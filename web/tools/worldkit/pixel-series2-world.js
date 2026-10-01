// Series 2 — world: water & shores, new terrain, grass blend overlays, bridges, ruined town, farmland, landmarks, nature.
import { Spr, G, D, W, L, PN, DW, M, X, SEASON_NAMES, withSeason, dress, mkRng } from './pixel-assets-v2.js';
import { H } from './pixel-buildings.js';
import { text } from './pixel-ui.js';

const { hh, dk, rect, shadeRect, plaster, win, door, B, GL } = H;
const TAU = Math.PI * 2, per = (u, s = 0) => 1.1 * Math.sin(TAU * u / 16 + s) + 0.6 * Math.sin(TAU * u / 8 + s * 1.7);
const tile = fn => { const s = new Spr(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) s.set(x, y, fn(x, y)); return s; };
const wp = s => (x, y, c) => s.set(((x % 16) + 16) % 16, ((y % 16) + 16) % 16, c);
const pick = (pal, v) => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(v * pal.length)))];
function blob(s, cx, cy, rx, ry, pal, seed, gap = 0) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry, d2 = dx * dx + dy * dy; if (d2 > 1) continue;
    if (gap && d2 > 0.7 && hh(x, y, seed + 3) < gap) continue;
    const l = -dx * 0.5 - dy * 0.6 + Math.sqrt(1 - d2) * 0.6; s.set(x, y, pick(pal, (l + 0.45) / 1.45 + (hh(x, y, seed) - .5) * .18));
  }
}

const WATER = ['#1c2a2e', '#26393d', '#334d50', '#476a6a', '#6a8e88'];
const ICE = ['#6f8896', '#8ea6b2', '#aec2cc', '#cfdde2', '#e6eef0'];
const FOAM = '#8fa89e';
const SNOW = ['#a3adb6', '#c3cad0', '#dde2e5', '#eef1f2'];
const FF = ['#2a261c', '#353024', '#433c2c', '#51493a'];
const MUD = ['#2a2a1e', '#353526', '#434330', '#52523c'];
const MURK = ['#1f2a20', '#28352a', '#334334', '#445642'];
const RK = ['#3b3f3a', '#545a53', '#6e756c', '#8b9287', '#a7ad9f'];
const ASPH = ['#262826', '#303330', '#3b3e3b', '#484b47'];
const CON = ['#4e504a', '#5f615a', '#72746b', '#85877d', '#989a8f'];
const LINE = ['#7a6c3a', '#a08c4c'];
const PAINT = ['#7e8276', '#a2a698'];
const WHEAT = ['#6e5a2a', '#8a7436', '#a88f48', '#c4aa5c', '#dcc47a'];
const STRAW = ['#6e5a2a', '#8a7436', '#a88f48'];
const FALL_LEAF = ['#a8592c', '#c07a34', '#8a3e24'];
const RED = ['#5a1f18', '#7a2e24', '#a8453a', '#c45a48'];
const CARD = ['#8a8f80', '#b8bcaa', '#dfe2d0'];

/* ---------- water & shores ---------- */
function waterPx(x, y, f, Wt) {
  let c = hh(x >> 2, y >> 1, 71) < 0.3 ? Wt[0] : Wt[1];
  const rx = (x + f * 2 + (y >> 2) * 5) & 15, seg = hh(rx >> 2, y, 72);
  if (y % 4 === 1 && seg < 0.4 && (rx & 3) !== 3) c = (rx & 3) === 1 && seg < 0.15 ? Wt[3] : Wt[2];
  return c;
}
const water = (f, winter) => tile((x, y) => waterPx(x, y, winter ? 0 : f, winter ? ICE : WATER));
function geo(kind, dir, px, py, thr) {
  if (kind === 'edge') return { d: dir === 'n' ? py : dir === 's' ? 16 - py : dir === 'w' ? px : 16 - px, h: dir === 'n' || dir === 's' };
  const a = dir[1] === 'w' ? px : 16 - px, b = dir[0] === 'n' ? py : 16 - py;
  if (kind === 'out') { const c = thr + 4; return { d: a < c && b < c ? c - Math.hypot(c - a, c - b) : Math.min(a, b), h: b < a }; }
  const c = thr - 2; return { d: a > c && b > c ? c + Math.hypot(a - c, b - c) : Math.max(a, b), h: b > a };
}
const jt = (g, x, y, s) => (g.h ? per(x + .5, s) : per(y + .5, s)) * 0.8;
function shore(gr, kind, dir, winter) {
  const Wt = winter ? ICE : WATER;
  return tile((x, y) => {
    const g = geo(kind, dir, x + .5, y + .5, 5), d = g.d - 5 + jt(g, x, y, 0.7);
    if (d < -1) return gr.get(x, y);
    if (d < 0) return G[1];
    if (d < 1) return D[1];
    if (d < 2) return winter ? SNOW[1] : hh(x, y, 81) < .5 ? D[3] : D[2];
    if (d < 3) return winter ? ICE[4] : (x + y) % 2 ? FOAM : Wt[3];
    if (d < 5) return Wt[2];
    return waterPx(x, y, 0, Wt);
  });
}
function grassOver(gr, kind, dir) {
  const s = new Spr(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const g = geo(kind, dir, x + .5, y + .5, 4), d = g.d - 4 + jt(g, x, y, 2.1);
    if (d < -0.6) s.set(x, y, d > -1.6 && hh(x, y, 92) < 0.18 ? G[4] : gr.get(x, y));
    else if (d < 0.4) s.set(x, y, hh(x, y, 91) < .5 ? G[1] : G[2]);
    else if (d < 1.4) s.shade(x, y, 0.28);
  }
  return s;
}

