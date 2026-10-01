// Procedural world map generator. Pure logic, no DOM. Output uses the Map Editor's survival-map format,
// so a generated world can be opened in the editor and exported to Unity from there.

export const SIZES = {
  small: { label: 'Small', w: 64, h: 48, bw: 18, bh: 14, pois: 4, towns: 1, exits: 1, edgeZ: 4, cars: 3 },
  medium: { label: 'Medium', w: 112, h: 80, bw: 20, bh: 15, pois: 8, towns: 1, exits: 2, edgeZ: 8, cars: 7 },
  large: { label: 'Large', w: 176, h: 128, bw: 22, bh: 16, pois: 14, towns: 2, exits: 3, edgeZ: 14, cars: 14 }
};
export const POI_TYPES = {
  town: { label: 'Town', r: 11 },
  farm: { label: 'Farmstead', r: 7 },
  gas: { label: 'Gas stop', r: 5 },
  ruin: { label: 'Ruins', r: 5 },
  chapel: { label: 'Chapel', r: 5 },
  camp: { label: 'Abandoned camp', r: 3 }
};
export const FP = {
  bld_town_hall: [4, 3], bld_clinic: [3, 3], bld_barracks: [4, 2], bld_workshop: [3, 3], bld_farm: [4, 3], bld_shelter: [2, 2], bld_lumber_mill: [3, 2], bld_storage: [3, 3], bld_lab: [3, 3], bld_armory: [2, 2], bld_bunkhouse: [3, 2],
  wld_house: [3, 3], wld_burnt_house: [3, 2], wld_gas_station: [4, 3], wld_barn: [4, 3], wld_chapel: [3, 3], wld_water_tower: [2, 2], wld_shed: [2, 2], wld_trailer: [3, 2]
};
export const DFP = { deco_car: [2, 1], deco_dumpster: [2, 1], deco_bench: [2, 1], deco_barrier: [2, 1], deco_fallen_log: [2, 1], deco_tent: [2, 1], deco_picnic: [2, 1], deco_tractor: [2, 1], deco_police_car: [2, 1], deco_wire: [2, 1], deco_bus: [3, 1] };
// rows a base building's sprite rises above its footprint (sprite height minus footprint height, in tiles)
const BUP = { bld_town_hall: 2, bld_barracks: 2, bld_farm: 0, bld_lumber_mill: 0, wld_barn: 2, wld_chapel: 2, wld_water_tower: 2 };
// props tall enough to hide a building facade when stood directly in front of it
const TALL = { tree_pine: 1, tree_oak: 1, tree_dead: 1, deco_pole: 1, deco_streetlight: 1, deco_sign: 1, deco_scarecrow: 1, deco_well: 1, deco_tractor: 1, deco_dumpster: 1, deco_tent: 1, deco_bus: 1 };
const ON_ROAD = { deco_car: 1, deco_barrier: 1, deco_police_car: 1, deco_bus: 1 };
const DECOR = {
  town: [['deco_mailbox', 3], ['deco_hydrant', 2], ['deco_dumpster', 1], ['deco_bench', 2], ['deco_trash', 3], ['deco_car', 2], ['deco_police_car', 1], ['deco_crates', 1], ['deco_sign', 1], ['deco_bicycle', 2], ['deco_cart', 1], ['deco_picnic', 1], ['deco_backpack', 1], ['deco_skeleton', 1], ['deco_blood', 2], ['deco_flowers', 2]],
  farm: [['deco_haybale', 4], ['deco_well', 1], ['deco_logs', 1], ['deco_fence', 4], ['deco_crates', 1], ['deco_drum', 1], ['deco_scarecrow', 2], ['deco_wheelbarrow', 1], ['deco_tractor', 1], ['deco_flowers', 1]],
  gas: [['deco_car', 3], ['deco_drum', 3], ['deco_tires', 2], ['deco_dumpster', 1], ['deco_sign', 1], ['deco_trash', 2], ['deco_barrier', 1], ['deco_cart', 2], ['deco_blood', 1]],
  ruin: [['deco_rubble', 5], ['deco_trash', 2], ['deco_car', 1], ['deco_tires', 1], ['deco_boulder', 1], ['deco_skeleton', 2], ['deco_blood', 2], ['deco_leaves', 1]],
  chapel: [['deco_bench', 2], ['deco_well', 1], ['deco_mailbox', 1], ['deco_trash', 1], ['deco_flowers', 2]],
  camp: [['deco_tent', 3], ['deco_campfire', 1], ['deco_crates', 2], ['deco_tires', 1], ['deco_drum', 2], ['deco_logs', 1], ['deco_car', 1], ['deco_trash', 2], ['deco_backpack', 2], ['deco_picnic', 1]]
};

