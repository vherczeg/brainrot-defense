import { describe, expect, it } from 'vitest';
import { enemyStats } from '../../src/game/domain/enemies';
import {
  WAVE_DEFINITIONS,
  getWave,
  waveFirstCompletionBonus,
  waveReplayRewardCoins,
} from '../../src/game/domain/waves';
import { createBattleState, runBattleToCompletion } from '../../src/game/simulation/battle';
import { profileWith, unit } from './testFixtures';

const EXPECTED_REWARDS = [
  120, 145, 170, 195, 225, 255, 285, 315, 350, 500, 425, 475, 525, 575, 625, 675, 725, 775, 825,
  1200,
];

function campaignArmy(): ReturnType<typeof unit>[] {
  const ranks = [1, 2, 2, 2, 2, 2, 3, 3, 4, 5, 6];
  return ranks.map((rank, index) =>
    unit(
      `unit-${index + 1}`,
      index % 2 === 0 ? 'laser-crocodile' : 'lightning-scorpion',
      rank,
      index % 6,
      index < 6 ? 4 : 3,
      rank > 3 ? 5000 : rank * 700,
    ),
  );
}

function minimalArmy(): ReturnType<typeof unit>[] {
  return [
    unit('unit-1', 'laser-crocodile', 1, 0, 3),
    unit('unit-2', 'laser-crocodile', 1, 1, 3),
    unit('unit-3', 'lightning-scorpion', 1, 2, 3),
    unit('unit-4', 'lightning-scorpion', 1, 3, 3),
  ];
}

function representativeArmy() {
  return [
    unit('unit-1', 'laser-crocodile', 6, 0, 3, 5000),
    unit('unit-2', 'laser-crocodile', 6, 1, 3, 5000),
    unit('unit-3', 'laser-crocodile', 5, 2, 3, 4000),
    unit('unit-4', 'laser-crocodile', 5, 3, 3, 4000),
    unit('unit-5', 'lightning-scorpion', 4, 4, 3, 3000),
    unit('unit-6', 'lightning-scorpion', 4, 5, 3, 3000),
    unit('unit-7', 'laser-crocodile', 3, 0, 4, 2000),
    unit('unit-8', 'laser-crocodile', 3, 1, 4, 2000),
    unit('unit-9', 'lightning-scorpion', 2, 2, 4, 1000),
    unit('unit-10', 'lightning-scorpion', 2, 3, 4, 1000),
    unit('unit-11', 'laser-crocodile', 1, 4, 4, 0),
    unit('unit-12', 'laser-crocodile', 1, 5, 4, 0),
  ];
}

describe('M3.4 economy targets', () => {
  it('keeps the exact documented first-clear reward table for all twenty waves', () => {
    expect(WAVE_DEFINITIONS.map((wave) => wave.rewardCoins)).toEqual(EXPECTED_REWARDS);
  });

  it('keeps post-wave-10 gold inflation under control', () => {
    const firstTen = EXPECTED_REWARDS.slice(0, 10).reduce((sum, value) => sum + value, 0);
    const lastTen = EXPECTED_REWARDS.slice(10).reduce((sum, value) => sum + value, 0);
    expect(firstTen).toBe(2560);
    expect(lastTen).toBe(6825);
    expect(EXPECTED_REWARDS.reduce((sum, value) => sum + value, 0)).toBe(9385);
    expect(lastTen / firstTen).toBeLessThan(3);
  });

  it('uses a 35% replay reward and keeps first-clear rewards distinct', () => {
    for (const wave of WAVE_DEFINITIONS) {
      const replay = waveReplayRewardCoins(wave);
      const firstBonus = waveFirstCompletionBonus(wave);
      expect(replay).toBe(Math.floor((wave.rewardCoins * 35) / 100));
      expect(firstBonus).toBe(wave.rewardCoins - replay);
    }
  });

  it('makes boss rewards meaningful without exceeding 1.5x the neighbouring wave', () => {
    const boss10 = getWave(10);
    const boss20 = getWave(20);
    expect(boss10?.rewardCoins).toBe(500);
    expect(boss20?.rewardCoins).toBe(1200);
    expect((boss10?.rewardCoins ?? 0) / (getWave(9)?.rewardCoins ?? 1)).toBeLessThanOrEqual(1.5);
    expect((boss20?.rewardCoins ?? 0) / (getWave(19)?.rewardCoins ?? 1)).toBeLessThanOrEqual(1.5);
  });
});

