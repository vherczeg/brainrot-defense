import { characterStats } from '../domain/characters';
import { characterLevelFromXp } from '../domain/progression';
import { ENEMY_DEFINITIONS, enemyAbilities } from '../domain/enemies';
import { enemyStatsForDifficulty } from '../domain/difficulty';
import { waveModifierConfig } from '../domain/modifiers';
import { upgradeAttackMultiplier, upgradeHpMultiplier } from '../domain/upgrades';
import { getWave } from '../domain/waves';
import {
  BOARD_COLS,
  BOARD_ROWS,
  type AttackKind,
  type BattleStatus,
  type CharacterInstance,
  type Difficulty,
  type EnemyAbilities,
  type Team,
  type WaveDefinition,
} from '../domain/types';
import {
  FIXED_TICK_SECONDS,
  maxBattleSeconds,
  type BattleEvent,
  type BattlePoint,
  type BattleState,
  type BattleStepResult,
  type BattleUnit,
  type DamageSource,
  type PhaseShiftStatus,
  type PoisonStatus,
  type SlowStatus,
  type SpinShieldStatus,
} from './types';

const EMPTY_ABILITIES: EnemyAbilities = {
  poison: null,
  spinShield: null,
  earthquake: null,
  heal: null,
  thorns: null,
  phaseShift: null,
  summon: null,
  enrage: null,
  explode: null,
  stun: null,
  armorAura: null,
};
const VULNERABLE_DAMAGE_MULTIPLIER = 1.5;
const MAX_ARMOR = 0.9;
const SUMMON_OCCUPANCY_RADIUS = 0.9;

function cellCenter(col: number, row: number): BattlePoint {
  return { x: col + 0.5, y: row + 0.5 };
}

