# M3.4 – Boss difficulty and economy rebalance

This milestone keeps the 20-wave campaign, all save data, merge/UNDO/sell systems, XP progression,
and the Green Venom Falcon mechanics. It changes reward pacing, late-wave enemy levels, and boss
stat baselines only.

## Goals from playtesting

- Remove the large first-clear gold inflation after wave 10.
- Keep early waves beginner-friendly.
- Make waves 6–9 ask for better decisions.
- Turn wave 10 into a durable first boss milestone.
- Make waves 11–19 escalate smoothly instead of becoming trivial.
- Make wave 20 a tactical encounter where poison, spin shield, ranged shield-breaking, and the
  earthquake matter.

## Gold before and after

Replay rewards are now **35%** of the listed first-clear reward instead of 50%. The first-clear
reward remains the full listed amount.

|      Wave | Old first clear | New first clear | Old replay (50%) | New replay (35%) |
| --------: | --------------: | --------------: | ---------------: | ---------------: |
|         1 |             120 |             120 |               60 |               42 |
|         2 |             140 |             145 |               70 |               50 |
|         3 |             170 |             170 |               85 |               59 |
|         4 |             190 |             195 |               95 |               68 |
|         5 |             220 |             225 |              110 |               78 |
|         6 |             260 |             255 |              130 |               89 |
|         7 |             300 |             285 |              150 |               99 |
|         8 |             340 |             315 |              170 |              110 |
|         9 |             400 |             350 |              200 |              122 |
|        10 |             600 |             500 |              300 |              175 |
|        11 |             700 |             425 |              350 |              148 |
|        12 |             820 |             475 |              410 |              166 |
|        13 |             950 |             525 |              475 |              183 |
|        14 |           1 100 |             575 |              550 |              201 |
|        15 |           1 250 |             625 |              625 |              218 |
|        16 |           1 450 |             675 |              725 |              236 |
|        17 |           1 650 |             725 |              825 |              253 |
|        18 |           1 900 |             775 |              950 |              271 |
|        19 |           2 200 |             825 |            1 100 |              288 |
|        20 |           3 000 |           1 200 |            1 500 |              420 |
| **Total** |      **17 760** |       **9 385** |        **8 880** |        **3 276** |

- Waves 1–10: old **2 740**, new **2 560**.
- Waves 11–20: old **15 020**, new **6 825**.
- The post-boss wave 11 reward no longer exceeds the wave 10 boss reward.
- Boss premiums remain visible: wave 10 is 1.43× wave 9, wave 20 is 1.45× wave 19.
- The new ordinary-wave increments are 25–50 gold, with no sudden percentage jumps.

## Boss changes

| Boss                  | Old base HP / ATK / level | New base HP / ATK / level | Effective HP | Effective ATK |
| --------------------- | ------------------------: | ------------------------: | -----------: | ------------: |
| Mega Brainrot Gorilla |           1 400 / 34 / L3 |           1 800 / 36 / L3 |        3 281 |            59 |
| Green Venom Falcon    |           1 200 / 32 / L3 |           1 700 / 36 / L6 |        8 508 |           134 |

Unchanged intentionally:

- Gorilla interval 1.4 s, range 1.2, speed 0.55, armor 25%.
- Falcon interval 1.15 s, range 1.2, speed 0.8, armor 15%.
- Falcon earthquake freeze: 2 s.
- Falcon poison: 4 s duration, 1 s ticks, 5.5 s cooldown, 4.5 range, 35% attack factor.
- Falcon spin shield: 5 s duration, 8 s cooldown, 50% spin slow on ranged break, 4 s vulnerable
  window, 1.5× vulnerable damage, spin aura 12% attack, 2.3 radius, 1 s aura tick.
- Ranged attacks break the shield; melee attacks are blocked while it is shielded.

## Encounter composition changes

- Waves 6–9 gain one enemy level so the pre-boss stretch is no longer trivial.
- Waves 11–19 gain one enemy level, plus additional enemies from wave 15 onward.
- Wave 20 support enemies are level 6 and the Falcon is level 6.
- Exact compositions are in `src/game/domain/waves.ts` and in `docs/GAMEPLAY_RULES.md`.

## Simulation results

Command:

```bash
npm run simulate
```

The simulator buys, merges, fights all 20 waves, applies first-clear/replay/comfort rewards, and
checks that the final coin ledger equals `starting + earned - spent`. Combat is deterministic, so
seeds 1, 2, and 3 produce the same outcome.

