import { describe, expect, it } from 'vitest';
import { FakeRepository, makeController } from './fakeRepository';
import { profileWith } from './testFixtures';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function expansionController(expansionCells = 0, coins = 500_000) {
  const initial = profileWith([], { profileId: 'expand', coins, expansionCells });
  const repository = new FakeRepository([initial], initial.profileId);
  const controller = makeController(repository);
  return { controller, repository };
}

describe('controller expansion purchase idempotency', () => {
  it('a single purchase action unlocks exactly one cell even when invoked repeatedly in the same turn', async () => {
    const { controller, repository } = expansionController();
    await controller.initialize();
    controller.enterGame();

    // Simulate a burst of duplicate invocations (one physical tap delivered as several events).
    controller.purchaseExpansion();
    controller.purchaseExpansion();
    controller.purchaseExpansion();
    controller.purchaseExpansion();
    await repository.settle();

    const profile = controller.getSnapshot().activeProfile;
    expect(profile?.expansionCells).toBe(1);
    expect(profile?.coins).toBe(500_000 - 10_000);
  });

  it('allows legitimate consecutive purchases as distinct user actions', async () => {
    const { controller, repository } = expansionController();
    await controller.initialize();
    controller.enterGame();

    controller.purchaseExpansion();
    await flushMicrotasks();
    controller.purchaseExpansion();
    await flushMicrotasks();
    controller.purchaseExpansion();
    await repository.settle();

    const profile = controller.getSnapshot().activeProfile;
    expect(profile?.expansionCells).toBe(3);
    // 10k + 20k + 30k
    expect(profile?.coins).toBe(500_000 - 60_000);
  });

  it('deducts the exact price for each purchase and never skips or repeats a cell', async () => {
    const { controller, repository } = expansionController();
    await controller.initialize();
    controller.enterGame();

    for (let index = 0; index < 6; index += 1) {
      controller.purchaseExpansion();
      await flushMicrotasks();
    }
    await repository.settle();

    const profile = controller.getSnapshot().activeProfile;
    expect(profile?.expansionCells).toBe(6);
    // 10 + 20 + 30 + 40 + 50 + 60 (×1000) = 210 000
    expect(profile?.coins).toBe(500_000 - 210_000);
  });

  it('prevents purchases when gold is insufficient', async () => {
    const { controller, repository } = expansionController(0, 9_999);
    await controller.initialize();
    controller.enterGame();

    controller.purchaseExpansion();
    await repository.settle();

    expect(controller.getSnapshot().activeProfile?.expansionCells).toBe(0);
    expect(controller.getSnapshot().activeProfile?.coins).toBe(9_999);
    expect(controller.getSnapshot().toast?.tone).toBe('error');
  });

  it('never purchases the sixth cell twice', async () => {
    const { controller, repository } = expansionController(6);
    await controller.initialize();
    controller.enterGame();

    controller.purchaseExpansion();
    await repository.settle();

    expect(controller.getSnapshot().activeProfile?.expansionCells).toBe(6);
    expect(controller.getSnapshot().activeProfile?.coins).toBe(500_000);
    expect(controller.getSnapshot().toast?.tone).toBe('error');
  });

  it('keeps the guard independent from other purchases', async () => {
    const { controller, repository } = expansionController();
    await controller.initialize();
    controller.enterGame();

    controller.purchaseExpansion();
    controller.purchase('laser-crocodile');
    await repository.settle();

    const profile = controller.getSnapshot().activeProfile;
    expect(profile?.expansionCells).toBe(1);
    expect(profile?.characters).toHaveLength(1);
    expect(profile?.coins).toBe(500_000 - 10_000 - 100);
  });
});
