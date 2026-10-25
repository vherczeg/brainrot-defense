import { characterStats, CHARACTER_DEFINITIONS, isCharacterTypeId } from '../domain/characters';
import { firstEmptyAlliedCell, isAlliedCell, isPositionFree, sameCell } from '../domain/grid';
import {
  awardXp,
  battleXpPerUnit,
  characterLevelFromXp,
  mergeCharacterXp,
} from '../domain/progression';
import { DEFEAT_COMFORT_COINS } from '../domain/state';
import {
  MAX_COINS,
  MAX_MERGE_RANK,
  MAX_NEXT_CHARACTER_ID,
  TOTAL_WAVES,
  fail,
  ok,
  type BattleSpeed,
  type CharacterInstance,
  type CharacterTypeId,
  type GameSettings,
  type PlayerProfile,
  type Result,
} from '../domain/types';
import { getWave } from '../domain/waves';

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

export interface WaveRewardOutcome {
  readonly profile: PlayerProfile;
  readonly rewardCoins: number;
  readonly firstCompletion: boolean;
}

export interface BattleLevelUp {
  readonly characterId: string;
  readonly typeId: CharacterTypeId;
  readonly fromLevel: number;
  readonly toLevel: number;
}

export interface BattleRewardOutcome {
  readonly profile: PlayerProfile;
  readonly rewardCoins: number;
  readonly firstCompletion: boolean;
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
  if (!isAlliedCell(targetCol, targetRow)) return fail('not-allied-cell');
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
  const emptyCell = firstEmptyAlliedCell(profile.characters);
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

export function claimWaveReward(
  profile: PlayerProfile,
  waveId: number,
  now = Date.now(),
): Result<WaveRewardOutcome> {
  const wave = getWave(waveId);
  if (!wave) return fail('invalid-wave');
  if (profile.completedWaves.includes(waveId)) {
    return ok({ profile, rewardCoins: 0, firstCompletion: false });
  }
  if (profile.coins > MAX_COINS - wave.rewardCoins) return fail('coin-overflow');
  const completedWaves = [...profile.completedWaves, waveId].sort((a, b) => a - b);
  const nextWave = Math.min(waveId + 1, TOTAL_WAVES);
  const nextProfile = updated(
    {
      ...profile,
      coins: profile.coins + wave.rewardCoins,
      completedWaves,
      unlockedWave: Math.max(profile.unlockedWave, nextWave),
      currentWave: Math.max(profile.currentWave, nextWave),
    },
    now,
  );
  return ok({ profile: nextProfile, rewardCoins: wave.rewardCoins, firstCompletion: true });
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
  if (profile.coins > MAX_COINS - DEFEAT_COMFORT_COINS) return fail('coin-overflow');
  return ok(
    updated(
      {
        ...profile,
        coins: profile.coins + DEFEAT_COMFORT_COINS,
      },
      now,
    ),
  );
}

export function updateSettings(
  profile: PlayerProfile,
  settings: Partial<GameSettings>,
  now = Date.now(),
): PlayerProfile {
  const battleSpeed: BattleSpeed =
    settings.battleSpeed === 2 ? 2 : settings.battleSpeed === 1 ? 1 : profile.settings.battleSpeed;
  return updated(
    {
      ...profile,
      settings: {
        soundEnabled: settings.soundEnabled ?? profile.settings.soundEnabled,
        reducedMotion: settings.reducedMotion ?? profile.settings.reducedMotion,
        battleSpeed,
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
