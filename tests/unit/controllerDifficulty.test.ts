import { describe, expect, it } from 'vitest';
import { resolveBattleRewards } from '../../src/game/commands/profileCommands';
import { FakeRepository, makeController } from './fakeRepository';
import { profileWith, unit } from './testFixtures';

function initialProfile(profileId: string, difficulty: 'normal' | 'hard' = 'normal') {
  return profileWith([unit('unit-1', 'laser-crocodile', 2, 0, 3)], {
    profileId,
    tutorialSeen: true,
    settings: {
      soundEnabled: true,
      reducedMotion: false,
      battleSpeed: 1,
      difficulty,
    },
  });
}

describe('controller difficulty selection', () => {
  it('defaults to Normal and saves a preparation-time Hard selection', async () => {
    const initial = initialProfile('difficulty-save');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();

    expect(controller.getSnapshot().activeProfile?.settings.difficulty).toBe('normal');
    controller.setDifficulty('hard');
    expect(controller.getSnapshot().activeProfile?.settings.difficulty).toBe('hard');
    await repository.settle();

    expect(repository.lastSaved?.settings.difficulty).toBe('hard');

    const reloaded = makeController(repository);
    await reloaded.initialize();
    expect(reloaded.getSnapshot().activeProfile?.settings.difficulty).toBe('hard');
  });

  it('captures Hard at battle start and ignores changes during battle', async () => {
    const initial = initialProfile('difficulty-battle');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.setDifficulty('hard');
    controller.startBattle();

    expect(controller.getSnapshot().battle?.difficulty).toBe('hard');
    controller.setDifficulty('normal');
    expect(controller.getSnapshot().activeProfile?.settings.difficulty).toBe('hard');
    expect(controller.getSnapshot().battle?.difficulty).toBe('hard');
  });

  it('keeps the captured difficulty on the result screen', async () => {
    const initial = initialProfile('difficulty-result');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.setDifficulty('hard');
    controller.startBattle();

    const internals = controller as unknown as {
      finishBattle(status: 'victory' | 'defeat'): void;
    };
    internals.finishBattle('victory');
    await repository.settle();

    expect(controller.getSnapshot().result?.difficulty).toBe('hard');
    expect(controller.getSnapshot().activeProfile?.settings.difficulty).toBe('hard');
  });

  it('stores difficulty per profile without resetting progress', async () => {
    const first = initialProfile('difficulty-prof-a');
    const second = initialProfile('difficulty-prof-b');
    const repository = new FakeRepository([first, second], first.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.setDifficulty('hard');
    await repository.settle();

    await controller.selectProfile('difficulty-prof-b');
    expect(controller.getSnapshot().activeProfile?.settings.difficulty).toBe('normal');

    await controller.selectProfile('difficulty-prof-a');
    expect(controller.getSnapshot().activeProfile?.settings.difficulty).toBe('hard');
    expect(controller.getSnapshot().activeProfile?.coins).toBe(first.coins);
    expect(controller.getSnapshot().activeProfile?.currentWave).toBe(first.currentWave);
  });

  it('does not grant a second first-clear reward after switching difficulty', () => {
    const completed = profileWith([unit('unit-1', 'laser-crocodile', 2, 0, 3)], {
      profileId: 'difficulty-replay',
      completedWaves: [1],
      currentWave: 2,
      unlockedWave: 2,
      settings: {
        soundEnabled: true,
        reducedMotion: false,
        battleSpeed: 1,
        difficulty: 'hard',
      },
    });
    const reward = resolveBattleRewards(completed, 1, ['unit-1'], 2);
    expect(reward.ok).toBe(true);
    if (!reward.ok) return;
    expect(reward.value.firstCompletion).toBe(false);
    expect(reward.value.rewardCoins).toBe(42);
    expect(reward.value.profile.completedWaves).toEqual([1]);
    expect(reward.value.profile.currentWave).toBe(2);
  });

  it('keeps gold and XP rewards identical between Normal and Hard', () => {
    const normal = initialProfile('difficulty-reward-normal', 'normal');
    const hard = initialProfile('difficulty-reward-hard', 'hard');
    const normalReward = resolveBattleRewards(normal, 1, ['unit-1'], 2);
    const hardReward = resolveBattleRewards(hard, 1, ['unit-1'], 2);
    expect(normalReward.ok).toBe(true);
    expect(hardReward.ok).toBe(true);
    if (!normalReward.ok || !hardReward.ok) return;
    expect(hardReward.value.rewardCoins).toBe(normalReward.value.rewardCoins);
    expect(hardReward.value.xpPerUnit).toBe(normalReward.value.xpPerUnit);
    expect(hardReward.value.totalXpAwarded).toBe(normalReward.value.totalXpAwarded);
    expect(hardReward.value.profile.settings.difficulty).toBe('hard');
    expect(normalReward.value.profile.settings.difficulty).toBe('normal');
  });
});
