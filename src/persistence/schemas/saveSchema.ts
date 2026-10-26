import { isCharacterTypeId } from '../../game/domain/characters';
import { MAX_CHARACTER_XP, MAX_MERGE_RANK } from '../../game/domain/progression';
import {
  ALLY_ROW_START,
  BOARD_COLS,
  BOARD_ROWS,
  MAX_ARMY_SIZE,
  MAX_COINS,
  MAX_NEXT_CHARACTER_ID,
  PREVIOUS_TOTAL_WAVES,
  TOTAL_WAVES,
  fail,
  ok,
  type BattleSpeed,
  type CharacterInstance,
  type Difficulty,
  type GameSettings,
  type PlayerProfile,
  type Result,
} from '../../game/domain/types';

export const CURRENT_SAVE_VERSION = 4;
export const MIN_MIGRATABLE_SAVE_VERSION = 2;
export const LEGACY_SAVE_VERSION = 1;
export const SAVE_APP_ID = 'brainrot-defense';
export const SAVE_FORMAT = 'brainrot-defense-save';
export { MAX_COINS } from '../../game/domain/types';
export const MAX_NAME_LENGTH = 24;
export const MAX_PROFILE_ID_LENGTH = 80;
export const MAX_UNIT_ID_LENGTH = 80;

export interface SaveEnvelope {
  readonly format: typeof SAVE_FORMAT;
  readonly appId: typeof SAVE_APP_ID;
  readonly schemaVersion: number;
  readonly exportedAt: string;
  readonly profile: PlayerProfile;
}

export interface StoredProfileRecord {
  readonly profileId: string;
  readonly schemaVersion: number;
  readonly checksum: string;
  readonly savedAt: number;
  readonly payload: unknown;
}

export interface LegacyCharacterInstanceV1 {
  readonly id: string;
  readonly typeId: CharacterInstance['typeId'];
  readonly level: number;
  readonly col: number;
  readonly row: number;
}

export interface LegacyPlayerProfileV1 {
  readonly profileId: string;
  readonly name: string;
  readonly coins: number;
  readonly currentWave: number;
  readonly unlockedWave: number;
  readonly completedWaves: readonly number[];
  readonly characters: readonly LegacyCharacterInstanceV1[];
  readonly upgrades: Readonly<Record<string, number>>;
  readonly settings: GameSettings;
  readonly tutorialSeen: boolean;
  readonly nextCharacterId: number;
  readonly createdAt: number;
  readonly lastSavedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isSafeId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_UNIT_ID_LENGTH &&
    /^[a-zA-Z0-9_-]+$/.test(value)
  );
}

function parseSettings(value: unknown): Result<GameSettings> {
  if (!isRecord(value)) return fail('invalid-import', 'settings');
  const battleSpeed = value.battleSpeed;
  if (battleSpeed !== 1 && battleSpeed !== 2) {
    return fail('invalid-import', 'settings.battleSpeed');
  }
  if (typeof value.soundEnabled !== 'boolean') {
    return fail('invalid-import', 'settings.soundEnabled');
  }
  if (typeof value.reducedMotion !== 'boolean') {
    return fail('invalid-import', 'settings.reducedMotion');
  }
  const rawDifficulty = value.difficulty;
  if (rawDifficulty !== undefined && rawDifficulty !== 'normal' && rawDifficulty !== 'hard') {
    return fail('invalid-import', 'settings.difficulty');
  }
  return ok({
    soundEnabled: value.soundEnabled,
    reducedMotion: value.reducedMotion,
    battleSpeed: battleSpeed as BattleSpeed,
    difficulty: (rawDifficulty ?? 'normal') as Difficulty,
  });
}

function parseUpgrades(value: unknown): Result<Readonly<Record<string, number>>> {
  if (!isRecord(value)) return fail('invalid-import', 'upgrades');
  const entries = Object.entries(value);
  if (entries.length > 20) return fail('invalid-import', 'upgrades.size');
  const upgrades: Record<string, number> = {};
  for (const [key, amount] of entries) {
    if (key.length === 0 || key.length > 40) return fail('invalid-import', 'upgrades.key');
    if (
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > MAX_COINS
    ) {
      return fail('invalid-import', 'upgrades.value');
    }
    upgrades[key] = amount;
  }
  return ok(upgrades);
}