/* ---------- terrain ---------- */
function forest(seed, kind, sea) {
  const r = mkRng(seed), s = tile((x, y) => {
    const v = hh(x, y, seed), m = hh(x >> 2, y >> 2, seed + 1) * 0.7 + hh(x >> 1, y >> 1, seed + 2) * 0.3;
    if (sea === 'winter' && m < 0.42) return v < .3 ? SNOW[1] : SNOW[2];
    if (m < 0.3) return v < .4 ? G[0] : G[1];
    return v < .3 ? FF[0] : v < .75 ? FF[1] : FF[2];
  }), P = wp(s);
  for (let i = 0; i < 14; i++) { const x = r() * 16 | 0, y = r() * 16 | 0, c = r() < .5 ? PN[3] : '#6a5a3a'; P(x, y, c); P(x + 1, y + (r() < .5 ? 1 : 0), c); }
  for (let i = 0; i < 2; i++) { const x = r() * 16 | 0, y = r() * 16 | 0, l = 3 + (r() * 3 | 0); for (let k = 0; k < l; k++) P(x + k, y + (k >> 1), W[1]); P(x + l - 1, y + (l >> 1) - 1, W[2]); }
  if (kind === 'b') {
    for (let i = 0; i < 10; i++) {
      const x = r() * 16 | 0, y = r() * 16 | 0, c = sea === 'fall' ? FALL_LEAF[i % 3] : sea === 'spring' ? (i % 3 ? G[3] : '#d9a3b2') : sea === 'winter' ? null : (i % 2 ? '#6a5a2a' : '#7a6a36');
      if (c) { P(x, y, c); P(x + 1, y, c); P(x, y + 1, dk(c, 0.3)); }
    }
    for (let i = 0; i < 2; i++) { const x = r() * 16 | 0, y = r() * 16 | 0; P(x, y, W[2]); P(x, y + 1, W[1]); P(x + 1, y + 1, W[0]); }
  }
  return s;
}
function swampMud(seed, sea) {
  const r = mkRng(seed), s = tile((x, y) => {
    const v = hh(x, y, seed), p = hh(x >> 2, y >> 1, seed + 1) * 0.7 + hh(x >> 1, y, seed + 2) * 0.3;
    if (p < 0.3) return sea === 'winter' ? (v < .5 ? ICE[1] : ICE[2]) : v < .2 ? MURK[2] : MURK[1];
    return v < .25 ? MUD[0] : v < .7 ? MUD[1] : MUD[2];
  }), P = wp(s);
  for (let i = 0; i < 3; i++) { const x = r() * 16 | 0, y = r() * 16 | 0; P(x, y, G[2]); P(x, y - 1, G[3]); P(x, y - 2, G[4]); P(x + 1, y, G[1]); P(x - 1, y - 1, G[3]); }
  for (let i = 0; i < 4; i++) P(r() * 16 | 0, r() * 16 | 0, MUD[3]);
  return s;
}
function swampWater(seed, sea) {
  const Wt = sea === 'winter' ? ICE : MURK, r = mkRng(seed);
  const s = tile((x, y) => {
    let c = waterPx(x, y, 0, [Wt[0], Wt[1], Wt[2], Wt[3]]);
    if (sea !== 'winter' && hh(x >> 1, y, seed + 4) < 0.14) c = hh(x, y, seed) < .5 ? '#4a5a34' : '#56663a';
    return c;
  }), P = wp(s);
  if (sea !== 'winter') for (let i = 0; i < 3; i++) { const x = r() * 16 | 0, y = r() * 16 | 0; P(x, y, G[3]); P(x + 1, y, G[2]); P(x - 1, y, G[2]); P(x, y + 1, G[1]); P(x + 1, y + 1, G[1]); if (sea === 'summer' && i === 0) P(x, y - 1, '#dfe2e8'); }
  return s;
}
function rocky(seed, kind, sea) {
  const r = mkRng(seed), s = tile((x, y) => { const v = hh(x, y, seed); return v < .2 ? D[1] : v < .6 ? D[2] : v < .85 ? RK[1] : RK[2]; }), P = wp(s);
  if (kind === 'a') for (let i = 0; i < 10; i++) { const x = r() * 16 | 0, y = r() * 16 | 0; P(x, y, sea === 'winter' ? SNOW[2] : RK[3]); P(x + 1, y, RK[2]); P(x, y + 1, RK[1]); P(x + 1, y + 1, RK[0]); }
  else for (let i = 0; i < 4; i++) {
    const cx = r() * 16, cy = r() * 16, rx = 2.5 + r() * 2, ry = 1.8 + r();
    for (let y = Math.floor(cy - ry) - 1; y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry, d = dx * dx + dy * dy;
      if (d <= 1) P(x, y, dy < -0.45 ? (sea === 'winter' ? SNOW[2] : RK[4]) : dx + dy < 0 ? RK[3] : RK[2]);
      else if (d <= 1.6 && dy > 0.3) P(x, y, RK[0]);
    }
  }
  return s;
}

