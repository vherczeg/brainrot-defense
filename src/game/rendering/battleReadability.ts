import type { AttackKind } from '../domain/types';

export interface HealthBarMetrics {
  readonly width: number;
  readonly height: number;
  readonly y: number;
  readonly border: number;
}

export function healthBarMetrics(isBoss: boolean): HealthBarMetrics {
  return isBoss
    ? { width: 96, height: 12, y: -56, border: 2 }
    : { width: 58, height: 8, y: -46, border: 1 };
}

export function clampRatio(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export interface HealthBarSegments {
  readonly hpRatio: number;
  readonly flashRatio: number;
}

export function healthBarSegments(displayHp: number, hp: number, maxHp: number): HealthBarSegments {
  const safeMax = Math.max(1, maxHp);
  return {
    hpRatio: clampRatio(hp / safeMax),
    flashRatio: clampRatio(Math.max(0, displayHp - hp) / safeMax),
  };
}

export function easeDisplayHp(displayHp: number, hp: number): number {
  const diff = hp - displayHp;
  if (Math.abs(diff) < 0.75) return hp;
  return displayHp + diff * 0.16;
}

export function attackLinkColor(kind: AttackKind): number {
  switch (kind) {
    case 'laser':
      return 0x62e7ff;
    case 'lightning':
      return 0xc98bff;
    case 'boss-smash':
      return 0xff5a7a;
    case 'claw':
      return 0x7dff5a;
    case 'poison':
      return 0x7dff5a;
    default:
      return 0xffa35a;
  }
}
