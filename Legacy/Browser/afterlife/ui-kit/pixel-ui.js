// Pixel-art HUD / UI generator. Shares palette + sprite core with the tileset.
import { Spr, OL, W, M, D, G, scene, buildAll } from './pixel-assets-v2.js';
import { buildBuildings } from './pixel-buildings.js';

const T = { txt: '#d6d8c6', mut: '#8b8f78', lime: '#c5d48a', red: '#d0694f', amb: '#d4a24a', ink: '#1a1e14', sh: '#0b0d09' };
const RP = {
  wood: ['#7a6444', '#9a8157', '#c2a878'], wood2: ['#5a4832', '#7a6444', '#9a8157'], end: ['#9a8157', '#c9b08a', '#e0caa0'],
  metal: ['#55605a', '#7f8b84', '#aab5ad'], steel: ['#3a423d', '#55605a', '#7f8b84'],
  red: ['#7a2e24', '#a8453a', '#cf6a55'], amber: ['#8a6a2a', '#c4a24a', '#e6c874'], lime: ['#6f7d45', '#a3b56a', '#cfe08e'],
  skin: ['#8a5e44', '#b58462', '#d6a882'], skin2: ['#5e3e2c', '#7e5638', '#a0724e'], skin3: ['#a87a5a', '#cfa07c', '#ecc6a0'],
  jacket: ['#3e4a32', '#566645', '#728558'], jacket2: ['#4a3a2c', '#6a5440', '#8a7058'], jacket3: ['#3a4452', '#52607a', '#6e7e98'],
  zg: ['#4a5c3a', '#6f8a52', '#93ad6e'], cloth: ['#8a8f80', '#b8bcaa', '#dfe2d0'], blue: ['#3a4a66', '#56698c', '#8398b8'],
  moon: ['#7a86a0', '#b4bed2', '#e2e8f2'], tan: ['#8a7a58', '#b0a078', '#d2c49a'], tan2: ['#7a6c4c', '#978a66', '#b8aa82'],
  dark: ['#23281e', '#2e3527', '#3d4633'], hairB: ['#1e1a16', '#2e2822', '#443a30'], hairR: ['#5a2e1c', '#7e4428', '#a05c38'],
  hairG: ['#5e5a52', '#848076', '#aaa698'], rope: ['#6f6040', '#9a875a', '#bca97a']
};

/* ---------- text (Silkscreen rasterized to the pixel grid) ---------- */
const tc = document.createElement('canvas'); tc.width = 512; tc.height = 40;
const tx = tc.getContext('2d', { willReadFrequently: true });
const off = {};
function raster(str, size) {
  tx.clearRect(0, 0, 512, 40); tx.font = `${size}px Silkscreen`; tx.textBaseline = 'top'; tx.fillStyle = '#fff'; tx.fillText(str, 0, 0);
  const w = Math.min(512, Math.ceil(tx.measureText(str).width) + 2), h = size + 6, d = tx.getImageData(0, 0, w, h).data, px = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (d[(j * w + i) * 4 + 3] > 110) px.push([i, j]);
  return { px, w: Math.ceil(tx.measureText(str).width) };
}
function capOff(size) { if (off[size] == null) { const r = raster('H', size); off[size] = r.px.length ? Math.min(...r.px.map(p => p[1])) : 0; } return off[size]; }
export const measure = (str, size = 8) => { tx.font = `${size}px Silkscreen`; return Math.ceil(tx.measureText(str).width) - (size === 8 ? 1 : 2); };
function text(s, str, x, y, col, size = 8, shadow = T.sh, align = 'l') {
  const o = capOff(size), r = raster(str, size), w = measure(str, size);
  if (align === 'r') x -= w; else if (align === 'c') x -= Math.floor(w / 2);
  if (shadow) for (const [i, j] of r.px) s.set(x + i, y + j - o + (size === 8 ? 1 : 2), shadow);
  for (const [i, j] of r.px) s.set(x + i, y + j - o, col);
  return w;
}

/* ---------- colour helpers ---------- */
const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };
const mute = c => { const [r, g, b] = rgb(c), l = r * .3 + g * .59 + b * .11; return hex([l * .55 + 10, l * .58 + 12, l * .5 + 8]); };
function mapSpr(src, fn) { const s = new Spr(src.w, src.h); for (let i = 0; i < src.p.length; i++) { s.sh[i] = src.sh[i]; const y = (i / src.w) | 0, x = i % src.w; if (src.p[i]) s.p[i] = fn(src.p[i], x, y); } return s; }

/* ---------- frames (9-slice sources, 8px corners) ---------- */
const FR = {
  panel: { o: OL, hi: '#4a5440', lo: '#232820', f: '#1d2119', rivet: 1 },
  inset: { o: OL, hi: '#0e100c', lo: '#343c2d', f: '#12150f' },
  btn: { o: OL, hi: '#5a664c', lo: '#262c20', f: '#343c2c', drop: '#161a12' },
  hover: { o: OL, hi: '#76845f', lo: '#2e3526', f: '#434d38', drop: '#161a12' },
  down: { o: OL, hi: '#1c2018', lo: '#3a4332', f: '#2b3224', press: 1 },
  off: { o: '#1e221a', hi: '#2c3226', lo: '#20241c', f: '#262b21' },
  primary: { o: OL, hi: '#e0eab0', lo: '#8a9a56', f: '#b7c67e', drop: '#5a6636' },
  primaryDown: { o: OL, hi: '#7c8b4c', lo: '#a6b56e', f: '#a0af6a', press: 1 },
  alert: { o: OL, hi: '#a4513f', lo: '#3e1c16', f: '#2a1b16', rivet: 1 },
  select: { o: '#c5d48a', hi: '#6f7d45', lo: '#1e231a', f: '#1d2119' },
  owned: { o: OL, hi: '#6f7d45', lo: '#1a1f15', f: '#252c1d' },
  research: { o: OL, hi: '#c4a24a', lo: '#2a2414', f: '#2a2718' },
  maxed: { o: '#e6c874', hi: '#c4a24a', lo: '#4a3a1a', f: '#322b18' }
};
export function frame(w, h, kind) {
  const k = FR[kind], s = new Spr(w, h), y0 = k.press ? 1 : 0;
  for (let y = y0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = x === 0 || x === w - 1, cy = y === y0 || y === h - 1; if (cx && cy) continue;
    let c = k.f;
    if (cx || cy) c = k.o;
    else if (k.drop && y >= h - 3) c = k.drop;
    else if (y === y0 + 1 || x === 1) c = k.hi;
    else if (x === w - 2 || y === h - 2) c = k.lo;
    s.set(x, y, c);
  }
  if (k.rivet) for (const [x, y] of [[3, 3], [w - 5, 3], [3, h - 5], [w - 5, h - 5]]) { s.set(x, y, '#6a7560'); s.set(x + 1, y, '#4a5440'); s.set(x, y + 1, '#4a5440'); s.set(x + 1, y + 1, '#141711'); }
  return s;
}

/* ---------- icon builder: flat parts, auto-bevel, outline, drop shadow ---------- */
class Ico extends Spr {
  constructor(w = 24, h = 24) { super(w, h); this.pid = new Int16Array(w * h); this.rp = new Array(w * h).fill(null); this.dt = []; }
  put(x, y, r, id) { x = Math.floor(x); y = Math.floor(y); if (!this.in(x, y)) return; const i = y * this.w + x; this.p[i] = r[1]; this.rp[i] = r; this.pid[i] = id; }
  rect(x, y, w, h, r, id) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.put(i, j, r, id); return this; }
  disc(cx, cy, rad, r, id) { for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) if ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= rad * rad) this.put(x, y, r, id); return this; }
  poly(pts, r, id) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) {
      const px = x + .5, py = y + .5; let ins = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) ins = !ins; }
      if (ins) this.put(x, y, r, id);
    }
    return this;
  }
  seg(x0, y0, x1, y1, wd, r, id) {
    const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1, h = wd / 2;
    for (let y = Math.floor(Math.min(y0, y1) - h); y <= Math.max(y0, y1) + h; y++) for (let x = Math.floor(Math.min(x0, x1) - h); x <= Math.max(x0, x1) + h; x++) {
      const px = x + .5, py = y + .5, t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L));
      if ((px - x0 - t * dx) ** 2 + (py - y0 - t * dy) ** 2 <= h * h) this.put(x, y, r, id);
    }
    return this;
  }
  cut(fn) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const i = y * this.w + x; if (this.p[i] && fn(x, y, this.pid[i])) { this.p[i] = null; this.rp[i] = null; this.pid[i] = 0; } } return this; }
  cutDisc(cx, cy, rad) { return this.cut((x, y) => (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= rad * rad); }
  dot(x, y, c) { this.dt.push([x, y, c]); return this; }
  dots(list, c) { list.forEach(([x, y]) => this.dt.push([x, y, c])); return this; }
  finish(shadow = true) {
    const w = this.w, src = this.p.slice(), pid = this.pid;
    const E = (x, y, id) => !this.in(x, y) || !src[y * w + x] || pid[y * w + x] !== id;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, r = this.rp[i]; if (!r) continue; const id = pid[i];
      if (E(x, y - 1, id) || E(x - 1, y, id)) this.p[i] = r[2]; else if (E(x, y + 1, id) || E(x + 1, y, id)) this.p[i] = r[0];
    }
    this.dt.forEach(([x, y, c]) => this.set(x, y, c));
    this.outline(OL);
    if (shadow) { const q = this.p.slice(); for (let y = 1; y < this.h; y++) for (let x = 1; x < w; x++) if (!q[y * w + x] && q[(y - 1) * w + x - 1]) this.shade(x, y, 0.45); }
    return this;
  }
}
const K = '#1a1e16';

