import { describe, expect, it } from 'vitest';
import { CHARACTER_TYPE_IDS } from '../../src/game/domain/characters';
import { ENEMY_TYPE_IDS } from '../../src/game/domain/enemies';
import {
  CREATURE_KINDS,
  creatureShape,
  hasCreatureArt,
  isFlyingCreature,
  type CreatureKind,
  type ShapeCommand,
} from '../../src/game/rendering/creatureArt';

function assertValidCommand(command: ShapeCommand): void {
  switch (command.kind) {
    case 'circle':
      expect(Number.isFinite(command.x) && Number.isFinite(command.y)).toBe(true);
      expect(command.r).toBeGreaterThan(0);
      break;
    case 'ellipse':
      expect(command.rx).toBeGreaterThan(0);
      expect(command.ry).toBeGreaterThan(0);
      break;
    case 'poly':
      expect(command.points.length).toBeGreaterThanOrEqual(6);
      expect(command.points.length % 2).toBe(0);
      break;
    case 'roundRect':
      expect(command.w).toBeGreaterThan(0);
      expect(command.h).toBeGreaterThan(0);
      break;
    case 'strokePoly':
      expect(command.points.length).toBeGreaterThanOrEqual(4);
      expect(command.stroke.width).toBeGreaterThan(0);
      break;
    case 'strokeCircle':
      expect(command.r).toBeGreaterThan(0);
      break;
  }
}

describe('procedural creature art coverage', () => {
  it('provides art for every playable character', () => {
    for (const typeId of CHARACTER_TYPE_IDS) {
      expect(hasCreatureArt(typeId), `${typeId} must have art`).toBe(true);
      const shape = creatureShape(typeId);
      expect(shape.commands.length, `${typeId} art must not be empty`).toBeGreaterThan(0);
    }
  });

  it('provides art for every enemy and boss', () => {
    for (const typeId of ENEMY_TYPE_IDS) {
      expect(hasCreatureArt(typeId), `${typeId} must have art`).toBe(true);
      const shape = creatureShape(typeId);
      expect(shape.commands.length, `${typeId} art must not be empty`).toBeGreaterThan(0);
    }
  });

  it('covers exactly the union of characters and enemies', () => {
    const expected = new Set<CreatureKind>([...CHARACTER_TYPE_IDS, ...ENEMY_TYPE_IDS]);
    const actual = new Set<CreatureKind>(CREATURE_KINDS);
    expect([...actual].sort()).toEqual([...expected].sort());
  });

  it('emits only structurally valid commands', () => {
    for (const kind of CREATURE_KINDS) {
      const shape = creatureShape(kind);
      for (const command of shape.commands) assertValidCommand(command);
    }
  });

  it('gives distinct shapes to distinct creatures', () => {
    const signatures = new Map<string, CreatureKind>();
    for (const kind of CREATURE_KINDS) {
      const shape = creatureShape(kind);
      const signature = JSON.stringify(shape.commands.map((command) => command.kind));
      const previous = signatures.get(signature);
      if (previous) {
        expect.fail(`${previous} and ${kind} share an identical primitive sequence`);
      }
      signatures.set(signature, kind);
    }
  });

  it('marks flying creatures for the gentle hover animation', () => {
    expect(isFlyingCreature('frost-owl')).toBe(true);
    expect(isFlyingCreature('green-venom-falcon')).toBe(true);
    expect(isFlyingCreature('venomous-wasp')).toBe(true);
    expect(isFlyingCreature('armored-rhino')).toBe(false);
    expect(isFlyingCreature('laser-crocodile')).toBe(false);
    expect(isFlyingCreature('rock-toad')).toBe(false);
  });
});
