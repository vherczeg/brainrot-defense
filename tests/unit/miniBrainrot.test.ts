import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { ENEMY_DEFINITIONS } from '../../src/game/domain/enemies';
import {
  MINI_BRAINROT_ANIMATIONS,
  MINI_BRAINROT_ENEMY_ID,
  miniBrainrotAnimationKey,
  miniBrainrotIconPath,
  miniBrainrotIconUrl,
  miniBrainrotStaticPath,
  miniBrainrotStaticPaths,
  preloadMiniBrainrot,
  registerMiniBrainrotAnimations,
} from '../../src/game/rendering/miniBrainrot';
import { resolvePublicAssetUrl } from '../../src/game/rendering/publicAssets';

describe('mini brainrot asset mapping', () => {
  it('matches the existing enemy type ID', () => {
    expect(MINI_BRAINROT_ENEMY_ID).toBe('mini-brainrot');
    expect(ENEMY_DEFINITIONS).toHaveProperty(MINI_BRAINROT_ENEMY_ID);
  });

  it('maps animation states and static portrait paths without merge tiers', () => {
    expect(miniBrainrotAnimationKey('idle')).toBe('mini-brainrot-idle');
    expect(miniBrainrotAnimationKey('walk')).toBe('mini-brainrot-walk');
    expect(miniBrainrotAnimationKey('attack')).toBe('mini-brainrot-attack');
    expect(miniBrainrotAnimationKey('hurt')).toBe('mini-brainrot-hurt');
    expect(miniBrainrotIconPath()).toBe('assets/icons/mini-brainrot.png');
    expect(miniBrainrotStaticPath()).toBe('assets/units/mini-brainrot/mini-brainrot.png');
    expect(miniBrainrotStaticPaths()).toEqual([
      'assets/units/mini-brainrot/mini-brainrot.png',
      'assets/icons/mini-brainrot.png',
    ]);
    expect(miniBrainrotIconUrl('/brainrot/')).toBe('/brainrot/assets/icons/mini-brainrot.png');
  });

  it('describes four-frame 1024x256 spritesheets', () => {
    expect(MINI_BRAINROT_ANIMATIONS.map((animation) => animation.key)).toEqual([
      'mini-brainrot-idle',
      'mini-brainrot-walk',
      'mini-brainrot-attack',
      'mini-brainrot-hurt',
    ]);
    for (const animation of MINI_BRAINROT_ANIMATIONS) {
      expect(animation.url).toMatch(/^\/assets\/units\/mini-brainrot\//);
      expect(animation.frameWidth).toBe(256);
      expect(animation.frameHeight).toBe(256);
      expect(animation.frames).toBe(4);
      expect(animation.origin).toEqual([0.5, 0.875]);
    }
  });

  it('has a matching public file for every manifest animation URL and static image', async () => {
    for (const animation of MINI_BRAINROT_ANIMATIONS) {
      const filePath = resolve('public', animation.url.replace(/^\/+/, ''));
      await expect(access(filePath)).resolves.toBeUndefined();
    }
    for (const asset of miniBrainrotStaticPaths()) {
      await expect(access(resolve('public', asset))).resolves.toBeUndefined();
    }
  });

  it('resolves public URLs through the Vite base path', () => {
    expect(resolvePublicAssetUrl('/assets/units/mini-brainrot/idle.png', '/')).toBe(
      '/assets/units/mini-brainrot/idle.png',
    );
    expect(resolvePublicAssetUrl('/assets/units/mini-brainrot/walk.png', '/brainrot/')).toBe(
      '/brainrot/assets/units/mini-brainrot/walk.png',
    );
    expect(resolvePublicAssetUrl('assets/units/mini-brainrot/attack.png', '/brainrot')).toBe(
      '/brainrot/assets/units/mini-brainrot/attack.png',
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
    preloadMiniBrainrot(scene, '/brainrot/');
    registerMiniBrainrotAnimations(scene);
    expect(spritesheet).toHaveBeenCalledTimes(MINI_BRAINROT_ANIMATIONS.length);
    expect(spritesheet).toHaveBeenNthCalledWith(
      1,
      'mini-brainrot-idle',
      '/brainrot/assets/units/mini-brainrot/idle.png',
      { frameWidth: 256, frameHeight: 256, endFrame: 3 },
    );
    expect(create).toHaveBeenCalledTimes(MINI_BRAINROT_ANIMATIONS.length);
    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ key: 'mini-brainrot-idle', frameRate: 5, repeat: -1 }),
    );
  });
});
