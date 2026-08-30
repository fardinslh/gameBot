import type { BattleEventState, BattleSide, HeroSkillKey } from '@crown-and-coin/shared';
import {
  ARCANE_BLAST_MULTIPLIER_BPS,
  HERO_BATTLE_RULES_VERSION,
  CRITICAL_CHANCE_BPS,
  CRITICAL_MULTIPLIER_BPS,
  DAMAGE_VARIANCE_MAX_BPS,
  DAMAGE_VARIANCE_MIN_BPS,
  DEFENSE_FACTOR_BPS,
  HERO_BATTLE_CONFIG,
  MAX_PLAYBACK_MS,
  MAX_SIMULATION_MS,
  MINIMUM_DAMAGE,
  MIN_PLAYBACK_MS,
  POWER_SHOT_MULTIPLIER_BPS,
  SHIELD_WALL_DURATION_MS,
  SHIELD_WALL_REDUCTION_BPS,
} from './battle.config';
import { createSeededRandom, type SeededRandom } from './seeded-random';
import type { BattleCombatHero, BattleEngineInput, BattleEngineResult } from './battle.types';

interface CombatState extends BattleCombatHero {
  currentHp: number;
  nextBasicAt: number;
  nextSkillAt: number;
  shieldUntil: number;
  shieldExpirationEmitted: boolean;
}

interface LogicalEvent extends Omit<BattleEventState, 'sequence' | 'timeMs'> {
  logicalTimeMs: number;
}

export function simulateBattle(input: BattleEngineInput): BattleEngineResult {
  if (input.rulesVersion !== HERO_BATTLE_RULES_VERSION) throw new Error(`Unsupported Battle rules version ${input.rulesVersion}`);
  validateTeam(input.attacker, 'ATTACKER');
  validateTeam(input.defender, 'DEFENDER');
  const random = createSeededRandom(input.seed);
  const heroes = [...input.attacker, ...input.defender].map(createCombatState);
  const events: LogicalEvent[] = [event(0, 'BATTLE_START')];
  let logicalTimeMs = 0;
  let winnerSide: BattleSide | null = null;

  while (logicalTimeMs <= MAX_SIMULATION_MS) {
    winnerSide = resolvedWinner(heroes);
    if (winnerSide) break;
    const source = nextActor(heroes);
    if (!source) break;
    logicalTimeMs = Math.min(source.nextBasicAt, source.nextSkillAt);
    if (logicalTimeMs > MAX_SIMULATION_MS) break;
    emitExpiredShields(heroes, logicalTimeMs, events);
    if (source.currentHp <= 0) continue;

    if (source.nextSkillAt <= source.nextBasicAt) {
      castSkill(source, heroes, logicalTimeMs, random, events);
      source.nextSkillAt += HERO_BATTLE_CONFIG[source.key].skillCooldownMs;
    } else {
      const target = firstLivingEnemy(heroes, source.side);
      if (!target) break;
      events.push(event(logicalTimeMs, 'BASIC_ATTACK', source, target));
      applyDamage(source, target, logicalTimeMs + 120, 10_000, null, random, events);
      source.nextBasicAt += HERO_BATTLE_CONFIG[source.key].attackIntervalMs;
    }
  }

  winnerSide ??= timeoutWinner(heroes, random);
  logicalTimeMs = Math.min(Math.max(logicalTimeMs, 1), MAX_SIMULATION_MS);
  events.push(event(logicalTimeMs, 'BATTLE_END', undefined, undefined, winnerSide));
  const durationMs = Math.min(MAX_PLAYBACK_MS, Math.max(MIN_PLAYBACK_MS, Math.round(logicalTimeMs * 0.65)));
  const scale = durationMs / logicalTimeMs;
  const presented = events
    .map((item, insertionOrder) => ({ item, insertionOrder }))
    .sort((left, right) => left.item.logicalTimeMs - right.item.logicalTimeMs || left.insertionOrder - right.insertionOrder)
    .map(({ item }, sequence): BattleEventState => ({
    sequence,
    timeMs: item.type === 'BATTLE_END' ? durationMs : Math.min(durationMs, Math.round(item.logicalTimeMs * scale)),
    type: item.type,
    sourceSide: item.sourceSide,
    sourceSlot: item.sourceSlot,
    targetSide: item.targetSide,
    targetSlot: item.targetSlot,
    amount: item.amount,
    remainingHp: item.remainingHp,
    skillKey: item.skillKey,
    }));
  return {
    result: winnerSide === 'ATTACKER' ? 'ATTACKER_WIN' : 'DEFENDER_WIN',
    winnerSide,
    durationMs,
    logicalDurationMs: logicalTimeMs,
    events: presented,
  };
}

export function baseDamage(atk: number, def: number, multiplierBps = 10_000): number {
  const mitigated = atk - Math.round((def * DEFENSE_FACTOR_BPS) / 10_000);
  return Math.max(MINIMUM_DAMAGE, Math.round((mitigated * multiplierBps) / 10_000));
}

export function applyShieldReduction(damage: number): number {
  return Math.max(1, Math.round((damage * (10_000 - SHIELD_WALL_REDUCTION_BPS)) / 10_000));
}

function createCombatState(hero: BattleCombatHero): CombatState {
  const config = HERO_BATTLE_CONFIG[hero.key];
  return {
    ...hero,
    currentHp: hero.hp,
    nextBasicAt: Math.round(config.attackIntervalMs * 0.65),
    nextSkillAt: config.skillCooldownMs,
    shieldUntil: 0,
    shieldExpirationEmitted: true,
  };
}

