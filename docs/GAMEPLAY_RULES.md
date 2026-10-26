# Gameplay rules (M1.1)

## Board

- Grid: 6 columns × 5 rows.
- Enemy deployment area: rows 1–3 (0-based indices 0–2).
- Allied deployment area: rows 4–5 (0-based indices 3–4), 12 cells.
- Player units occupy exactly one allied cell each.
- Wave definitions place enemies in the enemy area. Battle copies of units may move freely across
  the battlefield; persistent positions never leave the allied area.

Coordinates in code are 0-based (`col`, `row`). Hungarian UI labels are 1-based.

## Preparation

- Preparation has no timer and no forced battle.
- The player may buy, move, merge, inspect, pause, and change settings indefinitely.
- The player may tap-to-select and tap an empty allied cell to move, or drag a unit.
- Invalid moves (enemy area, occupied non-merge target, out of bounds) cause no state change.
- Enemy wave composition is previewed before the battle.

## Two progression dimensions

### Merge rank (1–10)

Merge rank is the evolution dimension. It is increased only by merging two characters of the same
type and rank.

Two characters can merge only if all are true:

1. same `typeId`;
2. same `mergeRank`;
3. rank is below the cap (`MAX_MERGE_RANK = 10`);
4. both exist in the active player's persistent army;
5. the interaction refers to two distinct units;
6. the game is in the preparation phase.

Character levels **do not** have to match. For example, a rank 3 / level 12 Laser Crocodile and a
rank 3 / level 8 Laser Crocodile merge into a rank 4 character with their combined XP.

On success:

- exactly two units are removed;
- exactly one new unit is created with `mergeRank + 1`, same type;
- the new unit occupies the **target** unit's cell;
- the new unit's XP is `min(MAX_CHARACTER_XP, xpA + xpB)`;
- a new unique ID is allocated;
- `nextCharacterId` advances;
- `lastSavedAt` updates;
- the transition is atomic and persisted.

At rank 10, merging is rejected and both units are kept. A unit cannot merge with itself. Duplicate
events are safe: after the first successful merge those IDs no longer exist, so a repeated command
fails.

Merging is intentionally the most powerful progression step: each rank multiplies attack by
`1.45` and HP by `1.5`, while XP levels add a smaller linear bonus.

### Character level (1–100, derived from XP)

The character level is never stored as an independent field. It is calculated from lifetime XP:

```text
xpRequiredForLevel(level) = 25 * (level - 1)^2
```

| Level | XP required |
| ----: | ----------: |
|     1 |           0 |
|     2 |          25 |
|    10 |       2 025 |
|    50 |      60 025 |
|   100 |     245 025 |

- XP is a nonnegative safe integer and is capped at `245 025`.
- Exactly hitting a threshold gives that level; one XP below stays on the previous level.
- `totalXp` is clamped to `0..245 025`; negative or non-finite inputs are normalized safely.
- Negative XP awards do nothing. XP is never averaged or replaced by the higher of two levels.
- At level 100, further XP is discarded. The UI shows `MAX. SZINT`.

## Combat XP rewards

XP is granted when a battle ends in victory, not on defeat or surrender.

```text
baseWaveXp(wave) = 60 + 15 * wave
```

| Wave | Base XP per participating character |
| ---: | ----------------------------------: |
|    1 |                                  75 |
|    5 |                                 135 |
|   10 |                                 210 |

- First victory of a wave: each participant receives the full base XP.
- Repeat victory of an already completed wave: each participant receives `floor(base * 0.25)`.
  Replay is not exposed in the current UI; this rule is implemented and tested for a later
  wave-selector milestone.
- Defeat and surrender grant **0 XP**.
- The participating persistent character IDs are captured when the battle starts. XP is applied
  to that roster only, even if the temporary battle copy died or the persistent formation changes
  later.
- Acquiring a character after the battle started does not grant XP for that battle.
- Persistent characters are never removed because of a combat death.
- XP is awarded exactly once per resolved battle. The result action advances to preparation; it
  cannot re-award XP. Reloading a completed battle does not repeat the grant.
- Coin rewards and XP rewards remain independent. A completed wave grants its first-clear coins
  once; a replay may still grant reduced XP without granting coins again.
- If the coin cap prevents a first-clear reward, the wave still completes and XP is granted; the
  player sees a coin-overflow notice.

## Character stats

```text
attack = round(baseAttack * 1.45^(mergeRank - 1) * (1 + 0.035 * (characterLevel - 1)))
maxHp  = round(baseHp     * 1.5 ^(mergeRank - 1) * (1 + 0.04  * (characterLevel - 1)))
```

- Rank is clamped to `1..10`; XP is normalized to `0..245 025`.
- Stats are rounded and clamped to `1..1_000_000_000` to avoid overflow.
- Attack interval, range, movement speed, chain behavior, and type do not change with rank or level.
- The same `characterStats` function feeds the UI inspector, shop preview, battle simulation, army
  power calculation, and balance simulation, so the multipliers are applied exactly once.
