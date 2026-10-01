// Supplies card: bitmap font, UI parts, and a JS mirror of the Unity logic (SupplyStore.cs / SuppliesCard.cs).
// No imports, so the same file generates the PNGs that ship in ZombieBaseKit/Art/UI.

export const CHARS = '0123456789+-./ SUPLIEFOWKMDH';
const GL = {
  '0': ['.##.', '#..#', '#..#', '#..#', '.##.'], '1': ['.#..', '##..', '.#..', '.#..', '###.'], '2': ['###.', '...#', '.##.', '#...', '####'], '3': ['###.', '...#', '.##.', '...#', '###.'],
  '4': ['#..#', '#..#', '####', '...#', '...#'], '5': ['####', '#...', '###.', '...#', '###.'], '6': ['.##.', '#...', '###.', '#..#', '.##.'], '7': ['####', '...#', '..#.', '.#..', '.#..'],
  '8': ['.##.', '#..#', '.##.', '#..#', '.##.'], '9': ['.##.', '#..#', '.###', '...#', '.##.'],
  '+': ['...', '.#.', '###', '.#.', '...'], '-': ['...', '...', '###', '...', '...'], '.': ['.', '.', '.', '.', '#'], '/': ['...#', '..#.', '..#.', '.#..', '#...'], ' ': ['..', '..', '..', '..', '..'],
  'S': ['.###', '#...', '.##.', '...#', '###.'], 'U': ['#..#', '#..#', '#..#', '#..#', '.##.'], 'P': ['###.', '#..#', '###.', '#...', '#...'], 'L': ['#...', '#...', '#...', '#...', '####'], 'I': ['###', '.#.', '.#.', '.#.', '###'],
  'E': ['####', '#...', '###.', '#...', '####'], 'F': ['####', '#...', '###.', '#...', '#...'], 'O': ['.##.', '#..#', '#..#', '#..#', '.##.'], 'W': ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  'K': ['#..#', '#.#.', '##..', '#.#.', '#..#'], 'M': ['#...#', '##.##', '#.#.#', '#...#', '#...#'], 'D': ['###.', '#..#', '#..#', '#..#', '###.'], 'H': ['#..#', '#..#', '####', '#..#', '#..#']
};
export const WIDTHS = [...CHARS].map(c => GL[c][0].length);
export const CELL = 6, GH = 5;
export const T = { txt: '#d6d8c6', mut: '#8b8f78', lime: '#c5d48a', red: '#d0694f', redDim: '#7a2e24', amb: '#d4a24a', sh: '#0b0d09', rule: '#343c2d' };
export const RAMP = { lime: ['#6f7d45', '#a3b56a', '#cfe08e'], amber: ['#8a6a2a', '#c4a24a', '#e6c874'], red: ['#7a2e24', '#a8453a', '#cf6a55'] };
const OL = '#1a1e16';

export class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.p = new Array(w * h).fill(null); }
  set(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = c; }
}
export function toCanvas(b) {
  const cv = document.createElement('canvas'); cv.width = b.w; cv.height = b.h;
  const x = cv.getContext('2d'), im = x.createImageData(b.w, b.h);
  b.p.forEach((c, i) => { if (!c) return; const n = parseInt(c.slice(1), 16); im.data.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], i * 4); });
  x.putImageData(im, 0, 0); return cv;
}

