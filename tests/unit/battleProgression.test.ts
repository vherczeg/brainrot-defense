import { describe, expect, it } from 'vitest';
import {
  claimWaveReward,
  mergeCharacters,
  resolveBattleRewards,
} from '../../src/game/commands/profileCommands';
import { MAX_CHARACTER_XP, characterLevelFromXp } from '../../src/game/domain/progression';
import { NOW, profileWith, unit } from './testFixtures';

function profileWithRoster(overrides = {}) {
  return profileWith(
    [
      unit('unit-1', 'laser-crocodile', 3, 0, 3, 3025),
      unit('unit-2', 'laser-crocodile', 3, 1, 3, 1225),
      unit('unit-3', 'lightning-scorpion', 1, 2, 3, 500),
    ],
    { coins: 0, ...overrides },
  );
}

describe('battle XP distribution', () => {
  it('grants the full first-clear reward to every battle-start participant', () => {
    const profile = profileWithRoster();
    const result = resolveBattleRewards(profile, 1, ['unit-1', 'unit-2', 'unit-3'], NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.firstCompletion).toBe(true);
    expect(result.value.xpPerUnit).toBe(75);
    expect(result.value.totalXpAwarded).toBe(225);
    expect(result.value.profile.characters.map((character) => character.totalXp)).toEqual([
      3100, 1300, 575,
    ]);
    expect(result.value.levelUps).toHaveLength(0);
  });

  it('grants XP to participants even if their battle copy died', () => {
    const profile = profileWithRoster();
    const result = resolveBattleRewards(profile, 1, ['unit-1'], NOW);
    if (!result.ok) throw new Error('expected success');
    expect(result.value.profile.characters.find((c) => c.id === 'unit-1')?.totalXp).toBe(3100);
  });

  it('does not grant XP to characters outside the captured roster', () => {
    const profile = profileWithRoster();
    const result = resolveBattleRewards(profile, 1, ['unit-1'], NOW);
    if (!result.ok) throw new Error('expected success');
    expect(result.value.profile.characters.find((c) => c.id === 'unit-2')?.totalXp).toBe(1225);
    expect(result.value.profile.characters.find((c) => c.id === 'unit-3')?.totalXp).toBe(500);
  });

  it('uses reduced XP for a replay of an already completed wave', () => {
    const profile = profileWithRoster({ completedWaves: [1], currentWave: 2, unlockedWave: 2 });
    const result = resolveBattleRewards(profile, 1, ['unit-1', 'unit-2'], NOW);
    if (!result.ok) throw new Error('expected success');
    expect(result.value.firstCompletion).toBe(false);
    expect(result.value.xpPerUnit).toBe(18);
    expect(result.value.rewardCoins).toBe(0);
    expect(result.value.profile.characters.find((c) => c.id === 'unit-1')?.totalXp).toBe(3043);
    expect(result.value.profile.coins).toBe(0);
  });

  it('reports level-ups and never awards XP twice for the same resolution', () => {
    const profile = profileWith(
      [
        unit('unit-1', 'laser-crocodile', 1, 0, 3, 24),
        unit('unit-2', 'laser-crocodile', 1, 1, 3, 24),
      ],
      { coins: 0 },
    );
    const result = resolveBattleRewards(profile, 1, ['unit-1', 'unit-2'], NOW);
    if (!result.ok) throw new Error('expected success');
    expect(result.value.levelUps).toHaveLength(2);
    expect(result.value.levelUps[0]).toMatchObject({
      characterId: 'unit-1',
      fromLevel: 1,
      toLevel: 2,
    });
    const afterFirst = result.value.profile;
    expect(characterLevelFromXp(afterFirst.characters[0]?.totalXp ?? 0)).toBe(2);
  });

  it('caps participant XP at level 100', () => {
    const profile = profileWith(
      [
        unit('unit-1', 'laser-crocodile', 10, 0, 3, MAX_CHARACTER_XP - 5),
        unit('unit-2', 'laser-crocodile', 10, 1, 3, MAX_CHARACTER_XP),
      ],
      {
        coins: 0,
        completedWaves: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        currentWave: 10,
        unlockedWave: 10,
      },
    );
    const result = resolveBattleRewards(profile, 10, ['unit-1', 'unit-2'], NOW);
    if (!result.ok) throw new Error('expected success');
    expect(result.value.profile.characters.map((c) => c.totalXp)).toEqual([
      MAX_CHARACTER_XP,
      MAX_CHARACTER_XP,
    ]);
    expect(result.value.levelUps).toHaveLength(1);
  });

  it('does not mutate the input profile', () => {
    const profile = profileWithRoster();
    const before = structuredClone(profile);
    resolveBattleRewards(profile, 1, ['unit-1', 'unit-2', 'unit-3'], NOW);
    expect(profile).toEqual(before);
  });

  it('still awards XP when the coin reward would overflow the coin cap', () => {
    const profile = profileWithRoster({ coins: 1_000_000_000 });
    const result = resolveBattleRewards(profile, 1, ['unit-1'], NOW);
    if (!result.ok) throw new Error('expected success');
    expect(result.value.coinOverflow).toBe(true);
    expect(result.value.rewardCoins).toBe(0);
    expect(result.value.profile.coins).toBe(1_000_000_000);
    expect(result.value.profile.completedWaves).toEqual([1]);
    expect(result.value.profile.currentWave).toBe(2);
    expect(result.value.profile.characters.find((c) => c.id === 'unit-1')?.totalXp).toBe(3100);
  });

  it('keeps the coin claim one-time even while replay XP is reduced', () => {
    const profile = profileWithRoster();
    const first = resolveBattleRewards(profile, 1, ['unit-1'], NOW);
    if (!first.ok) throw new Error('expected success');
    const second = resolveBattleRewards(first.value.profile, 1, ['unit-1'], NOW + 1);
    if (!second.ok) throw new Error('expected success');
    expect(first.value.rewardCoins).toBe(120);
    expect(second.value.rewardCoins).toBe(0);
    expect(second.value.xpPerUnit).toBe(18);
  });
});

