import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { startGame } from './helpers';

test('production HTML, manifest icons, and service worker use resolvable asset URLs', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('menu-continue')).toBeVisible();

  const urls = await page.evaluate(() => {
    const scripts = [...document.querySelectorAll<HTMLScriptElement>('script[src]')].map(
      (element) => element.src,
    );
    const styles = [
      ...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'),
    ].map((element) => element.href);
    return [...scripts, ...styles];
  });
  expect(urls.length).toBeGreaterThanOrEqual(2);
  for (const url of urls) {
    const response = await page.request.get(url);
    expect(response.ok(), url).toBe(true);
  }

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).not.toBeNull();
  if (!manifestHref) return;
  const manifestUrl = new URL(manifestHref, page.url()).toString();
  const manifestResponse = await page.request.get(manifestUrl);
  expect(manifestResponse.ok(), manifestUrl).toBe(true);
  const manifest = (await manifestResponse.json()) as {
    start_url: string;
    scope: string;
    icons: { src: string }[];
  };
  for (const icon of manifest.icons) {
    const iconUrl = new URL(icon.src, manifestUrl).toString();
    const response = await page.request.get(iconUrl);
    expect(response.ok(), iconUrl).toBe(true);
  }

  const registration = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    const ready = await navigator.serviceWorker.ready;
    return { scriptURL: ready.active?.scriptURL ?? null, scope: ready.scope };
  });
  expect(registration?.scriptURL).toContain('/sw.js');
  expect(registration?.scope).toContain('/');
});

test('service worker cache name is build-versioned and includes JavaScript and CSS', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  const cache = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    await navigator.serviceWorker.ready;
    const names = await caches.keys();
    const name = names.find((item) => item.startsWith('brainrot-defense-shell-')) ?? '';
    const cacheNames = await caches.open(name);
    const requests = await cacheNames.keys();
    return {
      name,
      paths: requests.map((request) => new URL(request.url).pathname),
    };
  });
  expect(cache).not.toBeNull();
  if (!cache) return;
  expect(cache.name).toMatch(/brainrot-defense-shell-[0-9a-f]{6,}/);
  expect(cache.paths.some((path) => path.endsWith('.js'))).toBe(true);
  expect(cache.paths.some((path) => path.endsWith('.css'))).toBe(true);
  expect(cache.paths.some((path) => path.endsWith('index.html'))).toBe(true);
  expect(cache.paths).toContain('/assets/units/laser-crocodile/v1-idle.png');
  expect(cache.paths).toContain('/assets/units/laser-crocodile/v3-walk.png');
  expect(cache.paths).toContain('/assets/icons/laser-crocodile-v2.png');
  expect(cache.paths).toContain('/assets/effects/laser-crocodile/laser-bolt.png');
  expect(cache.paths).toContain('/assets/units/lightning-scorpion/v1-idle.png');
  expect(cache.paths).toContain('/assets/units/lightning-scorpion/v3-walk.png');
  expect(cache.paths).toContain('/assets/icons/lightning-scorpion-v2.png');
  expect(cache.paths).toContain('/assets/effects/lightning-scorpion/chain-bolt.png');
  expect(cache.paths).toContain('/assets/units/mini-brainrot/idle.png');
  expect(cache.paths).toContain('/assets/units/mini-brainrot/attack.png');
  expect(cache.paths).toContain('/assets/icons/mini-brainrot.png');
  expect(cache.paths).toContain('/assets/units/armored-snail/idle.png');
  expect(cache.paths).toContain('/assets/units/armored-snail/attack.png');
  expect(cache.paths).toContain('/assets/icons/armored-snail.png');
  expect(cache.paths).toContain('/assets/effects/armored-snail/shell-hit.png');
  expect(cache.paths).toContain('/assets/effects/armored-snail/slime-splash.png');
  expect(cache.paths).toContain('/assets/effects/armored-snail/frames/slime-trail/00.png');
  expect(cache.paths).toContain('/assets/units/shadow-runner/idle.png');
  expect(cache.paths).toContain('/assets/units/shadow-runner/attack.png');
  expect(cache.paths).toContain('/assets/icons/shadow-runner.png');
  expect(cache.paths).toContain('/assets/units/mega-brainrot-gorilla/idle.png');
  expect(cache.paths).toContain('/assets/effects/mega-brainrot-gorilla/ground-slam.png');
  expect(cache.paths).toContain('/assets/icons/mega-brainrot-gorilla.png');
  expect(cache.paths).toContain('/assets/terrain/chaos-arena/floor-tiles.png');
  expect(cache.paths).toContain('/assets/terrain/chaos-arena/decorations.png');
  expect(cache.paths).toContain('/assets/terrain/chaos-arena/tiles/basalt-01.png');
  expect(cache.paths).toContain('/assets/terrain/chaos-arena/props/brazier.png');
  expect(cache.paths).toContain('/assets/effects/arena-spawn-portal/idle.png');
  expect(cache.paths).toContain('/assets/effects/arena-spawn-portal/opening.png');
  expect(cache.paths).toContain('/assets/effects/arena-spawn-portal/frames/idle/00.png');
  expect(cache.paths).toContain('/assets/ui/brainrot-defense/hud-atlas.png');
  expect(cache.paths).toContain('/assets/ui/brainrot-defense/icons/coin.png');
  expect(cache.paths).toContain('/assets/ui/brainrot-defense/icons/pause.png');
  expect(cache.paths).toContain('/assets/ui/brainrot-defense/icons/home-base.png');
  expect(cache.paths).toContain('/assets/ui/brainrot-defense/skins/hud-skins-atlas.png');
  expect(cache.paths).toContain('/assets/ui/brainrot-defense/skins/card-panel.png');
  expect(cache.paths).toContain('/assets/ui/brainrot-defense/skins/button-default.png');
  expect(cache.paths).toContain('/assets/ui/brainrot-defense/skins/button-selected.png');
  expect(cache.paths).toContain('/assets/ui/brainrot-defense/skins/progress-gold.png');
  expect(cache.paths).toContain('/assets/ui/brainrot-defense/backgrounds/main-menu-landscape.png');
  expect(cache.paths).toContain('/assets/ui/brainrot-defense/backgrounds/main-menu-portrait.png');
});

