import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  LASER_CROCODILE_ANIMATIONS,
  laserCrocodileIconPath,
  laserCrocodileStaticPaths,
} from '../src/game/rendering/laserCrocodile';
import {
  LIGHTNING_SCORPION_ANIMATIONS,
  lightningScorpionIconPath,
  lightningScorpionStaticPaths,
} from '../src/game/rendering/lightningScorpion';
import {
  MINI_BRAINROT_ANIMATIONS,
  miniBrainrotStaticPaths,
} from '../src/game/rendering/miniBrainrot';
import {
  ARMORED_SNAIL_ANIMATIONS,
  ARMORED_SNAIL_EFFECT_ASSET_PATHS,
  armoredSnailStaticPaths,
} from '../src/game/rendering/armoredSnail';
import {
  MEGA_BRAINROT_GORILLA_ANIMATIONS,
  megaBrainrotGorillaStaticPaths,
} from '../src/game/rendering/megaBrainrotGorilla';
import {
  SHADOW_RUNNER_ANIMATIONS,
  shadowRunnerStaticPaths,
} from '../src/game/rendering/shadowRunner';
import { CHAOS_ARENA_ASSET_PATHS } from '../src/game/rendering/chaosArena';
import { ARENA_SPAWN_PORTAL_ASSET_PATHS } from '../src/game/rendering/arenaSpawnPortal';
import { HUD_ICON_ASSET_PATHS } from '../src/game/rendering/hudIcons';
import { HUD_SKIN_ASSET_PATHS } from '../src/game/rendering/hudSkins';
import { MENU_BACKGROUND_ASSET_PATHS } from '../src/game/rendering/mainMenuBackgrounds';

function normalizeBase(base: string): string {
  if (!base) return './';
  return base.endsWith('/') ? base : `${base}/`;
}

