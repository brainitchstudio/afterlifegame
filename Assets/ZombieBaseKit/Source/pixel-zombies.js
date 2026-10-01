// Zombie walk sheets — 24×28 frames, 4 directions × 4 frames. Same palette/outline as the tileset.
import { Spr, OL, W, DW, PN } from './pixel-assets-v2.js';

const hh = (x, y, s = 0) => { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
const EYE = '#cfc58a', BL = ['#4a1a14', '#6e2a1e'], SHOE = [DW[0], DW[1]], PUS = ['#5e6a2a', '#b4b060'];
const SKG = ['#3f4a36', '#5a6a4a', '#76865f', '#93a079'];

export const TYPES = {
  walker:  { name: 'Walker',  skin: SKG, top: ['#2e3640', '#434e5a', '#5a6674'], bot: [W[0], W[1], W[2]], hair: ['#2a2218', '#3d3122'], tw: 3, legW: 2, legLen: 7, torsoH: 8, arms: 'reach', lean: 1, shadow: 5, fps: 1, seed: 1 },
  runner:  { name: 'Runner',  skin: SKG, top: ['#4a2420', '#6a342a', '#844438'], bot: ['#262c36', '#384050', '#4a5466'], hood: true, tw: 3, legW: 2, legLen: 8, torsoH: 7, arms: 'swing', lean: 2, shadow: 5, fps: 1.6, seed: 2 },
  brute:   { name: 'Brute',   skin: ['#3a4434', '#526047', '#6c7c5c', '#879672'], top: ['#5f5d50', '#7e7b68', '#9c9882'], bot: [DW[0], DW[1], DW[2]], tw: 5, legW: 3, legLen: 7, torsoH: 10, arms: 'hang', bigArms: true, lean: 0, shadow: 7, fps: 0.7, scar: true, seed: 3 },
  bloater: { name: 'Bloater', skin: ['#4a4a2a', '#6a6a38', '#8a8a4a', '#a8a664'], top: null, bot: [W[1], W[2], W[3]], tw: 5, inset: 1, legW: 2, legLen: 6, torsoH: 9, arms: 'hang', lean: 0, shadow: 7, fps: 0.6, belly: true, pus: true, shorts: true, seed: 4 },
  soldier: { name: 'Soldier', skin: SKG, top: [PN[1], PN[2], PN[3]], bot: [PN[0], PN[1], PN[2]], vest: [DW[0], DW[1], DW[2]], helmet: [PN[0], PN[2], PN[4]], tw: 3, legW: 2, legLen: 7, torsoH: 8, arms: 'reach', lean: 1, shadow: 5, fps: 0.9, seed: 5 },
};
export const DIRS = ['s', 'n', 'e', 'w', 'se', 'sw', 'ne', 'nw'];

function frame(t, dir, f) {
  const s = new Spr(24, 28), cx = 12, FT = 25, sk = t.skin, EY = t.human ? '#2a2218' : EYE, BZ = t.human ? [sk[1], sk[1]] : BL;
  const CW = [1, 0, -1, 0][f], SW = [0, 1, 0, -1][f], bob = f % 2 ? -1 : 0;
  const hipY = FT - t.legLen + 1, legTop = hipY + bob, shY = hipY - t.torsoH + bob, hdY = shY - 6;
  const P = (x, y, c) => s.set(x, y, c), R = (x0, y0, x1, y1, fn) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P(x, y, typeof fn === 'function' ? fn(x, y) : fn); };
  const seg = (x0, y0, x1, y1, w, fn) => s.line(x0, y0, x1, y1, (x, y) => { for (let i = 0; i < w; i++) P(x + i, y, fn(x + i, y, i)); });
  const cloth = (pal, x, y, k) => { if (t.human) return pal[k]; const n = hh(x, y, t.seed * 11 + f * 0); return n < 0.07 ? sk[1] : n < 0.11 ? BZ[1] : pal[k]; };
  const topC = (x, y, k) => t.top ? cloth(t.top, x, y, k) : sk[k + 1];
  const pus = (x, y, base) => t.pus && hh(x, y, 77) < 0.09 ? PUS[1] : t.pus && hh(x, y - 1, 77) < 0.09 ? PUS[0] : base;
  s.ellipseShadow(12, 26, t.shadow, 1.8, 0.35);

  if (dir !== 'e') {
    const front = dir === 's' || dir === 'se', dg = dir.length === 2 ? 1 : 0, hc = cx + dg;
    const legs = [[cx - t.tw + (t.inset || 0) - dg * CW, (SW > 0 ? 2 : 0) + (dg && CW < 0 ? 1 : 0)], [cx + t.tw - t.legW - (t.inset || 0) + dg * CW + dg, (SW < 0 ? 2 : 0) + (dg && CW > 0 ? 1 : 0)]];
    for (const [x0, lift] of legs) for (let y = legTop; y <= FT - lift; y++) for (let i = 0; i < t.legW; i++) {
      const x = x0 + i, k = i === 0 ? 2 : i === t.legW - 1 ? 0 : 1;
      let c = y >= FT - lift - 1 ? SHOE[y === FT - lift ? 0 : 1] : (t.shorts && y > legTop + 2) ? sk[k + 1] : cloth(t.bot, x, y, k);
      P(x, y, c);
    }
    const aw = t.bigArms ? 3 : 2, arms = [[cx - t.tw - aw + dg, -SW], [cx + t.tw, SW]];
    const armPx = (x0, y0, len, i0) => { for (let j = 0; j < len; j++) for (let i = 0; i < aw; i++) { const x = x0 + i, y = y0 + j, k = i === 0 ? 2 : 1; P(x, y, j < (t.sleeve ?? 3) && t.top && !t.bigArms ? topC(x, y, k) : j >= len - 2 ? sk[k + 1] : sk[k]); } };
    if (t.arms !== 'reach') for (const [x0, sw] of arms) armPx(x0, shY + 1 + (t.arms === 'swing' ? sw : Math.max(0, sw)), t.torsoH - 1, 0);
    else for (const [x0] of arms) armPx(x0, shY + 1, 3, 0);
    R(cx - t.tw + dg, shY, cx + t.tw - 1, hipY - 1 + bob, (x, y) => {
      const k = x === cx - t.tw + dg ? 2 : x >= cx + t.tw - 1 - dg ? 0 : 1;
      if (y === hipY - 1 + bob && t.top) return t.top[0];
      return pus(x, y, topC(x, y, k));
    });
    if (t.belly) R(cx - t.tw - 1, shY + 3, cx + t.tw, shY + 7, (x, y) => x === cx - t.tw - 1 ? sk[2] : x === cx + t.tw ? sk[0] : s.get(x, y));
    if (t.belly && front) { P(cx - 1, shY + 5, sk[0]); P(cx - 2, shY + 3, BZ[0]); P(cx - 3, shY + 4, BZ[1]); }
    if (t.vest) R(cx - t.tw + 1, shY + 1, cx + t.tw - 2, hipY - 2 + bob, (x, y) => front && (y === shY + 5) && x !== cx - 1 && x !== cx ? t.vest[2] : x === cx - t.tw + 1 ? t.vest[2] : t.vest[1]);
    if (t.arms === 'reach' && front) { const hy = shY + 3 + (f % 2); R(cx - t.tw - 1 + dg * 2, hy, cx - t.tw + dg * 2, hy + 1, sk[3]); R(cx + t.tw - 1 + dg * 2, hy, cx + t.tw + dg * 2, hy + 1, sk[2]); }
    R(hc - 3, hdY, hc + 2, hdY + 5, (x, y) => pus(x, y, y === hdY + 5 ? sk[1] : x === hc - 3 ? sk[3] : x === hc + 2 ? sk[1] : sk[2]));
    if (front) {
      const e = dg; P(hc - 2 + e, hdY + 2, sk[1]); P(hc + 1 + e, hdY + 2, sk[1]); P(hc - 2 + e, hdY + 3, EY); if (hc + 1 + e <= hc + 2) P(hc + 1 + e, hdY + 3, EY);
      P(hc - 1 + e, hdY + 4, BZ[0]); P(hc + e, hdY + 4, BZ[0]); P(hc - 1 + e, hdY + 5, BZ[1]);
    }
    if (dg) { P(hc - 3, hdY + 3, sk[1]); P(hc - 3, hdY + 4, sk[1]);
    }
    if (t.hair) R(hc - 3, hdY, hc + 2, hdY + (front ? 1 : 4), (x, y) => hh(x, y, 91) < 0.22 ? s.get(x, y) : t.hair[(x + y) % 3 ? 0 : 1]);
    if (t.hood) R(hc - 3, hdY - 1, hc + 2, hdY + 5, (x, y) => front && x > hc - 3 + dg && x <= hc + 1 + dg && y > hdY ? s.get(x, y) : t.top[x === hc - 3 ? 2 : y === hdY - 1 ? 1 : x === hc + 2 ? 0 : 1]);
    if (t.helmet) { R(hc - 4, hdY - 1, hc + 3, hdY + 1, (x, y) => t.helmet[y === hdY - 1 ? 2 : x === hc + 3 ? 0 : 1]); R(hc - 4, hdY + 2, hc + 3, hdY + 2, t.helmet[0]); if (!front) R(hc - 3, hdY + 3, hc + 2, hdY + 3, t.helmet[0]); }
    if (t.scar) { P(hc - 2, hdY + 1, BZ[0]); P(hc - 1, hdY, BZ[0]); P(hc, hdY + 1, BZ[0]); }
    if (t.style) hairFB(s, t, front, dg, hc, hdY);
  } else {
    const L = t.lean, ts = L >> 1, hw = t.tw > 3 ? 4 : 2, sx = cx + ts;
    const legC = (far) => (x, y, i) => y >= FT - 1 ? SHOE[0] : t.shorts && y > legTop + 2 ? sk[far ? 1 : 2] : cloth(t.bot, x, y, far ? 0 : i === 0 ? 2 : 1);
    const leg = (foot, lift, far) => { seg(cx - 1, legTop, foot - 1, FT - lift, t.legW, legC(far)); P(foot - 1 + t.legW, FT - lift, SHOE[0]); };
    leg(cx - 3 * CW, SW < 0 ? 2 : 0, true);
    const aw = t.bigArms ? 3 : 2;
    const hand = (far) => (x, y, i) => sk[far ? 1 : 2];
    const arm = (x0, y0, x1, y1, far) => {
      let n = 0; const pts = []; s.line(x0, y0, x1, y1, (x, y) => pts.push([x, y]));
      pts.forEach(([x, y], j) => { for (let i = 0; i < aw; i++) { const hand_ = j >= pts.length - 2, sleeve = j < (t.sleeve ?? 3) && t.top && !t.bigArms; P(x + (y1 === y0 ? 0 : i), y + (y1 === y0 ? i : 0), hand_ ? sk[far ? 2 : 3] : sleeve ? topC(x, y, far ? 0 : 1) : sk[far ? 1 : 2]); } });
    };
    const hy = f % 2;
    if (t.arms === 'reach') arm(sx + 1, shY + 1 + hy, sx + 6, shY + 1 + hy, true);
    else if (t.arms === 'swing') arm(sx, shY + 1, sx + 3 * CW, shY + 6, true);
    else arm(sx + 1, shY + 1, sx + 1 - CW, shY + t.torsoH - 1, true);
    R(sx - hw, shY, sx + hw - 1, hipY - 1 + bob, (x, y) => pus(x, y, y === hipY - 1 + bob && t.top ? t.top[0] : topC(x, y, x === sx - hw ? 2 : x === sx + hw - 1 ? 0 : 1)));
    if (t.belly) R(sx + hw, shY + 3, sx + hw + 1, shY + 7, (x, y) => (x === sx + hw + 1 && (y === shY + 3 || y === shY + 7)) ? null : pus(x, y, sk[1]));
    if (t.vest) R(sx - hw, shY + 1, sx + hw - 1, hipY - 2 + bob, (x, y) => x === sx + hw - 1 ? t.vest[0] : y === shY + 5 ? t.vest[2] : t.vest[1]);
    leg(cx + 3 * CW, SW > 0 ? 2 : 0, false);
    if (t.arms === 'reach') arm(sx - 1, shY + 2 + hy, sx + 5, shY + 2 + hy, false);
    else if (t.arms === 'swing') arm(sx - 1, shY + 1, sx - 1 - 3 * CW, shY + 6, false);
    else arm(sx - 1, shY + 1, sx - 1 + CW, shY + t.torsoH - 1, false);
    const hx = cx - 2 + L;
    R(hx, hdY, hx + 4, hdY + 5, (x, y) => pus(x, y, y === hdY + 5 ? sk[1] : x === hx ? sk[1] : x === hx + 4 ? sk[3] : sk[2]));
    P(hx + 3, hdY + 2, sk[1]); P(hx + 3, hdY + 3, EY); P(hx + 4, hdY + 4, BZ[0]); P(hx + 4, hdY + 5, BZ[1]); P(hx + 1, hdY + 3, sk[1]);
    if (t.hair) R(hx, hdY, hx + 4, hdY + 1, (x, y) => hh(x, y, 91) < 0.22 ? s.get(x, y) : t.hair[(x + y) % 3 ? 0 : 1]), R(hx, hdY + 2, hx, hdY + 3, t.hair[0]);
    if (t.hood) R(hx - 1, hdY - 1, hx + 4, hdY + 5, (x, y) => x >= hx + 2 && y > hdY ? s.get(x, y) : t.top[y === hdY - 1 ? 2 : x === hx - 1 ? 0 : 1]);
    if (t.helmet) { R(hx - 1, hdY - 1, hx + 5, hdY + 1, (x, y) => t.helmet[y === hdY - 1 ? 2 : 1]); R(hx - 1, hdY + 2, hx + 5, hdY + 2, t.helmet[0]); }
    if (t.scar) { P(hx + 1, hdY, BZ[0]); P(hx + 2, hdY + 1, BZ[0]); }
    if (t.style) hairSide(s, t, hx, hdY);
  }
  s.outline(OL); return s;
}


