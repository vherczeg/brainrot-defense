import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MENU_BACKGROUND_ASSET_PATHS,
  MENU_BACKGROUND_ITEMS,
  MENU_BACKGROUND_NAMES,
  menuBackgroundUrl,
} from '../../src/game/rendering/mainMenuBackgrounds';

describe('brainrot defense main menu background assets', () => {
  it('describes the landscape and portrait backgrounds in manifest order', () => {
    expect(MENU_BACKGROUND_NAMES).toEqual(['landscape', 'portrait']);
  });

  it('includes both background files in the verification asset set', () => {
    expect(MENU_BACKGROUND_ASSET_PATHS).toEqual([
      'assets/ui/brainrot-defense/backgrounds/main-menu-landscape.png',
      'assets/ui/brainrot-defense/backgrounds/main-menu-portrait.png',
    ]);
  });

  it('keeps the expected orientation dimensions', () => {
    expect(MENU_BACKGROUND_ITEMS).toHaveLength(2);
    expect(MENU_BACKGROUND_ITEMS[0]?.size).toEqual([1536, 1024]);
    expect(MENU_BACKGROUND_ITEMS[1]?.size).toEqual([1024, 1536]);
  });

  it('has a matching public file for each background', async () => {
    for (const asset of MENU_BACKGROUND_ASSET_PATHS) {
      await expect(access(resolve('public', asset))).resolves.toBeUndefined();
    }
  });

  it('resolves background URLs through the Vite base path', () => {
    expect(menuBackgroundUrl('landscape', '/')).toBe(
      '/assets/ui/brainrot-defense/backgrounds/main-menu-landscape.png',
    );
    expect(menuBackgroundUrl('portrait', '/brainrot/')).toBe(
      '/brainrot/assets/ui/brainrot-defense/backgrounds/main-menu-portrait.png',
    );
  });
});