function parseCompletedWaves(value: unknown): Result<readonly number[]> {
  if (!Array.isArray(value)) return fail('invalid-import', 'completedWaves');
  const completedWaves: number[] = [];
  for (const wave of value) {
    if (!isInt(wave, 1, TOTAL_WAVES)) return fail('invalid-import', 'completedWaves.item');
    if (completedWaves.includes(wave)) return fail('invalid-import', 'completedWaves.duplicate');
    completedWaves.push(wave);
  }
  completedWaves.sort((a, b) => a - b);
  for (let index = 0; index < completedWaves.length; index += 1) {
    if (completedWaves[index] !== index + 1) {
      return fail('invalid-import', 'completedWaves.prefix');
    }
  }
  return ok(completedWaves);
}

function parseBaseProfile(value: Record<string, unknown>): Result<{
  readonly profileId: string;
  readonly name: string;
  readonly coins: number;
  readonly currentWave: number;
  readonly unlockedWave: number;
  readonly completedWaves: readonly number[];
  readonly upgrades: Readonly<Record<string, number>>;
  readonly settings: GameSettings;
  readonly tutorialSeen: boolean;
  readonly nextCharacterId: number;
  readonly createdAt: number;
  readonly lastSavedAt: number;
}> {
  if (!isSafeId(value.profileId) || value.profileId.length > MAX_PROFILE_ID_LENGTH) {
    return fail('invalid-import', 'profileId');
  }
  if (!isNonEmptyString(value.name, MAX_NAME_LENGTH)) {
    return fail('invalid-import', 'name');
  }
  if (!isInt(value.coins, 0, MAX_COINS)) return fail('invalid-import', 'coins');
  if (!isInt(value.currentWave, 1, TOTAL_WAVES)) {
    return fail('invalid-import', 'currentWave');
  }
  if (!isInt(value.unlockedWave, 1, TOTAL_WAVES)) {
    return fail('invalid-import', 'unlockedWave');
  }
  if (value.currentWave > value.unlockedWave) {
    return fail('invalid-import', 'wave-order');
  }
  const completedWaves = parseCompletedWaves(value.completedWaves);
  if (!completedWaves.ok) return completedWaves;
  const expectedCurrentWave = Math.min(completedWaves.value.length + 1, TOTAL_WAVES);
  const legacyMaxedWave =
    completedWaves.value.length >= PREVIOUS_TOTAL_WAVES &&
    value.currentWave === PREVIOUS_TOTAL_WAVES;
  if (value.currentWave !== expectedCurrentWave && !legacyMaxedWave) {
    return fail('invalid-import', 'currentWave.order');
  }
  // Saves made when the campaign ended at wave 10 stored currentWave/unlockedWave as 10.
  // Opening wave 11 must not corrupt them: accept that legacy shape and advance it in memory.
  const currentWave = legacyMaxedWave ? expectedCurrentWave : value.currentWave;
  const unlockedWave = Math.max(value.unlockedWave, currentWave);
  const upgrades = parseUpgrades(value.upgrades);
  if (!upgrades.ok) return upgrades;
  const settings = parseSettings(value.settings);
  if (!settings.ok) return settings;
  if (typeof value.tutorialSeen !== 'boolean') {
    return fail('invalid-import', 'tutorialSeen');
  }
  if (!isInt(value.nextCharacterId, 1, MAX_NEXT_CHARACTER_ID)) {
    return fail('invalid-import', 'nextCharacterId');
  }
  if (!isInt(value.createdAt, 0, Number.MAX_SAFE_INTEGER)) {
    return fail('invalid-import', 'createdAt');
  }
  if (!isInt(value.lastSavedAt, 0, Number.MAX_SAFE_INTEGER)) {
    return fail('invalid-import', 'lastSavedAt');
  }
  return ok({
    profileId: value.profileId,
    name: value.name.trim(),
    coins: value.coins,
    currentWave,
    unlockedWave,
    completedWaves: completedWaves.value,
    upgrades: upgrades.value,
    settings: settings.value,
    tutorialSeen: value.tutorialSeen,
    nextCharacterId: value.nextCharacterId,
    createdAt: value.createdAt,
    lastSavedAt: value.lastSavedAt,
  });
}

