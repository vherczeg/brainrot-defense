# Architecture Decision Record — Brainrot Defense M1.1

## Context

M1.1 extends the M0 playable game with a hybrid progression system: merge rank 1–10 and
XP-derived character level 1–100. The game must remain deterministic, offline-capable, save-safe,
and fully playable with existing M0.1 saves after an explicit schema migration.

## Decisions

### 1. Vite + TypeScript strict + React 19 + Phaser 3.90

- **Vite 7** keeps the toolchain small and produces a static build suitable for Pages.
- **TypeScript strict** (including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`)
  guards domain boundaries and save data.
- **React 19** owns menus, shop, inspector, HUD, modals, localization, and accessible placement.
- **Phaser 3.90** renders the battlefield, units, health bars, drag feedback, and combat effects
  on a canvas. Phaser is not used for menus or persistence.

Phaser was kept for the battlefield because it provides a proper game loop, input coordinates,
tweens, and compositing without hand-rolled canvas code. React was kept for the surrounding UI
because semantic HTML, focus management, modals, and responsive layout are substantially simpler
and more accessible there than inside a canvas.

The game was deliberately **not** built with a global state library. A single `GameController`
with an observer interface and `useSyncExternalStore` is enough for this scale.

### 2. Single authoritative state, pure commands

- `GameController` owns the active `PlayerProfile`, battle session, navigation, modals, toasts,
  and save status.
- Domain commands (`purchaseCharacter`, `mergeCharacters`, `moveCharacter`, `claimWaveReward`,
  `resolveBattleRewards`, `updateSettings`) are pure functions that return an immutable next
  profile or a typed error.
- Pure progression helpers in `src/game/domain/progression.ts` own the XP curve, level derivation,
  XP awards, merge XP combination, and wave XP formulas. Character level is never persisted.
- Failed commands return the original state untouched. Duplicate UI events therefore cannot
  execute a merge twice: after the first transition, the consumed units no longer exist.
- Rendering reads the controller (Phaser scene) or a React snapshot. Phaser never mutates domain
  objects.

Dependency direction:

```text
domain  ←  commands  ←  controller  ←  React UI
   ↑                         ↑
simulation ──────────────────┘
   ↑
rendering (Phaser) ────────┘ (read-only via controller)
```

`domain/` and `simulation/` import no Phaser, React, or DOM APIs. They run in plain Node under
Vitest.

### 3. Board geometry

The board is 6 columns × 5 rows. Rows 1–3 (indices 0–2) are the enemy deployment area; rows 4–5
(indices 3–4) are the allied area (12 cells). The 6×5 grid is unchanged for simulation purposes;
only the presentation adapts on small screens.

Why only two allied rows? It keeps the board readable on phones while preserving a 6×5 battlefield
and creates a real incentive to merge: 12 cells can only absorb a limited number of level-1 units,
so higher-level units are required to convert later-wave coin income into power.

Enemy waves use the enemy area only. One empty enemy row provides visual breathing room and is
available for future formations.

### 4. Fixed-timestep deterministic simulation

- Simulation tick: **1/30 s**.
- `BattleSession` accumulates real time (clamped to 250 ms per frame) and executes a bounded
  number of fixed ticks (max 20 per advance).
- 1× and 2× speed multiply simulated time, not the tick size. When both runs reach the end, the
  final tick count and state are identical. This is covered by tests.
- Rendering frame rate does not drive the simulation; the browser controller loop calls
  `session.advance(delta)`, and the Phaser scene only displays snapshots.
- Long tab suspensions are bounded, preventing catch-up spirals.

Targeting is deterministic: nearest living opponent, then lowest stable entity ID as tie-breaker.
Units act in stable ID order. Enemies use `enemy-{wave}-{n}` IDs, allies use `unit-{n}`, so in the
current ID ordering enemies act before allies when IDs are sorted ascending. This is an explicit,
tested rule, not an accident of object iteration.

Projectiles are visual only; damage is applied synchronously at the attack tick. This removes
race conditions between projectile travel, death, and target acquisition.

### 5. Persistence

- Native IndexedDB wrapper (no extra dependency) with promise-based helpers.
- One record per profile in the `profiles` store, keyed by `profileId`.
- A record is written in one `readwrite` transaction. Validation happens before the write, so an
  invalid transaction never replaces a valid record.
- Each record stores a schema version, timestamp, checksum, and payload. Load recomputes the
  checksum, validates legacy data if needed, migrates it with a pure function, and validates the
  final v2 schema. Corruption is surfaced, never silently reset.
- The database version is 2. A v1 character `level` maps to `mergeRank`, and `totalXp` starts at 0.
  Backups and v2 shadow records live in the `meta` store so migration never consumes one of the
  three profile slots. A stale v1 write from an old tab is detected and replaced in memory by the
  validated v2 shadow.
- Metadata (`activeProfileId`) lives in a separate `meta` store. Profile creation and import use
  one transaction across `profiles` and `meta`, so the saved profile and active selection cannot
  diverge.
- Writes go through a serialized `ProfileWriteQueue`. Autosave snapshots coalesce while they are
  waiting, so a burst of purchases/moves/settings changes does not create an unbounded queue.
- Import, delete, create, and active-profile changes are barriers. Older autosaves run before a
  barrier; autosaves for an invalidated/deleted generation are skipped. A confirmed import
  therefore cannot be overwritten by a stale autosave, and a deleted profile cannot be
  resurrected by the queue.
- Each profile has an in-memory generation. Successful import/delete invalidates older queued
  autosaves. Failed barrier writes leave the previous valid state intact and surface an error.
- Export produces an envelope with the selected profile. Import parses JSON only, validates bounds
  and types, and asks for confirmation before saving.
- A Web Locks guard prevents two tabs from editing the same profile simultaneously. The second
  tab gets an explicit blocking error instead of silently overwriting the first tab.
- During battle, only settings changes are persisted; the persistent army/current wave remain the
  last preparation snapshot. Victory/defeat results, XP, and coin changes are written after the
  battle resolves. The controller captures the participating persistent character IDs at battle
  start, so XP uses that roster even if temporary battle copies die or the formation changes.

See `docs/SAVE_SCHEMA.md` for fields and bounds.

### 6. Accessibility and input

- Phaser pointer input supports drag and tap-to-select/tap-to-place.
- A semantic `<details>` panel under the battlefield exposes every unit and every allied cell as
  buttons, with `aria-pressed`, labels, coordinates, and valid-target styling. This provides a
  non-drag path and keyboard operation.
- Modals use `role="dialog"`, `aria-modal`, labelled titles, focus on open, Escape to close, and
  a focus trap for Tab navigation.
- UI animations respect both `prefers-reduced-motion` and the in-game reduced-motion setting.
  Phaser idle motion and battle effects are reduced/skipped when that setting is active.
- Important state is communicated with text/counts/levels, not color alone.

### 7. Offline/PWA

The service worker is generated by a small Vite build plugin from
`scripts/serviceWorkerTemplate.ts`:

- the full app shell (hashed JS/CSS, HTML, manifest, icons, CNAME) is precached at install;
- the cache name contains a hash of the build contents;
- install writes to a staging cache and fails atomically; an incomplete cache is never activated;
- activation removes obsolete cache names with the same prefix;
- navigations are network-first with precached-shell fallback;
- essential same-origin assets are cache-first from the precache, with no runtime network
  dependency; cache matching uses `ignoreVary` because static hosts send `Vary: Origin`.

The generated manifest avoids stale runtime-cache combinations and makes the first-visit offline
case work. A Playwright test covers a fresh load followed immediately by offline reload, plus
online recovery. The service worker is still independent of IndexedDB save schema/versioning.

### 8. Localization

All player-facing strings live in `src/localization/hu.ts`, typed by `TranslationKey`. Components
never contain business copy. Adding English later means adding a second dictionary and a language
setting; no domain changes are required.

### 9. Asset strategy

All current visuals are original, programmatic placeholders:

- React/SVG creature portraits in `CreatureAvatar.tsx`;
- Phaser Graphics-drawn battlefield creatures, effects, and health bars;
- CSS-drawn UI chrome;
- Web Audio synthesized sound effects.

The rendering layers use stable type IDs (`laser-crocodile`, `lightning-scorpion`, enemy IDs) so a
future sprite/asset catalog can replace placeholders without touching domain rules.

## Testing strategy

- Domain rules and simulation: Vitest, plain Node, fixed seeds and deterministic scenarios.
- Progression: exhaustive XP threshold boundaries, rank/XP stat formulas, merge XP combination,
  first-victory and reduced replay XP, death/nonparticipant eligibility, and XP cap behaviour.
- Persistence: Vitest with `fake-indexeddb`, including strict v1→v2 migration, stale v1 shadow
  recovery, missing-shadow recovery, deletion tombstones, corruption, unsupported version, atomic
  failure, retryable open failures, and profile isolation.
- Integration: a scripted 10-wave playthrough with XP rewards validates that ordinary
  spending/merging remains mathematically completable. The simulation script covers zero-XP new
  games, migrated saves, aggressive merging, low-rank retention, type-focused armies, mixed
  formations, retries after defeat, per-wave XP progression, and max-rank/max-level boundaries.
- Browser: Playwright against the production build, real IndexedDB, real Phaser canvas, desktop
  and Pixel 7-like mobile Chromium profiles. Canvas drag, accessible placement, persistence,
  import/export, defeat/retry, and offline reload are covered.

## Consequences

- The bundle includes Phaser (largest cost). That is acceptable for M0; code-splitting is a
  future optimization.
- Canvas content is not screen-reader-readable; the DOM placement panel is the documented
  accessibility path.
- The UI and scene share a controller but keep separate local visual state. This avoids React
  re-rendering every simulation tick and avoids Phaser mutating domain state.
- Additional ranks, characters, waves, or progression tuning require data/helper changes plus
  tests, not rendering rewrites.
