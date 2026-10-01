// Procedural 16-bit pixel art generator — top-down 3/4, 16px grid.
export const OL = '#1a1e16';
export const G = ['#2e3a26', '#3a4a2f', '#46583a', '#566a45', '#6c7f55'];
export const D = ['#4f4a38', '#625b44', '#736b50', '#847c5e', '#9a9170'];
export const R = ['#6a6450', '#7c7560', '#8c856c', '#9e977d', '#b2ac92'];
export const W = ['#3d3122', '#5a4832', '#7a6444', '#9a8157', '#b89d6e'];
export const L = ['#223020', '#2f4029', '#3e5333', '#50673f', '#67804e'];
export const PN = ['#1d2b1f', '#273a28', '#324a31', '#415d3c', '#567349'];
export const DW = ['#2c2a24', '#434036', '#5d584b', '#7a7462', '#979079'];
export const M = ['#2a302d', '#46504a', '#65706a', '#8a958d'];
export const S = ['#524c38', '#6e674c', '#8a8262', '#a69e7c'];
export const X = ['#c4a24a', '#22221c', '#7a4a2c', '#94613a', '#5a1f18', '#d8cc86'];

const hh = (x, y, s = 0) => { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
export function mkRng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (pal, v) => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(v * pal.length)))];
const hexC = {}, dkC = {};
function rgb(h) { if (hexC[h]) return hexC[h]; const n = parseInt(h.slice(1), 16); return (hexC[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]); }
function darken(h, a) {
  const k = h + a.toFixed(2); if (dkC[k]) return dkC[k];
  const [r, g, b] = rgb(h), f = 1 - a, c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return (dkC[k] = '#' + c(r * f) + c(g * f) + c(b * (f + a * 0.18) + 6 * a));
}

export class Spr {
  constructor(w, h) { this.w = w; this.h = h; this.p = new Array(w * h).fill(null); this.sh = new Float32Array(w * h); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c) { x = Math.floor(x); y = Math.floor(y); if (this.in(x, y)) this.p[y * this.w + x] = c; }
  get(x, y) { return this.in(x, y) ? this.p[y * this.w + x] : null; }
  shade(x, y, a) { x = Math.floor(x); y = Math.floor(y); if (this.in(x, y)) { const i = y * this.w + x; this.sh[i] = Math.max(this.sh[i], a); } }
  ellipseShadow(cx, cy, rx, ry, a) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; if (dx * dx + dy * dy <= 1) this.shade(x, y, a); } }
  line(x0, y0, x1, y1, fn) { const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; for (;;) { fn(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }
  outline(c) { const w = this.w, h = this.h, s = this.p.slice(); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (s[i]) continue; if ((x > 0 && s[i - 1]) || (x < w - 1 && s[i + 1]) || (y > 0 && s[i - w]) || (y < h - 1 && s[i + w])) this.p[i] = c; } }
  blit(src, dx, dy) {
    for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
      const x = dx + i, y = dy + j; if (!this.in(x, y)) continue;
      const si = j * src.w + i, di = y * this.w + x, a = src.sh[si];
      if (a > 0) { if (this.p[di]) this.p[di] = darken(this.p[di], a); else this.sh[di] = Math.max(this.sh[di], a); }
      if (src.p[si]) this.p[di] = src.p[si];
    }
  }
}

