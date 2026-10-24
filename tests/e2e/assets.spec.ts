import { expect, test } from '@playwright/test';

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
});
