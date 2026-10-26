import {
  STARTING_COINS,
  TOTAL_WAVES,
  type CharacterInstance,
  type GameSettings,
  type PlayerProfile,
} from './types';

export const DEFAULT_PROFILE_NAME = 'Ábel';
export const DEFEAT_COMFORT_COINS = 50;

const STARTER_CHARACTERS: readonly CharacterInstance[] = [
  {
    id: 'unit-1',
    typeId: 'laser-crocodile',
    mergeRank: 1,
    totalXp: 0,
    col: 2,
    row: 4,
  },
  {
    id: 'unit-2',
    typeId: 'laser-crocodile',
    mergeRank: 1,
    totalXp: 0,
    col: 3,
    row: 4,
  },
  {
    id: 'unit-3',
    typeId: 'lightning-scorpion',
    mergeRank: 1,
    totalXp: 0,
    col: 2,
    row: 3,
  },
];

export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  reducedMotion: false,
  battleSpeed: 1,
  difficulty: 'normal',
};

export interface CreateProfileOptions {
  readonly name?: string;
  readonly reducedMotion?: boolean;
  readonly now?: number;
  readonly profileId?: string;
}

export function createInitialProfile(options: CreateProfileOptions = {}): PlayerProfile {
  const now = options.now ?? Date.now();
  const profileId = options.profileId ?? `profile-${now}-${Math.floor(Math.random() * 1e6)}`;
  return {
    profileId,
    name: (options.name ?? DEFAULT_PROFILE_NAME).trim().slice(0, 24),
    coins: STARTING_COINS,
    currentWave: 1,
    unlockedWave: 1,
    completedWaves: [],
    characters: STARTER_CHARACTERS.map((character) => ({ ...character })),
    defeatXpCounts: Array.from({ length: TOTAL_WAVES }, () => 0),
    upgrades: {},
    settings: {
      ...DEFAULT_SETTINGS,
      reducedMotion: options.reducedMotion ?? DEFAULT_SETTINGS.reducedMotion,
    },
    tutorialSeen: false,
    nextCharacterId: 4,
    createdAt: now,
    lastSavedAt: now,
  };
}

export function starterCharacterCount(): number {
  return STARTER_CHARACTERS.length;
}
