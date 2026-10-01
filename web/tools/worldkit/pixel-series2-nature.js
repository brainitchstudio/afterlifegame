// The nature sprites of the design kit's Series 2 story kit (pixel-series2.js), copied verbatim from its
// "nature" section. The rest of that file (items, NPCs, the quest HUD) needs the browser's canvas and
// fonts, and the world generator only places these.
import { Spr, G, W, L, withSeason, dress, mkRng } from './pixel-assets-v2.js';
import { H } from './pixel-buildings.js';

const { hh, rect } = H;
const pick = (pal, v) => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(v * pal.length)))];
const RK = ['#3b3f3a', '#545a53', '#6e756c', '#8b9287', '#a7ad9f'];
let SEA2 = 'summer';
function blob(s, cx, cy, rx, ry, pal, seed, gap = 0) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry, d2 = dx * dx + dy * dy; if (d2 > 1) continue;
    if (gap && d2 > 0.7 && hh(x, y, seed + 3) < gap) continue;
    const l = -dx * 0.5 - dy * 0.6 + Math.sqrt(1 - d2) * 0.6; s.set(x, y, pick(pal, (l + 0.45) / 1.45 + (hh(x, y, seed) - .5) * .18));
  }
}

function birch(seed) {
  const s = new Spr(24, 44); s.ellipseShadow(12, 41, 7, 2, 0.4);
  for (let y = 14; y <= 41; y++) for (let x = 11; x <= 13; x++) s.set(x, y, hh(x, y >> 1, seed) < 0.18 ? '#2a2b26' : x === 11 ? '#e8e6dc' : x === 12 ? '#c9c7ba' : '#9c9a8e');
  s.set(10, 41, '#9c9a8e'); s.set(14, 41, '#9c9a8e');
  s.line(13, 22, 17, 17, (x, y) => s.set(x, y, '#9c9a8e')); s.line(11, 25, 7, 20, (x, y) => s.set(x, y, '#c9c7ba'));
  for (const [cx, cy, rx, ry] of [[8, 17, 4.5, 4], [16, 16, 4.5, 4.5], [12, 11, 6, 7], [12, 4, 4, 4]]) blob(s, cx, cy, rx, ry, L, seed + cx, 0.3);
  return dress(s);
}
function appleTree(seed) {
  const s = new Spr(32, 40), r = mkRng(seed); s.ellipseShadow(16, 37, 11, 2.6, 0.4);
  for (let y = 22; y <= 37; y++) for (let x = 14; x <= 17; x++) s.set(x, y, x === 14 ? W[3] : x === 17 ? W[1] : W[2]);
  s.set(13, 37, W[1]); s.set(18, 37, W[1]);
  for (const [cx, cy, rx, ry] of [[10, 18, 7, 6], [22, 18, 7, 6], [16, 11, 9, 8], [16, 20, 8, 5]]) blob(s, cx, cy, rx, ry, L, seed + cx, 0.12);
  for (let i = 0; i < 12; i++) {
    const x = 5 + r() * 22 | 0, y = 5 + r() * 18 | 0; if (!s.get(x, y) || !s.get(x + 1, y + 1)) continue;
    if (SEA2 === 'spring') { s.set(x, y, '#ecd6dc'); s.set(x + 1, y, '#d9a3b2'); }
    else if (SEA2 !== 'winter') { s.set(x, y, '#cf5a44'); s.set(x + 1, y, '#9a3a2a'); s.set(x, y + 1, '#9a3a2a'); s.set(x + 1, y + 1, '#5a1f18'); }
  }
  return dress(s);
}
function cattails(seed) {
  const s = new Spr(16, 18), r = mkRng(seed); s.ellipseShadow(8, 16, 7, 1.8, 0.3);
  for (let i = 0; i < 6; i++) {
    const x = 2 + i * 2 + (r() * 2 | 0), top = 3 + (r() * 5 | 0);
    s.line(x, 16, x + (i % 2 ? 3 : -3), top + 5, (px, py) => s.set(px, py, G[2]));
    for (let y = top; y <= 16; y++) s.set(x, y, y > 13 ? G[1] : G[3]);
    if (i % 2 === 0) { rect(s, x, top, x + 1, top + 3, px => SEA2 === 'winter' ? (px === x ? '#b0a078' : '#8a7a58') : px === x ? '#7a4a2c' : '#5a3322'); s.set(x, top - 1, G[4]); }
  }
  return dress(s);
}
function fern(seed) {
  const s = new Spr(16, 12); s.ellipseShadow(8, 9.5, 7, 2, 0.3);
  const fr = (x1, y1) => s.line(8, 10, x1, y1, (x, y) => { s.set(x, y, G[3]); if ((x + y) % 2 === 0) { s.set(x, y - 1, G[4]); s.set(x, y + 1, G[1]); } });
  fr(1, 5); fr(4, 2); fr(8, 1); fr(12, 2); fr(15, 5); fr(3, 8); fr(13, 8);
  return dress(s);
}
function outcrop(seed) {
  const s = new Spr(32, 22); s.ellipseShadow(16, 18.5, 15, 3, 0.4);
  blob(s, 11, 11, 9, 8, RK, seed); blob(s, 22, 13, 8, 6.5, RK, seed + 1); blob(s, 27, 17, 4, 3, RK, seed + 2); blob(s, 5, 17, 4, 3, RK, seed + 3);
  s.line(9, 6, 12, 12, (x, y) => s.set(x, y, RK[0])); s.line(20, 10, 22, 15, (x, y) => s.set(x, y, RK[0]));
  for (let y = 3; y < 12; y++) for (let x = 3; x < 30; x++) if (s.get(x, y) && hh(x, y, seed + 9) < 0.18) s.set(x, y, hh(x, y, seed) < 0.5 ? G[2] : G[3]);
  return dress(s);
}

// Keyed like the rest of the kit: summer has no suffix, other seasons get _spring, _fall or _winter.
export function buildNature(sea = 'summer') {
  SEA2 = sea; const sf = sea === 'summer' ? '' : '_' + sea;
  const B = withSeason(sea, () => ({ nat_s2_birch: birch(51), nat_s2_apple: appleTree(52), nat_s2_cattails: cattails(53), nat_s2_fern: fern(54), nat_s2_outcrop: outcrop(55) }));
  SEA2 = 'summer';
  return Object.fromEntries(Object.entries(B).map(([k, s]) => [k + sf, s]));
}
