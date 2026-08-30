import { Injectable, Logger } from '@nestjs/common';
import {
  BattleEventType as PrismaBattleEventType,
  BattleSide as PrismaBattleSide,
  BattleType as PrismaBattleType,
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
  BattleArmySquadState,
  BattleReplayResponse,
  ArmyPreview,
  ArmyFormationSlotState,
  DefenseInboxResponse,
  HeroKey,
  RaidHistoryResponse,
  RaidLootAmounts,
  RaidMatchOfferState,
  RaidOverviewResponse,
  RaidResourceType,
  RaidSearchResponse,
  RevengePreviewResponse,
  ResourceAmounts,
} from '@crown-and-coin/shared';
import { ARMY_BATTLE_RULES_VERSION } from '../battle/battle.config';
import { resolveBattleSimulation } from '../battle/battle-simulation';
import type { ArmyCombatSquad } from '../battle/battle.types';
import { ArmyService } from '../army/army.service';
import { ArmyError } from '../army/army.errors';
import { calculateArmySquad } from '../army/army-power.calculator';
import { EconomyService } from '../economy/economy.service';
import { deriveHeroStats } from '../heroes/hero.calculator';
import { HERO_CONTENT } from '../heroes/hero.config';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import type { DevelopmentPlayerContext } from '../player/player-context.service';
import { calculateRaidLoot, calculateTrophyDeltas } from './raid.calculator';
import {
  EMPTY_RAID_LOOT,
  NEW_KINGDOM_SHIELD_MS,
  RAID_HISTORY_LIMIT,
  RAID_OFFER_TTL_MS,
  RAID_RECENT_OPPONENT_LIMIT,
  REAL_PLAYER_MATCH_PASSES,
  REAL_PLAYER_REPEAT_RAID_COOLDOWN_MS,
  REVENGE_TTL_MS,
} from './raid.config';
import { RaidError } from './raid.errors';
import {
  matchesRealPlayerPass,
  newPlayerProtection,
  RaidCandidateSelector,
  rankMatchCandidates,
} from './raid.matchmaking';
import { RaidRateLimiter } from './raid-rate-limiter.service';
import { kingdomEffectBps } from '../kingdom/kingdom-effects.config';
import type { ConfiguredSystemOpponent } from './system-opponent.config';
import { SystemOpponentService } from './system-opponent.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { armyFingerprint } from './raid-army-fingerprint';

const teamGraph = Prisma.validator<Prisma.RaidTeamDefaultArgs>()({
  include: { slots: { include: { playerHero: { include: { heroDefinition: true } } }, orderBy: { slot: 'asc' } } },
});
type TeamGraph = Prisma.RaidTeamGetPayload<typeof teamGraph>;
const armyGraph = Prisma.validator<Prisma.ArmyFormationDefaultArgs>()({
  include: {
    slots: {
      include: { commander: { include: { heroDefinition: true } } },
      orderBy: { slot: 'asc' },
    },
  },
});
type ArmyGraph = Prisma.ArmyFormationGetPayload<typeof armyGraph>;
const candidateGraph = Prisma.validator<Prisma.PlayerDefaultArgs>()({
  include: {
    kingdom: { include: { resourceBalances: true, buildings: { where: { type: { in: ['CASTLE', 'WATCHTOWER'] } } } } },
    armyFormation: armyGraph,
    troops: true,
  },
});
type CandidatePlayer = Prisma.PlayerGetPayload<typeof candidateGraph>;
type Tx = Prisma.TransactionClient;

interface ResolveBattleInput {
  type: PrismaBattleType;
  attackerPlayerId: string;
  defenderPlayerId: string;
  requestingPlayerId: string;
  matchOfferId?: string;
  revengeTargetId?: string;
  campaignStageKey?: string;
  attackerArmy?: ArmyCombatSquad[];
  snapshotTime?: Date;
}

interface MatchCandidate {
  player: CandidatePlayer;
  army: ArmyPreview;
  team: { power: number };
  kind: 'REAL' | 'SYSTEM';
  systemConfig?: ConfiguredSystemOpponent;
}

@Injectable()
export class RaidService {
  private readonly logger = new Logger(RaidService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly systems: SystemOpponentService,
    private readonly candidateSelector: RaidCandidateSelector,
    private readonly limiter: RaidRateLimiter,
    private readonly notifications: NotificationService,
    private readonly analytics: AnalyticsService,
    private readonly armyService: ArmyService,
    private readonly onboarding: OnboardingService = new OnboardingService(prisma, analytics),
  ) {}

  async overview(context: DevelopmentPlayerContext): Promise<RaidOverviewResponse> {
    const identity = await this.identity(context);
    this.limiter.assert(identity.playerId, 'overview');
    return this.loadOverview(identity.playerId);
  }

