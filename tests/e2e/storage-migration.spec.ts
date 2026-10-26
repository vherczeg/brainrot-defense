import { expect, test, type Page } from '@playwright/test';

function checksumOf(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function legacyProfile(profileId: string, name: string) {
  return {
    profileId,
    name,
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
    createdAt: 111,
    lastSavedAt: 222,
  };
}

async function seedLegacyDatabase(
  page: Page,
  record: {
    profileId: string;
    schemaVersion: number;
    checksum: string;
    savedAt: number;
    payload: unknown;
  },
  keepConnectionOpen: boolean,
): Promise<void> {
  await page.evaluate(
    async ({ record: rawRecord, keepConnectionOpen: keepOpen }) => {
      const request = indexedDB.open('brainrot-defense', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'profileId' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (keepOpen) {
        (window as unknown as { __heldDb?: IDBDatabase }).__heldDb = db;
      }
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(['profiles', 'meta'], 'readwrite');
        transaction.objectStore('profiles').put(rawRecord);
        transaction.objectStore('meta').put({
          key: 'activeProfileId',
          value: rawRecord.profileId,
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      if (!keepOpen) db.close();
    },
    { record, keepConnectionOpen },
  );
}

async function storedState(page: Page): Promise<{
  version: number;
  activeProfileId: unknown;
  profileIds: string[];
  record: { schemaVersion: number; payload: Record<string, unknown> } | null;
  shadow: { schemaVersion: number } | null;
  tombstone: unknown;
}> {
  return page.evaluate(async () => {
    const request = indexedDB.open('brainrot-defense');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction(['profiles', 'meta'], 'readonly');
    const profiles = transaction.objectStore('profiles');
    const meta = transaction.objectStore('meta');
    const getAllKeys = new Promise<IDBValidKey[]>((resolve, reject) => {
      const requestKeys = profiles.getAllKeys();
      requestKeys.onsuccess = () => resolve(requestKeys.result);
      requestKeys.onerror = () => reject(requestKeys.error);
    });
    const active = new Promise<{ value?: unknown } | undefined>((resolve, reject) => {
      const requestActive = meta.get('activeProfileId');
      requestActive.onsuccess = () =>
        resolve(requestActive.result as { value?: unknown } | undefined);
      requestActive.onerror = () => reject(requestActive.error);
    });
    const keys = await getAllKeys;
    const firstId = keys[0] === undefined ? null : String(keys[0]);
    const record = new Promise<{ schemaVersion: number; payload: Record<string, unknown> } | null>(
      (resolve, reject) => {
        if (!firstId) {
          resolve(null);
          return;
        }
        const requestRecord = profiles.get(firstId);
        requestRecord.onsuccess = () =>
          resolve(
            (requestRecord.result as
              { schemaVersion: number; payload: Record<string, unknown> } | undefined) ?? null,
          );
        requestRecord.onerror = () => reject(requestRecord.error);
      },
    );
    const shadow = new Promise<{ schemaVersion: number } | null>((resolve, reject) => {
      if (!firstId) {
        resolve(null);
        return;
      }
      const requestShadow = meta.get(`shadow:${firstId}`);
      requestShadow.onsuccess = () => {
        const value = (requestShadow.result as { value?: { schemaVersion: number } } | undefined)
          ?.value;
        resolve(value ?? null);
      };
      requestShadow.onerror = () => reject(requestShadow.error);
    });
    const tombstone = new Promise<unknown>((resolve, reject) => {
      if (!firstId) {
        resolve(undefined);
        return;
      }
      const requestTombstone = meta.get(`deleted:${firstId}`);
      requestTombstone.onsuccess = () => resolve(requestTombstone.result ?? undefined);
      requestTombstone.onerror = () => reject(requestTombstone.error);
    });
    const [activeRecord, recordValue, shadowValue, tombstoneValue] = await Promise.all([
      active,
      record,
      shadow,
      tombstone,
    ]);
    const version = db.version;
    db.close();
    return {
      version,
      activeProfileId: activeRecord?.value,
      profileIds: keys.map(String),
      record: recordValue,
      shadow: shadowValue,
      tombstone: tombstoneValue,
    };
  });
}

test('an old M0.1 tab cannot block opening, migration, or offline reload', async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  const oldTab = await context.newPage();
  await oldTab.goto('/CNAME');
  const profile = legacyProfile('legacy-old-tab', 'Régi Ábel');
  await seedLegacyDatabase(
    oldTab,
    {
      profileId: profile.profileId,
      schemaVersion: 1,
      checksum: checksumOf(profile),
      savedAt: 222,
      payload: profile,
    },
    true,
  );

  await page.goto('/');
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.getByTestId('menu-continue').click();
  const tutorial = page.getByTestId('tutorial-dismiss');
  if (await tutorial.isVisible()) await tutorial.click();
  await expect(page.getByTestId('coins-value')).toHaveAttribute('data-coins', '777');
  await expect(page.locator('.game-topbar__title h1')).toContainText('4. hullám');

  const migrated = await storedState(page);
  expect(migrated.version).toBe(1);
  expect(migrated.record?.schemaVersion).toBe(1);
  expect(migrated.shadow?.schemaVersion).toBe(3);

  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.getByTestId('menu-continue').click();
  await expect(page.getByTestId('coins-value')).toHaveAttribute('data-coins', '777');
  await expect(page.locator('.game-topbar__title h1')).toContainText('4. hullám');
  await context.setOffline(false);

  await oldTab.close();
  await page.reload();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.getByTestId('menu-continue').click();
  await expect(page.getByTestId('coins-value')).toHaveAttribute('data-coins', '777');
});

test('a stale legacy record cannot resurrect a deleted profile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  const before = await storedState(page);
  const deletedId = before.profileIds[0];
  expect(deletedId).toBeTruthy();

  await page.getByTestId('menu-continue').click();
  const tutorial = page.getByTestId('tutorial-dismiss');
  if (await tutorial.isVisible()) await tutorial.click();
  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-profiles').click();
  await page
    .locator('.profile-card')
    .filter({ hasText: 'Ábel' })
    .getByRole('button', { name: 'Játékos törlése' })
    .click();
  await page.getByTestId('delete-profile-modal').getByRole('button', { name: 'Törlés' }).click();
  await expect(page.getByTestId('profiles-screen')).toBeVisible();

  const profile = legacyProfile(deletedId!, 'Feltámadt Ábel');
  await page.evaluate(
    async ({ record }) => {
      const request = indexedDB.open('brainrot-defense');
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('profiles', 'readwrite');
        transaction.objectStore('profiles').put(record);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    },
    {
      record: {
        profileId: profile.profileId,
        schemaVersion: 1,
        checksum: checksumOf(profile),
        savedAt: 222,
        payload: profile,
      },
    },
  );

  await page.reload();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  const after = await storedState(page);
  expect(after.activeProfileId).not.toBe(deletedId);
  expect(after.activeProfileId).toBeTruthy();
  await page.getByTestId('menu-continue').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
  await expect(page.getByTestId('coins-value')).toHaveAttribute('data-coins', '350');
});
