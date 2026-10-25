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
