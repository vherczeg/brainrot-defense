import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HUD_ICON_ASSET_PATHS,
  HUD_ICON_ATLAS_PATH,
  HUD_ICON_NAMES,
  hudIconUrl,
} from '../../src/game/rendering/hudIcons';
import { resolvePublicAssetUrl } from '../../src/game/rendering/publicAssets';

describe('brainrot defense HUD icon assets', () => {
  it('describes all sixteen named HUD icons', () => {
    expect(HUD_ICON_NAMES).toEqual([
      'coin',
      'life-heart',
      'enemy-wave',
      'armor-shield',
      'battle-speed',
      'pause',
      'resume',
      'victory-trophy',
      'crystal',
      'upgrade',
      'merge',
      'boss-crown',
      'timer',
      'defeat-heart',
      'settings',
      'home-base',
    ]);
  });

  it('includes the atlas and every individual icon in the verification asset set', () => {
    expect(HUD_ICON_ATLAS_PATH).toBe('assets/ui/brainrot-defense/hud-atlas.png');
    expect(HUD_ICON_ASSET_PATHS).toHaveLength(17);
    for (const name of HUD_ICON_NAMES) {
      expect(HUD_ICON_ASSET_PATHS).toContain(`assets/ui/brainrot-defense/icons/${name}.png`);
    }
  });

  it('has a matching public file for the atlas and every icon', async () => {
    for (const asset of HUD_ICON_ASSET_PATHS) {
      await expect(access(resolve('public', asset))).resolves.toBeUndefined();
    }
  });

  it('resolves icon URLs through the Vite base path', () => {
    expect(hudIconUrl('coin', '/')).toBe('/assets/ui/brainrot-defense/icons/coin.png');
    expect(hudIconUrl('pause', '/brainrot/')).toBe(
      '/brainrot/assets/ui/brainrot-defense/icons/pause.png',
    );
    expect(resolvePublicAssetUrl('/assets/ui/brainrot-defense/hud-atlas.png', '/brainrot')).toBe(
      '/brainrot/assets/ui/brainrot-defense/hud-atlas.png',
    );
  });
});
