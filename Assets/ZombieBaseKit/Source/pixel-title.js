// Title screen: background, logo, main menu, new game / load / settings panels.
import { Spr, OL, PN, mkRng, scene, buildAll, gate, wall, tower } from './pixel-assets-v2.js';
import { buildZombies } from './pixel-zombies.js';
import { buildBuildings } from './pixel-buildings.js';
import { frame, measure, text, T, RP, Ico, ICONS, mix, rgb, hex, closeBtn, bar, plate } from './pixel-ui.js';

const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const dth = (x, y, t) => t * 16 > BY[y & 3][x & 3] + .5;
const night = c => { const [r, g, b] = rgb(c), l = r * .3 + g * .59 + b * .11; return hex([r * .36 + l * .08 + 6, g * .42 + l * .1 + 10, b * .48 + l * .12 + 17]); };
const SW = 960, SH = 540, DIM = '#565b4c', PW = 402;

function crop(s, m = 0) {
  let x0 = s.w, y0 = s.h, x1 = -1, y1 = -1;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.p[y * s.w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const o = new Spr(x1 - x0 + 1 + m * 2, y1 - y0 + 1 + m * 2); o.blit(s, m - x0, m - y0); return o;
}
function put(dst, src, x, y) { dst.blit(src, x, y); (src.hits || []).forEach(h => dst.hits.push({ ...h, x: h.x + x, y: h.y + y })); }

/* ---------- background ---------- */
function pine(S, cx, base, h, hw, col, rim) {
  for (let j = 0; j < h; j++) { const y = base - h + j, w = Math.round(hw * (j / h) * (.72 + .28 * ((j % 6) / 5))); for (let x = cx - w; x <= cx + w; x++) S.set(x, y, x === cx + w && rim ? rim : col); }
  for (let y = base; y < base + 3; y++) S.set(cx, y, col);
}
function background() {
  const s = new Spr(SW, SH), r = mkRng(77), HZ = 320;
  const SKY = ['#0a0e11', '#0d1216', '#10171a', '#141c1e', '#192221', '#1f2925'];
  for (let y = 0; y < HZ + 40; y++) { const t = Math.min(y, HZ - 1) / HZ * (SKY.length - 1), i = Math.floor(t), f = t - i; for (let x = 0; x < SW; x++) s.set(x, y, dth(x, y, f) ? SKY[Math.min(i + 1, SKY.length - 1)] : SKY[i]); }
  const MX = 862, MY = 84, MR = 30;
  for (let i = 0; i < 220; i++) {
    const x = r() * SW | 0, y = r() * 270 | 0; if (Math.hypot(x - MX, y - MY) < MR + 52) continue;
    const b = r(); s.set(x, y, b < .12 ? '#dfe4ec' : b < .45 ? '#7c8696' : '#3c4450');
    if (b < .025) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) s.set(x + dx, y + dy, '#4c5664');
  }
  for (let y = MY - MR - 48; y <= MY + MR + 48; y++) for (let x = MX - MR - 48; x <= MX + MR + 48; x++) {
    const d = Math.hypot(x + .5 - MX, y + .5 - MY); if (d <= MR) continue; const t = 1 - (d - MR) / 48; if (t > 0 && dth(x, y, t * t * .8)) s.set(x, y, t > .6 ? '#243238' : '#1a252a');
  }
  for (let y = MY - MR; y <= MY + MR; y++) for (let x = MX - MR; x <= MX + MR; x++) {
    const dx = x + .5 - MX, dy = y + .5 - MY, d = Math.hypot(dx, dy); if (d > MR) continue;
    const v = .5 - (dx + dy) / (MR * 2.6); let c = v > .62 ? '#e2e8f2' : v > .34 ? '#b4bed2' : '#8a94aa'; if (d > MR - 1.5) c = v > .5 ? '#b4bed2' : '#6e7890'; s.set(x, y, c);
  }
  [[-9, -6, 6], [8, 4, 4.5], [-4, 13, 3.5], [13, -11, 3], [-16, 7, 2.5]].forEach(([ox, oy, cr]) => {
    for (let y = Math.floor(MY + oy - cr - 1); y <= MY + oy + cr + 1; y++) for (let x = Math.floor(MX + ox - cr - 1); x <= MX + ox + cr + 1; x++) {
      const dx = x + .5 - MX - ox, dy = y + .5 - MY - oy, d = Math.hypot(dx, dy); if (d > cr || Math.hypot(x + .5 - MX, y + .5 - MY) > MR - 1.5) continue;
      s.set(x, y, d > cr - 1 && dx + dy > 0 ? '#eef2f8' : mix(s.get(x, y), '#4a5468', .32));
    }
  });
  for (let x = 0; x < SW; x++) { const h = Math.round(268 + 12 * Math.sin(x / 110) + 7 * Math.sin(x / 43 + 1.3) + 3 * Math.sin(x / 15 + .4)); for (let y = h; y < HZ + 30; y++) s.set(x, y, y === h ? '#1e2926' : '#141c1a'); }
  for (let x = -10; x < SW + 10; x += 4 + r() * 7) pine(s, x | 0, 322 + (r() * 6 | 0), 22 + r() * 26 | 0, 5 + r() * 4 | 0, '#0f1614', '#17211e');
  for (let y = 290; y < 334; y++) { const t = 1 - Math.abs(y - 314) / 22; if (t <= 0) continue; for (let x = 0; x < SW; x++) { const n = .5 + .5 * Math.sin(x / 37 + y / 9); if (dth(x, y, t * .38 * n)) s.set(x, y, '#27332f'); } }

  const TS = buildAll(), L = new Spr(SW, SH), gv = [TS.grass_a, TS.grass_b, TS.grass_c];
  for (let y = HZ; y < SH; y += 16) for (let x = 0; x < SW; x += 16) { const v = r(); L.blit(gv[v < .6 ? 0 : v < .88 ? 1 : 2], x, y); }
  for (let x = -8; x < SW + 8; x += 5 + r() * 7) pine(L, x | 0, 334 + (r() * 12 | 0), 28 + r() * 30 | 0, 7 + r() * 5 | 0, r() < .5 ? PN[1] : PN[0], PN[3]);
  const objs = [], WX = 576, WT = 392;
  for (let x = WX; x < SW; x += 16) { if (x === 736 || x === 752) continue; objs.push({ spr: wall('palisade', x === WX ? { e: true, s: true } : { e: true, w: true }), x, y: WT - 16, key: WT + 16 }); }
  objs.push({ spr: gate('wood', false), x: 736, y: WT - 16, key: WT + 16 });
  for (let y = WT + 16; y < SH + 16; y += 16) objs.push({ spr: wall('palisade', { n: true, s: true }), x: WX, y: y - 16, key: y + 16 });
  objs.push({ spr: tower(true), x: 596, y: 364, key: 420 }); objs.push({ spr: tower(true), x: 900, y: 364, key: 420 });
  const BB = buildBuildings();
  objs.push({ spr: BB.bld_town_hall, x: 648, y: 432, key: 432 + BB.bld_town_hall.h }); objs.push({ spr: BB.bld_clinic, x: 812, y: 444, key: 444 + BB.bld_clinic.h });
  const Z = buildZombies().frames, ty = Object.keys(Z), zf = (d) => Z[ty[r() * ty.length | 0]][d][r() * 4 | 0];
  for (let i = 0; i < 16; i++) { const x = 300 + r() * 250 | 0, y = 352 + r() * 160 | 0, d = y < 390 ? 'se' : y > 470 ? 'ne' : 'e'; objs.push({ spr: zf(d), x, y, key: y + 28 }); }
  for (let i = 0; i < 7; i++) { const x = 610 + r() * 300 | 0, y = 344 + r() * 12 | 0; if (x > 724 && x < 770) continue; objs.push({ spr: zf('s'), x, y, key: y + 28 }); }
  objs.sort((a, b) => a.key - b.key).forEach(o => L.blit(o.spr, o.x, o.y));
  for (let i = 0; i < L.p.length; i++) if (L.p[i]) L.p[i] = night(L.p[i]);
  s.blit(L, 0, 0);

  const lights = [[612, 374, 48], [916, 374, 48], [733, 394, 30], [771, 394, 30], [680, 470, 40]];
  for (const [lx, ly, R] of lights) {
    for (let y = ly - R; y <= ly + R; y++) for (let x = lx - R; x <= lx + R; x++) { const t = 1 - Math.hypot(x - lx, y - ly) / R, c = s.get(x, y); if (t > 0 && c && dth(x, y, t * .9)) s.set(x, y, mix(c, '#d4a24a', .22 + .3 * t)); }
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) s.set(lx + dx, ly + dy, '#c4a24a');
    s.set(lx, ly, '#f6e4a8');
  }
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const vx = (x - SW / 2) / (SW / 2), vy = (y - SH / 2) / (SH / 2), v = Math.max(0, (Math.hypot(vx * .9, vy) - .78) / .55);
    const cx = (x - SW / 2) / 300, cy = (y - 290) / 230, t = Math.min(1, Math.max(0, 1 - Math.hypot(cx, cy)) * .7 + v);
    if (t > 0 && dth(x, y, t)) { const c = s.get(x, y); if (c) s.set(x, y, mix(c, '#050607', .55)); }
  }
  return s;
}

