import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { ENEMY_DEFINITIONS } from '../../src/game/domain/enemies';
import {
  ARMORED_SNAIL_ANIMATIONS,
  ARMORED_SNAIL_ASSET_ID,
  ARMORED_SNAIL_ENEMY_ID,
  armoredSnailAnimationKey,
  armoredSnailIconPath,
  armoredSnailIconUrl,
  armoredSnailStaticPath,
  armoredSnailStaticPaths,
  preloadArmoredSnail,
  registerArmoredSnailAnimations,
} from '../../src/game/rendering/armoredSnail';
import { resolvePublicAssetUrl } from '../../src/game/rendering/publicAssets';

describe('armored snail asset mapping', () => {
  it('maps the asset ID to the existing armored-slug enemy ID', () => {
    expect(ARMORED_SNAIL_ASSET_ID).toBe('armored-snail');
    expect(ARMORED_SNAIL_ENEMY_ID).toBe('armored-slug');
    expect(ENEMY_DEFINITIONS).toHaveProperty(ARMORED_SNAIL_ENEMY_ID);
  });

  it('maps animation states and static portrait paths without merge tiers', () => {
    expect(armoredSnailAnimationKey('idle')).toBe('armored-snail-idle');
    expect(armoredSnailAnimationKey('walk')).toBe('armored-snail-walk');
    expect(armoredSnailAnimationKey('attack')).toBe('armored-snail-attack');
    expect(armoredSnailAnimationKey('hurt')).toBe('armored-snail-hurt');
    expect(armoredSnailIconPath()).toBe('assets/icons/armored-snail.png');
    expect(armoredSnailStaticPath()).toBe('assets/units/armored-snail/armored-snail.png');
    expect(armoredSnailStaticPaths()).toEqual([
      'assets/units/armored-snail/armored-snail.png',
      'assets/icons/armored-snail.png',
    ]);
    expect(armoredSnailIconUrl('/brainrot/')).toBe('/brainrot/assets/icons/armored-snail.png');
  });

  it('describes four-frame 1024x256 spritesheets', () => {
    expect(ARMORED_SNAIL_ANIMATIONS.map((animation) => animation.key)).toEqual([
      'armored-snail-idle',
      'armored-snail-walk',
      'armored-snail-attack',
      'armored-snail-hurt',
    ]);
    for (const animation of ARMORED_SNAIL_ANIMATIONS) {
      expect(animation.url).toMatch(/^\/assets\/units\/armored-snail\//);
      expect(animation.frameWidth).toBe(256);
      expect(animation.frameHeight).toBe(256);
      expect(animation.frames).toBe(4);
      expect(animation.origin).toEqual([0.5, 0.875]);
    }
  });

  it('has a matching public file for every manifest animation URL and static image', async () => {
    for (const animation of ARMORED_SNAIL_ANIMATIONS) {
      const filePath = resolve('public', animation.url.replace(/^\/+/, ''));
      await expect(access(filePath)).resolves.toBeUndefined();
    }
    for (const asset of armoredSnailStaticPaths()) {
      await expect(access(resolve('public', asset))).resolves.toBeUndefined();
    }
  });

  it('resolves public URLs through the Vite base path', () => {
    expect(resolvePublicAssetUrl('/assets/units/armored-snail/idle.png', '/')).toBe(
      '/assets/units/armored-snail/idle.png',
    );
    expect(resolvePublicAssetUrl('/assets/units/armored-snail/walk.png', '/brainrot/')).toBe(
      '/brainrot/assets/units/armored-snail/walk.png',
    );
    expect(resolvePublicAssetUrl('assets/units/armored-snail/attack.png', '/brainrot')).toBe(
      '/brainrot/assets/units/armored-snail/attack.png',
    );
  });

  it('preloads spritesheets and registers animations through the supplied base URL', () => {
    const spritesheet = vi.fn();
    const exists = vi.fn(() => false);
    const create = vi.fn();
    const generateFrameNumbers = vi.fn(() => []);
    const scene = {
      load: { spritesheet },
      anims: { exists, create, generateFrameNumbers },
    } as unknown as Phaser.Scene;
    preloadArmoredSnail(scene, '/brainrot/');
    registerArmoredSnailAnimations(scene);
    expect(spritesheet).toHaveBeenCalledTimes(ARMORED_SNAIL_ANIMATIONS.length);
    expect(spritesheet).toHaveBeenNthCalledWith(
      1,
      'armored-snail-idle',
      '/brainrot/assets/units/armored-snail/idle.png',
      { frameWidth: 256, frameHeight: 256, endFrame: 3 },
    );
    expect(create).toHaveBeenCalledTimes(ARMORED_SNAIL_ANIMATIONS.length);
    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ key: 'armored-snail-idle', frameRate: 5, repeat: -1 }),
    );
  });
});