/* ---------- terrain ---------- */
function grass(seed, kind) {
  const s = new Spr(16, 16), r = mkRng(seed), P = (x, y, c) => s.set(((x % 16) + 16) % 16, ((y % 16) + 16) % 16, c);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = r(); s.set(x, y, v < 0.13 ? G[1] : v < 0.2 ? G[3] : G[2]); }
  for (let i = 0; i < 6; i++) { const x = r() * 16 | 0, y = r() * 16 | 0; P(x, y, G[1]); P(x + 1, y, G[1]); P(x, y + 1, G[1]); }
  const tuft = (x, y) => { P(x - 1, y, G[1]); P(x, y, G[0]); P(x + 1, y, G[1]); P(x - 1, y - 1, G[3]); P(x + 1, y - 1, G[3]); P(x, y - 1, G[4]); P(x, y - 2, G[4]); P(x - 2, y - 2, G[3]); P(x + 2, y - 2, G[3]); };
  const n = kind === 'b' ? 4 : 1; for (let i = 0; i < n; i++) tuft(r() * 16 | 0, r() * 16 | 0);
  if (kind === 'c') for (let i = 0; i < 5; i++) { const x = r() * 16 | 0, y = r() * 16 | 0; P(x, y, i < 4 ? X[5] : '#dfe2e8'); P(x, y + 1, G[1]); if (i % 2) P(x + 1, y, '#c7b152'); }
  return s;
}
function dirt(seed, kind) {
  const s = new Spr(16, 16), r = mkRng(seed), P = (x, y, c) => s.set(((x % 16) + 16) % 16, ((y % 16) + 16) % 16, c);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = r(); s.set(x, y, v < 0.14 ? D[1] : v < 0.24 ? D[3] : D[2]); }
  for (let i = 0; i < 3; i++) { const cx = r() * 16 | 0, cy = r() * 16 | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 4 && r() < 0.55) P(cx + dx, cy + dy, D[1]); }
  if (kind === 'c') for (const b of [4, 11]) for (let x = 0; x < 16; x++) { P(x, b - 1, D[3]); P(x, b, D[1]); P(x, b + 1, x % 2 ? D[0] : D[1]); }
  const peb = (x, y) => { P(x, y, D[4]); P(x + 1, y, D[3]); P(x, y + 1, D[1]); P(x + 1, y + 1, D[0]); };
  const n = kind === 'b' ? 6 : 2; for (let i = 0; i < n; i++) peb(r() * 16 | 0, r() * 16 | 0);
  return s;
}
function fringe(s, dir, seed, dk = D[1], lt = D[3]) {
  const r = mkRng(seed); let depth = 2 + (r() * 2 | 0);
  const map = (t, d) => dir === 'n' ? [t, d] : dir === 's' ? [t, 15 - d] : dir === 'w' ? [d, t] : [15 - d, t];
  const lip = dir === 'n' || dir === 'w' ? dk : lt;
  for (let t = 0; t < 16; t++) {
    if (r() < 0.6) depth += r() < 0.5 ? -1 : 1; depth = Math.max(1, Math.min(4, depth));
    for (let d = 0; d <= depth; d++) {
      const [x, y] = map(t, d); let c;
      if (d === depth) c = lip;
      else if (d === depth - 1) c = r() < 0.25 ? G[4] : r() < 0.6 ? G[3] : G[2];
      else c = r() < 0.2 ? G[1] : G[2];
      s.set(x, y, c);
    }
  }
  return s;
}

function road(seed, kind) {
  const s = new Spr(16, 16), r = mkRng(seed), P = (x, y, c) => s.set(((x % 16) + 16) % 16, ((y % 16) + 16) % 16, c);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = r(); let c = v < 0.1 ? R[1] : v < 0.2 ? R[3] : R[2];
    if (hh(x >> 2, y >> 2, seed) < 0.3 && r() < 0.5) c = R[1];
    s.set(x, y, c);
  }
  const rut = (a, b) => { for (let t = 0; t < 16; t++) { const q = r(); const set = (u, c) => kind === 'h' ? P(t, u, c) : P(u, t, c); set(a - 1, R[3]); set(a, q < 0.7 ? R[1] : R[0]); set(b, q < 0.4 ? R[0] : R[1]); set(b + 1, R[3]); } };
  if (kind === 'h' || kind === 'v') { rut(3, 4); rut(11, 12); }
  if (kind === 'p') for (let i = 0; i < 2; i++) {
    const cx = 3 + r() * 10 | 0, cy = 3 + r() * 10 | 0, rx = 2 + (r() * 2 | 0);
    for (let y = -2; y <= 2; y++) for (let x = -rx - 1; x <= rx + 1; x++) {
      const d = (x / (rx + .5)) ** 2 + (y / 2) ** 2; if (d > 1.25) continue;
      P(cx + x, cy + y, d > 0.8 ? (y < 0 ? R[0] : R[4]) : d > 0.4 ? D[1] : D[0]);
    }
  }
  for (let i = 0; i < 4; i++) { const x = r() * 16 | 0, y = r() * 16 | 0; P(x, y, R[4]); P(x, y + 1, R[0]); }
  return s;
}
const roadEdge = (seed, kind, dirs) => { const s = road(seed, kind); dirs.forEach((d, i) => fringe(s, d, seed * 7 + i, R[0], R[4])); return s; };