/* ---------- ruined town ---------- */
const asphalt = seed => (x, y) => { const v = hh(x, y, seed), b = hh(x >> 2, y >> 2, seed + 1); let c = v < .12 ? ASPH[0] : v < .8 ? ASPH[1] : ASPH[2]; if (b < .2 && v < .6) c = ASPH[2]; if (v > .97) c = ASPH[3]; return c; };
function street(seed, kind, sea) {
  const s = tile(asphalt(seed)), P = wp(s), r = mkRng(seed + 9);
  const paint = (x, y, c) => { if (hh(x, y, seed + 5) > 0.18) P(x, y, c); };
  if (kind === 'h') for (let x = 2; x <= 9; x++) { paint(x, 7, LINE[1]); paint(x, 8, LINE[0]); }
  if (kind === 'v') for (let y = 2; y <= 9; y++) { paint(7, y, LINE[1]); paint(8, y, LINE[0]); }
  if (kind === 'cross') for (let y = 1; y <= 14; y++) if ((y >> 1) % 2 === 0) for (let x = 2; x <= 13; x++) paint(x, y, y % 2 ? PAINT[0] : PAINT[1]);
  if (kind === 'crack') {
    let x = 1, y = 3 + (r() * 4 | 0);
    for (let i = 0; i < 16; i++) { P(x, y, ASPH[0]); if (i % 4 === 2) { P(x, y + 1, sea === 'winter' ? SNOW[1] : G[2]); P(x, y - 1, sea === 'winter' ? SNOW[2] : G[3]); } x++; if (r() < .4) y += r() < .5 ? -1 : 1; }
    for (let k = 0; k < 5; k++) P(9 + (k >> 1), 9 + k, ASPH[0]);
    for (let yy = 11; yy <= 13; yy++) for (let xx = 3; xx <= 6; xx++) if ((xx - 4.5) ** 2 / 3 + (yy - 12) ** 2 <= 1.2) P(xx, yy, yy === 11 ? ASPH[3] : sea === 'winter' ? ICE[2] : '#1c1e1c');
  }
  return s;
}
function sidewalk(seed, sea) {
  const s = tile((x, y) => { if (x % 8 === 0 || y % 8 === 0) return CON[1]; const v = hh(x, y, seed), sl = hh(x >> 3, y >> 3, seed + 1); return v < .15 ? CON[2] : sl < .3 ? (v < .9 ? CON[2] : CON[3]) : v < .9 ? CON[3] : CON[4]; }), P = wp(s);
  for (let k = 0; k < 5; k++) P(10 + k, 3 + (k >> 1), CON[1]);
  if (sea !== 'winter') { P(8, 13, G[3]); P(8, 12, G[4]); P(0, 5, G[2]); } else { for (let x = 1; x < 16; x += 3) P(x, 0, SNOW[2]); }
  return s;
}
function curb(sw, st, dir) {
  return tile((x, y) => {
    const u = dir === 'n' ? y : dir === 's' ? 15 - y : dir === 'w' ? x : 15 - x;
    if (u < 8) return sw.get(x, y);
    if (u === 8) return CON[4];
    if (u === 9) return dir === 'n' ? CON[2] : CON[3];
    if (u === 10) return ASPH[0];
    return st.get(x, y);
  });
}
function rubbleLot(seed, sea) {
  const r = mkRng(seed), s = tile((x, y) => { const v = hh(x, y, seed); return v < .2 ? D[1] : v < .6 ? D[2] : v < .8 ? CON[1] : D[3]; }), P = wp(s);
  for (let i = 0; i < 5; i++) { const x = r() * 16 | 0, y = r() * 16 | 0; P(x, y, B[3]); P(x + 1, y, B[2]); P(x + 2, y, B[2]); P(x, y + 1, B[1]); P(x + 1, y + 1, B[1]); P(x + 2, y + 1, B[0]); }
  for (let i = 0; i < 4; i++) { const x = r() * 16 | 0, y = r() * 16 | 0; P(x, y, CON[4]); P(x + 1, y, CON[3]); P(x, y + 1, CON[2]); P(x + 1, y + 1, CON[0]); }
  { const x = r() * 12 | 0, y = r() * 12 | 0; for (let k = 0; k < 4; k++) P(x + k, y + (k >> 1), k % 2 ? M[1] : X[2]); }
  for (let i = 0; i < 3; i++) P(r() * 16 | 0, r() * 16 | 0, '#6a7a80');
  for (let i = 0; i < 2; i++) { const x = r() * 16 | 0, y = r() * 16 | 0; if (sea === 'winter') { P(x, y, SNOW[2]); P(x + 1, y, SNOW[1]); } else { P(x, y, G[3]); P(x, y - 1, G[4]); P(x + 1, y, G[2]); } }
  return s;
}
function ruinWall(seed) {
  const s = new Spr(32, 30); shadeRect(s, 2, 26, 31, 29, 0.3);
  const top = x => 6 + Math.round(Math.abs(Math.sin(x * 0.45 + 1)) * 6 + hh(x, 0, seed) * 4 + (x > 18 ? (x - 18) * 0.6 : 0));
  for (let x = 1; x <= 30; x++) {
    const t = top(x);
    for (let y = t; y <= 25; y++) {
      const fy = y - 6, row = Math.floor(fy / 3), rr = ((fy % 3) + 3) % 3;
      let c = rr === 2 || (x + (row % 2) * 3) % 6 === 0 ? '#5f5d50' : hh(x, y, seed) < .2 ? B[1] : hh(x, y, seed + 1) < .7 ? B[2] : B[3];
      if (y === t) c = B[3]; if (x === 30 || y === 25) c = B[0];
      s.set(x, y, c);
    }
  }
  rect(s, 9, 13, 14, 19, '#16140f'); rect(s, 9, 20, 14, 20, B[3]);
  for (const [x, y] of [[3, 26], [5, 27], [20, 27], [24, 26], [27, 27]]) { s.set(x, y, B[2]); s.set(x + 1, y, B[1]); }
  s.line(22, 10, 25, 4, (x, y) => s.set(x, y, M[1]));
  return dress(s);
}

