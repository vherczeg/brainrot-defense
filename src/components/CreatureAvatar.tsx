import { armoredSnailIconUrl } from '../game/rendering/armoredSnail';
import { laserCrocodileIconUrl } from '../game/rendering/laserCrocodile';
import { lightningScorpionIconUrl } from '../game/rendering/lightningScorpion';
import { megaBrainrotGorillaIconUrl } from '../game/rendering/megaBrainrotGorilla';
import { miniBrainrotIconUrl } from '../game/rendering/miniBrainrot';
import { shadowRunnerIconUrl } from '../game/rendering/shadowRunner';
import type { CharacterTypeId, EnemyTypeId } from '../game/domain/types';

export type CreatureKind = CharacterTypeId | EnemyTypeId;

interface CreatureAvatarProps {
  readonly kind: CreatureKind;
  readonly size?: number;
  readonly title?: string;
  readonly className?: string;
  readonly mergeRank?: number;
}

function LaserCrocodile({ mergeRank }: { mergeRank: number }) {
  return (
    <image
      href={laserCrocodileIconUrl(mergeRank)}
      x="0"
      y="0"
      width="100"
      height="100"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

function LightningScorpion({ mergeRank }: { mergeRank: number }) {
  return (
    <image
      href={lightningScorpionIconUrl(mergeRank)}
      x="0"
      y="0"
      width="100"
      height="100"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

function MiniBrainrot() {
  return (
    <image
      href={miniBrainrotIconUrl()}
      x="0"
      y="0"
      width="100"
      height="100"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

function ArmoredSlug() {
  return (
    <image
      href={armoredSnailIconUrl()}
      x="0"
      y="0"
      width="100"
      height="100"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

function ShadowRunner() {
  return (
    <image
      href={shadowRunnerIconUrl()}
      x="0"
      y="0"
      width="100"
      height="100"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

function MegaBoss() {
  return (
    <image
      href={megaBrainrotGorillaIconUrl()}
      x="0"
      y="0"
      width="100"
      height="100"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

function GreenVenomFalcon() {
  // Procedural placeholder for the M3.1 boss. The final portrait is intentionally not
  // presented as finished art; see docs/green-venom-falcon/ASSET_GUIDE.txt.
  return (
    <g>
      <ellipse cx="50" cy="62" rx="25" ry="20" fill="#9b6338" />
      <path d="M27 49 L8 27 L36 38 Z" fill="#24150c" />
      <path d="M73 49 L92 27 L64 38 Z" fill="#24150c" />
      <circle cx="50" cy="35" r="17" fill="#9b6338" />
      <path d="M36 28 L32 15 L45 22 Z" fill="#24150c" />
      <path d="M64 28 L68 15 L55 22 Z" fill="#24150c" />
      <path d="M45 38 L55 38 L50 50 Z" fill="#7dff5a" />
      <circle cx="43" cy="32" r="3" fill="#0a1207" />
      <circle cx="57" cy="32" r="3" fill="#0a1207" />
      <path
        d="M38 72 L33 88 L24 94 M38 72 L45 90 L50 96"
        stroke="#070707"
        strokeWidth="5"
        fill="none"
      />
      <path
        d="M62 72 L67 88 L76 94 M62 72 L55 90 L50 96"
        stroke="#070707"
        strokeWidth="5"
        fill="none"
      />
      <path d="M24 94 L34 86 L34 99 Z M50 96 L57 87 L57 101 Z" fill="#070707" />
      <path d="M76 94 L66 86 L66 99 Z M50 96 L43 87 L43 101 Z" fill="#070707" />
      <circle cx="72" cy="55" r="4" fill="#7dff5a" opacity="0.9" />
      <circle cx="78" cy="63" r="2.6" fill="#7dff5a" opacity="0.8" />
    </g>
  );
}

function CreatureShape({ kind, mergeRank }: { kind: CreatureKind; mergeRank: number }) {
  switch (kind) {
    case 'laser-crocodile':
      return <LaserCrocodile mergeRank={mergeRank} />;
    case 'lightning-scorpion':
      return <LightningScorpion mergeRank={mergeRank} />;
    case 'mini-brainrot':
      return <MiniBrainrot />;
    case 'armored-slug':
      return <ArmoredSlug />;
    case 'shadow-runner':
      return <ShadowRunner />;
    case 'mega-brainrot-gorilla':
      return <MegaBoss />;
    case 'green-venom-falcon':
      return <GreenVenomFalcon />;
    default:
      return null;
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
