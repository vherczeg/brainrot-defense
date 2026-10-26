import { characterStats } from '../domain/characters';
import { characterLevelFromXp } from '../domain/progression';
import { ENEMY_DEFINITIONS, enemyAbilities } from '../domain/enemies';
import { enemyStatsForDifficulty } from '../domain/difficulty';
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
  MAX_BATTLE_SECONDS,
  type BattleEvent,
  type BattlePoint,
  type BattleState,
  type BattleStepResult,
  type BattleUnit,
  type DamageSource,
  type PoisonStatus,
  type SpinShieldStatus,
} from './types';

const EMPTY_ABILITIES: EnemyAbilities = {
  poison: null,
  spinShield: null,
  earthquake: null,
};
const VULNERABLE_DAMAGE_MULTIPLIER = 1.5;

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
  return kind === 'laser' || kind === 'lightning';
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

export function createBattleState(
  characters: readonly CharacterInstance[],
  wave: WaveDefinition,
  seed = 1,
  difficulty: Difficulty = 'normal',
): BattleState {
  const earthquakeFreezeSec = wave.enemies.reduce((longest, config) => {
    const freezeSec = enemyAbilities(config.typeId).earthquake?.freezeSec ?? 0;
    return Math.max(longest, freezeSec);
  }, 0);

  const allyUnits: BattleUnit[] = characters.map((character) => {
    const stats = characterStats(character.typeId, character.mergeRank, character.totalXp);
    const position = cellCenter(character.col, character.row);
    return {
      id: character.id,
      team: 'ally',
      typeId: character.typeId,
      level: characterLevelFromXp(character.totalXp),
      mergeRank: character.mergeRank,
      x: position.x,
      y: position.y,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      attack: stats.attack,
      attackIntervalSec: stats.attackIntervalSec,
      range: stats.range,
      moveSpeed: stats.moveSpeed,
      armor: 0,
      attackKind: character.typeId === 'lightning-scorpion' ? 'lightning' : 'laser',
      chainCount: character.typeId === 'lightning-scorpion' ? 1 : 0,
      chainFactor: character.typeId === 'lightning-scorpion' ? 0.6 : 0,
      chainRange: character.typeId === 'lightning-scorpion' ? 1.6 : 0,
      cooldown: 0,
      alive: true,
      isBoss: false,
      abilities: EMPTY_ABILITIES,
      poison: null,
      spinShield: null,
      poisonCooldownSec: 0,
      frozenSec: earthquakeFreezeSec,
    };
  });

  const enemyUnits: BattleUnit[] = wave.enemies.map((config, index) => {
    const stats = enemyStatsForDifficulty(config.typeId, config.level, difficulty);
    const abilities = enemyAbilities(config.typeId);
    const position = cellCenter(config.col, config.row);
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
      attack: stats.attack,
      attackIntervalSec: stats.attackIntervalSec,
      range: stats.range,
      moveSpeed: stats.moveSpeed,
      armor: stats.armor,
      attackKind:
        config.typeId === 'mega-brainrot-gorilla'
          ? 'boss-smash'
          : config.typeId === 'green-venom-falcon'
            ? 'claw'
            : 'melee',
      chainCount: 0,
      chainFactor: 0,
      chainRange: 0,
      cooldown: 0,
      alive: true,
      isBoss: ENEMY_DEFINITIONS[config.typeId].isBoss,
      abilities,
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
      poisonCooldownSec: abilities.poison ? 1 : 0,
      frozenSec: earthquakeFreezeSec,
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
  };
}

export function mitigatedDamage(rawDamage: number, armor: number): number {
  const safeArmor = Math.min(0.9, Math.max(0, armor));
  const safeRaw = Math.max(0, rawDamage);
  return Math.max(1, Math.round(safeRaw * (1 - safeArmor)));
}

interface MutableUnit extends BattleUnit {
  hp: number;
  x: number;
  y: number;
  cooldown: number;
  alive: boolean;
  poison: PoisonStatus | null;
  spinShield: SpinShieldStatus | null;
  poisonCooldownSec: number;
  frozenSec: number;
}

interface DamageOptions {
  readonly attackKind?: AttackKind;
  readonly source?: DamageSource;
  readonly attackerId?: string;
}

function pointOf(unit: BattleUnit): BattlePoint {
  return { x: unit.x, y: unit.y };
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
  const multiplier = vulnerable ? VULNERABLE_DAMAGE_MULTIPLIER : 1;
  const amount = Math.max(1, Math.round(mitigatedDamage(rawDamage, target.armor) * multiplier));
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
  if (target.hp <= 0) {
    target.alive = false;
    events.push({
      type: 'death',
      unitId: target.id,
      team: target.team,
      at: pointOf(target),
    });
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

function tickPoison(unit: MutableUnit, events: BattleEvent[]): void {
  const poison = unit.poison;
  if (!poison) return;
  const remainingSec = poison.remainingSec - FIXED_TICK_SECONDS;
  let tickInSec = poison.tickInSec - FIXED_TICK_SECONDS;
  while (tickInSec <= 1e-9 && remainingSec >= -1e-9 && unit.alive) {
    applyDamage(unit, poison.damagePerTick, events, {
      source: 'poison',
      attackerId: poison.sourceId,
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
  const travel = Math.min(unit.moveSpeed * delta, Math.max(0, distance - unit.range));
  if (travel <= 0) return;
  unit.x = Math.min(BOARD_COLS - 0.5, Math.max(0.5, unit.x + (dx / distance) * travel));
  unit.y = Math.min(BOARD_ROWS - 0.5, Math.max(0.5, unit.y + (dy / distance) * travel));
}

function living(units: readonly BattleUnit[], team: Team): number {
  return units.reduce((count, unit) => (unit.alive && unit.team === team ? count + 1 : count), 0);
}

export function stepBattle(state: BattleState): BattleStepResult {
  if (state.status !== 'running') {
    return { state, events: [] };
  }

  const events: BattleEvent[] = [];
  const units: MutableUnit[] = state.units
    .map((unit) => ({ ...unit }))
    .sort((a, b) => compareUnitIds(a.id, b.id));

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
    tickPoison(unit, events);
    if (!unit.alive) continue;
    tickSpinShield(unit, units, events);
    if (!unit.alive) continue;

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
      unit.cooldown = unit.attackIntervalSec;
      unit.poisonCooldownSec = poisonAbility.cooldownSec;
      continue;
    }

    if (distance > unit.range + 1e-9) {
      moveToward(unit, target, FIXED_TICK_SECONDS);
      continue;
    }

    if (spinning) continue;
    if (unit.cooldown > 1e-9) continue;
    unit.cooldown = unit.attackIntervalSec;

    events.push({
      type: 'attack',
      attackerId: unit.id,
      targetId: target.id,
      kind: unit.attackKind,
      from: pointOf(unit),
      to: pointOf(target),
    });
    applyDamage(target, unit.attack, events, {
      attackKind: unit.attackKind,
      attackerId: unit.id,
    });

    if (unit.chainCount > 0 && target.alive) {
      for (let jump = 0; jump < unit.chainCount; jump += 1) {
        const chainTarget = findChainTarget(unit, target, units);
        if (!chainTarget) break;
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
        });
      }
    }
  }

  const elapsedSec = state.elapsedSec + FIXED_TICK_SECONDS;
  const alliesAlive = living(units, 'ally');
  const enemiesAlive = living(units, 'enemy');
  let status: BattleStatus = state.status;
  if (enemiesAlive === 0) {
    status = 'victory';
  } else if (alliesAlive === 0 || elapsedSec >= MAX_BATTLE_SECONDS) {
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
    },
    events,
  };
}

export function runBattleToCompletion(
  state: BattleState,
  maxTicks = Math.ceil(MAX_BATTLE_SECONDS / FIXED_TICK_SECONDS) + 5,
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
