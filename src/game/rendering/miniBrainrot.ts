import type Phaser from 'phaser';
import manifest from '../../../public/assets/units/mini-brainrot/manifest.json';
import { resolvePublicAssetUrl } from './publicAssets';

export type MiniBrainrotAnimationState = 'idle' | 'walk' | 'attack' | 'hurt';

export interface MiniBrainrotAnimationDefinition {
  readonly key: string;
  readonly url: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frames: number;
  readonly fps: number;
  readonly repeat: number;
  readonly origin: readonly number[];
}

export const MINI_BRAINROT_ENEMY_ID = manifest.characterTypeId;
export const MINI_BRAINROT_ANIMATIONS =
  manifest.animations as readonly MiniBrainrotAnimationDefinition[];
export const MINI_BRAINROT_ORIGIN = {
  x: manifest.unitOrigin[0] ?? 0.5,
  y: manifest.unitOrigin[1] ?? 0.875,
};
export const MINI_BRAINROT_DISPLAY_WIDTH = manifest.recommendedDisplayWidth;

export function miniBrainrotAnimationKey(state: MiniBrainrotAnimationState): string {
  return `mini-brainrot-${state}`;
}

export function miniBrainrotIconPath(): string {
  return 'assets/icons/mini-brainrot.png';
}

export function miniBrainrotIconUrl(baseUrl = import.meta.env.BASE_URL): string {
  return resolvePublicAssetUrl(miniBrainrotIconPath(), baseUrl);
}

export function miniBrainrotStaticPath(): string {
  return 'assets/units/mini-brainrot/mini-brainrot.png';
}

export function miniBrainrotStaticPaths(): readonly string[] {
  return [miniBrainrotStaticPath(), miniBrainrotIconPath()];
}

export function preloadMiniBrainrot(scene: Phaser.Scene, baseUrl = import.meta.env.BASE_URL): void {
  for (const asset of MINI_BRAINROT_ANIMATIONS) {
    scene.load.spritesheet(asset.key, resolvePublicAssetUrl(asset.url, baseUrl), {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
      endFrame: asset.frames - 1,
    });
  }
}

export function registerMiniBrainrotAnimations(scene: Phaser.Scene): void {
  for (const asset of MINI_BRAINROT_ANIMATIONS) {
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