/* ---------- logo ---------- */
const BONE = ['#5e5a46', '#8a8670', '#b9b79e', '#dcdcc6', '#f2f2e2'];
function logo(str) {
  const tmp = new Spr(measure(str, 16) + 8, 24); text(tmp, str, 2, 2, '#fff', 16, null);
  let y0 = 99, y1 = -1; for (let y = 0; y < tmp.h; y++) for (let x = 0; x < tmp.w; x++) if (tmp.get(x, y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const Z = 5, P = 12, LH = (y1 - y0 + 1) * Z, w = tmp.w * Z + P * 2, h = LH + P * 2 + 24, s = new Spr(w, h), r = mkRng(31);
  const on = (x, y) => y >= P && y < P + LH && tmp.get(Math.floor((x - P) / Z), Math.floor((y - P) / Z) + y0);
  for (let y = P; y < P + LH; y++) for (let x = 0; x < w; x++) if (on(x, y)) {
    const v = 3.2 * (1 - (y - P) / LH), k = Math.floor(v); let c = BONE[Math.min(3, k + (dth(x, y, v - k) ? 1 : 0))];
    if (!on(x, y - 1)) c = BONE[4]; else if (!on(x, y + 1)) c = BONE[0]; else if (!on(x - 1, y)) c = BONE[3]; else if (!on(x + 1, y)) c = BONE[1];
    s.set(x, y, c);
  }
  for (let n = 0; n < 9; n++) {
    let x, y, t = 0; do { x = P + r() * (w - P * 2) | 0; y = P + r() * LH * .6 | 0; } while (!on(x, y) && ++t < 80);
    for (let k = 0, len = 5 + r() * 9 | 0; k < len; k++) { if (on(x, y) && on(x, y - 1) && on(x, y + 1)) s.set(x, y, '#3e3a2e'); y++; x += r() < .5 ? 1 : r() < .5 ? -1 : 0; }
  }
  const bot = P + LH - 1; let last = -99;
  for (let x = P; x < w - P; x++) {
    if (!on(x, bot) || !on(x + 2, bot) || x - last < 10 || r() > .09) continue; last = x;
    const len = 4 + r() * 16 | 0, wd = 2 + (r() < .4 ? 1 : 0);
    for (let y = bot - 6; y <= bot; y++) for (let dx = -3; dx <= wd + 2; dx++) if (on(x + dx, y) && dth(x + dx, y, (y - bot + 7) / 7)) s.set(x + dx, y, dx < 0 || dx >= wd ? RP.red[0] : RP.red[1]);
    for (let i = 0; i < wd; i++) { const L2 = i === 0 || i === wd - 1 ? len - 1 : len; for (let y = bot + 1; y <= bot + L2; y++) s.set(x + i, y, i === 0 ? RP.red[2] : i === wd - 1 ? RP.red[0] : RP.red[1]); }
    for (let i = -1; i <= wd; i++) s.set(x + i, bot + len + 1, i === -1 ? RP.red[2] : RP.red[0]);
    s.set(x, bot + len, RP.red[2]); s.set(x, bot + len + 2, RP.red[0]);
  }
  s.outline(OL); s.outline('#0b0d09');
  const q = s.p.slice(); for (let y = 3; y < h; y++) for (let x = 2; x < w; x++) if (!q[y * w + x] && q[(y - 3) * w + x - 2]) s.set(x, y, '#060705');
  return crop(s);
}
function logoSub(str, w) {
  const s = new Spr(w, 12), tw = measure(str), x0 = (w - tw) >> 1; text(s, str, x0, 3, T.lime);
  for (let x = 6; x < x0 - 8; x++) { s.set(x, 5, '#6f7d45'); s.set(x, 6, '#2e3527'); }
  for (let x = x0 + tw + 8; x < w - 6; x++) { s.set(x, 5, '#6f7d45'); s.set(x, 6, '#2e3527'); }
  return s;
}

/* ---------- widgets ---------- */
function menuBtn(label, kind, w = 220) {
  const f = frame(w, 28, kind), dy = kind.endsWith('own') ? 1 : 0, pri = kind.startsWith('primary'), off = kind === 'off';
  text(f, label, w >> 1, 7 + dy, off ? DIM : pri ? T.ink : kind === 'hover' ? '#eef0de' : T.txt, 16, pri || off ? null : T.sh, 'c'); return f;
}
const caret = () => new Ico(12, 14).poly([[2, 2], [9.5, 7], [2, 12]], RP.lime, 1).finish();
function sbtn(label, kind, w, col) {
  const f = frame(w, 18, kind), dy = kind.endsWith('own') ? 1 : 0, pri = kind.startsWith('primary'), off = kind === 'off';
  text(f, label, w >> 1, 5 + dy, col || (off ? DIM : pri ? T.ink : T.txt), 8, pri || off ? null : T.sh, 'c'); return f;
}
function field(w, val, focus) {
  const f = frame(w, 18, focus ? 'select' : 'inset'), tw = text(f, val, 6, 6, T.txt, 8, null);
  if (focus) for (let y = 5; y < 13; y++) for (let x = 0; x < 4; x++) f.set(8 + tw + x, y, T.lime);
  return f;
}
function checkbox(on) {
  const f = frame(11, 11, on ? 'owned' : 'inset');
  if (on) [[2, 5], [3, 6], [4, 7], [5, 6], [6, 5], [7, 4], [8, 3]].forEach(([x, y]) => { f.set(x, y, '#cfe08e'); f.set(x, y + 1, '#6f7d45'); });
  return f;
}
function toggle(on) {
  const lw = measure('OFF'), s = new Spr(lw + 32, 13); text(s, on ? 'ON' : 'OFF', lw, 4, on ? T.lime : T.mut, 8, T.sh, 'r');
  const t = frame(26, 13, on ? 'owned' : 'inset'); t.blit(frame(11, 9, on ? 'primary' : 'btn'), on ? 13 : 2, 2); s.blit(t, lw + 6, 0); return s;
}
function slider(v, hover) {
  const s = new Spr(118, 12); s.blit(bar(90, v, RP.lime, 6), 0, 3); s.blit(frame(7, 12, hover ? 'hover' : 'btn'), 2 + Math.round(86 * v) - 3, 0);
  text(s, String(Math.round(v * 100)), 117, 3, hover ? T.lime : T.txt, 8, T.sh, 'r'); return s;
}
function tri(s, x, y, dir, c) { for (let i = 0; i < 4; i++) for (let j = -3 + i; j <= 3 - i; j++) s.set(x + (dir > 0 ? i : 3 - i), y + j, c); }
function stepper(val, w = 118) {
  const s = new Spr(w, 16), a = frame(16, 16, 'btn'), b = frame(16, 16, 'btn'); tri(a, 6, 6, -1, T.txt); tri(b, 7, 6, 1, T.txt);
  const m = frame(w - 36, 16, 'inset'); text(m, val, (w - 36) >> 1, 5, T.txt, 8, null, 'c');
  s.blit(a, 0, 0); s.blit(m, 18, 0); s.blit(b, w - 16, 0); return s;
}
function keycap(label, listen) {
  if (listen) { const f = frame(measure('PRESS A KEY') + 10, 15, 'research'); text(f, 'PRESS A KEY', 5, 5, T.amb, 8, null); return f; }
  const w = Math.max(17, measure(label) + 10), f = frame(w, 15, 'btn'); text(f, label, w >> 1, 4, T.txt, 8, T.sh, 'c'); return f;
}
function tabs(list, act, pre) {
  const ws = list.map(t => measure(t) + 12), s = new Spr(ws.reduce((a, b) => a + b + 3, -3), 16); s.hits = []; let x = 0;
  list.forEach((t, i) => { const f = frame(ws[i], 16, i === act ? 'select' : 'off'); text(f, t, 6, 5, i === act ? T.lime : T.mut, 8, null); s.blit(f, x, 0); s.hits.push({ x, y: 0, w: ws[i], h: 16, to: pre + t.toLowerCase() }); x += ws[i] + 3; });
  return s;
}
function panel(w, h, title, back = 'main') { const s = frame(w, h, 'panel'); text(s, title, 8, 8, T.lime); s.blit(closeBtn(), w - 19, 5); s.hits = [{ x: w - 19, y: 5, w: 13, h: 13, to: back }]; return s; }
function footer(s, left, right) {
  let x = 6; left.forEach(([l, k, w, col, to]) => { s.blit(sbtn(l, k, w, col), x, s.h - 24); s.hits.push({ x, y: s.h - 24, w, h: 18, to }); x += w + 4; });
  x = s.w - 6; right.forEach(([l, k, w, col, to]) => { x -= w; s.blit(sbtn(l, k, w, col), x, s.h - 24); s.hits.push({ x, y: s.h - 24, w, h: 18, to }); x -= 4; });
}

/* ---------- menus & panels ---------- */
const ITEMS = [['NEW GAME', 'new'], ['LOAD GAME', 'load'], ['SETTINGS', 'settings_video'], ['QUIT', 'quit']];
function mainMenu(C, sel = 0) {
  const s = new Spr(236, ITEMS.length * 36 - 8); s.hits = [];
  ITEMS.forEach(([l, to], i) => { const y = i * 36; s.blit(menuBtn(l, i === 0 ? 'primary' : i === sel ? 'hover' : 'btn'), 16, y); s.hits.push({ x: 16, y, w: 220, h: 28, to }); if (i === sel) s.blit(C, 1, y + 6); });
  return s;
}
function hintBar() {
  const parts = [['W', 'S', 'SELECT'], ['ENTER', 'CONFIRM'], ['ESC', 'BACK']], items = [];
  parts.forEach(p => { p.slice(0, -1).forEach(k => items.push(keycap(k))); items.push(p[p.length - 1]); });
  let w = 0; items.forEach(it => w += (typeof it === 'string' ? measure(it) + 14 : it.w + 3)); const s = new Spr(w, 15); let x = 0;
  items.forEach(it => { if (typeof it === 'string') { text(s, it, x + 2, 5, T.mut); x += measure(it) + 14; } else { s.blit(it, x, 0); x += it.w + 3; } });
  return s;
}
function dcard(icon, n, d, sel, w = 126) {
  const f = frame(w, 60, sel ? 'select' : 'inset'), c = w >> 1; f.blit(icon, c - 12, 6);
  text(f, n, c, 35, sel ? T.lime : T.txt, 8, null, 'c'); text(f, d, c, 47, T.mut, 8, null, 'c'); return f;
}
const DIFF = [['day', 'EASY', 'FEWER RAIDS'], ['night', 'NORMAL', 'STANDARD'], ['zombie', 'HARD', 'BIG HORDES']];
function newGame(I) {
  const w = PW, s = panel(w, 232, 'NEW GAME');
  text(s, 'SETTLEMENT NAME', 8, 26, T.mut); s.blit(field(w - 12, 'ASHFORD', true), 6, 36);
  text(s, 'DIFFICULTY', 8, 62, T.mut); DIFF.forEach(([ic, n, d], i) => s.blit(dcard(I[ic], n, d, i === 1), 6 + i * 132, 72));
  text(s, 'MAP SEED', 8, 142, T.mut); s.blit(field(w - 98, '48213', false), 6, 152); s.blit(sbtn('RANDOM', 'btn', 80), w - 86, 152);
  s.blit(checkbox(false), 6, 180); text(s, 'PERMADEATH', 22, 183, T.txt); text(s, 'ONE SAVE, NO RELOADS', w - 8, 183, T.mut, 8, T.sh, 'r');
  footer(s, [['BACK', 'btn', 72, null, 'main']], [['START', 'primary', 120, null, 'main']]); return s;
}
function thumb(seed) {
  const sc = scene(seed), s = new Spr(52, 34);
  for (let y = 0; y < 34; y++) for (let x = 0; x < 52; x++) { let r = 0, g = 0, b = 0, n = 0; for (let j = 0; j < 8; j += 2) for (let i = 0; i < 8; i += 2) { const c = sc.p[(y * 8 + j) * sc.w + x * 8 + i]; if (c) { const q = rgb(c); r += q[0]; g += q[1]; b += q[2]; n++; } } if (n) s.set(x, y, hex([r / n, g / n, b / n])); }
  return s;
}
function slot(o, sel, sw = PW - 12) {
  const f = frame(sw, 44, o ? (sel ? 'select' : 'inset') : 'off');
  if (!o) { text(f, 'EMPTY SLOT', sw >> 1, 19, DIM, 8, null, 'c'); return f; }
  const tb = frame(56, 38, 'inset'); tb.blit(o.thumb, 2, 2); f.blit(tb, 4, 3);
  const nw = text(f, o.name, 68, 8, sel ? T.lime : T.txt, 8, null); if (o.auto) f.blit(plate('AUTO', 'research', T.amb), 68 + nw + 5, 4);
  text(f, o.day + '  ' + o.crew, 68, 20, T.mut, 8, null); text(f, o.when, 68, 31, T.mut, 8, null); text(f, o.time, sw - 8, 8, T.txt, 8, null, 'r');
  return f;
}
function loadGame(S) {
  const w = PW, s = panel(w, 242, 'LOAD GAME'); text(s, '3/4', w - 26, 8, T.mut, 8, T.sh, 'r');
  S.forEach((o, i) => s.blit(slot(o, i === 0), 6, 20 + i * 48));
  footer(s, [['DELETE', 'btn', 72, T.red, 'delete']], [['LOAD', 'primary', 96, null, 'main'], ['BACK', 'btn', 64, null, 'main']]); return s;
}
const ROWS = {
  video: () => [['DISPLAY', stepper('FULLSCREEN')], ['RESOLUTION', stepper('1920X1080')], ['UI SCALE', stepper('2X')], ['VSYNC', toggle(true)], ['SCREEN SHAKE', toggle(false)]],
  audio: () => [['MASTER', slider(.8, true)], ['MUSIC', slider(.6)], ['EFFECTS', slider(.9)], ['AMBIENCE', slider(.45)], ['MUTE IN BACKGROUND', checkbox(true)]],
  controls: () => [['BUILD MENU', keycap('B')], ['SURVIVORS', keycap('C')], ['PAUSE', keycap('ESC')], ['GAME SPEED', keycap('TAB')], ['ROTATE', keycap('', true)], ['EDGE SCROLL', toggle(true)]]
};
function settings(tab) {
  const rows = ROWS[tab](), w = PW, h = rows.length * 20 + 86, s = panel(w, h, 'SETTINGS'), TB = ['VIDEO', 'AUDIO', 'CONTROLS'];
  put(s, tabs(TB, TB.indexOf(tab.toUpperCase()), 'settings_'), 6, 20);
  s.blit(frame(w - 12, rows.length * 20 + 8, 'inset'), 6, 40);
  rows.forEach(([l, wd], i) => { const y = 44 + i * 20; if (i) for (let x = 10; x < w - 10; x++) s.set(x, y, '#1d2119'); text(s, l, 12, y + 8, T.txt, 8, null); s.blit(wd, w - 12 - wd.w, y + 10 - (wd.h >> 1)); });
  footer(s, [['RESET', 'btn', 64, null, null]], [['APPLY', 'primary', 72, null, 'main'], ['BACK', 'btn', 64, null, 'main']]); return s;
}
function dialog(title, body, yes, kind, back) {
  const w = 208, h = 82, s = frame(w, h, kind); s.hits = [];
  text(s, title, w >> 1, 12, kind === 'alert' ? T.red : T.txt, 8, T.sh, 'c'); text(s, body, w >> 1, 28, T.mut, 8, T.sh, 'c');
  footer(s, [['CANCEL', 'btn', 94, null, back]], [[yes, 'btn', 94, T.red, back]]); return s;
}
function dim(s) { for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const c = s.p[y * s.w + x]; if (c) s.p[y * s.w + x] = mix(c, '#050607', dth(x, y, .5) ? .68 : .45); } }

export async function buildTitle(o = {}) {
  await document.fonts.load('8px Silkscreen'); await document.fonts.load('16px Silkscreen');
  const A = {}, I = {}; for (const k of ['day', 'night', 'zombie']) I[k] = ICONS[k]().finish();
  A.title_bg = background(); A.logo = logo(o.title || 'AFTERLIFE'); A.logo_sub = logoSub(o.sub || 'BUILD. DEFEND. SURVIVE.', A.logo.w);
  for (const k of ['btn', 'hover', 'down', 'off', 'primary', 'primaryDown']) A['menu_btn_' + k] = menuBtn(k === 'off' ? 'LOAD GAME' : 'NEW GAME', k);
  A.caret = caret(); A.main_menu = mainMenu(A.caret, 0); A.main_menu_hover = mainMenu(A.caret, 2); A.hint_bar = hintBar();
  A.panel_new = newGame(I); A.field = field(160, 'ASHFORD', false); A.field_focus = field(160, 'ASHFORD', true);
  DIFF.forEach(([ic, n, d], i) => A['card_' + n.toLowerCase()] = dcard(I[ic], n, d, i === 1, 92));
  A.checkbox_off = checkbox(false); A.checkbox_on = checkbox(true);
  const S = [
    { name: 'ASHFORD', day: 'DAY 12', crew: '6 SURVIVORS', when: 'SEP 26  21:40', time: '14H 20M', thumb: thumb(7) },
    { name: 'ASHFORD', auto: 1, day: 'DAY 11', crew: '6 SURVIVORS', when: 'SEP 26  21:02', time: '13H 42M', thumb: thumb(8) },
    { name: 'MILLBROOK', day: 'DAY 3', crew: '2 SURVIVORS', when: 'SEP 14  18:15', time: '2H 05M', thumb: thumb(19) }, null];
  A.panel_load = loadGame(S); A.slot_selected = slot(S[0], true); A.slot = slot(S[2]); A.slot_auto = slot(S[1]); A.slot_empty = slot(null);
  A.dialog_quit = dialog('QUIT TO DESKTOP?', 'PROGRESS SINCE LAST SAVE IS LOST.', 'QUIT', 'panel', 'main');
  A.dialog_delete = dialog('DELETE ASHFORD?', 'THIS CANNOT BE UNDONE.', 'DELETE', 'alert', 'load');
  for (const t of ['video', 'audio', 'controls']) A['settings_' + t] = settings(t);
  A.slider = slider(.6); A.slider_hover = slider(.8, true); A.toggle_on = toggle(true); A.toggle_off = toggle(false); A.stepper = stepper('1920X1080');
  A.key = keycap('B'); A.key_wide = keycap('ESC'); A.key_listen = keycap('', true);
  const PANELS = { new: A.panel_new, load: A.panel_load, delete: A.panel_load, settings_video: A.settings_video, settings_audio: A.settings_audio, settings_controls: A.settings_controls };
  const LY = 40, MY = LY + A.logo.h + A.logo_sub.h + 36, cache = {}, cx = w => (SW - w) >> 1;
  const screen = key => {
    if (cache[key]) return cache[key];
    const s = new Spr(SW, SH); s.hits = []; s.blit(A.title_bg, 0, 0);
    const body = PANELS[key] || A.main_menu, gap = PANELS[key] ? 20 : 32, head = A.logo.h + 6 + A.logo_sub.h, top = Math.max(12, (SH - 20 - head - gap - body.h) >> 1), by = top + head + gap;
    s.blit(A.logo, cx(A.logo.w), top); s.blit(A.logo_sub, cx(A.logo_sub.w), top + A.logo.h + 6);
    s.blit(A.hint_bar, SW - A.hint_bar.w - 24, SH - 31); text(s, 'V 0.1.0', 24, SH - 26, T.mut);
    if (PANELS[key]) put(s, PANELS[key], cx(PW), by); else put(s, A.main_menu, cx(220) - 16, by);
    if (key === 'quit' || key === 'delete') { dim(s); s.hits = []; const d = key === 'quit' ? A.dialog_quit : A.dialog_delete; put(s, d, (SW - d.w) >> 1, (SH - d.h) >> 1); }
    return cache[key] = s;
  };
  A.title_screen = screen('main');
  return { A, screen };
}