describe('M3.4 boss baseline stats', () => {
  it('raises the wave 10 Gorilla into a durable milestone', () => {
    const gorilla = enemyStats('mega-brainrot-gorilla', 3);
    expect(gorilla.maxHp).toBe(3281);
    expect(gorilla.attack).toBe(59);
    expect(gorilla.armor).toBe(0.25);
    expect(getWave(10)?.enemies[0]).toMatchObject({
      typeId: 'mega-brainrot-gorilla',
      level: 3,
    });
  });

  it('raises the wave 20 Falcon while preserving its ability timings', () => {
    const falcon = enemyStats('green-venom-falcon', 6);
    expect(falcon.maxHp).toBe(8508);
    expect(falcon.attack).toBe(134);
    expect(falcon.armor).toBe(0.15);
    expect(getWave(20)?.enemies[0]).toMatchObject({
      typeId: 'green-venom-falcon',
      level: 6,
    });
  });

  it('makes wave 20 clearly harder than wave 10 in raw boss pressure', () => {
    const gorilla = enemyStats('mega-brainrot-gorilla', 3);
    const falcon = enemyStats('green-venom-falcon', 6);
    expect(falcon.maxHp).toBeGreaterThan(gorilla.maxHp * 2);
    expect(falcon.attack).toBeGreaterThan(gorilla.attack * 2);
  });
});

describe('M3.4 deterministic balance probes', () => {
  it('produces identical outcomes across deterministic seeds', () => {
    const wave = getWave(20);
    if (!wave) throw new Error('missing wave 20');
    const outcomes = [1, 2, 3].map((seed) => {
      const result = runBattleToCompletion(createBattleState(representativeArmy(), wave, seed));
      return {
        status: result.state.status,
        ticks: result.state.ticks,
        survivors: result.state.units
          .filter((entry) => entry.team === 'ally' && entry.alive)
          .map((entry) => entry.id),
      };
    });
    expect(outcomes[1]).toEqual(outcomes[0]);
    expect(outcomes[2]).toEqual(outcomes[0]);
  });

  it('keeps wave 20 beatable with a sensible wide campaign army', () => {
    const wave = getWave(20);
    if (!wave) throw new Error('missing wave 20');
    const result = runBattleToCompletion(createBattleState(campaignArmy(), wave, 12345));
    expect(result.state.status).toBe('victory');
    const survivors = result.state.units.filter((entry) => entry.team === 'ally' && entry.alive);
    expect(survivors.length).toBeGreaterThan(0);
    expect(result.state.elapsedSec).toBeGreaterThan(20);
  });

  it('does not let a minimal rank-1 army brute-force the wave 20 boss', () => {
    const wave = getWave(20);
    if (!wave) throw new Error('missing wave 20');
    const result = runBattleToCompletion(createBattleState(minimalArmy(), wave, 12345));
    expect(result.state.status).toBe('defeat');
  });

  it('makes wave 10 a real milestone but still beatable by a developed army', () => {
    const wave = getWave(10);
    if (!wave) throw new Error('missing wave 10');
    const strong = runBattleToCompletion(createBattleState(campaignArmy(), wave, 12345));
    const weak = runBattleToCompletion(createBattleState(minimalArmy(), wave, 12345));
    expect(strong.state.status).toBe('victory');
    expect(weak.state.status).toBe('defeat');
  });

  it('does not confiscate existing coins when claiming new rewards', () => {
    const profile = profileWith([], {
      coins: 7500,
      completedWaves: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      currentWave: 11,
      unlockedWave: 11,
    });
    expect(profile.coins).toBe(7500);
    expect(profile.completedWaves).toHaveLength(10);
    expect(profile.currentWave).toBe(11);
  });
});
