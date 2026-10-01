// Environment decor sprites — same 16px 3/4 style and palettes as pixel-assets-v2.
import { Spr, W, M, DW, X, D, L, S, mkRng, dress, withSeason } from './pixel-assets-v2.js';

const hh = (x, y, s = 0) => { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
const pick = (pal, v) => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(v * pal.length)))];
const RU = ['#3a2218', '#5a3322', '#7a4a2c', '#94613a', '#b0794a'];
const PT = ['#2f3b3a', '#44524f', '#5d6b67', '#76847e', '#91a098'];
const GL = ['#1c2224', '#2c363a', '#46545a', '#6a7a80'];
const TY = ['#1b1c18', '#2a2b26', '#3b3c35', '#4e4f47'];
const RK = ['#3b3f3a', '#545a53', '#6e756c', '#8b9287', '#a7ad9f'];
const OD = ['#3d1f18', '#5e2c1e', '#7e3c26', '#9c5232', '#b86c44'];
const BR = ['#5e2e22', '#7a4032', '#9a5a44'];
const box = (s, x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) s.set(x, y, typeof c === 'function' ? c(x, y) : c); };
function blob(s, cx, cy, rx, ry, pal, seed) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry, d2 = dx * dx + dy * dy; if (d2 > 1) continue;
    const l = -dx * 0.5 - dy * 0.6 + Math.sqrt(1 - d2) * 0.6; s.set(x, y, pick(pal, (l + 0.45) / 1.45 + (hh(x, y, seed) - .5) * .18));
  }
}

