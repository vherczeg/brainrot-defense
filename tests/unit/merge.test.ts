import { describe, expect, it } from 'vitest';
import { mergeCharacters } from '../../src/game/commands/profileCommands';
import { MAX_MERGE_RANK } from '../../src/game/domain/types';
import { NOW, profileWith, unit } from './testFixtures';

describe('merge rules', () => {
  it('merges two matching rank 1 units into one rank 2 unit', () => {
    const profile = profileWith([
      unit('unit-1', 'laser-crocodile', 1, 1, 4),
      unit('unit-2', 'laser-crocodile', 1, 2, 4),
    ]);
    const result = mergeCharacters(profile, 'unit-1', 'unit-2', NOW + 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.merged).toMatchObject({
      typeId: 'laser-crocodile',
      mergeRank: 2,
      totalXp: 0,
      col: 2,
      row: 4,
    });
    expect(result.value.profile.characters).toHaveLength(1);
    expect(result.value.profile.characters[0]?.mergeRank).toBe(2);
    expect(result.value.profile.characters[0]?.id).not.toBe('unit-1');
    expect(result.value.profile.characters[0]?.id).not.toBe('unit-2');
  });

  it('merges two matching rank 3 units into one rank 4 unit', () => {
    const profile = profileWith([
      unit('unit-1', 'lightning-scorpion', 3, 1, 4),
      unit('unit-2', 'lightning-scorpion', 3, 2, 4),
    ]);
    const result = mergeCharacters(profile, 'unit-1', 'unit-2');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.merged.mergeRank).toBe(4);
    expect(result.value.merged.typeId).toBe('lightning-scorpion');
  });

  it('rejects merging different character types', () => {
    const profile = profileWith([
      unit('unit-1', 'laser-crocodile', 1, 1, 4),
      unit('unit-2', 'lightning-scorpion', 1, 2, 4),
    ]);
    const result = mergeCharacters(profile, 'unit-1', 'unit-2');
    expect(result).toEqual({ ok: false, error: 'type-mismatch' });
  });

  it('rejects merging different ranks even when XP levels match', () => {
    const profile = profileWith([
      unit('unit-1', 'laser-crocodile', 1, 1, 4),
      unit('unit-2', 'laser-crocodile', 3, 2, 4),
    ]);
    const result = mergeCharacters(profile, 'unit-1', 'unit-2');
    expect(result).toEqual({ ok: false, error: 'rank-mismatch' });
  });

  it('rejects merging at maximum rank without losing units', () => {
    const profile = profileWith([
      unit('unit-1', 'laser-crocodile', MAX_MERGE_RANK, 1, 4, 5000),
      unit('unit-2', 'laser-crocodile', MAX_MERGE_RANK, 2, 4, 9000),
    ]);
    const before = structuredClone(profile);
    const result = mergeCharacters(profile, 'unit-1', 'unit-2');
    expect(result).toEqual({ ok: false, error: 'max-rank' });
    expect(profile).toEqual(before);
  });

  it('rejects missing characters', () => {
    const profile = profileWith([unit('unit-1', 'laser-crocodile', 1, 1, 4)]);
    expect(mergeCharacters(profile, 'unit-1', 'unit-999')).toEqual({
      ok: false,
      error: 'not-found',
    });
    expect(mergeCharacters(profile, 'unit-999', 'unit-1')).toEqual({
      ok: false,
      error: 'not-found',
    });
  });

  it('rejects a unit merging with itself', () => {
    const profile = profileWith([unit('unit-1', 'laser-crocodile', 1, 1, 4)]);
    expect(mergeCharacters(profile, 'unit-1', 'unit-1')).toEqual({
      ok: false,
      error: 'same-unit',
    });
  });

  it('consumes exactly two units and creates exactly one', () => {
    const profile = profileWith([
      unit('unit-1', 'laser-crocodile', 1, 1, 4),
      unit('unit-2', 'laser-crocodile', 1, 2, 4),
      unit('unit-3', 'laser-crocodile', 2, 3, 4),
    ]);
    const result = mergeCharacters(profile, 'unit-1', 'unit-2');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.profile.characters).toHaveLength(2);
    expect(result.value.profile.characters.filter((c) => c.mergeRank === 2)).toHaveLength(2);
    expect(result.value.profile.characters.some((c) => c.id === 'unit-1')).toBe(false);
    expect(result.value.profile.characters.some((c) => c.id === 'unit-2')).toBe(false);
  });

  it('does not duplicate a character when the same interaction is executed twice', () => {
    const profile = profileWith([
      unit('unit-1', 'laser-crocodile', 1, 1, 4),
      unit('unit-2', 'laser-crocodile', 1, 2, 4),
    ]);
    const first = mergeCharacters(profile, 'unit-1', 'unit-2');
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = mergeCharacters(first.value.profile, 'unit-1', 'unit-2');
    expect(second.ok).toBe(false);
    expect(first.value.profile.characters).toHaveLength(1);
    expect(first.value.profile.characters[0]?.mergeRank).toBe(2);
  });

  it('leaves state unchanged after a failed merge', () => {
    const profile = profileWith([
      unit('unit-1', 'laser-crocodile', 1, 1, 4),
      unit('unit-2', 'laser-crocodile', 2, 2, 4),
    ]);
    const before = structuredClone(profile);
    const result = mergeCharacters(profile, 'unit-1', 'unit-2');
    expect(result.ok).toBe(false);
    expect(profile).toEqual(before);
  });

  it('merges units with different XP levels and combines their XP', () => {
    const profile = profileWith([
      unit('unit-1', 'laser-crocodile', 3, 1, 4, 3025),
      unit('unit-2', 'laser-crocodile', 3, 2, 4, 1225),
    ]);
    const result = mergeCharacters(profile, 'unit-1', 'unit-2', NOW + 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.merged.mergeRank).toBe(4);
    expect(result.value.merged.totalXp).toBe(4250);
  });

  it('updates lastSavedAt on success only', () => {
    const profile = profileWith([
      unit('unit-1', 'laser-crocodile', 1, 1, 4),
      unit('unit-2', 'laser-crocodile', 1, 2, 4),
    ]);
    const failed = mergeCharacters(profile, 'unit-1', 'missing', NOW + 5);
    expect(failed.ok).toBe(false);
    const success = mergeCharacters(profile, 'unit-1', 'unit-2', NOW + 7);
    expect(success.ok).toBe(true);
    if (!success.ok) return;
    expect(success.value.profile.lastSavedAt).toBe(NOW + 7);
  });
});
