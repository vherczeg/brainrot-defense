import {
  MAX_CHARACTER_LEVEL,
  MAX_CHARACTER_XP,
  MAX_MERGE_RANK,
  type CharacterInstance,
} from './types';

export { MAX_CHARACTER_LEVEL, MAX_CHARACTER_XP, MAX_MERGE_RANK };

const XP_PER_LEVEL_STEP = 25;
const REPLAY_XP_NUMERATOR = 1;
const REPLAY_XP_DENOMINATOR = 4;

export function normalizeTotalXp(value: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  if (value === Number.POSITIVE_INFINITY) return MAX_CHARACTER_XP;
  if (value === Number.NEGATIVE_INFINITY) return 0;
  return Math.min(MAX_CHARACTER_XP, Math.max(0, Math.floor(value)));
}

export function xpRequiredForLevel(level: number): number {
  if (typeof level !== 'number' || Number.isNaN(level)) return 0;
  const safeLevel = Math.min(MAX_CHARACTER_LEVEL, Math.max(1, Math.floor(level)));
  return XP_PER_LEVEL_STEP * (safeLevel - 1) ** 2;
}

export function characterLevelFromXp(totalXp: number): number {
  const xp = normalizeTotalXp(totalXp);
  let low = 1;
  let high = MAX_CHARACTER_LEVEL;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (xpRequiredForLevel(mid) <= xp) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

export function xpToNextLevel(totalXp: number): number {
  const xp = normalizeTotalXp(totalXp);
  const level = characterLevelFromXp(xp);
  if (level >= MAX_CHARACTER_LEVEL) return 0;
  return xpRequiredForLevel(level + 1) - xp;
}

export function awardXp(totalXp: number, amount: number): number {
  const xp = normalizeTotalXp(totalXp);
  if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
    return xp;
  }
  return normalizeTotalXp(xp + amount);
}

export function mergeCharacterXp(xpA: number, xpB: number): number {
  return Math.min(MAX_CHARACTER_XP, normalizeTotalXp(xpA) + normalizeTotalXp(xpB));
}

export function baseWaveXp(waveId: number): number {
  if (!Number.isFinite(waveId) || waveId < 1) return 0;
  return 60 + 15 * Math.floor(waveId);
}

export function battleXpPerUnit(waveId: number, firstCompletion: boolean): number {
  const base = baseWaveXp(waveId);
  if (firstCompletion) return base;
  return Math.floor((base * REPLAY_XP_NUMERATOR) / REPLAY_XP_DENOMINATOR);
}

export function xpProgress(totalXp: number): {
  readonly level: number;
  readonly currentLevelXp: number;
  readonly nextLevelXp: number | null;
  readonly remaining: number;
} {
  const xp = normalizeTotalXp(totalXp);
  const level = characterLevelFromXp(xp);
  if (level >= MAX_CHARACTER_LEVEL) {
    return {
      level,
      currentLevelXp: xpRequiredForLevel(level),
      nextLevelXp: null,
      remaining: 0,
    };
  }
  return {
    level,
    currentLevelXp: xpRequiredForLevel(level),
    nextLevelXp: xpRequiredForLevel(level + 1),
    remaining: xpToNextLevel(xp),
  };
}

export function isParticipatingCharacter(
  character: CharacterInstance,
  roster: readonly string[],
): boolean {
  return roster.includes(character.id);
}
