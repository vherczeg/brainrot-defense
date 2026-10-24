import { expect, test } from '@playwright/test';
import { openAccessiblePlacement, startGame } from './helpers';

function envelope(profile: Record<string, unknown>, schemaVersion: number) {
  return {
    format: 'brainrot-defense-save',
    appId: 'brainrot-defense',
    schemaVersion,
    exportedAt: new Date().toISOString(),
    profile,
  };
}

test('imports an old M0.1 save, maps level to rank, and starts every unit at level 1', async ({
  page,
}) => {
  await startGame(page);
  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-save').click();

  await page.getByTestId('import-save-input').setInputFiles({
    name: 'regi-mentes.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify(
        envelope(
          {
            profileId: 'legacy-e2e',
            name: 'Régi Ábel',
            coins: 777,
            currentWave: 4,
            unlockedWave: 5,
            completedWaves: [1, 2, 3],
            characters: [
              { id: 'unit-1', typeId: 'laser-crocodile', level: 7, col: 0, row: 3 },
              { id: 'unit-2', typeId: 'lightning-scorpion', level: 10, col: 1, row: 3 },
            ],
            upgrades: {},
            settings: { soundEnabled: true, reducedMotion: true, battleSpeed: 1 },
            tutorialSeen: true,
            nextCharacterId: 3,
            createdAt: 1,
            lastSavedAt: 2,
          },
          1,
        ),
      ),
    ),
  });
  await expect(page.getByTestId('import-confirm-modal')).toBeVisible();
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
  await expect(page.locator('.game-topbar__title h1')).toContainText('4. hullám');
  await expect(page.getByTestId('coins-value')).toHaveAttribute('data-coins', '777');

  await openAccessiblePlacement(page);
  await page.getByTestId('accessible-unit-unit-1').click();
  await expect(page.getByTestId('inspector-rank')).toHaveText('7 / 10');
  await expect(page.getByTestId('inspector-level')).toHaveText('1');
  await expect(page.getByTestId('inspector-xp')).toHaveText('0');
  await page.getByTestId('accessible-unit-unit-2').click();
  await expect(page.getByTestId('inspector-rank')).toHaveText('10 / 10');
  await expect(page.getByTestId('inspector-level')).toHaveText('1');
});

test('merges two units with different XP levels and persists the combined progression', async ({
  page,
}) => {
  await startGame(page);
  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-save').click();

  await page.getByTestId('import-save-input').setInputFiles({
    name: 'kombinalt.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify(
        envelope(
          {
            profileId: 'merge-xp-e2e',
            name: 'Egyesítő',
            coins: 500,
            currentWave: 1,
            unlockedWave: 1,
            completedWaves: [],
            characters: [
              {
                id: 'unit-1',
                typeId: 'laser-crocodile',
                mergeRank: 3,
                totalXp: 3025,
                col: 0,
                row: 3,
              },
              {
                id: 'unit-2',
                typeId: 'laser-crocodile',
                mergeRank: 3,
                totalXp: 1225,
                col: 1,
                row: 3,
              },
            ],
            upgrades: {},
            settings: { soundEnabled: true, reducedMotion: true, battleSpeed: 1 },
            tutorialSeen: true,
            nextCharacterId: 3,
            createdAt: 1,
            lastSavedAt: 2,
          },
          2,
        ),
      ),
    ),
  });
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();

  await openAccessiblePlacement(page);
  await page.getByTestId('accessible-unit-unit-1').click();
  await page.getByTestId('accessible-cell-1-3').click();

  await expect.poll(() => page.getByTestId('unit-count').getAttribute('data-count')).toBe('1');
  await expect(page.getByTestId('inspector-rank')).toHaveText('4 / 10');
  await expect(page.getByTestId('inspector-level')).toHaveText('14');
  await expect(page.getByTestId('inspector-xp')).toHaveText(/4\s*250/);
  await expect(page.getByTestId('inspector-next-level')).toContainText('Következő szintig');

  await page.reload();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.getByTestId('menu-continue').click();
  await openAccessiblePlacement(page);
  await page.getByTestId('accessible-unit-unit-3').click();
  await expect(page.getByTestId('inspector-rank')).toHaveText('4 / 10');
  await expect(page.getByTestId('inspector-level')).toHaveText('14');
});
