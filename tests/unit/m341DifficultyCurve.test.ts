import { describe, expect, it } from 'vitest';
import {
  mergeCharacters,
  purchaseCharacter,
  resolveBattleRewards,
} from '../../src/game/commands/profileCommands';
import { enemyStats } from '../../src/game/domain/enemies';
import { emptyAlliedCells } from '../../src/game/domain/grid';
import { createInitialProfile } from '../../src/game/domain/state';
import type { EnemyTypeId, PlayerProfile } from '../../src/game/domain/types';
import { getWave } from '../../src/game/domain/waves';
import { createBattleState, runBattleToCompletion } from '../../src/game/simulation/battle';

function runWave(profile: PlayerProfile, waveId: number) {
  const wave = getWave(waveId);
  if (!wave) throw new Error(`missing wave ${waveId}`);
  return runBattleToCompletion(createBattleState(profile.characters, wave, 200_000 + waveId));
}

function claimVictory(profile: PlayerProfile, waveId: number): PlayerProfile {
  const wave = getWave(waveId);
  if (!wave) throw new Error(`missing wave ${waveId}`);
  const result = resolveBattleRewards(
    profile,
    waveId,
    profile.characters.map((character) => character.id),
    2,
  );
  if (!result.ok) throw new Error(`reward failed on wave ${waveId}`);
  return result.value.profile;
}

