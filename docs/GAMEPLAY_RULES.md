# Gameplay rules (M0)

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

## Merge

Two characters can merge only if all are true:

1. same `typeId`;
2. same `level`;
3. level is below the cap (`MAX_CHARACTER_LEVEL = 10`);
4. both exist in the persistent army;
5. the interaction refers to two distinct units.

On success:

- exactly two units are removed;
- exactly one new unit is created with `level + 1`, same type;
- the new unit occupies the **target** unit's cell;
- a new unique ID is allocated;
- `nextCharacterId` advances;
- `lastSavedAt` updates;
- the transition is atomic and persisted.

At level 10, merging is rejected. A unit cannot merge with itself. Duplicate events are safe:
after the first successful merge those IDs no longer exist, so a repeated command fails.

## Character progression

```text
attack  = round(baseAttack * 1.65^(level - 1))
maxHp   = round(baseHp     * 1.5 ^(level - 1))
```

- Level is clamped to `1..10`.
- Stats are rounded and clamped to `1..1_000_000_000` to avoid overflow.
- Attack interval, range, movement speed, chain behavior, and type do not change with level in M0.
- Visuals add a level badge, increasing glow, and an original larger character drawing.

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
larger, has `isBoss`, and starts at wave-defined level (M0: level 3).

## Economy

- Starting coins: **350**.
- Starting army: 2 × level 1 Lézer Krokodil, 1 × level 1 Villám Skorpió.
- Purchases create level 1 units in the first empty allied cell (row-major order).
- Purchases validate funds and free space before any mutation.
- A full board blocks purchasing; the player must merge to free a cell.
- Wave rewards are claimable once per wave. Replaying a completed wave gives no new reward.
- Defeat grants **20 comfort coins**. Units are never lost, and retries are free. This guarantees
  that an unlucky ordinary playthrough cannot become permanently unplayable.
- Coins have a hard persistence bound of **1,000,000,000**. A reward or comfort grant that would
  exceed it is rejected with a visible error; the profile is left unchanged and remains saveable.

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
- Persistent characters are copied into battle entities. Death in battle never deletes a
  persistent character.

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
  In M0 the chain only jumps if the primary target survives the initial hit.
- Health is clamped at 0; a unit at 0 HP becomes dead and is no longer targetable/able to act.

### Targeting and movement

- Nearest living opponent by Euclidean distance in grid units.
- Distance ties resolved by lexicographically lowest stable ID.
- Movement is continuous in grid coordinates and clamped to the board bounds.
- Units stop moving once within attack range; no collision/occupancy restrictions in battle.

### Victory and defeat

- Victory: no living enemies remain.
- Defeat: no living allies remain, or the 90 s limit is reached.
- On victory, the wave reward is granted **once**, `completedWaves` is updated, and `currentWave`
  advances up to wave 10.
- On defeat, the persistent army is untouched and 20 comfort coins are granted.
- The result is stored only after the battle resolves. A mid-battle browser close restores the
  last preparation save.

## Persistence timing

The game autosaves complete preparation snapshots after every persistent change. Autosaves are
serialized and coalesced; import/delete/profile switches are barriers that cannot be overwritten
by older queued snapshots. No save is made for transient visual animation state. See
`docs/SAVE_SCHEMA.md`.

## Tutorial

First-time players see a three-step Hungarian tutorial:

1. buy characters with coins;
2. drag/tap equal characters to merge;
3. press **HARCOLJ!** for the automatic battle.

The tutorial is marked seen and saved when dismissed. It can be reopened from the menu or the
preparation sidebar.
