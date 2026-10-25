import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import {
  ARMORED_SNAIL_EFFECT_ACTIONS,
  ARMORED_SNAIL_EFFECT_ANIMATIONS,
  ARMORED_SNAIL_EFFECT_ASSET_PATHS,
  ARMORED_SNAIL_EFFECTS,
  preloadArmoredSnailEffects,
  registerArmoredSnailEffectsAnimations,
} from '../../src/game/rendering/armoredSnail';
import { resolvePublicAssetUrl } from '../../src/game/rendering/publicAssets';

describe('armored snail effect assets', () => {
  it('describes four four-frame effects', () => {
    expect(ARMORED_SNAIL_EFFECT_ACTIONS).toEqual([
      'shell-hit',
      'armor-glint',
      'slime-trail',
      'slime-splash',
    ]);
    expect(ARMORED_SNAIL_EFFECTS).toEqual({
      shellHit: 'armored-snail-fx-shell-hit',
      armorGlint: 'armored-snail-fx-armor-glint',
      slimeTrail: 'armored-snail-fx-slime-trail',
      slimeSplash: 'armored-snail-fx-slime-splash',
    });
    expect(ARMORED_SNAIL_EFFECT_ANIMATIONS.map((animation) => animation.key)).toEqual([
      'armored-snail-fx-shell-hit',
      'armored-snail-fx-armor-glint',
      'armored-snail-fx-slime-trail',
      'armored-snail-fx-slime-splash',
    ]);
    for (const animation of ARMORED_SNAIL_EFFECT_ANIMATIONS) {
      expect(animation.url).toMatch(/^\/assets\/effects\/armored-snail\//);
      expect(animation.frames).toBe(4);
      expect(animation.fps).toBe(9);
      expect(animation.repeat).toBe(0);
    }
  });

  it('keeps every strip and individual frame in the verification asset set', () => {
    expect(ARMORED_SNAIL_EFFECT_ASSET_PATHS).toHaveLength(20);
    for (const animation of ARMORED_SNAIL_EFFECT_ANIMATIONS) {
      expect(ARMORED_SNAIL_EFFECT_ASSET_PATHS).toContain(animation.url.replace(/^\/+/, ''));
      for (let frame = 0; frame < 4; frame += 1) {
        expect(ARMORED_SNAIL_EFFECT_ASSET_PATHS).toContain(
          `assets/effects/armored-snail/frames/${animation.action}/${String(frame).padStart(
            2,
            '0',
          )}.png`,
        );
      }
    }
  });

  it('has a matching public file for every strip and frame', async () => {
    for (const asset of ARMORED_SNAIL_EFFECT_ASSET_PATHS) {
      await expect(access(resolve('public', asset))).resolves.toBeUndefined();
    }
  });

  it('resolves effect URLs through the Vite base path', () => {
    expect(resolvePublicAssetUrl('/assets/effects/armored-snail/shell-hit.png', '/')).toBe(
      '/assets/effects/armored-snail/shell-hit.png',
    );
    expect(
      resolvePublicAssetUrl('/assets/effects/armored-snail/slime-splash.png', '/brainrot/'),
    ).toBe('/brainrot/assets/effects/armored-snail/slime-splash.png');
    expect(
      resolvePublicAssetUrl('assets/effects/armored-snail/frames/slime-trail/00.png', '/brainrot'),
    ).toBe('/brainrot/assets/effects/armored-snail/frames/slime-trail/00.png');
  });

  it('preloads and registers all four effect animations once', () => {
    const spritesheet = vi.fn();
    const exists = vi.fn(() => false);
    const create = vi.fn();
    const generateFrameNumbers = vi.fn(() => []);
    const scene = {
      load: { spritesheet },
      anims: { exists, create, generateFrameNumbers },
    } as unknown as Phaser.Scene;
    preloadArmoredSnailEffects(scene, '/brainrot/');
    registerArmoredSnailEffectsAnimations(scene);
    expect(spritesheet).toHaveBeenCalledTimes(4);
    expect(spritesheet).toHaveBeenNthCalledWith(
      1,
      'armored-snail-fx-shell-hit',
      '/brainrot/assets/effects/armored-snail/shell-hit.png',
      { frameWidth: 256, frameHeight: 256, endFrame: 3 },
    );
    expect(create).toHaveBeenCalledTimes(4);
    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        key: 'armored-snail-fx-shell-hit',
        frameRate: 9,
        repeat: 0,
      }),
    );
  });
});
