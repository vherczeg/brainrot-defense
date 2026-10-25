import manifest from '../../../public/assets/ui/brainrot-defense/manifest.json';
import { resolvePublicAssetUrl } from './publicAssets';

export type HudIconName = keyof typeof manifest.icons;

export const HUD_ICON_NAMES = Object.keys(manifest.icons) as HudIconName[];
export const HUD_ICON_ATLAS_PATH = manifest.atlas.url.replace(/^\/+/, '');
export const HUD_ICON_ASSET_PATHS: readonly string[] = [
  HUD_ICON_ATLAS_PATH,
  ...HUD_ICON_NAMES.map((name) => manifest.icons[name].url.replace(/^\/+/, '')),
];

export function hudIconUrl(name: HudIconName, baseUrl = import.meta.env.BASE_URL): string {
  return resolvePublicAssetUrl(manifest.icons[name].url, baseUrl);
}
