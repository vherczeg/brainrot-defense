import { describe, expect, it } from 'vitest';
import {
  createBattleState,
  findTarget,
  mitigatedDamage,
  runBattleToCompletion,
  stepBattle,
} from '../../src/game/simulation/battle';
import type { BattleEvent } from '../../src/game/simulation/types';
import { unit, waveWith } from './testFixtures';

function attacks(events: readonly BattleEvent[], attackerId: string): BattleEvent[] {
  return events.filter((event) => event.type === 'attack' && event.attackerId === attackerId);
}

describe('targeting', () => {
  it('acquires the nearest living enemy with a stable id tie-breaker', () => {
    const characters = [unit('unit-1', 'laser-crocodile', 1, 2, 4)];
    const wave = waveWith([
      { typeId: 'mini-brainrot', level: 1, col: 1, row: 2 },
      { typeId: 'mini-brainrot', level: 1, col: 3, row: 2 },
      { typeId: 'mini-brainrot', level: 1, col: 5, row: 0 },
    ]);
    const state = createBattleState(characters, wave);
    const ally = state.units.find((u) => u.id === 'unit-1');
    expect(ally).toBeDefined();
    if (!ally) return;
    const target = findTarget(ally, state.units);
    expect(target?.id).toBe('enemy-99-1');
  });

  it('ignores dead enemies when acquiring targets', () => {
    const characters = [unit('unit-1', 'laser-crocodile', 1, 2, 4)];
    const wave = waveWith([
      { typeId: 'mini-brainrot', level: 1, col: 1, row: 2 },
      { typeId: 'mini-brainrot', level: 1, col: 3, row: 2 },
    ]);
    const state = createBattleState(characters, wave);
    const ally = state.units.find((u) => u.id === 'unit-1');
    if (!ally) throw new Error('missing ally');
    const modified = {
      ...state,
      units: state.units.map((u) => (u.id === 'enemy-99-1' ? { ...u, alive: false, hp: 0 } : u)),
    };
    expect(findTarget(ally, modified.units)?.id).toBe('enemy-99-2');
  });
});

describe('ranged combat and cooldowns', () => {
  it('does not fire at a target outside range', () => {
    const characters = [unit('unit-1', 'laser-crocodile', 1, 0, 4)];
    const wave = waveWith([{ typeId: 'mini-brainrot', level: 1, col: 5, row: 0 }]);
    const state = createBattleState(characters, wave);
    const result = stepBattle(state);
    expect(attacks(result.events, 'unit-1')).toHaveLength(0);
  });

  it('fires when a target enters range', () => {
    const characters = [unit('unit-1', 'laser-crocodile', 1, 2, 4)];
    const wave = waveWith([{ typeId: 'mini-brainrot', level: 1, col: 2, row: 2 }]);
    const state = createBattleState(characters, wave);
    const result = stepBattle(state);
    expect(attacks(result.events, 'unit-1')).toHaveLength(1);
  });

  it('respects attack cooldowns', () => {
    const characters = [unit('unit-1', 'laser-crocodile', 1, 2, 3)];
    const wave = waveWith([{ typeId: 'armored-slug', level: 1, col: 2, row: 2 }]);
    let state = createBattleState(characters, wave);
    const attackTicks: number[] = [];
    for (let tick = 1; tick <= 40; tick += 1) {
      const result = stepBattle(state);
      if (attacks(result.events, 'unit-1').length > 0) attackTicks.push(tick);
      state = result.state;
    }
    expect(attackTicks[0]).toBe(1);
    expect(attackTicks[1]).toBeGreaterThanOrEqual(30);
    expect(attackTicks[1]).toBeLessThanOrEqual(32);
  });
});

