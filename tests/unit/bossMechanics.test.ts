import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS } from '../../src/game/domain/enemies';
import type { BattleState } from '../../src/game/simulation/types';
import {
  createBattleState,
  runBattleToCompletion,
  stepBattle,
} from '../../src/game/simulation/battle';
import { unit, waveWith } from './testFixtures';

const BOSS = 'enemy-99-1';
const ALLY = 'unit-1';

function falconWave() {
  return waveWith([{ typeId: 'green-venom-falcon', level: 3, col: 2, row: 1 }]);
}

function strongAlly() {
  return unit(ALLY, 'laser-crocodile', 10, 2, 3, 0);
}

function withoutFreeze(state: BattleState): BattleState {
  return {
    ...state,
    units: state.units.map((entry) => ({ ...entry, frozenSec: 0 })),
  };
}

function updateUnit(
  state: BattleState,
  id: string,
  update: (unit: BattleState['units'][number]) => BattleState['units'][number],
): BattleState {
  return {
    ...state,
    units: state.units.map((entry) => (entry.id === id ? update(entry) : entry)),
  };
}

function prepareFalcon(state: BattleState): BattleState {
  return updateUnit(withoutFreeze(state), BOSS, (boss) => ({
    ...boss,
    poisonCooldownSec: 0,
    spinShield: boss.spinShield
      ? { ...boss.spinShield, active: false, shielded: false, cooldownSec: 999 }
      : null,
  }));
}