function car(seed, pal = PT, lights = false, rust = 1) {
  const PT = pal, s = new Spr(32, 24), n = (x, y) => hh(x, y, seed);
  const paint = (x, y, i) => { const v = n(x, y); return v < 0.16 * rust ? RU[Math.max(1, i - 1)] : v < 0.24 * rust ? RU[Math.min(4, i)] : PT[i]; };
  if (lights) { box(s, 11, 1, 14, 2, (x, y) => y === 1 ? OD[4] : OD[2]); box(s, 17, 1, 20, 2, (x, y) => y === 1 ? '#5a7aa8' : '#3a5a8a'); box(s, 15, 1, 16, 2, M[1]); }
  s.ellipseShadow(16, 20.5, 15.5, 3, 0.4);
  box(s, 2, 8, 29, 13, (x, y) => paint(x, y, y === 8 ? 4 : x < 4 || x > 27 ? 2 : 3));
  box(s, 2, 14, 29, 18, (x, y) => paint(x, y, y === 14 ? 2 : 1));
  for (let x = 3; x <= 28; x++) if (n(x, 99) < 0.22) box(s, x, 15, x, 17, RU[2]);
  box(s, 15, 14, 15, 17, PT[0]); s.set(12, 15, M[3]); s.set(19, 15, M[3]);
  box(s, 9, 3, 22, 6, (x, y) => paint(x, y, y === 3 ? 4 : 3));
  box(s, 9, 7, 22, 9, (x, y) => y === 7 ? GL[3] : GL[2]);
  box(s, 15, 7, 16, 9, PT[1]);
  box(s, 18, 7, 21, 9, GL[0]); s.set(18, 7, GL[3]); s.set(21, 8, GL[3]); s.set(19, 9, GL[2]);
  for (const y of [11, 12, 13, 14, 15, 16]) { s.set(2, y, M[1]); s.set(29, y, M[1]); }
  s.set(2, 11, GL[3]); s.set(29, 11, OD[1]);
  for (const wx of [4, 22]) { box(s, wx, 17, wx + 4, 20, TY[0]); box(s, wx + 1, 18, wx + 3, 19, TY[2]); s.set(wx + 2, 18, M[3]); }
  for (const [x, y] of [[2, 8], [29, 8], [9, 3], [22, 3], [2, 18], [29, 18]]) s.set(x, y, null);
  return s;
}
function drum(seed) {
  const s = new Spr(14, 20), n = (x, y) => hh(x, y, seed);
  s.ellipseShadow(7, 17.5, 6.5, 2, 0.4);
  for (let y = 5; y <= 17; y++) for (let x = 2; x <= 11; x++) {
    const dx = (x + .5 - 7) / 5; let i = dx < -0.5 ? 3 : dx < 0.2 ? 2 : dx < 0.7 ? 1 : 0;
    if (y === 8 || y === 13) i = Math.max(0, i - 1); if (y === 9 || y === 14) i = Math.min(4, i + 1);
    s.set(x, y, n(x, y) < 0.12 ? RU[1 + (n(y, x) * 2 | 0)] : OD[i]);
  }
  s.set(2, 17, null); s.set(11, 17, null);
  for (let y = 2; y <= 7; y++) for (let x = 2; x <= 11; x++) { const dx = (x + .5 - 7) / 5, dy = (y + .5 - 4.5) / 2.3, d = dx * dx + dy * dy; if (d <= 1) s.set(x, y, d > 0.6 ? OD[4] : OD[3]); }
  s.set(9, 4, M[1]); s.set(9, 3, M[2]);
  return s;
}
function crate(s, x0, y0, x1, th, fh) {
  box(s, x0, y0, x1, y0 + th - 1, (x, y) => y === y0 ? W[4] : y === y0 + (th >> 1) ? W[2] : W[3]);
  const f0 = y0 + th, f1 = f0 + fh - 1;
  box(s, x0, f0, x1, f1, (x, y) => x === x0 || x === x1 || y === f0 || y === f1 ? W[1] : (y - f0) % 3 === 0 ? W[1] : W[2]);
  s.line(x0 + 1, f1 - 1, x1 - 1, f0 + 1, (x, y) => { s.set(x, y, W[3]); s.set(x, y + 1, W[1]); });
  box(s, x0, f0, x1, f0, W[0]);
}
function crates() {
  const s = new Spr(16, 22);
  s.ellipseShadow(8, 20, 8, 2.2, 0.4);
  crate(s, 1, 8, 14, 4, 9); crate(s, 3, 2, 11, 3, 6);
  return s;
}
function tires() {
  const s = new Spr(16, 16);
  s.ellipseShadow(8, 14, 7.5, 2, 0.4);
  const tire = (cx, cy, rx, ry) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + .5 - cx) / rx; if (Math.abs(dx) > 1) continue; const e = Math.sqrt(1 - dx * dx) * ry;
      if (y >= cy && y <= cy + e + 2) s.set(x, y, (x + y) % 2 ? TY[1] : TY[0]);
    }
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry, d = dx * dx + dy * dy; if (d > 1) continue;
      s.set(x, y, d < 0.22 ? TY[0] : dx + dy < -0.5 ? TY[3] : TY[2]);
    }
  };
  tire(8, 10, 6.5, 2.8); tire(8, 7, 6.5, 2.8); tire(9, 4, 6, 2.6);
  return s;
}
function boulder(seed) {
  const s = new Spr(18, 14);
  s.ellipseShadow(9, 12, 8.5, 2.2, 0.4);
  blob(s, 8.5, 7.5, 7.5, 5.5, RK, seed); blob(s, 13.5, 9.5, 3.5, 3, RK, seed + 1);
  s.line(6, 4, 8, 8, (x, y) => s.set(x, y, RK[0])); s.set(9, 9, RK[0]);
  return s;
}
function fence() {
  const s = new Spr(16, 18);
  s.ellipseShadow(8, 15.5, 7.5, 1.8, 0.3);
  box(s, 5, 15, 11, 16, (x, y) => y === 15 ? DW[3] : DW[1]);
  for (const px of [2, 12]) box(s, px, 3, px + 1, 15, (x, y) => y === 3 ? DW[4] : x === px ? DW[3] : DW[1]);
  box(s, 1, 6, 14, 7, (x, y) => y === 6 ? DW[3] : DW[2]); s.set(8, 6, DW[1]);
  s.line(4, 11, 9, 13, (x, y) => { s.set(x, y, DW[3]); s.set(x, y + 1, DW[1]); });
  return s;
}
function streetlight(seed) {
  const s = new Spr(14, 44), n = (x, y) => hh(x, y, seed);
  s.ellipseShadow(6, 41.5, 4.5, 1.6, 0.4);
  for (let y = 7; y <= 40; y++) { s.set(5, y, n(5, y) < 0.15 ? RU[3] : M[3]); s.set(6, y, n(6, y) < 0.15 ? RU[1] : M[1]); }
  box(s, 4, 38, 7, 42, (x, y) => y === 38 ? M[3] : x < 6 ? M[2] : M[1]);
  box(s, 5, 4, 12, 5, (x, y) => y === 4 ? M[3] : M[1]);
  box(s, 9, 6, 12, 7, (x, y) => y === 6 ? M[0] : x === 11 ? GL[0] : GL[3]);
  return s;
}
function rubble(seed) {
  const s = new Spr(16, 12), r = mkRng(seed);
  const brick = (x, y) => { s.ellipseShadow(x + 1.5, y + 2, 2, 1, 0.3); box(s, x, y, x + 2, y, BR[2]); box(s, x, y + 1, x + 2, y + 1, BR[1]); };
  const stone = (x, y) => { s.ellipseShadow(x + 1, y + 2, 1.5, 1, 0.3); s.set(x, y, RK[3]); s.set(x + 1, y, RK[2]); s.set(x, y + 1, RK[1]); s.set(x + 1, y + 1, RK[0]); };
  box(s, 3, 7, 9, 7, DW[3]); box(s, 3, 8, 9, 8, DW[1]);
  for (let i = 0; i < 4; i++) brick(1 + r() * 11 | 0, 1 + r() * 8 | 0);
  for (let i = 0; i < 4; i++) stone(1 + r() * 12 | 0, 1 + r() * 8 | 0);
  return s;
}
function campfire() {
  const s = new Spr(16, 12);
  s.ellipseShadow(8, 7, 7, 3.5, 0.25);
  for (let y = 3; y <= 10; y++) for (let x = 2; x <= 13; x++) { const dx = (x + .5 - 8) / 4.5, dy = (y + .5 - 6.5) / 2.4; if (dx * dx + dy * dy <= 1) s.set(x, y, (x + y) % 3 ? '#3a3834' : '#55524a'); }
  const log = (a, b, c, d) => s.line(a, b, c, d, (x, y) => { s.set(x, y, '#2a2420'); s.set(x, y - 1, '#4a3a2c'); });
  log(5, 5, 11, 8); log(5, 8, 11, 5);
  s.set(8, 6, '#b0582c'); s.set(7, 7, '#8a3e24'); s.set(10, 7, '#b0582c');
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, x = Math.round(8 + Math.cos(a) * 6.2 - 1), y = Math.round(6.5 + Math.sin(a) * 3.4 - 1); s.set(x, y, RK[4]); s.set(x + 1, y, RK[3]); s.set(x, y + 1, RK[2]); s.set(x + 1, y + 1, RK[1]); }
  return s;
}

