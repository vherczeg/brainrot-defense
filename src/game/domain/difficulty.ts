import { enemyStats } from './enemies';
import type { Difficulty, EnemyTypeId } from './types';

export interface DifficultyConfig {
  readonly enemyHpMultiplier: number;
  readonly enemyAttackMultiplier: number;
}

export const DIFFICULTY_CONFIG: Readonly<Record<Difficulty, DifficultyConfig>> = {
  easy: { enemyHpMultiplier: 0.8, enemyAttackMultiplier: 0.8 },
  normal: { enemyHpMultiplier: 1, enemyAttackMultiplier: 1 },
  hard: { enemyHpMultiplier: 1.4, enemyAttackMultiplier: 1.2 },
  extreme: { enemyHpMultiplier: 1.7, enemyAttackMultiplier: 1.35 },
};

export const DIFFICULTY_IDS: readonly Difficulty[] = ['easy', 'normal', 'hard', 'extreme'];

export const DEFEAT_COMFORT_COINS: Readonly<Record<Difficulty, number>> = {
  easy: 70,
  normal: 50,
  hard: 30,
  extreme: 20,
};

export function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'normal' || value === 'hard' || value === 'extreme';
}

export function difficultyConfig(difficulty: Difficulty): DifficultyConfig {
  return DIFFICULTY_CONFIG[difficulty];
}

export function defeatComfortCoins(difficulty: Difficulty): number {
  return DEFEAT_COMFORT_COINS[difficulty];
}

export function enemyStatsForDifficulty(
  typeId: EnemyTypeId,
  level: number,
  difficulty: Difficulty = 'normal',
) {
  const stats = enemyStats(typeId, level);
  const config = difficultyConfig(difficulty);
  return {
    ...stats,
    maxHp: Math.max(1, Math.round(stats.maxHp * config.enemyHpMultiplier)),
    attack: Math.max(1, Math.round(stats.attack * config.enemyAttackMultiplier)),
  };
}
