// Molotov FX: tumbling bottle, shatter/ignite splash, looping ground fire, burnout, burning zombie sheets.
import { Spr, OL, W } from './pixel-assets-v2.js';
const FC = ['#fff6c8', '#f8d060', '#e8902e', '#c0501e', '#7a2a14'];
const GL = ['#223020', '#3e5a3a', '#5a7a4a', '#9ab87a', '#c8dca0'];
const FU = ['#8a5a22', '#b07a30'];
const SMK = ['#3a3630', '#524c44', '#6e685c'];
const SC = ['#1e1a16', '#2c2620', '#3a322a'];

const hs = (x, y, s) => { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
const lerp = (a, b, t) => a + (b - a) * t;
function vn(x, y, s, py) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, g = (a, b) => hs(a, ((b % py) + py) % py, s);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return lerp(lerp(g(xi, yi), g(xi + 1, yi), u), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), u), v);
}
// rising noise, seamless over N frames
const fbm = (x, y, seed, f, N) => { const P = 4, sc = f / N * P * 6; return vn(x / 6, (y + sc) / 6, seed, P) * 0.65 + vn(x / 3, (y + sc) / 3, seed + 9, P * 2) * 0.35; };
const flameC = I => I > 0.86 ? FC[0] : I > 0.66 ? FC[1] : I > 0.46 ? FC[2] : I > 0.28 ? FC[3] : null;
const hx = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), mixC = {};
const mix = (a, b, t) => { const k = a + b + t; if (mixC[k]) return mixC[k]; const A = hx(a), B = hx(b); return (mixC[k] = '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')); };
const rot = a => { const c = Math.cos(a), n = Math.sin(a); return (dx, dy) => [dx * c + dy * n, -dx * n + dy * c]; };

/* ---------- bottle ---------- */
function bottle(f) {
  const s = new Spr(14, 14), a = f * Math.PI / 4, R = rot(a);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
    const [u, v] = R(x + .5 - 7, y + .5 - 7), av = Math.abs(v); let c = null;
    if (u >= -4 && u < 1.2 && av < 1.7) c = v < -0.6 ? GL[3] : u < -0.8 ? (v > 0.6 ? FU[0] : FU[1]) : GL[2];
    else if (u >= 1.2 && u < 3.4 && av < 0.8) c = GL[2];
    else if (u >= 3.4 && u < 4.8 && av < 1.1) c = v > 0 ? W[2] : W[4];
    if (c) s.set(x, y, c);
  }
  s.outline(OL);
  const tx = Math.floor(7 + Math.cos(a) * 4.4), ty = Math.floor(7 + Math.sin(a) * 4.4);
  s.set(tx, ty, FC[1]); s.set(tx, ty - 1, FC[0]); s.set(tx, ty - 2, FC[1]); s.set(tx + (f % 2 ? 1 : -1), ty - 1, FC[2]);
  if (f % 2 === 0) s.set(tx, ty - 3, FC[3]); else s.set(tx - 1, ty - 2, FC[3]);
  return s;
}
function shadow() { const s = new Spr(10, 4); s.ellipseShadow(5, 2, 4.5, 1.8, 0.4); return s; }

/* ---------- ground fire ---------- */
const FW = 40, FH = 32, GX = 20, GY = 24;
function fire(s, f, N, o) {
  const { rx, ry = rx * 0.36, H, boost = 0, seed = 5, ground = 'fuel', embers = 1 } = o;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const dx = x + .5 - GX, dy = y + .5 - GY, e = (dx / rx) ** 2 + (dy / ry) ** 2;
    if (e < 1 && !s.get(x, y)) {
      if (ground === 'fuel') s.set(x, y, e < 0.45 ? FC[4] : hs(x, y, seed + f) < 0.12 * embers ? FC[3] : '#4a2016');
      else s.set(x, y, hs(x, y, seed + f) < 0.08 * embers ? FC[3] : e < 0.5 ? SC[0] : e < 0.8 ? SC[1] : SC[2]);
    }
    if (H <= 0 || Math.abs(dx) >= rx) continue;
    const q = 1 - (dx / rx) ** 2, base = GY + ry * Math.sqrt(q) * 0.5;
    const Hc = H * Math.pow(q, 0.7) * (0.7 + 0.6 * vn(x / 5, 0, seed + 3, 99));
    if (y > base || Hc < 1) continue;
    const r = (base - y) / Hc, I = 1 - r + (fbm(x, y, seed, f, N) - 0.5) * 1.1 + boost;
    const c = flameC(I); if (c) s.set(x, y, c);
  }
}
function smoke(s, cy, rad, seed, light) {
  const bl = [[-3, 0, rad], [2, -2, rad * 0.85], [0, -4, rad * 0.7]];
  for (const [bx, by, br] of bl) for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const d = Math.hypot(x + .5 - GX - bx, y + .5 - cy - by); if (d > br || s.get(x, y)) continue;
    if (d > br * 0.75 && hs(x, y, seed) < 0.5) continue;
    s.set(x, y, d < br * 0.4 ? SMK[light ? 2 : 1] : SMK[light ? 1 : 0]);
  }
}
function firePatch(f) { const s = new Spr(FW, FH); fire(s, f, 8, { rx: 14, H: 14 }); return s; }

