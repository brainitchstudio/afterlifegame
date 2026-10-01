// Hand-held light sources: torches (warm radial, flickering) and flashlights (cool cone).
// Lights reveal the ungraded "day" colours under a tint, stepped to 4 levels with a 4×4 Bayer dither.
import { Spr, LIGHTS, gradeHex } from './pixel-assets-v2.js';

// How strongly hand-held lights read at each time of day.
export const DARK = { early_morning: 0.45, morning: 0, day: 0, early_evening: 0.3, evening: 0.75, night: 1, late_night: 1 };
export const LAMPS = {
  torch: { r: 38, tint: [1.22, 0.9, 0.6], add: [0.07, 0.025, 0] },
  flash: { len: 88, half: 0.4, pool: 11, tint: [1.0, 1.04, 1.12], add: [0.03, 0.045, 0.07] }
};
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v;
const YS = 1.3; // top-down 3/4: light pools read as ellipses

export function torchRadius(L, t) { return LAMPS.torch.r * (1 + 0.05 * Math.sin(t * 17 + L.seed) + 0.035 * Math.sin(t * 31 + L.seed * 3)); }

function stamp(buf, kind, w, h, L, t) {
  const put = (i, v, k) => { if (v > buf[i]) { buf[i] = v; kind[i] = k; } };
  if (L.type === 'torch') {
    const r = torchRadius(L, t), x0 = Math.max(0, L.x - r | 0), x1 = Math.min(w - 1, L.x + r | 0), y0 = Math.max(0, L.y - r / YS | 0), y1 = Math.min(h - 1, L.y + r / YS | 0);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - L.x, dy = (y - L.y) * YS, d = Math.sqrt(dx * dx + dy * dy) / r;
      if (d < 1) put(y * w + x, clamp((1 - d) * 1.45), 1);
    }
  } else {
    const F = LAMPS.flash, n = Math.hypot(L.dx, L.dy) || 1, ux = L.dx / n, uy = L.dy / n, R = F.len;
    const x0 = Math.max(0, L.x - R | 0), x1 = Math.min(w - 1, L.x + R | 0), y0 = Math.max(0, L.y - R | 0), y1 = Math.min(h - 1, L.y + R | 0);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - L.x, dy = (y - L.y) * YS, d = Math.sqrt(dx * dx + dy * dy); let v = 0;
      if (d < F.pool) v = 0.45 * (1 - d / F.pool);
      if (d > 0 && d < R) {
        const a = Math.acos(Math.max(-1, Math.min(1, (dx * ux + dy * uy) / d)));
        if (a < F.half) v = Math.max(v, clamp(Math.pow(1 - d / R, 0.6) * (1 - Math.pow(a / F.half, 2)) * 1.6));
      }
      if (v > 0) put(y * w + x, v, 2);
    }
  }
}

// Draws sprite s graded for `light`, with lamps revealing warm/cool area light. t in seconds (flicker).
export function renderLit(cv, s, light, lamps, t = 0) {
  const w = s.w, h = s.h; if (cv.width !== w) cv.width = w; if (cv.height !== h) cv.height = h;
  const k = DARK[light] ?? 0, buf = new Float32Array(w * h), kind = new Uint8Array(w * h);
  if (k > 0) lamps.forEach(L => stamp(buf, kind, w, h, L, t));
  const Lt = LIGHTS[light], sc = Lt ? Lt.shc : [10, 8, 12], sa = Lt ? Lt.sh : 1, T = [null, LAMPS.torch, LAMPS.flash];
  const ctx = cv.getContext('2d'), im = ctx.createImageData(w, h), d = im.data;
  for (let i = 0; i < s.p.length; i++) {
    const x = i % w, y = (i / w) | 0; let q = 0;
    if (buf[i] > 0) q = Math.min(1, Math.floor(buf[i] * k * 4 + BAY[(x & 3) + ((y & 3) << 2)] / 16) / 4);
    const c = s.p[i], o = i * 4;
    if (c) {
      const D = gradeHex(c, light);
      if (q > 0) {
        const B = gradeHex(c, 'day'), P = T[kind[i]];
        for (let j = 0; j < 3; j++) { const lit = Math.min(255, B[j] * P.tint[j] + P.add[j] * 255); d[o + j] = Math.round(D[j] + (lit - D[j]) * q); }
      } else { d[o] = D[0]; d[o + 1] = D[1]; d[o + 2] = D[2]; }
      d[o + 3] = 255;
    } else if (s.sh[i] > 0) { d[o] = sc[0]; d[o + 1] = sc[1]; d[o + 2] = sc[2]; d[o + 3] = Math.round(Math.min(1, s.sh[i] * sa) * (1 - q * 0.6) * 255); }
  }
  ctx.putImageData(im, 0, 0);
  lamps.forEach(L => drawProp(ctx, L, t, k));
}

