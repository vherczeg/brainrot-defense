import { describe, expect, it } from 'vitest';
import { resolveDefeatRewards } from '../../src/game/commands/profileCommands';
import { characterLevelFromXp, defeatXpPerUnit } from '../../src/game/domain/progression';
import { MAX_DEFEAT_XP_REWARDS } from '../../src/game/domain/types';
import { profileWith, unit } from './testFixtures';

function waveTenProfile(overrides = {}) {
  return profileWith(
    [
      unit('unit-1', 'laser-crocodile', 1, 0, 3, 0),
      unit('unit-2', 'lightning-scorpion', 1, 1, 3, 0),
      unit('unit-3', 'laser-crocodile', 1, 2, 3, 0),
    ],
    {
      coins: 0,
      completedWaves: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      currentWave: 10,
      unlockedWave: 10,
      ...overrides,
    },
  );
}

describe('defeat gold and XP rewards', () => {
  it('grants 50 gold and 20% XP to every participant on the first defeat', () => {
    const profile = waveTenProfile();
    const result = resolveDefeatRewards(profile, 10, ['unit-1', 'unit-2'], 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.comfortCoins).toBe(50);
    expect(result.value.xpPerUnit).toBe(42);
    expect(result.value.totalXpAwarded).toBe(84);
    expect(result.value.defeatXpCountBefore).toBe(0);
    expect(result.value.defeatXpCountAfter).toBe(1);
    expect(result.value.defeatXpEligible).toBe(true);
    expect(result.value.profile.coins).toBe(50);
    expect(result.value.profile.characters.map((c) => c.totalXp)).toEqual([42, 42, 0]);
    expect(result.value.profile.defeatXpCounts[9]).toBe(1);
  });

  it('grants all three eligible defeat XP rewards, then coins only', () => {
    let profile = waveTenProfile();
    const perParticipant: number[] = [];
    const coins: number[] = [];
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const result = resolveDefeatRewards(profile, 10, ['unit-1', 'unit-2'], attempt);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      profile = result.value.profile;
      perParticipant.push(result.value.xpPerUnit);
      coins.push(result.value.comfortCoins);
      expect(result.value.defeatXpCountAfter).toBe(Math.min(attempt, MAX_DEFEAT_XP_REWARDS));
    }

    expect(perParticipant).toEqual([42, 42, 42, 0]);
    expect(coins).toEqual([50, 50, 50, 50]);
    expect(profile.coins).toBe(200);
    expect(profile.characters.map((c) => c.totalXp)).toEqual([126, 126, 0]);
    expect(profile.defeatXpCounts[9]).toBe(MAX_DEFEAT_XP_REWARDS);
  });

  it('rounds defeat XP down and distinguishes first-clear from replay XP', () => {
    expect(defeatXpPerUnit(1, true)).toBe(15);
    expect(defeatXpPerUnit(2, true)).toBe(18);
    expect(defeatXpPerUnit(9, true)).toBe(39);
    expect(defeatXpPerUnit(10, true)).toBe(42);
    expect(defeatXpPerUnit(20, true)).toBe(72);
    expect(defeatXpPerUnit(1, false)).toBe(3);
    expect(defeatXpPerUnit(10, false)).toBe(10);

    const replay = waveTenProfile({
      currentWave: 10,
      completedWaves: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    });
    const result = resolveDefeatRewards(replay, 10, ['unit-1'], 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.xpPerUnit).toBe(10);
  });

  it('does not award XP to reserve characters and can trigger level-ups', () => {
    const profile = profileWith(
      [
        unit('unit-1', 'laser-crocodile', 1, 0, 3, 24),
        unit('unit-2', 'lightning-scorpion', 1, 1, 3, 0),
      ],
      {
        coins: 0,
        completedWaves: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        currentWave: 10,
        unlockedWave: 10,
      },
    );
    const result = resolveDefeatRewards(profile, 10, ['unit-1'], 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.profile.characters.map((c) => c.totalXp)).toEqual([66, 0]);
    expect(characterLevelFromXp(result.value.profile.characters[0]?.totalXp ?? 0)).toBe(2);
    expect(result.value.levelUps).toHaveLength(1);
    expect(result.value.levelUps[0]).toMatchObject({
      characterId: 'unit-1',
      fromLevel: 1,
      toLevel: 2,
    });
  });

  it('uses one shared counter for Normal and Hard and independent counters per wave', () => {
    const normal = waveTenProfile({
      settings: { soundEnabled: true, reducedMotion: false, battleSpeed: 1, difficulty: 'normal' },
    });
    const hard = waveTenProfile({
      settings: { soundEnabled: true, reducedMotion: false, battleSpeed: 1, difficulty: 'hard' },
    });
    const normalResult = resolveDefeatRewards(normal, 10, ['unit-1'], 2);
    const hardResult = resolveDefeatRewards(hard, 10, ['unit-1'], 2);
    expect(normalResult.ok && hardResult.ok).toBe(true);
    if (!normalResult.ok || !hardResult.ok) return;
    expect(normalResult.value.defeatXpCountAfter).toBe(1);
    expect(hardResult.value.defeatXpCountAfter).toBe(1);
    expect(normalResult.value.xpPerUnit).toBe(hardResult.value.xpPerUnit);

    const differentWave = resolveDefeatRewards(normal, 9, ['unit-1'], 2);
    expect(differentWave.ok).toBe(true);
    if (!differentWave.ok) return;
    expect(differentWave.value.profile.defeatXpCounts[9]).toBe(0);
    expect(differentWave.value.profile.defeatXpCounts[8]).toBe(1);
  });

  it('rejects rewards at the coin cap without incrementing the counter', () => {
    const profile = waveTenProfile({ coins: 1_000_000_000 });
    const result = resolveDefeatRewards(profile, 10, ['unit-1'], 2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('coin-overflow');
    expect(profile.defeatXpCounts[9]).toBe(0);
    expect(profile.coins).toBe(1_000_000_000);
  });
});