export function compareUnitIds(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function entityDistance(a: BattleUnit, b: BattleUnit): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function isRangedAttackKind(kind: AttackKind | undefined): boolean {
  return kind === 'laser' || kind === 'lightning' || kind === 'ranged' || kind === 'frost';
}

export function findTarget(unit: BattleUnit, units: readonly BattleUnit[]): BattleUnit | null {
  let best: BattleUnit | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of units) {
    if (!candidate.alive || candidate.team === unit.team) continue;
    const dx = candidate.x - unit.x;
    const dy = candidate.y - unit.y;
    const distance = dx * dx + dy * dy;
    if (
      distance < bestDistance - 1e-9 ||
      (Math.abs(distance - bestDistance) <= 1e-9 &&
        best !== null &&
        compareUnitIds(candidate.id, best.id) < 0)
    ) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function enemyAttackKind(typeId: string): AttackKind {
  switch (typeId) {
    case 'mega-brainrot-gorilla':
      return 'boss-smash';
    case 'green-venom-falcon':
      return 'claw';
    case 'storm-crow':
    case 'storm-garuda':
      return 'lightning';
    case 'venomous-wasp':
    case 'spitter-snail':
    case 'void-eye':
      return 'ranged';
    case 'armored-colossus':
    case 'lava-golem':
    case 'chaos-dragon':
    case 'mega-chaos-king':
    case 'iron-hedgehog':
      return 'boss-smash';
    case 'venom-king-crocodile':
    case 'shadow-prince':
    case 'chaos-twin-warrior':
    case 'chaos-twin-healer':
    case 'kappa-captain':
    case 'nightmare-moth':
    case 'bubble-duchess':
      return 'claw';
    default:
      return 'melee';
  }
}

function enemyChain(typeId: string): { count: number; factor: number; range: number } {
  if (typeId === 'storm-crow') return { count: 2, factor: 0.5, range: 1.8 };
  if (typeId === 'storm-garuda') return { count: 2, factor: 0.55, range: 2.2 };
  return { count: 0, factor: 0, range: 0 };
}

export function createBattleState(
  characters: readonly CharacterInstance[],
  wave: WaveDefinition,
  seed = 1,
  difficulty: Difficulty = 'normal',
  upgrades: Readonly<Record<string, number>> = {},
): BattleState {
  const modifier = waveModifierConfig(wave.modifier);
  const attackUpgrade = upgradeAttackMultiplier({ upgrades });
  const hpUpgrade = upgradeHpMultiplier({ upgrades });

  const earthquakeFreezeSec = wave.enemies.reduce((longest, config) => {
    const freezeSec = enemyAbilities(config.typeId).earthquake?.freezeSec ?? 0;
    return Math.max(longest, freezeSec);
  }, 0);

  const allyUnits: BattleUnit[] = characters.map((character) => {
    const definition = characterStats(character.typeId, character.mergeRank, character.totalXp);
    const position = cellCenter(character.col, character.row);
    const attack = Math.min(1_000_000_000, Math.round(definition.attack * attackUpgrade));
    const maxHp = Math.min(1_000_000_000, Math.round(definition.maxHp * hpUpgrade));
    const slowAbility =
      character.typeId === 'frost-owl'
        ? { attackIntervalFactor: 1.6, moveSpeedFactor: 0.6, durationSec: 3 }
        : null;
    return {
      id: character.id,
      team: 'ally',
      typeId: character.typeId,
      level: characterLevelFromXp(character.totalXp),
      mergeRank: character.mergeRank,
      x: position.x,
      y: position.y,
      hp: maxHp,
      maxHp,
      attack,
      attackIntervalSec: definition.attackIntervalSec * (modifier?.allyAttackIntervalFactor ?? 1),
      range: definition.range,
      moveSpeed: definition.moveSpeed * (modifier?.allyMoveSpeedFactor ?? 1),
      armor: definition.armor,
      attackKind:
        character.typeId === 'lightning-scorpion'
          ? 'lightning'
          : character.typeId === 'armored-rhino'
            ? 'melee'
            : character.typeId === 'frost-owl'
              ? 'frost'
              : 'laser',
      chainCount: character.typeId === 'lightning-scorpion' ? 1 : 0,
      chainFactor: character.typeId === 'lightning-scorpion' ? 0.6 : 0,
      chainRange: character.typeId === 'lightning-scorpion' ? 1.6 : 0,
      splashRadius: definition.splashRadius,
      cooldown: 0,
      alive: true,
      isBoss: false,
      abilities: EMPTY_ABILITIES,
      slowAbility,
      poison: null,
      spinShield: null,
      slow: null,
      phaseShift: null,
      poisonCooldownSec: 0,
      stunCooldownSec: 0,
      healCooldownSec: 1,
      summonTimerSec: 0,
      summonRemaining: 0,
      frozenSec: earthquakeFreezeSec,
      enrageIndex: 0,
    };
  });

  const enemyUnits: BattleUnit[] = wave.enemies.map((config, index) => {
    const stats = enemyStatsForDifficulty(config.typeId, config.level, difficulty);
    const abilities = enemyAbilities(config.typeId);
    const position = cellCenter(config.col, config.row);
    const chain = enemyChain(config.typeId);
    return {
      id: `enemy-${wave.id}-${index + 1}`,
      team: 'enemy',
      typeId: config.typeId,
      level: config.level,
      mergeRank: 0,
      x: position.x,
      y: position.y,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      attack: Math.max(1, Math.round(stats.attack * (modifier?.enemyAttackFactor ?? 1))),
      attackIntervalSec: stats.attackIntervalSec,
      range: stats.range,
      moveSpeed: stats.moveSpeed * (modifier?.enemyMoveSpeedFactor ?? 1),
      armor: Math.min(MAX_ARMOR, stats.armor + (modifier?.enemyArmorBonus ?? 0)),
      attackKind: enemyAttackKind(config.typeId),
      chainCount: chain.count,
      chainFactor: chain.factor,
      chainRange: chain.range,
      splashRadius: 0,
      cooldown: 0,
      alive: true,
      isBoss: ENEMY_DEFINITIONS[config.typeId].isBoss,
      abilities,
      slowAbility: null,
      poison: null,
      spinShield: abilities.spinShield
        ? {
            active: false,
            shielded: false,
            remainingSec: 0,
            cooldownSec: 1,
            speedFactor: 1,
            vulnerableSec: 0,
            auraTickInSec: 0,
          }
        : null,
      slow: null,
      phaseShift: abilities.phaseShift ? { active: false, remainingSec: 0, cooldownSec: 1 } : null,
      poisonCooldownSec: abilities.poison ? 1 : 0,
      stunCooldownSec: abilities.stun ? 1 : 0,
      healCooldownSec: abilities.heal ? abilities.heal.intervalSec : 1,
      summonTimerSec: abilities.summon ? abilities.summon.firstAtSec : 0,
      summonRemaining: abilities.summon ? abilities.summon.maxTotal : 0,
      frozenSec: earthquakeFreezeSec,
      enrageIndex: 0,
    };
  });

  return {
    waveId: wave.id,
    seed,
    difficulty,
    ticks: 0,
    elapsedSec: 0,
    status: 'running',
    units: [...allyUnits, ...enemyUnits],
    nextSummonId: 1,
  };
}

export function mitigatedDamage(rawDamage: number, armor: number): number {
  const safeArmor = Math.min(MAX_ARMOR, Math.max(0, armor));
  const safeRaw = Math.max(0, rawDamage);
  return Math.max(1, Math.round(safeRaw * (1 - safeArmor)));
}

interface MutableUnit extends BattleUnit {
  hp: number;
  x: number;
  y: number;
  cooldown: number;
  armor: number;
  alive: boolean;
  poison: PoisonStatus | null;
  spinShield: SpinShieldStatus | null;
  slow: SlowStatus | null;
  phaseShift: PhaseShiftStatus | null;
  poisonCooldownSec: number;
  stunCooldownSec: number;
  healCooldownSec: number;
  summonTimerSec: number;
  summonRemaining: number;
  frozenSec: number;
  enrageIndex: number;
}

interface DamageOptions {
  readonly attackKind?: AttackKind;
  readonly source?: DamageSource;
  readonly attackerId?: string;
  readonly units?: readonly MutableUnit[];
}

function pointOf(unit: BattleUnit): BattlePoint {
  return { x: unit.x, y: unit.y };
}

function armorAuraBonus(target: BattleUnit, units: readonly BattleUnit[] | undefined): number {
  if (!units) return 0;
  let bonus = 0;
  for (const provider of units) {
    const ability = provider.abilities.armorAura;
    if (!ability || !provider.alive || provider.team !== target.team) continue;
    if (provider.id === target.id) continue;
    if (entityDistance(provider, target) <= ability.radius + 1e-9) {
      bonus += ability.armorBonus;
    }
  }
  return bonus;
}

function enrageStepOf(unit: BattleUnit) {
  const ability = unit.abilities.enrage;
  if (!ability) return null;
  const ratio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 0;
  for (const step of ability.steps) {
    if (ratio <= step.threshold + 1e-9) return step;
  }
  return null;
}

function enrageAttackFactor(unit: BattleUnit): number {
  return enrageStepOf(unit)?.attackFactor ?? 1;
}

function effectiveArmor(target: BattleUnit, units: readonly BattleUnit[] | undefined): number {
  return Math.min(
    MAX_ARMOR,
    target.armor + (enrageStepOf(target)?.armorBonus ?? 0) + armorAuraBonus(target, units),
  );
}

function breakSpinShield(target: MutableUnit, events: BattleEvent[]): void {
  const spin = target.spinShield;
  const ability = target.abilities.spinShield;
  if (!spin || !spin.active || !spin.shielded) return;
  target.spinShield = {
    ...spin,
    shielded: false,
    speedFactor: ability?.rangedSlowFactor ?? 0.5,
    vulnerableSec: ability?.vulnerableSec ?? 0,
  };
  events.push({
    type: 'status',
    unitId: target.id,
    status: 'spin-break',
    at: pointOf(target),
  });
}

function breakPhaseShift(target: MutableUnit, events: BattleEvent[]): void {
  const phase = target.phaseShift;
  const ability = target.abilities.phaseShift;
  if (!phase || !phase.active || !ability) return;
  target.phaseShift = { active: false, remainingSec: 0, cooldownSec: ability.cooldownSec };
  events.push({
    type: 'status',
    unitId: target.id,
    status: 'phase-break',
    at: pointOf(target),
  });
}

function applyExplosion(
  target: MutableUnit,
  units: readonly MutableUnit[],
  events: BattleEvent[],
): void {
  const ability = target.abilities.explode;
  if (!ability) return;
  const damage = Math.max(1, Math.round(target.attack * ability.factor));
  events.push({
    type: 'explode',
    unitId: target.id,
    at: pointOf(target),
  });
  for (const victim of units) {
    if (!victim.alive || victim.team === target.team) continue;
    if (victim.id === target.id) continue;
    if (entityDistance(target, victim) > ability.radius + 1e-9) continue;
    applyDamage(victim, damage, events, {
      source: 'explode',
      attackerId: target.id,
      units,
    });
  }
}

function applyDamage(
  target: MutableUnit,
  rawDamage: number,
  events: BattleEvent[],
  options: DamageOptions = {},
): void {
  if (!target.alive) return;
  const source = options.source ?? 'attack';
  const spin = target.spinShield;
  if (spin?.active && spin.shielded) {
    if (!isRangedAttackKind(options.attackKind)) {
      events.push({
        type: 'damage',
        unitId: target.id,
        amount: 0,
        hp: target.hp,
        maxHp: target.maxHp,
        at: pointOf(target),
        source,
        blocked: true,
      });
      return;
    }
    breakSpinShield(target, events);
  }

  const vulnerable = (target.spinShield?.vulnerableSec ?? 0) > 1e-9;
  const phased = target.phaseShift?.active ?? false;
  let multiplier = vulnerable ? VULNERABLE_DAMAGE_MULTIPLIER : 1;
  if (phased) {
    // Lightning and frost are magic projectiles that disrupt the phase shift.
    if (options.attackKind === 'lightning' || options.attackKind === 'frost') {
      breakPhaseShift(target, events);
    } else if (options.source === 'attack' || options.source === 'thorns') {
      multiplier *= target.abilities.phaseShift?.damageFactor ?? 1;
    }
  }

  const armor = effectiveArmor(target, options.units);
  const amount = Math.max(1, Math.round(mitigatedDamage(rawDamage, armor) * multiplier));
  target.hp = Math.max(0, target.hp - amount);
  events.push({
    type: 'damage',
    unitId: target.id,
    amount,
    hp: target.hp,
    maxHp: target.maxHp,
    at: pointOf(target),
    source,
    blocked: false,
  });

  if (
    options.attackKind &&
    options.attackKind !== 'lightning' &&
    !isRangedAttackKind(options.attackKind)
  ) {
    const thorns = target.abilities.thorns;
    if (thorns && options.attackerId) {
      const attacker = options.units?.find((unit) => unit.id === options.attackerId);
      if (attacker && attacker.alive) {
        const thornsDamage = Math.max(1, Math.round(target.attack * thorns.factor));
        applyDamage(attacker, thornsDamage, events, {
          source: 'thorns',
          attackerId: target.id,
          ...(options.units ? { units: options.units } : {}),
        });
      }
    }
  }

  if (target.hp <= 0) {
    target.alive = false;
    events.push({
      type: 'death',
      unitId: target.id,
      team: target.team,
      at: pointOf(target),
    });
    if (options.units) {
      applyExplosion(target, options.units, events);
    }
  }
}

function applyPoison(target: MutableUnit, source: MutableUnit, events: BattleEvent[]): void {
  const ability = source.abilities.poison;
  if (!ability || !target.alive) return;
  const damagePerTick = Math.max(1, Math.round(source.attack * ability.attackFactor));
  target.poison = {
    remainingSec: ability.durationSec,
    tickInSec: ability.tickIntervalSec,
    tickIntervalSec: ability.tickIntervalSec,
    damagePerTick,
    sourceId: source.id,
  };
  events.push({
    type: 'status',
    unitId: target.id,
    status: 'poisoned',
    at: pointOf(target),
  });
}

function applySlow(target: MutableUnit, source: MutableUnit, events: BattleEvent[]): void {
  const ability = source.slowAbility;
  if (!ability || !target.alive) return;
  target.slow = {
    remainingSec: ability.durationSec,
    attackIntervalFactor: ability.attackIntervalFactor,
    moveSpeedFactor: ability.moveSpeedFactor,
  };
  events.push({
    type: 'status',
    unitId: target.id,
    status: 'slow',
    at: pointOf(target),
  });
}

function tickPoison(unit: MutableUnit, units: readonly MutableUnit[], events: BattleEvent[]): void {
  const poison = unit.poison;
  if (!poison) return;
  const remainingSec = poison.remainingSec - FIXED_TICK_SECONDS;
  let tickInSec = poison.tickInSec - FIXED_TICK_SECONDS;
  while (tickInSec <= 1e-9 && remainingSec >= -1e-9 && unit.alive) {
    applyDamage(unit, poison.damagePerTick, events, {
      source: 'poison',
      attackerId: poison.sourceId,
      units,
    });
    tickInSec += poison.tickIntervalSec;
  }
  if (!unit.alive) {
    unit.poison = null;
    return;
  }
  unit.poison =
    remainingSec > 1e-9
      ? {
          ...poison,
          remainingSec,
          tickInSec: Math.max(0, tickInSec),
        }
      : null;
}

function tickSlow(unit: MutableUnit): void {
  const slow = unit.slow;
  if (!slow) return;
  const remainingSec = slow.remainingSec - FIXED_TICK_SECONDS;
  unit.slow =
    remainingSec > 1e-9
      ? {
          ...slow,
          remainingSec,
        }
      : null;
}

function tickPhaseShift(unit: MutableUnit, events: BattleEvent[]): void {
  const ability = unit.abilities.phaseShift;
  const phase = unit.phaseShift;
  if (!ability || !phase) return;
  if (phase.active) {
    const remainingSec = Math.max(0, phase.remainingSec - FIXED_TICK_SECONDS);
    if (remainingSec <= 1e-9) {
      unit.phaseShift = { active: false, remainingSec: 0, cooldownSec: ability.cooldownSec };
      events.push({
        type: 'status',
        unitId: unit.id,
        status: 'phase-end',
        at: pointOf(unit),
      });
    } else {
      unit.phaseShift = { ...phase, remainingSec };
    }
  } else {
    const cooldownSec = Math.max(0, phase.cooldownSec - FIXED_TICK_SECONDS);
    if (cooldownSec <= 1e-9) {
      unit.phaseShift = { active: true, remainingSec: ability.durationSec, cooldownSec: 0 };
      events.push({
        type: 'status',
        unitId: unit.id,
        status: 'phase-start',
        at: pointOf(unit),
      });
    } else {
      unit.phaseShift = { ...phase, cooldownSec };
    }
  }
}

function tickSpinShield(
  unit: MutableUnit,
  units: readonly MutableUnit[],
  events: BattleEvent[],
): void {
  const ability = unit.abilities.spinShield;
  const spin = unit.spinShield;
  if (!ability || !spin) return;

  let { active, shielded, remainingSec, cooldownSec, speedFactor, vulnerableSec, auraTickInSec } =
    spin;
  if (vulnerableSec > 1e-9) {
    vulnerableSec = Math.max(0, vulnerableSec - FIXED_TICK_SECONDS);
  }

  if (active) {
    const spinStep = FIXED_TICK_SECONDS * (speedFactor > 0 ? speedFactor : 1);
    remainingSec = Math.max(0, remainingSec - spinStep);
    auraTickInSec -= spinStep;
    while (auraTickInSec <= 1e-9 && unit.alive) {
      const auraDamage = Math.max(1, Math.round(unit.attack * ability.auraAttackFactor));
      for (const ally of units) {
        if (!ally.alive || ally.team === unit.team) continue;
        if (entityDistance(unit, ally) <= ability.auraRadius + 1e-9) {
          applyDamage(ally, auraDamage, events, {
            source: 'spin-aura',
            attackerId: unit.id,
            units,
          });
        }
      }
      auraTickInSec += ability.auraTickIntervalSec;
      if (remainingSec <= 1e-9) break;
    }
    if (remainingSec <= 1e-9) {
      active = false;
      shielded = false;
      speedFactor = 1;
      auraTickInSec = 0;
      cooldownSec = ability.cooldownSec;
      events.push({
        type: 'status',
        unitId: unit.id,
        status: 'spin-end',
        at: pointOf(unit),
      });
    }
  } else {
    cooldownSec = Math.max(0, cooldownSec - FIXED_TICK_SECONDS);
    if (cooldownSec <= 1e-9) {
      active = true;
      shielded = true;
      remainingSec = ability.durationSec;
      speedFactor = 1;
      vulnerableSec = 0;
      auraTickInSec = ability.auraTickIntervalSec;
      events.push({
        type: 'status',
        unitId: unit.id,
        status: 'spin-start',
        at: pointOf(unit),
      });
    }
  }

  unit.spinShield = {
    active,
    shielded,
    remainingSec,
    cooldownSec,
    speedFactor,
    vulnerableSec,
    auraTickInSec,
  };
}

function findChainTarget(
  attacker: BattleUnit,
  primary: BattleUnit,
  units: readonly MutableUnit[],
): MutableUnit | null {
  let best: MutableUnit | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of units) {
    if (!candidate.alive || candidate.team === attacker.team || candidate.id === primary.id) {
      continue;
    }
    const dx = candidate.x - primary.x;
    const dy = candidate.y - primary.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > attacker.chainRange + 1e-9) continue;
    if (
      distance < bestDistance - 1e-9 ||
      (Math.abs(distance - bestDistance) <= 1e-9 &&
        best !== null &&
        compareUnitIds(candidate.id, best.id) < 0)
    ) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function moveToward(unit: MutableUnit, target: BattleUnit, delta: number): void {
  const dx = target.x - unit.x;
  const dy = target.y - unit.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= 0) return;
  const slowMoveFactor = unit.slow?.moveSpeedFactor ?? 1;
  const travel = Math.min(
    unit.moveSpeed * slowMoveFactor * delta,
    Math.max(0, distance - unit.range),
  );
  if (travel <= 0) return;
  unit.x = Math.min(BOARD_COLS - 0.5, Math.max(0.5, unit.x + (dx / distance) * travel));
  unit.y = Math.min(BOARD_ROWS - 0.5, Math.max(0.5, unit.y + (dy / distance) * travel));
}

function living(units: readonly BattleUnit[], team: Team): number {
  return units.reduce((count, unit) => (unit.alive && unit.team === team ? count + 1 : count), 0);
}

function healAction(unit: MutableUnit, units: readonly MutableUnit[], events: BattleEvent[]): void {
  const ability = unit.abilities.heal;
  if (!ability) return;
  let best: MutableUnit | null = null;
  let bestRatio = 1;
  for (const candidate of units) {
    if (!candidate.alive || candidate.team !== unit.team || candidate.id === unit.id) continue;
    if (candidate.hp >= candidate.maxHp) continue;
    if (entityDistance(unit, candidate) > ability.range + 1e-9) continue;
    const ratio = candidate.maxHp > 0 ? candidate.hp / candidate.maxHp : 0;
    if (
      ratio < bestRatio - 1e-9 ||
      (Math.abs(ratio - bestRatio) <= 1e-9 &&
        best !== null &&
        compareUnitIds(candidate.id, best.id) < 0)
    ) {
      best = candidate;
      bestRatio = ratio;
    }
  }
  if (!best) return;
  const amount = Math.max(1, Math.round(unit.attack * ability.attackFactor));
  best.hp = Math.min(best.maxHp, best.hp + amount);
  events.push({
    type: 'heal',
    unitId: unit.id,
    targetId: best.id,
    amount,
    hp: best.hp,
    maxHp: best.maxHp,
    at: pointOf(best),
  });
}

function stunAction(unit: MutableUnit, units: readonly MutableUnit[], events: BattleEvent[]): void {
  const ability = unit.abilities.stun;
  if (!ability) return;
  let best: MutableUnit | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of units) {
    if (!candidate.alive || candidate.team === unit.team) continue;
    const distance = entityDistance(unit, candidate);
    if (distance > ability.range + 1e-9) continue;
    if (
      distance < bestDistance - 1e-9 ||
      (Math.abs(distance - bestDistance) <= 1e-9 &&
        best !== null &&
        compareUnitIds(candidate.id, best.id) < 0)
    ) {
      best = candidate;
      bestDistance = distance;
    }
  }
  if (!best) return;
  best.frozenSec = Math.max(best.frozenSec, ability.durationSec);
  events.push({
    type: 'status',
    unitId: best.id,
    status: 'stunned',
    at: pointOf(best),
  });
}