- Visuals add a merge-rank badge, increasing glow, and an original larger character drawing. The
  character's XP level is shown separately in the inspector.

### M0.1 migration balance note (M1.4 playtesting)

M0.1 scaled a unit's attack by `1.65^(level - 1)` while using its level as the merge rank. M1.1
keeps the same rank but uses the agreed merge-rank formula `1.45^(mergeRank - 1)` for attack (HP
still uses `1.5`). A migrated character therefore keeps its rank, IDs, position, coins and wave
progress, but its attack is lower than the old M0.1 stat at the same historical level. This is a
deliberate formula change, not a bug and not a reason to rewrite old saves. It is recorded as an
M1.4 balance/playtesting item; M1.1 must not silently change the agreed progression formulas.

### Characters

| ID                   | Hungarian name | Role              | Cost |  HP | ATK | Interval | Range | Special                                                                            |
| -------------------- | -------------- | ----------------- | ---: | --: | --: | -------: | ----: | ---------------------------------------------------------------------------------- |
| `laser-crocodile`    | Lézer Krokodil | Ranged damage     |  100 | 100 |  12 |    1.0 s |   3.0 | Laser projectile                                                                   |
| `lightning-scorpion` | Villám Skorpió | Area/chain damage |  150 |  80 |   8 |    1.5 s |   2.5 | Chains to 1 extra enemy for 60% damage within 1.6 grid units of the primary target |

## Enemies

| ID                      | Hungarian name        |   HP | ATK | Interval | Speed | Range | Armor |
| ----------------------- | --------------------- | ---: | --: | -------: | ----: | ----: | ----: |
| `mini-brainrot`         | Mini Brainrot         |   55 |   7 |    1.2 s |  1.05 |   1.0 |    0% |
| `armored-slug`          | Páncélozott Csiga     |  150 |   9 |    1.6 s |   0.5 |   1.0 |   35% |
| `shadow-runner`         | Árny Futó             |   80 |   9 |    0.9 s |   1.7 |   1.0 |    0% |
| `mega-brainrot-gorilla` | Mega Brainrot Gorilla | 1400 |  34 |    1.4 s |  0.55 |   1.2 |   25% |

Enemy stat scaling per level: HP × `1.35^(level-1)`, ATK × `1.28^(level-1)`. The boss is visually
larger, has `isBoss`, and starts at wave-defined level (M1.1: level 3).

## Economy

- Starting coins: **350**.
- Starting army: 2 × rank 1 Lézer Krokodil, 1 × rank 1 Villám Skorpió, all at 0 XP.
- Purchases create rank 1, level 1 units in the first empty allied cell (row-major order).
- Purchases validate funds and free space before any mutation.
- A full board blocks purchasing; the player can merge or sell a selected unit to free a cell.
- Wave coin rewards are claimable once per wave. Replaying a completed wave gives no new coins.
- Defeat grants **20 comfort coins**. Units are never lost, and retries are free. This guarantees
  that an unlucky ordinary playthrough cannot become permanently unplayable.
- Coins have a hard persistence bound of **1,000,000,000**. A reward or comfort grant that would
  exceed it is rejected with a visible error; the profile is left unchanged and remains saveable.

### Selling units

- Selling is available only in preparation, and only for the friendly unit the player selected.
  The confirmation dialog always targets that exact unit; enemies and unselected units cannot be
  sold.
- Selling requires confirmation. The safe default is cancellation (`Mégse`); the destructive
  `Eladás` action must be chosen explicitly. The dialog shows the unit name, merge rank, character
  level, and the exact refund before confirmation.
- The refund is based on the unit's **merge investment**, not its current stats or XP level:

```text
purchaseValueForRank(rank) = baseCost * 2^(rank - 1)
sellRefund(rank)           = floor(purchaseValueForRank(rank) * 0.5)
```

| Rank | Laser Crocodile invested | Refund | Lightning Scorpion invested | Refund |
| ---: | -----------------------: | -----: | --------------------------: | -----: |
|    1 |                      100 |     50 |                         150 |     75 |
|    2 |                      200 |    100 |                         300 |    150 |
|    3 |                      400 |    200 |                         600 |    300 |
|    4 |                      800 |    400 |                       1 200 |    600 |
|   10 |                   51 200 | 25 600 |                      76 800 | 38 400 |

- XP and character level add no gold value, so levelling a unit cannot be used to farm refunds.
- Selling two rank-1 units gives the same refund as merging them and selling the rank-2 result
  (`50 + 50 = 100` for Laser Crocodile). Buying and immediately selling always loses half the
  purchase price, so buy/sell and merge/sell cycles cannot create gold.
- A successful sale removes exactly one unit, adds the integer refund exactly once, frees its cell,
  clears the selection, and is autosaved through the same profile write queue as other gameplay
  actions.
