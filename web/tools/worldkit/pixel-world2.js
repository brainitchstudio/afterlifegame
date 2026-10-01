// World buildings, series 2 — abandoned industrial, rural, roadside, waterfront and wilderness structures,
// plus tile-based world structures (lot fences and walls, rail, parking and street tiles, power lines, ruins, docks).
// Same grid, palette and outline rules as pixel-world.js. Scenery only: no door strips.
import { Spr, D, R, W, L, PN, DW, M, X, dress } from './pixel-assets-v2.js';
import { H } from './pixel-buildings.js';
const { hh, dk, rect, shadeRect, dkRow, plank, brick, plaster, concrete, corr, gable, corrGable, win, door, disc, crate, barrel, B, P, RF, RC, GL } = H;
let SEA = 'summer';
const VOID = '#16140f';
const WA = ['#1c2628', '#243236', '#2e3f44', '#3e5358'];

const ivy = (s, x0, y0, x1, y1, sd, amt = 0.12) => {
  if (SEA === 'winter') return;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (s.get(x, y) && hh(x >> 1, y >> 1, sd) < amt && hh(x, y, sd + 1) < 0.7)
    s.set(x, y, SEA === 'fall' ? (hh(x, y, sd + 2) < 0.5 ? '#8a3e24' : '#a8592c') : hh(x, y, sd + 2) < 0.5 ? L[2] : L[3]);
};
function broken(s, x, y, w, h, sd) { win(s, x, y, w, h); for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) if (hh(x + i, y + j, sd) < 0.4) s.set(x + i, y + j, VOID); }
function mesh(s, x0, x1, y0, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x + y) % 4 === 0 || (x - y + 400) % 4 === 0) s.set(x, y, M[2]); rect(s, x0, y0, x1, y0, M[3]); for (let x = x0; x <= x1; x += 8) rect(s, x, y0 - 1, x, y1 + 1, M[1]); }

/* ---------- factory · 6×4 ---------- */
function factory() {
  const s = new Spr(96, 104);
  shadeRect(s, 6, 98, 95, 103, 0.32);
  rect(s, 76, 0, 85, 44, (x, y) => y % 12 === 3 ? B[0] : x === 76 ? B[3] : x === 85 ? B[1] : brick(76, 0)(x, y));
  rect(s, 75, 0, 86, 2, (x, y) => y === 0 ? R[4] : R[2]);
  const f = corr(0.35, 502);
  for (let x = 1; x <= 94; x++) {
    const t = (x - 1) % 23;
    if (t < 4) for (let y = 20; y <= 51; y++) s.set(x, y, (y - 20) % 5 === 0 ? M[1] : hh(x, y, 501) < 0.25 ? VOID : t === 0 ? GL[2] : GL[1]);
    else { const top = 20 + Math.round((t - 4) / 18 * 7); for (let y = top; y <= 51; y++) s.set(x, y, y === top ? M[3] : dk(f(x, y), (t - 4) / 18 * 0.25)); }
  }
  rect(s, 1, 50, 94, 51, (x, y) => y === 50 ? M[3] : M[0]);
  rect(s, 3, 52, 92, 95, brick(3, 52));
  for (const x0 of [3, 26, 64, 91]) rect(s, x0, 52, x0 + 1, 95, x => x === x0 ? B[3] : B[1]);
  dkRow(s, 3, 92, 52, 0.4); dkRow(s, 3, 92, 53, 0.2);
  rect(s, 5, 55, 90, 57, (x, y) => y === 56 && x > 10 && x < 86 && hh(x >> 1, 0, 503) < 0.6 ? P[2] : PN[1]);
  for (const x of [7, 16, 28, 67, 76, 83]) broken(s, x, 61, 7, 12, 504 + x);
  rect(s, 38, 70, 57, 95, M[0]);
  rect(s, 39, 71, 56, 95, (x, y) => y <= 80 ? (y % 2 ? M[2] : M[3]) : y === 81 ? M[0] : hh(x, y, 505) < 0.06 ? DW[1] : VOID);
  rect(s, 2, 96, 93, 97, (x, y) => y === 96 ? R[3] : R[1]);
  rect(s, 36, 96, 59, 99, (x, y) => y === 96 ? R[4] : y === 99 ? R[0] : R[2]);
  ivy(s, 3, 60, 92, 95, 506, 0.1);
  barrel(s, 84, 88, 8); crate(s, 62, 89, 70, 97);
  return dress(s, SEA);
}

