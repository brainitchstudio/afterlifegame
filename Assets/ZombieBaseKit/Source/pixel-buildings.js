// Base buildings — same palette, grid and outline rules as pixel-assets-v2.js
import { Spr, OL, G, D, R, W, L, PN, DW, M, S, X, SN, dress } from './pixel-assets-v2.js';
let SEA = 'summer';

const hh = (x, y, s = 0) => { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
const dkC = {};
function dk(h, a) {
  if (!h) return h; const k = h + a.toFixed(2); if (dkC[k]) return dkC[k];
  const n = parseInt(h.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, f = 1 - a;
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return (dkC[k] = '#' + c(r * f) + c(g * f) + c(b * (f + a * 0.18) + 6 * a));
}
const B = ['#3e2620', '#5c3426', '#784630', '#8f5a3e'];      // brick
const P = ['#5f5d50', '#7e7b68', '#9c9882', '#b5b19a'];      // plaster
const RF = ['#4a2c20', '#643a26', '#7e4c30', '#98623e'];     // clay shingles
const RC = ['#7e3228', '#9a4436'];                           // painted cross
const GL = ['#1f2825', '#34423c', '#566a60'];                // glass

const rect = (s, x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) s.set(x, y, typeof c === 'function' ? c(x, y) : c); };
const shadeRect = (s, x0, y0, x1, y1, a) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) s.shade(x, y, a); };
const dkRow = (s, x0, x1, y, a) => { for (let x = x0; x <= x1; x++) s.set(x, y, dk(s.get(x, y), a)); };

const plank = (y0, pal = W) => (x, y) => {
  const fy = y - y0, row = Math.floor(fy / 3), r = fy % 3;
  if (r === 2 || (x + row * 7) % 13 === 0) return pal[1];
  const n = hh(x, y, row + 3);
  return r === 0 ? (n < 0.3 ? pal[4] : pal[3]) : (n < 0.15 ? pal[1] : pal[2]);
};
const brick = (x0, y0) => (x, y) => {
  const fy = y - y0, row = Math.floor(fy / 3), r = fy % 3;
  if (r === 2 || (x - x0 + (row % 2) * 3) % 6 === 0) return P[1];
  const n = hh((x - x0 + (row % 2) * 3) / 6 | 0, row, 5);
  return n < 0.2 ? B[1] : n < 0.75 ? B[2] : B[3];
};
const plaster = (x, y) => { const n = hh(x, y, 7), st = hh(x >> 2, y >> 3, 8); if (st < 0.12) return P[1]; return n < 0.12 ? P[1] : n < 0.8 ? P[2] : P[3]; };
const concrete = sd => (x, y) => { const n = hh(x, y, sd); return n < 0.14 ? R[1] : n < 0.86 ? R[2] : R[3]; };
const corr = (rust, sd) => (x, y) => {
  let c = [M[3], M[2], M[1]][((x % 3) + 3) % 3];
  if (hh(x >> 1, y >> 1, sd) < rust && hh(x, y, sd + 1) < 0.7) c = hh(x, y, sd + 2) < 0.5 ? X[2] : X[3];
  return c;
};

function gable(s, x0, y0, x1, y1, yr, pal) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let c;
    if (y < yr) c = (y - y0) % 3 === 0 ? pal[1] : pal[2];
    else if (y === yr) c = pal[3];
    else if (y === yr + 1) c = pal[0];
    else {
      const fy = y - yr - 2, r = fy % 3;
      if (r === 2) c = pal[0];
      else if ((x + Math.floor(fy / 3) * 2) % 5 === 0) c = pal[1];
      else c = r === 0 ? pal[3] : hh(x, y, 41) < 0.15 ? pal[1] : pal[2];
    }
    if (hh(x >> 1, y >> 1, 42) < 0.05) c = pal[0];
    if (y === y1) c = pal[0];
    s.set(x, y, c);
  }
}
function corrGable(s, x0, y0, x1, y1, yr, rust, sd) {
  const f = corr(rust, sd);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let c = f(x, y);
    if (y < yr) c = dk(c, 0.28);
    else if (y === yr) c = M[3];
    else if (y === yr + 1) c = M[0];
    else { if ((y - yr) % 8 === 0) c = M[1]; c = dk(c, (y - yr) / (y1 - yr) * 0.15); }
    if (y === y1) c = M[0];
    s.set(x, y, c);
  }
}
function win(s, x, y, w, h, boarded) {
  rect(s, x, y, x + w - 1, y + h - 1, W[1]);
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    const d = i - j; s.set(x + i, y + j, d === 1 || d === 2 ? GL[2] : j < h / 2 ? GL[1] : GL[0]);
  }
  for (let j = 1; j < h - 1; j++) s.set(x + (w >> 1), y + j, W[1]);
  rect(s, x - 1, y + h - 1, x + w, y + h - 1, W[3]);
  if (boarded) for (const by of [y + 2, y + h - 4]) { rect(s, x - 1, by, x + w, by, W[4]); rect(s, x - 1, by + 1, x + w, by + 1, W[2]); }
}
function door(s, x, y, w, h, pal = W) {
  rect(s, x, y, x + w - 1, y + h - 1, (px, py) => px === x || px === x + w - 1 || py === y ? pal[0] : (py - y) % 4 === 0 ? pal[1] : pal[2]);
  s.set(x + w - 2, y + (h >> 1), X[0]);
}
function sandbags(s, x0, y0, x1, y1) {
  rect(s, x0, y0, x1, y1, (x, y) => {
    const fy = y - y0, row = Math.floor(fy / 3), r = fy % 3, a = x - x0 + (row % 2) * 3;
    let c = a % 6 === 0 ? S[0] : r === 2 ? S[1] : r === 0 ? S[3] : hh(x, y, 17) < 0.2 ? S[3] : S[2];
    return y === y1 ? dk(c, 0.3) : c;
  });
}

