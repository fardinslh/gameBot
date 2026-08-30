import type { BattleEventState, BattleSide, HeroSkillKey, TroopType } from '@crown-and-coin/shared';
import { TROOP_CONTENT } from '../army/army.config';
import {
  ARMY_ARCANE_BLAST_MULTIPLIER_BPS,
  ARMY_BATTLE_RULES_VERSION,
  ARMY_MINIMUM_DAMAGE,
  COUNTER_DAMAGE_BONUS_BPS,
  CRITICAL_CHANCE_BPS,
  CRITICAL_MULTIPLIER_BPS,
  DAMAGE_VARIANCE_MAX_BPS,
  DAMAGE_VARIANCE_MIN_BPS,
  DEFENSE_FACTOR_BPS,
  HERO_BATTLE_CONFIG,
  MAX_PLAYBACK_MS,
  MAX_SIMULATION_MS,
  MIN_PLAYBACK_MS,
  POWER_SHOT_MULTIPLIER_BPS,
  SHIELD_WALL_DURATION_MS,
  SHIELD_WALL_REDUCTION_BPS,
} from './battle.config';
import { createSeededRandom, type SeededRandom } from './seeded-random';
import type { ArmyBattleEngineInput, ArmyCombatSquad, BattleEngineResult } from './battle.types';

export interface ArmyCombatState extends ArmyCombatSquad {
  currentHp: number;
  nextBasicAt: number;
  nextSkillAt: number;
  shieldUntil: number;
  shieldExpirationEmitted: boolean;
}

interface LogicalEvent extends Omit<BattleEventState, 'sequence' | 'timeMs'> {
  logicalTimeMs: number;
}

const COUNTERS: Readonly<Record<TroopType, TroopType>> = {
  INFANTRY: 'CAVALRY',
  CAVALRY: 'ARCHER',
  ARCHER: 'INFANTRY',
};

export function simulateArmyBattle(input: ArmyBattleEngineInput): BattleEngineResult {
  if (input.rulesVersion !== ARMY_BATTLE_RULES_VERSION) {
    throw new Error(`Unsupported Army Battle rules version ${input.rulesVersion}`);
  }
  validateArmy(input.attacker, 'ATTACKER');
  validateArmy(input.defender, 'DEFENDER');
  const random = createSeededRandom(input.seed);
  const squads = [...input.attacker, ...input.defender].map(createCombatState);
  const events: LogicalEvent[] = [event(0, 'BATTLE_START')];
  let logicalTimeMs = 0;
  let winnerSide: BattleSide | null = null;

  while (logicalTimeMs <= MAX_SIMULATION_MS) {
    winnerSide = resolvedWinner(squads);
    if (winnerSide) break;
    const source = nextActor(squads);
    if (!source) break;
    logicalTimeMs = Math.min(source.nextBasicAt, source.nextSkillAt);
    if (logicalTimeMs > MAX_SIMULATION_MS) break;
    emitExpiredShields(squads, logicalTimeMs, events);
    if (source.currentHp <= 0) continue;

    if (source.nextSkillAt <= source.nextBasicAt) {
      castCommanderSkill(source, squads, logicalTimeMs, random, events);
      source.nextSkillAt += HERO_BATTLE_CONFIG[source.commanderKey].skillCooldownMs;
    } else {
      const target = selectLaneTarget(squads, source);
      if (!target) break;
      events.push(event(logicalTimeMs, 'BASIC_ATTACK', source, target));
      applySquadDamage(source, target, logicalTimeMs + 120, 10_000, null, random, events);
      source.nextBasicAt += TROOP_CONTENT[source.troopType].combat.attackIntervalMs;
    }
  }

  winnerSide ??= timeoutWinner(squads, random);
  logicalTimeMs = Math.min(Math.max(logicalTimeMs, 1), MAX_SIMULATION_MS);
  events.push(event(logicalTimeMs, 'BATTLE_END', undefined, undefined, winnerSide));
  const durationMs = Math.min(MAX_PLAYBACK_MS, Math.max(MIN_PLAYBACK_MS, Math.round(logicalTimeMs * 0.65)));
  const scale = durationMs / logicalTimeMs;
  return {
    result: winnerSide === 'ATTACKER' ? 'ATTACKER_WIN' : 'DEFENDER_WIN',
    winnerSide,
    durationMs,
    logicalDurationMs: logicalTimeMs,
    events: events
      .map((item, insertionOrder) => ({ item, insertionOrder }))
      .sort((left, right) => left.item.logicalTimeMs - right.item.logicalTimeMs || left.insertionOrder - right.insertionOrder)
      .map(({ item }, sequence) => ({
        sequence,
        timeMs: item.type === 'BATTLE_END' ? durationMs : Math.min(durationMs, Math.round(item.logicalTimeMs * scale)),
        type: item.type,
        sourceSide: item.sourceSide,
        sourceSlot: item.sourceSlot,
        targetSide: item.targetSide,
        targetSlot: item.targetSlot,
        amount: item.amount,
        remainingHp: item.remainingHp,
        remainingUnits: item.remainingUnits,
        skillKey: item.skillKey,
      })),
  };
}

