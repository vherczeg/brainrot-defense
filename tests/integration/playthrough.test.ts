import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  claimWaveReward,
  mergeCharacters,
  purchaseCharacter,
  resolveBattleRewards,
} from '../../src/game/commands/profileCommands';
import { emptyAlliedCells } from '../../src/game/domain/grid';
import { createInitialProfile } from '../../src/game/domain/state';
import type { PlayerProfile } from '../../src/game/domain/types';
import { WAVE_DEFINITIONS } from '../../src/game/domain/waves';
import { createBattleState, runBattleToCompletion } from '../../src/game/simulation/battle';
import { IndexedDbProfileRepository } from '../../src/persistence/indexeddb/profileRepository';

function mergeLowestPair(profile: PlayerProfile): PlayerProfile | null {
  const groups = new Map<string, string[]>();
  for (const character of profile.characters) {
    const key = `${character.typeId}:${character.mergeRank}`;
    const ids = groups.get(key) ?? [];
    ids.push(character.id);
    groups.set(key, ids);
  }
  const candidates = [...groups.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .sort((a, b) => a[0].localeCompare(b[0]));
  for (const [, ids] of candidates) {
    const source = ids[0];
    const target = ids[1];
    if (!source || !target) continue;
    const result = mergeCharacters(profile, source, target, 1);
    if (result.ok) return result.value.profile;
  }
  return null;
}

function spendCoins(profile: PlayerProfile): PlayerProfile {
  let current = profile;
  for (let guard = 0; guard < 500; guard += 1) {
    const free = emptyAlliedCells(current.characters).length;
    if (free > 0 && current.coins >= 100) {
      const purchase = purchaseCharacter(current, 'laser-crocodile', 1);
      if (purchase.ok) {
        current = purchase.value.profile;
        continue;
      }
    }
    if (free === 0 && current.coins >= 100) {
      const merged = mergeLowestPair(current);
      if (merged) {
        current = merged;
        continue;
      }
    }
    break;
  }
  return current;
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('complete M0 playthrough', () => {
  it('can complete all ten waves with an ordinary merge strategy', () => {
    let profile = createInitialProfile({
      profileId: 'playthrough',
      name: 'Ábel',
      now: 1,
      reducedMotion: true,
    });

    for (const wave of WAVE_DEFINITIONS) {
      profile = spendCoins(profile);
      const roster = profile.characters.map((character) => character.id);
      const battle = createBattleState(profile.characters, wave, wave.id * 1000);
      const result = runBattleToCompletion(battle);
      expect(result.state.status, `wave ${wave.id}`).toBe('victory');
      const resolved = resolveBattleRewards(profile, wave.id, roster, wave.id);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;
      profile = resolved.value.profile;
    }

    expect(profile.completedWaves).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(profile.currentWave).toBe(10);
    expect(profile.unlockedWave).toBe(10);
    expect(profile.coins).toBeGreaterThan(0);
    profile.characters.forEach((character) => {
      expect(character.mergeRank).toBeGreaterThanOrEqual(1);
      expect(character.row).toBeGreaterThanOrEqual(3);
    });
  });

  it('persists the played-through profile and reloads it intact', async () => {
    const repository = new IndexedDbProfileRepository();
    let profile = createInitialProfile({
      profileId: 'persist-playthrough',
      name: 'Ábel',
      now: 1,
    });
    for (const wave of WAVE_DEFINITIONS.slice(0, 4)) {
      profile = spendCoins(profile);
      const roster = profile.characters.map((character) => character.id);
      const result = runBattleToCompletion(createBattleState(profile.characters, wave, wave.id));
      expect(result.state.status).toBe('victory');
      const resolved = resolveBattleRewards(profile, wave.id, roster, wave.id);
      if (!resolved.ok) throw new Error('claim failed');
      profile = resolved.value.profile;
    }

    expect((await repository.saveProfile(profile)).ok).toBe(true);
    const loaded = await repository.loadProfile(profile.profileId);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    expect(loaded.value).toEqual(profile);
    expect(loaded.value.currentWave).toBe(5);
    expect(loaded.value.completedWaves).toEqual([1, 2, 3, 4]);
    expect(loaded.value.characters.length).toBe(profile.characters.length);
    expect(loaded.value.characters.map((character) => character.mergeRank)).toEqual(
      profile.characters.map((character) => character.mergeRank),
    );
    expect(loaded.value.characters.map((character) => character.totalXp)).toEqual(
      profile.characters.map((character) => character.totalXp),
    );
  });

  it('rewards each wave only once even after repeated battles', () => {
    let profile = createInitialProfile({ profileId: 'double', name: 'Ábel', now: 1 });
    const first = claimWaveReward(profile, 1);
    if (!first.ok) throw new Error('claim failed');
    profile = first.value.profile;
    const coinsAfterFirst = profile.coins;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const repeat = claimWaveReward(profile, 1);
      if (!repeat.ok) throw new Error('claim failed');
      profile = repeat.value.profile;
    }
    expect(profile.coins).toBe(coinsAfterFirst);
    expect(profile.completedWaves).toEqual([1]);
  });
});
