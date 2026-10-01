// Shared pieces for drawing the camp's fixtures and buildables in the design kit's style: pixel
// helpers, the plank crate, and the seasonal dressing every camp sprite gets (snow in winter,
// leaves in fall, tufts in spring). No DOM, so the same code runs in the browser and in the
// tools/ script that bakes the menu cards and placement ghosts.
import { OL, W, M } from '../engine/ui-kit/pixel-assets-v2.js';

export const box = (s, x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) s.set(x, y, typeof c === 'function' ? c(x, y) : c); };
export const hh = (x, y, s = 0) => { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
export const SEASONS = ['summer', 'spring', 'fall', 'winter'];
export const seasonKey = (name, season) => name + (season === 'summer' ? '' : '_' + season);
const SNOW = ['#a3adb6', '#c3cad0', '#dde2e5', '#eef1f2'], LEAVES = ['#a8592c', '#c07a34', '#8a3e24'];

// A plank crate: lit top, planks with dark seams, a cross brace and steel corner caps.
export function crate(s, x0, y0, x1, y1) {
  box(s, x0, y0, x1, y0, W[4]);
  box(s, x0, y0 + 1, x1, y1, (x, y) => x === x0 || x === x1 ? W[1] : (y - y0) % 4 === 0 ? W[2] : W[3]);
  s.line(x0 + 1, y0 + 2, x1 - 1, y1 - 1, (x, y) => s.set(x, y, W[2]));
  for (const [x, y] of [[x0, y0 + 1], [x1, y0 + 1], [x0, y1], [x1, y1]]) s.set(x, y, M[2]);
}

export function dress(s, season) {
  const top = x => { for (let y = 0; y < s.h; y++) if (s.get(x, y)) return y; return -1; };
  if (season === 'winter') for (let x = 0; x < s.w; x++) {
    const y = top(x); if (y < 0) continue;
    s.set(x, y, hh(x, y, 302) < .3 ? SNOW[2] : SNOW[3]);
    if (s.get(x, y + 1) && hh(x, y, 301) < .6) s.set(x, y + 1, SNOW[1]);
  }
  if (season === 'fall') for (let x = 0; x < s.w; x++) { const y = top(x); if (y >= 0 && hh(x, y, 321) < .18) s.set(x, y, LEAVES[x % 3]); }
  s.outline(OL);
  if (season === 'spring' || season === 'fall') for (let i = 0; i < 8; i++) {
    const x = Math.floor(hh(i, 7, 331) * s.w), y = s.h - 1 - Math.floor(hh(i, 9, 332) * 3);
    if (s.get(x, y)) continue;
    if (season === 'fall') s.set(x, y, LEAVES[i % 3]);
    else { s.set(x, y, '#48613a'); if (!s.get(x, y - 1)) s.set(x, y - 1, i % 4 === 0 ? '#d9a3b2' : '#739052'); }
  }
  return s;
}