function hairFB(s, t, front, dg, hc, hdY) {
  const H = t.hairC, P = (x, y, c) => s.set(x, y, c), R = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P(x, y, typeof c === 'function' ? c(x, y) : c); };
  const hc_ = (x, y) => x % 3 === 1 && (y + x) % 4 !== 0 ? H[1] : H[0], st = t.style, l = hc - 3, r = hc + 2;
  if (st === 'buzz') { R(l, hdY, r, hdY, hc_); if (!front) R(l, hdY + 1, r, hdY + 2, hc_); }
  if (['short', 'long', 'pony', 'bun'].includes(st)) {
    R(l + 1, hdY - 1, r - 1, hdY - 1, hc_); R(l, hdY, r, hdY, hc_);
    if (front) { P(l, hdY + 1, H[0]); P(r, hdY + 1, H[0]); if (!dg) P(l + 1, hdY + 1, H[1]); else P(l, hdY + 2, H[0]); }
    else R(l, hdY + 1, r, hdY + (st === 'short' ? 3 : 4), hc_);
  }
  if (st === 'long') {
    if (front) { R(l - 1, hdY + 1, l, hdY + 8, hc_); if (!dg) R(r, hdY + 1, r + 1, hdY + 8, hc_); else R(r, hdY + 1, r, hdY + 3, hc_); }
    else R(l - 1, hdY + 1, r + 1, hdY + 8, hc_);
  }
  if (st === 'pony') { if (front) { R(l, hdY + 1, l, hdY + 2, H[0]); R(r, hdY + 1, r, hdY + 2, H[0]); } else R(hc - 1, hdY + 4, hc, hdY + 9, hc_); }
  if (st === 'bun') { R(hc - 2, hdY - 2, hc + 1, hdY - 2, hc_); R(hc - 1, hdY - 3, hc, hdY - 3, H[1]); }
  if (st === 'cap' || st === 'beanie') {
    const C = t.hatC;
    if (!front) R(l, hdY + 2, r, hdY + 3, hc_); else { P(l, hdY + 2, H[0]); P(r, hdY + 2, H[0]); }
    R(l + 1, hdY - 2, r - 1, hdY - 2, C[2]); R(l, hdY - 1, r, hdY + 1, (x, y) => y === hdY + 1 && st === 'beanie' ? C[2] : x === r ? C[0] : C[1]);
    if (st === 'cap' && front) R(l - (dg ? 0 : 0), hdY + 2, r + dg, hdY + 2, C[0]);
  }
  if (t.beard && front) R(l, hdY + 4, r, hdY + 5, (x, y) => y === hdY + 4 && (x === hc - 1 + dg || x === hc + dg) ? H[1] : hc_(x, y));
}
function hairSide(s, t, hx, hdY) {
  const H = t.hairC, P = (x, y, c) => s.set(x, y, c), R = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P(x, y, typeof c === 'function' ? c(x, y) : c); };
  const hc_ = (x, y) => x % 3 === 1 && (y + x) % 4 !== 0 ? H[1] : H[0], st = t.style;
  if (st === 'buzz') R(hx, hdY, hx + 3, hdY, hc_), R(hx, hdY + 1, hx, hdY + 2, H[0]);
  if (['short', 'long', 'pony', 'bun'].includes(st)) { R(hx, hdY - 1, hx + 3, hdY - 1, hc_); R(hx, hdY, hx + 4, hdY, hc_); R(hx, hdY + 1, hx + 1, hdY + 1, hc_); R(hx, hdY + 2, hx, hdY + 3, H[0]); }
  if (st === 'long') R(hx - 1, hdY, hx + 1, hdY + 8, (x, y) => y > hdY + 3 && x === hx + 1 ? s.get(x, y) : hc_(x, y));
  if (st === 'pony') R(hx - 2, hdY + 1, hx - 1, hdY + 6, (x, y) => (y === hdY + 1 && x === hx - 2) ? null : hc_(x, y));
  if (st === 'bun') R(hx - 1, hdY - 2, hx, hdY - 1, hc_);
  if (st === 'cap' || st === 'beanie') {
    const C = t.hatC; R(hx, hdY + 2, hx, hdY + 3, H[0]);
    R(hx + 1, hdY - 2, hx + 3, hdY - 2, C[2]); R(hx, hdY - 1, hx + 4, hdY + 1, (x, y) => y === hdY + 1 && st === 'beanie' ? C[2] : C[1]);
    if (st === 'cap') R(hx + 5, hdY + 1, hx + 6, hdY + 1, C[0]);
  }
  if (t.beard) R(hx + 1, hdY + 4, hx + 4, hdY + 5, (x, y) => x === hx + 4 && y === hdY + 4 ? H[1] : hc_(x, y));
}

