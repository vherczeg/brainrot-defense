import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

console.log(
  `Build asset verification passed: ${assets.length} index assets, ${manifest.icons?.length ?? 0} manifest icons, versioned service worker.`,
);