function parseDefeatXpCounts(value: unknown): Result<readonly number[]> {
  if (value === undefined) return ok(Array.from({ length: TOTAL_WAVES }, () => 0));
  if (!Array.isArray(value) || value.length !== TOTAL_WAVES) {
    return fail('invalid-import', 'defeatXpCounts');
  }
  const counts: number[] = [];
  for (const count of value) {
    if (!isInt(count, 0, 3)) return fail('invalid-import', 'defeatXpCounts.item');
    counts.push(count);
  }
  return ok(counts);
}

function parseCharacter(value: unknown): Result<CharacterInstance> {
  if (!isRecord(value)) return fail('invalid-import', 'character');
  if (!isSafeId(value.id)) return fail('invalid-import', 'character.id');
  if (!isCharacterTypeId(value.typeId)) return fail('invalid-import', 'character.typeId');
  if (!isInt(value.mergeRank, 1, MAX_MERGE_RANK)) {
    return fail('invalid-import', 'character.mergeRank');
  }
  if (!isInt(value.totalXp, 0, MAX_CHARACTER_XP)) {
    return fail('invalid-import', 'character.totalXp');
  }
  if (!isInt(value.col, 0, BOARD_COLS - 1)) {
    return fail('invalid-import', 'character.col');
  }
  if (!isInt(value.row, ALLY_ROW_START, BOARD_ROWS - 1)) {
    return fail('invalid-import', 'character.row');
  }
  return ok({
    id: value.id,
    typeId: value.typeId,
    mergeRank: value.mergeRank,
    totalXp: value.totalXp,
    col: value.col,
    row: value.row,
  });
}

function parseLegacyCharacter(value: unknown): Result<LegacyCharacterInstanceV1> {
  if (!isRecord(value)) return fail('invalid-import', 'character');
  if ('mergeRank' in value || 'totalXp' in value) {
    return fail('invalid-import', 'character.legacy-shape');
  }
  if (!isSafeId(value.id)) return fail('invalid-import', 'character.id');
  if (!isCharacterTypeId(value.typeId)) return fail('invalid-import', 'character.typeId');
  if (!isInt(value.level, 1, MAX_MERGE_RANK)) {
    return fail('invalid-import', 'character.level');
  }
  if (!isInt(value.col, 0, BOARD_COLS - 1)) {
    return fail('invalid-import', 'character.col');
  }
  if (!isInt(value.row, ALLY_ROW_START, BOARD_ROWS - 1)) {
    return fail('invalid-import', 'character.row');
  }
  return ok({
    id: value.id,
    typeId: value.typeId,
    level: value.level,
    col: value.col,
    row: value.row,
  });
}

function parseCharacterList<T>(
  value: unknown,
  parse: (character: unknown) => Result<T>,
  keyOf: (character: T) => { readonly id: string; readonly col: number; readonly row: number },
): Result<readonly T[]> {
  if (!Array.isArray(value)) return fail('invalid-import', 'characters');
  if (value.length > MAX_ARMY_SIZE) {
    return fail('invalid-import', 'characters.size');
  }
  const characters: T[] = [];
  const unitIds = new Set<string>();
  const positions = new Set<string>();
  for (const rawCharacter of value) {
    const parsed = parse(rawCharacter);
    if (!parsed.ok) return parsed;
    const character = parsed.value;
    const key = keyOf(character);
    if (unitIds.has(key.id)) return fail('invalid-import', 'characters.id-duplicate');
    const position = `${key.col},${key.row}`;
    if (positions.has(position)) return fail('invalid-import', 'characters.position-duplicate');
    unitIds.add(key.id);
    positions.add(position);
    characters.push(character);
  }
  return ok(characters);
}

export function validateProfile(value: unknown): Result<PlayerProfile> {
  if (!isRecord(value)) return fail('invalid-import', 'profile');
  const base = parseBaseProfile(value);
  if (!base.ok) return base;
  const characters = parseCharacterList(value.characters, parseCharacter, (character) => character);
  if (!characters.ok) return characters;
  const defeatXpCounts = parseDefeatXpCounts(value.defeatXpCounts);
  if (!defeatXpCounts.ok) return defeatXpCounts;
  return ok({
    profileId: base.value.profileId,
    name: base.value.name,
    coins: base.value.coins,
    currentWave: base.value.currentWave,
    unlockedWave: base.value.unlockedWave,
    completedWaves: base.value.completedWaves,
    characters: characters.value,
    defeatXpCounts: defeatXpCounts.value,
    upgrades: base.value.upgrades,
    settings: base.value.settings,
    tutorialSeen: base.value.tutorialSeen,
    nextCharacterId: base.value.nextCharacterId,
    createdAt: base.value.createdAt,
    lastSavedAt: base.value.lastSavedAt,
  });
}

