import { hudIconUrl, type HudIconName } from '../game/rendering/hudIcons';

export type IconName =
  | 'coin'
  | 'settings'
  | 'sound'
  | 'muted'
  | 'pause'
  | 'resume'
  | 'play'
  | 'bolt'
  | 'trophy'
  | 'save'
  | 'download'
  | 'upload'
  | 'arrow-right'
  | 'arrow-left'
  | 'close'
  | 'merge'
  | 'tutorial'
  | 'check'
  | 'warning'
  | 'skull'
  | 'life-heart'
  | 'enemy-wave'
  | 'battle-speed'
  | 'boss-crown'
  | 'timer'
  | 'defeat-heart'
  | 'home-base';

const HUD_ICON_MAP: Partial<Record<IconName, HudIconName>> = {
  coin: 'coin',
  settings: 'settings',
  pause: 'pause',
  resume: 'resume',
  trophy: 'victory-trophy',
  merge: 'merge',
  'life-heart': 'life-heart',
  'enemy-wave': 'enemy-wave',
  'battle-speed': 'battle-speed',
  'boss-crown': 'boss-crown',
  timer: 'timer',
  'defeat-heart': 'defeat-heart',
  'home-base': 'home-base',
};

const PATHS: Readonly<Record<IconName, string>> = {
  coin: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 2.5v9M9.5 8h4a2 2 0 0 1 0 4h-3.5',
  settings:
    'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.4 2.2.9 1.3-1.8 2.6.2 1.5 1 2.1-1.8 1.8-2.1-1-1.5-.2-2.6 1.8-1.3-.9-.9-1.3 1.8-2.6-.2-1.5-1-2.1 1.8-1.8 2.1 1 1.5.2 2.6-1.8 1.3.9Z',
  sound: 'M4 9v6h3l5 4V5L7 9H4Zm11.5-2.5a7 7 0 0 1 0 11M18 4a11 11 0 0 1 0 16',
  muted: 'M4 9v6h3l5 4V5L7 9H4Zm11 1 5 5m0-5-5 5',
  pause: 'M7 5h4v14H7zm6 0h4v14h-4z',
  play: 'M8 5v14l11-7Z',
  bolt: 'M13 2 4 14h6l-1 8 9-12h-6l1-8Z',
  trophy:
    'M7 4h10v4a5 5 0 0 1-10 0V4Zm-3 1h3v3a3 3 0 0 1-3-3Zm16 0h-3v3a3 3 0 0 0 3-3ZM10 16h4v3h-4zm-3 3h10',
  save: 'M5 3h12l3 3v15H5V3Zm3 0v6h8V3M8 14h8v6H8z',
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 19h16',
  upload: 'M12 16V4m0 0 4 4m-4-4L8 8M4 20h16',
  'arrow-right': 'M4 12h15m0 0-5-5m5 5-5 5',
  'arrow-left': 'M20 12H5m0 0 5-5m-5 5 5 5',
  close: 'M6 6l12 12M18 6 6 18',
  merge: 'M7 4h6l-2 6h5l-9 10 2-8H4l3-8Z',
  tutorial:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 13.5v.5M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8',
  check: 'M4 12.5 9 17.5 20 6.5',
  warning: 'M12 3 2 21h20L12 3Zm0 5v7m0 3v.5',
  skull:
    'M12 2a8 8 0 0 0-8 8c0 2.7 1.3 4.7 3 6v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3c1.7-1.3 3-3.3 3-6a8 8 0 0 0-8-8Zm-3 8.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Zm6 0a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6ZM10 17h4v3h-4z',
  'life-heart': 'M12 21S4 15.5 4 9.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 3.5C20 15.5 12 21 12 21Z',
  'enemy-wave': 'M5 20V4m0 0 11 2-2 4 2 4-11 2',
  'battle-speed': 'M13 2 4 14h6l-1 8 9-12h-6l1-8Z',
  resume: 'M8 5v14l11-7Z',
  'boss-crown': 'M4 18h16l-1-11-5 4-2-7-2 7-5-4-1 11Z',
  timer: 'M12 7v5l3 2M9 2h6M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z',
  'defeat-heart':
    'M12 21S4 15.5 4 9.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 3.5C20 15.5 12 21 12 21Zm-4-9 8-5',
  'home-base': 'M3 11 12 3l9 8v10h-6v-6H9v6H3V11Z',
};

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const hudIcon = HUD_ICON_MAP[name];
  if (hudIcon) {
    return (
      <img
        src={hudIconUrl(hudIcon)}
        width={size}
        height={size}
        className={className}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ display: 'block', flexShrink: 0, objectFit: 'contain' }}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