/* ---------- trees ---------- */
function shadeBlobs(s, blobs, pal, seed, dark = 0.25) {
  let top = 1e9, bot = -1e9; blobs.forEach(b => { top = Math.min(top, b.y - b.r); bot = Math.max(bot, b.y + b.r); });
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    let best = null, bz = -1e9, cov = 0;
    for (const b of blobs) { const dx = (x + .5 - b.x) / b.r, dy = (y + .5 - b.y) / b.r, d2 = dx * dx + dy * dy; if (d2 < 1) { cov++; const z = b.z + Math.sqrt(1 - d2) * b.r; if (z > bz) { bz = z; best = { dx, dy, d2 }; } } }
    if (!best) continue;
    if (cov === 1 && best.d2 > 0.8 && hh(x, y, seed + 7) < 0.35) continue;
    const nz = Math.sqrt(1 - best.d2), l = -best.dx * 0.45 - best.dy * 0.55 + nz * 0.6;
    let v = (l + 0.35) / 1.3 - ((y - top) / (bot - top)) * dark + (hh(x, y, seed) - 0.5) * 0.25;
    if ((x * 7 + y * 13) % 5 === 0) v -= 0.08;
    s.set(x, y, pick(pal, v));
  }
}
function oak(seed) {
  const s = new Spr(32, 40);
  s.ellipseShadow(16, 36, 12, 3.5, 0.4);
  for (let y = 24; y <= 35; y++) for (let x = 14; x <= 17; x++) s.set(x, y, hh(x, y, seed) < 0.15 ? W[1] : [W[3], W[2], W[2], W[1]][x - 14]);
  s.set(13, 35, W[2]); s.set(13, 34, W[2]); s.set(18, 35, W[1]); s.set(18, 34, W[1]);
  shadeBlobs(s, [{ x: 16, y: 8, r: 6, z: 0 }, { x: 10, y: 11, r: 6, z: 0 }, { x: 22, y: 11, r: 6, z: 0 }, { x: 7, y: 17, r: 6, z: 2 }, { x: 25, y: 17, r: 6, z: 2 }, { x: 16, y: 15, r: 8, z: 3 }, { x: 11, y: 22, r: 5.5, z: 5 }, { x: 21, y: 22, r: 5.5, z: 5 }], L, seed);
  s.outline(OL); return s;
}
function pine(seed) {
  const s = new Spr(24, 44), cx = 12;
  s.ellipseShadow(12, 40, 9, 2.5, 0.4);
  for (let y = 31; y <= 40; y++) for (let x = 11; x <= 13; x++) s.set(x, y, [W[3], W[2], W[1]][x - 11]);
  s.set(10, 40, W[2]); s.set(14, 40, W[1]);
  const tiers = [{ t: 17, h: 16, w: 11 }, { t: 9, h: 14, w: 8.5 }, { t: 2, h: 12, w: 6 }];
  tiers.forEach((T, ti) => {
    for (let dy = 0; dy < T.h; dy++) {
      const y = T.t + dy, half = T.w * (dy + 1) / T.h + 0.3;
      for (let x = 0; x < 24; x++) {
        const ox = x + .5 - cx; if (Math.abs(ox) > half) continue;
        if (dy === T.h - 1 && x % 2 === 0) continue;
        let v = 0.62 - ox / T.w * 0.4 - (dy / T.h) * 0.45 + (hh(x, y, seed) - 0.5) * 0.25;
        if ((x * 3 + y * 5) % 7 === 0) v -= 0.15; if (dy < 1) v += 0.15;
        s.set(x, y, pick(PN, v));
      }
    }
    if (ti > 0) { const y = T.t + T.h; for (let x = 0; x < 24; x++) if (Math.abs(x + .5 - cx) <= T.w + 1) { if (s.get(x, y)) s.set(x, y, PN[0]); if (s.get(x, y + 1)) s.set(x, y + 1, PN[1]); } }
  });
  s.outline(OL); return s;
}
function deadTree(seed) {
  const s = new Spr(24, 36);
  s.ellipseShadow(13, 33, 8, 2.2, 0.35);
  for (let y = 14; y <= 33; y++) { const w = y > 28 ? 4 : y > 20 ? 3 : 2, x0 = 12 - (w >> 1); for (let i = 0; i < w; i++) s.set(x0 + i, y, i === 0 ? DW[3] : i === w - 1 ? DW[1] : DW[2]); }
  s.set(9, 33, DW[2]); s.set(10, 32, DW[2]); s.set(15, 33, DW[1]); s.set(14, 32, DW[1]);
  const br = (a, b, c, d) => s.line(a, b, c, d, (x, y) => { s.set(x, y, DW[2]); if (!s.get(x, y - 1)) s.set(x, y - 1, DW[3]); });
  br(12, 22, 6, 15); br(6, 15, 3, 9); br(6, 15, 8, 10); br(12, 18, 18, 11); br(18, 11, 20, 5); br(18, 11, 15, 7); br(12, 14, 11, 5); br(11, 5, 13, 2); br(11, 9, 8, 5);
  s.outline(OL); return s;
}
function bush(seed) {
  const s = new Spr(16, 14);
  s.ellipseShadow(8, 12, 7, 2, 0.35);
  shadeBlobs(s, [{ x: 5, y: 8, r: 4.5, z: 0 }, { x: 11, y: 8, r: 4.5, z: 0 }, { x: 8, y: 5.5, r: 4.5, z: 1 }, { x: 8, y: 9, r: 4, z: 2 }], L, seed, 0.3);
  const r = mkRng(seed); for (let i = 0; i < 4; i++) { const x = 4 + r() * 8 | 0, y = 4 + r() * 6 | 0; if (s.get(x, y)) { s.set(x, y, '#b3372e'); s.set(x, y - 1, '#e0685a'); } }
  s.outline(OL); return s;
}
function stump(seed) {
  const s = new Spr(16, 14);
  s.ellipseShadow(8, 11, 7, 2.2, 0.35);
  for (let y = 5; y <= 11; y++) for (let x = 3; x <= 12; x++) {
    const dx = (x + .5 - 8) / 5; if (Math.abs(dx) > 1 || y > 8 + Math.sqrt(1 - dx * dx) * 2.5) continue;
    let c = dx < -0.4 ? W[3] : dx < 0.3 ? W[2] : W[1]; if (hh(x, y, seed) < 0.2) c = dx > 0 ? W[0] : W[1]; s.set(x, y, c);
  }
  for (let y = 2; y <= 8; y++) for (let x = 2; x <= 13; x++) {
    const dx = (x + .5 - 8) / 5, dy = (y + .5 - 5) / 2.6, d = Math.sqrt(dx * dx + dy * dy); if (d > 1) continue;
    s.set(x, y, d > 0.85 ? W[3] : d < 0.3 ? '#8a6436' : d < 0.55 ? '#c79c63' : d < 0.7 ? '#a87d48' : '#d8b27a');
  }
  s.outline(OL); return s;
}

