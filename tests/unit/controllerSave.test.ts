import { describe, expect, it } from 'vitest';
import { serializeEnvelope } from '../../src/persistence/import-export/saveCodec';
import { FakeRepository, FakeSessionGuard, makeController } from './fakeRepository';
import { profileWith, unit } from './testFixtures';

function initialProfile(profileId = 'profile-a', coins = 350) {
  return profileWith([unit('unit-1', 'laser-crocodile', 1, 0, 3)], {
    profileId,
    name: 'Ábel',
    coins,
  });
}

describe('WRITE COORDINATION: import and delete barriers', () => {
  it('a confirmed import wins over pending autosaves and survives reload', async () => {
    const initial = initialProfile('race-profile');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();

    controller.purchase('laser-crocodile');
    controller.updateSettings({ soundEnabled: false });
    controller.saveNow();
    controller.saveNow();

    const imported = profileWith([unit('unit-9', 'lightning-scorpion', 2, 4, 3)], {
      profileId: 'race-profile',
      name: 'Importált',
      coins: 4321,
    });
    expect(await controller.prepareImport(serializeEnvelope(imported), 'race.json')).toBe(true);
    await controller.confirmImport();
    expect(controller.getSnapshot().activeProfile?.coins).toBe(4321);

    await repository.settle();

    expect(repository.lastSaved?.coins).toBe(4321);
    expect(repository.lastSaved?.profileId).toBe('race-profile');

    const reloaded = makeController(repository);
    await reloaded.initialize();
    expect(reloaded.getSnapshot().activeProfile?.coins).toBe(4321);
    expect(reloaded.getSnapshot().activeProfile?.name).toBe('Importált');
  });

  it('a deleted profile is not resurrected by pending autosaves', async () => {
    const initial = initialProfile('delete-race');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();

    controller.purchase('laser-crocodile');
    controller.updateSettings({ soundEnabled: false });
    controller.saveNow();
    controller.saveNow();
    await controller.deleteProfile('delete-race');

    await repository.settle();

    expect(repository.hasProfile('delete-race')).toBe(false);
    expect(controller.getSnapshot().profiles.some((p) => p.profileId === 'delete-race')).toBe(
      false,
    );
  });

  it('coalesces a large burst of autosaves instead of writing every snapshot', async () => {
    const initial = initialProfile('coalesce');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();

    for (let index = 0; index < 1000; index += 1) {
      controller.updateSettings({ soundEnabled: index % 2 === 0 });
    }
    await repository.settle();

    expect(repository.writeCount).toBeLessThanOrEqual(4);
    expect(repository.lastSaved?.settings.soundEnabled).toBe(false);
  });
});

describe('WRITE COORDINATION: profile lifecycle and failures', () => {
  it('does not create a fourth profile from concurrent create requests', async () => {
    const first = initialProfile('profile-a');
    const second = initialProfile('profile-b');
    const repository = new FakeRepository([first, second], first.profileId);
    repository.delayMs = 10;
    const controller = makeController(repository);
    await controller.initialize();

    await Promise.allSettled([
      controller.createProfile('Csilla'),
      controller.createProfile('Dóra'),
    ]);
    await repository.settle();

    expect(repository.profileIds.length).toBeLessThanOrEqual(3);
    expect(controller.getSnapshot().profiles.length).toBeLessThanOrEqual(3);
  });

  it('reports a failed autosave and recovers on a later successful write', async () => {
    const initial = initialProfile('failure');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();

    repository.failSaveCount = 1;
    controller.purchase('laser-crocodile');
    await repository.settle();
    expect(controller.getSnapshot().saveStatus).toBe('error');
    expect(controller.getSnapshot().toast?.tone).toBe('error');

    controller.saveNow();
    await repository.settle();
    expect(controller.getSnapshot().saveStatus).toBe('saved');
    expect(repository.lastSaved?.coins).toBe(250);
  });

  it('does not switch profiles or report success when active-profile metadata fails', async () => {
    const first = initialProfile('profile-a');
    const second = initialProfile('profile-b', 222);
    const repository = new FakeRepository([first, second], first.profileId);
    const controller = makeController(repository);
    await controller.initialize();

    repository.failActiveCount = 1;
    await controller.selectProfile('profile-b');

    expect(controller.getSnapshot().activeProfile?.profileId).toBe('profile-a');
    expect(controller.getSnapshot().toast?.tone).toBe('error');
  });
});

