import { expect, test, type Page } from '@playwright/test';

function envelope(profile: Record<string, unknown>) {
  return {
    format: 'brainrot-defense-save',
    appId: 'brainrot-defense',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    profile,
  };
}

function maxArmyProfile(overrides: Record<string, unknown> = {}) {
  return {
    profileId: 'boss-e2e',
    name: 'Boss',
    coins: 9999,
    characters: [0, 1, 2, 3, 4, 5].map((col) => ({
      id: `unit-${col + 1}`,
      typeId: 'laser-crocodile',
      mergeRank: 10,
      totalXp: 0,
      col,
      row: 4,
    })),
    upgrades: {},
    settings: { soundEnabled: true, reducedMotion: false, battleSpeed: 2 },
    tutorialSeen: true,
    nextCharacterId: 7,
    createdAt: 1,
    lastSavedAt: 2,
    ...overrides,
  };
}

async function importProfile(page: Page, profile: Record<string, unknown>): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.getByTestId('menu-continue').click();
  const dismiss = page.getByTestId('tutorial-dismiss');
  if (await dismiss.isVisible()) await dismiss.click();

  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-save').click();
  await page.getByTestId('import-save-input').setInputFiles({
    name: 'boss.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(envelope(profile))),
  });
  await expect(page.getByTestId('import-confirm-modal')).toBeVisible();
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
}

test('defeats the wave 10 boss and opens wave 11', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop boss battle test');
  await importProfile(
    page,
    maxArmyProfile({
      profileId: 'boss10-e2e',
      currentWave: 10,
      unlockedWave: 10,
      completedWaves: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    }),
  );

  await page.getByTestId('battle-button').click();
  await expect(page.getByTestId('battle-hud')).toBeVisible();
  await expect(page.getByTestId('result-overlay')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('result-overlay')).toContainText('+600');
  await expect(page.getByTestId('result-first-bonus')).toContainText('+300');

  await page.getByTestId('result-next').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
  await expect(page.locator('.game-topbar h1')).toContainText('11. hullám');
});

test('defeats the Green Venom Falcon on wave 20 and completes all waves', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop boss battle test');
  await importProfile(
    page,
    maxArmyProfile({
      profileId: 'boss20-e2e',
      currentWave: 20,
      unlockedWave: 20,
      completedWaves: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    }),
  );

  const board = page.getByTestId('battlefield');
  await page.getByTestId('battle-button').click();
  await expect(page.getByTestId('battle-hud')).toBeVisible();
  await expect(page.getByTestId('result-overlay')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('result-title')).toContainText('MINDEN HULLÁMOT TELJESÍTETTÉL');
  await expect(page.getByTestId('result-overlay')).toContainText('+3000');
  await expect(page.getByTestId('result-first-bonus')).toContainText('+1500');
  await board.screenshot({ path: '/tmp/opencode/boss20_0.png' });

  await page.getByTestId('result-next').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
  await page.getByTestId('battle-button').click();
  await expect(page.getByTestId('battle-hud')).toBeVisible();
  await expect(page.getByTestId('result-overlay')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('result-overlay')).toContainText('+1500');
  await expect(page.getByTestId('result-first-bonus')).toHaveCount(0);
});
