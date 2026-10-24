import type { GameController } from '../../src/app/controller';
import type { LockAcquisition, ProfileSessionGuard } from '../../src/app/profileSessionGuard';
import { GameController as RealGameController } from '../../src/app/controller';
import {
  fail,
  ok,
  MAX_PROFILES,
  type PlayerProfile,
  type Result,
} from '../../src/game/domain/types';
import type {
  ProfileRepository,
  ProfileSummary,
} from '../../src/persistence/indexeddb/profileRepository';

function cloneProfile(profile: PlayerProfile): PlayerProfile {
  return structuredClone(profile);
}

function summaryOf(profile: PlayerProfile): ProfileSummary {
  return {
    profileId: profile.profileId,
    name: profile.name,
    currentWave: profile.currentWave,
    coins: profile.coins,
    lastSavedAt: profile.lastSavedAt,
    createdAt: profile.createdAt,
    corrupt: false,
  };
}

export class FakeRepository implements ProfileRepository {
  private readonly profiles = new Map<string, PlayerProfile>();
  private activeId: string | null;
  private queue: Promise<void> = Promise.resolve();

  writeCount = 0;
  failSaveCount = 0;
  failActiveCount = 0;
  failSaveAndActivateCount = 0;
  failDeleteCount = 0;
  failListDetail: string | null = null;
  delayMs = 0;
  lastSaved: PlayerProfile | null = null;

  constructor(initialProfiles: readonly PlayerProfile[], activeId: string | null) {
    for (const profile of initialProfiles) {
      this.profiles.set(profile.profileId, cloneProfile(profile));
    }
    this.activeId = activeId;
  }

  private enqueue(operation: () => Promise<Result<void>> | Result<void>): Promise<Result<void>> {
    this.writeCount += 1;
    return new Promise<Result<void>>((resolve) => {
      this.queue = this.queue
        .then(async () => {
          if (this.delayMs > 0) {
            await new Promise((resolveDelay) => setTimeout(resolveDelay, this.delayMs));
          }
          resolve(await operation());
        })
        .catch(() => resolve(fail('unknown')));
    });
  }

  async listProfiles(): Promise<Result<readonly ProfileSummary[]>> {
    if (this.failListDetail !== null) {
      return fail('storage-unavailable', this.failListDetail);
    }
    return ok([...this.profiles.values()].map(summaryOf));
  }

  async loadProfile(profileId: string): Promise<Result<PlayerProfile>> {
    const profile = this.profiles.get(profileId);
    return profile ? ok(cloneProfile(profile)) : fail('not-found');
  }

  saveProfile(profile: PlayerProfile): Promise<Result<void>> {
    return this.enqueue(() => {
      if (this.failSaveCount > 0) {
        this.failSaveCount -= 1;
        return fail('save-failed');
      }
      const copy = cloneProfile(profile);
      this.profiles.set(copy.profileId, copy);
      this.lastSaved = copy;
      return ok(undefined);
    });
  }

  saveProfileAndActivate(profile: PlayerProfile): Promise<Result<void>> {
    return this.enqueue(() => {
      if (this.failSaveAndActivateCount > 0) {
        this.failSaveAndActivateCount -= 1;
        return fail('save-failed');
      }
      if (this.failSaveCount > 0) {
        this.failSaveCount -= 1;
        return fail('save-failed');
      }
      if (this.failActiveCount > 0) {
        this.failActiveCount -= 1;
        return fail('save-failed');
      }
      if (!this.profiles.has(profile.profileId) && this.profiles.size >= MAX_PROFILES) {
        return fail('profile-limit');
      }
      const copy = cloneProfile(profile);
      this.profiles.set(copy.profileId, copy);
      this.activeId = copy.profileId;
      this.lastSaved = copy;
      return ok(undefined);
    });
  }

  deleteProfile(profileId: string): Promise<Result<void>> {
    return this.enqueue(() => {
      if (this.failDeleteCount > 0) {
        this.failDeleteCount -= 1;
        return fail('save-failed');
      }
      this.profiles.delete(profileId);
      if (this.activeId === profileId) this.activeId = null;
      return ok(undefined);
    });
  }

  async getActiveProfileId(): Promise<Result<string | null>> {
    return ok(this.activeId);
  }

  async setActiveProfileId(profileId: string | null): Promise<Result<void>> {
    if (this.failActiveCount > 0) {
      this.failActiveCount -= 1;
      return fail('save-failed');
    }
    this.activeId = profileId;
    return ok(undefined);
  }

  async requestPersistence(): Promise<boolean> {
    return false;
  }

  hasProfile(profileId: string): boolean {
    return this.profiles.has(profileId);
  }

  getProfile(profileId: string): PlayerProfile | null {
    const profile = this.profiles.get(profileId);
    return profile ? cloneProfile(profile) : null;
  }

  get profileIds(): readonly string[] {
    return [...this.profiles.keys()];
  }

  get activeProfileId(): string | null {
    return this.activeId;
  }

  async settle(): Promise<void> {
    let previous = -1;
    let stable = 0;
    for (let attempt = 0; attempt < 2000; attempt += 1) {
      await this.queue;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 2));
      if (this.writeCount === previous) {
        stable += 1;
        if (stable >= 2) return;
      } else {
        stable = 0;
        previous = this.writeCount;
      }
    }
  }
}

export function makeController(
  repository: FakeRepository,
  overrides: Partial<ConstructorParameters<typeof RealGameController>[0]> = {},
): GameController {
  const schedule = () => 0 as unknown as ReturnType<typeof setTimeout>;
  return new RealGameController({
    repository,
    now: () => 1_700_000_000_000,
    requestFrame: () => 1,
    cancelFrame: () => undefined,
    schedule,
    cancelSchedule: () => undefined,
    sessionGuard: new FakeSessionGuard(),
    ...overrides,
  });
}

export class FakeSessionGuard implements ProfileSessionGuard {
  allowed = true;
  readonly held = new Set<string>();

  async acquire(profileId: string): Promise<LockAcquisition> {
    if (!this.allowed) return { acquired: false, newlyAcquired: false };
    const newlyAcquired = !this.held.has(profileId);
    this.held.add(profileId);
    return { acquired: true, newlyAcquired };
  }

  async release(profileId: string): Promise<void> {
    this.held.delete(profileId);
  }

  async releaseOthers(profileId: string): Promise<void> {
    for (const id of [...this.held]) {
      if (id !== profileId) this.held.delete(id);
    }
  }
}
