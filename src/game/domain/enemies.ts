import {
  MAX_SAFE_STAT,
  type EnemyAbilities,
  type EnemyDefinition,
  type EnemyTypeId,
} from './types';

export const ENEMY_DEFINITIONS: Readonly<Record<EnemyTypeId, EnemyDefinition>> = {
  'mini-brainrot': {
    id: 'mini-brainrot',
    nameHu: 'Mini Brainrot',
    descriptionHu: 'Alap ellenség. Nem túl erős, de sokan vannak.',
    baseHp: 55,
    baseAttack: 7,
    attackIntervalSec: 1.2,
    range: 1,
    moveSpeed: 1.05,
    armor: 0,
    hpGrowth: 1.35,
    attackGrowth: 1.28,
    isBoss: false,
    colors: { primary: 0xff5a7a, secondary: 0xa41343, accent: 0xffc2d1 },
  },
  'armored-slug': {
    id: 'armored-slug',
    nameHu: 'Páncélozott Csiga',
    descriptionHu: 'Lassú, de vastag páncélja csökkenti a kapott sebzést.',
    baseHp: 150,
    baseAttack: 9,
    attackIntervalSec: 1.6,
    range: 1,
    moveSpeed: 0.5,
    armor: 0.35,
    hpGrowth: 1.35,
    attackGrowth: 1.28,
    isBoss: false,
    colors: { primary: 0xd24b5f, secondary: 0x5a1029, accent: 0xffa36b },
  },
  'shadow-runner': {
    id: 'shadow-runner',
    nameHu: 'Árny Futó',
    descriptionHu: 'Gyors támadó, aki hamar odaér az első vonalhoz.',
    baseHp: 80,
    baseAttack: 9,
    attackIntervalSec: 0.9,
    range: 1,
    moveSpeed: 1.7,
    armor: 0,
    hpGrowth: 1.35,
    attackGrowth: 1.28,
    isBoss: false,
    colors: { primary: 0xff7a45, secondary: 0x6b1a3a, accent: 0xffd166 },
  },
  'mega-brainrot-gorilla': {
    id: 'mega-brainrot-gorilla',
    nameHu: 'Mega Brainrot Gorilla',
    descriptionHu: 'A tizedik hullám főellensége. Hatalmas, páncélozott és dühös.',
    baseHp: 1800,
    baseAttack: 36,
    attackIntervalSec: 1.4,
    range: 1.2,
    moveSpeed: 0.55,
    armor: 0.25,
    hpGrowth: 1.35,
    attackGrowth: 1.28,
    isBoss: true,
    colors: { primary: 0xff3b6b, secondary: 0x3a0c33, accent: 0xffef5e },
  },
  'green-venom-falcon': {
    id: 'green-venom-falcon',
    nameHu: 'Zöld Méreg Sólyom',
    descriptionHu:
      'Ábel saját főellensége. Barna tollazat, hatalmas fekete karmok, zöld méreg és örvénylő védőpajzs.',
    baseHp: 1700,
    baseAttack: 36,
    attackIntervalSec: 1.15,
    range: 1.2,
    moveSpeed: 0.8,
    armor: 0.15,
    hpGrowth: 1.38,
    attackGrowth: 1.3,
    isBoss: true,
    abilities: {
      earthquake: { freezeSec: 2 },
      poison: {
        attackFactor: 0.35,
        tickIntervalSec: 1,
        durationSec: 4,
        cooldownSec: 5.5,
        range: 4.5,
      },
      spinShield: {
        durationSec: 5,
        cooldownSec: 8,
        rangedSlowFactor: 0.5,
        vulnerableSec: 4,
        auraAttackFactor: 0.12,
        auraRadius: 2.3,
        auraTickIntervalSec: 1,
      },
    },
    colors: { primary: 0x9b6338, secondary: 0x24150c, accent: 0x7dff5a },
  },
};

export const ENEMY_TYPE_IDS: readonly EnemyTypeId[] = [
  'mini-brainrot',
  'armored-slug',
  'shadow-runner',
  'mega-brainrot-gorilla',
  'green-venom-falcon',
];

export function isEnemyTypeId(value: unknown): value is EnemyTypeId {
  return (
    value === 'mini-brainrot' ||
    value === 'armored-slug' ||
    value === 'shadow-runner' ||
    value === 'mega-brainrot-gorilla' ||
    value === 'green-venom-falcon'
  );
}

export function enemyAbilities(typeId: EnemyTypeId): EnemyAbilities {
  const abilities = ENEMY_DEFINITIONS[typeId].abilities;
  return {
    poison: abilities?.poison ?? null,
    spinShield: abilities?.spinShield ?? null,
    earthquake: abilities?.earthquake ?? null,
  };
}

function boundedRound(value: number): number {
  if (!Number.isFinite(value)) return MAX_SAFE_STAT;
  return Math.min(MAX_SAFE_STAT, Math.max(1, Math.round(value)));
}

export function enemyStats(typeId: EnemyTypeId, level: number) {
  const definition = ENEMY_DEFINITIONS[typeId];
  const safeLevel = Math.min(20, Math.max(1, Math.floor(level)));
  return {
    maxHp: boundedRound(definition.baseHp * Math.pow(definition.hpGrowth, safeLevel - 1)),
    attack: boundedRound(definition.baseAttack * Math.pow(definition.attackGrowth, safeLevel - 1)),
    attackIntervalSec: definition.attackIntervalSec,
    range: definition.range,
    moveSpeed: definition.moveSpeed,
    armor: definition.armor,
  };
}
