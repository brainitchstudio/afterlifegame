// Neutral world buildings — abandoned structures for filling the map outside the base. Same grid, palette and outline rules as pixel-buildings.
import { Spr, D, R, W, PN, DW, M, X, dress } from './pixel-assets-v2.js';
import { H } from './pixel-buildings.js';
const { hh, dk, rect, shadeRect, dkRow, plank, brick, plaster, concrete, corr, gable, corrGable, win, door, B, P, RF, RC, GL } = H;
let SEA = 'summer';
const CH = ['#1c1a17', '#2a2622', '#3a342d', '#4c443a', '#5e5446'];
const RB = ['#3e1e1a', '#5a2a22', '#743a2c', '#8a4a36', '#a05c42'];
const VOID = '#16140f', VOID2 = '#0e0d0b';

/* ---------- farmhouse · 3×3 ---------- */
function house() {
  const s = new Spr(48, 60);
  shadeRect(s, 5, 54, 47, 59, 0.32);
  rect(s, 3, 30, 44, 53, plaster);
  for (const x0 of [3, 43]) rect(s, x0, 30, x0 + 1, 53, x => x === x0 ? P[3] : P[1]);
  rect(s, 3, 50, 44, 53, (x, y) => y === 50 ? B[3] : (x + (y % 2) * 3) % 6 === 0 ? B[0] : B[1]);
  gable(s, 1, 6, 46, 29, 13, RF);
  for (const [hx, hy] of [[12, 20], [13, 20], [13, 21], [30, 24], [31, 24], [31, 25]]) s.set(hx, hy, W[0]);
  rect(s, 34, 0, 38, 9, (x, y) => y === 0 ? R[3] : y === 1 ? R[1] : brick(34, 2)(x, y));
  dkRow(s, 3, 44, 30, 0.4); dkRow(s, 3, 44, 31, 0.2);
  win(s, 6, 36, 8, 8, true); win(s, 34, 36, 8, 8);
  door(s, 20, 38, 8, 16);
  rect(s, 16, 33, 31, 34, (x, y) => y === 33 ? W[4] : W[2]);
  shadeRect(s, 16, 35, 31, 35, 0.3);
  for (const px of [16, 30]) rect(s, px, 35, px + 1, 53, x => x === px ? W[3] : W[1]);
  rect(s, 15, 54, 32, 55, (x, y) => y === 54 ? W[4] : W[1]);
  return dress(s, SEA);
}

/* ---------- burned house · 3×2 ---------- */
function burnt() {
  const s = new Spr(48, 46);
  shadeRect(s, 5, 40, 47, 45, 0.32);
  rect(s, 3, 20, 44, 39, plank(20, CH));
  gable(s, 1, 4, 46, 19, 9, RF);
  rect(s, 1, 4, 46, 19, (x, y) => { const c = s.get(x, y); return c ? dk(c, 0.25 + hh(x >> 1, y >> 1, 202) * 0.35) : c; });
  const inHole = (x, y) => { const ex = (x - 24) / 11.5, ey = (y - 13) / 7; return y >= 6 && ex * ex + ey * ey <= 1 + (hh(x, y, 203) - 0.5) * 0.3; };
  rect(s, 12, 5, 36, 19, (x, y) => inHole(x, y) ? (y % 5 === 0 ? VOID2 : VOID) : s.get(x, y));
  for (const rx of [15, 21, 27, 32]) for (let y = 6; y <= 19; y++) if (inHole(rx, y)) { s.set(rx, y, CH[4]); s.set(rx + 1, y, CH[2]); }
  dkRow(s, 3, 44, 20, 0.4); dkRow(s, 3, 44, 21, 0.2);
  const gap = (x0, y0, w, h) => {
    for (let x = x0 - 1; x <= x0 + w; x++) for (let y = y0 - 4; y < y0; y++) if (hh(x, y, 204) < 0.6 && s.get(x, y)) s.set(x, y, dk(s.get(x, y), 0.45));
    rect(s, x0, y0, x0 + w - 1, y0 + h - 1, (x, y) => y === y0 ? VOID2 : VOID);
  };
  gap(7, 26, 7, 6); gap(34, 26, 7, 6); gap(20, 27, 8, 13);
  s.line(35, 27, 38, 31, (x, y) => { s.set(x, y, CH[3]); });
  for (let i = 0; i < 12; i++) { const x = 2 + (hh(i, 1, 205) * 42 | 0), y = 37 + (hh(i, 2, 205) * 4 | 0); s.set(x, y, B[2]); s.set(x + 1, y, B[1]); s.set(x, y + 1, CH[1]); }
  return dress(s, SEA);
}

