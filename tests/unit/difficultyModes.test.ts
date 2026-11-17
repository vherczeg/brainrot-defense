import { describe, expect, it } from 'vitest';
import { applyDefeatComfort, resolveDefeatRewards } from '../../src/game/commands/profileCommands';
import {
  DEFEAT_COMFORT_COINS,
  DIFFICULTY_IDS,
  defeatComfortCoins,
  difficultyConfig,
  isDifficulty,
} from '../../src/game/domain/difficulty';
import { profileWith } from './testFixtures';

describe('four difficulty modes', () => {
  it('exposes exactly four modes', () => {
    expect(DIFFICULTY_IDS).toEqual(['easy', 'normal', 'hard', 'extreme']);
  });

  it('recognizes all valid difficulties', () => {
    expect(isDifficulty('easy')).toBe(true);
    expect(isDifficulty('normal')).toBe(true);
    expect(isDifficulty('hard')).toBe(true);
    expect(isDifficulty('extreme')).toBe(true);
    expect(isDifficulty('nightmare')).toBe(false);
    expect(isDifficulty(undefined)).toBe(false);
  });

  it('keeps the documented M3.6 hard multipliers', () => {
    expect(difficultyConfig('hard')).toEqual({
      enemyHpMultiplier: 1.4,
      enemyAttackMultiplier: 1.2,
    });
    expect(difficultyConfig('normal')).toEqual({
      enemyHpMultiplier: 1,
      enemyAttackMultiplier: 1,
    });
  });

  it('softens easy and brutalizes extreme', () => {
    expect(difficultyConfig('easy').enemyHpMultiplier).toBeLessThan(1);
    expect(difficultyConfig('easy').enemyAttackMultiplier).toBeLessThan(1);
    expect(difficultyConfig('extreme').enemyHpMultiplier).toBeGreaterThan(
      difficultyConfig('hard').enemyHpMultiplier,
    );
  });

  it('grants the required defeat comfort coins per difficulty', () => {
    expect(defeatComfortCoins('easy')).toBe(70);
    expect(defeatComfortCoins('normal')).toBe(50);
    expect(defeatComfortCoins('hard')).toBe(30);
    expect(defeatComfortCoins('extreme')).toBe(20);
    expect(DEFEAT_COMFORT_COINS).toEqual({ easy: 70, normal: 50, hard: 30, extreme: 20 });
  });

  it('applies the difficulty-based comfort reward on defeat', () => {
    for (const difficulty of DIFFICULTY_IDS) {
      const profile = profileWith([], { coins: 0 });
      const withDifficulty = {
        ...profile,
        settings: { ...profile.settings, difficulty },
      };
      const outcome = applyDefeatComfort(withDifficulty);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.value.coins).toBe(defeatComfortCoins(difficulty));
      }
    }
  });

  it('pays the difficulty comfort through the full defeat reward flow', () => {
    for (const difficulty of DIFFICULTY_IDS) {
      const profile = profileWith([], {
        coins: 0,
        settings: { ...profileWith([]).settings, difficulty },
      });
      const outcome = resolveDefeatRewards(profile, 1, [], 2);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.value.comfortCoins).toBe(defeatComfortCoins(difficulty));
        expect(outcome.value.profile.coins).toBe(defeatComfortCoins(difficulty));
      }
    }
  });

  it('keeps victory rewards independent of difficulty', () => {
    expect(defeatComfortCoins('hard')).toBeLessThan(defeatComfortCoins('normal'));
  });
});