/* ---------- town hall · 4×3 ---------- */
function townHall() {
  const s = new Spr(64, 72);
  shadeRect(s, 6, 66, 63, 71, 0.32);
  rect(s, 4, 38, 59, 63, brick(4, 38));
  for (const x0 of [4, 24, 38, 58]) rect(s, x0, 38, x0 + 1, 61, (x) => x === x0 ? P[3] : P[2]);
  rect(s, 3, 62, 60, 65, (x, y) => y === 62 ? R[3] : (x + (y % 2) * 3) % 7 === 0 ? R[0] : hh(x, y, 31) < 0.3 ? R[1] : R[2]);
  dkRow(s, 4, 59, 38, 0.4); dkRow(s, 4, 59, 39, 0.2);
  win(s, 8, 44, 6, 10); win(s, 16, 44, 6, 10); win(s, 42, 44, 6, 10); win(s, 50, 44, 6, 10, true);
  rect(s, 26, 47, 37, 63, (x, y) => x === 26 || y === 47 ? P[3] : P[2]);
  door(s, 27, 49, 5, 15); door(s, 32, 49, 5, 15);
  s.set(30, 56, X[0]); s.set(31, 56, W[0]); s.set(32, 56, W[0]);
  rect(s, 25, 64, 38, 65, (x, y) => y === 64 ? R[4] : R[3]);
  rect(s, 23, 66, 40, 67, (x, y) => y === 66 ? R[3] : R[1]);
  rect(s, 24, 41, 39, 45, (x, y) => x === 24 || x === 39 || y === 41 || y === 45 ? W[1] : W[3]);
  for (let x = 26; x <= 37; x++) if ((x - 26) % 3 !== 2) for (let y = 42; y <= 44; y++) if (y === 43 || hh(x, y, 33) < 0.5) s.set(x, y, W[0]);
  gable(s, 2, 8, 61, 37, 16, RF);
  rect(s, 25, 23, 38, 24, (x, y) => dk(s.get(x, y), 0.35));
  rect(s, 25, 8, 38, 22, plank(8, W));
  for (let y = 8; y <= 22; y++) { s.set(25, y, W[4]); s.set(38, y, W[1]); }
  for (let x = 25; x <= 38; x++) s.set(x, 22, W[0]);
  rect(s, 29, 11, 34, 17, DW[0]);
  rect(s, 30, 13, 33, 16, (x, y) => x === 30 && y < 16 ? X[5] : y === 16 ? X[3] : X[0]);
  s.set(31, 12, X[0]); s.set(32, 12, X[0]);
  for (let i = 0; i <= 7; i++) {
    const xl = 31 - Math.round(i * 1.15), xr = 32 + Math.round(i * 1.15);
    for (let x = xl; x <= xr; x++) s.set(x, i, i === 7 ? RF[0] : x < 31 ? RF[3] : x > 32 ? RF[1] : RF[2]);
  }
  return dress(s, SEA);
}

/* ---------- clinic · 3×3 ---------- */
function clinic() {
  const s = new Spr(48, 58);
  shadeRect(s, 6, 50, 47, 56, 0.32);
  rect(s, 3, 6, 44, 25, concrete(51));
  rect(s, 3, 6, 44, 7, (x, y) => y === 6 ? P[3] : P[2]);
  for (let y = 6; y <= 25; y++) { s.set(3, y, P[3]); s.set(44, y, P[1]); }
  dkRow(s, 4, 43, 8, 0.3);
  rect(s, 3, 24, 44, 25, (x, y) => y === 24 ? P[3] : P[1]);
  rect(s, 15, 9, 32, 22, (x, y) => hh(x, y, 52) < 0.1 ? P[2] : P[3]);
  const cross = (x, y) => (x >= 21 && x <= 26 && y >= 10 && y <= 21) || (x >= 17 && x <= 30 && y >= 13 && y <= 18);
  rect(s, 15, 9, 32, 22, (x, y) => cross(x, y) ? (hh(x, y, 53) < 0.08 ? P[2] : (!cross(x - 1, y) || !cross(x, y - 1)) ? RC[1] : RC[0]) : s.get(x, y));
  rect(s, 36, 10, 41, 15, (x, y) => y <= 12 ? (x === 36 ? M[3] : (x + y) % 2 ? M[2] : M[3]) : y === 15 ? M[0] : M[1]);
  rect(s, 3, 26, 44, 49, plaster);
  rect(s, 3, 28, 44, 29, (x, y) => y === 28 ? PN[4] : PN[3]);
  rect(s, 3, 46, 44, 49, (x, y) => y === 46 ? R[2] : R[1]);
  dkRow(s, 3, 44, 26, 0.3);
  rect(s, 19, 34, 28, 49, M[2]);
  rect(s, 20, 35, 27, 48, (x, y) => x === 23 || x === 24 ? M[1] : (x - 20) - (y - 35) === 1 ? GL[2] : y < 41 ? GL[1] : GL[0]);
  rect(s, 21, 30, 26, 33, P[3]);
  rect(s, 21, 30, 26, 33, (x, y) => (x >= 23 && x <= 24) || (y >= 31 && y <= 32 && x >= 22 && x <= 25) ? RC[0] : P[3]);
  win(s, 7, 34, 8, 8); win(s, 33, 34, 8, 8, true);
  rect(s, 18, 50, 29, 51, (x, y) => y === 50 ? R[4] : R[2]);
  rect(s, 37, 46, 43, 52, (x, y) => y <= 47 ? (x === 37 ? W[4] : W[3]) : y === 52 ? W[0] : (x === 40 && y >= 48 && y <= 51) || (y === 49 || y === 50) && x >= 39 && x <= 41 ? RC[1] : W[2]);
  return dress(s, SEA);
}

