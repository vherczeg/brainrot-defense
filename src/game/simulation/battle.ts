import { characterStats } from '../domain/characters';
import { enemyStats } from '../domain/enemies';
import {
  BOARD_COLS,
  BOARD_ROWS,
  type BattleStatus,
  type CharacterInstance,
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
} from './types';

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
): BattleState {
  const allyUnits: BattleUnit[] = characters.map((character) => {
    const stats = characterStats(character.typeId, character.level);
    const position = cellCenter(character.col, character.row);
    return {
      id: character.id,
      team: 'ally',
      typeId: character.typeId,
      level: character.level,
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
    };
  });

  const enemyUnits: BattleUnit[] = wave.enemies.map((config, index) => {
    const stats = enemyStats(config.typeId, config.level);
    const position = cellCenter(config.col, config.row);
    return {
      id: `enemy-${wave.id}-${index + 1}`,
      team: 'enemy',
      typeId: config.typeId,
      level: config.level,
      x: position.x,
      y: position.y,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      attack: stats.attack,
      attackIntervalSec: stats.attackIntervalSec,
      range: stats.range,
      moveSpeed: stats.moveSpeed,
      armor: stats.armor,
      attackKind: config.typeId === 'mega-brainrot-gorilla' ? 'boss-smash' : 'melee',
      chainCount: 0,
      chainFactor: 0,
      chainRange: 0,
      cooldown: 0,
      alive: true,
      isBoss: stats.attack > 0 && config.typeId === 'mega-brainrot-gorilla',
    };
  });

  return {
    waveId: wave.id,
    seed,
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
}

function pointOf(unit: BattleUnit): BattlePoint {
  return { x: unit.x, y: unit.y };
}

function applyDamage(target: MutableUnit, rawDamage: number, events: BattleEvent[]): void {
  if (!target.alive) return;
  const amount = mitigatedDamage(rawDamage, target.armor);
  target.hp = Math.max(0, target.hp - amount);
  events.push({
    type: 'damage',
    unitId: target.id,
    amount,
    hp: target.hp,
    maxHp: target.maxHp,
    at: pointOf(target),
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

  for (const unit of units) {
    if (!unit.alive) continue;
    unit.cooldown = Math.max(0, unit.cooldown - FIXED_TICK_SECONDS);
    const target = findTarget(unit, units);
    if (!target) break;

    const distance = entityDistance(unit, target);
    if (distance > unit.range + 1e-9) {
      moveToward(unit, target, FIXED_TICK_SECONDS);
      continue;
    }

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
    applyDamage(target, unit.attack, events);

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
        applyDamage(chainTarget, unit.attack * unit.chainFactor, events);
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
