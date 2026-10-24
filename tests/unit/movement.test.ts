import { describe, expect, it } from 'vitest';
import { moveCharacter } from '../../src/game/commands/profileCommands';
import { NOW, profileWith, unit } from './testFixtures';

describe('movement rules', () => {
  it('moves a unit into an empty allied cell and preserves its identity and level', () => {
    const profile = profileWith([unit('unit-1', 'laser-crocodile', 3, 0, 3)]);
    const result = moveCharacter(profile, 'unit-1', 5, 4, NOW + 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.characters[0]).toMatchObject({
      id: 'unit-1',
      typeId: 'laser-crocodile',
      level: 3,
      col: 5,
      row: 4,
    });
    expect(result.value.lastSavedAt).toBe(NOW + 1);
  });

  it('treats a move to the same cell as an unchanged state', () => {
    const profile = profileWith([unit('unit-1', 'laser-crocodile', 1, 2, 4)]);
    const result = moveCharacter(profile, 'unit-1', 2, 4, NOW + 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(profile);
  });

  it('rejects enemy cells, out-of-bounds cells, fractional cells, and NaN', () => {
    const profile = profileWith([unit('unit-1', 'laser-crocodile', 1, 0, 3)]);
    const before = structuredClone(profile);
    const targets = [
      [0, 2],
      [5, 2],
      [6, 4],
      [-1, 3],
      [0.5, 3],
      [Number.NaN, 3],
    ] as const;
    for (const [col, row] of targets) {
      expect(moveCharacter(profile, 'unit-1', col, row).ok).toBe(false);
    }
    expect(profile).toEqual(before);
  });

  it('rejects occupied cells and missing units without changing state', () => {
    const profile = profileWith([
      unit('unit-1', 'laser-crocodile', 1, 0, 3),
      unit('unit-2', 'laser-crocodile', 1, 1, 3),
    ]);
    const before = structuredClone(profile);
    expect(moveCharacter(profile, 'unit-1', 1, 3)).toEqual({
      ok: false,
      error: 'cell-occupied',
    });
    expect(moveCharacter(profile, 'unit-999', 2, 3)).toMatchObject({
      ok: false,
      error: 'not-found',
    });
    expect(profile).toEqual(before);
  });

  it('is idempotent when the same move is repeated', () => {
    const profile = profileWith([unit('unit-1', 'laser-crocodile', 1, 0, 3)]);
    const first = moveCharacter(profile, 'unit-1', 1, 3, NOW + 1);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = moveCharacter(first.value, 'unit-1', 1, 3, NOW + 2);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value).toBe(first.value);
  });
});