/* ---------- barracks · 4×2 ---------- */
function barracks() {
  const s = new Spr(64, 54);
  shadeRect(s, 5, 48, 63, 53, 0.32);
  rect(s, 3, 30, 60, 47, plank(30, PN));
  for (const x0 of [3, 59]) rect(s, x0, 30, x0 + 1, 47, x => x === x0 ? W[3] : W[1]);
  dkRow(s, 3, 60, 30, 0.4); dkRow(s, 3, 60, 31, 0.2);
  door(s, 28, 34, 8, 14);
  rect(s, 29, 36, 34, 37, PN[4]);
  win(s, 8, 35, 7, 6); win(s, 18, 35, 7, 6, true); win(s, 39, 35, 7, 6); win(s, 49, 35, 7, 6);
  rect(s, 27, 48, 36, 49, (x, y) => y === 48 ? W[3] : W[1]);
  corrGable(s, 1, 4, 62, 29, 11, 0.12, 61);
  rect(s, 48, 0, 49, 9, x => x === 48 ? M[2] : M[0]);
  rect(s, 47, 0, 50, 1, (x, y) => y === 0 ? M[3] : M[1]);
  sandbags(s, 2, 45, 17, 50); sandbags(s, 46, 45, 61, 50);
  return dress(s, SEA);
}

/* ---------- workshop · 3×3 ---------- */
function workshop() {
  const s = new Spr(48, 62);
  shadeRect(s, 5, 56, 47, 61, 0.32);
  rect(s, 3, 30, 44, 55, plank(30, W));
  const rf = corr(0.35, 71);
  rect(s, 1, 6, 46, 29, (x, y) => { let c = y % 7 === 6 ? M[1] : rf(x, y); if (y >= 28) c = M[0]; return dk(c, (y - 6) / 23 * 0.22); });
  dkRow(s, 3, 44, 30, 0.4); dkRow(s, 3, 44, 31, 0.2);
  rect(s, 38, 0, 39, 8, x => x === 38 ? M[2] : M[0]);
  rect(s, 37, 0, 40, 1, (x, y) => y === 0 ? M[3] : M[1]);
  rect(s, 7, 34, 30, 55, (x, y) => y >= 50 ? (hh(x, y, 72) < 0.25 ? D[0] : D[1]) : y < 37 ? DW[0] : DW[1]);
  for (const [tx, len] of [[10, 4], [12, 3], [14, 5]]) for (let y = 37; y < 37 + len; y++) s.set(tx, y, M[3]);
  s.set(11, 37, M[3]); s.set(15, 37, M[3]); s.set(13, 37, M[2]);
  for (let y = 36; y <= 42; y++) for (let x = 22; x <= 28; x++) { const dx = x - 25, dy = y - 39, d = dx * dx + dy * dy; if (d <= 9) s.set(x, y, d <= 1 ? M[0] : d <= 5 ? M[2] : M[3]); }
  rect(s, 9, 45, 22, 49, (x, y) => y === 45 ? W[4] : y === 46 ? W[3] : (x === 10 || x === 21) ? W[1] : s.get(x, y));
  rect(s, 18, 43, 20, 44, (x, y) => y === 43 ? M[3] : M[1]);
  rect(s, 5, 32, 32, 33, (x, y) => y === 32 ? W[3] : W[1]);
  for (const x0 of [5, 31]) rect(s, x0, 32, x0 + 1, 55, x => x === x0 ? W[3] : W[1]);
  rect(s, 34, 33, 43, 42, (x, y) => x === 34 || y === 33 ? W[4] : x === 43 || y === 42 ? W[1] : W[3]);
  for (let y = 34; y <= 41; y++) for (let x = 35; x <= 42; x++) {
    const dx = x - 38.5, dy = y - 37.5, d = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx), tooth = Math.cos(a * 6) > 0.3;
    if (d <= 1.2) s.set(x, y, W[3]); else if (d <= 2.7 || (tooth && d <= 3.8)) s.set(x, y, dx + dy < 0 ? M[3] : M[1]);
  }
  rect(s, 36, 45, 42, 55, (x, y) => {
    if (y <= 46) return y === 45 ? X[3] : DW[1];
    if (y === 48 || y === 53) return M[1];
    return y === 55 ? dk(X[2], 0.3) : [X[3], X[3], X[2], X[2], X[2], dk(X[2], 0.25), dk(X[2], 0.35)][x - 36];
  });
  rect(s, 7, 56, 30, 57, (x, y) => y === 56 ? D[2] : D[1]);
  return dress(s, SEA);
}

