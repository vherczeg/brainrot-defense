import manifest from '../../../public/assets/ui/brainrot-defense/backgrounds/manifest.json';
import { resolvePublicAssetUrl } from './publicAssets';

export type MenuBackgroundName = 'landscape' | 'portrait';

export interface MenuBackgroundItem {
  readonly key: MenuBackgroundName;
  readonly url: string;
  readonly size: readonly number[];
}

export const MENU_BACKGROUND_ITEMS = manifest.backgrounds as readonly MenuBackgroundItem[];
export const MENU_BACKGROUND_NAMES = MENU_BACKGROUND_ITEMS.map((item) => item.key);
export const MENU_BACKGROUND_ASSET_PATHS: readonly string[] = MENU_BACKGROUND_ITEMS.map((item) =>
  item.url.replace(/^\/+/, ''),
);

export function menuBackgroundUrl(
  name: MenuBackgroundName,
  baseUrl = import.meta.env.BASE_URL,
): string {
  const item = MENU_BACKGROUND_ITEMS.find((background) => background.key === name);
  if (!item) throw new Error(`Unknown menu background: ${name}`);
  return resolvePublicAssetUrl(item.url, baseUrl);
}
