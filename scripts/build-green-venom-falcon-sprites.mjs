import { execFileSync } from 'node:child_process';
import console from 'node:console';
import fs from 'node:fs';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const unitDir = path.join(root, 'public/assets/units/green-venom-falcon');
const effectDir = path.join(root, 'public/assets/effects/green-venom-falcon');
const iconPath = path.join(root, 'public/assets/icons/green-venom-falcon.png');
const SIZE = 256;

const mag = (args, encoding = 'utf8') =>
  execFileSync('magick', args, { encoding, maxBuffer: 64 * 1024 * 1024 });

const palette = {
  brown: '#8b5a2b',
  brownDark: '#4a2a12',
  brownLight: '#c08a4a',
  brownShadow: '#2a1608',
  black: '#0a0908',
  claw: '#070707',
  beak: '#2b2520',
  beakLight: '#d9a441',
  eye: '#ffe45c',
  eyeDark: '#160d04',
  green: '#7dff5a',
  greenDark: '#2f9b3c',
  greenGlow: '#b6ff7a',
  red: '#ff5a5a',
  cream: '#f2d6a2',
};

function wing(side, angle, accent = false) {
  const mirror = side === 'right' ? 'scale(-1 1)' : 'scale(1 1)';
  const feather = accent ? palette.greenDark : palette.brownDark;
  return `<g transform="translate(128 138) ${mirror} rotate(${angle})">
    <path d="M 6 4 C -34 -22 -66 -70 -82 -126 C -38 -105 -10 -62 8 0 Z" fill="${palette.brown}" stroke="${palette.brownShadow}" stroke-width="3" />
    <path d="M 0 -2 C -30 -30 -52 -68 -64 -108 C -28 -88 -8 -52 4 -8 Z" fill="${palette.brownLight}" opacity="0.55" />
    <path d="M -18 -18 C -40 -40 -55 -70 -62 -98 M -8 -10 C -32 -36 -48 -66 -56 -92 M 1 -4 C -22 -30 -38 -58 -44 -80" stroke="${feather}" stroke-width="5" fill="none" stroke-linecap="round" />
    <path d="M -70 -114 L -60 -104 L -76 -98 Z" fill="${palette.black}" opacity="0.8" />
  </g>`;
}