/* ---------- farm plot · 4×3 ---------- */
function farm() {
  const s = new Spr(64, 52);
  const SD = SEA === 'spring' ? ['#463f30', '#574f3c', '#665d47', '#766c55', '#8c8268'] : SEA === 'winter' ? ['#3f3d36', '#504d44', '#605c52', '#716d62', '#8a867a'] : D;
  rect(s, 2, 7, 61, 45, (x, y) => {
    const r = (y - 7) % 6, n = hh(x, y, 81);
    if (SEA === 'winter' && r < 3) return r === 0 ? (n < 0.3 ? SN[3] : SN[4]) : n < 0.2 ? SN[1] : SN[2];
    if (r < 3) return r === 0 ? (n < 0.4 ? SD[4] : SD[3]) : n < 0.2 ? SD[1] : SD[2];
    return r === 5 ? SD[0] : n < 0.3 ? SD[0] : SD[1];
  });
  const post = (x, y0, y1) => rect(s, x, y0, x + 1, y1, (px, py) => py === y0 ? W[4] : px === x ? W[3] : W[1]);
  const railH = (x0, x1, y) => { rect(s, x0, y, x1, y, W[3]); rect(s, x0, y + 1, x1, y + 1, W[1]); shadeRect(s, x0, y + 2, x1, y + 2, 0.3); };
  railH(1, 62, 4); for (let x = 1; x <= 61; x += 10) post(x, 1, 7); post(61, 1, 7);
  for (let k = 0; k < 7; k++) {
    const ry = 7 + k * 6; if (ry > 42) break;
    for (let cx = 5; cx <= 19; cx += 5) {
      if (hh(cx, ry, 82) < 0.1 || SEA === 'winter') continue;
      if (SEA === 'spring') { s.set(cx + 1, ry, L[4]); s.set(cx, ry + 1, L[3]); s.set(cx + 2, ry + 1, L[3]); s.set(cx + 1, ry + 1, L[2]); s.shade(cx + 1, ry + 2, 0.3); continue; }
      s.set(cx + 1, ry - 1, L[4]); s.set(cx, ry, L[3]); s.set(cx + 1, ry, L[4]); s.set(cx + 2, ry, L[3]);
      s.set(cx, ry + 1, L[2]); s.set(cx + 1, ry + 1, L[3]); s.set(cx + 2, ry + 1, L[2]); s.set(cx + 1, ry + 2, L[1]);
      s.shade(cx + 2, ry + 3, 0.3); s.shade(cx + 1, ry + 3, 0.3);
    }
    for (let cx = 25; cx <= 41; cx += 4) {
      if (SEA === 'winter') { s.set(cx, ry - 1, W[3]); s.set(cx, ry, W[2]); s.set(cx, ry + 1, W[1]); continue; }
      if (SEA === 'spring') { s.set(cx, ry - 1, G[4]); s.set(cx - 1, ry, G[3]); s.set(cx, ry, G[3]); s.set(cx, ry + 1, G[2]); continue; }
      const dead = SEA === 'fall' || hh(cx, ry, 83) < 0.12;
      for (let y = ry - 3; y <= ry + 1; y++) s.set(cx, y, dead ? W[3] : G[3]);
      s.set(cx - 1, ry - 1, dead ? W[2] : G[4]); s.set(cx + 1, ry - 2, dead ? W[2] : G[4]);
      s.set(cx, ry - 4, X[5]); s.set(cx, ry - 3, X[0]);
      s.shade(cx + 1, ry + 2, 0.3);
    }
    for (let cx = 46; cx <= 58; cx += 4) {
      if (cx >= 46 && cx <= 56 && ry >= 12 && ry <= 32) continue;
      if (SEA === 'winter') continue;
      if (SEA === 'fall') { if (hh(cx, ry, 84) < 0.3) continue; s.set(cx, ry - 2, G[1]); s.set(cx - 1, ry - 1, '#c07a34'); s.set(cx, ry - 1, '#d0913f'); s.set(cx + 1, ry - 1, '#a8592c'); s.set(cx - 1, ry, '#a8592c'); s.set(cx, ry, '#b0672f'); s.set(cx + 1, ry, '#8a3e24'); s.shade(cx, ry + 1, 0.3); s.shade(cx + 1, ry + 1, 0.3); continue; }
      s.set(cx, ry, G[4]); s.set(cx - 1, ry - 1, G[3]); s.set(cx + 1, ry - 1, G[4]);
    }
  }
  s.ellipseShadow(53, 33, 6, 1.6, 0.35);
  rect(s, 51, 18, 51, 33, W[2]);
  rect(s, 46, 20, 56, 22, (x, y) => y === 20 ? PN[4] : y === 22 ? PN[1] : PN[3]);
  rect(s, 49, 20, 53, 28, (x, y) => (x === 52 && y === 24) || (x === 50 && y === 26) ? S[2] : y === 28 ? PN[1] : x === 53 ? PN[2] : PN[3]);
  s.set(45, 21, X[5]); s.set(45, 22, X[0]); s.set(57, 21, X[5]); s.set(57, 22, X[0]);
  rect(s, 49, 14, 53, 19, (x, y) => y === 19 ? S[1] : x === 53 ? S[2] : S[3]);
  s.set(50, 16, OL); s.set(52, 16, OL); s.set(51, 18, S[1]);
  rect(s, 47, 13, 55, 13, W[1]); rect(s, 49, 10, 53, 12, (x, y) => y === 12 ? W[0] : x === 49 ? W[3] : W[2]);
  for (const x0 of [1, 61]) { rect(s, x0, 5, x0 + 1, 46, x => x === x0 ? W[3] : W[1]); for (let y = 14; y <= 40; y += 13) post(x0, y, y + 4); }
  railH(1, 27, 45); railH(36, 62, 45);
  for (const x of [1, 10, 20, 26, 36, 42, 52, 61]) post(x, 42, 49);
  shadeRect(s, 2, 50, 63, 51, 0.28);
  return dress(s, SEA);
}

