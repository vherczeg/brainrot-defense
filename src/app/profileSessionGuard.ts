export interface LockAcquisition {
  readonly acquired: boolean;
  readonly newlyAcquired: boolean;
}

export interface ProfileSessionGuard {
  acquire(profileId: string): Promise<LockAcquisition>;
  release(profileId: string): Promise<void>;
  releaseOthers(profileId: string): Promise<void>;
}

interface HeldLock {
  readonly release: () => void;
  readonly done: Promise<unknown>;
}

export class WebLocksProfileSessionGuard implements ProfileSessionGuard {
  private readonly held = new Map<string, HeldLock>();

  async acquire(profileId: string): Promise<LockAcquisition> {
    if (this.held.has(profileId)) return { acquired: true, newlyAcquired: false };
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (!locks?.request) {
      this.held.set(profileId, { release: () => undefined, done: Promise.resolve() });
      return { acquired: true, newlyAcquired: true };
    }

    let decide: (value: LockAcquisition) => void = () => undefined;
    const decision = new Promise<LockAcquisition>((resolve) => {
      decide = resolve;
    });
    let releaseLock: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    let done: Promise<unknown> = Promise.resolve();
    done = locks
      .request(
        `brainrot-defense-profile-${profileId}`,
        { mode: 'exclusive', ifAvailable: true },
        async (lock) => {
          if (!lock) {
            decide({ acquired: false, newlyAcquired: false });
            return;
          }
          this.held.set(profileId, { release: releaseLock, done });
          decide({ acquired: true, newlyAcquired: true });
          await hold;
        },
      )
      .catch(() => decide({ acquired: false, newlyAcquired: false }));

    const acquisition = await decision;
    if (!acquisition.acquired) {
      this.held.delete(profileId);
      await done.catch(() => undefined);
      return acquisition;
    }
    return acquisition;
  }

  async release(profileId: string): Promise<void> {
    const held = this.held.get(profileId);
    if (!held) return;
    this.held.delete(profileId);
    held.release();
    await held.done.catch(() => undefined);
  }

  async releaseOthers(profileId: string): Promise<void> {
    const ids = [...this.held.keys()].filter((id) => id !== profileId);
    await Promise.all(ids.map((id) => this.release(id)));
  }
}
