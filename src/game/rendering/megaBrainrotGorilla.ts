import type Phaser from 'phaser';
import manifest from '../../../public/assets/units/mega-brainrot-gorilla/manifest.json';
import { resolvePublicAssetUrl } from './publicAssets';

export type MegaBrainrotGorillaAnimationState = 'idle' | 'walk' | 'attack' | 'hurt';

export interface MegaBrainrotGorillaAnimationDefinition {
  readonly key: string;
  readonly url: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frames: number;
  readonly fps: number;
  readonly repeat: number;
  readonly origin: readonly number[];
}

export const MEGA_BRAINROT_GORILLA_ASSET_ID = manifest.characterTypeId;
export const MEGA_BRAINROT_GORILLA_ENEMY_ID = 'mega-brainrot-gorilla' as const;
export const MEGA_BRAINROT_GORILLA_ANIMATIONS =
  manifest.animations as readonly MegaBrainrotGorillaAnimationDefinition[];
export const MEGA_BRAINROT_GORILLA_ORIGIN = {
  x: manifest.unitOrigin[0] ?? 0.5,
  y: manifest.unitOrigin[1] ?? 0.88,
};
export const MEGA_BRAINROT_GORILLA_RECOMMENDED_DISPLAY_WIDTH = manifest.recommendedDisplayWidth;
export const MEGA_BRAINROT_GORILLA_DISPLAY_WIDTH = 140;
export const MEGA_BRAINROT_GORILLA_EFFECTS = {
  charge: 'mbg-fx-charge',
  groundSlam: 'mbg-fx-ground-slam',
  roar: 'mbg-fx-roar',
  defeat: 'mbg-fx-defeat',
} as const;

export function megaBrainrotGorillaAnimationKey(state: MegaBrainrotGorillaAnimationState): string {
  return `mbg-${state}`;
}

export function megaBrainrotGorillaIconPath(): string {
  return 'assets/icons/mega-brainrot-gorilla.png';
}

export function megaBrainrotGorillaIconUrl(baseUrl = import.meta.env.BASE_URL): string {
  return resolvePublicAssetUrl(megaBrainrotGorillaIconPath(), baseUrl);
}

export function megaBrainrotGorillaStaticPath(): string {
  return 'assets/units/mega-brainrot-gorilla/mega-brainrot-gorilla.png';
}

export function megaBrainrotGorillaStaticPaths(): readonly string[] {
  return [megaBrainrotGorillaStaticPath(), megaBrainrotGorillaIconPath()];
}

export function preloadMegaBrainrotGorilla(
  scene: Phaser.Scene,
  baseUrl = import.meta.env.BASE_URL,
): void {
  for (const asset of MEGA_BRAINROT_GORILLA_ANIMATIONS) {
    scene.load.spritesheet(asset.key, resolvePublicAssetUrl(asset.url, baseUrl), {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
      endFrame: asset.frames - 1,
    });
  }
}

export function registerMegaBrainrotGorillaAnimations(scene: Phaser.Scene): void {
  for (const asset of MEGA_BRAINROT_GORILLA_ANIMATIONS) {
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
