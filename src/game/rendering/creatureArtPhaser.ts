import type Phaser from 'phaser';
import { creatureShape, type CreatureKind } from './creatureArt';

function toPoints(points: readonly number[]): Phaser.Types.Math.Vector2Like[] {
  const result: Phaser.Types.Math.Vector2Like[] = [];
  for (let index = 0; index < points.length; index += 2) {
    result.push({ x: points[index] ?? 0, y: points[index + 1] ?? 0 });
  }
  return result;
}

/**
 * Draws a creature's procedural artwork into a Phaser Graphics object. This is the fallback
 * renderer for units without a spritesheet, and the primary renderer for every M4 unit.
 */
export function drawCreatureArtToGraphics(
  g: Phaser.GameObjects.Graphics,
  kind: CreatureKind,
): void {
  const shape = creatureShape(kind);
  for (const command of shape.commands) {
    switch (command.kind) {
      case 'circle':
        g.fillStyle(command.fill, command.alpha ?? 1);
        g.fillCircle(command.x, command.y, command.r);
        break;
      case 'ellipse':
        g.fillStyle(command.fill, command.alpha ?? 1);
        g.fillEllipse(command.x, command.y, command.rx, command.ry);
        break;
      case 'poly':
        g.fillStyle(command.fill, command.alpha ?? 1);
        g.fillPoints(toPoints(command.points), true);
        break;
      case 'roundRect':
        g.fillStyle(command.fill, command.alpha ?? 1);
        g.fillRoundedRect(command.x, command.y, command.w, command.h, command.r);
        break;
      case 'strokePoly': {
        const { color, width, alpha } = command.stroke;
        g.lineStyle(width, color, alpha ?? 1);
        g.beginPath();
        const pts = toPoints(command.points);
        for (let index = 0; index < pts.length; index += 1) {
          const point = pts[index];
          if (!point) continue;
          if (index === 0) g.moveTo(point.x, point.y);
          else g.lineTo(point.x, point.y);
        }
        g.strokePath();
        break;
      }
      case 'strokeCircle':
        g.lineStyle(command.stroke.width, command.stroke.color, command.stroke.alpha ?? 1);
        g.strokeCircle(command.x, command.y, command.r);
        break;
    }
  }
}