function findMergePair(profile: PlayerProfile): readonly [string, string] | null {
  const groups = new Map<string, string[]>();
  for (const character of profile.characters) {
    if (character.mergeRank >= 10) continue;
    const key = `${character.typeId}:${character.mergeRank}`;
    groups.set(key, [...(groups.get(key) ?? []), character.id]);
  }
  const candidates = [...groups.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .sort((a, b) => a[0].localeCompare(b[0]));
  for (const [, ids] of candidates) {
    if (ids[0] && ids[1]) return [ids[0], ids[1]];
  }
  return null;
}

function sensiblePrepare(profile: PlayerProfile): PlayerProfile {
  let current = profile;
  const pair = findMergePair(current);
  if (pair) {
    const merged = mergeCharacters(current, pair[0], pair[1], 1);
    if (merged.ok) current = merged.value.profile;
  }
  for (let guard = 0; guard < 20; guard += 1) {
    if (emptyAlliedCells(current.characters).length === 0) break;
    if (current.coins < 100) break;
    const bought = purchaseCharacter(current, 'laser-crocodile', 1);
    if (!bought.ok) break;
    current = bought.value.profile;
  }
  return current;
}

function waveTotals(waveId: number) {
  const wave = getWave(waveId);
  if (!wave) throw new Error(`missing wave ${waveId}`);
  let hp = 0;
  let dps = 0;
  const levels = new Map<EnemyTypeId, number[]>();
  for (const enemy of wave.enemies) {
    const stats = enemyStats(enemy.typeId, enemy.level);
    hp += stats.maxHp;
    dps += stats.attack / stats.attackIntervalSec;
    levels.set(enemy.typeId, [...(levels.get(enemy.typeId) ?? []), enemy.level]);
  }
  for (const [typeId, values] of levels) {
    values.sort((a, b) => a - b);
    levels.set(typeId, values);
  }
  return { hp, dps, levels };
}

describe('M3.4.2 approved wave compositions', () => {
  it('uses the approved enemy types and levels for waves 3, 4, 5, 7, 11, and 17', () => {
    expect(Object.fromEntries(waveTotals(3).levels)).toEqual({
      'mini-brainrot': [1, 2],
      'armored-slug': [2],
    });
    expect(Object.fromEntries(waveTotals(4).levels)).toEqual({
      'mini-brainrot': [2, 2],
      'shadow-runner': [2, 2],
    });
    expect(Object.fromEntries(waveTotals(5).levels)).toEqual({
      'mini-brainrot': [2, 2],
      'armored-slug': [2],
      'shadow-runner': [2, 2],
    });
    expect(Object.fromEntries(waveTotals(7).levels)).toEqual({
      'armored-slug': [3, 3],
      'mini-brainrot': [3, 3, 3],
    });
    expect(Object.fromEntries(waveTotals(11).levels)).toEqual({
      'mini-brainrot': [4, 5, 5, 5],
      'armored-slug': [4],
      'shadow-runner': [4],
    });
    expect(Object.fromEntries(waveTotals(17).levels)).toEqual({
      'mini-brainrot': [6, 6, 6, 6, 6],
      'armored-slug': [6, 6],
      'shadow-runner': [6, 7],
    });
  });

  it('removes the previously identified difficulty dips', () => {
    const wave6 = waveTotals(6);
    const wave7 = waveTotals(7);
    const wave9 = waveTotals(9);
    const wave11 = waveTotals(11);
    const wave16 = waveTotals(16);
    const wave17 = waveTotals(17);

    expect(wave7.hp).toBeGreaterThan(wave6.hp);
    expect(wave7.dps).toBeGreaterThanOrEqual(wave6.dps * 0.95);

    expect(wave11.hp).toBeGreaterThan(wave9.hp);
    expect(wave11.dps).toBeGreaterThan(wave9.dps);

    expect(wave17.hp).toBeGreaterThan(wave16.hp);
    expect(wave17.dps).toBeGreaterThan(wave16.dps);
  });
});

describe('M3.4.2 early-game difficulty benchmarks', () => {
  it('keeps waves 1 and 2 beginner-friendly but makes the untouched army lose by wave 4', () => {
    let profile = createInitialProfile({ profileId: 'm341-untouched', now: 1 });

    const wave1 = runWave(profile, 1);
    expect(wave1.state.status).toBe('victory');
    profile = claimVictory(profile, 1);

    const wave2 = runWave(profile, 2);
    expect(wave2.state.status).toBe('victory');
    profile = claimVictory(profile, 2);

    const wave3 = runWave(profile, 3);
    expect(wave3.state.status).toBe('victory');
    profile = claimVictory(profile, 3);

    const wave4 = runWave(profile, 4);
    expect(wave4.state.status).toBe('defeat');
    expect(wave4.state.units.filter((unit) => unit.team === 'ally' && unit.alive)).toHaveLength(0);
  });

  it('lets one sensible early purchase turn wave 4 into a victory', () => {
    let profile = createInitialProfile({ profileId: 'm341-one-purchase', now: 1 });

    const wave1 = runWave(profile, 1);
    expect(wave1.state.status).toBe('victory');
    profile = claimVictory(profile, 1);

    const bought = purchaseCharacter(profile, 'laser-crocodile', 1);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    profile = bought.value.profile;

    for (const waveId of [2, 3]) {
      const result = runWave(profile, waveId);
      expect(result.state.status, `wave ${waveId}`).toBe('victory');
      profile = claimVictory(profile, waveId);
    }

    const wave4 = runWave(profile, 4);
    expect(wave4.state.status).toBe('victory');
    const survivors = wave4.state.units.filter((unit) => unit.team === 'ally' && unit.alive);
    expect(survivors.length).toBeGreaterThan(0);
  });

  it('lets a sensible purchasing and merging player complete wave 5', () => {
    let profile = createInitialProfile({ profileId: 'm341-sensible', now: 1 });
    let sawMergedUnit = false;

    for (let waveId = 1; waveId <= 5; waveId += 1) {
      profile = sensiblePrepare(profile);
      sawMergedUnit ||= profile.characters.some((character) => character.mergeRank > 1);
      const result = runWave(profile, waveId);
      expect(result.state.status, `wave ${waveId}`).toBe('victory');
      profile = claimVictory(profile, waveId);
    }

    expect(sawMergedUnit).toBe(true);
    expect(profile.completedWaves).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps the boss encounters and existing completion state intact', () => {
    expect(getWave(10)?.isBossWave).toBe(true);
    expect(getWave(20)?.isBossWave).toBe(true);
    expect(getWave(10)?.enemies[0]?.typeId).toBe('mega-brainrot-gorilla');
    expect(getWave(20)?.enemies[0]?.typeId).toBe('green-venom-falcon');
    expect(getWave(10)?.rewardCoins).toBe(500);
    expect(getWave(20)?.rewardCoins).toBe(1200);
  });
});
