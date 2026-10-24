import { fail, ok, MAX_PROFILES, type PlayerProfile, type Result } from '../../game/domain/types';
import { checksumOf } from '../import-export/saveCodec';
import {
  CURRENT_SAVE_VERSION,
  LEGACY_SAVE_VERSION,
  migrateV1Profile,
  validateLegacyProfileV1,
  validateProfile,
  validateStoredRecord,
  type StoredProfileRecord,
} from '../schemas/saveSchema';

const DB_NAME = 'brainrot-defense';
const PROFILE_STORE = 'profiles';
const META_STORE = 'meta';
const ACTIVE_PROFILE_KEY = 'activeProfileId';
const SHADOW_PREFIX = 'shadow:';
const BACKUP_PREFIX = 'backup:v1:';
const RECORD_SCHEMA_PREFIX = 'record-schema:';
const DELETED_PREFIX = 'deleted:';

function shadowKey(profileId: string): string {
  return `${SHADOW_PREFIX}${profileId}`;
}

function backupKey(profileId: string): string {
  return `${BACKUP_PREFIX}${profileId}`;
}

function recordSchemaKey(profileId: string): string {
  return `${RECORD_SCHEMA_PREFIX}${profileId}`;
}

function deletedKey(profileId: string): string {
  return `${DELETED_PREFIX}${profileId}`;
}

interface RecordSchemaMarker {
  readonly schemaVersion: number;
  readonly shadowChecksum?: string;
  readonly backupChecksum?: string;
  readonly migratedAt?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRecordSchemaMarker(value: unknown): RecordSchemaMarker | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1) {
    return { schemaVersion: value };
  }
  if (!isRecord(value)) return null;
  const schemaVersion = value.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    return null;
  }
  return {
    schemaVersion,
    ...(typeof value.shadowChecksum === 'string' ? { shadowChecksum: value.shadowChecksum } : {}),
    ...(typeof value.backupChecksum === 'string' ? { backupChecksum: value.backupChecksum } : {}),
    ...(typeof value.migratedAt === 'number' ? { migratedAt: value.migratedAt } : {}),
  };
}

function markerFor(record: StoredProfileRecord, backupChecksum?: string): RecordSchemaMarker {
  return {
    schemaVersion: CURRENT_SAVE_VERSION,
    shadowChecksum: record.checksum,
    ...(backupChecksum === undefined ? {} : { backupChecksum }),
    migratedAt: Date.now(),
  };
}

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

interface ResolvedStoredProfile {
  readonly profile: PlayerProfile;
  readonly migratedFromLegacy: boolean;
}

function migrateLegacySafely(
  payload: unknown,
  markerInfo: RecordSchemaMarker,
  profileId: string,
): PlayerProfile | null {
  if (markerInfo.shadowChecksum === undefined) return null;
  const legacy = validateLegacyProfileV1(payload);
  if (!legacy.ok) return null;
  const migrated = migrateV1Profile(payload);
  if (!migrated.ok || migrated.value.profileId !== profileId) return null;
  return markerInfo.shadowChecksum === checksumOf(migrated.value) ? migrated.value : null;
}

function resolveStoredProfile(
  stored: StoredProfileRecord,
  profileId: string,
  marker: unknown,
  shadow: unknown,
  backup: unknown,
): Result<ResolvedStoredProfile> {
  if (checksumOf(stored.payload) !== stored.checksum) {
    return fail('corrupt-save', 'checksum');
  }

  if (stored.schemaVersion === CURRENT_SAVE_VERSION) {
    const profile = validateProfile(stored.payload);
    if (!profile.ok) return profile;
    if (profile.value.profileId !== profileId) {
      return fail('corrupt-save', 'profileId-mismatch');
    }
    return ok({ profile: profile.value, migratedFromLegacy: false });
  }

  if (stored.schemaVersion > CURRENT_SAVE_VERSION) {
    return fail('unsupported-version', `schemaVersion ${stored.schemaVersion}`);
  }

  if (stored.schemaVersion === LEGACY_SAVE_VERSION) {
    const markerInfo = parseRecordSchemaMarker(marker);
    if (markerInfo && markerInfo.schemaVersion >= CURRENT_SAVE_VERSION) {
      const shadowRecord = validateStoredRecord(shadow);
      if (
        shadowRecord.ok &&
        shadowRecord.value.schemaVersion === CURRENT_SAVE_VERSION &&
        checksumOf(shadowRecord.value.payload) === shadowRecord.value.checksum &&
        (markerInfo.shadowChecksum === undefined ||
          markerInfo.shadowChecksum === shadowRecord.value.checksum)
      ) {
        const shadowProfile = validateProfile(shadowRecord.value.payload);
        if (shadowProfile.ok && shadowProfile.value.profileId === profileId) {
          return ok({ profile: shadowProfile.value, migratedFromLegacy: false });
        }
      }

      // The marker can point at the deterministic migration result. If the shadow is missing but
      // the stored v1 record (or a validated backup) still produces exactly that record, the
      // migration was merely incomplete and can be repaired without rolling back any newer v2
      // progress. A marker that points at any other record proves newer progress existed, so
      // recovery is not safe.
      const fromMain = migrateLegacySafely(stored.payload, markerInfo, profileId);
      if (fromMain) return ok({ profile: fromMain, migratedFromLegacy: true });

      const backupRecord = validateStoredRecord(backup);
      if (
        backupRecord.ok &&
        backupRecord.value.schemaVersion === LEGACY_SAVE_VERSION &&
        checksumOf(backupRecord.value.payload) === backupRecord.value.checksum
      ) {
        const fromBackup = migrateLegacySafely(backupRecord.value.payload, markerInfo, profileId);
        if (fromBackup) return ok({ profile: fromBackup, migratedFromLegacy: true });
      }
      return fail('unsupported-version', 'stale-v1-record');
    }

    const legacy = validateLegacyProfileV1(stored.payload);
    if (!legacy.ok) return legacy;
    const migrated = migrateV1Profile(stored.payload);
    if (!migrated.ok) return migrated;
    if (migrated.value.profileId !== profileId) {
      return fail('corrupt-save', 'profileId-mismatch');
    }
    return ok({ profile: migrated.value, migratedFromLegacy: true });
  }

  return fail('unsupported-version', `schemaVersion ${stored.schemaVersion}`);
}

