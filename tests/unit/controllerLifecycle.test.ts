import { describe, expect, it } from 'vitest';
import { MAX_COINS } from '../../src/persistence/schemas/saveSchema';
import { FakeRepository, makeController } from './fakeRepository';
import { unit, profileWith } from './testFixtures';

function profile(profileId = 'lifecycle', coins = 350) {
  return profileWith(
    [
      unit('unit-1', 'laser-crocodile', 1, 2, 4),
      unit('unit-2', 'laser-crocodile', 1, 3, 4),
      unit('unit-3', 'lightning-scorpion', 1, 2, 3),
    ],
    { profileId, coins },
  );
}

describe('STORAGE LIFECYCLE: blocked upgrades never create an ephemeral game', () => {
  it('shows an actionable error instead of a fresh in-memory profile when an upgrade is blocked', async () => {
    const initial = profile('blocked-upgrade');
    const repository = new FakeRepository([initial], initial.profileId);
    repository.failListDetail = 'upgrade-blocked';
    const controller = makeController(repository);
    await controller.initialize();

    const snapshot = controller.getSnapshot();
    expect(snapshot.screen).toBe('error');
    expect(snapshot.fatalError).not.toBeNull();
    expect(snapshot.fatalError?.title).toContain('várakozik');
    expect(snapshot.activeProfile).toBeNull();
    expect(snapshot.profiles).toEqual([]);
    expect(repository.hasProfile('blocked-upgrade')).toBe(true);
  });
});

describe('BATTLE LIFECYCLE: surrender modal', () => {
  it('clears a surrender modal when the battle finishes', async () => {
    const initial = profile();
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.startBattle();
    controller.openModal('surrender');

    const internals = controller as unknown as {
      finishBattle(status: 'victory' | 'defeat'): void;
    };
    internals.finishBattle('victory');
    await repository.settle();

    expect(controller.getSnapshot().phase).toBe('result');
    expect(controller.getSnapshot().result?.outcome).toBe('victory');
    expect(controller.getSnapshot().modal).toBeNull();

    controller.surrenderBattle();
    expect(controller.getSnapshot().phase).toBe('result');
    expect(controller.getSnapshot().modal).toBeNull();
  });

  it('shows a victory result without an invalid reward save at the coin limit', async () => {
    const initial = profile('max-coins-victory', MAX_COINS);
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.startBattle();

    const internals = controller as unknown as {
      finishBattle(status: 'victory' | 'defeat'): void;
    };
    internals.finishBattle('victory');
    await repository.settle();

    expect(controller.getSnapshot().phase).toBe('result');
    expect(controller.getSnapshot().result?.outcome).toBe('victory');
    expect(controller.getSnapshot().result?.rewardCoins).toBe(0);
    expect(controller.getSnapshot().activeProfile?.coins).toBe(MAX_COINS);
    expect(controller.getSnapshot().toast?.tone).toBe('error');
    expect(controller.getSnapshot().saveStatus).not.toBe('error');
  });

  it('does not produce an invalid save when coins are already at the maximum', async () => {
    const initial = profile('max-coins', MAX_COINS);
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    controller.enterGame();
    controller.startBattle();

    const internals = controller as unknown as {
      finishBattle(status: 'victory' | 'defeat'): void;
    };
    internals.finishBattle('defeat');
    await repository.settle();

    expect(controller.getSnapshot().phase).toBe('result');
    expect(controller.getSnapshot().activeProfile?.coins).toBeLessThanOrEqual(MAX_COINS);
    if (repository.lastSaved) {
      expect(repository.lastSaved.coins).toBeLessThanOrEqual(MAX_COINS);
    }
    expect(controller.getSnapshot().saveStatus).not.toBe('error');
  });
});
