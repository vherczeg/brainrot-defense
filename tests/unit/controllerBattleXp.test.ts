import { describe, expect, it } from 'vitest';
import { characterLevelFromXp } from '../../src/game/domain/progression';
import { FakeRepository, makeController } from './fakeRepository';
import { profileWith, unit } from './testFixtures';

function profile(profileId = 'battle-xp') {
  return profileWith(
    [
      unit('unit-1', 'laser-crocodile', 1, 0, 3, 0),
      unit('unit-2', 'laser-crocodile', 1, 1, 3, 0),
      unit('unit-3', 'lightning-scorpion', 1, 2, 3, 0),
    ],
    { profileId, coins: 0 },
  );
}

function finish(controller: ReturnType<typeof makeController>, status: 'victory' | 'defeat') {
  const internals = controller as unknown as {
    finishBattle(status: 'victory' | 'defeat'): void;
  };
  internals.finishBattle(status);
}

describe('controller battle XP integration', () => {
  it('awards XP to the battle-start roster on victory and shows it in the result', async () => {
    const initial = profile();
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.startBattle();
    finish(controller, 'victory');
    await repository.settle();

    const snapshot = controller.getSnapshot();
    expect(snapshot.result?.xpPerUnit).toBe(75);
    expect(snapshot.result?.totalXpAwarded).toBe(225);
    expect(snapshot.activeProfile?.characters.map((character) => character.totalXp)).toEqual([
      75, 75, 75,
    ]);
    expect(
      snapshot.activeProfile?.characters.map((character) =>
        characterLevelFromXp(character.totalXp),
      ),
    ).toEqual([2, 2, 2]);
    expect(snapshot.result?.levelUps).toHaveLength(3);
    expect(repository.lastSaved?.characters[0]?.totalXp).toBe(75);
  });

  it('cannot award the same battle twice when the resolution is repeated', async () => {
    const initial = profile('battle-xp-twice');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.startBattle();
    finish(controller, 'victory');
    finish(controller, 'victory');
    await repository.settle();

    expect(controller.getSnapshot().activeProfile?.characters.map((c) => c.totalXp)).toEqual([
      75, 75, 75,
    ]);
  });

  it('grants zero XP on defeat and on surrender', async () => {
    const initial = profile('battle-xp-defeat');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.startBattle();
    finish(controller, 'defeat');
    await repository.settle();
    expect(controller.getSnapshot().result?.xpPerUnit).toBe(0);
    expect(controller.getSnapshot().activeProfile?.characters.every((c) => c.totalXp === 0)).toBe(
      true,
    );

    controller.goToMenu();
    controller.enterGame();
    controller.startBattle();
    controller.surrenderBattle();
    expect(controller.getSnapshot().phase).toBe('preparation');
    expect(controller.getSnapshot().activeProfile?.characters.every((c) => c.totalXp === 0)).toBe(
      true,
    );
  });

  it('does not award XP to a character added after the battle started', async () => {
    const initial = profile('battle-xp-roster');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.startBattle();

    const internals = controller as unknown as {
      profile: typeof initial;
    };
    internals.profile = {
      ...initial,
      characters: [...initial.characters, unit('unit-9', 'laser-crocodile', 1, 5, 4, 0)],
    };
    finish(controller, 'victory');
    await repository.settle();

    const characters = controller.getSnapshot().activeProfile?.characters ?? [];
    expect(characters.find((character) => character.id === 'unit-9')?.totalXp).toBe(0);
    expect(characters.find((character) => character.id === 'unit-1')?.totalXp).toBe(75);
  });

  it('does not show the victory reward until the save has been acknowledged', async () => {
    const initial = profile('battle-xp-ack');
    const repository = new FakeRepository([initial], initial.profileId);
    repository.delayMs = 30;
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.startBattle();
    finish(controller, 'victory');

    expect(controller.getSnapshot().phase).toBe('battle');
    expect(controller.getSnapshot().result).toBeNull();
    expect(controller.getSnapshot().saveStatus).toBe('saving');

    await repository.settle();

    expect(controller.getSnapshot().phase).toBe('result');
    expect(controller.getSnapshot().result?.persistenceError).toBe(false);
    expect(controller.getSnapshot().result?.totalXpAwarded).toBe(225);
    expect(controller.getSnapshot().saveStatus).toBe('saved');
    expect(repository.lastSaved?.characters.map((character) => character.totalXp)).toEqual([
      75, 75, 75,
    ]);
  });

  it('keeps the old profile and reports a visible error when the victory save fails', async () => {
    const initial = profile('battle-xp-save-failure');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.startBattle();
    repository.failSaveCount = 1;
    finish(controller, 'victory');
    await repository.settle();

    const snapshot = controller.getSnapshot();
    expect(snapshot.phase).toBe('result');
    expect(snapshot.result?.persistenceError).toBe(true);
    expect(snapshot.result?.rewardCoins).toBe(0);
    expect(snapshot.result?.xpPerUnit).toBe(0);
    expect(snapshot.saveStatus).toBe('error');
    expect(snapshot.toast?.tone).toBe('error');
    expect(snapshot.activeProfile?.coins).toBe(0);
    expect(snapshot.activeProfile?.characters.every((character) => character.totalXp === 0)).toBe(
      true,
    );

    const reloaded = makeController(repository);
    await reloaded.initialize();
    expect(reloaded.getSnapshot().activeProfile?.characters.every((c) => c.totalXp === 0)).toBe(
      true,
    );
    expect(reloaded.getSnapshot().activeProfile?.currentWave).toBe(1);
  });

  it('persists XP and does not grant it again after reload', async () => {
    const initial = profile('battle-xp-persist');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.startBattle();
    finish(controller, 'victory');
    await repository.settle();

    const reloaded = makeController(repository);
    await reloaded.initialize();
    expect(reloaded.getSnapshot().activeProfile?.characters.map((c) => c.totalXp)).toEqual([
      75, 75, 75,
    ]);
  });

  it('merges two units with different XP levels through the UI interaction', async () => {
    const initial = profileWith(
      [
        unit('unit-1', 'laser-crocodile', 3, 0, 3, 3025),
        unit('unit-2', 'laser-crocodile', 3, 1, 3, 1225),
      ],
      { profileId: 'battle-merge-xp', nextCharacterId: 10 },
    );
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.selectCharacter('unit-1');
    controller.handleUnitTap('unit-2');
    await repository.settle();

    const merged = controller.getSnapshot().activeProfile?.characters[0];
    expect(merged?.mergeRank).toBe(4);
    expect(merged?.totalXp).toBe(4250);
    expect(characterLevelFromXp(merged?.totalXp ?? 0)).toBe(14);
  });
});