function flip(src) { const s = new Spr(src.w, src.h); for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const a = y * src.w + x, b = y * src.w + (src.w - 1 - x); s.p[a] = src.p[b]; s.sh[a] = src.sh[b]; } return s; }


const SKN = { light: ['#7a5a44', '#a07a5e', '#c49a78', '#dcb898'], medium: ['#5e4030', '#80583e', '#a07252', '#bc8e6a'], tan: ['#6a4a34', '#8c6446', '#ac7e58', '#c69a70'], dark: ['#3a261c', '#553828', '#704a34', '#8a5e42'] };
const HR = { black: ['#1c1a18', '#2e2a26'], brown: ['#3d2a1c', '#5a4028'], blonde: ['#8a7440', '#b09a58'], red: ['#5a2a18', '#7e3e22'], grey: ['#6e6c64', '#9a978c'] };
const DEN = ['#262c36', '#384050', '#4a5466'];
const H0 = { human: true, arms: 'swing', lean: 0, tw: 3, legW: 2, legLen: 7, torsoH: 8, shadow: 5, fps: 1.2, sleeve: 5 };
const F0 = { ...H0, torsoH: 7 };
export const SURVIVORS = {
  mechanic:  { ...H0, name: 'Mechanic', sex: 'M', skin: SKN.medium, hairC: HR.black, style: 'cap', hatC: [W[0], W[1], W[2]], top: ['#4f4a38', '#625b44', '#736b50'], bot: ['#4f4a38', '#625b44', '#736b50'], seed: 11 },
  doctor:    { ...H0, name: 'Doctor', sex: 'M', skin: SKN.light, hairC: HR.brown, style: 'short', top: ['#7e7b68', '#9c9882', '#b5b19a'], bot: DEN, seed: 12 },
  hunter:    { ...H0, name: 'Hunter', sex: 'M', skin: SKN.tan, hairC: HR.brown, style: 'beanie', hatC: [PN[1], PN[2], PN[3]], beard: true, top: ['#4a2420', '#6a342a', '#844438'], bot: DEN, seed: 13 },
  guard:     { ...H0, name: 'Guard', sex: 'M', skin: SKN.dark, hairC: HR.black, style: 'buzz', top: [PN[1], PN[2], PN[3]], bot: [PN[0], PN[1], PN[2]], vest: [DW[0], DW[1], DW[2]], seed: 14 },
  elder:     { ...H0, name: 'Elder farmer', sex: 'M', skin: SKN.light, hairC: HR.grey, style: 'buzz', beard: true, top: ['#6e674c', '#8a8262', '#a69e7c'], bot: DEN, fps: 1, seed: 15 },
  scavenger: { ...F0, name: 'Scavenger', sex: 'F', skin: SKN.medium, hairC: HR.brown, style: 'pony', top: ['#26383a', '#34504e', '#466864'], bot: ['#524c38', '#6e674c', '#8a8262'], seed: 16 },
  nurse:     { ...F0, name: 'Nurse', sex: 'F', skin: SKN.light, hairC: HR.blonde, style: 'bun', top: ['#3a5a50', '#4a7266', '#5e8a7c'], bot: ['#3a5a50', '#4a7266', '#5e8a7c'], seed: 17 },
  engineer:  { ...F0, name: 'Engineer', sex: 'F', skin: SKN.dark, hairC: HR.black, style: 'beanie', hatC: ['#2e3640', '#434e5a', '#5a6674'], top: ['#5a3322', '#7a4a2c', '#94613a'], bot: [DW[0], DW[1], DW[2]], seed: 18 },
  ranger:    { ...F0, name: 'Ranger', sex: 'F', skin: SKN.tan, hairC: HR.black, style: 'long', top: [W[0], W[1], W[2]], bot: DEN, seed: 19 },
  grower:    { ...F0, name: 'Grower', sex: 'F', skin: SKN.light, hairC: HR.red, style: 'long', top: ['#6a5a2a', '#8a7636', '#a89448'], bot: [W[1], W[2], W[3]], seed: 20 },
};
function buildSet(types, prefix) {
  const frames = {}, sheets = {};
  for (const k in types) {
    const t = types[k], F = { s: [], n: [], e: [], w: [], se: [], sw: [], ne: [], nw: [] };
    for (let f = 0; f < 4; f++) { F.s.push(frame(t, 's', f)); F.n.push(frame(t, 'n', f)); F.e.push(frame(t, 'e', f)); F.w.push(flip(F.e[f])); F.se.push(frame(t, 'se', f)); F.ne.push(frame(t, 'ne', f)); F.sw.push(flip(F.se[f])); F.nw.push(flip(F.ne[f])); }
    frames[k] = F;
    const sh = new Spr(96, 224);
    DIRS.forEach((d, r) => F[d].forEach((fr, c) => sh.blit(fr, c * 24, r * 28)));
    sheets[prefix + k] = sh;
  }
  return { frames, sheets };
}
export const buildZombies = () => buildSet(TYPES, 'zombie_');
export const buildSurvivors = () => buildSet(SURVIVORS, 'survivor_');
