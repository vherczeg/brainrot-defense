import { CHARACTER_DEFINITIONS } from '../domain/characters';
import { ENEMY_DEFINITIONS } from '../domain/enemies';
import type { CharacterTypeId, EnemyTypeId } from '../domain/types';

/**
 * A single source of truth for the procedural (vector) artwork of every creature.
 *
 * The M4 campaign introduced many units that previously reused tinted copies of the original
 * five sprites. This module gives every playable unit and enemy a distinct, recognizable
 * silhouette using only lightweight vector primitives, so the same design is rendered
 * consistently on the Phaser battlefield and in the React SVG portraits.
 *
 * Coordinate system: creature-local, centered at (0, 0) with the ground/feet line at y ≈ +30
 * and the top of the silhouette around y ≈ -55. Both renderers use a downward Y axis.
 */

export type CreatureKind = CharacterTypeId | EnemyTypeId;

export interface ShapeStroke {
  readonly color: number;
  readonly width: number;
  readonly alpha?: number;
}

export type ShapeCommand =
  | {
      readonly kind: 'circle';
      readonly x: number;
      readonly y: number;
      readonly r: number;
      readonly fill: number;
      readonly alpha?: number;
    }
  | {
      readonly kind: 'ellipse';
      readonly x: number;
      readonly y: number;
      readonly rx: number;
      readonly ry: number;
      readonly fill: number;
      readonly alpha?: number;
    }
  | {
      readonly kind: 'poly';
      readonly points: readonly number[];
      readonly fill: number;
      readonly alpha?: number;
    }
  | {
      readonly kind: 'roundRect';
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
      readonly r: number;
      readonly fill: number;
      readonly alpha?: number;
    }
  | {
      readonly kind: 'strokePoly';
      readonly points: readonly number[];
      readonly stroke: ShapeStroke;
    }
  | {
      readonly kind: 'strokeCircle';
      readonly x: number;
      readonly y: number;
      readonly r: number;
      readonly stroke: ShapeStroke;
    };

export interface CreatureShape {
  readonly commands: readonly ShapeCommand[];
}

const EYE_WHITE = 0xffffff;
const EYE_DARK = 0x20102a;

interface Palette {
  readonly primary: number;
  readonly secondary: number;
  readonly accent: number;
}

function paletteFor(kind: CreatureKind): Palette {
  if (kind in CHARACTER_DEFINITIONS) {
    return CHARACTER_DEFINITIONS[kind as CharacterTypeId].colors;
  }
  return ENEMY_DEFINITIONS[kind as EnemyTypeId].colors;
}

function circle(x: number, y: number, r: number, fill: number, alpha = 1): ShapeCommand {
  return { kind: 'circle', x, y, r, fill, alpha };
}
function ellipse(
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: number,
  alpha = 1,
): ShapeCommand {
  return { kind: 'ellipse', x, y, rx, ry, fill, alpha };
}
function poly(points: readonly number[], fill: number, alpha = 1): ShapeCommand {
  return { kind: 'poly', points, fill, alpha };
}
function tri(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  fill: number,
  alpha = 1,
): ShapeCommand {
  return poly([x1, y1, x2, y2, x3, y3], fill, alpha);
}
function roundRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: number,
  alpha = 1,
): ShapeCommand {
  return { kind: 'roundRect', x, y, w, h, r, fill, alpha };
}
function eyePair(x1: number, y: number, x2: number, r: number): ShapeCommand[] {
  return [
    circle(x1, y, r, EYE_WHITE),
    circle(x2, y, r, EYE_WHITE),
    circle(x1, y, r * 0.45, EYE_DARK),
    circle(x2, y, r * 0.45, EYE_DARK),
  ];
}
function outlineCircle(
  x: number,
  y: number,
  r: number,
  color: number,
  width = 3,
  alpha = 0.9,
): ShapeCommand {
  return { kind: 'strokeCircle', x, y, r, stroke: { color, width, alpha } };
}

// ---------------------------------------------------------------------------
// Playable characters
// ---------------------------------------------------------------------------

function laserCrocodileArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    ellipse(0, 4, 42, 24, p.secondary),
    ellipse(2, 0, 40, 22, p.primary),
    // snout
    poly([30, -4, 58, -10, 30, 6], p.primary),
    poly([46, -10, 46, 2, 30, 2], p.secondary, 0.7),
    // back ridge
    tri(-16, -18, -8, -30, -2, -16, p.secondary),
    tri(-4, -16, 2, -28, 8, -14, p.secondary),
    // tail
    poly([-38, 4, -54, -8, -40, 10], p.accent),
    ...eyePair(-2, -4, 12, 5),
  ];
  c.push({
    kind: 'strokePoly',
    points: [24, -14, 42, -18, 30, -6],
    stroke: { color: p.accent, width: 3 },
  });
  return { commands: c };
}

function lightningScorpionArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    ellipse(0, 8, 30, 22, p.secondary),
    ellipse(2, 4, 26, 18, p.primary),
    // claws
    poly([30, -6, 46, -16, 34, 2], p.primary),
    poly([34, 10, 48, 2, 36, 16], p.primary),
    // tail curled overhead with stinger
    poly([-20, 2, -40, -16, -22, -22, -6, -28], p.secondary),
    circle(-6, -30, 6, p.accent),
    tri(-10, -30, 2, -28, -6, -38, p.accent),
    ...eyePair(-4, 2, 10, 4),
  ];
  return { commands: c };
}

function armoredRhinoArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // legs
    roundRect(-30, 14, 14, 18, 5, p.secondary),
    roundRect(-10, 16, 14, 18, 5, p.secondary),
    roundRect(14, 16, 14, 18, 5, p.secondary),
    // body
    ellipse(-2, 2, 40, 26, p.primary),
    roundRect(-34, -8, 22, 24, 6, p.secondary, 0.9),
    // armor plates
    poly([-6, -18, 12, -16, 4, 2], p.accent, 0.55),
    poly([-18, -14, -8, -24, 2, -14], p.accent, 0.4),
    // head
    poly([34, -6, 30, -26, 46, -14, 46, 0], p.primary),
    // horn
    poly([42, -20, 34, -22, 40, -42, 46, -26], p.accent),
    circle(38, -10, 3.5, EYE_WHITE),
    circle(38, -10, 1.8, EYE_DARK),
    // small ears
    tri(28, -22, 24, -30, 34, -24, p.secondary),
  ];
  return { commands: c };
}

function frostOwlArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // wings
    tri(-14, -6, -46, -26, -20, 12, p.secondary),
    tri(14, -6, 46, -26, 20, 12, p.secondary),
    // body
    ellipse(0, 4, 30, 34, p.primary),
    ellipse(0, 22, 22, 12, p.accent, 0.7),
    // head
    circle(0, -22, 20, p.primary),
    // ear tufts
    tri(-12, -34, -8, -46, -2, -36, p.secondary),
    tri(12, -34, 8, -46, 2, -36, p.secondary),
    // big eyes
    circle(-8, -24, 8, EYE_WHITE),
    circle(8, -24, 8, EYE_WHITE),
    circle(-8, -24, 4, EYE_DARK),
    circle(8, -24, 4, EYE_DARK),
    // beak
    tri(-4, -14, 4, -14, 0, -4, p.accent),
    // frost sparkles
    tri(-30, -2, -34, -8, -28, -8, 0xffffff, 0.9),
    tri(28, 4, 32, -2, 26, -2, 0xffffff, 0.8),
  ];
  return { commands: c };
}

// ---------------------------------------------------------------------------
// Original enemies (procedural fallbacks; sprites are the primary render)
// ---------------------------------------------------------------------------

function miniBrainrotArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    tri(-14, -18, -24, -36, -4, -28, p.secondary),
    tri(14, -18, 24, -36, 4, -28, p.secondary),
    ellipse(0, 6, 34, 30, p.primary),
    ...eyePair(-10, 2, 10, 6),
    {
      kind: 'strokePoly',
      points: [-9, 18, 0, 22, 9, 18],
      stroke: { color: p.secondary, width: 3 },
    },
  ];
  return { commands: c };
}

function armoredSlugArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    roundRect(-32, 18, 64, 16, 8, p.accent),
    ellipse(0, 4, 34, 28, p.primary),
    circle(0, 0, 16, p.accent, 0.85),
    outlineCircle(0, 0, 16, p.secondary, 3),
    { kind: 'strokeCircle', x: 0, y: 0, r: 8, stroke: { color: p.secondary, width: 2 } },
    ...eyePair(-14, 10, -2, 4),
    tri(-30, -6, -40, -16, -24, -14, p.accent),
    tri(30, -6, 40, -16, 24, -14, p.accent),
  ];
  return { commands: c };
}

function shadowRunnerArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // lean, fast silhouette
    poly([-28, 8, 14, -26, 30, -4], p.primary),
    poly([30, -4, 10, 14, 30, 28], p.primary),
    tri(-32, 22, -44, 38, -18, 24, p.secondary),
    tri(2, -22, -8, -30, 8, -28, p.secondary),
    circle(8, -8, 4, p.accent),
    circle(9, -8, 2, EYE_DARK),
  ];
  return { commands: c };
}

function megaGorillaArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    circle(-26, 22, 16, p.secondary),
    circle(26, 22, 16, p.secondary),
    ellipse(0, 4, 34, 30, p.primary),
    circle(0, -16, 18, p.primary),
    tri(-20, -32, -30, -50, -10, -40, p.secondary),
    tri(20, -32, 30, -50, 10, -40, p.secondary),
    ...eyePair(-9, -20, 9, 5),
    poly([-12, -6, -4, -4, -8, 2], EYE_WHITE, 0.85),
    poly([4, -4, 12, -6, 8, 2], EYE_WHITE, 0.85),
  ];
  return { commands: c };
}

function falconArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    tri(-30, -6, -58, -34, -14, -22, p.secondary),
    tri(30, -6, 58, -34, 14, -22, p.secondary),
    ellipse(0, 4, 34, 26, p.primary),
    tri(-18, 20, -4, 20, -12, 34, p.primary),
    tri(18, 20, 4, 20, 12, 34, p.primary),
    circle(0, -18, 14, p.primary),
    tri(-5, -16, 5, -16, 0, -6, p.accent),
    ...eyePair(-7, -22, 7, 3.6),
  ];
  return { commands: c };
}

// ---------------------------------------------------------------------------
// New regular enemies
// ---------------------------------------------------------------------------

function venomousWaspArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // transparent wings
    tri(-8, -20, -34, -44, -20, -8, 0xdfe8ff, 0.5),
    tri(8, -20, 34, -44, 20, -8, 0xdfe8ff, 0.5),
    // striped abdomen with stinger
    ellipse(0, 14, 18, 22, p.primary),
    poly([-6, 0, 6, 0, 6, 8, -6, 8], p.secondary),
    poly([-7, 12, 7, 12, 7, 20, -7, 20], p.secondary),
    tri(-3, 34, 3, 34, 0, 44, p.accent),
    // thorax + head
    circle(0, -8, 12, p.primary),
    circle(0, -20, 9, p.secondary),
    ...eyePair(-3, -22, 3, 2.5),
    tri(-6, -30, -3, -34, 0, -30, p.secondary),
    tri(6, -30, 3, -34, 0, -30, p.secondary),
  ];
  return { commands: c };
}

function rockToadArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    ellipse(0, 6, 40, 28, p.secondary),
    ellipse(0, 0, 38, 24, p.primary),
    // warts
    circle(-18, 2, 5, p.secondary),
    circle(-6, 10, 5, p.secondary),
    circle(16, 0, 5, p.secondary),
    // eyes on top
    circle(-14, -12, 9, p.primary),
    circle(14, -12, 9, p.primary),
    circle(-14, -12, 3.5, EYE_DARK),
    circle(14, -12, 3.5, EYE_DARK),
    poly([-20, 24, 20, 24, 0, 12], p.accent, 0.5),
    roundRect(-20, 26, 10, 6, 3, p.secondary),
    roundRect(10, 26, 10, 6, 3, p.secondary),
  ];
  return { commands: c };
}

function stormCrowArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    poly([-30, 0, -6, -20, -14, 12], p.secondary),
    ellipse(0, 2, 30, 24, p.primary),
    poly([-10, 22, -2, 22, -6, 34], p.primary),
    circle(6, -20, 13, p.primary),
    tri(-2, -34, 2, -34, 6, -44, p.accent),
    ...eyePair(2, -22, 12, 3),
    // lightning mark
    poly([18, -6, 12, 2, 18, 2, 14, 12, 24, 0, 18, 0, 22, -6], p.accent),
  ];
  return { commands: c };
}

function shieldCrabArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // claws
    poly([-30, -6, -48, -18, -34, 4], p.secondary),
    poly([-48, -18, -56, -10, -42, -2], p.secondary),
    poly([30, -6, 48, -18, 34, 4], p.secondary),
    poly([48, -18, 56, -10, 42, -2], p.secondary),
    // wide shell
    ellipse(0, 4, 40, 26, p.primary),
    roundRect(-20, 22, 10, 8, 4, p.secondary),
    roundRect(-6, 24, 10, 8, 4, p.secondary),
    roundRect(10, 22, 10, 8, 4, p.secondary),
    outlineCircle(0, 2, 15, p.accent, 3),
    ...eyePair(-7, -2, 7, 3),
  ];
  return { commands: c };
}

function healerMushroomArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // stem
    roundRect(-10, 0, 20, 30, 8, 0xf4e7d5),
    // cap
    ellipse(0, -2, 34, 22, p.primary),
    ellipse(0, -8, 24, 10, p.accent, 0.7),
    circle(-14, -8, 4, 0xffffff, 0.9),
    circle(6, -12, 4, 0xffffff, 0.9),
    circle(16, -2, 3, 0xffffff, 0.9),
    // cheeks + eyes
    circle(-10, -2, 4, p.accent, 0.5),
    circle(10, -2, 4, p.accent, 0.5),
    ...eyePair(-5, -4, 5, 3),
    // healing sparkle
    tri(28, -28, 32, -34, 26, -34, 0xffffff),
    tri(22, -22, 28, -26, 24, -26, 0xffffff, 0.8),
  ];
  return { commands: c };
}

function spitterSnailArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // shell
    circle(-8, -6, 22, p.primary),
    circle(-8, -6, 14, p.secondary),
    circle(-8, -6, 7, p.primary),
    // body
    roundRect(-4, 14, 40, 18, 9, p.accent),
    // eye stalks
    roundRect(14, 2, 4, 12, 2, p.accent),
    roundRect(24, 2, 4, 12, 2, p.accent),
    circle(16, -4, 4, p.accent),
    circle(26, -4, 4, p.accent),
    circle(16, -4, 2, EYE_DARK),
    circle(26, -4, 2, EYE_DARK),
    // goo mouth
    circle(34, 24, 6, p.accent, 0.8),
    circle(40, 26, 3, p.accent, 0.6),
  ];
  return { commands: c };
}

function mirrorMothArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // large wings
    poly([-8, -6, -48, -30, -34, 16], p.primary),
    poly([8, -6, 48, -30, 34, 16], p.primary),
    poly([-8, 10, -30, 24, -16, 28], p.secondary, 0.8),
    poly([8, 10, 30, 24, 16, 28], p.secondary, 0.8),
    // eye spots on wings
    circle(-28, -6, 8, p.secondary),
    circle(-28, -6, 4, p.accent),
    circle(28, -6, 8, p.secondary),
    circle(28, -6, 4, p.accent),
    // body + head
    ellipse(0, 6, 10, 26, p.secondary),
    circle(0, -18, 9, p.primary),
    ...eyePair(-3, -20, 3, 2.5),
    tri(-8, -28, -12, -40, -2, -32, p.secondary),
    tri(8, -28, 12, -40, 2, -32, p.secondary),
  ];
  return { commands: c };
}

function chaosImpArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // tail
    poly([-12, 18, -30, 30, -18, 34, -8, 24], p.accent),
    tri(-30, 30, -36, 34, -24, 34, p.accent),
    // body
    ellipse(0, 4, 26, 28, p.primary),
    ellipse(0, 16, 20, 12, p.secondary, 0.8),
    // head
    circle(0, -20, 20, p.primary),
    // horns
    tri(-14, -34, -8, -24, -20, -46, p.accent),
    tri(14, -34, 8, -24, 20, -46, p.accent),
    // pointy ears
    tri(-18, -22, -28, -32, -14, -30, p.secondary),
    tri(18, -22, 28, -32, 14, -30, p.secondary),
    ...eyePair(-7, -22, 7, 5),
    // grin
    {
      kind: 'strokePoly',
      points: [-8, -10, 8, -10, 4, -6, -4, -6],
      stroke: { color: EYE_DARK, width: 2 },
    },
  ];
  return { commands: c };
}

function bombImpArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // bomb body
    circle(0, 0, 24, p.primary),
    circle(-6, -6, 8, p.accent, 0.5),
    // fuse
    { kind: 'strokePoly', points: [0, -24, 6, -32], stroke: { color: p.accent, width: 4 } },
    circle(9, -36, 4, p.accent),
    // feet
    roundRect(-14, 22, 10, 8, 4, p.secondary),
    roundRect(4, 22, 10, 8, 4, p.secondary),
    // eyes
    circle(-8, -6, 5, EYE_WHITE),
    circle(8, -6, 5, EYE_WHITE),
    circle(-8, -6, 2.4, EYE_DARK),
    circle(8, -6, 2.4, EYE_DARK),
    poly([-8, 6, 8, 6, 0, 12], EYE_DARK),
  ];
  return { commands: c };
}

function giantBeetleArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // horn
    tri(-10, -24, 2, -26, -2, -46, p.accent),
    // armored shell (elytra)
    ellipse(0, 2, 38, 28, p.secondary),
    ellipse(0, -2, 34, 20, p.primary),
    poly([0, -20, -4, 10, 0, 16], p.secondary, 0.8),
    // legs
    roundRect(-30, 12, 8, 16, 4, p.secondary),
    roundRect(-10, 20, 8, 16, 4, p.secondary),
    roundRect(4, 20, 8, 16, 4, p.secondary),
    roundRect(24, 12, 8, 16, 4, p.secondary),
    // head
    circle(0, -22, 12, p.primary),
    ...eyePair(-4, -24, 4, 3),
  ];
  return { commands: c };
}

// ---------------------------------------------------------------------------
// Main bosses
// ---------------------------------------------------------------------------

function armoredColossusArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    ellipse(0, 10, 46, 26, p.secondary),
    ellipse(0, 0, 44, 24, p.primary),
    // armored plates
    poly([-30, -16, -16, -26, -8, -12], p.accent, 0.7),
    poly([-8, -20, 8, -30, 16, -14], p.accent, 0.7),
    // spikes
    tri(-36, -6, -46, -16, -28, -12, p.accent),
    tri(36, -6, 46, -16, 28, -12, p.accent),
    // face
    circle(0, -18, 14, p.primary),
    ...eyePair(-7, -20, 7, 5),
    poly([-8, -8, 0, -2, 8, -8], EYE_DARK),
  ];
  return { commands: c };
}

function stormGarudaArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // lightning wings
    poly([-18, -8, -52, -34, -40, -2, -20, 8], p.secondary),
    poly([18, -8, 52, -34, 40, -2, 20, 8], p.secondary),
    poly([-30, -24, -24, -12, -18, -24, -12, -12], p.accent),
    poly([30, -24, 24, -12, 18, -24, 12, -12], p.accent),
    ellipse(0, 4, 32, 28, p.primary),
    tri(-14, 22, -4, 22, -8, 38, p.primary),
    tri(14, 22, 4, 22, 8, 38, p.primary),
    circle(0, -18, 15, p.primary),
    tri(-2, -34, 2, -34, 0, -44, p.accent),
    ...eyePair(-6, -20, 6, 4),
  ];
  return { commands: c };
}

function venomKingCrocArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    ellipse(0, 6, 44, 24, p.secondary),
    ellipse(2, 2, 42, 22, p.primary),
    poly([30, -4, 60, -10, 30, 8], p.primary),
    // poison fangs
    tri(52, -6, 56, 2, 58, -4, 0xffffff),
    // crown
    tri(-16, -22, -10, -40, -2, -24, p.accent),
    tri(-8, -22, 0, -42, 8, -24, p.accent),
    tri(2, -24, 12, -40, 18, -22, p.accent),
    // back ridge
    tri(-18, -14, -10, -28, -4, -12, p.secondary),
    // tail
    poly([-40, 4, -56, -6, -42, 12], p.accent),
    ...eyePair(-2, -6, 12, 5),
    // poison droplets
    circle(52, 12, 4, p.accent, 0.8),
    circle(58, 20, 3, p.accent, 0.6),
  ];
  return { commands: c };
}

function shadowPrinceArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // cloak
    poly([-30, -30, 0, -18, 30, -30, 22, 30, 0, 22, -22, 30], p.secondary),
    // inner
    poly([-16, -20, 0, -12, 16, -20, 12, 24, 0, 18, -12, 24], p.primary, 0.8),
    // head
    circle(0, -28, 13, p.primary),
    // crown
    tri(-10, -38, -6, -46, -2, -38, p.accent),
    tri(0, -38, 4, -48, 8, -38, p.accent),
    // glowing eyes
    circle(-5, -28, 3.5, p.accent),
    circle(5, -28, 3.5, p.accent),
    circle(-5, -28, 1.5, EYE_WHITE),
    circle(5, -28, 1.5, EYE_WHITE),
  ];
  return { commands: c };
}

function twinWarriorArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    roundRect(-16, 6, 12, 22, 5, p.secondary),
    roundRect(4, 6, 12, 22, 5, p.secondary),
    roundRect(-12, -12, 24, 26, 8, p.primary),
    circle(0, -24, 13, p.primary),
    tri(-8, -44, 2, -32, -16, -34, p.accent),
    ...eyePair(-4, -26, 4, 4),
    // sword
    roundRect(24, -22, 5, 26, 2, 0xcfe0ff),
    roundRect(20, -20, 13, 5, 2, p.accent),
    // shield
    ellipse(-26, -2, 12, 16, p.accent),
    ellipse(-26, -2, 6, 9, p.secondary),
  ];
  return { commands: c };
}

function twinHealerArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // robe
    poly([-20, -10, 0, -4, 20, -10, 16, 28, 0, 22, -16, 28], p.primary),
    circle(0, -20, 12, p.primary),
    // hood
    tri(-16, -28, -6, -22, -14, -16, p.secondary, 0.7),
    ...eyePair(-4, -20, 4, 3.4),
    // staff with orb
    roundRect(24, -30, 5, 52, 2, 0xc9a06a),
    circle(26, -34, 6, p.accent),
    circle(26, -34, 3, EYE_WHITE),
  ];
  return { commands: c };
}

function lavaGolemArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    roundRect(-22, -16, 16, 20, 5, p.secondary),
    roundRect(6, -16, 16, 20, 5, p.secondary),
    ellipse(0, -2, 40, 34, p.secondary),
    ellipse(0, -6, 34, 26, p.primary),
    // lava cracks
    poly([-14, -20, -6, -12, -14, -4, -4, 2, -12, 10], p.accent),
    poly([16, -18, 12, -10, 20, -2, 14, 8], p.accent),
    circle(0, -28, 13, p.primary),
    // glowing eyes
    circle(-5, -28, 4, p.accent),
    circle(5, -28, 4, p.accent),
  ];
  return { commands: c };
}

function chaosDragonArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // wings
    poly([-10, -12, -54, -44, -38, -4, -12, 4], p.secondary),
    poly([10, -12, 54, -44, 38, -4, 12, 4], p.secondary),
    // body
    ellipse(0, 4, 34, 26, p.primary),
    // tail
    poly([-30, 10, -52, 2, -36, 22], p.primary),
    tri(-52, 2, -58, 8, -46, 6, p.accent),
    // head
    circle(8, -20, 14, p.primary),
    tri(18, -32, 14, -46, 26, -32, p.accent),
    ...eyePair(4, -22, 14, 3.4),
    // horns on head back
    tri(0, -30, -6, -40, 6, -32, p.secondary),
  ];
  return { commands: c };
}

function megaChaosKingArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // cape
    poly([-36, -14, 0, -8, 36, -14, 28, 30, 0, 24, -28, 30], p.secondary),
    // body
    ellipse(0, 0, 36, 32, p.primary),
    // big arms
    circle(-34, 4, 12, p.secondary),
    circle(34, 4, 12, p.secondary),
    // head
    circle(0, -26, 18, p.primary),
    // horns
    tri(-16, -38, -8, -28, -24, -54, p.accent),
    tri(16, -38, 8, -28, 24, -54, p.accent),
    // crown
    tri(-12, -44, -6, -58, 0, -46, p.accent),
    tri(-2, -46, 4, -62, 10, -44, p.accent),
    // glowing eyes
    circle(-7, -28, 5, p.accent),
    circle(7, -28, 5, p.accent),
    circle(-7, -28, 2, EYE_WHITE),
    circle(7, -28, 2, EYE_WHITE),
    poly([-10, -16, 0, -10, 10, -16, 0, -12], EYE_DARK),
  ];
  return { commands: c };
}

// ---------------------------------------------------------------------------
// Surprise bosses
// ---------------------------------------------------------------------------

function kappaCaptainArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // shell
    circle(0, 4, 26, p.primary),
    circle(0, 4, 18, p.secondary),
    // head
    circle(0, -16, 14, p.primary),
    // beak
    tri(-6, -14, 6, -14, 0, -6, p.accent),
    // bowl on head (water)
    poly([-12, -28, 12, -28, 8, -34, -8, -34], 0x3a6ea8),
    ...eyePair(-5, -18, 5, 3),
    // legs
    roundRect(-14, 24, 10, 8, 4, p.secondary),
    roundRect(4, 24, 10, 8, 4, p.secondary),
  ];
  return { commands: c };
}

function nightmareMothArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    poly([-8, -6, -50, -32, -36, 18], p.primary),
    poly([8, -6, 50, -32, 36, 18], p.primary),
    // nightmare "eyes" on wings
    circle(-28, -2, 9, p.secondary),
    circle(-28, -2, 4.5, p.accent),
    circle(28, -2, 9, p.secondary),
    circle(28, -2, 4.5, p.accent),
    ellipse(0, 6, 10, 26, p.secondary),
    circle(0, -18, 9, p.primary),
    ...eyePair(-3, -20, 3, 2.5),
    tri(-8, -28, -12, -40, -2, -32, p.secondary),
    tri(8, -28, 12, -40, 2, -32, p.secondary),
  ];
  return { commands: c };
}

function ironHedgehogArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    ellipse(0, 2, 34, 26, p.primary),
    circle(10, -8, 12, p.accent, 0.85),
    circle(10, -8, 5, EYE_DARK),
  ];
  // metal spikes arranged in a fan
  for (let i = 0; i < 7; i += 1) {
    const a = -Math.PI * 0.95 + (i * Math.PI * 0.9) / 6;
    const bx = Math.cos(a) * 30;
    const by = Math.sin(a) * 24 - 4;
    const sx = Math.cos(a) * 44;
    const sy = Math.sin(a) * 36 - 6;
    const ex = bx + Math.cos(a + 0.5) * 8;
    const ey = by + Math.sin(a + 0.5) * 8;
    c.push(tri(bx, by, sx, sy, ex, ey, p.secondary));
  }
  c.push(
    roundRect(-22, 18, 12, 8, 4, p.secondary),
    roundRect(6, 18, 12, 8, 4, p.secondary),
    circle(4, -12, 3, EYE_WHITE),
    circle(4, -12, 1.5, EYE_DARK),
  );
  return { commands: c };
}

function bubbleDuchessArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [
    // floating bubble body
    circle(0, 4, 30, p.primary),
    circle(-10, -4, 8, 0xffffff, 0.35),
    // crown
    tri(-14, -22, -8, -40, 0, -24, p.accent),
    tri(-4, -24, 2, -44, 10, -22, p.accent),
    // little arms
    roundRect(-34, 6, 10, 5, 2, p.primary),
    roundRect(24, 6, 10, 5, 2, p.primary),
    ...eyePair(-7, -2, 7, 6),
    circle(-11, 8, 4, p.accent, 0.6),
    circle(11, 8, 4, p.accent, 0.6),
    poly([-5, 4, 5, 4, 0, 10], p.secondary),
  ];
  return { commands: c };
}

function voidEyeArt(p: Palette): CreatureShape {
  const c: ShapeCommand[] = [];
  // tendrils radiating outward
  for (let i = 0; i < 8; i += 1) {
    const a = (i * Math.PI) / 4;
    const ix = Math.cos(a) * 22;
    const iy = Math.sin(a) * 22;
    const tx = Math.cos(a) * 44;
    const ty = Math.sin(a) * 44;
    c.push({
      kind: 'strokePoly',
      points: [ix, iy, tx, ty],
      stroke: { color: p.secondary, width: 4, alpha: 0.7 },
    });
  }
  // eyeball
  c.push(
    circle(0, 0, 26, p.primary),
    circle(0, 0, 26, 0xffffff),
    circle(0, 0, 15, p.accent),
    circle(0, 0, 7, EYE_DARK),
    circle(-3, -3, 2.5, 0xffffff, 0.9),
  );
  return { commands: c };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const CREATURE_ART: Readonly<Record<CreatureKind, (p: Palette) => CreatureShape>> = {
  'laser-crocodile': laserCrocodileArt,
  'lightning-scorpion': lightningScorpionArt,
  'armored-rhino': armoredRhinoArt,
  'frost-owl': frostOwlArt,
  'mini-brainrot': miniBrainrotArt,
  'armored-slug': armoredSlugArt,
  'shadow-runner': shadowRunnerArt,
  'mega-brainrot-gorilla': megaGorillaArt,
  'green-venom-falcon': falconArt,
  'venomous-wasp': venomousWaspArt,
  'rock-toad': rockToadArt,
  'storm-crow': stormCrowArt,
  'shield-crab': shieldCrabArt,
  'healer-mushroom': healerMushroomArt,
  'spitter-snail': spitterSnailArt,
  'mirror-moth': mirrorMothArt,
  'chaos-imp': chaosImpArt,
  'bomb-imp': bombImpArt,
  'giant-beetle': giantBeetleArt,
  'armored-colossus': armoredColossusArt,
  'storm-garuda': stormGarudaArt,
  'venom-king-crocodile': venomKingCrocArt,
  'shadow-prince': shadowPrinceArt,
  'chaos-twin-warrior': twinWarriorArt,
  'chaos-twin-healer': twinHealerArt,
  'lava-golem': lavaGolemArt,
  'chaos-dragon': chaosDragonArt,
  'mega-chaos-king': megaChaosKingArt,
  'kappa-captain': kappaCaptainArt,
  'nightmare-moth': nightmareMothArt,
  'iron-hedgehog': ironHedgehogArt,
  'bubble-duchess': bubbleDuchessArt,
  'void-eye': voidEyeArt,
};

export const CREATURE_KINDS: readonly CreatureKind[] = Object.keys(CREATURE_ART) as CreatureKind[];

/** Creatures that hover/flap in the air and may use a gentle idle float. */
export const FLYING_CREATURES: ReadonlySet<CreatureKind> = new Set<CreatureKind>([
  'frost-owl',
  'green-venom-falcon',
  'venomous-wasp',
  'storm-crow',
  'mirror-moth',
  'nightmare-moth',
  'storm-garuda',
  'chaos-dragon',
  'void-eye',
  'bubble-duchess',
]);

export function isFlyingCreature(kind: CreatureKind): boolean {
  return FLYING_CREATURES.has(kind);
}

export function hasCreatureArt(kind: CreatureKind): boolean {
  return kind in CREATURE_ART;
}

export function creatureShape(kind: CreatureKind): CreatureShape {
  const build = CREATURE_ART[kind];
  if (!build) return { commands: [] };
  return build(paletteFor(kind));
}