function buildPathname(base: string, url: string): string {
  let pathname = url.split('?')[0]?.split('#')[0] ?? '';
  if (!pathname.startsWith('/')) pathname = `${base}${pathname}`;
  return pathname.replace(/\/\.\//g, '/');
}

function localPath(dist: string, base: string, url: string): string | null {
  if (/^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith('data:')) return null;
  const pathname = buildPathname(base, url);
  if (!pathname.startsWith(base)) {
    throw new Error(`Asset URL ${url} is outside the configured base path ${base}`);
  }
  return resolve(dist, pathname.slice(base.length));
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const dist = resolve(process.cwd(), 'dist');
const base = normalizeBase(process.env.VITE_BASE_PATH ?? '/');
const indexPath = resolve(dist, 'index.html');
const indexHtml = await readFile(indexPath, 'utf8');

const references = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((value): value is string => Boolean(value))
  .filter((value) => value.includes('assets/') || value.includes('manifest.webmanifest'));

if (references.length === 0) throw new Error('index.html has no build asset references');

const assets: string[] = [];
for (const reference of references) {
  const filePath = localPath(dist, base, reference);
  if (!filePath) continue;
  if (!(await exists(filePath))) {
    throw new Error(`Referenced build asset is missing: ${reference} -> ${filePath}`);
  }
  assets.push(filePath);
}

for (const required of ['sw.js', 'manifest.webmanifest']) {
  if (!(await exists(resolve(dist, required)))) {
    throw new Error(`Required build file is missing: ${required}`);
  }
}

const manifest = JSON.parse(await readFile(resolve(dist, 'manifest.webmanifest'), 'utf8')) as {
  icons?: { src?: string }[];
};
for (const icon of manifest.icons ?? []) {
  if (!icon.src) continue;
  const iconPath = localPath(dist, base, icon.src);
  if (iconPath && !(await exists(iconPath))) {
    throw new Error(`Manifest icon is missing: ${icon.src}`);
  }
}

const serviceWorker = await readFile(resolve(dist, 'sw.js'), 'utf8');
if (!/brainrot-defense-shell-[0-9a-f]{6,}/.test(serviceWorker)) {
  throw new Error('Service worker cache name is not build-versioned');
}
for (const reference of references) {
  const pathname = buildPathname(base, reference);
  if (!serviceWorker.includes(JSON.stringify(pathname))) {
    throw new Error(`Service worker precache is missing ${pathname}`);
  }
}

const assetGroups = [
  {
    name: 'Laser Crocodile',
    assets: [
      'assets/units/laser-crocodile/manifest.json',
      ...LASER_CROCODILE_ANIMATIONS.map((animation) => animation.url.replace(/^\/+/, '')),
      ...laserCrocodileStaticPaths(),
      ...[1, 4, 8].map(laserCrocodileIconPath),
    ],
  },
  {
    name: 'Lightning Scorpion',
    assets: [
      'assets/units/lightning-scorpion/manifest.json',
      ...LIGHTNING_SCORPION_ANIMATIONS.map((animation) => animation.url.replace(/^\/+/, '')),
      ...lightningScorpionStaticPaths(),
      ...[1, 4, 8].map(lightningScorpionIconPath),
    ],
  },
  {
    name: 'Mini Brainrot',
    assets: [
      'assets/units/mini-brainrot/manifest.json',
      ...MINI_BRAINROT_ANIMATIONS.map((animation) => animation.url.replace(/^\/+/, '')),
      ...miniBrainrotStaticPaths(),
    ],
  },
  {
    name: 'Armored Snail',
    assets: [
      'assets/units/armored-snail/manifest.json',
      'assets/effects/armored-snail/manifest.json',
      ...ARMORED_SNAIL_ANIMATIONS.map((animation) => animation.url.replace(/^\/+/, '')),
      ...armoredSnailStaticPaths(),
      ...ARMORED_SNAIL_EFFECT_ASSET_PATHS,
    ],
  },
  {
    name: 'Shadow Runner',
    assets: [
      'assets/units/shadow-runner/manifest.json',
      ...SHADOW_RUNNER_ANIMATIONS.map((animation) => animation.url.replace(/^\/+/, '')),
      ...shadowRunnerStaticPaths(),
    ],
  },
  {
    name: 'Mega Brainrot Gorilla',
    assets: [
      'assets/units/mega-brainrot-gorilla/manifest.json',
      ...MEGA_BRAINROT_GORILLA_ANIMATIONS.map((animation) => animation.url.replace(/^\/+/, '')),
      ...megaBrainrotGorillaStaticPaths(),
    ],
  },
  {
    name: 'Chaos Arena Terrain',
    assets: [...CHAOS_ARENA_ASSET_PATHS],
  },
  {
    name: 'Arena Spawn Portal',
    assets: ['assets/effects/arena-spawn-portal/manifest.json', ...ARENA_SPAWN_PORTAL_ASSET_PATHS],
  },
  {
    name: 'HUD Icons',
    assets: ['assets/ui/brainrot-defense/manifest.json', ...HUD_ICON_ASSET_PATHS],
  },
  {
    name: 'HUD Skins',
    assets: ['assets/ui/brainrot-defense/skins/manifest.json', ...HUD_SKIN_ASSET_PATHS],
  },
  {
    name: 'Main Menu Backgrounds',
    assets: [
      'assets/ui/brainrot-defense/backgrounds/manifest.json',
      ...MENU_BACKGROUND_ASSET_PATHS,
    ],
  },
];
let assetCount = 0;
for (const group of assetGroups) {
  assetCount += group.assets.length;
  for (const asset of group.assets) {
    const filePath = resolve(dist, asset);
    if (!(await exists(filePath))) {
      throw new Error(`${group.name} asset is missing from the build: ${asset}`);
    }
    const pathname = `${base}${asset}`;
    if (!serviceWorker.includes(JSON.stringify(pathname))) {
      throw new Error(`Service worker precache is missing ${pathname}`);
    }
  }
}

console.log(
  `Build asset verification passed: ${assets.length} index assets, ${manifest.icons?.length ?? 0} manifest icons, ${assetCount} grouped assets, versioned service worker.`,
);
