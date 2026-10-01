// Gunfire FX: muzzle flash, tracer, impacts, shell casing. Angle 0 = east, clockwise (screen y down).
import { Spr, mkRng } from './pixel-assets-v2.js';
const FL = ['#fffbe6', '#f8e08a', '#e8a840', '#b8602a'];
const SMK = ['#5e5a50', '#7a7668', '#9a9684'];
const TR = ['#fffbe6', '#f4d468', '#d8983a', '#9a5a28'];
const BLD = ['#3e1410', '#5e2218', '#86321f', '#a84a2c'];
const BR = ['#3a2a12', '#8a6a2a', '#c4a24a', '#e2c878'];
export const DIR16 = ['E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N', 'NNE', 'NE', 'ENE'];

const paint = (s, fn) => { for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const c = fn(x + .5 - s.w / 2, y + .5 - s.h / 2); if (c) s.set(x, y, c); } };
const rot = a => { const c = Math.cos(a), n = Math.sin(a); return (dx, dy) => [dx * c + dy * n, -dx * n + dy * c]; };
const P = (s, x, y, c) => s.set(8 + x, 8 + y, c);
const seg = (s, ang, r0, r1, dy, cT, cH) => {
  const c = Math.cos(ang), n = Math.sin(ang);
  const x0 = Math.floor(8 + c * r0), y0 = Math.floor(8 + n * r0 + dy), x1 = Math.floor(8 + c * r1), y1 = Math.floor(8 + n * r1 + dy);
  s.line(x0, y0, x1, y1, (x, y) => s.set(x, y, cT)); s.set(x1, y1, cH);
};

function flash(a, f) {
  const s = new Spr(16, 16), R = rot(a);
  if (f < 2) {
    const L = [4.5, 7.5][f], W0 = [1.5, 2.4][f];
    paint(s, (dx, dy) => {
      const [u, v] = R(dx, dy), av = Math.abs(v); let e = 9;
      if (u > -1.2 && u < L) { const w = W0 * (1 - Math.max(0, u) / L) + 0.45; if (av < w) e = Math.max(av / w, Math.max(0, u) / L); }
      const pl = L * 0.62; if (u > 0.5 && u < pl && Math.abs(av - u * 0.85) < 0.5) e = Math.min(e, 0.5 + (u / pl) * 0.45);
      if (e > 1) return null;
      return FL[Math.max(0, Math.min(3, Math.floor(e * 4 - (f ? 0 : 0.6))))];
    });
  } else {
    const bl = [[1.5, 0, 1.8], [3.6, -0.7, 1.4], [3.8, 0.9, 1.2], [5.4, 0.2, 0.9]];
    paint(s, (dx, dy) => {
      const [u, v] = R(dx, dy);
      for (const [bu, bv, br] of bl) { const d = Math.hypot(u - bu, v - bv); if (d < br) return d < br * 0.45 ? SMK[2] : dy < 0 ? SMK[1] : SMK[0]; }
      return null;
    });
    const c = Math.cos(a), n = Math.sin(a); s.set(Math.floor(8 + c * 6.5), Math.floor(8 + n * 6.5), FL[2]);
  }
  return s;
}

function tracer(a, f) {
  const s = new Spr(16, 16), R = rot(a), head = 4.5, tail = f ? -3.5 : -5.5;
  paint(s, (dx, dy) => {
    const [u, v] = R(dx, dy), av = Math.abs(v);
    if (u < tail || u > head) return null;
    if (av > 0.55) return u > head - 1.6 && av < 0.95 ? TR[2] : null;
    const t = (u - tail) / (head - tail);
    return TR[t > 0.8 ? 0 : t > 0.55 ? 1 : t > 0.25 ? 2 : 3];
  });
  return s;
}

const sprays = (a, seed, count, spread) => { const r = mkRng(seed); return Array.from({ length: count }, () => ({ ang: a + (r() - .5) * spread, k: 0.75 + r() * 0.6, keep: r() < 0.55 })); };

