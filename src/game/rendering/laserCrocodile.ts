import type Phaser from 'phaser';
import manifest from '../../../public/assets/units/laser-crocodile/manifest.json';
import { resolvePublicAssetUrl } from './publicAssets';

export { resolvePublicAssetUrl } from './publicAssets';

export type LaserCrocodileTier = keyof typeof manifest.visualTierByMergeRank;
export type LaserCrocodileAnimationState = 'idle' | 'walk' | 'attack' | 'hurt';
export type LaserCrocodileLocomotion = 'idle' | 'walk';
export type LaserCrocodileAction = 'attack' | 'hurt';

export interface LaserCrocodileAnimationDefinition {
  readonly key: string;
  readonly url: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frames: number;
  readonly fps: number;
  readonly repeat: number;
  readonly origin: readonly number[];
}

export const LASER_CROCODILE_CHARACTER_ID = manifest.characterTypeId;
export const LASER_CROCODILE_ANIMATIONS =
  manifest.animations as readonly LaserCrocodileAnimationDefinition[];
export const LASER_CROCODILE_ORIGIN = {
  x: manifest.unitOrigin[0] ?? 0.5,
  y: manifest.unitOrigin[1] ?? 0.875,
};
export const LASER_CROCODILE_DISPLAY_WIDTH = manifest.recommendedDisplayWidth;
export const LASER_CROCODILE_EFFECTS = {
  projectile: 'lc-fx-laser-bolt',
  muzzle: 'lc-fx-muzzle-flash',
  impact: 'lc-fx-impact',
} as const;

const STATIC_TIERS: readonly LaserCrocodileTier[] = ['v1', 'v2', 'v3'];

export function laserCrocodileTier(mergeRank: number): LaserCrocodileTier {
  const v3Start = manifest.visualTierByMergeRank.v3[0] ?? 8;
  const v2Start = manifest.visualTierByMergeRank.v2[0] ?? 4;
  if (mergeRank >= v3Start) return 'v3';
  if (mergeRank >= v2Start) return 'v2';
  return 'v1';
}

export function laserCrocodileAnimationKey(
  tier: LaserCrocodileTier,
  state: LaserCrocodileAnimationState,
): string {
  return `lc-${tier}-${state}`;
}

export function laserCrocodileIconPath(mergeRank: number): string {
  return `assets/icons/laser-crocodile-${laserCrocodileTier(mergeRank)}.png`;
}

export function laserCrocodileIconUrl(mergeRank: number): string {
  return resolvePublicAssetUrl(laserCrocodileIconPath(mergeRank));
}

export function laserCrocodileStaticPath(tier: LaserCrocodileTier): string {
  return `assets/units/laser-crocodile/${tier}.png`;
}

export function laserCrocodileStaticPaths(): readonly string[] {
  return STATIC_TIERS.map((tier) => laserCrocodileStaticPath(tier));
}

export function preloadLaserCrocodile(
  scene: Phaser.Scene,
  baseUrl = import.meta.env.BASE_URL,
): void {
  for (const asset of LASER_CROCODILE_ANIMATIONS) {
    scene.load.spritesheet(asset.key, resolvePublicAssetUrl(asset.url, baseUrl), {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
      endFrame: asset.frames - 1,
    });
  }
}

export function registerLaserCrocodileAnimations(scene: Phaser.Scene): void {
  for (const asset of LASER_CROCODILE_ANIMATIONS) {
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