const GM = ['#1f2a24', '#2c3b32', '#3b4e42', '#4d6354', '#62795f'];
const HY = ['#6e5a2c', '#8c7438', '#a88f48', '#c4aa5c', '#d8c476'];
const PAPER = ['#d8d2c0', '#b8b09a'];
function dumpster(seed) {
  const s = new Spr(32, 24), n = (x, y) => hh(x, y, seed);
  s.ellipseShadow(16, 21, 15, 2.5, 0.4);
  box(s, 2, 3, 29, 8, (x, y) => y === 3 ? GM[4] : y === 8 ? GM[0] : x % 7 === 0 ? GM[2] : GM[3]);
  box(s, 2, 9, 29, 19, (x, y) => { let c = (x - 2) % 9 === 0 ? GM[1] : y === 9 ? GM[3] : GM[2]; if (n(x >> 1, y >> 1) < 0.12) c = RU[2 + (n(x, y) * 2 | 0)]; return y === 19 ? GM[0] : c; });
  box(s, 4, 8, 15, 8, '#0e0d0b');
  for (const [x, c] of [[5, PAPER[0]], [7, TY[1]], [8, TY[2]], [11, PAPER[1]], [13, TY[1]]]) s.set(x, 7, c);
  box(s, 0, 11, 1, 14, GM[1]); box(s, 30, 11, 31, 14, GM[1]);
  for (const wx of [4, 25]) { box(s, wx, 19, wx + 2, 21, TY[0]); s.set(wx + 1, 20, TY[2]); }
  return s;
}
function bench() {
  const s = new Spr(32, 18);
  s.ellipseShadow(16, 15.5, 14, 1.8, 0.35);
  for (const y of [2, 5]) { box(s, 2, y, 29, y, W[4]); box(s, 2, y + 1, 29, y + 1, W[2]); }
  box(s, 2, 9, 29, 9, W[4]); box(s, 2, 10, 29, 11, W[3]); box(s, 2, 12, 29, 12, W[1]);
  for (const [x, y] of [[18, 2], [19, 2], [18, 3], [19, 3], [20, 3]]) s.set(x, y, null);
  for (const lx of [4, 26]) box(s, lx, 1, lx + 1, 15, (x, y) => y >= 13 ? M[1] : x === lx ? M[2] : M[0]);
  return s;
}
function barrier(seed) {
  const s = new Spr(32, 18), n = (x, y) => hh(x, y, seed);
  s.ellipseShadow(16, 15.5, 15, 2, 0.4);
  box(s, 4, 2, 27, 4, (x, y) => y === 2 ? RK[4] : RK[3]);
  box(s, 2, 5, 29, 15, (x, y) => y === 15 ? RK[0] : n(x, y) < 0.1 ? RK[1] : y >= 10 && y <= 11 ? RK[2] : RK[3]);
  for (let x = 3; x <= 28; x++) for (const y of [7, 8]) if (((x + y) >> 2) % 2 === 0 && n(x, y) > 0.1) s.set(x, y, X[0]);
  s.set(2, 5, null); s.set(29, 5, null); s.set(27, 6, RK[1]); s.set(28, 6, RK[1]); s.set(28, 7, RK[1]);
  return s;
}
function sign(seed) {
  const s = new Spr(14, 32), n = (x, y) => hh(x, y, seed);
  s.ellipseShadow(7, 29.5, 3, 1.2, 0.4);
  box(s, 6, 10, 7, 29, x => x === 6 ? M[3] : M[1]);
  for (let y = 0; y <= 12; y++) for (let x = 0; x <= 13; x++) { const d = Math.abs(x - 6.5) + Math.abs(y - 6); if (d <= 6.5) s.set(x, y, d > 5.5 ? M[0] : n(x, y) < 0.1 ? RU[2] : x + y < 12 ? X[0] : '#a88a3a'); }
  box(s, 6, 3, 7, 6, M[0]); box(s, 6, 8, 7, 8, M[0]);
  for (const [x, y] of [[4, 5], [9, 6], [5, 9]]) s.set(x, y, M[0]);
  return s;
}
function mailbox() {
  const s = new Spr(12, 20);
  s.ellipseShadow(6, 17.5, 3, 1.2, 0.4);
  box(s, 5, 9, 6, 17, x => x === 5 ? W[3] : W[1]);
  box(s, 1, 3, 10, 9, (x, y) => y === 3 ? M[3] : y === 9 ? M[0] : x === 1 ? M[1] : x === 10 ? M[1] : M[2]);
  s.set(1, 3, null); s.set(10, 3, null);
  box(s, 11, 2, 11, 7, OD[2]); box(s, 9, 2, 10, 3, OD[3]);
  return s;
}
function hydrant() {
  const s = new Spr(10, 14);
  s.ellipseShadow(5, 12, 4, 1.3, 0.4);
  box(s, 2, 4, 7, 12, x => x <= 3 ? OD[4] : x <= 5 ? OD[3] : OD[1]);
  box(s, 3, 1, 6, 3, (x, y) => y === 1 ? OD[4] : x <= 4 ? OD[3] : OD[2]);
  box(s, 0, 6, 1, 7, OD[2]); box(s, 8, 6, 9, 7, OD[1]);
  box(s, 1, 11, 8, 12, (x, y) => y === 11 ? OD[2] : OD[0]);
  s.set(4, 0, M[2]); s.set(5, 0, M[1]); s.set(4, 7, RU[1]); s.set(6, 9, RU[1]);
  return s;
}
function haybale(seed) {
  const s = new Spr(18, 16), n = (x, y) => hh(x, y, seed);
  s.ellipseShadow(9, 13.5, 8.5, 2, 0.4);
  box(s, 1, 2, 16, 5, (x, y) => n(x, y) < 0.3 ? HY[3] : HY[4]);
  box(s, 1, 6, 16, 13, (x, y) => y === 13 ? HY[0] : n(x, y) < 0.25 ? HY[1] : (x + y) % 3 === 0 ? HY[2] : HY[3]);
  for (const bx of [5, 12]) box(s, bx, 2, bx, 13, (x, y) => y <= 5 ? W[2] : W[1]);
  s.set(1, 2, null); s.set(16, 2, null); s.set(0, 12, HY[3]); s.set(17, 11, HY[2]);
  return s;
}
function logs() {
  const s = new Spr(20, 14);
  s.ellipseShadow(10, 12, 9.5, 2, 0.4);
  const log = (cx, cy) => { for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) { const dx = x - cx, dy = y - cy, d = dx * dx + dy * dy; if (d <= 5) s.set(x, y, d >= 4 ? (dx + dy < 0 ? RU[3] : RU[1]) : d <= 1 ? W[2] : W[4]); } };
  for (const cx of [4, 9, 14]) log(cx, 10);
  for (const cx of [6, 12]) log(cx, 6);
  log(9, 2);
  return s;
}
function trash(seed) {
  const s = new Spr(16, 12), r = mkRng(seed);
  const bag = (cx, cy) => { s.ellipseShadow(cx, cy + 2, 3, 1, 0.3); blob(s, cx, cy, 3, 2.5, TY, seed + cx); s.set(cx | 0, (cy - 2) | 0, TY[3]); };
  bag(4.5, 5.5); bag(10.5, 7);
  for (let i = 0; i < 7; i++) s.set(r() * 15 | 0, r() * 11 | 0, PAPER[i % 2]);
  s.set(13, 3, RU[3]); s.set(14, 3, RU[2]);
  return s;
}
function pole(seed) {
  const s = new Spr(20, 56), n = (x, y) => hh(x, y, seed);
  s.ellipseShadow(10, 53.5, 3.5, 1.4, 0.4);
  for (let y = 4; y <= 53; y++) { s.set(9, y, n(9, y) < 0.2 ? DW[3] : W[3]); s.set(10, y, n(10, y) < 0.2 ? W[2] : W[1]); }
  box(s, 1, 8, 18, 9, (x, y) => y === 8 ? W[4] : W[1]);
  for (const x of [2, 6, 13, 17]) s.set(x, 7, M[3]);
  box(s, 11, 13, 13, 18, (x, y) => y === 13 ? M[3] : x === 11 ? M[2] : M[1]);
  s.line(17, 9, 19, 20, (x, y) => s.set(x, y, TY[0]));
  return s;
}
function well(seed) {
  const s = new Spr(20, 24);
  s.ellipseShadow(10, 20.5, 9, 2.5, 0.4);
  box(s, 1, 11, 18, 19, (x, y) => { const row = (y - 11) / 3 | 0, r = (y - 11) % 3; if (r === 2 || (x + row * 3) % 6 === 0) return RK[0]; return hh(x, y, seed + 1) < 0.3 ? RK[3] : RK[2]; });
  for (let y = 7; y <= 14; y++) for (let x = 1; x <= 18; x++) { const dx = (x + 0.5 - 10) / 9, dy = (y + 0.5 - 10.5) / 3.5, d = dx * dx + dy * dy; if (d <= 1) s.set(x, y, d < 0.45 ? '#0e0d0b' : pick(RK, 0.75 - dy * 0.3 + (hh(x, y, seed) - 0.5) * 0.3)); }
  for (const px of [2, 16]) box(s, px, 2, px + 1, 11, x => x === px ? W[3] : W[1]);
  box(s, 0, 0, 19, 2, (x, y) => y === 0 ? W[4] : y === 1 ? W[3] : W[1]);
  box(s, 3, 5, 16, 5, DW[3]); box(s, 10, 6, 10, 9, '#9a875a');
  return s;
}

