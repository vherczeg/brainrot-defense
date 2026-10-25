import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HUD_SKIN_ASSET_PATHS,
  HUD_SKIN_ATLAS_PATH,
  HUD_SKIN_ITEMS,
  HUD_SKIN_NAMES,
  applyHudSkinVariables,
  hudSkinUrl,
} from '../../src/game/rendering/hudSkins';

describe('brainrot defense HUD skin assets', () => {
  it('describes all sixteen named HUD skins in manifest order', () => {
    expect(HUD_SKIN_NAMES).toEqual([
      'card-panel',
      'wide-panel',
      'modal-frame',
      'tooltip-panel',
      'button-default',
      'button-pressed',
      'button-disabled',
      'button-selected',
      'progress-track',
      'progress-cyan',
      'progress-emerald',
      'progress-gold',
      'title-ribbon',
      'section-divider',
      'warning-banner',
      'segmented-tabs',
    ]);
  });

  it('includes the atlas and every individual skin in the verification asset set', () => {
    expect(HUD_SKIN_ATLAS_PATH).toBe('assets/ui/brainrot-defense/skins/hud-skins-atlas.png');
    expect(HUD_SKIN_ASSET_PATHS).toHaveLength(17);
    for (const name of HUD_SKIN_NAMES) {
      expect(HUD_SKIN_ASSET_PATHS).toContain(`assets/ui/brainrot-defense/skins/${name}.png`);
    }
  });

  it('keeps the manifest frame metadata for every skin', () => {
    expect(HUD_SKIN_ITEMS).toHaveLength(16);
    for (const item of HUD_SKIN_ITEMS) {
      expect(item.frame).toBeGreaterThanOrEqual(0);
      expect(item.frame).toBeLessThan(16);
      expect(item.frameRect).toHaveLength(4);
      expect(item.size).toHaveLength(2);
    }
  });

  it('has a matching public file for the atlas and every skin', async () => {
    for (const asset of HUD_SKIN_ASSET_PATHS) {
      await expect(access(resolve('public', asset))).resolves.toBeUndefined();
    }
  });

  it('resolves skin URLs through the Vite base path', () => {
    expect(hudSkinUrl('card-panel', '/')).toBe('/assets/ui/brainrot-defense/skins/card-panel.png');
    expect(hudSkinUrl('button-selected', '/brainrot/')).toBe(
      '/brainrot/assets/ui/brainrot-defense/skins/button-selected.png',
    );
  });

  it('publishes every skin as a CSS custom property', () => {
    const properties = new Map<string, string>();
    const root = {
      style: {
        setProperty(name: string, value: string) {
          properties.set(name, value);
        },
      },
    } as unknown as HTMLElement;

    applyHudSkinVariables(root);

    expect(properties.size).toBe(16);
    expect(properties.get('--skin-card-panel')).toBe(
      'url("/assets/ui/brainrot-defense/skins/card-panel.png")',
    );
    expect(properties.get('--skin-progress-gold')).toBe(
      'url("/assets/ui/brainrot-defense/skins/progress-gold.png")',
    );
  });
});