function spark(a, f) {
  const s = new Spr(16, 16), sp = sprays(a + Math.PI, 1000 + Math.round(a * 1000), 6, 2.4);
  if (f === 0) paint(s, (dx, dy) => { const d = Math.hypot(dx, dy); return d < 1.1 ? FL[0] : d < 2.6 && (Math.abs(dx) < 0.6 || Math.abs(dy) < 0.6) ? FL[1] : null; });
  if (f === 1) { paint(s, (dx, dy) => Math.hypot(dx, dy) < 1.1 ? FL[1] : null); sp.forEach(p => seg(s, p.ang, 1.4 * p.k, 3.8 * p.k, 0, FL[2], FL[0])); }
  if (f === 2) { paint(s, (dx, dy) => { const d = Math.hypot(dx, dy); return d < 1.7 ? (dy < 0 ? SMK[1] : SMK[0]) : null; }); sp.forEach(p => seg(s, p.ang, 4 * p.k, 5.8 * p.k, 0.7, FL[3], FL[1])); }
  if (f === 3) { paint(s, (dx, dy) => { const d = Math.hypot(dx, dy); return d < 1.4 || (d < 2.5 && (Math.floor(dx + 8) + Math.floor(dy + 8)) % 2) ? SMK[0] : null; }); sp.filter(p => p.keep).forEach(p => P(s, Math.cos(p.ang) * 6.4 * p.k, Math.sin(p.ang) * 6.4 * p.k + 1.6, FL[3])); }
  return s;
}

function blood(a, f) {
  const s = new Spr(16, 16), sp = sprays(a, 2000 + Math.round(a * 1000), 7, 1.8).concat(sprays(a + Math.PI, 3000 + Math.round(a * 1000), 2, 1.2));
  if (f === 0) { paint(s, (dx, dy) => { const d = Math.hypot(dx, dy); return d < 0.9 ? BLD[3] : d < 1.9 ? BLD[2] : null; }); s.outline(BLD[0]); }
  if (f === 1) { paint(s, (dx, dy) => Math.hypot(dx, dy) < 1.3 ? BLD[1] : null); sp.forEach(p => seg(s, p.ang, 1.6 * p.k, 2.8 * p.k, 0, BLD[2], BLD[3])); }
  if (f === 2) { paint(s, (dx, dy) => Math.hypot(dx, dy) < 0.8 ? BLD[1] : null); sp.forEach(p => P(s, Math.cos(p.ang) * 4.6 * p.k, Math.sin(p.ang) * 4.6 * p.k + 0.8, BLD[2])); }
  if (f === 3) sp.filter(p => p.keep).forEach(p => P(s, Math.cos(p.ang) * 6 * p.k, Math.sin(p.ang) * 6 * p.k + 2, BLD[1]));
  return s;
}

function casing(f) {
  const s = new Spr(8, 8), R = rot(f * Math.PI / 4);
  paint(s, (dx, dy) => { const [u, v] = R(dx, dy); if (Math.abs(u) > 1.6 || Math.abs(v) > 0.8) return null; return u > 0.9 ? BR[1] : v < 0 ? BR[3] : BR[2]; });
  s.outline(BR[0]); return s;
}

export const FX = {
  flash: { name: 'Muzzle flash', fn: flash, nf: 3 },
  tracer: { name: 'Tracer', fn: tracer, nf: 2 },
  spark: { name: 'Impact · hard surface', fn: spark, nf: 4 },
  blood: { name: 'Impact · flesh', fn: blood, nf: 4 },
};
export function buildGunfire(n = 16) {
  const frames = {}, sheets = {};
  for (const k in FX) {
    const nf = FX[k].nf, sh = new Spr(16 * nf, 16 * n); frames[k] = [];
    for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n; frames[k][i] = []; for (let f = 0; f < nf; f++) { const s = FX[k].fn(a, f); frames[k][i][f] = s; sh.blit(s, f * 16, i * 16); } }
    sheets['gunfire_' + k] = sh;
  }
  frames.casing = [0, 1, 2, 3].map(casing);
  const cs = new Spr(32, 8); frames.casing.forEach((s, f) => cs.blit(s, f * 8, 0)); sheets.gunfire_casing = cs;
  return { frames, sheets };
}
