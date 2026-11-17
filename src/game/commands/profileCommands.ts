import {
  characterStats,
  CHARACTER_DEFINITIONS,
  isCharacterTypeId,
  sellRefund,
} from '../domain/characters';
import { defeatComfortCoins, isDifficulty } from '../domain/difficulty';
import {
  EXPANSION_COLUMN_ORDER,
  expansionCellCount,
  firstEmptyAlliedCell,
  isPlayableAlliedCell,
  isPositionFree,
  sameCell,
} from '../domain/grid';
import { nextExpansionCost } from '../domain/expansion';
import {
  awardXp,
  battleXpPerUnit,
  characterLevelFromXp,
  defeatXpPerUnit,
  mergeCharacterXp,
} from '../domain/progression';
import {
  isUpgradeKind,
  maxUpgradeLevelReached,
  upgradeCost,
  upgradeLevel,
} from '../domain/upgrades';
import {
  MAX_COINS,
  MAX_DEFEAT_XP_REWARDS,
  MAX_MERGE_RANK,
  MAX_NEXT_CHARACTER_ID,
  MAX_UPGRADE_ENTRIES,
  TOTAL_WAVES,
  fail,
  ok,
  type BattleSpeed,
  type CharacterInstance,
  type Difficulty,
  type CharacterTypeId,
  type GameSettings,
  type PlayerProfile,
  type Result,
  type UpgradeKind,
} from '../domain/types';
import {
  getWave,
  waveFirstCompletionBonus,
  waveReplayRewardCoins,
  waveRewardCoins,
} from '../domain/waves';

export interface MergeOutcome {
  readonly profile: PlayerProfile;
  readonly merged: CharacterInstance;
}

export interface MergeUndo {
  readonly source: CharacterInstance;
  readonly target: CharacterInstance;
  readonly mergedId: string;
}

export interface PurchaseOutcome {
  readonly profile: PlayerProfile;
  readonly purchased: CharacterInstance;
}

export interface ExpansionPurchaseOutcome {
  readonly profile: PlayerProfile;
  readonly expansionCells: number;
  readonly unlockedColumn: number;
  readonly cost: number;
}

export interface UpgradePurchaseOutcome {
  readonly profile: PlayerProfile;
  readonly kind: UpgradeKind;
  readonly level: number;
  readonly cost: number;
}

export interface SellOutcome {
  readonly profile: PlayerProfile;
  readonly sold: CharacterInstance;
  readonly refund: number;
}

export interface WaveRewardOutcome {
  readonly profile: PlayerProfile;
  readonly rewardCoins: number;
  readonly firstCompletion: boolean;
  readonly firstCompletionBonus: number;
}

export interface BattleLevelUp {
  readonly characterId: string;
  readonly typeId: CharacterTypeId;
  readonly fromLevel: number;
  readonly toLevel: number;
}

export interface DefeatRewardOutcome {
  readonly profile: PlayerProfile;
  readonly comfortCoins: number;
  readonly xpPerUnit: number;
  readonly totalXpAwarded: number;
  readonly levelUps: readonly BattleLevelUp[];
  readonly defeatXpCountBefore: number;
  readonly defeatXpCountAfter: number;
  readonly defeatXpEligible: boolean;
}

export interface BattleRewardOutcome {
  readonly profile: PlayerProfile;
  readonly rewardCoins: number;
  readonly firstCompletion: boolean;
  readonly firstCompletionBonus: number;
  readonly xpPerUnit: number;
  readonly totalXpAwarded: number;
  readonly levelUps: readonly BattleLevelUp[];
  readonly coinOverflow: boolean;
}

function updated(profile: PlayerProfile, now: number): PlayerProfile {
  return { ...profile, lastSavedAt: now };
}

function allocateCharacterId(profile: PlayerProfile): { id: string; nextId: number } {
  const existing = new Set(profile.characters.map((character) => character.id));
  let nextId = Math.max(1, Math.floor(profile.nextCharacterId));
  let id = `unit-${nextId}`;
  while (existing.has(id)) {
    nextId += 1;
    id = `unit-${nextId}`;
  }
  return { id, nextId: nextId < MAX_NEXT_CHARACTER_ID ? nextId + 1 : MAX_NEXT_CHARACTER_ID };
}

export function moveCharacter(
  profile: PlayerProfile,
  characterId: string,
  targetCol: number,
  targetRow: number,
  now = Date.now(),
): Result<PlayerProfile> {
  const source = profile.characters.find((character) => character.id === characterId);
  if (!source) return fail('not-found', characterId);
  if (!isPlayableAlliedCell(targetCol, targetRow, profile.expansionCells)) {
    return fail('not-allied-cell');
  }
  if (sameCell(source, { col: targetCol, row: targetRow })) {
    return ok(profile);
  }
  if (!isPositionFree(profile.characters, targetCol, targetRow)) {
    return fail('cell-occupied');
  }
  const characters = profile.characters.map((character) =>
    character.id === characterId ? { ...character, col: targetCol, row: targetRow } : character,
  );
  return ok(updated({ ...profile, characters }, now));
}

