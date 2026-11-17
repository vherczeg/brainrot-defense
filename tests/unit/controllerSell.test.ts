import { describe, expect, it } from 'vitest';
import { MAX_UNDO_MERGES } from '../../src/app/controller';
import type { CharacterInstance } from '../../src/game/domain/types';
import { FakeRepository, makeController } from './fakeRepository';
import { profileWith, unit } from './testFixtures';

function fullArmy(): CharacterInstance[] {
  const characters: CharacterInstance[] = [];
  let index = 0;
  for (let row = 3; row <= 4; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      index += 1;
      characters.push(
        unit(
          `unit-${index}`,
          index % 2 === 0 ? 'laser-crocodile' : 'lightning-scorpion',
          1,
          col,
          row,
        ),
      );
    }
  }
  return characters;
}

describe('controller unit selling', () => {
  it('sells only the selected friendly unit, clears selection, and persists', async () => {
    const initial = profileWith(
      [unit('unit-1', 'laser-crocodile', 1, 0, 3), unit('unit-2', 'lightning-scorpion', 1, 1, 3)],
      { profileId: 'sell-basic', coins: 100 },
    );
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();

    controller.selectCharacter('unit-1');
    controller.requestSell();

    expect(controller.getSnapshot().modal).toBe('sell-confirm');
    expect(controller.getSnapshot().sellOffer).toMatchObject({
      characterId: 'unit-1',
      typeId: 'laser-crocodile',
      mergeRank: 1,
      level: 1,
      refund: 50,
    });

    controller.confirmSell();
    await repository.settle();

    const snapshot = controller.getSnapshot();
    expect(snapshot.modal).toBeNull();
    expect(snapshot.selectedCharacterId).toBeNull();
    expect(snapshot.activeProfile?.coins).toBe(150);
    expect(snapshot.activeProfile?.characters.map((character) => character.id)).toEqual(['unit-2']);
    expect(repository.lastSaved?.characters.map((character) => character.id)).toEqual(['unit-2']);
    expect(repository.lastSaved?.coins).toBe(150);
  });

  it('cancels without changing coins or units', async () => {
    const initial = profileWith([unit('unit-1', 'laser-crocodile', 1, 0, 3)], {
      profileId: 'sell-cancel',
    });
    const controller = makeController(new FakeRepository([initial], initial.profileId));
    await controller.initialize();
    controller.enterGame();
    controller.selectCharacter('unit-1');

    controller.requestSell();
    controller.cancelSell();

    expect(controller.getSnapshot().modal).toBeNull();
    expect(controller.getSnapshot().sellOffer).toBeNull();
    expect(controller.getSnapshot().selectedCharacterId).toBe('unit-1');
    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(1);
    expect(controller.getSnapshot().activeProfile?.coins).toBe(350);
  });

  it('does nothing without a selected unit and shows the selection hint', async () => {
    const initial = profileWith([unit('unit-1', 'laser-crocodile', 1, 0, 3)], {
      profileId: 'sell-no-selection',
      tutorialSeen: true,
    });
    const controller = makeController(new FakeRepository([initial], initial.profileId));
    await controller.initialize();
    controller.enterGame();

    controller.requestSell();

    expect(controller.getSnapshot().modal).toBeNull();
    expect(controller.getSnapshot().sellOffer).toBeNull();
    expect(controller.getSnapshot().toast?.message).toBe('Válassz ki egy harcost az eladáshoz!');
    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(1);
  });

  it('never sells an enemy or unselected unit', async () => {
    const initial = profileWith([unit('unit-1', 'laser-crocodile', 1, 0, 3)], {
      profileId: 'sell-enemy',
    });
    const controller = makeController(new FakeRepository([initial], initial.profileId));
    await controller.initialize();
    controller.enterGame();
    controller.selectCharacter('unit-1');

    controller.requestSell('enemy-1');
    controller.confirmSell();

    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(1);
    expect(controller.getSnapshot().activeProfile?.coins).toBe(350);
  });

  it('is unavailable during battle', async () => {
    const initial = profileWith([unit('unit-1', 'laser-crocodile', 1, 0, 3)], {
      profileId: 'sell-battle',
    });
    const controller = makeController(new FakeRepository([initial], initial.profileId));
    await controller.initialize();
    controller.enterGame();
    controller.selectCharacter('unit-1');
    controller.startBattle();

    controller.requestSell('unit-1');
    controller.confirmSell();

    expect(controller.getSnapshot().phase).toBe('battle');
    expect(controller.getSnapshot().sellOffer).toBeNull();
    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(1);
    expect(controller.getSnapshot().activeProfile?.coins).toBe(350);
  });

  it('cannot double-refund when confirmation is repeated', async () => {
    const initial = profileWith([unit('unit-1', 'laser-crocodile', 1, 0, 3)], {
      profileId: 'sell-twice',
    });
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.selectCharacter('unit-1');

    controller.requestSell();
    controller.confirmSell();
    controller.confirmSell();
    controller.confirmSell();
    await repository.settle();

    expect(controller.getSnapshot().activeProfile?.coins).toBe(400);
    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(0);
    expect(repository.lastSaved?.coins).toBe(400);
    expect(repository.lastSaved?.characters).toHaveLength(0);
  });

  it('frees a cell on a full board and allows exactly one replacement purchase', async () => {
    const initial = profileWith(fullArmy(), {
      profileId: 'sell-full-board',
      coins: 1000,
      nextCharacterId: 100,
    });
    const controller = makeController(new FakeRepository([initial], initial.profileId));
    await controller.initialize();
    controller.enterGame();

    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(12);
    controller.selectCharacter('unit-7');
    controller.requestSell();
    expect(controller.getSnapshot().sellOffer?.refund).toBe(75);
    controller.confirmSell();

    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(11);
    expect(controller.getSnapshot().activeProfile?.coins).toBe(1075);

    controller.purchase('laser-crocodile');
    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(12);
    expect(controller.getSnapshot().activeProfile?.coins).toBe(975);
    expect(controller.getSnapshot().selectedCharacterId).toBe('unit-100');
  });

  it('clears merge undo history after selling so undo cannot duplicate a unit', async () => {
    const initial = profileWith(
      [
        unit('unit-1', 'laser-crocodile', 1, 0, 3),
        unit('unit-2', 'laser-crocodile', 1, 1, 3),
        unit('unit-3', 'lightning-scorpion', 1, 2, 3),
      ],
      { profileId: 'sell-undo', coins: 0 },
    );
    const controller = makeController(new FakeRepository([initial], initial.profileId));
    await controller.initialize();
    controller.enterGame();

    controller.dragUnitToCell('unit-1', 1, 3);
    expect(controller.getSnapshot().undoCount).toBe(1);
    const mergedId = controller
      .getSnapshot()
      .activeProfile?.characters.find((character) => character.mergeRank === 2)?.id;
    if (!mergedId) throw new Error('merge did not happen');

    controller.selectCharacter(mergedId);
    controller.requestSell();
    controller.confirmSell();

    expect(controller.getSnapshot().undoCount).toBe(0);
    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(1);
    controller.undo();
    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(1);
    expect(new Set(controller.getSnapshot().activeProfile?.characters.map((c) => c.id)).size).toBe(
      1,
    );
    expect(controller.getSnapshot().toast?.message).toBe('Nincs mit visszavonni.');
    expect(MAX_UNDO_MERGES).toBe(10);
  });

  it('preserves the sold state across reload', async () => {
    const initial = profileWith(
      [unit('unit-1', 'laser-crocodile', 1, 0, 3), unit('unit-2', 'lightning-scorpion', 1, 1, 3)],
      { profileId: 'sell-reload', coins: 0 },
    );
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.selectCharacter('unit-2');
    controller.requestSell();
    controller.confirmSell();
    await repository.settle();

    const reloaded = makeController(repository);
    await reloaded.initialize();
    expect(reloaded.getSnapshot().activeProfile?.coins).toBe(75);
    expect(reloaded.getSnapshot().activeProfile?.characters.map((c) => c.id)).toEqual(['unit-1']);
  });

  it('handles a persistence failure without double refunds or duplicate removals', async () => {
    const initial = profileWith(
      [unit('unit-1', 'laser-crocodile', 1, 0, 3), unit('unit-2', 'laser-crocodile', 1, 1, 3)],
      { profileId: 'sell-save-failure', coins: 0 },
    );
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();

    repository.failSaveCount = 1;
    controller.selectCharacter('unit-1');
    controller.requestSell();
    controller.confirmSell();
    await repository.settle();

    expect(controller.getSnapshot().saveStatus).toBe('error');
    expect(controller.getSnapshot().toast?.tone).toBe('error');
    expect(controller.getSnapshot().activeProfile?.coins).toBe(50);
    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(1);

    controller.saveNow();
    await repository.settle();
    expect(controller.getSnapshot().saveStatus).toBe('saved');
    expect(repository.lastSaved?.coins).toBe(50);
    expect(repository.lastSaved?.characters).toHaveLength(1);
  });
});
