import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  claimWaveReward,
  mergeCharacters,
  purchaseCharacter,
} from '../../src/game/commands/profileCommands';
import type { PlayerProfile } from '../../src/game/domain/types';
import {
  parseProfileFromImport,
  serializeEnvelope,
} from '../../src/persistence/import-export/saveCodec';
import { IndexedDbProfileRepository } from '../../src/persistence/indexeddb/profileRepository';
import { createEnvelope, MAX_COINS } from '../../src/persistence/schemas/saveSchema';
import { NOW, profileWith, unit } from './testFixtures';

function profile(overrides: Partial<PlayerProfile> = {}) {
  return profileWith([unit('unit-1', 'laser-crocodile', 1, 0, 3)], {
    profileId: 'boundary',
    coins: 500,
    ...overrides,
  });
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('BOUNDARIES: accepted profiles remain persistable', () => {
  it('purchasing at the maximum nextCharacterId still saves a valid profile', async () => {
    const repository = new IndexedDbProfileRepository();
    const initial = profile({ nextCharacterId: 2_000_000_000 });
    expect((await repository.saveProfile(initial)).ok).toBe(true);

    const purchased = purchaseCharacter(initial, 'laser-crocodile', NOW);
    expect(purchased.ok).toBe(true);
    if (!purchased.ok) return;
    expect(new Set(purchased.value.profile.characters.map((c) => c.id)).size).toBe(
      purchased.value.profile.characters.length,
    );
    expect((await repository.saveProfile(purchased.value.profile)).ok).toBe(true);
  });

  it('merging at the maximum nextCharacterId still saves a valid profile', async () => {
    const repository = new IndexedDbProfileRepository();
    const initial = profileWith(
      [unit('unit-1', 'laser-crocodile', 1, 0, 3), unit('unit-2', 'laser-crocodile', 1, 1, 3)],
      { profileId: 'boundary-merge', nextCharacterId: 2_000_000_000 },
    );
    expect((await repository.saveProfile(initial)).ok).toBe(true);

    const merged = mergeCharacters(initial, 'unit-1', 'unit-2', NOW);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect((await repository.saveProfile(merged.value.profile)).ok).toBe(true);
  });

  it('does not produce a save that exceeds the coin limit after a wave reward', async () => {
    const repository = new IndexedDbProfileRepository();
    const initial = profile({ coins: MAX_COINS, currentWave: 1 });
    expect((await repository.saveProfile(initial)).ok).toBe(true);

    const claimed = claimWaveReward(initial, 1, NOW);
    expect(claimed.ok).toBe(false);

    const loaded = await repository.loadProfile(initial.profileId);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value).toEqual(initial);
  });

  it('imports and persists a profile with nextCharacterId at the accepted maximum', async () => {
    const imported = profile({ nextCharacterId: 2_000_000_000 });
    const text = serializeEnvelope(imported);
    const parsed = parseProfileFromImport(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const repository = new IndexedDbProfileRepository();
    const purchased = purchaseCharacter(parsed.value, 'lightning-scorpion', NOW);
    expect(purchased.ok).toBe(true);
    if (!purchased.ok) return;
    expect((await repository.saveProfile(purchased.value.profile)).ok).toBe(true);
  });
});

describe('IMPORT INVARIANTS: impossible progression states are rejected', () => {
  function parse(overrides: Partial<PlayerProfile>) {
    return parseProfileFromImport(JSON.stringify(createEnvelope(profile(overrides))));
  }

  it('rejects completed waves that do not form a prefix from wave 1', () => {
    expect(parse({ completedWaves: [1, 3], currentWave: 4, unlockedWave: 4 }).ok).toBe(false);
  });

  it('rejects completed waves beyond the current wave', () => {
    expect(parse({ completedWaves: [10], currentWave: 1, unlockedWave: 10 }).ok).toBe(false);
  });

  it('rejects a current wave that skips an unfinished earlier wave', () => {
    expect(parse({ completedWaves: [1, 2, 3], currentWave: 5, unlockedWave: 5 }).ok).toBe(false);
  });

  it('accepts the normal next-wave state and an unlocked wave ahead of it', () => {
    expect(parse({ completedWaves: [1, 2, 3], currentWave: 4, unlockedWave: 5 }).ok).toBe(true);
  });
});