- Selling clears the merge UNDO stack. This conservative policy guarantees that a later UNDO can
  never resurrect a sold unit, duplicate a character, or restore a stale board position. UNDO
  becomes empty after a sale.
- A persistence error is reported visibly and can be retried with the normal save path; the domain
  transaction itself is still applied exactly once, so no duplicate unit or refund is produced.

### Waves

| Wave | Name                  | Enemies                                | Reward |
| ---: | --------------------- | -------------------------------------- | -----: |
|    1 | Első kopogás          | 2 × Mini L1                            |    120 |
|    2 | Több kis szörny       | 3 × Mini L1                            |    140 |
|    3 | Páncélos vendég       | 2 × Mini L1, 1 × Csiga L1              |    170 |
|    4 | Gyors lábak           | 2 × Mini L2, 2 × Futó L1               |    190 |
|    5 | Vegyes had            | 2 × Mini L1, 1 × Csiga L1, 2 × Futó L2 |    220 |
|    6 | Erősödő sereg         | 3 × Mini L3, 1 × Csiga L2              |    260 |
|    7 | Acélfal               | 2 × Csiga L2, 2 × Mini L2              |    300 |
|    8 | Árny roham            | 4 × Futó L2, 1 × Mini L2               |    340 |
|    9 | Káosz kapuja          | 3 × Mini L3, 2 × Csiga L2, 1 × Futó L3 |    400 |
|   10 | Mega Brainrot Gorilla | Boss L3, 2 × Mini L3, 1 × Csiga L2     |    600 |

Exact positions are data in `src/game/domain/waves.ts` and are validated by tests.

## Combat simulation

- Fixed step: **1/30 s**. The accumulator is fed real elapsed time (clamped to 250 ms). At most 20
  ticks are processed per advance. Excess catch-up time is discarded to avoid a spiral.
- 1× and 2× battle speed scale simulated time, not tick size. The final outcome is identical.
- Rendering rate has no influence on the simulation; tests compare 5 ms and 50 ms frame feeding.
- Damage is applied synchronously at the attack tick. Projectile/beam visuals are cosmetic.
- A 90-second simulation limit ends the battle as a defeat if neither side has been eliminated.
- Persistent characters are copied into battle entities using their rank/XP-derived stats. Death
  in battle never deletes a persistent character.

### Action order

1. Decrement cooldowns by the fixed step.
2. Process living units in stable ascending ID order.
3. For each unit, acquire the nearest living opponent (Euclidean distance, lowest ID on ties).
4. If the target is outside range, move toward it by `moveSpeed * dt`, stopping at range.
5. Otherwise, if cooldown is ready, attack.
6. After all units, check victory/defeat/timeout.

Enemy IDs (`enemy-…`) sort before ally IDs (`unit-…`), so enemies act first in the current stable
ordering. This is explicit and tested; future balance changes can adjust IDs/order only with tests.

### Damage

- Base damage is the attacker's current attack.
- Armor mitigation: `max(1, round(rawDamage * (1 - armor)))`, with armor clamped to 0–90%.
- Armored Slug: 35% mitigation. Boss: 25%.
- Chain lightning: primary target takes full damage; exactly one additional enemy within 1.6 grid
  units of the primary takes `attack × 0.6` (after its armor). Ties resolved by distance then ID.
  The chain only jumps if the primary target survives the initial hit.
- Health is clamped at 0; a unit at 0 HP becomes dead and is no longer targetable/able to act.

### Targeting and movement

- Nearest living opponent by Euclidean distance in grid units.
- Distance ties resolved by lexicographically lowest stable ID.
- Movement is continuous in grid coordinates and clamped to the board bounds.
- Units stop moving once within attack range; no collision/occupancy restrictions in battle.

## Victory and defeat

- Victory: no living enemies remain.
- Defeat: no living allies remain, or the 90 s limit is reached.
- On victory, each battle-start participant receives XP, the wave coin reward is granted **once**,
  `completedWaves` is updated, and `currentWave` advances up to wave 10.
- On defeat, no XP is granted, the persistent army is untouched, and 20 comfort coins are granted.
- On surrender, no XP and no coins are granted; the army is untouched.
- The result is stored only after the battle resolves. A mid-battle browser close restores the
  last preparation save and grants no XP.

## Persistence timing

The game autosaves complete preparation snapshots after every persistent change, including XP
awards and merges. Autosaves are serialized and coalesced; import/delete/profile switches are
barriers that cannot be overwritten by older queued snapshots. No save is made for transient
visual animation state. See `docs/SAVE_SCHEMA.md`.

## Tutorial

First-time players see a three-step Hungarian tutorial:

1. buy characters with coins;
2. drag/tap equal characters of equal rank to merge;
3. press **HARCOLJ!** for the automatic battle and XP rewards.

The tutorial is marked seen and saved when dismissed. It can be reopened from the menu or the
preparation sidebar.