| Scenario                     | Defeats | Earned |  Spent | Final gold | W5 power | W10 power | W15 power | W20 power | W10 HP left | W19 HP left | W20 result                     |
| ---------------------------- | ------: | -----: | -----: | ---------: | -------: | --------: | --------: | --------: | ----------: | ----------: | ------------------------------ |
| Beginner, wide army          |       0 |  9 385 |  8 450 |      1 285 |      193 |       363 |       561 |       836 |         33% |         21% | win, 2 survivors, 38 s, 31%    |
| Casual child, careful merges |       0 |  9 385 |  8 450 |      1 285 |      193 |       363 |       561 |       836 |         33% |         21% | win, 2 survivors, 38 s, 31%    |
| Experienced, crocodile focus |       0 |  9 385 |  8 500 |      1 235 |      235 |       434 |       685 |       984 |         65% |         49% | win, 8 survivors, 27 s, 64%    |
| Optimized, reserve + elite   |       0 |  9 385 |  8 400 |      1 335 |      211 |       421 |       679 |       992 |         65% |         52% | win, 9 survivors, 26 s, 66%    |
| Replay farmer, wave 9 ×10    |       0 | 10 605 |  9 750 |      1 205 |      193 |       378 |       643 |       877 |         61% |         23% | win, 7 survivors, 32 s, 39%    |
| Replay farmer, wave 15 ×10   |       0 | 11 565 | 10 650 |      1 265 |      193 |       363 |       561 |       916 |         33% |         36% | win, 5 survivors, 30 s, 53%    |
| Legacy M0.1 fixture          |       0 |  9 101 |  8 550 |      1 241 |      567 |       752 |       922 |     1 148 |         87% |         66% | win, 7 survivors, 26 s, 63%    |
| Max rank/level boundary      |       0 |  9 385 |  6 150 |      3 235 |    9 438 |     9 569 |     9 716 |     9 900 |        100% |         99% | win, 12 survivors, 5.9 s, 100% |

All eight scenarios complete all 20 waves. No correctness failures were reported. The only
balance note is that the beginner and casual-child purchase/merge policies converge to the same
end state under this economy.

Replay farming still adds gold but has diminishing value:

- Farming wave 9 ten times adds **1 220** gold.
- Farming wave 15 ten times adds **2 180** gold.
- Both farmers still finish with roughly 1 200 gold, because extra income is spent on wider armies.
- Farming does not skip the need to build enough ranged units for wave 20.

## Save compatibility

- No save-schema change.
- Existing coins, XP, merge ranks, completed waves, and unlocked waves are untouched.
- Rewards only apply to future victory claims.
- Wealthy pre-M3.4 profiles keep their accumulated gold; they are simply less able to grow that
  wealth through new first-clear rewards. Fresh profiles have a tighter but still completable
  economy, as shown by the simulation.
- Import/export and old M0.1 migration are unchanged.

## M3.4.2 follow-up: approved early/mid curve

The M3.4.1 audit found that the untouched three-unit starting army could clear waves 1–4 and reach
wave 5 with 980 gold. The approved follow-up changes only these wave compositions:

| Wave | Before                                             | After                                | HP before → after | Nominal DPS before → after |
| ---: | -------------------------------------------------- | ------------------------------------ | ----------------: | -------------------------: |
|    3 | 2× Mini L1, 1× Slug L1                             | 1× Mini L1, 1× Mini L2, 1× Slug L2   |         260 → 332 |              17.29 → 20.83 |
|    4 | 2× Mini L2, 2× Runner L1                           | 2× Mini L2, 2× Runner L2             |         308 → 364 |              35.00 → 41.67 |
|    5 | 2× Mini L1, 1× Slug L1, 2× Runner L2               | 2× Mini L2, 1× Slug L2, 2× Runner L2 |         476 → 567 |              43.96 → 49.17 |
|    7 | 2× Slug L3, 2× Mini L3                             | 2× Slug L3, 3× Mini L3               |         746 → 846 |              37.08 → 46.25 |
|   11 | 3× Mini L5, 1× Slug L4                             | +1× Mini L4, +1× Runner L4           |       918 → 1,250 |              59.38 → 88.55 |
|   17 | 4× Mini L6, 2× Slug L6, 1× Runner L6, 1× Runner L7 | +1× Mini L6                          |     3,177 → 3,424 |            197.64 → 217.64 |

All other wave compositions, rewards, defender stats, prices, XP, saves, boss mechanics, and Falcon
mechanics are unchanged.

Benchmarks after this change:

- Untouched starting army: wins waves 1–3, then loses wave 4.
- One sensible early Laser Crocodile purchase: wave 4 becomes a victory with surviving units.
- Sensible merging and purchasing: completes wave 5 and reaches the existing wave 10 boss.
- Wave 7 now has more HP than wave 6 and effectively flat DPS instead of a 21% dip.
- Wave 11 is stronger than wave 9 in both HP and DPS.
- Wave 17 has more HP and DPS than wave 16.
- The full M3.4 simulation remains 8/8 completed scenarios with no software correctness failures.