describe('Green Venom Falcon abilities', () => {
  it('is defined as the wave 20 boss with all required abilities', () => {
    const definition = ENEMY_DEFINITIONS['green-venom-falcon'];
    expect(definition.isBoss).toBe(true);
    expect(definition.abilities?.earthquake?.freezeSec).toBe(2);
    expect(definition.abilities?.poison?.durationSec).toBeGreaterThan(0);
    expect(definition.abilities?.spinShield?.rangedSlowFactor).toBe(0.5);
  });

  it('spits poison that deals gradual damage over time', () => {
    let state = prepareFalcon(createBattleState([strongAlly()], falconWave()));
    const first = stepBattle(state);
    state = first.state;

    expect(
      first.events.some(
        (event) => event.type === 'attack' && event.attackerId === BOSS && event.kind === 'poison',
      ),
    ).toBe(true);
    expect(
      first.events.some(
        (event) => event.type === 'status' && event.unitId === ALLY && event.status === 'poisoned',
      ),
    ).toBe(true);

    const hpAfterSpit = state.units.find((entry) => entry.id === ALLY)?.hp ?? 0;
    const poisonDamage: number[] = [];
    for (let tick = 0; tick < 60; tick += 1) {
      const result = stepBattle(state);
      state = result.state;
      for (const event of result.events) {
        if (event.type === 'damage' && event.unitId === ALLY && event.source === 'poison') {
          poisonDamage.push(event.amount);
        }
      }
    }
    expect(poisonDamage.length).toBeGreaterThanOrEqual(1);
    expect(poisonDamage.every((amount) => amount > 0)).toBe(true);
    expect(state.units.find((entry) => entry.id === ALLY)?.hp ?? 0).toBeLessThan(hpAfterSpit);
  });

  it('is immune to normal (melee) attacks while spinning and damages nearby allies', () => {
    let state = prepareFalcon(createBattleState([strongAlly()], falconWave()));
    state = updateUnit(state, BOSS, (boss) => ({
      ...boss,
      spinShield: boss.spinShield
        ? {
            ...boss.spinShield,
            active: true,
            shielded: true,
            remainingSec: 5,
            speedFactor: 1,
            cooldownSec: 999,
            auraTickInSec: 0,
          }
        : null,
    }));
    state = updateUnit(state, ALLY, (ally) => ({
      ...ally,
      attackKind: 'melee',
      cooldown: 0,
      attack: 500,
    }));
    const bossHpBefore = state.units.find((entry) => entry.id === BOSS)?.hp ?? 0;
    const allyHpBefore = state.units.find((entry) => entry.id === ALLY)?.hp ?? 0;

    const result = stepBattle(state);
    const bossDamage = result.events.filter(
      (event) => event.type === 'damage' && event.unitId === BOSS,
    );
    const auraDamage = result.events.filter(
      (event) => event.type === 'damage' && event.unitId === ALLY && event.source === 'spin-aura',
    );

    expect(auraDamage.length).toBeGreaterThanOrEqual(1);
    expect(bossDamage.some((event) => event.type === 'damage' && event.blocked)).toBe(true);
    expect(result.state.units.find((entry) => entry.id === BOSS)?.hp).toBe(bossHpBefore);
    expect(result.state.units.find((entry) => entry.id === ALLY)?.hp ?? 0).toBeLessThan(
      allyHpBefore,
    );
  });

  it('a ranged hit halves the spin, breaks the shield and makes the boss vulnerable', () => {
    let state = prepareFalcon(createBattleState([strongAlly()], falconWave()));
    state = updateUnit(state, BOSS, (boss) => ({
      ...boss,
      spinShield: boss.spinShield
        ? {
            ...boss.spinShield,
            active: true,
            shielded: true,
            remainingSec: 5,
            speedFactor: 1,
            cooldownSec: 999,
            auraTickInSec: 999,
          }
        : null,
    }));
    state = updateUnit(state, ALLY, (ally) => ({ ...ally, cooldown: 0 }));
    const bossHpBefore = state.units.find((entry) => entry.id === BOSS)?.hp ?? 0;

    const result = stepBattle(state);
    const boss = result.state.units.find((entry) => entry.id === BOSS);

    expect(
      result.events.some(
        (event) =>
          event.type === 'status' && event.unitId === BOSS && event.status === 'spin-break',
      ),
    ).toBe(true);
    expect(boss?.spinShield?.shielded).toBe(false);
    expect(boss?.spinShield?.active).toBe(true);
    expect(boss?.spinShield?.speedFactor).toBe(0.5);
    expect(boss?.spinShield?.vulnerableSec ?? 0).toBeGreaterThan(0);
    expect(boss?.hp ?? 0).toBeLessThan(bossHpBefore);
  });

  it('freezes every combat unit for two seconds on arrival', () => {
    const initial = createBattleState([strongAlly()], falconWave());
    expect(initial.units.every((entry) => entry.frozenSec === 2)).toBe(true);

    let result = stepBattle(initial);
    expect(
      result.events.some((event) => event.type === 'earthquake' && event.freezeSec === 2),
    ).toBe(true);
    expect(result.events.some((event) => event.type === 'attack')).toBe(false);
    expect(result.state.units.every((entry) => entry.frozenSec > 1.9)).toBe(true);

    let state = result.state;
    for (let tick = 0; tick < 59; tick += 1) {
      result = stepBattle(state);
      state = result.state;
      expect(result.events.some((event) => event.type === 'attack')).toBe(false);
    }
    expect(state.units.every((entry) => entry.frozenSec === 0)).toBe(true);

    result = stepBattle(state);
    expect(result.events.some((event) => event.type === 'attack')).toBe(true);
  });

  it('can still resolve a full wave 20 battle', () => {
    const wave = waveWith(
      [
        { typeId: 'green-venom-falcon', level: 3, col: 2, row: 1 },
        { typeId: 'mini-brainrot', level: 5, col: 0, row: 0 },
      ],
      20,
    );
    const allies = [
      unit('unit-1', 'laser-crocodile', 10, 0, 3, 0),
      unit('unit-2', 'laser-crocodile', 10, 1, 3, 0),
      unit('unit-3', 'lightning-scorpion', 10, 2, 3, 0),
      unit('unit-4', 'lightning-scorpion', 10, 3, 3, 0),
    ];
    const result = runBattleToCompletion(createBattleState(allies, wave, 20));
    expect(['victory', 'defeat']).toContain(result.state.status);
  });
});
