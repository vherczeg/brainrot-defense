import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { ENEMY_DEFINITIONS } from '../../src/game/domain/enemies';
import {
  SHADOW_RUNNER_ANIMATIONS,
  SHADOW_RUNNER_ENEMY_ID,
  preloadShadowRunner,
  registerShadowRunnerAnimations,
  shadowRunnerAnimationKey,
  shadowRunnerIconPath,
  shadowRunnerIconUrl,
  shadowRunnerStaticPath,
  shadowRunnerStaticPaths,
} from '../../src/game/rendering/shadowRunner';
import { resolvePublicAssetUrl } from '../../src/game/rendering/publicAssets';

describe('shadow runner asset mapping', () => {
  it('matches the existing enemy type ID', () => {
    expect(SHADOW_RUNNER_ENEMY_ID).toBe('shadow-runner');
    expect(ENEMY_DEFINITIONS).toHaveProperty(SHADOW_RUNNER_ENEMY_ID);
  });

  it('maps animation states and static portrait paths without merge tiers', () => {
    expect(shadowRunnerAnimationKey('idle')).toBe('shadow-runner-idle');
    expect(shadowRunnerAnimationKey('walk')).toBe('shadow-runner-walk');
    expect(shadowRunnerAnimationKey('attack')).toBe('shadow-runner-attack');
    expect(shadowRunnerAnimationKey('hurt')).toBe('shadow-runner-hurt');
    expect(shadowRunnerIconPath()).toBe('assets/icons/shadow-runner.png');
    expect(shadowRunnerStaticPath()).toBe('assets/units/shadow-runner/shadow-runner.png');
    expect(shadowRunnerStaticPaths()).toEqual([
      'assets/units/shadow-runner/shadow-runner.png',
      'assets/icons/shadow-runner.png',
    ]);
    expect(shadowRunnerIconUrl('/brainrot/')).toBe('/brainrot/assets/icons/shadow-runner.png');
  });

  it('describes four-frame 1024x256 spritesheets', () => {
    expect(SHADOW_RUNNER_ANIMATIONS.map((animation) => animation.key)).toEqual([
      'shadow-runner-idle',
      'shadow-runner-walk',
      'shadow-runner-attack',
      'shadow-runner-hurt',
    ]);
    for (const animation of SHADOW_RUNNER_ANIMATIONS) {
      expect(animation.url).toMatch(/^\/assets\/units\/shadow-runner\//);
      expect(animation.frameWidth).toBe(256);
      expect(animation.frameHeight).toBe(256);
      expect(animation.frames).toBe(4);
      expect(animation.origin).toEqual([0.5, 0.875]);
    }
  });

  it('has a matching public file for every manifest animation URL and static image', async () => {
    for (const animation of SHADOW_RUNNER_ANIMATIONS) {
      const filePath = resolve('public', animation.url.replace(/^\/+/, ''));
      await expect(access(filePath)).resolves.toBeUndefined();
    }
    for (const asset of shadowRunnerStaticPaths()) {
      await expect(access(resolve('public', asset))).resolves.toBeUndefined();
    }
  });

  it('resolves public URLs through the Vite base path', () => {
    expect(resolvePublicAssetUrl('/assets/units/shadow-runner/idle.png', '/')).toBe(
      '/assets/units/shadow-runner/idle.png',
    );
    expect(resolvePublicAssetUrl('/assets/units/shadow-runner/walk.png', '/brainrot/')).toBe(
      '/brainrot/assets/units/shadow-runner/walk.png',
    );
    expect(resolvePublicAssetUrl('assets/units/shadow-runner/attack.png', '/brainrot')).toBe(
      '/brainrot/assets/units/shadow-runner/attack.png',
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
    preloadShadowRunner(scene, '/brainrot/');
    registerShadowRunnerAnimations(scene);
    expect(spritesheet).toHaveBeenCalledTimes(SHADOW_RUNNER_ANIMATIONS.length);
    expect(spritesheet).toHaveBeenNthCalledWith(
      1,
      'shadow-runner-idle',
      '/brainrot/assets/units/shadow-runner/idle.png',
      { frameWidth: 256, frameHeight: 256, endFrame: 3 },
    );
    expect(create).toHaveBeenCalledTimes(SHADOW_RUNNER_ANIMATIONS.length);
    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ key: 'shadow-runner-idle', frameRate: 5, repeat: -1 }),
    );
  });
});