/* ---------- underground shelter entrance · 2×2 ---------- */
function shelter() {
  const s = new Spr(32, 40);
  shadeRect(s, 5, 34, 31, 38, 0.32);
  rect(s, 3, 8, 28, 19, (x, y) => {
    let c = concrete(91)(x, y);
    if (hh(x >> 1, y >> 1, 92) < 0.18) c = hh(x, y, 93) < 0.5 ? G[3] : G[2];
    if (y === 8) c = R[4];
    return c;
  });
  s.line(8, 11, 13, 15, (x, y) => s.set(x, y, R[0]));
  rect(s, 3, 19, 28, 20, (x, y) => y === 19 ? R[4] : R[3]);
  rect(s, 3, 21, 28, 33, (x, y) => (x - 3) % 6 === 0 ? R[0] : y === 33 ? R[0] : hh(x, y, 94) < 0.15 ? R[0] : R[1]);
  rect(s, 9, 21, 22, 22, (x, y) => (x + y) % 4 < 2 ? X[0] : X[1]);
  rect(s, 9, 23, 22, 33, (x) => x === 9 ? M[2] : M[1]);
  rect(s, 10, 23, 21, 33, (x, y) => { const c = (y - 23) % 3 === 0 ? DW[3] : DW[2]; return dk(c, 0.75 * (1 - (y - 23) / 10)); });
  rect(s, 15, 17, 16, 18, (x, y) => y === 17 ? M[1] : X[5]);
  rect(s, 21, 2, 23, 10, x => [M[3], M[2], M[1]][x - 21]);
  rect(s, 20, 0, 24, 2, (x, y) => y === 0 ? M[3] : y === 2 ? M[0] : M[2]);
  s.shade(24, 10, 0.3); s.shade(24, 9, 0.3);
  sandbags(s, 1, 29, 8, 35); sandbags(s, 23, 29, 30, 35);
  return dress(s, SEA);
}

const disc = (s, cx, cy, r, fn) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) { const dx = x - cx, dy = y - cy, d = dx * dx + dy * dy; if (d <= r * r + r * 0.8) { const c = fn(dx, dy, d); if (c !== undefined) s.set(x, y, c); } } };
function crate(s, x0, y0, x1, y1, pal = W) {
  rect(s, x0, y0, x1, y1, (x, y) => {
    if (y <= y0 + 1) return y === y0 ? pal[4] : pal[3];
    if (x === x0 || x === x1 || y === y1 || y === y0 + 2) return pal[1];
    const fy = y - y0 - 2, w = x1 - x0, hgt = y1 - y0 - 2, t = Math.round(fy * w / hgt);
    if (x - x0 === t || x1 - x === t) return pal[1];
    return hh(x, y, 121) < 0.15 ? pal[2] : pal[3];
  });
}
function barrel(s, x0, y0, h) {
  rect(s, x0, y0, x0 + 6, y0 + h - 1, (x, y) => {
    if (y <= y0 + 1) return y === y0 ? X[3] : DW[1];
    if (y === y0 + 3 || y === y0 + h - 3) return M[1];
    return y === y0 + h - 1 ? dk(X[2], 0.3) : [X[3], X[3], X[2], X[2], X[2], dk(X[2], 0.25), dk(X[2], 0.35)][x - x0];
  });
}

/* ---------- lumber mill · 3×2 ---------- */
function lumberMill() {
  const s = new Spr(48, 50);
  shadeRect(s, 5, 44, 47, 49, 0.32);
  const bw = plank(24, W);
  rect(s, 3, 24, 44, 43, (x, y) => { const n = hh(x, y, 101); return y <= 31 ? dk(bw(x, y), 0.4) : n < 0.08 ? X[5] : n < 0.22 ? W[4] : n < 0.8 ? D[2] : D[1]; });
  dkRow(s, 3, 44, 32, 0.35);
  corrGable(s, 1, 4, 46, 23, 10, 0.25, 101);
  dkRow(s, 3, 44, 24, 0.45); dkRow(s, 3, 44, 25, 0.25);
  const logEnd = (cx, cy) => disc(s, cx, cy, 3, (dx, dy, d) => d > 7 ? (dx + dy < 0 ? X[3] : X[2]) : d <= 1 ? W[2] : dx + dy < 0 ? W[4] : W[3]);
  for (const cx of [9, 15]) logEnd(cx, 34);
  for (const cx of [6, 12, 18]) logEnd(cx, 39);
  disc(s, 35, 31, 5, (dx, dy, d) => { const a = Math.atan2(dy, dx); if (d > 20 && Math.cos(a * 8) < 0.2) return undefined; return d <= 2 ? M[0] : dx + dy < 0 ? M[3] : M[2]; });
  rect(s, 26, 32, 31, 34, (x, y) => x === 26 ? (y === 33 ? W[2] : W[4]) : y === 32 ? X[3] : X[2]);
  rect(s, 26, 35, 42, 37, (x, y) => y === 35 ? W[4] : y === 36 ? W[2] : W[1]);
  for (const lx of [27, 40]) rect(s, lx, 38, lx + 1, 42, x => x === lx ? W[2] : W[1]);
  for (const [y, a, b] of [[40, 35, 37], [41, 34, 38], [42, 33, 39]]) for (let x = a; x <= b; x++) s.set(x, y, hh(x, y, 102) < 0.4 ? X[5] : W[4]);
  for (const x0 of [3, 23, 43]) rect(s, x0, 24, x0 + 1, 43, x => x === x0 ? W[3] : W[1]);
  rect(s, 28, 44, 45, 48, (x, y) => x === 28 ? W[2] : [W[4], W[3], W[1], W[3], W[0]][y - 44]);
  rect(s, 4, 45, 9, 48, (x, y) => y === 45 ? W[4] : y === 46 ? W[3] : x < 7 ? X[3] : X[2]);
  rect(s, 6, 43, 7, 44, M[3]); s.set(8, 43, M[1]);
  for (let y = 40; y <= 44; y++) s.set(8, y - 1, W[3]);
  return dress(s, SEA);
}

