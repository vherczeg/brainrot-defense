import { describe, expect, it, vi } from 'vitest';
import {
  playLaserCrocodileDeathOnce,
  type LaserDeathSprite,
} from '../../src/game/rendering/laserCrocodileDeath';

interface FakeDeathSprite extends LaserDeathSprite {
  played: string[];
  onceHandlers: Map<string, () => void>;
  anims: { isPlaying: boolean; currentAnim: { key: string } | null };
  once(event: string, handler: () => void): unknown;
  off(event: string, handler: () => void): unknown;
  play(key: string): unknown;
  complete(key: string): void;
}

function makeDeathSprite(): FakeDeathSprite {
  const onceHandlers = new Map<string, () => void>();
  const sprite: FakeDeathSprite = {
    played: [],
    onceHandlers,
    anims: { isPlaying: false, currentAnim: null },
    once(event, handler) {
      onceHandlers.set(event, handler);
      return sprite;
    },
    off(event, handler) {
      if (onceHandlers.get(event) === handler) onceHandlers.delete(event);
      return sprite;
    },
    play(key) {
      sprite.played.push(key);
      return sprite;
    },
    complete(key) {
      const handler = onceHandlers.get(`animationcomplete-${key}`);
      if (handler) {
        onceHandlers.delete(`animationcomplete-${key}`);
        handler();
      }
    },
  };
  return sprite;
}

describe('playLaserCrocodileDeathOnce', () => {
  it('plays the death animation once and hides on completion', () => {
    const sprite = makeDeathSprite();
    const hide = vi.fn();
    playLaserCrocodileDeathOnce(sprite, 'lc-v1-death', true, hide);

    expect(sprite.played).toEqual(['lc-v1-death']);
    expect(hide).not.toHaveBeenCalled();

    sprite.complete('lc-v1-death');
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('hides immediately when the death animation is missing', () => {
    const sprite = makeDeathSprite();
    const hide = vi.fn();
    playLaserCrocodileDeathOnce(sprite, 'lc-v1-death', false, hide);

    expect(sprite.played).toEqual([]);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('does not restart an already-playing death animation', () => {
    const sprite = makeDeathSprite();
    sprite.anims.isPlaying = true;
    sprite.anims.currentAnim = { key: 'lc-v1-death' };
    const hide = vi.fn();
    playLaserCrocodileDeathOnce(sprite, 'lc-v1-death', true, hide);

    expect(sprite.played).toEqual([]);
    sprite.complete('lc-v1-death');
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('removes its completion listener after hiding', () => {
    const sprite = makeDeathSprite();
    const hide = vi.fn();
    playLaserCrocodileDeathOnce(sprite, 'lc-v1-death', true, hide);
    sprite.complete('lc-v1-death');
    expect(sprite.onceHandlers.has('animationcomplete-lc-v1-death')).toBe(false);
  });
});

it('cancels the death completion callback when the view is removed', () => {
  const sprite = makeDeathSprite();
  const hide = vi.fn();
  const cancel = playLaserCrocodileDeathOnce(sprite, 'lc-v2-death', true, hide);
  cancel();
  cancel();
  sprite.complete('lc-v2-death');
  expect(hide).not.toHaveBeenCalled();
  expect(sprite.onceHandlers.size).toBe(0);
});
