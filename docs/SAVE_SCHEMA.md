# Save schema and migration strategy

## Storage layout

IndexedDB database: `brainrot-defense` (version 1).

| Object store | Key path    | Purpose                                    |
| ------------ | ----------- | ------------------------------------------ |
| `profiles`   | `profileId` | One atomic record per local player profile |
| `meta`       | `key`       | App metadata, currently `activeProfileId`  |

There is no backend and no cloud synchronization. Each browser profile has its own local data.

## Stored profile record (schema version 1)

```ts
interface StoredProfileRecord {
  profileId: string;
  schemaVersion: 1;
  checksum: string;
  savedAt: number;
  payload: PlayerProfile;
}
```

- The checksum is a 32-bit FNV-1a hash of `JSON.stringify(payload)`, rendered as 8 hex chars.
- Load order: validate record shape → check supported version → recompute checksum → validate full
  profile payload → verify `payload.profileId === record.profileId`.
- Writes validate the profile **before** opening the read/write transaction. A failed validation
  leaves the previous valid record untouched.
- A single `put` in one transaction covers the complete record; there is no partially committed
  profile.

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
  level: number; // integer, 1..10
  col: number; // integer, 0..5
  row: number; // integer, 3..4 (allied deployment area)
}
```

Additional invariants enforced on import/save validation:

- character IDs are unique;
- character positions are unique and inside the allied area;
- completed waves are unique, in range, and form a contiguous prefix starting at wave 1;
- `currentWave` equals the next unfinished wave (`min(completedWaves.length + 1, 10)`);
- `currentWave <= unlockedWave`;
- `nextCharacterId` is an integer in `1..2_000_000_000`; at the upper bound the allocator reuses
  that starting point and skips existing IDs without advancing the stored value past the bound;
- `coins` is an integer in `0..1_000_000_000`. Wave rewards and comfort coins that would exceed
  the bound are rejected with `coin-overflow` instead of creating an unsaveable profile.

The 12-cell allied area is derived from the 6×5 board (`rows 3..4`). This is intentionally part of
the persisted schema so an imported character can never appear on the enemy side.

## Export envelope

```json
{
  "format": "brainrot-defense-save",
  "appId": "brainrot-defense",
  "schemaVersion": 1,
  "exportedAt": "2026-10-24T00:00:00.000Z",
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
5. If an existing profile has the same ID, the import replaces it only after explicit confirmation.
6. If the profile is new, it is allowed only while fewer than three profiles exist.
7. The imported profile is saved to IndexedDB first. Only after a successful write does the
   in-memory active profile switch. Any failure leaves the previous state untouched.

Malformed JSON, unknown character types, out-of-range stats, duplicate positions/IDs, unsupported
versions, and invalid settings are rejected with a user-facing Hungarian error.

## Migration strategy

- `CURRENT_SAVE_VERSION = 1`.
- Any record or envelope with a version **newer** than the app is rejected as
  `unsupported-version`; it is not partially loaded.
- Any version lower than current will go through an explicit migration function in a future
  milestone. M0 has no legacy versions, so the migration function is intentionally not stubbed.
- Migrations must be pure and must run before validation of the final schema. Raw data is not
  overwritten until the migrated profile validates and saves successfully.
- The service worker cache version is independent of the save schema version. Updating the app
  shell can never migrate or clear IndexedDB data.

## Autosave

The controller saves after:

- character purchase;
- successful merge;
- unit movement;
- wave completion and reward claim;
- defeat comfort coins;
- settings change;
- tutorial completion;
- profile creation/selection/import.

Saves are serialized through `ProfileWriteQueue`. Autosave snapshots coalesce while queued, so a
burst of changes produces the newest complete snapshot rather than every intermediate one.
Import, delete, create, and active-profile changes are write barriers. Older autosaves run before
the barrier; successful import/delete increments the profile generation and discards queued
autosaves from the previous lifecycle. A confirmed import therefore wins over older autosaves, and
a deleted profile is not recreated by the queue. Failed writes leave the previously committed
record intact and set the save status/error message; success is only reported after the write
transaction completes.

During an active battle, the last stable preparation state is the saved state. Starting a battle
does not persist combat-only copies. Closing the browser mid-battle therefore restores the
preparation state and the battle can be started again.

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