export function livingUnits(currentHp: number, perUnitHp: number): number {
  return currentHp <= 0 ? 0 : Math.ceil(currentHp / perUnitHp);
}

export function hasCounterAdvantage(attacker: TroopType, defender: TroopType): boolean {
  return COUNTERS[attacker] === defender;
}

export function selectNearestLivingSlot(sourceSlot: number, livingSlots: readonly number[]): number | null {
  return [...livingSlots].sort((left, right) => Math.abs(left - sourceSlot) - Math.abs(right - sourceSlot) || left - right)[0] ?? null;
}

export function armyBaseDamage(source: ArmyCombatState, target: ArmyCombatState, multiplierBps = 10_000): number {
  const attackStrength = livingUnits(source.currentHp, source.perUnitHp) * source.perUnitAtk;
  const mitigation = Math.round(
    (livingUnits(target.currentHp, target.perUnitHp) * target.perUnitDef * DEFENSE_FACTOR_BPS) / 10_000,
  );
  const counterMultiplier = hasCounterAdvantage(source.troopType, target.troopType)
    ? 10_000 + COUNTER_DAMAGE_BONUS_BPS
    : 10_000;
  const mitigated = Math.max(ARMY_MINIMUM_DAMAGE, attackStrength - mitigation);
  return Math.max(
    ARMY_MINIMUM_DAMAGE,
    Math.round((mitigated * multiplierBps * counterMultiplier) / 100_000_000),
  );
}

export function applyArmyShieldReduction(damage: number): number {
  return Math.max(1, Math.round((damage * (10_000 - SHIELD_WALL_REDUCTION_BPS)) / 10_000));
}

function createCombatState(squad: ArmyCombatSquad): ArmyCombatState {
  return {
    ...squad,
    currentHp: squad.aggregateMaxHp,
    nextBasicAt: Math.round(TROOP_CONTENT[squad.troopType].combat.attackIntervalMs * 0.65),
    nextSkillAt: HERO_BATTLE_CONFIG[squad.commanderKey].skillCooldownMs,
    shieldUntil: 0,
    shieldExpirationEmitted: true,
  };
}

function validateArmy(army: ArmyCombatSquad[], side: BattleSide): void {
  if (army.length !== 3 || new Set(army.map((squad) => squad.slot)).size !== 3) {
    throw new Error(`${side} must have three unique Army slots`);
  }
  if (new Set(army.map((squad) => squad.commanderKey)).size !== 3) {
    throw new Error(`${side} must have three unique Commanders`);
  }
  if (army.some((squad) => squad.side !== side || squad.initialUnitCount <= 0 || squad.aggregateMaxHp <= 0)) {
    throw new Error(`${side} contains invalid Army combat stats`);
  }
}

function nextActor(squads: ArmyCombatState[]): ArmyCombatState | null {
  return squads
    .filter((squad) => squad.currentHp > 0)
    .sort((left, right) => {
      const timeDifference = Math.min(left.nextBasicAt, left.nextSkillAt) - Math.min(right.nextBasicAt, right.nextSkillAt);
      if (timeDifference !== 0) return timeDifference;
      if (left.side !== right.side) return left.side === 'ATTACKER' ? -1 : 1;
      return left.slot - right.slot;
    })[0] ?? null;
}

function selectLaneTarget(squads: ArmyCombatState[], source: ArmyCombatState): ArmyCombatState | null {
  const enemies = squads.filter((squad) => squad.side !== source.side && squad.currentHp > 0);
  const targetSlot = selectNearestLivingSlot(source.slot, enemies.map((squad) => squad.slot));
  return targetSlot === null ? null : enemies.find((squad) => squad.slot === targetSlot) ?? null;
}

