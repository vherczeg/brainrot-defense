import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  checksumOf,
  parseProfileFromImport,
  serializeEnvelope,
} from '../../src/persistence/import-export/saveCodec';
import { IndexedDbProfileRepository } from '../../src/persistence/indexeddb/profileRepository';
import { createEnvelope, type StoredProfileRecord } from '../../src/persistence/schemas/saveSchema';
import { TOTAL_WAVES } from '../../src/game/domain/types';
import { profileWith, unit } from './testFixtures';

const DB_NAME = 'brainrot-defense';

function openRawDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
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

function completeProfile() {
  return profileWith(
    [
      unit('unit-1', 'laser-crocodile', 3, 1, 4, 3025),
      unit('unit-2', 'lightning-scorpion', 2, 4, 3, 1225),
    ],
    {
      profileId: 'profile-one',
      name: 'Ábel',
      coins: 777,
      currentWave: 4,
      unlockedWave: 5,
      completedWaves: [1, 2, 3],
      tutorialSeen: true,
      upgrades: { laser: 2 },
      defeatXpCounts: Array.from({ length: TOTAL_WAVES }, (_, index) =>
        index === 0 ? 1 : index === 9 ? 2 : 0,
      ),
      settings: { soundEnabled: false, reducedMotion: true, battleSpeed: 2, difficulty: 'normal' },
    },
  );
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('IndexedDB save repository', () => {
  it('round-trips the important profile state', async () => {
    const repository = new IndexedDbProfileRepository();
    const profile = completeProfile();
    const saved = await repository.saveProfile(profile);
    expect(saved.ok).toBe(true);

    const loaded = await repository.loadProfile(profile.profileId);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value).toEqual(profile);
    expect(loaded.value.coins).toBe(777);
    expect(loaded.value.currentWave).toBe(4);
    expect(loaded.value.unlockedWave).toBe(5);
    expect(loaded.value.completedWaves).toEqual([1, 2, 3]);
    expect(loaded.value.characters.map((character) => character.mergeRank)).toEqual([3, 2]);
    expect(loaded.value.characters.map((character) => character.totalXp)).toEqual([3025, 1225]);
    expect(loaded.value.characters.map((character) => `${character.col},${character.row}`)).toEqual(
      ['1,4', '4,3'],
    );
    expect(loaded.value.settings.battleSpeed).toBe(2);
    expect(loaded.value.defeatXpCounts[0]).toBe(1);
    expect(loaded.value.defeatXpCounts[9]).toBe(2);
  });

  it('keeps separate profiles isolated', async () => {
    const repository = new IndexedDbProfileRepository();
    const first = profileWith([], {
      profileId: 'first',
      name: 'Első',
      coins: 100,
      currentWave: 1,
    });
    const second = profileWith([], {
      profileId: 'second',
      name: 'Második',
      coins: 900,
      currentWave: 7,
      unlockedWave: 7,
      completedWaves: [1, 2, 3, 4, 5, 6],
    });
    expect((await repository.saveProfile(first)).ok).toBe(true);
    expect((await repository.saveProfile(second)).ok).toBe(true);

    const loadedFirst = await repository.loadProfile('first');
    const loadedSecond = await repository.loadProfile('second');
    expect(loadedFirst.ok && loadedFirst.value.coins).toBe(100);
    expect(loadedSecond.ok && loadedSecond.value.coins).toBe(900);

    const list = await repository.listProfiles();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value).toHaveLength(2);
  });

  it('stores and restores the active profile id', async () => {
    const repository = new IndexedDbProfileRepository();
    expect(await repository.setActiveProfileId('abc')).toEqual({ ok: true, value: undefined });
    expect(await repository.getActiveProfileId()).toEqual({ ok: true, value: 'abc' });
    expect(await repository.setActiveProfileId(null)).toEqual({ ok: true, value: undefined });
    expect(await repository.getActiveProfileId()).toEqual({ ok: true, value: null });
  });

  it('saves the profile and active profile id in one operation', async () => {
    const repository = new IndexedDbProfileRepository();
    const profile = completeProfile();
    expect((await repository.saveProfileAndActivate(profile)).ok).toBe(true);

    const loaded = await repository.loadProfile(profile.profileId);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value).toEqual(profile);
    expect(await repository.getActiveProfileId()).toEqual({ ok: true, value: profile.profileId });
  });

  it('deletes a profile', async () => {
    const repository = new IndexedDbProfileRepository();
    const profile = completeProfile();
    await repository.saveProfile(profile);
    await repository.setActiveProfileId(profile.profileId);
    const deleted = await repository.deleteProfile(profile.profileId);
    expect(deleted.ok).toBe(true);
    expect((await repository.loadProfile(profile.profileId)).ok).toBe(false);
    expect(await repository.getActiveProfileId()).toEqual({ ok: true, value: null });
  });

  it('retries a failed database open instead of caching the rejection', async () => {
    const factory = new IDBFactory();
    globalThis.indexedDB = factory;
    const originalOpen = factory.open.bind(factory);
    let failNext = true;
    factory.open = ((...args: Parameters<IDBFactory['open']>): IDBOpenDBRequest => {
      if (failNext) {
        failNext = false;
        throw new Error('temporary open failure');
      }
      return originalOpen(...args);
    }) as IDBFactory['open'];

    const repository = new IndexedDbProfileRepository();
    const first = await repository.loadProfile('missing');
    expect(first.ok).toBe(false);
    if (first.ok) return;
    expect(first.error).toBe('storage-unavailable');

    const profile = completeProfile();
    expect((await repository.saveProfile(profile)).ok).toBe(true);
    expect((await repository.loadProfile(profile.profileId)).ok).toBe(true);
  });

  it('rejects an unsupported stored save version safely', async () => {
    const repository = new IndexedDbProfileRepository();
    const profile = completeProfile();
    await repository.saveProfile(profile);
    const raw = await getRawRecord(profile.profileId);
    await putRawRecord({ ...raw, schemaVersion: 99 });
    const loaded = await repository.loadProfile(profile.profileId);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error).toBe('unsupported-version');
  });

  it('detects checksum corruption and does not reset silently', async () => {
    const repository = new IndexedDbProfileRepository();
    const profile = completeProfile();
    await repository.saveProfile(profile);
    const raw = await getRawRecord(profile.profileId);
    const payload = structuredClone(raw.payload) as Record<string, unknown>;
    payload.coins = 999_999;
    await putRawRecord({ ...raw, payload });
    const loaded = await repository.loadProfile(profile.profileId);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error).toBe('corrupt-save');
    const stillStored = await repository.loadProfile(profile.profileId);
    expect(stillStored.ok).toBe(false);
  });

  it('does not overwrite an existing valid save with an invalid transaction', async () => {
    const repository = new IndexedDbProfileRepository();
    const valid = completeProfile();
    await repository.saveProfile(valid);

    const invalid = {
      ...valid,
      characters: [
        unit('unit-1', 'laser-crocodile', 1, 2, 4),
        unit('unit-2', 'laser-crocodile', 1, 2, 4),
      ],
    };
    const failed = await repository.saveProfile(invalid);
    expect(failed.ok).toBe(false);

    const loaded = await repository.loadProfile(valid.profileId);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value).toEqual(valid);
  });

  it('reports a missing profile as not-found', async () => {
    const repository = new IndexedDbProfileRepository();
    const loaded = await repository.loadProfile('missing');
    expect(loaded).toEqual({ ok: false, error: 'not-found' });
  });

  it('survives a database open after an initial corrupt save', async () => {
    const repository = new IndexedDbProfileRepository();
    const profile = completeProfile();
    await repository.saveProfile(profile);
    const raw = await getRawRecord(profile.profileId);
    await putRawRecord({
      ...raw,
      checksum: 'deadbeef',
    });
    const list = await repository.listProfiles();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value[0]?.corrupt).toBe(true);
  });
});

