import type Phaser from 'phaser';
import manifest from '../../../public/assets/terrain/chaos-arena/manifest.json';
import { resolvePublicAssetUrl } from './publicAssets';

export interface ChaosArenaFile {
  readonly key: string;
  readonly type: 'floor' | 'prop';
  readonly url: string;
  readonly atlasFrame: number;
  readonly frameRect: readonly number[];
}

export const CHAOS_ARENA_FLOOR_TEXTURE_KEY = 'chaos-arena-floor';
export const CHAOS_ARENA_FILES = manifest.files as readonly ChaosArenaFile[];
export const CHAOS_ARENA_FLOOR_FILES = CHAOS_ARENA_FILES.filter((file) => file.type === 'floor');
export const CHAOS_ARENA_PROP_FILES = CHAOS_ARENA_FILES.filter((file) => file.type === 'prop');
export const CHAOS_ARENA_ATLAS_PATHS = {
  floor: manifest.atlasFiles.floor,
  decorations: manifest.atlasFiles.decorations,
} as const;
export const CHAOS_ARENA_ASSET_PATHS: readonly string[] = [
  CHAOS_ARENA_ATLAS_PATHS.floor.replace(/^\/+/, ''),
  CHAOS_ARENA_ATLAS_PATHS.decorations.replace(/^\/+/, ''),
  ...CHAOS_ARENA_FILES.map((file) => file.url.replace(/^\/+/, '')),
];

export const CHAOS_ARENA_TILE_SIZE = {
  width: manifest.tileSize[0] ?? 256,
  height: manifest.tileSize[1] ?? 256,
};

export function chaosArenaFloorFrame(col: number, row: number, allyRowStart: number): number {
  const zoneOffset = row >= allyRowStart ? 8 : 0;
  return zoneOffset + ((col + row * 3) % 8);
}

export function preloadChaosArena(scene: Phaser.Scene, baseUrl = import.meta.env.BASE_URL): void {
  scene.load.spritesheet(
    CHAOS_ARENA_FLOOR_TEXTURE_KEY,
    resolvePublicAssetUrl(CHAOS_ARENA_ATLAS_PATHS.floor, baseUrl),
    {
      frameWidth: CHAOS_ARENA_TILE_SIZE.width,
      frameHeight: CHAOS_ARENA_TILE_SIZE.height,
      endFrame: CHAOS_ARENA_FLOOR_FILES.length - 1,
    },
  );
}
