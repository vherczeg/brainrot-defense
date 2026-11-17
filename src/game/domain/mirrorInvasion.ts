import { ENEMY_DEFINITIONS } from './enemies';
import { EXPANSION_COLUMN_ORDER } from './grid';
import type { WaveDefinition, WaveEnemyConfig } from './types';
import { getWaveForProfile } from './waves';

/**
 * TÜKÖRINVÁZIÓ (Mirror Invasion).
 *
 * Every purchased defender cell also strengthens the enemy: each applicable wave receives one
 * additional regular enemy, and the enemy's expansion is made visible on the battlefield.
 *
 * The extra enemies reuse the actual enemy types and scaling of the wave they join, so the
 * mechanic stays predictable and fair: the player trades extra space for a slightly larger army
 * to defeat.
 */

const ENEMY_MIRROR_ROWS = [2, 1, 0] as const;

export function mirrorEnemyCount(expansionCells: number): number {
  if (!Number.isFinite(expansionCells)) return 0;
  return Math.min(6, Math.max(0, Math.floor(expansionCells)));
}

function isSurpriseBossWave(wave: WaveDefinition): boolean {
  return (
    wave.enemies.length === 1 &&
    (ENEMY_DEFINITIONS[wave.enemies[0]!.typeId]?.isSurpriseBoss ?? false)
  );
}

export function applyMirrorInvasion(wave: WaveDefinition, expansionCells: number): WaveDefinition {
  const count = mirrorEnemyCount(expansionCells);
  if (count === 0) return wave;

  // A solo surprise-boss encounter keeps its unique identity: no extra minions.
  if (isSurpriseBossWave(wave)) return wave;

  const regulars = wave.enemies.filter((enemy) => !ENEMY_DEFINITIONS[enemy.typeId].isBoss);
  if (regulars.length === 0) return wave;

  const occupied = new Set(wave.enemies.map((enemy) => `${enemy.col},${enemy.row}`));
  const extras: WaveEnemyConfig[] = [];
  for (let index = 0; index < count; index += 1) {
    const template = regulars[index % regulars.length]!;
    const cell = findMirrorCell(occupied);
    if (!cell) break;
    occupied.add(`${cell.col},${cell.row}`);
    extras.push({
      typeId: template.typeId,
      level: template.level,
      col: cell.col,
      row: cell.row,
    });
  }

  return { ...wave, enemies: [...wave.enemies, ...extras] };
}

function findMirrorCell(occupied: ReadonlySet<string>): { col: number; row: number } | null {
  for (const row of ENEMY_MIRROR_ROWS) {
    for (const col of EXPANSION_COLUMN_ORDER) {
      const key = `${col},${row}`;
      if (!occupied.has(key)) return { col, row };
    }
  }
  for (let row = ENEMY_MIRROR_ROWS[0]!; row >= 0; row -= 1) {
    for (let col = 0; col < 6; col += 1) {
      const key = `${col},${row}`;
      if (!occupied.has(key)) return { col, row };
    }
  }
  return null;
}

/**
 * Resolves the wave a profile actually fights: surprise-boss overlay first, then the Mirror
 * Invasion enemy expansion.
 */
export function resolveWave(
  profile: { readonly profileId: string; readonly expansionCells: number },
  waveId: number,
): WaveDefinition | null {
  const wave = getWaveForProfile(profile.profileId, waveId);
  if (!wave) return null;
  return applyMirrorInvasion(wave, profile.expansionCells);
}
