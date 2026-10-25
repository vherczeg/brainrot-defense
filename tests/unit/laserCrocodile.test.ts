import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import {
  LASER_CROCODILE_ANIMATIONS,
  laserCrocodileAnimationKey,
  laserCrocodileIconPath,
  laserCrocodileStaticPaths,
  laserCrocodileTier,
  preloadLaserCrocodile,
  resolvePublicAssetUrl,
} from '../../src/game/rendering/laserCrocodile';

describe('laser crocodile asset mapping', () => {
  it('selects the visual tier from merge rank only', () => {
    expect([1, 2, 3].map(laserCrocodileTier)).toEqual(['v1', 'v1', 'v1']);
    expect([4, 5, 6, 7].map(laserCrocodileTier)).toEqual(['v2', 'v2', 'v2', 'v2']);
    expect([8, 9, 10].map(laserCrocodileTier)).toEqual(['v3', 'v3', 'v3']);
  });

  it('maps each tier to its static icon and animation keys', () => {
    expect(laserCrocodileIconPath(1)).toBe('assets/icons/laser-crocodile-v1.png');
    expect(laserCrocodileIconPath(5)).toBe('assets/icons/laser-crocodile-v2.png');
    expect(laserCrocodileIconPath(10)).toBe('assets/icons/laser-crocodile-v3.png');
    expect(laserCrocodileStaticPaths()).toEqual([
      'assets/units/laser-crocodile/v1.png',
      'assets/units/laser-crocodile/v2.png',
      'assets/units/laser-crocodile/v3.png',
    ]);
    expect(laserCrocodileAnimationKey('v2', 'attack')).toBe('lc-v2-attack');
    expect(laserCrocodileAnimationKey('v3', 'hurt')).toBe('lc-v3-hurt');
    expect(laserCrocodileAnimationKey('v1', 'death')).toBe('lc-v1-death');
  });

  it('describes four-frame 1024x256 spritesheets for all unit and effect animations', () => {
    expect(LASER_CROCODILE_ANIMATIONS).toHaveLength(19);
    for (const animation of LASER_CROCODILE_ANIMATIONS) {
      expect(animation.url).toMatch(/^\/assets\/(units|effects)\/laser-crocodile\//);
      expect(animation.frameWidth).toBe(256);
      expect(animation.frameHeight).toBe(256);
      expect(animation.frames).toBe(4);
      expect(animation.origin).toEqual([0.5, animation.key.startsWith('lc-fx-') ? 0.5 : 0.875]);
    }
  });

  it('describes one four-frame 8fps death animation per visual tier', () => {
    const deaths = LASER_CROCODILE_ANIMATIONS.filter((animation) =>
      animation.key.endsWith('-death'),
    );
    expect(deaths.map((animation) => animation.key)).toEqual([
      'lc-v1-death',
      'lc-v2-death',
      'lc-v3-death',
    ]);
    for (const death of deaths) {
      expect(death.url).toMatch(/^\/assets\/units\/laser-crocodile\/v[123]-death\.png$/);
      expect(death.frames).toBe(4);
      expect(death.fps).toBe(8);
      expect(death.repeat).toBe(0);
      expect(death.origin).toEqual([0.5, 0.875]);
    }
  });

  it('resolves URLs against the Vite base path at the root and under a subpath', () => {
    expect(resolvePublicAssetUrl('/assets/icons/laser-crocodile-v1.png', '/')).toBe(
      '/assets/icons/laser-crocodile-v1.png',
    );
    expect(resolvePublicAssetUrl('/assets/icons/laser-crocodile-v2.png', '/brainrot/')).toBe(
      '/brainrot/assets/icons/laser-crocodile-v2.png',
    );
    expect(resolvePublicAssetUrl('assets/icons/laser-crocodile-v3.png', '/brainrot')).toBe(
      '/brainrot/assets/icons/laser-crocodile-v3.png',
    );
  });

  it('preloads spritesheets through the supplied base URL', () => {
    const spritesheet = vi.fn();
    const scene = { load: { spritesheet } } as unknown as Phaser.Scene;
    preloadLaserCrocodile(scene, '/brainrot/');
    expect(spritesheet).toHaveBeenCalledTimes(LASER_CROCODILE_ANIMATIONS.length);
    expect(spritesheet).toHaveBeenNthCalledWith(
      1,
      'lc-v1-idle',
      '/brainrot/assets/units/laser-crocodile/v1-idle.png',
      { frameWidth: 256, frameHeight: 256, endFrame: 3 },
    );
  });
});
