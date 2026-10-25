import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { ENEMY_DEFINITIONS } from '../../src/game/domain/enemies';
import {
  MEGA_BRAINROT_GORILLA_ANIMATIONS,
  MEGA_BRAINROT_GORILLA_ASSET_ID,
  MEGA_BRAINROT_GORILLA_DISPLAY_WIDTH,
  MEGA_BRAINROT_GORILLA_EFFECTS,
  MEGA_BRAINROT_GORILLA_ENEMY_ID,
  MEGA_BRAINROT_GORILLA_RECOMMENDED_DISPLAY_WIDTH,
  megaBrainrotGorillaAnimationKey,
  megaBrainrotGorillaIconPath,
  megaBrainrotGorillaIconUrl,
  megaBrainrotGorillaStaticPath,
  megaBrainrotGorillaStaticPaths,
  preloadMegaBrainrotGorilla,
  registerMegaBrainrotGorillaAnimations,
} from '../../src/game/rendering/megaBrainrotGorilla';
import { resolvePublicAssetUrl } from '../../src/game/rendering/publicAssets';

describe('mega brainrot gorilla asset mapping', () => {
  it('matches the existing boss enemy type ID', () => {
    expect(MEGA_BRAINROT_GORILLA_ASSET_ID).toBe('mega-brainrot-gorilla');
    expect(MEGA_BRAINROT_GORILLA_ENEMY_ID).toBe('mega-brainrot-gorilla');
    expect(ENEMY_DEFINITIONS).toHaveProperty(MEGA_BRAINROT_GORILLA_ENEMY_ID);
    expect(ENEMY_DEFINITIONS[MEGA_BRAINROT_GORILLA_ENEMY_ID].isBoss).toBe(true);
  });

  it('maps boss animations, effects, and static portrait paths', () => {
    expect(megaBrainrotGorillaAnimationKey('idle')).toBe('mbg-idle');
    expect(megaBrainrotGorillaAnimationKey('walk')).toBe('mbg-walk');
    expect(megaBrainrotGorillaAnimationKey('attack')).toBe('mbg-attack');
    expect(megaBrainrotGorillaAnimationKey('hurt')).toBe('mbg-hurt');
    expect(MEGA_BRAINROT_GORILLA_EFFECTS).toEqual({
      charge: 'mbg-fx-charge',
      groundSlam: 'mbg-fx-ground-slam',
      roar: 'mbg-fx-roar',
      defeat: 'mbg-fx-defeat',
    });
    expect(megaBrainrotGorillaIconPath()).toBe('assets/icons/mega-brainrot-gorilla.png');
    expect(megaBrainrotGorillaStaticPath()).toBe(
      'assets/units/mega-brainrot-gorilla/mega-brainrot-gorilla.png',
    );
    expect(megaBrainrotGorillaStaticPaths()).toEqual([
      'assets/units/mega-brainrot-gorilla/mega-brainrot-gorilla.png',
      'assets/icons/mega-brainrot-gorilla.png',
    ]);
    expect(megaBrainrotGorillaIconUrl('/brainrot/')).toBe(
      '/brainrot/assets/icons/mega-brainrot-gorilla.png',
    );
  });

  it('keeps the battlefield display width within the boss container layout', () => {
    expect(MEGA_BRAINROT_GORILLA_RECOMMENDED_DISPLAY_WIDTH).toBe(184);
    expect(MEGA_BRAINROT_GORILLA_DISPLAY_WIDTH).toBe(140);
    expect(MEGA_BRAINROT_GORILLA_DISPLAY_WIDTH).toBeLessThan(
      MEGA_BRAINROT_GORILLA_RECOMMENDED_DISPLAY_WIDTH,
    );
  });

  it('describes four-frame 1024x256 unit and effect spritesheets', () => {
    expect(MEGA_BRAINROT_GORILLA_ANIMATIONS.map((animation) => animation.key)).toEqual([
      'mbg-idle',
      'mbg-walk',
      'mbg-attack',
      'mbg-hurt',
      'mbg-fx-charge',
      'mbg-fx-ground-slam',
      'mbg-fx-roar',
      'mbg-fx-defeat',
    ]);
    for (const animation of MEGA_BRAINROT_GORILLA_ANIMATIONS) {
      expect(animation.url).toMatch(/^\/assets\/(units|effects)\/mega-brainrot-gorilla\//);
      expect(animation.frameWidth).toBe(256);
      expect(animation.frameHeight).toBe(256);
      expect(animation.frames).toBe(4);
      expect(animation.origin).toEqual([0.5, animation.key.startsWith('mbg-fx-') ? 0.5 : 0.88]);
    }
  });

  it('has a matching public file for every manifest animation URL and static image', async () => {
    for (const animation of MEGA_BRAINROT_GORILLA_ANIMATIONS) {
      const filePath = resolve('public', animation.url.replace(/^\/+/, ''));
      await expect(access(filePath)).resolves.toBeUndefined();
    }
    for (const asset of megaBrainrotGorillaStaticPaths()) {
      await expect(access(resolve('public', asset))).resolves.toBeUndefined();
    }
  });

  it('resolves public URLs through the Vite base path', () => {
    expect(resolvePublicAssetUrl('/assets/units/mega-brainrot-gorilla/idle.png', '/')).toBe(
      '/assets/units/mega-brainrot-gorilla/idle.png',
    );
    expect(
      resolvePublicAssetUrl('/assets/units/mega-brainrot-gorilla/walk.png', '/brainrot/'),
    ).toBe('/brainrot/assets/units/mega-brainrot-gorilla/walk.png');
    expect(
      resolvePublicAssetUrl('assets/effects/mega-brainrot-gorilla/ground-slam.png', '/brainrot'),
    ).toBe('/brainrot/assets/effects/mega-brainrot-gorilla/ground-slam.png');
  });

  it('preloads all sheets and registers animations through the supplied base URL', () => {
    const spritesheet = vi.fn();
    const exists = vi.fn(() => false);
    const create = vi.fn();
    const generateFrameNumbers = vi.fn(() => []);
    const scene = {
      load: { spritesheet },
      anims: { exists, create, generateFrameNumbers },
    } as unknown as Phaser.Scene;
    preloadMegaBrainrotGorilla(scene, '/brainrot/');
    registerMegaBrainrotGorillaAnimations(scene);
    expect(spritesheet).toHaveBeenCalledTimes(MEGA_BRAINROT_GORILLA_ANIMATIONS.length);
    expect(spritesheet).toHaveBeenNthCalledWith(
      1,
      'mbg-idle',
      '/brainrot/assets/units/mega-brainrot-gorilla/idle.png',
      { frameWidth: 256, frameHeight: 256, endFrame: 3 },
    );
    expect(create).toHaveBeenCalledTimes(MEGA_BRAINROT_GORILLA_ANIMATIONS.length);
    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ key: 'mbg-idle', frameRate: 5, repeat: -1 }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'mbg-fx-ground-slam', frameRate: 14, repeat: 0 }),
    );
  });
});
