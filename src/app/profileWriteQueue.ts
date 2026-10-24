import { fail, type Result } from '../game/domain/types';

type WriteKind = 'autosave' | 'barrier';

interface WriteTask {
  readonly kind: WriteKind;
  readonly profileId: string;
  readonly epoch: number;
  readonly skipIfStale: boolean;
  readonly run: () => Promise<Result<void>>;
  readonly onSettled?: (result: Result<void>) => void;
  readonly resolve?: (result: Result<void>) => void;
  readonly invalidateOnSuccess?: boolean;
}

export class ProfileWriteQueue {
  private tasks: WriteTask[] = [];
  private readonly epochs = new Map<string, number>();
  private running = false;
  private idleWaiters: (() => void)[] = [];

  getEpoch(profileId: string): number {
    return this.epochs.get(profileId) ?? 0;
  }

  invalidate(profileId: string): number {
    const next = this.getEpoch(profileId) + 1;
    this.epochs.set(profileId, next);
    this.tasks = this.tasks.filter(
      (task) => !(task.kind === 'autosave' && task.profileId === profileId),
    );
    return next;
  }

  enqueueAutosave(
    profileId: string,
    epoch: number,
    run: () => Promise<Result<void>>,
    onSettled: (result: Result<void>) => void,
  ): void {
    for (let index = this.tasks.length - 1; index >= 0; index -= 1) {
      const task = this.tasks[index];
      if (!task) continue;
      if (task.kind === 'barrier') break;
      if (task.profileId === profileId) {
        this.tasks[index] = {
          kind: 'autosave',
          profileId,
          epoch,
          skipIfStale: true,
          run,
          onSettled,
        };
        this.kick();
        return;
      }
    }
    this.tasks.push({
      kind: 'autosave',
      profileId,
      epoch,
      skipIfStale: true,
      run,
      onSettled,
    });
    this.kick();
  }

  enqueueBarrier(
    profileId: string,
    run: () => Promise<Result<void>>,
    invalidateOnSuccess = false,
  ): Promise<Result<void>> {
    return new Promise<Result<void>>((resolve) => {
      this.tasks.push({
        kind: 'barrier',
        profileId,
        epoch: this.getEpoch(profileId),
        skipIfStale: false,
        run,
        resolve,
        invalidateOnSuccess,
      });
      this.kick();
    });
  }

  whenIdle(): Promise<void> {
    if (!this.running && this.tasks.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  private kick(): void {
    if (this.running) return;
    this.running = true;
    void this.drain();
  }

  private async drain(): Promise<void> {
    try {
      while (this.tasks.length > 0) {
        const task = this.tasks.shift();
        if (!task) break;
        if (task.skipIfStale && this.getEpoch(task.profileId) !== task.epoch) continue;

        let result: Result<void>;
        try {
          result = await task.run();
        } catch {
          result = fail('unknown');
        }

        if (task.kind === 'barrier' && result.ok && task.invalidateOnSuccess) {
          this.invalidate(task.profileId);
        }
        task.onSettled?.(result);
        task.resolve?.(result);
      }
    } finally {
      this.running = false;
      if (this.tasks.length > 0) {
        this.kick();
      } else {
        const waiters = this.idleWaiters;
        this.idleWaiters = [];
        for (const resolve of waiters) resolve();
      }
    }
  }
}