/* ---------- parts ---------- */
export function fontAtlas(scale) {
  const b = new Buf(CHARS.length * CELL * scale, GH * scale);
  [...CHARS].forEach((c, i) => GL[c].forEach((row, y) => [...row].forEach((v, x) => {
    if (v === '#') for (let j = 0; j < scale; j++) for (let k = 0; k < scale; k++) b.set(i * CELL * scale + x * scale + k, y * scale + j, '#ffffff');
  })));
  return b;
}
export const measure = (s, scale = 1) => { let w = 0; for (const ch of String(s).toUpperCase()) { const i = CHARS.indexOf(ch); w += (WIDTHS[i < 0 ? 14 : i] + 1) * scale; } return Math.max(0, w - scale); };
const FR = {
  panel: { o: OL, hi: '#4a5440', lo: '#232820', f: '#1d2119', rivet: 1 },
  strip: { o: OL, hi: '#343c2d', lo: '#161a12', f: '#1d2119' },
  btn: { o: OL, hi: '#5a664c', lo: '#262c20', f: '#343c2c', drop: '#161a12' },
  hover: { o: OL, hi: '#76845f', lo: '#2e3526', f: '#434d38', drop: '#161a12' },
  down: { o: OL, hi: '#1c2018', lo: '#3a4332', f: '#2b3224', press: 1 }
};
export function frame(w, h, kind) {
  const k = FR[kind], b = new Buf(w, h), y0 = k.press ? 1 : 0;
  for (let y = y0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = x === 0 || x === w - 1, cy = y === y0 || y === h - 1; if (cx && cy) continue;
    let c = k.f;
    if (cx || cy) c = k.o; else if (k.drop && y >= h - 3) c = k.drop; else if (y === y0 + 1 || x === 1) c = k.hi; else if (x === w - 2 || y === h - 2) c = k.lo;
    b.set(x, y, c);
  }
  if (k.rivet) for (const [x, y] of [[3, 3], [w - 5, 3], [3, h - 5], [w - 5, h - 5]]) { b.set(x, y, '#6a7560'); b.set(x + 1, y, '#4a5440'); b.set(x, y + 1, '#4a5440'); b.set(x + 1, y + 1, '#141711'); }
  return b;
}
export function chevron(dir, state) {
  const b = frame(11, 11, state === 'normal' ? 'btn' : state), dy = state === 'down' ? 1 : 0, c = state === 'hover' ? '#eef0de' : T.txt;
  const up = [[5, 4], [4, 5], [5, 5], [6, 5], [3, 6], [4, 6], [6, 6], [7, 6]], pts = dir === 'up' ? up : up.map(([x, y]) => [x, 10 - y]);
  for (const [x, y] of pts) b.set(x, y + 1 + dy, T.sh);
  for (const [x, y] of pts) b.set(x, y + dy, c);
  return b;
}
export function barBack() { const b = new Buf(4, 4); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) b.set(x, y, x === 0 || y === 0 || x === 3 || y === 3 ? OL : '#0c0e0a'); return b; }
export function barFill(r) { const b = new Buf(6, 2); for (let x = 0; x < 6; x++) { b.set(x, 0, x === 5 ? r[1] : r[2]); b.set(x, 1, x === 5 ? r[0] : r[1]); } return b; }
export const PARTS = {
  sup_font_s: () => fontAtlas(1), sup_font_l: () => fontAtlas(2), sup_strip: () => frame(16, 16, 'strip'), sup_panel: () => frame(24, 24, 'panel'),
  sup_chevron_up: () => chevron('up', 'normal'), sup_chevron_up_hover: () => chevron('up', 'hover'), sup_chevron_up_down: () => chevron('up', 'down'),
  sup_chevron_down: () => chevron('down', 'normal'), sup_chevron_down_hover: () => chevron('down', 'hover'), sup_chevron_down_down: () => chevron('down', 'down'),
  sup_bar_back: barBack, sup_fill_lime: () => barFill(RAMP.lime), sup_fill_amber: () => barFill(RAMP.amber), sup_fill_red: () => barFill(RAMP.red)
};
export const BORDERS = { sup_strip: 4, sup_panel: 8, sup_bar_back: 1 };

/* ---------- store (mirror of SupplyStore.cs) ---------- */
export class Store {
  constructor(defs, now = 0) { this.s = defs.map(d => ({ low: 0.15, ...d, hist: [], manual: null })); this.window = 60; this.lowSeconds = 60; this.t0 = now; this.on = []; }
  add(i, n, now) {
    const s = this.s[i], b = s.amount; s.amount = Math.max(0, Math.min(s.capacity, s.amount + n));
    const d = s.amount - b; if (d) { s.hist.push([now, d]); this.on.forEach(f => f(i, d)); } return d;
  }
  spend(i, n, now) { if (this.s[i].amount < n) return false; this.add(i, -n, now); return true; }
  rate(i, now) {
    const s = this.s[i]; if (s.manual != null) return s.manual;
    while (s.hist.length && s.hist[0][0] < now - this.window) s.hist.shift();
    const span = Math.min(this.window, Math.max(1, now - this.t0)); return s.hist.reduce((a, h) => a + h[1], 0) * 60 / span;
  }
  isLow(i, now) { const s = this.s[i], r = this.rate(i, now); return s.amount <= s.capacity * s.low || (r < 0 && s.amount / (-r / 60) < this.lowSeconds); }
  isFull(i) { return this.s[i].amount >= this.s[i].capacity; }
}

