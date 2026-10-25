export const LASER_FIRE_FRAME_INDEX = 2;

export interface LaserPoint {
  readonly px: number;
  readonly py: number;
}

export type LaserReleaseFrameHandler = (
  animation: unknown,
  frame: { readonly textureFrame: number | string },
) => void;

export interface LaserReleaseSprite {
  setFlipX(value: boolean): unknown;
  on(event: 'animationupdate', handler: LaserReleaseFrameHandler): unknown;
  off(event: 'animationupdate', handler: LaserReleaseFrameHandler): unknown;
}

export interface LaserAttackReleaseOptions {
  readonly sprite: LaserReleaseSprite;
  readonly from: LaserPoint;
  readonly to: LaserPoint;
  readonly animationKey?: string;
  readonly getOrigin?: () => LaserPoint;
  readonly fire: (from: LaserPoint, to: LaserPoint) => void;
}

export class LaserAttackRelease {
  private readonly sprite: LaserReleaseSprite;
  private readonly from: LaserPoint;
  private readonly to: LaserPoint;
  private readonly fireShot: (from: LaserPoint, to: LaserPoint) => void;
  private readonly getOrigin: (() => LaserPoint) | undefined;
  private readonly handler: LaserReleaseFrameHandler;
  private released = false;
  private cancelled = false;

  constructor(options: LaserAttackReleaseOptions) {
    this.sprite = options.sprite;
    this.from = options.from;
    this.to = options.to;
    this.fireShot = options.fire;
    this.getOrigin = options.getOrigin;
    this.handler = (_animation, frame) => {
      // Phaser AnimationFrame.index is one-based; textureFrame is the sheet index.
      const frameIndex = Number(frame.textureFrame);
      if (!Number.isFinite(frameIndex) || frameIndex < LASER_FIRE_FRAME_INDEX) return;
      if (
        options.animationKey &&
        (!_animation ||
          typeof _animation !== 'object' ||
          !('key' in _animation) ||
          _animation.key !== options.animationKey)
      )
        return;
      this.release();
    };
    this.sprite.setFlipX(this.to.px < this.from.px);
    this.sprite.on('animationupdate', this.handler);
  }

  release(): void {
    if (this.released || this.cancelled) return;
    this.released = true;
    this.detach();
    this.fireShot(this.getOrigin?.() ?? this.from, this.to);
  }

  cancel(): void {
    if (this.cancelled || this.released) return;
    this.cancelled = true;
    this.detach();
  }

  private detach(): void {
    this.sprite.off('animationupdate', this.handler);
  }
}
