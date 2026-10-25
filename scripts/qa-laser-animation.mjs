/* global console, process, window, document, setTimeout, performance */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
// Fresh browser profile; instrumentation exists only in test responses.
fs.mkdirSync('test-results/laser-animation', { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [],
  failed = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('requestfailed', (r) => failed.push(r.url()));
await page.route('**/src/main.tsx*', async (route) => {
  const r = await route.fetch();
  let s = await r.text();
  s = s.replace(
    'const controller = new GameController(',
    'const controller = window.__qaController = new GameController(',
  );
  console.log('instrumented', route.request().url(), s.includes('window.__qa'));
  await route.fulfill({ response: r, body: s });
});
await page.route('**/src/components/BattlefieldView.tsx*', async (route) => {
  const r = await route.fetch();
  let s = await r.text();
  s = s.replace(/const game = new (\w+)\.Game\(/, 'const game = window.__qaGame = new $1.Game(');
  console.log('instrumented', route.request().url(), s.includes('window.__qa'));
  await route.fulfill({ response: r, body: s });
});
await page.goto(process.env.LASER_QA_URL ?? 'http://127.0.0.1:5174/');
await page.getByTestId('menu-continue').click();
const dismiss = page.getByTestId('tutorial-dismiss');
if (await dismiss.isVisible()) await dismiss.click();
try {
  await page.waitForFunction(() =>
    window.__qaGame?.scene.getScene('BattleScene')?.textures.exists('lc-v3-death'),
  );
} catch (e) {
  console.log(
    'BOOT ERRORS',
    errors,
    failed,
    await page.evaluate(() => ({
      controller: !!window.__qaController,
      game: !!window.__qaGame,
      phase: window.__qaController?.getSnapshot().phase,
    })),
  );
  throw e;
}
await page.evaluate(() => {
  const c = window.__qaController;
  c.profile = {
    ...c.profile,
    coins: 1000,
    characters: [1, 4, 8].map((rank, i) => ({
      id: `qa-${i}`,
      typeId: 'laser-crocodile',
      mergeRank: rank,
      totalXp: 0,
      col: i + 1,
      row: 4,
    })),
  };
  c.prepVersion++;
  c.emit();
});
await page.waitForTimeout(300);
await page.screenshot({ path: 'test-results/laser-animation/desktop.png', fullPage: true });
await page.evaluate(() => {
  const c = window.__qaController;
  c.startBattle();
  c.stopBattleLoop();
});
await page.waitForTimeout(200);
const result = await page.evaluate(async () => {
  const c = window.__qaController,
    s = window.__qaGame.scene.getScene('BattleScene');
  c.stopBattleLoop();
  const views = [...s.unitViews.entries()].filter(([, v]) => v.typeId === 'laser-crocodile');
  for (const [, v] of views) {
    v.laserRelease?.cancel();
    v.laserRelease = null;
    v.action = null;
    if (v.actionHandler) {
      v.sprite.off(v.actionHandler.event, v.actionHandler.handler);
      v.actionHandler = null;
    }
    v.sprite.play(v.visual.animationKey('idle'));
  }
  const traces = [];
  const original = s.spawnProjectileAttack.bind(s);
  s.spawnProjectileAttack = (from, to, ...rest) => {
    const v = s.unitViews.get(window.__qaAttacker);
    traces.push({
      frame: v?.sprite?.anims.currentFrame?.textureFrame,
      index: v?.sprite?.anims.currentFrame?.index,
      from,
      to,
      flip: v?.sprite?.flipX,
    });
    return original(from, to, ...rest);
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const [id, v] of views) {
    window.__qaAttacker = id;
    const u = c.session.state.units.find((u) => u.id === id),
      target = c.session.state.units.find((u) => u.team === 'enemy');
    s.playBattleEvent({
      type: 'attack',
      attackerId: id,
      targetId: target.id,
      kind: 'laser',
      from: { x: u.x, y: u.y },
      to: { x: u.x - 1, y: u.y - 2 },
    });
    const deadline = performance.now() + 10000;
    const expected = views.findIndex(([vId]) => vId === id) + 1;
    while ((traces.length < expected || v.action !== null) && performance.now() < deadline)
      await wait(25);
  }
  return {
    traces,
    views: views.map(([id, v]) => ({
      id,
      key: v.sprite.anims.currentAnim.key,
      visible: v.container.visible,
    })),
    animations: s.anims.anims.entries
      ? Object.keys(s.anims.anims.entries).filter((k) => k.startsWith('lc-')).length
      : 0,
  };
});
console.log(JSON.stringify(result));
assert.equal(result.traces.length, 3, 'three tiers must each release one shot');
for (const t of result.traces) {
  assert.equal(Number(t.frame), 2, 'release must match third texture frame');
  assert.equal(t.flip, true);
}
const hurtPriority = await page.evaluate(async () => {
  const c = window.__qaController,
    s = window.__qaGame.scene.getScene('BattleScene');
  const [id, v] = [...s.unitViews.entries()].find(([, v]) => v.typeId === 'laser-crocodile');
  const shots = [],
    hurt = [];
  const original = s.spawnProjectileAttack.bind(s);
  s.spawnProjectileAttack = (...args) => {
    shots.push({
      frame: v.sprite.anims.currentFrame.textureFrame,
      flip: v.sprite.flipX,
      origin: args[0],
      baseX: v.container.x,
    });
    return original(...args);
  };
  v.sprite.on('animationstart', (a) => {
    if (a.key.endsWith('-hurt')) hurt.push(a.key);
  });
  const u = c.session.state.units.find((u) => u.id === id);
  s.playBattleEvent({
    type: 'attack',
    attackerId: id,
    targetId: 'test',
    kind: 'laser',
    from: { x: u.x, y: u.y },
    to: { x: u.x + 1, y: u.y - 1 },
  });
  s.playBattleEvent({
    type: 'damage',
    unitId: id,
    amount: 1,
    hp: u.hp - 1,
    maxHp: u.maxHp,
    at: { x: u.x, y: u.y },
  });
  const queued = v.pendingHurt && v.action === 'attack' && shots.length === 0;
  const deadline = performance.now() + 10000;
  while ((!shots.length || v.action !== null) && performance.now() < deadline)
    await new Promise((r) => setTimeout(r, 25));
  return { queued, shots, hurt };
});
assert.equal(hurtPriority.queued, true);
assert.equal(hurtPriority.shots.length, 1);
assert.equal(Number(hurtPriority.shots[0].frame), 2);
assert.equal(hurtPriority.shots[0].flip, false);
assert.ok(hurtPriority.shots[0].origin.px > hurtPriority.shots[0].baseX);
assert.equal(hurtPriority.hurt.length, 1);
const immediatePause = await page.evaluate(() => {
  const c = window.__qaController;
  c.stopBattleLoop();
  c.togglePause();
  c.stopBattleLoop();
  const s = window.__qaGame.scene.getScene('BattleScene');
  return [s.anims.globalTimeScale, s.tweens.timeScale, s.time.timeScale];
});
assert.deepEqual(immediatePause, [0, 0, 0]);
await page.waitForTimeout(100);
const before = await page.evaluate(() => {
  const s = window.__qaGame.scene.getScene('BattleScene');
  return [...s.unitViews.values()]
    .filter((v) => v.typeId === 'laser-crocodile')
    .map((v) => v.sprite.anims.currentFrame.textureFrame);
});
await page.waitForTimeout(300);
const after = await page.evaluate(() => {
  const s = window.__qaGame.scene.getScene('BattleScene');
  return [...s.unitViews.values()]
    .filter((v) => v.typeId === 'laser-crocodile')
    .map((v) => v.sprite.anims.currentFrame.textureFrame);
});
assert.deepEqual(after, before, 'paused frames must stay fixed');
const lifecycle = await page.evaluate(async () => {
  const c = window.__qaController,
    s = window.__qaGame.scene.getScene('BattleScene');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  c.togglePause();
  c.stopBattleLoop();
  c.setBattleSpeed(2);
  c.stopBattleLoop();
  await wait(200);
  const scales = [s.anims.globalTimeScale, s.tweens.timeScale, s.time.timeScale];
  const views = [...s.unitViews.entries()].filter(([, v]) => v.typeId === 'laser-crocodile');
  const deaths = [],
    deathFrames = {};
  for (const [id, v] of views) {
    v.sprite.on('animationstart', (a) => {
      if (a.key.endsWith('-death')) deaths.push(a.key);
    });
    v.sprite.on('animationupdate', (a, f) => {
      if (a.key.endsWith('-death')) (deathFrames[id] ??= []).push(f.textureFrame);
    });
  }
  c.session.state = {
    ...c.session.state,
    units: c.session.state.units.map((u) =>
      u.team === 'ally' ? { ...u, alive: false, hp: 0 } : u,
    ),
  };
  let deadline = performance.now() + 10000;
  while (views.some(([, v]) => v.alive) && performance.now() < deadline) await wait(25);
  const started = views.map(([, v]) => v.sprite.anims.currentAnim.key);
  for (const [id] of views)
    s.playBattleEvent({
      type: 'damage',
      unitId: id,
      amount: 1,
      hp: 0,
      maxHp: 1,
      at: { x: 1, y: 1 },
    });
  const afterHurt = views.map(([, v]) => v.sprite.anims.currentAnim.key);
  while (views.some(([, v]) => v.container.visible) && performance.now() < deadline) await wait(25);
  const hidden = views.every(([, v]) => !v.container.visible);
  s.clearUnitViews();
  c.session.state = {
    ...c.session.state,
    units: c.session.state.units.map((u) =>
      u.team === 'ally' ? { ...u, alive: true, hp: u.maxHp } : u,
    ),
  };
  await wait(200);
  c.profile = { ...c.profile, settings: { ...c.profile.settings, reducedMotion: true } };
  c.emit();
  c.session.state = {
    ...c.session.state,
    units: c.session.state.units.map((u) =>
      u.team === 'ally' ? { ...u, alive: false, hp: 0 } : u,
    ),
  };
  await wait(200);
  const reducedHidden = [...s.unitViews.values()]
    .filter((v) => v.typeId === 'laser-crocodile')
    .every((v) => !v.container.visible);
  return { scales, deaths, started, afterHurt, deathFrames, hidden, reducedHidden };
});
assert.deepEqual(lifecycle.scales, [2, 2, 2]);
assert.equal(lifecycle.deaths.length, 3);
assert.deepEqual(lifecycle.started, lifecycle.afterHurt, 'hurt must not interrupt defeat');
assert.equal(lifecycle.hidden, true);
assert.equal(lifecycle.reducedHidden, true);
await page.evaluate(() => window.__qaController.surrenderBattle());
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(500);
await page.screenshot({ path: 'test-results/laser-animation/mobile.png', fullPage: true });
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth,
);
assert.equal(overflow, false, 'mobile page should not overflow');
fs.writeFileSync(
  'test-results/laser-animation/runtime.json',
  JSON.stringify(
    { result, hurtPriority, immediatePause, paused: true, lifecycle, overflow, errors, failed },
    null,
    2,
  ),
);
assert.deepEqual(errors, []);
assert.deepEqual(failed, []);
await browser.close();
console.log(
  'Runtime release, tiers, facing, pause/speed, death and reduced motion, mobile layout: PASS',
);
