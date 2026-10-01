// The clock card's day strip: a tall window onto the sky, drawn pixel by pixel and shown at 3× like
// the Supplies card. The whole day scrolls through it (night, dawn, day, dusk, with the sun at noon
// and the moon at midnight) so the current hour sits at the fixed marker across the middle; the next
// six hours come in at the top and the last six leave at the bottom.
import { useEffect, useRef } from 'react';

export const DIAL_ZOOM = 3;
const W = 18, H = 41, MID = (H - 1) / 2;
// Hours per pixel row inside the frame (three pixels of frame at each end), so the window spans ±6h.
const PER_ROW = 12 / (H - 6);
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// The kit palette: outline, rim frame and highlight, the marker and the sky's stops through the day.
const OUTLINE = hex('#1a1e16'), RIM = hex('#4a5440'), RIM_LIGHT = hex('#6f7d45'), RIM_SHADE = hex('#2b3224');
const TICK = hex('#8b8f78'), TICK_MAIN = hex('#c5d48a'), NEEDLE = hex('#e6c874'), NEEDLE_DARK = hex('#8a6a2a');
const SKY = [[0, '#1c2433'], [4.5, '#1c2433'], [5.75, '#b0703f'], [7, '#6f95a0'], [17, '#6f95a0'], [18.25, '#a4513f'], [19.5, '#1c2433'], [24, '#1c2433']].map(([h, c]) => [h, hex(c)]);
const HORIZON = hex('#12150f');
const STARS = [[20.4, 0.15, 1], [21.2, 0.7, 0], [22.4, 0.3, 0], [23.3, 0.9, 1], [0.9, 0.1, 1], [1.8, 0.8, 0], [2.9, 0.35, 0], [3.7, 0.65, 1]];
const STAR = [hex('#d6d8c6'), hex('#8b8f78')];
// 3 × 3 sprites, row by row; null is see-through.
const SUN = [['#d4a24a', '#e6c874', '#d4a24a'], ['#e6c874', '#f6e7a8', '#e6c874'], ['#d4a24a', '#e6c874', '#d4a24a']].map(r => r.map(hex));
const MOON = [['#d6d8c6', '#d6d8c6', null], ['#d6d8c6', '#aeb29c', null], ['#d6d8c6', '#d6d8c6', null]].map(r => r.map(c => c && hex(c)));

const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function sky(h) {
  // Half-hour bands, so the gradient steps like pixel art instead of blending smoothly.
  h = Math.floor(((h % 24) + 24) % 24 * 2) / 2;
  for (let i = 1; i < SKY.length; i++) {
    const [h1, c1] = SKY[i];
    if (h <= h1) { const [h0, c0] = SKY[i - 1]; return lerp(c0, c1, (h - h0) / (h1 - h0 || 1)); }
  }
  return SKY[0][1];
}
const hourAtRow = (y, hour) => hour + (MID - y) * PER_ROW;
const rowOf = (at, hour) => { let d = ((at - hour) % 24 + 36) % 24 - 12; return Math.round(MID - d / PER_ROW); };

function paint(ctx, hour) {
  const img = ctx.createImageData(W, H), px = img.data;
  const put = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H || !c) return; const i = (y * W + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; };
  const inSky = (x, y) => x >= 3 && x < W - 3 && y >= 3 && y < H - 3;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    // Rounded outer corners, then outline, a lit rim (top and left), a shaded rim and an inner shadow.
    if (edge === 0 && (x === 0 || x === W - 1) && (y === 0 || y === H - 1)) continue;
    if (edge === 0) put(x, y, OUTLINE);
    else if (edge === 1) put(x, y, x === 1 || y === 1 ? RIM_LIGHT : RIM);
    else if (edge === 2) put(x, y, RIM_SHADE);
    else put(x, y, x === 3 || y === 3 ? lerp(sky(hourAtRow(y, hour)), HORIZON, 0.35) : sky(hourAtRow(y, hour)));
  }
  // Ticks on both rims every three hours; dawn and dusk in lime.
  for (let t = 0; t < 24; t += 3) {
    const y = rowOf(t, hour);
    if (y > 2 && y < H - 3) { const c = t === 6 || t === 18 ? TICK_MAIN : TICK; put(1, y, c); put(W - 2, y, c); }
  }
  for (const [at, fx, dim] of STARS) {
    const x = Math.round(4 + fx * (W - 9)), y = rowOf(at, hour);
    if (inSky(x, y)) put(x, y, STAR[dim]);
  }
  const sprite = (at, cells) => {
    const cx = Math.floor(W / 2), cy = rowOf(at, hour);
    cells.forEach((row, j) => row.forEach((c, i) => { if (inSky(cx + i - 1, cy + j - 1)) put(cx + i - 1, cy + j - 1, c); }));
  };
  sprite(12, SUN);
  sprite(0, MOON);
  // The fixed marker across the middle: a thin line with a notch at each rim.
  const y = MID;
  for (let x = 3; x < W - 3; x++) if (x % 2 === 1) put(x, y, NEEDLE);
  for (const [x, dir] of [[1, 1], [W - 2, -1]]) {
    put(x, y, NEEDLE); put(x + dir, y, NEEDLE); put(x, y - 1, NEEDLE_DARK); put(x, y + 1, NEEDLE_DARK); put(x + dir, y - 1, NEEDLE_DARK); put(x + dir, y + 1, NEEDLE_DARK);
  }
  ctx.putImageData(img, 0, 0);
}

export function DayDial({ hour }) {
  const ref = useRef(null);
  // Five-minute steps: the strip scrolls a notch at a time rather than repainting every frame.
  const step = Math.floor(hour * 12) / 12;
  useEffect(() => { const ctx = ref.current?.getContext('2d'); if (ctx) paint(ctx, step); }, [step]);
  return <canvas ref={ref} className="day-dial" width={W} height={H} style={{ width: W * DIAL_ZOOM, height: H * DIAL_ZOOM }} aria-label="Time of day" />;
}
