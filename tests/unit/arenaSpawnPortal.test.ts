import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import {
  ARENA_SPAWN_PORTAL_ACTIONS,
  ARENA_SPAWN_PORTAL_ANIMATIONS,
  ARENA_SPAWN_PORTAL_ASSET_PATHS,
  ARENA_SPAWN_PORTAL_DISPLAY_SIZE,
  ARENA_SPAWN_PORTAL_ID,
  arenaSpawnPortalAnimationKey,
  preloadArenaSpawnPortal,
  registerArenaSpawnPortalAnimations,
} from '../../src/game/rendering/arenaSpawnPortal';
import { resolvePublicAssetUrl } from '../../src/game/rendering/publicAssets';

describe('arena spawn portal assets', () => {
  it('describes four four-frame portal animations', () => {
    expect(ARENA_SPAWN_PORTAL_ID).toBe('arena-spawn-portal');
    expect(ARENA_SPAWN_PORTAL_ACTIONS).toEqual(['idle', 'opening', 'active', 'closing']);
    expect(ARENA_SPAWN_PORTAL_ANIMATIONS).toHaveLength(4);
    expect(ARENA_SPAWN_PORTAL_ANIMATIONS.map((animation) => animation.key)).toEqual([
      'arena-spawn-portal-idle',
      'arena-spawn-portal-opening',
      'arena-spawn-portal-active',
      'arena-spawn-portal-closing',
    ]);
    for (const animation of ARENA_SPAWN_PORTAL_ANIMATIONS) {
      expect(animation.frames).toBe(4);
      expect(animation.fps).toBe(8);
      expect(animation.url).toMatch(/^\/assets\/effects\/arena-spawn-portal\//);
      expect(arenaSpawnPortalAnimationKey(animation.action)).toBe(animation.key);
    }
    expect(ARENA_SPAWN_PORTAL_ANIMATIONS.map((animation) => animation.repeat)).toEqual([
      -1, 0, -1, 0,
    ]);
    expect(ARENA_SPAWN_PORTAL_DISPLAY_SIZE).toBe(40);
  });

  it('keeps every strip and individual frame in the verification asset set', () => {
    expect(ARENA_SPAWN_PORTAL_ASSET_PATHS).toHaveLength(20);
    for (const animation of ARENA_SPAWN_PORTAL_ANIMATIONS) {
      expect(ARENA_SPAWN_PORTAL_ASSET_PATHS).toContain(animation.url.replace(/^\/+/, ''));
      for (let frame = 0; frame < 4; frame += 1) {
        expect(ARENA_SPAWN_PORTAL_ASSET_PATHS).toContain(
          animation.url
            .replace(/^\/+/, '')
            .replace(
              /[^/]+\.png$/,
              `frames/${animation.action}/${String(frame).padStart(2, '0')}.png`,
            ),
        );
      }
    }
  });

  it('has a matching public file for every strip and frame', async () => {
    for (const asset of ARENA_SPAWN_PORTAL_ASSET_PATHS) {
      await expect(access(resolve('public', asset))).resolves.toBeUndefined();
    }
  });

  it('resolves portal URLs through the Vite base path', () => {
    expect(resolvePublicAssetUrl('/assets/effects/arena-spawn-portal/idle.png', '/')).toBe(
      '/assets/effects/arena-spawn-portal/idle.png',
    );
    expect(
      resolvePublicAssetUrl('/assets/effects/arena-spawn-portal/opening.png', '/brainrot/'),
    ).toBe('/brainrot/assets/effects/arena-spawn-portal/opening.png');
    expect(
      resolvePublicAssetUrl('assets/effects/arena-spawn-portal/frames/idle/00.png', '/brainrot'),
    ).toBe('/brainrot/assets/effects/arena-spawn-portal/frames/idle/00.png');
  });

  it('preloads and registers all four portal animations once', () => {
    const spritesheet = vi.fn();
    const exists = vi.fn(() => false);
    const create = vi.fn();
    const generateFrameNumbers = vi.fn(() => []);
    const scene = {
      load: { spritesheet },
      anims: { exists, create, generateFrameNumbers },
    } as unknown as Phaser.Scene;
    preloadArenaSpawnPortal(scene, '/brainrot/');
    registerArenaSpawnPortalAnimations(scene);
    expect(spritesheet).toHaveBeenCalledTimes(4);
    expect(spritesheet).toHaveBeenNthCalledWith(
      1,
      'arena-spawn-portal-idle',
      '/brainrot/assets/effects/arena-spawn-portal/idle.png',
      { frameWidth: 256, frameHeight: 256, endFrame: 3 },
    );
    expect(create).toHaveBeenCalledTimes(4);
    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ key: 'arena-spawn-portal-idle', frameRate: 8, repeat: -1 }),
    );
    expect(create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ key: 'arena-spawn-portal-opening', frameRate: 8, repeat: 0 }),
    );
  });
});