/* ---------- storage depot · 3×3 ---------- */
function storage() {
  const s = new Spr(48, 60);
  shadeRect(s, 5, 54, 47, 59, 0.32);
  rect(s, 3, 28, 44, 53, brick(3, 28));
  for (const x0 of [3, 43]) rect(s, x0, 28, x0 + 1, 51, x => x === x0 ? P[3] : P[2]);
  rect(s, 3, 52, 44, 53, (x, y) => y === 52 ? R[3] : R[1]);
  corrGable(s, 1, 6, 46, 27, 13, 0.3, 111);
  dkRow(s, 3, 44, 28, 0.4); dkRow(s, 3, 44, 29, 0.2);
  rect(s, 11, 33, 36, 53, M[0]);
  rect(s, 12, 34, 35, 53, (x, y) => {
    if (y <= 43) { let c = (y - 34) % 2 === 0 ? M[3] : M[2]; if (hh(x >> 1, y, 112) < 0.1) c = X[2]; return c; }
    if (y === 44) return M[0];
    const crateSil = (x >= 14 && x <= 20 && y >= 48) || (x >= 27 && x <= 33 && y >= 46);
    return dk(crateSil ? DW[1] : DW[0], 0.4 * (1 - (y - 45) / 9));
  });
  s.set(23, 44, X[0]); s.set(24, 44, X[0]);
  rect(s, 17, 29, 30, 31, (x, y) => y === 30 && x > 18 && x < 29 && x % 2 ? W[0] : W[3]);
  win(s, 5, 34, 5, 6); win(s, 38, 34, 5, 6, true);
  rect(s, 10, 54, 37, 55, (x, y) => y === 54 ? R[4] : R[2]);
  barrel(s, 1, 45, 10);
  crate(s, 37, 45, 46, 54); crate(s, 39, 38, 45, 44);
  return dress(s, SEA);
}

/* ---------- research lab · 3×3 ---------- */
function lab() {
  const s = new Spr(48, 62);
  shadeRect(s, 5, 56, 47, 61, 0.32);
  rect(s, 3, 8, 44, 27, concrete(131));
  rect(s, 3, 8, 44, 9, (x, y) => y === 8 ? P[3] : P[2]);
  for (let y = 8; y <= 27; y++) { s.set(3, y, P[3]); s.set(44, y, P[1]); }
  dkRow(s, 4, 43, 10, 0.3);
  rect(s, 3, 26, 44, 27, (x, y) => y === 26 ? P[3] : P[1]);
  shadeRect(s, 13, 21, 20, 22, 0.3);
  rect(s, 11, 16, 12, 22, x => x === 11 ? M[1] : M[0]);
  for (let y = 9; y <= 17; y++) for (let x = 5; x <= 19; x++) {
    const ex = (x - 12) / 7, ey = (y - 13) / 4, e = ex * ex + ey * ey;
    if (e <= 1) s.set(x, y, e > 0.6 ? M[3] : ex + ey > 0.2 ? M[1] : M[2]);
  }
  s.line(12, 13, 16, 10, (x, y) => s.set(x, y, M[0])); s.set(16, 10, X[0]);
  shadeRect(s, 33, 22, 42, 23, 0.3);
  rect(s, 32, 13, 41, 21, (x, y) => y <= 14 ? (y === 13 ? M[3] : M[2]) : y === 21 ? M[0] : x === 32 ? M[3] : M[2]);
  disc(s, 37, 18, 2, (dx, dy, d) => d <= 1 ? M[1] : M[0]);
  rect(s, 26, 1, 26, 16, M[2]); rect(s, 24, 4, 28, 4, M[3]); rect(s, 25, 8, 27, 8, M[3]); rect(s, 25, 17, 27, 17, M[0]);
  s.set(26, 0, RC[1]);
  rect(s, 3, 28, 44, 55, plaster);
  dkRow(s, 3, 44, 28, 0.3);
  rect(s, 3, 30, 44, 31, (x, y) => y === 30 ? M[2] : M[1]);
  rect(s, 3, 52, 44, 55, (x, y) => y === 52 ? R[2] : R[1]);
  rect(s, 19, 36, 28, 55, M[2]);
  rect(s, 20, 37, 27, 54, (x, y) => x === 23 || x === 24 ? M[1] : (x - 20) - (y - 37) === 1 ? GL[2] : y < 44 ? GL[1] : GL[0]);
  rect(s, 18, 32, 29, 34, (x, y) => y === 33 && x > 19 && x < 28 && x % 2 ? X[5] : M[0]);
  win(s, 6, 36, 8, 8);
  for (let j = 1; j < 7; j++) for (let i = 1; i < 7; i++) if (i !== 4) s.set(6 + i, 36 + j, j < 3 ? X[5] : X[0]);
  win(s, 34, 36, 8, 8);
  rect(s, 31, 28, 32, 55, (x, y) => (y - 28) % 7 === 3 ? M[0] : x === 31 ? M[3] : M[1]);
  rect(s, 18, 56, 29, 57, (x, y) => y === 56 ? R[4] : R[2]);
  rect(s, 42, 46, 46, 56, (x, y) => y === 46 ? (x === 44 ? X[0] : s.get(x, y)) : y === 47 ? M[3] : y === 50 ? RC[1] : [M[3], M[2], M[2], M[1], M[0]][x - 42]);
  return dress(s, SEA);
}