function castCommanderSkill(
  source: ArmyCombatState,
  squads: ArmyCombatState[],
  timeMs: number,
  random: SeededRandom,
  events: LogicalEvent[],
): void {
  events.push(event(timeMs, 'SKILL_CAST', source, undefined, undefined, source.commanderSkillKey));
  if (source.commanderSkillKey === 'SHIELD_WALL') {
    source.shieldUntil = timeMs + SHIELD_WALL_DURATION_MS;
    source.shieldExpirationEmitted = false;
    events.push(event(timeMs + 80, 'BUFF_APPLIED', source, source, undefined, source.commanderSkillKey));
    return;
  }
  if (source.commanderSkillKey === 'POWER_SHOT') {
    const target = selectLaneTarget(squads, source);
    if (target) applySquadDamage(source, target, timeMs + 180, POWER_SHOT_MULTIPLIER_BPS, source.commanderSkillKey, random, events);
    return;
  }
  for (const target of squads.filter((squad) => squad.side !== source.side && squad.currentHp > 0).sort((a, b) => a.slot - b.slot)) {
    applySquadDamage(source, target, timeMs + 220, ARMY_ARCANE_BLAST_MULTIPLIER_BPS, source.commanderSkillKey, random, events);
  }
}

function applySquadDamage(
  source: ArmyCombatState,
  target: ArmyCombatState,
  timeMs: number,
  multiplierBps: number,
  skillKey: HeroSkillKey | null,
  random: SeededRandom,
  events: LogicalEvent[],
): void {
  if (source.currentHp <= 0 || target.currentHp <= 0) return;
  let damage = armyBaseDamage(source, target, multiplierBps);
  damage = Math.round((damage * random.integer(DAMAGE_VARIANCE_MIN_BPS, DAMAGE_VARIANCE_MAX_BPS)) / 10_000);
  if (random.integer(1, 10_000) <= CRITICAL_CHANCE_BPS) damage = Math.round((damage * CRITICAL_MULTIPLIER_BPS) / 10_000);
  if (target.shieldUntil > timeMs) {
    damage = applyArmyShieldReduction(damage);
  }
  target.currentHp = Math.max(0, target.currentHp - damage);
  events.push(event(
    timeMs,
    'DAMAGE',
    source,
    target,
    undefined,
    skillKey,
    damage,
    target.currentHp,
    livingUnits(target.currentHp, target.perUnitHp),
  ));
  if (target.currentHp === 0) events.push(event(timeMs + 40, 'SQUAD_DEFEATED', source, target));
}

function emitExpiredShields(squads: ArmyCombatState[], timeMs: number, events: LogicalEvent[]): void {
  for (const squad of squads) {
    if (squad.shieldUntil > 0 && squad.shieldUntil <= timeMs && !squad.shieldExpirationEmitted) {
      squad.shieldExpirationEmitted = true;
      events.push(event(squad.shieldUntil, 'BUFF_EXPIRED', squad, squad, undefined, squad.commanderSkillKey));
    }
  }
}

function resolvedWinner(squads: ArmyCombatState[]): BattleSide | null {
  const attackerAlive = squads.some((squad) => squad.side === 'ATTACKER' && squad.currentHp > 0);
  const defenderAlive = squads.some((squad) => squad.side === 'DEFENDER' && squad.currentHp > 0);
  if (!attackerAlive) return 'DEFENDER';
  if (!defenderAlive) return 'ATTACKER';
  return null;
}

export function armyRemainingHpPpm(squads: readonly ArmyCombatState[], side: BattleSide): number {
  const sideSquads = squads.filter((squad) => squad.side === side);
  const currentHp = sideSquads.reduce((total, squad) => total + squad.currentHp, 0);
  const maximumHp = sideSquads.reduce((total, squad) => total + squad.aggregateMaxHp, 0);
  return maximumHp <= 0 ? 0 : Math.round((currentHp * 1_000_000) / maximumHp);
}

export function timeoutWinner(squads: ArmyCombatState[], random: SeededRandom): BattleSide {
  const attacker = armyRemainingHpPpm(squads, 'ATTACKER');
  const defender = armyRemainingHpPpm(squads, 'DEFENDER');
  if (attacker === defender) return random.next() < 0.5 ? 'ATTACKER' : 'DEFENDER';
  return attacker > defender ? 'ATTACKER' : 'DEFENDER';
}

function event(
  logicalTimeMs: number,
  type: BattleEventState['type'],
  source?: ArmyCombatState,
  target?: ArmyCombatState,
  explicitSide?: BattleSide,
  skillKey: HeroSkillKey | null = null,
  amount: number | null = null,
  remainingHp: number | null = null,
  remainingUnits: number | null = null,
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
    remainingUnits,
    skillKey,
  };
}