  async search(context: DevelopmentPlayerContext): Promise<RaidSearchResponse> {
    const identity = await this.identity(context);
    this.limiter.assert(identity.playerId, 'search');
    await this.systems.ensure();
    const now = new Date();
    const overview = await this.loadOverview(identity.playerId, now);
    if (overview.army.squads.length !== 3) throw new RaidError('INVALID_ARMY_FORMATION', 'Prepare three Army squads before searching.');

    const recent = await this.prisma.raidMatchOffer.findMany({
      where: { attackerPlayerId: identity.playerId }, orderBy: { createdAt: 'desc' }, take: RAID_RECENT_OPPONENT_LIMIT,
      select: { defenderPlayerId: true },
    });
    const recentlySeen = new Set(recent.map((item) => item.defenderPlayerId));
    const immediateOpponentId = recent[0]?.defenderPlayerId;
    const systemConfigs = await this.systems.configuredPlayers();
    const systemPlayers = await this.prisma.player.findMany({
      where: {
        id: { in: [...systemConfigs.keys()], not: identity.playerId },
        isSystemOpponent: true,
        systemOpponentKind: 'RAID',
        kingdom: { isNot: null }, armyFormation: { isNot: null },
        NOT: { armyFormation: { slots: { none: {} } } },
      },
      ...candidateGraph,
    });
    const systemCandidates = this.presentCandidates(systemPlayers, 'SYSTEM', systemConfigs);

    let realCandidates: MatchCandidate[] = [];
    let repeatFarmed = new Set<string>();
    if (!overview.newPlayerProtection.active) {
      const shieldCutoff = new Date(now.getTime() - NEW_KINGDOM_SHIELD_MS);
      const minimumTrophies = Math.max(0, overview.player.trophies - REAL_PLAYER_MATCH_PASSES.at(-1)!.trophyDifference);
      const maximumTrophies = overview.player.trophies + REAL_PLAYER_MATCH_PASSES.at(-1)!.trophyDifference;
      const [realPlayers, recentBattles] = await Promise.all([
        this.prisma.player.findMany({
          where: {
            id: { not: identity.playerId },
            isSystemOpponent: false,
            createdAt: { lte: shieldCutoff },
            trophies: { gte: minimumTrophies, lte: maximumTrophies },
            kingdom: { isNot: null }, armyFormation: { isNot: null },
            NOT: { armyFormation: { slots: { none: {} } } },
          },
          ...candidateGraph,
        }),
        this.prisma.battle.findMany({
          where: {
            type: PrismaBattleType.RAID,
            attackerPlayerId: identity.playerId,
            createdAt: { gte: new Date(now.getTime() - REAL_PLAYER_REPEAT_RAID_COOLDOWN_MS) },
          },
          select: { defenderPlayerId: true },
        }),
      ]);
      repeatFarmed = new Set(recentBattles.map((battle) => battle.defenderPlayerId));
      realCandidates = this.presentCandidates(realPlayers, 'REAL')
        .filter((candidate) => !repeatFarmed.has(candidate.player.id));
    }

    const nonRecentReal = realCandidates.filter((candidate) => !recentlySeen.has(candidate.player.id));
    const nonRecentSystem = systemCandidates.filter((candidate) => !recentlySeen.has(candidate.player.id));
    const olderRecentReal = realCandidates.filter((candidate) => candidate.player.id !== immediateOpponentId);
    const olderRecentSystem = systemCandidates.filter((candidate) => candidate.player.id !== immediateOpponentId);
    let selected = this.selectRealCandidate(nonRecentReal, overview)
      ?? this.selectRankedCandidate(nonRecentSystem, overview)
      ?? this.selectRealCandidate(olderRecentReal, overview)
      ?? this.selectRankedCandidate(olderRecentSystem, overview)
      ?? this.selectRankedCandidate(systemCandidates, overview);
    if (selected?.player.id === immediateOpponentId) {
      this.logger.warn(`raid-immediate-repeat attacker=${identity.playerId} defender=${selected.player.id}`);
    }
    if (!selected?.player.kingdom) throw new RaidError('NO_OPPONENT_AVAILABLE', 'No eligible opponent is available right now.');
    const defenderState = selected.kind === 'SYSTEM' && selected.systemConfig
      ? await this.systems.prepareForOffer(selected.player.id, selected.systemConfig)
      : selected.player.kingdom;
    const potentialLoot = calculateRaidLoot(
      this.balanceMap(defenderState.resourceBalances),
      this.watchtowerProtectionBps(defenderState.buildings),
    );
    const expiresAt = new Date(now.getTime() + RAID_OFFER_TTL_MS);
    const offer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.raidMatchOffer.create({
        data: {
          attackerPlayerId: identity.playerId,
          defenderPlayerId: selected.player.id,
          attackerPower: overview.army.power,
          attackerArmyFingerprint: armyFingerprint(overview.army.squads.map((squad) => ({
            slot: squad.slot,
            troopType: squad.troopType,
            unitCount: squad.unitCount,
            commanderPlayerHeroId: squad.commander.playerHeroId,
            commanderKey: squad.commander.key,
            commanderLevel: squad.commander.level,
          }))),
          defenderPower: selected.army.power,
          potentialLoot: potentialLoot as unknown as Prisma.InputJsonValue,
          expiresAt,
        },
      });
      await this.analytics.recordServer(tx, {
        playerId: identity.playerId, eventName: 'raid_search', dedupeKey: `raid_search:${created.id}`,
        properties: { opponentKind: selected.kind }, occurredAt: now,
      });
      return created;
    });
    return {
      ...overview,
      offer: this.presentOffer(offer.id, expiresAt, overview.army.power, selected.player, selected.army, potentialLoot, selected.kind),
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

          const snapshotTime = new Date();
          let attackerArmy: ArmyCombatSquad[];
          try {
            attackerArmy = await this.armyService.loadBattleArmy(tx, offer.attackerPlayerId, 'ATTACKER', snapshotTime);
          } catch (error) {
            if (!(error instanceof ArmyError)) throw error;
            throw new RaidError('MATCH_OFFER_ARMY_CHANGED', 'Your Army changed after finding this opponent. Find another enemy.');
          }
          const currentFingerprint = armyFingerprint(attackerArmy.map((squad) => ({
            slot: squad.slot,
            troopType: squad.troopType,
            unitCount: squad.initialUnitCount,
            commanderPlayerHeroId: squad.commanderPlayerHeroId,
            commanderKey: squad.commanderKey,
            commanderLevel: squad.commanderLevel,
          })));
          if (!offer.attackerArmyFingerprint || offer.attackerArmyFingerprint !== currentFingerprint) {
            throw new RaidError('MATCH_OFFER_ARMY_CHANGED', 'Your Army changed after finding this opponent. Find another enemy.');
          }

          const response = await this.resolveBattle(tx, {
            type: PrismaBattleType.RAID,
            attackerPlayerId: offer.attackerPlayerId,
            defenderPlayerId: offer.defenderPlayerId,
            requestingPlayerId: identity.playerId,
            matchOfferId: offer.id,
            attackerArmy,
            snapshotTime,
          });
          await tx.raidMatchOffer.update({ where: { id: offer.id }, data: { usedAt: new Date() } });
          await tx.economyRequest.create({
            data: { playerId: identity.playerId, idempotencyKey: key, action: EconomyAction.RAID_START, response: response as unknown as Prisma.InputJsonValue },
          });
          this.logger.log(`raid-resolved battle=${response.id} attacker=${offer.attackerPlayerId} defender=${offer.defenderPlayerId} result=${response.result}`);
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

  async inbox(context: DevelopmentPlayerContext): Promise<DefenseInboxResponse> {
    const identity = await this.identity(context);
    const now = new Date();
    await this.prisma.revengeTarget.updateMany({
      where: { playerId: identity.playerId, status: 'AVAILABLE', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });
    const [battles, unreadCount] = await Promise.all([
      this.prisma.battle.findMany({
        where: { defenderPlayerId: identity.playerId, type: { in: [PrismaBattleType.RAID, PrismaBattleType.REVENGE] } },
        include: { attacker: true, revengeSource: true },
        orderBy: { createdAt: 'desc' },
        take: RAID_HISTORY_LIMIT,
      }),
      this.prisma.notification.count({
        where: { playerId: identity.playerId, type: 'PLAYER_RAIDED', readAt: null },
      }),
    ]);
    return {
      unreadCount,
      serverTime: now.toISOString(),
      entries: battles.map((battle) => ({
        battleId: battle.id,
        battleType: battle.type,
        attacker: { id: battle.attacker.id, displayName: battle.attacker.displayName ?? 'Unknown Warden' },
        createdAt: battle.createdAt.toISOString(),
        defenseResult: battle.result === 'DEFENDER_WIN' ? 'DEFENSE_WIN' : 'DEFENSE_LOSS',
        lootLost: (battle.result === 'ATTACKER_WIN' ? battle.loot : EMPTY_RAID_LOOT) as RaidLootAmounts,
        trophyDelta: battle.defenderTrophyDelta,
        revengeStatus: battle.revengeSource?.status ?? 'UNAVAILABLE',
        revengeTargetId: battle.revengeSource?.id ?? null,
        revengeExpiresAt: battle.revengeSource?.expiresAt.toISOString() ?? null,
      })),
    };
  }

  async markInboxRead(context: DevelopmentPlayerContext): Promise<{ readCount: number }> {
    const identity = await this.identity(context);
    return { readCount: await this.notifications.markIncomingRead(identity.playerId) };
  }

  async revengePreview(context: DevelopmentPlayerContext, revengeTargetId: string): Promise<RevengePreviewResponse> {
    const identity = await this.identity(context);
    const now = new Date();
    await this.prisma.revengeTarget.updateMany({
      where: { id: revengeTargetId, status: 'AVAILABLE', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });
    const target = await this.prisma.revengeTarget.findUnique({
      where: { id: revengeTargetId },
      include: {
        sourceBattle: true,
        targetPlayer: {
          include: {
            kingdom: { include: { resourceBalances: true, buildings: { where: { type: 'WATCHTOWER' }, take: 1 } } },
            armyFormation: armyGraph,
            troops: true,
          },
        },
      },
    });
    this.assertRevengeTarget(target, identity.playerId, now);
    const own = await this.loadOverview(identity.playerId);
    if (!target.targetPlayer.kingdom || !target.targetPlayer.armyFormation) throw new RaidError('OPPONENT_NOT_FOUND', 'The revenge target is unavailable.');
    const targetArmy = this.presentArmy(target.targetPlayer.armyFormation, target.targetPlayer.troops);
    if (targetArmy.squads.length !== 3) throw new RaidError('INVALID_ARMY_FORMATION', 'The revenge target has no valid Army formation.');
    return {
      revengeTargetId: target.id,
      sourceBattleId: target.sourceBattleId,
      status: target.status,
      target: {
        id: target.targetPlayer.id,
        displayName: target.targetPlayer.displayName ?? 'Unknown Warden',
        trophies: target.targetPlayer.trophies,
        armyPower: targetArmy.power,
        army: targetArmy.squads,
      },
      ownArmy: own.army,
      potentialLoot: calculateRaidLoot(
        this.balanceMap(target.targetPlayer.kingdom.resourceBalances),
        this.watchtowerProtectionBps(target.targetPlayer.kingdom.buildings),
      ),
      expiresAt: target.expiresAt.toISOString(),
      serverTime: now.toISOString(),
    };
  }

  async startRevenge(context: DevelopmentPlayerContext, revengeTargetId: string, idempotencyKey?: string): Promise<BattleReplayResponse> {
    const key = this.validateKey(idempotencyKey);
    const identity = await this.identity(context);
    this.limiter.assert(identity.playerId, 'start');
    const hint = await this.prisma.revengeTarget.findUnique({
      where: { id: revengeTargetId },
      select: { playerId: true, targetPlayerId: true },
    });
    if (!hint) throw new RaidError('REVENGE_NOT_FOUND', 'This revenge opportunity does not exist.');
    if (hint.playerId !== identity.playerId) throw new RaidError('REVENGE_NOT_OWNER', 'This revenge opportunity belongs to another player.');
    await this.prisma.revengeTarget.updateMany({
      where: { id: revengeTargetId, status: 'AVAILABLE', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await this.lockPlayers(tx, [hint.playerId, hint.targetPlayerId]);
          const previous = await tx.economyRequest.findUnique({
            where: { playerId_idempotencyKey_action: { playerId: identity.playerId, idempotencyKey: key, action: EconomyAction.REVENGE_START } },
          });
          if (previous) return previous.response as unknown as BattleReplayResponse;
          await tx.$queryRaw`SELECT "id" FROM "RevengeTarget" WHERE "id" = ${revengeTargetId} FOR UPDATE`;
          const now = new Date();
          await tx.revengeTarget.updateMany({
            where: { id: revengeTargetId, status: 'AVAILABLE', expiresAt: { lte: now } },
            data: { status: 'EXPIRED' },
          });
          const target = await tx.revengeTarget.findUnique({ where: { id: revengeTargetId }, include: { sourceBattle: true } });
          this.assertRevengeTarget(target, identity.playerId, now);
          if (
            target.sourceBattle.type !== PrismaBattleType.RAID
            || target.sourceBattle.result !== 'ATTACKER_WIN'
            || target.sourceBattle.attackerPlayerId !== target.targetPlayerId
            || target.sourceBattle.defenderPlayerId !== target.playerId
          ) throw new RaidError('REVENGE_INVALID_SOURCE', 'This battle cannot create a revenge.');

          const response = await this.resolveBattle(tx, {
            type: PrismaBattleType.REVENGE,
            attackerPlayerId: target.playerId,
            defenderPlayerId: target.targetPlayerId,
            requestingPlayerId: identity.playerId,
            revengeTargetId: target.id,
          });
          await tx.revengeTarget.update({ where: { id: target.id }, data: { status: 'USED', usedAt: new Date() } });
          await tx.economyRequest.create({
            data: { playerId: identity.playerId, idempotencyKey: key, action: EconomyAction.REVENGE_START, response: response as unknown as Prisma.InputJsonValue },
          });
          this.logger.log(`revenge-resolved battle=${response.id} target=${target.id} result=${response.result}`);
          return response;
        }, { maxWait: 5_000, timeout: 20_000 });
      } catch (error) {
        if (this.retryable(error) && attempt < 3) continue;
        if (this.retryable(error)) throw new RaidError('RAID_CONFLICT', 'The revenge is busy. Please retry.');
        throw error;
      }
    }
    throw new RaidError('RAID_CONFLICT', 'The revenge is busy. Please retry.');
  }

  async battle(context: DevelopmentPlayerContext, battleId: string): Promise<BattleReplayResponse> {
    const identity = await this.identity(context);
    this.limiter.assert(identity.playerId, 'battle');
    return this.prisma.$transaction((tx) => this.presentBattle(tx, battleId, identity.playerId));
  }

  async resolveCampaignBattle(
    tx: Tx,
    input: { attackerPlayerId: string; defenderPlayerId: string; stageKey: string; snapshotTime: Date },
  ): Promise<Extract<BattleReplayResponse, { rulesVersion: 2 }>> {
    const replay = await this.resolveBattle(tx, {
      type: PrismaBattleType.CAMPAIGN,
      attackerPlayerId: input.attackerPlayerId,
      defenderPlayerId: input.defenderPlayerId,
      requestingPlayerId: input.attackerPlayerId,
      campaignStageKey: input.stageKey,
      snapshotTime: input.snapshotTime,
    });
    if (replay.rulesVersion !== 2) throw new Error('Campaign Battle did not use Army rules version 2.');
    return replay;
  }

  async history(context: DevelopmentPlayerContext): Promise<RaidHistoryResponse> {
    const identity = await this.identity(context);
    const battles = await this.prisma.battle.findMany({
      where: {
        type: { in: [PrismaBattleType.RAID, PrismaBattleType.REVENGE] },
        OR: [{ attackerPlayerId: identity.playerId }, { defenderPlayerId: identity.playerId }],
      },
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

  private async loadOverview(playerId: string, now = new Date()): Promise<RaidOverviewResponse> {
    const player = await this.prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      include: {
        kingdom: { include: { resourceBalances: true, buildings: { where: { type: 'CASTLE' }, take: 1 } } },
        armyFormation: armyGraph,
        troops: true,
      },
    });
    if (!player.kingdom || !player.armyFormation) throw new RaidError('INVALID_ARMY_FORMATION', 'Your Army is not ready.');
    return {
      player: { id: player.id, displayName: player.displayName ?? 'Warden of Dawnkeep', level: player.kingdom.buildings[0]?.level ?? player.kingdom.level, trophies: player.trophies },
      balances: this.presentBalances(player.kingdom.resourceBalances),
      army: this.presentArmy(player.armyFormation, player.troops),
      newPlayerProtection: newPlayerProtection(player.createdAt, player.isSystemOpponent, now),
      serverTime: now.toISOString(),
    };
  }

  private presentArmy(formation: ArmyGraph, troops: { troopType: string; readyCount: number }[]): ArmyPreview {
    if (formation.slots.length !== 3
      || new Set(formation.slots.map((slot) => slot.commanderPlayerHeroId)).size !== 3
      || formation.slots.some((slot) => slot.commander.playerId !== formation.playerId || !slot.commander.heroDefinition.enabled)) {
      return { squads: [], power: 0 };
    }
    const assignedByType = new Map<string, number>();
    for (const slot of formation.slots) assignedByType.set(slot.troopType, (assignedByType.get(slot.troopType) ?? 0) + slot.unitCount);
    if ([...assignedByType].some(([type, assigned]) => assigned <= 0 || assigned > (troops.find((troop) => troop.troopType === type)?.readyCount ?? 0))) {
      return { squads: [], power: 0 };
    }
    const squads = formation.slots.map((slot): ArmyFormationSlotState => {
      const key = slot.commander.heroDefinition.key as HeroKey;
      const stats = deriveHeroStats(HERO_CONTENT[key], slot.commander.level);
      const calculated = calculateArmySquad({
        troopType: slot.troopType,
        unitCount: slot.unitCount,
        commanderKey: key,
        commanderLevel: slot.commander.level,
        commanderSkillKey: HERO_CONTENT[key].skillKey,
        commanderPower: stats.power,
      });
      return {
        slot: slot.slot as 1 | 2 | 3,
        troopType: slot.troopType,
        unitCount: slot.unitCount,
        squadPower: calculated.squadPower,
        commander: {
          playerHeroId: slot.commander.id,
          key,
          level: slot.commander.level,
          power: stats.power,
          portraitAsset: slot.commander.heroDefinition.portraitAsset,
        },
      };
    });
    return { squads, power: squads.reduce((total, squad) => total + squad.squadPower, 0) };
  }

  private presentOffer(id: string, expiresAt: Date, ownPower: number, player: { id: string; displayName: string | null; trophies: number; kingdom: { level: number; buildings: { type: string; level: number }[] } | null }, army: ArmyPreview, potentialLoot: RaidLootAmounts, kind: 'REAL' | 'SYSTEM'): RaidMatchOfferState {
    return {
      id, expiresAt: expiresAt.toISOString(), ownPower,
      opponent: {
        id: player.id, displayName: player.displayName ?? 'Unknown Warden', castleLevel: player.kingdom?.buildings.find((building) => building.type === 'CASTLE')?.level ?? player.kingdom?.level ?? 1,
        trophies: player.trophies, armyPower: army.power, army: army.squads, kind,
      },
      potentialLoot,
    };
  }

  private presentCandidates(
    players: CandidatePlayer[],
    kind: 'REAL' | 'SYSTEM',
    systemConfigs?: Map<string, ConfiguredSystemOpponent>,
  ): MatchCandidate[] {
    return players.flatMap((player) => {
      if (!player.armyFormation) return [];
      const army = this.presentArmy(player.armyFormation, player.troops);
      if (army.squads.length !== 3) return [];
      const systemConfig = systemConfigs?.get(player.id);
      if (kind === 'SYSTEM' && !systemConfig) return [];
      return [{ player, army, team: { power: army.power }, kind, systemConfig }];
    });
  }

  private selectRealCandidate(
    candidates: MatchCandidate[],
    overview: RaidOverviewResponse,
  ): MatchCandidate | undefined {
    for (const pass of REAL_PLAYER_MATCH_PASSES) {
      const eligible = candidates.filter((candidate) => matchesRealPlayerPass(
        candidate,
        overview.player.trophies,
        overview.army.power,
        pass,
      ));
      const selected = this.selectRankedCandidate(eligible, overview);
      if (selected) return selected;
    }
    return undefined;
  }

  private selectRankedCandidate(
    candidates: MatchCandidate[],
    overview: RaidOverviewResponse,
  ): MatchCandidate | undefined {
    return this.candidateSelector.select(rankMatchCandidates(
      candidates,
      overview.player.trophies,
      overview.army.power,
    ));
  }

  private async resolveBattle(tx: Tx, input: ResolveBattleInput): Promise<BattleReplayResponse> {
    const snapshotTime = input.snapshotTime ?? new Date();
    let attackerArmy: ArmyCombatSquad[];
    let defenderArmy: ArmyCombatSquad[];
    try {
      attackerArmy = input.attackerArmy ?? await this.armyService.loadBattleArmy(tx, input.attackerPlayerId, 'ATTACKER', snapshotTime);
      defenderArmy = await this.armyService.loadBattleArmy(tx, input.defenderPlayerId, 'DEFENDER', snapshotTime);
    } catch (error) {
      if (!(error instanceof ArmyError)) throw error;
      throw new RaidError('INVALID_ARMY_FORMATION', 'Both players need a valid battle-ready Army formation.');
    }
    const seed = randomUUID();
    const engine = resolveBattleSimulation({ seed, rulesVersion: ARMY_BATTLE_RULES_VERSION, attacker: attackerArmy, defender: defenderArmy });
    const players = await tx.player.findMany({
      where: { id: { in: [input.attackerPlayerId, input.defenderPlayerId] } },
      include: { kingdom: { include: { resourceBalances: true, buildings: { where: { type: 'WATCHTOWER' }, take: 1 } } } },
    });
    const attacker = players.find((player) => player.id === input.attackerPlayerId);
    const defender = players.find((player) => player.id === input.defenderPlayerId);
    if (!attacker?.kingdom || !defender?.kingdom) throw new RaidError('OPPONENT_NOT_FOUND', 'A battle participant is unavailable.');
    const attackerWon = engine.result === 'ATTACKER_WIN';
    const campaignBattle = input.type === PrismaBattleType.CAMPAIGN;
    const loot = attackerWon && !campaignBattle ? calculateRaidLoot(
      this.balanceMap(defender.kingdom.resourceBalances),
      this.watchtowerProtectionBps(defender.kingdom.buildings),
    ) : { ...EMPTY_RAID_LOOT };
    const calculatedDeltas = calculateTrophyDeltas(attacker.trophies, defender.trophies, attackerWon);
    const attackerDelta = campaignBattle || attacker.isSystemOpponent ? 0 : Math.max(-attacker.trophies, calculatedDeltas.attacker);
    const defenderDelta = campaignBattle || defender.isSystemOpponent ? 0 : Math.max(-defender.trophies, calculatedDeltas.defender);
    const battleId = randomUUID();
    if (attackerWon && !campaignBattle) {
      await this.transferLoot(
        tx,
        battleId,
        { id: attacker.id, kingdom: attacker.kingdom },
        { id: defender.id, kingdom: defender.kingdom },
        loot,
      );
    }
    if (attackerDelta !== 0) await tx.player.update({ where: { id: attacker.id }, data: { trophies: { increment: attackerDelta } } });
    if (defenderDelta !== 0) await tx.player.update({ where: { id: defender.id }, data: { trophies: { increment: defenderDelta } } });
    const startedAt = new Date();
    const resolvedAt = new Date(startedAt.getTime() + engine.durationMs);
    await tx.battle.create({
      data: {
        id: battleId,
        type: input.type,
        matchOfferId: input.matchOfferId,
        revengeTargetId: input.revengeTargetId,
        campaignStageKey: input.campaignStageKey,
        status: 'REWARDED',
        attackerPlayerId: attacker.id,
        defenderPlayerId: defender.id,
        winnerPlayerId: attackerWon ? attacker.id : defender.id,
        result: engine.result,
        seed,
        rulesVersion: ARMY_BATTLE_RULES_VERSION,
        durationMs: engine.durationMs,
        attackerTrophyBefore: attacker.trophies,
        defenderTrophyBefore: defender.trophies,
        attackerTrophyDelta: attackerDelta,
        defenderTrophyDelta: defenderDelta,
        loot: loot as unknown as Prisma.InputJsonValue,
        startedAt,
        resolvedAt,
        armySquadSnapshots: { create: [...attackerArmy, ...defenderArmy].map((squad) => ({
          side: squad.side as PrismaBattleSide,
          slot: squad.slot,
          troopType: squad.troopType,
          initialUnitCount: squad.initialUnitCount,
          perUnitHp: squad.perUnitHp,
          perUnitAtk: squad.perUnitAtk,
          perUnitDef: squad.perUnitDef,
          aggregateMaxHp: squad.aggregateMaxHp,
          commanderKey: squad.commanderKey as PrismaHeroKey,
          commanderLevel: squad.commanderLevel,
          commanderSkillKey: squad.commanderSkillKey,
          commanderPower: squad.commanderPower,
          commanderPortraitAsset: squad.commanderPortraitAsset,
          squadPower: squad.squadPower,
        })) },
        events: { create: engine.events.map((event) => ({
          sequence: event.sequence,
          timeMs: event.timeMs,
          type: event.type as PrismaBattleEventType,
          sourceSide: event.sourceSide as PrismaBattleSide | null,
          sourceSlot: event.sourceSlot,
          targetSide: event.targetSide as PrismaBattleSide | null,
          targetSlot: event.targetSlot,
          amount: event.amount,
          remainingHp: event.remainingHp,
          remainingUnits: event.remainingUnits,
          skillKey: event.skillKey,
        })) },
      },
    });

    const attackerPower = attackerArmy.reduce((total, squad) => total + squad.squadPower, 0);
    const defenderPower = defenderArmy.reduce((total, squad) => total + squad.squadPower, 0);
    const initialArmySize = attackerArmy.reduce((total, squad) => total + squad.initialUnitCount, 0);
    const remainingBySlot = new Map<number, number>();
    for (const squad of attackerArmy) remainingBySlot.set(squad.slot, squad.initialUnitCount);
    for (const event of engine.events) {
      if (event.type === 'DAMAGE' && event.targetSide === 'ATTACKER' && event.targetSlot && event.remainingUnits != null) {
        remainingBySlot.set(event.targetSlot, event.remainingUnits);
      }
    }
    const remainingArmySize = [...remainingBySlot.values()].reduce((total, count) => total + count, 0);
    await this.analytics.recordServer(tx, {
      playerId: attacker.id,
      eventName: 'army_battle_started',
      dedupeKey: `army_battle_started:${battleId}`,
      properties: { battleId, battleType: input.type, ownArmyPower: attackerPower, enemyArmyPower: defenderPower, initialArmySize },
      occurredAt: startedAt,
    });
    await this.analytics.recordServer(tx, {
      playerId: attacker.id,
      eventName: 'army_battle_finished',
      dedupeKey: `army_battle_finished:${battleId}`,
      properties: { battleId, battleType: input.type, ownArmyPower: attackerPower, enemyArmyPower: defenderPower, result: engine.result, initialArmySize, remainingArmySize },
      occurredAt: resolvedAt,
    });

    if (input.type === PrismaBattleType.RAID) {
      const opponentKind = defender.isSystemOpponent ? 'SYSTEM' : 'REAL';
      await this.analytics.recordServer(tx, {
        playerId: attacker.id, eventName: 'raid_started', dedupeKey: `raid_started:${battleId}`,
        properties: { opponentKind }, occurredAt: startedAt,
      });
      await this.analytics.recordServer(tx, {
        playerId: attacker.id, eventName: 'raid_finished', dedupeKey: `raid_finished:${battleId}`,
        properties: { result: engine.result, opponentKind }, occurredAt: resolvedAt,
      });
      const resultEvent = attackerWon ? 'raid_win' : 'raid_loss';
      await this.analytics.recordServer(tx, {
        playerId: attacker.id, eventName: resultEvent, dedupeKey: `${resultEvent}:${battleId}`,
        properties: { opponentKind }, occurredAt: resolvedAt,
      });
      await this.analytics.recordServer(tx, {
        playerId: attacker.id, eventName: 'first_raid_completed',
        dedupeKey: `first_raid_completed:${attacker.id}`, occurredAt: resolvedAt,
      });
      await this.onboarding.completeAfterStandardRaid(tx, attacker.id, battleId, resolvedAt);
    } else if (input.type === PrismaBattleType.REVENGE) {
      await this.analytics.recordServer(tx, {
        playerId: attacker.id, eventName: 'revenge_started', dedupeKey: `revenge_started:${battleId}`, occurredAt: startedAt,
      });
      await this.analytics.recordServer(tx, {
        playerId: attacker.id, eventName: 'revenge_finished', dedupeKey: `revenge_finished:${battleId}`,
        properties: { result: engine.result }, occurredAt: resolvedAt,
      });
    }

    if (input.type === PrismaBattleType.RAID && !defender.isSystemOpponent) {
      await this.notifications.createNotification(tx, {
        playerId: defender.id,
        type: 'PLAYER_RAIDED',
        payload: {
          attackerName: attacker.displayName ?? 'Unknown Warden',
          battleId,
          lootLost: loot,
          trophyDelta: defenderDelta,
          defenseResult: attackerWon ? 'DEFENSE_LOSS' : 'DEFENSE_WIN',
        },
        deepLinkIntent: { screen: 'INBOX', battleId },
        sourceKey: `PLAYER_RAIDED:${battleId}`,
      });
      if (attackerWon) {
        const revengeTargetId = randomUUID();
        const expiresAt = new Date(startedAt.getTime() + REVENGE_TTL_MS);
        await tx.revengeTarget.create({
          data: {
            id: revengeTargetId,
            sourceBattleId: battleId,
            playerId: defender.id,
            targetPlayerId: attacker.id,
            expiresAt,
          },
        });
        await this.notifications.createNotification(tx, {
          playerId: defender.id,
          type: 'REVENGE_AVAILABLE',
          payload: {
            revengeTargetId,
            sourceBattleId: battleId,
            attackerName: attacker.displayName ?? 'Unknown Warden',
            expiresAt: expiresAt.toISOString(),
          },
          deepLinkIntent: { screen: 'REVENGE', revengeTargetId },
          sourceKey: `REVENGE_AVAILABLE:${revengeTargetId}`,
        });
      }
    }
    return this.presentBattle(tx, battleId, input.requestingPlayerId);
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
        armySquadSnapshots: { orderBy: [{ side: 'asc' }, { slot: 'asc' }] },
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
    const base = {
      id: battle.id, type: battle.type, seed: battle.seed, result: battle.result, winnerPlayerId: battle.winnerPlayerId,
      durationMs: battle.durationMs,
      attacker: { playerId: battle.attacker.id, displayName: battle.attacker.displayName ?? 'Warden', trophiesBefore: battle.attackerTrophyBefore, trophyDelta: battle.attackerTrophyDelta },
      defender: { playerId: battle.defender.id, displayName: battle.defender.displayName ?? 'Warden', trophiesBefore: battle.defenderTrophyBefore, trophyDelta: battle.defenderTrophyDelta },
      loot: battle.loot as RaidLootAmounts,
      balances: requestingPlayerId === battle.attackerPlayerId && battle.attacker.kingdom
        ? this.presentBalances(battle.attacker.kingdom.resourceBalances)
        : battle.defender.kingdom
          ? this.presentBalances(battle.defender.kingdom.resourceBalances)
          : { GOLD: '0', FOOD: '0', WOOD: '0', STONE: '0', GEMS: '0' },
      resolvedAt: battle.resolvedAt.toISOString(),
    };
    if (battle.rulesVersion === 1) {
      return {
        ...base,
        rulesVersion: 1,
        teams: { attacker: heroes.filter((hero) => hero.side === 'ATTACKER'), defender: heroes.filter((hero) => hero.side === 'DEFENDER') },
        events: battle.events.map((event) => ({
          sequence: event.sequence, timeMs: event.timeMs, type: event.type, sourceSide: event.sourceSide, sourceSlot: event.sourceSlot as 1 | 2 | 3 | null,
          targetSide: event.targetSide, targetSlot: event.targetSlot as 1 | 2 | 3 | null, amount: event.amount, remainingHp: event.remainingHp,
          skillKey: event.skillKey as BattleReplayResponse['events'][number]['skillKey'],
        })),
      };
    }
    if (battle.rulesVersion === 2) {
      const squads = battle.armySquadSnapshots.map((squad): BattleArmySquadState => ({
        side: squad.side,
        slot: squad.slot as 1 | 2 | 3,
        troopType: squad.troopType,
        initialUnitCount: squad.initialUnitCount,
        perUnitHp: squad.perUnitHp,
        perUnitAtk: squad.perUnitAtk,
        perUnitDef: squad.perUnitDef,
        aggregateMaxHp: squad.aggregateMaxHp,
        commanderKey: squad.commanderKey,
        commanderLevel: squad.commanderLevel,
        commanderSkillKey: squad.commanderSkillKey as BattleArmySquadState['commanderSkillKey'],
        commanderPower: squad.commanderPower,
        commanderPortraitAsset: squad.commanderPortraitAsset,
        squadPower: squad.squadPower,
      }));
      return {
        ...base,
        rulesVersion: 2,
        armies: {
          attacker: squads.filter((squad) => squad.side === 'ATTACKER'),
          defender: squads.filter((squad) => squad.side === 'DEFENDER'),
        },
        events: battle.events.map((event) => ({
          sequence: event.sequence, timeMs: event.timeMs, type: event.type, sourceSide: event.sourceSide, sourceSlot: event.sourceSlot as 1 | 2 | 3 | null,
          targetSide: event.targetSide, targetSlot: event.targetSlot as 1 | 2 | 3 | null, amount: event.amount, remainingHp: event.remainingHp,
          remainingUnits: event.remainingUnits,
          skillKey: event.skillKey as BattleReplayResponse['events'][number]['skillKey'],
        })),
      };
    }
    throw new Error(`Unsupported persisted Battle rules version ${battle.rulesVersion}`);
  }

  private async lockPlayers(tx: Tx, ids: string[]): Promise<void> {
    const accounts = await tx.platformAccount.findMany({ where: { playerId: { in: [...ids].sort() }, platform: Platform.WEB }, orderBy: { playerId: 'asc' } });
    for (const account of accounts) await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext(${`${account.platform}:${account.externalUserId}`}))`;
  }

  private assertRevengeTarget<T extends {
    playerId: string;
    targetPlayerId: string;
    status: 'AVAILABLE' | 'USED' | 'EXPIRED' | 'INVALID';
    expiresAt: Date;
  }>(target: T | null, playerId: string, now: Date): asserts target is T {
    if (!target) throw new RaidError('REVENGE_NOT_FOUND', 'This revenge opportunity does not exist.');
    if (target.playerId !== playerId) throw new RaidError('REVENGE_NOT_OWNER', 'This revenge opportunity belongs to another player.');
    if (target.playerId === target.targetPlayerId) throw new RaidError('SELF_ATTACK_FORBIDDEN', 'A player cannot revenge their own Kingdom.');
    if (target.status === 'USED') throw new RaidError('REVENGE_ALREADY_USED', 'This revenge opportunity has already been used.');
    if (target.status === 'EXPIRED' || target.expiresAt.getTime() <= now.getTime()) throw new RaidError('REVENGE_EXPIRED', 'This revenge opportunity has expired.');
    if (target.status !== 'AVAILABLE') throw new RaidError('REVENGE_INVALID_SOURCE', 'This revenge opportunity is invalid.');
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

  private watchtowerProtectionBps(buildings: readonly { type?: string; level: number }[]): number {
    return kingdomEffectBps(buildings.find((building) => building.type === 'WATCHTOWER')?.level ?? 1);
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
