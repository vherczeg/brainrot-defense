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
    armor: 0,
    attackKind: 'laser',
    chainCount: 0,
    chainFactor: 0,
    chainRange: 0,
    splashRadius: 0,
    colors: { primary: 0x39e58c, secondary: 0x0f9f6e, accent: 0xa8ff4d },
  },
  'lightning-scorpion': {
    id: 'lightning-scorpion',
    nameHu: 'Villám Skorpió',
    shortNameHu: 'Skorpió',
    roleHu: 'Területsebző',
    descriptionHu: 'Lila skorpió, akinek villámcsapása a szomszédos ellenségre is átugrik.',
    specialHu:
      'Láncvillám: a fő célpont mellett egy közeli ellenséget is megcsap, és kizökkenti a szellem módú szörnyeket.',
    cost: 150,
    baseHp: 110,
    baseAttack: 10,
    attackIntervalSec: 1.4,
    range: 2.5,
    moveSpeed: 0.8,
    armor: 0,
    attackKind: 'lightning',
    chainCount: 1,
    chainFactor: 0.6,
    chainRange: 1.8,
    splashRadius: 0,
    colors: { primary: 0xb066ff, secondary: 0x5b2bd1, accent: 0x62e7ff },
  },
  'armored-rhino': {
    id: 'armored-rhino',
    nameHu: 'Páncél Rinó',
    shortNameHu: 'Rinó',
    roleHu: 'Védelmező tank',
    descriptionHu: 'Vastag páncélú rinocérosz, aki a közelében lévő összes szörnyet megsebzi.',
    specialHu: 'Dübörgő csapás: a közeli ellenségek mind kapnak a találatból.',
    cost: 200,
    baseHp: 260,
    baseAttack: 14,
    attackIntervalSec: 1.2,
    range: 1.4,
    moveSpeed: 0.95,
    armor: 0.3,
    attackKind: 'melee',
    chainCount: 0,
    chainFactor: 0,
    chainRange: 0,
    splashRadius: 1,
    colors: { primary: 0x8a9bb5, secondary: 0x2a3342, accent: 0xd8e6ff },
  },
  'frost-owl': {
    id: 'frost-owl',
    nameHu: 'Fagy Bagoly',
    shortNameHu: 'Bagoly',
    roleHu: 'Lassító támadó',
    descriptionHu: 'Jéghideg tollakkal támad; akit eltalál, az lassabban támad és csúszik.',
    specialHu: 'Fagy lehelet: lelassítja az eltalált szörnyet.',
    cost: 200,
    baseHp: 110,
    baseAttack: 13,
    attackIntervalSec: 1.3,
    range: 3.5,
    moveSpeed: 0.8,
    armor: 0,
    attackKind: 'frost',
    chainCount: 0,
    chainFactor: 0,
    chainRange: 0,
    splashRadius: 0,
    slow: { attackIntervalFactor: 1.6, moveSpeedFactor: 0.6, durationSec: 3 },
    colors: { primary: 0x8ad1ff, secondary: 0x1a4a7a, accent: 0xe0f4ff },
  },
};

export const CHARACTER_TYPE_IDS: readonly CharacterTypeId[] = Object.keys(
  CHARACTER_DEFINITIONS,
) as CharacterTypeId[];

export const ATTACK_RANK_GROWTH = 1.45;
export const HP_RANK_GROWTH = 1.5;
export const ATTACK_LEVEL_FACTOR = 0.035;
export const HP_LEVEL_FACTOR = 0.04;

export function isCharacterTypeId(value: unknown): value is CharacterTypeId {
  return typeof value === 'string' && value in CHARACTER_DEFINITIONS;
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
    armor: definition.armor,
    splashRadius: definition.splashRadius,
  };
}

export const SELL_REFUND_PERCENT = 50;

/**
 * The purchase value of a rank-r unit is the base price doubled for every merge step.
 * A rank-r unit represents 2^(r-1) rank-1 purchases, so the player can never sell a unit
 * for more than the gold legitimately invested in its merge lineage.
 */
export function purchaseValueForRank(typeId: CharacterTypeId, mergeRank: number): number {
  const definition = CHARACTER_DEFINITIONS[typeId];
  const safeRank = clampMergeRank(mergeRank);
  return definition.cost * 2 ** (safeRank - 1);
}

export function sellRefund(typeId: CharacterTypeId, mergeRank: number): number {
  return Math.floor((purchaseValueForRank(typeId, mergeRank) * SELL_REFUND_PERCENT) / 100);
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