test('scorpion portraits use scorpion icons instead of crocodile icons', async ({ page }) => {
  await startGame(page);
  const scorpionCard = page.locator('.shop-card').filter({ hasText: 'Villám Skorpió' });
  await expect(scorpionCard.locator('image')).toHaveAttribute(
    'href',
    /\/assets\/icons\/lightning-scorpion-v1\.png$/,
  );

  await page.getByTestId('accessible-panel').locator('summary').click();
  const scorpionUnit = page.locator('.accessible-unit').filter({ hasText: 'Skorpió' }).first();
  if (await scorpionUnit.isVisible()) {
    await scorpionUnit.click();
    await expect(page.getByTestId('unit-inspector').locator('image')).toHaveAttribute(
      'href',
      /\/assets\/icons\/lightning-scorpion-v1\.png$/,
    );
  }
});

test('Mini Brainrot enemy portraits use the mini-brainrot icon', async ({ page }) => {
  await startGame(page);
  const miniBrainrot = page.locator('.enemy-stack').filter({ hasText: 'Mini Brainrot' }).first();
  await expect(miniBrainrot.locator('image')).toHaveAttribute(
    'href',
    /\/assets\/icons\/mini-brainrot\.png$/,
  );
});

test('Armored Snail enemy portraits use the armored-snail icon', async ({ page }) => {
  await startGame(page);
  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-save').click();
  await expect(page.getByTestId('save-modal')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-save').click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  if (!path) return;

  const envelope = JSON.parse(await readFile(path, 'utf8')) as {
    profile: { currentWave: number; unlockedWave: number; completedWaves: number[] };
  };
  envelope.profile.currentWave = 3;
  envelope.profile.unlockedWave = 3;
  envelope.profile.completedWaves = [1, 2];
  await page.getByTestId('import-save-input').setInputFiles({
    name: 'armored-snail-wave.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(envelope)),
  });
  await expect(page.getByTestId('import-confirm-modal')).toBeVisible();
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();

  const armoredSnail = page
    .locator('.enemy-stack')
    .filter({ hasText: 'Páncélozott Csiga' })
    .first();
  await expect(armoredSnail.locator('image')).toHaveAttribute(
    'href',
    /\/assets\/icons\/armored-snail\.png$/,
  );
});

test('Shadow Runner enemy portraits use the shadow-runner icon', async ({ page }) => {
  await startGame(page);
  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-save').click();
  await expect(page.getByTestId('save-modal')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-save').click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  if (!path) return;

  const envelope = JSON.parse(await readFile(path, 'utf8')) as {
    profile: { currentWave: number; unlockedWave: number; completedWaves: number[] };
  };
  envelope.profile.currentWave = 4;
  envelope.profile.unlockedWave = 4;
  envelope.profile.completedWaves = [1, 2, 3];
  await page.getByTestId('import-save-input').setInputFiles({
    name: 'shadow-runner-wave.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(envelope)),
  });
  await expect(page.getByTestId('import-confirm-modal')).toBeVisible();
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();

  const shadowRunner = page.locator('.enemy-stack').filter({ hasText: 'Árny Futó' }).first();
  await expect(shadowRunner.locator('image')).toHaveAttribute(
    'href',
    /\/assets\/icons\/shadow-runner\.png$/,
  );
});

test('Mega Brainrot Gorilla portraits use the boss icon', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await expect(page.locator('.menu-floater--three image')).toHaveAttribute(
    'href',
    /\/assets\/icons\/mega-brainrot-gorilla\.png$/,
  );
});

test('Chaos Arena terrain assets resolve and both atlases decode with sixteen cells', async ({
  page,
  request,
}) => {
  const manifestResponse = await request.get('/assets/terrain/chaos-arena/manifest.json');
  expect(manifestResponse.ok(), manifestResponse.url()).toBe(true);
  const manifest = (await manifestResponse.json()) as {
    files: { type: string; url: string }[];
    atlasFiles: { floor: string; decorations: string };
  };
  expect(manifest.files.filter((file) => file.type === 'floor')).toHaveLength(16);
  expect(manifest.files.filter((file) => file.type === 'prop')).toHaveLength(16);

  const urls = [
    manifest.atlasFiles.floor,
    manifest.atlasFiles.decorations,
    ...manifest.files.map((file) => file.url),
  ];
  for (const url of urls) {
    const response = await request.get(url);
    expect(response.ok(), url).toBe(true);
  }

  await page.goto('/');
  const result = await page.evaluate(
    async (atlasUrls: string[]) => {
      async function load(url: string): Promise<HTMLImageElement> {
        const image = new Image();
        image.src = url;
        await image.decode();
        return image;
      }

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('2D canvas context is unavailable');

      const atlases: {
        url: string;
        width: number;
        height: number;
        nonTransparentPixels: number[];
      }[] = [];
      for (const url of atlasUrls) {
        const image = await load(url);
        const nonTransparentPixels: number[] = [];
        for (let index = 0; index < 16; index += 1) {
          const sourceX = (index % 4) * 256;
          const sourceY = Math.floor(index / 4) * 256;
          context.clearRect(0, 0, 256, 256);
          context.drawImage(image, sourceX, sourceY, 256, 256, 0, 0, 256, 256);
          const pixels = context.getImageData(0, 0, 256, 256).data;
          let opaque = 0;
          for (let pixel = 3; pixel < pixels.length; pixel += 4) {
            if ((pixels[pixel] ?? 0) > 0) opaque += 1;
          }
          nonTransparentPixels.push(opaque);
        }
        atlases.push({
          url,
          width: image.naturalWidth,
          height: image.naturalHeight,
          nonTransparentPixels,
        });
      }
      return atlases;
    },
    [manifest.atlasFiles.floor, manifest.atlasFiles.decorations],
  );

  for (const atlas of result) {
    expect(atlas.width, atlas.url).toBe(1024);
    expect(atlas.height, atlas.url).toBe(1024);
    for (const [frame, opaque] of atlas.nonTransparentPixels.entries()) {
      expect(opaque, `${atlas.url} frame ${frame}`).toBeGreaterThan(0);
    }
  }
});

test('Arena spawn portal strips and frames resolve with four-frame animations', async ({
  page,
  request,
}) => {
  const manifestResponse = await request.get('/assets/effects/arena-spawn-portal/manifest.json');
  expect(manifestResponse.ok(), manifestResponse.url()).toBe(true);
  const manifest = (await manifestResponse.json()) as {
    files: Record<string, { url: string; frames: string[] }>;
  };
  const animations = Object.values(manifest.files);
  expect(animations).toHaveLength(4);

  const urls = animations.flatMap((animation) => [animation.url, ...animation.frames]);
  expect(urls).toHaveLength(20);
  for (const url of urls) {
    const response = await request.get(url);
    expect(response.ok(), url).toBe(true);
  }

  await page.goto('/');
  const result = await page.evaluate(
    async (animationUrls: string[]) => {
      async function load(url: string): Promise<HTMLImageElement> {
        const image = new Image();
        image.src = url;
        await image.decode();
        return image;
      }

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('2D canvas context is unavailable');

      const decoded: {
        url: string;
        width: number;
        height: number;
        nonTransparentPixels: number[];
      }[] = [];
      for (const url of animationUrls) {
        const image = await load(url);
        const nonTransparentPixels: number[] = [];
        for (let frame = 0; frame < 4; frame += 1) {
          context.clearRect(0, 0, 256, 256);
          context.drawImage(image, frame * 256, 0, 256, 256, 0, 0, 256, 256);
          const pixels = context.getImageData(0, 0, 256, 256).data;
          let opaque = 0;
          for (let pixel = 3; pixel < pixels.length; pixel += 4) {
            if ((pixels[pixel] ?? 0) > 0) opaque += 1;
          }
          nonTransparentPixels.push(opaque);
        }
        decoded.push({
          url,
          width: image.naturalWidth,
          height: image.naturalHeight,
          nonTransparentPixels,
        });
      }
      return decoded;
    },
    animations.map((animation) => animation.url),
  );

  for (const animation of result) {
    expect(animation.width, animation.url).toBe(1024);
    expect(animation.height, animation.url).toBe(256);
    for (const [frame, opaque] of animation.nonTransparentPixels.entries()) {
      expect(opaque, `${animation.url} frame ${frame}`).toBeGreaterThan(0);
    }
  }
});

test('Armored Snail effect strips and frames resolve with four-frame animations', async ({
  page,
  request,
}) => {
  const manifestResponse = await request.get('/assets/effects/armored-snail/manifest.json');
  expect(manifestResponse.ok(), manifestResponse.url()).toBe(true);
  const manifest = (await manifestResponse.json()) as {
    files: Record<string, { url: string; frames: string[] }>;
  };
  const effects = Object.values(manifest.files);
  expect(effects).toHaveLength(4);

  const urls = effects.flatMap((effect) => [effect.url, ...effect.frames]);
  expect(urls).toHaveLength(20);
  for (const url of urls) {
    const response = await request.get(url);
    expect(response.ok(), url).toBe(true);
  }

  await page.goto('/');
  const result = await page.evaluate(
    async (effectUrls: string[]) => {
      async function load(url: string): Promise<HTMLImageElement> {
        const image = new Image();
        image.src = url;
        await image.decode();
        return image;
      }

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('2D canvas context is unavailable');

      const decoded: {
        url: string;
        width: number;
        height: number;
        nonTransparentPixels: number[];
      }[] = [];
      for (const url of effectUrls) {
        const image = await load(url);
        const nonTransparentPixels: number[] = [];
        for (let frame = 0; frame < 4; frame += 1) {
          context.clearRect(0, 0, 256, 256);
          context.drawImage(image, frame * 256, 0, 256, 256, 0, 0, 256, 256);
          const pixels = context.getImageData(0, 0, 256, 256).data;
          let opaque = 0;
          for (let pixel = 3; pixel < pixels.length; pixel += 4) {
            if ((pixels[pixel] ?? 0) > 0) opaque += 1;
          }
          nonTransparentPixels.push(opaque);
        }
        decoded.push({
          url,
          width: image.naturalWidth,
          height: image.naturalHeight,
          nonTransparentPixels,
        });
      }
      return decoded;
    },
    effects.map((effect) => effect.url),
  );

  for (const effect of result) {
    expect(effect.width, effect.url).toBe(1024);
    expect(effect.height, effect.url).toBe(256);
    for (const [frame, opaque] of effect.nonTransparentPixels.entries()) {
      expect(opaque, `${effect.url} frame ${frame}`).toBeGreaterThan(0);
    }
  }
});

test('HUD icon atlas and individual icons resolve with sixteen cells', async ({
  page,
  request,
}) => {
  const manifestResponse = await request.get('/assets/ui/brainrot-defense/manifest.json');
  expect(manifestResponse.ok(), manifestResponse.url()).toBe(true);
  const manifest = (await manifestResponse.json()) as {
    atlas: { url: string; columns: number; rows: number };
    icons: Record<string, { url: string; frame: number; frameRect: number[] }>;
  };
  const icons = Object.values(manifest.icons);
  expect(icons).toHaveLength(16);
  expect(manifest.atlas.columns * manifest.atlas.rows).toBe(16);

  const urls = [manifest.atlas.url, ...icons.map((icon) => icon.url)];
  expect(urls).toHaveLength(17);
  for (const url of urls) {
    const response = await request.get(url);
    expect(response.ok(), url).toBe(true);
  }

  await page.goto('/');
  const result = await page.evaluate(
    async ({ atlasUrl, iconUrls }: { atlasUrl: string; iconUrls: string[] }) => {
      async function load(url: string): Promise<HTMLImageElement> {
        const image = new Image();
        image.src = url;
        await image.decode();
        return image;
      }

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('2D canvas context is unavailable');
      const ctx = context;

      function countOpaque(image: HTMLImageElement, sx: number, sy: number): number {
        ctx.clearRect(0, 0, 256, 256);
        ctx.drawImage(image, sx, sy, 256, 256, 0, 0, 256, 256);
        const pixels = ctx.getImageData(0, 0, 256, 256).data;
        let opaque = 0;
        for (let pixel = 3; pixel < pixels.length; pixel += 4) {
          if ((pixels[pixel] ?? 0) > 0) opaque += 1;
        }
        return opaque;
      }

      const atlas = await load(atlasUrl);
      const atlasCells: number[] = [];
      for (let index = 0; index < 16; index += 1) {
        atlasCells.push(countOpaque(atlas, (index % 4) * 256, Math.floor(index / 4) * 256));
      }

      const individual: { url: string; width: number; height: number; opaque: number }[] = [];
      for (const url of iconUrls) {
        const image = await load(url);
        individual.push({
          url,
          width: image.naturalWidth,
          height: image.naturalHeight,
          opaque: countOpaque(image, 0, 0),
        });
      }
      return {
        atlasWidth: atlas.naturalWidth,
        atlasHeight: atlas.naturalHeight,
        atlasCells,
        individual,
      };
    },
    {
      atlasUrl: manifest.atlas.url,
      iconUrls: icons.map((icon) => icon.url),
    },
  );

  expect(result.atlasWidth).toBe(1024);
  expect(result.atlasHeight).toBe(1024);
  for (const [index, opaque] of result.atlasCells.entries()) {
    expect(opaque, `atlas cell ${index}`).toBeGreaterThan(0);
  }
  for (const icon of result.individual) {
    expect(icon.width, icon.url).toBe(256);
    expect(icon.height, icon.url).toBe(256);
    expect(icon.opaque, icon.url).toBeGreaterThan(0);
  }
});

test('HUD skin atlas and individual skins resolve with sixteen cells', async ({
  page,
  request,
}) => {
  const manifestResponse = await request.get('/assets/ui/brainrot-defense/skins/manifest.json');
  expect(manifestResponse.ok(), manifestResponse.url()).toBe(true);
  const manifest = (await manifestResponse.json()) as {
    atlasSource: string;
    grid: number[];
    items: { url: string; size: number[]; frameRect: number[] }[];
  };
  expect(manifest.items).toHaveLength(16);
  expect((manifest.grid[0] ?? 0) * (manifest.grid[1] ?? 0)).toBe(16);

  const atlasUrl = `/assets/ui/brainrot-defense/skins/${manifest.atlasSource}`;
  const urls = [atlasUrl, ...manifest.items.map((item) => item.url)];
  expect(urls).toHaveLength(17);
  for (const url of urls) {
    const response = await request.get(url);
    expect(response.ok(), url).toBe(true);
  }

  await page.goto('/');
  const result = await page.evaluate(
    async ({
      atlasUrl,
      items,
    }: {
      atlasUrl: string;
      items: { url: string; size: number[]; frameRect: number[] }[];
    }) => {
      async function load(url: string): Promise<HTMLImageElement> {
        const image = new Image();
        image.src = url;
        await image.decode();
        return image;
      }

      const atlas = await load(atlasUrl);
      const individual: { url: string; width: number; height: number }[] = [];
      for (const item of items) {
        const image = await load(item.url);
        individual.push({
          url: item.url,
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      }
      return {
        atlasWidth: atlas.naturalWidth,
        atlasHeight: atlas.naturalHeight,
        individual,
      };
    },
    {
      atlasUrl,
      items: manifest.items.map((item) => ({
        url: item.url,
        size: item.size,
        frameRect: item.frameRect,
      })),
    },
  );

  expect(result.atlasWidth).toBe(1536);
  expect(result.atlasHeight).toBe(1024);
  for (const [index, skin] of result.individual.entries()) {
    const item = manifest.items[index];
    expect(skin.width, skin.url).toBe(item?.size[0]);
    expect(skin.height, skin.url).toBe(item?.size[1]);
  }
});

test('HUD skins style existing controls without replacing labels', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  const progressBackground = await page
    .locator('.progress-track span')
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(progressBackground).toContain('/assets/ui/brainrot-defense/skins/progress-gold.png');

  await page.getByTestId('menu-continue').click();
  const tutorial = page.getByTestId('tutorial-dismiss');
  if (await tutorial.isVisible()) await tutorial.click();
  await page.getByTestId('battle-button').click();
  await expect(page.getByTestId('battle-hud')).toBeVisible();
  await page.getByTestId('battle-pause').click();
  await expect(page.getByTestId('pause-modal')).toBeVisible();

  const pauseEmblem = await page
    .locator('.pause-glyph')
    .evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(pauseEmblem).toContain('/assets/ui/brainrot-defense/skins/card-panel.png');

  const speedOptions = page.locator('.segmented__option');
  await expect(speedOptions.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(speedOptions.nth(0)).toContainText('1×');
  await expect(speedOptions.nth(1)).toContainText('2×');
  const activeBackground = await speedOptions
    .nth(0)
    .evaluate((element) => getComputedStyle(element).backgroundImage);
  const inactiveBackground = await speedOptions
    .nth(1)
    .evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(activeBackground).toContain('/assets/ui/brainrot-defense/skins/button-selected.png');
  expect(inactiveBackground).toContain('/assets/ui/brainrot-defense/skins/button-default.png');

  await speedOptions.nth(1).click();
  await expect(speedOptions.nth(0)).toHaveAttribute('aria-pressed', 'false');
  await expect(speedOptions.nth(1)).toHaveAttribute('aria-pressed', 'true');
});

test('main menu backgrounds use orientation-matched artwork without replacing content', async ({
  page,
  request,
}) => {
  const manifestResponse = await request.get(
    '/assets/ui/brainrot-defense/backgrounds/manifest.json',
  );
  expect(manifestResponse.ok(), manifestResponse.url()).toBe(true);
  const manifest = (await manifestResponse.json()) as {
    backgrounds: { key: string; url: string; size: number[] }[];
  };
  expect(manifest.backgrounds.map((background) => background.key)).toEqual([
    'landscape',
    'portrait',
  ]);
  expect(manifest.backgrounds.map((background) => background.size)).toEqual([
    [1536, 1024],
    [1024, 1536],
  ]);
  for (const background of manifest.backgrounds) {
    const response = await request.get(background.url);
    expect(response.ok(), background.url).toBe(true);
  }

  await page.goto('/');
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await expect(page.locator('.brand-title')).toContainText('BRAINROT');

  await page.setViewportSize({ width: 1280, height: 900 });
  const landscapeBackground = await page
    .locator('.menu-screen')
    .evaluate((element) => getComputedStyle(element, '::before').backgroundImage);
  expect(landscapeBackground).toContain(
    '/assets/ui/brainrot-defense/backgrounds/main-menu-landscape.png',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  const portraitBackground = await page
    .locator('.menu-screen')
    .evaluate((element) => getComputedStyle(element, '::before').backgroundImage);
  expect(portraitBackground).toContain(
    '/assets/ui/brainrot-defense/backgrounds/main-menu-portrait.png',
  );
  await expect(page.locator('.menu-screen')).toHaveCSS('overflow', 'hidden');
  await expect(page.getByTestId('menu-continue')).toBeVisible();
});

test('HUD controls use raster icons without replacing labels', async ({ page }) => {
  await startGame(page);
  await expect(page.getByTestId('coins-value').locator('img')).toHaveAttribute(
    'src',
    /\/assets\/ui\/brainrot-defense\/icons\/coin\.png$/,
  );
  await expect(page.getByTestId('open-settings').locator('img')).toHaveAttribute(
    'src',
    /\/assets\/ui\/brainrot-defense\/icons\/settings\.png$/,
  );
  await page.getByTestId('battle-button').click();
  await expect(page.getByTestId('battle-speed').locator('img')).toHaveAttribute(
    'src',
    /\/assets\/ui\/brainrot-defense\/icons\/battle-speed\.png$/,
  );
  await expect(page.getByTestId('battle-pause').locator('img')).toHaveAttribute(
    'src',
    /\/assets\/ui\/brainrot-defense\/icons\/pause\.png$/,
  );
  await expect(page.getByTestId('battle-speed')).toContainText('1×');
});

const CHARACTER_ASSETS = [
  {
    name: 'Laser Crocodile',
    slug: 'laser-crocodile',
    animationCount: 16,
    staticPaths: [
      '/assets/units/laser-crocodile/v1.png',
      '/assets/units/laser-crocodile/v2.png',
      '/assets/units/laser-crocodile/v3.png',
      '/assets/icons/laser-crocodile-v1.png',
      '/assets/icons/laser-crocodile-v2.png',
      '/assets/icons/laser-crocodile-v3.png',
    ],
  },
  {
    name: 'Lightning Scorpion',
    slug: 'lightning-scorpion',
    animationCount: 16,
    staticPaths: [
      '/assets/units/lightning-scorpion/v1.png',
      '/assets/units/lightning-scorpion/v2.png',
      '/assets/units/lightning-scorpion/v3.png',
      '/assets/icons/lightning-scorpion-v1.png',
      '/assets/icons/lightning-scorpion-v2.png',
      '/assets/icons/lightning-scorpion-v3.png',
    ],
  },
  {
    name: 'Mini Brainrot',
    slug: 'mini-brainrot',
    animationCount: 4,
    staticPaths: [
      '/assets/units/mini-brainrot/mini-brainrot.png',
      '/assets/icons/mini-brainrot.png',
    ],
  },
  {
    name: 'Armored Snail',
    slug: 'armored-snail',
    animationCount: 4,
    staticPaths: [
      '/assets/units/armored-snail/armored-snail.png',
      '/assets/icons/armored-snail.png',
    ],
  },
  {
    name: 'Shadow Runner',
    slug: 'shadow-runner',
    animationCount: 4,
    staticPaths: [
      '/assets/units/shadow-runner/shadow-runner.png',
      '/assets/icons/shadow-runner.png',
    ],
  },
  {
    name: 'Mega Brainrot Gorilla',
    slug: 'mega-brainrot-gorilla',
    animationCount: 8,
    staticPaths: [
      '/assets/units/mega-brainrot-gorilla/mega-brainrot-gorilla.png',
      '/assets/icons/mega-brainrot-gorilla.png',
    ],
  },
] as const;

for (const character of CHARACTER_ASSETS) {
  test(`${character.name} static images and spritesheets decode with all four frames`, async ({
    page,
    request,
  }) => {
    const manifestResponse = await request.get(`/assets/units/${character.slug}/manifest.json`);
    expect(manifestResponse.ok(), manifestResponse.url()).toBe(true);
    const manifest = (await manifestResponse.json()) as {
      animations: { key: string; url: string; frames: number }[];
    };
    expect(manifest.animations).toHaveLength(character.animationCount);

    for (const path of character.staticPaths) {
      const response = await request.get(path);
      expect(response.ok(), path).toBe(true);
    }

    await page.goto('/');
    const result = await page.evaluate(
      async ({ animationUrls, staticUrls }: { animationUrls: string[]; staticUrls: string[] }) => {
        async function load(url: string): Promise<HTMLImageElement> {
          const image = new Image();
          image.src = url;
          await image.decode();
          return image;
        }

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('2D canvas context is unavailable');

        const animations: {
          key: string;
          width: number;
          height: number;
          nonTransparentPixels: number[];
        }[] = [];
        for (const url of animationUrls) {
          const image = await load(url);
          const nonTransparentPixels: number[] = [];
          for (let frame = 0; frame < 4; frame += 1) {
            context.clearRect(0, 0, 256, 256);
            context.drawImage(image, frame * 256, 0, 256, 256, 0, 0, 256, 256);
            const pixels = context.getImageData(0, 0, 256, 256).data;
            let opaque = 0;
            for (let index = 3; index < pixels.length; index += 4) {
              if ((pixels[index] ?? 0) > 0) opaque += 1;
            }
            nonTransparentPixels.push(opaque);
          }
          animations.push({
            key: url,
            width: image.naturalWidth,
            height: image.naturalHeight,
            nonTransparentPixels,
          });
        }

        const statics: { url: string; width: number; height: number }[] = [];
        for (const url of staticUrls) {
          const image = await load(url);
          statics.push({ url, width: image.naturalWidth, height: image.naturalHeight });
        }
        return { animations, statics };
      },
      {
        animationUrls: manifest.animations.map((animation) => animation.url),
        staticUrls: [...character.staticPaths],
      },
    );

    for (const animation of result.animations) {
      expect(animation.width, animation.key).toBe(1024);
      expect(animation.height, animation.key).toBe(256);
      for (const [frame, opaque] of animation.nonTransparentPixels.entries()) {
        expect(opaque, `${animation.key} frame ${frame}`).toBeGreaterThan(0);
      }
    }
    for (const image of result.statics) {
      expect(image.width, image.url).toBe(256);
      expect(image.height, image.url).toBe(256);
    }
  });
}