export function validateLegacyProfileV1(value: unknown): Result<LegacyPlayerProfileV1> {
  if (!isRecord(value)) return fail('invalid-import', 'profile');
  const base = parseBaseProfile(value);
  if (!base.ok) return base;
  const characters = parseCharacterList(
    value.characters,
    parseLegacyCharacter,
    (character) => character,
  );
  if (!characters.ok) return characters;
  return ok({
    profileId: base.value.profileId,
    name: base.value.name,
    coins: base.value.coins,
    currentWave: base.value.currentWave,
    unlockedWave: base.value.unlockedWave,
    completedWaves: base.value.completedWaves,
    characters: characters.value,
    upgrades: base.value.upgrades,
    settings: base.value.settings,
    tutorialSeen: base.value.tutorialSeen,
    nextCharacterId: base.value.nextCharacterId,
    createdAt: base.value.createdAt,
    lastSavedAt: base.value.lastSavedAt,
  });
}

export function migrateV1Profile(value: unknown): Result<PlayerProfile> {
  // A v1 payload must use the v1 character shape. Accepting v2-shaped characters behind a v1
  // version marker would make the declared schema version meaningless and hide client mistakes.
  const legacy = validateLegacyProfileV1(value);
  if (!legacy.ok) return legacy;
  return validateProfile({
    ...legacy.value,
    characters: legacy.value.characters.map((character) => ({
      id: character.id,
      typeId: character.typeId,
      mergeRank: character.level,
      totalXp: 0,
      col: character.col,
      row: character.row,
    })),
  });
}

export function validateEnvelope(value: unknown): Result<SaveEnvelope> {
  if (!isRecord(value)) return fail('invalid-import', 'envelope');
  if (value.appId !== SAVE_APP_ID || value.format !== SAVE_FORMAT) {
    return fail('invalid-import', 'appId');
  }
  if (!isInt(value.schemaVersion, 1, Number.MAX_SAFE_INTEGER)) {
    return fail('invalid-import', 'schemaVersion');
  }
  if (value.schemaVersion > CURRENT_SAVE_VERSION) {
    return fail('unsupported-version', `schemaVersion ${value.schemaVersion}`);
  }
  const profile =
    value.schemaVersion === LEGACY_SAVE_VERSION
      ? migrateV1Profile(value.profile)
      : validateProfile(value.profile);
  if (!profile.ok) return profile;
  return ok({
    format: SAVE_FORMAT,
    appId: SAVE_APP_ID,
    schemaVersion: CURRENT_SAVE_VERSION,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date(0).toISOString(),
    profile: profile.value,
  });
}

export function createEnvelope(profile: PlayerProfile, exportedAt = new Date()): SaveEnvelope {
  return {
    format: SAVE_FORMAT,
    appId: SAVE_APP_ID,
    schemaVersion: CURRENT_SAVE_VERSION,
    exportedAt: exportedAt.toISOString(),
    profile,
  };
}

export function validateStoredRecord(value: unknown): Result<StoredProfileRecord> {
  if (!isRecord(value)) return fail('corrupt-save', 'record');
  if (!isSafeId(value.profileId)) return fail('corrupt-save', 'record.profileId');
  if (!isInt(value.schemaVersion, 1, Number.MAX_SAFE_INTEGER)) {
    return fail('corrupt-save', 'record.schemaVersion');
  }
  if (value.schemaVersion > CURRENT_SAVE_VERSION) {
    return fail('unsupported-version', `schemaVersion ${value.schemaVersion}`);
  }
  if (typeof value.checksum !== 'string') return fail('corrupt-save', 'record.checksum');
  if (!isInt(value.savedAt, 0, Number.MAX_SAFE_INTEGER)) {
    return fail('corrupt-save', 'record.savedAt');
  }
  if (!('payload' in value)) return fail('corrupt-save', 'record.payload');
  return ok({
    profileId: value.profileId,
    schemaVersion: value.schemaVersion,
    checksum: value.checksum,
    savedAt: value.savedAt,
    payload: value.payload,
  });
}