/* ---------- warehouse · 5×3 ---------- */
function warehouse() {
  const s = new Spr(80, 68);
  shadeRect(s, 6, 62, 79, 67, 0.32);
  for (let x = 2; x <= 77; x++) {
    const u = (x - 39.5) / 38, top = 10 + Math.round(8 * (1 - Math.sqrt(Math.max(0, 1 - u * u))));
    for (let y = top; y <= 35; y++) { let c = (x - 2) % 6 === 0 ? M[1] : y === top ? M[3] : M[2]; if (hh(x >> 1, y >> 1, 511) < 0.15) c = hh(x, y, 512) < 0.5 ? X[2] : X[3]; s.set(x, y, dk(c, (y - top) / (36 - top) * 0.3)); }
  }
  rect(s, 2, 34, 77, 35, (x, y) => y === 34 ? M[3] : M[0]);
  rect(s, 3, 36, 76, 61, corr(0.3, 513));
  dkRow(s, 3, 76, 36, 0.45); dkRow(s, 3, 76, 37, 0.25);
  for (const [x0, open] of [[12, false], [50, true]]) {
    rect(s, x0 - 1, 41, x0 + 18, 41, M[3]); rect(s, x0, 42, x0 + 17, 61, M[0]);
    rect(s, x0 + 1, 43, x0 + 16, 61, open ? (x, y) => x < x0 + 7 ? (x % 2 ? M[2] : M[3]) : hh(x, y, 515) < 0.05 ? DW[1] : VOID : (x, y) => (x - x0) % 4 === 0 ? M[1] : (x - x0 + y) % 9 === 0 ? M[3] : M[2]);
  }
  broken(s, 34, 44, 10, 6, 514);
  rect(s, 2, 62, 77, 63, (x, y) => y === 62 ? R[3] : R[1]);
  crate(s, 70, 55, 78, 63); crate(s, 3, 56, 10, 63);
  return dress(s, SEA);
}

/* ---------- power substation · 3×3 ---------- */
function substation() {
  const s = new Spr(48, 56);
  shadeRect(s, 4, 52, 47, 55, 0.3);
  rect(s, 2, 14, 45, 51, (x, y) => { const n = hh(x, y, 521); return n < 0.3 ? D[1] : n < 0.8 ? D[2] : R[1]; });
  mesh(s, 2, 45, 6, 15);
  for (const px of [5, 42]) rect(s, px, 1, px + 1, 30, x => x === px ? M[2] : M[0]);
  rect(s, 5, 3, 42, 4, (x, y) => y === 3 ? M[3] : M[1]);
  const tf = (x, y) => {
    rect(s, x, y, x + 11, y + 13, (xx, yy) => yy <= y + 2 ? (yy === y ? M[3] : M[2]) : yy === y + 13 ? M[0] : (xx - x) % 2 === 0 ? M[1] : M[2]);
    for (const bx of [x + 2, x + 5, x + 8]) { rect(s, bx, y - 4, bx + 1, y - 1, (xx, yy) => yy % 2 ? P[2] : P[3]); s.line(bx, y - 4, bx + (bx < 24 ? 2 : -2), 6, (a, b) => s.set(a, b, M[0])); }
  };
  tf(7, 24); tf(27, 24);
  for (const ix of [12, 24, 36]) rect(s, ix, 5, ix, 7, P[3]);
  rect(s, 2, 16, 2, 51, M[1]); rect(s, 45, 16, 45, 51, M[1]);
  mesh(s, 2, 45, 42, 51);
  rect(s, 20, 42, 27, 51, (x, y) => (x + y) % 4 === 0 || (x - y + 400) % 4 === 0 ? M[3] : s.get(x, y));
  rect(s, 23, 46, 24, 47, X[0]);
  rect(s, 31, 44, 36, 48, (x, y) => x === 31 || x === 36 || y === 44 || y === 48 ? P[3] : RC[1]);
  return dress(s, SEA);
}

/* ---------- grain elevator · 3×3 ---------- */
function grainElevator() {
  const s = new Spr(48, 100);
  shadeRect(s, 6, 94, 47, 99, 0.32);
  const SH = [R[4], R[3], R[3], R[2], R[2], R[1], R[0]];
  for (let i = 0; i < 3; i++) {
    const cx = 9 + i * 15;
    for (let y = 24; y <= 91; y++) for (let x = cx - 7; x <= cx + 6; x++) {
      let c = SH[Math.min(6, (x - cx + 7) >> 1)];
      if (y <= 26) c = y === 24 ? R[4] : R[3];
      else if ((y - 27) % 12 === 0) c = dk(c, 0.2);
      if (hh(x, 0, 531 + i) < 0.18 && y > 30) c = dk(c, 0.15);
      s.set(x, y, c);
    }
  }
  corrGable(s, 12, 0, 35, 10, 3, 0.4, 532);
  rect(s, 13, 11, 34, 28, corr(0.4, 533)); dkRow(s, 13, 34, 11, 0.4);
  broken(s, 16, 15, 5, 6, 534); broken(s, 26, 15, 5, 6, 535);
  s.line(35, 14, 46, 70, (x, y) => { s.set(x, y, M[2]); s.set(x + 1, y, M[0]); });
  rect(s, 1, 92, 46, 95, (x, y) => y === 92 ? R[3] : R[1]);
  door(s, 20, 81, 8, 11, M);
  ivy(s, 2, 60, 45, 91, 536, 0.08);
  return dress(s, SEA);
}

