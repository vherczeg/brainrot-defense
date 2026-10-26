import type Phaser from 'phaser';
import manifest from '../../../public/assets/units/green-venom-falcon/manifest.json';
import { resolvePublicAssetUrl } from './publicAssets';

export type GreenVenomFalconAnimationState =
  'idle' | 'fly' | 'claw' | 'poison' | 'spin' | 'spin-break' | 'hurt' | 'death';

export interface GreenVenomFalconAnimationDefinition {
  readonly key: string;
  readonly url: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frames: number;
  readonly fps: number;
  readonly repeat: number;
  readonly origin: readonly number[];
}

export const GREEN_VENOM_FALCON_ASSET_ID = manifest.characterTypeId;
export const GREEN_VENOM_FALCON_ENEMY_ID = 'green-venom-falcon' as const;
export const GREEN_VENOM_FALCON_ART_STATUS = manifest.artStatus;
export const GREEN_VENOM_FALCON_ANIMATIONS =
  manifest.animations as readonly GreenVenomFalconAnimationDefinition[];
export const GREEN_VENOM_FALCON_UNIT_ANIMATIONS = GREEN_VENOM_FALCON_ANIMATIONS.filter(
  (animation) => !animation.key.startsWith('gvf-fx-'),
);
export const GREEN_VENOM_FALCON_EFFECT_ANIMATIONS = GREEN_VENOM_FALCON_ANIMATIONS.filter(
  (animation) => animation.key.startsWith('gvf-fx-'),
);
export const GREEN_VENOM_FALCON_ORIGIN = {
  x: manifest.unitOrigin[0] ?? 0.5,
  y: manifest.unitOrigin[1] ?? 0.88,
};
export const GREEN_VENOM_FALCON_RECOMMENDED_DISPLAY_WIDTH = manifest.recommendedDisplayWidth;
export const GREEN_VENOM_FALCON_DISPLAY_WIDTH = 150;
export const GREEN_VENOM_FALCON_EFFECTS = {
  poisonProjectile: 'gvf-fx-poison-projectile',
  poisonMuzzle: 'gvf-fx-poison-muzzle',
  poisonImpact: 'gvf-fx-poison-impact',
  spinAura: 'gvf-fx-spin-aura',
  spinBreak: 'gvf-fx-spin-break',
  earthquake: 'gvf-fx-earthquake',
  defeat: 'gvf-fx-defeat',
} as const;
export const GREEN_VENOM_FALCON_PROJECTILE_EFFECTS = {
  projectile: GREEN_VENOM_FALCON_EFFECTS.poisonProjectile,
  muzzle: GREEN_VENOM_FALCON_EFFECTS.poisonMuzzle,
  impact: GREEN_VENOM_FALCON_EFFECTS.poisonImpact,
} as const;

export function greenVenomFalconAnimationKey(state: GreenVenomFalconAnimationState): string {
  return `gvf-${state}`;
}

export function greenVenomFalconIconPath(): string {
  return 'assets/icons/green-venom-falcon.png';
}

export function greenVenomFalconIconUrl(baseUrl = import.meta.env.BASE_URL): string {
  return resolvePublicAssetUrl(greenVenomFalconIconPath(), baseUrl);
}

export function greenVenomFalconStaticPath(): string {
  return 'assets/units/green-venom-falcon/green-venom-falcon.png';
}

export function greenVenomFalconStaticPaths(): readonly string[] {
  return [greenVenomFalconStaticPath(), greenVenomFalconIconPath()];
}

export function preloadGreenVenomFalcon(
  scene: Phaser.Scene,
  baseUrl = import.meta.env.BASE_URL,
): void {
  for (const asset of GREEN_VENOM_FALCON_ANIMATIONS) {
    scene.load.spritesheet(asset.key, resolvePublicAssetUrl(asset.url, baseUrl), {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
      endFrame: asset.frames - 1,
    });
  }
}

export function registerGreenVenomFalconAnimations(scene: Phaser.Scene): void {
  for (const asset of GREEN_VENOM_FALCON_ANIMATIONS) {
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
