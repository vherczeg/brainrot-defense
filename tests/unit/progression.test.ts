import { describe, expect, it } from 'vitest';
import {
  ATTACK_GROWTH,
  CHARACTER_DEFINITIONS,
  HP_GROWTH,
  canMergeLevels,
  characterStats,
} from '../../src/game/domain/characters';
import { MAX_CHARACTER_LEVEL } from '../../src/game/domain/types';

describe('character progression', () => {
  it('uses the configured attack and hp formulas', () => {
    const def = CHARACTER_DEFINITIONS['laser-crocodile'];
    const level1 = characterStats('laser-crocodile', 1);
    expect(level1.attack).toBe(def.baseAttack);
    expect(level1.maxHp).toBe(def.baseHp);

    const level4 = characterStats('laser-crocodile', 4);
    expect(level4.attack).toBe(Math.round(def.baseAttack * Math.pow(ATTACK_GROWTH, 3)));
    expect(level4.maxHp).toBe(Math.round(def.baseHp * Math.pow(HP_GROWTH, 3)));
  });

  it('clamps invalid and out-of-range levels safely', () => {
    const atMax = characterStats('laser-crocodile', MAX_CHARACTER_LEVEL);
    expect(characterStats('laser-crocodile', 0)).toEqual(characterStats('laser-crocodile', 1));
    expect(characterStats('laser-crocodile', 999)).toEqual(atMax);
    expect(characterStats('laser-crocodile', Number.NaN)).toEqual(
      characterStats('laser-crocodile', 1),
    );
  });

  it('keeps stats bounded and finite', () => {
    const stats = characterStats('laser-crocodile', MAX_CHARACTER_LEVEL);
    expect(Number.isFinite(stats.attack)).toBe(true);
    expect(Number.isFinite(stats.maxHp)).toBe(true);
    expect(stats.attack).toBeLessThanOrEqual(1_000_000_000);
    expect(stats.maxHp).toBeLessThanOrEqual(1_000_000_000);
  });

  it('only allows equal levels below the cap to merge', () => {
    expect(canMergeLevels(1, 1)).toBe(true);
    expect(canMergeLevels(3, 3)).toBe(true);
    expect(canMergeLevels(1, 2)).toBe(false);
    expect(canMergeLevels(MAX_CHARACTER_LEVEL, MAX_CHARACTER_LEVEL)).toBe(false);
  });
});
