import { armoredSnailIconUrl } from '../game/rendering/armoredSnail';
import { greenVenomFalconIconUrl } from '../game/rendering/greenVenomFalcon';
import { laserCrocodileIconUrl } from '../game/rendering/laserCrocodile';
import { lightningScorpionIconUrl } from '../game/rendering/lightningScorpion';
import { megaBrainrotGorillaIconUrl } from '../game/rendering/megaBrainrotGorilla';
import { miniBrainrotIconUrl } from '../game/rendering/miniBrainrot';
import { shadowRunnerIconUrl } from '../game/rendering/shadowRunner';
import { creatureShape, type CreatureKind } from '../game/rendering/creatureArt';

interface CreatureAvatarProps {
  readonly kind: CreatureKind;
  readonly size?: number;
  readonly title?: string;
  readonly className?: string;
  readonly mergeRank?: number;
}

function cssColor(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function IconImage({ src }: { src: string; mergeRank?: number }) {
  return (
    <image href={src} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet" />
  );
}

// The seven original units keep their hand-drawn generated icons. Every M4 unit (and the
// two new heroes) is drawn from the shared procedural creature-art, giving each a distinct,
// recognizable silhouette that matches the battlefield renderer.

function ProceduralCreature({ kind }: { kind: CreatureKind }) {
  const shape = creatureShape(kind);
  return (
    <g transform="translate(50 42)">
      {shape.commands.map((command, index) => {
        switch (command.kind) {
          case 'circle':
            return (
              <circle
                key={index}
                cx={command.x}
                cy={command.y}
                r={command.r}
                fill={cssColor(command.fill)}
                opacity={command.alpha ?? 1}
              />
            );
          case 'ellipse':
            return (
              <ellipse
                key={index}
                cx={command.x}
                cy={command.y}
                rx={command.rx}
                ry={command.ry}
                fill={cssColor(command.fill)}
                opacity={command.alpha ?? 1}
              />
            );
          case 'poly':
            return (
              <polygon
                key={index}
                points={command.points.join(' ')}
                fill={cssColor(command.fill)}
                opacity={command.alpha ?? 1}
              />
            );
          case 'roundRect':
            return (
              <rect
                key={index}
                x={command.x}
                y={command.y}
                width={command.w}
                height={command.h}
                rx={command.r}
                ry={command.r}
                fill={cssColor(command.fill)}
                opacity={command.alpha ?? 1}
              />
            );
          case 'strokePoly':
            return (
              <polyline
                key={index}
                points={command.points.join(' ')}
                fill="none"
                stroke={cssColor(command.stroke.color)}
                strokeWidth={command.stroke.width}
                opacity={command.stroke.alpha ?? 1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          case 'strokeCircle':
            return (
              <circle
                key={index}
                cx={command.x}
                cy={command.y}
                r={command.r}
                fill="none"
                stroke={cssColor(command.stroke.color)}
                strokeWidth={command.stroke.width}
                opacity={command.stroke.alpha ?? 1}
              />
            );
          default:
            return null;
        }
      })}
    </g>
  );
}

function CreatureShape({ kind, mergeRank }: { kind: CreatureKind; mergeRank: number }) {
  switch (kind) {
    case 'laser-crocodile':
      return <IconImage src={laserCrocodileIconUrl(mergeRank)} />;
    case 'lightning-scorpion':
      return <IconImage src={lightningScorpionIconUrl(mergeRank)} />;
    case 'mini-brainrot':
      return <IconImage src={miniBrainrotIconUrl()} />;
    case 'armored-slug':
      return <IconImage src={armoredSnailIconUrl()} />;
    case 'shadow-runner':
      return <IconImage src={shadowRunnerIconUrl()} />;
    case 'mega-brainrot-gorilla':
      return <IconImage src={megaBrainrotGorillaIconUrl()} />;
    case 'green-venom-falcon':
      return <IconImage src={greenVenomFalconIconUrl()} />;
    default:
      return <ProceduralCreature kind={kind} />;
  }
}

export function CreatureAvatar({
  kind,
  size = 64,
  title,
  className,
  mergeRank = 1,
}: CreatureAvatarProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <CreatureShape kind={kind} mergeRank={mergeRank} />
    </svg>
  );
}
