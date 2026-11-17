import { expect, test, type Page } from '@playwright/test';

function envelope(profile: Record<string, unknown>) {
  return {
    format: 'brainrot-defense-save',
    appId: 'brainrot-defense',
    schemaVersion: 4,
    exportedAt: new Date().toISOString(),
    profile,
  };
}

function armyProfile(overrides: Record<string, unknown> = {}) {
  return {
    profileId: 'campaign100-e2e',
    name: 'Kampány',
    coins: 999999,
    characters: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((index) => ({
      id: `unit-${index + 1}`,
      typeId: index < 8 ? 'laser-crocodile' : 'lightning-scorpion',
      mergeRank: 10,
      totalXp: 100000,
      col: index % 6,
      row: index < 6 ? 3 : 4,
    })),
    upgrades: { 'army-attack': 12, 'army-hp': 12 },
    settings: { soundEnabled: false, reducedMotion: true, battleSpeed: 2, difficulty: 'normal' },
    tutorialSeen: true,
    nextCharacterId: 13,
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
    name: 'campaign.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(envelope(profile))),
  });
  await expect(page.getByTestId('import-confirm-modal')).toBeVisible();
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
}

test('shows all four difficulty options in the selector', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop UI verification');
  await importProfile(page, armyProfile({ currentWave: 1, unlockedWave: 1, completedWaves: [] }));

  await expect(page.getByTestId('difficulty-easy')).toBeVisible();
  await expect(page.getByTestId('difficulty-normal')).toBeVisible();
  await expect(page.getByTestId('difficulty-hard')).toBeVisible();
  await expect(page.getByTestId('difficulty-extreme')).toBeVisible();

  await page.getByTestId('difficulty-easy').click();
  await expect(page.getByTestId('difficulty-easy')).toHaveAttribute('aria-pressed', 'true');
});

test('offers the army upgrade shop and purchases a level', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop upgrade shop verification');
  await importProfile(
    page,
    armyProfile({
      currentWave: 30,
      unlockedWave: 30,
      completedWaves: Array.from({ length: 29 }, (_, index) => index + 1),
    }),
  );

  await expect(page.getByTestId('upgrade-army-attack')).toBeVisible();
  await expect(page.getByTestId('upgrade-army-hp')).toBeVisible();

  await page.getByTestId('upgrade-buy-army-attack').click();
  await expect(page.getByTestId('upgrade-army-attack')).toContainText('13. szint');
});

test('shows the chapter and modifier on the wave preview', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop wave preview verification');
  await importProfile(
    page,
    armyProfile({
      currentWave: 35,
      unlockedWave: 35,
      completedWaves: Array.from({ length: 34 }, (_, index) => index + 1),
    }),
  );

  await expect(page.locator('.wave-preview .panel-label')).toContainText('4. fejezet');
  await expect(page.getByTestId('wave-modifier')).toBeVisible();
});

test('announces a deterministic surprise boss on its wave', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop surprise boss verification');
  // Profile 'surprise-e2e' deterministically gets a surprise boss on wave 16.
  await importProfile(
    page,
    armyProfile({
      profileId: 'surprise-e2e',
      currentWave: 16,
      unlockedWave: 16,
      completedWaves: Array.from({ length: 15 }, (_, index) => index + 1),
    }),
  );

  await expect(page.locator('.wave-preview .boss-chip')).toContainText('MEGLEPETÉS');
  await expect(page.locator('.wave-preview')).toContainText('Rém Álomlepke');
});

test('defeats the wave 100 Mega Chaos King and finishes the campaign', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop finale verification');
  await importProfile(
    page,
    armyProfile({
      currentWave: 100,
      unlockedWave: 100,
      completedWaves: Array.from({ length: 99 }, (_, index) => index + 1),
    }),
  );

  await expect(page.locator('.wave-preview')).toContainText('Mega Káosz Király');
  await page.getByTestId('battle-button').click();
  await expect(page.getByTestId('battle-hud')).toBeVisible();
  await expect(page.getByTestId('result-overlay')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('result-title')).toContainText('MINDEN HULLÁMOT TELJESÍTETTÉL');
  await expect(page.getByTestId('result-overlay')).toContainText('+5000');
});