// Emissive hand-held props, drawn after grading so they stay bright.
function drawProp(ctx, L, t, k) {
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const x = L.x, y = L.y;
  if (L.type === 'torch') {
    px(x, y + 1, '#3a2a1c'); px(x, y + 2, '#3a2a1c'); px(x, y + 3, '#2a1f16');
    const f = Math.floor(t * 11 + L.seed) % 3;
    px(x, y, '#f6d27a'); px(x, y - 1, '#e89a3a');
    if (f !== 1) px(x, y - 2, '#d0662a');
    if (f === 0) px(x - 1, y, '#c8582a'); if (f === 2) px(x + 1, y - 1, '#c8582a');
    if (k > 0.5 && f === 1) px(x, y - 3, '#f8e6a8');
  } else {
    const sx = Math.sign(L.dx), sy = Math.sign(L.dy);
    px(x - sx, y - sy, '#2c2e2c'); px(x, y, '#474a46');
    px(x + sx, y + sy, k > 0 ? '#fbf6dc' : '#9aa09a');
  }
}

/* ---------- exportable light assets ---------- */
const greys = ['#404040', '#808080', '#bfbfbf', '#ffffff'];
function cookie(w, h, fn) {
  const s = new Spr(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fn(x, y); if (v <= 0) continue;
    const q = Math.min(4, Math.floor(v * 4 + BAY[(x & 3) + ((y & 3) << 2)] / 16)); if (q > 0) s.set(x, y, greys[q - 1]);
  }
  return s;
}
export function buildLightAssets() {
  const A = {}, r = LAMPS.torch.r, F = LAMPS.flash;
  const tw = Math.ceil(r * 2) + 2, th = Math.ceil(r * 2 / YS) + 2;
  A.light_torch = cookie(tw, th, (x, y) => { const dx = x + 0.5 - tw / 2, dy = (y + 0.5 - th / 2) * YS, d = Math.hypot(dx, dy) / r; return clamp((1 - d) * 1.45); });
  const fw = F.len + F.pool + 2, fh = Math.ceil(Math.sin(F.half) * F.len * 2 / YS) + 4, ox = F.pool + 1, oy = fh / 2;
  A.light_flashlight_e = cookie(fw, fh, (x, y) => {
    const dx = x + 0.5 - ox, dy = (y + 0.5 - oy) * YS, d = Math.hypot(dx, dy); let v = d < F.pool ? 0.45 * (1 - d / F.pool) : 0;
    if (d > 0 && d < F.len) { const a = Math.abs(Math.atan2(dy, dx)); if (a < F.half) v = Math.max(v, clamp(Math.pow(1 - d / F.len, 0.6) * (1 - Math.pow(a / F.half, 2)) * 1.6)); }
    return v;
  });
  const strip = new Spr(24, 8);
  for (let f = 0; f < 3; f++) {
    const X = f * 8 + 3, Y = 3, P = (x, y, c) => strip.set(x, y, c);
    P(X, Y + 1, '#3a2a1c'); P(X, Y + 2, '#3a2a1c'); P(X, Y + 3, '#2a1f16'); P(X, Y, '#f6d27a'); P(X, Y - 1, '#e89a3a');
    if (f !== 1) P(X, Y - 2, '#d0662a'); if (f === 0) P(X - 1, Y, '#c8582a'); if (f === 2) P(X + 1, Y - 1, '#c8582a'); if (f === 1) P(X, Y - 3, '#f8e6a8');
  }
  A.prop_torch = strip;
  const fl = new Spr(5, 3); fl.set(1, 1, '#2c2e2c'); fl.set(2, 1, '#474a46'); fl.set(3, 1, '#fbf6dc');
  A.prop_flashlight = fl;
  return A;
}