describe('merge combines XP, not levels', () => {
  it('combines XP and recalculates the resulting character level', () => {
    const profile = profileWith(
      [
        unit('unit-1', 'laser-crocodile', 3, 0, 3, 3025),
        unit('unit-2', 'laser-crocodile', 3, 1, 3, 1225),
      ],
      { nextCharacterId: 10 },
    );
    const result = mergeCharacters(profile, 'unit-1', 'unit-2', NOW);
    if (!result.ok) throw new Error('expected merge');
    expect(result.value.merged).toMatchObject({
      typeId: 'laser-crocodile',
      mergeRank: 4,
      totalXp: 4250,
      col: 1,
      row: 3,
    });
    expect(characterLevelFromXp(result.value.merged.totalXp)).toBe(14);
  });

  it('caps combined XP without creating XP', () => {
    const profile = profileWith(
      [
        unit('unit-1', 'laser-crocodile', 5, 0, 3, MAX_CHARACTER_XP - 100),
        unit('unit-2', 'laser-crocodile', 5, 1, 3, 500),
      ],
      { nextCharacterId: 10 },
    );
    const result = mergeCharacters(profile, 'unit-1', 'unit-2', NOW);
    if (!result.ok) throw new Error('expected merge');
    expect(result.value.merged.totalXp).toBe(MAX_CHARACTER_XP);
  });

  it('keeps the existing coin-only claim behavior independent from XP', () => {
    const profile = profileWith([]);
    const claimed = claimWaveReward(profile, 1, NOW);
    expect(claimed.ok).toBe(true);
    expect(claimed.ok && claimed.value.profile.characters).toEqual([]);
  });
});
