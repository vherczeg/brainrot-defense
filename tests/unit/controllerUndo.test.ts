import { describe, expect, it } from 'vitest';
import { MAX_UNDO_MERGES } from '../../src/app/controller';
import type { CharacterInstance } from '../../src/game/domain/types';
import { FakeRepository, makeController } from './fakeRepository';
import { profileWith, unit } from './testFixtures';

describe('merge safety (no accidental merges)', () => {
  it('tapping a compatible unit selects it instead of merging', async () => {
    const initial = profileWith(
      [
        unit('unit-1', 'laser-crocodile', 1, 0, 3),
        unit('unit-2', 'laser-crocodile', 1, 1, 3),
      ],
      { profileId: 'tap-safe', nextCharacterId: 100 },
    );
    const controller = makeController(new FakeRepository([initial], initial.profileId));
    await controller.initialize();
    controller.enterGame();

    controller.selectCharacter('unit-1');
    controller.handleUnitTap('unit-2');

    const characters = controller.getSnapshot().activeProfile?.characters ?? [];
    expect(characters).toHaveLength(2);
    expect(characters.every((character) => character.mergeRank === 1)).toBe(true);
    expect(controller.getSnapshot().selectedCharacterId).toBe('unit-2');
  });

  it('ignores a drag dropped onto an incompatible unit', async () => {
    const initial = profileWith(
      [
        unit('unit-1', 'laser-crocodile', 1, 0, 3),
        unit('unit-2', 'lightning-scorpion', 1, 1, 3),
      ],
      { profileId: 'drag-safe', nextCharacterId: 100 },
    );
    const controller = makeController(new FakeRepository([initial], initial.profileId));
    await controller.initialize();
    controller.enterGame();

    controller.dragUnitToCell('unit-1', 1, 3);

    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(2);
    expect(controller.getSnapshot().toast?.tone).not.toBe('error');
  });
});

describe('UNDO', () => {
  it('merges via drag and undo restores both units and persists', async () => {
    const initial = profileWith(
      [
        unit('unit-1', 'laser-crocodile', 2, 0, 3, 900),
        unit('unit-2', 'laser-crocodile', 2, 1, 3, 700),
      ],
      { profileId: 'undo-save', nextCharacterId: 100 },
    );
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();

    controller.dragUnitToCell('unit-1', 1, 3);
    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(1);
    expect(controller.getSnapshot().undoCount).toBe(1);

    controller.undo();
    await repository.settle();

    const restored = controller.getSnapshot().activeProfile?.characters ?? [];
    expect(restored).toHaveLength(2);
    expect(restored).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'unit-1', mergeRank: 2, totalXp: 900, col: 0, row: 3 }),
        expect.objectContaining({ id: 'unit-2', mergeRank: 2, totalXp: 700, col: 1, row: 3 }),
      ]),
    );
    expect(controller.getSnapshot().undoCount).toBe(0);
    expect(repository.getProfile('undo-save')?.characters).toHaveLength(2);
  });

  it('undoing with an empty history is a safe no-op', async () => {
    const initial = profileWith([unit('unit-1', 'laser-crocodile', 1, 0, 3)], {
      profileId: 'undo-empty',
    });
    const controller = makeController(new FakeRepository([initial], initial.profileId));
    await controller.initialize();
    controller.enterGame();

    controller.undo();

    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(1);
    expect(controller.getSnapshot().undoCount).toBe(0);
  });

  it('clears the undo history when a battle starts', async () => {
    const initial = profileWith(
      [
        unit('unit-1', 'laser-crocodile', 1, 0, 3),
        unit('unit-2', 'laser-crocodile', 1, 1, 3),
      ],
      { profileId: 'undo-battle', nextCharacterId: 100 },
    );
    const controller = makeController(new FakeRepository([initial], initial.profileId));
    await controller.initialize();
    controller.enterGame();

    controller.dragUnitToCell('unit-1', 1, 3);
    expect(controller.getSnapshot().undoCount).toBe(1);

    controller.startBattle();
    expect(controller.getSnapshot().undoCount).toBe(0);
  });

  it('fails safely and never duplicates when a moved unit occupies the original cell', async () => {
    const initial = profileWith(
      [
        unit('unit-1', 'laser-crocodile', 1, 0, 3),
        unit('unit-2', 'laser-crocodile', 1, 1, 3),
        unit('unit-3', 'laser-crocodile', 2, 2, 3),
      ],
      { profileId: 'undo-move', nextCharacterId: 100 },
    );
    const controller = makeController(new FakeRepository([initial], initial.profileId));
    await controller.initialize();
    controller.enterGame();

    controller.dragUnitToCell('unit-1', 1, 3);
    expect(controller.getSnapshot().undoCount).toBe(1);

    controller.dragUnitToCell('unit-3', 0, 3);
    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(2);

    controller.undo();

    const characters = controller.getSnapshot().activeProfile?.characters ?? [];
    expect(characters).toHaveLength(2);
    expect(new Set(characters.map((character) => character.id)).size).toBe(2);
    expect(characters.some((character) => character.mergeRank === 2)).toBe(true);
    expect(controller.getSnapshot().undoCount).toBe(0);
    expect(controller.getSnapshot().toast?.tone).toBe('error');
  });


  it('caps the undo history at ten merges and unwinds them in order', async () => {
    const starter: CharacterInstance[] = [];
    let id = 1;
    for (let row = 3; row <= 4; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        starter.push(unit(`u-${id}`, 'laser-crocodile', 1, col, row));
        id += 1;
      }
    }
    const initial = profileWith(starter, { profileId: 'undo-cap', nextCharacterId: 1000 });
    const controller = makeController(new FakeRepository([initial], initial.profileId));
    await controller.initialize();
    controller.enterGame();

    const mergeOnePair = (): boolean => {
      const characters = controller.getSnapshot().activeProfile?.characters ?? [];
      for (let i = 0; i < characters.length; i += 1) {
        for (let j = i + 1; j < characters.length; j += 1) {
          const a = characters[i];
          const b = characters[j];
          if (a && b && a.typeId === b.typeId && a.mergeRank === b.mergeRank) {
            controller.dragUnitToCell(a.id, b.col, b.row);
            return true;
          }
        }
      }
      return false;
    };

    let merges = 0;
    while (mergeOnePair()) merges += 1;

    expect(merges).toBe(10);
    expect(MAX_UNDO_MERGES).toBe(10);
    expect(controller.getSnapshot().undoCount).toBe(10);

    for (let step = 0; step < 10; step += 1) controller.undo();

    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(12);
    expect(controller.getSnapshot().undoCount).toBe(0);
  });
});