export const hh = (x, y, s = 0) => { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
function rngOf(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function seedOf(s) { s = String(s ?? ''); if (/^\d+$/.test(s)) return (+s >>> 0) || 1; let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) || 1; }
function noise(seed) {
  const v = (x, y) => hh(x, y, seed), sm = t => t * t * (3 - 2 * t);
  const n = (x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = sm(x - x0), fy = sm(y - y0); const a = v(x0, y0), b = v(x0 + 1, y0), c = v(x0, y0 + 1), d = v(x0 + 1, y0 + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
  return (x, y) => (n(x, y) * 0.55 + n(x * 2.1 + 17, y * 2.1 + 5) * 0.3 + n(x * 4.3 + 31, y * 4.3 + 11) * 0.15);
}

/* ---------- binary heap ---------- */
function Heap() { const f = [], v = []; return {
  get size() { return f.length; },
  push(p, x) { let i = f.length; f.push(p); v.push(x); while (i > 0) { const q = (i - 1) >> 1; if (f[q] <= f[i]) break; [f[q], f[i]] = [f[i], f[q]]; [v[q], v[i]] = [v[i], v[q]]; i = q; } },
  pop() { const top = v[0], lf = f.pop(), lv = v.pop(); if (f.length) { f[0] = lf; v[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < f.length && f[l] < f[m]) m = l; if (r < f.length && f[r] < f[m]) m = r; if (m === i) break; [f[m], f[i]] = [f[i], f[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; } } return top; }
}; }

export function generate({ size = 'medium', seed = 1 } = {}) {
  const S = SIZES[size] || SIZES.medium, w = S.w, h = S.h, N = w * h, sd = seedOf(seed), rng = rngOf(sd);
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const terr = new Array(N).fill('g'), block = new Uint8Array(N), keepOut = new Uint8Array(N), clear = new Uint8Array(N), base = new Array(N).fill(0);
  const objs = [], marks = [], I = (x, y) => y * w + x, inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const stats = {};

  /* 1 · noise fields */
  const fN = noise(sd ^ 0x51), dN = noise(sd ^ 0xa7), forest = new Float32Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    forest[I(x, y)] = fN(x / 13, y / 13);
    if (dN(x / 9 + 40, y / 9 + 40) > 0.72) terr[I(x, y)] = 'd';
  }

  const fpOf = o => o.t === 'gate' ? (o.o === 'h' ? [2, 1] : [1, 2]) : o.t === 'tower' ? [2, 2] : o.t === 'bld' ? FP[o.k] : DFP[o.k] || [1, 1];
  // roof: rows a building sprite rises into (nothing may stand there, it would be hidden); front: two rows before a facade (no tall props)
  const roof = new Uint8Array(N), front = new Uint8Array(N), gpath = new Uint8Array(N);
  const fits = (o, allowRoad) => { const [fw, fh] = fpOf(o), tall = o.t === 'tree' && TALL[o.k]; for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) { const x = o.tx + i, y = o.ty + j; if (!inb(x, y)) return false; const k = I(x, y); if (block[k] || roof[k] || gpath[k] || (tall && front[k]) || (!allowRoad && terr[k] === 'r')) return false; } return true; };
  const put = o => {
    const [fw, fh] = fpOf(o); for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) block[I(o.tx + i, o.ty + j)] = 1;
    if (o.t === 'bld') { const up = BUP[o.k] ?? 1; for (let i = -1; i <= fw; i++) { for (let j = 1; j <= up; j++) if (i >= 0 && i < fw && inb(o.tx + i, o.ty - j)) roof[I(o.tx + i, o.ty - j)] = 1; for (let j = 0; j < 2; j++) if (inb(o.tx + i, o.ty + fh + j)) front[I(o.tx + i, o.ty + fh + j)] = 1; } }
    objs.push(o); return o;
  };

  /* 2 · starting base */
  const bw = S.bw, bh = S.bh, cx = w / 2, cy = h / 2;
  const ang = rng() * Math.PI * 2, rad = (0.12 + rng() * 0.14) * Math.min(w, h);
  const x0 = Math.round(Math.max(6, Math.min(w - bw - 6, cx + Math.cos(ang) * rad - bw / 2)));
  const y0 = Math.round(Math.max(6, Math.min(h - bh - 6, cy + Math.sin(ang) * rad - bh / 2)));
  const x1 = x0 + bw - 1, y1 = y0 + bh - 1, bcx = (x0 + x1) / 2, bcy = (y0 + y1) / 2;
  const ddx = cx - bcx, ddy = cy - bcy, side = Math.abs(ddx) * h > Math.abs(ddy) * w ? (ddx > 0 ? 'e' : 'w') : (ddy > 0 ? 's' : 'n');
  for (let y = y0 - 3; y <= y1 + 4; y++) for (let x = x0 - 3; x <= x1 + 3; x++) if (inb(x, y)) { clear[I(x, y)] = 1; if (x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1) keepOut[I(x, y)] = 1; }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { terr[I(x, y)] = 'd'; base[I(x, y)] = 1; }
  const gx = Math.round(bcx) - 1, gy = Math.round(bcy) - 1;
  const gate = side === 'n' ? { t: 'gate', gk: 'wood', o: 'h', open: 0, side: 'e', tx: gx, ty: y0 } : side === 's' ? { t: 'gate', gk: 'wood', o: 'h', open: 0, side: 'e', tx: gx, ty: y1 }
    : side === 'w' ? { t: 'gate', gk: 'wood', o: 'v', open: 0, side: 'e', tx: x0, ty: gy } : { t: 'gate', gk: 'wood', o: 'v', open: 0, side: 'w', tx: x1, ty: gy };
  put(gate);
  // gate approach, 4 tiles out and 3 in, never gets an object on it
  for (let d = -4; d <= 4; d++) for (let q = 0; q < 2; q++) { const x = gate.o === 'h' ? gate.tx + q : gate.tx + d, y = gate.o === 'h' ? gate.ty + d : gate.ty + q; if (d && inb(x, y)) gpath[I(x, y)] = 1; }
  // the starting ring is always intact: no damaged planks, which read as gaps
  for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) { const o = { t: 'wall', mat: 'planks', dmg: 0, tx: x, ty: y }; if (fits(o)) put(o); }
  for (let y = y0 + 1; y < y1; y++) for (const x of [x0, x1]) { const o = { t: 'wall', mat: 'planks', dmg: 0, tx: x, ty: y }; if (fits(o)) put(o); }
  for (const [tx, ty] of [[x0 + 1, y0 + 1], [x1 - 2, y0 + 1], [x0 + 1, y1 - 2], [x1 - 2, y1 - 2]]) put({ t: 'tower', roof: rng() < 0.5 ? 1 : 0, tx, ty });
  // corridor from gate to centre stays open while base buildings are placed
  const corr = [];
  const lx = Math.min(gate.tx, Math.round(bcx) - 1), hx = Math.max(gate.tx + 1, Math.round(bcx)), ly = Math.min(gate.ty, Math.round(bcy) - 1), hy = Math.max(gate.ty + 1, Math.round(bcy));
  for (let y = ly; y <= hy; y++) for (let x = lx; x <= hx; x++) { const k = I(x, y); if (!block[k] && (gate.o === 'h' ? x >= gate.tx && x <= gate.tx + 1 : y >= gate.ty && y <= gate.ty + 1)) { block[k] = 1; corr.push(k); } }
  const gatePt = { x: gate.tx, y: gate.ty };
  // sprites rise above their footprint; those rows are reserved so nothing sits behind a roof and no roof covers the wall
  const resv = [], reserve = (x, y) => { if (inb(x, y) && !block[I(x, y)]) { block[I(x, y)] = 3; resv.push(I(x, y)); } };
  for (const tx of [x0 + 1, x1 - 2]) for (const y of [y1 - 3, y1 - 4]) for (const x of [tx, tx + 1]) reserve(x, y);
  const inner = (k, far) => {
    const [fw, fh] = FP[k], up = BUP[k] ?? 1; let best = null, bs = 1e9;
    for (let ty = y0 + 1 + up; ty + fh - 1 < y1; ty++) for (let tx = x0 + 1; tx + fw - 1 < x1; tx++) {
      let ok = true; for (let j = -1; j <= fh && ok; j++) for (let i = -1; i <= fw && ok; i++) { const x = tx + i, y = ty + j; if (x <= x0 || x >= x1 || y <= y0 || y >= y1) continue; if (block[I(x, y)]) ok = false; }
      for (let j = -up; j < fh && ok; j++) for (let i = 0; i < fw && ok; i++) if (block[I(tx + i, ty + j)]) ok = false;
      if (!ok) continue;
      const d = Math.hypot(tx + fw / 2 - gatePt.x, ty + fh / 2 - gatePt.y), c = Math.hypot(tx + fw / 2 - bcx, ty + fh / 2 - bcy);
      const sc = (far ? -d : c) + rng() * 3; if (sc < bs) { bs = sc; best = { t: 'bld', k, tx, ty }; }
    }
    if (!best) return null;
    put(best); for (let j = 1; j <= up; j++) for (let i = 0; i < fw; i++) reserve(best.tx + i, best.ty - j);
    return best;
  };
  // largest first packs best; a starter that can't fit falls back to a small shelter
  const starters = size === 'small' ? ['bld_town_hall', 'bld_farm', 'bld_bunkhouse'] : ['bld_town_hall', 'bld_farm', 'bld_storage', 'bld_bunkhouse'];
  starters.forEach((k, i) => { if (!inner(k, i === 0)) inner('bld_shelter', false); });
  corr.forEach(k => { block[k] = 0; });
  const nearBase = [];
  for (let y = y0 + 2; y < y1 - 1; y++) for (let x = x0 + 2; x < x1 - 1; x++) if (!block[I(x, y)] && !corr.includes(I(x, y))) nearBase.push([x, y, Math.hypot(x - bcx, y - bcy)]);
  nearBase.sort((a, b) => a[2] - b[2]);
  const fire = nearBase.find(([x, y]) => fits({ t: 'tree', k: 'deco_campfire', tx: x, ty: y }));
  if (fire) {
    put({ t: 'tree', k: 'deco_campfire', tx: fire[0], ty: fire[1] });
    let n = 0; for (const [x, y] of nearBase) { if (n >= 3) break; if (!block[I(x, y)] && Math.hypot(x - fire[0], y - fire[1]) <= 2.5 && (x !== fire[0] || y !== fire[1])) { marks.push({ mk: 'survivor', tx: x, ty: y }); block[I(x, y)] = 2; n++; } }
    marks.forEach(m => { if (block[I(m.tx, m.ty)] === 2) block[I(m.tx, m.ty)] = 0; });
  }
  for (const k of ['deco_crates', 'deco_drum', 'deco_crates']) { for (let t = 0; t < 40; t++) { const o = { t: 'tree', k, tx: ri(x0 + 2, x1 - 2), ty: ri(y0 + 2, y1 - 2) }; if (fits(o) && !corr.includes(I(o.tx, o.ty)) && !marks.some(m => m.tx === o.tx && m.ty === o.ty)) { put(o); break; } } }
  resv.forEach(k => { if (block[k] === 3) block[k] = 0; });
  // outside objects keep this margin from the walls; the south side is deeper because tall sprites rise north over it
  const nearB = (x, y, m = 0) => x >= x0 - 3 - m && x <= x1 + 3 + m && y >= y0 - 3 - m && y <= y1 + 4 + m;
  // road anchor just outside the gate
  const gateRoad = side === 'n' ? { x: gate.tx, y: y0 - 3, stub: [[gate.tx, y0 - 2]] } : side === 's' ? { x: gate.tx, y: y1 + 2, stub: [[gate.tx, y1 + 1]] }
    : side === 'w' ? { x: x0 - 3, y: gate.ty, stub: [[x0 - 2, gate.ty]] } : { x: x1 + 2, y: gate.ty, stub: [[x1 + 1, gate.ty]] };

  /* 3 · points of interest */
  const pois = [], md0 = Math.sqrt(N / (S.pois + 1)) * 0.78, baseR = Math.max(bw, bh) / 2 + 14, M = size === 'small' ? 7 : 9;
  let md = md0;
  // spacing relaxes after each run of failed attempts so every size reaches its target count
  for (let t = 0, fail = 0; t < S.pois * 400 && pois.length < S.pois; t++) {
    if (fail > 60) { md *= 0.9; fail = 0; }
    const x = ri(M, w - M - 1), y = ri(M, h - M - 1);
    if (Math.hypot(x - bcx, y - bcy) < Math.min(baseR, md0 * 0.9 + 4) || pois.some(p => Math.hypot(p.x - x, p.y - y) < md)) { fail++; continue; }
    pois.push({ x, y }); fail = 0;
  }
  pois.sort((a, b) => Math.hypot(b.x - bcx, b.y - bcy) - Math.hypot(a.x - bcx, a.y - bcy));
  const types = []; for (let i = 0; i < S.towns; i++) types.push('town'); types.push('farm');
  const pool = ['farm', 'gas', 'ruin', 'chapel', 'camp', 'gas', 'ruin'];
  while (types.length < pois.length) types.push(pool[Math.floor(rng() * pool.length)]);
  // towns go to the far points, the rest are shuffled across the remainder
  const rest = shuffle(types.slice(S.towns));
  pois.forEach((p, i) => { p.type = i < S.towns ? 'town' : rest[i - S.towns]; p.r = POI_TYPES[p.type].r; p.label = POI_TYPES[p.type].label; p.id = i; p.blds = []; });
  const count = {}; pois.forEach(p => { count[p.type] = (count[p.type] || 0) + 1; p.name = p.label + (types.filter(t => t === p.type).length > 1 ? ' ' + count[p.type] : ''); });

  /* 4 · road network */
  const exits = [];
  const sides = shuffle(['n', 'e', 's', 'w']);
  for (let i = 0; i < S.exits; i++) {
    const s = sides[i % 4], along = () => s === 'n' || s === 's' ? ri(8, w - 10) : ri(8, h - 10);
    let best = null, bd = -1;
    for (let t = 0; t < 12; t++) { const a = along(), p = s === 'n' ? { x: a, y: 0 } : s === 's' ? { x: a, y: h - 2 } : s === 'w' ? { x: 0, y: a } : { x: w - 2, y: a }; const d = Math.hypot(p.x - bcx, p.y - bcy); if (d > bd) { bd = d; best = p; } }
    best.exit = true; exits.push(best);
  }
  const nodes = [{ x: gateRoad.x, y: gateRoad.y, base: true }, ...pois.map(p => ({ x: Math.min(w - 2, p.x), y: Math.min(h - 2, p.y), poi: p })), ...exits];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), edges = [], inT = new Set([0]);
  while (inT.size < nodes.length) {
    let best = null, bd = 1e9;
    for (const a of inT) for (let b = 0; b < nodes.length; b++) if (!inT.has(b) && !(nodes[a].exit && nodes[b].exit)) { const d = dist(nodes[a], nodes[b]); if (d < bd) { bd = d; best = [a, b]; } }
    if (!best) break; inT.add(best[1]); edges.push(best);
  }
  const has = (a, b) => edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
  let loops = Math.floor(nodes.length / 4);
  const cand = []; for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) if (!has(a, b) && !nodes[a].exit && !nodes[b].exit) cand.push([dist(nodes[a], nodes[b]), a, b]);
  cand.sort((p, q) => p[0] - q[0]);
  for (const [d, a, b] of cand) { if (loops <= 0) break; if (d < md * 1.6 && rng() < 0.6) { edges.push([a, b]); loops--; } }
  edges.sort((p, q) => dist(nodes[p[0]], nodes[p[1]]) - dist(nodes[q[0]], nodes[q[1]]));

  const RW = w - 1, RH = h - 1, D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const cost = (x, y) => {
    let r = 0, f = 0; for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const k = I(x + i, y + j); if (keepOut[k]) return Infinity; if (terr[k] === 'r') r++; f += forest[k]; }
    return r === 4 ? 0.35 : 1 + Math.max(0, f / 4 - 0.4) * 5;
  };
  const route = (s, t) => {
    const n = RW * RH * 4, g = new Float32Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), H = Heap();
    for (let d = 0; d < 4; d++) { const k = (s.y * RW + s.x) * 4 + d; g[k] = 0; H.push(0, k); }
    let end = -1;
    while (H.size) {
      const k = H.pop(), c = k >> 2, d = k & 3, x = c % RW, y = (c / RW) | 0;
      if (x === t.x && y === t.y) { end = k; break; }
      const gk = g[k];
      for (let nd = 0; nd < 4; nd++) {
        if (nd === ((d + 2) & 3)) continue;
        const nx = x + D4[nd][0], ny = y + D4[nd][1]; if (nx < 0 || ny < 0 || nx >= RW || ny >= RH) continue;
        const cc = cost(nx, ny); if (cc === Infinity) continue;
        const ng = gk + cc + (nd !== d ? 3 : 0), nk = (ny * RW + nx) * 4 + nd;
        if (ng < g[nk]) { g[nk] = ng; from[nk] = k; H.push(ng + (Math.abs(nx - t.x) + Math.abs(ny - t.y)) * 0.5, nk); }
      }
    }
    if (end < 0) return null;
    const path = []; for (let k = end; k >= 0; k = from[k]) { const c = k >> 2; path.push([c % RW, (c / RW) | 0]); if (g[k] === 0) break; }
    return path.reverse();
  };
  const stamp = (x, y) => { for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (inb(x + i, y + j)) terr[I(x + i, y + j)] = 'r'; };
  gateRoad.stub.forEach(([x, y]) => stamp(x, y)); stamp(gateRoad.x, gateRoad.y);
  const paths = [];
  for (const [a, b] of edges) { const p = route(nodes[a], nodes[b]); if (p) { p.forEach(([x, y]) => stamp(x, y)); paths.push(p); } }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (terr[I(x, y)] === 'r') for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (inb(x + i, y + j)) clear[I(x + i, y + j)] = 1;
  stats.road = terr.filter(t => t === 'r').length;

  /* 5 · POI buildings, yards and decor */
  const roadAt = (x, y) => inb(x, y) && terr[I(x, y)] === 'r';
  const placeBld = (k, p) => {
    const [fw, fh] = FP[k], R = p.r; let best = null, bs = 1e9;
    for (let ty = p.y - R; ty <= p.y + R; ty++) for (let tx = p.x - R; tx <= p.x + R; tx++) {
      if (tx < 2 || ty < 3 || tx + fw > w - 2 || ty + fh > h - 2) continue;
      let ok = true;
      for (let j = -1; j <= fh && ok; j++) for (let i = -1; i <= fw && ok; i++) { const q = I(tx + i, ty + j); if (block[q] || keepOut[q] || terr[q] === 'r' || nearB(tx + i, ty + j, 3) || (j >= 0 && j < fh && i >= 0 && i < fw && roof[q])) ok = false; }
      for (let j = 1, up = BUP[k] ?? 1; j <= up && ok; j++) for (let i = 0; i < fw && ok; i++) if (block[I(tx + i, ty - j)]) ok = false;
      if (!ok) continue;
      let rd = 0; for (let d = 2; d <= 4 && !rd; d++) for (let i = 0; i < fw; i++) if (roadAt(tx + i, ty + fh - 1 + d)) { rd = d; break; }
      const sc = Math.hypot(tx + fw / 2 - p.x, ty + fh / 2 - p.y) * 0.6 + (rd ? rd * 1.5 : 12) + rng() * 3;
      if (sc < bs) { bs = sc; best = { tx, ty, rd }; }
    }
    if (!best) return null;
    const o = put({ t: 'bld', k, tx: best.tx, ty: best.ty }); p.blds.push(o);
    for (let j = 0; j <= fh; j++) for (let i = -1; i <= fw; i++) { const x = best.tx + i, y = best.ty + j; if (inb(x, y) && terr[I(x, y)] !== 'r' && !base[I(x, y)]) { terr[I(x, y)] = 'd'; clear[I(x, y)] = 1; } }
    if (best.rd) { const px = best.tx + (fw >> 1); for (let y = best.ty + fh; y < best.ty + fh - 1 + best.rd; y++) for (const x of [px - 1, px]) if (inb(x, y) && terr[I(x, y)] !== 'r') { terr[I(x, y)] = 'd'; clear[I(x, y)] = 1; } }
    return o;
  };
  const BAG = {
    town: () => { const b = shuffle(['wld_house', 'wld_house', 'wld_house', 'wld_trailer', 'wld_trailer', 'wld_gas_station', 'wld_chapel', 'wld_water_tower', 'wld_shed', 'wld_burnt_house', 'wld_burnt_house']); return b.slice(0, ri(6, 8)); },
    farm: () => ['wld_barn', 'wld_house', 'wld_shed', ...(rng() < 0.5 ? ['wld_water_tower'] : [])],
    gas: () => ['wld_gas_station', ...(rng() < 0.5 ? ['wld_trailer'] : []), ...(rng() < 0.4 ? ['wld_shed'] : [])],
    ruin: () => ['wld_burnt_house', 'wld_burnt_house', ...(rng() < 0.5 ? ['wld_shed'] : [])],
    chapel: () => ['wld_chapel', 'wld_house', ...(rng() < 0.5 ? ['wld_shed'] : [])],
    camp: () => []
  };
  const area = k => FP[k][0] * FP[k][1];
  for (const p of pois) BAG[p.type]().sort((a, b) => area(b) - area(a)).forEach(k => placeBld(k, p));
  const placeDecor = (k, p) => {
    const onRoad = !!ON_ROAD[k];
    for (let t = 0; t < 40; t++) {
      let x, y;
      if (onRoad) { x = p.x + ri(-p.r - 2, p.r + 2); y = p.y + ri(-p.r - 2, p.r + 2); }
      else if (p.blds.length && rng() < 0.7) { const b = p.blds[Math.floor(rng() * p.blds.length)], [fw, fh] = FP[b.k]; x = b.tx + ri(-2, fw + 1); y = b.ty + ri(fh - 1, fh + 2); }
      else { x = p.x + ri(-p.r, p.r); y = p.y + ri(-p.r, p.r); }
      const o = { t: 'tree', k, tx: x, ty: y };
      if (!fits(o, onRoad)) continue;
      const [fw] = fpOf(o); let bad = false;
      for (let i = 0; i < fw; i++) { const q = I(x + i, y); if (keepOut[q] || nearB(x + i, y) || (onRoad && terr[q] !== 'r')) bad = true; }
      if (bad) continue;
      return put(o);
    }
    return null;
  };
  for (const p of pois) for (const [k, n] of DECOR[p.type]) for (let i = 0; i < n; i++) placeDecor(k, p);
  // graveyard beside each chapel: a 4×3 grid of stones and crosses, 2 tiles apart
  for (const p of pois) { const ch = p.blds.find(b => b.k === 'wld_chapel'); if (!ch) continue;
    let done = false;
    for (const [ox, oy] of shuffle([[-9, 0], [4, 0], [-9, 3], [4, 3], [-3, 4], [-3, -6]])) {
      const gx0 = ch.tx + ox, gy0 = ch.ty + oy, cells = [];
      for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) cells.push([gx0 + i * 2, gy0 + j * 2]);
      if (!cells.every(([x, y]) => inb(x, y) && !block[I(x, y)] && !roof[I(x, y)] && !keepOut[I(x, y)] && !nearB(x, y, 1) && terr[I(x, y)] !== 'r')) continue;
      cells.forEach(([x, y]) => { if (rng() < 0.85) put({ t: 'tree', k: rng() < 0.55 ? 'deco_tombstone' : 'deco_grave_cross', tx: x, ty: y }); });
      for (let y = gy0 - 1; y <= gy0 + 5; y++) for (let x = gx0 - 1; x <= gx0 + 7; x++) if (inb(x, y)) clear[I(x, y)] = 1;
      done = true; break;
    }
    stats.graveyards = (stats.graveyards || 0) + (done ? 1 : 0);
  }
  for (const p of pois) for (let y = p.y - p.r; y <= p.y + p.r; y++) for (let x = p.x - p.r; x <= p.x + p.r; x++) if (inb(x, y) && Math.hypot(x - p.x, y - p.y) < p.r * 0.75) clear[I(x, y)] = 1;

  /* roadside: utility poles, streetlights in towns, wrecks and barriers */
  const inTown = (x, y) => pois.some(p => (p.type === 'town' || p.type === 'gas') && Math.hypot(x - p.x, y - p.y) <= p.r + 2);
  for (const path of paths) for (let i = 4; i < path.length - 1; i += 9) {
    const [x, y] = path[i], [px, py] = path[i - 1], hz = py === y;
    for (const [cx2, cy2] of hz ? [[x, y - 1], [x, y + 2]] : [[x - 1, y], [x + 2, y]]) {
      const k = inTown(cx2, cy2) ? 'deco_streetlight' : 'deco_pole', o = { t: 'tree', k, tx: cx2, ty: cy2 };
      if (fits(o) && !keepOut[I(cx2, cy2)] && !nearB(cx2, cy2)) { put(o); break; }
    }
  }
  const roadCells = []; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 2; x++) if (terr[I(x, y)] === 'r' && terr[I(x + 1, y)] === 'r' && !keepOut[I(x, y)]) roadCells.push([x, y]);
  const wreck = (k, n) => { for (let t = 0, c = 0; t < n * 30 && c < n; t++) { const [x, y] = roadCells[Math.floor(rng() * roadCells.length)] || [0, 0]; const o = { t: 'tree', k, tx: x, ty: y }; if (nearB(x, y, 2) || nearB(x + 1, y, 2)) continue; if (fits(o, true) && terr[I(x, y)] === 'r' && terr[I(x + 1, y)] === 'r') { put(o); c++; } } };
  if (roadCells.length) { wreck('deco_car', S.cars); wreck('deco_barrier', Math.ceil(S.cars / 3)); }
  if (roadCells.length) wreck('deco_bus', Math.max(1, Math.round(S.cars / 5)));
  // checkpoints: a police car and barriers on the road, sandbags and wire beside it, remains nearby
  const near = (k, cx0, cy0, rr, allowRoad) => { for (let t = 0; t < 30; t++) { const o = { t: 'tree', k, tx: cx0 + ri(-rr, rr), ty: cy0 + ri(-rr, rr) }; if (fits(o, allowRoad) && !keepOut[I(o.tx, o.ty)] && !nearB(o.tx, o.ty) && (!allowRoad || terr[I(o.tx, o.ty)] === 'r')) return put(o); } return null; };
  const longPaths = paths.filter(p => p.length > 12);
  stats.checkpoints = 0;
  for (let i = 0, t = 0; i < Math.ceil(S.pois / 4) && longPaths.length && t < 30; t++) {
    const path = longPaths[Math.floor(rng() * longPaths.length)], [x, y] = path[Math.floor(path.length * (0.3 + rng() * 0.4))];
    if (Math.hypot(x - bcx, y - bcy) < baseR || pois.some(p => Math.hypot(p.x - x, p.y - y) < p.r + 3)) continue;
    near('deco_police_car', x, y, 2, true); near('deco_barrier', x, y, 2, true); near('deco_barrier', x, y, 3, true);
    for (const k of ['deco_sandbags', 'deco_sandbags', 'deco_wire', 'deco_wire', 'deco_skeleton', 'deco_blood', 'deco_backpack', 'deco_drum']) near(k, x, y, 4, false);
    stats.checkpoints++; i++;
  }
  // wild vignettes away from roads and towns
  const VIG = [['deco_skeleton', 'deco_backpack', 'deco_blood'], ['deco_tent', 'deco_campfire', 'deco_backpack', 'deco_logs'], ['deco_bicycle', 'deco_skeleton', 'deco_blood'], ['deco_car', 'deco_tires', 'deco_drum', 'deco_blood']];
  const nVig = Math.round(N / 1400);
  for (let t = 0, c = 0; t < nVig * 40 && c < nVig; t++) {
    const x = ri(4, w - 5), y = ri(4, h - 5), k = I(x, y);
    if (terr[k] === 'r' || block[k] || keepOut[k] || clear[k] || forest[k] > 0.6 || Math.hypot(x - bcx, y - bcy) < baseR + 4) continue;
    VIG[Math.floor(rng() * VIG.length)].forEach(key => near(key, x, y, 2, false)); c++;
  }
  const signs = Math.ceil(S.pois / 3);
  for (let t = 0, c = 0; t < 200 && c < signs; t++) { const x = ri(2, w - 3), y = ri(2, h - 3), k = I(x, y); if (terr[k] !== 'r' && !block[k] && !roof[k] && !front[k] && !keepOut[k] && !nearB(x, y) && (roadAt(x + 1, y) || roadAt(x - 1, y) || roadAt(x, y + 1) || roadAt(x, y - 1))) { put({ t: 'tree', k: 'deco_sign', tx: x, ty: y }); c++; } }

  /* 6 · foliage */
  const TR = (v, r) => r < 0.5 ? (v > 0.5 ? 'tree_pine' : 'tree_oak') : r < 0.62 ? 'tree_dead' : r < 0.82 ? 'bush' : 'stump';
  const vN = noise(sd ^ 0x3c);
  for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) {
    const k = I(x, y); if (block[k] || roof[k] || front[k] || clear[k] || keepOut[k] || terr[k] === 'r') continue;
    const f = forest[k], r = rng(), v = vN(x / 20, y / 20); let key = null;
    if (f > 0.6) { if (r < 0.5) key = rng() < 0.9 ? (v > 0.45 ? 'tree_pine' : 'tree_oak') : 'tree_dead'; else if (r < 0.56) key = 'bush'; }
    else if (f > 0.52) { if (r < 0.14) key = TR(v, rng()); }
    else if (r < 0.012) key = TR(v, rng()); else if (r < 0.016) key = 'deco_boulder';
    if (key) put({ t: 'tree', k: key, tx: x, ty: y });
  }
  // walkable ground scatter: undergrowth in forest, grass and flowers in the open
  for (let y = 1; y < h; y++) for (let x = 0; x < w - 1; x++) {
    const k = I(x, y); if (block[k] || keepOut[k] || terr[k] === 'r' || base[k]) continue;
    const f = forest[k], r = rng(); let key = null;
    if (f > 0.55) { if (r < 0.025) key = 'deco_mushrooms'; else if (r < 0.045) key = 'deco_leaves'; else if (r < 0.06) key = 'deco_fallen_log'; }
    else if (terr[k] === 'g') { if (r < 0.03) key = 'deco_tuft'; else if (r < 0.042 && vN(x / 8, y / 8) > 0.5) key = 'deco_flowers'; else if (r < 0.05) key = 'deco_pebbles'; }
    else if (r < 0.03) key = 'deco_pebbles';
    if (key === 'deco_fallen_log' && (nearB(x, y) || nearB(x + 1, y))) key = null;
    if (key && fits({ t: 'tree', k: key, tx: x, ty: y })) put({ t: 'tree', k: key, tx: x, ty: y });
  }

  /* 7 · zombie spawns */
  const zOk = (x, y) => inb(x, y) && !block[I(x, y)] && !keepOut[I(x, y)] && Math.hypot(x - bcx, y - bcy) > baseR + 8 && !marks.some(m => m.tx === x && m.ty === y);
  for (const p of pois) { const n = p.type === 'town' ? 3 : 1; for (let t = 0, c = 0; t < 60 && c < n; t++) { const x = p.x + ri(-p.r, p.r), y = p.y + ri(-p.r, p.r); if (zOk(x, y)) { marks.push({ mk: 'zombie', tx: x, ty: y }); c++; } } }
  for (let t = 0, c = 0; t < S.edgeZ * 40 && c < S.edgeZ; t++) { const s = ri(0, 3), a = rng(), x = s === 1 ? w - 2 : s === 3 ? 1 : Math.round(1 + a * (w - 3)), y = s === 0 ? 1 : s === 2 ? h - 2 : Math.round(1 + a * (h - 3)); if (zOk(x, y)) { marks.push({ mk: 'zombie', tx: x, ty: y }); c++; } }

  stats.buildings = objs.filter(o => o.t === 'bld' && o.k.startsWith('wld_')).length;
  stats.trees = objs.filter(o => o.t === 'tree' && !o.k.startsWith('deco_')).length;
  stats.decor = objs.filter(o => o.t === 'tree' && o.k.startsWith('deco_')).length;
  stats.zombies = marks.filter(m => m.mk === 'zombie').length;
  const fixed = new Array(N).fill(null);
  const map = { format: 'survival-map', version: 2, name: `world_${size}_${sd}`, w, h, terr, fixed, base, objs, marks };
  return { map, meta: { size, seed: sd, base: { x0, y0, x1, y1, side, cx: bcx, cy: bcy }, pois, nodes, edges, stats } };
}

