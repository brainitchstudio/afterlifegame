// Placement rules for any survival-map (generated or hand-made). Pure logic, no DOM.
// computeRules() turns a map into a per-tile bitmask the game can query before it places anything
// at runtime; validate() lists every existing object or tile that breaks those rules.
import { FP, DFP } from './pixel-worldgen.js';

export const R = {
  BASE: 1,        // inside the starting base (buildable)
  WALL: 2,        // wall, gate or tower footprint
  BUFFER: 4,      // clear ring outside the wall (3 tiles, 4 on the south side where tall sprites rise over it)
  ROAD: 8,
  BLOCKED: 16,    // footprint of a blocking object
  ROOF: 32,       // a building or tower sprite is drawn over this tile; anything placed here is hidden
  FACADE: 64,     // two rows in front of a building; tall props here hide its front
  NO_ZOMBIE: 128, // base, buffer and 8 tiles beyond
  GATE_PATH: 256  // approach through the gate, inside and out; keep walkable
};
// what each placement kind may not touch
export const DENY = {
  foliage: R.BASE | R.WALL | R.BUFFER | R.ROAD | R.BLOCKED | R.ROOF | R.FACADE | R.GATE_PATH,
  prop: R.WALL | R.BUFFER | R.BLOCKED | R.ROOF | R.GATE_PATH,
  tall_prop: R.WALL | R.BUFFER | R.BLOCKED | R.ROOF | R.FACADE | R.GATE_PATH,
  base_prop: R.WALL | R.BLOCKED | R.ROOF | R.GATE_PATH | R.ROAD,
  building: R.WALL | R.BUFFER | R.ROAD | R.BLOCKED | R.ROOF | R.GATE_PATH,
  road: R.BASE | R.WALL | R.BLOCKED,
  zombie_spawn: R.NO_ZOMBIE | R.BLOCKED
};
const TALL = new Set(['tree_pine', 'tree_oak', 'tree_dead', 'deco_pole', 'deco_streetlight', 'deco_sign', 'deco_scarecrow', 'deco_well', 'deco_tractor', 'deco_dumpster', 'deco_tent', 'deco_bus']);
const GROUND = new Set(['deco_tuft', 'deco_flowers', 'deco_pebbles', 'deco_mushrooms', 'deco_leaves', 'deco_blood']);
const BASE_OK = new Set(['deco_campfire', 'deco_crates', 'deco_drum', 'deco_logs', 'deco_sandbags', 'deco_barrel', 'deco_wheelbarrow', 'deco_backpack', 'deco_bench', 'deco_picnic', 'deco_haybale']);
export const kindOf = o => {
  if (o.t === 'wall' || o.t === 'gate' || o.t === 'tower') return 'wall';
  if (o.t === 'bld') return 'building';
  const k = o.k || '';
  if (GROUND.has(k)) return 'ground';
  if (!k.startsWith('deco_') || k === 'deco_boulder' || k === 'deco_fallen_log') return 'foliage';
  return TALL.has(k) ? 'tall_prop' : 'prop';
};
export const fpOf = o => o.t === 'gate' ? (o.o === 'h' ? [2, 1] : [1, 2]) : o.t === 'tower' ? [2, 2] : o.t === 'bld' ? (FP[o.k] || [o.fw || 1, o.fh || 1]) : DFP[o.k] || [1, 1];
const UP_FALLBACK = { bld_town_hall: 2, bld_barracks: 2, wld_barn: 2, wld_chapel: 2, wld_water_tower: 2 };
// rows a sprite rises above its footprint; uses real sprite heights when the atlas is passed
const upOf = (o, A) => {
  if (o.t === 'tower') return 2;
  if (o.t !== 'bld') return 0;
  const s = A && A[o.k], fh = fpOf(o)[1];
  if (s) return Math.max(0, Math.ceil((s.h - fh * 16 - 4) / 16));
  return UP_FALLBACK[o.k] ?? 1;
};

export function computeRules(M, A) {
  const { w, h } = M, N = w * h, g = new Uint16Array(N), I = (x, y) => y * w + x, inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const base = M.base || new Array(N).fill(0);
  let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = I(x, y); if (M.terr[k] === 'r') g[k] |= R.ROAD; if (base[k]) { g[k] |= R.BASE; bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); } }
  // buffer + no-zombie: dilate the base mask
  if (bx1 >= 0) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (base[I(x, y)]) {
    for (let j = -8; j <= 9; j++) for (let i = -8; i <= 8; i++) { const X = x + i, Y = y + j; if (!inb(X, Y)) continue; const k = I(X, Y); g[k] |= R.NO_ZOMBIE; if (!base[k] && Math.abs(i) <= 3 && j >= -3 && j <= 4) g[k] |= R.BUFFER; }
  }
  for (const o of M.objs) {
    const [fw, fh] = fpOf(o), kd = kindOf(o), blocking = kd !== 'ground';
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) { const x = o.tx + i, y = o.ty + j; if (!inb(x, y)) continue; const k = I(x, y); if (blocking) g[k] |= R.BLOCKED; if (kd === 'wall') g[k] |= R.WALL; }
    const up = upOf(o, A);
    for (let j = 1; j <= up; j++) for (let i = 0; i < fw; i++) if (inb(o.tx + i, o.ty - j)) g[I(o.tx + i, o.ty - j)] |= R.ROOF;
    if (o.t === 'bld') for (let j = 0; j < 2; j++) for (let i = -1; i <= fw; i++) if (inb(o.tx + i, o.ty + fh + j)) g[I(o.tx + i, o.ty + fh + j)] |= R.FACADE;
    if (o.t === 'gate') {
      const hz = o.o === 'h', cells = hz ? [[o.tx, o.ty], [o.tx + 1, o.ty]] : [[o.tx, o.ty], [o.tx, o.ty + 1]];
      for (const s of [-1, 1]) {
        const [ax, ay] = cells[0], nx = hz ? ax : ax + s, ny = hz ? ay + s : ay, inside = inb(nx, ny) && base[I(nx, ny)];
        for (let d = 1; d <= (inside ? 3 : 4); d++) for (const [cx, cy] of cells) { const x = hz ? cx : cx + s * d, y = hz ? cy + s * d : cy; if (inb(x, y)) g[I(x, y)] |= R.GATE_PATH; }
      }
    }
  }
  return { grid: Array.from(g), bits: R, deny: DENY, baseRect: bx1 >= 0 ? { x0: bx0, y0: by0, x1: bx1, y1: by1 } : null };
}

