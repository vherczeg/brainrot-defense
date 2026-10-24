import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { buildServiceWorkerSource } from './scripts/serviceWorkerTemplate';

async function listFiles(directory: string, rootDirectory = directory): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath, rootDirectory)));
    } else if (entry.isFile()) {
      files.push(relative(rootDirectory, fullPath));
    }
  }
  return files;
}

function normalizeBase(base: string): string {
  if (!base) return './';
  return base.endsWith('/') ? base : `${base}/`;
}

function serviceWorkerPlugin(): Plugin {
  let root = process.cwd();
  let outDir = resolve(root, 'dist');
  let base = '/';

  return {
    name: 'brainrot-service-worker',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = resolve(root, config.build.outDir);
      base = config.base;
    },
    async closeBundle() {
      const files = (await listFiles(outDir))
        .map((file) => file.split(sep).join('/'))
        .filter((file) => file !== 'sw.js' && !file.endsWith('.map'))
        .sort();
      const hash = createHash('sha256');
      hash.update('brainrot-service-worker');
      hash.update(buildServiceWorkerSource.toString());
      for (const file of files) {
        hash.update(file);
        hash.update('\0');
        hash.update(await readFile(resolve(outDir, file)));
        hash.update('\0');
      }
      const version = hash.digest('hex').slice(0, 12);
      const normalizedBase = normalizeBase(base);
      const source = buildServiceWorkerSource({
        version,
        precache: [normalizedBase, ...files.map((file) => `${normalizedBase}${file}`)],
        indexUrl: `${normalizedBase}index.html`,
        baseUrl: normalizedBase,
      });
      await writeFile(resolve(outDir, 'sw.js'), source, 'utf8');
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorkerPlugin()],
  base: process.env.VITE_BASE_PATH ?? '/',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
