import {
  MAX_CHARACTER_XP,
  MAX_MERGE_RANK,
  MAX_SAFE_STAT,
  type CharacterDefinition,
  type CharacterStats,
  type CharacterTypeId,
} from './types';
import { characterLevelFromXp, normalizeTotalXp } from './progression';

export const CHARACTER_DEFINITIONS: Readonly<Record<CharacterTypeId, CharacterDefinition>> = {
  'laser-crocodile': {
    id: 'laser-crocodile',
    nameHu: 'Lézer Krokodil',
    shortNameHu: 'Krokodil',
    roleHu: 'Távolsági sebző',
    descriptionHu: 'Zöld energia-krokodil, aki lézernyalábokat lő a betolakodókra.',
    specialHu: 'Lézer lövedék: messziről, pontosan talál.',
    cost: 100,
    baseHp: 100,
    baseAttack: 12,
    attackIntervalSec: 1,
    range: 3,
    moveSpeed: 0.8,
    attackKind: 'laser',
    chainCount: 0,
    chainFactor: 0,
    chainRange: 0,
    colors: { primary: 0x39e58c, secondary: 0x0f9f6e, accent: 0xa8ff4d },
  },
  'lightning-scorpion': {
    id: 'lightning-scorpion',
    nameHu: 'Villám Skorpió',
    shortNameHu: 'Skorpió',
    roleHu: 'Területsebző',
    descriptionHu: 'Lila skorpió, akinek villámcsapása a szomszédos ellenségre is átugrik.',
    specialHu: 'Láncvillám: a fő célpont mellett egy közeli ellenséget is megcsap.',
    cost: 150,
    baseHp: 80,
    baseAttack: 8,
    attackIntervalSec: 1.5,
    range: 2.5,
    moveSpeed: 0.8,
    attackKind: 'lightning',
    chainCount: 1,
    chainFactor: 0.6,
    chainRange: 1.6,
    colors: { primary: 0xb066ff, secondary: 0x5b2bd1, accent: 0x62e7ff },
  },
};

export const CHARACTER_TYPE_IDS: readonly CharacterTypeId[] = [
  'laser-crocodile',
  'lightning-scorpion',
];

export const ATTACK_RANK_GROWTH = 1.45;
export const HP_RANK_GROWTH = 1.5;
export const ATTACK_LEVEL_FACTOR = 0.035;
export const HP_LEVEL_FACTOR = 0.04;

export function isCharacterTypeId(value: unknown): value is CharacterTypeId {
  return value === 'laser-crocodile' || value === 'lightning-scorpion';
}

function clampMergeRank(mergeRank: number): number {
  if (!Number.isFinite(mergeRank)) return 1;
  return Math.min(MAX_MERGE_RANK, Math.max(1, Math.floor(mergeRank)));
}

function boundedRound(value: number): number {
  if (!Number.isFinite(value)) return MAX_SAFE_STAT;
  return Math.min(MAX_SAFE_STAT, Math.max(1, Math.round(value)));
}

export function characterStats(
  typeId: CharacterTypeId,
  mergeRank: number,
  totalXp = 0,
): CharacterStats {
  const definition = CHARACTER_DEFINITIONS[typeId];
  const safeRank = clampMergeRank(mergeRank);
  const safeXp = normalizeTotalXp(totalXp);
  const level = characterLevelFromXp(safeXp);
  const rankAttackMultiplier = ATTACK_RANK_GROWTH ** (safeRank - 1);
  const rankHpMultiplier = HP_RANK_GROWTH ** (safeRank - 1);
  const levelAttackMultiplier = 1 + ATTACK_LEVEL_FACTOR * (level - 1);
  const levelHpMultiplier = 1 + HP_LEVEL_FACTOR * (level - 1);
  return {
    attack: boundedRound(definition.baseAttack * rankAttackMultiplier * levelAttackMultiplier),
    maxHp: boundedRound(definition.baseHp * rankHpMultiplier * levelHpMultiplier),
    attackIntervalSec: definition.attackIntervalSec,
    range: definition.range,
    moveSpeed: definition.moveSpeed,
  };
}

export function canMergeRanks(rankA: number, rankB: number): boolean {
  return rankA === rankB && rankA < MAX_MERGE_RANK;
}

export function isMaxMergeRank(mergeRank: number): boolean {
  return mergeRank >= MAX_MERGE_RANK;
}

export function normalizedXp(totalXp: number): number {
  return Math.min(MAX_CHARACTER_XP, normalizeTotalXp(totalXp));
}
