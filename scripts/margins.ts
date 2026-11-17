import { createInitialProfile } from '../src/game/domain/state';
import { LAST_WAVE_ID, getWaveForProfile } from '../src/game/domain/waves';
import { createBattleState, runBattleToCompletion } from '../src/game/simulation/battle';
import { resolveBattleRewards, resolveDefeatRewards } from '../src/game/commands/profileCommands';
import { prepareArmy, type Strategy } from './campaignSim';

/**
 * Runs one reference strategy through the whole campaign and prints the per-wave margin
 * (remaining ally HP ratio) so the difficulty curve can be tuned data-driven.
 */
const strategies: readonly Strategy[] = [
  {
    name: 'mid (krokodil-fókusz)',
    buy: 'crocodile',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 6,
  },
  {
    name: 'beginner (vegyes)',
    buy: 'mixed',
    merge: 'late',
    start: 'new',
    reserveCoins: 0,
    minArmy: 6,
  },
  {
    name: 'strong (optimalizált)',
    buy: 'mixed',
    merge: 'aggressive',
    start: 'new',
    reserveCoins: 60,
    minArmy: 6,
    upgradeReserveFactor: 2,
  },
];

interface MarginRow {
  readonly waveId: number;
  readonly attempts: number;
  readonly hpPct: number;
  readonly durationSec: number;
  readonly surprise: boolean;
}

function run(strategy: Strategy, seed: number): MarginRow[] {
  let profile = createInitialProfile({ profileId: `margin-${seed}`, name: 'M', now: 1 });
  const rows: MarginRow[] = [];
  for (let waveId = 1; waveId <= LAST_WAVE_ID; waveId += 1) {
    const wave = getWaveForProfile(profile.profileId, waveId);
    if (!wave) throw new Error(`missing wave ${waveId}`);
    let won = false;
    let attempts = 0;
    let hpPct = 0;
    let durationSec = 0;
    while (!won && attempts < 25) {
      attempts += 1;
      profile = prepareArmy(profile, strategy);
      const roster = profile.characters.map((character) => character.id);
      const result = runBattleToCompletion(
        createBattleState(
          profile.characters,
          wave,
          waveId * 1000 + attempts + seed,
          'normal',
          profile.upgrades,
        ),
      );
      if (result.state.status === 'victory') {
        won = true;
        durationSec = result.state.elapsedSec;
        const allies = result.state.units.filter((unit) => unit.team === 'ally');
        const maxHp = allies.reduce((sum, unit) => sum + unit.maxHp, 0);
        const hp = allies.reduce((sum, unit) => sum + (unit.alive ? unit.hp : 0), 0);
        hpPct = maxHp > 0 ? hp / maxHp : 0;
        const resolved = resolveBattleRewards(profile, waveId, roster, 2);
        if (!resolved.ok) throw new Error(`reward failed ${waveId}`);
        profile = resolved.value.profile;
      } else {
        const comfort = resolveDefeatRewards(profile, waveId, roster, 2);
        if (!comfort.ok) throw new Error(`comfort failed ${waveId}`);
        profile = comfort.value.profile;
      }
    }
    rows.push({
      waveId,
      attempts,
      hpPct,
      durationSec,
      surprise: false,
    });
    if (!won) break;
  }
  return rows;
}

for (const strategy of strategies) {
  console.log(`\n=== ${strategy.name} ===`);
  const rows = run(strategy, 7);
  for (const row of rows) {
    const bar = '█'.repeat(Math.min(40, Math.round(row.hpPct * 40)));
    console.log(
      `w${String(row.waveId).padStart(3)} a${String(row.attempts).padStart(2)} hp ${(row.hpPct * 100).toFixed(0).padStart(3)}% ${row.durationSec.toFixed(0).padStart(3)}s ${bar}`,
    );
  }
}