/* ---------- barricades ---------- */
const WT = {
  planks: {
    light: W[4], dark: W[1],
    face(x, fy) {
      if (x >= 6 && x <= 9) { if (fy === 0) return W[4]; return hh(x, fy, 3) < 0.12 ? W[1] : [W[3], W[2], W[2], W[1]][x - 6]; }
      const b = fy >> 2, ry = fy & 3, seam = (b * 7 + 3) % 16;
      if (x === seam || ry === 3) return W[0]; if (ry === 0) return W[3];
      if (ry === 1 && (x === seam + 1 || x === seam - 1)) return M[3];
      return hh(x, fy + b * 5, 11) < 0.14 ? W[1] : W[2];
    },
    cap(x, y) { const n = hh(x, y, 21); return n < 0.18 ? W[4] : n < 0.28 ? W[2] : W[3]; }
  },
  palisade: {
    light: W[4], dark: W[0], spikes: true,
    face(x, fy) {
      const lx = x & 3; let c = [W[3], W[2], W[2], W[1]][lx];
      if (hh(x, fy, 5) < 0.16) c = lx === 3 ? W[0] : W[1];
      if (fy === 3 || fy === 11) c = (x + fy) & 1 ? '#9a875a' : '#6f6040';
      if (fy === 4 || fy === 12) c = W[1];
      return c;
    },
    cap(x, y, vert) { const u = vert ? (y & 3) : (x & 3), v = vert ? x - 5 : y - 5; if ((u === 1 || u === 2) && v >= 1 && v <= 4) return hh(x, y, 9) < 0.5 ? W[4] : W[3]; return u === 0 ? W[1] : W[2]; }
  },
  sandbag: {
    light: S[3], dark: S[0],
    face(x, fy) {
      if (fy === 15) return S[0];
      const row = Math.floor(fy / 5), bx = (x + (row % 2) * 4) % 8, by = fy % 5;
      if (bx === 0 || by === 4) return S[0];
      if (by === 0) return bx === 1 || bx === 7 ? S[0] : S[3];
      if (bx === 7 || by === 3) return S[1];
      return hh(x, fy, 13) < 0.15 ? S[1] : S[2];
    },
    cap(x, y, vert) { const a = vert ? y : x, b = vert ? x : y; if ((a + (Math.floor(b / 3) % 2) * 4) % 8 === 0) return S[0]; if (b % 3 === 2) return S[1]; return hh(x, y, 17) < 0.2 ? S[3] : S[2]; }
  },
  scrap: {
    light: M[3], dark: M[0],
    face(x, fy) {
      const pi = Math.floor(x / 5), px = x % 5; if (px === 0) return M[0];
      const k = hh(pi, 0, 33), pc = k < 0.55 ? [M[3], M[2], M[1]] : k < 0.8 ? ['#7c9478', '#5d7560', '#43574a'] : ['#a86452', '#86493b', '#643428'];
      if ((fy === 2 || fy === 13) && px === 2) return '#c8ccd2';
      if (hh(x >> 1, fy >> 1, 44) < 0.3 && hh(x, fy, 45) < 0.6) return hh(x, fy, 46) < 0.5 ? X[2] : X[3];
      return pc[x % 3];
    },
    cap(x, y) { return hh(x, y, 51) < 0.2 ? '#3d3833' : '#2e2a26'; }
  }
};
WT.planks_dmg = {
  ...WT.planks,
  face(x, fy) {
    const inHole = (x >= 1 && x <= 4 && fy >= 4 + (hh(x, 0, 7) < .5 ? 1 : 0) && fy <= 10 - (hh(x, 1, 7) < .5 ? 1 : 0)) ||
      (x >= 11 && x <= 14 && fy >= 8 + (hh(x, 2, 7) < .5 ? 1 : 0) && fy <= 12);
    if (inHole) return null;
    if (fy >= 11 && hh(x, fy, 77) < 0.12 && !(x >= 6 && x <= 9)) return X[4];
    return WT.planks.face(x, fy);
  }
};
export function wall(type, c) {
  const t = WT[type], s = new Spr(16, 28);
  const top = (x, y) => {
    if (x < 0) return !!c.w && y >= 5 && y <= 10; if (x > 15) return !!c.e && y >= 5 && y <= 10;
    if (y < 0) return !!c.n && x >= 5 && x <= 10; if (y > 15) return !!c.s && x >= 5 && x <= 10;
    const cx = x >= 5 && x <= 10, cy = y >= 5 && y <= 10;
    if (cx && cy) return true; if (cx && y < 5) return !!c.n; if (cx && y > 10) return !!c.s;
    if (cy && x < 5) return !!c.w; if (cy && x > 10) return !!c.e; return false;
  };
  const faceCol = x => x < 5 ? !!c.w : x > 10 ? !!c.e : !c.s;
  const vert = (c.n || c.s) && !c.e && !c.w;
  for (let x = 0; x < 16; x++) if (faceCol(x)) {
    for (let fy = 0; fy < 16; fy++) { let col = t.face(x, fy); if (!col) continue; if (fy === 15) col = darken(col, 0.3); s.set(x, 11 + fy, col); }
    s.shade(x, 27, 0.45);
  }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (top(x, y)) {
    let col = t.cap(x, y, vert);
    if (!top(x, y - 1) || !top(x - 1, y)) col = t.light; else if (!top(x + 1, y)) col = t.dark;
    s.set(x, y, col);
  }
  if (t.spikes) for (const x of [3, 11]) if (faceCol(x) && faceCol(x + 1)) for (let y = 20; y <= 27; y++) { s.set(x, y, y >= 26 ? '#c9b48a' : y >= 23 ? W[3] : W[2]); s.set(x + 1, y, y >= 26 ? W[3] : W[1]); }
  s.outline(OL); return s;
}
const RING = { h: { e: 1, w: 1 }, v: { n: 1, s: 1 }, tl: { e: 1, s: 1 }, tr: { w: 1, s: 1 }, bl: { n: 1, e: 1 }, br: { n: 1, w: 1 } };
function wallSet(type) {
  const s = new Spr(80, 60);
  for (let ty = 0; ty < 3; ty++) for (let tx = 0; tx < 5; tx++) {
    const edgeX = tx === 0 || tx === 4, edgeY = ty === 0 || ty === 2; if (!edgeX && !edgeY) continue;
    const k = ty === 0 ? (tx === 0 ? 'tl' : tx === 4 ? 'tr' : 'h') : ty === 2 ? (tx === 0 ? 'bl' : tx === 4 ? 'br' : 'h') : 'v';
    s.blit(wall(type, RING[k]), tx * 16, ty * 16);
  }
  return s;
}