interface SummonSpawn {
  readonly unit: MutableUnit;
  readonly event: BattleEvent;
}

function summonAction(
  unit: MutableUnit,
  state: BattleState,
  units: readonly MutableUnit[],
): SummonSpawn | null {
  const ability = unit.abilities.summon;
  if (!ability || unit.summonRemaining <= 0) return null;
  const spawnTypeId = ability.spawnTypeId;
  const definition = ENEMY_DEFINITIONS[spawnTypeId];
  const spawnLevel =
    ability.spawnLevel < 0
      ? Math.max(1, Math.min(40, unit.level + ability.spawnLevel))
      : ability.spawnLevel;
  const stats = enemyStatsForDifficulty(spawnTypeId, spawnLevel, state.difficulty);
  const modifier = waveModifierConfig(getWave(state.waveId)?.modifier);
  let cell = null;
  for (const candidate of ability.spawnCells) {
    const center = cellCenter(candidate.col, candidate.row);
    const occupied = units.some(
      (other) =>
        other.alive &&
        other.team === 'enemy' &&
        Math.hypot(other.x - center.x, other.y - center.y) < SUMMON_OCCUPANCY_RADIUS,
    );
    if (!occupied) {
      cell = center;
      break;
    }
  }
  if (!cell) return null;
  const spawnedId = `enemy-${state.waveId}-summon-${state.nextSummonId}`;
  const spawned: MutableUnit = {
    id: spawnedId,
    team: 'enemy',
    typeId: spawnTypeId,
    level: spawnLevel,
    mergeRank: 0,
    x: cell.x,
    y: cell.y,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    attack: Math.max(1, Math.round(stats.attack * (modifier?.enemyAttackFactor ?? 1))),
    attackIntervalSec: stats.attackIntervalSec,
    range: stats.range,
    moveSpeed: stats.moveSpeed * (modifier?.enemyMoveSpeedFactor ?? 1),
    armor: stats.armor,
    attackKind: enemyAttackKind(spawnTypeId),
    chainCount: 0,
    chainFactor: 0,
    chainRange: 0,
    splashRadius: 0,
    cooldown: 0,
    alive: true,
    isBoss: definition.isBoss,
    abilities: enemyAbilities(spawnTypeId),
    slowAbility: null,
    poison: null,
    spinShield: null,
    slow: null,
    phaseShift: null,
    poisonCooldownSec: 0,
    stunCooldownSec: 0,
    healCooldownSec: 1,
    summonTimerSec: 0,
    summonRemaining: 0,
    frozenSec: 0,
    enrageIndex: 0,
  };
  return {
    unit: spawned,
    event: {
      type: 'summon',
      unitId: unit.id,
      spawnedId,
      at: pointOf(spawned),
    },
  };
}

