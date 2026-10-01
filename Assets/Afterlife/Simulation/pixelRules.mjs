// The design kit's pixel-rules3.js, verbatim but for the import path. Pure logic, no DOM.
// Placement rules for v3 survival maps (generated or hand-made). Pure logic, no DOM.
// computeRules() turns a map into a per-tile bitmask the game can query before it places anything at runtime;
// validate() lists every object or tile that breaks those rules. Works for both base kinds (tent camp and walled compound).
import { FP, DFP, BUP, TALL, GROUND, ON_WATER } from './worldgen4.mjs';

export const R = {
  BASE: 1,        // inside the starting base (buildable)
  WALL: 2,        // wall, gate or tower footprint
  BUFFER: 4,      // clear ring outside the base (3 tiles, 4 on the south side where tall sprites rise over it)
  ROAD: 8,        // road, street or bridge
  BLOCKED: 16,    // footprint of a blocking object
  ROOF: 32,       // a building or tower sprite is drawn over this tile; anything placed here is hidden
  FACADE: 64,     // two rows in front of a building; tall props here hide its front
  NO_ZOMBIE: 128, // base, buffer and 8 tiles beyond
  GATE_PATH: 256, // approach through the gate (compound) or the footpath to the road (camp); keep walkable
  WATER: 512      // open water or swamp water; only bridges and lily pads go here
};
export const DENY = {
  foliage: R.BASE | R.WALL | R.BUFFER | R.ROAD | R.BLOCKED | R.ROOF | R.FACADE | R.GATE_PATH | R.WATER,
  prop: R.WALL | R.BUFFER | R.BLOCKED | R.ROOF | R.GATE_PATH | R.WATER,
  tall_prop: R.WALL | R.BUFFER | R.BLOCKED | R.ROOF | R.FACADE | R.GATE_PATH | R.WATER,
  base_prop: R.WALL | R.BLOCKED | R.ROOF | R.GATE_PATH | R.ROAD | R.WATER,
  building: R.WALL | R.BUFFER | R.ROAD | R.BLOCKED | R.ROOF | R.GATE_PATH | R.WATER,
  road: R.BASE | R.WALL | R.BLOCKED | R.WATER,
  zombie_spawn: R.NO_ZOMBIE | R.BLOCKED | R.WATER
};
const BASE_OK = new Set(['deco_campfire', 'deco_crates', 'deco_drum', 'deco_logs', 'deco_sandbags', 'deco_barrel', 'deco_wheelbarrow', 'deco_backpack', 'deco_bench', 'deco_picnic', 'deco_haybale', 'deco_tent', 'camp_workbench']);
export const kindOf = o => {
  if (o.t === 'wall' || o.t === 'gate' || o.t === 'tower') return 'wall';
  if (o.t === 'bridge') return 'bridge';
  if (o.t === 'bld') return 'building';
  const k = o.k || '';
  if (GROUND[k]) return 'ground';
  if (k.startsWith('tree_') || k === 'bush' || k === 'stump' || k.startsWith('nat_s2_') || k === 'deco_boulder' || k === 'deco_fallen_log') return 'foliage';
  return TALL[k] ? 'tall_prop' : 'prop';
};
export const fpOf = o => o.t === 'gate' ? (o.o === 'h' ? [2, 1] : [1, 2]) : o.t === 'tower' ? [2, 2] : o.t === 'bld' ? (FP[o.k] || [o.fw || 1, o.fh || 1]) : DFP[o.k] || [1, 1];
const upOf = (o, A) => {
  if (o.t === 'tower') return 2;
  if (o.t !== 'bld') return 0;
  const s = A && A[o.k], fh = fpOf(o)[1];
  if (s) return Math.max(0, Math.ceil((s.h - fh * 16 - 4) / 16));
  return BUP[o.k] ?? 1;
};

