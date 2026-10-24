import { stepBattle } from './battle';
import { FIXED_TICK_SECONDS, type BattleEvent, type BattleState } from './types';
import type { BattleSpeed } from '../domain/types';

const MAX_FRAME_DELTA_MS = 250;
const MAX_STEPS_PER_ADVANCE = 20;

export class BattleSession {
  private state: BattleState;
  private accumulator = 0;
  private speed: BattleSpeed;
  private paused = false;
  private pendingEvents: BattleEvent[] = [];

  constructor(initialState: BattleState, speed: BattleSpeed = 1) {
    this.state = initialState;
    this.speed = speed;
  }

  getState(): BattleState {
    return this.state;
  }

  getSpeed(): BattleSpeed {
    return this.speed;
  }

  isPaused(): boolean {
    return this.paused;
  }

  isFinished(): boolean {
    return this.state.status !== 'running';
  }

  setSpeed(speed: BattleSpeed): void {
    this.speed = speed;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  drainEvents(): readonly BattleEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  advance(deltaMs: number): void {
    if (this.paused || this.isFinished()) return;
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;

    const boundedDelta = Math.min(MAX_FRAME_DELTA_MS, deltaMs);
    this.accumulator += (boundedDelta / 1000) * this.speed;

    let steps = 0;
    while (this.accumulator + 1e-12 >= FIXED_TICK_SECONDS && steps < MAX_STEPS_PER_ADVANCE) {
      const result = stepBattle(this.state);
      this.state = result.state;
      this.pendingEvents.push(...result.events);
      this.accumulator -= FIXED_TICK_SECONDS;
      steps += 1;
      if (this.state.status !== 'running') {
        this.accumulator = 0;
        break;
      }
    }

    if (steps >= MAX_STEPS_PER_ADVANCE) {
      this.accumulator = 0;
    }
  }
}
