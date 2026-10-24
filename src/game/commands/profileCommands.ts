import { characterStats, CHARACTER_DEFINITIONS, isCharacterTypeId } from '../domain/characters';
import { firstEmptyAlliedCell, isAlliedCell, isPositionFree, sameCell } from '../domain/grid';
import { DEFEAT_COMFORT_COINS } from '../domain/state';
import {
  MAX_CHARACTER_LEVEL,
  MAX_COINS,
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

export interface PurchaseOutcome {
  readonly profile: PlayerProfile;
  readonly purchased: CharacterInstance;
}

export interface WaveRewardOutcome {
  readonly profile: PlayerProfile;
  readonly rewardCoins: number;
  readonly firstCompletion: boolean;
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
  if (source.level !== target.level) return fail('level-mismatch');
  if (source.level >= MAX_CHARACTER_LEVEL) return fail('max-level');

  const allocation = allocateCharacterId(profile);
  const merged: CharacterInstance = {
    id: allocation.id,
    typeId: target.typeId,
    level: target.level + 1,
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
    level: 1,
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
    const stats = characterStats(character.typeId, character.level);
    return total + stats.attack + stats.maxHp / 10;
  }, 0);
}