/* ---------- stables · 5×2 ---------- */
function stables() {
  const s = new Spr(80, 52);
  shadeRect(s, 6, 46, 79, 51, 0.32);
  gable(s, 1, 4, 78, 27, 11, RF);
  ivy(s, 2, 12, 77, 26, 541, 0.08);
  rect(s, 35, 13, 44, 21, (x, y) => x === 35 || x === 44 || y === 13 ? W[1] : VOID);
  rect(s, 3, 28, 76, 45, plank(28, W));
  for (const x0 of [3, 75]) rect(s, x0, 28, x0 + 1, 45, x => x === x0 ? W[4] : W[1]);
  dkRow(s, 3, 76, 28, 0.45); dkRow(s, 3, 76, 29, 0.25);
  [7, 21, 35, 49, 63].forEach((x, i) => {
    rect(s, x - 1, 32, x + 10, 45, W[0]);
    const open = hh(i, 0, 542) < 0.5;
    rect(s, x, 33, x + 9, 45, (xx, y) => y < 39 && open ? VOID : y === 39 ? W[3] : (xx - x) % 3 === 2 ? W[1] : W[2]);
    if (i === 3) rect(s, x, 39, x + 9, 45, VOID);
  });
  for (let i = 0; i < 18; i++) { const x = 4 + (hh(i, 1, 543) * 70 | 0); s.set(x, 46, X[5]); s.set(x + 1, 46, X[0]); }
  rect(s, 2, 46, 77, 47, (x, y) => y === 46 ? D[3] : D[1]);
  rect(s, 68, 42, 78, 48, (x, y) => y === 42 ? X[5] : (y - 42) % 3 === 0 ? X[3] : X[0]);
  return dress(s, SEA);
}

/* ---------- windmill · 2×2 ---------- */
function windmill() {
  const s = new Spr(32, 80);
  s.ellipseShadow(16, 77, 13, 2.5, 0.35);
  for (let y = 30; y <= 73; y++) {
    const half = Math.round(6 + (y - 30) / 43 * 6);
    for (let x = 16 - half; x < 16 + half; x++) s.set(x, y, (y - 30) % 3 === 2 ? W[1] : x < 16 - half + 2 ? W[4] : x > 16 + half - 3 ? W[1] : hh(x, y, 551) < 0.3 ? W[3] : W[2]);
  }
  broken(s, 14, 44, 5, 6, 552);
  rect(s, 12, 63, 19, 73, (x, y) => x === 12 || x === 19 || y === 63 ? W[0] : VOID);
  rect(s, 7, 74, 24, 77, (x, y) => y === 74 ? R[4] : hh(x, y, 553) < 0.3 ? R[1] : R[2]);
  for (let y = 21; y <= 30; y++) { const half = 4 + Math.round((y - 21) / 9 * 3); for (let x = 16 - half; x < 16 + half; x++) s.set(x, y, y === 30 ? RF[0] : x < 16 ? RF[3] : RF[2]); }
  [[0.35, 15], [1.92, 15], [3.49, 8], [5.06, 15]].forEach(([a, len]) => {
    const c = Math.cos(a), sn = Math.sin(a);
    for (let d = 3; d <= len; d++) {
      const px = 16 + c * d, py = 24 + sn * d * 0.9;
      s.set(px, py, W[3]);
      if (d % 3 === 0) for (let k = 1; k <= 3; k++) s.set(px - sn * k, py + c * k * 0.9, W[2]);
    }
  });
  disc(s, 16, 24, 2, (dx, dy, d) => d <= 1 ? M[1] : M[0]);
  return dress(s, SEA);
}

/* ---------- truck stop diner · 5×3 ---------- */
function truckStop() {
  const s = new Spr(80, 64);
  shadeRect(s, 12, 58, 79, 63, 0.32);
  rect(s, 5, 10, 6, 55, x => x === 5 ? M[2] : M[0]);
  rect(s, 0, 0, 17, 12, (x, y) => x === 0 || x === 17 || y === 0 || y === 12 ? M[1] : RC[0]);
  for (let y = 4; y <= 7; y++) for (let x = 2; x <= 15; x++) if (hh(x, y, 561) < 0.45 && x % 3 !== 1) s.set(x, y, P[3]);
  s.set(16, 1, null); s.set(17, 1, null); s.set(17, 0, null); s.set(16, 0, null);
  rect(s, 12, 22, 77, 31, concrete(562));
  rect(s, 12, 22, 77, 23, (x, y) => y === 22 ? P[3] : P[2]);
  rect(s, 12, 30, 77, 31, (x, y) => y === 30 ? P[3] : P[1]);
  rect(s, 20, 24, 27, 28, (x, y) => y === 24 ? M[3] : (x + y) % 2 ? M[1] : M[2]);
  rect(s, 12, 32, 77, 55, plaster); dkRow(s, 12, 77, 32, 0.3);
  rect(s, 12, 34, 77, 36, (x, y) => y === 36 ? M[1] : M[3]);
  broken(s, 16, 39, 20, 9, 563); broken(s, 38, 39, 20, 9, 564);
  rect(s, 64, 41, 71, 55, M[2]);
  rect(s, 65, 42, 70, 55, (x, y) => hh(x, y, 565) < 0.35 ? VOID : x === 67 || x === 68 ? M[1] : y < 47 ? GL[1] : GL[0]);
  rect(s, 61, 37, 74, 38, (x, y) => y === 37 ? M[3] : M[1]);
  rect(s, 12, 52, 77, 55, (x, y) => y === 52 ? R[2] : R[1]);
  rect(s, 10, 56, 79, 57, (x, y) => y === 56 ? R[4] : R[2]);
  ivy(s, 12, 40, 77, 55, 566, 0.08);
  return dress(s, SEA);
}

