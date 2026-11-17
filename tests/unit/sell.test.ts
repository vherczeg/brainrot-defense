import { describe, expect, it } from 'vitest';
import {
  mergeCharacters,
  purchaseCharacter,
  sellCharacter,
} from '../../src/game/commands/profileCommands';
import { sellRefund } from '../../src/game/domain/characters';
import { isPositionFree } from '../../src/game/domain/grid';
import { MAX_COINS, type CharacterInstance } from '../../src/game/domain/types';
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

describe('sell refund formula', () => {
  it('refunds half of the rank-1 purchase price as an integer', () => {
    expect(sellRefund('laser-crocodile', 1)).toBe(50);
    expect(sellRefund('lightning-scorpion', 1)).toBe(75);
  });

  it('values higher merge ranks by their full purchase investment', () => {
    expect(sellRefund('laser-crocodile', 2)).toBe(100);
    expect(sellRefund('laser-crocodile', 3)).toBe(200);
    expect(sellRefund('laser-crocodile', 4)).toBe(400);
    expect(sellRefund('laser-crocodile', 10)).toBe(25_600);
    expect(sellRefund('lightning-scorpion', 10)).toBe(38_400);
  });

  it('never refunds more than the gold invested in the merge lineage', () => {
    for (let rank = 1; rank <= 10; rank += 1) {
      const invested = 100 * 2 ** (rank - 1);
      expect(sellRefund('laser-crocodile', rank)).toBeLessThanOrEqual(invested);
    }
  });
});

describe('sellCharacter', () => {
  it('sells a rank-1 Laser Crocodile and frees exactly its cell', () => {
    const profile = profileWith([unit('unit-1', 'laser-crocodile', 1, 2, 4)], { coins: 100 });
    const result = sellCharacter(profile, 'unit-1', NOW + 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.refund).toBe(50);
    expect(result.value.profile.coins).toBe(150);
    expect(result.value.profile.characters).toHaveLength(0);
    expect(isPositionFree(result.value.profile.characters, 2, 4)).toBe(true);
    expect(result.value.profile.lastSavedAt).toBe(NOW + 1);
  });

  it('sells a rank-1 Lightning Scorpion for its own refund', () => {
    const profile = profileWith([unit('unit-1', 'lightning-scorpion', 1, 0, 3)], { coins: 0 });
    const result = sellCharacter(profile, 'unit-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.refund).toBe(75);
    expect(result.value.profile.coins).toBe(75);
  });

  it('sells a higher-rank merged unit for a rank-aware refund', () => {
    const profile = profileWith(
      [
        unit('unit-1', 'laser-crocodile', 3, 0, 3, 500),
        unit('unit-2', 'laser-crocodile', 3, 1, 3, 900),
      ],
      { coins: 0 },
    );
    const merged = mergeCharacters(profile, 'unit-1', 'unit-2');
    if (!merged.ok) throw new Error('merge failed');
    expect(merged.value.merged.mergeRank).toBe(4);

    const result = sellCharacter(merged.value.profile, merged.value.merged.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.refund).toBe(400);
    expect(result.value.profile.coins).toBe(400);
    expect(result.value.profile.characters).toHaveLength(0);
  });

  it('sells a high-level unit without changing the deterministic refund', () => {
    const profile = profileWith([unit('unit-1', 'laser-crocodile', 2, 0, 3, 245_025)], {
      coins: 10,
    });
    const result = sellCharacter(profile, 'unit-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.refund).toBe(100);
    expect(result.value.profile.coins).toBe(110);
  });

  it('works when every defender cell is occupied', () => {
    const profile = profileWith(fullArmy(), { coins: 0 });
    const result = sellCharacter(profile, 'unit-7');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.profile.characters).toHaveLength(11);
    expect(result.value.refund).toBe(50);
    expect(result.value.profile.coins).toBe(50);
  });

  it('rejects an unknown or already sold unit without changing the profile', () => {
    const profile = profileWith([unit('unit-1', 'laser-crocodile', 1, 0, 3)], { coins: 100 });
    const before = structuredClone(profile);
    const result = sellCharacter(profile, 'enemy-1');
    expect(result).toEqual({ ok: false, error: 'not-found', detail: 'enemy-1' });
    expect(profile).toEqual(before);
  });

  it('rejects a refund that would exceed the coin cap', () => {
    const profile = profileWith([unit('unit-1', 'laser-crocodile', 10, 0, 3)], {
      coins: MAX_COINS,
    });
    const result = sellCharacter(profile, 'unit-1');
    expect(result).toEqual({ ok: false, error: 'coin-overflow' });
    expect(profile.characters).toHaveLength(1);
  });

  it('cannot create unlimited gold through buy/sell or merge/sell cycles', () => {
    let profile = profileWith([], { coins: 1000 });
    const startingCoins = profile.coins;

    const boughtA = purchaseCharacter(profile, 'laser-crocodile');
    if (!boughtA.ok) throw new Error('purchase A failed');
    const soldA = sellCharacter(boughtA.value.profile, boughtA.value.purchased.id);
    if (!soldA.ok) throw new Error('sell A failed');
    profile = soldA.value.profile;
    expect(profile.coins).toBe(startingCoins - 50);

    const boughtB = purchaseCharacter(profile, 'laser-crocodile');
    if (!boughtB.ok) throw new Error('purchase B failed');
    const boughtC = purchaseCharacter(boughtB.value.profile, 'laser-crocodile');
    if (!boughtC.ok) throw new Error('purchase C failed');
    const merged = mergeCharacters(
      boughtC.value.profile,
      boughtB.value.purchased.id,
      boughtC.value.purchased.id,
    );
    if (!merged.ok) throw new Error('merge failed');
    const soldMerged = sellCharacter(merged.value.profile, merged.value.merged.id);
    if (!soldMerged.ok) throw new Error('sell merged failed');
    expect(soldMerged.value.profile.coins).toBe(startingCoins - 150);
    expect(soldMerged.value.profile.coins).toBeLessThan(startingCoins);
  });
});