/* ---------- gas station · 4×3 ---------- */
function gasStation() {
  const s = new Spr(64, 64);
  rect(s, 0, 40, 63, 61, (x, y) => { if (y === 61) return R[0]; if (x % 16 === 0 || y === 50) return R[1]; const n = hh(x, y, 211); return n < 0.1 ? R[1] : n < 0.92 ? R[2] : R[3]; });
  for (const [cx, cy, r] of [[22, 57, 3], [46, 47, 2.5]]) for (let y = cy - 2; y <= cy + 2; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { const dx = (x - cx) / r, dy = (y - cy) / 2; if (dx * dx + dy * dy <= 1 && hh(x, y, 212) < 0.8) s.set(x, y, dk(s.get(x, y), 0.35)); }
  rect(s, 3, 6, 50, 19, concrete(213));
  rect(s, 3, 6, 50, 7, (x, y) => y === 6 ? P[3] : P[2]);
  for (let y = 6; y <= 19; y++) { s.set(3, y, P[3]); s.set(50, y, P[1]); }
  rect(s, 36, 9, 43, 14, (x, y) => y === 9 ? M[3] : y === 14 ? M[0] : x === 36 ? M[3] : y >= 11 && y <= 12 && x > 37 && x < 42 && x % 2 ? M[0] : M[2]);
  shadeRect(s, 44, 10, 45, 15, 0.3);
  rect(s, 3, 20, 50, 39, plaster);
  rect(s, 3, 20, 50, 24, (x, y) => y === 20 ? RC[1] : y === 24 ? dk(RC[0], 0.3) : hh(x, y, 214) < 0.08 ? P[2] : RC[0]);
  for (let x = 12; x <= 41; x++) if ((x - 12) % 4 !== 3 && hh(x, 0, 215) > 0.2) s.set(x, 22, P[3]);
  dkRow(s, 3, 50, 25, 0.3);
  rect(s, 7, 27, 26, 36, M[1]);
  rect(s, 8, 28, 25, 35, (x, y) => { const d = (x - 8) - (y - 28); return d === 2 || d === 3 ? GL[2] : y < 32 ? GL[1] : GL[0]; });
  for (const x of [14, 20]) rect(s, x, 28, x, 35, M[1]);
  rect(s, 15, 30, 27, 31, (x, y) => y === 30 ? W[4] : W[2]);
  rect(s, 31, 27, 38, 39, M[2]);
  rect(s, 32, 28, 37, 39, (x, y) => x === 34 || x === 35 ? M[1] : y < 33 ? GL[1] : GL[0]);
  win(s, 42, 28, 6, 6, true);
  rect(s, 3, 38, 50, 39, (x, y) => y === 38 ? R[3] : R[1]);
  shadeRect(s, 4, 40, 52, 42, 0.3);
  const pump = px => {
    s.ellipseShadow(px + 3.5, 57, 6, 1.6, 0.35);
    rect(s, px - 2, 54, px + 9, 56, (x, y) => y === 54 ? R[4] : y === 56 ? R[1] : R[3]);
    rect(s, px, 44, px + 7, 55, (x, y) => y === 44 ? RC[1] : y === 45 ? dk(RC[0], 0.2) : y >= 47 && y <= 49 && x >= px + 2 && x <= px + 5 ? (y === 47 ? GL[2] : GL[0]) : x === px ? RC[1] : x === px + 7 ? dk(RC[0], 0.35) : RC[0]);
    rect(s, px + 8, 47, px + 8, 52, M[0]); s.set(px + 9, 52, M[1]);
  };
  pump(14); pump(38);
  rect(s, 56, 12, 57, 40, x => x === 56 ? M[3] : M[1]);
  rect(s, 51, 1, 62, 12, (x, y) => x === 51 || x === 62 || y === 1 || y === 12 ? M[0] : y <= 5 ? RC[0] : hh(x, y, 216) < 0.1 ? P[2] : P[3]);
  for (const y of [7, 9]) for (let x = 53; x <= 60; x++) if (x % 3 !== 2 && hh(x, y, 217) > 0.2) s.set(x, y, M[0]);
  shadeRect(s, 57, 41, 60, 42, 0.3);
  return dress(s, SEA);
}

/* ---------- barn · 4×3 ---------- */
function barn() {
  const s = new Spr(64, 70);
  shadeRect(s, 5, 64, 63, 69, 0.32);
  rect(s, 3, 34, 60, 63, (x, y) => { const b = (x - 3) % 4; if (b === 3) return RB[1]; if (hh(x, y >> 1, 222) < 0.06) return P[1]; return b === 0 ? RB[4] : hh(x, y, 221) < 0.12 ? RB[2] : RB[3]; });
  corrGable(s, 1, 4, 62, 33, 12, 0.35, 221);
  dkRow(s, 3, 60, 34, 0.45); dkRow(s, 3, 60, 35, 0.25);
  for (const x0 of [3, 59]) rect(s, x0, 34, x0 + 1, 63, x => x === x0 ? P[3] : P[1]);
  rect(s, 27, 37, 36, 44, (x, y) => x === 27 || x === 36 || y === 37 || y === 44 ? P[3] : y >= 42 ? X[5] : VOID);
  for (let x = 28; x <= 35; x++) if (hh(x, 1, 223) < 0.5) s.set(x, 41, X[0]);
  rect(s, 18, 47, 45, 63, (x, y) => x === 18 || x === 45 || y === 47 || x === 31 || x === 32 ? P[3] : (x - 3) % 4 === 3 ? RB[1] : RB[2]);
  for (const [a, b] of [[19, 30], [33, 44]]) { s.line(a, 48, b, 63, (x, y) => s.set(x, y, P[2])); s.line(b, 48, a, 63, (x, y) => s.set(x, y, P[2])); }
  for (let i = 0; i < 14; i++) { const x = 20 + (hh(i, 3, 224) * 24 | 0); s.set(x, 63, X[5]); s.set(x + 1, 63, X[0]); }
  rect(s, 16, 64, 47, 65, (x, y) => y === 64 ? D[3] : D[1]);
  return dress(s, SEA);
}

/* ---------- chapel · 3×3 ---------- */
function chapel() {
  const s = new Spr(48, 76);
  shadeRect(s, 7, 70, 47, 75, 0.32);
  rect(s, 5, 44, 42, 69, plaster);
  for (const x0 of [5, 41]) rect(s, x0, 44, x0 + 1, 69, x => x === x0 ? P[3] : P[1]);
  rect(s, 5, 66, 42, 69, (x, y) => y === 66 ? R[3] : R[1]);
  gable(s, 3, 22, 44, 43, 28, RF);
  dkRow(s, 5, 42, 44, 0.4); dkRow(s, 5, 42, 45, 0.2);
  rect(s, 18, 14, 29, 32, (x, y) => x === 18 ? P[3] : x === 29 ? P[1] : plaster(x, y));
  rect(s, 22, 18, 25, 25, (x, y) => y === 18 && (x === 22 || x === 25) ? P[2] : x === 22 ? '#1a1814' : VOID2);
  rect(s, 17, 31, 30, 33, (x, y) => y === 31 ? P[3] : P[1]);
  shadeRect(s, 17, 34, 31, 35, 0.3);
  for (let i = 0; i <= 7; i++) { const xl = 23 - Math.round(i * 0.8), xr = 24 + Math.round(i * 0.8); for (let x = xl; x <= xr; x++) s.set(x, 6 + i, i === 7 ? RF[0] : x < 23 ? RF[3] : x > 24 ? RF[1] : RF[2]); }
  rect(s, 23, 0, 24, 6, x => x === 23 ? M[3] : M[1]); rect(s, 21, 2, 26, 2, M[3]);
  const arch = (x0, y0, w, h, boarded) => {
    rect(s, x0, y0, x0 + w - 1, y0 + h - 1, (x, y) => y === y0 && (x === x0 || x === x0 + w - 1) ? s.get(x, y) : x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1 ? W[1] : (x - x0) - (y - y0) === 0 ? GL[2] : y < y0 + h / 2 ? GL[1] : GL[0]);
    rect(s, x0 - 1, y0 + h - 1, x0 + w, y0 + h - 1, P[3]);
    if (boarded) for (const by of [y0 + 3, y0 + 7]) { rect(s, x0 - 1, by, x0 + w, by, W[4]); rect(s, x0 - 1, by + 1, x0 + w, by + 1, W[2]); }
  };
  arch(10, 50, 6, 12); arch(32, 50, 6, 12, true);
  door(s, 20, 55, 8, 15);
  rect(s, 21, 54, 26, 54, W[0]);
  rect(s, 17, 70, 30, 71, (x, y) => y === 70 ? R[4] : R[2]);
  return dress(s, SEA);
}

/* ---------- water tower · 2×2 ---------- */
function waterTower() {
  const s = new Spr(32, 64);
  s.ellipseShadow(16, 60, 14, 3, 0.35);
  for (const lx of [11, 20]) rect(s, lx, 24, lx, 58, M[0]);
  const br = (a, b, c, d) => s.line(a, b, c, d, (x, y) => s.set(x, y, M[1]));
  br(6, 30, 25, 44); br(25, 30, 6, 44); br(6, 44, 25, 57); br(25, 44, 6, 57);
  rect(s, 6, 44, 25, 44, M[1]);
  for (const lx of [4, 26]) rect(s, lx, 24, lx + 1, 59, x => x === lx ? M[3] : M[1]);
  for (let y = 7; y <= 25; y++) for (let x = 2; x <= 29; x++) {
    const dx = (x + 0.5 - 16) / 14, i = dx < -0.6 ? 3 : dx < 0.1 ? 2 : dx < 0.7 ? 1 : 0;
    let c = M[i]; if (y === 11 || y === 20) c = M[Math.max(0, i - 1)];
    if (y > 11 && y < 19 && hh(x, 0, 232) < 0.2 && hh(x, y, 233) < 0.7) c = X[2];
    if (hh(x >> 1, y >> 1, 231) < 0.06) c = X[3];
    if (y === 25) c = M[0]; s.set(x, y, c);
  }
  for (let i = 0; i <= 6; i++) { const hw = 2 + i * 2; for (let x = 16 - hw; x < 16 + hw; x++) s.set(x, i, x < 16 ? M[3] : M[2]); }
  rect(s, 15, 0, 16, 0, M[3]);
  rect(s, 1, 26, 30, 26, M[1]);
  for (let y = 27; y <= 58; y++) { s.set(22, y, M[2]); s.set(24, y, M[2]); if (y % 3 === 0) s.set(23, y, M[3]); }
  return dress(s, SEA);
}

/* ---------- tool shed · 2×2 ---------- */
function shed() {
  const s = new Spr(32, 38);
  shadeRect(s, 4, 32, 31, 37, 0.32);
  rect(s, 3, 18, 28, 31, plank(18, W));
  for (const x0 of [3, 27]) rect(s, x0, 18, x0 + 1, 31, x => x === x0 ? W[4] : W[1]);
  const rf = corr(0.4, 241);
  rect(s, 1, 4, 30, 17, (x, y) => { let c = rf(x, y); if (y === 4) c = M[3]; if (y === 17) c = M[0]; return dk(c, (y - 4) / 13 * 0.2); });
  dkRow(s, 3, 28, 18, 0.45); dkRow(s, 3, 28, 19, 0.25);
  door(s, 11, 21, 10, 11, W);
  rect(s, 17, 25, 18, 27, (x, y) => y === 25 ? M[3] : X[0]);
  return dress(s, SEA);
}

/* ---------- trailer home · 3×2 ---------- */
function trailer() {
  const s = new Spr(48, 40);
  shadeRect(s, 4, 34, 47, 39, 0.32);
  rect(s, 2, 4, 45, 15, (x, y) => y === 4 ? M[3] : y === 15 ? M[0] : x % 6 === 0 ? M[1] : hh(x, y, 251) < 0.08 ? X[2] : M[2]);
  rect(s, 2, 16, 45, 31, (x, y) => { const r = (y - 16) % 3; let c = r === 2 ? P[1] : r === 0 ? P[3] : P[2]; if (hh(x >> 1, (y - 16) / 3 | 0, 252) < 0.07) c = X[3]; if (y >= 28 && hh(x, y, 253) < 0.25) c = dk(c, 0.25); return c; });
  rect(s, 2, 23, 45, 23, PN[3]);
  dkRow(s, 2, 45, 16, 0.4); dkRow(s, 2, 45, 17, 0.2);
  win(s, 6, 19, 9, 6); win(s, 33, 19, 9, 6, true);
  rect(s, 21, 18, 27, 31, (x, y) => x === 21 || x === 27 || y === 18 ? M[1] : y >= 20 && y <= 22 && x >= 23 && x <= 25 ? GL[1] : P[2]);
  s.set(26, 25, X[0]);
  rect(s, 2, 32, 45, 33, (x, y) => (x + y) % 3 === 0 ? DW[3] : DW[1]);
  rect(s, 19, 32, 29, 35, (x, y) => y === 32 ? W[4] : y === 33 ? W[3] : x === 19 || x === 29 ? W[1] : W[2]);
  return dress(s, SEA);
}

// [key, label, footprint, generator]
export const WORLD = [
  ['wld_house', 'Farmhouse', [3, 3], house],
  ['wld_burnt_house', 'Burned house', [3, 2], burnt],
  ['wld_gas_station', 'Gas station', [4, 3], gasStation],
  ['wld_barn', 'Barn', [4, 3], barn],
  ['wld_chapel', 'Chapel', [3, 3], chapel],
  ['wld_water_tower', 'Water tower', [2, 2], waterTower],
  ['wld_shed', 'Tool shed', [2, 2], shed],
  ['wld_trailer', 'Trailer home', [3, 2], trailer]
];
export function buildWorld(season = 'summer') {
  SEA = season; const A = {}, sf = season === 'summer' ? '' : '_' + season;
  for (const [k, , , g] of WORLD) A[k + sf] = g();
  SEA = 'summer'; return A;
}
