import { Injectable, Logger } from '@nestjs/common';
import {
  BattleEventType as PrismaBattleEventType,
  BattleSide as PrismaBattleSide,
  EconomyAction,
  EconomyTransactionReason,
  HeroKey as PrismaHeroKey,
  Platform,
  Prisma,
  ResourceType,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type {
  BattleHeroState,
  BattleReplayResponse,
  HeroKey,
  HeroState,
  RaidHistoryResponse,
  RaidLootAmounts,
  RaidMatchOfferState,
  RaidOverviewResponse,
  RaidResourceType,
  RaidSearchResponse,
  RaidTeamPreview,
  ResourceAmounts,
} from '@crown-and-coin/shared';
import { BATTLE_RULES_VERSION } from '../battle/battle.config';
import { simulateBattle } from '../battle/battle.engine';
import type { BattleCombatHero } from '../battle/battle.types';
import { EconomyService } from '../economy/economy.service';
import { deriveHeroStats, heroUpgradeCost } from '../heroes/hero.calculator';
import { HERO_CONTENT, HERO_MAXIMUM_LEVEL } from '../heroes/hero.config';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { calculateRaidLoot, calculateTrophyDeltas } from './raid.calculator';
import { EMPTY_RAID_LOOT, RAID_HISTORY_LIMIT, RAID_OFFER_TTL_MS, RAID_RECENT_OPPONENT_LIMIT } from './raid.config';
import { RaidError } from './raid.errors';
import { RaidFixtureService } from './raid-fixture.service';
import { RaidRateLimiter } from './raid-rate-limiter.service';

const teamGraph = Prisma.validator<Prisma.RaidTeamDefaultArgs>()({
  include: { slots: { include: { playerHero: { include: { heroDefinition: true } } }, orderBy: { slot: 'asc' } } },
});
type TeamGraph = Prisma.RaidTeamGetPayload<typeof teamGraph>;
type Tx = Prisma.TransactionClient;

@Injectable()
export class RaidService {
  private readonly logger = new Logger(RaidService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly fixtures: RaidFixtureService,
    private readonly limiter: RaidRateLimiter,
  ) {}

  async overview(context: DevelopmentPlayerContext): Promise<RaidOverviewResponse> {
    const identity = await this.identity(context);
    this.limiter.assert(identity.playerId, 'overview');
    return this.loadOverview(identity.playerId);
  }

  async search(context: DevelopmentPlayerContext): Promise<RaidSearchResponse> {
    const identity = await this.identity(context);
    this.limiter.assert(identity.playerId, 'search');
    await this.fixtures.ensure();
    const overview = await this.loadOverview(identity.playerId);
    if (overview.team.heroes.length !== 3) throw new RaidError('INVALID_RAID_TEAM', 'Select exactly three Heroes before searching.');

    const recent = await this.prisma.raidMatchOffer.findMany({
      where: { attackerPlayerId: identity.playerId }, orderBy: { createdAt: 'desc' }, take: RAID_RECENT_OPPONENT_LIMIT,
      select: { defenderPlayerId: true },
    });
    const recentlySeen = recent.map((item) => item.defenderPlayerId);
    const candidates = await this.prisma.player.findMany({
      where: {
        id: { not: identity.playerId }, kingdom: { isNot: null }, raidTeam: { isNot: null },
        NOT: { raidTeam: { slots: { none: {} } } },
      },
      include: {
        kingdom: { include: { resourceBalances: true, buildings: { where: { type: 'CASTLE' }, take: 1 } } },
        raidTeam: teamGraph,
      },
      take: 100,
    });
    const valid = candidates
      .map((player) => ({ player, team: player.raidTeam ? this.presentTeam(player.raidTeam) : null }))
      .filter((item): item is typeof item & { team: RaidTeamPreview } => item.team?.heroes.length === 3);
    const passes = [
      { trophy: 150, power: 0.15, recent: false },
      { trophy: 300, power: 0.30, recent: false },
      { trophy: Number.MAX_SAFE_INTEGER, power: Number.MAX_SAFE_INTEGER, recent: false },
      { trophy: Number.MAX_SAFE_INTEGER, power: Number.MAX_SAFE_INTEGER, recent: true },
    ];
    let selected: (typeof valid)[number] | undefined;
    for (const pass of passes) {
      selected = valid
        .filter(({ player, team }) => (pass.recent || !recentlySeen.includes(player.id))
          && Math.abs(player.trophies - overview.player.trophies) <= pass.trophy
          && Math.abs(team.power - overview.team.power) <= Math.max(1, overview.team.power * pass.power))
        .sort((left, right) => {
          const leftScore = Math.abs(left.player.trophies - overview.player.trophies) + Math.abs(left.team.power - overview.team.power) / 10;
          const rightScore = Math.abs(right.player.trophies - overview.player.trophies) + Math.abs(right.team.power - overview.team.power) / 10;
          return leftScore - rightScore || left.player.id.localeCompare(right.player.id);
        })[0];
      if (selected) break;
    }
    if (!selected?.player.kingdom) throw new RaidError('NO_OPPONENT_AVAILABLE', 'No eligible opponent is available right now.');
    const potentialLoot = calculateRaidLoot(this.balanceMap(selected.player.kingdom.resourceBalances));
    const expiresAt = new Date(Date.now() + RAID_OFFER_TTL_MS);
    const offer = await this.prisma.raidMatchOffer.create({
      data: {
        attackerPlayerId: identity.playerId,
        defenderPlayerId: selected.player.id,
        attackerPower: overview.team.power,
        defenderPower: selected.team.power,
        potentialLoot: potentialLoot as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });
    return {
      ...overview,
      offer: this.presentOffer(offer.id, expiresAt, overview.team.power, selected.player, selected.team, potentialLoot),
    };
  }

  async start(context: DevelopmentPlayerContext, offerId: string, idempotencyKey?: string): Promise<BattleReplayResponse> {
    const key = this.validateKey(idempotencyKey);
    const identity = await this.identity(context);
    this.limiter.assert(identity.playerId, 'start');
    const hint = await this.prisma.raidMatchOffer.findUnique({ where: { id: offerId }, select: { attackerPlayerId: true, defenderPlayerId: true } });
    if (!hint) throw new RaidError('MATCH_OFFER_NOT_FOUND', 'This Raid offer does not exist.');
    if (hint.attackerPlayerId !== identity.playerId) throw new RaidError('MATCH_OFFER_NOT_OWNER', 'This Raid offer belongs to another player.');

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await this.lockPlayers(tx, [hint.attackerPlayerId, hint.defenderPlayerId]);
          const previous = await tx.economyRequest.findUnique({
            where: { playerId_idempotencyKey_action: { playerId: identity.playerId, idempotencyKey: key, action: EconomyAction.RAID_START } },
          });
          if (previous) return previous.response as unknown as BattleReplayResponse;
          const offer = await tx.raidMatchOffer.findUnique({ where: { id: offerId } });
          if (!offer) throw new RaidError('MATCH_OFFER_NOT_FOUND', 'This Raid offer does not exist.');
          if (offer.attackerPlayerId !== identity.playerId) throw new RaidError('MATCH_OFFER_NOT_OWNER', 'This Raid offer belongs to another player.');
          if (offer.attackerPlayerId === offer.defenderPlayerId) throw new RaidError('SELF_ATTACK_FORBIDDEN', 'A player cannot attack their own Kingdom.');
          if (offer.usedAt) throw new RaidError('MATCH_OFFER_ALREADY_USED', 'This Raid offer has already been used.');
          if (offer.expiresAt.getTime() <= Date.now()) throw new RaidError('MATCH_OFFER_EXPIRED', 'This Raid offer has expired. Find another opponent.');

          const attackerTeam = await this.loadCombatTeam(tx, offer.attackerPlayerId, 'ATTACKER');
          const defenderTeam = await this.loadCombatTeam(tx, offer.defenderPlayerId, 'DEFENDER');
          const seed = randomUUID();
          const engine = simulateBattle({ seed, rulesVersion: BATTLE_RULES_VERSION, attacker: attackerTeam, defender: defenderTeam });
          const players = await tx.player.findMany({
            where: { id: { in: [offer.attackerPlayerId, offer.defenderPlayerId] } },
            include: { kingdom: { include: { resourceBalances: true } } },
          });
          const attacker = players.find((player) => player.id === offer.attackerPlayerId);
          const defender = players.find((player) => player.id === offer.defenderPlayerId);
          if (!attacker?.kingdom || !defender?.kingdom) throw new RaidError('OPPONENT_NOT_FOUND', 'A Raid participant is unavailable.');
          const attackerWon = engine.result === 'ATTACKER_WIN';
          const loot = attackerWon ? calculateRaidLoot(this.balanceMap(defender.kingdom.resourceBalances)) : { ...EMPTY_RAID_LOOT };
          const calculatedDeltas = calculateTrophyDeltas(attacker.trophies, defender.trophies, attackerWon);
          const attackerDelta = Math.max(-attacker.trophies, calculatedDeltas.attacker);
          const defenderDelta = Math.max(-defender.trophies, calculatedDeltas.defender);
          const battleId = randomUUID();
          if (attackerWon) {
            await this.transferLoot(
              tx,
              battleId,
              { id: attacker.id, kingdom: attacker.kingdom },
              { id: defender.id, kingdom: defender.kingdom },
              loot,
            );
          }
          await tx.player.update({ where: { id: attacker.id }, data: { trophies: { increment: attackerDelta } } });
          await tx.player.update({ where: { id: defender.id }, data: { trophies: { increment: defenderDelta } } });
          const startedAt = new Date();
          const resolvedAt = new Date(startedAt.getTime() + engine.durationMs);
          await tx.battle.create({
            data: {
              id: battleId,
              matchOfferId: offer.id,
              status: 'REWARDED',
              attackerPlayerId: attacker.id,
              defenderPlayerId: defender.id,
              winnerPlayerId: attackerWon ? attacker.id : defender.id,
              result: engine.result,
              seed,
              rulesVersion: BATTLE_RULES_VERSION,
              durationMs: engine.durationMs,
              attackerTrophyBefore: attacker.trophies,
              defenderTrophyBefore: defender.trophies,
              attackerTrophyDelta: attackerDelta,
              defenderTrophyDelta: defenderDelta,
              loot: loot as unknown as Prisma.InputJsonValue,
              startedAt,
              resolvedAt,
              heroSnapshots: { create: [...attackerTeam, ...defenderTeam].map((hero) => ({
                side: hero.side as PrismaBattleSide, slot: hero.slot, heroKey: hero.key as PrismaHeroKey, level: hero.level,
                hp: hero.hp, atk: hero.atk, def: hero.def, power: hero.power, skillKey: hero.skillKey,
              })) },
              events: { create: engine.events.map((event) => ({
                sequence: event.sequence, timeMs: event.timeMs, type: event.type as PrismaBattleEventType,
                sourceSide: event.sourceSide as PrismaBattleSide | null, sourceSlot: event.sourceSlot,
                targetSide: event.targetSide as PrismaBattleSide | null, targetSlot: event.targetSlot,
                amount: event.amount, remainingHp: event.remainingHp, skillKey: event.skillKey,
              })) },
            },
          });
          await tx.raidMatchOffer.update({ where: { id: offer.id }, data: { usedAt: startedAt } });
          const response = await this.presentBattle(tx, battleId, attacker.id);
          await tx.economyRequest.create({
            data: { playerId: attacker.id, idempotencyKey: key, action: EconomyAction.RAID_START, response: response as unknown as Prisma.InputJsonValue },
          });
          this.logger.log(`raid-resolved battle=${battleId} attacker=${attacker.id} defender=${defender.id} result=${engine.result}`);
          return response;
        }, { maxWait: 5_000, timeout: 20_000 });
      } catch (error) {
        if (this.retryable(error) && attempt < 3) continue;
        if (this.retryable(error)) throw new RaidError('RAID_CONFLICT', 'The Raid is busy. Please retry.');
        throw error;
      }
    }
    throw new RaidError('RAID_CONFLICT', 'The Raid is busy. Please retry.');
  }

  async battle(context: DevelopmentPlayerContext, battleId: string): Promise<BattleReplayResponse> {
    const identity = await this.identity(context);
    this.limiter.assert(identity.playerId, 'battle');
    return this.prisma.$transaction((tx) => this.presentBattle(tx, battleId, identity.playerId));
  }

  async history(context: DevelopmentPlayerContext): Promise<RaidHistoryResponse> {
    const identity = await this.identity(context);
    const battles = await this.prisma.battle.findMany({
      where: { OR: [{ attackerPlayerId: identity.playerId }, { defenderPlayerId: identity.playerId }] },
      include: { attacker: true, defender: true }, orderBy: { createdAt: 'desc' }, take: RAID_HISTORY_LIMIT,
    });
    return { battles: battles.map((battle) => {
      const wasAttacker = battle.attackerPlayerId === identity.playerId;
      return {
        battleId: battle.id,
        opponentName: (wasAttacker ? battle.defender.displayName : battle.attacker.displayName) ?? 'Unknown Warden',
        result: battle.result,
        wasAttacker,
        trophyDelta: wasAttacker ? battle.attackerTrophyDelta : battle.defenderTrophyDelta,
        loot: (wasAttacker && battle.result === 'ATTACKER_WIN' ? battle.loot : EMPTY_RAID_LOOT) as RaidLootAmounts,
        createdAt: battle.createdAt.toISOString(),
      };
    }) };
  }

  private async identity(context: DevelopmentPlayerContext): Promise<{ playerId: string; kingdomId: string }> {
    await this.economy.getKingdom(context);
    const account = await this.prisma.platformAccount.findUniqueOrThrow({
      where: { platform_externalUserId: { platform: Platform.WEB, externalUserId: context.externalUserId } },
      include: { player: { include: { kingdom: true } } },
    });
    if (!account.player.kingdom) throw new Error('Player bootstrap did not create a Kingdom.');
    return { playerId: account.playerId, kingdomId: account.player.kingdom.id };
  }

  private async loadOverview(playerId: string): Promise<RaidOverviewResponse> {
    const player = await this.prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      include: { kingdom: { include: { resourceBalances: true, buildings: { where: { type: 'CASTLE' }, take: 1 } } }, raidTeam: teamGraph },
    });
    if (!player.kingdom || !player.raidTeam) throw new RaidError('INVALID_RAID_TEAM', 'Your Raid Team is not ready.');
    return {
      player: { id: player.id, displayName: player.displayName ?? 'Warden of Dawnkeep', level: player.kingdom.buildings[0]?.level ?? player.kingdom.level, trophies: player.trophies },
      balances: this.presentBalances(player.kingdom.resourceBalances),
      team: this.presentTeam(player.raidTeam),
      serverTime: new Date().toISOString(),
    };
  }

  private presentTeam(team: TeamGraph): RaidTeamPreview {
    const heroes = team.slots.map((slot): HeroState => {
      const key = slot.playerHero.heroDefinition.key as HeroKey;
      const config = HERO_CONTENT[key];
      const stats = deriveHeroStats(config, slot.playerHero.level);
      const cost = slot.playerHero.level >= HERO_MAXIMUM_LEVEL ? null : heroUpgradeCost(slot.playerHero.level);
      return {
        id: slot.playerHero.id, key, level: slot.playerHero.level, class: config.combatClass, ...stats,
        skill: { key: config.skillKey }, portraitAsset: config.portraitAsset, canUpgrade: false,
        maximumLevel: HERO_MAXIMUM_LEVEL, upgradeCost: cost === null ? null : { gold: cost.toString() },
      };
    });
    return { heroes, power: heroes.reduce((total, hero) => total + hero.power, 0) };
  }

  private presentOffer(id: string, expiresAt: Date, ownPower: number, player: { id: string; displayName: string | null; trophies: number; kingdom: { level: number; buildings: { level: number }[] } | null }, team: RaidTeamPreview, potentialLoot: RaidLootAmounts): RaidMatchOfferState {
    return {
      id, expiresAt: expiresAt.toISOString(), ownPower,
      opponent: {
        id: player.id, displayName: player.displayName ?? 'Unknown Warden', castleLevel: player.kingdom?.buildings[0]?.level ?? player.kingdom?.level ?? 1,
        trophies: player.trophies, teamPower: team.power, team: team.heroes,
      },
      potentialLoot,
    };
  }

  private async loadCombatTeam(tx: Tx, playerId: string, side: 'ATTACKER' | 'DEFENDER'): Promise<BattleCombatHero[]> {
    const team = await tx.raidTeam.findUnique({ where: { playerId }, ...teamGraph });
    if (!team || team.slots.length !== 3 || team.slots.some((slot) => slot.playerHero.playerId !== playerId || !slot.playerHero.heroDefinition.enabled)) {
      throw new RaidError('INVALID_RAID_TEAM', 'Both Raid Teams must contain exactly three enabled, owned Heroes.');
    }
    return team.slots.map((slot) => {
      const key = slot.playerHero.heroDefinition.key as HeroKey;
      const stats = deriveHeroStats(HERO_CONTENT[key], slot.playerHero.level);
      return { side, slot: slot.slot as 1 | 2 | 3, key, level: slot.playerHero.level, ...stats, skillKey: HERO_CONTENT[key].skillKey };
    });
  }

  private async transferLoot(tx: Tx, battleId: string, attacker: { id: string; kingdom: { id: string; resourceBalances: { id: string; resource: ResourceType; amount: bigint }[] } }, defender: { id: string; kingdom: { id: string; resourceBalances: { id: string; resource: ResourceType; amount: bigint }[] } }, loot: RaidLootAmounts): Promise<void> {
    for (const resource of Object.keys(loot) as RaidResourceType[]) {
      const amount = BigInt(loot[resource]);
      if (amount <= 0n) continue;
      const from = defender.kingdom.resourceBalances.find((balance) => balance.resource === resource);
      const to = attacker.kingdom.resourceBalances.find((balance) => balance.resource === resource);
      if (!from || !to) throw new RaidError('INSUFFICIENT_OR_INVALID_STATE', 'Raid balances are incomplete.');
      const debited = await tx.resourceBalance.updateMany({ where: { id: from.id, amount: { gte: amount } }, data: { amount: { decrement: amount } } });
      if (debited.count !== 1) throw new RaidError('INSUFFICIENT_OR_INVALID_STATE', 'Opponent resources changed. Please retry.');
      await tx.resourceBalance.update({ where: { id: to.id }, data: { amount: { increment: amount } } });
      await tx.economyTransaction.createMany({ data: [
        { playerId: attacker.id, kingdomId: attacker.kingdom.id, balanceId: to.id, resourceType: resource as ResourceType, delta: amount, balanceBefore: to.amount, balanceAfter: to.amount + amount, reason: EconomyTransactionReason.RAID_REWARD, referenceId: battleId },
        { playerId: defender.id, kingdomId: defender.kingdom.id, balanceId: from.id, resourceType: resource as ResourceType, delta: -amount, balanceBefore: from.amount, balanceAfter: from.amount - amount, reason: EconomyTransactionReason.RAID_LOSS, referenceId: battleId },
      ] });
    }
  }

  private async presentBattle(tx: Tx, battleId: string, requestingPlayerId: string): Promise<BattleReplayResponse> {
    const battle = await tx.battle.findUnique({
      where: { id: battleId },
      include: {
        attacker: { include: { kingdom: { include: { resourceBalances: true } } } },
        defender: { include: { kingdom: { include: { resourceBalances: true } } } },
        heroSnapshots: { orderBy: [{ side: 'asc' }, { slot: 'asc' }] },
        events: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!battle) throw new RaidError('BATTLE_NOT_FOUND', 'This battle does not exist.');
    if (battle.attackerPlayerId !== requestingPlayerId && battle.defenderPlayerId !== requestingPlayerId) throw new RaidError('BATTLE_NOT_PARTICIPANT', 'Only battle participants may view this replay.');
    const portrait = (key: HeroKey): string => HERO_CONTENT[key].portraitAsset;
    const heroes = battle.heroSnapshots.map((hero): BattleHeroState => ({
      side: hero.side, slot: hero.slot as 1 | 2 | 3, key: hero.heroKey, level: hero.level, hp: hero.hp, atk: hero.atk,
      def: hero.def, power: hero.power, skillKey: hero.skillKey as BattleHeroState['skillKey'], portraitAsset: portrait(hero.heroKey),
    }));
    return {
      id: battle.id, seed: battle.seed, rulesVersion: battle.rulesVersion, result: battle.result, winnerPlayerId: battle.winnerPlayerId,
      durationMs: battle.durationMs,
      attacker: { playerId: battle.attacker.id, displayName: battle.attacker.displayName ?? 'Warden', trophiesBefore: battle.attackerTrophyBefore, trophyDelta: battle.attackerTrophyDelta },
      defender: { playerId: battle.defender.id, displayName: battle.defender.displayName ?? 'Warden', trophiesBefore: battle.defenderTrophyBefore, trophyDelta: battle.defenderTrophyDelta },
      teams: { attacker: heroes.filter((hero) => hero.side === 'ATTACKER'), defender: heroes.filter((hero) => hero.side === 'DEFENDER') },
      events: battle.events.map((event) => ({
        sequence: event.sequence, timeMs: event.timeMs, type: event.type, sourceSide: event.sourceSide, sourceSlot: event.sourceSlot as 1 | 2 | 3 | null,
        targetSide: event.targetSide, targetSlot: event.targetSlot as 1 | 2 | 3 | null, amount: event.amount, remainingHp: event.remainingHp,
        skillKey: event.skillKey as BattleReplayResponse['events'][number]['skillKey'],
      })),
      loot: battle.loot as RaidLootAmounts,
      balances: requestingPlayerId === battle.attackerPlayerId && battle.attacker.kingdom
        ? this.presentBalances(battle.attacker.kingdom.resourceBalances)
        : battle.defender.kingdom
          ? this.presentBalances(battle.defender.kingdom.resourceBalances)
          : { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' },
      resolvedAt: battle.resolvedAt.toISOString(),
    };
  }

  private async lockPlayers(tx: Tx, ids: string[]): Promise<void> {
    const accounts = await tx.platformAccount.findMany({ where: { playerId: { in: [...ids].sort() }, platform: Platform.WEB }, orderBy: { playerId: 'asc' } });
    for (const account of accounts) await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext(${`${account.platform}:${account.externalUserId}`}))`;
  }

  private presentBalances(rows: { resource: ResourceType; amount: bigint }[]): ResourceAmounts {
    const result: ResourceAmounts = { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' };
    for (const row of rows) result[row.resource] = row.amount.toString();
    return result;
  }

  private balanceMap(rows: { resource: ResourceType; amount: bigint }[]): Partial<Record<RaidResourceType, bigint>> {
    const result: Partial<Record<RaidResourceType, bigint>> = {};
    for (const row of rows) if (row.resource !== ResourceType.GEMS) result[row.resource] = row.amount;
    return result;
  }

  private validateKey(value?: string): string {
    const key = value?.trim();
    if (!key || key.length < 8 || key.length > 100) throw new RaidError('INVALID_IDEMPOTENCY_KEY', 'A valid Idempotency-Key header is required.');
    return key;
  }

  private retryable(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002');
  }
}
