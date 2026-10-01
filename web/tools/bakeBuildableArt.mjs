// Bakes the menu card and the two placement ghosts for every camp buildable from the same sprites the
// world draws (src/host/campBuildArt.js), so the three can't drift apart:
//   public/unity/Buildings/<key>.png     the card art the build menu shows (the sprite, shadow and all)
//   public/unity/UI/ghost_<key>_ok.png   the placement ghost: the sprite's solid pixels on a checkerboard,
//   public/unity/UI/ghost_<key>_bad.png  tinted green when the spot is free and red when it is blocked
// The ghost recipe and tint curves were fitted to the existing kit ghosts (ghost_clinic_ok, ...).
// Run from web/:  node tools/bakeBuildableArt.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './png.mjs';
import { buildableSprites } from '../src/host/campBuildArt.js';
import { dress } from '../src/host/campArtKit.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const unity = path.join(root, 'public/unity');

// The tent and campfire already have atlas art; the rest are drawn.
const ATLAS_ART = { tent: 'decor/deco_tent', campfire: 'decor/deco_campfire' };

// Per channel: a + b*L + c*L^2 + d*(R-L) + e*(B-L), on 0-1 luminance and chroma, giving 0-255.
const TINT = {
  ok: [[68.26, 271.4, -166.92, 138.04, 23.98], [84.99, 299.64, -197.1, -31.38, 6.37], [43.43, 229.48, -122.29, 18.08, 132.81]],
  bad: [[86.94, 290.33, -187.72, 141.2, 25.64], [30.56, 241.16, -135.28, -41.32, -4.3], [25.03, 203.77, -94.66, 13.32, 128.19]],
};
const clamp = v => Math.max(0, Math.min(255, Math.round(v)));

function ghost(img, kind) {
  const out = Buffer.alloc(img.data.length);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const i = (y * img.w + x) * 4, [r, g, b, a] = img.data.subarray(i, i + 4);
    if (a < 255 || (x + y) % 2) continue;
    const L = (0.3 * r + 0.59 * g + 0.11 * b) / 255, f = [1, L, L * L, r / 255 - L, b / 255 - L];
    out.set([...TINT[kind].map(c => clamp(c.reduce((sum, k, n) => sum + k * f[n], 0))), 255], i);
  }
  return { ...img, data: out };
}

const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
function toImage(s) {
  const data = Buffer.alloc(s.w * s.h * 4);
  for (let i = 0; i < s.w * s.h; i++) {
    if (s.p[i]) data.set([...hex(s.p[i]), 255], i * 4);
    else if (s.sh[i] > 0) data.set([10, 8, 12, Math.round(s.sh[i] * 255)], i * 4);
  }
  return { w: s.w, h: s.h, data };
}

function atlasCrop(atlas, e) {
  const data = Buffer.alloc(e.w * e.h * 4);
  for (let y = 0; y < e.h; y++) atlas.data.copy(data, y * e.w * 4, ((e.y + y) * atlas.w + e.x) * 4, ((e.y + y) * atlas.w + e.x + e.w) * 4);
  return { w: e.w, h: e.h, data };
}

const atlas = decodePng(path.join(unity, 'AfterlifeAtlas.png'));
const entries = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(unity, 'AfterlifeAtlas.json'), 'utf8')).entries.map(e => [e.key, e]));
const cards = {
  ...Object.fromEntries(Object.entries(ATLAS_ART).map(([key, art]) => [key, atlasCrop(atlas, entries[art])])),
  ...Object.fromEntries(Object.entries(buildableSprites).map(([key, make]) => [key, toImage(dress(make(), 'summer'))])),
};

for (const [key, img] of Object.entries(cards)) {
  encodePng(img, path.join(unity, 'Buildings', key + '.png'));
  for (const kind of ['ok', 'bad']) { encodePng(ghost(img, kind), path.join(unity, 'UI', `ghost_${key}_${kind}.png`)); }
}

// src/hud/uiSprites.json belongs to Tools/export-web-assets.mjs (the Unity resources); the cards and ghosts
// baked here are served from public/unity without being listed there.
console.log('baked', Object.keys(cards).join(', '));