export function computeRules(M, A) {
  const { w, h } = M, N = w * h, g = new Uint16Array(N), I = (x, y) => y * w + x, inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const base = M.base || new Array(N).fill(0);
  let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = I(x, y), t = M.terr[k];
    if (t === 'r' || t === 'a' || t === 'x') g[k] |= R.ROAD; if (t === 'w' || t === 'S') g[k] |= R.WATER;
    if (base[k]) { g[k] |= R.BASE; bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
  }
  if (bx1 >= 0) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (base[I(x, y)]) {
    for (let j = -8; j <= 9; j++) for (let i = -8; i <= 8; i++) { const X = x + i, Y = y + j; if (!inb(X, Y)) continue; const k = I(X, Y); g[k] |= R.NO_ZOMBIE; if (!base[k] && Math.abs(i) <= 3 && j >= -3 && j <= 4) g[k] |= R.BUFFER; }
  }
  for (const o of M.objs) {
    const [fw, fh] = fpOf(o), kd = kindOf(o);
    if (kd === 'bridge') { if (inb(o.tx, o.ty)) g[I(o.tx, o.ty)] |= R.ROAD; continue; }
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) { const x = o.tx + i, y = o.ty + j; if (!inb(x, y)) continue; const k = I(x, y); if (kd !== 'ground') g[k] |= R.BLOCKED; if (kd === 'wall') g[k] |= R.WALL; }
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
  // camp: the dirt footpath from the fire out of the base zone stays walkable
  if (M.baseKind === 'camp' && M.campPath) for (const k of M.campPath) g[k] |= R.GATE_PATH;
  return { grid: Array.from(g), bits: R, deny: DENY, baseRect: bx1 >= 0 ? { x0: bx0, y0: by0, x1: bx1, y1: by1 } : null };
}

export function canPlace(rules, w, tx, ty, fw, fh, kind) {
  const deny = DENY[kind] ?? 0, h = rules.grid.length / w;
  for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) { const x = tx + i, y = ty + j; if (x < 0 || y < 0 || x >= w || y >= h || rules.grid[y * w + x] & deny) return false; }
  return true;
}

