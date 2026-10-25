import {
  ALLY_ROW_START,
  BOARD_COLS,
  type EnemyTypeId,
  type WaveDefinition,
  type WaveEnemyConfig,
} from './types';

function enemy(typeId: EnemyTypeId, level: number, col: number, row: number): WaveEnemyConfig {
  return { typeId, level, col, row };
}

export const WAVE_DEFINITIONS: readonly WaveDefinition[] = [
  {
    id: 1,
    nameHu: 'Első kopogás',
    descriptionHu: 'Két kíváncsi Mini Brainrot közeledik. Ideje felkészülni!',
    rewardCoins: 120,
    isBossWave: false,
    enemies: [enemy('mini-brainrot', 1, 2, 1), enemy('mini-brainrot', 1, 3, 1)],
  },
  {
    id: 2,
    nameHu: 'Több kis szörny',
    descriptionHu: 'Háromfelől érkeznek. Oszd el okosan a védőidet!',
    rewardCoins: 140,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 1, 1, 1),
      enemy('mini-brainrot', 1, 3, 0),
      enemy('mini-brainrot', 1, 4, 1),
    ],
  },
  {
    id: 3,
    nameHu: 'Páncélos vendég',
    descriptionHu: 'Megjelenik az első Páncélozott Csiga. A páncél kemény dió!',
    rewardCoins: 170,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 1, 1, 0),
      enemy('armored-slug', 1, 2, 0),
      enemy('mini-brainrot', 1, 3, 1),
    ],
  },
  {
    id: 4,
    nameHu: 'Gyors lábak',
    descriptionHu: 'Árny Futók rohannak előre. A gyorsakat előbb kell megállítani.',
    rewardCoins: 190,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 2, 1, 1),
      enemy('mini-brainrot', 2, 4, 1),
      enemy('shadow-runner', 1, 2, 0),
      enemy('shadow-runner', 1, 3, 0),
    ],
  },
  {
    id: 5,
    nameHu: 'Vegyes had',
    descriptionHu: 'Páncél és sebesség egyszerre. A csapatmunka most számít.',
    rewardCoins: 220,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 1, 0, 1),
      enemy('mini-brainrot', 1, 5, 1),
      enemy('armored-slug', 1, 2, 0),
      enemy('shadow-runner', 2, 3, 0),
      enemy('shadow-runner', 2, 4, 1),
    ],
  },
  {
    id: 6,
    nameHu: 'Erősödő sereg',
    descriptionHu: 'A szörnyek egyre magasabb szinten támadnak.',
    rewardCoins: 260,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 3, 1, 0),
      enemy('mini-brainrot', 3, 3, 0),
      enemy('mini-brainrot', 3, 4, 1),
      enemy('armored-slug', 2, 2, 1),
    ],
  },
  {
    id: 7,
    nameHu: 'Acélfal',
    descriptionHu: 'Két vastag páncélos lassan, de biztosan közeledik.',
    rewardCoins: 300,
    isBossWave: false,
    enemies: [
      enemy('armored-slug', 2, 1, 0),
      enemy('armored-slug', 2, 4, 0),
      enemy('mini-brainrot', 2, 2, 1),
      enemy('mini-brainrot', 2, 3, 1),
    ],
  },
  {
    id: 8,
    nameHu: 'Árny roham',
    descriptionHu: 'Négy Árny Futó rohan egyszerre. Ne hagyd, hogy átcsússzanak!',
    rewardCoins: 340,
    isBossWave: false,
    enemies: [
      enemy('shadow-runner', 2, 0, 1),
      enemy('shadow-runner', 2, 1, 0),
      enemy('shadow-runner', 2, 4, 0),
      enemy('shadow-runner', 2, 5, 1),
      enemy('mini-brainrot', 2, 3, 1),
    ],
  },
  {
    id: 9,
    nameHu: 'Káosz kapuja',
    descriptionHu: 'A legkeményebb csapat a főellenség előtt. Készülj fel!',
    rewardCoins: 400,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 3, 0, 1),
      enemy('mini-brainrot', 3, 2, 0),
      enemy('mini-brainrot', 3, 5, 1),
      enemy('armored-slug', 2, 1, 0),
      enemy('armored-slug', 2, 4, 0),
      enemy('shadow-runner', 3, 3, 1),
    ],
  },
  {
    id: 10,
    nameHu: 'Mega Brainrot Gorilla',
    descriptionHu: 'A végső főellenség megérkezett! Minden erőt be kell vetni.',
    rewardCoins: 600,
    isBossWave: true,
    enemies: [
      enemy('mega-brainrot-gorilla', 3, 2, 0),
      enemy('mini-brainrot', 3, 1, 1),
      enemy('mini-brainrot', 3, 4, 1),
      enemy('armored-slug', 2, 0, 0),
    ],
  },
];

export function getWave(waveId: number): WaveDefinition | null {
  return WAVE_DEFINITIONS.find((wave) => wave.id === waveId) ?? null;
}

export function waveReplayRewardCoins(wave: WaveDefinition): number {
  return Math.floor(wave.rewardCoins / 2);
}

export function waveFirstCompletionBonus(wave: WaveDefinition): number {
  return wave.rewardCoins - waveReplayRewardCoins(wave);
}

export const FIRST_WAVE_ID = 1;
export const LAST_WAVE_ID = 10;

export function isValidWaveId(waveId: number): boolean {
  return Number.isInteger(waveId) && getWave(waveId) !== null;
}

export function isValidEnemyPosition(col: number, row: number): boolean {
  return (
    Number.isInteger(col) &&
    Number.isInteger(row) &&
    col >= 0 &&
    col < BOARD_COLS &&
    row >= 0 &&
    row < ALLY_ROW_START
  );
}