function talon(x, y, spread = 1, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M 0 0 L -2 14" stroke="${palette.brownDark}" stroke-width="8" stroke-linecap="round" />
    <path d="M -2 10 C -18 18 -26 26 -30 ${30 * spread}" stroke="${palette.claw}" stroke-width="6" fill="none" stroke-linecap="round" />
    <path d="M -2 10 C -6 22 -8 30 -8 ${38 * spread}" stroke="${palette.claw}" stroke-width="6" fill="none" stroke-linecap="round" />
    <path d="M -2 10 C 10 20 16 28 20 ${32 * spread}" stroke="${palette.claw}" stroke-width="6" fill="none" stroke-linecap="round" />
    <path d="M -30 ${30 * spread} L -22 ${24 * spread} L -23 ${38 * spread} Z" fill="${palette.claw}" />
    <path d="M -8 ${38 * spread} L 0 ${28 * spread} L 2 ${42 * spread} Z" fill="${palette.claw}" />
    <path d="M 20 ${32 * spread} L 13 ${25 * spread} L 12 ${39 * spread} Z" fill="${palette.claw}" />
  </g>`;
}

function poisonArt(amount, openBeak) {
  if (amount <= 0) return '';
  const glob = `<circle cx="128" cy="${126 + amount * 16}" r="${4 + amount * 7}" fill="${palette.green}" opacity="0.92" />`;
  const drip = `<path d="M 124 ${142 + amount * 18} C 120 ${156 + amount * 22} 132 ${158 + amount * 22} 128 ${174 + amount * 24}" stroke="${palette.greenDark}" stroke-width="${3 + amount * 2}" fill="none" stroke-linecap="round" opacity="0.9" />`;
  const spray = openBeak
    ? `<path d="M 128 118 C 112 126 108 140 112 150 M 128 118 C 144 126 148 140 144 150" stroke="${palette.greenGlow}" stroke-width="3" fill="none" opacity="0.8" />`
    : '';
  return `<g>${spray}${drip}${glob}</g>`;
}

function falconFrame(options = {}) {
  const {
    bodyY = 0,
    wingAngle = 8,
    headTilt = 0,
    legExtend = 0,
    openBeak = false,
    poison = 0,
    spin = 0,
    shield = 0,
    shieldBroken = 0,
    hurt = 0,
    death = 0,
    deathRotate = 0,
    deathAlpha = 1,
    fly = 0,
    feathers = 0,
  } = options;

  const bodyTransform = `translate(0 ${bodyY + fly})`;
  const overall =
    spin !== 0 || deathRotate !== 0
      ? `translate(128 150) rotate(${spin + deathRotate}) translate(-128 -150)`
      : '';
  const alpha = deathAlpha;
  const hurtOverlay =
    hurt > 0
      ? `<ellipse cx="128" cy="145" rx="82" ry="100" fill="${palette.red}" opacity="${0.12 + hurt * 0.18}" />`
      : '';
  const spinShield =
    shield > 0 || shieldBroken > 0
      ? `<g opacity="${shield > 0 ? 0.85 : 0.55}">
        <ellipse cx="128" cy="150" rx="100" ry="78" fill="none" stroke="${palette.green}" stroke-width="${shield > 0 ? 7 : 4}" stroke-dasharray="${shield > 0 ? '44 20' : '24 30'}" />
        <ellipse cx="128" cy="150" rx="86" ry="66" fill="none" stroke="${palette.greenGlow}" stroke-width="3" stroke-dasharray="18 26" transform="rotate(38 128 150)" />
        <ellipse cx="128" cy="150" rx="112" ry="88" fill="${palette.green}" opacity="0.06" />
      </g>`
      : '';
  const shards =
    shieldBroken > 0
      ? `<g fill="${palette.greenGlow}" opacity="${0.8 * shieldBroken}">
        <path d="M 42 88 L 58 72 L 66 98 Z" />
        <path d="M 206 96 L 194 74 L 216 70 Z" />
        <path d="M 36 190 L 54 178 L 58 204 Z" />
        <path d="M 206 186 L 220 178 L 224 200 Z" />
      </g>`
      : '';
  const scatterFeathers =
    feathers > 0
      ? `<g fill="${palette.brown}" opacity="${feathers}">
        <path d="M 34 74 C 24 64 20 48 30 38 C 40 48 44 62 34 74 Z" />
        <path d="M 220 62 C 230 52 234 36 224 26 C 214 36 210 50 220 62 Z" />
        <path d="M 28 210 C 16 204 10 190 18 178 C 30 186 36 198 28 210 Z" />
        <path d="M 228 208 C 240 202 246 188 238 176 C 226 184 220 196 228 208 Z" />
      </g>`
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 256 256">
    <defs>
      <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${palette.brownLight}" />
        <stop offset="0.55" stop-color="${palette.brown}" />
        <stop offset="1" stop-color="${palette.brownDark}" />
      </linearGradient>
      <radialGradient id="poisonGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${palette.greenGlow}" stop-opacity="0.9" />
        <stop offset="1" stop-color="${palette.green}" stop-opacity="0" />
      </radialGradient>
    </defs>
    <g opacity="${alpha}">
      ${spinShield}
      ${shards}
      ${death === 0 ? `<ellipse cx="128" cy="236" rx="${fly > 0 ? 38 : 62}" ry="11" fill="#000" opacity="${fly > 0 ? 0.18 : 0.32}" />` : ''}
      <g transform="${overall}">
        <g transform="${bodyTransform}">
          ${wing('left', wingAngle, true)}
          ${wing('right', wingAngle, true)}
          <path d="M 112 186 L 94 224 L 112 218 L 124 190 Z" fill="${palette.brownDark}" />
          <path d="M 144 186 L 162 224 L 144 218 L 132 190 Z" fill="${palette.brownDark}" />
          ${talon(112, 210 + legExtend, 1 + legExtend * 0.015, 1 + legExtend * 0.01)}
          ${talon(144, 210 + legExtend, 1 + legExtend * 0.015, 1 + legExtend * 0.01)}
          <ellipse cx="128" cy="158" rx="43" ry="58" fill="url(#body)" stroke="${palette.brownShadow}" stroke-width="3" />
          <ellipse cx="128" cy="170" rx="28" ry="40" fill="${palette.cream}" opacity="0.42" />
          <path d="M 106 142 C 116 162 110 184 128 198 C 146 184 140 162 150 142 C 136 150 120 150 106 142 Z" fill="${palette.greenDark}" opacity="0.55" />
          <path d="M 96 142 C 82 154 78 172 84 188 M 160 142 C 174 154 178 172 172 188" stroke="${palette.brownShadow}" stroke-width="4" fill="none" opacity="0.5" />
          <g transform="translate(128 108) rotate(${headTilt}) translate(-128 -108)">
            <path d="M 108 84 L 96 58 L 118 72 Z" fill="${palette.brownDark}" />
            <path d="M 148 84 L 160 58 L 138 72 Z" fill="${palette.brownDark}" />
            <path d="M 128 58 L 120 40 L 134 46 Z" fill="${palette.brown}" />
            <circle cx="128" cy="102" r="34" fill="url(#body)" stroke="${palette.brownShadow}" stroke-width="3" />
            <path d="M 108 92 C 116 84 124 84 130 92" stroke="${palette.brownShadow}" stroke-width="4" fill="none" />
            <path d="M 148 92 C 140 84 132 84 126 92" stroke="${palette.brownShadow}" stroke-width="4" fill="none" />
            <ellipse cx="116" cy="98" rx="8" ry="7" fill="${palette.eye}" />
            <ellipse cx="140" cy="98" rx="8" ry="7" fill="${palette.eye}" />
            <circle cx="117" cy="99" r="3.4" fill="${palette.eyeDark}" />
            <circle cx="139" cy="99" r="3.4" fill="${palette.eyeDark}" />
            ${
              death > 0
                ? `<path d="M 110 92 L 122 104 M 122 92 L 110 104 M 134 92 L 146 104 M 146 92 L 134 104" stroke="${palette.cream}" stroke-width="3" />`
                : ''
            }
            <path d="${openBeak ? 'M 112 112 L 128 118 L 144 112 L 136 132 L 128 126 L 120 132 Z' : 'M 112 112 L 128 122 L 144 112 L 132 120 L 128 128 L 124 120 Z'}" fill="${palette.beak}" />
            <path d="M 120 116 L 128 120 L 136 116" stroke="${palette.beakLight}" stroke-width="2" fill="none" opacity="0.8" />
            <circle cx="128" cy="${openBeak ? 124 : 120}" r="${openBeak ? 8 : 3}" fill="url(#poisonGlow)" opacity="${openBeak ? 0.85 : 0.45}" />
            <path d="M 103 80 C 112 70 144 70 153 80" stroke="${palette.brownDark}" stroke-width="5" fill="none" />
          </g>
          ${poisonArt(poison, openBeak)}
          <path d="M 102 218 L 100 230 M 134 220 L 132 232 M 154 218 L 156 230" stroke="${palette.green}" stroke-width="3" opacity="${poison > 0 ? 0.8 : 0.25}" stroke-linecap="round" />
        </g>
      </g>
      ${hurtOverlay}
      ${scatterFeathers}
    </g>
  </svg>`;
}

