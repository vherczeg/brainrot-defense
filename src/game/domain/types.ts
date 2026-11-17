export const BOARD_COLS = 6;
export const BOARD_ROWS = 6;
export const ALLY_ROW_START = 3;
export const MAX_EXPANSION_CELLS = 6;
export const MAX_MERGE_RANK = 10;
export const MAX_CHARACTER_LEVEL = 100;
export const MAX_CHARACTER_XP = 245025;
export const STARTING_COINS = 350;
export const TOTAL_WAVES = 100;
export const PREVIOUS_TOTAL_WAVES = 20;
export const FIRST_CAMPAIGN_TOTAL_WAVES = 10;
export const MAX_ARMY_SIZE = BOARD_COLS * (BOARD_ROWS - ALLY_ROW_START);
export const MAX_SAFE_STAT = 1_000_000_000;
export const MAX_COINS = 1_000_000_000;
export const MAX_NEXT_CHARACTER_ID = 2_000_000_000;
export const MAX_PROFILES = 3;
export const MAX_DEFEAT_XP_REWARDS = 3;
export const DEFEAT_XP_RATE = 0.2;
export const MAX_UPGRADE_LEVEL = 25;
export const MAX_UPGRADE_ENTRIES = 20;

export type CharacterTypeId =
  'laser-crocodile' | 'lightning-scorpion' | 'armored-rhino' | 'frost-owl';

export type EnemyTypeId =
  | 'mini-brainrot'
  | 'armored-slug'
  | 'shadow-runner'
  | 'mega-brainrot-gorilla'
  | 'green-venom-falcon'
  | 'venomous-wasp'
  | 'rock-toad'
  | 'storm-crow'
  | 'shield-crab'
  | 'healer-mushroom'
  | 'spitter-snail'
  | 'mirror-moth'
  | 'chaos-imp'
  | 'bomb-imp'
  | 'giant-beetle'
  | 'armored-colossus'
  | 'storm-garuda'
  | 'venom-king-crocodile'
  | 'shadow-prince'
  | 'chaos-twin-warrior'
  | 'chaos-twin-healer'
  | 'lava-golem'
  | 'chaos-dragon'
  | 'mega-chaos-king'
  | 'kappa-captain'
  | 'nightmare-moth'
  | 'iron-hedgehog'
  | 'bubble-duchess'
  | 'void-eye';

export type SurpriseBossTypeId =
  'kappa-captain' | 'nightmare-moth' | 'iron-hedgehog' | 'bubble-duchess' | 'void-eye';

export type Team = 'ally' | 'enemy';
export type AttackKind =
  'laser' | 'lightning' | 'ranged' | 'frost' | 'melee' | 'boss-smash' | 'claw' | 'poison';
export type BattleStatus = 'running' | 'victory' | 'defeat';
export type BattleSpeed = 1 | 2;
export type Difficulty = 'easy' | 'normal' | 'hard' | 'extreme';
export type GameScreen = 'loading' | 'menu' | 'profiles' | 'game' | 'error';
export type GamePhase = 'preparation' | 'battle' | 'result';
export type WaveOutcome = 'victory' | 'defeat';

export type WaveModifierId = 'storm' | 'frenzy' | 'haste' | 'thick-armor' | 'gold-rush' | 'fog';

export type UpgradeKind = 'army-attack' | 'army-hp';

export interface GridPosition {
  readonly col: number;
  readonly row: number;
}

export interface GameSettings {
  readonly soundEnabled: boolean;
  readonly reducedMotion: boolean;
  readonly battleSpeed: BattleSpeed;
  readonly difficulty: Difficulty;
}

export interface CharacterInstance {
  readonly id: string;
  readonly typeId: CharacterTypeId;
  readonly mergeRank: number;
  readonly totalXp: number;
  readonly col: number;
  readonly row: number;
}

export interface PlayerProfile {
  readonly profileId: string;
  readonly name: string;
  readonly coins: number;
  readonly currentWave: number;
  readonly unlockedWave: number;
  readonly completedWaves: readonly number[];
  readonly characters: readonly CharacterInstance[];
  readonly defeatXpCounts: readonly number[];
  readonly upgrades: Readonly<Record<string, number>>;
  readonly expansionCells: number;
  readonly settings: GameSettings;
  readonly tutorialSeen: boolean;
  readonly nextCharacterId: number;
  readonly createdAt: number;
  readonly lastSavedAt: number;
}

export interface SlowOnHitAbility {
  readonly attackIntervalFactor: number;
  readonly moveSpeedFactor: number;
  readonly durationSec: number;
}

export interface CharacterStats {
  readonly attack: number;
  readonly maxHp: number;
  readonly attackIntervalSec: number;
  readonly range: number;
  readonly moveSpeed: number;
  readonly armor: number;
  readonly splashRadius: number;
}

