import type Phaser from 'phaser';
import manifest from '../../../public/assets/units/lightning-scorpion/manifest.json';
import { resolvePublicAssetUrl } from './publicAssets';

export type LightningScorpionTier = keyof typeof manifest.visualTierByMergeRank;
export type LightningScorpionAnimationState = 'idle' | 'walk' | 'attack' | 'hurt';
export type LightningScorpionLocomotion = 'idle' | 'walk';
export type LightningScorpionAction = 'attack' | 'hurt';

export interface LightningScorpionAnimationDefinition {
  readonly key: string;
  readonly url: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frames: number;
  readonly fps: number;
  readonly repeat: number;
  readonly origin: readonly number[];
}

export const LIGHTNING_SCORPION_CHARACTER_ID = manifest.characterTypeId;
export const LIGHTNING_SCORPION_ANIMATIONS =
  manifest.animations as readonly LightningScorpionAnimationDefinition[];
export const LIGHTNING_SCORPION_ORIGIN = {
  x: manifest.unitOrigin[0] ?? 0.5,
  y: manifest.unitOrigin[1] ?? 0.875,
};
export const LIGHTNING_SCORPION_DISPLAY_WIDTH = manifest.recommendedDisplayWidth;
export const LIGHTNING_SCORPION_EFFECTS = {
  projectile: 'ls-fx-chain-bolt',
  muzzle: 'ls-fx-muzzle-flash',
  impact: 'ls-fx-impact',
} as const;

const STATIC_TIERS: readonly LightningScorpionTier[] = ['v1', 'v2', 'v3'];

export function lightningScorpionTier(mergeRank: number): LightningScorpionTier {
  const v3Start = manifest.visualTierByMergeRank.v3[0] ?? 8;
  const v2Start = manifest.visualTierByMergeRank.v2[0] ?? 4;
  if (mergeRank >= v3Start) return 'v3';
  if (mergeRank >= v2Start) return 'v2';
  return 'v1';
}

export function lightningScorpionAnimationKey(
  tier: LightningScorpionTier,
  state: LightningScorpionAnimationState,
): string {
  return `ls-${tier}-${state}`;
}

export function lightningScorpionIconPath(mergeRank: number): string {
  return `assets/icons/lightning-scorpion-${lightningScorpionTier(mergeRank)}.png`;
}

export function lightningScorpionIconUrl(mergeRank: number): string {
  return resolvePublicAssetUrl(lightningScorpionIconPath(mergeRank));
}

export function lightningScorpionStaticPath(tier: LightningScorpionTier): string {
  return `assets/units/lightning-scorpion/${tier}.png`;
}

export function lightningScorpionStaticPaths(): readonly string[] {
  return STATIC_TIERS.map((tier) => lightningScorpionStaticPath(tier));
}

export function preloadLightningScorpion(
  scene: Phaser.Scene,
  baseUrl = import.meta.env.BASE_URL,
): void {
  for (const asset of LIGHTNING_SCORPION_ANIMATIONS) {
    scene.load.spritesheet(asset.key, resolvePublicAssetUrl(asset.url, baseUrl), {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
      endFrame: asset.frames - 1,
    });
  }
}

export function registerLightningScorpionAnimations(scene: Phaser.Scene): void {
  for (const asset of LIGHTNING_SCORPION_ANIMATIONS) {
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
