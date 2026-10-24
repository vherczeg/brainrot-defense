# Save schema and migration strategy

## Storage layout

IndexedDB database: `brainrot-defense`.

M1.1 only changes the **record** schema. The IndexedDB structure is unchanged from M0.1, so the app
opens the database without requesting a version upgrade. New databases are created at version 1;
an existing M0.1 (version 1) or an experimental M1.1 (version 2) database opens without an upgrade.
This is deliberate: an old M0.1 tab holding a version-1 connection must not be able to block the
M1.1 app and make it fall back to an ephemeral in-memory profile.

| Object store | Key path    | Purpose                                    |
| ------------ | ----------- | ------------------------------------------ |
| `profiles`   | `profileId` | One atomic record per local player profile |
| `meta`       | `key`       | App metadata and migration safety records  |

`meta` stores:

- `activeProfileId`;
- `shadow:<profileId>` — latest validated v2 record used to recover from a stale v1 tab;
- `record-schema:<profileId>` — marker object for the highest schema version successfully stored
  for that profile, including the expected shadow checksum;
- `backup:v1:<profileId>` — first legacy record kept as a recoverable migration backup;
- `deleted:<profileId>` — durable deletion tombstone. It prevents a stale old-format record from
  resurrecting a deleted profile. Only an explicit, validated create/import clears it.

These internal keys do not consume any of the three player-profile slots.

There is no backend and no cloud synchronization. Each browser profile has its own local data.

## Stored profile record (current schema version 2)

```ts
interface StoredProfileRecord {
  profileId: string;
  schemaVersion: 2;
  checksum: string;
  savedAt: number;
  payload: PlayerProfile;
}
```

- The checksum is a 32-bit FNV-1a hash of `JSON.stringify(payload)`, rendered as 8 hex chars.
- Load order: check the deletion tombstone → validate record shape → check supported version →
  recompute checksum → validate or migrate the payload → validate the final v2 profile → verify
  `payload.profileId === record.profileId`.
- Writes validate the profile **before** opening the read/write transaction. A failed validation
  leaves the previous valid record untouched.
- A single transaction writes the profile record, its shadow copy, and its schema marker. There is
  no partially committed profile.
- `saveProfileAndActivate` additionally writes `activeProfileId` in the same transaction.

## Player profile

```ts
interface PlayerProfile {
  profileId: string; // safe id: [a-zA-Z0-9_-], <= 80 chars
  name: string; // trimmed, 1..24 chars
  coins: number; // integer, 0..1_000_000_000
  currentWave: number; // integer, 1..10
  unlockedWave: number; // integer, 1..10, >= currentWave
  completedWaves: number[]; // unique wave ids, sorted, subset of 1..10
  characters: CharacterInstance[]; // 0..12 entries
  upgrades: Record<string, number>; // <= 20 keys, finite values 0..1e9
  settings: {
    soundEnabled: boolean;
    reducedMotion: boolean;
    battleSpeed: 1 | 2;
  };
  tutorialSeen: boolean;
  nextCharacterId: number; // integer >= 1
  createdAt: number; // integer epoch ms
  lastSavedAt: number; // integer epoch ms
}

interface CharacterInstance {
  id: string; // safe id, <= 80 chars, unique per profile
  typeId: 'laser-crocodile' | 'lightning-scorpion';
  mergeRank: number; // integer, 1..10
  totalXp: number; // integer, 0..245_025 (maximum is level 100)
  col: number; // integer, 0..5
  row: number; // integer, 3..4 (allied deployment area)
}
```

The character level is **not persisted**. It is derived from `totalXp` by the pure progression
helpers in `src/game/domain/progression.ts`. `mergeRank` and character level are separate concepts:
rank comes from merging, level comes from combat XP.

Additional invariants enforced on import/save validation:

- character IDs are unique;
- character positions are unique and inside the allied area;
- completed waves are unique, in range, and form a contiguous prefix starting at wave 1;
- `currentWave` equals the next unfinished wave (`min(completedWaves.length + 1, 10)`);
- `currentWave <= unlockedWave`;
- `nextCharacterId` is an integer in `1..2_000_000_000`; at the upper bound the allocator reuses
  that starting point and skips existing IDs without advancing the stored value past the bound;
- `coins` is an integer in `0..1_000_000_000`. Wave rewards and comfort coins that would exceed
  the bound are rejected with `coin-overflow` instead of creating an unsaveable profile. A victory
  whose coin reward overflows still completes the wave and grants XP with zero coins.

The 12-cell allied area is derived from the 6×5 board (`rows 3..4`). This is intentionally part of
the persisted schema so an imported character can never appear on the enemy side.

## Export envelope

```json
{
  "format": "brainrot-defense-save",
  "appId": "brainrot-defense",
  "schemaVersion": 2,
  "exportedAt": "2026-10-25T00:00:00.000Z",
  "profile": { "...": "PlayerProfile" }
}
```

Export is generated from the current in-memory profile, which is only updated by successful,
complete state transitions.

## Import

1. Read the file as text (the UI uses `File.text()`); no code is executed.
2. Reject empty or larger-than-2 MB input.
3. `JSON.parse` inside a narrow `try/catch`; parse failure returns a typed error.
4. Validate app identity, format, supported version, and the entire profile schema/bounds.
5. If `schemaVersion` is 1, validate the legacy profile, migrate it to v2, and validate the result.
6. If an existing profile has the same ID, the import replaces it only after explicit confirmation.
7. If the profile is new, it is allowed only while fewer than three profiles exist.
8. The imported profile is saved to IndexedDB first. Only after a successful write does the
   in-memory active profile switch. Any failure leaves the previous state untouched.