/* ---------- gates ---------- */
export function gate(kind, open) {
  const s = new Spr(32, 28), metal = kind === 'metal';
  const post = x0 => {
    for (let lx = 0; lx < 6; lx++) {
      const x = x0 + lx;
      for (let y = 3; y <= 26; y++) {
        let c;
        if (y <= 8) c = y === 3 || lx === 0 ? W[4] : lx === 5 ? W[1] : W[3];
        else { c = [W[3], W[3], W[2], W[2], W[1], W[1]][lx]; if (hh(x, y, 91) < 0.12) c = W[1]; if (y === 12 || y === 22) c = M[2]; if (y === 13 || y === 23) c = M[0]; if (y === 26) c = darken(c, 0.3); }
        s.set(x, y, c);
      }
      s.shade(x, 27, 0.45);
    }
  };
  post(0); post(26);
  const woodFace = (x, fy) => {
    if (x === 15) return W[0]; if (x === 16) return W[1];
    const left = x < 16, dx = left ? x - 6 : 25 - x;
    if ((dx <= 2) && (fy === 2 || fy === 3 || fy === 12 || fy === 13)) return fy % 2 === 0 ? M[2] : M[0];
    if (fy === 2 || fy === 12) return W[3]; if (fy === 3 || fy === 13) return W[1];
    if (fy > 3 && fy < 12) { if (dx === 15 - fy) return W[3]; if (dx === 16 - fy) return W[1]; }
    if ((x === 14 || x === 17) && (fy === 7 || fy === 8)) return M[3];
    const c = [W[3], W[2], W[1]][((left ? x - 6 : x - 16) % 3 + 3) % 3];
    return hh(x, fy, 93) < 0.12 ? W[1] : c;
  };
  const metalFace = (x, fy) => {
    if (x === 15) return M[0];
    const left = x < 16, dx = left ? x - 6 : x - 16;
    if (fy >= 11 && fy <= 14) return (x + fy) % 6 < 3 ? X[0] : X[1];
    if (fy === 0 || dx === 0) return M[3]; if (dx === 9) return M[0];
    if ((dx === 1 || dx === 8) && (fy === 2 || fy === 9)) return '#c8ccd2';
    if (fy === 5) return M[3]; if (fy === 6) return M[1];
    if (hh(x, fy, 95) < 0.07) return X[2];
    return hh(x, fy, 94) < 0.1 ? M[1] : M[2];
  };
  if (!open) {
    for (let x = 6; x <= 25; x++) {
      s.set(x, 9, metal ? M[3] : W[4]); s.set(x, 10, metal ? M[2] : W[2]);
      for (let fy = 0; fy < 16; fy++) { let c = metal ? metalFace(x, fy) : woodFace(x, fy); if (fy === 15) c = darken(c, 0.3); s.set(x, 11 + fy, c); }
      s.shade(x, 27, 0.45);
    }
  } else {
    for (const [d0, dir] of [[6, 1], [22, -1]]) for (let i = 0; i < 4; i++) {
      const x = d0 + i, k = dir > 0 ? i : 3 - i;
      for (let y = 2; y <= 22; y++) {
        let c;
        if (y <= 3) c = metal ? M[3] : (y === 2 ? W[4] : W[3]);
        else if (metal) c = y >= 18 && y <= 20 ? ((x + y) % 4 < 2 ? X[0] : X[1]) : [M[2], M[1], M[1], M[0]][k];
        else c = y === 7 || y === 16 ? W[3] : y === 8 || y === 17 ? W[0] : [W[2], W[2], W[1], W[0]][k];
        s.set(x, y, c);
      }
      for (let y = 23; y <= 26; y++) s.shade(x, y, 0.35);
    }
  }
  s.outline(OL); return s;
}

