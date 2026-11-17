import {
  ALLY_ROW_START,
  BOARD_COLS,
  BOARD_ROWS,
  MAX_EXPANSION_CELLS,
  type CharacterInstance,
  type GridPosition,
} from './types';

export const EXPANSION_ROW = BOARD_ROWS - 1;

/**
 * The purchase order for the third defender row, from the first unlocked cell to the last.
 * Columns C → D → B → E → F → A (indices 2, 3, 1, 4, 5, 0), creating an approximately centered
 * expansion without moving already unlocked cells.
 */
export const EXPANSION_COLUMN_ORDER: readonly number[] = [2, 3, 1, 4, 5, 0];

export function expansionCellCount(expansionCells: number): number {
  if (!Number.isFinite(expansionCells)) return 0;
  return Math.min(MAX_EXPANSION_CELLS, Math.max(0, Math.floor(expansionCells)));
}

export function unlockedExpansionColumns(expansionCells: number): readonly number[] {
  return EXPANSION_COLUMN_ORDER.slice(0, expansionCellCount(expansionCells));
}

export function isExpansionCell(row: number): boolean {
  return row === EXPANSION_ROW;
}

export function isInsideBoard(col: number, row: number): boolean {
  return (
    Number.isInteger(col) &&
    Number.isInteger(row) &&
    col >= 0 &&
    col < BOARD_COLS &&
    row >= 0 &&
    row < BOARD_ROWS
  );
}

export function isAlliedCell(col: number, row: number): boolean {
  return isInsideBoard(col, row) && row >= ALLY_ROW_START;
}

/** True when a cell is a playable defender cell given the profile's purchased expansion. */
export function isPlayableAlliedCell(col: number, row: number, expansionCells = 0): boolean {
  if (!isAlliedCell(col, row)) return false;
  if (!isExpansionCell(row)) return true;
  return unlockedExpansionColumns(expansionCells).includes(col);
}

export function isEnemyCell(col: number, row: number): boolean {
  return isInsideBoard(col, row) && row < ALLY_ROW_START;
}

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function sameCell(a: GridPosition, b: GridPosition): boolean {
  return a.col === b.col && a.row === b.row;
}

export function characterAt(
  characters: readonly CharacterInstance[],
  col: number,
  row: number,
): CharacterInstance | null {
  return characters.find((character) => character.col === col && character.row === row) ?? null;
}

export function occupiedCellKeys(characters: readonly CharacterInstance[]): ReadonlySet<string> {
  return new Set(characters.map((character) => cellKey(character.col, character.row)));
}

export function alliedCells(expansionCells = 0): readonly GridPosition[] {
  const cells: GridPosition[] = [];
  for (let row = ALLY_ROW_START; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      if (row === EXPANSION_ROW && !unlockedExpansionColumns(expansionCells).includes(col)) {
        continue;
      }
      cells.push({ col, row });
    }
  }
  return cells;
}

/** The number of playable defender cells for a profile with the given expansion count. */
export function playableAlliedCellCount(expansionCells = 0): number {
  return alliedCells(expansionCells).length;
}

export function emptyAlliedCells(
  characters: readonly CharacterInstance[],
  expansionCells = 0,
): readonly GridPosition[] {
  const occupied = occupiedCellKeys(characters);
  return alliedCells(expansionCells).filter((cell) => !occupied.has(cellKey(cell.col, cell.row)));
}

export function firstEmptyAlliedCell(
  characters: readonly CharacterInstance[],
  expansionCells = 0,
): GridPosition | null {
  return emptyAlliedCells(characters, expansionCells)[0] ?? null;
}

export function isPositionFree(
  characters: readonly CharacterInstance[],
  col: number,
  row: number,
): boolean {
  return characterAt(characters, col, row) === null;
}

export function distanceBetween(a: GridPosition, b: GridPosition): number {
  const dx = a.col - b.col;
  const dy = a.row - b.row;
  return Math.sqrt(dx * dx + dy * dy);
}