export function mergeCharacters(
  profile: PlayerProfile,
  sourceId: string,
  targetId: string,
  now = Date.now(),
): Result<MergeOutcome> {
  if (sourceId === targetId) return fail('same-unit');
  const source = profile.characters.find((character) => character.id === sourceId);
  const target = profile.characters.find((character) => character.id === targetId);
  if (!source || !target) return fail('not-found');
  if (source.typeId !== target.typeId) return fail('type-mismatch');
  if (source.mergeRank !== target.mergeRank) return fail('rank-mismatch');
  if (source.mergeRank >= MAX_MERGE_RANK) return fail('max-rank');

  const allocation = allocateCharacterId(profile);
  const merged: CharacterInstance = {
    id: allocation.id,
    typeId: target.typeId,
    mergeRank: target.mergeRank + 1,
    totalXp: mergeCharacterXp(source.totalXp, target.totalXp),
    col: target.col,
    row: target.row,
  };
  const characters = [
    ...profile.characters.filter(
      (character) => character.id !== source.id && character.id !== target.id,
    ),
    merged,
  ].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const nextProfile = updated(
    {
      ...profile,
      characters,
      nextCharacterId: allocation.nextId,
    },
    now,
  );
  return ok({ profile: nextProfile, merged });
}

export function undoMerge(
  profile: PlayerProfile,
  undo: MergeUndo,
  now = Date.now(),
): Result<PlayerProfile> {
  const merged = profile.characters.find((character) => character.id === undo.mergedId);
  if (!merged) return fail('not-found', undo.mergedId);
  const survivors = profile.characters.filter((character) => character.id !== undo.mergedId);
  const occupies = (col: number, row: number): boolean =>
    survivors.some((character) => character.col === col && character.row === row);
  if (occupies(undo.source.col, undo.source.row)) return fail('cell-occupied', 'undo.source');
  if (occupies(undo.target.col, undo.target.row)) return fail('cell-occupied', 'undo.target');
  const characters = [...survivors, { ...undo.source }, { ...undo.target }].sort((a, b) =>
    a.id.localeCompare(b.id, 'en'),
  );
  return ok(updated({ ...profile, characters }, now));
}

export function purchaseCharacter(
  profile: PlayerProfile,
  typeId: CharacterTypeId,
  now = Date.now(),
): Result<PurchaseOutcome> {
  if (!isCharacterTypeId(typeId)) return fail('invalid-character');
  const definition = CHARACTER_DEFINITIONS[typeId];
  if (profile.coins < definition.cost) return fail('insufficient-coins');
  const emptyCell = firstEmptyAlliedCell(profile.characters, profile.expansionCells);
  if (!emptyCell) return fail('board-full');

  const allocation = allocateCharacterId(profile);
  const purchased: CharacterInstance = {
    id: allocation.id,
    typeId,
    mergeRank: 1,
    totalXp: 0,
    col: emptyCell.col,
    row: emptyCell.row,
  };
  const nextProfile = updated(
    {
      ...profile,
      coins: profile.coins - definition.cost,
      characters: [...profile.characters, purchased].sort((a, b) => a.id.localeCompare(b.id, 'en')),
      nextCharacterId: allocation.nextId,
    },
    now,
  );
  return ok({ profile: nextProfile, purchased });
}

export function purchaseExpansion(
  profile: PlayerProfile,
  now = Date.now(),
): Result<ExpansionPurchaseOutcome> {
  const cost = nextExpansionCost(profile.expansionCells);
  if (cost === null) return fail('max-expansion');
  if (profile.coins < cost) return fail('insufficient-coins');
  const nextCount = expansionCellCount(profile.expansionCells) + 1;
  const unlockedColumn = EXPANSION_COLUMN_ORDER[nextCount - 1];
  if (unlockedColumn === undefined) return fail('max-expansion');
  return ok({
    profile: updated({ ...profile, coins: profile.coins - cost, expansionCells: nextCount }, now),
    expansionCells: nextCount,
    unlockedColumn,
    cost,
  });
}