/* ---------- farmland ---------- */
function tilled(seed, dir, sea) {
  const s = tile((x, y) => {
    const u = dir === 'h' ? y : x, k = u % 4, v = hh(x, y, seed);
    if (sea === 'winter' && k <= 1) return v < .15 ? D[2] : k === 0 ? SNOW[2] : SNOW[1];
    const rp = k === 0 ? [D[3], D[4]] : k === 1 ? [D[2], D[3]] : k === 2 ? [D[1], D[2]] : [D[0], D[1]];
    return v < .3 ? rp[0] : rp[1];
  }), P = wp(s);
  if (sea !== 'winter') for (let u = 0; u < 16; u += 4) for (let t = 0; t < 16; t++) {
    if ((t + (u >> 2) * 2) % 4 !== 1) continue;
    const at = (a, b, c) => dir === 'h' ? P(t + a, u + b, c) : P(u + b, t + a, c);
    if (sea === 'spring') { at(0, 0, G[4]); at(0, -1, G[3]); }
    else if (sea === 'summer') { at(0, -1, L[4]); at(-1, 0, L[3]); at(1, 0, L[2]); at(0, 0, L[3]); at(0, 1, L[1]); }
    else { at(0, -1, STRAW[2]); at(0, 0, STRAW[1]); }
  }
  return s;
}
function wheat(seed, sea) {
  if (sea === 'fall' || sea === 'winter') return tile((x, y) => {
    const v = hh(x, y, seed), st = (y + (hh(x, 0, seed) * 3 | 0)) % 3 === 0 && x % 2 === 0;
    if (sea === 'winter') return st ? STRAW[1] : v < .2 ? SNOW[1] : SNOW[2];
    return st ? (v < .5 ? STRAW[2] : '#c4aa5c') : v < .3 ? D[1] : v < .7 ? D[2] : STRAW[0];
  });
  const pal = sea === 'spring' ? G : WHEAT;
  return tile((x, y) => { if (hh(x, y, seed + 2) < .07) return pal[0]; const k = (y + (hh(x, 0, seed) * 4 | 0)) % 4; return k === 0 ? pal[4] : k === 1 ? pal[3] : k === 2 ? pal[2] : pal[1]; });
}
function corn(seed, sea) {
  const s = new Spr(16, 28), r = mkRng(seed); s.ellipseShadow(8, 25.5, 7, 2, 0.35);
  const pal = sea === 'fall' ? STRAW : sea === 'winter' ? [W[0], W[1], W[2]] : [L[1], L[2], L[3]];
  const tall = sea === 'spring' ? 9 : sea === 'winter' ? 7 : 22;
  for (const [x, back] of [[5, 1], [10, 1], [3, 0], [8, 0], [13, 0]]) {
    const h = tall - (back ? 2 : 0) - (r() * 3 | 0), top = 25 - h, c = back ? pal[0] : pal[1];
    for (let y = top; y <= 25; y++) s.set(x, y, c);
    for (let y = top + 3; y < 24; y += 4) { const sd = (y >> 2) % 2 ? 1 : -1; for (let k = 1; k <= 3; k++) s.set(x + sd * k, y + (k >> 1), back ? pal[0] : k === 1 ? pal[2] : pal[1]); }
    if (sea === 'summer' && !back) { s.set(x, top - 1, WHEAT[4]); s.set(x - 1, top, WHEAT[3]); s.set(x + 1, top, WHEAT[3]); }
    if ((sea === 'summer' || sea === 'fall') && !back) { rect(s, x + 1, top + 9, x + 2, top + 11, (px, py) => px === x + 1 ? WHEAT[4] : WHEAT[2]); s.set(x + 1, top + 12, pal[2]); }
    if (sea === 'winter') s.set(x, top, SNOW[2]);
  }
  return dress(s);
}
function fenceH() {
  const s = new Spr(16, 18);
  for (let x = 0; x < 16; x++) { s.shade(x, 16, 0.3); s.set(x, 7, W[3]); s.set(x, 8, W[1]); s.set(x, 11, W[3]); s.set(x, 12, W[1]); }
  rect(s, 1, 4, 2, 16, (x, y) => y === 4 ? W[4] : x === 1 ? W[3] : W[1]);
  return dress(s);
}
function fenceV() {
  const s = new Spr(16, 26);
  for (let y = 0; y < 26; y++) { s.set(7, y, W[3]); s.set(8, y, W[1]); s.shade(9, y + 2, 0.3); }
  rect(s, 6, 12, 9, 22, (x, y) => y === 12 ? W[4] : x === 6 ? W[3] : x === 9 ? W[0] : W[2]);
  return dress(s);
}
function fencePost() { const s = new Spr(16, 18); s.ellipseShadow(8, 16, 3, 1.2, 0.3); rect(s, 6, 4, 9, 16, (x, y) => y === 4 ? W[4] : x === 6 ? W[3] : x === 9 ? W[0] : W[2]); return dress(s); }

