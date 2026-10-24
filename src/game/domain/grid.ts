import {
  ALLY_ROW_START,
  BOARD_COLS,
  BOARD_ROWS,
  type CharacterInstance,
  type GridPosition,
} from './types';

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

export function alliedCells(): readonly GridPosition[] {
  const cells: GridPosition[] = [];
  for (let row = ALLY_ROW_START; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      cells.push({ col, row });
    }
  }
  return cells;
}

export function emptyAlliedCells(
  characters: readonly CharacterInstance[],
): readonly GridPosition[] {
  const occupied = occupiedCellKeys(characters);
  return alliedCells().filter((cell) => !occupied.has(cellKey(cell.col, cell.row)));
}

export function firstEmptyAlliedCell(
  characters: readonly CharacterInstance[],
): GridPosition | null {
  return emptyAlliedCells(characters)[0] ?? null;
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