/* ---------- rendering helpers (same placement rules as the Map Editor) ---------- */
const TS = 16, DIRS = [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]];
export function groundKey(M, x, y) {
  const i = y * M.w + x, f = M.fixed[i]; if (f) return f;
  const t = M.terr[i], h = hh(x, y, 5), T = (a, b) => a >= 0 && b >= 0 && a < M.w && b < M.h ? M.terr[b * M.w + a] : null;
  if (t === 'g') return h < 0.55 ? 'grass_a' : h < 0.88 ? 'grass_b' : 'grass_c';
  if (t === 'd') { for (const [d, dx, dy] of DIRS) if (T(x + dx, y + dy) === 'g') return 'edge_' + d; return h < 0.8 ? 'dirt_a' : h < 0.95 ? 'dirt_b' : 'dirt_c'; }
  const g = {}; for (const [d, dx, dy] of DIRS) { const v = T(x + dx, y + dy); g[d] = v !== null && v !== 'r'; }
  const n = g.n + g.e + g.s + g.w;
  if (n === 0) return h < 0.12 ? 'road_p' : 'road_x';
  if (n === 1) return 'road_edge_' + (g.n ? 'n' : g.e ? 'e' : g.s ? 's' : 'w');
  if (n === 2) { if (g.n && g.s) return 'road_h'; if (g.e && g.w) return 'road_v'; return 'road_corner_' + (g.n ? 'n' : 's') + (g.w ? 'w' : 'e'); }
  if (n === 3) return g.n && g.s ? 'road_h' : 'road_v';
  return 'road_p';
}
export function layout(M, A, season = 'summer') {
  const sf = season === 'summer' ? '' : '_' + season, sk = k => A[k + sf] ? k + sf : k;
  const occ = new Int32Array(M.w * M.h).fill(-1);
  const fpOf = o => o.t === 'gate' ? (o.o === 'h' ? [2, 1] : [1, 2]) : o.t === 'tower' ? [2, 2] : o.t === 'bld' ? FP[o.k] : DFP[o.k] || [1, 1];
  M.objs.forEach((o, n) => { const [fw, fh] = fpOf(o); for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) { const x = o.tx + i, y = o.ty + j; if (x >= 0 && y >= 0 && x < M.w && y < M.h) occ[y * M.w + x] = n; } });
  const at = (x, y) => x >= 0 && y >= 0 && x < M.w && y < M.h && occ[y * M.w + x] >= 0 ? M.objs[occ[y * M.w + x]] : null;
  const wallish = (x, y) => { const o = at(x, y); return !!o && (o.t === 'wall' || o.t === 'gate'); };
  const piece = (x, y) => {
    const n = wallish(x, y - 1), s = wallish(x, y + 1), e = wallish(x + 1, y), w = wallish(x - 1, y), hz = e || w, vt = n || s;
    if (hz && !vt) return 'h'; if (vt && !hz) return 'v';
    if (s && e && !n && !w) return 'tl'; if (s && w && !n && !e) return 'tr'; if (n && e && !s && !w) return 'bl'; if (n && w && !s && !e) return 'br';
    return e && w ? 'h' : vt ? 'v' : 'h';
  };
  const sprOf = o => {
    if (o.t === 'wall') { const p = piece(o.tx, o.ty); return { key: o.dmg && p === 'h' ? 'wall_planks_dmg' : `wall_${o.mat}_${p}`, x: o.tx * TS, y: o.ty * TS - 16, ord: o.ty * TS + 16 }; }
    if (o.t === 'gate') {
      if (o.o === 'h') return { key: `gate_${o.gk}_${o.open ? 'open' : 'closed'}`, x: o.tx * TS, y: o.ty * TS - 16, ord: o.ty * TS + 16 };
      return { key: o.open ? `gate_${o.gk}_v_open_${o.side || 'e'}` : `gate_${o.gk}_v_closed`, x: o.tx * TS - (o.open && o.side === 'w' ? 16 : 0), y: o.ty * TS - 16, ord: (o.ty + 2) * TS };
    }
    if (o.t === 'tower') return { key: o.roof ? 'tower_roofed' : 'tower_open', x: o.tx * TS, y: (o.ty + 2) * TS - 56, ord: (o.ty + 2) * TS };
    const s = A[sk(o.k)]; if (!s) return null;
    if (o.t === 'bld') { const [fw, fh] = FP[o.k]; return { key: o.k, x: o.tx * TS + ((fw * TS - s.w) >> 1), y: (o.ty + fh) * TS - s.h, ord: (o.ty + fh) * TS }; }
    const fw = (DFP[o.k] || [1])[0];
    return { key: o.k, x: o.tx * TS + ((fw * TS) >> 1) - (s.w >> 1), y: o.ty * TS + 18 - s.h, ord: o.ty * TS + 16 };
  };
  const ground = []; for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) ground.push(sk(groundKey(M, x, y)));
  const draws = M.objs.map(o => { const d = sprOf(o); return d && { ...d, key: sk(d.key), ob: o }; }).filter(Boolean).sort((a, b) => a.ord - b.ord || a.x - b.x);
  return { ground, draws, at };
}

