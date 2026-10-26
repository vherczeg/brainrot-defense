import Phaser from 'phaser';
import type { GameController, VisualEvent } from '../../../app/controller';
import { CHARACTER_DEFINITIONS } from '../../../game/domain/characters';
import { ENEMY_DEFINITIONS } from '../../../game/domain/enemies';
import { characterLevelFromXp } from '../../../game/domain/progression';
import {
  ALLY_ROW_START,
  BOARD_COLS,
  BOARD_ROWS,
  MAX_MERGE_RANK,
  type CharacterTypeId,
  type EnemyTypeId,
} from '../../../game/domain/types';
import type { BattleEvent, BattleState, BattleUnit } from '../../../game/simulation/types';
import {
  LASER_CROCODILE_ANIMATIONS,
  LASER_CROCODILE_DISPLAY_WIDTH,
  LASER_CROCODILE_EFFECTS,
  LASER_CROCODILE_ORIGIN,
  LASER_CROCODILE_MUZZLE_OFFSET,
  laserCrocodileAnimationKey,
  laserCrocodileTier,
  preloadLaserCrocodile,
  registerLaserCrocodileAnimations,
} from '../laserCrocodile';
import { LaserAttackRelease } from '../laserAttackRelease';
import { playLaserCrocodileDeathOnce } from '../laserCrocodileDeath';
import { LaserCrocodileLocomotion } from '../laserCrocodileLocomotion';
import {
  attackLinkColor,
  easeDisplayHp,
  healthBarMetrics,
  healthBarSegments,
} from '../battleReadability';
import {
  LIGHTNING_SCORPION_ANIMATIONS,
  LIGHTNING_SCORPION_DISPLAY_WIDTH,
  LIGHTNING_SCORPION_EFFECTS,
  LIGHTNING_SCORPION_ORIGIN,
  lightningScorpionAnimationKey,
  lightningScorpionTier,
  preloadLightningScorpion,
  registerLightningScorpionAnimations,
} from '../lightningScorpion';
import {
  ARMORED_SNAIL_ANIMATIONS,
  ARMORED_SNAIL_DISPLAY_WIDTH,
  ARMORED_SNAIL_EFFECT_ANIMATIONS,
  ARMORED_SNAIL_EFFECTS,
  ARMORED_SNAIL_ENEMY_ID,
  ARMORED_SNAIL_ORIGIN,
  armoredSnailAnimationKey,
  preloadArmoredSnail,
  preloadArmoredSnailEffects,
  registerArmoredSnailAnimations,
  registerArmoredSnailEffectsAnimations,
} from '../armoredSnail';
import {
  MINI_BRAINROT_ANIMATIONS,
  MINI_BRAINROT_DISPLAY_WIDTH,
  MINI_BRAINROT_ORIGIN,
  miniBrainrotAnimationKey,
  preloadMiniBrainrot,
  registerMiniBrainrotAnimations,
} from '../miniBrainrot';
import {
  SHADOW_RUNNER_ANIMATIONS,
  SHADOW_RUNNER_DISPLAY_WIDTH,
  SHADOW_RUNNER_ENEMY_ID,
  SHADOW_RUNNER_ORIGIN,
  preloadShadowRunner,
  registerShadowRunnerAnimations,
  shadowRunnerAnimationKey,
} from '../shadowRunner';
import {
  GREEN_VENOM_FALCON_ANIMATIONS,
  GREEN_VENOM_FALCON_DISPLAY_WIDTH,
  GREEN_VENOM_FALCON_EFFECTS,
  GREEN_VENOM_FALCON_ENEMY_ID,
  GREEN_VENOM_FALCON_ORIGIN,
  GREEN_VENOM_FALCON_PROJECTILE_EFFECTS,
  greenVenomFalconAnimationKey,
  type GreenVenomFalconAnimationState,
  preloadGreenVenomFalcon,
  registerGreenVenomFalconAnimations,
} from '../greenVenomFalcon';
import {
  MEGA_BRAINROT_GORILLA_ANIMATIONS,
  MEGA_BRAINROT_GORILLA_DISPLAY_WIDTH,
  MEGA_BRAINROT_GORILLA_EFFECTS,
  MEGA_BRAINROT_GORILLA_ENEMY_ID,
  MEGA_BRAINROT_GORILLA_ORIGIN,
  megaBrainrotGorillaAnimationKey,
  preloadMegaBrainrotGorilla,
  registerMegaBrainrotGorillaAnimations,
} from '../megaBrainrotGorilla';
import {
  CHAOS_ARENA_FLOOR_TEXTURE_KEY,
  chaosArenaFloorFrame,
  preloadChaosArena,
} from '../chaosArena';
import {
  ARENA_SPAWN_PORTAL_DISPLAY_SIZE,
  arenaSpawnPortalAnimationKey,
  preloadArenaSpawnPortal,
  registerArenaSpawnPortalAnimations,
} from '../arenaSpawnPortal';
import { t } from '../../../localization';

export const SCENE_WIDTH = 760;
export const SCENE_HEIGHT = 640;
const BOARD_X = 56;
const BOARD_Y = 70;
const CELL = 108;
const BOARD_WIDTH = BOARD_COLS * CELL;
const BOARD_HEIGHT = BOARD_ROWS * CELL;
const GAP = 4;
const UNIT_FEET_Y = 30;
const SPAWN_PORTAL_X = BOARD_X + BOARD_WIDTH + 32;
const SPAWN_PORTAL_Y = BOARD_Y + CELL * 0.5;
const ANIMATED_UNIT_ANIMATION_KEYS = new Set(
  [
    ...LASER_CROCODILE_ANIMATIONS,
    ...LIGHTNING_SCORPION_ANIMATIONS,
    ...MINI_BRAINROT_ANIMATIONS,
    ...ARMORED_SNAIL_ANIMATIONS,
    ...ARMORED_SNAIL_EFFECT_ANIMATIONS,
    ...SHADOW_RUNNER_ANIMATIONS,
    ...MEGA_BRAINROT_GORILLA_ANIMATIONS,
    ...GREEN_VENOM_FALCON_ANIMATIONS,
  ].map((asset) => asset.key),
);

type UnitAnimationState = 'idle' | 'walk' | 'attack' | 'hurt';
type UnitPlayableState = UnitAnimationState | 'fly' | 'claw' | 'poison' | 'spin' | 'spin-break';
type UnitLocomotion = 'idle' | 'walk';
type UnitAction = 'attack' | 'hurt' | 'poison';

interface AnimatedCharacterEffects {
  readonly projectile: string;
  readonly muzzle: string;
  readonly impact: string;
}

interface AnimatedCharacterVisual {
  readonly animationKey: (state: UnitPlayableState) => string;
  readonly origin: { readonly x: number; readonly y: number };
  readonly displayWidth: number;
  readonly effects?: AnimatedCharacterEffects;
  readonly deathKey?: string;
}

interface Cell {
  readonly col: number;
  readonly row: number;
}

interface UnitActionHandler {
  readonly event: string;
  readonly handler: () => void;
}

interface UnitView {
  readonly container: Phaser.GameObjects.Container;
  readonly health: Phaser.GameObjects.Graphics;
  readonly team: 'ally' | 'enemy';
  readonly typeId: CharacterTypeId | EnemyTypeId;
  readonly sprite: Phaser.GameObjects.Sprite | null;
  readonly visual: AnimatedCharacterVisual | null;
  readonly baseX: number;
  readonly baseY: number;
  readonly phaseOffset: number;
  locomotion: UnitLocomotion;
  action: UnitAction | null;
  actionHandler: UnitActionHandler | null;
  laserRelease: LaserAttackRelease | null;
  deathCleanup: (() => void) | null;
  locomotionTween: LaserCrocodileLocomotion | null;
  spinAura: Phaser.GameObjects.Container | null;
  animationOverride: UnitPlayableState | null;
  pendingHurt: boolean;
  lastX: number;
  lastY: number;
  nextTrailAt: number;
  lastHp: number;
  maxHp: number;
  displayHp: number;
  alive: boolean;
}

type Mode = 'prep' | 'battle' | 'none';

function basicAnimationState(state: UnitPlayableState): UnitAnimationState {
  switch (state) {
    case 'fly':
      return 'walk';
    case 'claw':
    case 'poison':
      return 'attack';
    case 'spin':
    case 'spin-break':
      return 'idle';
    default:
      return state;
  }
}

function falconAnimationState(state: UnitPlayableState): GreenVenomFalconAnimationState {
  if (state === 'walk') return 'fly';
  if (state === 'attack') return 'claw';
  return state;
}

function animatedCharacterVisual(
  typeId: CharacterTypeId,
  mergeRank: number,
): AnimatedCharacterVisual | null {
  if (typeId === 'laser-crocodile') {
    const tier = laserCrocodileTier(mergeRank);
    return {
      animationKey: (state) => laserCrocodileAnimationKey(tier, basicAnimationState(state)),
      origin: LASER_CROCODILE_ORIGIN,
      displayWidth: LASER_CROCODILE_DISPLAY_WIDTH,
      effects: LASER_CROCODILE_EFFECTS,
      deathKey: laserCrocodileAnimationKey(tier, 'death'),
    };
  }
  if (typeId === 'lightning-scorpion') {
    const tier = lightningScorpionTier(mergeRank);
    return {
      animationKey: (state) => lightningScorpionAnimationKey(tier, basicAnimationState(state)),
      origin: LIGHTNING_SCORPION_ORIGIN,
      displayWidth: LIGHTNING_SCORPION_DISPLAY_WIDTH,
      effects: LIGHTNING_SCORPION_EFFECTS,
    };
  }
  return null;
}