const ICONS = {
  wood: () => { const s = new Ico(); s.rect(6, 5, 12, 6, RP.wood, 1).disc(18, 8, 3.2, RP.end, 2).rect(3, 12, 14, 6, RP.wood, 3).disc(17, 15, 3.2, RP.end, 4); return s.dots([[18, 8], [17, 15], [9, 7], [12, 9], [6, 14], [11, 16]], W[1]); },
  metal: () => { const s = new Ico(), pts = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; pts.push([12 + Math.cos(a) * 9.5, 12 + Math.sin(a) * 9.5]); } return s.poly(pts, RP.metal, 1).cutDisc(12, 12, 3.3); },
  food: () => { const s = new Ico(); s.rect(6, 7, 12, 13, RP.metal, 1); for (let y = 4; y <= 9; y++) for (let x = 5; x <= 18; x++) if (((x + .5 - 12) / 6) ** 2 + ((y + .5 - 7) / 2.6) ** 2 <= 1) s.put(x, y, RP.cloth, 2); s.rect(6, 11, 12, 6, RP.red, 3).rect(10, 12, 4, 4, RP.amber, 4); return s.dots([[9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6]], '#7f8b84'); },
  survivor: () => { const s = new Ico(); s.poly([[3, 22], [4, 16], [8, 14], [16, 14], [20, 16], [21, 22]], RP.jacket, 1).disc(12, 9, 4.6, RP.skin, 2).rect(7, 4, 10, 3, RP.hairB, 3).rect(7, 7, 1, 2, RP.hairB, 3).rect(16, 7, 1, 2, RP.hairB, 3); return s.dots([[10, 9], [14, 9]], K).dots([[12, 15], [12, 16], [12, 17]], '#3e4a32'); },
  build: () => { const s = new Ico(); s.seg(5, 20, 14, 11, 3, RP.wood, 1).seg(10, 6, 19, 15, 5, RP.metal, 2); return s.dots([[12, 10], [13, 11], [14, 12]], '#55605a'); },
  alarm: () => { const s = new Ico(); s.disc(12, 10, 6, RP.amber, 1).rect(6, 10, 12, 6, RP.amber, 1).rect(4, 16, 16, 2, RP.amber, 1).disc(12, 3.5, 1.6, RP.amber, 1).disc(12, 19.5, 1.8, RP.metal, 2); return s.dots([[2, 7], [2, 8], [21, 7], [21, 8], [1, 10], [22, 10]], T.amb); },
  map: () => { const s = new Ico(); s.poly([[3, 6], [9, 4], [9, 19], [3, 21]], RP.tan, 1).poly([[9, 4], [15, 6], [15, 21], [9, 19]], RP.tan2, 2).poly([[15, 6], [21, 4], [21, 19], [15, 21]], RP.tan, 3); return s.dots([[5, 16], [7, 14], [9, 13], [11, 12], [13, 11]], '#a8453a').dots([[17, 8], [19, 8], [18, 9], [17, 10], [19, 10]], '#a8453a'); },
  base: () => { const s = new Ico(); s.rect(16, 4, 3, 6, RP.steel, 4).rect(5, 11, 14, 9, RP.wood, 1).poly([[12, 2], [2, 12], [22, 12]], RP.red, 2).rect(10, 14, 4, 6, RP.dark, 3); return s.dots([[7, 14], [8, 14], [7, 15], [8, 15], [16, 14], [17, 14], [16, 15], [17, 15]], '#8398b8'); },
  menu: () => new Ico().rect(4, 5, 16, 3, RP.cloth, 1).rect(4, 11, 16, 3, RP.cloth, 2).rect(4, 17, 16, 3, RP.cloth, 3),
  expedition: () => { const s = new Ico(); s.rect(5, 19, 8, 2, RP.tan2, 3).seg(7.5, 3, 7.5, 20, 2, RP.wood, 1).poly([[9, 3], [21, 7.5], [9, 12]], RP.lime, 2); return s; },
  wall: () => { const s = new Ico(); for (let i = 0; i < 4; i++) { const x = 3 + i * 5; s.rect(x, 8, 4, 12, RP.wood, i + 1).poly([[x, 8], [x + 2, 3], [x + 4, 8]], RP.wood, i + 1); } return s.rect(2, 14, 20, 2, RP.rope, 9); },
  gate: () => { const s = new Ico(); s.rect(2, 4, 4, 17, RP.wood, 1).rect(18, 4, 4, 17, RP.wood, 2).rect(6, 7, 6, 13, RP.wood2, 3).rect(12, 7, 6, 13, RP.wood2, 4).rect(6, 10, 12, 2, RP.metal, 5).rect(6, 16, 12, 2, RP.metal, 5); return s.dots([[7, 15], [8, 14], [9, 13], [10, 12], [16, 15], [15, 14], [14, 13], [13, 12]], W[3]); },
  tower: () => { const s = new Ico(); s.seg(6, 13, 4, 21, 2, RP.wood, 3).seg(18, 13, 20, 21, 2, RP.wood, 4).seg(6, 15, 18, 20, 1, RP.wood2, 6).seg(18, 15, 6, 20, 1, RP.wood2, 6).rect(5, 8, 2, 4, RP.wood, 5).rect(17, 8, 2, 4, RP.wood, 5).rect(3, 11, 18, 3, RP.wood, 2).poly([[2, 8], [12, 2], [22, 8]], RP.steel, 1); return s; },
  repair: () => { const s = new Ico(); s.seg(5, 19, 13, 11, 3.5, RP.metal, 1).disc(16, 8, 5, RP.metal, 1).cutDisc(19, 5, 2.6).cutDisc(5, 19, 0.8); return s; },
  demolish: () => new Ico().seg(5, 5, 19, 19, 4.2, RP.red, 1).seg(19, 5, 5, 19, 4.2, RP.red, 2),
  zombie: () => { const s = new Ico(); s.disc(12, 10, 7, RP.zg, 1).rect(7, 13, 10, 6, RP.zg, 1).cut((x, y) => x >= 18 && y >= 6 && y <= 8); s.dots([[8, 10], [9, 10], [8, 11], [9, 11], [14, 10], [15, 10], [14, 11], [15, 11]], K).dots([[9, 10], [14, 10]], '#c65a44'); s.dots([[9, 16], [11, 16], [13, 16], [15, 16], [10, 15], [12, 17], [14, 15]], K); return s.dots([[10, 4], [11, 3], [14, 4], [6, 7]], '#2e3a22'); },
  health: () => new Ico().disc(8.5, 9, 4.8, RP.red, 1).disc(15.5, 9, 4.8, RP.red, 1).poly([[3.8, 10.5], [20.2, 10.5], [12, 20]], RP.red, 1).dots([[7, 7], [8, 7], [7, 8]], '#f0a090'),
  integrity: () => new Ico().poly([[4, 3], [20, 3], [20, 11], [12, 21], [4, 11]], RP.steel, 1).poly([[7, 6], [17, 6], [17, 11], [12, 17], [7, 11]], RP.lime, 2),
  bed: () => new Ico().rect(3, 7, 3, 13, RP.wood, 1).rect(3, 13, 18, 4, RP.wood, 1).rect(19, 17, 2, 3, RP.wood, 1).rect(6, 11, 15, 3, RP.cloth, 2).rect(6, 9, 5, 3, RP.cloth, 3).rect(11, 10, 10, 4, RP.jacket, 4),
  day: () => { const s = new Ico(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; s.seg(12 + Math.cos(a) * 7.5, 12 + Math.sin(a) * 7.5, 12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10, 2, RP.amber, 2); } return s.disc(12, 12, 5.5, RP.amber, 1); },
  night: () => new Ico().disc(11, 12, 8, RP.moon, 1).cutDisc(16, 8, 6.5).dots([[19, 16], [21, 5], [17, 20]], '#e2e8f2'),
  warning: () => new Ico().poly([[12, 2], [22.5, 20.5], [1.5, 20.5]], RP.amber, 1).dots([[11, 8], [12, 8], [11, 9], [12, 9], [11, 10], [12, 10], [11, 11], [12, 11], [11, 12], [12, 12], [11, 15], [12, 15], [11, 16], [12, 16]], K),
  pause: () => new Ico().rect(6, 5, 4, 14, RP.cloth, 1).rect(14, 5, 4, 14, RP.cloth, 2),
  play: () => new Ico().poly([[7, 4], [19, 12], [7, 20]], RP.cloth, 1),
  fast: () => new Ico().poly([[3, 6], [12, 12], [3, 18]], RP.cloth, 1).poly([[12, 6], [21, 12], [12, 18]], RP.cloth, 2),
  settings: () => { const s = new Ico(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; s.disc(12 + Math.cos(a) * 7.5, 12 + Math.sin(a) * 7.5, 2.2, RP.metal, 1); } return s.disc(12, 12, 7, RP.metal, 1).cutDisc(12, 12, 2.6); },
  save: () => new Ico().rect(4, 4, 16, 16, RP.blue, 1).rect(8, 4, 8, 5, RP.metal, 2).rect(7, 13, 10, 6, RP.cloth, 3).dots([[13, 5], [13, 6], [13, 7]], '#3a423d')
};
const starPts = (cx, cy, R, r) => { const p = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, d = k % 2 ? r : R; p.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]); } return p; };
Object.assign(ICONS, {
  research: () => new Ico().rect(10, 3, 4, 7, RP.cloth, 1).poly([[9.5, 9], [14.5, 9], [20.5, 19], [19, 21], [5, 21], [3.5, 19]], RP.cloth, 2).poly([[7.2, 14], [16.8, 14], [20.5, 19], [19, 21], [5, 21], [3.5, 19]], RP.lime, 3).rect(9, 2, 6, 2, RP.wood, 4).dots([[10, 17], [13, 16], [15, 18]], '#eef6c8'),
  upgrade: () => new Ico().poly([[12, 2], [21.5, 11.5], [15.5, 11.5], [15.5, 21], [8.5, 21], [8.5, 11.5], [2.5, 11.5]], RP.lime, 1),
  lock: () => new Ico().disc(12, 9, 6.5, RP.metal, 1).cutDisc(12, 9, 3.5).cut((x, y) => y >= 10).rect(4, 10, 16, 11, RP.amber, 2).dots([[11, 13], [12, 13], [11, 14], [12, 14], [11, 15], [12, 15], [11, 16], [12, 16]], K),
  check: () => new Ico().seg(4, 13, 9.5, 18.5, 4, RP.lime, 1).seg(9.5, 18.5, 20, 6, 4, RP.lime, 1),
  star: () => new Ico().poly(starPts(12, 12.8, 10.5, 4.4), RP.amber, 1),
  timer: () => new Ico().rect(5, 2, 14, 3, RP.wood, 1).rect(5, 19, 14, 3, RP.wood, 1).poly([[7, 5], [17, 5], [13, 12], [17, 19], [7, 19], [11, 12]], RP.cloth, 2).poly([[9, 7], [15, 7], [12, 11]], RP.amber, 3).poly([[8, 19], [16, 19], [12, 15]], RP.amber, 4),
  damage: () => new Ico().poly([[7, 16], [18, 3], [21, 4], [21, 6], [10, 18]], RP.metal, 1).seg(5, 15, 10, 20, 2.2, RP.steel, 2).seg(2, 22, 7, 17, 3, RP.wood, 3),
  range: () => { const s = new Ico(); for (let y = 4; y < 20; y++) for (let x = 0; x < 24; x++) if (((x + .5 - 12) / 10.5) ** 2 + ((y + .5 - 12) / 6) ** 2 <= 1) s.put(x, y, RP.cloth, 1); return s.disc(12, 12, 4, RP.blue, 2).dots([[11, 11], [12, 11], [11, 12], [12, 12]], K).dots([[13, 10]], '#e2e8f2'); },
  capacity: () => new Ico().rect(2, 12, 10, 9, RP.wood, 1).rect(12, 12, 10, 9, RP.wood, 2).rect(7, 3, 10, 9, RP.wood2, 3),
  yield: () => new Ico().disc(12, 15, 7, RP.tan, 1).rect(9, 4, 6, 6, RP.tan2, 2).rect(8, 8, 8, 2, RP.rope, 3).dots([[10, 3], [12, 2], [14, 3]], '#e6c874'),
  stamina: () => new Ico().poly([[14, 2], [5, 13], [11, 13], [8, 22], [19, 10], [13, 10], [17, 2]], RP.amber, 1),
  medicine: () => new Ico().rect(8, 4, 8, 3, RP.steel, 2).cut((x, y) => x >= 10 && x <= 13 && y >= 5).rect(3, 7, 18, 13, RP.cloth, 1).rect(10, 10, 4, 8, RP.red, 3).rect(8, 12, 8, 4, RP.red, 3),
  carry: () => new Ico().disc(12, 9, 6, RP.jacket2, 1).rect(6, 9, 12, 12, RP.jacket2, 1).rect(8, 13, 8, 6, RP.jacket, 2).rect(10, 1, 4, 2, RP.steel, 3).dots([[11, 15], [12, 15]], '#c4a24a'),
  barricade: () => new Ico().seg(4, 21, 16, 4, 3, RP.wood, 1).seg(8, 4, 20, 21, 3, RP.wood, 2).rect(2, 12, 20, 3, RP.wood2, 3).dots([[16, 3], [17, 2], [8, 3], [7, 2]], '#aab5ad'),
  trap: () => { const s = new Ico().rect(2, 17, 20, 4, RP.wood2, 1); for (let i = 0; i < 4; i++) { const x = 2 + i * 5; s.poly([[x, 17], [x + 2.5, 6 + (i % 2) * 3], [x + 5, 17]], RP.metal, 2 + i); } return s; },
  training: () => { const s = new Ico().poly([[2, 6], [12, 8], [12, 20], [2, 18]], RP.cloth, 1).poly([[12, 8], [22, 6], [22, 18], [12, 20]], RP.cloth, 2); for (const y of [11, 14]) for (let x = 4; x <= 20; x++) if (x < 10 || x > 14) s.dot(x, y + (x < 12 ? 0 : 0), '#8a8f80'); return s; },
  blueprint: () => { const s = new Ico().rect(3, 4, 18, 16, RP.blue, 1), c = '#b4c4dc'; for (let x = 7; x <= 16; x++) s.dot(x, 16, c); for (let y = 11; y <= 16; y++) { s.dot(7, y, c); s.dot(16, y, c); } for (let i = 0; i <= 4; i++) { s.dot(7 + i, 11 - i, c); s.dot(16 - i, 11 - i, c); } return s; }
});
const BADGE = {
  lock: () => new Ico(10, 10).disc(5, 4, 3, RP.metal, 1).cutDisc(5, 4, 1.4).cut((x, y) => y >= 4).rect(2, 4, 6, 5, RP.amber, 2).dots([[4, 6], [5, 6]], K),
  check: () => new Ico(10, 10).seg(1.5, 5.5, 4, 8, 2, RP.lime, 1).seg(4, 8, 8.5, 2, 2, RP.lime, 1),
  star: () => new Ico(10, 10).poly(starPts(5, 5.4, 4.4, 1.9), RP.amber, 1),
  up: () => new Ico(10, 10).poly([[5, 1], [9, 5], [6.5, 5], [6.5, 9], [3.5, 9], [3.5, 5], [1, 5]], RP.lime, 1),
  time: () => new Ico(10, 10).rect(2, 1, 6, 1, RP.wood, 1).rect(2, 8, 6, 1, RP.wood, 1).poly([[2.5, 2], [7.5, 2], [5, 5], [7.5, 8], [2.5, 8], [5, 5]], RP.amber, 2),
  new: () => new Ico(10, 10).rect(4, 1, 2, 5, RP.amber, 1).rect(4, 7, 2, 2, RP.amber, 2)
};
const MINI = {
  time: () => new Ico(10, 10).rect(2, 1, 6, 1, RP.wood, 1).rect(2, 8, 6, 1, RP.wood, 1).poly([[2.5, 2], [7.5, 2], [5, 5], [7.5, 8], [2.5, 8], [5, 5]], RP.amber, 2),
  points: () => new Ico(10, 10).rect(1, 2, 8, 6, RP.blue, 1).dots([[3, 4], [4, 4], [5, 4], [6, 4], [3, 5], [6, 5]], '#b4c4dc'),
  wood: () => new Ico(10, 10).rect(1, 3, 6, 4, RP.wood, 1).disc(7, 5, 2.2, RP.end, 2),
  metal: () => { const s = new Ico(10, 10), pts = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; pts.push([5 + Math.cos(a) * 4.2, 5 + Math.sin(a) * 4.2]); } return s.poly(pts, RP.metal, 1).cutDisc(5, 5, 1.2); },
  food: () => new Ico(10, 10).rect(2, 2, 6, 7, RP.metal, 1).rect(2, 4, 6, 3, RP.red, 2)
};

