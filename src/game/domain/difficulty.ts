import { enemyStats } from './enemies';
import type { Difficulty, EnemyTypeId } from './types';

export interface DifficultyConfig {
  readonly enemyHpMultiplier: number;
  readonly enemyAttackMultiplier: number;
}

export const DIFFICULTY_CONFIG: Readonly<Record<Difficulty, DifficultyConfig>> = {
  normal: { enemyHpMultiplier: 1, enemyAttackMultiplier: 1 },
  hard: { enemyHpMultiplier: 1.4, enemyAttackMultiplier: 1.2 },
};

export function difficultyConfig(difficulty: Difficulty): DifficultyConfig {
  return DIFFICULTY_CONFIG[difficulty];
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
