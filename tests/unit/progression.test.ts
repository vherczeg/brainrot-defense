import { describe, expect, it } from 'vitest';
import {
  CHARACTER_DEFINITIONS,
  characterStats,
  canMergeRanks,
} from '../../src/game/domain/characters';
import {
  MAX_CHARACTER_LEVEL,
  MAX_CHARACTER_XP,
  MAX_MERGE_RANK,
  awardXp,
  baseWaveXp,
  battleXpPerUnit,
  characterLevelFromXp,
  mergeCharacterXp,
  normalizeTotalXp,
  xpRequiredForLevel,
  xpToNextLevel,
} from '../../src/game/domain/progression';

describe('XP progression thresholds', () => {
  it('uses the documented quadratic curve and hits every boundary exactly', () => {
    expect(xpRequiredForLevel(1)).toBe(0);
    expect(xpRequiredForLevel(2)).toBe(25);
    expect(xpRequiredForLevel(10)).toBe(2025);
    expect(xpRequiredForLevel(50)).toBe(60025);
    expect(xpRequiredForLevel(100)).toBe(245025);

    for (let level = 1; level <= MAX_CHARACTER_LEVEL; level += 1) {
      const threshold = 25 * (level - 1) ** 2;
      expect(xpRequiredForLevel(level)).toBe(threshold);
      expect(characterLevelFromXp(threshold)).toBe(level);
      if (level > 1) {
        expect(characterLevelFromXp(threshold - 1)).toBe(level - 1);
      }
    }
  });

  it('derives the level from XP without storing a redundant level field', () => {
    expect(characterLevelFromXp(0)).toBe(1);
    expect(characterLevelFromXp(24)).toBe(1);
    expect(characterLevelFromXp(25)).toBe(2);
    expect(characterLevelFromXp(3025)).toBe(12);
    expect(characterLevelFromXp(4250)).toBe(14);
  });

  it('handles invalid, negative, decimal and above-maximum XP safely', () => {
    expect(normalizeTotalXp(-1)).toBe(0);
    expect(normalizeTotalXp(Number.NaN)).toBe(0);
    expect(normalizeTotalXp(Number.POSITIVE_INFINITY)).toBe(MAX_CHARACTER_XP);
    expect(normalizeTotalXp(12.9)).toBe(12);
    expect(normalizeTotalXp(MAX_CHARACTER_XP + 1)).toBe(MAX_CHARACTER_XP);
    expect(characterLevelFromXp(-500)).toBe(1);
    expect(characterLevelFromXp(Number.NaN)).toBe(1);
    expect(characterLevelFromXp(MAX_CHARACTER_XP + 999)).toBe(MAX_CHARACTER_LEVEL);
  });

  it('reports XP remaining to the next level and zero at the cap', () => {
    expect(xpToNextLevel(0)).toBe(25);
    expect(xpToNextLevel(24)).toBe(1);
    expect(xpToNextLevel(25)).toBe(75);
    expect(xpToNextLevel(245024)).toBe(1);
    expect(xpToNextLevel(MAX_CHARACTER_XP)).toBe(0);
  });

  it('awards nonnegative XP and caps at level 100', () => {
    expect(awardXp(0, 75)).toBe(75);
    expect(awardXp(24, 1)).toBe(25);
    expect(awardXp(0, -50)).toBe(0);
    expect(awardXp(100, Number.NaN)).toBe(100);
    expect(awardXp(MAX_CHARACTER_XP - 10, 999)).toBe(MAX_CHARACTER_XP);
  });

  it('combines merge XP exactly and discards overflow above the cap', () => {
    expect(mergeCharacterXp(3025, 1225)).toBe(4250);
    expect(mergeCharacterXp(-10, 25)).toBe(25);
    expect(mergeCharacterXp(Number.NaN, 25)).toBe(25);
    expect(mergeCharacterXp(MAX_CHARACTER_XP - 1, 10)).toBe(MAX_CHARACTER_XP);
    expect(mergeCharacterXp(MAX_CHARACTER_XP, MAX_CHARACTER_XP)).toBe(MAX_CHARACTER_XP);
  });

  it('calculates wave XP rewards and replay reduction', () => {
    expect(baseWaveXp(1)).toBe(75);
    expect(baseWaveXp(5)).toBe(135);
    expect(baseWaveXp(10)).toBe(210);
    expect(battleXpPerUnit(1, true)).toBe(75);
    expect(battleXpPerUnit(1, false)).toBe(Math.floor(75 * 0.25));
    expect(battleXpPerUnit(10, false)).toBe(52);
    expect(battleXpPerUnit(0, true)).toBe(0);
  });
});