/* ---------- portraits ---------- */
function portrait(o) {
  const bg = frame(26, 26, 'inset'), s = new Ico(22, 22);
  s.poly([[0, 22], [1, 18], [5, 16], [17, 16], [21, 18], [22, 22]], o.jacket, 1);
  if (o.hair !== 'bald') s.disc(11, 7.5, 6, o.hc, 3);
  s.rect(9, 13, 4, 4, o.skin, 2).disc(11, 9.5, 5.2, o.skin, 2);
  s.put(5, 10, o.skin, 2); s.put(16, 10, o.skin, 2);
  if (o.hair !== 'bald') s.rect(7, 4, 8, 2, o.hc, 3).put(6, 6, o.hc, 3);
  if (o.hair === 'long') s.rect(5, 7, 2, 9, o.hc, 3).rect(15, 7, 2, 9, o.hc, 3);
  if (o.beard) for (let y = 11; y <= 15; y++) for (let x = 6; x <= 16; x++) if ((x + .5 - 11) ** 2 + (y + .5 - 10.5) ** 2 <= 21 && !(y === 12 && x >= 10 && x <= 11)) s.put(x, y, o.hc, 5);
  if (o.hat === 'cap') s.rect(5, 2, 12, 4, o.hatc, 4).rect(4, 5, 14, 1, o.hatc, 4);
  if (o.hat === 'bandana') s.rect(5, 4, 12, 2, RP.red, 4).rect(16, 5, 2, 3, RP.red, 4);
  s.dots([[9, 9], [13, 9]], K).dots([[9, 8], [13, 8]], o.hair === 'bald' ? o.skin[0] : o.hc[0]);
  if (!o.beard) s.dots([[10, 12], [11, 12]], darkSkin(o.skin)); else s.dots([[10, 12], [11, 12]], '#3a2018');
  if (o.glasses) s.dots([[8, 9], [10, 9], [12, 9], [14, 9], [11, 9]], '#2a2a22').dots([[9, 9], [13, 9]], '#8aa0a8');
  if (o.scar) s.dots([[13, 7], [14, 8], [13, 8]], '#8a3a2c');
  s.finish(false); bg.blit(s, 2, 2); return bg;
}
const darkSkin = r => r[0];

