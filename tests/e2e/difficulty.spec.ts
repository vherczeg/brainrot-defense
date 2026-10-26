import { expect, test, type Page } from '@playwright/test';
import { startGame } from './helpers';

function legacyWave20Envelope() {
  return {
    format: 'brainrot-defense-save',
    appId: 'brainrot-defense',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    profile: {
      profileId: 'wave20-hard-e2e',
      name: 'Viktor',
      coins: 500,
      currentWave: 20,
      unlockedWave: 20,
      completedWaves: Array.from({ length: 19 }, (_, index) => index + 1),
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
    },
  };
}

async function importWave20(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.getByTestId('menu-continue').click();
  const tutorial = page.getByTestId('tutorial-dismiss');
  if (await tutorial.isVisible()) await tutorial.click();

  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-save').click();
  await page.getByTestId('import-save-input').setInputFiles({
    name: 'wave20-v2.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(legacyWave20Envelope())),
  });
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
}

test('selects Hard in preparation, persists it after reload, and locks it during battle', async ({
  page,
}) => {
  await startGame(page);
  const selector = page.getByTestId('difficulty-selector');
  await expect(selector).toBeVisible();
  await expect(page.getByTestId('difficulty-normal')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('difficulty-hard')).toHaveAttribute('aria-pressed', 'false');

  await page.getByTestId('difficulty-hard').click();
  await expect(page.getByTestId('difficulty-hard')).toHaveAttribute('aria-pressed', 'true');
  await expect(selector).toContainText(
    'Nehéz mód: az ellenfeleknek +40% életereje és +20% támadóereje van.',
  );

  await page.reload();
  await page.getByTestId('menu-continue').click();
  const tutorial = page.getByTestId('tutorial-dismiss');
  if (await tutorial.isVisible()) await tutorial.click();
  await expect(page.getByTestId('difficulty-hard')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('battle-button').click();
  await expect(page.getByTestId('battle-difficulty')).toContainText('Nehéz');
  await expect(page.getByTestId('difficulty-selector')).toHaveCount(0);
  await expect(page.getByTestId('battle-difficulty')).toContainText('Nehéz');
});

test('opens an existing v2 wave-20 save as Normal, switches to Hard, and beats the Falcon', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop boss/difficulty verification');
  await importWave20(page);

  await expect(page.locator('.game-topbar__title h1')).toContainText('20. hullám');
  await expect(page.getByTestId('difficulty-normal')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('difficulty-hard').click();
  await expect(page.getByTestId('difficulty-hard')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('coins-value')).toHaveAttribute('data-coins', '500');

  await page.getByTestId('battle-button').click();
  await expect(page.getByTestId('battle-hud')).toBeVisible();
  await expect(page.getByTestId('battle-difficulty')).toContainText('Nehéz');
  await expect(page.getByTestId('result-overlay')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('result-title')).toContainText('MINDEN HULLÁMOT TELJESÍTETTÉL');
  await expect(page.getByTestId('result-difficulty')).toContainText('Nehéz');
  await expect(page.getByTestId('result-overlay')).toContainText('+1200');
});
