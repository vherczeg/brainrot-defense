import type Phaser from 'phaser';
import manifest from '../../../public/assets/units/shadow-runner/manifest.json';
import { resolvePublicAssetUrl } from './publicAssets';

export type ShadowRunnerAnimationState = 'idle' | 'walk' | 'attack' | 'hurt';

export interface ShadowRunnerAnimationDefinition {
  readonly key: string;
  readonly url: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frames: number;
  readonly fps: number;
  readonly repeat: number;
  readonly origin: readonly number[];
}

export const SHADOW_RUNNER_ENEMY_ID = manifest.characterTypeId;
export const SHADOW_RUNNER_ANIMATIONS =
  manifest.animations as readonly ShadowRunnerAnimationDefinition[];
export const SHADOW_RUNNER_ORIGIN = {
  x: manifest.unitOrigin[0] ?? 0.5,
  y: manifest.unitOrigin[1] ?? 0.875,
};
export const SHADOW_RUNNER_DISPLAY_WIDTH = manifest.recommendedDisplayWidth;

export function shadowRunnerAnimationKey(state: ShadowRunnerAnimationState): string {
  return `shadow-runner-${state}`;
}

export function shadowRunnerIconPath(): string {
  return 'assets/icons/shadow-runner.png';
}

export function shadowRunnerIconUrl(baseUrl = import.meta.env.BASE_URL): string {
  return resolvePublicAssetUrl(shadowRunnerIconPath(), baseUrl);
}

export function shadowRunnerStaticPath(): string {
  return 'assets/units/shadow-runner/shadow-runner.png';
}

export function shadowRunnerStaticPaths(): readonly string[] {
  return [shadowRunnerStaticPath(), shadowRunnerIconPath()];
}

export function preloadShadowRunner(scene: Phaser.Scene, baseUrl = import.meta.env.BASE_URL): void {
  for (const asset of SHADOW_RUNNER_ANIMATIONS) {
    scene.load.spritesheet(asset.key, resolvePublicAssetUrl(asset.url, baseUrl), {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
      endFrame: asset.frames - 1,
    });
  }
}

export function registerShadowRunnerAnimations(scene: Phaser.Scene): void {
  for (const asset of SHADOW_RUNNER_ANIMATIONS) {
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
