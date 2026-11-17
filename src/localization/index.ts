import { hu, type TranslationKey } from './hu';
import type { Difficulty } from '../game/domain/types';

export type { TranslationKey };
export { hu };

export type TranslationVars = Readonly<Record<string, string | number>>;

export function t(key: TranslationKey, vars: TranslationVars = {}): string {
  const template = hu[key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

export function difficultyLabel(difficulty: Difficulty): string {
  return t(
    difficulty === 'easy'
      ? 'difficultyEasy'
      : difficulty === 'hard'
        ? 'difficultyHard'
        : difficulty === 'extreme'
          ? 'difficultyExtreme'
          : 'difficultyNormal',
  );
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 }).format(value);
}

export function formatSeconds(value: number): string {
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}
