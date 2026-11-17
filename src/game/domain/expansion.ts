import { MAX_EXPANSION_CELLS } from './types';

export const EXPANSION_CELL_COST = 10_000;

/**
 * The cost of the next expansion purchase. Purchase N (1-indexed) costs N × 10,000 gold, so the
 * full six-cell expansion totals 210,000 gold.
 */
export function nextExpansionCost(expansionCells: number): number | null {
  const count = Math.min(MAX_EXPANSION_CELLS, Math.max(0, Math.floor(expansionCells)));
  if (count >= MAX_EXPANSION_CELLS) return null;
  return (count + 1) * EXPANSION_CELL_COST;
}

export function totalExpansionCost(expansionCells: number): number {
  const count = Math.min(MAX_EXPANSION_CELLS, Math.max(0, Math.floor(expansionCells)));
  let total = 0;
  for (let index = 1; index <= count; index += 1) {
    total += index * EXPANSION_CELL_COST;
  }
  return total;
}