describe('damage and armor', () => {
  it('applies armor mitigation with a minimum of one damage', () => {
    expect(mitigatedDamage(100, 0.35)).toBe(65);
    expect(mitigatedDamage(100, 0)).toBe(100);
    expect(mitigatedDamage(1, 0.35)).toBe(1);
    expect(mitigatedDamage(100, 5)).toBe(10);
  });

  it('actually reduces damage against armored enemies', () => {
    const characters = [unit('unit-1', 'laser-crocodile', 1, 2, 3)];
    const wave = waveWith([{ typeId: 'armored-slug', level: 1, col: 2, row: 2 }]);
    const state = createBattleState(characters, wave);
    const result = stepBattle(state);
    const damage = result.events.find(
      (event) => event.type === 'damage' && event.unitId === 'enemy-99-1',
    );
    expect(damage).toBeDefined();
    if (damage?.type !== 'damage') return;
    expect(damage.amount).toBe(Math.round(12 * 0.65));
  });

  it('limits lightning chains to the configured number of jumps', () => {
    const characters = [unit('unit-1', 'lightning-scorpion', 1, 2, 3)];
    const wave = waveWith([
      { typeId: 'mini-brainrot', level: 1, col: 2, row: 2 },
      { typeId: 'mini-brainrot', level: 1, col: 1, row: 2 },
      { typeId: 'mini-brainrot', level: 1, col: 3, row: 2 },
    ]);
    const state = createBattleState(characters, wave);
    const result = stepBattle(state);
    const chainEvents = result.events.filter((event) => event.type === 'chain');
    expect(chainEvents).toHaveLength(1);
    const damagedEnemies = result.events
      .filter((event) => event.type === 'damage' && event.unitId.startsWith('enemy-'))
      .map((event) => (event.type === 'damage' ? event.unitId : ''));
    expect(new Set(damagedEnemies).size).toBe(2);
  });

  it('does not let dead units attack again', () => {
    const characters = [unit('unit-1', 'laser-crocodile', 10, 2, 3)];
    const wave = waveWith([{ typeId: 'mini-brainrot', level: 1, col: 2, row: 2 }]);
    let state = createBattleState(characters, wave);
    const allEvents: BattleEvent[] = [];
    let deathTick = -1;
    for (let tick = 1; tick <= 10; tick += 1) {
      const result = stepBattle(state);
      state = result.state;
      allEvents.push(...result.events);
      if (deathTick === -1 && result.events.some((event) => event.type === 'death')) {
        deathTick = tick;
      }
    }
    const enemyAttacks = allEvents.filter(
      (event) => event.type === 'attack' && event.attackerId === 'enemy-99-1',
    );
    expect(deathTick).toBeGreaterThanOrEqual(1);
    expect(enemyAttacks.length).toBeLessThanOrEqual(1);
  });
});

describe('battle resolution', () => {
  it('detects victory when all enemies are defeated', () => {
    const characters = [unit('unit-1', 'laser-crocodile', 10, 2, 3)];
    const wave = waveWith([{ typeId: 'mini-brainrot', level: 1, col: 2, row: 2 }]);
    const state = createBattleState(characters, wave);
    const result = runBattleToCompletion(state);
    expect(result.state.status).toBe('victory');
    expect(
      result.events.some((event) => event.type === 'battle-end' && event.outcome === 'victory'),
    ).toBe(true);
  });

  it('detects defeat when all allies are defeated', () => {
    const characters = [unit('unit-1', 'laser-crocodile', 1, 2, 3)];
    const wave = waveWith([{ typeId: 'mega-brainrot-gorilla', level: 10, col: 2, row: 2 }]);
    const state = createBattleState(characters, wave);
    const result = runBattleToCompletion(state);
    expect(result.state.status).toBe('defeat');
  });

  it('times out into defeat if neither side can finish', () => {
    const characters = [unit('unit-1', 'laser-crocodile', 1, 0, 4)];
    const wave = waveWith([{ typeId: 'armored-slug', level: 1, col: 5, row: 0 }]);
    const state = createBattleState(characters, wave);
    const result = runBattleToCompletion({
      ...state,
      units: state.units.map((unitState) => ({
        ...unitState,
        moveSpeed: 0,
        attack: 1,
        hp: 1_000_000,
        maxHp: 1_000_000,
        range: 0.1,
      })),
    });
    expect(result.state.status).toBe('defeat');
    expect(result.state.elapsedSec).toBeGreaterThanOrEqual(90);
  });

  it('keeps the persistent army intact after defeat', () => {
    const characters = [unit('unit-1', 'laser-crocodile', 1, 2, 3)];
    const before = structuredClone(characters);
    const wave = waveWith([{ typeId: 'mega-brainrot-gorilla', level: 10, col: 2, row: 2 }]);
    const state = createBattleState(characters, wave);
    const result = runBattleToCompletion(state);
    expect(result.state.status).toBe('defeat');
    expect(characters).toEqual(before);
  });
});
