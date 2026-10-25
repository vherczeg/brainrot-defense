import { describe, expect, it, vi } from 'vitest';
import {
  LASER_FIRE_FRAME_INDEX,
  LaserAttackRelease,
  type LaserReleaseFrameHandler,
  type LaserReleaseSprite,
} from '../../src/game/rendering/laserAttackRelease';

interface FakeSprite extends LaserReleaseSprite {
  flipX: boolean;
  handlers: LaserReleaseFrameHandler[];
  setFlipX(value: boolean): void;
  on(event: 'animationupdate', handler: LaserReleaseFrameHandler): unknown;
  off(event: 'animationupdate', handler: LaserReleaseFrameHandler): unknown;
  emitUpdate(frameIndex: number): void;
}

function makeSprite(): FakeSprite {
  const handlers: LaserReleaseFrameHandler[] = [];
  const sprite: FakeSprite = {
    flipX: false,
    handlers,
    setFlipX(value: boolean): void {
      sprite.flipX = value;
    },
    on(_event, handler) {
      handlers.push(handler);
      return sprite;
    },
    off(_event, handler) {
      const index = handlers.indexOf(handler);
      if (index >= 0) handlers.splice(index, 1);
      return sprite;
    },
    emitUpdate(frameIndex: number): void {
      const frame = { textureFrame: frameIndex, index: frameIndex + 1 };
      for (const handler of [...handlers]) handler(null, frame);
    },
  };
  return sprite;
}

const fire = vi.fn<(from: { px: number; py: number }, to: { px: number; py: number }) => void>();

describe('LaserAttackRelease', () => {
  it('releases the shot exactly once on the fire frame index', () => {
    fire.mockClear();
    const sprite = makeSprite();
    const release = new LaserAttackRelease({
      sprite,
      from: { px: 10, py: 20 },
      to: { px: 110, py: 20 },
      fire,
    });

    sprite.emitUpdate(0);
    sprite.emitUpdate(1);
    expect(fire).not.toHaveBeenCalled();

    sprite.emitUpdate(LASER_FIRE_FRAME_INDEX);
    expect(fire).toHaveBeenCalledTimes(1);
    expect(fire).toHaveBeenCalledWith({ px: 10, py: 20 }, { px: 110, py: 20 });

    sprite.emitUpdate(LASER_FIRE_FRAME_INDEX);
    sprite.emitUpdate(3);
    expect(fire).toHaveBeenCalledTimes(1);
    expect(sprite.handlers).toHaveLength(0);
    expect(release).toBeDefined();
  });

  it('flips the sprite toward the target direction', () => {
    fire.mockClear();
    const right = makeSprite();
    new LaserAttackRelease({
      sprite: right,
      from: { px: 10, py: 20 },
      to: { px: 110, py: 20 },
      fire,
    });
    expect(right.flipX).toBe(false);

    const left = makeSprite();
    new LaserAttackRelease({
      sprite: left,
      from: { px: 110, py: 20 },
      to: { px: 10, py: 20 },
      fire,
    });
    expect(left.flipX).toBe(true);
  });

  it('cancel detaches the listener and prevents any later release', () => {
    fire.mockClear();
    const sprite = makeSprite();
    const release = new LaserAttackRelease({
      sprite,
      from: { px: 10, py: 20 },
      to: { px: 110, py: 20 },
      fire,
    });

    release.cancel();
    expect(sprite.handlers).toHaveLength(0);

    sprite.emitUpdate(LASER_FIRE_FRAME_INDEX);
    expect(fire).not.toHaveBeenCalled();

    release.release();
    expect(fire).not.toHaveBeenCalled();
  });

  it('manual release fires once and is idempotent (explicit fallback)', () => {
    fire.mockClear();
    const sprite = makeSprite();
    const release = new LaserAttackRelease({
      sprite,
      from: { px: 10, py: 20 },
      to: { px: 110, py: 20 },
      fire,
    });

    release.release();
    expect(fire).toHaveBeenCalledTimes(1);
    expect(sprite.handlers).toHaveLength(0);

    release.release();
    sprite.emitUpdate(LASER_FIRE_FRAME_INDEX);
    expect(fire).toHaveBeenCalledTimes(1);
  });
});

describe('Phaser frame event contract', () => {
  it('waits for texture frame 2 even though Phaser index is already 2 on the charge pose', () => {
    const sprite = makeSprite();
    const shot = vi.fn();
    new LaserAttackRelease({ sprite, from: { px: 0, py: 0 }, to: { px: 100, py: 0 }, fire: shot });
    sprite.emitUpdate(1);
    expect(shot).not.toHaveBeenCalled();
    sprite.emitUpdate(2);
    expect(shot).toHaveBeenCalledOnce();
  });

  it('ignores updates from a different animation and uses the live cannon position', () => {
    const sprite = makeSprite();
    const shot = vi.fn();
    const origin = { px: 35, py: -22 };
    new LaserAttackRelease({
      sprite,
      from: { px: 0, py: 0 },
      to: { px: 100, py: 0 },
      fire: shot,
      animationKey: 'lc-v1-attack',
      getOrigin: () => origin,
    });
    sprite.handlers[0]?.({ key: 'lc-v1-idle' }, { textureFrame: 2 });
    expect(shot).not.toHaveBeenCalled();
    origin.px = 55;
    sprite.handlers[0]?.({ key: 'lc-v1-attack' }, { textureFrame: 2 });
    expect(shot).toHaveBeenCalledWith({ px: 55, py: -22 }, { px: 100, py: 0 });
  });

  it('still releases once when a slow rendered frame skips directly to recovery', () => {
    const sprite = makeSprite();
    const shot = vi.fn();
    new LaserAttackRelease({ sprite, from: { px: 0, py: 0 }, to: { px: 100, py: 0 }, fire: shot });
    sprite.emitUpdate(3);
    sprite.emitUpdate(3);
    expect(shot).toHaveBeenCalledOnce();
  });
});