function validateTeam(team: BattleCombatHero[], side: BattleSide): void {
  if (team.length !== 3 || new Set(team.map((hero) => hero.slot)).size !== 3) throw new Error(`${side} must have three unique slots`);
  if (team.some((hero) => hero.side !== side || hero.hp <= 0 || hero.atk <= 0 || hero.def <= 0)) throw new Error(`${side} contains invalid combat stats`);
}

function nextActor(heroes: CombatState[]): CombatState | null {
  return heroes
    .filter((hero) => hero.currentHp > 0)
    .sort((left, right) => {
      const timeDifference = Math.min(left.nextBasicAt, left.nextSkillAt) - Math.min(right.nextBasicAt, right.nextSkillAt);
      if (timeDifference !== 0) return timeDifference;
      if (left.side !== right.side) return left.side === 'ATTACKER' ? -1 : 1;
      return left.slot - right.slot;
    })[0] ?? null;
}

function castSkill(source: CombatState, heroes: CombatState[], timeMs: number, random: SeededRandom, events: LogicalEvent[]): void {
  events.push(event(timeMs, 'SKILL_CAST', source, undefined, undefined, source.skillKey));
  if (source.skillKey === 'SHIELD_WALL') {
    source.shieldUntil = timeMs + SHIELD_WALL_DURATION_MS;
    source.shieldExpirationEmitted = false;
    events.push(event(timeMs + 80, 'BUFF_APPLIED', source, source, undefined, source.skillKey));
    return;
  }
  if (source.skillKey === 'POWER_SHOT') {
    const target = firstLivingEnemy(heroes, source.side);
    if (target) applyDamage(source, target, timeMs + 180, POWER_SHOT_MULTIPLIER_BPS, source.skillKey, random, events);
    return;
  }
  const targets = livingEnemies(heroes, source.side);
  for (const target of targets) applyDamage(source, target, timeMs + 220, ARCANE_BLAST_MULTIPLIER_BPS, source.skillKey, random, events);
}

function applyDamage(
  source: CombatState,
  target: CombatState,
  timeMs: number,
  multiplierBps: number,
  skillKey: HeroSkillKey | null,
  random: SeededRandom,
  events: LogicalEvent[],
): void {
  if (source.currentHp <= 0 || target.currentHp <= 0) return;
  let damage = baseDamage(source.atk, target.def, multiplierBps);
  damage = Math.round((damage * random.integer(DAMAGE_VARIANCE_MIN_BPS, DAMAGE_VARIANCE_MAX_BPS)) / 10_000);
  if (random.integer(1, 10_000) <= CRITICAL_CHANCE_BPS) damage = Math.round((damage * CRITICAL_MULTIPLIER_BPS) / 10_000);
  if (target.shieldUntil > timeMs) damage = applyShieldReduction(damage);
  target.currentHp = Math.max(0, target.currentHp - damage);
  events.push(event(timeMs, 'DAMAGE', source, target, undefined, skillKey, damage, target.currentHp));
  if (target.currentHp === 0) events.push(event(timeMs + 40, 'HERO_DEFEATED', source, target));
}

function emitExpiredShields(heroes: CombatState[], timeMs: number, events: LogicalEvent[]): void {
  for (const hero of heroes) {
    if (hero.shieldUntil > 0 && hero.shieldUntil <= timeMs && !hero.shieldExpirationEmitted) {
      hero.shieldExpirationEmitted = true;
      events.push(event(hero.shieldUntil, 'BUFF_EXPIRED', hero, hero, undefined, hero.skillKey));
    }
  }
}

function firstLivingEnemy(heroes: CombatState[], sourceSide: BattleSide): CombatState | null {
  return livingEnemies(heroes, sourceSide)[0] ?? null;
}

function livingEnemies(heroes: CombatState[], sourceSide: BattleSide): CombatState[] {
  return heroes.filter((hero) => hero.side !== sourceSide && hero.currentHp > 0).sort((left, right) => left.slot - right.slot);
}

function resolvedWinner(heroes: CombatState[]): BattleSide | null {
  const attackerAlive = heroes.some((hero) => hero.side === 'ATTACKER' && hero.currentHp > 0);
  const defenderAlive = heroes.some((hero) => hero.side === 'DEFENDER' && hero.currentHp > 0);
  if (!attackerAlive) return 'DEFENDER';
  if (!defenderAlive) return 'ATTACKER';
  return null;
}

function timeoutWinner(heroes: CombatState[], random: SeededRandom): BattleSide {
  const ratio = (side: BattleSide): number => heroes
    .filter((hero) => hero.side === side)
    .reduce((total, hero) => total + hero.currentHp / hero.hp, 0);
  const attacker = ratio('ATTACKER');
  const defender = ratio('DEFENDER');
  if (attacker === defender) return random.next() < 0.5 ? 'ATTACKER' : 'DEFENDER';
  return attacker > defender ? 'ATTACKER' : 'DEFENDER';
}

function event(
  logicalTimeMs: number,
  type: BattleEventState['type'],
  source?: CombatState,
  target?: CombatState,
  explicitSide?: BattleSide,
  skillKey: HeroSkillKey | null = null,
  amount: number | null = null,
  remainingHp: number | null = null,
): LogicalEvent {
  return {
    logicalTimeMs,
    type,
    sourceSide: explicitSide ?? source?.side ?? null,
    sourceSlot: source?.slot ?? null,
    targetSide: target?.side ?? null,
    targetSlot: target?.slot ?? null,
    amount,
    remainingHp,
    skillKey,
  };
}
