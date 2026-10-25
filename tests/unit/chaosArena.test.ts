import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import {
  CHAOS_ARENA_ASSET_PATHS,
  CHAOS_ARENA_ATLAS_PATHS,
  CHAOS_ARENA_FILES,
  CHAOS_ARENA_FLOOR_FILES,
  CHAOS_ARENA_FLOOR_TEXTURE_KEY,
  CHAOS_ARENA_PROP_FILES,
  CHAOS_ARENA_TILE_SIZE,
  chaosArenaFloorFrame,
  preloadChaosArena,
} from '../../src/game/rendering/chaosArena';
import { resolvePublicAssetUrl } from '../../src/game/rendering/publicAssets';

describe('chaos arena terrain assets', () => {
  it('describes sixteen floor tiles and sixteen decorations', () => {
    expect(CHAOS_ARENA_TILE_SIZE).toEqual({ width: 256, height: 256 });
    expect(CHAOS_ARENA_FLOOR_FILES).toHaveLength(16);
    expect(CHAOS_ARENA_PROP_FILES).toHaveLength(16);
    expect(CHAOS_ARENA_FILES).toHaveLength(32);
    expect(CHAOS_ARENA_FLOOR_FILES.map((file) => file.atlasFrame)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
    expect(CHAOS_ARENA_PROP_FILES.map((file) => file.atlasFrame)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
  });

  it('keeps the atlas paths and every manifest URL in the asset set', () => {
    expect(CHAOS_ARENA_ATLAS_PATHS).toEqual({
      floor: '/assets/terrain/chaos-arena/floor-tiles.png',
      decorations: '/assets/terrain/chaos-arena/decorations.png',
    });
    expect(CHAOS_ARENA_ASSET_PATHS).toHaveLength(34);
    for (const file of CHAOS_ARENA_FILES) {
      expect(CHAOS_ARENA_ASSET_PATHS).toContain(file.url.replace(/^\/+/, ''));
    }
  });

  it('has a matching public file for every atlas and manifest URL', async () => {
    for (const asset of CHAOS_ARENA_ASSET_PATHS) {
      await expect(access(resolve('public', asset))).resolves.toBeUndefined();
    }
  });

  it('uses deterministic floor variants while keeping enemy and player zones distinct', () => {
    const enemyFrames = new Set<number>();
    const playerFrames = new Set<number>();
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        const frame = chaosArenaFloorFrame(col, row, 3);
        expect(frame).toBe(chaosArenaFloorFrame(col, row, 3));
        if (row < 3) {
          enemyFrames.add(frame);
          expect(frame).toBeGreaterThanOrEqual(0);
          expect(frame).toBeLessThan(8);
        } else {
          playerFrames.add(frame);
          expect(frame).toBeGreaterThanOrEqual(8);
          expect(frame).toBeLessThan(16);
        }
      }
    }
    expect(enemyFrames.size).toBe(8);
    expect(playerFrames.size).toBe(8);
  });

  it('resolves atlas URLs through the Vite base path', () => {
    expect(resolvePublicAssetUrl(CHAOS_ARENA_ATLAS_PATHS.floor, '/')).toBe(
      '/assets/terrain/chaos-arena/floor-tiles.png',
    );
    expect(resolvePublicAssetUrl(CHAOS_ARENA_ATLAS_PATHS.floor, '/brainrot/')).toBe(
      '/brainrot/assets/terrain/chaos-arena/floor-tiles.png',
    );
    expect(resolvePublicAssetUrl(CHAOS_ARENA_ATLAS_PATHS.decorations, '/brainrot')).toBe(
      '/brainrot/assets/terrain/chaos-arena/decorations.png',
    );
  });

  it('preloads the floor atlas once as a four by four spritesheet', () => {
    const spritesheet = vi.fn();
    const scene = { load: { spritesheet } } as unknown as Phaser.Scene;
    preloadChaosArena(scene, '/brainrot/');
    expect(spritesheet).toHaveBeenCalledTimes(1);
    expect(spritesheet).toHaveBeenCalledWith(
      CHAOS_ARENA_FLOOR_TEXTURE_KEY,
      '/brainrot/assets/terrain/chaos-arena/floor-tiles.png',
      { frameWidth: 256, frameHeight: 256, endFrame: 15 },
    );
  });
});
