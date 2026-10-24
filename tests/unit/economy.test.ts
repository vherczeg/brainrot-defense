import { describe, expect, it } from 'vitest';
import {
  applyDefeatComfort,
  claimWaveReward,
  purchaseCharacter,
} from '../../src/game/commands/profileCommands';
import { STARTING_COINS, type CharacterInstance } from '../../src/game/domain/types';
import { NOW, profileWith, unit } from './testFixtures';

function fullArmy(): CharacterInstance[] {
  const characters: CharacterInstance[] = [];
  let index = 0;
  for (let row = 3; row <= 4; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      index += 1;
      characters.push(unit(`unit-${index}`, 'laser-crocodile', 1, col, row));
    }
  }
  return characters;
}

describe('purchase economy', () => {
  it('deducts the exact cost and creates a level 1 unit in the first free cell', () => {
    const profile = profileWith([unit('unit-1', 'laser-crocodile', 1, 0, 3)]);
    const result = purchaseCharacter(profile, 'laser-crocodile', NOW + 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.profile.coins).toBe(STARTING_COINS - 100);
    expect(result.value.purchased).toMatchObject({
      typeId: 'laser-crocodile',
      level: 1,
      col: 1,
      row: 3,
    });
    expect(result.value.profile.characters).toHaveLength(2);
    expect(result.value.profile.coins).toBeGreaterThanOrEqual(0);
  });

  it('deducts the scorpion cost exactly', () => {
    const profile = profileWith([]);
    const result = purchaseCharacter(profile, 'lightning-scorpion');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.profile.coins).toBe(STARTING_COINS - 150);
  });

  it('rejects purchases with insufficient coins and leaves state unchanged', () => {
    const profile = profileWith([], { coins: 99 });
    const before = structuredClone(profile);
    const result = purchaseCharacter(profile, 'laser-crocodile', NOW + 3);
    expect(result).toEqual({ ok: false, error: 'insufficient-coins' });
    expect(profile).toEqual(before);
  });

  it('rejects purchases when the board is full', () => {
    const profile = profileWith(fullArmy(), { coins: 1000 });
    const result = purchaseCharacter(profile, 'laser-crocodile');
    expect(result).toEqual({ ok: false, error: 'board-full' });
  });

  it('never produces a negative coin balance', () => {
    let profile = profileWith([], { coins: 0 });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = purchaseCharacter(profile, 'laser-crocodile');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('insufficient-coins');
      profile = result.ok ? result.value.profile : profile;
    }
    expect(profile.coins).toBe(0);
  });

  it('rejects an unknown character type safely', () => {
    const profile = profileWith([]);
    const result = purchaseCharacter(profile, 'unknown' as never);
    expect(result).toEqual({ ok: false, error: 'invalid-character' });
  });
});

describe('wave rewards and retry policy', () => {
  it('claims a wave reward exactly once', () => {
    const profile = profileWith([], { coins: 0 });
    const first = claimWaveReward(profile, 1, NOW + 10);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.firstCompletion).toBe(true);
    expect(first.value.rewardCoins).toBe(120);
    expect(first.value.profile.coins).toBe(120);
    expect(first.value.profile.completedWaves).toEqual([1]);
    expect(first.value.profile.currentWave).toBe(2);
    expect(first.value.profile.unlockedWave).toBe(2);

    const second = claimWaveReward(first.value.profile, 1, NOW + 20);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.firstCompletion).toBe(false);
    expect(second.value.rewardCoins).toBe(0);
    expect(second.value.profile.coins).toBe(120);
    expect(second.value.profile.completedWaves).toEqual([1]);
  });

  it('never advances beyond the final wave', () => {
    const profile = profileWith([], {
      currentWave: 10,
      unlockedWave: 10,
      coins: 0,
      completedWaves: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    });
    const result = claimWaveReward(profile, 10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.profile.currentWave).toBe(10);
    expect(result.value.profile.unlockedWave).toBe(10);
    expect(result.value.profile.completedWaves).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('gives a small comfort reward after defeat so progression cannot deadlock', () => {
    const profile = profileWith([], { coins: 0 });
    const next = applyDefeatComfort(profile);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.value.coins).toBe(20);
    expect(profile.coins).toBe(0);
  });

  it('rejects comfort coins that would exceed the persistence bound', () => {
    const profile = profileWith([], { coins: 1_000_000_000 });
    const next = applyDefeatComfort(profile);
    expect(next.ok).toBe(false);
    expect(profile.coins).toBe(1_000_000_000);
  });
});
