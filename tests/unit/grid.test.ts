import { describe, expect, it } from 'vitest';
import {
  alliedCells,
  characterAt,
  emptyAlliedCells,
  firstEmptyAlliedCell,
  isAlliedCell,
  isEnemyCell,
  isInsideBoard,
} from '../../src/game/domain/grid';
import { unit } from './testFixtures';

describe('grid rules', () => {
  it('defines a 6 by 6 board with 12 base allied cells plus the expansion row', () => {
    // The Mirror Invasion update adds a third defender row (row index 5). Without any purchased
    // expansion the playable allied area stays the original 12 cells (rows 3-4).
    expect(alliedCells()).toHaveLength(12);
    expect(alliedCells(6)).toHaveLength(18);
    expect(isInsideBoard(0, 0)).toBe(true);
    expect(isInsideBoard(5, 4)).toBe(true);
    expect(isInsideBoard(5, 5)).toBe(true);
    expect(isInsideBoard(6, 4)).toBe(false);
    expect(isInsideBoard(0, 6)).toBe(false);
    expect(isAlliedCell(0, 3)).toBe(true);
    expect(isEnemyCell(0, 2)).toBe(true);
    expect(isAlliedCell(0, 2)).toBe(false);
  });

  it('finds the first empty allied cell deterministically', () => {
    const characters = [
      unit('unit-1', 'laser-crocodile', 1, 0, 3),
      unit('unit-2', 'laser-crocodile', 1, 1, 3),
    ];
    expect(firstEmptyAlliedCell(characters)).toEqual({ col: 2, row: 3 });
  });

  it('returns null when every allied cell is occupied', () => {
    const characters = [];
    let index = 0;
    for (let row = 3; row <= 4; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        index += 1;
        characters.push(unit(`unit-${index}`, 'laser-crocodile', 1, col, row));
      }
    }
    expect(firstEmptyAlliedCell(characters)).toBeNull();
    expect(emptyAlliedCells(characters)).toHaveLength(0);
  });

  it('finds the character at a cell', () => {
    const characters = [unit('unit-1', 'laser-crocodile', 1, 4, 4)];
    expect(characterAt(characters, 4, 4)?.id).toBe('unit-1');
    expect(characterAt(characters, 3, 3)).toBeNull();
  });
});