const BONE = ['#8e8672', '#b8b09a', '#d8d2c0'], BLOOD = ['#3a1410', '#5a1f18', '#7a2a1e'];
const TN = ['#262f22', '#364230', '#4a583c', '#5f6e4a'], FL = ['#c8b04a', '#b86a8a', '#d8d2c0', '#8a6ab0'];
const LV = ['#6e4a2a', '#8a3e24', '#a8592c', '#c07a34'], YB = ['#5e4a1c', '#8a6c28', '#b08c34', '#c8a444', '#d8bc5c'];
const PC = ['#161816', '#1e211e', '#2a2d2a', '#c8c8bc', '#dcdcd0'];
function flowers(seed) {
  const s = new Spr(16, 12), r = mkRng(seed);
  for (let i = 0; i < 5; i++) { const x = r() * 15 | 0, y = 6 + r() * 4 | 0; s.set(x, y, L[3]); s.set(x, y + 1, L[2]); }
  for (let i = 0; i < 7; i++) { const x = 1 + r() * 13 | 0, y = 2 + r() * 7 | 0, c = FL[r() * FL.length | 0]; s.set(x, y + 1, L[2]); s.set(x, y + 2, L[1]); s.set(x, y, c); if (r() < 0.5) s.set(x + 1, y, c); }
  return s;
}
function tuft(seed) {
  const s = new Spr(16, 14), r = mkRng(seed);
  s.ellipseShadow(8, 12, 6, 1.5, 0.25);
  for (let i = 0; i < 14; i++) { const x = 2 + r() * 12 | 0, hgt = 3 + r() * 6 | 0, lean = r() < 0.5 ? -1 : 1; for (let j = 0; j < hgt; j++) s.set(x + (j > hgt * 0.6 ? lean : 0), 12 - j, j === hgt - 1 ? L[4] : j > hgt / 2 ? L[3] : L[1]); }
  return s;
}
function mushrooms() {
  const s = new Spr(12, 10);
  for (const [cx, cy, rad, red] of [[3, 6, 2, 0], [8, 7, 1.6, 1], [6, 3, 1.3, 0]]) {
    s.ellipseShadow(cx + 0.5, cy + 2.5, rad + 0.5, 0.8, 0.3);
    s.set(cx, cy + 1, BONE[2]); s.set(cx, cy + 2, BONE[1]);
    for (let x = Math.floor(cx - rad); x <= cx + rad; x++) { s.set(x, cy, red ? (x < cx ? OD[4] : OD[2]) : (x < cx ? W[3] : W[2])); if (Math.abs(x - cx) < rad - 0.5) s.set(x, cy - 1, red ? OD[3] : W[4]); }
    if (red) s.set(cx, cy - 1, BONE[2]);
  }
  return s;
}
function leaves(seed) {
  const s = new Spr(16, 10);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) { const dx = (x + 0.5 - 8) / 7, dy = (y + 0.5 - 5.5) / 3.6, d = dx * dx + dy * dy + (hh(x, y, seed) - 0.5) * 0.5; if (d <= 1) s.set(x, y, LV[Math.floor(hh(x, y, seed + 1) * 4)]); }
  return s;
}
function pebbles(seed) {
  const s = new Spr(16, 10), r = mkRng(seed);
  for (let i = 0; i < 6; i++) { const x = 1 + r() * 13 | 0, y = 1 + r() * 7 | 0, big = r() < 0.4; s.set(x, y, RK[3]); s.set(x, y + 1, RK[1]); if (big) { s.set(x + 1, y, RK[2]); s.set(x + 1, y + 1, RK[0]); } s.shade(x, y + 2, 0.3); }
  return s;
}
function fallenLog(seed) {
  const s = new Spr(32, 18), n = (x, y) => hh(x, y, seed);
  s.ellipseShadow(16, 14.5, 14.5, 2, 0.4);
  box(s, 9, 3, 10, 5, x => x === 9 ? W[3] : W[1]);
  for (let y = 6; y <= 13; y++) for (let x = 2; x <= 26; x++) { const t = (y - 6) / 7; let i = t < 0.2 ? 3 : t < 0.55 ? 2 : t < 0.85 ? 1 : 0; if (n(x, y >> 1) < 0.12) i = Math.max(0, i - 1); let c = [DW[0], W[1], W[2], W[3]][i]; if (y <= 7 && n(x >> 1, 0) < 0.35) c = L[3]; s.set(x, y, c); }
  for (let y = 6; y <= 13; y++) for (let x = 25; x <= 30; x++) { const dx = (x + 0.5 - 27.5) / 3, dy = (y + 0.5 - 10) / 4.2, d = dx * dx + dy * dy; if (d <= 1) s.set(x, y, d > 0.65 ? W[1] : d > 0.3 ? W[4] : W[3]); }
  return s;
}
function skeleton() {
  const s = new Spr(16, 10);
  s.ellipseShadow(8, 7, 7, 2, 0.2);
  box(s, 1, 3, 3, 5, BONE[2]); s.set(1, 5, BONE[1]); s.set(2, 4, DW[0]); s.set(3, 4, DW[0]);
  box(s, 4, 4, 11, 4, BONE[1]);
  for (const x of [5, 7, 9]) { s.set(x, 3, BONE[2]); s.set(x, 5, BONE[2]); s.set(x, 2, BONE[1]); s.set(x, 6, BONE[1]); }
  s.line(11, 4, 15, 2, (x, y) => s.set(x, y, BONE[2])); s.line(11, 4, 15, 7, (x, y) => s.set(x, y, BONE[1]));
  s.line(5, 5, 4, 8, (x, y) => s.set(x, y, BONE[1])); s.line(6, 3, 8, 0, (x, y) => s.set(x, y, BONE[2]));
  return s;
}
function blood(seed) {
  const s = new Spr(16, 12), r = mkRng(seed);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) { const dx = (x + 0.5 - 7) / 5.5, dy = (y + 0.5 - 6) / 3.2, d = dx * dx + dy * dy + (hh(x, y, seed) - 0.5) * 0.5; if (d <= 1) s.set(x, y, d < 0.35 ? BLOOD[0] : d < 0.7 ? BLOOD[1] : BLOOD[2]); }
  for (let i = 0; i < 6; i++) s.set(r() * 16 | 0, r() * 12 | 0, BLOOD[1]);
  return s;
}
function tent(seed) {
  const s = new Spr(32, 24), n = (x, y) => hh(x, y, seed);
  s.ellipseShadow(16, 20.5, 15, 2.5, 0.4);
  for (let y = 3; y <= 19; y++) { const hw = 1 + (y - 3) / 16 * 13; for (let x = Math.floor(16 - hw); x <= Math.ceil(15 + hw); x++) { let c = x < 16 ? (x < 16 - hw + 2 ? TN[3] : TN[2]) : TN[1]; if (n(x, y) < 0.06) c = TN[0]; if (y >= 9 && Math.abs(x + 0.5 - 16) < (y - 9) * 0.45 + 0.5) c = y === 19 ? TN[0] : '#12110d'; s.set(x, y, c); } }
  s.line(16, 3, 16, 9, (x, y) => s.set(x, y, TN[0]));
  s.line(4, 15, 0, 20, (x, y) => s.set(x, y, W[3])); s.line(27, 15, 31, 20, (x, y) => s.set(x, y, W[3]));
  box(s, 15, 1, 16, 2, W[3]);
  return s;
}
function cart() {
  const s = new Spr(16, 16);
  s.ellipseShadow(8, 14, 7, 1.6, 0.35);
  for (let y = 3; y <= 10; y++) { const xl = 2 + ((y - 3) >> 2); for (let x = xl; x <= 13; x++) if (y === 3 || y === 10 || x === 13 || x === xl || x % 3 === 0 || y % 3 === 0) s.set(x, y, y === 3 ? M[3] : x % 3 === 0 ? M[2] : M[1]); }
  box(s, 13, 1, 15, 1, OD[3]); s.set(13, 2, M[2]);
  box(s, 3, 11, 13, 11, M[1]);
  for (const x of [4, 12]) { s.set(x, 12, M[1]); s.set(x, 13, TY[0]); s.set(x + 1, 13, TY[1]); }
  return s;
}
function backpack() {
  const s = new Spr(12, 12);
  s.ellipseShadow(6, 10.5, 5, 1.3, 0.35);
  box(s, 4, 1, 7, 2, (x, y) => y === 1 ? TN[2] : TN[1]); s.set(5, 2, null); s.set(6, 2, null);
  box(s, 2, 3, 9, 10, (x, y) => x === 2 ? TN[2] : x === 9 ? TN[0] : TN[1]);
  box(s, 2, 3, 9, 5, (x, y) => y === 3 ? TN[3] : y === 5 ? TN[0] : TN[2]);
  box(s, 4, 7, 7, 9, (x, y) => y === 7 ? TN[2] : TN[1]); s.set(5, 5, X[0]);
  s.line(9, 5, 11, 9, (x, y) => s.set(x, y, TN[0]));
  return s;
}
function picnic() {
  const s = new Spr(32, 20);
  s.ellipseShadow(16, 17, 15, 2, 0.35);
  box(s, 4, 2, 27, 3, (x, y) => y === 2 ? W[4] : W[2]);
  box(s, 2, 5, 29, 10, (x, y) => y === 10 ? W[1] : (y - 5) % 2 === 1 ? W[2] : W[3]);
  for (const lx of [5, 26]) box(s, lx, 11, lx + 1, 16, x => x === lx ? W[2] : W[0]);
  box(s, 3, 13, 28, 14, (x, y) => y === 13 ? W[4] : W[1]);
  return s;
}
function scarecrow() {
  const s = new Spr(16, 32);
  s.ellipseShadow(8, 29.5, 3.5, 1.3, 0.4);
  box(s, 7, 10, 8, 29, x => x === 7 ? W[3] : W[1]);
  box(s, 1, 11, 14, 12, (x, y) => y === 11 ? W[3] : W[1]);
  box(s, 4, 11, 11, 20, x => x < 6 ? PT[3] : x > 9 ? PT[1] : PT[2]);
  box(s, 2, 11, 4, 13, PT[2]); box(s, 11, 11, 13, 13, PT[1]);
  for (const x of [1, 14]) { s.set(x, 12, '#c4aa5c'); s.set(x, 13, '#a88f48'); }
  for (const x of [5, 8, 10]) s.set(x, 21, '#c4aa5c');
  box(s, 5, 5, 10, 10, (x, y) => y === 10 ? S[1] : x < 7 ? S[3] : S[2]);
  s.set(6, 7, DW[0]); s.set(9, 7, DW[0]); box(s, 6, 9, 9, 9, DW[1]);
  box(s, 3, 4, 12, 4, W[2]); box(s, 5, 1, 10, 3, (x, y) => y === 1 || x < 7 ? W[3] : W[2]);
  return s;
}
function wheelbarrow() {
  const s = new Spr(18, 14);
  s.ellipseShadow(9, 12, 8, 1.6, 0.35);
  box(s, 4, 9, 6, 12, (x, y) => x === 5 && y === 10 ? TY[2] : TY[0]);
  s.line(9, 8, 10, 12, (x, y) => s.set(x, y, M[1]));
  for (let y = 5; y <= 8; y++) for (let x = 3 + (y - 5); x <= 13 - (y - 5) * 0.5; x++) s.set(x, y, y === 8 ? RU[0] : RU[2]);
  box(s, 3, 3, 13, 4, (x, y) => y === 3 ? RU[4] : RU[3]);
  s.line(12, 8, 17, 4, (x, y) => s.set(x, y, W[2]));
  return s;
}
function wheel(s, cx, cy, r) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy); if (d <= r) s.set(x, y, d > r - 1.6 ? ((x + y) % 2 ? TY[1] : TY[0]) : d > r * 0.45 ? TY[2] : d > 1.2 ? OD[2] : M[1]); }
}
function tractor(seed) {
  const s = new Spr(32, 28), n = (x, y) => hh(x, y, seed), paint = (x, y, i) => n(x, y) < 0.25 ? RU[Math.max(1, i)] : OD[i];
  s.ellipseShadow(16, 25, 15, 2.5, 0.4);
  box(s, 15, 2, 16, 8, x => x === 15 ? M[2] : M[0]); s.set(15, 1, M[0]); s.set(16, 1, M[0]);
  box(s, 4, 9, 19, 18, (x, y) => paint(x, y, y === 9 ? 4 : y < 12 ? 3 : y === 18 ? 1 : 2));
  for (let y = 12; y <= 16; y += 2) box(s, 5, y, 9, y, M[0]);
  box(s, 20, 4, 26, 18, (x, y) => paint(x, y, y === 4 ? 4 : x === 20 ? 3 : 2));
  box(s, 21, 6, 25, 9, (x, y) => y === 6 ? GL[3] : GL[1]);
  wheel(s, 24.5, 19.5, 6.5); wheel(s, 8, 22, 4);
  return s;
}
function bus(seed) {
  const s = new Spr(48, 30), n = (x, y) => hh(x, y, seed), paint = (x, y, i) => n(x, y) < 0.08 ? RU[Math.max(1, i - 1)] : YB[i];
  s.ellipseShadow(24, 26.5, 23.5, 3, 0.4);
  box(s, 2, 3, 45, 8, (x, y) => paint(x, y, y === 3 ? 4 : 3));
  box(s, 2, 9, 45, 14, (x, y) => { if (x % 6 === 5 || y === 14) return YB[1]; const w = hh(x / 6 | 0, 0, seed); return w < 0.25 ? '#0e0d0b' : w < 0.4 ? (y % 2 ? W[3] : W[1]) : y === 9 ? GL[3] : GL[1]; });
  box(s, 2, 15, 45, 23, (x, y) => y === 18 ? DW[0] : paint(x, y, y === 15 ? 3 : y === 23 ? 1 : 2));
  s.set(44, 20, GL[3]); s.set(3, 20, OD[3]);
  for (const wx of [6, 36]) { box(s, wx, 21, wx + 5, 25, TY[0]); box(s, wx + 1, 22, wx + 4, 24, TY[2]); s.set(wx + 2, 23, M[3]); }
  for (const [x, y] of [[2, 3], [45, 3], [2, 23], [45, 23]]) s.set(x, y, null);
  return s;
}
function graveCross() {
  const s = new Spr(12, 18);
  s.ellipseShadow(6, 15.5, 5, 1.5, 0.3);
  box(s, 1, 12, 10, 15, (x, y) => y === 12 ? D[3] : y === 15 ? D[0] : D[2]);
  box(s, 5, 1, 6, 13, x => x === 5 ? W[3] : W[1]);
  box(s, 2, 4, 9, 5, (x, y) => y === 4 ? W[4] : W[2]);
  return s;
}
function tombstone(seed) {
  const s = new Spr(12, 16);
  s.ellipseShadow(6, 13.5, 5, 1.4, 0.3);
  box(s, 2, 3, 9, 13, (x, y) => y === 3 && (x === 2 || x === 9) ? null : y === 3 ? RK[4] : x === 2 ? RK[3] : x === 9 ? RK[1] : hh(x, y, seed) < 0.12 ? RK[1] : RK[2]);
  box(s, 4, 6, 7, 6, RK[0]); box(s, 4, 8, 7, 8, RK[0]); s.line(7, 4, 6, 7, (x, y) => s.set(x, y, RK[0]));
  box(s, 1, 13, 10, 14, (x, y) => y === 13 ? RK[2] : RK[0]);
  return s;
}
function wire() {
  const s = new Spr(32, 16);
  s.ellipseShadow(16, 13.5, 15, 1.5, 0.3);
  for (const px of [2, 28]) box(s, px, 2, px + 1, 13, x => x === px ? W[3] : W[1]);
  for (let x = 1; x <= 30; x++) { const a = x * 0.9; s.set(x, Math.round(7 + Math.sin(a) * 3.5), M[3]); s.set(x, Math.round(7 + Math.cos(a) * 3.5), M[2]); if (x % 4 === 0) s.set(x, Math.round(7 + Math.sin(a + 1) * 2), M[3]); }
  return s;
}
function sandbagPile() {
  const s = new Spr(18, 14);
  s.ellipseShadow(9, 12, 8.5, 1.8, 0.4);
  const bag = (x, y) => { box(s, x, y, x + 5, y + 3, (xx, yy) => yy === y ? S[3] : yy === y + 3 ? S[0] : xx === x + 5 ? S[1] : S[2]); s.set(x, y, null); s.set(x + 5, y, null); s.set(x + 2, y + 1, S[1]); };
  bag(1, 8); bag(6, 8); bag(11, 8); bag(3, 4); bag(9, 4); bag(6, 0);
  return s;
}
function bicycle() {
  const s = new Spr(18, 12);
  s.ellipseShadow(9, 9, 8, 1.6, 0.3);
  const ring = (cx, cy) => { for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; s.set(Math.round(cx + Math.cos(t) * 3.5), Math.round(cy + Math.sin(t) * 2.5), TY[1]); } s.set(cx, cy, M[2]); };
  ring(4, 6); ring(13, 6);
  s.line(4, 6, 8, 3, (x, y) => s.set(x, y, OD[3])); s.line(8, 3, 13, 6, (x, y) => s.set(x, y, OD[3])); s.line(8, 3, 9, 7, (x, y) => s.set(x, y, OD[2])); s.line(4, 6, 9, 7, (x, y) => s.set(x, y, OD[2]));
  box(s, 7, 1, 9, 1, TY[0]); box(s, 12, 2, 14, 2, M[3]);
  return s;
}