function animatedEnemyVisual(typeId: EnemyTypeId): AnimatedCharacterVisual | null {
  if (typeId === 'mini-brainrot') {
    return {
      animationKey: (state) => miniBrainrotAnimationKey(basicAnimationState(state)),
      origin: MINI_BRAINROT_ORIGIN,
      displayWidth: MINI_BRAINROT_DISPLAY_WIDTH,
    };
  }
  if (typeId === ARMORED_SNAIL_ENEMY_ID) {
    return {
      animationKey: (state) => armoredSnailAnimationKey(basicAnimationState(state)),
      origin: ARMORED_SNAIL_ORIGIN,
      displayWidth: ARMORED_SNAIL_DISPLAY_WIDTH,
    };
  }
  if (typeId === SHADOW_RUNNER_ENEMY_ID) {
    return {
      animationKey: (state) => shadowRunnerAnimationKey(basicAnimationState(state)),
      origin: SHADOW_RUNNER_ORIGIN,
      displayWidth: SHADOW_RUNNER_DISPLAY_WIDTH,
    };
  }
  if (typeId === MEGA_BRAINROT_GORILLA_ENEMY_ID) {
    return {
      animationKey: (state) => megaBrainrotGorillaAnimationKey(basicAnimationState(state)),
      origin: MEGA_BRAINROT_GORILLA_ORIGIN,
      displayWidth: MEGA_BRAINROT_GORILLA_DISPLAY_WIDTH,
    };
  }
  if (typeId === GREEN_VENOM_FALCON_ENEMY_ID) {
    return {
      animationKey: (state) => greenVenomFalconAnimationKey(falconAnimationState(state)),
      origin: GREEN_VENOM_FALCON_ORIGIN,
      displayWidth: GREEN_VENOM_FALCON_DISPLAY_WIDTH,
      deathKey: greenVenomFalconAnimationKey('death'),
    };
  }
  return null;
}

function cellCenterX(col: number): number {
  return BOARD_X + (col + 0.5) * CELL;
}

function cellCenterY(row: number): number {
  return BOARD_Y + (row + 0.5) * CELL;
}

function gridToPixel(x: number, y: number): { px: number; py: number } {
  return { px: BOARD_X + x * CELL, py: BOARD_Y + y * CELL };
}

function isCellEqual(a: Cell, b: Cell): boolean {
  return a.col === b.col && a.row === b.row;
}

export class BattleScene extends Phaser.Scene {
  private readonly controller: GameController;
  private mode: Mode = 'none';
  private lastPrepVersion = -1;
  private readonly unitViews = new Map<string, UnitView>();
  private previewViews: Phaser.GameObjects.Container[] = [];
  private terrainLayer: Phaser.GameObjects.Container | null = null;
  private portalLayer: Phaser.GameObjects.Container | null = null;
  private staticBoard: Phaser.GameObjects.Graphics | null = null;
  private groundEffectsLayer: Phaser.GameObjects.Container | null = null;
  private highlightLayer: Phaser.GameObjects.Graphics | null = null;
  private hoverLayer: Phaser.GameObjects.Graphics | null = null;
  private unitsLayer: Phaser.GameObjects.Container | null = null;
  private previewLayer: Phaser.GameObjects.Container | null = null;
  private effectsLayer: Phaser.GameObjects.Container | null = null;
  private waveLabel: Phaser.GameObjects.Text | null = null;
  private dragMarker: Phaser.GameObjects.Container | null = null;
  private draggingId: string | null = null;
  private dragOrigin: Cell | null = null;
  private pendingCellTap: Cell | null = null;
  private pointerDownAt: { x: number; y: number } | null = null;
  private isDragging = false;
  private selectedWasSet = false;

  constructor(controller: GameController) {
    super({ key: 'BattleScene' });
    this.controller = controller;
  }

  preload(): void {
    const baseUrl = import.meta.env.BASE_URL;
    preloadLaserCrocodile(this, baseUrl);
    preloadLightningScorpion(this, baseUrl);
    preloadMiniBrainrot(this, baseUrl);
    preloadArmoredSnail(this, baseUrl);
    preloadArmoredSnailEffects(this, baseUrl);
    preloadShadowRunner(this, baseUrl);
    preloadMegaBrainrotGorilla(this, baseUrl);
    preloadGreenVenomFalcon(this, baseUrl);
    preloadChaosArena(this, baseUrl);
    preloadArenaSpawnPortal(this, baseUrl);
  }

  create(): void {
    registerLaserCrocodileAnimations(this);
    registerLightningScorpionAnimations(this);
    registerMiniBrainrotAnimations(this);
    registerArmoredSnailAnimations(this);
    registerArmoredSnailEffectsAnimations(this);
    registerShadowRunnerAnimations(this);
    registerMegaBrainrotGorillaAnimations(this);
    registerGreenVenomFalconAnimations(this);
    registerArenaSpawnPortalAnimations(this);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.terrainLayer = this.add.container(0, 0).setDepth(-10);
    this.drawTerrain();
    this.portalLayer = this.add.container(0, 0).setDepth(-5);
    this.drawSpawnPortal();
    this.staticBoard = this.add.graphics();
    this.drawStaticBoard();
    this.groundEffectsLayer = this.add.container(0, 0);
    this.highlightLayer = this.add.graphics();
    this.hoverLayer = this.add.graphics();
    this.previewLayer = this.add.container(0, 0);
    this.unitsLayer = this.add.container(0, 0);
    this.effectsLayer = this.add.container(0, 0);
    this.waveLabel = this.add
      .text(BOARD_X, 16, '', {
        fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0, 0);
    this.add
      .text(BOARD_X + BOARD_WIDTH, 20, t('canvasEnemyZone'), {
        fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ff8aa5',
      })
      .setOrigin(1, 0);
    this.add
      .text(BOARD_X + BOARD_WIDTH / 2, BOARD_Y + BOARD_HEIGHT + 18, t('canvasAllyZone'), {
        fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#75ffc2',
      })
      .setOrigin(0.5, 0);

    // Apply pause/speed before Phaser advances its next animation frame.
    const unsubscribeClock = this.controller.subscribe(() => this.syncAnimationClock());
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('gameout', this.clearPointerState, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribeClock();
      this.input.off('pointerdown', this.handlePointerDown, this);
      this.input.off('pointermove', this.handlePointerMove, this);
      this.input.off('pointerup', this.handlePointerUp, this);
      this.input.off('gameout', this.clearPointerState, this);
      for (const view of this.unitViews.values()) {
        view.deathCleanup?.();
        view.deathCleanup = null;
        view.laserRelease?.cancel();
        view.laserRelease = null;
        view.locomotionTween?.stop();
        this.clearSpinAura(view);
      }
    });
  }

  update(time: number): void {
    const snapshot = this.controller.getSnapshot();
    const desiredMode: Mode = snapshot.phase === 'preparation' ? 'prep' : 'battle';
    if (desiredMode !== this.mode) {
      this.mode = desiredMode;
      this.clearPointerState();
      if (desiredMode === 'prep') {
        this.renderPrep(true);
      } else {
        this.prepareBattle();
      }
    }

    this.syncAnimationClock();

    if (this.mode === 'prep') {
      this.updatePrep(time);
    } else {
      this.updateBattle();
    }
  }

  private syncAnimationClock(): void {
    const snapshot = this.controller.getSnapshot();
    const battle = snapshot.battle;
    const running = snapshot.phase === 'battle' && battle?.status === 'running';
    const paused = running && (battle?.paused ?? false);
    const speed = running ? (battle?.speed ?? 1) : 1;
    const scale = paused ? 0 : speed;
    this.anims.globalTimeScale = scale;
    this.tweens.timeScale = scale;
    this.time.timeScale = scale;
  }

