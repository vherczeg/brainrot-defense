import { describe, expect, it } from 'vitest';
import { mergeCharacters, moveCharacter, undoMerge } from '../../src/game/commands/profileCommands';
import { NOW, profileWith, unit } from './testFixtures';

describe('undoMerge', () => {
  it('restores both original units with rank, position and XP', () => {
    const profile = profileWith([
      unit('unit-1', 'laser-crocodile', 3, 0, 3, 3025),
      unit('unit-2', 'laser-crocodile', 3, 1, 3, 1225),
    ]);
    const source = profile.characters.find((c) => c.id === 'unit-1');
    const target = profile.characters.find((c) => c.id === 'unit-2');
    const merged = mergeCharacters(profile, 'unit-1', 'unit-2', NOW + 1);
    expect(merged.ok).toBe(true);
    if (!merged.ok || !source || !target) return;

    const result = undoMerge(merged.value.profile, { source, target, mergedId: merged.value.merged.id });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.characters).toHaveLength(2);
    expect(result.value.characters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'unit-1', typeId: 'laser-crocodile', mergeRank: 3, totalXp: 3025, col: 0, row: 3 }),
        expect.objectContaining({ id: 'unit-2', typeId: 'laser-crocodile', mergeRank: 3, totalXp: 1225, col: 1, row: 3 }),
      ]),
    );
  });

  it('removes the merged unit and does not duplicate any id', () => {
    const profile = profileWith([
      unit('unit-1', 'laser-crocodile', 1, 0, 3),
      unit('unit-2', 'laser-crocodile', 1, 1, 3),
    ]);
    const source = profile.characters.find((c) => c.id === 'unit-1');
    const target = profile.characters.find((c) => c.id === 'unit-2');
    const merged = mergeCharacters(profile, 'unit-1', 'unit-2');
    if (!merged.ok || !source || !target) throw new Error('merge failed');

    const result = undoMerge(merged.value.profile, { source, target, mergedId: merged.value.merged.id });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.value.characters.map((c) => c.id);
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain(merged.value.merged.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('fails when the merged unit no longer exists', () => {
    const profile = profileWith([
      unit('unit-1', 'laser-crocodile', 1, 0, 3),
      unit('unit-2', 'laser-crocodile', 1, 1, 3),
    ]);
    const result = undoMerge(profile, {
      source: unit('unit-1', 'laser-crocodile', 1, 0, 3),
      target: unit('unit-2', 'laser-crocodile', 1, 1, 3),
      mergedId: 'unit-999',
    });
    expect(result).toEqual({ ok: false, error: 'not-found', detail: 'unit-999' });
  });

  it('fails when the source position has been re-occupied', () => {
    const profile = profileWith([
      unit('unit-1', 'laser-crocodile', 1, 0, 3),
      unit('unit-2', 'laser-crocodile', 1, 1, 3),
      unit('unit-3', 'laser-crocodile', 2, 2, 3),
    ]);
    const source = profile.characters.find((c) => c.id === 'unit-1');
    const target = profile.characters.find((c) => c.id === 'unit-2');
    const merged = mergeCharacters(profile, 'unit-1', 'unit-2');
    if (!merged.ok || !source || !target) throw new Error('merge failed');
    const moved = moveCharacter(merged.value.profile, 'unit-3', 0, 3);
    if (!moved.ok) throw new Error('move failed');

    const result = undoMerge(moved.value, { source, target, mergedId: merged.value.merged.id });
    expect(result).toEqual({ ok: false, error: 'cell-occupied', detail: 'undo.source' });
  });

  it('fails when the target position has been re-occupied', () => {
    const profile = profileWith([
      unit('unit-1', 'laser-crocodile', 1, 0, 3),
      unit('unit-2', 'laser-crocodile', 1, 1, 3),
      unit('unit-3', 'laser-crocodile', 2, 2, 3),
    ]);
    const source = profile.characters.find((c) => c.id === 'unit-1');
    const target = profile.characters.find((c) => c.id === 'unit-2');
    const merged = mergeCharacters(profile, 'unit-1', 'unit-2');
    if (!merged.ok || !source || !target) throw new Error('merge failed');
    const afterMerge = moveCharacter(merged.value.profile, merged.value.merged.id, 3, 3);
    if (!afterMerge.ok) throw new Error('move merged failed');
    const moved = moveCharacter(afterMerge.value, 'unit-3', 1, 3);
    if (!moved.ok) throw new Error('move failed');

    const result = undoMerge(moved.value, { source, target, mergedId: merged.value.merged.id });
    expect(result).toEqual({ ok: false, error: 'cell-occupied', detail: 'undo.target' });
  });

  it('undoes consecutive merges in last-in-first-out order', () => {
    const profile = profileWith([
      unit('unit-1', 'laser-crocodile', 1, 0, 3),
      unit('unit-2', 'laser-crocodile', 1, 1, 3),
      unit('unit-3', 'laser-crocodile', 2, 2, 3),
    ]);
    const firstSource = profile.characters.find((c) => c.id === 'unit-1');
    const firstTarget = profile.characters.find((c) => c.id === 'unit-2');
    const first = mergeCharacters(profile, 'unit-1', 'unit-2');
    if (!first.ok || !firstSource || !firstTarget) throw new Error('first merge failed');

    const secondSource = first.value.merged;
    const secondTarget = first.value.profile.characters.find((c) => c.id === 'unit-3');
    const second = mergeCharacters(first.value.profile, secondSource.id, 'unit-3');
    if (!second.ok || !secondTarget) throw new Error('second merge failed');

    const undoSecond = undoMerge(second.value.profile, {
      source: secondSource,
      target: secondTarget,
      mergedId: second.value.merged.id,
    });
    expect(undoSecond.ok).toBe(true);
    if (!undoSecond.ok) return;
    expect(undoSecond.value.characters.map((c) => c.mergeRank).sort()).toEqual([2, 2]);

    const undoFirst = undoMerge(undoSecond.value, {
      source: firstSource,
      target: firstTarget,
      mergedId: first.value.merged.id,
    });
    expect(undoFirst.ok).toBe(true);
    if (!undoFirst.ok) return;
    expect(undoFirst.value.characters).toHaveLength(3);
    expect(undoFirst.value.characters.map((c) => c.id).sort()).toEqual([
      'unit-1',
      'unit-2',
      'unit-3',
    ]);
  });
});
