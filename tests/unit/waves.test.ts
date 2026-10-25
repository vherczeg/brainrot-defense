import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS } from '../../src/game/domain/enemies';
import { isAlliedCell, isInsideBoard } from '../../src/game/domain/grid';
import { TOTAL_WAVES } from '../../src/game/domain/types';
import {
  LAST_WAVE_ID,
  WAVE_DEFINITIONS,
  getWave,
  isValidEnemyPosition,
  waveFirstCompletionBonus,
  waveReplayRewardCoins,
} from '../../src/game/domain/waves';

describe('wave definitions', () => {
  it('contains exactly ten valid waves in order', () => {
    expect(WAVE_DEFINITIONS).toHaveLength(TOTAL_WAVES);
    expect(WAVE_DEFINITIONS.map((wave) => wave.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(LAST_WAVE_ID).toBe(10);
  });

  it('places every enemy in the enemy deployment area', () => {
    for (const wave of WAVE_DEFINITIONS) {
      const positions = new Set<string>();
      for (const enemy of wave.enemies) {
        expect(isInsideBoard(enemy.col, enemy.row)).toBe(true);
        expect(isAlliedCell(enemy.col, enemy.row)).toBe(false);
        expect(isValidEnemyPosition(enemy.col, enemy.row)).toBe(true);
        const key = `${enemy.col},${enemy.row}`;
        expect(positions.has(key)).toBe(false);
        positions.add(key);
        expect(ENEMY_DEFINITIONS[enemy.typeId]).toBeDefined();
        expect(enemy.level).toBeGreaterThanOrEqual(1);
      }
      expect(wave.enemies.length).toBeGreaterThan(0);
      expect(wave.rewardCoins).toBeGreaterThan(0);
    }
  });

  it('includes the Mega Brainrot Gorilla as the final boss', () => {
    const finalWave = getWave(10);
    expect(finalWave?.isBossWave).toBe(true);
    expect(finalWave?.enemies.some((enemy) => enemy.typeId === 'mega-brainrot-gorilla')).toBe(true);
    expect(finalWave?.nameHu).toContain('Mega Brainrot Gorilla');
  });

  it('rewards increase with wave difficulty', () => {
    for (let index = 1; index < WAVE_DEFINITIONS.length; index += 1) {
      const previous = WAVE_DEFINITIONS[index - 1];
      const current = WAVE_DEFINITIONS[index];
      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      if (previous && current) {
        expect(current.rewardCoins).toBeGreaterThan(previous.rewardCoins);
      }
    }
  });

  it('does not include a boss before wave ten', () => {
    expect(WAVE_DEFINITIONS.slice(0, 9).some((wave) => wave.isBossWave)).toBe(false);
  });

  it('splits every reward into a replay half and a one-time first bonus half', () => {
    for (const wave of WAVE_DEFINITIONS) {
      const replay = waveReplayRewardCoins(wave);
      const bonus = waveFirstCompletionBonus(wave);
      expect(replay + bonus).toBe(wave.rewardCoins);
      expect(replay).toBeGreaterThan(0);
      expect(bonus).toBeGreaterThan(0);
    }
  });
});