export class IndexedDbProfileRepository implements ProfileRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDatabase(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    const promise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is unavailable'));
        return;
      }
      // M1.1 only changes the *record* schema, not the IndexedDB structure. Opening without an
      // explicit version creates new databases at version 1 and opens existing v1/v2 databases
      // without requesting an upgrade. An old M0.1 tab therefore cannot block this open, and the
      // app cannot fall back to an ephemeral profile while a valid save exists.
      const request = indexedDB.open(DB_NAME);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PROFILE_STORE)) {
          db.createObjectStore(PROFILE_STORE, { keyPath: 'profileId' });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const forget = () => {
          if (this.dbPromise === promise) this.dbPromise = null;
        };
        db.onversionchange = () => {
          db.close();
          forget();
        };
        db.onclose = forget;
        resolve(db);
      };
      request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
      request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked'));
    });
    this.dbPromise = promise;
    // A blocked/failed open must not poison every later retry.
    promise.catch(() => {
      if (this.dbPromise === promise) this.dbPromise = null;
    });
    return promise;
  }

  async listProfiles(): Promise<Result<readonly ProfileSummary[]>> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction([PROFILE_STORE, META_STORE], 'readonly');
      const records = await requestToPromise(
        transaction.objectStore(PROFILE_STORE).getAll() as IDBRequest<unknown[]>,
      );
      const metaRecords = await requestToPromise(
        transaction.objectStore(META_STORE).getAll() as IDBRequest<MetaRecord[]>,
      );
      await transactionToPromise(transaction);
      const meta = new Map(metaRecords.map((entry) => [entry.key, entry.value]));
      const deletedIds = new Set(
        metaRecords
          .filter((entry) => entry.key.startsWith(DELETED_PREFIX))
          .map((entry) => entry.key.slice(DELETED_PREFIX.length)),
      );
      const summaries: ProfileSummary[] = records
        .filter((record) => {
          const candidate = record as { profileId?: unknown };
          return !(typeof candidate.profileId === 'string' && deletedIds.has(candidate.profileId));
        })
        .map((record) => {
          const stored = validateStoredRecord(record);
          if (stored.ok) {
            const resolved = resolveStoredProfile(
              stored.value,
              stored.value.profileId,
              meta.get(recordSchemaKey(stored.value.profileId)),
              meta.get(shadowKey(stored.value.profileId)),
              meta.get(backupKey(stored.value.profileId)),
            );
            if (resolved.ok) {
              return {
                profileId: resolved.value.profile.profileId,
                name: resolved.value.profile.name,
                currentWave: resolved.value.profile.currentWave,
                coins: resolved.value.profile.coins,
                lastSavedAt: resolved.value.profile.lastSavedAt,
                createdAt: resolved.value.profile.createdAt,
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
    } catch (error) {
      return fail(
        'storage-unavailable',
        error instanceof Error && error.message.includes('blocked') ? 'upgrade-blocked' : undefined,
      );
    }
  }

  async loadProfile(profileId: string): Promise<Result<PlayerProfile>> {
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction([PROFILE_STORE, META_STORE], 'readonly');
      const metaStore = transaction.objectStore(META_STORE);
      const record = await requestToPromise(
        transaction.objectStore(PROFILE_STORE).get(profileId) as IDBRequest<unknown>,
      );
      const marker = await requestToPromise(
        metaStore.get(recordSchemaKey(profileId)) as IDBRequest<MetaRecord | undefined>,
      );
      const shadow = await requestToPromise(
        metaStore.get(shadowKey(profileId)) as IDBRequest<MetaRecord | undefined>,
      );
      const backup = await requestToPromise(
        metaStore.get(backupKey(profileId)) as IDBRequest<MetaRecord | undefined>,
      );
      const tombstone = await requestToPromise(
        metaStore.get(deletedKey(profileId)) as IDBRequest<MetaRecord | undefined>,
      );
      await transactionToPromise(transaction);
      if (tombstone) return fail('not-found');
      if (!record) return fail('not-found');

      const stored = validateStoredRecord(record);
      if (!stored.ok) return stored;
      const resolved = resolveStoredProfile(
        stored.value,
        profileId,
        marker?.value,
        shadow?.value,
        backup?.value,
      );
      if (!resolved.ok) return resolved;
      if (resolved.value.migratedFromLegacy) {
        await this.writeMigrationArtifacts(db, stored.value, resolved.value.profile);
      }
      return ok(resolved.value.profile);
    } catch {
      return fail('storage-unavailable');
    }
  }

  private async writeMigrationArtifacts(
    db: IDBDatabase,
    legacyRecord: StoredProfileRecord,
    profile: PlayerProfile,
  ): Promise<void> {
    try {
      const transaction = db.transaction(META_STORE, 'readwrite');
      const store = transaction.objectStore(META_STORE);
      const existingBackup = await requestToPromise(
        store.get(backupKey(profile.profileId)) as IDBRequest<MetaRecord | undefined>,
      );
      if (!existingBackup) {
        store.put({ key: backupKey(profile.profileId), value: legacyRecord } satisfies MetaRecord);
      }
      const currentRecord = recordFor(profile);
      store.put({ key: shadowKey(profile.profileId), value: currentRecord } satisfies MetaRecord);
      store.put({
        key: recordSchemaKey(profile.profileId),
        value: markerFor(currentRecord, legacyRecord.checksum),
      } satisfies MetaRecord);
      await transactionToPromise(transaction);
    } catch {
      // A failed best-effort backup must not prevent loading the migrated profile.
    }
  }

  async saveProfile(profile: PlayerProfile): Promise<Result<void>> {
    const validation = validateProfile(profile);
    if (!validation.ok) return validation;
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction([PROFILE_STORE, META_STORE], 'readwrite');
      const record = recordFor(validation.value);
      const metaStore = transaction.objectStore(META_STORE);
      const tombstone = await requestToPromise(
        metaStore.get(deletedKey(record.profileId)) as IDBRequest<MetaRecord | undefined>,
      );
      if (tombstone) {
        await transactionToPromise(transaction);
        return fail('not-found');
      }
      transaction.objectStore(PROFILE_STORE).put(record);
      metaStore.put({ key: shadowKey(record.profileId), value: record } satisfies MetaRecord);
      metaStore.put({
        key: recordSchemaKey(record.profileId),
        value: markerFor(record),
      } satisfies MetaRecord);
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
      const metaStore = transaction.objectStore(META_STORE);
      const keys = await requestToPromise(profileStore.getAllKeys());
      const metaKeys = await requestToPromise(metaStore.getAllKeys());
      const deletedIds = new Set(
        metaKeys
          .filter((key): key is string => typeof key === 'string' && key.startsWith(DELETED_PREFIX))
          .map((key) => key.slice(DELETED_PREFIX.length)),
      );
      const liveKeys = keys.filter((key) => !deletedIds.has(String(key)));
      if (!keys.includes(validation.value.profileId) && liveKeys.length >= MAX_PROFILES) {
        await transactionToPromise(transaction);
        return fail('profile-limit');
      }
      profileStore.put(record);
      // Creation, import, and explicit profile creation are the only operations allowed to
      // supersede a deletion tombstone.
      metaStore.delete(deletedKey(record.profileId));
      metaStore.put({ key: shadowKey(record.profileId), value: record } satisfies MetaRecord);
      metaStore.put({
        key: recordSchemaKey(record.profileId),
        value: markerFor(record),
      } satisfies MetaRecord);
      metaStore.put({
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
      metaStore.put({
        key: deletedKey(profileId),
        value: { deletedAt: Date.now() },
      } satisfies MetaRecord);
      metaStore.delete(shadowKey(profileId));
      metaStore.delete(backupKey(profileId));
      metaStore.delete(recordSchemaKey(profileId));
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