describe('character stats', () => {
  it('uses rank and XP-derived level exactly once in both stats', () => {
    const def = CHARACTER_DEFINITIONS['laser-crocodile'];
    const level1 = characterStats('laser-crocodile', 1, 0);
    expect(level1.attack).toBe(def.baseAttack);
    expect(level1.maxHp).toBe(def.baseHp);

    const rank4Level14 = characterStats('laser-crocodile', 4, 4250);
    const level = characterLevelFromXp(4250);
    expect(level).toBe(14);
    expect(rank4Level14.attack).toBe(
      Math.round(def.baseAttack * 1.45 ** (4 - 1) * (1 + 0.035 * (level - 1))),
    );
    expect(rank4Level14.maxHp).toBe(
      Math.round(def.baseHp * 1.5 ** (4 - 1) * (1 + 0.04 * (level - 1))),
    );
  });

  it('matches the documented maximum boundaries', () => {
    const def = CHARACTER_DEFINITIONS['laser-crocodile'];
    const max = characterStats('laser-crocodile', MAX_MERGE_RANK, MAX_CHARACTER_XP);
    expect(max.attack).toBe(Math.round(def.baseAttack * 1.45 ** 9 * (1 + 0.035 * 99)));
    expect(max.maxHp).toBe(Math.round(def.baseHp * 1.5 ** 9 * (1 + 0.04 * 99)));
  });

  it('is monotonic and clamps invalid rank/XP values safely', () => {
    for (let rank = 1; rank <= MAX_MERGE_RANK; rank += 1) {
      let previousAttack = 0;
      let previousHp = 0;
      for (let xp = 0; xp <= MAX_CHARACTER_XP; xp += 500) {
        const stats = characterStats('lightning-scorpion', rank, xp);
        expect(stats.attack).toBeGreaterThanOrEqual(previousAttack);
        expect(stats.maxHp).toBeGreaterThanOrEqual(previousHp);
        expect(Number.isSafeInteger(stats.attack)).toBe(true);
        expect(Number.isSafeInteger(stats.maxHp)).toBe(true);
        previousAttack = stats.attack;
        previousHp = stats.maxHp;
      }
    }
    let previousRankAttack = 0;
    let previousRankHp = 0;
    for (let rank = 1; rank <= MAX_MERGE_RANK; rank += 1) {
      const stats = characterStats('lightning-scorpion', rank, 0);
      expect(stats.attack).toBeGreaterThanOrEqual(previousRankAttack);
      expect(stats.maxHp).toBeGreaterThanOrEqual(previousRankHp);
      previousRankAttack = stats.attack;
      previousRankHp = stats.maxHp;
    }
    expect(characterStats('laser-crocodile', 0, -5)).toEqual(
      characterStats('laser-crocodile', 1, 0),
    );
    expect(characterStats('laser-crocodile', 99, 999999)).toEqual(
      characterStats('laser-crocodile', MAX_MERGE_RANK, MAX_CHARACTER_XP),
    );
    const nanStats = characterStats('laser-crocodile', Number.NaN, Number.NaN);
    expect(Number.isFinite(nanStats.attack)).toBe(true);
    expect(Number.isFinite(nanStats.maxHp)).toBe(true);
  });

  it('only allows equal ranks below rank 10 to merge', () => {
    expect(canMergeRanks(1, 1)).toBe(true);
    expect(canMergeRanks(3, 3)).toBe(true);
    expect(canMergeRanks(1, 2)).toBe(false);
    expect(canMergeRanks(MAX_MERGE_RANK, MAX_MERGE_RANK)).toBe(false);
  });
});
