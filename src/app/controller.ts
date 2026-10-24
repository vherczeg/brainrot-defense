import { SoundManager, type SoundName } from '../audio/soundManager';
import {
  applyDefeatComfort,
  markTutorialSeen,
  mergeCharacters,
  moveCharacter,
  purchaseCharacter,
  resolveBattleRewards,
  updateSettings,
  type BattleLevelUp,
} from '../game/commands/profileCommands';
import { CHARACTER_DEFINITIONS } from '../game/domain/characters';
import { MAX_CHARACTER_XP } from '../game/domain/progression';
import { emptyAlliedCells } from '../game/domain/grid';
import {
  createInitialProfile,
  DEFEAT_COMFORT_COINS,
  DEFAULT_PROFILE_NAME,
} from '../game/domain/state';
import {
  MAX_MERGE_RANK,
  MAX_PROFILES,
  TOTAL_WAVES,
  type BattleSpeed,
  type CharacterInstance,
  type CharacterTypeId,
  type CommandErrorCode,
  type GamePhase,
  type GameScreen,
  type GameSettings,
  type PlayerProfile,
  type Result,
  type WaveEnemyConfig,
} from '../game/domain/types';
import { getWave } from '../game/domain/waves';
import { createBattleState } from '../game/simulation/battle';
import { BattleSession } from '../game/simulation/battleSession';
import type { BattleEvent, BattleState } from '../game/simulation/types';
import { t, type TranslationKey, type TranslationVars } from '../localization';
import { parseProfileFromImport, serializeEnvelope } from '../persistence/import-export/saveCodec';
import type { ProfileRepository, ProfileSummary } from '../persistence/indexeddb/profileRepository';
import { ProfileWriteQueue } from './profileWriteQueue';
import { WebLocksProfileSessionGuard, type ProfileSessionGuard } from './profileSessionGuard';
import { MAX_NAME_LENGTH } from '../persistence/schemas/saveSchema';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'unavailable';
export type ToastTone = 'info' | 'success' | 'error' | 'reward';
export type ModalId = 'settings' | 'save' | 'tutorial' | 'import-confirm' | 'surrender' | null;

export interface ToastView {
  readonly id: number;
  readonly message: string;
  readonly tone: ToastTone;
}

export interface FatalErrorView {
  readonly title: string;
  readonly body: string;
}

export interface BattleHudView {
  readonly waveId: number;
  readonly elapsedSec: number;
  readonly alliesAlive: number;
  readonly enemiesAlive: number;
  readonly status: 'running' | 'victory' | 'defeat';
  readonly paused: boolean;
  readonly speed: BattleSpeed;
}

export interface BattleResultView {
  readonly outcome: 'victory' | 'defeat';
  readonly waveId: number;
  readonly rewardCoins: number;
  readonly comfortCoins: number;
  readonly firstCompletion: boolean;
  readonly completedAllWaves: boolean;
  readonly nextWave: number;
  readonly xpPerUnit: number;
  readonly totalXpAwarded: number;
  readonly levelUps: readonly BattleLevelUp[];
  readonly maxLevelReached: boolean;
  readonly persistenceError: boolean;
}

export interface PrepView {
  readonly version: number;
  readonly selectedId: string | null;
  readonly characters: readonly CharacterInstance[];
  readonly enemies: readonly WaveEnemyConfig[];
  readonly validMoveCells: readonly { readonly col: number; readonly row: number }[];
  readonly mergeTargets: readonly {
    readonly col: number;
    readonly row: number;
    readonly characterId: string;
  }[];
  readonly reducedMotion: boolean;
}

export interface VisualEvent {
  readonly id: number;
  readonly type: 'merge' | 'purchase' | 'move';
  readonly col: number;
  readonly row: number;
}

export interface AppSnapshot {
  readonly screen: GameScreen;
  readonly phase: GamePhase;
  readonly loading: boolean;
  readonly storageAvailable: boolean;
  readonly persistenceGranted: boolean | null;
  readonly profiles: readonly ProfileSummary[];
  readonly activeProfile: PlayerProfile | null;
  readonly selectedCharacterId: string | null;
  readonly modal: ModalId;
  readonly prepVersion: number;
  readonly battle: BattleHudView | null;
  readonly result: BattleResultView | null;
  readonly saveStatus: SaveStatus;
  readonly toast: ToastView | null;
  readonly fatalError: FatalErrorView | null;
  readonly pendingImportName: string | null;
  readonly creatingProfile: boolean;
}