const MINI = {
  summer: { g: [80, 103, 63], d: [122, 111, 82], tree: [40, 56, 34] },
  spring: { g: [90, 118, 70], d: [118, 108, 85], tree: [46, 66, 38] },
  fall: { g: [118, 104, 60], d: [122, 106, 78], tree: [110, 62, 34] },
  winter: { g: [195, 202, 208], d: [150, 146, 136], tree: [70, 84, 80] }
};
export function minimap(M, season = 'summer') {
  const P = MINI[season] || MINI.summer, px = new Uint8ClampedArray(M.w * M.h * 4);
  const set = (i, c) => { px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = 255; };
  for (let i = 0; i < M.w * M.h; i++) set(i, M.terr[i] === 'r' ? [168, 160, 134] : M.terr[i] === 'd' ? P.d : P.g);
  const fpOf = o => o.t === 'gate' ? (o.o === 'h' ? [2, 1] : [1, 2]) : o.t === 'tower' ? [2, 2] : o.t === 'bld' ? FP[o.k] : DFP[o.k] || [1, 1];
  for (const o of M.objs) {
    const c = o.t === 'wall' || o.t === 'gate' || o.t === 'tower' ? [197, 212, 138] : o.t === 'bld' ? (o.k.startsWith('bld_') ? [197, 212, 138] : [176, 121, 74]) : o.k.startsWith('deco_') ? null : o.k === 'bush' || o.k === 'stump' ? null : P.tree;
    if (!c) continue; const [fw, fh] = fpOf(o);
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) { const x = o.tx + i, y = o.ty + j; if (x >= 0 && y >= 0 && x < M.w && y < M.h) set(y * M.w + x, c); }
  }
  return px;
}