function splash(f) {
  const s = new Spr(FW, FH), sh = [];
  for (let i = 0; i < 8; i++) sh.push({ a: (i / 8) * Math.PI * 2 + hs(i, 1, 77) * 0.6, k: 0.7 + hs(i, 2, 77) * 0.6, c: i % 3 ? GL[3] : GL[4] });
  const shard = (r, drop, keep) => sh.forEach((p, i) => { if (i % 2 && !keep) return; s.set(GX + Math.cos(p.a) * r * p.k, GY - 2 + Math.sin(p.a) * r * p.k * 0.55 + drop, p.c); });
  const fuel = (r, n) => { for (let i = 0; i < n; i++) { const a = hs(i, 3, 91) * Math.PI * 2, k = 0.5 + hs(i, 4, 91) * 0.6; s.set(GX + Math.cos(a) * r * k, GY - 1 + Math.sin(a) * r * k * 0.5, i % 2 ? FU[1] : FU[0]); } };
  if (f === 0) { shard(3, 0, true); fuel(4, 10); s.set(GX, GY - 2, FC[0]); s.set(GX - 1, GY - 2, FC[1]); s.set(GX, GY - 3, FC[1]); }
  if (f === 1) { shard(7, 1, true); fire(s, 1, 8, { rx: 8, H: 8, boost: 0.1 }); fuel(10, 14); }
  if (f === 2) { fire(s, 2, 8, { rx: 10, H: 20, boost: 0.2 }); shard(11, 3, false); }
  if (f === 3) { smoke(s, GY - 21, 3.2, 3, false); fire(s, 3, 8, { rx: 12, H: 17, boost: 0.1 }); }
  if (f === 4) { smoke(s, GY - 24, 3.6, 4, true); fire(s, 4, 8, { rx: 13.5, H: 15 }); }
  if (f === 5) { fire(s, 5, 8, { rx: 14, H: 14 }); }
  return s;
}
function burnout(f) {
  const s = new Spr(FW, FH), H = [10, 6, 3, 0][f], rx = [14, 13.5, 13, 13][f];
  fire(s, f, 8, { rx, H, ground: f < 2 ? 'fuel' : 'scorch', embers: [1, 0.8, 0.6, 0][f] });
  if (f === 1 || f === 2) smoke(s, GY - 10 - f * 3, 2.6, 11 + f, true);
  return s;
}

/* ---------- burning zombies ---------- */
function burning(zf, f, seed) {
  const s = new Spr(zf.w, zf.h), m = (x, y) => zf.in(x, y) && !!zf.p[y * zf.w + x];
  for (let i = 0; i < zf.p.length; i++) { const c = zf.p[i]; s.p[i] = c && c !== OL ? mix(c, '#2a1c14', 0.4) : c; s.sh[i] = zf.sh[i]; }
  let bot = 0; for (let y = zf.h - 1; y >= 0 && !bot; y--) for (let x = 0; x < zf.w; x++) if (m(x, y)) { bot = y; break; }
  for (let y = 0; y < zf.h; y++) for (let x = 0; x < zf.w; x++) {
    if (y > bot - 3) continue;
    let d = -1; for (let k = 0; k <= 5; k++) if (m(x, y + k)) { d = k; break; }
    if (d < 0) continue;
    const I = (fbm(x, y, seed, f, 4) - 0.3) * 1.9 - d * 0.16, c = flameC(I);
    if (c) s.set(x, y, c); else if (d === 0 && I > 0.12 && zf.p[y * zf.w + x] !== OL) s.set(x, y, FC[4]);
  }
  return s;
}

export function buildMolotov(Z) {
  const frames = {}, sheets = {};
  const strip = (arr, w, h) => { const sh = new Spr(w * arr.length, h); arr.forEach((a, i) => sh.blit(a, i * w, 0)); return sh; };
  frames.bottle = [0, 1, 2, 3, 4, 5, 6, 7].map(bottle); sheets.molotov_bottle = strip(frames.bottle, 14, 14);
  frames.shadow = [shadow()]; sheets.molotov_shadow = frames.shadow[0];
  frames.splash = [0, 1, 2, 3, 4, 5].map(splash); sheets.molotov_splash = strip(frames.splash, FW, FH);
  frames.fire = [0, 1, 2, 3, 4, 5, 6, 7].map(firePatch); sheets.molotov_fire = strip(frames.fire, FW, FH);
  frames.burnout = [0, 1, 2, 3].map(burnout); sheets.molotov_burnout = strip(frames.burnout, FW, FH);
  sheets.molotov_scorch = frames.burnout[3];
  const DIRS = ['s', 'n', 'e', 'w', 'se', 'sw', 'ne', 'nw'];
  frames.burn = {};
  Object.keys(Z).forEach((k, ti) => {
    const F = {}, sh = new Spr(96, 224);
    DIRS.forEach((d, r) => { F[d] = Z[k][d].map((zf, f) => burning(zf, f, 40 + ti * 7 + r)); F[d].forEach((fr, c) => sh.blit(fr, c * 24, r * 28)); });
    frames.burn[k] = F; sheets['zombie_' + k + '_burning'] = sh;
  });
  return { frames, sheets, anchor: { fire: [GX, GY] } };
}