/* ---------- billboard · 3×1 ---------- */
function billboard() {
  const s = new Spr(48, 52);
  s.ellipseShadow(24, 49, 20, 2.5, 0.35);
  for (const px of [10, 36]) rect(s, px, 28, px + 1, 48, x => x === px ? W[3] : W[1]);
  s.line(11, 32, 36, 46, (x, y) => s.set(x, y, W[2])); s.line(36, 32, 11, 46, (x, y) => s.set(x, y, W[2]));
  rect(s, 2, 2, 45, 27, W[0]);
  rect(s, 3, 3, 44, 26, (x, y) => {
    if (y > 21 && hh(x >> 1, 0, 571) < 0.4) return W[1];
    if (hh(x >> 1, y >> 1, 572) < 0.12) return P[2];
    return x < 20 ? (y < 14 ? X[0] : X[3]) : y < 9 ? P[3] : y < 18 ? RC[0] : PN[3];
  });
  for (let x = 23; x <= 41; x += 3) rect(s, x, 5, x + 1, 6, RC[0]);
  rect(s, 2, 28, 45, 29, (x, y) => y === 28 ? M[2] : M[0]);
  for (let x = 2; x <= 45; x += 7) s.set(x, 27, M[1]);
  return dress(s, SEA);
}

/* ---------- bus shelter · 2×1 ---------- */
function busShelter() {
  const s = new Spr(32, 30);
  shadeRect(s, 2, 25, 31, 29, 0.3);
  rect(s, 3, 8, 28, 20, (x, y) => (x - 3) % 8 === 0 ? M[1] : hh(x >> 2, y >> 2, 581) < 0.25 ? null : (x - y) % 7 === 0 ? GL[2] : GL[1]);
  s.line(12, 9, 17, 17, (x, y) => s.get(x, y) && s.set(x, y, GL[2]));
  for (const px of [2, 29]) rect(s, px, 8, px, 24, M[2]);
  rect(s, 1, 4, 30, 7, (x, y) => y === 4 ? M[3] : y === 7 ? M[0] : M[1]);
  rect(s, 6, 18, 25, 19, (x, y) => y === 18 ? W[3] : W[1]); s.set(7, 20, W[0]); s.set(24, 20, W[0]); s.set(7, 21, W[0]); s.set(24, 21, W[0]);
  rect(s, 26, 0, 30, 3, (x, y) => x === 26 || y === 0 ? P[3] : RC[1]);
  return dress(s, SEA);
}

/* ---------- boathouse · 3×3 ---------- */
function boathouse() {
  const s = new Spr(48, 62);
  rect(s, 0, 40, 47, 61, (x, y) => (x + (y % 4) * 3) % 9 === 0 ? WA[3] : y % 4 === 0 ? WA[2] : WA[1]);
  for (const px of [4, 12, 35, 43]) rect(s, px, 40, px + 1, 50, (x, y) => y > 46 ? dk(W[1], 0.4) : x === px ? W[2] : W[0]);
  rect(s, 3, 22, 44, 44, plank(22, W));
  for (const x0 of [3, 43]) rect(s, x0, 22, x0 + 1, 44, x => x === x0 ? W[4] : W[1]);
  gable(s, 1, 2, 46, 21, 8, RF);
  dkRow(s, 3, 44, 22, 0.45); dkRow(s, 3, 44, 23, 0.25);
  rect(s, 14, 29, 33, 44, W[0]);
  rect(s, 15, 30, 32, 44, (x, y) => y >= 40 ? ((x + y) % 5 === 0 ? WA[1] : WA[0]) : VOID);
  broken(s, 37, 26, 6, 6, 591); broken(s, 5, 26, 6, 6, 592);
  ivy(s, 3, 30, 44, 44, 593, 0.1);
  for (const [a, b] of [[0, 13], [34, 47]]) rect(s, a, 45, b, 48, (x, y) => y === 48 ? W[0] : x % 4 === 3 ? W[1] : y === 45 ? W[4] : W[3]);
  for (let y = 52; y <= 56; y++) { const hw = 6 - Math.abs(y - 54) * 2; for (let x = 24 - hw; x <= 24 + hw; x++) s.set(x, y, y === 52 ? W[4] : y === 56 ? W[0] : W[2]); }
  return dress(s, SEA);
}

