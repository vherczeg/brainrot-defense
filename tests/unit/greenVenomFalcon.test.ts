import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { ENEMY_DEFINITIONS } from '../../src/game/domain/enemies';
import {
  GREEN_VENOM_FALCON_ANIMATIONS,
  GREEN_VENOM_FALCON_ART_STATUS,
  GREEN_VENOM_FALCON_ASSET_ID,
  GREEN_VENOM_FALCON_DISPLAY_WIDTH,
  GREEN_VENOM_FALCON_EFFECTS,
  GREEN_VENOM_FALCON_EFFECT_ANIMATIONS,
  GREEN_VENOM_FALCON_ENEMY_ID,
  GREEN_VENOM_FALCON_ORIGIN,
  GREEN_VENOM_FALCON_PROJECTILE_EFFECTS,
  GREEN_VENOM_FALCON_RECOMMENDED_DISPLAY_WIDTH,
  GREEN_VENOM_FALCON_UNIT_ANIMATIONS,
  greenVenomFalconAnimationKey,
  greenVenomFalconIconPath,
  greenVenomFalconIconUrl,
  greenVenomFalconStaticPath,
  greenVenomFalconStaticPaths,
  preloadGreenVenomFalcon,
  registerGreenVenomFalconAnimations,
} from '../../src/game/rendering/greenVenomFalcon';
import { resolvePublicAssetUrl } from '../../src/game/rendering/publicAssets';

describe('green venom falcon asset mapping', () => {
  it('matches the wave 20 boss enemy type and records provisional art status', () => {
    expect(GREEN_VENOM_FALCON_ASSET_ID).toBe('green-venom-falcon');
    expect(GREEN_VENOM_FALCON_ENEMY_ID).toBe('green-venom-falcon');
    expect(ENEMY_DEFINITIONS[GREEN_VENOM_FALCON_ENEMY_ID].isBoss).toBe(true);
    expect(GREEN_VENOM_FALCON_ART_STATUS).toBe(
      'generated-concept-placeholder-pending-abel-approval',
    );
  });

  it('maps all eight character animation states', () => {
    expect(GREEN_VENOM_FALCON_UNIT_ANIMATIONS.map((animation) => animation.key)).toEqual([
      'gvf-idle',
      'gvf-fly',
      'gvf-claw',
      'gvf-poison',
      'gvf-spin',
      'gvf-spin-break',
      'gvf-hurt',
      'gvf-death',
    ]);
    for (const state of [
      'idle',
      'fly',
      'claw',
      'poison',
      'spin',
      'spin-break',
      'hurt',
      'death',
    ] as const) {
      expect(greenVenomFalconAnimationKey(state)).toBe(`gvf-${state}`);
    }
  });

  it('maps all seven effect animations', () => {
    expect(GREEN_VENOM_FALCON_EFFECT_ANIMATIONS.map((animation) => animation.key)).toEqual([
      'gvf-fx-poison-projectile',
      'gvf-fx-poison-muzzle',
      'gvf-fx-poison-impact',
      'gvf-fx-spin-aura',
      'gvf-fx-spin-break',
      'gvf-fx-earthquake',
      'gvf-fx-defeat',
    ]);
    expect(GREEN_VENOM_FALCON_EFFECTS).toEqual({
      poisonProjectile: 'gvf-fx-poison-projectile',
      poisonMuzzle: 'gvf-fx-poison-muzzle',
      poisonImpact: 'gvf-fx-poison-impact',
      spinAura: 'gvf-fx-spin-aura',
      spinBreak: 'gvf-fx-spin-break',
      earthquake: 'gvf-fx-earthquake',
      defeat: 'gvf-fx-defeat',
    });
    expect(GREEN_VENOM_FALCON_PROJECTILE_EFFECTS).toEqual({
      projectile: 'gvf-fx-poison-projectile',
      muzzle: 'gvf-fx-poison-muzzle',
      impact: 'gvf-fx-poison-impact',
    });
  });

  it('uses uniform 256x256 frames and stable left-facing origins', () => {
    expect(GREEN_VENOM_FALCON_ORIGIN).toEqual({ x: 0.5, y: 0.88 });
    expect(GREEN_VENOM_FALCON_DISPLAY_WIDTH).toBe(150);
    expect(GREEN_VENOM_FALCON_DISPLAY_WIDTH).toBeLessThan(
      GREEN_VENOM_FALCON_RECOMMENDED_DISPLAY_WIDTH,
    );
    for (const animation of GREEN_VENOM_FALCON_ANIMATIONS) {
      expect(animation.frameWidth).toBe(256);
      expect(animation.frameHeight).toBe(256);
      expect(animation.frames).toBeGreaterThanOrEqual(4);
      expect(animation.url).toMatch(/^\/assets\/(units|effects)\/green-venom-falcon\//);
    }
  });

  it('maps icon and static paths through the Vite base URL', () => {
    expect(greenVenomFalconIconPath()).toBe('assets/icons/green-venom-falcon.png');
    expect(greenVenomFalconStaticPath()).toBe(
      'assets/units/green-venom-falcon/green-venom-falcon.png',
    );
    expect(greenVenomFalconStaticPaths()).toEqual([
      'assets/units/green-venom-falcon/green-venom-falcon.png',
      'assets/icons/green-venom-falcon.png',
    ]);
    expect(greenVenomFalconIconUrl('/brainrot/')).toBe(
      '/brainrot/assets/icons/green-venom-falcon.png',
    );
    expect(resolvePublicAssetUrl('/assets/units/green-venom-falcon/idle.png', '/')).toBe(
      '/assets/units/green-venom-falcon/idle.png',
    );
  });

  it('has a matching public file for every animation and static image', async () => {
    for (const animation of GREEN_VENOM_FALCON_ANIMATIONS) {
      await expect(
        access(resolve('public', animation.url.replace(/^\/+/, ''))),
      ).resolves.toBeUndefined();
    }
    for (const asset of greenVenomFalconStaticPaths()) {
      await expect(access(resolve('public', asset))).resolves.toBeUndefined();
    }
  });

  it('preloads and registers every unit and effect spritesheet', () => {
    const spritesheet = vi.fn();
    const exists = vi.fn(() => false);
    const create = vi.fn();
    const generateFrameNumbers = vi.fn(() => []);
    const scene = {
      load: { spritesheet },
      anims: { exists, create, generateFrameNumbers },
    } as unknown as Phaser.Scene;
    preloadGreenVenomFalcon(scene, '/brainrot/');
    registerGreenVenomFalconAnimations(scene);
    expect(spritesheet).toHaveBeenCalledTimes(GREEN_VENOM_FALCON_ANIMATIONS.length);
    expect(spritesheet).toHaveBeenCalledWith(
      'gvf-idle',
      '/brainrot/assets/units/green-venom-falcon/idle.png',
      { frameWidth: 256, frameHeight: 256, endFrame: 3 },
    );
    expect(spritesheet).toHaveBeenCalledWith(
      'gvf-death',
      '/brainrot/assets/units/green-venom-falcon/death.png',
      { frameWidth: 256, frameHeight: 256, endFrame: 7 },
    );
    expect(spritesheet).toHaveBeenCalledWith(
      'gvf-fx-earthquake',
      '/brainrot/assets/effects/green-venom-falcon/earthquake.png',
      { frameWidth: 256, frameHeight: 256, endFrame: 5 },
    );
    expect(create).toHaveBeenCalledTimes(GREEN_VENOM_FALCON_ANIMATIONS.length);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'gvf-spin', frameRate: 12, repeat: -1 }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'gvf-spin-break', frameRate: 6, repeat: -1 }),
    );
  });
});
