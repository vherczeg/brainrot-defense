import { fail, ok, MAX_PROFILES, type PlayerProfile, type Result } from '../../game/domain/types';
import { checksumOf } from '../import-export/saveCodec';
import {
  CURRENT_SAVE_VERSION,
  validateProfile,
  validateStoredRecord,
  type StoredProfileRecord,
} from '../schemas/saveSchema';

const DB_NAME = 'brainrot-defense';
const DB_VERSION = 1;
const PROFILE_STORE = 'profiles';
const META_STORE = 'meta';
const ACTIVE_PROFILE_KEY = 'activeProfileId';

export interface ProfileSummary {
  readonly profileId: string;
  readonly name: string;
  readonly currentWave: number;
  readonly coins: number;
  readonly lastSavedAt: number;
  readonly createdAt: number;
  readonly corrupt: boolean;
}

export interface ProfileRepository {
  listProfiles(): Promise<Result<readonly ProfileSummary[]>>;
  loadProfile(profileId: string): Promise<Result<PlayerProfile>>;
  saveProfile(profile: PlayerProfile): Promise<Result<void>>;
  saveProfileAndActivate(profile: PlayerProfile): Promise<Result<void>>;
  deleteProfile(profileId: string): Promise<Result<void>>;
  getActiveProfileId(): Promise<Result<string | null>>;
  setActiveProfileId(profileId: string | null): Promise<Result<void>>;
  requestPersistence(): Promise<boolean>;
}

interface MetaRecord {
  readonly key: string;
  readonly value: unknown;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function recordFor(profile: PlayerProfile): StoredProfileRecord {
  return {
    profileId: profile.profileId,
    schemaVersion: CURRENT_SAVE_VERSION,
    checksum: checksumOf(profile),
    savedAt: Date.now(),
    payload: profile,
  };
}

export class IndexedDbProfileRepository implements ProfileRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDatabase(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is unavailable'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PROFILE_STORE)) {
          db.createObjectStore(PROFILE_STORE, { keyPath: 'profileId' });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
      request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked'));
    });
    return this.dbPromise;
  }

  async listProfiles(): Promise<Result<readonly ProfileSummary[]>> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(PROFILE_STORE, 'readonly');
      const records = await requestToPromise(
        transaction.objectStore(PROFILE_STORE).getAll() as IDBRequest<unknown[]>,
      );
      await transactionToPromise(transaction);
      const summaries: ProfileSummary[] = records.map((record) => {
        const stored = validateStoredRecord(record);
        if (stored.ok && checksumOf(stored.value.payload) === stored.value.checksum) {
          const parsed = validateProfile(stored.value.payload);
          if (parsed.ok) {
            return {
              profileId: parsed.value.profileId,
              name: parsed.value.name,
              currentWave: parsed.value.currentWave,
              coins: parsed.value.coins,
              lastSavedAt: parsed.value.lastSavedAt,
              createdAt: parsed.value.createdAt,
              corrupt: false,
            };
          }
        }
        const fallback = record as { profileId?: unknown };
        return {
          profileId: typeof fallback.profileId === 'string' ? fallback.profileId : 'ismeretlen',
          name: '',
          currentWave: 1,
          coins: 0,
          lastSavedAt: 0,
          createdAt: 0,
          corrupt: true,
        };
      });
      summaries.sort((a, b) => a.createdAt - b.createdAt);
      return ok(summaries);
    } catch {
      return fail('storage-unavailable');
    }
  }

  async loadProfile(profileId: string): Promise<Result<PlayerProfile>> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(PROFILE_STORE, 'readonly');
      const record = await requestToPromise(
        transaction.objectStore(PROFILE_STORE).get(profileId) as IDBRequest<unknown>,
      );
      await transactionToPromise(transaction);
      if (!record) return fail('not-found');

      const stored = validateStoredRecord(record);
      if (!stored.ok) return stored;
      if (stored.value.schemaVersion !== CURRENT_SAVE_VERSION) {
        return fail('unsupported-version', `schemaVersion ${stored.value.schemaVersion}`);
      }
      if (checksumOf(stored.value.payload) !== stored.value.checksum) {
        return fail('corrupt-save', 'checksum');
      }
      const profile = validateProfile(stored.value.payload);
      if (!profile.ok) return profile;
      if (profile.value.profileId !== profileId) {
        return fail('corrupt-save', 'profileId-mismatch');
      }
      return ok(profile.value);
    } catch {
      return fail('storage-unavailable');
    }
  }

  async saveProfile(profile: PlayerProfile): Promise<Result<void>> {
    const validation = validateProfile(profile);
    if (!validation.ok) return validation;
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(PROFILE_STORE, 'readwrite');
      transaction.objectStore(PROFILE_STORE).put(recordFor(validation.value));
      await transactionToPromise(transaction);
      return ok(undefined);
    } catch {
      return fail('save-failed');
    }
  }

  async saveProfileAndActivate(profile: PlayerProfile): Promise<Result<void>> {
    const validation = validateProfile(profile);
    if (!validation.ok) return validation;
    try {
      const db = await this.openDatabase();
      const record = recordFor(validation.value);
      const transaction = db.transaction([PROFILE_STORE, META_STORE], 'readwrite');
      const profileStore = transaction.objectStore(PROFILE_STORE);
      const keys = await requestToPromise(profileStore.getAllKeys());
      if (!keys.includes(validation.value.profileId) && keys.length >= MAX_PROFILES) {
        await transactionToPromise(transaction);
        return fail('profile-limit');
      }
      profileStore.put(record);
      transaction.objectStore(META_STORE).put({
        key: ACTIVE_PROFILE_KEY,
        value: validation.value.profileId,
      } satisfies MetaRecord);
      await transactionToPromise(transaction);
      return ok(undefined);
    } catch {
      return fail('save-failed');
    }
  }

  async deleteProfile(profileId: string): Promise<Result<void>> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction([PROFILE_STORE, META_STORE], 'readwrite');
      transaction.objectStore(PROFILE_STORE).delete(profileId);
      const metaStore = transaction.objectStore(META_STORE);
      const active = await requestToPromise(
        metaStore.get(ACTIVE_PROFILE_KEY) as IDBRequest<MetaRecord | undefined>,
      );
      if (active?.value === profileId) {
        metaStore.delete(ACTIVE_PROFILE_KEY);
      }
      await transactionToPromise(transaction);
      return ok(undefined);
    } catch {
      return fail('save-failed');
    }
  }

  async getActiveProfileId(): Promise<Result<string | null>> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(META_STORE, 'readonly');
      const record = await requestToPromise(
        transaction.objectStore(META_STORE).get(ACTIVE_PROFILE_KEY) as IDBRequest<
          MetaRecord | undefined
        >,
      );
      await transactionToPromise(transaction);
      if (!record) return ok(null);
      return ok(typeof record.value === 'string' ? record.value : null);
    } catch {
      return fail('storage-unavailable');
    }
  }

  async setActiveProfileId(profileId: string | null): Promise<Result<void>> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction(META_STORE, 'readwrite');
      const store = transaction.objectStore(META_STORE);
      if (profileId === null) {
        store.delete(ACTIVE_PROFILE_KEY);
      } else {
        const record: MetaRecord = { key: ACTIVE_PROFILE_KEY, value: profileId };
        store.put(record);
      }
      await transactionToPromise(transaction);
      return ok(undefined);
    } catch {
      return fail('save-failed');
    }
  }

  async requestPersistence(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
}