/* ---------- bridges ---------- */
function bridgeH(part) {
  const s = new Spr(16, 26);
  for (let x = 0; x < 16; x++) { s.shade(x, 24, 0.45); s.shade(x, 25, 0.25); }
  rect(s, 0, 10, 15, 21, (x, y) => { const k = x % 3; return k === 2 ? W[1] : hh(x, y >> 2, 301) < .12 ? W[2] : k === 0 ? W[3] : W[2]; });
  for (let x = 0; x < 16; x++) { s.set(x, 22, W[1]); s.set(x, 23, W[0]); }
  for (const bx of [3, 12]) { s.set(bx, 24, W[0]); s.set(bx, 25, W[0]); }
  for (let x = 0; x < 16; x++) { s.set(x, 4, W[4]); s.set(x, 5, W[2]); s.set(x, 17, W[4]); s.set(x, 18, W[2]); }
  for (const px of [1, 9]) { rect(s, px, 3, px + 1, 10, (x, y) => y === 3 ? W[4] : x === px ? W[3] : W[1]); rect(s, px, 16, px + 1, 23, (x, y) => y === 16 ? W[4] : x === px ? W[3] : W[1]); }
  if (part !== 'm') {
    const L0 = part === 'w' ? 0 : 11, L1 = part === 'w' ? 4 : 15;
    rect(s, L0, 8, L1, 25, (x, y) => { const row = (y - 8) >> 2, br = (y - 8) % 4 === 3 || (x + row * 2) % 5 === 0; return br ? RK[0] : y === 8 ? RK[4] : hh(x, y, 302) < .3 ? RK[1] : RK[2]; });
    const ep = part === 'w' ? 5 : 9;
    rect(s, ep, 1, ep + 1, 10, (x, y) => y === 1 ? W[4] : x === ep ? W[3] : W[0]); rect(s, ep, 14, ep + 1, 23, (x, y) => y === 14 ? W[4] : x === ep ? W[3] : W[0]);
  }
  return dress(s);
}
function bridgeV(part) {
  const s = new Spr(16, 20);
  for (let y = 4; y < 20; y++) { s.shade(15, y, 0.4); s.shade(14, y, 0.2); }
  rect(s, 3, 4, 12, 19, (x, y) => { const k = (y - 4) % 3; return k === 2 ? W[1] : hh(x >> 2, y, 311) < .12 ? W[2] : k === 0 ? W[3] : W[2]; });
  for (const [rx, c0, c1] of [[1, W[4], W[2]], [13, W[3], W[1]]]) {
    for (let y = 0; y < 20; y++) { s.set(rx, y, c0); s.set(rx + 1, y, c1); }
    for (const py of [2, 10, 18]) rect(s, rx, py - 2, rx + 1, py + 3, (x, y) => y === py - 2 ? W[4] : x === rx ? W[3] : W[0]);
  }
  if (part !== 'm') {
    const y0 = part === 'n' ? 4 : 15, y1 = part === 'n' ? 8 : 19;
    rect(s, 0, y0, 15, y1, (x, y) => { const br = (y - y0) % 3 === 2 || (x + (y >> 1) * 3) % 5 === 0; return br ? RK[0] : hh(x, y, 312) < .3 ? RK[1] : y === y0 ? RK[4] : RK[2]; });
  }
  return dress(s);
}

/* ---------- landmarks ---------- */
function silo() {
  const s = new Spr(32, 72);
  for (let y = 60; y <= 71; y++) for (let x = 1; x <= 31; x++) { const dx = (x + .5 - 17) / 15, dy = (y + .5 - 65) / 5; if (dx * dx + dy * dy <= 1) s.shade(x, y, 0.32); }
  const cyl = (cx, rx, y0, y1, seed) => {
    for (let y = y0; y <= y1 + 3; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + .5 - cx) / rx; if (Math.abs(dx) > 1) continue;
      if (y > y1 && ((y - y1) / 3) ** 2 + dx * dx > 1) continue;
      let i = dx < -0.55 ? 3 : dx < 0.05 ? 2 : dx < 0.6 ? 1 : 0;
      if (y % 3 === 0) i = Math.max(0, i - 1);
      let c = M[i]; if ((y - y0) % 12 === 11) c = M[0];
      if (hh(x >> 1, y >> 2, seed) < 0.12 && hh(x, y, seed + 1) < 0.7) c = hh(x, y, seed + 2) < .5 ? X[2] : X[3];
      s.set(x, y, c);
    }
  };
  cyl(26, 5, 38, 62, 331);
  for (let y = 31; y <= 38; y++) { const hw = Math.round((y - 31) * 0.7) + 1; for (let x = 26 - hw; x <= 26 + hw; x++) s.set(x, y, x < 26 ? M[3] : M[1]); }
  cyl(12, 10, 14, 61, 332);
  for (let y = 6; y <= 14; y++) for (let x = 2; x <= 22; x++) { const dx = (x + .5 - 12) / 10, dy = (y + .5 - 14.5) / 8.5; if (dx * dx + dy * dy <= 1) s.set(x, y, dx + dy < -0.6 ? M[3] : dx < 0.2 ? M[2] : M[1]); }
  rect(s, 11, 3, 13, 6, (x, y) => y === 3 ? M[3] : M[1]);
  for (let y = 12; y <= 62; y++) { s.set(19, y, M[0]); s.set(21, y, M[0]); if (y % 2 === 0) s.set(20, y, M[3]); }
  s.line(24, 32, 14, 7, (x, y) => { s.set(x, y, M[1]); s.set(x, y + 1, M[0]); });
  rect(s, 8, 52, 13, 61, (x, y) => x === 8 || y === 52 ? W[0] : (y - 52) % 3 === 2 ? W[1] : W[2]);
  return dress(s);
}
function motel() {
  const s = new Spr(80, 50);
  shadeRect(s, 5, 44, 79, 49, 0.32);
  rect(s, 3, 22, 76, 43, (x, y) => y < 30 ? plaster(x, y) : ((y - 30) % 3 === 2 || (x + ((y - 30) / 3 | 0) % 2 * 3) % 6 === 0 ? '#5f5d50' : hh(x, y, 341) < .2 ? B[1] : B[2]));
  rect(s, 1, 16, 78, 21, (x, y) => y === 16 ? CON[4] : y === 17 ? CON[3] : y === 21 ? CON[0] : CON[2]);
  for (let x = 3; x <= 76; x++) { s.set(x, 22, dk(s.get(x, 22), 0.45)); s.set(x, 23, dk(s.get(x, 23), 0.3)); }
  const DC = [['#2e4a44', '#3a5a50', '#4a7266'], ['#5a2a1e', '#7a3a28', '#944a34']];
  for (let i = 0; i < 5; i++) {
    const x = 6 + i * 14;
    if (i === 3) { rect(s, x, 31, x + 5, 43, '#16140f'); rect(s, x - 1, 30, x + 6, 30, B[0]); }
    else door(s, x, 31, 6, 13, DC[i % 2]);
    win(s, x + 8, 32, 5, 5, i === 1);
    s.set(x + 2, 29, '#c4a24a'); s.set(x + 3, 29, '#c4a24a');
  }
  for (const px of [52, 74]) rect(s, px, 11, px + 1, 16, M[1]);
  rect(s, 46, 1, 78, 11, (x, y) => x === 46 || x === 78 || y === 1 || y === 11 ? M[0] : y === 2 ? '#dfe2d0' : '#b8bcaa');
  text(s, 'MOTEL', 62, 4, RED[2], 8, null, 'c');
  for (const [x, y] of [[53, 4], [54, 5], [67, 8]]) s.set(x, y, '#8a8f80');
  rect(s, 0, 36, 2, 44, (x, y) => y === 36 ? RED[3] : x === 0 ? RED[2] : RED[1]);
  return dress(s);
}
function lighthouse() {
  const s = new Spr(32, 88);
  for (let y = 78; y <= 87; y++) for (let x = 1; x <= 31; x++) { const dx = (x + .5 - 17) / 14, dy = (y + .5 - 83) / 4.5; if (dx * dx + dy * dy <= 1) s.shade(x, y, 0.35); }
  blob(s, 16, 78, 14, 7, RK, 351); blob(s, 7, 81, 6, 4, RK, 352); blob(s, 26, 81, 5, 3.5, RK, 353);
  for (let y = 22; y <= 74; y++) {
    const t = (y - 22) / 52, hw = 5 + t * 3.5, band = Math.floor((y - 22) / 9) % 2;
    for (let x = Math.floor(15.5 - hw); x <= 15.5 + hw; x++) {
      const dx = (x + .5 - 15.5) / hw, P2 = band ? RED : ['#6e7166', CARD[0], CARD[1], CARD[2]];
      s.set(x, y, P2[dx < -0.5 ? 3 : dx < 0.1 ? 2 : dx < 0.6 ? 1 : 0]);
    }
  }
  rect(s, 14, 66, 17, 74, (x, y) => y === 66 ? W[0] : '#16140f');
  for (const wy of [38, 52]) rect(s, 15, wy, 16, wy + 2, GL[0]);
  rect(s, 8, 20, 23, 22, (x, y) => y === 20 ? M[3] : y === 21 ? M[1] : M[0]);
  for (let x = 8; x <= 23; x += 2) { s.set(x, 18, M[2]); s.set(x, 19, M[1]); } for (let x = 8; x <= 23; x++) s.set(x, 17, M[2]);
  rect(s, 11, 10, 20, 17, (x, y) => x === 11 || x === 20 || x === 15 || y === 10 ? M[0] : y < 13 ? GL[2] : GL[1]);
  rect(s, 13, 12, 18, 15, (x, y) => (x + y) % 2 ? '#e6c874' : '#f4ecc4');
  for (let y = 4; y <= 9; y++) { const hw = Math.round((y - 4) * 1.1) + 1; for (let x = 15 - hw; x <= 16 + hw; x++) s.set(x, y, x <= 15 ? RED[2] : RED[1]); }
  rect(s, 15, 1, 16, 3, M[2]);
  return dress(s);
}

