import { describe, expect, it } from 'vitest';
import { purchaseUpgrade } from '../../src/game/commands/profileCommands';
import {
  UPGRADE_DEFINITIONS,
  UPGRADE_KINDS,
  maxUpgradeLevelReached,
  upgradeAttackMultiplier,
  upgradeCost,
  upgradeHpMultiplier,
  upgradeLevel,
} from '../../src/game/domain/upgrades';
import { MAX_UPGRADE_LEVEL } from '../../src/game/domain/types';
import { profileWith } from './testFixtures';

describe('army upgrade shop', () => {
  it('defines two upgrade kinds', () => {
    expect(UPGRADE_KINDS).toEqual(['army-attack', 'army-hp']);
  });

  it('grows the cost with the level', () => {
    const first = upgradeCost('army-attack', 0);
    const second = upgradeCost('army-attack', 1);
    const late = upgradeCost('army-attack', 20);
    expect(second).toBeGreaterThan(first);
    expect(late).toBeGreaterThan(second);
    expect(Number.isFinite(first)).toBe(true);
  });

  it('caps upgrades at the documented level', () => {
    expect(upgradeCost('army-hp', MAX_UPGRADE_LEVEL)).toBe(Number.POSITIVE_INFINITY);
    const profile = profileWith([], { upgrades: { 'army-attack': MAX_UPGRADE_LEVEL } });
    expect(maxUpgradeLevelReached(profile, 'army-attack')).toBe(true);
    expect(upgradeLevel(profile, 'army-attack')).toBe(MAX_UPGRADE_LEVEL);
  });

  it('purchases an upgrade level with coins', () => {
    const profile = profileWith([], { coins: 100_000 });
    const outcome = purchaseUpgrade(profile, 'army-attack', 2);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.level).toBe(1);
    expect(outcome.value.profile.upgrades['army-attack']).toBe(1);
    expect(outcome.value.profile.coins).toBe(100_000 - outcome.value.cost);
  });

  it('rejects purchases without coins and at max level', () => {
    const poor = purchaseUpgrade(profileWith([], { coins: 0 }), 'army-hp', 2);
    expect(poor.ok).toBe(false);
    expect(poor.ok ? null : poor.error).toBe('insufficient-coins');

    const maxed = purchaseUpgrade(
      profileWith([], { coins: 100_000, upgrades: { 'army-hp': MAX_UPGRADE_LEVEL } }),
      'army-hp',
      2,
    );
    expect(maxed.ok).toBe(false);
    expect(maxed.ok ? null : maxed.error).toBe('max-upgrade');
  });

  it('rejects unknown upgrade kinds', () => {
    const outcome = purchaseUpgrade(profileWith([], { coins: 100 }), 'wrong' as never, 2);
    expect(outcome.ok).toBe(false);
  });

  it('multipliers scale linearly per level', () => {
    const base = profileWith([], {});
    const leveled = profileWith([], { upgrades: { 'army-attack': 10, 'army-hp': 10 } });
    expect(upgradeAttackMultiplier(leveled)).toBe(1.5);
    expect(upgradeHpMultiplier(leveled)).toBe(1.5);
    expect(upgradeAttackMultiplier(base)).toBe(1);
  });

  it('clamps out-of-range stored levels', () => {
    const weird = profileWith([], { upgrades: { 'army-attack': 999 } });
    expect(upgradeLevel(weird, 'army-attack')).toBe(MAX_UPGRADE_LEVEL);
  });

  it('keeps upgrade definitions descriptive', () => {
    expect(UPGRADE_DEFINITIONS['army-attack'].nameHu.length).toBeGreaterThan(2);
    expect(UPGRADE_DEFINITIONS['army-hp'].descriptionHu.length).toBeGreaterThan(2);
  });
});
