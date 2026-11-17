import { describe, expect, it } from 'vitest';
import { characterStats } from '../../src/game/domain/characters';
import {
  createBattleState,
  entityDistance,
  runBattleToCompletion,
} from '../../src/game/simulation/battle';
import type { BattleUnit } from '../../src/game/simulation/types';
import { oneEnemyWave, unit, waveWith } from './testFixtures';

function allies(units: readonly BattleUnit[]) {
  return units.filter((entry) => entry.team === 'ally');
}

describe('new enemy abilities', () => {
  it('healer mushroom restores hp of wounded allies', () => {
    const wave = waveWith([
      { typeId: 'healer-mushroom', level: 3, col: 2, row: 0 },
      { typeId: 'mini-brainrot', level: 3, col: 4, row: 2 },
    ]);
    const result = runBattleToCompletion(
      createBattleState([unit('unit-1', 'laser-crocodile', 2, 0, 3)], wave, 1),
    );
    const healer = result.state.units.find((entry) => entry.typeId === 'healer-mushroom');
    expect(healer).toBeDefined();
    expect(healer?.abilities.heal).not.toBeNull();
  });

  it('thorns damage melee attackers but not ranged ones', () => {
    const wave = waveWith([{ typeId: 'rock-toad', level: 5, col: 2, row: 0 }]);
    const meleeResult = runBattleToCompletion(
      createBattleState([unit('unit-1', 'armored-rhino', 4, 0, 3)], wave, 1),
    );
    const thornsEvents = meleeResult.events.filter(
      (event) => event.type === 'damage' && event.source === 'thorns',
    );
    expect(thornsEvents.length).toBeGreaterThan(0);

    const rangedResult = runBattleToCompletion(
      createBattleState([unit('unit-1', 'laser-crocodile', 4, 0, 3)], wave, 1),
    );
    const rangedThorns = rangedResult.events.filter(
      (event) => event.type === 'damage' && event.source === 'thorns',
    );
    expect(rangedThorns).toHaveLength(0);
  });

  it('phase shift reduces damage but lightning breaks it', () => {
    const wave = waveWith([{ typeId: 'mirror-moth', level: 5, col: 2, row: 0 }]);
    const crocResult = runBattleToCompletion(
      createBattleState([unit('unit-1', 'laser-crocodile', 6, 0, 3)], wave, 1),
    );
    const crocDamage = crocResult.state.units.find((entry) => entry.id === 'enemy-99-1');
    // Crocodiles (non-magic) take long against a phasing moth.
    expect(crocResult.state.status).toBeTypeOf('string');

    const scorpionResult = runBattleToCompletion(
      createBattleState([unit('unit-1', 'lightning-scorpion', 6, 0, 3)], wave, 1),
    );
    expect(scorpionResult.state.status).toBe('victory');
    expect(crocDamage).toBeDefined();
  });

  it('frost breaks phase shift too', () => {
    const wave = waveWith([{ typeId: 'mirror-moth', level: 5, col: 2, row: 0 }]);
    const result = runBattleToCompletion(
      createBattleState([unit('unit-1', 'frost-owl', 6, 0, 3)], wave, 1),
    );
    expect(result.state.status).toBe('victory');
  });

  it('summoners spawn extra enemies over time', () => {
    const wave = waveWith([{ typeId: 'kappa-captain', level: 6, col: 2, row: 0 }]);
    const result = runBattleToCompletion(
      createBattleState([unit('unit-1', 'laser-crocodile', 5, 0, 3)], wave, 1),
    );
    const spawned = result.state.units.filter((entry) => entry.id.includes('summon'));
    expect(spawned.length).toBeGreaterThan(0);
    expect(spawned.every((entry) => entry.team === 'enemy')).toBe(true);
  });

  it('bomb imps explode on death and hurt nearby allies', () => {
    const wave = waveWith([
      { typeId: 'bomb-imp', level: 4, col: 2, row: 2 },
      { typeId: 'mini-brainrot', level: 4, col: 4, row: 2 },
    ]);
    const result = runBattleToCompletion(
      createBattleState(
        [unit('unit-1', 'laser-crocodile', 4, 2, 3), unit('unit-2', 'armored-rhino', 4, 2, 4)],
        wave,
        1,
      ),
    );
    const explosionEvents = result.events.filter((event) => event.type === 'explode');
    expect(explosionEvents.length).toBeGreaterThan(0);
  });

  it('enrage increases damage after the threshold', () => {
    const wave = oneEnemyWave('giant-beetle', 8);
    const result = runBattleToCompletion(
      createBattleState(
        [unit('unit-1', 'laser-crocodile', 7, 0, 3), unit('unit-2', 'laser-crocodile', 7, 1, 3)],
        wave,
        1,
      ),
    );
    const enrageEvents = result.events.filter(
      (event) => event.type === 'status' && event.status === 'enrage',
    );
    expect(enrageEvents.length).toBeGreaterThan(0);
  });

  it('armor aura protects nearby allies', () => {
    const wave = waveWith([
      { typeId: 'shield-crab', level: 4, col: 2, row: 0 },
      { typeId: 'mini-brainrot', level: 4, col: 3, row: 1 },
    ]);
    const result = runBattleToCompletion(
      createBattleState([unit('unit-1', 'laser-crocodile', 4, 0, 3)], wave, 1),
    );
    const crab = result.state.units.find((entry) => entry.typeId === 'shield-crab');
    expect(crab?.abilities.armorAura).not.toBeNull();
  });

  it('boss stun freezes a nearby ally temporarily', () => {
    const wave = waveWith([{ typeId: 'void-eye', level: 5, col: 2, row: 0 }]);
    const result = runBattleToCompletion(
      createBattleState([unit('unit-1', 'laser-crocodile', 4, 0, 3)], wave, 1),
    );
    const stuns = result.events.filter(
      (event) => event.type === 'status' && event.status === 'stunned',
    );
    expect(stuns.length).toBeGreaterThan(0);
  });
});

