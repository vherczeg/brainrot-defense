import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  checksumOf,
  parseProfileFromImport,
  serializeEnvelope,
} from '../../src/persistence/import-export/saveCodec';
import { IndexedDbProfileRepository } from '../../src/persistence/indexeddb/profileRepository';
import {
  CURRENT_SAVE_VERSION,
  migrateV1Profile,
  validateEnvelope,
  type StoredProfileRecord,
} from '../../src/persistence/schemas/saveSchema';
import { MAX_CHARACTER_XP } from '../../src/game/domain/progression';
import { profileWith, unit } from './testFixtures';

const DB_NAME = 'brainrot-defense';

function legacyProfile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    profileId: 'legacy-profile',
    name: 'Régi Ábel',
    coins: 777,
    currentWave: 4,
    unlockedWave: 5,
    completedWaves: [1, 2, 3],
    characters: [
      { id: 'unit-1', typeId: 'laser-crocodile', level: 7, col: 1, row: 4 },
      { id: 'unit-2', typeId: 'lightning-scorpion', level: 10, col: 4, row: 3 },
    ],
    upgrades: { laser: 2 },
    settings: { soundEnabled: false, reducedMotion: true, battleSpeed: 2 },
    tutorialSeen: true,
    nextCharacterId: 10,
    createdAt: 111,
    lastSavedAt: 222,
    ...overrides,
  };
}

function legacyEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    format: 'brainrot-defense-save',
    appId: 'brainrot-defense',
    schemaVersion: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    profile: legacyProfile(overrides),
  };
}

function openRawDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('profiles')) {
        db.createObjectStore('profiles', { keyPath: 'profileId' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putRawRecord(record: StoredProfileRecord): Promise<void> {
  const db = await openRawDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('profiles', 'readwrite');
    transaction.objectStore('profiles').put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function getRawRecord(profileId: string): Promise<StoredProfileRecord> {
  const db = await openRawDatabase();
  const record = await new Promise<StoredProfileRecord>((resolve, reject) => {
    const transaction = db.transaction('profiles', 'readonly');
    const request = transaction.objectStore('profiles').get(profileId);
    request.onsuccess = () => resolve(request.result as StoredProfileRecord);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return record;
}

async function putRawMeta(key: string, value: unknown): Promise<void> {
  const db = await openRawDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('meta', 'readwrite');
    transaction.objectStore('meta').put({ key, value });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function getRawMeta(key: string): Promise<unknown> {
  const db = await openRawDatabase();
  const record = await new Promise<{ key: string; value: unknown } | undefined>(
    (resolve, reject) => {
      const transaction = db.transaction('meta', 'readonly');
      const request = transaction.objectStore('meta').get(key);
      request.onsuccess = () =>
        resolve(request.result as { key: string; value: unknown } | undefined);
      request.onerror = () => reject(request.error);
    },
  );
  db.close();
  return record?.value;
}

async function databaseVersion(): Promise<number> {
  const db = await openRawDatabase();
  const version = db.version;
  db.close();
  return version;
}

function legacyStoredRecord(profile = legacyProfile()): StoredProfileRecord {
  return {
    profileId: profile.profileId as string,
    schemaVersion: 1,
    checksum: checksumOf(profile),
    savedAt: 222,
    payload: profile,
  };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('v1 -> v2 save migration', () => {
  it('migrates a valid M0.1 export and preserves all profile metadata', () => {
    const parsed = parseProfileFromImport(JSON.stringify(legacyEnvelope()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value.profileId).toBe('legacy-profile');
    expect(parsed.value.name).toBe('Régi Ábel');
    expect(parsed.value.coins).toBe(777);
    expect(parsed.value.currentWave).toBe(4);
    expect(parsed.value.unlockedWave).toBe(5);
    expect(parsed.value.completedWaves).toEqual([1, 2, 3]);
    expect(parsed.value.settings).toEqual({
      soundEnabled: false,
      reducedMotion: true,
      battleSpeed: 2,
    });
    expect(parsed.value.upgrades).toEqual({ laser: 2 });
    expect(parsed.value.tutorialSeen).toBe(true);
    expect(parsed.value.nextCharacterId).toBe(10);
    expect(parsed.value.createdAt).toBe(111);
    expect(parsed.value.lastSavedAt).toBe(222);
    expect(parsed.value.characters).toEqual([
      { id: 'unit-1', typeId: 'laser-crocodile', mergeRank: 7, totalXp: 0, col: 1, row: 4 },
      { id: 'unit-2', typeId: 'lightning-scorpion', mergeRank: 10, totalXp: 0, col: 4, row: 3 },
    ]);
  });

  it('maps every old merge level 1..10 to mergeRank and zero XP', () => {
    const characters = Array.from({ length: 10 }, (_, index) => ({
      id: `unit-${index + 1}`,
      typeId: 'laser-crocodile',
      level: index + 1,
      col: index % 6,
      row: 3 + Math.floor(index / 6),
    }));
    const parsed = validateEnvelope(
      legacyEnvelope({ characters, completedWaves: [], currentWave: 1, unlockedWave: 1 }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.profile.characters.map((character) => character.mergeRank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(parsed.value.profile.characters.every((character) => character.totalXp === 0)).toBe(
      true,
    );
  });

  it('never interprets the old level as character level or grants invented XP', () => {
    const migrated = migrateV1Profile(legacyProfile());
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.characters[0]?.totalXp).toBe(0);
    expect(migrated.value.characters[1]?.mergeRank).toBe(10);
    expect(
      migrated.value.characters.every((character) => character.totalXp < MAX_CHARACTER_XP),
    ).toBe(true);
  });

  it('strictly rejects v2-shaped characters behind a v1 schema marker', () => {
    const migrated = migrateV1Profile(legacyProfile());
    if (!migrated.ok) throw new Error('migration failed');
    expect(migrateV1Profile(migrated.value).ok).toBe(false);
    expect(
      parseProfileFromImport(
        JSON.stringify({
          ...legacyEnvelope(),
          profile: migrated.value,
        }),
      ).ok,
    ).toBe(false);
  });

  it('rejects malformed or unsupported old profiles without damage', () => {
    const cases = [
      legacyEnvelope({ name: '' }),
      legacyEnvelope({ coins: -1 }),
      legacyEnvelope({ completedWaves: [1, 3] }),
      legacyEnvelope({
        characters: [{ id: 'unit-1', typeId: 'laser-crocodile', level: 11, col: 1, row: 4 }],
      }),
      { ...legacyEnvelope(), schemaVersion: 0 },
      { ...legacyEnvelope(), schemaVersion: 3 },
      { ...legacyEnvelope(), appId: 'other' },
    ];
    for (const value of cases) {
      expect(parseProfileFromImport(JSON.stringify(value)).ok).toBe(false);
    }
  });

  it('rejects a v2 profile that contains only the legacy level field', () => {
    const parsed = parseProfileFromImport(
      JSON.stringify({
        ...legacyEnvelope(),
        schemaVersion: CURRENT_SAVE_VERSION,
      }),
    );
    expect(parsed.ok).toBe(false);
  });

  it('leaves an existing v2 profile unchanged', () => {
    const profile = profileWith([unit('unit-1', 'laser-crocodile', 3, 1, 4, 500)], {
      profileId: 'v2',
      name: 'Új',
    });
    const parsed = parseProfileFromImport(serializeEnvelope(profile));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual(profile);
  });
});

describe('IndexedDB legacy record migration', () => {
  it('loads and migrates a raw v1 stored record', async () => {
    const repository = new IndexedDbProfileRepository();
    const legacy = legacyStoredRecord();
    await putRawRecord(legacy);

    const loaded = await repository.loadProfile('legacy-profile');
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.name).toBe('Régi Ábel');
    expect(loaded.value.coins).toBe(777);
    expect(loaded.value.completedWaves).toEqual([1, 2, 3]);
    expect(loaded.value.characters.map((character) => character.mergeRank)).toEqual([7, 10]);
    expect(loaded.value.characters.every((character) => character.totalXp === 0)).toBe(true);
  });

  it('migrates once and then reloads the persisted v2 record without changes', async () => {
    const repository = new IndexedDbProfileRepository();
    await putRawRecord(legacyStoredRecord());

    const first = await repository.loadProfile('legacy-profile');
    if (!first.ok) throw new Error('first load failed');
    expect((await repository.saveProfile(first.value)).ok).toBe(true);
    const second = await repository.loadProfile('legacy-profile');
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value).toEqual(first.value);

    const raw = await getRawRecord('legacy-profile');
    expect(raw.schemaVersion).toBe(CURRENT_SAVE_VERSION);
  });

  it('recovers v2 data when a stale v1 record overwrites the profile record', async () => {
    const repository = new IndexedDbProfileRepository();
    const profile = profileWith([unit('unit-1', 'laser-crocodile', 4, 1, 4, 9000)], {
      profileId: 'stale-target',
      coins: 4321,
    });
    expect((await repository.saveProfile(profile)).ok).toBe(true);

    await putRawRecord({
      ...legacyStoredRecord({
        ...legacyProfile(),
        profileId: 'stale-target',
        coins: 1,
      }),
    });

    const loaded = await repository.loadProfile('stale-target');
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.coins).toBe(4321);
    expect(loaded.value.characters[0]?.mergeRank).toBe(4);
    expect(loaded.value.characters[0]?.totalXp).toBe(9000);
  });

  it('does not consume a player profile slot for an internal migration backup', async () => {
    const repository = new IndexedDbProfileRepository();
    const legacy = legacyStoredRecord();
    await putRawRecord(legacy);
    const loaded = await repository.loadProfile('legacy-profile');
    if (!loaded.ok) throw new Error('migration failed');

    const list = await repository.listProfiles();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value.filter((summary) => !summary.corrupt)).toHaveLength(1);
  });

  it('does not silently replace a corrupt legacy record', async () => {
    const repository = new IndexedDbProfileRepository();
    await putRawRecord({ ...legacyStoredRecord(), checksum: 'deadbeef' });
    const loaded = await repository.loadProfile('legacy-profile');
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error).toBe('corrupt-save');
  });

  it('refuses a newer schema version without writing', async () => {
    const repository = new IndexedDbProfileRepository();
    const profile = profileWith([], { profileId: 'future' });
    expect((await repository.saveProfile(profile)).ok).toBe(true);
    const raw = await getRawRecord('future');
    await putRawRecord({ ...raw, schemaVersion: 99 });
    const loaded = await repository.loadProfile('future');
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error).toBe('unsupported-version');
  });
});

describe('IndexedDB version strategy (F1)', () => {
  it('creates the database at version 1 so an old M0.1 tab cannot block it', async () => {
    const repository = new IndexedDbProfileRepository();
    const profile = profileWith([unit('unit-1', 'laser-crocodile', 1, 0, 3)], {
      profileId: 'version-check',
    });
    expect((await repository.saveProfile(profile)).ok).toBe(true);
    expect(await databaseVersion()).toBe(1);
  });
});

describe('strict v1 stored records (F8)', () => {
  it('rejects a v1 record whose characters already use the v2 shape', async () => {
    const repository = new IndexedDbProfileRepository();
    const v2Shaped = legacyProfile({
      characters: [
        {
          id: 'unit-1',
          typeId: 'laser-crocodile',
          mergeRank: 7,
          totalXp: 0,
          col: 1,
          row: 4,
        },
      ],
    });
    await putRawRecord({
      profileId: 'legacy-profile',
      schemaVersion: 1,
      checksum: checksumOf(v2Shaped),
      savedAt: 222,
      payload: v2Shaped,
    });
    const loaded = await repository.loadProfile('legacy-profile');
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error).toEqual('invalid-import');
  });
});

describe('deletion tombstones (F3)', () => {
  it('does not resurrect a deleted profile from a stale legacy record', async () => {
    const repository = new IndexedDbProfileRepository();
    const profile = profileWith([unit('unit-1', 'laser-crocodile', 2, 0, 3)], {
      profileId: 'deleted-target',
      coins: 500,
    });
    expect((await repository.saveProfileAndActivate(profile)).ok).toBe(true);
    expect((await repository.deleteProfile(profile.profileId)).ok).toBe(true);

    await putRawRecord(legacyStoredRecord({ ...legacyProfile(), profileId: 'deleted-target' }));

    expect(await repository.loadProfile('deleted-target')).toEqual({
      ok: false,
      error: 'not-found',
    });
    const list = await repository.listProfiles();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value.some((summary) => summary.profileId === 'deleted-target')).toBe(false);

    const staleAutosave = await repository.saveProfile(profile);
    expect(staleAutosave.ok).toBe(false);
  });

  it('does not let tombstoned stale records consume profile slots', async () => {
    const repository = new IndexedDbProfileRepository();
    for (let index = 1; index <= 3; index += 1) {
      const profile = profileWith([], {
        profileId: `slot-${index}`,
        name: `Slot ${index}`,
      });
      expect((await repository.saveProfileAndActivate(profile)).ok).toBe(true);
      expect((await repository.deleteProfile(profile.profileId)).ok).toBe(true);
      await putRawRecord(legacyStoredRecord({ ...legacyProfile(), profileId: profile.profileId }));
    }

    const fresh = profileWith([unit('unit-1', 'laser-crocodile', 1, 0, 3)], {
      profileId: 'fresh-slot',
      name: 'Friss',
    });
    expect((await repository.saveProfileAndActivate(fresh)).ok).toBe(true);
    expect(await repository.loadProfile('fresh-slot')).toMatchObject({ ok: true });
  });

  it('allows an explicit validated import to supersede a tombstone', async () => {
    const repository = new IndexedDbProfileRepository();
    const profile = profileWith([unit('unit-1', 'laser-crocodile', 2, 0, 3)], {
      profileId: 'resurrect-explicitly',
      coins: 900,
    });
    expect((await repository.saveProfileAndActivate(profile)).ok).toBe(true);
    expect((await repository.deleteProfile(profile.profileId)).ok).toBe(true);

    expect((await repository.saveProfileAndActivate(profile)).ok).toBe(true);
    const loaded = await repository.loadProfile(profile.profileId);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value).toEqual(profile);
  });
});

describe('missing migration shadow recovery (F4)', () => {
  it('re-migrates and repairs metadata when the marker points at the deterministic migration', async () => {
    const repository = new IndexedDbProfileRepository();
    const legacy = legacyStoredRecord();
    await putRawRecord(legacy);
    const migrated = migrateV1Profile(legacy.payload);
    if (!migrated.ok) throw new Error('migration failed');
    await putRawMeta('record-schema:legacy-profile', {
      schemaVersion: CURRENT_SAVE_VERSION,
      shadowChecksum: checksumOf(migrated.value),
    });
    await putRawMeta('backup:v1:legacy-profile', legacy);

    const loaded = await repository.loadProfile('legacy-profile');
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value).toEqual(migrated.value);

    const repairedShadow = (await getRawMeta('shadow:legacy-profile')) as StoredProfileRecord;
    expect(repairedShadow.schemaVersion).toBe(CURRENT_SAVE_VERSION);
    expect(repairedShadow.checksum).toBe(checksumOf(migrated.value));
    expect((await getRawRecord('legacy-profile')).schemaVersion).toBe(1);
  });

  it('recovers from a validated legacy backup when the main legacy payload is unusable', async () => {
    const repository = new IndexedDbProfileRepository();
    const backup = legacyStoredRecord();
    const migratedBackup = migrateV1Profile(backup.payload);
    if (!migratedBackup.ok) throw new Error('backup migration failed');
    const unusableMain = legacyProfile({
      characters: [
        {
          id: 'unit-1',
          typeId: 'laser-crocodile',
          mergeRank: 7,
          totalXp: 0,
          col: 1,
          row: 4,
        },
      ],
    });
    await putRawRecord({
      profileId: 'legacy-profile',
      schemaVersion: 1,
      checksum: checksumOf(unusableMain),
      savedAt: 222,
      payload: unusableMain,
    });
    await putRawMeta('record-schema:legacy-profile', {
      schemaVersion: CURRENT_SAVE_VERSION,
      shadowChecksum: checksumOf(migratedBackup.value),
    });
    await putRawMeta('backup:v1:legacy-profile', backup);

    const loaded = await repository.loadProfile('legacy-profile');
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value).toEqual(migratedBackup.value);
    expect((await getRawMeta('shadow:legacy-profile')) as StoredProfileRecord).toBeTruthy();
  });

  it('does not roll back newer v2 progress when the marker points at another record', async () => {
    const repository = new IndexedDbProfileRepository();
    const legacy = legacyStoredRecord();
    await putRawRecord(legacy);
    const newer = profileWith([unit('unit-1', 'laser-crocodile', 6, 0, 3, 9000)], {
      profileId: 'legacy-profile',
      coins: 9999,
    });
    await putRawMeta('record-schema:legacy-profile', {
      schemaVersion: CURRENT_SAVE_VERSION,
      shadowChecksum: checksumOf(newer),
    });
    await putRawMeta('backup:v1:legacy-profile', legacy);

    const loaded = await repository.loadProfile('legacy-profile');
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error).toBe('unsupported-version');
    expect((await getRawRecord('legacy-profile')).payload).toEqual(legacy.payload);
    expect(await getRawMeta('shadow:legacy-profile')).toBeUndefined();
  });

  it('fails safely for a legacy numeric marker with no shadow', async () => {
    const repository = new IndexedDbProfileRepository();
    const legacy = legacyStoredRecord();
    await putRawRecord(legacy);
    await putRawMeta('record-schema:legacy-profile', CURRENT_SAVE_VERSION);
    await putRawMeta('backup:v1:legacy-profile', legacy);

    const loaded = await repository.loadProfile('legacy-profile');
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error).toBe('unsupported-version');
    expect((await getRawRecord('legacy-profile')).payload).toEqual(legacy.payload);
  });
});