/* ---------- armory · 2×2 ---------- */
function armory() {
  const s = new Spr(32, 42);
  shadeRect(s, 5, 36, 31, 41, 0.32);
  rect(s, 2, 6, 29, 19, concrete(141));
  for (let y = 6; y <= 19; y++) { s.set(2, y, R[3]); s.set(29, y, R[1]); }
  rect(s, 2, 18, 29, 19, (x, y) => y === 18 ? R[4] : R[2]);
  sandbags(s, 3, 3, 28, 8);
  rect(s, 6, 11, 11, 15, (x, y) => x === 6 || x === 11 || y === 11 || y === 15 ? M[0] : y === 12 ? M[2] : M[1]);
  crate(s, 18, 10, 26, 16, PN);
  rect(s, 2, 20, 29, 35, (x, y) => (x - 2 + (Math.floor((y - 20) / 5) % 2) * 3) % 7 === 0 || (y - 20) % 5 === 4 ? R[0] : hh(x, y, 142) < 0.2 ? R[0] : R[1]);
  dkRow(s, 2, 29, 20, 0.4); dkRow(s, 2, 29, 21, 0.2);
  rect(s, 9, 22, 22, 22, (x, y) => (x + y) % 4 < 2 ? X[0] : X[1]);
  rect(s, 10, 23, 21, 35, M[0]);
  rect(s, 11, 24, 20, 35, (x, y) => y === 29 ? M[1] : x === 11 ? M[3] : M[2]);
  for (const [rx, ry] of [[12, 25], [19, 25], [12, 33], [19, 33]]) s.set(rx, ry, M[3]);
  s.set(18, 30, X[0]); s.set(18, 31, X[0]);
  for (const x0 of [4, 23]) { rect(s, x0, 25, x0 + 4, 26, X[1]); rect(s, x0 - 1, 27, x0 + 5, 27, R[3]); }
  rect(s, 10, 36, 21, 37, (x, y) => y === 36 ? R[4] : R[2]);
  sandbags(s, 1, 31, 8, 37);
  crate(s, 23, 33, 30, 39, PN); s.set(26, 36, X[0]); s.set(27, 36, X[0]);
  return dress(s, SEA);
}

/* ---------- bunkhouse · 3×2 ---------- */
function bunkhouse() {
  const s = new Spr(48, 46);
  shadeRect(s, 5, 40, 47, 45, 0.32);
  rect(s, 3, 22, 44, 39, plank(22, W));
  for (const x0 of [3, 43]) rect(s, x0, 22, x0 + 1, 39, x => x === x0 ? W[4] : W[1]);
  rect(s, 36, 0, 38, 9, (x, y) => y === 0 ? M[0] : y === 3 ? M[0] : x === 36 ? M[3] : x === 37 ? M[2] : M[1]);
  corrGable(s, 1, 4, 46, 21, 10, 0.25, 151);
  rect(s, 36, 4, 38, 6, (x, y) => x === 36 ? M[3] : x === 37 ? M[2] : M[1]);
  dkRow(s, 3, 44, 22, 0.45); dkRow(s, 3, 44, 23, 0.25);
  rect(s, 20, 27, 27, 39, W[0]);
  rect(s, 21, 28, 26, 39, (x, y) => x === 21 ? W[3] : (y - 28) % 4 === 3 ? W[1] : W[2]);
  s.set(25, 34, M[3]);
  win(s, 6, 27, 8, 6); win(s, 33, 27, 8, 6, true);
  for (let i = 7; i <= 12; i++) { s.set(i, 30, W[1]); s.set(i, 31, W[2]); }
  rect(s, 29, 26, 30, 28, (x, y) => y === 26 ? M[0] : x === 29 ? X[5] : X[3]);
  rect(s, 18, 40, 29, 41, (x, y) => y === 40 ? W[4] : W[2]);
  for (const [x0, y0] of [[2, 37], [3, 34]]) rect(s, x0, y0, x0 + 8, y0 + 2, (x, y) => x === x0 + 3 || x === x0 + 6 ? W[1] : y === y0 ? PN[3] : y === y0 + 1 ? PN[2] : PN[1]);
  barrel(s, 39, 33, 8);
  return dress(s, SEA);
}

