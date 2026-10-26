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

  it('rewards increase smoothly across ordinary waves', () => {
    const ordinaryRewards = WAVE_DEFINITIONS.filter((wave) => !wave.isBossWave).map(
      (wave) => wave.rewardCoins,
    );
    for (let index = 1; index < ordinaryRewards.length; index += 1) {
      const previous = ordinaryRewards[index - 1];
      const current = ordinaryRewards[index];
      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      if (previous !== undefined && current !== undefined) {
        expect(current).toBeGreaterThan(previous);
        expect(current - previous).toBeLessThanOrEqual(75);
      }
    }
  });

  it('boss rewards are attractive milestones without breaking the curve', () => {
    const boss10 = getWave(10);
    const boss20 = getWave(20);
    const wave9 = getWave(9);
    const wave11 = getWave(11);
    const wave19 = getWave(19);
    expect(boss10?.rewardCoins).toBe(500);
    expect(boss20?.rewardCoins).toBe(1200);
    expect(boss10?.rewardCoins).toBeGreaterThan(wave9?.rewardCoins ?? 0);
    expect(boss10?.rewardCoins).toBeGreaterThan(wave11?.rewardCoins ?? 0);
    expect(boss20?.rewardCoins).toBeGreaterThan(wave19?.rewardCoins ?? 0);
    expect((boss10?.rewardCoins ?? 0) / (wave9?.rewardCoins ?? 1)).toBeLessThanOrEqual(1.5);
    expect((boss20?.rewardCoins ?? 0) / (wave19?.rewardCoins ?? 1)).toBeLessThanOrEqual(1.5);
  });

  it('only marks waves 10 and 20 as boss waves', () => {
    expect(WAVE_DEFINITIONS.filter((wave) => wave.isBossWave).map((wave) => wave.id)).toEqual([
      10, 20,
    ]);
  });

  it('splits every reward into a 35% replay reward and a first-clear bonus', () => {
    for (const wave of WAVE_DEFINITIONS) {
      const replay = waveReplayRewardCoins(wave);
      const bonus = waveFirstCompletionBonus(wave);
      expect(replay + bonus).toBe(wave.rewardCoins);
      expect(replay).toBe(Math.floor((wave.rewardCoins * 35) / 100));
      expect(replay).toBeGreaterThan(0);
      expect(bonus).toBeGreaterThan(0);
    }
  });
});
