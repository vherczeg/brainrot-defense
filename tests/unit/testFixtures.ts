import { createInitialProfile } from '../../src/game/domain/state';
import type { CharacterInstance, PlayerProfile, WaveDefinition } from '../../src/game/domain/types';

export const NOW = 1_700_000_000_000;

export function profileWith(
  characters: readonly CharacterInstance[],
  overrides: Partial<PlayerProfile> = {},
): PlayerProfile {
  const base = createInitialProfile({
    name: 'Teszt',
    profileId: 'test-profile',
    now: NOW,
  });
  return {
    ...base,
    ...overrides,
    characters,
    nextCharacterId: overrides.nextCharacterId ?? 100,
  };
}

export function unit(
  id: string,
  typeId: CharacterInstance['typeId'],
  level: number,
  col: number,
  row: number,
): CharacterInstance {
  return { id, typeId, level, col, row };
}

export function oneEnemyWave(
  typeId: WaveDefinition['enemies'][number]['typeId'] = 'mini-brainrot',
  level = 1,
  col = 2,
  row = 1,
): WaveDefinition {
  return {
    id: 99,
    nameHu: 'Teszt hullám',
    descriptionHu: 'Teszt',
    rewardCoins: 0,
    isBossWave: false,
    enemies: [{ typeId, level, col, row }],
  };
}

export function waveWith(enemies: WaveDefinition['enemies'], id = 99): WaveDefinition {
  return {
    id,
    nameHu: 'Teszt hullám',
    descriptionHu: 'Teszt',
    rewardCoins: 0,
    isBossWave: enemies.some((enemy) => enemy.typeId === 'mega-brainrot-gorilla'),
    enemies,
  };
}