/* ---------- watch towers ---------- */
export function tower(roof) {
  const s = new Spr(32, 56);
  for (let y = 44; y <= 55; y++) for (let x = 1; x <= 30; x++) s.shade(x, y, 0.28);
  for (let y = 28; y <= 44; y++) { s.set(6, y, W[1]); s.set(7, y, W[0]); s.set(24, y, W[1]); s.set(25, y, W[0]); }
  const brace = (a, b, c, d) => s.line(a, b, c, d, (x, y) => { s.set(x, y, W[2]); s.set(x, y + 1, W[1]); });
  brace(5, 31, 26, 50); brace(26, 31, 5, 50);
  for (let x = 5; x <= 26; x++) { s.set(x, 40, W[3]); s.set(x, 41, W[1]); }
  for (let y = 28; y <= 54; y++) for (let lx = 0; lx < 3; lx++) { const c = y === 54 ? W[0] : [W[3], W[2], W[1]][lx]; s.set(2 + lx, y, c); s.set(27 + lx, y, c); }
  const dk = roof ? [W[1], W[2], W[0]] : [W[3], W[4], W[1]];
  for (let y = 10; y <= 25; y++) for (let x = 1; x <= 30; x++) { const r = (y - 10) % 3; s.set(x, y, r === 2 ? dk[2] : hh(x, y, 61) < 0.2 ? dk[1] : dk[0]); }
  for (let x = 1; x <= 30; x++) { s.set(x, 26, W[2]); s.set(x, 27, W[1]); s.set(x, 28, W[0]); }
  for (let y = 22; y <= 25; y++) for (let x = 14; x <= 17; x++) s.set(x, y, W[0]);
  for (let y = 22; y <= 54; y++) { s.set(13, y, W[3]); s.set(18, y, W[1]); }
  for (let y = 30; y <= 53; y += 4) for (let x = 14; x <= 17; x++) { s.set(x, y, W[4]); s.set(x, y + 1, W[1]); }
  if (!roof) {
    for (let y = 11; y <= 15; y++) for (let x = 21; x <= 26; x++) s.set(x, y, y <= 12 ? (x === 21 ? W[4] : W[3]) : (x === 26 ? W[1] : (x + y) % 5 === 0 ? W[1] : W[2]));
    for (let x = 1; x <= 30; x++) { s.set(x, 5, W[3]); s.set(x, 6, W[1]); s.set(x, 8, W[2]); }
    for (const x of [1, 15, 30]) for (let y = 5; y <= 10; y++) s.set(x, y, x === 30 ? W[1] : W[2]);
  }
  for (let y = 5; y <= 22; y++) { s.set(1, y, W[3]); s.set(30, y, W[1]); }
  for (let x = 1; x <= 30; x++) if (x < 13 || x > 18) { s.set(x, 18, W[4]); s.set(x, 19, W[1]); s.set(x, 21, W[3]); s.set(x, 22, W[1]); }
  for (const x of [1, 8, 23, 30]) for (let y = 18; y <= 25; y++) s.set(x, y, x === 30 ? W[1] : W[3]);
  if (roof) {
    for (let y = 12; y <= 25; y++) { s.set(2, y, W[3]); s.set(3, y, W[1]); s.set(28, y, W[3]); s.set(29, y, W[1]); }
    for (let y = 0; y <= 11; y++) for (let x = 0; x <= 31; x++) {
      let c = [M[3], M[2], M[1]][x % 3]; if (y === 0) c = M[3];
      if (hh(x >> 1, y >> 1, 71) < 0.25 && hh(x, y, 72) < 0.7) c = hh(x, y, 73) < 0.5 ? X[2] : X[3];
      s.set(x, y, c);
    }
    for (let x = 0; x <= 31; x++) { s.set(x, 12, M[0]); s.set(x, 13, x % 3 === 0 ? M[1] : M[0]); }
  }
  s.outline(OL); return s;
}

