import { MAX_UPGRADE_LEVEL, type UpgradeKind } from './types';

export const UPGRADE_KINDS: readonly UpgradeKind[] = ['army-attack', 'army-hp'];

export const UPGRADE_DEFINITIONS: Readonly<
  Record<
    UpgradeKind,
    {
      readonly kind: UpgradeKind;
      readonly nameHu: string;
      readonly descriptionHu: string;
      readonly baseCost: number;
      readonly costGrowth: number;
      readonly levelFactor: number;
    }
  >
> = {
  'army-attack': {
    kind: 'army-attack',
    nameHu: 'Sereg ereje',
    descriptionHu: 'Minden harcosod támadása +5% szintenként.',
    baseCost: 75,
    costGrowth: 1.7,
    levelFactor: 0.05,
  },
  'army-hp': {
    kind: 'army-hp',
    nameHu: 'Sereg szíve',
    descriptionHu: 'Minden harcosod életereje +5% szintenként.',
    baseCost: 60,
    costGrowth: 1.7,
    levelFactor: 0.05,
  },
};

export function isUpgradeKind(value: unknown): value is UpgradeKind {
  return value === 'army-attack' || value === 'army-hp';
}

export function upgradeLevel(
  profile: { readonly upgrades: Readonly<Record<string, number>> },
  kind: UpgradeKind,
): number {
  const level = profile.upgrades[kind] ?? 0;
  if (!Number.isFinite(level)) return 0;
  return Math.min(MAX_UPGRADE_LEVEL, Math.max(0, Math.floor(level)));
}

export function upgradeCost(kind: UpgradeKind, currentLevel: number): number {
  const definition = UPGRADE_DEFINITIONS[kind];
  const safeLevel = Math.min(MAX_UPGRADE_LEVEL, Math.max(0, Math.floor(currentLevel)));
  if (safeLevel >= MAX_UPGRADE_LEVEL) return Number.POSITIVE_INFINITY;
  return Math.max(
    1,
    Math.round((definition.baseCost * Math.pow(safeLevel + 1, definition.costGrowth)) / 10) * 10,
  );
}

export function upgradeAttackMultiplier(profile: {
  readonly upgrades: Readonly<Record<string, number>>;
}): number {
  const level = upgradeLevel(profile, 'army-attack');
  return 1 + UPGRADE_DEFINITIONS['army-attack'].levelFactor * level;
}

export function upgradeHpMultiplier(profile: {
  readonly upgrades: Readonly<Record<string, number>>;
}): number {
  const level = upgradeLevel(profile, 'army-hp');
  return 1 + UPGRADE_DEFINITIONS['army-hp'].levelFactor * level;
}

export function maxUpgradeLevelReached(
  profile: { readonly upgrades: Readonly<Record<string, number>> },
  kind: UpgradeKind,
): boolean {
  return upgradeLevel(profile, kind) >= MAX_UPGRADE_LEVEL;
}
