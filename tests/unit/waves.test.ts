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
  it('contains exactly twenty valid waves in order', () => {
    expect(WAVE_DEFINITIONS).toHaveLength(TOTAL_WAVES);
    expect(WAVE_DEFINITIONS.map((wave) => wave.id)).toEqual(
      Array.from({ length: TOTAL_WAVES }, (_, index) => index + 1),
    );
    expect(LAST_WAVE_ID).toBe(20);
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

  it('includes the Mega Brainrot Gorilla as the wave 10 boss', () => {
    const finalWave = getWave(10);
    expect(finalWave?.isBossWave).toBe(true);
    expect(finalWave?.enemies.some((enemy) => enemy.typeId === 'mega-brainrot-gorilla')).toBe(true);
    expect(finalWave?.nameHu).toContain('Mega Brainrot Gorilla');
  });

  it('includes the Green Venom Falcon as the wave 20 boss', () => {
    const finalWave = getWave(20);
    expect(finalWave?.isBossWave).toBe(true);
    expect(finalWave?.enemies.some((enemy) => enemy.typeId === 'green-venom-falcon')).toBe(true);
    expect(finalWave?.nameHu).toContain('Zöld Méreg Sólyom');
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

  it('only marks waves 10 and 20 as boss waves', () => {
    expect(WAVE_DEFINITIONS.filter((wave) => wave.isBossWave).map((wave) => wave.id)).toEqual([
      10, 20,
    ]);
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