function palette() {
  const ramps = [G, D, R, W, L, PN, DW, M, S, X], s = new Spr(30, ramps.length * 6);
  ramps.forEach((r, j) => r.forEach((c, i) => { for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) s.set(i * 6 + x, j * 6 + y, c); }));
  return s;
}

export function buildAll() {
  const A = {};
  A.grass_a = grass(11, 'a'); A.grass_b = grass(23, 'b'); A.grass_c = grass(37, 'c');
  A.dirt_a = dirt(5, 'a'); A.dirt_b = dirt(19, 'b'); A.dirt_c = dirt(29, 'c');
  ['n', 'e', 's', 'w'].forEach((d, i) => { A['edge_' + d] = fringe(dirt(5, 'a'), d, 100 + i); });
  A.road_h = road(41, 'h'); A.road_v = road(42, 'v'); A.road_x = road(43, 'x'); A.road_p = road(44, 'p');
  ['n', 'e', 's', 'w'].forEach((d, i) => { A['road_edge_' + d] = roadEdge(50 + i, d === 'n' || d === 's' ? 'h' : 'v', [d]); });
  [['nw', ['n', 'w']], ['ne', ['n', 'e']], ['sw', ['s', 'w']], ['se', ['s', 'e']]].forEach(([k, ds], i) => { A['road_corner_' + k] = roadEdge(60 + i, 'x', ds); });
  A.tree_oak = oak(3); A.tree_pine = pine(4); A.tree_dead = deadTree(5); A.bush = bush(6); A.stump = stump(7);
  for (const t of ['planks', 'palisade', 'sandbag', 'scrap']) { for (const k in RING) A[`wall_${t}_${k}`] = wall(t, RING[k]); A['set_' + t] = wallSet(t); }
  A.wall_planks_dmg = wall('planks_dmg', { e: 1, w: 1 });
  A.gate_wood_closed = gate('wood', false); A.gate_wood_open = gate('wood', true);
  A.gate_metal_closed = gate('metal', false); A.gate_metal_open = gate('metal', true);
  A.tower_open = tower(false); A.tower_roofed = tower(true);
  A.palette = palette();
  return A;
}

/* ---------- scene ---------- */
export function scene(seed) {
  const TW = 26, TH = 17, s = new Spr(TW * 16, TH * 16), r = mkRng(seed);
  const X0 = 6, Y0 = 3, X1 = 19, Y1 = 11, GX = 12;
  const patches = new Set(); for (let i = 0; i < 4; i++) patches.add((r() * TW | 0) + ',' + (r() * TH | 0));
  const RY = 14;
  const isRoad = (x, y) => x >= 0 && y >= 0 && x < TW && y < TH && ((y === RY || y === RY + 1) || ((x === GX || x === GX + 1) && y > Y1) || ((x === GX || x === GX + 1) && y > Y0 && y < Y1));
  const isDirt = (x, y) => {
    if (x < 0 || y < 0 || x >= TW || y >= TH || isRoad(x, y)) return false;
    if (x >= X0 && x <= X1 && y >= Y0 && y <= Y1) return true;
    return patches.has(x + ',' + y);
  };
  const isGrass = (x, y) => x >= 0 && y >= 0 && x < TW && y < TH && !isRoad(x, y) && !isDirt(x, y);
  const gv = [grass(11, 'a'), grass(12, 'a'), grass(13, 'a'), grass(23, 'b'), grass(24, 'b'), grass(37, 'c')];
  const N = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    if (isRoad(x, y)) {
      const hz = y === RY || y === RY + 1, vt = x === GX || x === GX + 1;
      const t = road(2000 + x * 29 + y * 13, hz && vt ? 'x' : r() < 0.12 ? 'p' : hz ? 'h' : 'v');
      for (const d in N) if (isGrass(x + N[d][0], y + N[d][1])) fringe(t, d, x * 97 + y * 53 + d.charCodeAt(0), R[0], R[4]);
      s.blit(t, x * 16, y * 16);
    } else if (isDirt(x, y)) {
      const t = dirt(1000 + x * 31 + y * 17, r() < 0.2 ? 'b' : 'a');
      for (const d in N) if (isGrass(x + N[d][0], y + N[d][1])) fringe(t, d, x * 131 + y * 71 + d.charCodeAt(0));
      s.blit(t, x * 16, y * 16);
    } else { const v = r(); s.blit(v < 0.55 ? gv[r() * 3 | 0] : v < 0.88 ? gv[3 + (r() * 2 | 0)] : gv[5], x * 16, y * 16); }
  }
  const objs = [];
  const onRing = (x, y) => x >= X0 && x <= X1 && y >= Y0 && y <= Y1 && (x === X0 || x === X1 || y === Y0 || y === Y1);
  const isGate = (x, y) => y === Y1 && (x === GX || x === GX + 1);
  const solid = (x, y) => onRing(x, y);
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    if (!onRing(x, y) || isGate(x, y)) continue;
    const type = y === Y1 ? 'palisade' : y === Y0 ? (x === 10 ? 'planks_dmg' : 'planks') : x === X0 ? 'sandbag' : 'scrap';
    const c = { n: solid(x, y - 1), s: solid(x, y + 1), e: solid(x + 1, y), w: solid(x - 1, y) };
    objs.push({ spr: wall(type, c), x: x * 16, y: y * 16 - 16, key: y * 16 + 16 });
  }
  objs.push({ spr: gate('wood', false), x: GX * 16, y: Y1 * 16 - 16, key: Y1 * 16 + 16 });
  objs.push({ spr: tower(false), x: (X0 + 1) * 16, y: (Y0 + 3) * 16 - 56, key: (Y0 + 3) * 16 });
  objs.push({ spr: tower(true), x: (X1 - 2) * 16, y: (Y0 + 3) * 16 - 56, key: (Y0 + 3) * 16 });
  const trees = [[oak(3), .2], [oak(9), .16], [pine(4), .2], [pine(10), .16], [bush(6), .1], [bush(12), .06], [deadTree(5), .07], [stump(7), .05]];
  const placed = [];
  for (let i = 0; i < 400 && placed.length < 30; i++) {
    const tx = r() * TW | 0, ty = 1 + (r() * (TH - 1) | 0);
    if (tx >= X0 - 1 && tx <= X1 + 1 && ty >= Y0 - 1 && ty <= Y1 + 1) continue;
    if (tx >= GX - 2 && tx <= GX + 3 && ty > Y1) continue;
    if (isDirt(tx, ty) || isRoad(tx, ty) || isRoad(tx, ty + 1) || placed.some(p => Math.abs(p[0] - tx) < 2 && Math.abs(p[1] - ty) < 2)) continue;
    let v = r(), spr = trees[0][0]; for (const [t, w] of trees) { if (v < w) { spr = t; break; } v -= w; }
    placed.push([tx, ty]);
    objs.push({ spr, x: tx * 16 + 8 - (spr.w >> 1), y: ty * 16 + 18 - spr.h, key: ty * 16 + 16 });
  }
  objs.sort((a, b) => a.key - b.key || a.x - b.x).forEach(o => s.blit(o.spr, o.x, o.y));
  return s;
}

