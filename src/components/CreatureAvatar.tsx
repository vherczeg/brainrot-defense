import type { CharacterTypeId, EnemyTypeId } from '../game/domain/types';

export type CreatureKind = CharacterTypeId | EnemyTypeId;

interface CreatureAvatarProps {
  readonly kind: CreatureKind;
  readonly size?: number;
  readonly title?: string;
  readonly className?: string;
}

function LaserCrocodile() {
  return (
    <g>
      <ellipse cx="50" cy="86" rx="32" ry="7" fill="rgba(4, 8, 24, 0.45)" />
      <path d="M28 62 Q8 68 10 82 Q26 78 40 72 Z" fill="#0f9f6e" />
      <path d="M22 45 L30 28 L40 40 L49 22 L58 40 L69 30 L72 48 Z" fill="#0b7a55" />
      <ellipse cx="45" cy="57" rx="30" ry="25" fill="#39e58c" />
      <ellipse cx="45" cy="57" rx="30" ry="25" fill="none" stroke="#0b7a55" strokeWidth="3" />
      <path
        d="M61 48 Q88 48 91 61 Q89 74 62 74 Z"
        fill="#6dffb0"
        stroke="#0b7a55"
        strokeWidth="3"
      />
      <circle cx="60" cy="45" r="8" fill="#ffffff" />
      <circle cx="62" cy="46" r="4" fill="#0c2a24" />
      <circle cx="63" cy="45" r="1.5" fill="#ffffff" />
      <path d="M64 65 L70 65 L67 71 Z" fill="#fff8de" />
      <path d="M75 65 L81 65 L78 71 Z" fill="#fff8de" />
      <path d="M84 60 H97" stroke="#9bff5a" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      <path d="M84 57 H93" stroke="#e9ffc9" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
      <circle cx="34" cy="62" r="5" fill="#0f9f6e" />
    </g>
  );
}

