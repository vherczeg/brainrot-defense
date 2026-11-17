import { describe, expect, it } from 'vitest';
import { CHAPTER_DEFINITIONS, chapterOfWave } from '../../src/game/domain/chapters';
import { ENEMY_DEFINITIONS } from '../../src/game/domain/enemies';
import { waveModifierConfig, waveRewardMultiplier } from '../../src/game/domain/modifiers';
import {
  SURPRISE_BLOCKS,
  buildSurpriseBossWave,
  isSurpriseBossWaveFor,
  surpriseBossTypeFor,
  surpriseBossWaveCandidates,
  surpriseBossWaveFor,
} from '../../src/game/domain/surpriseBosses';
import { TOTAL_WAVES } from '../../src/game/domain/types';
import {
  LAST_WAVE_ID,
  WAVE_DEFINITIONS,
  getWave,
  getWaveForProfile,
  waveRewardCoins,
} from '../../src/game/domain/waves';

describe('100-wave campaign structure', () => {
  it('defines exactly one hundred waves', () => {
    expect(WAVE_DEFINITIONS).toHaveLength(TOTAL_WAVES);
    expect(LAST_WAVE_ID).toBe(100);
  });

  it('places a mandatory boss on every tenth wave', () => {
    const bossWaves = WAVE_DEFINITIONS.filter((wave) => wave.isBossWave).map((wave) => wave.id);
    expect(bossWaves).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it('gives every new boss its own identity and at least one ability', () => {
    const bossIds = [
      'armored-colossus',
      'storm-garuda',
      'venom-king-crocodile',
      'shadow-prince',
      'chaos-twin-warrior',
      'chaos-twin-healer',
      'lava-golem',
      'chaos-dragon',
      'mega-chaos-king',
    ];
    for (const bossId of bossIds) {
      const definition = ENEMY_DEFINITIONS[bossId as keyof typeof ENEMY_DEFINITIONS];
      expect(definition.isBoss).toBe(true);
      expect(definition.nameHu.length).toBeGreaterThan(2);
      const abilities = definition.abilities ?? {};
      const hasAbility = Object.values(abilities).some((ability) => ability !== null);
      expect(hasAbility, `${bossId} should have an ability`).toBe(true);
    }
  });

  it('keeps the wave 20 Green Venom Falcon intact', () => {
    const wave = getWave(20);
    expect(wave?.enemies[0]?.typeId).toBe('green-venom-falcon');
  });

  it('keeps the first ten waves untouched', () => {
    expect(getWave(1)?.enemies.map((enemy) => enemy.typeId)).toEqual([
      'mini-brainrot',
      'mini-brainrot',
    ]);
    expect(getWave(10)?.enemies[0]?.typeId).toBe('mega-brainrot-gorilla');
  });

  it('assigns ten chapters in order', () => {
    expect(CHAPTER_DEFINITIONS).toHaveLength(10);
    for (const wave of WAVE_DEFINITIONS) {
      const chapter = chapterOfWave(wave.id);
      expect(chapter).toBeDefined();
      expect(wave.chapterId).toBe(chapter?.id);
    }
  });

  it('uses only defined wave modifiers', () => {
    for (const wave of WAVE_DEFINITIONS) {
      if (wave.modifier) {
        expect(waveModifierConfig(wave.modifier)).not.toBeNull();
      }
    }
  });

  it('scales gold-rush rewards deterministically', () => {
    const goldRush = WAVE_DEFINITIONS.filter((wave) => wave.modifier === 'gold-rush');
    expect(goldRush.length).toBeGreaterThanOrEqual(4);
    for (const wave of goldRush) {
      expect(waveRewardMultiplier(wave.modifier)).toBe(1.5);
      expect(waveRewardCoins(wave)).toBe(Math.round(wave.rewardCoins * 1.5));
    }
  });
});

describe('surprise boss selection', () => {
  it('selects exactly one surprise wave per 20-wave block', () => {
    for (let block = 0; block < SURPRISE_BLOCKS; block += 1) {
      const candidates = surpriseBossWaveCandidates(block);
      expect(candidates.length).toBeGreaterThan(0);
      const selected = surpriseBossWaveFor('test-profile', block);
      expect(selected).not.toBeNull();
      expect(candidates).toContain(selected);
    }
  });

  it('never picks a mandatory boss wave', () => {
    for (let block = 0; block < SURPRISE_BLOCKS; block += 1) {
      const selected = surpriseBossWaveFor('test-profile', block);
      expect(selected).not.toBeNull();
      if (selected !== null) expect(selected % 10).not.toBe(0);
    }
  });

  it('is deterministic for a given profile id', () => {
    for (let block = 0; block < SURPRISE_BLOCKS; block += 1) {
      expect(surpriseBossWaveFor('abel-profile', block)).toBe(
        surpriseBossWaveFor('abel-profile', block),
      );
      expect(surpriseBossTypeFor('abel-profile', 37)).toBe(surpriseBossTypeFor('abel-profile', 37));
    }
  });

  it('does not overwrite waves 1–11 of the beginner experience', () => {
    for (const waveId of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      expect(surpriseBossWaveCandidates(0)).not.toContain(waveId);
    }
  });

  it('replaces only the selected wave with a lone boss', () => {
    const profileId = 'surprise-test';
    const block = 0;
    const selected = surpriseBossWaveFor(profileId, block);
    expect(selected).not.toBeNull();
    if (selected === null) return;
    const base = getWave(selected);
    if (!base) return;
    const built = buildSurpriseBossWave(profileId, base);
    expect(built).not.toBeNull();
    if (!built) return;
    expect(built.wave.enemies).toHaveLength(1);
    expect(ENEMY_DEFINITIONS[built.wave.enemies[0]!.typeId].isSurpriseBoss).toBe(true);
    expect(built.wave.nameHu).toBe(ENEMY_DEFINITIONS[built.bossTypeId].nameHu);
    expect(built.wave.rewardCoins).toBeGreaterThan(base.rewardCoins);
  });

  it('reports surprise waves without mutating the base definitions', () => {
    const base = getWave(15);
    if (!base) return;
    expect(isSurpriseBossWaveFor('some-profile', 15)).toBeTypeOf('boolean');
    expect(getWave(15)?.nameHu).toBe(base.nameHu);
    expect(getWave(15)?.enemies).toEqual(base.enemies);
  });

  it('resolves per-profile waves through getWaveForProfile', () => {
    const profileId = 'resolved-profile';
    const selected = surpriseBossWaveFor(profileId, 0);
    expect(selected).not.toBeNull();
    if (selected === null) return;
    const resolved = getWaveForProfile(profileId, selected);
    expect(resolved).not.toBeNull();
    if (!resolved) return;
    expect(resolved.enemies).toHaveLength(1);
    const untouched = getWaveForProfile(profileId, selected === 13 ? 14 : 13);
    expect(untouched?.enemies.length).toBeGreaterThan(1);
  });
});
