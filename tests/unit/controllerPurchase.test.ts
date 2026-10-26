import { describe, expect, it } from 'vitest';
import type { CharacterInstance } from '../../src/game/domain/types';
import { FakeRepository, makeController } from './fakeRepository';
import { profileWith, unit } from './testFixtures';

function fullArmy(): CharacterInstance[] {
  const characters: CharacterInstance[] = [];
  let index = 0;
  for (let row = 3; row <= 4; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      index += 1;
      characters.push(unit(`unit-${index}`, 'laser-crocodile', 1, col, row));
    }
  }
  return characters;
}

describe('controller purchasing transaction safety', () => {
  it('one purchase command creates exactly one unit and deducts currency once', async () => {
    const initial = profileWith([], { profileId: 'buy-one', coins: 350 });
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();

    controller.purchase('laser-crocodile');
    await repository.settle();

    const snapshot = controller.getSnapshot();
    expect(snapshot.activeProfile?.characters).toHaveLength(1);
    expect(snapshot.activeProfile?.coins).toBe(250);
    expect(snapshot.selectedCharacterId).toBe('unit-100');
    expect(snapshot.toast?.message).toContain('Lézer Krokodil');
    expect(snapshot.toast?.message).toContain('250 érme');
    expect(snapshot.toast?.message).toContain('1/12 harcos');
    expect(repository.lastSaved?.characters).toHaveLength(1);
    expect(repository.lastSaved?.coins).toBe(250);
  });

  it('two separate purchase commands create exactly two units', async () => {
    const initial = profileWith([], { profileId: 'buy-two', coins: 350, nextCharacterId: 100 });
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();

    controller.purchase('laser-crocodile');
    controller.purchase('lightning-scorpion');
    await repository.settle();

    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(2);
    expect(controller.getSnapshot().activeProfile?.coins).toBe(100);
    expect(repository.lastSaved?.characters).toHaveLength(2);
    expect(repository.lastSaved?.coins).toBe(100);
  });

  it('rejects a purchase on a full board without deducting currency', async () => {
    const initial = profileWith(fullArmy(), { profileId: 'buy-full', coins: 1000 });
    const controller = makeController(new FakeRepository([initial], initial.profileId));
    await controller.initialize();
    controller.enterGame();

    controller.purchase('laser-crocodile');

    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(12);
    expect(controller.getSnapshot().activeProfile?.coins).toBe(1000);
    expect(controller.getSnapshot().toast?.tone).toBe('error');
  });

  it('rejects an unaffordable purchase without creating a unit', async () => {
    const initial = profileWith([], { profileId: 'buy-poor', coins: 99 });
    const controller = makeController(new FakeRepository([initial], initial.profileId));
    await controller.initialize();
    controller.enterGame();

    controller.purchase('laser-crocodile');

    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(0);
    expect(controller.getSnapshot().activeProfile?.coins).toBe(99);
    expect(controller.getSnapshot().toast?.tone).toBe('error');
  });

  it('purchases immediately after selling the unit that freed the last cell', async () => {
    const initial = profileWith(fullArmy(), {
      profileId: 'buy-after-sell',
      coins: 50,
      nextCharacterId: 100,
    });
    const controller = makeController(new FakeRepository([initial], initial.profileId));
    await controller.initialize();
    controller.enterGame();

    controller.selectCharacter('unit-1');
    controller.requestSell();
    controller.confirmSell();
    expect(controller.getSnapshot().activeProfile?.coins).toBe(100);

    controller.purchase('laser-crocodile');

    expect(controller.getSnapshot().activeProfile?.characters).toHaveLength(12);
    expect(controller.getSnapshot().activeProfile?.coins).toBe(0);
    expect(controller.getSnapshot().selectedCharacterId).toBe('unit-100');
  });

  it('does not duplicate the last purchase when the saved profile is reloaded', async () => {
    const initial = profileWith([], { profileId: 'buy-reload', coins: 350 });
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.purchase('laser-crocodile');
    await repository.settle();

    const reloaded = makeController(repository);
    await reloaded.initialize();

    expect(reloaded.getSnapshot().activeProfile?.characters).toHaveLength(1);
    expect(reloaded.getSnapshot().activeProfile?.coins).toBe(250);
  });
});