function effectFrame(kind, index, total) {
  const t = total <= 1 ? 0 : index / (total - 1);
  if (kind === 'poison-projectile') {
    const x = 34 + t * 172;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <g>
        <circle cx="${x - 18}" cy="${128 + Math.sin(t * Math.PI) * -18}" r="${8 - t * 4}" fill="${palette.greenDark}" opacity="${0.5 - t * 0.25}" />
        <circle cx="${x - 10}" cy="${126 + Math.sin(t * Math.PI) * -14}" r="${10 - t * 3}" fill="${palette.green}" opacity="${0.7 - t * 0.2}" />
        <circle cx="${x}" cy="${126 + Math.sin(t * Math.PI) * -12}" r="${10 + t * 4}" fill="${palette.greenGlow}" />
        <circle cx="${x + 3}" cy="${123 + Math.sin(t * Math.PI) * -12}" r="${3}" fill="#ffffff" opacity="0.8" />
      </g>
    </svg>`;
  }
  if (kind === 'poison-muzzle') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <g transform="translate(128 170)">
        <circle r="${12 + t * 22}" fill="${palette.green}" opacity="${0.85 - t * 0.55}" />
        <circle r="${7 + t * 10}" fill="${palette.greenGlow}" opacity="${0.8 - t * 0.4}" />
        ${[0, 1, 2, 3, 4]
          .map((i) => {
            const angle = (Math.PI * 2 * i) / 5 + t;
            const dist = 12 + t * 40;
            return `<circle cx="${Math.cos(angle) * dist}" cy="${Math.sin(angle) * dist}" r="${4 - t * 2}" fill="${palette.greenGlow}" opacity="${0.8 - t * 0.5}" />`;
          })
          .join('')}
      </g>
    </svg>`;
  }
  if (kind === 'poison-impact') {
    const radius = 12 + t * 80;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <g transform="translate(128 128)">
        <circle r="${radius}" fill="none" stroke="${palette.greenGlow}" stroke-width="${9 - t * 6}" opacity="${1 - t}" />
        <circle r="${radius * 0.55}" fill="${palette.green}" opacity="${0.5 - t * 0.42}" />
        ${Array.from({ length: 8 }, (_, i) => {
          const angle = (Math.PI * 2 * i) / 8;
          const dist = 18 + t * 74;
          return `<circle cx="${Math.cos(angle) * dist}" cy="${Math.sin(angle) * dist}" r="${7 - t * 4}" fill="${i % 2 ? palette.green : palette.greenGlow}" opacity="${0.9 - t * 0.8}" />`;
        }).join('')}
      </g>
    </svg>`;
  }
  if (kind === 'spin-aura') {
    const angle = t * 360;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <g transform="rotate(${angle} 128 128)">
        <ellipse cx="128" cy="128" rx="104" ry="78" fill="none" stroke="${palette.green}" stroke-width="7" stroke-dasharray="42 22" opacity="0.8" />
        <ellipse cx="128" cy="128" rx="84" ry="62" fill="none" stroke="${palette.greenGlow}" stroke-width="4" stroke-dasharray="20 28" opacity="0.75" />
        <ellipse cx="128" cy="128" rx="120" ry="92" fill="${palette.green}" opacity="0.07" />
      </g>
    </svg>`;
  }
  if (kind === 'spin-break') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <g transform="translate(128 128)">
        <circle r="${24 + t * 92}" fill="none" stroke="${palette.greenGlow}" stroke-width="${12 - t * 10}" opacity="${0.95 - t * 0.8}" />
        ${Array.from({ length: 10 }, (_, i) => {
          const angle = (Math.PI * 2 * i) / 10 + 0.3;
          const dist = 20 + t * 96;
          const x = Math.cos(angle) * dist;
          const y = Math.sin(angle) * dist;
          return `<path d="M ${x} ${y} L ${x + 12} ${y - 16} L ${x + 18} ${y + 6} Z" fill="${i % 2 ? palette.greenGlow : palette.green}" opacity="${0.95 - t * 0.8}" />`;
        }).join('')}
      </g>
    </svg>`;
  }
  if (kind === 'earthquake') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <g transform="translate(128 170)">
        <ellipse rx="${20 + t * 120}" ry="${8 + t * 46}" fill="none" stroke="${palette.brownLight}" stroke-width="${12 - t * 9}" opacity="${0.9 - t * 0.8}" />
        <ellipse rx="${10 + t * 82}" ry="${4 + t * 30}" fill="none" stroke="${palette.greenGlow}" stroke-width="${8 - t * 6}" opacity="${0.8 - t * 0.7}" />
        ${Array.from({ length: 12 }, (_, i) => {
          const angle = (Math.PI * 2 * i) / 12;
          const dist = 16 + t * 110;
          const x = Math.cos(angle) * dist;
          const y = Math.sin(angle) * dist * 0.42;
          return `<path d="M ${x} ${y} l ${6} ${-14} l ${8} ${16} Z" fill="${i % 3 ? palette.brown : palette.greenDark}" opacity="${0.9 - t * 0.75}" />`;
        }).join('')}
      </g>
    </svg>`;
  }
  if (kind === 'defeat') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <g transform="translate(128 136)">
        <circle r="${18 + t * 80}" fill="none" stroke="${palette.greenGlow}" stroke-width="${14 - t * 12}" opacity="${1 - t}" />
        <circle r="${10 + t * 54}" fill="${palette.green}" opacity="${0.45 - t * 0.4}" />
        ${Array.from({ length: 14 }, (_, i) => {
          const angle = (Math.PI * 2 * i) / 14 + i * 0.07;
          const dist = 10 + t * 110;
          const x = Math.cos(angle) * dist;
          const y = Math.sin(angle) * dist;
          return i % 2
            ? `<path d="M ${x} ${y} C ${x + 12} ${y - 14} ${x + 26} ${y - 6} ${x + 28} ${y + 8} C ${x + 14} ${y + 10} ${x + 6} ${y + 12} ${x} ${y} Z" fill="${palette.brown}" opacity="${0.9 - t * 0.8}" />`
            : `<circle cx="${x}" cy="${y}" r="${8 - t * 5}" fill="${i % 4 ? palette.green : palette.greenGlow}" opacity="${0.95 - t * 0.85}" />`;
        }).join('')}
      </g>
    </svg>`;
  }
  throw new Error(`unknown effect ${kind}`);
}

function writeFrame(file, svg) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const svgPath = `${file}.svg`;
  fs.writeFileSync(svgPath, svg);
  mag(['-background', 'none', svgPath, '-alpha', 'on', '-depth', '8', '-strip', file]);
  fs.rmSync(svgPath);
}

function buildStrip(frames, out) {
  mag([...frames, '+append', '-depth', '8', '-strip', '-define', 'png:color-type=6', out]);
}

const unitAnimations = [
  {
    state: 'idle',
    frames: 4,
    fps: 5,
    repeat: -1,
    options: (i) => ({
      bodyY: Math.sin((i / 4) * Math.PI * 2) * 3,
      wingAngle: 7 + Math.sin((i / 4) * Math.PI * 2) * 5,
      headTilt: Math.sin((i / 4) * Math.PI * 2) * 2,
    }),
  },
  {
    state: 'fly',
    frames: 4,
    fps: 10,
    repeat: -1,
    options: (i) => ({
      bodyY: -10 + Math.sin((i / 4) * Math.PI * 2) * 7,
      wingAngle: -34 + Math.sin((i / 4) * Math.PI * 2) * 58,
      fly: 1,
      legExtend: -10,
    }),
  },
  {
    state: 'claw',
    frames: 6,
    fps: 12,
    repeat: 0,
    options: (i) => {
      const t = i / 5;
      return {
        bodyY: Math.sin(t * Math.PI) * -8,
        wingAngle: 18 - t * 52,
        legExtend: Math.sin(t * Math.PI) * 26,
        headTilt: -4 + t * 8,
        openBeak: t > 0.35 && t < 0.75,
      };
    },
  },
  {
    state: 'poison',
    frames: 6,
    fps: 10,
    repeat: 0,
    options: (i) => {
      const t = i / 5;
      return {
        bodyY: Math.sin(t * Math.PI) * -4,
        wingAngle: 14 - t * 10,
        headTilt: 4,
        openBeak: t > 0.2,
        poison: t < 0.25 ? 0 : Math.min(1, (t - 0.2) * 1.8),
      };
    },
  },
  {
    state: 'spin',
    frames: 6,
    fps: 12,
    repeat: -1,
    options: (i) => ({ spin: (i / 6) * 360, wingAngle: -10, shield: 1, fly: -4 }),
  },
  {
    state: 'spin-break',
    frames: 6,
    fps: 6,
    repeat: -1,
    options: (i) => ({
      spin: (i / 6) * 360,
      wingAngle: 24,
      shield: 0,
      shieldBroken: i < 3 ? 1 - i / 3 : 0,
      fly: -2,
    }),
  },
  {
    state: 'hurt',
    frames: 4,
    fps: 12,
    repeat: 0,
    options: (i) => ({
      bodyY: Math.sin((i / 4) * Math.PI) * 8,
      wingAngle: 24 + i * 6,
      headTilt: -8,
      hurt: 1 - i / 4,
    }),
  },
  {
    state: 'death',
    frames: 8,
    fps: 8,
    repeat: 0,
    options: (i) => {
      const t = i / 7;
      return {
        death: 1,
        deathRotate: t * 92,
        deathAlpha: 1 - t * 0.72,
        bodyY: t * 48,
        wingAngle: 20 + t * 40,
        headTilt: t * 26,
        feathers: t > 0.25 ? Math.min(1, (t - 0.25) * 1.6) : 0,
      };
    },
  },
];

const effectAnimations = [
  { key: 'poison-projectile', frames: 4, fps: 12, repeat: 0 },
  { key: 'poison-muzzle', frames: 4, fps: 12, repeat: 0 },
  { key: 'poison-impact', frames: 4, fps: 14, repeat: 0 },
  { key: 'spin-aura', frames: 6, fps: 12, repeat: -1 },
  { key: 'spin-break', frames: 6, fps: 12, repeat: 0 },
  { key: 'earthquake', frames: 6, fps: 12, repeat: 0 },
  { key: 'defeat', frames: 8, fps: 8, repeat: 0 },
];

const report = { unit: [], effects: [] };
for (const animation of unitAnimations) {
  const frames = [];
  for (let i = 0; i < animation.frames; i += 1) {
    const file = path.join(unitDir, 'frames', animation.state, `${String(i).padStart(2, '0')}.png`);
    writeFrame(file, falconFrame(animation.options(i)));
    frames.push(file);
  }
  const strip = path.join(unitDir, `${animation.state}.png`);
  buildStrip(frames, strip);
  report.unit.push({
    state: animation.state,
    frames: animation.frames,
    fps: animation.fps,
    repeat: animation.repeat,
    strip: path.relative(root, strip),
  });
}

for (const animation of effectAnimations) {
  const frames = [];
  for (let i = 0; i < animation.frames; i += 1) {
    const file = path.join(effectDir, 'frames', animation.key, `${String(i).padStart(2, '0')}.png`);
    writeFrame(file, effectFrame(animation.key, i, animation.frames));
    frames.push(file);
  }
  const strip = path.join(effectDir, `${animation.key}.png`);
  buildStrip(frames, strip);
  report.effects.push({
    key: animation.key,
    frames: animation.frames,
    fps: animation.fps,
    repeat: animation.repeat,
    strip: path.relative(root, strip),
  });
}

fs.copyFileSync(
  path.join(unitDir, 'frames/idle/00.png'),
  path.join(unitDir, 'green-venom-falcon.png'),
);
fs.copyFileSync(path.join(unitDir, 'frames/idle/00.png'), iconPath);

const originY = 0.88;
const manifest = {
  version: 1,
  characterTypeId: 'green-venom-falcon',
  role: 'wave-20-boss',
  artStatus: 'generated-concept-placeholder-pending-abel-approval',
  format: 'horizontal-spritesheet',
  frameSize: [SIZE, SIZE],
  frameOrder: 'left-to-right',
  unitOrigin: [0.5, originY],
  facing: 'left',
  recommendedDisplayWidth: 190,
  animations: [
    ...unitAnimations.map((animation) => ({
      key: `gvf-${animation.state}`,
      url: `/assets/units/green-venom-falcon/${animation.state}.png`,
      frameWidth: SIZE,
      frameHeight: SIZE,
      frames: animation.frames,
      fps: animation.fps,
      repeat: animation.repeat,
      origin: [0.5, originY],
    })),
    ...effectAnimations.map((animation) => ({
      key: `gvf-fx-${animation.key}`,
      url: `/assets/effects/green-venom-falcon/${animation.key}.png`,
      frameWidth: SIZE,
      frameHeight: SIZE,
      frames: animation.frames,
      fps: animation.fps,
      repeat: animation.repeat,
      origin: [0.5, 0.5],
    })),
  ],
};
fs.writeFileSync(path.join(unitDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(
  path.join(root, 'docs/green-venom-falcon/generated-assets.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), status: manifest.artStatus, ...report }, null, 2)}\n`,
);
console.log(
  `Generated ${report.unit.length} unit animations and ${report.effects.length} effect animations.`,
);