  private drawTerrain(): void {
    const layer = this.terrainLayer;
    if (!layer) return;
    layer.removeAll(true);
    const size = CELL - GAP * 2;
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const image = this.add
          .image(
            cellCenterX(col),
            cellCenterY(row),
            CHAOS_ARENA_FLOOR_TEXTURE_KEY,
            chaosArenaFloorFrame(col, row, ALLY_ROW_START),
          )
          .setDisplaySize(size, size);
        layer.add(image);
      }
    }
  }

  private drawSpawnPortal(): void {
    const layer = this.portalLayer;
    if (!layer) return;
    const idleKey = arenaSpawnPortalAnimationKey('idle');
    const portal = this.add
      .sprite(SPAWN_PORTAL_X, SPAWN_PORTAL_Y, idleKey, 0)
      .setOrigin(0.5)
      .setDisplaySize(ARENA_SPAWN_PORTAL_DISPLAY_SIZE, ARENA_SPAWN_PORTAL_DISPLAY_SIZE)
      .setAlpha(0.9);
    portal.play(idleKey);
    layer.add(portal);
  }

  private drawStaticBoard(): void {
    const g = this.staticBoard;
    if (!g) return;
    g.clear();
    g.fillStyle(0x080d20, 0.45);
    g.fillRoundedRect(BOARD_X - 10, BOARD_Y - 10, BOARD_WIDTH + 20, BOARD_HEIGHT + 20, 26);
    g.lineStyle(2, 0x34447f, 0.9);
    g.strokeRoundedRect(BOARD_X - 10, BOARD_Y - 10, BOARD_WIDTH + 20, BOARD_HEIGHT + 20, 26);

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const x = BOARD_X + col * CELL + GAP;
        const y = BOARD_Y + row * CELL + GAP;
        const size = CELL - GAP * 2;
        const isEnemy = row < ALLY_ROW_START;
        g.fillStyle(isEnemy ? 0x431733 : 0x0d3b2c, isEnemy ? 0.3 : 0.34);
        g.fillRoundedRect(x, y, size, size, 14);
        g.lineStyle(1.5, isEnemy ? 0x78254d : 0x1b6c50, 0.85);
        g.strokeRoundedRect(x, y, size, size, 14);
      }
    }

    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#93a3d8',
    };
    for (let col = 0; col < BOARD_COLS; col += 1) {
      this.add
        .text(cellCenterX(col), BOARD_Y - 15, String.fromCharCode(65 + col), labelStyle)
        .setOrigin(0.5, 1);
    }
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      this.add.text(BOARD_X - 20, cellCenterY(row), String(row + 1), labelStyle).setOrigin(0.5);
    }
  }

  private clearUnitViews(): void {
    for (const view of this.unitViews.values()) {
      if (view.sprite && view.actionHandler) {
        view.sprite.off(view.actionHandler.event, view.actionHandler.handler);
      }
      view.deathCleanup?.();
      view.deathCleanup = null;
      view.laserRelease?.cancel();
      view.laserRelease = null;
      view.locomotionTween?.stop();
      this.clearSpinAura(view);
      view.container.destroy(true);
    }
    this.unitViews.clear();
    for (const preview of this.previewViews) preview.destroy(true);
    this.previewViews = [];
  }

  private clearSpinAura(view: UnitView): void {
    if (!view.spinAura) return;
    this.tweens.killTweensOf(view.spinAura);
    view.spinAura.destroy(true);
    view.spinAura = null;
  }

  private prepareBattle(): void {
    this.clearUnitViews();
    this.highlightLayer?.clear();
    this.hoverLayer?.clear();
    this.clearDrag();
    this.controller.drainVisualEvents();
    const snapshot = this.controller.getSnapshot();
    this.waveLabel?.setText(
      t('canvasBattleTitle', { wave: snapshot.activeProfile?.currentWave ?? 1 }),
    );
    this.selectedWasSet = false;
  }

  private renderPrep(force = false): void {
    const view = this.controller.getPrepView();
    if (!force && view.version === this.lastPrepVersion) return;
    this.lastPrepVersion = view.version;
    this.clearUnitViews();
    this.highlightLayer?.clear();
    this.hoverLayer?.clear();
    this.selectedWasSet = false;

    const snapshot = this.controller.getSnapshot();
    this.waveLabel?.setText(
      t('canvasWaveLabel', { wave: snapshot.activeProfile?.currentWave ?? 1 }),
    );

    const selected = view.characters.find((character) => character.id === view.selectedId);
    if (selected) {
      this.drawCellOutline(selected.col, selected.row, 0xffd447, 0.95, 3);
    }
    for (const cell of view.validMoveCells) {
      this.drawCellFill(cell.col, cell.row, 0x4cff9a, 0.11);
      this.drawCellOutline(cell.col, cell.row, 0x4cff9a, 0.65, 2);
    }
    for (const target of view.mergeTargets) {
      this.drawCellFill(target.col, target.row, 0xc067ff, 0.16);
      this.drawCellOutline(target.col, target.row, 0xc067ff, 0.95, 3);
    }

    for (const enemy of view.enemies) {
      const preview = this.createUnitVisual(
        {
          id: `preview-${enemy.typeId}-${enemy.col}-${enemy.row}`,
          team: 'enemy',
          typeId: enemy.typeId,
          level: enemy.level,
          mergeRank: 0,
          col: enemy.col + 0.5,
          row: enemy.row + 0.5,
        },
        { ghost: true },
      );
      preview.setAlpha(0.42);
      preview.setData('baseY', preview.y);
      this.previewLayer?.add(preview);
      this.previewViews.push(preview);
    }

    view.characters.forEach((character, index) => {
      const container = this.createUnitVisual(
        {
          id: character.id,
          team: 'ally',
          typeId: character.typeId,
          level: characterLevelFromXp(character.totalXp),
          mergeRank: character.mergeRank,
          col: character.col + 0.5,
          row: character.row + 0.5,
        },
        { selected: character.id === view.selectedId },
      );
      const health = container.getData('health') as Phaser.GameObjects.Graphics | undefined;
      health?.setVisible(false);
      this.unitsLayer?.add(container);
      const baseX = container.x;
      const baseY = container.y;
      const sprite = container.getData('animatedCharacterSprite') as
        Phaser.GameObjects.Sprite | undefined;
      const visual = container.getData('animatedCharacterVisual') as
        AnimatedCharacterVisual | undefined;
      const locomotionTween = container.getData('locomotionTween') as
        LaserCrocodileLocomotion | undefined;
      const viewEntry: UnitView = {
        container,
        health: health ?? this.add.graphics(),
        team: 'ally',
        typeId: character.typeId,
        sprite: sprite ?? null,
        visual: visual ?? null,
        baseX,
        baseY,
        phaseOffset: index * 0.9,
        locomotion: 'idle',
        action: null,
        actionHandler: null,
        laserRelease: null,
        deathCleanup: null,
        locomotionTween: locomotionTween ?? null,
        spinAura: null,
        animationOverride: null,
        pendingHurt: false,
        lastX: character.col + 0.5,
        lastY: character.row + 0.5,
        nextTrailAt: 0,
        lastHp: 1,
        maxHp: 1,
        displayHp: 1,
        alive: true,
      };
      this.unitViews.set(character.id, viewEntry);
    });
  }

  private createUnitVisual(
    spec: {
      id: string;
      team: 'ally' | 'enemy';
      typeId: CharacterTypeId | EnemyTypeId;
      level: number;
      mergeRank: number;
      col: number;
      row: number;
    },
    options: { ghost?: boolean; selected?: boolean } = {},
  ): Phaser.GameObjects.Container {
    const isBoss =
      spec.team === 'enemy' && (ENEMY_DEFINITIONS[spec.typeId as EnemyTypeId]?.isBoss ?? false);
    const animated =
      spec.team === 'ally'
        ? animatedCharacterVisual(spec.typeId as CharacterTypeId, spec.mergeRank)
        : animatedEnemyVisual(spec.typeId as EnemyTypeId);
    // A failed/missing spritesheet must not break the battle: fall back to procedural art.
    const animatedReady = animated
      ? this.textures.exists(animated.animationKey('idle')) &&
        this.anims.exists(animated.animationKey('idle'))
      : false;
    const progressionLevel = spec.team === 'ally' ? spec.mergeRank : spec.level;
    const levelScale = 1 + Math.min(progressionLevel - 1, 9) * 0.03;
    const scale = (isBoss ? 1.32 : levelScale) * (options.ghost ? 0.82 : 1);
    const x = BOARD_X + spec.col * CELL;
    const y = BOARD_Y + spec.row * CELL;
    const container = this.add.container(x, y);
    container.setData('unitId', spec.id);
    container.setScale(scale);
    container.setDepth(100 + y);

    const art = this.add.graphics();
    if (options.selected) {
      art.fillStyle(0xffd447, 0.16);
      art.fillCircle(0, 0, 46);
      art.lineStyle(3, 0xffd447, 0.9);
      art.strokeCircle(0, 0, 46);
    }
    art.fillStyle(0x020617, 0.45);
    art.fillEllipse(0, 30, 62, 14);

    if (spec.team === 'ally') {
      if (animatedReady) {
        this.drawAllyAura(art, spec.typeId as CharacterTypeId, spec.mergeRank);
      } else {
        this.drawAllyArt(art, spec.typeId as CharacterTypeId, spec.mergeRank);
      }
    } else {
      if (!animatedReady) this.drawEnemyArt(art, spec.typeId as EnemyTypeId, spec.level, isBoss);
      if (!options.ghost) {
        art.lineStyle(2, 0xff5a7a, 0.35);
        art.strokeCircle(0, 2, 44);
      }
    }
    container.add(art);

    if (animated && animatedReady) {
      const idleKey = animated.animationKey('idle');
      const sprite = this.add
        .sprite(0, UNIT_FEET_Y, idleKey, 0)
        .setOrigin(animated.origin.x, animated.origin.y)
        .setDisplaySize(animated.displayWidth, animated.displayWidth);
      sprite.play(idleKey);
      container.add(sprite);
      container.setData('animatedCharacterSprite', sprite);
      container.setData('animatedCharacterVisual', animated);
      if (spec.typeId === 'laser-crocodile') {
        const locomotion = new LaserCrocodileLocomotion({ sprite, tweens: this.tweens });
        if (!this.prefersReducedMotion()) locomotion.play('idle');
        container.setData('locomotionTween', locomotion);
      }
    }

    const badge = this.add.graphics();
    badge.fillStyle(0xffd447, 1);
    badge.fillCircle(28, 24, isBoss ? 17 : 14);
    badge.lineStyle(2, 0x4a2c00, 1);
    badge.strokeCircle(28, 24, isBoss ? 17 : 14);
    container.add(badge);
    const badgeValue = spec.team === 'ally' ? spec.mergeRank : spec.level;
    const badgeText = this.add
      .text(28, 24, String(badgeValue), {
        fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
        fontSize: isBoss ? '17px' : '15px',
        fontStyle: 'bold',
        color: '#3b2400',
      })
      .setOrigin(0.5);
    container.add(badgeText);

    if (spec.team === 'ally' && spec.mergeRank >= MAX_MERGE_RANK) {
      const crown = this.add
        .text(0, -48, '★', {
          fontFamily: '"Trebuchet MS", sans-serif',
          fontSize: '20px',
          color: '#ffe86b',
        })
        .setOrigin(0.5);
      container.add(crown);
    }

    if (isBoss) {
      const bossTag = this.add
        .text(0, -54, t('canvasBoss'), {
          fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#ffe86b',
          stroke: '#3a0c33',
          strokeThickness: 4,
        })
        .setOrigin(0.5);
      container.add(bossTag);
    }

    const health = this.add.graphics();
    health.setVisible(false);
    container.add(health);
    container.setData('health', health);
    return container;
  }

  private drawAllyAura(
    g: Phaser.GameObjects.Graphics,
    typeId: CharacterTypeId,
    mergeRank: number,
  ): void {
    if (mergeRank < 4) return;
    const colors = CHARACTER_DEFINITIONS[typeId].colors;
    g.lineStyle(3, colors.accent, 0.55);
    g.strokeCircle(0, 2, 40 + Math.min(mergeRank, 10));
  }

  private drawAllyArt(
    g: Phaser.GameObjects.Graphics,
    typeId: CharacterTypeId,
    mergeRank: number,
  ): void {
    this.drawAllyAura(g, typeId, mergeRank);
    const colors = CHARACTER_DEFINITIONS[typeId].colors;
    g.fillStyle(colors.secondary, 1);
    g.fillEllipse(-6, 6, 52, 34);
    g.fillStyle(colors.primary, 1);
    g.fillEllipse(1, 2, 48, 34);
    g.fillStyle(colors.secondary, 1);
    g.fillCircle(-24, -10, 10);
    g.fillCircle(20, -10, 10);
    g.fillStyle(colors.primary, 1);
    g.fillCircle(-24, -10, 7);
    g.fillCircle(20, -10, 7);
    g.fillStyle(colors.primary, 1);
    g.fillTriangle(24, 14, 38, 22, 20, 24);
    g.fillTriangle(30, 4, 42, 0, 36, 14);
    g.fillStyle(0xd8fbff, 1);
    g.fillCircle(-4, 0, 6);
    g.fillCircle(10, 0, 6);
    g.fillStyle(0x1f1680, 1);
    g.fillCircle(-4, 0, 2.6);
    g.fillCircle(10, 0, 2.6);
    g.lineStyle(3, colors.accent, 1);
    g.beginPath();
    g.moveTo(-30, 0);
    g.lineTo(-38, -8);
    g.lineTo(-30, -14);
    g.strokePath();
    g.fillStyle(colors.accent, 1);
    g.fillTriangle(-42, -18, -34, -12, -40, -4);
  }

  private drawEnemyArt(
    g: Phaser.GameObjects.Graphics,
    typeId: EnemyTypeId,
    level: number,
    isBoss: boolean,
  ): void {
    const colors = ENEMY_DEFINITIONS[typeId].colors;
    if (typeId === 'green-venom-falcon') {
      // Placeholder procedural art until the final Green Venom Falcon spritesheet exists.
      // See docs/green-venom-falcon/ASSET_GUIDE.txt for the missing asset specification.
      g.fillStyle(colors.secondary, 1);
      g.fillTriangle(-30, -6, -58, -34, -14, -22);
      g.fillTriangle(30, -6, 58, -34, 14, -22);
      g.fillStyle(colors.primary, 1);
      g.fillEllipse(0, 2, 58, 46);
      g.fillTriangle(-20, 20, -4, 20, -12, 34);
      g.fillTriangle(20, 20, 4, 20, 12, 34);
      g.fillCircle(0, -20, 22);
      g.fillStyle(colors.secondary, 1);
      g.fillTriangle(-16, -26, -24, -42, -4, -34);
      g.fillTriangle(16, -26, 24, -42, 4, -34);
      g.fillStyle(colors.accent, 1);
      g.fillTriangle(-5, -16, 5, -16, 0, -4);
      g.fillCircle(-9, -24, 4);
      g.fillCircle(9, -24, 4);
      g.fillStyle(0x0a1207, 1);
      g.fillCircle(-9, -24, 2);
      g.fillCircle(9, -24, 2);
      g.lineStyle(5, 0x070707, 1);
      g.beginPath();
      g.moveTo(-18, 22);
      g.lineTo(-24, 40);
      g.lineTo(-34, 48);
      g.moveTo(-18, 22);
      g.lineTo(-10, 42);
      g.lineTo(-4, 50);
      g.moveTo(18, 22);
      g.lineTo(24, 40);
      g.lineTo(34, 48);
      g.moveTo(18, 22);
      g.lineTo(10, 42);
      g.lineTo(4, 50);
      g.strokePath();
      g.fillStyle(0x070707, 1);
      g.fillTriangle(-36, 48, -28, 42, -28, 54);
      g.fillTriangle(-6, 50, 2, 44, 2, 56);
      g.fillTriangle(36, 48, 28, 42, 28, 54);
      g.fillTriangle(6, 50, -2, 44, -2, 56);
      g.fillStyle(colors.accent, 0.9);
      g.fillCircle(26, 10, 5);
      g.fillCircle(32, 18, 3.5);
      g.lineStyle(3, colors.accent, 0.75);
      g.strokeCircle(0, 0, 46);
      return;
    }
    if (isBoss) {
      g.fillStyle(colors.secondary, 1);
      g.fillCircle(-26, 22, 16);
      g.fillCircle(26, 22, 16);
      g.fillStyle(colors.primary, 1);
      g.fillEllipse(0, 6, 60, 54);
      g.fillCircle(0, -18, 30);
      g.fillStyle(colors.secondary, 1);
      g.fillTriangle(-22, -38, -34, -58, -12, -44);
      g.fillTriangle(22, -38, 34, -58, 12, -44);
      g.fillStyle(colors.accent, 1);
      g.fillCircle(-11, -22, 5);
      g.fillCircle(11, -22, 5);
      g.fillStyle(0x1c0618, 1);
      g.fillCircle(-11, -22, 2.4);
      g.fillCircle(11, -22, 2.4);
      g.fillStyle(0xffffff, 0.85);
      g.fillTriangle(-14, -6, -6, -6, -10, 2);
      g.fillTriangle(6, -6, 14, -6, 10, 2);
      g.lineStyle(3, colors.accent, 0.7);
      g.strokeCircle(0, 2, 48);
      return;
    }
    if (typeId === 'mini-brainrot') {
      g.fillStyle(colors.secondary, 1);
      g.fillTriangle(-14, -22, -24, -38, -4, -30);
      g.fillTriangle(14, -22, 24, -38, 4, -30);
      g.fillStyle(colors.primary, 1);
      g.fillEllipse(0, 4, 58, 52);
      g.fillStyle(0xffffff, 0.92);
      g.fillCircle(-11, 0, 6);
      g.fillCircle(11, 0, 6);
      g.fillStyle(0x3a0c1c, 1);
      g.fillCircle(-11, 0, 2.7);
      g.fillCircle(11, 0, 2.7);
      g.lineStyle(3, colors.secondary, 1);
      g.beginPath();
      g.moveTo(-10, 16);
      g.lineTo(0, 21);
      g.lineTo(10, 16);
      g.strokePath();
      if (level >= 3) {
        g.lineStyle(2.5, colors.accent, 0.8);
        g.strokeCircle(0, 4, 32);
      }
      return;
    }
    if (typeId === 'armored-slug') {
      g.fillStyle(0xffa36b, 1);
      g.fillRoundedRect(-32, 16, 64, 16, 8);
      g.fillStyle(colors.primary, 1);
      g.fillEllipse(0, 2, 60, 50);
      g.lineStyle(4, colors.accent, 0.8);
      g.strokeCircle(0, 2, 18);
      g.beginPath();
      g.arc(0, 2, 10, 0.4, 4.4);
      g.strokePath();
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(-20, 14, 5);
      g.fillCircle(-8, 16, 5);
      g.fillStyle(0x31101c, 1);
      g.fillCircle(-20, 14, 2.2);
      g.fillCircle(-8, 16, 2.2);
      g.fillStyle(colors.accent, 1);
      g.fillTriangle(-30, -6, -40, -16, -24, -14);
      g.fillTriangle(30, -6, 40, -16, 24, -14);
      return;
    }
    g.fillStyle(colors.primary, 1);
    g.fillTriangle(-32, 6, 18, -28, 32, -6);
    g.fillTriangle(32, -6, 8, 16, 30, 30);
    g.fillStyle(colors.secondary, 1);
    g.fillTriangle(-30, 26, -40, 40, -16, 24);
    g.fillStyle(colors.accent, 1);
    g.fillCircle(8, -8, 5);
    g.fillStyle(0x3d0f1e, 1);
    g.fillCircle(9, -8, 2.2);
    g.lineStyle(3, colors.accent, 0.8);
    g.beginPath();
    g.moveTo(-20, 4);
    g.lineTo(2, 10);
    g.strokePath();
  }

  private drawCellFill(col: number, row: number, color: number, alpha: number): void {
    const g = this.highlightLayer;
    if (!g) return;
    g.fillStyle(color, alpha);
    g.fillRoundedRect(
      BOARD_X + col * CELL + GAP,
      BOARD_Y + row * CELL + GAP,
      CELL - GAP * 2,
      CELL - GAP * 2,
      14,
    );
  }

  private drawCellOutline(
    col: number,
    row: number,
    color: number,
    alpha: number,
    width: number,
  ): void {
    const g = this.highlightLayer;
    if (!g) return;
    g.lineStyle(width, color, alpha);
    g.strokeRoundedRect(
      BOARD_X + col * CELL + GAP + 1,
      BOARD_Y + row * CELL + GAP + 1,
      CELL - GAP * 2 - 2,
      CELL - GAP * 2 - 2,
      14,
    );
  }

  private updatePrep(time: number): void {
    const snapshot = this.controller.getSnapshot();
    if (snapshot.prepVersion !== this.lastPrepVersion) {
      this.renderPrep();
    }
    const reduced = snapshot.activeProfile?.settings.reducedMotion ?? false;
    for (const view of this.unitViews.values()) {
      view.container.y = reduced
        ? view.baseY
        : view.baseY + Math.sin(time * 0.0024 + view.phaseOffset) * 2;
    }
    for (const [index, preview] of this.previewViews.entries()) {
      const baseY = preview.getData('baseY') as number | undefined;
      if (baseY !== undefined) {
        preview.y = reduced ? baseY : baseY + Math.sin(time * 0.0018 + index) * 1.5;
      }
    }
    for (const event of this.controller.drainVisualEvents()) {
      this.playVisualEvent(event);
    }
    this.updateHover();
  }

  private updateBattle(): void {
    const events = this.controller.drainBattleEvents();
    const state = this.controller.getBattleState();
    if (!state) return;
    this.syncBattleState(state);
    for (const event of events) this.playBattleEvent(event);
  }

  private syncBattleState(state: BattleState): void {
    for (const unit of state.units) {
      let view = this.unitViews.get(unit.id);
      if (!view) {
        const container = this.createUnitVisual({
          id: unit.id,
          team: unit.team,
          typeId: unit.typeId as CharacterTypeId | EnemyTypeId,
          level: unit.level,
          mergeRank: unit.mergeRank,
          col: unit.x,
          row: unit.y,
        });
        this.unitsLayer?.add(container);
        const health = container.getData('health') as Phaser.GameObjects.Graphics;
        const sprite = container.getData('animatedCharacterSprite') as
          Phaser.GameObjects.Sprite | undefined;
        const visual = container.getData('animatedCharacterVisual') as
          AnimatedCharacterVisual | undefined;
        const locomotionTween = container.getData('locomotionTween') as
          LaserCrocodileLocomotion | undefined;
        view = {
          container,
          health,
          team: unit.team,
          typeId: unit.typeId as CharacterTypeId | EnemyTypeId,
          sprite: sprite ?? null,
          visual: visual ?? null,
          baseX: container.x,
          baseY: container.y,
          phaseOffset: 0,
          locomotion: 'idle',
          action: null,
          actionHandler: null,
          laserRelease: null,
          deathCleanup: null,
          locomotionTween: locomotionTween ?? null,
          spinAura: null,
          animationOverride: null,
          pendingHurt: false,
          lastX: unit.x,
          lastY: unit.y,
          nextTrailAt: 0,
          lastHp: unit.hp,
          maxHp: unit.maxHp,
          displayHp: unit.hp,
          alive: unit.alive,
        };
        this.unitViews.set(unit.id, view);
        if (!unit.alive) {
          container.setVisible(false);
          health.setVisible(false);
        }
      }
      const deltaX = unit.x - view.lastX;
      const deltaY = unit.y - view.lastY;
      const moved = Math.abs(deltaX) > 1e-6 || Math.abs(deltaY) > 1e-6;
      view.lastX = unit.x;
      view.lastY = unit.y;
      const position = gridToPixel(unit.x, unit.y);
      view.container.setPosition(position.px, position.py);
      view.container.setDepth(100 + position.py);
      if (!unit.alive) {
        if (view.alive) {
          view.alive = false;
          view.health.setVisible(false);
          if (view.visual?.deathKey) {
            this.startUnitDeath(view);
          } else {
            this.tweens.add({
              targets: view.container,
              alpha: 0,
              scaleX: view.container.scaleX * 0.7,
              scaleY: view.container.scaleY * 0.7,
              duration: 260,
              onComplete: () => view?.container.setVisible(false),
            });
          }
        }
        continue;
      }
      view.alive = true;
      view.lastHp = unit.hp;
      view.maxHp = unit.maxHp;
      this.updateAnimatedCharacterLocomotion(view, moved, deltaX, deltaY);
      this.drawHealth(view, unit);
    }
  }

  private drawHealth(view: UnitView, unit: BattleUnit): void {
    view.displayHp = easeDisplayHp(view.displayHp, unit.hp);
    const { hpRatio, flashRatio } = healthBarSegments(view.displayHp, unit.hp, unit.maxHp);
    const metrics = healthBarMetrics(unit.isBoss);
    const g = view.health;
    g.clear();
    g.setVisible(true);

    const x = -metrics.width / 2;
    const y = metrics.y;
    const b = metrics.border;

    g.fillStyle(0x060b1c, 0.92);
    g.fillRoundedRect(x - b, y - b, metrics.width + b * 2, metrics.height + b * 2, 4 + b);
    if (unit.isBoss) {
      g.lineStyle(b, 0xffd447, 0.95);
      g.strokeRoundedRect(x - b, y - b, metrics.width + b * 2, metrics.height + b * 2, 4 + b);
    }

    if (flashRatio > 0.001) {
      const flashStart = hpRatio * metrics.width;
      const flashWidth = Math.max(1, flashRatio * metrics.width);
      g.fillStyle(0xffffff, 0.92);
      g.fillRoundedRect(x + flashStart + 1, y + 1, flashWidth - 2, metrics.height - 2, 2);
    }

    const fillWidth = Math.max(0, hpRatio * metrics.width - 2);
    if (fillWidth > 0) {
      g.fillStyle(unit.team === 'ally' ? 0x54e58d : 0xff5a7a, 1);
      g.fillRoundedRect(x + 1, y + 1, fillWidth, metrics.height - 2, 2);
    }
  }

  private prefersReducedMotion(): boolean {
    return this.controller.getSnapshot().activeProfile?.settings.reducedMotion ?? false;
  }

  private updateAnimatedCharacterLocomotion(
    view: UnitView,
    moved: boolean,
    deltaX = 0,
    deltaY = 0,
  ): void {
    view.locomotion = moved ? 'walk' : 'idle';
    if (view.animationOverride && view.sprite && view.visual) {
      const overrideKey = view.visual.animationKey(view.animationOverride);
      if (!(view.sprite.anims.isPlaying && view.sprite.anims.currentAnim?.key === overrideKey)) {
        view.sprite.play(overrideKey);
      }
      view.locomotionTween?.stop();
      return;
    }
    if (moved && view.typeId === ARMORED_SNAIL_ENEMY_ID) {
      const now = this.time.now;
      if (!this.prefersReducedMotion() && now >= view.nextTrailAt) {
        const distance = Math.max(1e-6, Math.sqrt(deltaX * deltaX + deltaY * deltaY));
        this.spawnOneShotEffect(
          {
            px: view.container.x - (deltaX / distance) * 24,
            py: view.container.y - (deltaY / distance) * 24,
          },
          ARMORED_SNAIL_EFFECTS.slimeTrail,
          56,
          { ground: true, alpha: 0.65 },
        );
        view.nextTrailAt = now + 360;
      }
    }
    if (!view.sprite || !view.visual || view.action) {
      view.locomotionTween?.stop();
      return;
    }
    const key = view.visual.animationKey(view.locomotion);
    if (!(view.sprite.anims.isPlaying && view.sprite.anims.currentAnim?.key === key)) {
      view.sprite.play(key);
    }
    if (this.prefersReducedMotion()) {
      view.locomotionTween?.stop();
    } else {
      view.locomotionTween?.play(view.locomotion);
    }
  }

  private playAnimatedCharacterAction(unitId: string, action: UnitAction): void {
    const view = this.unitViews.get(unitId);
    if (!view || !view.sprite || !view.visual || !view.alive) return;
    const sprite = view.sprite;
    const visual = view.visual;
    const key = visual.animationKey(action);
    if (!this.anims.exists(key)) return;
    if (view.action === action && sprite.anims.isPlaying && sprite.anims.currentAnim?.key === key) {
      return;
    }
    if (view.actionHandler) {
      sprite.off(view.actionHandler.event, view.actionHandler.handler);
      view.actionHandler = null;
    }
    view.locomotionTween?.stop();
    const event = `animationcomplete-${key}`;
    const handler = () => {
      if (view.actionHandler?.handler !== handler) return;
      view.actionHandler = null;
      view.action = null;
      if (view.pendingHurt && view.alive) {
        view.pendingHurt = false;
        this.playAnimatedCharacterAction(unitId, 'hurt');
        return;
      }
      const state = view.animationOverride ?? view.locomotion;
      const locomotionKey = visual.animationKey(state);
      if (!(sprite.anims.isPlaying && sprite.anims.currentAnim?.key === locomotionKey)) {
        sprite.play(locomotionKey);
      }
    };
    view.action = action;
    view.actionHandler = { event, handler };
    sprite.once(event, handler);
    if (!(sprite.anims.isPlaying && sprite.anims.currentAnim?.key === key)) sprite.play(key);
  }

  private setAnimationOverride(view: UnitView | undefined, state: UnitPlayableState): void {
    if (!view || !view.sprite || !view.visual || !view.alive) return;
    if (view.actionHandler) {
      view.sprite.off(view.actionHandler.event, view.actionHandler.handler);
      view.actionHandler = null;
    }
    view.action = null;
    view.pendingHurt = false;
    view.animationOverride = state;
    view.locomotionTween?.stop();
    const key = view.visual.animationKey(state);
    if (!this.anims.exists(key)) return;
    if (!(view.sprite.anims.isPlaying && view.sprite.anims.currentAnim?.key === key)) {
      view.sprite.play(key);
    }
  }

  private clearAnimationOverride(view: UnitView | undefined): void {
    if (!view || !view.animationOverride) return;
    view.animationOverride = null;
    if (!view.alive || !view.sprite || !view.visual) return;
    const key = view.visual.animationKey(view.locomotion);
    if (!(view.sprite.anims.isPlaying && view.sprite.anims.currentAnim?.key === key)) {
      view.sprite.play(key);
    }
  }

  private scheduleLaserShot(
    view: UnitView | undefined,
    fallbackFrom: { px: number; py: number },
    to: { px: number; py: number },
  ): void {
    if (view && !view.alive) return;
    const sprite = view?.sprite;
    const attackKey = view?.visual?.animationKey('attack');
    if (!sprite || !attackKey || !this.anims.exists(attackKey)) {
      this.spawnProjectileAttack(fallbackFrom, to, LASER_CROCODILE_EFFECTS);
      return;
    }
    view.deathCleanup?.();
    view.deathCleanup = null;
    view.laserRelease?.cancel();
    const from = { px: view.container.x + sprite.x, py: view.container.y + sprite.y };
    view.laserRelease = new LaserAttackRelease({
      sprite,
      from,
      to,
      animationKey: attackKey,
      getOrigin: () => {
        const point = sprite
          .getWorldTransformMatrix()
          .transformPoint(
            LASER_CROCODILE_MUZZLE_OFFSET.x * (sprite.flipX ? -1 : 1),
            LASER_CROCODILE_MUZZLE_OFFSET.y,
          );
        return { px: point.x, py: point.y };
      },
      fire: (fireFrom, fireTo) => {
        view.laserRelease = null;
        this.spawnProjectileAttack(fireFrom, fireTo, LASER_CROCODILE_EFFECTS);
      },
    });
  }

  private startUnitDeath(view: UnitView): void {
    view.deathCleanup?.();
    view.deathCleanup = null;
    view.laserRelease?.cancel();
    view.laserRelease = null;
    view.locomotionTween?.stop();
    view.animationOverride = null;
    this.clearSpinAura(view);
    if (view.sprite && view.actionHandler) {
      view.sprite.off(view.actionHandler.event, view.actionHandler.handler);
      view.actionHandler = null;
    }
    view.action = null;
    view.pendingHurt = false;
    const deathKey = view.visual?.deathKey;
    if (deathKey && view.sprite && !this.prefersReducedMotion()) {
      view.deathCleanup = playLaserCrocodileDeathOnce(
        view.sprite,
        deathKey,
        this.anims.exists(deathKey),
        () => {
          view.container.setVisible(false);
        },
      );
    } else {
      view.container.setVisible(false);
    }
  }

  private playBattleEvent(event: BattleEvent): void {
    const reduced = this.prefersReducedMotion();
    switch (event.type) {
      case 'attack': {
        const from = gridToPixel(event.from.x, event.from.y);
        const to = gridToPixel(event.to.x, event.to.y);
        if (!reduced) this.spawnAttackLink(from, to, attackLinkColor(event.kind));
        if (event.kind === 'laser') {
          if (!reduced) {
            this.scheduleLaserShot(this.unitViews.get(event.attackerId), from, to);
          }
          this.controller.playSound('laser');
        } else if (event.kind === 'lightning') {
          if (!reduced) this.spawnProjectileAttack(from, to, LIGHTNING_SCORPION_EFFECTS);
          this.controller.playSound('lightning');
        } else if (event.kind === 'poison') {
          if (!reduced) this.spawnPoisonSpit(from, to);
          this.controller.playSound('hit');
        } else if (event.kind === 'boss-smash') {
          if (!reduced) {
            this.spawnOneShotEffect(from, MEGA_BRAINROT_GORILLA_EFFECTS.charge, 96);
            this.spawnOneShotEffect(to, MEGA_BRAINROT_GORILLA_EFFECTS.groundSlam, 128);
          }
          this.controller.playSound('hit');
        } else {
          const attacker = this.unitViews.get(event.attackerId);
          if (!reduced) {
            this.spawnImpact(to, attacker?.typeId === 'green-venom-falcon' ? 0x7dff5a : 0xffa35a);
            if (attacker?.typeId === ARMORED_SNAIL_ENEMY_ID) {
              this.spawnOneShotEffect(to, ARMORED_SNAIL_EFFECTS.slimeSplash, 76, {
                ground: true,
                alpha: 0.85,
              });
            }
          }
          this.controller.playSound('hit');
        }
        this.playAnimatedCharacterAction(
          event.attackerId,
          event.kind === 'poison' ? 'poison' : 'attack',
        );
        break;
      }
      case 'chain': {
        if (!reduced) {
          const from = gridToPixel(event.from.x, event.from.y);
          const to = gridToPixel(event.to.x, event.to.y);
          this.spawnProjectileAttack(from, to, LIGHTNING_SCORPION_EFFECTS, {
            showMuzzle: false,
            duration: 170,
          });
        }
        break;
      }
      case 'damage': {
        const at = gridToPixel(event.at.x, event.at.y);
        const view = this.unitViews.get(event.unitId);
        if (event.blocked) {
          this.spawnFloatingText(at.px, at.py - 30, t('canvasShieldBlocked'), '#7dff5a', 16);
          break;
        }
        const damageColor =
          event.source === 'poison'
            ? '#7dff5a'
            : event.source === 'spin-aura'
              ? '#b6ff7a'
              : undefined;
        this.spawnDamageText(at, event.amount, reduced, damageColor);
        if (!reduced && view?.sprite) this.flashSprite(view.sprite);
        if (!reduced && view?.typeId === ARMORED_SNAIL_ENEMY_ID) {
          this.spawnUnitOneShotEffect(view, ARMORED_SNAIL_EFFECTS.shellHit, 64, 0.85);
        }
        if (view?.typeId === 'laser-crocodile' && view.alive && view.action === 'attack') {
          // Finish the committed firing pose before playing the hurt reaction.
          view.pendingHurt = true;
        } else {
          this.playAnimatedCharacterAction(event.unitId, 'hurt');
        }
        break;
      }
      case 'status': {
        const at = gridToPixel(event.at.x, event.at.y);
        const view = this.unitViews.get(event.unitId);
        if (event.status === 'poisoned') {
          this.spawnFloatingText(at.px, at.py - 40, t('canvasPoisoned'), '#7dff5a', 16);
          if (!reduced) {
            this.spawnDotBurst(at, 0x7dff5a, 6);
            if (view) {
              this.spawnUnitOneShotEffect(view, GREEN_VENOM_FALCON_EFFECTS.poisonImpact, 86, 0.75);
            }
          }
        } else if (event.status === 'spin-start') {
          this.spawnFloatingText(at.px, at.py - 62, t('canvasSpinStart'), '#b6ff7a', 17);
          this.setAnimationOverride(view, 'spin');
          if (!reduced && view) this.startSpinAura(view);
        } else if (event.status === 'spin-break') {
          this.spawnFloatingText(at.px, at.py - 62, t('canvasSpinBreak'), '#ffe86b', 18);
          this.setAnimationOverride(view, 'spin-break');
          if (!reduced && view) {
            this.clearSpinAura(view);
            this.spawnOneShotEffect(at, GREEN_VENOM_FALCON_EFFECTS.spinBreak, 170);
            this.spawnRing(at.px, at.py, 0x7dff5a, 70, 380);
          }
        } else if (event.status === 'spin-end' && view) {
          this.clearAnimationOverride(view);
          this.clearSpinAura(view);
        }
        break;
      }
      case 'earthquake': {
        const at = gridToPixel(event.at.x, event.at.y);
        this.spawnFloatingText(
          BOARD_X + BOARD_WIDTH / 2,
          BOARD_Y + BOARD_HEIGHT / 2 - 40,
          t('canvasEarthquake'),
          '#62e7ff',
          26,
        );
        if (!reduced) {
          this.cameras.main.shake(500, 0.008);
          this.spawnOneShotEffect(at, GREEN_VENOM_FALCON_EFFECTS.earthquake, 420, {
            ground: true,
          });
          this.spawnRing(at.px, at.py, 0x62e7ff, 220, 700);
          this.spawnRing(at.px, at.py, 0x7dff5a, 150, 520);
        }
        this.controller.playSound('hit');
        break;
      }
      case 'death': {
        if (!reduced) {
          const at = gridToPixel(event.at.x, event.at.y);
          const view = this.unitViews.get(event.unitId);
          const isBoss =
            view?.team === 'enemy' &&
            (ENEMY_DEFINITIONS[view.typeId as EnemyTypeId]?.isBoss ?? false);
          if (isBoss) {
            if (view?.typeId === MEGA_BRAINROT_GORILLA_ENEMY_ID) {
              this.spawnOneShotEffect(at, MEGA_BRAINROT_GORILLA_EFFECTS.defeat, 128);
            } else if (view?.typeId === GREEN_VENOM_FALCON_ENEMY_ID) {
              this.spawnOneShotEffect(at, GREEN_VENOM_FALCON_EFFECTS.defeat, 320);
            }
            this.spawnRing(at.px, at.py, 0xffd447, 92, 520);
            this.spawnRing(at.px, at.py, 0x7dff5a, 64, 380);
            this.spawnDeathBurst(at, 0xff7a8e, 16, 68);
          } else {
            this.spawnDeathBurst(at, event.team === 'ally' ? 0x6dffb0 : 0xff7a8e);
          }
        }
        break;
      }
      case 'battle-end': {
        if (event.outcome === 'victory') {
          this.spawnFloatingText(
            BOARD_X + BOARD_WIDTH / 2,
            BOARD_Y + BOARD_HEIGHT / 2,
            t('resultVictory'),
            '#ffe86b',
            30,
          );
          if (!reduced) this.spawnVictoryBurst();
        }
        break;
      }
      default:
        break;
    }
  }

  private playVisualEvent(event: VisualEvent): void {
    const x = cellCenterX(event.col);
    const y = cellCenterY(event.row);
    const reduced = this.prefersReducedMotion();
    if (event.type === 'merge') {
      if (!reduced) this.spawnRing(x, y, 0xc067ff, 70, 420);
      this.spawnFloatingText(x, y - 50, t('canvasMerge'), '#e2b6ff', 20);
      if (!reduced) this.spawnSparkleBurst(x, y, 0xc067ff, 10);
    } else if (event.type === 'purchase') {
      if (!reduced) this.spawnRing(x, y, 0x4cff9a, 54, 340);
      this.spawnFloatingText(x, y - 44, '+1', '#9dffc9', 18);
      if (!reduced) this.spawnSparkleBurst(x, y, 0x4cff9a, 7);
    } else if (!reduced) {
      this.spawnRing(x, y, 0x7aa2ff, 36, 260);
    }
  }

  private spawnProjectileAttack(
    from: { px: number; py: number },
    to: { px: number; py: number },
    effects: AnimatedCharacterEffects,
    options: { showMuzzle?: boolean; duration?: number } = {},
  ): void {
    if (options.showMuzzle !== false) this.spawnOneShotEffect(from, effects.muzzle, 56);
    const projectileReady =
      this.anims.exists(effects.projectile) && this.textures.exists(effects.projectile);
    if (!projectileReady) {
      this.spawnImpact(to, effects.projectile.includes('poison') ? 0x7dff5a : 0xffa35a);
      return;
    }
    const bolt = this.add
      .sprite(from.px, from.py, effects.projectile, 0)
      .setOrigin(0.5)
      .setDisplaySize(52, 52)
      .setRotation(Math.atan2(to.py - from.py, to.px - from.px));
    this.effectsLayer?.add(bolt);
    bolt.play(effects.projectile);
    this.tweens.add({
      targets: bolt,
      x: to.px,
      y: to.py,
      duration: options.duration ?? 190,
      ease: 'Linear',
      onComplete: () => {
        bolt.destroy();
        if (!this.spawnOneShotEffect(to, effects.impact, 72)) {
          this.spawnImpact(to, effects.impact.includes('poison') ? 0x7dff5a : 0xffa35a);
        }
      },
    });
  }

  private spawnPoisonSpit(from: { px: number; py: number }, to: { px: number; py: number }): void {
    if (
      this.anims.exists(GREEN_VENOM_FALCON_EFFECTS.poisonProjectile) &&
      this.textures.exists(GREEN_VENOM_FALCON_EFFECTS.poisonProjectile)
    ) {
      this.spawnProjectileAttack(from, to, GREEN_VENOM_FALCON_PROJECTILE_EFFECTS, {
        duration: 260,
      });
      return;
    }
    const bolt = this.add.circle(from.px, from.py, 10, 0x7dff5a, 0.95);
    this.effectsLayer?.add(bolt);
    this.tweens.add({
      targets: bolt,
      x: to.px,
      y: to.py,
      scale: 0.55,
      duration: 380,
      ease: 'Sine.easeIn',
      onComplete: () => {
        bolt.destroy();
        this.spawnImpact(to, 0x7dff5a);
        this.spawnDotBurst(to, 0x7dff5a, 5);
      },
    });
  }

  private spawnDotBurst(at: { px: number; py: number }, color: number, count: number): void {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const dot = this.add.circle(at.px, at.py, 3, color, 0.85);
      this.effectsLayer?.add(dot);
      this.tweens.add({
        targets: dot,
        x: at.px + Math.cos(angle) * (16 + Math.random() * 18),
        y: at.py + Math.sin(angle) * (16 + Math.random() * 18),
        alpha: 0,
        duration: 380 + Math.random() * 180,
        onComplete: () => dot.destroy(),
      });
    }
  }

  private startSpinAura(view: UnitView): void {
    this.clearSpinAura(view);
    const aura = this.add.container(0, 0);
    const auraKey = GREEN_VENOM_FALCON_EFFECTS.spinAura;
    if (this.anims.exists(auraKey) && this.textures.exists(auraKey)) {
      const sprite = this.add.sprite(0, 0, auraKey, 0).setOrigin(0.5).setDisplaySize(180, 180);
      sprite.play(auraKey);
      aura.add(sprite);
    } else {
      for (let ring = 0; ring < 3; ring += 1) {
        const radius = 38 + ring * 9;
        const arc = this.add.graphics();
        arc.lineStyle(3, ring === 1 ? 0x7dff5a : 0x3fbf4a, 0.55 - ring * 0.1);
        arc.beginPath();
        arc.arc(0, 0, radius, ring * 1.2, ring * 1.2 + Math.PI * 1.1);
        arc.strokePath();
        aura.add(arc);
      }
      this.tweens.add({
        targets: aura,
        angle: 360,
        duration: 900,
        repeat: -1,
        ease: 'Linear',
      });
    }
    view.container.addAt(aura, 0);
    view.spinAura = aura;
  }

  private spawnUnitOneShotEffect(
    view: UnitView,
    key: string,
    size: number,
    alpha = 1,
  ): Phaser.GameObjects.Sprite | null {
    if (
      !view.sprite ||
      !ANIMATED_UNIT_ANIMATION_KEYS.has(key) ||
      !this.anims.exists(key) ||
      !this.textures.exists(key)
    ) {
      return null;
    }
    const sprite = this.add
      .sprite(0, 0, key, 0)
      .setOrigin(0.5)
      .setDisplaySize(size, size)
      .setAlpha(alpha);
    view.container.addAt(sprite, view.container.getIndex(view.sprite) + 1);
    const destroy = () => sprite.destroy();
    sprite.once(`animationcomplete-${key}`, destroy);
    sprite.play(key);
    return sprite;
  }

  private spawnOneShotEffect(
    at: { px: number; py: number },
    key: string,
    size: number,
    options: { ground?: boolean; alpha?: number } = {},
  ): Phaser.GameObjects.Sprite | null {
    if (
      !ANIMATED_UNIT_ANIMATION_KEYS.has(key) ||
      !this.anims.exists(key) ||
      !this.textures.exists(key)
    ) {
      return null;
    }
    const sprite = this.add
      .sprite(at.px, at.py, key, 0)
      .setOrigin(0.5)
      .setDisplaySize(size, size)
      .setAlpha(options.alpha ?? 1);
    (options.ground ? this.groundEffectsLayer : this.effectsLayer)?.add(sprite);
    const destroy = () => sprite.destroy();
    sprite.once(`animationcomplete-${key}`, destroy);
    sprite.play(key);
    return sprite;
  }

  private spawnDamageText(
    at: { px: number; py: number },
    amount: number,
    reduced = false,
    color?: string,
  ): void {
    const stagger = Math.random() * 22 - 11;
    const text = this.add
      .text(at.px + stagger, at.py - 34, `-${amount}`, {
        fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
        fontSize: amount > 30 ? '22px' : '18px',
        fontStyle: 'bold',
        color: color ?? (amount > 30 ? '#ffe86b' : '#ffffff'),
        stroke: '#1c0a24',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.effectsLayer?.add(text);
    this.tweens.add({
      targets: text,
      y: reduced ? text.y : text.y - 34,
      alpha: 0,
      duration: reduced ? 320 : 650,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private spawnFloatingText(
    x: number,
    y: number,
    value: string,
    color: string,
    size: number,
  ): void {
    const text = this.add
      .text(x, y, value, {
        fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#160b28',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.effectsLayer?.add(text);
    this.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private spawnImpact(at: { px: number; py: number }, color: number): void {
    const circle = this.add.circle(at.px, at.py, 8, color, 0.9);
    this.effectsLayer?.add(circle);
    this.tweens.add({
      targets: circle,
      scale: 2.4,
      alpha: 0,
      duration: 240,
      onComplete: () => circle.destroy(),
    });
  }

  private spawnRing(x: number, y: number, color: number, radius: number, duration: number): void {
    const circle = this.add.circle(x, y, 12, color, 0);
    circle.setStrokeStyle(3, color, 0.95);
    this.effectsLayer?.add(circle);
    const targetScale = radius / 12;
    this.tweens.add({
      targets: circle,
      scale: targetScale,
      alpha: 0,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => circle.destroy(),
    });
  }

  private spawnDeathBurst(
    at: { px: number; py: number },
    color: number,
    count = 8,
    radius = 44,
  ): void {
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count;
      const spark = this.add.circle(at.px, at.py, 4, color, 0.9);
      this.effectsLayer?.add(spark);
      this.tweens.add({
        targets: spark,
        x: at.px + Math.cos(angle) * radius,
        y: at.py + Math.sin(angle) * radius,
        alpha: 0,
        duration: 420,
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  private spawnAttackLink(
    from: { px: number; py: number },
    to: { px: number; py: number },
    color: number,
  ): void {
    const g = this.add.graphics();
    g.lineStyle(2, color, 0.55);
    g.lineBetween(from.px, from.py, to.px, to.py);
    this.effectsLayer?.add(g);
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 280,
      ease: 'Cubic.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  private flashSprite(sprite: Phaser.GameObjects.Sprite): void {
    sprite.setTint(0xffffff);
    this.time.delayedCall(110, () => sprite.clearTint());
  }

  private spawnVictoryBurst(): void {
    const centerX = BOARD_X + BOARD_WIDTH / 2;
    const centerY = BOARD_Y + BOARD_HEIGHT / 2;
    const colors = [0xffd447, 0x6dffb0, 0xc98bff, 0x62e7ff, 0xff7a8e];
    for (let index = 0; index < 26; index += 1) {
      const color = colors[index % colors.length] ?? 0xffffff;
      const spark = this.add.circle(centerX, centerY, 5, color, 0.95);
      this.effectsLayer?.add(spark);
      const angle = Math.random() * Math.PI * 2;
      const distance = 120 + Math.random() * 160;
      this.tweens.add({
        targets: spark,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.4,
        duration: 800 + Math.random() * 500,
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  private spawnSparkleBurst(x: number, y: number, color: number, count: number): void {
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.4;
      const spark = this.add.circle(x, y, 3, color, 0.95);
      this.effectsLayer?.add(spark);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * (30 + Math.random() * 25),
        y: y + Math.sin(angle) * (30 + Math.random() * 25),
        alpha: 0,
        duration: 420 + Math.random() * 180,
        onComplete: () => spark.destroy(),
      });
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const snapshot = this.controller.getSnapshot();
    if (snapshot.phase !== 'preparation') return;
    const cell = this.pointerToCell(pointer);
    if (!cell) return;
    this.pointerDownAt = { x: pointer.worldX, y: pointer.worldY };
    this.isDragging = false;
    this.hoverLayer?.clear();

    const view = this.controller.getPrepView();
    const occupant =
      view.characters.find(
        (character) => character.col === cell.col && character.row === cell.row,
      ) ?? null;

    if (occupant) {
      this.selectedWasSet = view.selectedId === occupant.id;
      if (!this.selectedWasSet) {
        this.controller.selectCharacter(occupant.id);
      }
      this.draggingId = occupant.id;
      this.dragOrigin = cell;
    } else {
      this.pendingCellTap = cell;
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.draggingId || !this.pointerDownAt) return;
    const dx = pointer.worldX - this.pointerDownAt.x;
    const dy = pointer.worldY - this.pointerDownAt.y;
    if (!this.isDragging && Math.sqrt(dx * dx + dy * dy) < 9) return;
    this.isDragging = true;
    if (!this.dragMarker) {
      const container = this.add.container(pointer.worldX, pointer.worldY);
      const glow = this.add.circle(0, 0, 22, 0xffd447, 0.18);
      const ring = this.add.circle(0, 0, 18, 0xffd447, 0);
      ring.setStrokeStyle(3, 0xffd447, 0.95);
      const arrow = this.add
        .text(0, 0, '↔', {
          fontFamily: '"Trebuchet MS", sans-serif',
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#ffe98a',
        })
        .setOrigin(0.5);
      container.add([glow, ring, arrow]);
      this.effectsLayer?.add(container);
      this.dragMarker = container;
    }
    this.dragMarker.setPosition(pointer.worldX, pointer.worldY);
    this.dragMarker.setDepth(1000);
    this.updateHover();
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    const snapshot = this.controller.getSnapshot();
    if (snapshot.phase !== 'preparation') {
      this.clearDrag();
      return;
    }
    const cell = this.pointerToCell(pointer);

    if (this.draggingId) {
      const draggedId = this.draggingId;
      const origin = this.dragOrigin;
      const wasDragging = this.isDragging;
      const wasSelected = this.selectedWasSet;
      this.clearDrag();
      if (cell && origin) {
        if (!isCellEqual(cell, origin)) {
          this.controller.dragUnitToCell(draggedId, cell.col, cell.row);
        } else if (!wasDragging && wasSelected) {
          this.controller.handleUnitTap(draggedId);
        }
      }
      return;
    }

    if (this.pendingCellTap && cell) {
      const pending = this.pendingCellTap;
      this.pendingCellTap = null;
      if (isCellEqual(pending, cell)) {
        this.controller.handleCellTap(cell.col, cell.row);
      }
    }
    this.clearDrag();
  }

  private clearDrag(): void {
    this.draggingId = null;
    this.dragOrigin = null;
    this.pendingCellTap = null;
    this.pointerDownAt = null;
    this.isDragging = false;
    this.selectedWasSet = false;
    this.dragMarker?.destroy(true);
    this.dragMarker = null;
    this.hoverLayer?.clear();
  }

  private clearPointerState(): void {
    this.clearDrag();
  }

  private updateHover(): void {
    const g = this.hoverLayer;
    if (!g) return;
    g.clear();
    if (!this.isDragging || !this.draggingId) return;
    const pointer = this.input.activePointer;
    const cell = this.pointerToCell(pointer);
    if (!cell) return;
    const view = this.controller.getPrepView();
    const occupant = view.characters.find(
      (character) => character.col === cell.col && character.row === cell.row,
    );
    const selected = view.characters.find((character) => character.id === view.selectedId);
    const canMerge =
      occupant !== undefined &&
      occupant.id !== this.draggingId &&
      selected !== undefined &&
      selected.typeId === occupant.typeId &&
      selected.mergeRank === occupant.mergeRank;
    const isValidMove = !occupant && cell.row >= ALLY_ROW_START;
    g.lineStyle(4, canMerge ? 0xc067ff : isValidMove ? 0x4cff9a : 0xff5a7a, 0.95);
    g.strokeRoundedRect(
      BOARD_X + cell.col * CELL + GAP + 2,
      BOARD_Y + cell.row * CELL + GAP + 2,
      CELL - GAP * 2 - 4,
      CELL - GAP * 2 - 4,
      14,
    );
  }

  private pointerToCell(pointer: Phaser.Input.Pointer): Cell | null {
    const x = pointer.worldX;
    const y = pointer.worldY;
    if (x < BOARD_X || x >= BOARD_X + BOARD_WIDTH) return null;
    if (y < BOARD_Y || y >= BOARD_Y + BOARD_HEIGHT) return null;
    const col = Math.floor((x - BOARD_X) / CELL);
    const row = Math.floor((y - BOARD_Y) / CELL);
    if (col < 0 || col >= BOARD_COLS || row < 0 || row >= BOARD_ROWS) return null;
    return { col, row };
  }
}