interface ControllerOptions {
  readonly repository: ProfileRepository | null;
  readonly now?: () => number;
  readonly requestFrame?: (callback: FrameRequestCallback) => number;
  readonly cancelFrame?: (id: number) => void;
  readonly schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  readonly cancelSchedule?: (id: ReturnType<typeof setTimeout>) => void;
  readonly sessionGuard?: ProfileSessionGuard;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function makeProfileId(now: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `profile-${now}-${Math.floor(Math.random() * 1_000_000)}`;
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function errorKey(code: CommandErrorCode): TranslationKey {
  const map: Record<CommandErrorCode, TranslationKey> = {
    'not-found': 'errorNotFound',
    'invalid-cell': 'errorInvalidCell',
    'not-allied-cell': 'errorNotAlliedCell',
    'cell-occupied': 'errorCellOccupied',
    'same-unit': 'errorSameUnit',
    'type-mismatch': 'errorTypeMismatch',
    'rank-mismatch': 'errorRankMismatch',
    'max-rank': 'errorMaxRank',
    'insufficient-coins': 'errorInsufficientCoins',
    'coin-overflow': 'errorCoinOverflow',
    'profile-limit': 'profileLimit',
    'board-full': 'errorBoardFull',
    'invalid-wave': 'errorInvalidWave',
    'already-completed': 'errorAlreadyCompleted',
    'no-army': 'errorNoArmy',
    'invalid-import': 'errorInvalidImport',
    'invalid-character': 'errorInvalidCharacter',
    'corrupt-save': 'errorCorruptSave',
    'save-failed': 'errorSaveFailed',
    'unsupported-version': 'errorUnsupportedVersion',
    'storage-unavailable': 'errorStorageUnavailable',
    unknown: 'errorUnknown',
  };
  return map[code];
}

function buildHud(state: BattleState, session: BattleSession): BattleHudView {
  const alliesAlive = state.units.filter((unit) => unit.team === 'ally' && unit.alive).length;
  const enemiesAlive = state.units.filter((unit) => unit.team === 'enemy' && unit.alive).length;
  return {
    waveId: state.waveId,
    elapsedSec: state.elapsedSec,
    alliesAlive,
    enemiesAlive,
    status: state.status,
    paused: session.isPaused(),
    speed: session.getSpeed(),
  };
}

function summaryOf(profile: PlayerProfile): ProfileSummary {
  return {
    profileId: profile.profileId,
    name: profile.name,
    currentWave: profile.currentWave,
    coins: profile.coins,
    lastSavedAt: profile.lastSavedAt,
    createdAt: profile.createdAt,
    corrupt: false,
  };
}

export class GameController {
  private readonly repository: ProfileRepository | null;
  private readonly sessionGuard: ProfileSessionGuard;
  private readonly now: () => number;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (id: number) => void;
  private readonly schedule: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>;
  private readonly cancelSchedule: (id: ReturnType<typeof setTimeout>) => void;
  private readonly sound = new SoundManager();
  private readonly listeners = new Set<() => void>();

  private screen: GameScreen = 'loading';
  private phase: GamePhase = 'preparation';
  private loading = true;
  private storageAvailable = false;
  private persistenceGranted: boolean | null = null;
  private profiles: readonly ProfileSummary[] = [];
  private profile: PlayerProfile | null = null;
  private selectedId: string | null = null;
  private modal: ModalId = null;
  private prepVersion = 0;
  private battleHud: BattleHudView | null = null;
  private result: BattleResultView | null = null;
  private saveStatus: SaveStatus = 'idle';
  private toast: ToastView | null = null;
  private fatalError: FatalErrorView | null = null;
  private pendingImport: PlayerProfile | null = null;
  private pendingImportName: string | null = null;
  private creatingProfile = false;
  private profileChangeToken = 0;

  private toastCounter = 0;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private visualEvents: VisualEvent[] = [];
  private visualEventCounter = 0;
  private readonly writes = new ProfileWriteQueue();

  private session: BattleSession | null = null;
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private battleAttempt = 0;
  private battleResolved = false;
  private battleFinishing = false;
  private battleRoster: readonly string[] = [];
  private battleWaveId: number | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  private snapshot: AppSnapshot = this.createSnapshot();

  constructor(options: ControllerOptions) {
    this.repository = options.repository;
    this.sessionGuard = options.sessionGuard ?? new WebLocksProfileSessionGuard();
    this.now = options.now ?? (() => Date.now());
    this.requestFrame =
      options.requestFrame ??
      ((callback) =>
        typeof requestAnimationFrame === 'function' ? requestAnimationFrame(callback) : 0);
    this.cancelFrame =
      options.cancelFrame ??
      ((id) => {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
      });
    this.schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.cancelSchedule = options.cancelSchedule ?? ((id) => clearTimeout(id));
    this.sound.setEnabled(true);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): AppSnapshot => this.snapshot;

  private createSnapshot(): AppSnapshot {
    return {
      screen: this.screen,
      phase: this.phase,
      loading: this.loading,
      storageAvailable: this.storageAvailable,
      persistenceGranted: this.persistenceGranted,
      profiles: this.profiles,
      activeProfile: this.profile,
      selectedCharacterId: this.selectedId,
      modal: this.modal,
      prepVersion: this.prepVersion,
      battle: this.battleHud,
      result: this.result,
      saveStatus: this.saveStatus,
      toast: this.toast,
      fatalError: this.fatalError,
      pendingImportName: this.pendingImportName,
      creatingProfile: this.creatingProfile,
    };
  }

  private emit(): void {
    this.snapshot = this.createSnapshot();
    for (const listener of this.listeners) listener();
  }

  initialize(): Promise<void> {
    if (this.initialized) return Promise.resolve();
    if (this.initializationPromise) return this.initializationPromise;
    this.initializationPromise = this.performInitialize();
    return this.initializationPromise;
  }

  private async performInitialize(): Promise<void> {
    this.loading = true;
    this.screen = 'loading';
    this.emit();

    if (this.repository) {
      const listed = await this.repository.listProfiles();
      if (listed.ok) {
        this.storageAvailable = true;
        this.profiles = listed.value;
      } else {
        this.storageAvailable = false;
        if (listed.detail === 'upgrade-blocked') {
          this.fatalError = {
            title: t('errorUpgradeBlockedTitle'),
            body: t('errorUpgradeBlockedBody'),
          };
        }
      }
    }

    if (this.storageAvailable && this.repository) {
      const activeId = await this.repository.getActiveProfileId();
      let activeProfile: PlayerProfile | null = null;

      if (activeId.ok && activeId.value) {
        const loaded = await this.repository.loadProfile(activeId.value);
        if (loaded.ok) {
          activeProfile = loaded.value;
        } else if (loaded.error === 'not-found') {
          const cleared = await this.repository.setActiveProfileId(null);
          if (!cleared.ok) {
            this.fatalError = {
              title: t('errorStorageTitle'),
              body: t('errorStorageBody'),
            };
          }
        } else {
          this.fatalError = {
            title: t('errorCorruptTitle'),
            body: t('errorCorruptBody'),
          };
        }
      }

      if (!activeProfile && !this.fatalError && this.profiles.length > 0) {
        const firstProfile = this.profiles[0];
        if (firstProfile) {
          const loaded = await this.repository.loadProfile(firstProfile.profileId);
          if (loaded.ok) activeProfile = loaded.value;
          else if (loaded.error !== 'not-found') {
            this.fatalError = {
              title: t('errorLoadTitle'),
              body: t('errorLoadBody'),
            };
          }
        }
      }

      if (!activeProfile && !this.fatalError && this.profiles.length === 0) {
        const created = createInitialProfile({
          name: DEFAULT_PROFILE_NAME,
          profileId: makeProfileId(this.now()),
          reducedMotion: prefersReducedMotion(),
          now: this.now(),
        });
        const session = await this.sessionGuard.acquire(created.profileId);
        if (!session.acquired) {
          this.fatalError = {
            title: t('errorProfileInUseTitle'),
            body: t('errorProfileInUseBody'),
          };
        } else {
          const saved = await this.repository.saveProfileAndActivate(created);
          if (saved.ok) {
            activeProfile = created;
            this.profiles = [summaryOf(created)];
          } else {
            if (session.newlyAcquired) {
              await this.sessionGuard.release(created.profileId);
            }
            this.fatalError = {
              title: t('errorStorageTitle'),
              body: t('errorStorageBody'),
            };
          }
        }
      }

      if (activeProfile) {
        const session = await this.sessionGuard.acquire(activeProfile.profileId);
        if (!session.acquired) {
          this.fatalError = {
            title: t('errorProfileInUseTitle'),
            body: t('errorProfileInUseBody'),
          };
          this.screen = 'error';
        } else {
          await this.sessionGuard.releaseOthers(activeProfile.profileId);
          this.profile = activeProfile;
          this.profiles = this.upsertSummary(activeProfile);
          this.screen = 'menu';
        }
      } else if (this.fatalError) {
        this.screen = 'error';
      } else {
        this.screen = 'profiles';
      }
    } else if (this.fatalError) {
      this.storageAvailable = false;
      this.screen = 'error';
    } else {
      this.storageAvailable = false;
      this.profile = createInitialProfile({
        name: DEFAULT_PROFILE_NAME,
        profileId: makeProfileId(this.now()),
        reducedMotion: prefersReducedMotion(),
        now: this.now(),
      });
      this.profiles = [summaryOf(this.profile)];
      this.saveStatus = 'unavailable';
      this.screen = 'menu';
    }

    this.loading = false;
    this.initialized = true;
    this.syncSound();
    this.emit();

    if (this.storageAvailable && this.repository) {
      void this.repository.requestPersistence().then((granted) => {
        this.persistenceGranted = granted;
        this.emit();
      });
    }
  }

  private upsertSummary(profile: PlayerProfile): readonly ProfileSummary[] {
    const summary = summaryOf(profile);
    const existing = this.profiles.filter((item) => item.profileId !== profile.profileId);
    return [...existing, summary].sort((a, b) => a.createdAt - b.createdAt);
  }

  async refreshProfiles(): Promise<void> {
    if (!this.repository || !this.storageAvailable) return;
    const listed = await this.repository.listProfiles();
    if (listed.ok) {
      this.profiles = listed.value;
      this.emit();
    }
  }

  openProfiles(): void {
    void this.refreshProfiles();
    this.screen = 'profiles';
    this.modal = null;
    this.emit();
  }

  closeProfiles(): void {
    this.screen = this.profile ? 'menu' : 'profiles';
    this.emit();
  }

  goToMenu(): void {
    this.stopBattle();
    this.screen = 'menu';
    this.phase = 'preparation';
    this.result = null;
    this.selectedId = null;
    this.modal = null;
    this.fatalError = null;
    this.emit();
  }

  enterGame(): void {
    if (!this.profile) {
      this.openProfiles();
      return;
    }
    this.screen = 'game';
    this.phase = 'preparation';
    this.result = null;
    this.selectedId = null;
    this.prepVersion += 1;
    this.modal = this.profile.tutorialSeen ? null : 'tutorial';
    this.emit();
  }

  async createProfile(name: string): Promise<void> {
    const cleanName = name.trim().slice(0, MAX_NAME_LENGTH);
    if (cleanName.length === 0) {
      this.showToastKey('profileNameRequired', {}, 'error');
      this.sound.play('error');
      return;
    }
    if (this.creatingProfile) return;
    if (this.profiles.length >= MAX_PROFILES) {
      this.showToastKey('profileLimit', {}, 'error');
      this.sound.play('error');
      return;
    }
    const profile = createInitialProfile({
      name: cleanName,
      profileId: makeProfileId(this.now()),
      reducedMotion: prefersReducedMotion(),
      now: this.now(),
    });

    this.creatingProfile = true;
    this.emit();
    if (this.repository && this.storageAvailable) {
      const session = await this.sessionGuard.acquire(profile.profileId);
      if (!session.acquired) {
        this.creatingProfile = false;
        this.showToastKey('errorProfileInUse', {}, 'error');
        this.sound.play('error');
        this.emit();
        return;
      }
      const repository = this.repository;
      const saved = await this.writes.enqueueBarrier(
        profile.profileId,
        () => repository.saveProfileAndActivate(profile),
        true,
      );
      if (!saved.ok) {
        if (session.newlyAcquired) {
          await this.sessionGuard.release(profile.profileId);
        }
        this.creatingProfile = false;
        this.showToastKey(errorKey(saved.error), {}, 'error');
        this.sound.play('error');
        this.emit();
        return;
      }
      await this.sessionGuard.releaseOthers(profile.profileId);
    } else {
      this.writes.invalidate(profile.profileId);
    }

    this.creatingProfile = false;
    this.profile = profile;
    this.profiles = this.upsertSummary(profile);
    this.saveStatus = this.storageAvailable ? 'saved' : 'unavailable';
    this.screen = 'game';
    this.phase = 'preparation';
    this.selectedId = null;
    this.prepVersion += 1;
    this.modal = profile.tutorialSeen ? null : 'tutorial';
    this.syncSound(profile);
    this.showToastKey('profileCreated', {}, 'success');
    this.emit();
  }

  async selectProfile(profileId: string): Promise<void> {
    const summary = this.profiles.find((item) => item.profileId === profileId);
    if (summary?.corrupt) {
      this.showToastKey('profileCorruptHint', {}, 'error');
      return;
    }
    if (this.profile?.profileId === profileId) {
      this.screen = 'menu';
      this.emit();
      return;
    }
    if (!this.repository || !this.storageAvailable) {
      if (this.profile?.profileId === profileId) {
        this.screen = 'menu';
        this.emit();
      }
      return;
    }
    const token = (this.profileChangeToken += 1);
    const repository = this.repository;
    await this.writes.whenIdle();
    if (token !== this.profileChangeToken) return;
    const loaded = await repository.loadProfile(profileId);
    if (token !== this.profileChangeToken) return;
    if (!loaded.ok) {
      this.showToastKey(errorKey(loaded.error), {}, 'error');
      this.sound.play('error');
      return;
    }
    const session = await this.sessionGuard.acquire(profileId);
    if (token !== this.profileChangeToken) {
      if (session.newlyAcquired) {
        await this.sessionGuard.release(profileId);
      }
      return;
    }
    if (!session.acquired) {
      this.showToastKey('errorProfileInUse', {}, 'error');
      this.sound.play('error');
      return;
    }
    const activated = await this.writes.enqueueBarrier(profileId, () =>
      repository.setActiveProfileId(profileId),
    );
    if (token !== this.profileChangeToken) {
      if (session.newlyAcquired) {
        await this.sessionGuard.release(profileId);
      }
      return;
    }
    if (!activated.ok) {
      if (session.newlyAcquired) {
        await this.sessionGuard.release(profileId);
      }
      this.showToastKey(errorKey(activated.error), {}, 'error');
      this.sound.play('error');
      return;
    }
    await this.sessionGuard.releaseOthers(profileId);
    this.profile = loaded.value;
    this.profiles = this.upsertSummary(loaded.value);
    this.screen = 'menu';
    this.phase = 'preparation';
    this.selectedId = null;
    this.saveStatus = 'saved';
    this.syncSound(loaded.value);
    this.showToastKey('profileSelected', {}, 'success');
    this.emit();
  }

  async deleteProfile(profileId: string): Promise<void> {
    this.profileChangeToken += 1;
    if (this.repository && this.storageAvailable) {
      const repository = this.repository;
      const deleted = await this.writes.enqueueBarrier(
        profileId,
        () => repository.deleteProfile(profileId),
        true,
      );
      if (!deleted.ok) {
        this.showToastKey(errorKey(deleted.error), {}, 'error');
        return;
      }
    } else {
      this.writes.invalidate(profileId);
    }
    const wasActive = this.profile?.profileId === profileId;
    this.profiles = this.profiles.filter((profile) => profile.profileId !== profileId);
    if (wasActive) {
      await this.sessionGuard.release(profileId);
      this.profile = null;
    }
    this.screen = 'profiles';
    this.showToastKey('profileDeleted', {}, 'info');
    this.emit();
  }

  dismissFatalError(): void {
    this.fatalError = null;
    this.screen = this.profile ? 'menu' : 'profiles';
    this.emit();
  }

  openModal(modal: Exclude<ModalId, null>): void {
    this.modal = modal;
    this.emit();
  }

  closeModal(): void {
    if (this.modal === 'tutorial' && this.profile && !this.profile.tutorialSeen) {
      this.markTutorial();
      return;
    }
    this.modal = null;
    this.emit();
  }

  openTutorial(): void {
    this.modal = 'tutorial';
    this.emit();
  }

  markTutorial(): void {
    if (!this.profile) {
      this.modal = null;
      this.emit();
      return;
    }
    const next = markTutorialSeen(this.profile, this.now());
    this.modal = null;
    this.commitProfile(next, { silent: true });
  }

  private selectCharacterInternal(characterId: string | null): void {
    this.selectedId = characterId;
    this.prepVersion += 1;
    this.emit();
  }

  selectCharacter(characterId: string): void {
    if (this.phase !== 'preparation' || !this.profile) return;
    if (!this.profile.characters.some((character) => character.id === characterId)) return;
    this.sound.play('click');
    this.selectCharacterInternal(characterId);
  }

  handleUnitTap(characterId: string): void {
    if (this.phase !== 'preparation' || !this.profile) return;
    const tapped = this.profile.characters.find((character) => character.id === characterId);
    if (!tapped) {
      this.showToastKey('errorNotFound', {}, 'error');
      return;
    }
    if (!this.selectedId) {
      this.selectCharacter(characterId);
      return;
    }
    if (this.selectedId === characterId) {
      this.sound.play('click');
      this.selectCharacterInternal(null);
      return;
    }
    const selected = this.profile.characters.find((character) => character.id === this.selectedId);
    if (!selected) {
      this.selectCharacter(characterId);
      return;
    }
    if (selected.typeId === tapped.typeId && selected.mergeRank === tapped.mergeRank) {
      if (selected.mergeRank >= MAX_MERGE_RANK) {
        this.showToastKey('errorMaxRank', {}, 'error');
        this.sound.play('error');
        return;
      }
      this.performMerge(selected.id, tapped.id);
      return;
    }
    this.selectCharacter(characterId);
  }

  handleCellTap(col: number, row: number): void {
    if (this.phase !== 'preparation' || !this.profile) return;
    const occupant =
      this.profile.characters.find((character) => character.col === col && character.row === row) ??
      null;
    if (occupant) {
      this.handleUnitTap(occupant.id);
      return;
    }
    if (!this.selectedId) return;
    this.performMove(this.selectedId, col, row);
  }

  dragUnitToCell(characterId: string, col: number, row: number): void {
    if (this.phase !== 'preparation' || !this.profile) return;
    const target =
      this.profile.characters.find((character) => character.col === col && character.row === row) ??
      null;
    if (target) {
      if (target.id === characterId) {
        this.selectCharacter(characterId);
        return;
      }
      this.performMerge(characterId, target.id);
      return;
    }
    this.performMove(characterId, col, row);
  }

  private performMerge(sourceId: string, targetId: string): void {
    if (!this.profile) return;
    const outcome = mergeCharacters(this.profile, sourceId, targetId, this.now());
    if (!outcome.ok) {
      this.showToastKey(errorKey(outcome.error), {}, 'error');
      this.sound.play('error');
      return;
    }
    const definition = CHARACTER_DEFINITIONS[outcome.value.merged.typeId];
    this.selectedId = outcome.value.merged.id;
    this.pushVisualEvent('merge', outcome.value.merged.col, outcome.value.merged.row);
    this.sound.play('merge');
    this.showToastKey(
      'toastMerged',
      { name: definition.nameHu, rank: outcome.value.merged.mergeRank },
      'success',
    );
    this.commitProfile(outcome.value.profile);
  }

  private performMove(characterId: string, col: number, row: number): void {
    if (!this.profile) return;
    const outcome = moveCharacter(this.profile, characterId, col, row, this.now());
    if (!outcome.ok) {
      this.showToastKey(errorKey(outcome.error), {}, 'error');
      this.sound.play('error');
      return;
    }
    if (outcome.value === this.profile) return;
    this.pushVisualEvent('move', col, row);
    this.sound.play('click');
    this.commitProfile(outcome.value);
  }

  purchase(typeId: CharacterTypeId): void {
    if (!this.profile || this.phase !== 'preparation') return;
    const outcome = purchaseCharacter(this.profile, typeId, this.now());
    if (!outcome.ok) {
      this.showToastKey(errorKey(outcome.error), {}, 'error');
      this.sound.play('error');
      return;
    }
    this.selectedId = outcome.value.purchased.id;
    this.pushVisualEvent('purchase', outcome.value.purchased.col, outcome.value.purchased.row);
    this.sound.play('buy');
    this.showToastKey('toastPurchased', { name: CHARACTER_DEFINITIONS[typeId].nameHu }, 'success');
    this.commitProfile(outcome.value.profile);
  }

  updateSettings(settings: Partial<GameSettings>): void {
    if (!this.profile) return;
    const next = updateSettings(this.profile, settings, this.now());
    this.syncSound(next);
    this.commitProfile(next, { silent: true });
    if (this.session) {
      this.session.setSpeed(next.settings.battleSpeed);
      this.battleHud = buildHud(this.session.getState(), this.session);
      this.emit();
    }
  }

  startBattle(): void {
    if (!this.profile || this.phase !== 'preparation') return;
    if (this.profile.characters.length === 0) {
      this.showToastKey('errorNoArmy', {}, 'error');
      this.sound.play('error');
      return;
    }
    const wave = getWave(this.profile.currentWave);
    if (!wave) {
      this.showToastKey('errorInvalidWave', {}, 'error');
      return;
    }
    this.battleAttempt += 1;
    const seed = hashSeed(
      `${this.profile.profileId}:${wave.id}:${this.battleAttempt}:${this.profile.coins}`,
    );
    const state = createBattleState(this.profile.characters, wave, seed);
    this.session = new BattleSession(state, this.profile.settings.battleSpeed);
    this.phase = 'battle';
    this.result = null;
    this.selectedId = null;
    this.battleResolved = false;
    this.battleFinishing = false;
    this.battleRoster = this.profile.characters.map((character) => character.id);
    this.battleWaveId = wave.id;
    this.lastFrameTime = 0;
    this.battleHud = buildHud(state, this.session);
    this.sound.play('click');
    this.emit();
    this.startBattleLoop();
  }

  private startBattleLoop(): void {
    this.stopBattleLoop();
    if (typeof this.requestFrame !== 'function') return;
    this.rafId = this.requestFrame(this.battleLoop);
  }

  private battleLoop = (time: number): void => {
    this.rafId = null;
    const session = this.session;
    if (!session || this.phase !== 'battle' || session.isPaused()) return;
    if (this.lastFrameTime === 0) this.lastFrameTime = time;
    const delta = Math.max(0, time - this.lastFrameTime);
    this.lastFrameTime = time;
    session.advance(delta);
    const state = session.getState();
    const hud = buildHud(state, session);

    const shouldEmitHud =
      !this.battleHud ||
      Math.floor(hud.elapsedSec * 10) !== Math.floor(this.battleHud.elapsedSec * 10) ||
      hud.status !== this.battleHud.status ||
      hud.alliesAlive !== this.battleHud.alliesAlive ||
      hud.enemiesAlive !== this.battleHud.enemiesAlive ||
      hud.paused !== this.battleHud.paused ||
      hud.speed !== this.battleHud.speed;
    if (shouldEmitHud) {
      this.battleHud = hud;
      this.emit();
    }

    if (state.status !== 'running') {
      this.scheduleBattleEnd(state.status);
      return;
    }
    this.rafId = this.requestFrame(this.battleLoop);
  };

  private scheduleBattleEnd(status: 'victory' | 'defeat'): void {
    if (this.battleResolved) return;
    this.battleResolved = true;
    this.stopBattleLoop();
    const delay = this.profile?.settings.reducedMotion ? 150 : 850;
    this.endTimer = this.schedule(() => {
      this.endTimer = null;
      this.finishBattle(status);
    }, delay);
    if (this.session) {
      this.battleHud = buildHud(this.session.getState(), this.session);
      this.emit();
    }
  }

  private finishBattle(status: 'victory' | 'defeat'): void {
    if (!this.profile || this.phase !== 'battle' || this.battleFinishing) return;
    this.battleFinishing = true;
    if (this.modal === 'surrender') this.modal = null;
    const waveId = this.battleWaveId ?? this.profile.currentWave;
    const profileToken = this.profileChangeToken;
    if (status === 'victory') {
      const resolved = resolveBattleRewards(this.profile, waveId, this.battleRoster, this.now());
      if (!resolved.ok) {
        this.battleFinishing = false;
        this.result = {
          outcome: 'victory',
          waveId,
          rewardCoins: 0,
          comfortCoins: 0,
          firstCompletion: false,
          completedAllWaves: false,
          nextWave: this.profile.currentWave,
          xpPerUnit: 0,
          totalXpAwarded: 0,
          levelUps: [],
          maxLevelReached: false,
          persistenceError: false,
        };
        this.phase = 'result';
        this.sound.play('victory');
        this.showToastKey(errorKey(resolved.error), {}, 'error');
        if (this.session) this.battleHud = buildHud(this.session.getState(), this.session);
        this.emit();
        return;
      }

      const nextProfile = resolved.value.profile;
      const nextCompletedAllWaves =
        nextProfile.completedWaves.includes(TOTAL_WAVES) &&
        nextProfile.completedWaves.length >= TOTAL_WAVES;
      const result: BattleResultView = {
        outcome: 'victory',
        waveId,
        rewardCoins: resolved.value.rewardCoins,
        comfortCoins: 0,
        firstCompletion: resolved.value.firstCompletion,
        completedAllWaves: nextCompletedAllWaves,
        nextWave: nextProfile.currentWave,
        xpPerUnit: resolved.value.xpPerUnit,
        totalXpAwarded: resolved.value.totalXpAwarded,
        levelUps: resolved.value.levelUps,
        maxLevelReached: nextProfile.characters.some(
          (character) =>
            character.totalXp >= MAX_CHARACTER_XP && this.battleRoster.includes(character.id),
        ),
        persistenceError: false,
      };
      const persistence = this.saveCriticalProfile(nextProfile);
      void persistence.then((saved) => {
        const sameProfile =
          profileToken === this.profileChangeToken &&
          this.profile?.profileId === nextProfile.profileId;
        const stillActive = sameProfile && this.phase === 'battle' && this.battleWaveId === waveId;
        if (saved.ok && sameProfile) {
          this.profile = nextProfile;
          this.profiles = this.upsertSummary(nextProfile);
          this.prepVersion += 1;
          this.saveStatus = 'saved';
          if (stillActive) {
            this.result = result;
            this.phase = 'result';
            this.sound.play('victory');
            if (result.rewardCoins > 0) {
              this.showToastKey('toastWaveReward', { coins: result.rewardCoins }, 'reward');
            }
            if (resolved.value.coinOverflow) {
              this.showToastKey('errorCoinOverflow', {}, 'error');
            }
          }
        } else if (stillActive) {
          this.failBattlePersistence(result);
        } else if (sameProfile) {
          this.saveStatus = 'error';
          this.showToastKey('toastAutoSaveFailed', {}, 'error');
        }
        this.battleFinishing = false;
        if (this.session) this.battleHud = buildHud(this.session.getState(), this.session);
        this.emit();
      });
      return;
    }

    const comfort = applyDefeatComfort(this.profile, this.now());
    const nextProfile = comfort.ok ? comfort.value : this.profile;
    const comfortCoins = comfort.ok ? DEFEAT_COMFORT_COINS : 0;
    const result: BattleResultView = {
      outcome: 'defeat',
      waveId,
      rewardCoins: 0,
      comfortCoins,
      firstCompletion: false,
      completedAllWaves: false,
      nextWave: nextProfile.currentWave,
      xpPerUnit: 0,
      totalXpAwarded: 0,
      levelUps: [],
      maxLevelReached: false,
      persistenceError: false,
    };
    if (!comfort.ok) {
      this.battleFinishing = false;
      this.result = { ...result, comfortCoins: 0 };
      this.phase = 'result';
      this.sound.play('defeat');
      this.showToastKey(errorKey(comfort.error), {}, 'error');
      if (this.session) this.battleHud = buildHud(this.session.getState(), this.session);
      this.emit();
      return;
    }
    const persistence = this.saveCriticalProfile(nextProfile);
    void persistence.then((saved) => {
      const sameProfile =
        profileToken === this.profileChangeToken &&
        this.profile?.profileId === nextProfile.profileId;
      const stillActive = sameProfile && this.phase === 'battle' && this.battleWaveId === waveId;
      if (saved.ok && sameProfile) {
        this.profile = nextProfile;
        this.profiles = this.upsertSummary(nextProfile);
        this.prepVersion += 1;
        this.saveStatus = 'saved';
        if (stillActive) {
          this.result = result;
          this.phase = 'result';
          this.sound.play('defeat');
          this.showToastKey('toastComfort', { coins: DEFEAT_COMFORT_COINS }, 'info');
        }
      } else if (stillActive) {
        this.failBattlePersistence(result);
      } else if (sameProfile) {
        this.saveStatus = 'error';
        this.showToastKey('toastAutoSaveFailed', {}, 'error');
      }
      this.battleFinishing = false;
      if (this.session) this.battleHud = buildHud(this.session.getState(), this.session);
      this.emit();
    });
  }

  private failBattlePersistence(result: BattleResultView): void {
    this.saveStatus = 'error';
    this.result = {
      ...result,
      rewardCoins: 0,
      comfortCoins: 0,
      xpPerUnit: 0,
      totalXpAwarded: 0,
      levelUps: [],
      maxLevelReached: false,
      persistenceError: true,
    };
    this.phase = 'result';
    this.sound.play('error');
    this.showToastKey('toastAutoSaveFailed', {}, 'error');
  }

  private saveCriticalProfile(profile: PlayerProfile): Promise<Result<void>> {
    if (!this.repository || !this.storageAvailable) {
      this.saveStatus = 'unavailable';
      this.emit();
      return Promise.resolve({ ok: true, value: undefined });
    }
    const repo = this.repository;
    this.saveStatus = 'saving';
    this.emit();
    return this.writes.enqueueBarrier(profile.profileId, () => repo.saveProfile(profile));
  }

  togglePause(): void {
    if (!this.session || this.phase !== 'battle') return;
    const paused = !this.session.isPaused();
    this.session.setPaused(paused);
    if (paused) {
      this.stopBattleLoop();
    } else {
      this.lastFrameTime = 0;
      this.startBattleLoop();
    }
    this.sound.play('click');
    this.battleHud = buildHud(this.session.getState(), this.session);
    this.emit();
  }

  setBattleSpeed(speed: BattleSpeed): void {
    if (!this.profile) return;
    this.updateSettings({ battleSpeed: speed });
    this.sound.play('click');
  }

  surrenderBattle(): void {
    if (this.phase !== 'battle') return;
    this.stopBattle();
    this.phase = 'preparation';
    this.battleHud = null;
    this.result = null;
    this.modal = null;
    this.selectedId = null;
    this.showToastKey('battleSurrendered', {}, 'info');
    this.emit();
  }

  nextWave(): void {
    if (this.phase !== 'result' || !this.result) return;
    this.stopBattleLoop();
    this.session = null;
    this.battleHud = null;
    this.result = null;
    this.battleRoster = [];
    this.battleWaveId = null;
    this.phase = 'preparation';
    this.selectedId = null;
    this.prepVersion += 1;
    this.emit();
  }

  retryBattle(): void {
    if (this.phase !== 'result' || !this.result) return;
    this.nextWave();
  }

  private stopBattle(): void {
    this.stopBattleLoop();
    if (this.endTimer) {
      this.cancelSchedule(this.endTimer);
      this.endTimer = null;
    }
    this.session = null;
    this.battleHud = null;
    this.battleResolved = false;
    this.battleFinishing = false;
    this.battleRoster = [];
    this.battleWaveId = null;
  }

  private stopBattleLoop(): void {
    if (this.rafId !== null) {
      this.cancelFrame(this.rafId);
      this.rafId = null;
    }
  }

  private commitProfile(profile: PlayerProfile, options: { silent?: boolean } = {}): void {
    this.profile = profile;
    this.profiles = this.upsertSummary(profile);
    this.prepVersion += 1;
    this.emit();
    if (!options.silent) {
      this.saveStatus = this.storageAvailable ? 'saving' : 'unavailable';
      this.emit();
    }
    this.persist(profile, options.silent ?? false);
  }

  private persist(profile: PlayerProfile, silent: boolean): void {
    if (!this.repository || !this.storageAvailable) {
      this.saveStatus = 'unavailable';
      this.emit();
      return;
    }
    const repo = this.repository;
    this.writes.enqueueAutosave(
      profile.profileId,
      this.writes.getEpoch(profile.profileId),
      () => repo.saveProfile(profile),
      (saved) => {
        if (this.profile?.profileId !== profile.profileId) return;
        if (saved.ok) {
          this.saveStatus = 'saved';
          this.emit();
        } else {
          this.saveStatus = 'error';
          if (!silent) this.showToastKey('toastAutoSaveFailed', {}, 'error');
          else this.emit();
        }
      },
    );
  }

  saveNow(): void {
    if (!this.profile) return;
    this.saveStatus = this.storageAvailable ? 'saving' : 'unavailable';
    this.emit();
    this.persist(this.profile, false);
  }

  exportSave(): { filename: string; content: string } | null {
    if (!this.profile) return null;
    this.showToastKey('settingsExportSuccess', {}, 'success');
    return {
      filename: t('saveExportFilename'),
      content: serializeEnvelope(this.profile),
    };
  }

  async prepareImport(text: string, fileName: string): Promise<boolean> {
    const parsed = parseProfileFromImport(text);
    if (!parsed.ok) {
      this.showToastKey(errorKey(parsed.error), {}, 'error');
      this.sound.play('error');
      return false;
    }
    const exists = this.profiles.some((profile) => profile.profileId === parsed.value.profileId);
    if (!exists && this.profiles.length >= MAX_PROFILES) {
      this.showToastKey('profileLimit', {}, 'error');
      this.sound.play('error');
      return false;
    }
    this.pendingImport = parsed.value;
    this.pendingImportName = fileName;
    this.modal = 'import-confirm';
    this.emit();
    return true;
  }

  cancelImport(): void {
    this.pendingImport = null;
    this.pendingImportName = null;
    if (this.modal === 'import-confirm') this.modal = 'save';
    this.emit();
  }

  async confirmImport(): Promise<void> {
    const imported = this.pendingImport;
    if (!imported) return;
    this.profileChangeToken += 1;
    if (this.repository && this.storageAvailable) {
      const session = await this.sessionGuard.acquire(imported.profileId);
      if (!session.acquired) {
        this.showToastKey('errorProfileInUse', {}, 'error');
        this.sound.play('error');
        return;
      }
      const repository = this.repository;
      const saved = await this.writes.enqueueBarrier(
        imported.profileId,
        () => repository.saveProfileAndActivate(imported),
        true,
      );
      if (!saved.ok) {
        // A same-ID import never acquires a new lock; releasing here would unlock the active
        // profile held by an earlier successful session and allow a second tab to edit it.
        if (session.newlyAcquired) {
          await this.sessionGuard.release(imported.profileId);
        }
        this.showToastKey(errorKey(saved.error), {}, 'error');
        this.sound.play('error');
        return;
      }
      await this.sessionGuard.releaseOthers(imported.profileId);
    } else {
      this.writes.invalidate(imported.profileId);
    }
    this.profile = imported;
    this.profiles = this.upsertSummary(imported);
    this.pendingImport = null;
    this.pendingImportName = null;
    this.modal = null;
    this.screen = 'game';
    this.phase = 'preparation';
    this.selectedId = null;
    this.prepVersion += 1;
    this.saveStatus = this.storageAvailable ? 'saved' : 'unavailable';
    this.syncSound(imported);
    this.showToastKey('settingsImportSuccess', {}, 'success');
    this.sound.play('reward');
    this.emit();
  }

  private pushVisualEvent(type: VisualEvent['type'], col: number, row: number): void {
    this.visualEventCounter += 1;
    this.visualEvents.push({ id: this.visualEventCounter, type, col, row });
    if (this.visualEvents.length > 20) this.visualEvents.shift();
  }

  drainVisualEvents(): readonly VisualEvent[] {
    const events = this.visualEvents;
    this.visualEvents = [];
    return events;
  }

  getPrepView(): PrepView {
    if (!this.profile) {
      return {
        version: this.prepVersion,
        selectedId: null,
        characters: [],
        enemies: [],
        validMoveCells: [],
        mergeTargets: [],
        reducedMotion: true,
      };
    }
    const selected =
      this.profile.characters.find((character) => character.id === this.selectedId) ?? null;
    const moves = selected
      ? emptyAlliedCells(this.profile.characters).map((cell) => ({ ...cell }))
      : [];
    const mergeTargets = selected
      ? this.profile.characters
          .filter(
            (character) =>
              character.id !== selected.id &&
              character.typeId === selected.typeId &&
              character.mergeRank === selected.mergeRank &&
              character.mergeRank < MAX_MERGE_RANK,
          )
          .map((character) => ({
            col: character.col,
            row: character.row,
            characterId: character.id,
          }))
      : [];
    const wave = getWave(this.profile.currentWave);
    return {
      version: this.prepVersion,
      selectedId: this.selectedId,
      characters: this.profile.characters,
      enemies: wave?.enemies ?? [],
      validMoveCells: moves,
      mergeTargets,
      reducedMotion: this.profile.settings.reducedMotion,
    };
  }

  getBattleState(): BattleState | null {
    return this.session?.getState() ?? null;
  }

  drainBattleEvents(): readonly BattleEvent[] {
    return this.session?.drainEvents() ?? [];
  }

  playSound(name: SoundName): void {
    if (this.profile && !this.profile.settings.soundEnabled) return;
    this.sound.play(name);
  }

  notify(messageKey: TranslationKey, tone: ToastTone = 'info', vars: TranslationVars = {}): void {
    this.showToastKey(messageKey, vars, tone);
  }

  private syncSound(profile?: PlayerProfile): void {
    const enabled = profile ? profile.settings.soundEnabled : true;
    this.sound.setEnabled(enabled);
  }

  private showToastKey(
    key: TranslationKey,
    vars: TranslationVars = {},
    tone: ToastTone = 'info',
  ): void {
    this.toastCounter += 1;
    const toast: ToastView = {
      id: this.toastCounter,
      message: t(key, vars),
      tone,
    };
    this.toast = toast;
    if (this.toastTimer) this.cancelSchedule(this.toastTimer);
    this.toastTimer = this.schedule(() => {
      this.toastTimer = null;
      if (this.toast?.id === toast.id) {
        this.toast = null;
        this.emit();
      }
    }, 3600);
    this.emit();
  }

  dismissToast(): void {
    if (this.toastTimer) {
      this.cancelSchedule(this.toastTimer);
      this.toastTimer = null;
    }
    this.toast = null;
    this.emit();
  }

  dispose(): void {
    this.stopBattle();
    if (this.toastTimer) this.cancelSchedule(this.toastTimer);
    this.listeners.clear();
  }
}
