import { describe, expect, it } from 'vitest';
import {
  attackLinkColor,
  clampRatio,
  easeDisplayHp,
  healthBarMetrics,
  healthBarSegments,
} from '../../src/game/rendering/battleReadability';

describe('healthBarMetrics', () => {
  it('uses a wider, taller bar with a gold border for bosses', () => {
    expect(healthBarMetrics(true)).toEqual({ width: 96, height: 12, y: -56, border: 2 });
    expect(healthBarMetrics(false)).toEqual({ width: 58, height: 8, y: -46, border: 1 });
  });
});

describe('clampRatio', () => {
  it('clamps to the 0..1 range and rejects non-finite values', () => {
    expect(clampRatio(-0.5)).toBe(0);
    expect(clampRatio(1.5)).toBe(1);
    expect(clampRatio(0.4)).toBe(0.4);
    expect(clampRatio(Number.NaN)).toBe(0);
    expect(clampRatio(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('healthBarSegments', () => {
  it('computes hp and flash ratios against max hp', () => {
    expect(healthBarSegments(100, 80, 100)).toEqual({ hpRatio: 0.8, flashRatio: 0.2 });
  });

  it('shows no flash when the display hp has caught up to the current hp', () => {
    expect(healthBarSegments(60, 60, 100)).toEqual({ hpRatio: 0.6, flashRatio: 0 });
  });

  it('shows no flash when the unit healed above its displayed hp', () => {
    expect(healthBarSegments(40, 70, 100)).toEqual({ hpRatio: 0.7, flashRatio: 0 });
  });

  it('never reports a ratio above 1 even for corrupted values', () => {
    expect(healthBarSegments(140, 120, 100)).toEqual({ hpRatio: 1, flashRatio: 0.2 });
  });

  it('handles a zero or negative max hp safely', () => {
    expect(healthBarSegments(0, 0, 0)).toEqual({ hpRatio: 0, flashRatio: 0 });
  });
});

describe('easeDisplayHp', () => {
  it('moves the displayed hp toward the current hp', () => {
    expect(easeDisplayHp(100, 80)).toBeLessThan(100);
    expect(easeDisplayHp(100, 80)).toBeGreaterThan(80);
  });

  it('snaps to the current hp when the difference is negligible', () => {
    expect(easeDisplayHp(80.4, 80)).toBe(80);
  });

  it('follows hp upward (healing) as well as downward (damage)', () => {
    expect(easeDisplayHp(60, 80)).toBeGreaterThan(60);
  });
});

describe('attackLinkColor', () => {
  it('uses a distinct, recognizable color per attack kind', () => {
    expect(attackLinkColor('laser')).toBe(0x62e7ff);
    expect(attackLinkColor('lightning')).toBe(0xc98bff);
    expect(attackLinkColor('boss-smash')).toBe(0xff5a7a);
    expect(attackLinkColor('melee')).toBe(0xffa35a);
  });
});