export function sellCharacter(
  profile: PlayerProfile,
  characterId: string,
  now = Date.now(),
): Result<SellOutcome> {
  const sold = profile.characters.find((character) => character.id === characterId);
  if (!sold) return fail('not-found', characterId);
  if (!isCharacterTypeId(sold.typeId)) return fail('invalid-character');
  const refund = sellRefund(sold.typeId, sold.mergeRank);
  if (refund > 0 && profile.coins > MAX_COINS - refund) return fail('coin-overflow');
  const characters = profile.characters.filter((character) => character.id !== sold.id);
  return ok({
    profile: updated(
      {
        ...profile,
        coins: profile.coins + refund,
        characters,
      },
      now,
    ),
    sold,
    refund,
  });
}

export function claimWaveReward(
  profile: PlayerProfile,
  waveId: number,
  now = Date.now(),
): Result<WaveRewardOutcome> {
  const wave = getWave(waveId);
  if (!wave) return fail('invalid-wave');
  const firstCompletion = !profile.completedWaves.includes(waveId);
  const rewardCoins = firstCompletion ? waveRewardCoins(wave) : waveReplayRewardCoins(wave);
  const firstCompletionBonus = firstCompletion ? waveFirstCompletionBonus(wave) : 0;
  if (rewardCoins > 0 && profile.coins > MAX_COINS - rewardCoins) return fail('coin-overflow');
  const completedWaves = firstCompletion
    ? [...profile.completedWaves, waveId].sort((a, b) => a - b)
    : profile.completedWaves;
  const nextWave = Math.min(waveId + 1, TOTAL_WAVES);
  const nextProfile = updated(
    {
      ...profile,
      coins: profile.coins + rewardCoins,
      completedWaves,
      unlockedWave: firstCompletion
        ? Math.max(profile.unlockedWave, nextWave)
        : profile.unlockedWave,
      currentWave: firstCompletion ? Math.max(profile.currentWave, nextWave) : profile.currentWave,
    },
    now,
  );
  return ok({
    profile: nextProfile,
    rewardCoins,
    firstCompletion,
    firstCompletionBonus,
  });
}

export function resolveDefeatRewards(
  profile: PlayerProfile,
  waveId: number,
  participantIds: readonly string[],
  now = Date.now(),
): Result<DefeatRewardOutcome> {
  const wave = getWave(waveId);
  if (!wave) return fail('invalid-wave');
  const comfortCoins = defeatComfortCoins(profile.settings.difficulty);
  if (profile.coins > MAX_COINS - comfortCoins) return fail('coin-overflow');

  const firstCompletion = !profile.completedWaves.includes(waveId);
  const counterIndex = waveId - 1;
  const countBefore = profile.defeatXpCounts[counterIndex] ?? 0;
  const eligible = countBefore < MAX_DEFEAT_XP_REWARDS;
  const xpPerUnit = eligible ? defeatXpPerUnit(waveId, firstCompletion) : 0;
  const participants = new Set(participantIds);
  const levelUps: BattleLevelUp[] = [];
  let totalXpAwarded = 0;

  const characters = profile.characters.map((character) => {
    if (!participants.has(character.id) || xpPerUnit <= 0) return character;
    const beforeLevel = characterLevelFromXp(character.totalXp);
    const nextXp = awardXp(character.totalXp, xpPerUnit);
    const afterLevel = characterLevelFromXp(nextXp);
    totalXpAwarded += nextXp - character.totalXp;
    if (afterLevel > beforeLevel) {
      levelUps.push({
        characterId: character.id,
        typeId: character.typeId,
        fromLevel: beforeLevel,
        toLevel: afterLevel,
      });
    }
    return { ...character, totalXp: nextXp };
  });

  const defeatXpCounts = Array.from(
    { length: Math.max(TOTAL_WAVES, profile.defeatXpCounts.length) },
    (_, index) => profile.defeatXpCounts[index] ?? 0,
  );
  if (eligible) defeatXpCounts[counterIndex] = countBefore + 1;

  return ok({
    profile: updated(
      {
        ...profile,
        coins: profile.coins + comfortCoins,
        characters,
        defeatXpCounts,
      },
      now,
    ),
    comfortCoins,
    xpPerUnit,
    totalXpAwarded,
    levelUps,
    defeatXpCountBefore: countBefore,
    defeatXpCountAfter: eligible ? countBefore + 1 : countBefore,
    defeatXpEligible: eligible,
  });
}