/* ---------- nature ---------- */
function willow(seed) {
  const s = new Spr(36, 42); s.ellipseShadow(18, 39, 12, 2.6, 0.4);
  for (let y = 16; y <= 39; y++) for (let x = 16; x <= 19; x++) s.set(x, y, x === 16 ? W[3] : x === 19 ? W[1] : W[2]);
  s.set(15, 39, W[1]); s.set(20, 39, W[1]);
  for (const [cx, cy, rx, ry] of [[10, 15, 7, 6], [26, 15, 7, 6], [18, 11, 12, 8]]) blob(s, cx, cy, rx, ry, L, seed + cx, 0.1);
  for (let x = 4; x <= 31; x++) {
    let bot = -1; for (let y = 0; y < 26; y++) if (s.get(x, y)) bot = y; if (bot < 0) continue;
    const len = 7 + (hh(x, 0, seed) * 12 | 0) - Math.round(Math.abs(x - 18) * 0.25);
    for (let y = bot + 1; y <= Math.min(38, bot + len); y++) if (x % 2 === 0 || y < bot + len - 4) s.set(x, y, (y + x) % 5 === 0 ? L[1] : x % 2 ? L[2] : L[3]);
  }
  return dress(s);
}
function sapling(seed) {
  const s = new Spr(14, 22); s.ellipseShadow(7, 20, 4, 1.4, 0.35);
  for (let y = 9; y <= 20; y++) s.set(7, y, W[2]); s.set(6, 20, W[1]);
  s.line(7, 13, 10, 10, (x, y) => s.set(x, y, W[2]));
  blob(s, 7, 7, 5, 5, L, seed, 0.25); blob(s, 10, 10, 3, 2.5, L, seed + 1, 0.25);
  return dress(s);
}
function bramble(seed, sea) {
  const s = new Spr(22, 16), r = mkRng(seed); s.ellipseShadow(11, 13, 10, 2.4, 0.35);
  blob(s, 11, 9, 9, 5, G, seed, 0.35);
  const V = ['#3a2228', '#553038'];
  for (let i = 0; i < 6; i++) { let x = 2 + r() * 18, y = 4 + r() * 8; const dx = r() < .5 ? 1 : -1; for (let k = 0; k < 7; k++) { s.set(x, y, V[k % 2]); if (k % 3 === 1) s.set(x, y - 1, '#8a6a58'); x += dx; y += Math.sin(k + i) > 0 ? 1 : -1; } }
  const bc = sea === 'spring' ? ['#e8e6dc', '#e8e6dc'] : sea === 'summer' ? ['#2a1a30', '#4a2a50'] : sea === 'fall' ? ['#7a2e24', '#a8453a'] : null;
  if (bc) for (let i = 0; i < 7; i++) { const x = 3 + r() * 16 | 0, y = 4 + r() * 8 | 0; if (s.get(x, y)) { s.set(x, y, bc[1]); s.set(x + 1, y + 1, bc[0]); } }
  return dress(s);
}
function lilypads(seed, sea) {
  const s = new Spr(16, 16); if (sea === 'winter') return s;
  const r = mkRng(seed);
  for (const [cx, cy, rr] of [[4.5, 5, 2.6], [11, 8, 3.2], [6, 12, 2.2]]) {
    for (let y = Math.floor(cy - rr); y <= cy + rr; y++) for (let x = Math.floor(cx - rr); x <= cx + rr; x++) {
      const dx = x + .5 - cx, dy = y + .5 - cy; if (dx * dx + dy * dy > rr * rr) continue;
      if (dx > 0 && Math.abs(dy) < 0.8) continue;
      s.set(x, y, dy < -rr * 0.3 ? G[4] : dx + dy < 0 ? G[3] : G[2]); if (dy > rr * 0.5) s.shade(x, y + 1, 0.3);
    }
  }
  if (sea !== 'fall') { s.set(11, 7, sea === 'spring' ? '#d9a3b2' : '#e8e6dc'); s.set(12, 7, '#e8e6dc'); s.set(11, 6, '#e8e6dc'); s.set(12, 8, '#c9b452'); }
  return s;
}
function driftwood(seed) {
  const s = new Spr(26, 10); s.ellipseShadow(13, 7.5, 12, 2, 0.3);
  for (let x = 2; x <= 23; x++) { const y0 = 3 + Math.round(Math.sin(x * 0.35) * 0.6); s.set(x, y0, DW[4]); s.set(x, y0 + 1, hh(x, 1, seed) < .3 ? DW[2] : DW[3]); s.set(x, y0 + 2, DW[2]); s.set(x, y0 + 3, DW[1]); }
  s.line(8, 3, 6, 0, (x, y) => s.set(x, y, DW[3])); s.line(18, 4, 21, 1, (x, y) => s.set(x, y, DW[3]));
  s.set(23, 4, DW[1]); s.set(23, 5, DW[0]); s.set(2, 5, DW[1]);
  return dress(s);
}