/* ---------- widgets ---------- */
function bar(w, pct, ramp, h = 8) {
  const s = frame(w, h, 'inset'), iw = w - 4, fillW = Math.round(iw * pct);
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const on = x - 2 < fillW, ry = y - 2, rh = h - 4;
    let c = on ? (ry === 0 ? ramp[2] : ry === rh - 1 ? ramp[0] : ramp[1]) : '#0c0e0a';
    if (on && (x - 2) % 6 === 5) c = mix(c, '#000000', 0.25);
    s.set(x, y, c);
  }
  return s;
}
function unitBar(pct, col) { const s = new Spr(14, 4); for (let y = 0; y < 4; y++) for (let x = 0; x < 14; x++) s.set(x, y, OL); for (let x = 1; x < 13; x++) { const on = x - 1 < Math.round(12 * pct); s.set(x, 1, on ? col[2] : '#2a2f24'); s.set(x, 2, on ? col[0] : '#1a1e16'); } return s; }
function counter(icon, num, rate) {
  const w = 30 + Math.max(measure(num, 16), measure(rate)) + 8, s = frame(w, 30, 'panel');
  s.blit(icon, 3, 3); text(s, num, 29, 5, T.txt, 16); text(s, rate, 29, 20, T.mut); return s;
}
function clock(I) {
  const w = 168, s = frame(w, 46, 'panel');
  s.blit(I.day, 4, 3);
  let x = 30 + text(s, 'DAY 02', 30, 7, T.txt); text(s, '/ 24', x + 5, 7, T.mut);
  text(s, '7H UNTIL DUSK', 30, 18, T.mut);
  text(s, '09:53', w - 6, 8, T.txt, 16, T.sh, 'r');
  const bx = 5, by = 33, bw = w - 10, b = frame(bw, 8, 'inset'); s.blit(b, bx, by);
  const segs = [[0, .06, RP.amber], [.06, .55, ['#5a6a3a', '#7a8a4e', '#98a866']], [.55, .67, ['#5a3452', '#7a4a6a', '#9a6488']], [.67, .95, RP.blue], [.95, 1, RP.amber]];
  for (let i = 0; i < bw - 4; i++) { const t = i / (bw - 4), sg = segs.find(q => t >= q[0] && t < q[1]) || segs[4]; for (let j = 0; j < 4; j++) s.set(bx + 2 + i, by + 2 + j, j === 0 ? sg[2][2] : j === 3 ? sg[2][0] : sg[2][1]); }
  const mx = bx + 2 + Math.round((bw - 4) * .14); for (let j = -1; j < 7; j++) s.set(mx, by + 1 + j, j < 0 ? OL : '#eef0de'); s.set(mx - 1, by, '#eef0de'); s.set(mx + 1, by, '#eef0de');
  return s;
}
function speedCtl() {
  const s = new Spr(4 * 20 - 2, 16); ['II', '1X', '2X', '4X'].forEach((l, i) => { const act = i === 1, f = frame(18, 16, act ? 'primary' : 'btn'); text(f, l, 9, 4, act ? T.ink : T.txt, 8, act ? null : T.sh, 'c'); s.blit(f, i * 20, 0); }); return s;
}
function buildBtn(I, h, kind) {
  const w = 92, s = frame(w, h, kind), dy = kind === 'primaryDown' ? 1 : 0, cy = Math.floor((h - 3) / 2);
  s.blit(I.build, 4, cy - 12 + dy + 1); text(s, 'BUILD', 31, cy - 2 + dy, T.ink, 8, null);
  const kb = frame(14, 13, 'inset'); text(kb, 'B', 7, 4, T.lime, 8, null, 'c'); s.blit(kb, w - 19, cy - 6 + dy);
  return s;
}
function sqBtn(icon, label, kind) {
  const s = frame(38, 38, kind), dy = kind === 'down' ? 1 : 0, ic = kind === 'off' ? mapSpr(icon, mute) : icon;
  const lc = kind === 'off' ? '#565b4c' : kind.startsWith('primary') ? T.ink : T.mut;
  s.blit(ic, 7, 3 + dy); text(s, label, 19, 28 + dy, lc, 8, null, 'c'); return s;
}
function actionBar(I) {
  const items = [['build', 'BUILD'], ['survivor', 'CREW'], ['expedition', 'EXPED'], ['alarm', 'ALARM'], ['map', 'LAND'], ['base', 'BASE'], ['menu', 'MENU']];
  const s = new Spr(items.length * 40 - 2, 38);
  items.forEach(([k, l], i) => s.blit(sqBtn(I[k], l, i === 0 ? 'primary' : i === 1 ? 'hover' : 'btn'), i * 40, 0)); return s;
}
function buildMenu(I, Mi) {
  const w = 184, h = 176, s = frame(w, h, 'panel');
  text(s, 'BUILD', 8, 8, T.lime); text(s, 'DEFENSE', w - 8, 8, T.mut, 8, T.sh, 'r');
  const tabs = ['DEFENSE', 'SHELTER', 'FOOD']; let tx0 = 6;
  tabs.forEach((t, i) => { const tw = measure(t) + 12, f = frame(tw, 16, i === 0 ? 'select' : 'off'); text(f, t, 6, 5, i === 0 ? T.lime : T.mut, 8, null); s.blit(f, tx0, 20); tx0 += tw + 3; });
  const slots = [['wall', 'wood', '10'], ['gate', 'wood', '40'], ['tower', 'wood', '60'], ['alarm', 'metal', '25'], ['bed', 'wood', '30'], ['food', 'food', '15'], ['repair', 'metal', '20'], ['integrity', 'metal', '80']];
  slots.forEach(([ic, res, cost], i) => {
    const col = i % 4, row = i >> 2, x = 6 + col * 44, y = 42 + row * 46, sel = i === 2, lock = i === 7;
    const f = frame(42, 44, sel ? 'select' : 'inset');
    f.blit(lock ? mapSpr(I[ic], mute) : I[ic], 9, 4);
    if (lock) text(f, 'LOCKED', 21, 33, '#565b4c', 8, null, 'c');
    else { f.blit(Mi[res], 8, 30); text(f, cost, 20, 32, sel ? T.lime : T.txt, 8, null); }
    s.blit(f, x, y);
  });
  const fy = 136; for (let x = 6; x < w - 6; x++) s.set(x, fy, '#2e3527');
  text(s, 'WATCHTOWER', 8, fy + 7, T.txt);
  let cx = w - 8; cx -= measure('20'); text(s, '20', cx, fy + 7, T.txt); s.blit(Mi.metal, cx - 11, fy + 5); cx -= 16 + measure('60'); text(s, '60', cx, fy + 7, T.txt); s.blit(Mi.wood, cx - 11, fy + 5);
  text(s, '+6 TILE VISION  1 GUARD', 8, fy + 20, T.mut);
  return s;
}
function inspect(I) {
  const w = 156, h = 118, s = frame(w, h, 'panel');
  const ib = frame(28, 28, 'inset'); ib.blit(I.tower, 2, 2); s.blit(ib, 6, 6);
  text(s, 'WATCHTOWER', 40, 10, T.txt); text(s, 'DEFENSE  LV 1', 40, 21, T.mut);
  text(s, 'INTEGRITY', 7, 42, T.mut); text(s, '140/200', w - 7, 42, T.txt, 8, T.sh, 'r'); s.blit(bar(w - 12, 0.7, RP.amber), 6, 51);
  [['GUARDS', '1/2'], ['RANGE', '6 TILES'], ['UPKEEP', '2 WOOD/DAY']].forEach(([k, v], i) => { text(s, k, 7, 66 + i * 10, T.mut); text(s, v, w - 7, 66 + i * 10, T.txt, 8, T.sh, 'r'); });
  const b1 = frame(70, 18, 'primary'); text(b1, 'REPAIR', 35, 5, T.ink, 8, null, 'c'); s.blit(b1, 6, h - 24);
  const b2 = frame(70, 18, 'btn'); text(b2, 'DEMOLISH', 35, 5, T.red, 8, T.sh, 'c'); s.blit(b2, w - 76, h - 24);
  return s;
}
function survivors(P) {
  const w = 164, rows = [['MARA', 'SCOUT', .9, 0], ['JONAS', 'BUILDER', .65, 1], ['PRIYA', 'MEDIC', 1, 2], ['OKE', 'GUARD', .25, 3]], h = 22 + rows.length * 32 + 4, s = frame(w, h, 'panel');
  text(s, 'SURVIVORS', 8, 8, T.lime); text(s, '4/6', w - 8, 8, T.mut, 8, T.sh, 'r');
  rows.forEach(([n, r, hp, pi], i) => {
    const y = 20 + i * 32; if (i) for (let x = 6; x < w - 6; x++) s.set(x, y - 2, '#2a3024');
    s.blit(P[pi], 6, y + 1); text(s, n, 38, y + 5, T.txt); text(s, r, 38, y + 15, T.mut);
    const col = hp > .6 ? RP.lime : hp > .3 ? RP.amber : RP.red; s.blit(bar(52, hp, col, 6), w - 58, y + 16);
    if (hp <= .3) text(s, 'HURT', w - 8, y + 5, T.red, 8, T.sh, 'r');
  });
  return s;
}
function toast(I, kind, icon, title, body) {
  const w = 184, h = 40, s = frame(w, h, kind === 'alert' ? 'alert' : 'panel');
  const ib = frame(28, 28, 'inset'); ib.blit(I[icon], 2, 2); s.blit(ib, 6, 6);
  text(s, title, 40, 11, kind === 'alert' ? T.red : kind === 'ok' ? T.lime : T.txt); text(s, body, 40, 23, T.mut); return s;
}
function crewManager(I, P) {
  const w = 320, h = 196, s = frame(w, h, 'panel');
  text(s, 'SURVIVOR MANAGER', 8, 8, T.lime); text(s, '4/6  BEDS 2', w - 8, 8, T.mut, 8, T.sh, 'r');
  const crew = [['MARA', 'SCOUT', .9], ['JONAS', 'BUILDER', .65], ['PRIYA', 'MEDIC', 1], ['OKE', 'GUARD', .25]];
  crew.forEach(([n, r, hp], i) => {
    const y = 20 + i * 34, sel = i === 1, f = frame(118, 32, sel ? 'select' : 'inset');
    f.blit(P[i], 3, 3); text(f, n, 33, 7, sel ? T.lime : T.txt, 8, null); text(f, r, 33, 17, T.mut, 8, null);
    const col = hp > .6 ? RP.lime : hp > .3 ? RP.amber : RP.red; f.blit(unitBar(hp, col), 100, 7 + 0);
    s.blit(f, 6, y);
  });
  const rb = frame(118, 18, 'btn'); text(rb, '+ RECRUIT', 59, 5, T.txt, 8, T.sh, 'c'); s.blit(rb, 6, h - 24);
  const x0 = 132; for (let y = 20; y < h - 6; y++) s.set(x0 - 4, y, '#2a3024');
  const big = frame(40, 40, 'inset'), pb = new Spr(26, 26); pb.blit(P[1], 0, 0);
  for (let y = 0; y < 26; y++) for (let x = 0; x < 26; x++) { const c = pb.p[y * 26 + x]; if (c) big.set(7 + x, 7 + y, c); }
  s.blit(big, x0, 20);
  text(s, 'JONAS', x0 + 46, 24, T.txt, 16); text(s, 'BUILDER  DAY 2 SURVIVOR', x0 + 46, 44, T.mut);
  [['HEALTH', .65, RP.red], ['FOOD', .8, RP.amber], ['MORALE', .45, RP.lime]].forEach(([k, v, r], i) => {
    const y = 68 + i * 13; text(s, k, x0, y + 1, T.mut); s.blit(bar(w - x0 - 58, v, r, 8), x0 + 50, y);
  });
  text(s, 'ROLE', x0, 112, T.mut);
  let bx = x0; ['SCOUT', 'BUILD', 'MEDIC', 'GUARD'].forEach((l, i) => { const bw = 44, f = frame(bw - 2, 16, i === 1 ? 'select' : 'btn'); text(f, l, (bw - 2) / 2, 5, i === 1 ? T.lime : T.txt, 8, i === 1 ? null : T.sh, 'c'); s.blit(f, bx, 122); bx += bw; });
  text(s, 'POST', x0, 146, T.mut);
  ['N', 'E', 'S', 'W', 'HQ'].forEach((l, i) => { const bw = i === 4 ? 26 : 18, f = frame(bw, 16, i === 4 ? 'select' : 'btn'); text(f, l, bw / 2, 5, i === 4 ? T.lime : T.txt, 8, i === 4 ? null : T.sh, 'c'); s.blit(f, x0 + 34 + i * 20, 141); });
  const eb = frame(w - x0 - 6, 18, 'primary'); text(eb, 'SEND ON EXPEDITION', (w - x0 - 6) / 2, 5, T.ink, 8, null, 'c'); s.blit(eb, x0, h - 24);
  return s;
}
function objective() {
  const w = 216, s = frame(w, 32, 'panel'), d = new Ico(14, 14);
  d.poly([[7, 0.5], [13.5, 7], [7, 13.5], [0.5, 7]], RP.lime, 1).poly([[7, 4], [10, 7], [7, 10], [4, 7]], RP.dark, 2).finish(); s.blit(d, 8, 9);
  text(s, 'THE LONG NIGHT', 30, 8, T.lime); text(s, 'BUILD A REFUGE. SURVIVE 24 DAYS.', 30, 19, T.txt); return s;
}
function minimap() {
  const sc = scene(7), mw = sc.w / 4, mh = sc.h / 4, s = frame(mw + 12, mh + 26, 'panel');
  text(s, 'MAP', 7, 7, T.lime); text(s, 'N', mw + 5, 7, T.mut, 8, T.sh, 'r');
  s.blit(frame(mw + 4, mh + 4, 'inset'), 4, 18);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const c = sc.p[(y * 4 + j) * sc.w + x * 4 + i]; if (c) { const q = rgb(c); r += q[0]; g += q[1]; b += q[2]; n++; } }
    if (n) s.set(6 + x, 20 + y, hex([r / n, g / n, b / n]));
  }
  for (const [x, y] of [[4, 40], [8, 44], [96, 20], [99, 50], [20, 62], [90, 60]]) { s.set(6 + x, 20 + y, '#e0674f'); s.set(7 + x, 20 + y, '#e0674f'); s.set(6 + x, 21 + y, '#a8453a'); s.set(7 + x, 21 + y, '#a8453a'); }
  for (const [x, y] of [[40, 28], [52, 34], [62, 26], [50, 44]]) s.set(6 + x, 20 + y, '#dfeea0');
  const vx = 20, vy = 8, vw = 64, vh = 40; for (let i = 0; i <= vw; i++) { if (i % 2 === 0) { s.set(6 + vx + i, 20 + vy, '#eef0de'); s.set(6 + vx + i, 20 + vy + vh, '#eef0de'); } } for (let j = 0; j <= vh; j++) if (j % 2 === 0) { s.set(6 + vx, 20 + vy + j, '#eef0de'); s.set(6 + vx + vw, 20 + vy + j, '#eef0de'); }
  return s;
}
function pauseMenu() {
  const w = 144, items = ['RESUME', 'SETTINGS', 'SAVE GAME', 'QUIT TO TITLE'], h = 50 + items.length * 22 + 6, s = frame(w, h, 'panel');
  text(s, 'PAUSED', w / 2, 10, T.txt, 16, T.sh, 'c'); text(s, 'DAY 02  09:53', w / 2, 30, T.mut, 8, T.sh, 'c');
  items.forEach((l, i) => { const p = i === 0, f = frame(w - 24, 18, p ? 'primary' : i === 1 ? 'hover' : 'btn'); text(f, l, (w - 24) / 2, 5, p ? T.ink : i === 3 ? T.red : T.txt, 8, p ? null : T.sh, 'c'); s.blit(f, 12, 46 + i * 22); });
  return s;
}
/* cursors & ghosts */
function cursor(kind) {
  const s = new Ico(16, 16);
  if (kind === 'arrow') s.poly([[1, 1], [1, 13.5], [4.5, 10.5], [7, 15], [9.5, 14], [7, 9.5], [11.5, 9.5]], ['#b8bcaa', '#dfe2d0', '#f4f6e8'], 1);
  if (kind === 'build') { s.poly([[1, 1], [1, 9], [3.5, 7], [7, 7]], ['#b8bcaa', '#dfe2d0', '#f4f6e8'], 1); s.seg(6, 15, 11, 10, 2, RP.wood, 2).seg(9, 7, 15, 13, 3.5, RP.metal, 3); }
  if (kind === 'attack') { s.disc(8, 8, 6.5, RP.red, 1).cutDisc(8, 8, 4.5); s.cut((x, y) => (x === 7 || x === 8) || (y === 7 || y === 8)); s.rect(7, 7, 2, 2, RP.red, 2); s.rect(7, 0, 2, 4, RP.red, 3).rect(7, 12, 2, 4, RP.red, 3).rect(0, 7, 4, 2, RP.red, 3).rect(12, 7, 4, 2, RP.red, 3); }
  if (kind === 'deny') { s.disc(8, 8, 7, RP.red, 1).cutDisc(8, 8, 4.8).seg(4, 12, 12, 4, 2.4, RP.red, 1); }
  return s.finish();
}
function ghost(src, tint) { const s = new Spr(src.w, src.h); for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.p[y * src.w + x]; if (!c || (x + y) & 1) continue; s.set(x, y, c === OL ? mix(tint, '#000000', .55) : mix(c, tint, .55)); } return s; }
function brackets(n, col) {
  const w = n * 16, s = new Spr(w, w), L = 4, c2 = mix(col, '#000000', .5);
  for (let i = 0; i < L; i++) for (const [x, y] of [[i, 0], [0, i], [w - 1 - i, 0], [w - 1, i], [i, w - 1], [0, w - 1 - i], [w - 1 - i, w - 1], [w - 1, w - 1 - i]]) s.set(x, y, col);
  for (let i = 1; i < L; i++) for (const [x, y] of [[i, 1], [1, i], [w - 1 - i, 1], [w - 2, i], [i, w - 2], [1, w - 1 - i], [w - 1 - i, w - 2], [w - 2, w - 1 - i]]) s.set(x, y, c2);
  for (let y = 2; y < w - 2; y++) for (let x = 2; x < w - 2; x++) if (x % 2 === 0 && y % 2 === 0) s.set(x, y, mix(col, '#000000', .3));
  return s;
}
/* ---------- research & upgrade trees ---------- */
const NODE_K = { locked: 'off', available: 'btn', hover: 'hover', research: 'research', owned: 'owned', maxed: 'maxed' };
function node(I, B, icon, st, size = 32, pct = .6) {
  const kind = NODE_K[st], k = FR[kind], s = frame(size, size, kind), o = (size - 24) >> 1, lip = kind === 'btn' || kind === 'hover' ? 1 : 0;
  if (size > 32) { const c = k.hi, a = 4, b = size - 5; for (let i = 0; i < 4; i++) for (const [x, y] of [[a + i, a], [a, a + i], [b - i, a], [b, a + i], [a + i, b - lip], [a, b - lip - i], [b - i, b - lip], [b, b - lip - i]]) s.set(x, y, c); }
  if (icon) s.blit(st === 'locked' ? mapSpr(I[icon], mute) : I[icon], o, o - lip);
  if (st === 'research') { const x0 = 4, x1 = size - 5, n = Math.round((x1 - x0 + 1) * pct); for (let x = x0; x <= x1; x++) { const on = x - x0 < n; s.set(x, size - 6, on ? '#e6c874' : '#0c0e0a'); s.set(x, size - 5, on ? '#c4a24a' : '#0c0e0a'); } }
  const bd = { locked: 'lock', owned: 'check', maxed: 'star' }[st]; if (icon && bd) s.blit(B[bd], size - 11, size - 11);
  return s;
}
function ring(w, col = '#c5d48a') {
  const s = new Spr(w, w), L = 6, c2 = mix(col, '#000000', .5);
  for (let i = 0; i < L; i++) for (const [x, y] of [[i, 0], [0, i], [w - 1 - i, 0], [w - 1, i], [i, w - 1], [0, w - 1 - i], [w - 1 - i, w - 1], [w - 1, w - 1 - i]]) s.set(x, y, col);
  for (let i = 1; i < L - 1; i++) for (const [x, y] of [[i, 1], [1, i], [w - 1 - i, 1], [w - 2, i], [i, w - 2], [1, w - 1 - i], [w - 1 - i, w - 2], [w - 2, w - 1 - i]]) s.set(x, y, c2);
  return s;
}
const LC = { off: ['#3d4633', '#2e3527'], on: ['#cfe08e', '#a3b56a'], prog: ['#e6c874', '#c4a24a'] };
const lname = m => ['n', 'e', 's', 'w'].filter((_, i) => m >> i & 1).join('');
function conn(m, st) {
  const C = LC[st], s = new Spr(8, 8), core = new Map(), add = (x, y, c) => core.set(y * 8 + x, c);
  for (let y = 3; y <= 4; y++) for (let x = 3; x <= 4; x++) add(x, y, x === 3 && y === 3 ? C[0] : C[1]);
  for (let i = 0; i < 3; i++) {
    if (m & 1) { add(3, i, C[0]); add(4, i, C[1]); } if (m & 4) { add(3, 5 + i, C[0]); add(4, 5 + i, C[1]); }
    if (m & 8) { add(i, 3, C[0]); add(i, 4, C[1]); } if (m & 2) { add(5 + i, 3, C[0]); add(5 + i, 4, C[1]); }
  }
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (!core.has(y * 8 + x) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx >= 0 && x + dx < 8 && y + dy >= 0 && y + dy < 8 && core.has((y + dy) * 8 + x + dx))) s.set(x, y, OL);
  core.forEach((c, i) => s.set(i % 8, (i / 8) | 0, c));
  return s;
}
function linkStrip(st) { const s = new Spr(15 * 10 - 2, 8); for (let m = 1; m < 16; m++) s.blit(conn(m, st), (m - 1) * 10, 0); return s; }
function pip(st) {
  const s = new Spr(6, 6), r = st === 'max' || st === 'next' ? RP.amber : st === 'on' ? RP.lime : ['#1a1e16', '#23281e', '#2e3527'];
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) { const e = x === 0 || y === 0 || x === 5 || y === 5; if (e && (x === 0 || x === 5) && (y === 0 || y === 5)) continue; s.set(x, y, e ? OL : y === 1 ? r[2] : y === 4 ? r[0] : r[1]); }
  if (st === 'next') for (let y = 2; y <= 3; y++) for (let x = 2; x <= 3; x++) s.set(x, y, '#1a1e16');
  return s;
}
function ranks(cur, max, next) { const s = new Spr(max * 7 - 1, 6); for (let i = 0; i < max; i++) s.blit(pip(i < cur ? (cur === max ? 'max' : 'on') : i === cur && next ? 'next' : 'off'), i * 7, 0); return s; }
function plate(label, kind, col) { const f = frame(measure(label) + 10, 13, kind); text(f, label, 5, 4, col, 8, null); return f; }
function labelBtn(label, kind, badge) {
  const off = kind === 'off', bw = badge ? 13 : 0, w = measure(label) + bw + 14, f = frame(w, 18, kind), dy = kind.endsWith('own') ? 1 : 0;
  const lc = off ? '#565b4c' : kind.startsWith('primary') ? T.ink : T.txt;
  if (badge) f.blit(off ? mapSpr(badge, mute) : badge, 5, 3 + dy);
  text(f, label, 7 + bw, 5 + dy, lc, 8, kind.startsWith('primary') || off ? null : T.sh); return f;
}
function tabs(list, act) {
  const ws = list.map(t => measure(t) + 12), s = new Spr(ws.reduce((a, b) => a + b + 3, -3), 16); let x = 0;
  list.forEach((t, i) => { const f = frame(ws[i], 16, i === act ? 'select' : 'off'); text(f, t, 6, 5, i === act ? T.lime : T.mut, 8, null); s.blit(f, x, 0); x += ws[i] + 3; });
  return s;
}
function tree(I, B, o) {
  const N = {}; o.nodes.forEach(n => { N[n.id] = n; n.x = 2 + n.c * 6; n.y = 2 + Math.round(n.r * 6); });
  const mx = Math.max(...o.nodes.map(n => n.x)), my = Math.max(...o.nodes.map(n => n.y)), s = new Spr(mx * 8 + 28, my * 8 + 28);
  for (let y = 0; y < s.h; y += 8) for (let x = 0; x < s.w; x += 8) s.set(x + 7, y + 7, '#1a1f16');
  const G = new Map(), P = { off: 0, prog: 1, on: 2 };
  const cell = (x, y) => { const k = x + ',' + y; if (!G.has(k)) G.set(k, { m: 0, st: 'off', x, y }); return G.get(k); };
  const mark = (c, bit, st) => { c.m |= bit; if (P[st] > P[c.st]) c.st = st; };
  const line = (x0, y0, x1, y1, st) => { const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0); let x = x0, y = y0; cell(x, y); while (x !== x1 || y !== y1) { const a = cell(x, y); x += dx; y += dy; const b = cell(x, y); if (dx) { mark(a, dx > 0 ? 2 : 8, st); mark(b, dx > 0 ? 8 : 2, st); } else { mark(a, dy > 0 ? 4 : 1, st); mark(b, dy > 0 ? 1 : 4, st); } } };
  o.edges.forEach(([ai, bi]) => {
    const a = N[ai], b = N[bi], st = b.st === 'owned' || b.st === 'maxed' ? 'on' : b.st === 'research' ? 'prog' : 'off';
    if (o.dir === 'v') { const m = Math.round((a.y + b.y) / 2); line(a.x, a.y, a.x, m, st); line(a.x, m, b.x, m, st); line(b.x, m, b.x, b.y, st); }
    else { const m = Math.round((a.x + b.x) / 2); line(a.x, a.y, m, a.y, st); line(m, a.y, m, b.y, st); line(m, b.y, b.x, b.y, st); }
  });
  G.forEach(c => { if (c.m) s.blit(conn(c.m, c.st), c.x * 8, c.y * 8); });
  o.nodes.forEach(n => { const sz = n.major ? 40 : 32, h = sz / 2 - 4; s.blit(node(I, B, n.icon, n.st, sz), n.x * 8 - h, n.y * 8 - h); if (n.id === o.sel) s.blit(ring(sz + 4), n.x * 8 - h - 2, n.y * 8 - h - 2); });
  return s;
}
function treePanel(I, B, Mi, o) {
  const g = tree(I, B, o), tb = tabs(['SURVIVORS', 'BUILDINGS', 'DEFENSE'], o.tab), w = Math.max(g.w + 12, tb.w + 12), ay = o.tiers ? 58 : 42, h = ay + g.h + 10, s = frame(w, h, 'panel');
  text(s, o.title, 8, 8, T.lime);
  const rw = measure(o.right[1]); text(s, o.right[1], w - 8, 8, T.txt, 8, T.sh, 'r'); s.blit(Mi[o.right[0]], w - 8 - rw - 12, 6);
  s.blit(tb, 6, 20);
  s.blit(frame(w - 8, g.h + 6, 'inset'), 4, ay); const gx = 4 + ((w - 8 - g.w) >> 1);
  if (o.tiers) o.tiers.forEach((t, c) => { if (!t) return; const p = plate(t, 'inset', T.mut); s.blit(p, gx + (2 + c * 6) * 8 + 4 - (p.w >> 1), 41); });
  s.blit(g, gx, ay + 3); return s;
}
function arrow(s, x, y, c) { for (const [i, j] of [[0, 2], [1, 2], [2, 2], [3, 2], [2, 0], [3, 1], [4, 2], [3, 3], [2, 4]]) s.set(x + i, y + j, c); }
function detail(I, B, Mi, o) {
  const w = 176, rows = o.stats.length, h = 64 + rows * 11 + (o.req ? 12 : 0) + 50, s = frame(w, h, 'panel');
  s.blit(node(I, B, o.icon, o.st), 6, 6);
  text(s, o.name, 44, 9, T.txt); text(s, o.sub, 44, 20, T.mut); s.blit(ranks(o.rank[0], o.rank[1], !o.off), 44, 30);
  text(s, o.desc, 7, 46, T.mut); for (let x = 6; x < w - 6; x++) s.set(x, 58, '#2e3527');
  o.stats.forEach(([k, a, b], i) => { const y = 64 + i * 11; text(s, k, 7, y, T.mut); const bx = w - 7, ax = bx - measure(b) - 9; text(s, b, bx, y, o.off ? T.txt : T.lime, 8, T.sh, 'r'); arrow(s, ax + 1, y, T.mut); text(s, a, ax - 3, y, T.txt, 8, T.sh, 'r'); });
  let y = 64 + rows * 11 + 2;
  if (o.req) { s.blit(B.lock, 6, y - 2); text(s, o.req, 19, y, T.red); y += 12; }
  for (let x = 6; x < w - 6; x++) s.set(x, y, '#2e3527'); y += 7;
  let x = 7; o.cost.forEach(([r, n]) => { s.blit(Mi[r], x, y - 2); text(s, String(n), x + 12, y, T.txt); x += 12 + measure(String(n)) + 9; });
  const tw = measure(o.time); text(s, o.time, w - 7, y, T.txt, 8, T.sh, 'r'); s.blit(Mi.time, w - 7 - tw - 12, y - 2);
  const bk = o.off ? 'off' : 'primary', b = frame(w - 12, 18, bk); text(b, o.btn, (w - 12) >> 1, 5, o.off ? '#565b4c' : T.ink, 8, null, 'c'); s.blit(b, 6, h - 24);
  return s;
}
function queue(I, B, Mi) {
  const w = 176, h = 20 + 3 * 40 + 2, s = frame(w, h, 'panel');
  text(s, 'RESEARCH QUEUE', 8, 8, T.lime); text(s, '2/3', w - 8, 8, T.mut, 8, T.sh, 'r');
  [0, 1, 2].forEach(i => {
    const f = frame(164, 36, i === 2 ? 'off' : 'inset');
    if (i === 0) { f.blit(node(I, B, 'trap', 'research', 32, .6), 2, 2); text(f, 'SPIKE TRAPS', 38, 7, T.txt, 8, null); text(f, '3H', 158, 7, T.amb, 8, null, 'r'); f.blit(bar(120, .6, RP.amber, 6), 38, 20); }
    if (i === 1) { f.blit(node(I, B, 'gate', 'available'), 2, 2); text(f, 'REINFORCED GATE', 38, 7, T.txt, 8, null); text(f, 'QUEUED', 38, 20, T.mut, 8, null); text(f, '6H', 158, 7, T.mut, 8, null, 'r'); }
    if (i === 2) text(f, '+ ADD RESEARCH', 82, 15, T.mut, 8, null, 'c');
    s.blit(f, 6, 20 + i * 40);
  });
  return s;
}
function fontSheet(size, lines) {
  const lh = size + 6, w = Math.max(...lines.map(l => measure(l, size))) + 4, s = new Spr(w, lines.length * lh + 2);
  lines.forEach((l, i) => text(s, l, 2, 2 + i * lh, T.txt, size, null)); return s;
}

