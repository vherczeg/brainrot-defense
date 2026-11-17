import { describe, expect, it } from 'vitest';
import { resolveDefeatRewards } from '../../src/game/commands/profileCommands';
import { TOTAL_WAVES } from '../../src/game/domain/types';
import { parseProfileFromImport } from '../../src/persistence/import-export/saveCodec';
import { validateProfile } from '../../src/persistence/schemas/saveSchema';
import { profileWith, NOW } from './testFixtures';

function wave20CompletedProfile() {
  return profileWith([], {
    coins: 1234,
    completedWaves: Array.from({ length: 20 }, (_, index) => index + 1),
    currentWave: 20,
    unlockedWave: 20,
    defeatXpCounts: Array.from({ length: 20 }, () => 0),
  });
}

describe('100-wave save compatibility', () => {
  it('pads shorter defeat counters to the full campaign length', () => {
    const profile = validateProfile({
      ...wave20CompletedProfile(),
      defeatXpCounts: Array.from({ length: 20 }, () => 0),
    });
    expect(profile.ok).toBe(true);
    if (!profile.ok) return;
    expect(profile.value.defeatXpCounts).toHaveLength(TOTAL_WAVES);
    expect(profile.value.defeatXpCounts.slice(0, 20).every((count) => count === 0)).toBe(true);
    expect(profile.value.defeatXpCounts.slice(20).every((count) => count === 0)).toBe(true);
  });

  it('advances a wave-20-completed save to wave 21 of the extended campaign', () => {
    const profile = validateProfile(wave20CompletedProfile());
    expect(profile.ok).toBe(true);
    if (!profile.ok) return;
    expect(profile.value.currentWave).toBe(21);
    expect(profile.value.unlockedWave).toBe(21);
  });

  it('keeps mid-campaign progress untouched', () => {
    const profile = validateProfile(
      profileWith([], {
        coins: 999,
        completedWaves: [1, 2, 3, 4, 5],
        currentWave: 6,
        unlockedWave: 6,
      }),
    );
    expect(profile.ok).toBe(true);
    if (!profile.ok) return;
    expect(profile.value.currentWave).toBe(6);
    expect(profile.value.completedWaves).toEqual([1, 2, 3, 4, 5]);
  });

  it('accepts all four difficulty settings in saves', () => {
    for (const difficulty of ['easy', 'normal', 'hard', 'extreme'] as const) {
      const base = wave20CompletedProfile();
      const profile = validateProfile({
        ...base,
        settings: { ...base.settings, difficulty },
      });
      expect(profile.ok, difficulty).toBe(true);
      if (profile.ok) expect(profile.value.settings.difficulty).toBe(difficulty);
    }
  });

  it('preserves upgrade levels through import/export', () => {
    const profile = profileWith([], {
      coins: 5000,
      upgrades: { 'army-attack': 7, 'army-hp': 3 },
    });
    const envelope = JSON.parse(JSON.stringify({ profile }));
    const parsed = parseProfileFromImport(
      JSON.stringify({
        format: 'brainrot-defense-save',
        appId: 'brainrot-defense',
        schemaVersion: 4,
        exportedAt: new Date(NOW).toISOString(),
        profile: envelope.profile,
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.upgrades).toEqual({ 'army-attack': 7, 'army-hp': 3 });
  });

  it('supports defeat rewards all the way to wave 100', () => {
    const profile = profileWith([], {
      coins: 0,
      completedWaves: Array.from({ length: 99 }, (_, index) => index + 1),
      currentWave: 100,
      unlockedWave: 100,
      defeatXpCounts: Array.from({ length: TOTAL_WAVES }, () => 0),
    });
    const outcome = resolveDefeatRewards(profile, 100, [], NOW);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.profile.coins).toBe(50);
    expect(outcome.value.profile.defeatXpCounts[99]).toBe(1);
  });

  it('rejects defeat counter arrays longer than the campaign', () => {
    const profile = validateProfile({
      ...wave20CompletedProfile(),
      defeatXpCounts: Array.from({ length: TOTAL_WAVES + 1 }, () => 0),
    });
    expect(profile.ok).toBe(false);
  });
});