/* ---------- build ---------- */
const CORN = ['nw', 'ne', 'sw', 'se'], EDGES = ['n', 'e', 's', 'w'];
export function buildWorld2(T) {
  const A = {};
  for (const sea of SEASON_NAMES) {
    const sf = sea === 'summer' ? '' : '_' + sea, gr = T['grass_a' + sf], win_ = sea === 'winter';
    withSeason(sea, () => {
      const O = {};
      const wf = [0, 1, 2].map(f => water(f, win_)); O.water_a = wf[0];
      const strip = new Spr(48, 16); wf.forEach((w, i) => strip.blit(w, i * 16, 0)); O.water_anim = strip; wf.forEach((w, i) => O['set_water_f' + i] = w);
      for (const d of EDGES) { O['shore_' + d] = shore(gr, 'edge', d, win_); O['over_' + d] = grassOver(gr, 'edge', d); }
      for (const d of CORN) { O['shore_out_' + d] = shore(gr, 'out', d, win_); O['shore_in_' + d] = shore(gr, 'in', d, win_); O['over_out_' + d] = grassOver(gr, 'out', d); O['over_in_' + d] = grassOver(gr, 'in', d); }
      O.forest_a = forest(401, 'a', sea); O.forest_b = forest(402, 'b', sea);
      O.swamp_mud = swampMud(403, sea); O.swamp_water = swampWater(404, sea);
      O.rocky_a = rocky(405, 'a', sea); O.rocky_b = rocky(406, 'b', sea);
      O.street_h = street(411, 'h', sea); O.street_v = street(412, 'v', sea); O.street_x = street(413, 'x', sea); O.street_crack = street(414, 'crack', sea); O.street_cross_h = street(415, 'cross', sea);
      O.sidewalk = sidewalk(416, sea); for (const d of EDGES) O['curb_' + d] = curb(O.sidewalk, O.street_x, d);
      O.lot_rubble = rubbleLot(417, sea);
      O.field_tilled_h = tilled(421, 'h', sea); O.field_tilled_v = tilled(422, 'v', sea); O.field_wheat = wheat(423, sea);
      O.bridge_h_w = bridgeH('w'); O.bridge_h_m = bridgeH('m'); O.bridge_h_e = bridgeH('e');
      O.bridge_v_n = bridgeV('n'); O.bridge_v_m = bridgeV('m'); O.bridge_v_s = bridgeV('s');
      O.deco_ruin_wall = ruinWall(431); O.deco_corn = corn(432, sea); O.fence_rail_h = fenceH(); O.fence_rail_v = fenceV(); O.fence_rail_post = fencePost();
      O.wld_silo = silo(); O.wld_motel = motel(); O.wld_lighthouse = lighthouse();
      O.nat_s2_willow = willow(441); O.nat_s2_sapling = sapling(442); O.nat_s2_bramble = bramble(443, sea); O.nat_s2_lilypads = lilypads(444, sea); O.nat_s2_driftwood = driftwood(445);
      for (const k in O) A[k + sf] = O[k];
    });
  }
  return A;
}

