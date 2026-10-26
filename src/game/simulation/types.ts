import type { AttackKind, BattleStatus, Difficulty, EnemyAbilities, Team } from '../domain/types';

export const FIXED_TICK_SECONDS = 1 / 30;
export const MAX_BATTLE_SECONDS = 90;

export interface PoisonStatus {
  readonly remainingSec: number;
  readonly tickInSec: number;
  readonly tickIntervalSec: number;
  readonly damagePerTick: number;
  readonly sourceId: string;
}

export interface SpinShieldStatus {
  readonly active: boolean;
  readonly shielded: boolean;
  readonly remainingSec: number;
  readonly cooldownSec: number;
  readonly speedFactor: number;
  readonly vulnerableSec: number;
  readonly auraTickInSec: number;
}

export interface BattleUnit {
  readonly id: string;
  readonly team: Team;
  readonly typeId: string;
  readonly level: number;
  readonly mergeRank: number;
  readonly x: number;
  readonly y: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly attack: number;
  readonly attackIntervalSec: number;
  readonly range: number;
  readonly moveSpeed: number;
  readonly armor: number;
  readonly attackKind: AttackKind;
  readonly chainCount: number;
  readonly chainFactor: number;
  readonly chainRange: number;
  readonly cooldown: number;
  readonly alive: boolean;
  readonly isBoss: boolean;
  readonly abilities: EnemyAbilities;
  readonly poison: PoisonStatus | null;
  readonly spinShield: SpinShieldStatus | null;
  readonly poisonCooldownSec: number;
  readonly frozenSec: number;
}

export interface BattleState {
  readonly waveId: number;
  readonly seed: number;
  readonly difficulty: Difficulty;
  readonly ticks: number;
  readonly elapsedSec: number;
  readonly status: BattleStatus;
  readonly units: readonly BattleUnit[];
}

export interface BattlePoint {
  readonly x: number;
  readonly y: number;
}

export type DamageSource = 'attack' | 'poison' | 'spin-aura';

export type BattleEvent =
  | {
      readonly type: 'attack';
      readonly attackerId: string;
      readonly targetId: string;
      readonly kind: AttackKind;
      readonly from: BattlePoint;
      readonly to: BattlePoint;
    }
  | {
      readonly type: 'chain';
      readonly attackerId: string;
      readonly targetId: string;
      readonly from: BattlePoint;
      readonly to: BattlePoint;
    }
  | {
      readonly type: 'damage';
      readonly unitId: string;
      readonly amount: number;
      readonly hp: number;
      readonly maxHp: number;
      readonly at: BattlePoint;
      readonly source?: DamageSource;
      readonly blocked?: boolean;
    }
  | {
      readonly type: 'death';
      readonly unitId: string;
      readonly team: Team;
      readonly at: BattlePoint;
    }
  | {
      readonly type: 'status';
      readonly unitId: string;
      readonly status: 'poisoned' | 'spin-start' | 'spin-break' | 'spin-end';
      readonly at: BattlePoint;
    }
  | {
      readonly type: 'earthquake';
      readonly at: BattlePoint;
      readonly freezeSec: number;
    }
  | {
      readonly type: 'battle-end';
      readonly outcome: 'victory' | 'defeat';
    };

export interface BattleStepResult {
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
}