/* ---------- fire lookout · 2×2 ---------- */
function fireLookout() {
  const s = new Spr(32, 88);
  s.ellipseShadow(16, 85, 14, 3, 0.35);
  const leg = (a, b, c, d) => s.line(a, b, c, d, (x, y) => { s.set(x, y, M[2]); s.set(x + 1, y, M[0]); });
  leg(4, 84, 9, 40); leg(26, 84, 21, 40);
  for (let y = 44; y < 84; y += 10) { const xl = 4 + Math.round((84 - y) / 44 * 5), xr = 27 - Math.round((84 - y) / 44 * 5), yn = y + 10, xl2 = 4 + Math.round((84 - yn) / 44 * 5), xr2 = 27 - Math.round((84 - yn) / 44 * 5); s.line(xl, y, xr2, Math.min(84, yn), (x, yy) => s.set(x, yy, M[1])); s.line(xr, y, xl2, Math.min(84, yn), (x, yy) => s.set(x, yy, M[1])); }
  for (let k = 0; k < 4; k++) { const y0 = 42 + k * 10; s.line(k % 2 ? 20 : 11, y0, k % 2 ? 11 : 20, y0 + 9, (x, y) => { s.set(x, y, W[3]); s.set(x, y + 1, W[1]); }); }
  rect(s, 5, 20, 26, 37, plank(20, W));
  rect(s, 6, 23, 25, 31, (x, y) => (x - 6) % 5 === 0 || y === 23 || y === 31 ? M[1] : hh(x, y, 601) < 0.2 ? VOID : (x - y) % 6 === 0 ? GL[2] : GL[1]);
  rect(s, 3, 38, 28, 40, (x, y) => y === 38 ? W[4] : y === 40 ? W[0] : W[2]);
  for (const px of [3, 10, 21, 28]) rect(s, px, 34, px, 37, W[1]);
  rect(s, 3, 34, 28, 34, W[3]);
  for (let y = 8; y <= 19; y++) { const hw = 2 + Math.round((y - 8) / 11 * 12); for (let x = 16 - hw; x < 16 + hw; x++) s.set(x, y, y === 19 ? RF[0] : (y - 8) % 3 === 2 ? RF[1] : x < 16 ? RF[3] : RF[2]); }
  rect(s, 15, 2, 15, 7, M[2]);
  return dress(s, SEA);
}

/* ---------- log cabin · 3×2 ---------- */
function logCabin() {
  const s = new Spr(48, 46);
  shadeRect(s, 5, 42, 47, 45, 0.32);
  rect(s, 36, 0, 41, 26, (x, y) => { const r = y >> 2, a = (x + (r % 2) * 2) % 4; return y <= 1 ? R[4] : a === 0 || y % 4 === 3 ? R[0] : hh(x, y, 611) < 0.4 ? R[1] : R[2]; });
  gable(s, 1, 4, 46, 21, 9, RF);
  rect(s, 36, 4, 41, 8, (x, y) => (x + y) % 4 === 0 ? R[0] : R[2]);
  ivy(s, 2, 10, 45, 20, 612, 0.1);
  rect(s, 3, 22, 44, 39, (x, y) => { const r = (y - 22) % 3; return r === 2 ? W[0] : r === 0 ? W[3] : hh(x, y, 613) < 0.06 ? W[1] : W[2]; });
  for (const cx of [3, 44]) for (let y = 22; y <= 39; y += 3) { s.set(cx, y, W[4]); s.set(cx, y + 1, X[3]); s.set(cx + (cx === 3 ? -1 : 1), y, W[3]); s.set(cx + (cx === 3 ? -1 : 1), y + 1, W[1]); }
  dkRow(s, 3, 44, 22, 0.45); dkRow(s, 3, 44, 23, 0.25);
  rect(s, 19, 26, 28, 39, W[0]); rect(s, 20, 27, 22, 39, (x, y) => (y - 27) % 4 === 0 ? W[1] : W[2]); rect(s, 23, 27, 27, 39, VOID);
  broken(s, 7, 27, 8, 6, 614); win(s, 33, 27, 8, 6, true);
  rect(s, 14, 40, 33, 41, (x, y) => y === 40 ? W[4] : W[2]);
  for (const px of [14, 33]) rect(s, px, 24, px, 39, W[3]);
  return dress(s, SEA);
}

