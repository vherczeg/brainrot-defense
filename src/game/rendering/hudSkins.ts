import manifest from '../../../public/assets/ui/brainrot-defense/skins/manifest.json';
import { resolvePublicAssetUrl } from './publicAssets';

export type HudSkinName =
  | 'card-panel'
  | 'wide-panel'
  | 'modal-frame'
  | 'tooltip-panel'
  | 'button-default'
  | 'button-pressed'
  | 'button-disabled'
  | 'button-selected'
  | 'progress-track'
  | 'progress-cyan'
  | 'progress-emerald'
  | 'progress-gold'
  | 'title-ribbon'
  | 'section-divider'
  | 'warning-banner'
  | 'segmented-tabs';

export interface HudSkinItem {
  readonly key: HudSkinName;
  readonly url: string;
  readonly frame: number;
  readonly frameRect: readonly number[];
  readonly size: readonly number[];
}

export const HUD_SKIN_ITEMS = manifest.items as readonly HudSkinItem[];
export const HUD_SKIN_NAMES = HUD_SKIN_ITEMS.map((item) => item.key);
const HUD_SKIN_ROOT = 'assets/ui/brainrot-defense/skins';
export const HUD_SKIN_ATLAS_PATH = `${HUD_SKIN_ROOT}/${manifest.atlasSource.replace(/^\/+/, '')}`;
export const HUD_SKIN_ASSET_PATHS: readonly string[] = [
  HUD_SKIN_ATLAS_PATH,
  ...HUD_SKIN_ITEMS.map((item) => item.url.replace(/^\/+/, '')),
];

export function hudSkinUrl(name: HudSkinName, baseUrl = import.meta.env.BASE_URL): string {
  const item = HUD_SKIN_ITEMS.find((skin) => skin.key === name);
  if (!item) throw new Error(`Unknown HUD skin: ${name}`);
  return resolvePublicAssetUrl(item.url, baseUrl);
}

export function applyHudSkinVariables(root: HTMLElement = document.documentElement): void {
  for (const name of HUD_SKIN_NAMES) {
    root.style.setProperty(`--skin-${name}`, `url("${hudSkinUrl(name)}")`);
  }
}