export function resolveBattleRewards(
  profile: PlayerProfile,
  waveId: number,
  participantIds: readonly string[],
  now = Date.now(),
): Result<BattleRewardOutcome> {
  const wave = getWave(waveId);
  if (!wave) return fail('invalid-wave');

  const firstCompletion = !profile.completedWaves.includes(waveId);
  const xpPerUnit = battleXpPerUnit(waveId, firstCompletion);
  const participants = new Set(participantIds);
  const levelUps: BattleLevelUp[] = [];
  let totalXpAwarded = 0;

  const characters = profile.characters.map((character) => {
    if (!participants.has(character.id) || xpPerUnit <= 0) return character;
    const beforeLevel = characterLevelFromXp(character.totalXp);
    const nextXp = awardXp(character.totalXp, xpPerUnit);
    const afterLevel = characterLevelFromXp(nextXp);
    totalXpAwarded += nextXp - character.totalXp;
    if (afterLevel > beforeLevel) {
      levelUps.push({
        characterId: character.id,
        typeId: character.typeId,
        fromLevel: beforeLevel,
        toLevel: afterLevel,
      });
    }
    return { ...character, totalXp: nextXp };
  });

  const withXp = updated({ ...profile, characters }, now);
  const claimed = claimWaveReward(withXp, waveId, now);
  if (claimed.ok) {
    return ok({
      profile: claimed.value.profile,
      rewardCoins: claimed.value.rewardCoins,
      firstCompletion: claimed.value.firstCompletion,
      firstCompletionBonus: claimed.value.firstCompletionBonus,
      xpPerUnit,
      totalXpAwarded,
      levelUps,
      coinOverflow: false,
    });
  }
  if (claimed.error === 'coin-overflow') {
    const completedWaves = profile.completedWaves.includes(waveId)
      ? profile.completedWaves
      : [...profile.completedWaves, waveId].sort((a, b) => a - b);
    const nextWave = Math.min(waveId + 1, TOTAL_WAVES);
    return ok({
      profile: updated(
        {
          ...withXp,
          completedWaves,
          unlockedWave: Math.max(withXp.unlockedWave, nextWave),
          currentWave: Math.max(withXp.currentWave, nextWave),
        },
        now,
      ),
      rewardCoins: 0,
      firstCompletion,
      firstCompletionBonus: 0,
      xpPerUnit,
      totalXpAwarded,
      levelUps,
      coinOverflow: true,
    });
  }
  return claimed;
}

export function applyDefeatComfort(
  profile: PlayerProfile,
  now = Date.now(),
): Result<PlayerProfile> {
  const comfortCoins = defeatComfortCoins(profile.settings.difficulty);
  if (profile.coins > MAX_COINS - comfortCoins) return fail('coin-overflow');
  return ok(
    updated(
      {
        ...profile,
        coins: profile.coins + comfortCoins,
      },
      now,
    ),
  );
}

export function purchaseUpgrade(
  profile: PlayerProfile,
  kind: UpgradeKind,
  now = Date.now(),
): Result<UpgradePurchaseOutcome> {
  if (!isUpgradeKind(kind)) return fail('invalid-upgrade');
  if (maxUpgradeLevelReached(profile, kind)) return fail('max-upgrade');
  const currentLevel = upgradeLevel(profile, kind);
  const cost = upgradeCost(kind, currentLevel);
  if (profile.coins < cost) return fail('insufficient-coins');
  const nextLevel = currentLevel + 1;
  const upgrades: Record<string, number> = { ...profile.upgrades };
  upgrades[kind] = nextLevel;
  const entryCount = Object.keys(upgrades).length;
  if (entryCount > MAX_UPGRADE_ENTRIES) return fail('invalid-upgrade');
  return ok({
    profile: updated(
      {
        ...profile,
        coins: profile.coins - cost,
        upgrades,
      },
      now,
    ),
    kind,
    level: nextLevel,
    cost,
  });
}

export function updateSettings(
  profile: PlayerProfile,
  settings: Partial<GameSettings>,
  now = Date.now(),
): PlayerProfile {
  const battleSpeed: BattleSpeed =
    settings.battleSpeed === 2 ? 2 : settings.battleSpeed === 1 ? 1 : profile.settings.battleSpeed;
  const difficulty: Difficulty = isDifficulty(settings.difficulty)
    ? settings.difficulty
    : profile.settings.difficulty;
  return updated(
    {
      ...profile,
      settings: {
        soundEnabled: settings.soundEnabled ?? profile.settings.soundEnabled,
        reducedMotion: settings.reducedMotion ?? profile.settings.reducedMotion,
        battleSpeed,
        difficulty,
      },
    },
    now,
  );
}

export function markTutorialSeen(profile: PlayerProfile, now = Date.now()): PlayerProfile {
  if (profile.tutorialSeen) return profile;
  return updated({ ...profile, tutorialSeen: true }, now);
}

export function currentWaveDefinition(profile: PlayerProfile) {
  return getWave(profile.currentWave);
}

export function armyPower(profile: PlayerProfile): number {
  return profile.characters.reduce((total, character) => {
    const stats = characterStats(character.typeId, character.mergeRank, character.totalXp);
    return total + stats.attack + stats.maxHp / 10;
  }, 0);
}