export interface CharacterDefinition {
  readonly id: CharacterTypeId;
  readonly nameHu: string;
  readonly shortNameHu: string;
  readonly roleHu: string;
  readonly descriptionHu: string;
  readonly specialHu: string;
  readonly cost: number;
  readonly baseHp: number;
  readonly baseAttack: number;
  readonly attackIntervalSec: number;
  readonly range: number;
  readonly moveSpeed: number;
  readonly armor: number;
  readonly attackKind: AttackKind;
  readonly chainCount: number;
  readonly chainFactor: number;
  readonly chainRange: number;
  readonly splashRadius: number;
  readonly slow?: SlowOnHitAbility;
  readonly colors: {
    readonly primary: number;
    readonly secondary: number;
    readonly accent: number;
  };
}

export interface PoisonAbility {
  readonly attackFactor: number;
  readonly tickIntervalSec: number;
  readonly durationSec: number;
  readonly cooldownSec: number;
  readonly range: number;
}

export interface SpinShieldAbility {
  readonly durationSec: number;
  readonly cooldownSec: number;
  readonly rangedSlowFactor: number;
  readonly vulnerableSec: number;
  readonly auraAttackFactor: number;
  readonly auraRadius: number;
  readonly auraTickIntervalSec: number;
}

export interface EarthquakeAbility {
  readonly freezeSec: number;
}

export interface HealAbility {
  readonly intervalSec: number;
  readonly cooldownSec: number;
  readonly attackFactor: number;
  readonly range: number;
}

export interface ThornsAbility {
  readonly factor: number;
}

export interface PhaseShiftAbility {
  readonly durationSec: number;
  readonly cooldownSec: number;
  readonly damageFactor: number;
}

export interface SummonAbility {
  readonly firstAtSec: number;
  readonly intervalSec: number;
  readonly maxTotal: number;
  readonly spawnTypeId: EnemyTypeId;
  readonly spawnLevel: number;
  readonly spawnCells: readonly GridPosition[];
}

export interface EnrageStep {
  readonly threshold: number;
  readonly attackFactor: number;
  readonly armorBonus: number;
}

export interface EnrageAbility {
  readonly steps: readonly EnrageStep[];
}

export interface ExplodeAbility {
  readonly radius: number;
  readonly factor: number;
}

export interface StunAbility {
  readonly durationSec: number;
  readonly cooldownSec: number;
  readonly range: number;
}

export interface ArmorAuraAbility {
  readonly radius: number;
  readonly armorBonus: number;
}

export interface EnemyAbilities {
  readonly poison: PoisonAbility | null;
  readonly spinShield: SpinShieldAbility | null;
  readonly earthquake: EarthquakeAbility | null;
  readonly heal: HealAbility | null;
  readonly thorns: ThornsAbility | null;
  readonly phaseShift: PhaseShiftAbility | null;
  readonly summon: SummonAbility | null;
  readonly enrage: EnrageAbility | null;
  readonly explode: ExplodeAbility | null;
  readonly stun: StunAbility | null;
  readonly armorAura: ArmorAuraAbility | null;
}

export interface EnemyDefinition {
  readonly id: EnemyTypeId;
  readonly nameHu: string;
  readonly descriptionHu: string;
  readonly baseHp: number;
  readonly baseAttack: number;
  readonly attackIntervalSec: number;
  readonly range: number;
  readonly moveSpeed: number;
  readonly armor: number;
  readonly hpGrowth: number;
  readonly attackGrowth: number;
  readonly isBoss: boolean;
  readonly isSurpriseBoss?: boolean;
  readonly abilities?: EnemyAbilities;
  readonly colors: {
    readonly primary: number;
    readonly secondary: number;
    readonly accent: number;
  };
}

export interface WaveEnemyConfig {
  readonly typeId: EnemyTypeId;
  readonly level: number;
  readonly col: number;
  readonly row: number;
}

export interface WaveDefinition {
  readonly id: number;
  readonly nameHu: string;
  readonly descriptionHu: string;
  readonly rewardCoins: number;
  readonly enemies: readonly WaveEnemyConfig[];
  readonly isBossWave: boolean;
  readonly chapterId: number;
  readonly modifier?: WaveModifierId;
}

export type CommandErrorCode =
  | 'not-found'
  | 'invalid-cell'
  | 'not-allied-cell'
  | 'cell-occupied'
  | 'same-unit'
  | 'type-mismatch'
  | 'rank-mismatch'
  | 'max-rank'
  | 'insufficient-coins'
  | 'coin-overflow'
  | 'board-full'
  | 'profile-limit'
  | 'invalid-wave'
  | 'already-completed'
  | 'no-army'
  | 'invalid-import'
  | 'invalid-character'
  | 'invalid-upgrade'
  | 'max-upgrade'
  | 'max-expansion'
  | 'cell-locked'
  | 'corrupt-save'
  | 'save-failed'
  | 'unsupported-version'
  | 'storage-unavailable'
  | 'unknown';

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly error: CommandErrorCode;
      readonly detail?: string;
    };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T = never>(error: CommandErrorCode, detail?: string): Result<T> {
  return detail === undefined ? { ok: false, error } : { ok: false, error, detail };
}
