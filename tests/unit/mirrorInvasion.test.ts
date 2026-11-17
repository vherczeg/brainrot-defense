import { describe, expect, it } from 'vitest';
import {
  purchaseExpansion,
  purchaseCharacter,
  mergeCharacters,
} from '../../src/game/commands/profileCommands';
import { nextExpansionCost, totalExpansionCost } from '../../src/game/domain/expansion';
import {
  EXPANSION_COLUMN_ORDER,
  EXPANSION_ROW,
  isPlayableAlliedCell,
  unlockedExpansionColumns,
} from '../../src/game/domain/grid';
import {
  applyMirrorInvasion,
  mirrorEnemyCount,
  resolveWave,
} from '../../src/game/domain/mirrorInvasion';
import { MAX_EXPANSION_CELLS, TOTAL_WAVES } from '../../src/game/domain/types';
import { WAVE_DEFINITIONS, getWave, getWaveForProfile } from '../../src/game/domain/waves';
import { buildSurpriseBossWave, surpriseBossWaveFor } from '../../src/game/domain/surpriseBosses';
import { createBattleState, runBattleToCompletion } from '../../src/game/simulation/battle';
import { validateProfile } from '../../src/persistence/schemas/saveSchema';
import { profileWith, unit } from './testFixtures';

function richProfile() {
  return profileWith([], { coins: 500_000 });
}

describe('Mirror Invasion: expansion purchase', () => {
  it('loads existing profiles with zero purchased expansion cells', () => {
    expect(profileWith([]).expansionCells).toBe(0);
    expect(unlockedExpansionColumns(0)).toEqual([]);
  });

  it('charges the documented prices and totals 210,000 gold', () => {
    expect(nextExpansionCost(0)).toBe(10_000);
    expect(nextExpansionCost(1)).toBe(20_000);
    expect(nextExpansionCost(5)).toBe(60_000);
    expect(totalExpansionCost(6)).toBe(210_000);
  });

  it('unlocks cells in the order C, D, B, E, F, A on the single third row', () => {
    expect(EXPANSION_COLUMN_ORDER).toEqual([2, 3, 1, 4, 5, 0]);
    expect(unlockedExpansionColumns(1)).toEqual([2]);
    expect(unlockedExpansionColumns(2)).toEqual([2, 3]);
    expect(unlockedExpansionColumns(6)).toEqual([2, 3, 1, 4, 5, 0]);
    // All unlocked cells share the same third row and are not in the original two rows.
    for (const col of unlockedExpansionColumns(6)) {
      expect(EXPANSION_ROW).toBe(5);
      expect(EXPANSION_ROW).toBeGreaterThanOrEqual(3);
      expect(col).toBeGreaterThanOrEqual(0);
    }
  });

  it('purchases sequentially and keeps existing characters in place', () => {
    const character = unit('unit-1', 'laser-crocodile', 1, 0, 3);
    let profile = profileWith([character], { coins: 500_000 });
    for (let count = 1; count <= 6; count += 1) {
      const before = profile.coins;
      const outcome = purchaseExpansion(profile, 2);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.value.expansionCells).toBe(count);
      expect(outcome.value.cost).toBe(count * 10_000);
      expect(outcome.value.profile.coins).toBe(before - count * 10_000);
      // The original unit never moves.
      expect(outcome.value.profile.characters[0]).toEqual(character);
      profile = outcome.value.profile;
    }
    expect(profile.expansionCells).toBe(6);
  });

  it('fails safely when gold is insufficient and at maximum expansion', () => {
    const poor = purchaseExpansion(profileWith([], { coins: 9_999 }), 2);
    expect(poor.ok).toBe(false);
    expect(poor.ok ? null : poor.error).toBe('insufficient-coins');

    const maxed = purchaseExpansion(profileWith([], { coins: 500_000, expansionCells: 6 }), 2);
    expect(maxed.ok).toBe(false);
    expect(maxed.ok ? null : maxed.error).toBe('max-expansion');
  });

  it('caps the expansion at six cells', () => {
    expect(unlockedExpansionColumns(99)).toHaveLength(MAX_EXPANSION_CELLS);
    expect(nextExpansionCost(6)).toBeNull();
  });

  it('lets units occupy and move onto newly unlocked cells', () => {
    let profile = richProfile();
    const bought = purchaseExpansion(profile, 2);
    if (!bought.ok) return;
    profile = bought.value.profile;

    // Fill the original twelve cells first.
    const characters = [];
    let index = 0;
    for (let row = 3; row <= 4; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        index += 1;
        characters.push(unit(`unit-${index}`, 'laser-crocodile', 1, col, row));
      }
    }
    profile = { ...profile, characters };

    // The next purchase lands on an unlocked third-row cell.
    const purchase = purchaseCharacter(profile, 'laser-crocodile', 2);
    expect(purchase.ok).toBe(true);
    if (!purchase.ok) return;
    const placed = purchase.value.purchased;
    expect(placed.row).toBe(EXPANSION_ROW);
    expect(isPlayableAlliedCell(placed.col, placed.row, profile.expansionCells)).toBe(true);
  });

  it('keeps locked third-row cells unplayable', () => {
    expect(isPlayableAlliedCell(0, EXPANSION_ROW, 0)).toBe(false);
    expect(isPlayableAlliedCell(2, EXPANSION_ROW, 1)).toBe(true);
    expect(isPlayableAlliedCell(0, EXPANSION_ROW, 1)).toBe(false);
    expect(isPlayableAlliedCell(0, 3, 0)).toBe(true);
  });

  it('supports merging two units placed on the third row', () => {
    let profile = profileWith([], { coins: 500_000, expansionCells: 2 });
    profile = {
      ...profile,
      characters: [
        unit('unit-1', 'laser-crocodile', 1, 2, 5),
        unit('unit-2', 'laser-crocodile', 1, 3, 5),
      ],
    };
    const merged = mergeCharacters(profile, 'unit-1', 'unit-2', 2);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.value.merged.mergeRank).toBe(2);
    expect(merged.value.merged.row).toBe(EXPANSION_ROW);
  });

  it('lets a ranged unit on the third row win a battle', () => {
    const wave = getWave(1);
    if (!wave) return;
    const characters = [unit('unit-1', 'laser-crocodile', 4, 2, EXPANSION_ROW)];
    const result = runBattleToCompletion(createBattleState(characters, wave, 1));
    expect(result.state.status).toBe('victory');
  });
});