/* ---------- card (mirror of SuppliesCard.cs) ---------- */
export const LAYOUT = { W: 120, HEAD: 18, ROW: 24, PADB: 5, BTN_X: 104, BTN_Y: 4, AMT_X: 30, BAR_W: 85, RIGHT: 114, CH: 15 };
LAYOUT.H = LAYOUT.HEAD + 3 * LAYOUT.ROW + LAYOUT.PADB;
export const fmtAmount = n => n < 10000 ? String(n) : n < 1e6 ? (Math.floor(n / 100) / 10).toFixed(1).replace(/\.0$/, '') + 'K' : (Math.floor(n / 1e5) / 10).toFixed(1).replace(/\.0$/, '') + 'M';
export const fmtRate = (r, sfx = '/M') => Math.abs(r) < 0.05 ? '0' + sfx : (r > 0 ? '+' : '-') + (Math.abs(r) >= 100 ? Math.abs(r).toFixed(0) : Math.abs(r).toFixed(1)) + sfx;

export class Card {
  constructor(store, art, o = {}) {
    this.store = store; this.art = art; this.collapsed = !!o.collapsed; this.sfx = o.suffix || '/M';
    this.rows = store.s.map(s => ({ shown: s.amount, flash: 0, flashCol: T.lime })); this.pops = []; this.hover = false; this.press = false; this.anim = null;
    this.tints = {}; store.on.push((i, d) => this.changed(i, d));
  }
  changed(i, d) {
    const r = this.rows[i]; r.flash = 0.35; r.flashCol = d > 0 ? T.lime : T.red;
    if (!this.collapsed) { this.pops = this.pops.filter(p => p.i !== i); this.pops.push({ i, text: (d > 0 ? '+' : '-') + fmtAmount(Math.abs(d)), col: d > 0 ? T.lime : T.red, t: 0 }); }
  }
  toggle() { if (this.anim) return; this.anim = { t: 0, to: !this.collapsed }; }
  update(dt) {
    for (let i = 0; i < this.rows.length; i++) {
      const r = this.rows[i], a = this.store.s[i].amount;
      r.shown += (a - r.shown) * Math.min(1, dt * 10); if (Math.abs(a - r.shown) < 0.5) r.shown = a;
      r.flash = Math.max(0, r.flash - dt);
    }
    this.pops.forEach(p => p.t += dt); this.pops = this.pops.filter(p => p.t < 0.9);
    if (this.anim) { this.anim.t += dt; if (this.anim.t >= 0.06 && this.anim.to !== this.collapsed) this.collapsed = this.anim.to; if (this.anim.t >= 0.12) this.anim = null; }
  }
  tint(key, col) { const k = key + col; if (!this.tints[k]) { const src = this.art[key], c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); this.tints[k] = c; } return this.tints[k]; }
  text(ctx, str, x, y, col, scale = 1, right = false, alpha = 1) {
    str = String(str).toUpperCase(); if (right) x -= measure(str, scale);
    const key = scale === 1 ? 'fontS' : 'fontL', sh = this.tint(key, T.sh), fc = this.tint(key, col);
    ctx.globalAlpha = alpha;
    for (const [src, oy] of [[sh, scale], [fc, 0]]) {
      let cx = x;
      for (const ch of str) { const i = Math.max(0, CHARS.indexOf(ch)), w = WIDTHS[i] * scale; if (ch !== ' ') ctx.drawImage(src, i * CELL * scale, 0, w, GH * scale, cx, y + oy, w, GH * scale); cx += w + scale; }
    }
    ctx.globalAlpha = 1;
  }
  nine(ctx, img, b, x, y, w, h) {
    const W = img.width, H = img.height, sx = [0, b, W - b, W], dx = [x, x + b, x + w - b, x + w], sy = [0, b, H - b, H], dy = [y, y + b, y + h - b, y + h];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const sw = sx[i + 1] - sx[i], shh = sy[j + 1] - sy[j], dw = dx[i + 1] - dx[i], dh = dy[j + 1] - dy[j]; if (sw && shh && dw > 0 && dh > 0) ctx.drawImage(img, sx[i], sy[j], sw, shh, dx[i], dy[j], dw, dh); }
  }
  tiled(ctx, img, x, y, w, h) { for (let px = 0; px < w; px += img.width) ctx.drawImage(img, 0, 0, Math.min(img.width, w - px), h, x + px, y, Math.min(img.width, w - px), h); }
  state(i, now) {
    const s = this.store.s[i], full = this.store.isFull(i), low = !full && this.store.isLow(i, now), blink = Math.floor(now * 2.5) % 2 === 0;
    return { s, full, low, amt: full ? T.amb : low ? (blink ? T.red : T.redDim) : T.txt, cap: full ? T.amb : T.mut, fill: full ? 'fillAmber' : low ? 'fillRed' : 'fillLime' };
  }
  collapsedWidth() { let x = 5; this.rows.forEach(r => { x += 12 + measure(fmtAmount(Math.round(r.shown))) + 7; }); return x + 13; }
  size() { return this.collapsed ? [this.collapsedWidth(), LAYOUT.CH] : [LAYOUT.W, LAYOUT.H]; }
  hit(x, y) {
    if (this.collapsed) { const [w, h] = this.size(); return x >= 0 && y >= 0 && x < w && y < h; }
    return x >= LAYOUT.BTN_X && x < LAYOUT.BTN_X + 11 && y >= LAYOUT.BTN_Y && y < LAYOUT.BTN_Y + 11;
  }
  draw(ctx, X, Y, now) {
    const [w, h] = this.size();
    let clipH = h; if (this.anim) { const p = this.anim.t < 0.06 ? 1 - this.anim.t / 0.06 : (this.anim.t - 0.06) / 0.06; clipH = Math.max(1, Math.round(h * Math.min(1, p))); }
    ctx.save(); ctx.beginPath(); ctx.rect(X, Y, w, clipH); ctx.clip();
    const st = this.hover ? (this.press ? 'Down' : 'Hover') : '';
    if (this.collapsed) {
      this.nine(ctx, this.art.strip, 4, X, Y, w, h);
      let x = X + 5;
      this.rows.forEach((r, i) => {
        const S = this.state(i, now), t = fmtAmount(Math.round(r.shown));
        ctx.drawImage(this.art.minis[i], x, Y + 3);
        this.text(ctx, t, x + 12, Y + 5, r.flash > 0 ? r.flashCol : S.amt);
        x += 12 + measure(t) + 7;
      });
      ctx.drawImage(this.art['chevDown' + st], x - 2, Y + 2);
    } else {
      this.nine(ctx, this.art.panel, 8, X, Y, w, h);
      this.text(ctx, 'SUPPLIES', X + 7, Y + 7, T.mut);
      ctx.drawImage(this.art['chevUp' + st], X + LAYOUT.BTN_X, Y + LAYOUT.BTN_Y);
      ctx.fillStyle = T.rule; ctx.fillRect(X + 5, Y + 16, LAYOUT.W - 10, 1);
      this.rows.forEach((r, i) => {
        const S = this.state(i, now), ry = Y + LAYOUT.HEAD + i * LAYOUT.ROW, t = fmtAmount(Math.round(r.shown)), ax = X + LAYOUT.AMT_X;
        ctx.drawImage(this.art.icons[i], X + 4, ry);
        this.text(ctx, t, ax, ry + 3, S.amt, 2);
        const cx = ax + measure(t, 2) + 3, pop = this.pops.find(p => p.i === i);
        if (pop) { const k = pop.t / 0.9; this.text(ctx, pop.text, cx, ry + 8 - Math.round(k * 6), pop.col, 1, false, k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45); }
        else this.text(ctx, '/' + fmtAmount(S.s.capacity), cx, ry + 8, S.cap);
        const rate = this.store.rate(i, now);
        this.text(ctx, fmtRate(rate, this.sfx), X + LAYOUT.RIGHT, ry + 3, rate > 0.05 ? T.lime : rate < -0.05 ? T.red : T.mut, 1, true);
        this.nine(ctx, this.art.barBack, 1, ax, ry + 17, LAYOUT.BAR_W, 4);
        const fw = Math.round((LAYOUT.BAR_W - 2) * Math.min(1, S.s.amount / S.s.capacity)); if (fw > 0) this.tiled(ctx, this.art[S.fill], ax + 1, ry + 18, fw, 2);
      });
    }
    ctx.restore();
  }
}
