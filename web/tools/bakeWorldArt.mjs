// Bakes the art World Generator v3 needs that the Unity atlas (public/unity/AfterlifeAtlas.*) lacks:
// water and shores, bridges, forest floor, rocky ground, swamps, fields, streets, sidewalks, rail and
// parking tiles, the grass blend overlays, Series 2 plants and the newer world buildings and structures,
// in all four seasons. The sprites come from the design kit's own generators (tools/worldkit), drawn in
// daylight as the kit's draw() does, and are packed into a web-only atlas the world view loads beside
// the Unity one:
//   public/world/WorldAtlas.png    the sprites
//   public/world/WorldAtlas.json   { width, height, entries: [{ key, x, y, w, h, ax, ay }] }, keyed like
//                                  the Unity atlas: world/wld_*, decor/deco_*, tiles/<everything else>,
//                                  with _spring, _fall or _winter after a seasonal variant
// Run from web/:  node tools/bakeWorldArt.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './png.mjs';
import { buildAll, SEASON_NAMES } from './worldkit/pixel-assets-v2.js';
import { buildWorld2 as buildStructures } from './worldkit/pixel-world2.js';
import { buildWorld2 as buildSeries2World } from './worldkit/pixel-series2-world.js';
import { buildNature } from './worldkit/pixel-series2-nature.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const unity = JSON.parse(fs.readFileSync(path.join(root, 'public/unity/AfterlifeAtlas.json'), 'utf8'));
const have = new Set(unity.entries.map(e => e.key));

const terrain = buildAll();
const sprites = Object.assign({}, buildSeries2World(terrain), ...SEASON_NAMES.map(buildStructures), ...SEASON_NAMES.map(buildNature));
// The water strip is the three animation frames side by side; they are baked one by one.
for (const k of Object.keys(sprites)) if (k.startsWith('water_anim')) delete sprites[k];

const prefix = k => k.startsWith('wld_') ? 'world/' : k.startsWith('deco_') ? 'decor/' : 'tiles/';
const baseName = k => k.replace(/_(spring|fall|winter)$/, '');
const bake = Object.keys(sprites).filter(k => !have.has(prefix(k) + baseName(k))).sort();

// Daylight, as the kit's draw(): shadow-only pixels are its shadow colour at the shadow's strength.
const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
function paint(out, W, s, ox, oy) {
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const i = y * s.w + x, o = ((oy + y) * W + ox + x) * 4, c = s.p[i];
    if (c) out.set([...hex(c), 255], o);
    else if (s.sh[i] > 0) out.set([10, 8, 12, Math.round(Math.min(1, s.sh[i]) * 255)], o);
  }
}

// Shelf packing, tallest first, a pixel of air round every sprite so filtering never bleeds.
const W = 1024, order = [...bake].sort((a, b) => sprites[b].h - sprites[a].h || sprites[b].w - sprites[a].w || (a < b ? -1 : 1));
const place = {};
let x = 1, y = 1, row = 0;
for (const k of order) {
  const s = sprites[k];
  if (x + s.w + 1 > W) { x = 1; y += row + 2; row = 0; }
  place[k] = [x, y]; x += s.w + 2; row = Math.max(row, s.h);
}
const H = 2 ** Math.ceil(Math.log2(y + row + 1)), data = Buffer.alloc(W * H * 4);
for (const k of bake) paint(data, W, sprites[k], ...place[k]);

const out = path.join(root, 'public/world');
fs.mkdirSync(out, { recursive: true });
encodePng({ w: W, h: H, data }, path.join(out, 'WorldAtlas.png'));
const entries = bake.map(k => ({ key: prefix(k) + k, x: place[k][0], y: place[k][1], w: sprites[k].w, h: sprites[k].h, ax: 0.5, ay: 1 }));
fs.writeFileSync(path.join(out, 'WorldAtlas.json'), JSON.stringify({ width: W, height: H, entries }));
console.log(`WorldAtlas: ${entries.length} sprites (${new Set(bake.map(baseName)).size} kinds), ${W}×${H}`);
