import { describe, expect, it } from 'vitest';
import {
  LaserCrocodileLocomotion,
  type LaserLocomotionSprite,
  type LaserLocomotionTween,
  type LaserLocomotionTweenConfig,
  type LaserLocomotionTweens,
} from '../../src/game/rendering/laserCrocodileLocomotion';

interface FakeSprite extends LaserLocomotionSprite {
  scaleX: number;
  scaleY: number;
  y: number;
  setScale(x: number, y: number): void;
  setY(y: number): void;
}

interface FakeTween extends LaserLocomotionTween {
  removed: boolean;
  config: LaserLocomotionTweenConfig;
}

interface FakeTweens extends LaserLocomotionTweens {
  readonly added: FakeTween[];
}

function makeSprite(scaleX = 0.4375, scaleY = 0.4375, y = 30): FakeSprite {
  const sprite: FakeSprite = {
    scaleX,
    scaleY,
    y,
    setScale(x, ny) {
      sprite.scaleX = x;
      sprite.scaleY = ny;
    },
    setY(ny) {
      sprite.y = ny;
    },
  };
  return sprite;
}

function makeTweens(): FakeTweens {
  const added: FakeTween[] = [];
  return {
    added,
    add(config) {
      const tween: FakeTween = {
        removed: false,
        config,
        remove() {
          tween.removed = true;
        },
      };
      added.push(tween);
      return tween;
    },
  };
}

describe('LaserCrocodileLocomotion', () => {
  it('starts an idle breathing tween that scales and floats around the base transform', () => {
    const sprite = makeSprite();
    const tweens = makeTweens();
    const locomotion = new LaserCrocodileLocomotion({ sprite, tweens });

    locomotion.play('idle');

    expect(tweens.added).toHaveLength(1);
    const config = tweens.added[0]?.config;
    expect(config).toMatchObject({
      targets: sprite,
      scaleX: 0.4375 * 1.02,
      scaleY: 0.4375 * 1.02,
      y: 30 - 1.5,
      duration: 1400,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  });

  it('starts a walk bob tween without scaling the body', () => {
    const sprite = makeSprite();
    const tweens = makeTweens();
    const locomotion = new LaserCrocodileLocomotion({ sprite, tweens });

    locomotion.play('walk');

    expect(tweens.added).toHaveLength(1);
    const config = tweens.added[0]?.config;
    expect(config).toMatchObject({ y: 30 - 1.8, duration: 440, yoyo: true, repeat: -1 });
    expect(config?.scaleX).toBeUndefined();
    expect(config?.scaleY).toBeUndefined();
  });

  it('keeps the same tween when asked to play the current kind again', () => {
    const sprite = makeSprite();
    const tweens = makeTweens();
    const locomotion = new LaserCrocodileLocomotion({ sprite, tweens });

    locomotion.play('idle');
    locomotion.play('idle');

    expect(tweens.added).toHaveLength(1);
    expect(tweens.added[0]?.removed).toBe(false);
  });

  it('switches from idle to walk by removing the old tween', () => {
    const sprite = makeSprite();
    const tweens = makeTweens();
    const locomotion = new LaserCrocodileLocomotion({ sprite, tweens });

    locomotion.play('idle');
    locomotion.play('walk');

    expect(tweens.added).toHaveLength(2);
    expect(tweens.added[0]?.removed).toBe(true);
    expect(tweens.added[1]?.removed).toBe(false);
    expect(tweens.added[1]?.config.duration).toBe(440);
  });

  it('switches back from walk to idle', () => {
    const sprite = makeSprite();
    const tweens = makeTweens();
    const locomotion = new LaserCrocodileLocomotion({ sprite, tweens });

    locomotion.play('walk');
    locomotion.play('idle');

    expect(tweens.added).toHaveLength(2);
    expect(tweens.added[1]?.config.duration).toBe(1400);
    expect(tweens.added[1]?.config.scaleX).toBe(0.4375 * 1.02);
  });

  it('stop removes the active tween and resets the sprite to its base transform', () => {
    const sprite = makeSprite();
    const tweens = makeTweens();
    const locomotion = new LaserCrocodileLocomotion({ sprite, tweens });

    locomotion.play('walk');
    sprite.scaleX = 0.5;
    sprite.scaleY = 0.5;
    sprite.y = 20;

    locomotion.stop();

    expect(tweens.added[0]?.removed).toBe(true);
    expect(sprite.scaleX).toBe(0.4375);
    expect(sprite.scaleY).toBe(0.4375);
    expect(sprite.y).toBe(30);
  });

  it('stop is a safe no-op when nothing is playing', () => {
    const sprite = makeSprite();
    const tweens = makeTweens();
    const locomotion = new LaserCrocodileLocomotion({ sprite, tweens });

    locomotion.stop();
    locomotion.stop();

    expect(tweens.added).toHaveLength(0);
    expect(sprite.y).toBe(30);
  });

  it('captures the base transform from the sprite at construction time', () => {
    const sprite = makeSprite(0.5, 0.6, 42);
    const tweens = makeTweens();
    const locomotion = new LaserCrocodileLocomotion({ sprite, tweens });

    locomotion.play('idle');
    locomotion.stop();

    expect(sprite.scaleX).toBe(0.5);
    expect(sprite.scaleY).toBe(0.6);
    expect(sprite.y).toBe(42);
  });
});
