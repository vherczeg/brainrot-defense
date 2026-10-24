import {
  claimWaveReward,
  mergeCharacters,
  purchaseCharacter,
} from '../src/game/commands/profileCommands';
import { characterStats } from '../src/game/domain/characters';
import { emptyAlliedCells } from '../src/game/domain/grid';
import { createInitialProfile } from '../src/game/domain/state';
import type { PlayerProfile } from '../src/game/domain/types';
import { getWave } from '../src/game/domain/waves';
import { createBattleState, runBattleToCompletion } from '../src/game/simulation/battle';

interface StrategyOptions {
  readonly merge: boolean;
  readonly buysPerPrep: number;
}

function buyAndMerge(profile: PlayerProfile, options: StrategyOptions): PlayerProfile {
  let current = profile;
  let purchases = 0;
  for (let guard = 0; guard < 500; guard += 1) {
    const free = emptyAlliedCells(current.characters).length;
    if (free > 0 && current.coins >= 100 && purchases < options.buysPerPrep) {
      const purchase = purchaseCharacter(current, 'laser-crocodile');
      if (purchase.ok) {
        current = purchase.value.profile;
        purchases += 1;
        continue;
      }
    }
    if (options.merge) {
      const merge = possiblyMerge(current);
      if (merge) {
        current = merge;
        continue;
      }
    }
    if (free > 0 && current.coins < 100) break;
    break;
  }
  return current;
}

function mergeLowestPair(profile: PlayerProfile): PlayerProfile | null {
  const byKey = new Map<string, string[]>();
  for (const character of profile.characters) {
    const key = `${character.typeId}:${character.level}`;
    const group = byKey.get(key) ?? [];
    group.push(character.id);
    byKey.set(key, group);
  }
  const candidates = [...byKey.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .sort((a, b) => a[0].localeCompare(b[0]));
  for (const [, ids] of candidates) {
    const source = ids[0];
    const target = ids[1];
    if (source && target) {
      const result = mergeCharacters(profile, source, target);
      if (result.ok) return result.value.profile;
    }
  }
  return null;
}

function smartSpend(profile: PlayerProfile): PlayerProfile {
  let current = profile;
  for (let guard = 0; guard < 1000; guard += 1) {
    const free = emptyAlliedCells(current.characters).length;
    if (free > 0 && current.coins >= 100) {
      const purchase = purchaseCharacter(current, 'laser-crocodile');
      if (purchase.ok) {
        current = purchase.value.profile;
        continue;
      }
    }
    if (free === 0 && current.coins >= 100) {
      const merge = mergeLowestPair(current);
      if (merge) {
        current = merge;
        continue;
      }
    }
    break;
  }
  return current;
}

function possiblyMerge(profile: PlayerProfile): PlayerProfile | null {
  const byKey = new Map<string, string[]>();
  for (const character of profile.characters) {
    const key = `${character.typeId}:${character.level}`;
    const group = byKey.get(key) ?? [];
    group.push(character.id);
    byKey.set(key, group);
  }
  const candidates = [...byKey.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .sort((a, b) => b[0].localeCompare(a[0]));
  for (const [, ids] of candidates) {
    const source = ids[0];
    const target = ids[1];
    if (source && target) {
      const result = mergeCharacters(profile, source, target);
      if (result.ok) return result.value.profile;
    }
  }
  return null;
}

function armySummary(profile: PlayerProfile): string {
  const counts = new Map<string, number>();
  let power = 0;
  for (const character of profile.characters) {
    const key = `${character.typeId === 'laser-crocodile' ? 'K' : 'S'}${character.level}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const stats = characterStats(character.typeId, character.level);
    power += stats.attack + stats.maxHp / 10;
  }
  return `${profile.characters.length} egység [${[...counts.entries()]
    .map(([key, value]) => `${key}×${value}`)
    .join(', ')}] Erő=${power.toFixed(0)}`;
}

function simulate(options: StrategyOptions, maxAttemptsPerWave = 30): void {
  let profile = createInitialProfile({ profileId: 'sim', name: 'Sim', now: 1 });
  console.log(`\n=== Stratégia: merge=${options.merge} buys=${options.buysPerPrep} ===`);
  for (let waveId = 1; waveId <= 10; waveId += 1) {
    const wave = getWave(waveId);
    if (!wave) throw new Error('missing wave');
    let attempts = 0;
    let won = false;
    while (!won && attempts < maxAttemptsPerWave) {
      attempts += 1;
      profile = buyAndMerge(profile, options);
      const battle = createBattleState(profile.characters, wave, attempts);
      const result = runBattleToCompletion(battle);
      if (result.state.status === 'victory') {
        const claimed = claimWaveReward(profile, waveId, 2);
        if (!claimed.ok) throw new Error('reward failed');
        profile = claimed.value.profile;
        won = true;
        console.log(
          `Hullám ${waveId}: GYŐZELEM (${attempts}. próba) ${result.state.elapsedSec.toFixed(
            1,
          )}s, ${armySummary(profile)}, érme=${profile.coins}`,
        );
      } else if (attempts === 1) {
        console.log(
          `Hullám ${waveId}: vereség (${result.state.elapsedSec.toFixed(1)}s), ${armySummary(
            profile,
          )}`,
        );
      }
      if (!won) {
        profile = {
          ...profile,
          coins: profile.coins + 20,
          currentWave: waveId,
        };
      }
    }
    if (!won) {
      console.log(`Hullám ${waveId}: NEM TELJESÍTHETŐ ${attempts} próbából`);
      return;
    }
  }
  console.log('Mind a 10 hullám teljesítve!');
}

simulate({ merge: false, buysPerPrep: 99 }, 1);
simulate({ merge: true, buysPerPrep: 99 }, 1);
simulate({ merge: true, buysPerPrep: 2 }, 30);

function simulateSmart(): void {
  let profile = createInitialProfile({ profileId: 'smart', name: 'Smart', now: 1 });
  console.log('\n=== Stratégia: okos (tele pakol, majd egyesít) ===');
  for (let waveId = 1; waveId <= 10; waveId += 1) {
    const wave = getWave(waveId);
    if (!wave) throw new Error('missing wave');
    let attempts = 0;
    let won = false;
    while (!won && attempts < 30) {
      attempts += 1;
      profile = smartSpend(profile);
      const result = runBattleToCompletion(createBattleState(profile.characters, wave, attempts));
      if (result.state.status === 'victory') {
        const claimed = claimWaveReward(profile, waveId, 2);
        if (!claimed.ok) throw new Error('reward failed');
        profile = claimed.value.profile;
        won = true;
        console.log(
          `Hullám ${waveId}: GYŐZELEM (${attempts}. próba) ${result.state.elapsedSec.toFixed(
            1,
          )}s, ${armySummary(profile)}, érme=${profile.coins}`,
        );
      } else if (attempts === 1) {
        console.log(`Hullám ${waveId}: vereség, ${armySummary(profile)}`);
      }
      if (!won) profile = { ...profile, coins: profile.coins + 20, currentWave: waveId };
    }
    if (!won) {
      console.log(`Hullám ${waveId}: NEM TELJESÍTHETŐ`);
      return;
    }
  }
  console.log('Mind a 10 hullám teljesítve!');
}
simulateSmart();