/* ---------- world scene ---------- */
export function makeWorldScene(m, A, sea) {
  const sf = sea === 'summer' ? '' : '_' + sea, TW = 26, TH = 15, g = (k) => A[k + sf], r = mkRng(21);
  const map = Array.from({ length: TH }, () => Array(TW).fill('g'));
  const fill = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) map[y][x] = c; };
  fill(0, 0, 4, 4, 'w'); fill(0, 9, 5, 13, 't'); fill(0, 7, 7, 7, 'r');
  fill(11, 5, 25, 5, 'p'); fill(11, 6, 25, 6, 'cn'); fill(11, 7, 25, 7, 'a'); fill(11, 8, 25, 8, 'cs'); fill(11, 9, 25, 9, 'p');
  fill(19, 2, 22, 4, 'l'); fill(11, 11, 14, 14, 'k'); fill(15, 12, 18, 14, 's'); fill(16, 13, 17, 14, 'S'); fill(19, 11, 25, 14, 'f'); fill(20, 10, 25, 10, 'f');
  const BL = 'wtlksSf', isG = (x, y) => x < 0 || y < 0 || x >= TW || y >= TH ? false : map[y][x] === 'g';
  const gk = ['grass_a', 'grass_a', 'grass_b', 'grass_c'];
  const cells = [];
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const c = map[y][x], v = r();
    let k = c === 'g' ? gk[v * 4 | 0] : c === 'w' ? 'field_wheat' : c === 't' ? 'field_tilled_h' : c === 'r' ? 'road_h' : c === 'p' ? 'sidewalk' : c === 'cn' ? 'curb_n' : c === 'cs' ? 'curb_s'
      : c === 'a' ? (x === 22 ? 'street_cross_h' : v < 0.22 ? 'street_crack' : 'street_h') : c === 'l' ? 'lot_rubble' : c === 'k' ? (v < .5 ? 'rocky_a' : 'rocky_b') : c === 's' ? 'swamp_mud' : c === 'S' ? 'swamp_water' : c === 'f' ? (v < .5 ? 'forest_a' : 'forest_b') : 'grass_a';
    if (x === 8) k = 'shore_w'; else if (x === 9) k = 'water'; else if (x === 10) k = 'shore_e';
    const ov = [];
    if (BL.includes(c) && x !== 8 && x !== 9 && x !== 10) {
      const n = isG(x, y - 1), s = isG(x, y + 1), w = isG(x - 1, y), e = isG(x + 1, y);
      if (n && w) ov.push('over_out_nw'); if (n && e) ov.push('over_out_ne'); if (s && w) ov.push('over_out_sw'); if (s && e) ov.push('over_out_se');
      if (n && !w && !e) ov.push('over_n'); if (s && !w && !e) ov.push('over_s'); if (w && !n && !s) ov.push('over_w'); if (e && !n && !s) ov.push('over_e');
      if (!n && !w && isG(x - 1, y - 1)) ov.push('over_in_nw'); if (!n && !e && isG(x + 1, y - 1)) ov.push('over_in_ne');
      if (!s && !w && isG(x - 1, y + 1)) ov.push('over_in_sw'); if (!s && !e && isG(x + 1, y + 1)) ov.push('over_in_se');
    }
    cells.push({ x, y, k, ov });
  }
  const O = [['wld_silo', 80, 96], ['wld_motel', 190, 80], ['deco_ruin_wall', 312, 66], ['nat_s2_sapling', 344, 44], ['deco_corn', 96, 164], ['deco_corn', 96, 184], ['deco_corn', 96, 204],
    ['nat_s2_willow', 94, 236], ['nat_s2_driftwood', 132, 206], ['nat_s2_outcrop', 182, 206], ['deco_boulder', 212, 228], ['tree_dead', 244, 206], ['nat_s2_cattails', 240, 236], ['nat_s2_bramble', 296, 170],
    ['tree_pine', 306, 196], ['tree_pine', 344, 214], ['nat_s2_birch', 372, 190], ['tree_pine', 390, 236], ['tree_oak', 330, 244], ['nat_s2_birch', 128, 60], ['tree_oak', 360, 102], ['deco_streetlight', 250, 88], ['deco_streetlight', 330, 88], ['deco_car', 270, 124]]
    .map(([k, x, b]) => ({ s: g(k), x, b })).filter(o => o.s);
  for (let x = 0; x <= 6; x++) O.push({ s: g('fence_rail_h'), x: x * 16, b: 8 * 16 + 16 });
  O.push({ s: g('bridge_h_w'), x: 128, b: 128 + 2 }, { s: g('bridge_h_m'), x: 144, b: 128 + 2 }, { s: g('bridge_h_e'), x: 160, b: 128 + 2 });
  O.sort((a, b) => a.b - b.b);
  const frames = [0, 1, 2].map(f => {
    const s = new Spr(TW * 16, TH * 16);
    for (const c of cells) { const t = c.k === 'water' ? A['set_water_f' + f + sf] : g(c.k); if (t) s.blit(t, c.x * 16, c.y * 16); for (const o of c.ov) s.blit(g(o), c.x * 16, c.y * 16); }
    const lp = g('nat_s2_lilypads'); if (lp) { s.blit(lp, 144, 32); s.blit(lp, 144, 176); }
    for (const o of O) s.blit(o.s, o.x, o.b - o.s.h);
    const cv = document.createElement('canvas'); m.draw(cv, s, 'day'); return cv;
  });
  return { render(cv, t) { if (cv.width !== TW * 16) { cv.width = TW * 16; cv.height = TH * 16; } const x = cv.getContext('2d'); x.drawImage(frames[Math.floor(t * 3) % 3], 0, 0); } };
}