describe('SESSION GUARD: one editing tab per profile', () => {
  it('shows a blocking error when the active profile is already open elsewhere', async () => {
    const initial = initialProfile('locked');
    const repository = new FakeRepository([initial], initial.profileId);
    const guard = new FakeSessionGuard();
    guard.allowed = false;
    const controller = makeController(repository, { sessionGuard: guard });
    await controller.initialize();

    expect(controller.getSnapshot().screen).toBe('error');
    expect(controller.getSnapshot().fatalError).not.toBeNull();
    expect(controller.getSnapshot().activeProfile).toBeNull();
  });

  it('does not release the active Web Lock when a same-ID import fails', async () => {
    const initial = initialProfile('same-id-lock', 500);
    const repository = new FakeRepository([initial], initial.profileId);
    const guard = new FakeSessionGuard();
    const controller = makeController(repository, { sessionGuard: guard });
    await controller.initialize();
    expect(guard.held.has('same-id-lock')).toBe(true);

    const imported = profileWith([unit('unit-9', 'lightning-scorpion', 2, 4, 3)], {
      profileId: 'same-id-lock',
      coins: 4321,
    });
    expect(await controller.prepareImport(serializeEnvelope(imported), 'same-id.json')).toBe(true);
    repository.failSaveAndActivateCount = 1;
    await controller.confirmImport();
    await repository.settle();

    expect(guard.held.has('same-id-lock')).toBe(true);
    expect(controller.getSnapshot().activeProfile?.coins).toBe(500);
    expect(controller.getSnapshot().modal).toBe('import-confirm');
    expect(controller.getSnapshot().toast?.tone).toBe('error');
  });

  it('keeps the old session when switching to a locked profile fails', async () => {
    const first = initialProfile('first');
    const second = initialProfile('second', 222);
    const repository = new FakeRepository([first, second], first.profileId);
    const guard = new FakeSessionGuard();
    const controller = makeController(repository, { sessionGuard: guard });
    await controller.initialize();
    guard.allowed = false;

    await controller.selectProfile('second');

    expect(controller.getSnapshot().activeProfile?.profileId).toBe('first');
    expect(controller.getSnapshot().toast?.tone).toBe('error');
    expect(guard.held.has('first')).toBe(true);
  });
});

describe('WRITE COORDINATION: atomic profile metadata and pending UI', () => {
  it('does not add a profile when save+activate fails atomically', async () => {
    const first = initialProfile('atomic-first');
    const repository = new FakeRepository([first], first.profileId);
    repository.failSaveAndActivateCount = 1;
    const controller = makeController(repository);
    await controller.initialize();

    await controller.createProfile('Hibás');
    await repository.settle();

    expect(repository.profileIds).toEqual(['atomic-first']);
    expect(controller.getSnapshot().activeProfile?.profileId).toBe('atomic-first');
    expect(controller.getSnapshot().creatingProfile).toBe(false);
    expect(controller.getSnapshot().toast?.tone).toBe('error');
  });

  it('exposes a pending creation state while the profile write is in flight', async () => {
    const first = initialProfile('pending-first');
    const repository = new FakeRepository([first], first.profileId);
    repository.delayMs = 20;
    const controller = makeController(repository);
    await controller.initialize();

    const creation = controller.createProfile('Lassú');
    expect(controller.getSnapshot().creatingProfile).toBe(true);
    await creation;
    await repository.settle();
    expect(controller.getSnapshot().creatingProfile).toBe(false);
  });

  it('keeps the active profile and import modal when an import write fails', async () => {
    const first = initialProfile('import-failure');
    const repository = new FakeRepository([first], first.profileId);
    const controller = makeController(repository);
    await controller.initialize();
    const imported = profileWith([unit('unit-7', 'laser-crocodile', 1, 0, 3)], {
      profileId: 'import-failure',
      coins: 999,
    });
    expect(await controller.prepareImport(serializeEnvelope(imported), 'bad.json')).toBe(true);
    repository.failSaveAndActivateCount = 1;
    await controller.confirmImport();
    await repository.settle();

    expect(controller.getSnapshot().activeProfile?.coins).toBe(350);
    expect(controller.getSnapshot().modal).toBe('import-confirm');
    expect(controller.getSnapshot().toast?.tone).toBe('error');
  });
});

