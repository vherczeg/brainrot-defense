export type LaserCrocodileLocomotionKind = 'idle' | 'walk';

export interface LaserLocomotionSprite {
  readonly scaleX: number;
  readonly scaleY: number;
  readonly y: number;
  setScale(x: number, y: number): unknown;
  setY(y: number): unknown;
}

export interface LaserLocomotionTween {
  remove(): void;
}

export interface LaserLocomotionTweenConfig {
  readonly targets: LaserLocomotionSprite;
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly y?: number;
  readonly duration: number;
  readonly ease: string;
  readonly yoyo: boolean;
  readonly repeat: number;
}

export interface LaserLocomotionTweens {
  add(config: LaserLocomotionTweenConfig): LaserLocomotionTween;
}

export interface LaserCrocodileLocomotionOptions {
  readonly sprite: LaserLocomotionSprite;
  readonly tweens: LaserLocomotionTweens;
  readonly breatheScale?: number;
  readonly idleFloat?: number;
  readonly idleDuration?: number;
  readonly walkBob?: number;
  readonly walkDuration?: number;
}

export const LASER_CROCODILE_IDLE_BREATHE_SCALE = 0.02;
export const LASER_CROCODILE_IDLE_FLOAT = 1.5;
export const LASER_CROCODILE_IDLE_DURATION = 1400;
export const LASER_CROCODILE_WALK_BOB = 1.8;
export const LASER_CROCODILE_WALK_DURATION = 440;

export class LaserCrocodileLocomotion {
  private readonly sprite: LaserLocomotionSprite;
  private readonly tweens: LaserLocomotionTweens;
  private readonly breatheScale: number;
  private readonly idleFloat: number;
  private readonly idleDuration: number;
  private readonly walkBob: number;
  private readonly walkDuration: number;
  private readonly baseScaleX: number;
  private readonly baseScaleY: number;
  private readonly baseY: number;
  private kind: LaserCrocodileLocomotionKind | null = null;
  private tween: LaserLocomotionTween | null = null;

  constructor(options: LaserCrocodileLocomotionOptions) {
    this.sprite = options.sprite;
    this.tweens = options.tweens;
    this.breatheScale = options.breatheScale ?? LASER_CROCODILE_IDLE_BREATHE_SCALE;
    this.idleFloat = options.idleFloat ?? LASER_CROCODILE_IDLE_FLOAT;
    this.idleDuration = options.idleDuration ?? LASER_CROCODILE_IDLE_DURATION;
    this.walkBob = options.walkBob ?? LASER_CROCODILE_WALK_BOB;
    this.walkDuration = options.walkDuration ?? LASER_CROCODILE_WALK_DURATION;
    this.baseScaleX = options.sprite.scaleX;
    this.baseScaleY = options.sprite.scaleY;
    this.baseY = options.sprite.y;
  }

  play(kind: LaserCrocodileLocomotionKind): void {
    if (this.kind === kind && this.tween) return;
    this.stopTween();
    this.kind = kind;
    this.tween = this.tweens.add(this.configFor(kind));
  }

  stop(): void {
    this.stopTween();
    this.kind = null;
    this.reset();
  }

  private configFor(kind: LaserCrocodileLocomotionKind): LaserLocomotionTweenConfig {
    if (kind === 'idle') {
      return {
        targets: this.sprite,
        scaleX: this.baseScaleX * (1 + this.breatheScale),
        scaleY: this.baseScaleY * (1 + this.breatheScale),
        y: this.baseY - this.idleFloat,
        duration: this.idleDuration,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      };
    }
    return {
      targets: this.sprite,
      y: this.baseY - this.walkBob,
      duration: this.walkDuration,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    };
  }

  private stopTween(): void {
    if (this.tween) {
      this.tween.remove();
      this.tween = null;
    }
  }

  private reset(): void {
    this.sprite.setScale(this.baseScaleX, this.baseScaleY);
    this.sprite.setY(this.baseY);
  }
}
