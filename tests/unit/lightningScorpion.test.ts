import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import {
  LIGHTNING_SCORPION_ANIMATIONS,
  LIGHTNING_SCORPION_EFFECTS,
  lightningScorpionAnimationKey,
  lightningScorpionIconPath,
  lightningScorpionStaticPaths,
  lightningScorpionTier,
  preloadLightningScorpion,
  registerLightningScorpionAnimations,
} from '../../src/game/rendering/lightningScorpion';
import { resolvePublicAssetUrl } from '../../src/game/rendering/publicAssets';

describe('lightning scorpion asset mapping', () => {
  it('selects the visual tier from merge rank only', () => {
    expect([1, 2, 3].map(lightningScorpionTier)).toEqual(['v1', 'v1', 'v1']);
    expect([4, 5, 6, 7].map(lightningScorpionTier)).toEqual(['v2', 'v2', 'v2', 'v2']);
    expect([8, 9, 10].map(lightningScorpionTier)).toEqual(['v3', 'v3', 'v3']);
  });

  it('maps each tier to its own scorpion icon and animation keys', () => {
    expect(lightningScorpionIconPath(1)).toBe('assets/icons/lightning-scorpion-v1.png');
    expect(lightningScorpionIconPath(5)).toBe('assets/icons/lightning-scorpion-v2.png');
    expect(lightningScorpionIconPath(10)).toBe('assets/icons/lightning-scorpion-v3.png');
    expect(lightningScorpionStaticPaths()).toEqual([
      'assets/units/lightning-scorpion/v1.png',
      'assets/units/lightning-scorpion/v2.png',
      'assets/units/lightning-scorpion/v3.png',
    ]);
    expect(lightningScorpionAnimationKey('v1', 'idle')).toBe('ls-v1-idle');
    expect(lightningScorpionAnimationKey('v2', 'attack')).toBe('ls-v2-attack');
    expect(lightningScorpionAnimationKey('v3', 'hurt')).toBe('ls-v3-hurt');
    expect(LIGHTNING_SCORPION_EFFECTS).toEqual({
      projectile: 'ls-fx-chain-bolt',
      muzzle: 'ls-fx-muzzle-flash',
      impact: 'ls-fx-impact',
    });
  });

  it('describes four-frame 1024x256 spritesheets for all unit and effect animations', () => {
    expect(LIGHTNING_SCORPION_ANIMATIONS).toHaveLength(16);
    for (const animation of LIGHTNING_SCORPION_ANIMATIONS) {
      expect(animation.url).toMatch(/^\/assets\/(units|effects)\/lightning-scorpion\//);
      expect(animation.frameWidth).toBe(256);
      expect(animation.frameHeight).toBe(256);
      expect(animation.frames).toBe(4);
      expect(animation.origin).toEqual([0.5, animation.key.startsWith('ls-fx-') ? 0.5 : 0.875]);
    }
  });

  it('has a matching public file for every manifest animation URL', async () => {
    for (const animation of LIGHTNING_SCORPION_ANIMATIONS) {
      const filePath = resolve('public', animation.url.replace(/^\/+/, ''));
      await expect(access(filePath)).resolves.toBeUndefined();
    }
    const chainBolt = LIGHTNING_SCORPION_ANIMATIONS.find(
      (animation) => animation.key === LIGHTNING_SCORPION_EFFECTS.projectile,
    );
    expect(chainBolt?.url).toBe('/assets/effects/lightning-scorpion/chain-bolt.png');
  });

  it('resolves URLs against the Vite base path at the root and under a subpath', () => {
    expect(resolvePublicAssetUrl('/assets/icons/lightning-scorpion-v1.png', '/')).toBe(
      '/assets/icons/lightning-scorpion-v1.png',
    );
    expect(resolvePublicAssetUrl('/assets/icons/lightning-scorpion-v2.png', '/brainrot/')).toBe(
      '/brainrot/assets/icons/lightning-scorpion-v2.png',
    );
    expect(
      resolvePublicAssetUrl('assets/effects/lightning-scorpion/chain-bolt.png', '/brainrot'),
    ).toBe('/brainrot/assets/effects/lightning-scorpion/chain-bolt.png');
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
    preloadLightningScorpion(scene, '/brainrot/');
    registerLightningScorpionAnimations(scene);
    expect(spritesheet).toHaveBeenCalledTimes(LIGHTNING_SCORPION_ANIMATIONS.length);
    expect(spritesheet).toHaveBeenNthCalledWith(
      1,
      'ls-v1-idle',
      '/brainrot/assets/units/lightning-scorpion/v1-idle.png',
      { frameWidth: 256, frameHeight: 256, endFrame: 3 },
    );
    expect(create).toHaveBeenCalledTimes(LIGHTNING_SCORPION_ANIMATIONS.length);
    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ key: 'ls-v1-idle', frameRate: 5, repeat: -1 }),
    );
  });
});