describe('WRITE COORDINATION: switching and overlapping gameplay saves', () => {
  it('finishes pending writes on both profiles during a rapid switch', async () => {
    const first = initialProfile('switch-a');
    const second = initialProfile('switch-b');
    const repository = new FakeRepository([first, second], first.profileId);
    repository.delayMs = 5;
    const controller = makeController(repository);
    await controller.initialize();

    controller.purchase('laser-crocodile');
    await controller.selectProfile('switch-b');
    controller.purchase('laser-crocodile');
    await controller.selectProfile('switch-a');
    await repository.settle();

    expect(controller.getSnapshot().activeProfile?.profileId).toBe('switch-a');
    expect(repository.getProfile('switch-a')?.coins).toBe(250);
    expect(repository.getProfile('switch-b')?.coins).toBe(250);
    expect(repository.activeProfileId).toBe('switch-a');
  });

  it('coalesces overlapping purchase and merge saves without losing the final state', async () => {
    const initial = profileWith([unit('unit-1', 'laser-crocodile', 1, 0, 3)], {
      profileId: 'gameplay-coalesce',
      coins: 1000,
      nextCharacterId: 100,
    });
    const repository = new FakeRepository([initial], initial.profileId);
    repository.delayMs = 3;
    const controller = makeController(repository);
    await controller.initialize();

    for (let index = 0; index < 5; index += 1) {
      controller.purchase('laser-crocodile');
    }
    controller.selectCharacter('unit-100');
    controller.handleUnitTap('unit-101');
    await repository.settle();

    const saved = repository.getProfile('gameplay-coalesce');
    expect(saved?.coins).toBe(500);
    expect(saved?.characters).toHaveLength(5);
    expect(saved?.characters.some((character) => character.mergeRank === 2)).toBe(true);
  });

  it('keeps the profile and reports an error when deletion fails', async () => {
    const initial = initialProfile('delete-failure');
    const repository = new FakeRepository([initial], initial.profileId);
    const controller = makeController(repository);
    await controller.initialize();

    repository.failDeleteCount = 1;
    await controller.deleteProfile('delete-failure');
    await repository.settle();

    expect(repository.hasProfile('delete-failure')).toBe(true);
    expect(controller.getSnapshot().activeProfile?.profileId).toBe('delete-failure');
    expect(controller.getSnapshot().toast?.tone).toBe('error');
  });
});

describe('WRITE COORDINATION: selecting the current profile', () => {
  it('does not reload a stale database copy over newer in-memory progress', async () => {
    const first = initialProfile('current-profile');
    const repository = new FakeRepository([first], first.profileId);
    repository.delayMs = 20;
    const controller = makeController(repository);
    await controller.initialize();

    controller.purchase('laser-crocodile');
    await controller.selectProfile('current-profile');
    expect(controller.getSnapshot().screen).toBe('menu');
    expect(controller.getSnapshot().activeProfile?.coins).toBe(250);

    await repository.settle();
    expect(repository.getProfile('current-profile')?.coins).toBe(250);
  });
});