// returns [{ id, text, n, cells: [[x,y]...] }]; an empty list means the map is clean
export function validate(M, A, rules = computeRules(M, A)) {
  const { w, h } = M, G = rules.grid, I = (x, y) => y * w + x, inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h, found = {}, camp = M.baseKind === 'camp';
  const add = (id, text, x, y) => { const f = found[id] || (found[id] = { id, text, n: 0, cells: [] }); f.n++; if (f.cells.length < 50) f.cells.push([x, y]); };
  const occ = new Int32Array(w * h).fill(-1);
  M.objs.forEach((o, n) => {
    const [fw, fh] = fpOf(o), kd = kindOf(o); if (kd === 'ground' || kd === 'bridge') return;
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) { const x = o.tx + i, y = o.ty + j; if (!inb(x, y)) { add('out', 'Objects hanging off the map edge', o.tx, o.ty); continue; } const k = I(x, y); if (occ[k] >= 0) add('overlap', 'Objects sharing a tile', x, y); else occ[k] = n; }
  });
  for (const o of M.objs) {
    const [fw, fh] = fpOf(o), kd = kindOf(o); if (kd === 'wall') continue;
    let bits = 0; for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) if (inb(o.tx + i, o.ty + j)) bits |= G[I(o.tx + i, o.ty + j)];
    if (kd === 'bridge') { if (!(bits & R.WATER)) add('bridge_dry', 'Bridges over dry land', o.tx, o.ty); continue; }
    if (ON_WATER[o.k]) { if (!(bits & R.WATER)) add('on_water', 'Objects standing in water', o.tx, o.ty); continue; }
    if (bits & R.WATER) add('on_water', 'Objects standing in water', o.tx, o.ty);
    const inBase = bits & R.BASE;
    if (kd === 'foliage' && inBase) add('foliage_base', 'Trees, bushes or rocks inside the base', o.tx, o.ty);
    else if ((kd === 'foliage' || kd === 'tall_prop') && bits & R.BUFFER) add('buffer', 'Tall objects in the clear ring around the base', o.tx, o.ty);
    if (kd === 'prop' && inBase && !BASE_OK.has(o.k)) add('prop_base', 'World props inside the base', o.tx, o.ty);
    if (o.t === 'bld' && o.k.startsWith('wld_') && (inBase || bits & R.BUFFER)) add('wld_base', 'World buildings in or beside the base', o.tx, o.ty);
    if (o.t === 'bld' && o.k.startsWith('bld_') && !inBase) add('bld_out', 'Base buildings outside the base', o.tx, o.ty);
    if (kd !== 'ground' && bits & R.GATE_PATH) add('gate_path', camp ? 'Camp footpath blocked' : 'Gate approach blocked', o.tx, o.ty);
    if (TALL[o.k] && bits & R.FACADE) add('facade', 'Tall objects standing in front of a building', o.tx, o.ty);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = I(x, y); if ((G[k] & R.ROOF) && occ[k] >= 0 && kindOf(M.objs[occ[k]]) !== 'wall') add('roof', 'Objects hidden under a roof', x, y); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = I(x, y); if (!(G[k] & R.BASE)) continue;
    if (G[k] & R.ROAD) add('road_base', 'Road tiles inside the base', x, y);
    if (G[k] & R.WATER) add('water_base', 'Water inside the base', x, y);
    if (camp) continue;
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => !inb(x + i, y + j) || !(G[I(x + i, y + j)] & R.BASE));
    if (edge && !(G[k] & R.WALL)) add('wall_gap', 'Gaps in the base wall', x, y);
  }
  for (const m of M.marks || []) {
    const k = inb(m.tx, m.ty) ? I(m.tx, m.ty) : -1;
    if (m.mk === 'zombie' && k >= 0 && G[k] & R.NO_ZOMBIE) add('zombie_near', 'Zombie spawns in or near the base', m.tx, m.ty);
    if (m.mk === 'survivor' && k >= 0 && !(G[k] & R.BASE)) add('survivor_out', 'Survivor spawns outside the base', m.tx, m.ty);
    if (k >= 0 && G[k] & (R.BLOCKED | R.WATER)) add('mark_blocked', 'Spawns on a blocked tile', m.tx, m.ty);
  }
  if (rules.baseRect && camp) {
    const inB = o => o.tx >= rules.baseRect.x0 && o.tx <= rules.baseRect.x1 && o.ty >= rules.baseRect.y0 && o.ty <= rules.baseRect.y1;
    if (!M.objs.some(o => o.k === 'deco_campfire' && inB(o))) add('camp_fire', 'Camp has no campfire', rules.baseRect.x0, rules.baseRect.y0);
    if (!M.objs.some(o => o.k === 'camp_workbench' && inB(o))) add('camp_bench', 'Camp has no workbench', rules.baseRect.x0, rules.baseRect.y0);
  } else if (rules.baseRect && !M.objs.some(o => o.t === 'gate')) add('no_gate', 'Base has no gate', rules.baseRect.x0, rules.baseRect.y0);
  return Object.values(found);
}

// the checks validate() runs for this map, for listing passes as well as failures
export function checksFor(M) {
  const camp = M.baseKind === 'camp';
  return [
    ...(camp ? [['camp_fire', 'Camp has a campfire'], ['camp_bench', 'Camp has a workbench'], ['gate_path', 'Footpath to the road clear']]
      : [['wall_gap', 'Wall ring complete'], ['no_gate', 'Base has a gate'], ['gate_path', 'Gate approach clear']]),
    ['foliage_base', 'No foliage inside the base'], ['road_base', 'No roads through the base'], ['water_base', 'No water inside the base'], ['buffer', 'Clear ring outside the base'],
    ['on_water', 'Nothing standing in water'], ['bridge_dry', 'Bridges only over water'], ['roof', 'Nothing hidden under roofs'], ['facade', 'Building fronts unobstructed'], ['overlap', 'No overlapping objects'],
    ['wld_base', 'World buildings away from base'], ['zombie_near', 'Zombie spawns away from base'], ['survivor_out', 'Survivors spawn in base']
  ];
}