describe('Mirror Invasion: enemy expansion', () => {
  it('adds one regular enemy per purchased cell', () => {
    const wave = getWave(22);
    if (!wave) return;
    const base = wave.enemies.length;
    const expanded = applyMirrorInvasion(wave, 3);
    expect(expanded.enemies).toHaveLength(base + 3);
    expect(mirrorEnemyCount(3)).toBe(3);
  });

  it('reuses the wave actual enemy types and levels', () => {
    const wave = getWave(22);
    if (!wave) return;
    const expanded = applyMirrorInvasion(wave, 6);
    const baseTypes = new Set(wave.enemies.map((enemy) => enemy.typeId));
    for (const enemy of expanded.enemies.slice(wave.enemies.length)) {
      expect(baseTypes.has(enemy.typeId)).toBe(true);
    }
  });

  it('does not add extra enemies when there is no expansion', () => {
    const wave = getWave(50);
    if (!wave) return;
    expect(applyMirrorInvasion(wave, 0).enemies).toEqual(wave.enemies);
  });

  it('preserves mandatory boss encounters', () => {
    for (const waveId of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) {
      const wave = getWave(waveId);
      if (!wave) continue;
      const expanded = applyMirrorInvasion(wave, 6);
      // The original boss is still present exactly once and is never multiplied.
      const originalBoss = wave.enemies[0];
      expect(
        expanded.enemies.filter((enemy) => enemy.typeId === originalBoss?.typeId),
      ).toHaveLength(1);
    }
  });

  it('preserves solo surprise-boss encounters (documented exception)', () => {
    const profileId = 'surprise-test';
    const selected = surpriseBossWaveFor(profileId, 0);
    if (selected === null) return;
    const base = getWave(selected);
    if (!base) return;
    const surprise = buildSurpriseBossWave(profileId, base);
    if (!surprise) return;
    const expanded = applyMirrorInvasion(surprise.wave, 6);
    expect(expanded.enemies).toEqual(surprise.wave.enemies);
  });

  it('resolveWave applies both surprise bosses and mirror invasion', () => {
    const wave = resolveWave({ profileId: 'resolved', expansionCells: 2 }, 22);
    expect(wave).not.toBeNull();
    if (!wave) return;
    expect(wave.enemies.length).toBe((getWave(22)?.enemies.length ?? 0) + 2);
  });
});

describe('Mirror Invasion: saves', () => {
  it('preserves expansion across save validation round-trips', () => {
    const profile = profileWith([], { coins: 1000, expansionCells: 4 });
    const validated = validateProfile({ ...profile, characters: profile.characters });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.value.expansionCells).toBe(4);
  });

  it('defaults missing expansionCells to zero (backward compatibility)', () => {
    const raw = { ...profileWith([]) };
    delete (raw as Record<string, unknown>).expansionCells;
    const validated = validateProfile(raw);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.value.expansionCells).toBe(0);
  });

  it('rejects a unit on a locked third-row cell', () => {
    const profile = profileWith([], { expansionCells: 1 });
    const invalid = validateProfile({
      ...profile,
      characters: [unit('unit-1', 'laser-crocodile', 1, 0, EXPANSION_ROW)],
    });
    expect(invalid.ok).toBe(false);
  });

  it('accepts a unit on an unlocked third-row cell', () => {
    const profile = profileWith([], { expansionCells: 1 });
    const valid = validateProfile({
      ...profile,
      characters: [unit('unit-1', 'laser-crocodile', 1, 2, EXPANSION_ROW)],
    });
    expect(valid.ok).toBe(true);
  });

  it('keeps player profiles independent', () => {
    const a = purchaseExpansion(profileWith([], { coins: 500_000 }), 2);
    const b = profileWith([]);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.value.profile.expansionCells).toBe(1);
    expect(b.expansionCells).toBe(0);
  });

  it('keeps the existing 100-wave definitions intact without expansion', () => {
    expect(WAVE_DEFINITIONS).toHaveLength(TOTAL_WAVES);
    expect(getWave(100)?.isBossWave).toBe(true);
    // No expansion means no surprise overlay side-effects beyond the profile id.
    expect(getWaveForProfile('some-profile', 5)).toBeDefined();
  });
});