// [key, generator]
export const DECOR = [
  ['deco_car', () => car(71)],
  ['deco_drum', () => drum(72)],
  ['deco_crates', crates],
  ['deco_tires', tires],
  ['deco_boulder', () => boulder(73)],
  ['deco_fence', fence],
  ['deco_streetlight', () => streetlight(74)],
  ['deco_rubble', () => rubble(75)],
  ['deco_campfire', campfire],
  ['deco_dumpster', () => dumpster(76)],
  ['deco_bench', bench],
  ['deco_barrier', () => barrier(77)],
  ['deco_sign', () => sign(78)],
  ['deco_mailbox', mailbox],
  ['deco_hydrant', hydrant],
  ['deco_haybale', () => haybale(79)],
  ['deco_logs', logs],
  ['deco_trash', () => trash(80)],
  ['deco_pole', () => pole(81)],
  ['deco_well', () => well(82)],
  ['deco_flowers', () => flowers(83)],
  ['deco_tuft', () => tuft(84)],
  ['deco_mushrooms', mushrooms],
  ['deco_leaves', () => leaves(85)],
  ['deco_pebbles', () => pebbles(86)],
  ['deco_fallen_log', () => fallenLog(87)],
  ['deco_skeleton', skeleton],
  ['deco_blood', () => blood(88)],
  ['deco_tent', () => tent(89)],
  ['deco_cart', cart],
  ['deco_backpack', backpack],
  ['deco_bicycle', bicycle],
  ['deco_picnic', picnic],
  ['deco_scarecrow', scarecrow],
  ['deco_wheelbarrow', wheelbarrow],
  ['deco_tractor', () => tractor(90)],
  ['deco_bus', () => bus(91)],
  ['deco_police_car', () => car(92, PC, true, 0.35)],
  ['deco_grave_cross', graveCross],
  ['deco_tombstone', () => tombstone(93)],
  ['deco_wire', wire],
  ['deco_sandbags', sandbagPile]
];
export function buildDecor(sea = 'summer') {
  const A = {}, sf = sea === 'summer' ? '' : '_' + sea;
  for (const [k, g] of DECOR) A[k + sf] = dress(withSeason(sea, g), sea);
  return A;
}
