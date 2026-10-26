/* global console, process, window */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const outDir = 'docs/green-venom-falcon/qa';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('requestfailed', (request) => errors.push(`request failed: ${request.url()}`));

await page.route('**/src/main.tsx*', async (route) => {
  const response = await route.fetch();
  const source = (await response.text()).replace(
    'const controller = new GameController(',
    'const controller = window.__qaController = new GameController(',
  );
  await route.fulfill({ response, body: source });
});
await page.route('**/src/components/BattlefieldView.tsx*', async (route) => {
  const response = await route.fetch();
  const source = (await response.text()).replace(
    /const game = new (\w+)\.Game\(/,
    'const game = window.__qaGame = new $1.Game(',
  );
  await route.fulfill({ response, body: source });
});

await page.goto(process.env.FALCON_QA_URL ?? 'http://127.0.0.1:5174/');
await page.getByTestId('menu-continue').click();
const dismiss = page.getByTestId('tutorial-dismiss');
if (await dismiss.isVisible()) await dismiss.click();

await page.waitForFunction(() =>
  window.__qaGame?.scene.getScene('BattleScene')?.textures.exists('gvf-idle'),
);

await page.evaluate(() => {
  const controller = window.__qaController;
  controller.profile = {
    ...controller.profile,
    coins: 9999,
    currentWave: 20,
    unlockedWave: 20,
    completedWaves: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    settings: {
      ...controller.profile.settings,
      battleSpeed: 1,
      soundEnabled: false,
      reducedMotion: false,
    },
    characters: [
      { id: 'qa-falcon-1', typeId: 'laser-crocodile', mergeRank: 7, totalXp: 0, col: 0, row: 4 },
      { id: 'qa-falcon-2', typeId: 'laser-crocodile', mergeRank: 7, totalXp: 0, col: 5, row: 4 },
    ],
  };
  controller.prepVersion += 1;
  controller.emit();
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/00-preparation.png`, fullPage: true });

async function freezeScene() {
  await page.evaluate(() => {
    const controller = window.__qaController;
    const scene = window.__qaGame.scene.getScene('BattleScene');
    controller.stopBattleLoop();
    if (!window.__qaOriginalSyncClock) {
      window.__qaOriginalSyncClock = scene.syncAnimationClock.bind(scene);
    }
    scene.syncAnimationClock = () => {};
    scene.anims.globalTimeScale = 0;
    scene.tweens.timeScale = 0;
    scene.time.timeScale = 0;
  });
  await page.waitForTimeout(140);
}

async function resumeScene() {
  await page.evaluate(() => {
    const controller = window.__qaController;
    const scene = window.__qaGame.scene.getScene('BattleScene');
    if (window.__qaOriginalSyncClock) {
      scene.syncAnimationClock = window.__qaOriginalSyncClock;
      delete window.__qaOriginalSyncClock;
    }
    scene.anims.globalTimeScale = 1;
    scene.tweens.timeScale = 1;
    scene.time.timeScale = 1;
    controller.lastFrameTime = 0;
    controller.startBattleLoop();
  });
}

async function freezeAndShot(name, settleMs = 80) {
  if (settleMs > 0) await page.waitForTimeout(settleMs);
  await freezeScene();
  await shot(name);
  await resumeScene();
}

async function shot(name) {
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  console.log('captured', `${outDir}/${name}.png`);
}

async function waitFor(condition, timeout = 40_000) {
  await page.waitForFunction(condition, undefined, { timeout, polling: 50 });
}

await page.getByTestId('battle-button').click();
await page.waitForTimeout(420);
await freezeScene();
await shot('01-earthquake-entrance');
await resumeScene();

await waitFor(() => {
  const state = window.__qaController.session?.getState();
  const boss = state?.units.find((unit) => unit.typeId === 'green-venom-falcon');
  return Boolean(boss?.spinShield?.active && boss.spinShield.shielded);
});
await freezeScene();
await shot('04-spin-shield-full-speed');
await resumeScene();

await waitFor(() => {
  const scene = window.__qaGame.scene.getScene('BattleScene');
  const view = [...scene.unitViews.values()].find((entry) => entry.typeId === 'green-venom-falcon');
  return view?.action === 'poison';
});
await freezeAndShot('03-poison-spit', 0);

await waitFor(() => {
  const scene = window.__qaGame.scene.getScene('BattleScene');
  const view = [...scene.unitViews.values()].find((entry) => entry.typeId === 'green-venom-falcon');
  return view?.action === 'attack';
});
await freezeAndShot('02-claw-attack', 0);

await waitFor(() => {
  const state = window.__qaController.session?.getState();
  const boss = state?.units.find((unit) => unit.typeId === 'green-venom-falcon');
  return Boolean(boss?.spinShield?.active && !boss.spinShield.shielded);
});
await freezeAndShot('05-spin-shield-broken');

await page.waitForTimeout(1600);
await freezeAndShot('07-battle-overview', 0);

await waitFor(() => {
  const state = window.__qaController.session?.getState();
  return Boolean(state && state.units.every((unit) => unit.team !== 'enemy' || !unit.alive));
}, 60_000);
await page.waitForTimeout(260);
await freezeScene();
await shot('06-boss-defeat');
await resumeScene();

if (errors.length > 0) {
  console.error('QA errors:', errors);
  process.exitCode = 1;
} else {
  console.log('Green Venom Falcon QA screenshots captured without page errors.');
}
await browser.close();