export function stepBattle(state: BattleState): BattleStepResult {
  if (state.status !== 'running') {
    return { state, events: [] };
  }

  const events: BattleEvent[] = [];
  const units: MutableUnit[] = state.units
    .map((unit) => ({ ...unit }))
    .sort((a, b) => compareUnitIds(a.id, b.id));
  const spawns: SummonSpawn[] = [];
  let nextSummonId = state.nextSummonId;

  if (state.ticks === 0) {
    const quake = units.find((unit) => unit.alive && unit.abilities.earthquake);
    const earthquake = quake?.abilities.earthquake;
    if (quake && earthquake) {
      events.push({
        type: 'earthquake',
        at: pointOf(quake),
        freezeSec: earthquake.freezeSec,
      });
    }
  }

  for (const unit of units) {
    if (!unit.alive) continue;

    if (unit.frozenSec > 1e-9) {
      unit.frozenSec = Math.max(0, unit.frozenSec - FIXED_TICK_SECONDS);
      continue;
    }

    unit.cooldown = Math.max(0, unit.cooldown - FIXED_TICK_SECONDS);
    unit.poisonCooldownSec = Math.max(0, unit.poisonCooldownSec - FIXED_TICK_SECONDS);
    unit.stunCooldownSec = Math.max(0, unit.stunCooldownSec - FIXED_TICK_SECONDS);
    tickPoison(unit, units, events);
    tickSlow(unit);
    if (!unit.alive) continue;
    tickSpinShield(unit, units, events);
    tickPhaseShift(unit, events);
    if (!unit.alive) continue;

    const enrageAbility = unit.abilities.enrage;
    if (enrageAbility) {
      const ratio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 0;
      let activeIndex = 0;
      for (let stepIndex = 0; stepIndex < enrageAbility.steps.length; stepIndex += 1) {
        const step = enrageAbility.steps[stepIndex];
        if (step && ratio <= step.threshold + 1e-9) {
          activeIndex = stepIndex + 1;
        }
      }
      if (activeIndex > unit.enrageIndex) {
        unit.enrageIndex = activeIndex;
        events.push({
          type: 'status',
          unitId: unit.id,
          status: 'enrage',
          at: pointOf(unit),
        });
      }
    }

    if (unit.abilities.stun && unit.stunCooldownSec <= 1e-9) {
      const before = events.length;
      stunAction(unit, units, events);
      if (events.length > before) {
        unit.stunCooldownSec = unit.abilities.stun.cooldownSec;
      }
    }

    if (unit.abilities.heal && unit.healCooldownSec <= 1e-9) {
      const before = events.length;
      healAction(unit, units, events);
      if (events.length > before) {
        const ability = unit.abilities.heal;
        unit.healCooldownSec = Math.max(ability.intervalSec, ability.cooldownSec || 0);
      }
    } else {
      unit.healCooldownSec = Math.max(0, unit.healCooldownSec - FIXED_TICK_SECONDS);
    }

    if (unit.abilities.summon && unit.summonRemaining > 0) {
      unit.summonTimerSec = Math.max(0, unit.summonTimerSec - FIXED_TICK_SECONDS);
      if (unit.summonTimerSec <= 1e-9) {
        const spawn = summonAction(unit, state, units);
        if (spawn) {
          spawns.push(spawn);
          unit.summonRemaining -= 1;
          unit.summonTimerSec = unit.abilities.summon.intervalSec;
          nextSummonId += 1;
        }
      }
    }

    const target = findTarget(unit, units);
    if (!target) break;

    const distance = entityDistance(unit, target);
    const spinning = unit.spinShield?.active ?? false;
    const poisonAbility = unit.abilities.poison;
    if (
      !spinning &&
      poisonAbility &&
      unit.poisonCooldownSec <= 1e-9 &&
      distance <= poisonAbility.range + 1e-9
    ) {
      events.push({
        type: 'attack',
        attackerId: unit.id,
        targetId: target.id,
        kind: 'poison',
        from: pointOf(unit),
        to: pointOf(target),
      });
      applyPoison(target, unit, events);
      unit.cooldown = unit.attackIntervalSec * (unit.slow?.attackIntervalFactor ?? 1);
      unit.poisonCooldownSec = poisonAbility.cooldownSec;
      continue;
    }

    if (distance > unit.range + 1e-9) {
      moveToward(unit, target, FIXED_TICK_SECONDS);
      continue;
    }

    if (spinning) continue;
    if (unit.cooldown > 1e-9) continue;
    unit.cooldown = unit.attackIntervalSec * (unit.slow?.attackIntervalFactor ?? 1);

    const attackDamage = Math.max(1, Math.round(unit.attack * enrageAttackFactor(unit)));
    events.push({
      type: 'attack',
      attackerId: unit.id,
      targetId: target.id,
      kind: unit.attackKind,
      from: pointOf(unit),
      to: pointOf(target),
    });
    applyDamage(target, attackDamage, events, {
      attackKind: unit.attackKind,
      attackerId: unit.id,
      units,
    });

    if (unit.slowAbility && target.alive) {
      applySlow(target, unit, events);
    }

    if (unit.splashRadius > 0) {
      for (const other of units) {
        if (!other.alive || other.team === unit.team || other.id === target.id) continue;
        if (entityDistance(unit, other) <= unit.splashRadius + 1e-9) {
          applyDamage(other, attackDamage, events, {
            attackKind: unit.attackKind,
            attackerId: unit.id,
            units,
          });
        }
      }
    }

    if (unit.chainCount > 0 && target.alive) {
      let chained = false;
      for (let jump = 0; jump < unit.chainCount; jump += 1) {
        const chainTarget = findChainTarget(unit, target, units);
        if (!chainTarget) break;
        chained = true;
        events.push({
          type: 'chain',
          attackerId: unit.id,
          targetId: chainTarget.id,
          from: pointOf(target),
          to: pointOf(chainTarget),
        });
        applyDamage(chainTarget, unit.attack * unit.chainFactor, events, {
          attackKind: unit.attackKind,
          attackerId: unit.id,
          units,
        });
      }
      // With no nearby second target the lightning arcs back to the primary victim.
      if (!chained) {
        events.push({
          type: 'chain',
          attackerId: unit.id,
          targetId: target.id,
          from: pointOf(target),
          to: pointOf(target),
        });
        applyDamage(target, unit.attack * unit.chainFactor, events, {
          attackKind: unit.attackKind,
          attackerId: unit.id,
          units,
        });
      }
    }
  }

  for (const spawn of spawns) {
    units.push(spawn.unit);
    events.push(spawn.event);
  }

  const elapsedSec = state.elapsedSec + FIXED_TICK_SECONDS;
  const alliesAlive = living(units, 'ally');
  const enemiesAlive = living(units, 'enemy');
  let status: BattleStatus = state.status;
  if (enemiesAlive === 0) {
    status = 'victory';
  } else if (alliesAlive === 0 || elapsedSec >= maxBattleSeconds(state.waveId)) {
    status = 'defeat';
  }

  if (status !== 'running') {
    events.push({
      type: 'battle-end',
      outcome: status === 'victory' ? 'victory' : 'defeat',
    });
  }

  return {
    state: {
      ...state,
      ticks: state.ticks + 1,
      elapsedSec,
      status,
      units,
      nextSummonId,
    },
    events,
  };
}

export function runBattleToCompletion(
  state: BattleState,
  maxTicks = Math.ceil(maxBattleSeconds(state.waveId) / FIXED_TICK_SECONDS) + 5,
): { state: BattleState; events: readonly BattleEvent[] } {
  let current = state;
  const events: BattleEvent[] = [];
  for (let tick = 0; tick < maxTicks && current.status === 'running'; tick += 1) {
    const result = stepBattle(current);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}
