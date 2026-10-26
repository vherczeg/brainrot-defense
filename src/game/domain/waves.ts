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
    rewardCoins: 145,
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
      enemy('armored-slug', 2, 2, 0),
      enemy('mini-brainrot', 2, 3, 1),
    ],
  },
  {
    id: 4,
    nameHu: 'Gyors lábak',
    descriptionHu: 'Árny Futók rohannak előre. A gyorsakat előbb kell megállítani.',
    rewardCoins: 195,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 2, 1, 1),
      enemy('mini-brainrot', 2, 4, 1),
      enemy('shadow-runner', 2, 2, 0),
      enemy('shadow-runner', 2, 3, 0),
    ],
  },
  {
    id: 5,
    nameHu: 'Vegyes had',
    descriptionHu: 'Páncél és sebesség egyszerre. A csapatmunka most számít.',
    rewardCoins: 225,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 2, 0, 1),
      enemy('mini-brainrot', 2, 5, 1),
      enemy('armored-slug', 2, 2, 0),
      enemy('shadow-runner', 2, 3, 0),
      enemy('shadow-runner', 2, 4, 1),
    ],
  },
  {
    id: 6,
    nameHu: 'Erősödő sereg',
    descriptionHu: 'A szörnyek egyre magasabb szinten támadnak.',
    rewardCoins: 255,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 4, 1, 0),
      enemy('mini-brainrot', 4, 3, 0),
      enemy('mini-brainrot', 4, 4, 1),
      enemy('armored-slug', 3, 2, 1),
    ],
  },
  {
    id: 7,
    nameHu: 'Acélfal',
    descriptionHu: 'Két vastag páncélos lassan, de biztosan közeledik.',
    rewardCoins: 285,
    isBossWave: false,
    enemies: [
      enemy('armored-slug', 3, 1, 0),
      enemy('armored-slug', 3, 4, 0),
      enemy('mini-brainrot', 3, 2, 1),
      enemy('mini-brainrot', 3, 3, 1),
      enemy('mini-brainrot', 3, 5, 1),
    ],
  },
  {
    id: 8,
    nameHu: 'Árny roham',
    descriptionHu: 'Négy Árny Futó rohan egyszerre. Ne hagyd, hogy átcsússzanak!',
    rewardCoins: 315,
    isBossWave: false,
    enemies: [
      enemy('shadow-runner', 3, 0, 1),
      enemy('shadow-runner', 3, 1, 0),
      enemy('shadow-runner', 3, 4, 0),
      enemy('shadow-runner', 3, 5, 1),
      enemy('mini-brainrot', 3, 3, 1),
    ],
  },
  {
    id: 9,
    nameHu: 'Káosz kapuja',
    descriptionHu: 'A legkeményebb csapat a főellenség előtt. Készülj fel!',
    rewardCoins: 350,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 4, 0, 1),
      enemy('mini-brainrot', 4, 2, 0),
      enemy('mini-brainrot', 4, 5, 1),
      enemy('armored-slug', 3, 1, 0),
      enemy('armored-slug', 3, 4, 0),
      enemy('shadow-runner', 4, 3, 1),
    ],
  },
  {
    id: 10,
    nameHu: 'Mega Brainrot Gorilla',
    descriptionHu: 'Az első igazi főellenség megérkezett! Széles sereg és erős tűzerő kell ellene.',
    rewardCoins: 500,
    isBossWave: true,
    enemies: [
      enemy('mega-brainrot-gorilla', 3, 2, 0),
      enemy('mini-brainrot', 3, 1, 1),
      enemy('mini-brainrot', 3, 4, 1),
      enemy('armored-slug', 2, 0, 0),
    ],
  },
  {
    id: 11,
    nameHu: 'Káosz utórezgés',
    descriptionHu: 'A tizedik hullám után új szörnyek törnek elő. Erősítsd tovább a sereged!',
    rewardCoins: 425,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 5, 1, 0),
      enemy('mini-brainrot', 5, 4, 0),
      enemy('mini-brainrot', 5, 2, 2),
      enemy('armored-slug', 4, 3, 1),
      enemy('mini-brainrot', 4, 0, 0),
      enemy('shadow-runner', 4, 5, 0),
    ],
  },
  {
    id: 12,
    nameHu: 'Árny vihar',
    descriptionHu: 'Négy gyors Árny Futó keresi az utat a védelmeden át.',
    rewardCoins: 475,
    isBossWave: false,
    enemies: [
      enemy('shadow-runner', 5, 0, 1),
      enemy('shadow-runner', 5, 1, 2),
      enemy('shadow-runner', 5, 4, 0),
      enemy('shadow-runner', 5, 5, 1),
      enemy('mini-brainrot', 5, 2, 0),
    ],
  },
  {
    id: 13,
    nameHu: 'Vastag fal',
    descriptionHu: 'Páncélozott Csigák és gyors futók egyszerre támadnak.',
    rewardCoins: 525,
    isBossWave: false,
    enemies: [
      enemy('armored-slug', 5, 1, 1),
      enemy('armored-slug', 5, 4, 1),
      enemy('mini-brainrot', 5, 0, 0),
      enemy('mini-brainrot', 5, 2, 2),
      enemy('mini-brainrot', 5, 5, 0),
      enemy('shadow-runner', 5, 3, 0),
    ],
  },
  {
    id: 14,
    nameHu: 'Kettős szorítás',
    descriptionHu: 'Két oldalról zárul a gyűrű. Oszd el jól a tüzerőt!',
    rewardCoins: 575,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 5, 0, 1),
      enemy('mini-brainrot', 5, 5, 2),
      enemy('armored-slug', 5, 1, 0),
      enemy('armored-slug', 5, 4, 0),
      enemy('shadow-runner', 6, 2, 1),
      enemy('shadow-runner', 6, 3, 1),
    ],
  },
  {
    id: 15,
    nameHu: 'Sűrű raj',
    descriptionHu: 'A Mini Brainrotek szintet léptek. Már nem olyan ártalmatlanok.',
    rewardCoins: 625,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 6, 0, 0),
      enemy('mini-brainrot', 6, 3, 0),
      enemy('mini-brainrot', 6, 5, 1),
      enemy('armored-slug', 5, 1, 2),
      enemy('armored-slug', 5, 4, 2),
      enemy('shadow-runner', 5, 2, 1),
      enemy('shadow-runner', 6, 5, 2),
    ],
  },
  {
    id: 16,
    nameHu: 'Mérges hullám',
    descriptionHu: 'Minden fajta szörny összefog. A páncél és a sebesség most együtt jön.',
    rewardCoins: 675,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 6, 0, 2),
      enemy('mini-brainrot', 6, 2, 0),
      enemy('mini-brainrot', 6, 5, 2),
      enemy('armored-slug', 6, 1, 1),
      enemy('armored-slug', 6, 4, 1),
      enemy('shadow-runner', 6, 3, 0),
      enemy('mini-brainrot', 6, 5, 0),
      enemy('shadow-runner', 6, 0, 0),
    ],
  },
  {
    id: 17,
    nameHu: 'Hétpróbás',
    descriptionHu: 'Hét szörny, egyetlen cél: áttörni a védelmeden.',
    rewardCoins: 725,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 6, 0, 0),
      enemy('mini-brainrot', 6, 2, 2),
      enemy('mini-brainrot', 6, 4, 0),
      enemy('armored-slug', 6, 1, 1),
      enemy('armored-slug', 6, 5, 1),
      enemy('shadow-runner', 6, 3, 2),
      enemy('shadow-runner', 7, 3, 0),
      enemy('mini-brainrot', 6, 0, 2),
      enemy('mini-brainrot', 6, 5, 2),
    ],
  },
  {
    id: 18,
    nameHu: 'Acél és árnyék',
    descriptionHu: 'A legkeményebb páncélosok és a leggyorsabb futók csapata.',
    rewardCoins: 775,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 6, 0, 1),
      enemy('mini-brainrot', 6, 3, 1),
      enemy('mini-brainrot', 6, 5, 0),
      enemy('armored-slug', 6, 1, 0),
      enemy('armored-slug', 6, 4, 2),
      enemy('shadow-runner', 6, 2, 2),
      enemy('shadow-runner', 7, 2, 0),
      enemy('mini-brainrot', 6, 0, 0),
      enemy('shadow-runner', 7, 4, 0),
    ],
  },
  {
    id: 19,
    nameHu: 'A sólyom árnyéka',
    descriptionHu: 'A levegő megremeg. Valami nagy és mérges közeledik a 20. hullámban.',
    rewardCoins: 825,
    isBossWave: false,
    enemies: [
      enemy('mini-brainrot', 7, 0, 0),
      enemy('mini-brainrot', 7, 3, 0),
      enemy('mini-brainrot', 7, 5, 1),
      enemy('armored-slug', 6, 1, 1),
      enemy('armored-slug', 6, 4, 1),
      enemy('shadow-runner', 6, 2, 2),
      enemy('shadow-runner', 6, 4, 0),
      enemy('shadow-runner', 6, 3, 2),
      enemy('mini-brainrot', 7, 5, 0),
      enemy('shadow-runner', 7, 1, 0),
    ],
  },
  {
    id: 20,
    nameHu: 'Zöld Méreg Sólyom',
    descriptionHu:
      'Ábel saját főellensége: Zöld Méreg Sólyom. Földrengéssel érkezik, mérget köp, és forgó szárnypajzzsal védi magát. Távolsági találattal törhető meg a pajzs!',
    rewardCoins: 1200,
    isBossWave: true,
    enemies: [
      enemy('green-venom-falcon', 6, 2, 1),
      enemy('mini-brainrot', 6, 0, 0),
      enemy('mini-brainrot', 6, 5, 0),
      enemy('armored-slug', 6, 1, 2),
      enemy('armored-slug', 6, 4, 2),
      enemy('shadow-runner', 6, 3, 2),
    ],
  },
];

export function getWave(waveId: number): WaveDefinition | null {
  return WAVE_DEFINITIONS.find((wave) => wave.id === waveId) ?? null;
}

export const WAVE_REPLAY_REWARD_PERCENT = 35;

export function waveReplayRewardCoins(wave: WaveDefinition): number {
  return Math.floor((wave.rewardCoins * WAVE_REPLAY_REWARD_PERCENT) / 100);
}

export function waveFirstCompletionBonus(wave: WaveDefinition): number {
  return wave.rewardCoins - waveReplayRewardCoins(wave);
}

export const FIRST_WAVE_ID = 1;
export const LAST_WAVE_ID = 20;

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
