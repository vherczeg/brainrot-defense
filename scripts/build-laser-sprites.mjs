import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import console from 'node:console';
import { URL, fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const states = ['idle', 'walk', 'attack', 'hurt', 'death'];
const mag = (args, encoding = 'utf8') =>
  execFileSync('magick', args, { encoding, maxBuffer: 32 * 1024 * 1024 });
const report = [];
for (const tier of ['v1', 'v2', 'v3']) {
  const source = path.join(root, `docs/laser-crocodile/animation-v2-sources/${tier}.png`);
  const [w, h] = mag(['identify', '-format', '%w %h', source]).split(' ').map(Number);
  const alpha = mag([source, '-alpha', 'extract', '-depth', '8', 'gray:-'], null);
  const bounds = [];
  for (let row = 0; row < 5; row++) {
    const top = Math.round((h * row) / 5),
      bottom = Math.round((h * (row + 1)) / 5);
    const cuts = [0];
    for (let c = 1; c < 4; c++) {
      const mid = Math.round((w * c) / 4),
        options = [];
      for (let x = mid - 22; x <= mid + 22; x++) {
        let sum = 0;
        for (let y = top; y < bottom; y++) sum += alpha[y * w + x];
        options.push({ x, sum });
      }
      options.sort((a, b) => a.sum - b.sum || Math.abs(a.x - mid) - Math.abs(b.x - mid));
      cuts.push(options[0].x);
    }
    cuts.push(w);
    for (let col = 0; col < 4; col++) {
      let left = w,
        right = 0,
        upper = h,
        lower = 0,
        pixels = 0;
      for (let y = top; y < bottom; y++)
        for (let x = cuts[col]; x < cuts[col + 1]; x++)
          if (alpha[y * w + x] > 8) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            upper = Math.min(upper, y);
            lower = Math.max(lower, y);
            pixels++;
          }
      bounds.push({
        row,
        col,
        top,
        bottom,
        cut: cuts[col],
        end: cuts[col + 1],
        left,
        right,
        upper,
        lower,
        pixels,
      });
    }
  }
  const scale = 216 / Math.max(...bounds.map((b) => b.right - b.left + 1));
  for (const b of bounds) {
    const dir = path.join(
      root,
      `public/assets/units/laser-crocodile/frames/${tier}-${states[b.row]}`,
    );
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `${String(b.col).padStart(2, '0')}.png`);
    const cw = b.end - b.cut,
      ch = b.bottom - b.top;
    const sw = Math.round(cw * scale),
      sh = Math.round(ch * scale);
    let dx = Math.round(128 - sw / 2);
    const left = dx + (b.left - b.cut) * scale,
      right = dx + (b.right - b.cut) * scale;
    if (left < 12) dx += Math.ceil(12 - left);
    if (right > 244) dx -= Math.ceil(right - 244);
    const dy = Math.round(224 - (b.lower - b.top + 1) * scale);
    mag([
      '-size',
      '256x256',
      'canvas:none',
      '(',
      source,
      '-crop',
      `${cw}x${ch}+${b.cut}+${b.top}`,
      '+repage',
      '-resize',
      `${sw}x${sh}!`,
      ')',
      '-geometry',
      `+${dx}+${dy}`,
      '-compose',
      'Over',
      '-composite',
      '-depth',
      '8',
      '-strip',
      '-define',
      'png:color-type=6',
      out,
    ]);
    report.push({
      tier,
      state: states[b.row],
      frame: b.col,
      sourceBounds: b,
      scale,
      offset: [dx, dy],
      file: path.relative(root, out),
    });
  }
  for (const state of states) {
    const dir = path.join(root, `public/assets/units/laser-crocodile/frames/${tier}-${state}`);
    mag([
      ...Array.from({ length: 4 }, (_, i) => path.join(dir, `${String(i).padStart(2, '0')}.png`)),
      '+append',
      '-depth',
      '8',
      '-strip',
      '-define',
      'png:color-type=6',
      path.join(root, `public/assets/units/laser-crocodile/${tier}-${state}.png`),
    ]);
  }
}
fs.writeFileSync(
  path.join(root, 'docs/laser-crocodile/animation-v2-preparation.json'),
  JSON.stringify(report, null, 2),
);
console.log('Prepared 60 RGBA frames and 15 strips; one uniform scale per tier, foot baseline224.');