/* ---------- output ---------- */
export function draw(cv, s) {
  cv.width = s.w; cv.height = s.h;
  const ctx = cv.getContext('2d'), im = ctx.createImageData(s.w, s.h), d = im.data;
  for (let i = 0; i < s.p.length; i++) {
    const c = s.p[i];
    if (c) { const [r, g, b] = rgb(c); d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
    else if (s.sh[i] > 0) { d[i * 4] = 10; d[i * 4 + 1] = 8; d[i * 4 + 2] = 12; d[i * 4 + 3] = Math.round(s.sh[i] * 255); }
  }
  ctx.putImageData(im, 0, 0);
}
export function grid(cv, step) {
  const ctx = cv.getContext('2d'); ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let x = step; x < cv.width; x += step) ctx.fillRect(x, 0, 1, cv.height);
  for (let y = step; y < cv.height; y += step) ctx.fillRect(0, y, cv.width, 1);
}
const urlC = {};
export function tileURL(s, z) {
  const k = z; if (urlC[k]) return urlC[k];
  const a = document.createElement('canvas'); draw(a, s);
  const b = document.createElement('canvas'); b.width = s.w * z; b.height = s.h * z;
  const ctx = b.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(a, 0, 0, b.width, b.height);
  return (urlC[k] = b.toDataURL());
}
function save(cv, name) { cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }); }
export function download(s, name) { if (!s) return; const cv = document.createElement('canvas'); draw(cv, s); save(cv, name); }
export function exportAtlas(A, name = 'survival-tileset') {
  const keys = Object.keys(A).filter(k => !k.startsWith('set_') && k !== 'palette');
  const W_ = 256, gap = 2; let x = 0, y = 0, rowH = 0; const pos = {};
  for (const k of keys) { const s = A[k]; if (x + s.w > W_) { x = 0; y += rowH + gap; rowH = 0; } pos[k] = [x, y]; x += s.w + gap; rowH = Math.max(rowH, s.h); }
  const atlas = new Spr(W_, y + rowH);
  for (const k of keys) atlas.blit(A[k], pos[k][0], pos[k][1]);
  const cv = document.createElement('canvas'); draw(cv, atlas); save(cv, name + '.png');
  const meta = {}; keys.forEach(k => meta[k] = { x: pos[k][0], y: pos[k][1], w: A[k].w, h: A[k].h });
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(meta, null, 1)], { type: 'application/json' })); a.download = name + '.json'; setTimeout(() => a.click(), 300);
}