export async function buildUI() {
  await document.fonts.load('8px Silkscreen'); await document.fonts.load('16px Silkscreen');
  const A = {}, I = {}, Mi = {};
  for (const k in ICONS) { I[k] = ICONS[k]().finish(); A['icon_' + k] = I[k]; }
  for (const k in MINI) { Mi[k] = MINI[k]().finish(false); A['mini_' + k] = Mi[k]; }
  for (const k in FR) A['frame_' + k] = frame(24, 24, k);
  const P = [
    portrait({ skin: RP.skin, hc: RP.hairR, hair: 'long', jacket: RP.jacket, hat: 'bandana' }),
    portrait({ skin: RP.skin3, hc: RP.hairB, hair: 'short', jacket: RP.jacket2, hat: 'cap', hatc: RP.tan2, beard: 1 }),
    portrait({ skin: RP.skin2, hc: RP.hairB, hair: 'long', jacket: RP.cloth, glasses: 1 }),
    portrait({ skin: RP.skin2, hc: RP.hairG, hair: 'bald', jacket: RP.jacket3, beard: 1, scar: 1 })
  ];
  P.forEach((p, i) => A['portrait_' + (i + 1)] = p);
  A.counter_wood = counter(I.wood, '616', '+20.4/M'); A.counter_metal = counter(I.metal, '284', '+8.7/M'); A.counter_food = counter(I.food, '177', '+8.0/M');
  A.clock = clock(I); A.speed = speedCtl();
  A.bar_health = bar(72, 0.85, RP.red); A.bar_integrity = bar(72, 0.29, RP.amber); A.bar_progress = bar(72, 0.6, RP.lime); A.bar_empty = bar(72, 0, RP.lime);
  A.ubar_full = unitBar(1, RP.lime); A.ubar_mid = unitBar(.5, RP.amber); A.ubar_low = unitBar(.2, RP.red);
  A.build_btn = buildBtn(I, 30, 'primary'); A.build_btn_down = buildBtn(I, 30, 'primaryDown');
  A.sq_btn = sqBtn(I.alarm, 'ALARM', 'btn'); A.sq_hover = sqBtn(I.alarm, 'ALARM', 'hover'); A.sq_down = sqBtn(I.alarm, 'ALARM', 'down'); A.sq_off = sqBtn(I.alarm, 'ALARM', 'off');
  A.action_bar = actionBar(I);
  A.build_menu = buildMenu(I, Mi); A.inspect = inspect(I); A.survivors = survivors(P);
  A.toast_alert = toast(I, 'alert', 'zombie', 'EAST WALL BREACHED', '6 HOSTILES INSIDE'); A.toast_info = toast(I, 'info', 'alarm', 'A BREAK IN THE ATTACK', 'REPAIR THE HQ NOW'); A.toast_ok = toast(I, 'ok', 'tower', 'WATCHTOWER BUILT', 'NORTH SIDE COVERED');
  A.crew_manager = crewManager(I, P);
  A.objective = objective(); A.minimap = minimap(); A.pause = pauseMenu();
  for (const k of ['arrow', 'build', 'attack', 'deny']) A['cursor_' + k] = cursor(k);
  const TS = buildAll();
  A.ghost_wall_ok = ghost(TS.wall_palisade_h, '#b7e07a'); A.ghost_wall_bad = ghost(TS.wall_palisade_h, '#e0674f');
  A.ghost_tower_ok = ghost(TS.tower_open, '#b7e07a'); A.ghost_tower_bad = ghost(TS.tower_open, '#e0674f');
  const BB = buildBuildings();
  for (const k in BB) { const n = k.replace('bld_', ''); A['ghost_' + n + '_ok'] = ghost(BB[k], '#b7e07a'); A['ghost_' + n + '_bad'] = ghost(BB[k], '#e0674f'); }
  A.select_1 = brackets(1, '#c5d48a'); A.select_2 = brackets(2, '#c5d48a'); A.select_2_bad = brackets(2, '#e0674f');
  const B = {}; for (const k in BADGE) { B[k] = BADGE[k]().finish(false); A['badge_' + k] = B[k]; }
  for (const st of Object.keys(NODE_K)) { A['node_' + st] = node(I, B, 'barricade', st); A['node_major_' + st] = node(I, B, 'gate', st, 40); }
  A.node_empty = node(I, B, null, 'locked'); A.node_select = ring(36); A.node_select_major = ring(44);
  for (const st of ['off', 'on', 'prog']) { for (let m = 1; m < 16; m++) A['link_' + st + '_' + lname(m)] = conn(m, st); A['links_' + st] = linkStrip(st); }
  for (const st of ['off', 'on', 'next', 'max']) A['pip_' + st] = pip(st);
  A.rank_0_3 = ranks(0, 3, 1); A.rank_2_3 = ranks(2, 3, 1); A.rank_3_3 = ranks(3, 3); A.rank_2_5 = ranks(2, 5, 1);
  ['I', 'II', 'III', 'IV', 'V'].forEach((r, i) => { A['tier_' + (i + 1)] = plate('TIER ' + r, 'inset', T.mut); A['lv_' + (i + 1)] = plate('LV ' + (i + 1), 'owned', T.lime); });
  A.btn_upgrade = labelBtn('UPGRADE', 'primary', B.up); A.btn_upgrade_down = labelBtn('UPGRADE', 'primaryDown', B.up); A.btn_upgrade_off = labelBtn('UPGRADE', 'off', B.lock);
  A.btn_research = labelBtn('RESEARCH', 'primary', Mi.points); A.btn_research_off = labelBtn('RESEARCH', 'off', Mi.points); A.btn_cancel = labelBtn('CANCEL', 'btn', null); A.btn_speedup = labelBtn('RUSH', 'btn', B.time);
  A.tabs_tree = tabs(['SURVIVORS', 'BUILDINGS', 'DEFENSE'], 0);
  A.detail_upgrade = detail(I, B, Mi, { icon: 'gate', st: 'available', name: 'REINFORCED GATE', sub: 'GATE  TIER II', rank: [1, 3], desc: 'IRON BANDS ON THE FRAME.', stats: [['INTEGRITY', '200', '320'], ['OPEN TIME', '3S', '2S'], ['REPAIR COST', '20', '16']], cost: [['wood', 80], ['metal', 40]], time: '2H', btn: 'UPGRADE' });
  A.detail_locked = detail(I, B, Mi, { icon: 'trap', st: 'locked', name: 'SPIKE TRAPS', sub: 'BARRICADE  TIER III', rank: [0, 1], desc: 'SLOWS AND WOUNDS HOSTILES.', stats: [['DAMAGE', '0', '4/S'], ['SLOW', '0', '30%']], req: 'NEEDS WORKSHOP LV 3', cost: [['metal', 60], ['points', 2]], time: '4H', btn: 'RESEARCH', off: 1 });
  A.research_queue = queue(I, B, Mi);
  A.tree_survivor = treePanel(I, B, Mi, { title: 'SURVIVOR SKILLS', tab: 0, right: ['points', '3'], tiers: [null, 'TIER I', 'TIER II', 'TIER III'], sel: 's3', nodes: [
    { id: 'root', c: 0, r: 1.5, icon: 'survivor', st: 'owned', major: 1 },
    { id: 's1', c: 1, r: 0, icon: 'stamina', st: 'owned' }, { id: 's2', c: 2, r: 0, icon: 'range', st: 'owned' }, { id: 's3', c: 3, r: 0, icon: 'carry', st: 'research', major: 1 },
    { id: 'b1', c: 1, r: 1, icon: 'build', st: 'owned' }, { id: 'b2', c: 2, r: 1, icon: 'repair', st: 'available' }, { id: 'b3', c: 3, r: 1, icon: 'capacity', st: 'locked', major: 1 },
    { id: 'm1', c: 1, r: 2, icon: 'medicine', st: 'available' }, { id: 'm2', c: 2, r: 2, icon: 'health', st: 'locked' }, { id: 'm3', c: 3, r: 2, icon: 'training', st: 'locked', major: 1 },
    { id: 'g1', c: 1, r: 3, icon: 'damage', st: 'maxed' }, { id: 'g2', c: 2, r: 3, icon: 'alarm', st: 'available' }, { id: 'g3', c: 3, r: 3, icon: 'tower', st: 'locked', major: 1 }],
    edges: [['root', 's1'], ['root', 'b1'], ['root', 'm1'], ['root', 'g1'], ['s1', 's2'], ['s2', 's3'], ['b1', 'b2'], ['b2', 'b3'], ['m1', 'm2'], ['m2', 'm3'], ['g1', 'g2'], ['g2', 'g3']] });
  A.tree_building = treePanel(I, B, Mi, { title: 'HQ UPGRADES', tab: 1, dir: 'v', right: ['metal', 'LV 2/5'], sel: 'h3', nodes: [
    { id: 'h1', c: 1, r: 0, icon: 'base', st: 'owned' }, { id: 'h2', c: 1, r: 1, icon: 'integrity', st: 'owned' }, { id: 'h3', c: 1, r: 2, icon: 'capacity', st: 'research' }, { id: 'h4', c: 1, r: 3, icon: 'upgrade', st: 'locked' }, { id: 'h5', c: 1, r: 4, icon: 'star', st: 'locked', major: 1 },
    { id: 'x1', c: 0, r: 1, icon: 'bed', st: 'owned' }, { id: 'x2', c: 2, r: 1, icon: 'food', st: 'available' }, { id: 'x3', c: 0, r: 3, icon: 'yield', st: 'locked' }, { id: 'x4', c: 2, r: 3, icon: 'alarm', st: 'locked' }],
    edges: [['h1', 'h2'], ['h2', 'h3'], ['h3', 'h4'], ['h4', 'h5'], ['h2', 'x1'], ['h2', 'x2'], ['h4', 'x3'], ['h4', 'x4']] });
  A.tree_defense = treePanel(I, B, Mi, { title: 'BARRICADE & GATE', tab: 2, right: ['points', '5'], tiers: ['TIER I', 'TIER II', 'TIER III', 'TIER IV'], sel: 'd3', nodes: [
    { id: 'd1', c: 0, r: 0, icon: 'wall', st: 'owned' }, { id: 'd2', c: 1, r: 0, icon: 'barricade', st: 'owned' }, { id: 'd3', c: 2, r: 0, icon: 'trap', st: 'research' }, { id: 'd4', c: 3, r: 0, icon: 'damage', st: 'locked', major: 1 },
    { id: 'e1', c: 0, r: 1, icon: 'gate', st: 'owned' }, { id: 'e2', c: 1, r: 1, icon: 'integrity', st: 'available' }, { id: 'e3', c: 2, r: 1, icon: 'alarm', st: 'locked' }, { id: 'e4', c: 3, r: 1, icon: 'star', st: 'locked', major: 1 }],
    edges: [['d1', 'd2'], ['d2', 'd3'], ['d3', 'd4'], ['e1', 'e2'], ['e2', 'e3'], ['d2', 'e3'], ['e3', 'e4']] });
  A.toast_research = toast(I, 'ok', 'research', 'RESEARCH COMPLETE', 'SPIKE TRAPS UNLOCKED'); A.toast_upgrade = toast(I, 'info', 'upgrade', 'UPGRADE READY', 'HQ CAN REACH LV 3');
  A.font_8 = fontSheet(8, ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0123456789 .,:;!?+-/%()#']); A.font_16 = fontSheet(16, ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ', '0123456789:/+']);
  return A;
}