export function canPlace(rules, w, tx, ty, fw, fh, kind) {
  const deny = DENY[kind] ?? 0, h = rules.grid.length / w;
  for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) { const x = tx + i, y = ty + j; if (x < 0 || y < 0 || x >= w || y >= h || rules.grid[y * w + x] & deny) return false; }
  return true;
}

// returns [{ id, text, n, cells: [[x,y]...] }]; an empty list means the map is clean
export function validate(M, A, rules = computeRules(M, A)) {
  const { w, h } = M, G = rules.grid, I = (x, y) => y * w + x, inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h, found = {};
  const add = (id, text, x, y) => { const f = found[id] || (found[id] = { id, text, n: 0, cells: [] }); f.n++; if (f.cells.length < 50) f.cells.push([x, y]); };
  const occ = new Int32Array(w * h).fill(-1);
  M.objs.forEach((o, n) => {
    const [fw, fh] = fpOf(o), kd = kindOf(o); if (kd === 'ground') return;
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) { const x = o.tx + i, y = o.ty + j; if (!inb(x, y)) { add('out', 'Objects hanging off the map edge', o.tx, o.ty); continue; } const k = I(x, y); if (occ[k] >= 0) add('overlap', 'Objects sharing a tile', x, y); else occ[k] = n; }
  });
  // own footprint is already in BLOCKED/WALL, so test each object against the other bits only
  const own = R.BLOCKED | R.WALL;
  for (const o of M.objs) {
    const [fw, fh] = fpOf(o), kd = kindOf(o); if (kd === 'wall') continue;
    let bits = 0; for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) if (inb(o.tx + i, o.ty + j)) bits |= G[I(o.tx + i, o.ty + j)];
    const inBase = bits & R.BASE;
    if (kd === 'foliage' && inBase) add('foliage_base', 'Trees, bushes or rocks inside the base', o.tx, o.ty);
    else if ((kd === 'foliage' || kd === 'tall_prop') && bits & R.BUFFER) add('buffer', 'Tall objects in the clear ring around the base', o.tx, o.ty);
    if (kd === 'prop' && inBase && !BASE_OK.has(o.k)) add('prop_base', 'World props inside the base', o.tx, o.ty);
    if (o.t === 'bld' && o.k.startsWith('wld_') && (inBase || bits & R.BUFFER)) add('wld_base', 'World buildings in or beside the base', o.tx, o.ty);
    if (o.t === 'bld' && o.k.startsWith('bld_') && !inBase) add('bld_out', 'Base buildings outside the base', o.tx, o.ty);
    if (kd !== 'ground' && bits & R.GATE_PATH) add('gate_path', 'Gate approach blocked', o.tx, o.ty);
    if (TALL.has(o.k) && bits & R.FACADE) add('facade', 'Tall objects standing in front of a building', o.tx, o.ty);
  }
  // roofs: anything whose footprint sits in another object's roof rows
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = I(x, y); if ((G[k] & R.ROOF) && occ[k] >= 0 && kindOf(M.objs[occ[k]]) !== 'wall') add('roof', 'Objects hidden under a roof', x, y); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = I(x, y); if (!(G[k] & R.BASE)) continue;
    if (G[k] & R.ROAD) add('road_base', 'Road tiles inside the base', x, y);
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => !inb(x + i, y + j) || !(G[I(x + i, y + j)] & R.BASE));
    if (edge && !(G[k] & R.WALL)) add('wall_gap', 'Gaps in the base wall', x, y);
  }
  for (const m of M.marks || []) {
    const k = inb(m.tx, m.ty) ? I(m.tx, m.ty) : -1;
    if (m.mk === 'zombie' && k >= 0 && G[k] & R.NO_ZOMBIE) add('zombie_near', 'Zombie spawns in or near the base', m.tx, m.ty);
    if (m.mk === 'survivor' && k >= 0 && !(G[k] & R.BASE)) add('survivor_out', 'Survivor spawns outside the base', m.tx, m.ty);
    if (k >= 0 && G[k] & R.BLOCKED) add('mark_blocked', 'Spawns on a blocked tile', m.tx, m.ty);
  }
  const gates = M.objs.filter(o => o.t === 'gate');
  if (rules.baseRect && !gates.length) add('no_gate', 'Base has no gate', rules.baseRect.x0, rules.baseRect.y0);
  return Object.values(found);
}

// the checks validate() runs, for listing passes as well as failures
export const CHECKS = [
  ['wall_gap', 'Wall ring complete'], ['no_gate', 'Base has a gate'], ['gate_path', 'Gate approach clear'],
  ['foliage_base', 'No foliage inside the base'], ['road_base', 'No roads through the base'], ['buffer', 'Clear ring outside the wall'],
  ['roof', 'Nothing hidden under roofs'], ['facade', 'Building fronts unobstructed'], ['overlap', 'No overlapping objects'],
  ['wld_base', 'World buildings away from base'], ['zombie_near', 'Zombie spawns away from base'], ['survivor_out', 'Survivors spawn in base']
];