/* ---------- structures ---------- */
function chainH() { const s = new Spr(16, 24); for (let x = 0; x < 16; x++) { s.shade(x, 21, 0.35); s.shade(x, 22, 0.2); } for (let y = 5; y <= 20; y++) for (let x = 0; x < 16; x++) if ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0) s.set(x, y, y > 17 ? M[1] : M[2]); rect(s, 0, 4, 15, 4, M[3]); rect(s, 0, 2, 1, 21, x => x === 0 ? M[3] : M[1]); return s; }
function chainV() { const s = new Spr(16, 28); for (let y = 0; y < 24; y++) s.shade(9, y + 2, 0.3); rect(s, 7, 0, 8, 23, (x, y) => y % 16 === 0 ? M[3] : x === 7 ? M[2] : M[1]); return s; }
function chainPost() { const s = new Spr(16, 24); for (let y = 20; y <= 23; y++) for (let x = 5; x <= 11; x++) s.shade(x, y, 0.3); rect(s, 6, 1, 9, 21, x => x === 6 ? M[3] : x === 9 ? M[0] : M[2]); rect(s, 5, 0, 10, 1, M[3]); s.outline('#1a1e16'); return s; }
function wallBrickH() {
  const s = new Spr(16, 20); for (let x = 0; x < 16; x++) for (let y = 17; y <= 19; y++) s.shade(x, y, 0.35);
  rect(s, 0, 4, 15, 6, (x, y) => y === 4 ? R[4] : y === 5 ? R[3] : R[1]);
  rect(s, 0, 7, 15, 16, (x, y) => hh(x / 3 | 0, y / 3 | 0, 621) < 0.08 ? VOID : y === 16 ? dk(brick(0, 7)(x, y), 0.3) : brick(0, 7)(x, y));
  return dress(s, SEA);
}
function wallBrickV() { const s = new Spr(16, 28); for (let y = 2; y <= 27; y++) s.shade(11, y, 0.35); rect(s, 5, 0, 10, 19, (x, y) => x === 5 ? R[4] : x === 10 ? R[1] : y % 6 === 5 ? R[1] : R[3]); rect(s, 5, 20, 10, 27, brick(5, 20)); return dress(s, SEA); }
function wallBrickPost() { const s = new Spr(16, 24); for (let y = 21; y <= 23; y++) for (let x = 4; x <= 13; x++) s.shade(x, y, 0.35); rect(s, 4, 3, 11, 20, brick(4, 3)); rect(s, 3, 0, 12, 3, (x, y) => y === 0 ? R[4] : y === 3 ? R[1] : R[3]); return dress(s, SEA); }
const ballast = (x, y, sd) => { const n = hh(x, y, sd); return n < 0.25 ? R[0] : n < 0.6 ? R[1] : n < 0.9 ? D[1] : R[2]; };
function railTile(v, cross) {
  const s = new Spr(16, 16), T = (a, b, c) => v ? rect(s, a[1], a[0], b[1], b[0], (x, y) => c(y, x)) : rect(s, a[0], a[1], b[0], b[1], c);
  if (cross) T([0, 0], [15, 15], (x, y) => x % 4 === 3 ? W[1] : hh(x, y, 632) < 0.2 ? W[2] : W[3]);
  else { T([0, 0], [15, 15], (x, y) => ballast(x, y, 631)); T([0, 3], [15, 12], (x, y) => x % 4 < 2 ? (y === 3 || y === 12 ? W[0] : x % 4 === 0 ? W[2] : W[1]) : ballast(x, y, 631)); }
  for (const ry of [5, 10]) { T([0, ry], [15, ry], () => M[3]); T([0, ry + 1], [15, ry + 1], () => M[1]); }
  return s;
}
function railSignal() {
  const s = new Spr(16, 40); for (let y = 36; y <= 39; y++) for (let x = 4; x <= 12; x++) s.shade(x, y, 0.3);
  rect(s, 7, 6, 8, 36, x => x === 7 ? M[3] : M[1]);
  for (const [a, b, c, d] of [[3, 0, 12, 8], [12, 0, 3, 8]]) s.line(a, b, c, d, (x, y) => { s.set(x, y, P[3]); s.set(x, y + 1, RC[0]); });
  for (const lx of [3, 10]) rect(s, lx, 12, lx + 2, 14, (x, y) => x === lx + 1 && y === 13 ? RC[1] : M[0]);
  rect(s, 5, 13, 10, 13, M[1]);
  return dress(s, SEA);
}
function railBuffer() {
  const s = new Spr(16, 20); for (let y = 16; y <= 19; y++) for (let x = 1; x <= 15; x++) s.shade(x, y, 0.3);
  for (const px of [3, 11]) rect(s, px, 6, px + 1, 16, x => x === px ? M[2] : M[0]);
  rect(s, 1, 4, 14, 8, (x, y) => y === 4 ? P[3] : ((x + y) >> 1) % 2 ? RC[0] : P[2]);
  for (const bx of [3, 11]) rect(s, bx, 9, bx + 1, 10, M[3]);
  return dress(s, SEA);
}
const asph = (x, y, sd) => { const n = hh(x, y, sd); return n < 0.15 ? DW[0] : n < 0.85 ? DW[1] : DW[2]; };
function lot(kind) {
  const s = new Spr(16, 16); rect(s, 0, 0, 15, 15, (x, y) => asph(x, y, 641));
  if (kind === 'crack') { let x = 3; for (let y = 0; y < 16; y++) { x += hh(0, y, 642) < 0.33 ? -1 : hh(0, y, 642) > 0.66 ? 1 : 0; s.set(x, y, DW[0]); if (SEA !== 'winter' && hh(x, y, 643) < 0.25) s.set(x + 1, y, L[3]); } s.line(x, 9, 13, 13, (a, b) => s.set(a, b, DW[0])); }
  if (kind === 'line') rect(s, 7, 0, 8, 15, (x, y) => hh(x, y >> 1, 644) < 0.2 ? DW[2] : P[2]);
  if (kind === 'h' || kind === 'v') for (let i = 2; i <= 9; i++) for (const k of [7, 8]) if (hh(i, k, 645) > 0.2) kind === 'h' ? s.set(i, k, X[0]) : s.set(k, i, X[0]);
  return s;
}
function lotBumper() { const s = new Spr(16, 10); for (let x = 2; x <= 14; x++) { s.shade(x, 7, 0.35); s.shade(x, 8, 0.2); } rect(s, 2, 3, 13, 6, (x, y) => y === 3 ? R[4] : y === 6 ? R[1] : hh(x, y, 646) < 0.2 ? R[2] : R[3]); rect(s, 4, 4, 5, 5, P[3]); rect(s, 10, 4, 11, 5, P[3]); return dress(s, SEA); }
function pylon() {
  const s = new Spr(32, 72); s.ellipseShadow(16, 68, 14, 3, 0.35);
  const ln = (a, b, c, d, col) => s.line(a, b, c, d, (x, y) => s.set(x, y, col));
  ln(3, 68, 12, 14, M[2]); ln(4, 68, 13, 14, M[0]); ln(28, 68, 19, 14, M[2]); ln(27, 68, 18, 14, M[0]);
  for (let y = 20; y < 66; y += 12) { const xl = 3 + Math.round((68 - y) / 54 * 9), xr = 28 - Math.round((68 - y) / 54 * 9), y2 = y + 12, xl2 = 3 + Math.round((68 - y2) / 54 * 9), xr2 = 28 - Math.round((68 - y2) / 54 * 9); ln(xl, y, xr2, Math.min(68, y2), M[1]); ln(xr, y, xl2, Math.min(68, y2), M[1]); ln(xl, y, xr, y, M[1]); }
  rect(s, 12, 4, 19, 14, (x, y) => (x + y) % 3 === 0 ? M[1] : x === 12 || x === 19 ? M[2] : null);
  rect(s, 0, 16, 31, 17, (x, y) => y === 16 ? M[3] : M[1]); rect(s, 5, 6, 26, 7, (x, y) => y === 6 ? M[3] : M[1]);
  for (const [ix, iy] of [[1, 18], [30, 18], [6, 8], [25, 8]]) rect(s, ix, iy, ix, iy + 3, (x, y) => y % 2 ? P[2] : P[3]);
  return dress(s, SEA);
}
function transformerPole() {
  const s = new Spr(16, 48); s.ellipseShadow(8, 45, 5, 1.5, 0.35);
  rect(s, 7, 2, 8, 45, x => x === 7 ? W[3] : W[1]);
  rect(s, 1, 6, 14, 7, (x, y) => y === 6 ? W[4] : W[2]);
  for (const ix of [2, 7, 13]) rect(s, ix, 3, ix, 5, P[3]);
  rect(s, 9, 14, 13, 22, (x, y) => y === 14 ? M[3] : x === 9 ? M[3] : y === 22 ? M[0] : M[2]);
  s.line(11, 13, 13, 6, (x, y) => s.set(x, y, M[0]));
  return dress(s, SEA);
}
function ruinWall() {
  const s = new Spr(16, 28); for (let x = 0; x < 16; x++) for (let y = 25; y <= 27; y++) s.shade(x, y, 0.35);
  for (let x = 0; x < 16; x++) { const top = 6 + Math.round(hh(x >> 1, 0, 651) * 12); for (let y = top; y <= 24; y++) s.set(x, y, y === top ? R[3] : hh(x / 3 | 0, y / 3 | 0, 652) < 0.07 ? VOID : y === 24 ? dk(brick(0, 6)(x, y), 0.3) : brick(0, 6)(x, y)); }
  ivy(s, 0, 10, 15, 24, 653, 0.15);
  return dress(s, SEA);
}
function ruinCorner() {
  const s = new Spr(16, 40); for (let x = 3; x <= 15; x++) for (let y = 36; y <= 39; y++) s.shade(x, y, 0.35);
  for (let x = 3; x <= 12; x++) { const top = 2 + Math.round(hh(x, 0, 654) * 8); for (let y = top; y <= 35; y++) s.set(x, y, y === top ? R[3] : x >= 11 ? dk(brick(3, 2)(x, y), 0.25) : brick(3, 2)(x, y)); }
  ivy(s, 3, 12, 12, 35, 655, 0.12);
  return dress(s, SEA);
}
function rubble(w, h, sd) {
  const s = new Spr(w, h); s.ellipseShadow(w / 2, h - 3, w / 2 - 1, 2, 0.3);
  for (let i = 0; i < w * h / 10; i++) { const x = 1 + (hh(i, 1, sd) * (w - 3) | 0), y = 2 + (hh(i, 2, sd) * (h - 5) | 0), c = hh(i, 3, sd); rect(s, x, y, x + 1, y + (c < 0.5 ? 0 : 1), c < 0.35 ? B[2] : c < 0.55 ? B[1] : c < 0.8 ? R[2] : R[3]); }
  if (w > 16) s.line(3, h - 7, w - 6, 4, (x, y) => { s.set(x, y, W[2]); s.set(x, y + 1, W[0]); });
  return dress(s, SEA);
}
function ruinChimney() {
  const s = new Spr(16, 48); for (let x = 4; x <= 14; x++) for (let y = 44; y <= 47; y++) s.shade(x, y, 0.35);
  for (let x = 4; x <= 11; x++) { const top = 2 + Math.round(hh(x >> 1, 0, 661) * 5); for (let y = top; y <= 44; y++) { const r = y >> 2, a = (x + (r % 2) * 2) % 4; s.set(x, y, y === top ? R[4] : a === 0 || y % 4 === 3 ? R[0] : x >= 10 ? R[1] : hh(x, y, 662) < 0.4 ? R[2] : R[3]); } }
  rect(s, 6, 30, 9, 36, VOID);
  ivy(s, 4, 18, 11, 44, 663, 0.1);
  return dress(s, SEA);
}
function dockH() { const s = new Spr(16, 16); rect(s, 0, 0, 15, 15, (x, y) => y >= 13 ? (y === 13 ? W[0] : WA[0]) : x % 4 === 3 ? WA[1] : y === 0 ? W[4] : hh(x, y, 671) < 0.15 ? W[2] : W[3]); for (const nx of [1, 5, 9, 13]) { s.set(nx, 2, M[1]); s.set(nx, 10, M[1]); } return s; }
function dockPost() { const s = new Spr(8, 14); s.ellipseShadow(4, 12, 3, 1.2, 0.3); rect(s, 2, 2, 5, 12, (x, y) => y === 2 ? W[4] : x === 2 ? W[3] : x === 5 ? W[0] : W[2]); rect(s, 2, 5, 5, 6, X[3]); return dress(s, SEA); }

