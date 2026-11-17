import type { WaveModifierId } from './types';

export interface WaveModifierConfig {
  readonly id: WaveModifierId;
  readonly nameHu: string;
  readonly descriptionHu: string;
  readonly allyAttackIntervalFactor: number;
  readonly enemyAttackFactor: number;
  readonly enemyMoveSpeedFactor: number;
  readonly enemyArmorBonus: number;
  readonly allyMoveSpeedFactor: number;
  readonly rewardFactor: number;
}

export const WAVE_MODIFIER_CONFIGS: Readonly<Record<WaveModifierId, WaveModifierConfig>> = {
  storm: {
    id: 'storm',
    nameHu: 'Vihar',
    descriptionHu: 'A vihar mindenkit lassít: a védők ritkábban tudnak támadni.',
    allyAttackIntervalFactor: 1.15,
    enemyAttackFactor: 1,
    enemyMoveSpeedFactor: 1,
    enemyArmorBonus: 0,
    allyMoveSpeedFactor: 1,
    rewardFactor: 1,
  },
  frenzy: {
    id: 'frenzy',
    nameHu: 'Őrjöngés',
    descriptionHu: 'A szörnyek őrjöngenek: a támadásuk erősebb.',
    allyAttackIntervalFactor: 1,
    enemyAttackFactor: 1.2,
    enemyMoveSpeedFactor: 1,
    enemyArmorBonus: 0,
    allyMoveSpeedFactor: 1,
    rewardFactor: 1,
  },
  haste: {
    id: 'haste',
    nameHu: 'Sebes szél',
    descriptionHu: 'A szél felgyorsítja a szörnyeket.',
    allyAttackIntervalFactor: 1,
    enemyAttackFactor: 1,
    enemyMoveSpeedFactor: 1.35,
    enemyArmorBonus: 0,
    allyMoveSpeedFactor: 1,
    rewardFactor: 1,
  },
  'thick-armor': {
    id: 'thick-armor',
    nameHu: 'Vastag páncél',
    descriptionHu: 'A szörnyek páncélja vastagabb a szokásosnál.',
    allyAttackIntervalFactor: 1,
    enemyAttackFactor: 1,
    enemyMoveSpeedFactor: 1,
    enemyArmorBonus: 0.05,
    allyMoveSpeedFactor: 1,
    rewardFactor: 1,
  },
  'gold-rush': {
    id: 'gold-rush',
    nameHu: 'Aranyláz',
    descriptionHu: 'Ebben a hullámban bőséges arany vár rád!',
    allyAttackIntervalFactor: 1,
    enemyAttackFactor: 1,
    enemyMoveSpeedFactor: 1,
    enemyArmorBonus: 0,
    allyMoveSpeedFactor: 1,
    rewardFactor: 1.5,
  },
  fog: {
    id: 'fog',
    nameHu: 'Sűrű köd',
    descriptionHu: 'A ködben a védők lassabban mozognak. A távoli lövészeket nem zavarja!',
    allyAttackIntervalFactor: 1,
    enemyAttackFactor: 1,
    enemyMoveSpeedFactor: 1,
    enemyArmorBonus: 0,
    allyMoveSpeedFactor: 0.8,
    rewardFactor: 1,
  },
};

export const WAVE_MODIFIER_IDS: readonly WaveModifierId[] = Object.keys(
  WAVE_MODIFIER_CONFIGS,
) as WaveModifierId[];

export function waveModifierConfig(
  modifier: WaveModifierId | undefined,
): WaveModifierConfig | null {
  if (!modifier) return null;
  return WAVE_MODIFIER_CONFIGS[modifier];
}

export function waveRewardMultiplier(modifier: WaveModifierId | undefined): number {
  return waveModifierConfig(modifier)?.rewardFactor ?? 1;
}

export function scaledWaveRewardCoins(rewardCoins: number, modifier: WaveModifierId | undefined) {
  return Math.max(1, Math.round(rewardCoins * waveRewardMultiplier(modifier)));
}
