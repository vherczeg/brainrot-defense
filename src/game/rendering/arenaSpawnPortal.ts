import type Phaser from 'phaser';
import manifest from '../../../public/assets/effects/arena-spawn-portal/manifest.json';
import { resolvePublicAssetUrl } from './publicAssets';

export type ArenaSpawnPortalAction = 'idle' | 'opening' | 'active' | 'closing';

export interface ArenaSpawnPortalAnimation {
  readonly key: string;
  readonly action: ArenaSpawnPortalAction;
  readonly url: string;
  readonly frames: number;
  readonly fps: number;
  readonly repeat: number;
}

export const ARENA_SPAWN_PORTAL_ID = manifest.id;
export const ARENA_SPAWN_PORTAL_ACTIONS: readonly ArenaSpawnPortalAction[] = [
  'idle',
  'opening',
  'active',
  'closing',
];
export const ARENA_SPAWN_PORTAL_ANIMATIONS: readonly ArenaSpawnPortalAnimation[] =
  ARENA_SPAWN_PORTAL_ACTIONS.map((action) => ({
    key: `arena-spawn-portal-${action}`,
    action,
    url: manifest.files[action].url,
    frames: manifest.files[action].frames.length,
    fps: manifest.fps,
    repeat: manifest.loop[action] ? -1 : 0,
  }));
export const ARENA_SPAWN_PORTAL_ASSET_PATHS: readonly string[] = ARENA_SPAWN_PORTAL_ACTIONS.flatMap(
  (action) => [
    manifest.files[action].url.replace(/^\/+/, ''),
    ...manifest.files[action].frames.map((url) => url.replace(/^\/+/, '')),
  ],
);
export const ARENA_SPAWN_PORTAL_DISPLAY_SIZE = 40;

export function arenaSpawnPortalAnimationKey(action: ArenaSpawnPortalAction): string {
  return `arena-spawn-portal-${action}`;
}

export function preloadArenaSpawnPortal(
  scene: Phaser.Scene,
  baseUrl = import.meta.env.BASE_URL,
): void {
  for (const asset of ARENA_SPAWN_PORTAL_ANIMATIONS) {
    scene.load.spritesheet(asset.key, resolvePublicAssetUrl(asset.url, baseUrl), {
      frameWidth: manifest.tileSize[0] ?? 256,
      frameHeight: manifest.tileSize[1] ?? 256,
      endFrame: asset.frames - 1,
    });
  }
}

export function registerArenaSpawnPortalAnimations(scene: Phaser.Scene): void {
  for (const asset of ARENA_SPAWN_PORTAL_ANIMATIONS) {
    if (scene.anims.exists(asset.key)) continue;
    scene.anims.create({
      key: asset.key,
      frames: scene.anims.generateFrameNumbers(asset.key, {
        start: 0,
        end: asset.frames - 1,
      }),
      frameRate: asset.fps,
      repeat: asset.repeat,
    });
  }
}