Malformed JSON, unknown character types, out-of-range stats, duplicate positions/IDs, unsupported
versions, and invalid settings are rejected with a user-facing Hungarian error.

## Migration v1 → v2

M0.1 stored a character property named `level` that represented the **merge level**. In M1.1 this
maps to `mergeRank`; historical combat XP did not exist, so `totalXp` starts at `0`:

```json
{ "level": 7 }
```

becomes

```json
{ "mergeRank": 7, "totalXp": 0 }
```

Migration rules:

- `CURRENT_SAVE_VERSION = 2`, `LEGACY_SAVE_VERSION = 1`.
- A v1 payload is validated against the complete v1 schema **before** conversion.
- The migration function is pure and deterministic for v1 input. Already migrated v2 profiles
  go through v2 validation; `migrateV1Profile` does not pass them through.
- The complete migrated profile is validated again against v2 before it is returned.
- `level` is never interpreted as character level.
- Character IDs, types, positions, coins, completed waves, wave unlock state, profile identity,
  settings, upgrades, tutorial state, and ID allocator state are preserved.
- Existing saves with rank 10 remain rank 10 and start at level 1.
- No XP or coins are invented for historical victories.
- A v2 payload that only contains `level` (without `mergeRank`/`totalXp`) is rejected.
- Version semantics are strict: a `schemaVersion: 1` payload must use the v1 `level` character
  shape. A v1 marker wrapping v2-shaped `mergeRank`/`totalXp` characters is rejected as
  `invalid-import`/`corrupt-save`; `migrateV1Profile` is not an idempotent pass-through.
- Any record or envelope newer than v2 is rejected as `unsupported-version`; it is not partially
  loaded.
- A failed migration never overwrites the stored record.

### Interrupted migration and backups

Loading a valid v1 IndexedDB record migrates it in memory. Best-effort background metadata writes
then retain:

- the original v1 record under `backup:v1:<profileId>`;
- a current v2 shadow record under `shadow:<profileId>`;
- `record-schema:<profileId> = 2`.

The main profile record is not replaced until the next successful autosave. If those metadata
writes fail, the migrated profile is still returned and the old record remains untouched.

The marker stores `{ schemaVersion, shadowChecksum, backupChecksum?, migratedAt }`. If the shadow is
missing but the marker's `shadowChecksum` equals the deterministic migration of the stored v1
record, the migration was merely incomplete: the app re-migrates, validates the v1 source (or a
validated `backup:v1` record when the main legacy payload is unusable), and atomically repairs the
backup/shadow/marker. If the marker points at any other checksum, newer v2
progress existed, so recovery is refused and the data is preserved for an explicit import. Legacy
numeric markers without a shadow are treated conservatively (no unsafe rollback).

### Stale v1 writes from an older tab

Because the database structure stays at version 1, an already running M0.1 tab can still attempt a
v1 write even though a newly opened M0.1 tab would also open the same database. If such a record
appears after a profile has a v2 schema marker, the current app:

1. detects that the record is stale;
2. reads the validated v2 shadow copy;
3. returns the v2 profile instead of the stale v1 payload.

If no valid shadow exists and the marker cannot prove that the main record is the deterministic
migration result, loading fails safely rather than silently discarding v2 progress.

### Deleted profiles and stale legacy writes

Deletion writes a `deleted:<profileId>` tombstone in the same transaction as the record/meta
deletion. If an old running tab later writes a v1 record with the same ID, list/load ignore it and
autosave for that ID fails. An explicit validated import or create with the same ID supersedes the
tombstone. This protects both the write queue and external stale writers.

## Autosave

The controller saves after:

- character purchase;
- successful merge;
- unit movement;
- wave completion, XP award, and reward claim;
- defeat comfort coins;
- settings change;
- tutorial completion;
- profile creation/selection/import.

Saves are serialized through `ProfileWriteQueue`. Autosave snapshots coalesce while queued, so a
burst of changes produces the newest complete snapshot rather than every intermediate one.
Critical battle rewards use a write barrier: the in-memory profile and the result overlay are only
updated after `saveProfile` acknowledges the write. If that write fails, the old valid profile is
kept, the result shows a visible save error, and no reward/XP is claimed. A later retry can award
the battle again because the failed award was never durable. This is a best-effort exactly-once
guarantee per successful write, not a crash-safe transactional guarantee across a process crash
between the IndexedDB commit and the UI acknowledgement.
Import, delete, create, and active-profile changes are write barriers. Older autosaves run before
the barrier; successful import/delete increments the profile generation and discards queued
autosaves from the previous lifecycle. A confirmed import therefore wins over older autosaves, and
a deleted profile is not recreated by the queue. Failed writes leave the previously committed
record intact and set the save status/error message; success is only reported after the write
transaction completes.

During an active battle, the last stable preparation state is the saved state. Starting a battle
does not persist combat-only copies. Closing the browser mid-battle therefore restores the
preparation state and the battle can be started again, with no XP awarded for the interrupted
battle.

## Corruption and recovery

- Corrupt checksum, malformed record, missing payload, or unsupported version produce an error.
- The game never auto-creates a replacement over a corrupt active profile and never silently
  resets it.
- A Web Locks guard blocks concurrent editing of the same profile in two tabs. The second tab is
  shown an explicit error and does not write.
- The user can open the profile screen, import a previous export, choose another profile, or
  explicitly create a new profile. The corrupt record remains until explicitly deleted.
- Profile lists mark unreadable records as `Sérült mentés` and expose deletion only.

## Persistent storage

The game may request `navigator.storage.persist()`. The result is displayed in settings. The app
does not promise persistence when the browser denies or does not implement it. If IndexedDB is
unavailable, the UI warns that reliable local saving is unavailable rather than pretending a save
succeeded.