export const H = { hh, dk, rect, shadeRect, dkRow, plank, brick, plaster, concrete, corr, gable, corrGable, win, door, sandbags, disc, crate, barrel, B, P, RF, RC, GL };

/* ---------- door animations ---------- */
// Region is in sprite pixels. swing = single leaf hinged left; double = two leaves; slide = glass panels part;
// roll = shutter rises off the region; blast = steel leaves slide apart. Frame 0 closed … frame 3 open.
export const DOORS = {
  bld_town_hall: { type: 'double', x: 27, y: 49, w: 10, h: 15 },
  bld_clinic: { type: 'slide', x: 20, y: 35, w: 8, h: 14 },
  bld_barracks: { type: 'swing', x: 28, y: 34, w: 8, h: 14 },
  bld_workshop: { type: 'roll', x: 7, y: 34, w: 24, h: 22 },
  bld_shelter: { type: 'blast', x: 10, y: 23, w: 12, h: 11 },
  bld_storage: { type: 'roll', x: 12, y: 44, w: 24, h: 10, top: 34 },
  bld_lab: { type: 'slide', x: 20, y: 37, w: 8, h: 18 },
  bld_armory: { type: 'swing', x: 11, y: 24, w: 10, h: 12 },
  bld_bunkhouse: { type: 'swing', x: 21, y: 28, w: 6, h: 12 }
};
export const DOOR_FRAMES = 4;
const inner = (i, j, h) => j === h - 1 ? '#2a261f' : j === h - 2 ? '#211e18' : j < 2 ? '#0e0d0b' : hh(i, j, 401) < 0.08 ? '#221f1a' : '#16140f';
function doorFrame(src, d, k) {
  const s = new Spr(src.w, src.h); s.p = src.p.slice(); s.sh.set(src.sh);
  const t = k / (DOOR_FRAMES - 1), O = (i, j) => src.get(d.x + i, d.y + j), S = (i, j, c) => s.set(d.x + i, d.y + j, c);
  const leaf = (i0, w, hingeRight) => {
    const lw = Math.max(1, Math.round(w * (1 - 0.8 * t)));
    for (let j = 0; j < d.h; j++) for (let q = 0; q < w; q++) {
      const i = hingeRight ? i0 + w - 1 - q : i0 + q;
      if (q < lw) { const sq = Math.min(w - 1, Math.floor(q * w / lw)), si = hingeRight ? i0 + w - 1 - sq : i0 + sq; let c = O(si, j); if (t > 0 && q === lw - 1) c = W[4]; else if (c) c = dk(c, 0.35 * t); S(i, j, c); }
      else S(i, j, inner(i, j, d.h));
    }
  };
  if (d.type === 'swing') leaf(0, d.w, false);
  else if (d.type === 'double') { const h2 = d.w >> 1; leaf(0, h2, false); leaf(h2, d.w - h2, true); }
  else if (d.type === 'slide') {
    const h2 = d.w >> 1, sh = Math.round(t * h2);
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
      const si = i < h2 ? i + sh : i - sh, ok = i < h2 ? si < h2 : si >= h2;
      S(i, j, ok ? O(si, j) : inner(i, j, d.h));
    }
  } else if (d.type === 'roll') {
    const cov = Math.round((1 - t) * d.h), y0 = d.top ?? d.y;
    for (let j = 0; j < cov; j++) for (let i = 0; i < d.w; i++) {
      let c = (d.y + j - y0) % 2 === 0 ? M[3] : M[2]; if (hh(i >> 1, j, 402) < 0.08) c = X[2];
      if (j === cov - 1) c = (i === (d.w >> 1) || i === (d.w >> 1) - 1) ? X[0] : M[0];
      S(i, j, c);
    }
    if (d.top === undefined && t > 0 && t < 1) for (let i = 0; i < d.w; i++) S(i, 0, M[0]);
  } else if (d.type === 'blast') {
    const h2 = d.w >> 1, lw = Math.round((1 - t) * h2);
    for (let j = 0; j < d.h; j++) for (let q = 0; q < lw; q++) for (const [i, edge] of [[q, q === lw - 1], [d.w - 1 - q, q === lw - 1]]) {
      let c = edge ? (i < h2 ? M[3] : M[0]) : (j === 2 || j === d.h - 3) && (q % 3 === 1) ? '#c8ccd2' : j === 5 ? ((i + j) % 4 < 2 ? X[0] : X[1]) : q % 3 === 0 ? M[1] : M[2];
      S(i, j, c);
    }
  }
  return s;
}
export function doorStrip(src, d) {
  const s = new Spr(src.w * DOOR_FRAMES, src.h);
  for (let k = 0; k < DOOR_FRAMES; k++) s.blit(doorFrame(src, d, k), k * src.w, 0);
  return s;
}

export function buildBuildings(season = 'summer') {
  SEA = season;
  const A = { bld_town_hall: townHall(), bld_clinic: clinic(), bld_barracks: barracks(), bld_workshop: workshop(), bld_farm: farm(), bld_shelter: shelter(),
    bld_lumber_mill: lumberMill(), bld_storage: storage(), bld_lab: lab(), bld_armory: armory(), bld_bunkhouse: bunkhouse() };
  SEA = 'summer';
  for (const k in DOORS) A[k + '_door'] = doorStrip(A[k], DOORS[k]);
  if (season === 'summer') return A;
  const O = {}; for (const k in A) O[k + '_' + season] = A[k]; return O;
}
