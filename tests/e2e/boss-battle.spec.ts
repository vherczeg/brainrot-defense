import { expect, test } from '@playwright/test';

function envelope(profile: Record<string, unknown>) {
  return {
    format: 'brainrot-defense-save',
    appId: 'brainrot-defense',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    profile,
  };
}

test('defeats the wave 10 boss and completes all waves', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop boss battle test');
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
    buffer: Buffer.from(
      JSON.stringify(
        envelope({
          profileId: 'boss-e2e',
          name: 'Boss',
          coins: 9999,
          currentWave: 10,
          unlockedWave: 10,
          completedWaves: [1, 2, 3, 4, 5, 6, 7, 8, 9],
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
        }),
      ),
    ),
  });
  await expect(page.getByTestId('import-confirm-modal')).toBeVisible();
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();

  const board = page.getByTestId('battlefield');
  await page.getByTestId('battle-button').click();
  await expect(page.getByTestId('battle-hud')).toBeVisible();
  await page.waitForTimeout(800);
  await board.screenshot({ path: '/tmp/opencode/boss_0.png' });
  await expect(page.getByTestId('result-overlay')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('result-title')).toContainText('MINDEN HULLÁMOT TELJESÍTETTÉL');
});
