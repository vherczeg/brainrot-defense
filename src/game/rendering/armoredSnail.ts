import type Phaser from 'phaser';
import manifest from '../../../public/assets/units/armored-snail/manifest.json';
import effectsManifest from '../../../public/assets/effects/armored-snail/manifest.json';
import { resolvePublicAssetUrl } from './publicAssets';

export type ArmoredSnailAnimationState = 'idle' | 'walk' | 'attack' | 'hurt';
export type ArmoredSnailEffectAction = 'shell-hit' | 'armor-glint' | 'slime-trail' | 'slime-splash';

export interface ArmoredSnailEffectAnimation {
  readonly key: string;
  readonly action: ArmoredSnailEffectAction;
  readonly url: string;
  readonly frames: number;
  readonly fps: number;
  readonly repeat: number;
}

export interface ArmoredSnailAnimationDefinition {
  readonly key: string;
  readonly url: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frames: number;
  readonly fps: number;
  readonly repeat: number;
  readonly origin: readonly number[];
}

export const ARMORED_SNAIL_ASSET_ID = manifest.characterTypeId;
export const ARMORED_SNAIL_ENEMY_ID = 'armored-slug' as const;
export const ARMORED_SNAIL_ANIMATIONS =
  manifest.animations as readonly ArmoredSnailAnimationDefinition[];
export const ARMORED_SNAIL_ORIGIN = {
  x: manifest.unitOrigin[0] ?? 0.5,
  y: manifest.unitOrigin[1] ?? 0.875,
};
export const ARMORED_SNAIL_DISPLAY_WIDTH = manifest.recommendedDisplayWidth;
export const ARMORED_SNAIL_EFFECT_ACTIONS: readonly ArmoredSnailEffectAction[] = [
  'shell-hit',
  'armor-glint',
  'slime-trail',
  'slime-splash',
];
export const ARMORED_SNAIL_EFFECT_ANIMATIONS: readonly ArmoredSnailEffectAnimation[] =
  ARMORED_SNAIL_EFFECT_ACTIONS.map((action) => ({
    key: `armored-snail-fx-${action}`,
    action,
    url: effectsManifest.files[action].url,
    frames: effectsManifest.files[action].frames.length,
    fps: effectsManifest.fps,
    repeat: 0,
  }));
export const ARMORED_SNAIL_EFFECTS = {
  shellHit: 'armored-snail-fx-shell-hit',
  armorGlint: 'armored-snail-fx-armor-glint',
  slimeTrail: 'armored-snail-fx-slime-trail',
  slimeSplash: 'armored-snail-fx-slime-splash',
} as const;
export const ARMORED_SNAIL_EFFECT_ASSET_PATHS: readonly string[] =
  ARMORED_SNAIL_EFFECT_ACTIONS.flatMap((action) => [
    effectsManifest.files[action].url.replace(/^\/+/, ''),
    ...effectsManifest.files[action].frames.map((url) => url.replace(/^\/+/, '')),
  ]);

export function armoredSnailAnimationKey(state: ArmoredSnailAnimationState): string {
  return `armored-snail-${state}`;
}

export function armoredSnailIconPath(): string {
  return 'assets/icons/armored-snail.png';
}

export function armoredSnailIconUrl(baseUrl = import.meta.env.BASE_URL): string {
  return resolvePublicAssetUrl(armoredSnailIconPath(), baseUrl);
}

export function armoredSnailStaticPath(): string {
  return 'assets/units/armored-snail/armored-snail.png';
}

export function armoredSnailStaticPaths(): readonly string[] {
  return [armoredSnailStaticPath(), armoredSnailIconPath()];
}

export function preloadArmoredSnail(scene: Phaser.Scene, baseUrl = import.meta.env.BASE_URL): void {
  for (const asset of ARMORED_SNAIL_ANIMATIONS) {
    scene.load.spritesheet(asset.key, resolvePublicAssetUrl(asset.url, baseUrl), {
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
      endFrame: asset.frames - 1,
    });
  }
}

export function registerArmoredSnailAnimations(scene: Phaser.Scene): void {
  for (const asset of ARMORED_SNAIL_ANIMATIONS) {
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

export function preloadArmoredSnailEffects(
  scene: Phaser.Scene,
  baseUrl = import.meta.env.BASE_URL,
): void {
  for (const asset of ARMORED_SNAIL_EFFECT_ANIMATIONS) {
    scene.load.spritesheet(asset.key, resolvePublicAssetUrl(asset.url, baseUrl), {
      frameWidth: effectsManifest.tileSize[0] ?? 256,
      frameHeight: effectsManifest.tileSize[1] ?? 256,
      endFrame: asset.frames - 1,
    });
  }
}

export function registerArmoredSnailEffectsAnimations(scene: Phaser.Scene): void {
  for (const asset of ARMORED_SNAIL_EFFECT_ANIMATIONS) {
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