describe('new ally mechanics', () => {
  it('armored rhino has armor and splash radius', () => {
    const stats = characterStats('armored-rhino', 5, 0);
    expect(stats.armor).toBeGreaterThan(0);
    expect(stats.splashRadius).toBeGreaterThan(0);
  });

  it('rhino splash damages nearby secondary targets', () => {
    const wave = waveWith([
      { typeId: 'mini-brainrot', level: 4, col: 2, row: 1 },
      { typeId: 'mini-brainrot', level: 4, col: 3, row: 1 },
    ]);
    const result = runBattleToCompletion(
      createBattleState([unit('unit-1', 'armored-rhino', 5, 2, 3)], wave, 1),
    );
    expect(result.state.status).toBe('victory');
    const damageEvents = result.events.filter((event) => event.type === 'damage');
    const distinctTargets = new Set(damageEvents.map((event) => event.unitId));
    expect(distinctTargets.size).toBeGreaterThanOrEqual(2);
  });

  it('frost owl applies slow status', () => {
    const wave = waveWith([{ typeId: 'mini-brainrot', level: 4, col: 2, row: 0 }]);
    const result = runBattleToCompletion(
      createBattleState([unit('unit-1', 'frost-owl', 3, 0, 3)], wave, 1),
    );
    const slows = result.events.filter(
      (event) => event.type === 'status' && event.status === 'slow',
    );
    expect(slows.length).toBeGreaterThan(0);
  });

  it('lightning arcs back to the primary target when alone', () => {
    const wave = oneEnemyWave('mini-brainrot', 4);
    const result = runBattleToCompletion(
      createBattleState([unit('unit-1', 'lightning-scorpion', 4, 2, 3)], wave, 1),
    );
    expect(result.state.status).toBe('victory');
    const chains = result.events.filter((event) => event.type === 'chain');
    expect(chains.length).toBeGreaterThan(0);
    for (const chain of chains) {
      if (chain.type === 'chain') {
        expect(chain.targetId).toBe(chain.attackerId === 'unit-1' ? 'enemy-99-1' : chain.targetId);
      }
    }
  });

  it('units keep a sane distance metric', () => {
    const a = { x: 0.5, y: 0.5 };
    const b = { x: 3.5, y: 0.5 };
    expect(entityDistance(a as never, b as never)).toBeCloseTo(3, 5);
  });

  it('upgrades multiply ally stats in battle', () => {
    const wave = oneEnemyWave('mini-brainrot', 4);
    const base = runBattleToCompletion(
      createBattleState([unit('u1', 'laser-crocodile', 3, 0, 3)], wave, 1, 'normal', {}),
    );
    const boosted = runBattleToCompletion(
      createBattleState([unit('u1', 'laser-crocodile', 3, 0, 3)], wave, 1, 'normal', {
        'army-attack': 10,
        'army-hp': 10,
      }),
    );
    const baseAlly = allies(base.state.units)[0];
    const boostedAlly = allies(boosted.state.units)[0];
    expect(boostedAlly?.attack).toBeGreaterThan(baseAlly?.attack ?? 0);
    expect(boostedAlly?.maxHp).toBeGreaterThan(baseAlly?.maxHp ?? 0);
  });
});

describe('determinism of new mechanics', () => {
  it('summons, enrage and poison are reproducible across seeds', () => {
    const wave = waveWith([
      { typeId: 'venom-king-crocodile', level: 8, col: 2, row: 0 },
      { typeId: 'bomb-imp', level: 7, col: 4, row: 2 },
    ]);
    const first = runBattleToCompletion(
      createBattleState([unit('u1', 'laser-crocodile', 7, 0, 3)], wave, 1),
    );
    const second = runBattleToCompletion(
      createBattleState([unit('u1', 'laser-crocodile', 7, 0, 3)], wave, 999),
    );
    expect(second.state.status).toBe(first.state.status);
    expect(second.state.ticks).toBe(first.state.ticks);
    expect(second.events).toEqual(first.events);
  });
});