describe('save import validation', () => {
  it('exports a valid envelope that can be imported again', () => {
    const profile = completeProfile();
    const text = serializeEnvelope(profile);
    const parsed = parseProfileFromImport(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual(profile);
    expect(parsed.value.defeatXpCounts[0]).toBe(1);
    expect(parsed.value.defeatXpCounts[9]).toBe(2);
  });

  it('rejects malformed JSON without throwing', () => {
    expect(parseProfileFromImport('{not json')).toEqual({
      ok: false,
      error: 'invalid-import',
      detail: 'json',
    });
  });

  it('rejects unsupported versions', () => {
    const profile = completeProfile();
    const envelope = {
      ...createEnvelope(profile),
      schemaVersion: 5,
    };
    const parsed = parseProfileFromImport(JSON.stringify(envelope));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toBe('unsupported-version');
  });

  it('rejects invalid field values and bounds', () => {
    const profile = completeProfile();
    const envelope = createEnvelope(profile);
    const cases = [
      { ...envelope, profile: { ...profile, coins: -1 } },
      { ...envelope, profile: { ...profile, coins: 10.5 } },
      { ...envelope, profile: { ...profile, name: '' } },
      { ...envelope, profile: { ...profile, currentWave: 11 } },
      { ...envelope, profile: { ...profile, unlockedWave: 0 } },
      {
        ...envelope,
        profile: {
          ...profile,
          characters: [unit('unit-1', 'laser-crocodile', 11, 1, 4)],
        },
      },
      {
        ...envelope,
        profile: {
          ...profile,
          characters: [unit('unit-1', 'laser-crocodile', 1, 1, 0)],
        },
      },
      {
        ...envelope,
        profile: {
          ...profile,
          characters: [
            unit('unit-1', 'laser-crocodile', 1, 1, 4),
            unit('unit-1', 'laser-crocodile', 1, 2, 4),
          ],
        },
      },
      { ...envelope, profile: { ...profile, settings: { ...profile.settings, battleSpeed: 3 } } },
      { ...envelope, schemaVersion: 0 },
      { ...envelope, appId: 'other-game' },
    ];
    for (const value of cases) {
      expect(parseProfileFromImport(JSON.stringify(value)).ok).toBe(false);
    }
  });

  it('rejects unknown character types', () => {
    const profile = completeProfile();
    const envelope = createEnvelope(profile);
    const parsed = parseProfileFromImport(
      JSON.stringify({
        ...envelope,
        profile: {
          ...profile,
          characters: [
            {
              id: 'unit-1',
              typeId: 'infinite-money-croc',
              mergeRank: 1,
              totalXp: 0,
              col: 1,
              row: 4,
            },
          ],
        },
      }),
    );
    expect(parsed.ok).toBe(false);
  });

  it('recomputes a stable checksum', () => {
    const profile = completeProfile();
    expect(checksumOf(profile)).toBe(checksumOf(structuredClone(profile)));
    expect(checksumOf({ value: 1 })).not.toBe(checksumOf({ value: 2 }));
  });

  it('keeps the existing profile untouched when an import fails', async () => {
    const repository = new IndexedDbProfileRepository();
    const profile = completeProfile();
    await repository.saveProfile(profile);
    const invalid = parseProfileFromImport('{"appId":"brainrot-defense"}');
    expect(invalid.ok).toBe(false);
    const loaded = await repository.loadProfile(profile.profileId);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value).toEqual(profile);
  });
});

describe('profile limit enforcement', () => {
  it('rejects a new profile when three already exist but allows updating an existing one', async () => {
    const repository = new IndexedDbProfileRepository();
    for (let index = 1; index <= 3; index += 1) {
      const profile = profileWith([], {
        profileId: `limit-${index}`,
        name: `Játékos ${index}`,
        currentWave: 1,
      });
      expect((await repository.saveProfileAndActivate(profile)).ok).toBe(true);
    }
    const fourth = profileWith([], {
      profileId: 'limit-4',
      name: 'Negyedik',
      currentWave: 1,
    });
    const rejected = await repository.saveProfileAndActivate(fourth);
    expect(rejected).toEqual({ ok: false, error: 'profile-limit' });

    const existing = profileWith([], {
      profileId: 'limit-1',
      name: 'Átnevezett',
      currentWave: 1,
    });
    expect((await repository.saveProfileAndActivate(existing)).ok).toBe(true);
  });
});
