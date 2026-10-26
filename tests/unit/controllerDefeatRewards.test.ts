import { describe, expect, it } from 'vitest';
import { FakeRepository, makeController } from './fakeRepository';
import { profileWith, unit } from './testFixtures';

function waveTenProfile(profileId: string, difficulty: 'normal' | 'hard' = 'normal') {
  return profileWith(
    [
      unit('unit-1', 'laser-crocodile', 2, 0, 3, 0),
      unit('unit-2', 'lightning-scorpion', 2, 1, 3, 0),
      unit('unit-3', 'laser-crocodile', 1, 2, 3, 1000),
    ],
    {
      profileId,
      coins: 0,
      completedWaves: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      currentWave: 10,
      unlockedWave: 10,
      tutorialSeen: true,
      settings: { soundEnabled: true, reducedMotion: false, battleSpeed: 1, difficulty },
    },
  );
}

function finish(controller: ReturnType<typeof makeController>, status: 'victory' | 'defeat') {
  const internals = controller as unknown as {
    finishBattle(status: 'victory' | 'defeat'): void;
  };
  internals.finishBattle(status);
}

describe('controller defeat rewards', () => {
  it('awards 50 gold, 20% XP, and one counter step for a genuine defeat', async () => {
    const initial = waveTenProfile('defeat-reward-controller');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.startBattle();
    finish(controller, 'defeat');
    await repository.settle();

    const snapshot = controller.getSnapshot();
    expect(snapshot.result?.comfortCoins).toBe(50);
    expect(snapshot.result?.xpPerUnit).toBe(42);
    expect(snapshot.result?.totalXpAwarded).toBe(126);
    expect(snapshot.result?.defeatXpCount).toBe(1);
    expect(snapshot.result?.defeatXpLimit).toBe(3);
    expect(snapshot.activeProfile?.coins).toBe(50);
    expect(snapshot.activeProfile?.characters.map((c) => c.totalXp)).toEqual([42, 42, 1042]);
    expect(snapshot.activeProfile?.defeatXpCounts[9]).toBe(1);
    expect(repository.lastSaved?.defeatXpCounts[9]).toBe(1);
  });

  it('cannot double-process the same defeat result', async () => {
    const initial = waveTenProfile('defeat-double');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.startBattle();
    finish(controller, 'defeat');
    finish(controller, 'defeat');
    await repository.settle();

    expect(controller.getSnapshot().activeProfile?.coins).toBe(50);
    expect(controller.getSnapshot().activeProfile?.defeatXpCounts[9]).toBe(1);
    expect(controller.getSnapshot().activeProfile?.characters.map((c) => c.totalXp)).toEqual([
      42, 42, 1042,
    ]);
  });

  it('keeps defeat rewards through retry and increases the counter', async () => {
    const initial = waveTenProfile('defeat-retry');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.startBattle();
    finish(controller, 'defeat');
    await repository.settle();
    expect(controller.getSnapshot().result?.defeatXpCount).toBe(1);

    controller.retryBattle();
    expect(controller.getSnapshot().phase).toBe('preparation');
    controller.startBattle();
    finish(controller, 'defeat');
    await repository.settle();

    expect(controller.getSnapshot().result?.defeatXpCount).toBe(2);
    expect(controller.getSnapshot().activeProfile?.coins).toBe(100);
    expect(controller.getSnapshot().activeProfile?.defeatXpCounts[9]).toBe(2);
  });

  it('does not award anything on surrender', async () => {
    const initial = waveTenProfile('defeat-surrender');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.startBattle();
    controller.surrenderBattle();

    expect(controller.getSnapshot().phase).toBe('preparation');
    expect(controller.getSnapshot().result).toBeNull();
    expect(controller.getSnapshot().activeProfile?.coins).toBe(0);
    expect(controller.getSnapshot().activeProfile?.defeatXpCounts[9]).toBe(0);
    expect(controller.getSnapshot().activeProfile?.characters.map((c) => c.totalXp)).toEqual([
      0, 0, 1000,
    ]);
  });

  it('keeps the old profile and awards nothing if the defeat save fails', async () => {
    const initial = waveTenProfile('defeat-save-failure');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.startBattle();
    repository.failSaveCount = 1;
    finish(controller, 'defeat');
    await repository.settle();

    const snapshot = controller.getSnapshot();
    expect(snapshot.result?.persistenceError).toBe(true);
    expect(snapshot.result?.comfortCoins).toBe(0);
    expect(snapshot.result?.defeatXpCount).toBe(0);
    expect(snapshot.activeProfile?.coins).toBe(0);
    expect(snapshot.activeProfile?.defeatXpCounts[9]).toBe(0);
    expect(snapshot.activeProfile?.characters.map((c) => c.totalXp)).toEqual([0, 0, 1000]);
  });

  it('shares the counter between Normal and Hard', async () => {
    const initial = waveTenProfile('defeat-shared-counter', 'hard');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.startBattle();
    finish(controller, 'defeat');
    await repository.settle();
    expect(controller.getSnapshot().activeProfile?.defeatXpCounts[9]).toBe(1);

    controller.retryBattle();
    controller.setDifficulty('normal');
    controller.startBattle();
    finish(controller, 'defeat');
    await repository.settle();
    expect(controller.getSnapshot().activeProfile?.defeatXpCounts[9]).toBe(2);
    expect(controller.getSnapshot().result?.xpPerUnit).toBe(42);
  });
});