function LightningScorpion() {
  return (
    <g>
      <ellipse cx="50" cy="86" rx="30" ry="7" fill="rgba(4, 8, 24, 0.45)" />
      <path
        d="M67 58 Q84 56 82 38 Q80 22 65 18"
        fill="none"
        stroke="#5b2bd1"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M65 18 L56 30 L66 31 L58 45 L76 27 L66 27 Z"
        fill="#62e7ff"
        stroke="#1f1680"
        strokeWidth="1.5"
      />
      <ellipse cx="49" cy="63" rx="26" ry="19" fill="#b066ff" stroke="#5b2bd1" strokeWidth="3" />
      <path d="M33 56 L18 46" stroke="#5b2bd1" strokeWidth="7" strokeLinecap="round" />
      <path d="M18 46 L7 52 L12 64 L25 61 Z" fill="#b066ff" stroke="#5b2bd1" strokeWidth="2.5" />
      <path d="M65 56 L80 46" stroke="#5b2bd1" strokeWidth="7" strokeLinecap="round" />
      <path d="M80 46 L93 52 L88 64 L75 61 Z" fill="#b066ff" stroke="#5b2bd1" strokeWidth="2.5" />
      <circle cx="41" cy="60" r="5" fill="#d8fbff" />
      <circle cx="41" cy="60" r="2.2" fill="#1f1680" />
      <circle cx="57" cy="60" r="5" fill="#d8fbff" />
      <circle cx="57" cy="60" r="2.2" fill="#1f1680" />
      <path
        d="M40 71 Q49 76 58 71"
        fill="none"
        stroke="#3d1691"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M28 32 L33 42 L39 34"
        fill="none"
        stroke="#62e7ff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
}

function MiniBrainrot() {
  return (
    <g>
      <ellipse cx="50" cy="87" rx="27" ry="6" fill="rgba(4, 8, 24, 0.45)" />
      <path d="M36 22 L30 8 L43 16 Z" fill="#a41343" />
      <path d="M64 22 L70 8 L57 16 Z" fill="#a41343" />
      <path
        d="M18 54 Q14 26 36 20 Q50 12 64 20 Q86 26 82 54 Q78 82 50 84 Q22 82 18 54 Z"
        fill="#ff5a7a"
        stroke="#a41343"
        strokeWidth="3"
      />
      <path
        d="M28 47 Q36 40 44 47"
        fill="none"
        stroke="#5c0b28"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M56 47 Q64 40 72 47"
        fill="none"
        stroke="#5c0b28"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="36" cy="52" r="4.5" fill="#fff6f8" />
      <circle cx="36" cy="52" r="2" fill="#3a0c1c" />
      <circle cx="64" cy="52" r="4.5" fill="#fff6f8" />
      <circle cx="64" cy="52" r="2" fill="#3a0c1c" />
      <path
        d="M42 66 Q50 72 58 66"
        fill="none"
        stroke="#5c0b28"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M46 67 L48 73 L51 67 Z" fill="#fff6f8" />
      <path d="M55 67 L57 73 L60 67 Z" fill="#fff6f8" />
    </g>
  );
}

function ArmoredSlug() {
  return (
    <g>
      <ellipse cx="50" cy="87" rx="34" ry="6" fill="rgba(4, 8, 24, 0.45)" />
      <path d="M12 74 Q10 84 24 86 L80 86 Q90 84 88 74 Z" fill="#ffa36b" />
      <path
        d="M20 67 Q16 28 50 22 Q84 28 80 67 Q66 78 50 78 Q34 78 20 67 Z"
        fill="#d24b5f"
        stroke="#5a1029"
        strokeWidth="3"
      />
      <path
        d="M50 31 Q66 31 68 48 Q68 62 52 65 Q38 63 39 49 Q40 38 50 37"
        fill="none"
        stroke="#ffc2a8"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="34" cy="62" r="5" fill="#fff6ed" />
      <circle cx="34" cy="62" r="2.3" fill="#31101c" />
      <circle cx="47" cy="63" r="5" fill="#fff6ed" />
      <circle cx="47" cy="63" r="2.3" fill="#31101c" />
      <path d="M21 58 L14 52 L18 68 Z" fill="#ffa36b" />
      <path d="M79 58 L86 52 L82 68 Z" fill="#ffa36b" />
    </g>
  );
}

function ShadowRunner() {
  return (
    <g>
      <ellipse cx="52" cy="88" rx="33" ry="5" fill="rgba(4, 8, 24, 0.45)" />
      <path
        d="M8 58 L36 34 L58 42 L90 20 L76 54 L92 74 L54 66 L30 82 Z"
        fill="#ff7a45"
        stroke="#6b1a3a"
        strokeWidth="3"
      />
      <path d="M30 82 L20 94 L42 78 Z" fill="#6b1a3a" />
      <path d="M76 54 L57 62" stroke="#ffd166" strokeWidth="4" strokeLinecap="round" />
      <circle cx="58" cy="50" r="5" fill="#fff6df" />
      <circle cx="59" cy="50" r="2.2" fill="#3d0f1e" />
      <path d="M64 44 L72 38" stroke="#ffd166" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M38 46 L44 52" stroke="#ffd166" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function MegaBoss() {
  return (
    <g>
      <ellipse cx="50" cy="89" rx="38" ry="7" fill="rgba(4, 8, 24, 0.5)" />
      <path
        d="M16 66 Q8 44 24 34 Q35 28 40 38 L60 38 Q65 28 76 34 Q92 44 84 66 Q92 82 72 84 L28 84 Q8 82 16 66 Z"
        fill="#ff3b6b"
        stroke="#3a0c33"
        strokeWidth="3"
      />
      <path d="M26 40 L18 20 L36 32 Z" fill="#ffef5e" stroke="#3a0c33" strokeWidth="2" />
      <path d="M74 40 L82 20 L64 32 Z" fill="#ffef5e" stroke="#3a0c33" strokeWidth="2" />
      <path
        d="M24 56 Q34 38 50 38 Q66 38 76 56 Q70 74 50 76 Q30 74 24 56 Z"
        fill="#ff6a8a"
        stroke="#3a0c33"
        strokeWidth="3"
      />
      <path d="M31 59 L45 55" stroke="#3a0c33" strokeWidth="4" strokeLinecap="round" />
      <path d="M69 59 L55 55" stroke="#3a0c33" strokeWidth="4" strokeLinecap="round" />
      <circle cx="39" cy="59" r="4" fill="#fff7b0" />
      <circle cx="39" cy="59" r="2" fill="#3a0c33" />
      <circle cx="61" cy="59" r="4" fill="#fff7b0" />
      <circle cx="61" cy="59" r="2" fill="#3a0c33" />
      <path
        d="M38 70 Q50 78 62 70"
        fill="none"
        stroke="#3a0c33"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M42 71 L45 79 L49 71 Z" fill="#fff7b0" />
      <path d="M53 71 L57 79 L60 71 Z" fill="#fff7b0" />
      <path d="M10 74 Q18 58 26 66" stroke="#3a0c33" strokeWidth="8" strokeLinecap="round" />
      <path d="M90 74 Q82 58 74 66" stroke="#3a0c33" strokeWidth="8" strokeLinecap="round" />
    </g>
  );
}

function CreatureShape({ kind }: { kind: CreatureKind }) {
  switch (kind) {
    case 'laser-crocodile':
      return <LaserCrocodile />;
    case 'lightning-scorpion':
      return <LightningScorpion />;
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

export function CreatureAvatar({ kind, size = 64, title, className }: CreatureAvatarProps) {
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
      <CreatureShape kind={kind} />
    </svg>
  );
}
