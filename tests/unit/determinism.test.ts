import { describe, expect, it } from 'vitest';
import {
  createBattleState,
  runBattleToCompletion,
  stepBattle,
} from '../../src/game/simulation/battle';
import { BattleSession } from '../../src/game/simulation/battleSession';
import type { BattleState } from '../../src/game/simulation/types';
import { unit, waveWith } from './testFixtures';

const characters = [
  unit('unit-1', 'laser-crocodile', 3, 1, 4),
  unit('unit-2', 'laser-crocodile', 2, 2, 3),
  unit('unit-3', 'lightning-scorpion', 3, 4, 4),
];

const wave = waveWith([
  { typeId: 'mini-brainrot', level: 3, col: 1, row: 1 },
  { typeId: 'armored-slug', level: 2, col: 2, row: 0 },
  { typeId: 'shadow-runner', level: 2, col: 4, row: 1 },
  { typeId: 'mini-brainrot', level: 2, col: 5, row: 0 },
]);

function initialState(): BattleState {
  return createBattleState(characters, wave, 123456);
}

function runSession(session: BattleSession, deltaMs: number, limit = 20_000): void {
  let elapsed = 0;
  while (!session.isFinished() && elapsed < limit) {
    session.advance(deltaMs);
    elapsed += deltaMs;
  }
}

describe('deterministic battle simulation', () => {
  it('produces identical outcomes for identical seeds', () => {
    const first = runBattleToCompletion(initialState());
    const second = runBattleToCompletion(initialState());
    expect(first.state.status).toBe(second.state.status);
    expect(first.state.ticks).toBe(second.state.ticks);
    expect(JSON.stringify(first.state.units)).toBe(JSON.stringify(second.state.units));
  });

  it('produces identical results regardless of render frame rate', () => {
    const slow = new BattleSession(initialState(), 1);
    runSession(slow, 50);
    const fast = new BattleSession(initialState(), 1);
    runSession(fast, 5);

    expect(slow.getState().status).toBe(fast.getState().status);
    expect(slow.getState().ticks).toBe(fast.getState().ticks);
    expect(JSON.stringify(slow.getState().units)).toBe(JSON.stringify(fast.getState().units));
  });

  it('produces the same result at 1x and 2x battle speed', () => {
    const normal = new BattleSession(initialState(), 1);
    runSession(normal, 16);
    const double = new BattleSession(initialState(), 2);
    runSession(double, 16);

    expect(normal.getState().status).toBe(double.getState().status);
    expect(normal.getState().ticks).toBe(double.getState().ticks);
    expect(JSON.stringify(normal.getState().units)).toBe(JSON.stringify(double.getState().units));
  });

  it('matches manual fixed-step advancement', () => {
    const automatic = runBattleToCompletion(initialState());
    let manual = initialState();
    for (let tick = 0; tick < 5000 && manual.status === 'running'; tick += 1) {
      manual = stepBattle(manual).state;
    }
    expect(manual.status).toBe(automatic.state.status);
    expect(manual.ticks).toBe(automatic.state.ticks);
    expect(JSON.stringify(manual.units)).toBe(JSON.stringify(automatic.state.units));
  });

  it('does not mutate source character data', () => {
    const before = structuredClone(characters);
    runBattleToCompletion(initialState());
    expect(characters).toEqual(before);
  });

  it('caps catch-up work after a long frame gap', () => {
    const session = new BattleSession(initialState(), 2);
    session.advance(10_000);
    const ticksAfterHugeDelta = session.getState().ticks;
    expect(ticksAfterHugeDelta).toBeLessThanOrEqual(20);
    expect(ticksAfterHugeDelta).toBeGreaterThan(0);
  });
});