// [key, label, footprint, generator]
export const WORLD2 = [
  ['wld_factory', 'Factory', [6, 4], factory],
  ['wld_warehouse', 'Warehouse', [5, 3], warehouse],
  ['wld_substation', 'Power substation', [3, 3], substation],
  ['wld_grain_elevator', 'Grain elevator', [3, 3], grainElevator],
  ['wld_stables', 'Stables', [5, 2], stables],
  ['wld_windmill', 'Windmill', [2, 2], windmill],
  ['wld_truck_stop', 'Truck stop diner', [5, 3], truckStop],
  ['wld_billboard', 'Billboard', [3, 1], billboard],
  ['wld_bus_shelter', 'Bus shelter', [2, 1], busShelter],
  ['wld_boathouse', 'Boathouse', [3, 3], boathouse],
  ['wld_fire_lookout', 'Fire lookout', [2, 2], fireLookout],
  ['wld_cabin', 'Log cabin', [3, 2], logCabin]
];
// [key, label, generator]
export const STRUCT = [
  ['str_fence_chain_h', 'Chain-link · N/S', chainH], ['str_fence_chain_v', 'Chain-link · W/E', chainV], ['str_fence_chain_post', 'Chain-link post', chainPost],
  ['str_wall_brick_h', 'Brick lot wall · N/S', wallBrickH], ['str_wall_brick_v', 'Brick lot wall · W/E', wallBrickV], ['str_wall_brick_post', 'Brick pillar', wallBrickPost],
  ['str_rail_h', 'Rail · E–W', () => railTile(false)], ['str_rail_v', 'Rail · N–S', () => railTile(true)], ['str_rail_x', 'Level crossing', () => railTile(false, true)],
  ['str_rail_signal', 'Crossing signal', railSignal], ['str_rail_buffer', 'Buffer stop', railBuffer],
  ['str_lot_a', 'Parking lot', () => lot('a')], ['str_lot_crack', 'Parking lot · cracked', () => lot('crack')], ['str_lot_line', 'Parking bay line', () => lot('line')], ['str_lot_bumper', 'Wheel stop', lotBumper],
  ['str_street_h', 'Street · E–W', () => lot('h')], ['str_street_v', 'Street · N–S', () => lot('v')],
  ['str_pylon', 'Power pylon', pylon], ['str_transformer_pole', 'Transformer pole', transformerPole],
  ['str_ruin_wall', 'Ruined wall', ruinWall], ['str_ruin_corner', 'Ruined corner', ruinCorner], ['str_rubble', 'Rubble', () => rubble(16, 12, 681)], ['str_rubble_lg', 'Rubble heap', () => rubble(32, 20, 682)], ['str_ruin_chimney', 'Standing chimney', ruinChimney],
  ['str_dock', 'Dock planks', dockH], ['str_dock_post', 'Mooring post', dockPost]
];
export function buildWorld2(season = 'summer') {
  SEA = season; const A = {}, sf = season === 'summer' ? '' : '_' + season;
  for (const [k, , , g] of WORLD2) A[k + sf] = g();
  for (const [k, , g] of STRUCT) A[k + sf] = g();
  SEA = 'summer'; return A;
}
