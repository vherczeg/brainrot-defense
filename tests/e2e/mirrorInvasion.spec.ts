import { expect, test } from '@playwright/test';

function envelope(profile: Record<string, unknown>) {
  return {
    format: 'brainrot-defense-save',
    appId: 'brainrot-defense',
    schemaVersion: 4,
    exportedAt: new Date().toISOString(),
    profile,
  };
}

test('buys expansion cells and shows the mirror invasion tradeoff', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'desktop expansion purchase test');
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  const profile = {
    profileId: 'mirror-e2e',
    name: 'Tükör',
    coins: 500000,
    currentWave: 22,
    unlockedWave: 22,
    completedWaves: Array.from({ length: 21 }, (_, i) => i + 1),
    characters: [
      { id: 'unit-1', typeId: 'laser-crocodile', mergeRank: 8, totalXp: 50000, col: 0, row: 3 },
      { id: 'unit-2', typeId: 'armored-rhino', mergeRank: 8, totalXp: 50000, col: 1, row: 3 },
    ],
    defeatXpCounts: Array.from({ length: 100 }, () => 0),
    upgrades: { 'army-attack': 5, 'army-hp': 5 },
    expansionCells: 0,
    settings: { soundEnabled: false, reducedMotion: false, battleSpeed: 2, difficulty: 'normal' },
    tutorialSeen: true,
    nextCharacterId: 3,
    createdAt: 1,
    lastSavedAt: 2,
  };

  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await page.getByTestId('menu-continue').click();
  const dismiss = page.getByTestId('tutorial-dismiss');
  if (await dismiss.isVisible()) await dismiss.click();

  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-save').click();
  await page.getByTestId('import-save-input').setInputFiles({
    name: 'mirror.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(envelope(profile))),
  });
  await expect(page.getByTestId('import-confirm-modal')).toBeVisible();
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();

  // The expansion block shows the tradeoff before any purchase.
  await expect(page.getByTestId('expansion-block')).toBeVisible();
  await expect(page.getByTestId('expansion-count')).toContainText('0/6');
  await expect(page.getByTestId('expansion-mirror')).toContainText('+0');

  // First purchase: 10,000 gold, one cell, mirror +1.
  await page.getByTestId('expansion-buy').click();
  await expect(page.getByTestId('expansion-count')).toContainText('1/6');
  await expect(page.getByTestId('expansion-mirror')).toContainText('+1');
  await expect(page.getByTestId('coins-value')).toHaveAttribute('data-coins', '490000');

  // Second purchase: 20,000 gold.
  await page.getByTestId('expansion-buy').click();
  await expect(page.getByTestId('expansion-count')).toContainText('2/6');
  await expect(page.getByTestId('coins-value')).toHaveAttribute('data-coins', '470000');

  expect(consoleErrors, 'no runtime console errors').toEqual([]);
});
