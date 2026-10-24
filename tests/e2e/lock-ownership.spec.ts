import { expect, test, type Page } from '@playwright/test';
import { startGame } from './helpers';

async function readActiveProfile(page: Page): Promise<{ profileId: string; coins: number }> {
  return page.evaluate(async () => {
    const request = indexedDB.open('brainrot-defense');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction('meta', 'readonly');
    const active = await new Promise<{ value?: string } | undefined>((resolve, reject) => {
      const requestActive = transaction.objectStore('meta').get('activeProfileId');
      requestActive.onsuccess = () =>
        resolve(requestActive.result as { value?: string } | undefined);
      requestActive.onerror = () => reject(requestActive.error);
    });
    const profileId = active?.value ?? '';
    const profileTransaction = db.transaction('profiles', 'readonly');
    const record = await new Promise<{ payload: { profileId: string; coins: number } } | undefined>(
      (resolve, reject) => {
        const requestRecord = profileTransaction.objectStore('profiles').get(profileId);
        requestRecord.onsuccess = () =>
          resolve(requestRecord.result as { payload: { profileId: string; coins: number } });
        requestRecord.onerror = () => reject(requestRecord.error);
      },
    );
    db.close();
    return record?.payload ?? { profileId, coins: 0 };
  });
}

test('a failed same-ID import keeps the active profile Web Lock', async ({ context, page }) => {
  await startGame(page);
  const profile = await readActiveProfile(page);

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByTestId('error-screen')).toBeVisible();

  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-save').click();
  await expect(page.getByTestId('save-modal')).toBeVisible();

  await page.evaluate(() => {
    const storePrototype = IDBObjectStore.prototype;
    const originalPut = storePrototype.put;
    let failed = false;
    storePrototype.put = function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      if (!failed && this.name === 'profiles') {
        failed = true;
        throw new DOMException('forced profile write failure', 'AbortError');
      }
      return originalPut.apply(this, args);
    };
  });

  const envelope = {
    format: 'brainrot-defense-save',
    appId: 'brainrot-defense',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    profile: { ...profile, coins: 4321, lastSavedAt: Date.now() },
  };
  await page.getByTestId('import-save-input').setInputFiles({
    name: 'same-id-failure.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(envelope)),
  });
  await expect(page.getByTestId('import-confirm-modal')).toBeVisible();
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('toast')).toContainText('sikertelen');

  await second.reload();
  await expect(second.getByTestId('error-screen')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
});
