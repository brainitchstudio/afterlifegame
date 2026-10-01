// v4: pixel-worldgen3 plus an XL size and the spawn customizer (opts.custom).
// Procedural world generator v3. Pure logic: no DOM and no imports, so the same file runs in the browser, React, Node and workers.
// python/survival_worldgen.py is a line-for-line port. The same seed and options give the same world; compare fingerprint().
// v3 adds water (rivers with bridges, lakes, ponds, swamps), forest floor, rocky ground, farm fields, town streets and sidewalks,
// rubble lots, Series 2 landmarks and nature, and a tent starting camp (the walled compound is still available: base: 'compound').

export const VERSION = 3;
export const SIZES = {
  small: { label: 'Small', w: 96, h: 72, bw: 18, bh: 14, pois: 7, towns: 1, exits: 2, edgeZ: 6, cars: 5, rivers: [0, 1], lakes: [0, 1], ponds: [1, 3], swamps: [0, 1], wild: 1, docks: 1 },
  medium: { label: 'Medium', w: 160, h: 112, bw: 20, bh: 15, pois: 13, towns: 2, exits: 2, edgeZ: 12, cars: 11, rivers: [1, 1], lakes: [1, 1], ponds: [2, 4], swamps: [1, 2], wild: 2, docks: 2 },
  large: { label: 'Large', w: 240, h: 176, bw: 22, bh: 16, pois: 22, towns: 3, exits: 3, edgeZ: 20, cars: 20, rivers: [1, 1], lakes: [1, 3], ponds: [4, 6], swamps: [2, 3], wild: 3, docks: 3 },
  xl: { label: 'XL', w: 320, h: 224, bw: 22, bh: 16, pois: 32, towns: 4, exits: 4, edgeZ: 30, cars: 30, rivers: [1, 2], lakes: [2, 4], ponds: [6, 9], swamps: [3, 4], wild: 4, docks: 4 }
};
// Spawn customizer. Numbers are multipliers on the size's defaults (hordes is a count); booleans switch a feature on or off.
// With the defaults every threshold and rng call is unchanged, so default worlds keep the v3 fingerprint and match the Python port.
export const PLACE_TYPES = ['farm', 'gas', 'ruin', 'chapel', 'camp', 'industrial', 'stop', 'wild'];
export const DEFAULT_CUSTOM = { places: 1, towns: 1, zombies: 1, hordes: 0, trees: 1, rocks: 1, scatter: 1, water: 1, decor: 1, wrecks: 1, checkpoints: 1, vignettes: 1,
  types: { farm: true, gas: true, ruin: true, chapel: true, camp: true, industrial: true, stop: true, wild: true }, fields: true, rail: true, graveyards: true, boathouses: true, pylons: true, roadside: true };
export function customOf(c) {
  c = c || {}; const d = DEFAULT_CUSTOM, o = {};
  for (const k in d) o[k] = k === 'types' ? Object.fromEntries(PLACE_TYPES.map(t => [t, !c.types || c.types[t] !== false])) : typeof d[k] === 'boolean' ? c[k] !== false : c[k] != null && Number.isFinite(+c[k]) ? Math.max(0, +c[k]) : d[k];
  o.hordes = Math.round(o.hordes); return o;
}
export const isDefaultCustom = c => JSON.stringify(customOf(c)) === JSON.stringify(DEFAULT_CUSTOM);
export const POI_TYPES = {
  town: { label: 'Town', r: 11 },
  farm: { label: 'Farmstead', r: 7 },
  gas: { label: 'Gas stop', r: 5 },
  ruin: { label: 'Ruins', r: 5 },
  chapel: { label: 'Chapel', r: 5 },
  camp: { label: 'Abandoned camp', r: 3 },
  industrial: { label: 'Industrial yard', r: 10 },
  stop: { label: 'Truck stop', r: 7 },
  wild: { label: 'Ranger post', r: 5 }
};
// terrain codes stored in map.terr
export const TERRAIN = { g: 'grass', d: 'dirt', r: 'road', w: 'water', f: 'forest floor', k: 'rocky ground', s: 'swamp mud', S: 'swamp water', t: 'tilled field', h: 'wheat field', a: 'street', p: 'sidewalk', l: 'rubble lot', q: 'rail', x: 'level crossing', L: 'parking lot' };
export const FP = {
  bld_town_hall: [4, 3], bld_clinic: [3, 3], bld_barracks: [4, 2], bld_workshop: [3, 3], bld_farm: [4, 3], bld_shelter: [2, 2], bld_lumber_mill: [3, 2], bld_storage: [3, 3], bld_lab: [3, 3], bld_armory: [2, 2], bld_bunkhouse: [3, 2], bld_bunkhouse_l2: [3, 2], bld_bunkhouse_l3: [4, 2], bld_bunkhouse_l4: [4, 2], bld_bunkhouse_l5: [4, 2], bld_clinic_l2: [3, 3], bld_clinic_l3: [4, 3], bld_clinic_l4: [4, 3], bld_clinic_l5: [4, 3], bld_barracks_l2: [4, 2], bld_barracks_l3: [5, 2], bld_barracks_l4: [5, 2], bld_barracks_l5: [5, 2], bld_town_hall_l2: [4,3], bld_town_hall_l3: [5,3], bld_town_hall_l4: [5,3], bld_town_hall_l5: [5,3], bld_workshop_l2: [3,3], bld_workshop_l3: [4,3], bld_workshop_l4: [4,3], bld_workshop_l5: [4,3], bld_farm_l2: [4,3], bld_farm_l3: [5,3], bld_farm_l4: [5,3], bld_farm_l5: [5,3], bld_shelter_l2: [2,2], bld_shelter_l3: [3,2], bld_shelter_l4: [3,2], bld_shelter_l5: [3,2], bld_lumber_mill_l2: [3,2], bld_lumber_mill_l3: [4,2], bld_lumber_mill_l4: [4,2], bld_lumber_mill_l5: [4,2], bld_storage_l2: [3,3], bld_storage_l3: [4,3], bld_storage_l4: [4,3], bld_storage_l5: [4,3], bld_lab_l2: [3,3], bld_lab_l3: [4,3], bld_lab_l4: [4,3], bld_lab_l5: [4,3], bld_armory_l2: [2,2], bld_armory_l3: [3,2], bld_armory_l4: [3,2], bld_armory_l5: [3,2],
  wld_house: [3, 3], wld_burnt_house: [3, 2], wld_gas_station: [4, 3], wld_barn: [4, 3], wld_chapel: [3, 3], wld_water_tower: [2, 2], wld_shed: [2, 2], wld_trailer: [3, 2],
  wld_silo: [2, 2], wld_motel: [5, 2], wld_lighthouse: [2, 2],
  wld_factory: [6, 4], wld_warehouse: [5, 3], wld_substation: [3, 3], wld_grain_elevator: [3, 3], wld_stables: [5, 2], wld_windmill: [2, 2],
  wld_truck_stop: [5, 3], wld_billboard: [3, 1], wld_bus_shelter: [2, 1], wld_boathouse: [3, 3], wld_fire_lookout: [2, 2], wld_cabin: [3, 2]
};
export const DFP = { deco_car: [2, 1], deco_dumpster: [2, 1], deco_bench: [2, 1], deco_barrier: [2, 1], deco_fallen_log: [2, 1], deco_tent: [2, 1], deco_picnic: [2, 1], deco_tractor: [2, 1], deco_police_car: [2, 1], deco_wire: [2, 1], deco_bus: [3, 1],
  deco_ruin_wall: [2, 1], camp_workbench: [2, 1], nat_s2_apple: [2, 1], nat_s2_willow: [2, 1], nat_s2_outcrop: [2, 1], nat_s2_driftwood: [2, 1], str_rubble_lg: [2, 1], str_pylon: [2, 1] };
// rows a building's sprite rises above its footprint
export const BUP = { bld_town_hall: 2, bld_barracks: 2, bld_bunkhouse_l4: 2, bld_bunkhouse_l5: 2, bld_clinic_l4: 2, bld_clinic_l5: 2, bld_barracks_l2: 2, bld_barracks_l3: 2, bld_barracks_l4: 3, bld_barracks_l5: 3, bld_town_hall_l2: 2, bld_town_hall_l3: 2, bld_town_hall_l4: 3, bld_town_hall_l5: 3, bld_workshop_l4: 2, bld_workshop_l5: 2, bld_farm_l2: 0, bld_farm_l3: 0, bld_farm_l4: 2, bld_farm_l5: 2, bld_shelter_l4: 2, bld_shelter_l5: 2, bld_lumber_mill_l2: 0, bld_lumber_mill_l3: 0, bld_lumber_mill_l4: 2, bld_lumber_mill_l5: 3, bld_storage_l4: 2, bld_storage_l5: 2, bld_lab_l4: 2, bld_lab_l5: 2, bld_armory_l4: 2, bld_armory_l5: 2, bld_farm: 0, bld_lumber_mill: 0, wld_barn: 2, wld_chapel: 2, wld_water_tower: 2, wld_silo: 3, wld_motel: 1, wld_lighthouse: 4, wld_factory: 3, wld_grain_elevator: 3, wld_windmill: 3, wld_billboard: 2, wld_fire_lookout: 4 };
// props tall enough to hide a building facade when stood directly in front of it
export const TALL = { tree_pine: 1, tree_oak: 1, tree_dead: 1, deco_pole: 1, deco_streetlight: 1, deco_sign: 1, deco_scarecrow: 1, deco_well: 1, deco_tractor: 1, deco_dumpster: 1, deco_tent: 1, deco_bus: 1, nat_s2_birch: 1, nat_s2_apple: 1, nat_s2_willow: 1, deco_corn: 1, str_pylon: 1, str_transformer_pole: 1, str_ruin_chimney: 1, str_ruin_corner: 1, str_rail_signal: 1 };
// walkable ground scatter: drawn, never blocks
export const GROUND = { deco_tuft: 1, deco_flowers: 1, deco_pebbles: 1, deco_mushrooms: 1, deco_leaves: 1, deco_blood: 1, nat_s2_cattails: 1, nat_s2_fern: 1, nat_s2_lilypads: 1, nat_s2_driftwood: 1, str_rubble: 1, str_dock: 1 };
export const ON_WATER = { nat_s2_lilypads: 1, str_dock: 1 };
// ground tiles placed as objects: drawn flush with the tile, not lifted like props
export const FLAT = { str_dock: 1 };
const ON_ROAD = { deco_car: 1, deco_barrier: 1, deco_police_car: 1, deco_bus: 1 };
const DECOR = {
  town: [['deco_mailbox', 3], ['deco_hydrant', 2], ['deco_dumpster', 1], ['deco_bench', 2], ['deco_trash', 3], ['deco_car', 2], ['deco_police_car', 1], ['deco_crates', 1], ['deco_sign', 1], ['deco_bicycle', 2], ['deco_cart', 1], ['deco_picnic', 1], ['deco_backpack', 1], ['deco_skeleton', 1], ['deco_blood', 2], ['deco_flowers', 2], ['deco_ruin_wall', 1]],
  farm: [['deco_haybale', 4], ['deco_well', 1], ['deco_logs', 1], ['deco_fence', 3], ['deco_crates', 1], ['deco_drum', 1], ['deco_scarecrow', 2], ['deco_wheelbarrow', 1], ['deco_tractor', 1], ['deco_flowers', 1]],
  gas: [['deco_car', 3], ['deco_drum', 3], ['deco_tires', 2], ['deco_dumpster', 1], ['deco_sign', 1], ['deco_trash', 2], ['deco_barrier', 1], ['deco_cart', 2], ['deco_blood', 1]],
  ruin: [['deco_ruin_wall', 3], ['deco_rubble', 5], ['deco_trash', 2], ['deco_car', 1], ['deco_tires', 1], ['deco_boulder', 1], ['deco_skeleton', 2], ['deco_blood', 2], ['deco_leaves', 1]],
  chapel: [['deco_bench', 2], ['deco_well', 1], ['deco_mailbox', 1], ['deco_trash', 1], ['deco_flowers', 2]],
  camp: [['deco_tent', 3], ['deco_campfire', 1], ['deco_crates', 2], ['deco_tires', 1], ['deco_drum', 2], ['deco_logs', 1], ['deco_car', 1], ['deco_trash', 2], ['deco_backpack', 2], ['deco_picnic', 1]],
  industrial: [['deco_drum', 4], ['deco_crates', 3], ['deco_tires', 2], ['deco_dumpster', 2], ['deco_trash', 2], ['str_transformer_pole', 2], ['str_rubble', 2], ['str_lot_bumper', 3], ['deco_car', 1], ['deco_blood', 1]],
  stop: [['deco_car', 3], ['deco_drum', 2], ['deco_tires', 2], ['deco_dumpster', 1], ['deco_trash', 3], ['deco_sign', 1], ['deco_bench', 1], ['deco_cart', 1], ['str_lot_bumper', 3], ['deco_blood', 1]],
  wild: [['deco_logs', 2], ['deco_campfire', 1], ['deco_fallen_log', 1], ['deco_backpack', 1], ['deco_crates', 1], ['deco_tent', 1]]
};
DECOR.ruin.push(['str_ruin_wall', 3], ['str_ruin_corner', 1], ['str_rubble', 3], ['str_rubble_lg', 1], ['str_ruin_chimney', 1]);

// Portability notes for the Python port: plain sqrt (no hypot), no trig, Math.round only on values >= 0, 64-bit floats everywhere.
const hyp = (a, b) => Math.sqrt(a * a + b * b);
export const hh = (x, y, s = 0) => { let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
function rngOf(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function seedOf(s) { s = String(s ?? ''); if (/^\d+$/.test(s)) return (+s >>> 0) || 1; let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) || 1; }
function noise(seed) {
  const v = (x, y) => hh(x, y, seed), sm = t => t * t * (3 - 2 * t);
  const n = (x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = sm(x - x0), fy = sm(y - y0); const a = v(x0, y0), b = v(x0 + 1, y0), c = v(x0, y0 + 1), d = v(x0 + 1, y0 + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
  return (x, y) => (n(x, y) * 0.55 + n(x * 2.1 + 17, y * 2.1 + 5) * 0.3 + n(x * 4.3 + 31, y * 4.3 + 11) * 0.15);
}
// single octave, for smooth curves
function noise1(seed) {
  const v = (x, y) => hh(x, y, seed), sm = t => t * t * (3 - 2 * t);
  return (x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = sm(x - x0), fy = sm(y - y0); const a = v(x0, y0), b = v(x0 + 1, y0), c = v(x0, y0 + 1), d = v(x0 + 1, y0 + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
}
function Heap() { const f = [], v = []; return {
  get size() { return f.length; },
  push(p, x) { let i = f.length; f.push(p); v.push(x); while (i > 0) { const q = (i - 1) >> 1; if (f[q] <= f[i]) break; [f[q], f[i]] = [f[i], f[q]]; [v[q], v[i]] = [v[i], v[q]]; i = q; } },
  pop() { const top = v[0], lf = f.pop(), lv = v.pop(); if (f.length) { f[0] = lf; v[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < f.length && f[l] < f[m]) m = l; if (r < f.length && f[r] < f[m]) m = r; if (m === i) break; [f[m], f[i]] = [f[i], f[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; } } return top; }
}; }

// Which water tile a 'w' cell shows, from where the land is. null means the shape can't be drawn (the cleanup turns it into land).
// Off-map counts as water so rivers run off the edge.
export function shoreKey(terr, w, h, x, y) {
  const L = (a, b) => a >= 0 && b >= 0 && a < w && b < h && terr[b * w + a] !== 'w';
  const n = L(x, y - 1), e = L(x + 1, y), s = L(x, y + 1), wl = L(x - 1, y), c = n + e + s + wl;
  const nw = L(x - 1, y - 1), ne = L(x + 1, y - 1), sw = L(x - 1, y + 1), se = L(x + 1, y + 1);
  if (c === 0) { const d = nw + ne + sw + se; if (d === 0) return 'water_a'; if (d > 1) return null; return 'shore_in_' + (nw ? 'nw' : ne ? 'ne' : sw ? 'sw' : 'se'); }
  if (c === 1) { if (n) return sw || se ? null : 'shore_n'; if (s) return nw || ne ? null : 'shore_s'; if (e) return nw || sw ? null : 'shore_e'; return ne || se ? null : 'shore_w'; }
  if (c === 2) { if (n && wl) return se ? null : 'shore_out_nw'; if (n && e) return sw ? null : 'shore_out_ne'; if (s && wl) return ne ? null : 'shore_out_sw'; if (s && e) return nw ? null : 'shore_out_se'; }
  return null;
}

export function generate(opts = {}) {
  const size = SIZES[opts.size] ? opts.size : 'medium', C = customOf(opts.custom), S = { ...SIZES[size] }, w = S.w, h = S.h, N = w * h, sd = seedOf(opts.seed ?? 1), rng = rngOf(sd);
  const WO = { rivers: opts.rivers !== false, lakes: opts.lakes !== false, ponds: opts.ponds !== false, swamps: opts.swamps !== false, lighthouse: opts.lighthouse !== false };
  const baseKind = opts.base === 'compound' ? 'compound' : 'camp';
  S.pois = Math.max(1, Math.round(S.pois * C.places)); S.towns = Math.min(S.pois, Math.round(S.towns * C.towns)); S.cars = Math.round(S.cars * C.wrecks); S.edgeZ = Math.round(S.edgeZ * C.zombies);
  if (!C.types.wild) S.wild = 0; if (!C.boathouses) S.docks = 0;
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const terr = new Array(N).fill('g'), block = new Uint8Array(N), keepOut = new Uint8Array(N), clear = new Uint8Array(N), base = new Array(N).fill(0);
  const objs = [], marks = [], I = (x, y) => y * w + x, inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const stats = { checkpoints: 0, graveyards: 0, fields: 0, lighthouses: 0, hordes: 0 };
  const isWet = k => terr[k] === 'w' || terr[k] === 'S';

  /* 1 · noise fields and ground */
  const fN = noise(sd ^ 0x51), dN = noise(sd ^ 0xa7), kN = noise(sd ^ 0x6b), wN = noise(sd ^ 0x2d), rvN = noise1(sd ^ 0x1f), forest = new Float64Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = I(x, y), f = fN(x / 13, y / 13); forest[k] = f;
    if (dN(x / 9 + 40, y / 9 + 40) > 0.72) terr[k] = 'd';
    else if (f < 0.5 && kN(x / 11 + 7, y / 11 + 3) > 0.74) terr[k] = 'k';
    else if (f > 0.62) terr[k] = 'f';
  }

  /* 2 · water: rivers, lakes, ponds, swamps */
  const blob = (cx, cy, rx, ry, jag, salt, fn) => {
    for (let y = Math.floor(cy - ry) - 2; y <= Math.ceil(cy + ry) + 2; y++) for (let x = Math.floor(cx - rx) - 2; x <= Math.ceil(cx + rx) + 2; x++) {
      if (!inb(x, y)) continue;
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = Math.sqrt(dx * dx + dy * dy) + (wN(x / 5 + salt, y / 5) - 0.5) * jag;
      if (d < 1) fn(I(x, y), d, x, y);
    }
  };
  const rivers = [], lakes = [], swamps = [];
  // v4 rivers: gentler bends (amplitude capped at ~20% of the cross axis, 24 tiles max), and a second river runs the same way
  // as the first, well apart, so rivers never cross each other or cut the map into a grid
  const rvVert = rng() < 0.5;
  if (WO.rivers) for (let n = ri(S.rivers[0], S.rivers[1]), r = 0; r < n; r++) {
    // the centre line is one smooth octave so the banks never step more than a tile or two per row; the channel is a chain of discs
    const vert = rvVert, L = vert ? h : w, A = vert ? w : h, amp = Math.min(A * 0.2, 24), wd = 3 + rng() * 1.2, off = rng() * 90;
    let c0 = A * (0.25 + rng() * 0.5);
    if (rivers.length) { const p = rivers[rivers.length - 1].at; c0 = p < A / 2 ? A * (0.72 + rng() * 0.1) : A * (0.18 + rng() * 0.1); if (Math.abs(c0 - p) < amp * 2 + 8) break; }
    for (let q = -4; q <= L * 2 + 4; q++) {
      const u = q / 2, c = c0 + (rvN(u / 46 + off, r * 7 + 3) - 0.5) * amp, hw = wd / 2 + (wN(u / 6 + off, r * 5 + 11) - 0.5) * 0.8;
      for (let U = Math.floor(u - hw) - 1; U <= Math.ceil(u + hw) + 1; U++) for (let V = Math.floor(c - hw) - 1; V <= Math.ceil(c + hw) + 1; V++) {
        if (U < 0 || V < 0 || U >= L || V >= A) continue;
        const du = U + 0.5 - u, dv = V + 0.5 - c; if (du * du + dv * dv < hw * hw) terr[vert ? I(V, U) : I(U, V)] = 'w';
      }
    }
    rivers.push({ vert, at: Math.round(c0) });
  }
  if (WO.lakes) for (let n = ri(S.lakes[0], S.lakes[1]), i = 0; i < n; i++) for (let t = 0; t < 30; t++) {
    const R = 6 + rng() * 4, m = Math.ceil(R * 1.3) + 5, x = ri(m, w - m - 1), y = ri(m, h - m - 1);
    if (lakes.some(q => hyp(q.x - x, q.y - y) < q.r + R + 8)) continue;
    blob(x, y, R * 1.3, R * 0.9, 0.55, lakes.length * 17 + 5, k => { terr[k] = 'w'; });
    lakes.push({ x, y, r: R, big: R >= 7, pond: false }); break;
  }
  if (WO.ponds) for (let n = ri(S.ponds[0], S.ponds[1]), i = 0; i < n; i++) for (let t = 0; t < 30; t++) {
    const R = 2.2 + rng() * 1.6, x = ri(6, w - 7), y = ri(6, h - 7);
    if (terr[I(x, y)] === 'w' || lakes.some(q => hyp(q.x - x, q.y - y) < q.r + R + 5)) continue;
    blob(x, y, R * 1.2, R * 0.85, 0.4, lakes.length * 17 + 5, k => { terr[k] = 'w'; });
    lakes.push({ x, y, r: R, big: false, pond: true }); break;
  }
  if (WO.swamps) for (let n = ri(S.swamps[0], S.swamps[1]), i = 0; i < n; i++) for (let t = 0; t < 40; t++) {
    const R = 4 + rng() * 3, x = ri(8, w - 9), y = ri(8, h - 9);
    if (terr[I(x, y)] === 'w' || swamps.some(q => hyp(q.x - x, q.y - y) < q.r + R + 6)) continue;
    const salt = 60 + i * 13;
    blob(x, y, R * 1.25, R, 0.6, salt, (k, d, X, Y) => { if (terr[k] !== 'w') terr[k] = d < 0.72 && wN(X / 2.5 + salt, Y / 2.5) > 0.5 ? 'S' : 's'; });
    swamps.push({ x, y, r: R }); break;
  }
  // every water cell must match one of the 13 water/shore tiles; cells that can't are filled in until the shape settles
  const cleanWater = () => {
    for (let pass = 0; pass < 40; pass++) {
      let ch = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (terr[I(x, y)] === 'w' && !shoreKey(terr, w, h, x, y)) { terr[I(x, y)] = 'g'; ch++; }
      if (!ch) break;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (terr[I(x, y)] === 'S' && [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([i, j]) => inb(x + i, y + j) && terr[I(x + i, y + j)] === 'w')) terr[I(x, y)] = 's';
  };
  cleanWater();

  const fpOf = o => o.t === 'gate' ? (o.o === 'h' ? [2, 1] : [1, 2]) : o.t === 'tower' ? [2, 2] : o.t === 'bld' ? FP[o.k] : DFP[o.k] || [1, 1];
  // roof: rows a building sprite rises into (nothing may stand there, it would be hidden); front: two rows before a facade (no tall props)
  const roof = new Uint8Array(N), front = new Uint8Array(N), gpath = new Uint8Array(N);
  const fits = (o, allowRoad) => {
    const [fw, fh] = fpOf(o), tall = o.t === 'tree' && TALL[o.k], aqua = !!ON_WATER[o.k];
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) {
      const x = o.tx + i, y = o.ty + j; if (!inb(x, y)) return false; const k = I(x, y);
      if (block[k] || roof[k] || gpath[k] || (tall && front[k]) || (!allowRoad && terr[k] === 'r') || isWet(k) !== aqua) return false;
    }
    return true;
  };
  const put = o => {
    const [fw, fh] = fpOf(o); for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) block[I(o.tx + i, o.ty + j)] = 1;
    if (o.t === 'bld') { const up = BUP[o.k] ?? 1; for (let i = -1; i <= fw; i++) { for (let j = 1; j <= up; j++) if (i >= 0 && i < fw && inb(o.tx + i, o.ty - j)) roof[I(o.tx + i, o.ty - j)] = 1; for (let j = 0; j < 2; j++) if (inb(o.tx + i, o.ty + fh + j)) front[I(o.tx + i, o.ty + fh + j)] = 1; } }
    objs.push(o); return o;
  };

  /* 3 · starting base: laid out as a walled compound; step 10 turns it into a tent camp */
  const bw = S.bw, bh = S.bh, cx = w / 2, cy = h / 2;
  let x0 = 0, y0 = 0, bestWet = 1e9;
  for (let t = 0; t < 24; t++) {
    let dx = rng() * 2 - 1, dy = rng() * 2 - 1; const l = hyp(dx, dy) || 1; dx /= l; dy /= l;
    const rad = (0.12 + rng() * 0.14) * Math.min(w, h);
    const X0 = Math.round(Math.max(6, Math.min(w - bw - 6, cx + dx * rad - bw / 2))), Y0 = Math.round(Math.max(6, Math.min(h - bh - 6, cy + dy * rad - bh / 2)));
    let n = 0; for (let y = Y0 - 4; y <= Y0 + bh + 4; y++) for (let x = X0 - 4; x <= X0 + bw + 3; x++) if (inb(x, y) && (isWet(I(x, y)) || terr[I(x, y)] === 's')) n++;
    if (n < bestWet) { bestWet = n; x0 = X0; y0 = Y0; }
    if (!n) break;
  }
  const x1 = x0 + bw - 1, y1 = y0 + bh - 1, bcx = (x0 + x1) / 2, bcy = (y0 + y1) / 2;
  if (bestWet) { for (let y = y0 - 4; y <= y1 + 5; y++) for (let x = x0 - 4; x <= x1 + 4; x++) if (inb(x, y) && (isWet(I(x, y)) || terr[I(x, y)] === 's')) terr[I(x, y)] = 'g'; cleanWater(); }
  const ddx = cx - bcx, ddy = cy - bcy, side = Math.abs(ddx) * h > Math.abs(ddy) * w ? (ddx > 0 ? 'e' : 'w') : (ddy > 0 ? 's' : 'n');
  for (let y = y0 - 3; y <= y1 + 4; y++) for (let x = x0 - 3; x <= x1 + 3; x++) if (inb(x, y)) {
    const k = I(x, y); clear[k] = 1; if (terr[k] === 'f' || terr[k] === 'k') terr[k] = 'g';
    if (x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1) keepOut[k] = 1;
  }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { terr[I(x, y)] = 'd'; base[I(x, y)] = 1; }
  const gx = Math.round(bcx) - 1, gy = Math.round(bcy) - 1;
  const gate = side === 'n' ? { t: 'gate', gk: 'wood', o: 'h', open: 0, side: 'e', tx: gx, ty: y0 } : side === 's' ? { t: 'gate', gk: 'wood', o: 'h', open: 0, side: 'e', tx: gx, ty: y1 }
    : side === 'w' ? { t: 'gate', gk: 'wood', o: 'v', open: 0, side: 'e', tx: x0, ty: gy } : { t: 'gate', gk: 'wood', o: 'v', open: 0, side: 'w', tx: x1, ty: gy };
  put(gate);
  for (let d = -4; d <= 4; d++) for (let q = 0; q < 2; q++) { const x = gate.o === 'h' ? gate.tx + q : gate.tx + d, y = gate.o === 'h' ? gate.ty + d : gate.ty + q; if (d && inb(x, y)) gpath[I(x, y)] = 1; }
  for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) { const o = { t: 'wall', mat: 'planks', dmg: 0, tx: x, ty: y }; if (fits(o)) put(o); }
  for (let y = y0 + 1; y < y1; y++) for (const x of [x0, x1]) { const o = { t: 'wall', mat: 'planks', dmg: 0, tx: x, ty: y }; if (fits(o)) put(o); }
  for (const [tx, ty] of [[x0 + 1, y0 + 1], [x1 - 2, y0 + 1], [x0 + 1, y1 - 2], [x1 - 2, y1 - 2]]) put({ t: 'tower', roof: rng() < 0.5 ? 1 : 0, tx, ty });
  const corr = new Set();
  const lx = Math.min(gate.tx, Math.round(bcx) - 1), hx = Math.max(gate.tx + 1, Math.round(bcx)), ly = Math.min(gate.ty, Math.round(bcy) - 1), hy = Math.max(gate.ty + 1, Math.round(bcy));
  for (let y = ly; y <= hy; y++) for (let x = lx; x <= hx; x++) { const k = I(x, y); if (!block[k] && (gate.o === 'h' ? x >= gate.tx && x <= gate.tx + 1 : y >= gate.ty && y <= gate.ty + 1)) { block[k] = 1; corr.add(k); } }
  const gatePt = { x: gate.tx, y: gate.ty };
  const resv = [], reserve = (x, y) => { if (inb(x, y) && !block[I(x, y)]) { block[I(x, y)] = 3; resv.push(I(x, y)); } };
  for (const tx of [x0 + 1, x1 - 2]) for (const y of [y1 - 3, y1 - 4]) for (const x of [tx, tx + 1]) reserve(x, y);
  const inner = (k, far) => {
    const [fw, fh] = FP[k], up = BUP[k] ?? 1; let best = null, bs = 1e9;
    for (let ty = y0 + 1 + up; ty + fh - 1 < y1; ty++) for (let tx = x0 + 1; tx + fw - 1 < x1; tx++) {
      let ok = true; for (let j = -1; j <= fh && ok; j++) for (let i = -1; i <= fw && ok; i++) { const x = tx + i, y = ty + j; if (x <= x0 || x >= x1 || y <= y0 || y >= y1) continue; if (block[I(x, y)]) ok = false; }
      for (let j = -up; j < fh && ok; j++) for (let i = 0; i < fw && ok; i++) if (block[I(tx + i, ty + j)]) ok = false;
      if (!ok) continue;
      const d = hyp(tx + fw / 2 - gatePt.x, ty + fh / 2 - gatePt.y), c = hyp(tx + fw / 2 - bcx, ty + fh / 2 - bcy);
      const sc = (far ? -d : c) + rng() * 3; if (sc < bs) { bs = sc; best = { t: 'bld', k, tx, ty }; }
    }
    if (!best) return null;
    put(best); for (let j = 1; j <= up; j++) for (let i = 0; i < fw; i++) reserve(best.tx + i, best.ty - j);
    return best;
  };
  const starters = size === 'small' ? ['bld_town_hall', 'bld_farm', 'bld_bunkhouse'] : ['bld_town_hall', 'bld_farm', 'bld_storage', 'bld_bunkhouse'];
  starters.forEach((k, i) => { if (!inner(k, i === 0)) inner('bld_shelter', false); });
  corr.forEach(k => { block[k] = 0; });
  const nearBase = [];
  for (let y = y0 + 2; y < y1 - 1; y++) for (let x = x0 + 2; x < x1 - 1; x++) if (!block[I(x, y)] && !corr.has(I(x, y))) nearBase.push([x, y, hyp(x - bcx, y - bcy)]);
  nearBase.sort((a, b) => a[2] - b[2]);
  const fire = nearBase.find(([x, y]) => fits({ t: 'tree', k: 'deco_campfire', tx: x, ty: y }));
  if (fire) {
    put({ t: 'tree', k: 'deco_campfire', tx: fire[0], ty: fire[1] });
    let n = 0; for (const [x, y] of nearBase) { if (n >= 3) break; if (!block[I(x, y)] && hyp(x - fire[0], y - fire[1]) <= 2.5 && (x !== fire[0] || y !== fire[1])) { marks.push({ mk: 'survivor', tx: x, ty: y }); block[I(x, y)] = 2; n++; } }
    marks.forEach(m => { if (block[I(m.tx, m.ty)] === 2) block[I(m.tx, m.ty)] = 0; });
  }
  for (const k of ['deco_crates', 'deco_drum', 'deco_crates']) { for (let t = 0; t < 40; t++) { const o = { t: 'tree', k, tx: ri(x0 + 2, x1 - 2), ty: ri(y0 + 2, y1 - 2) }; if (fits(o) && !corr.has(I(o.tx, o.ty)) && !marks.some(m => m.tx === o.tx && m.ty === o.ty)) { put(o); break; } } }
  resv.forEach(k => { if (block[k] === 3) block[k] = 0; });
  const nearB = (x, y, m = 0) => x >= x0 - 3 - m && x <= x1 + 3 + m && y >= y0 - 3 - m && y <= y1 + 4 + m;
  const gateRoad = side === 'n' ? { x: gate.tx, y: y0 - 3, stub: [[gate.tx, y0 - 2]] } : side === 's' ? { x: gate.tx, y: y1 + 2, stub: [[gate.tx, y1 + 1]] }
    : side === 'w' ? { x: x0 - 3, y: gate.ty, stub: [[x0 - 2, gate.ty]] } : { x: x1 + 2, y: gate.ty, stub: [[x1 + 1, gate.ty]] };

  /* 4 · points of interest, kept on dry land */
  const wetShare = (x, y, r) => { let n = 0, c = 0; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { if (!inb(x + i, y + j)) continue; c++; if (isWet(I(x + i, y + j))) n++; } return n / c; };
  const pois = [], md0 = Math.sqrt(N / (S.pois + 1)) * 0.78, baseR = Math.max(bw, bh) / 2 + 14, M = size === 'small' ? 7 : 9;
  let md = md0;
  for (let t = 0, fail = 0; t < S.pois * 400 && pois.length < S.pois; t++) {
    if (fail > 60) { md *= 0.9; fail = 0; }
    const x = ri(M, w - M - 1), y = ri(M, h - M - 1);
    if (hyp(x - bcx, y - bcy) < Math.min(baseR, md0 * 0.9 + 4) || pois.some(p => hyp(p.x - x, p.y - y) < md) || isWet(I(x, y)) || wetShare(x, y, 4) > 0.12) { fail++; continue; }
    pois.push({ x, y }); fail = 0;
  }
  pois.sort((a, b) => hyp(b.x - bcx, b.y - bcy) - hyp(a.x - bcx, a.y - bcy));
  const types = []; for (let i = 0; i < S.towns; i++) types.push('town'); types.push(...['farm', 'industrial', 'stop'].filter(t => C.types[t]));
  let pool = ['farm', 'gas', 'ruin', 'chapel', 'camp', 'gas', 'ruin', 'industrial', 'stop', 'farm'].filter(t => C.types[t]); if (!pool.length) pool = ['town'];
  while (types.length < pois.length) types.push(pool[Math.floor(rng() * pool.length)]);
  const rest = shuffle(types.slice(S.towns));
  pois.forEach((p, i) => { p.type = i < S.towns ? 'town' : rest[i - S.towns]; p.r = POI_TYPES[p.type].r; p.label = POI_TYPES[p.type].label; p.id = i; p.blds = []; });
  const count = {}; pois.forEach(p => { count[p.type] = (count[p.type] || 0) + 1; p.name = p.label + (types.filter(t => t === p.type).length > 1 ? ' ' + count[p.type] : ''); });

  /* 5 · roads; crossings over water become bridges */
  const wet2 = (x, y) => terr[I(x, y)] === 'w' || terr[I(x + 1, y)] === 'w' || terr[I(x, y + 1)] === 'w' || terr[I(x + 1, y + 1)] === 'w';
  const exits = [];
  const sides = shuffle(['n', 'e', 's', 'w']);
  for (let i = 0; i < S.exits; i++) {
    const s = sides[i % 4], along = () => s === 'n' || s === 's' ? ri(8, w - 10) : ri(8, h - 10);
    let best = null, bd = -1;
    for (let t = 0; t < 12; t++) { const a = along(), p = s === 'n' ? { x: a, y: 0 } : s === 's' ? { x: a, y: h - 2 } : s === 'w' ? { x: 0, y: a } : { x: w - 2, y: a }; if (wet2(p.x, p.y)) continue; const d = hyp(p.x - bcx, p.y - bcy); if (d > bd) { bd = d; best = p; } }
    if (best) { best.exit = true; exits.push(best); }
  }
  const nodes = [{ x: gateRoad.x, y: gateRoad.y, base: true }, ...pois.map(p => ({ x: Math.min(w - 2, p.x), y: Math.min(h - 2, p.y), poi: p })), ...exits];
  const dist = (a, b) => hyp(a.x - b.x, a.y - b.y), edges = [], inT = [0];
  while (inT.length < nodes.length) {
    let best = null, bd = 1e9;
    for (const a of inT) for (let b = 0; b < nodes.length; b++) if (!inT.includes(b) && !(nodes[a].exit && nodes[b].exit)) { const d = dist(nodes[a], nodes[b]); if (d < bd) { bd = d; best = [a, b]; } }
    if (!best) break; inT.push(best[1]); edges.push(best);
  }
  const has = (a, b) => edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
  let loops = Math.floor(nodes.length / 4);
  const cand = []; for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) if (!has(a, b) && !nodes[a].exit && !nodes[b].exit) cand.push([dist(nodes[a], nodes[b]), a, b]);
  cand.sort((p, q) => p[0] - q[0]);
  for (const [d, a, b] of cand) { if (loops <= 0) break; if (d < md * 1.6 && rng() < 0.6) { edges.push([a, b]); loops--; } }
  edges.sort((p, q) => dist(nodes[p[0]], nodes[p[1]]) - dist(nodes[q[0]], nodes[q[1]]));

  const RW = w - 1, RH = h - 1, D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const cost = (x, y) => {
    let r = 0, f = 0, wc = 0, mud = 0;
    for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const k = I(x + i, y + j); if (keepOut[k] || terr[k] === 'S') return Infinity; if (terr[k] === 'r') r++; else if (terr[k] === 'w') wc++; else if (terr[k] === 's') mud++; f += forest[k]; }
    if (wc) return wc === 4 ? 7 : 11;
    return r === 4 ? 0.35 : 1 + Math.max(0, f / 4 - 0.4) * 5 + mud * 0.5;
  };
  // A* over (tile, heading); turning is not allowed on or onto water, so every crossing is a straight bridge
  const route = (s, t) => {
    const n = RW * RH * 4, g = new Float64Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), H = Heap();
    for (let d = 0; d < 4; d++) { const k = (s.y * RW + s.x) * 4 + d; g[k] = 0; H.push(0, k); }
    let end = -1;
    while (H.size) {
      const k = H.pop(), c = k >> 2, d = k & 3, x = c % RW, y = (c / RW) | 0;
      if (x === t.x && y === t.y) { end = k; break; }
      const gk = g[k], here = wet2(x, y);
      for (let nd = 0; nd < 4; nd++) {
        if (nd === ((d + 2) & 3)) continue;
        const nx = x + D4[nd][0], ny = y + D4[nd][1]; if (nx < 0 || ny < 0 || nx >= RW || ny >= RH) continue;
        if (nd !== d && (here || wet2(nx, ny))) continue;
        const cc = cost(nx, ny); if (cc === Infinity) continue;
        const ng = gk + cc + (nd !== d ? 3 : 0), nk = (ny * RW + nx) * 4 + nd;
        if (ng < g[nk]) { g[nk] = ng; from[nk] = k; H.push(ng + (Math.abs(nx - t.x) + Math.abs(ny - t.y)) * 0.5, nk); }
      }
    }
    if (end < 0) return null;
    const path = []; for (let k = end; k >= 0; k = from[k]) { const c = k >> 2; path.push([c % RW, (c / RW) | 0]); if (g[k] === 0) break; }
    return path.reverse();
  };
  // 1 = E–W bridge deck, 2 = N–S deck. The bridge takes the lower lane of an E–W road and the left lane of a N–S road.
  const bridgeAt = new Uint8Array(N);
  const stamp = (x, y, hz) => { for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const X = x + i, Y = y + j; if (!inb(X, Y)) continue; const k = I(X, Y); if (terr[k] === 'w') { if ((hz ? j === 1 : i === 0) && !bridgeAt[k]) bridgeAt[k] = hz ? 1 : 2; } else terr[k] = 'r'; } };
  gateRoad.stub.forEach(([x, y]) => stamp(x, y, side === 'e' || side === 'w')); stamp(gateRoad.x, gateRoad.y, side === 'e' || side === 'w');
  const paths = [];
  for (const [a, b] of edges) {
    const p = route(nodes[a], nodes[b]); if (!p) continue;
    for (let i = 0; i < p.length; i++) { const q = p[i > 0 ? i - 1 : Math.min(1, p.length - 1)]; stamp(p[i][0], p[i][1], q[1] === p[i][1]); }
    paths.push(p);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = I(x, y), b = bridgeAt[k]; if (!b) continue;
    let key;
    if (b === 1) { const W_ = x > 0 && bridgeAt[k - 1] === 1, E_ = x < w - 1 && bridgeAt[k + 1] === 1; key = 'bridge_h_' + (W_ === E_ ? 'm' : !W_ ? 'w' : 'e'); }
    else { const N_ = y > 0 && bridgeAt[k - w] === 2, S_ = y < h - 1 && bridgeAt[k + w] === 2; key = 'bridge_v_' + (N_ === S_ ? 'm' : !N_ ? 'n' : 's'); }
    put({ t: 'bridge', k: key, tx: x, ty: y });
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (terr[I(x, y)] === 'r' || bridgeAt[I(x, y)]) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (inb(x + i, y + j)) clear[I(x + i, y + j)] = 1;

  /* 6 · POI buildings, yards, fields, landmarks and decor */
  const roadAt = (x, y) => inb(x, y) && terr[I(x, y)] === 'r';
  const placeBld = (k, p) => {
    const [fw, fh] = FP[k], R = p.r; let best = null, bs = 1e9;
    for (let ty = p.y - R; ty <= p.y + R; ty++) for (let tx = p.x - R; tx <= p.x + R; tx++) {
      if (tx < 2 || ty < 3 || tx + fw > w - 2 || ty + fh > h - 2) continue;
      let ok = true;
      for (let j = -1; j <= fh && ok; j++) for (let i = -1; i <= fw && ok; i++) { const q = I(tx + i, ty + j); if (block[q] || keepOut[q] || terr[q] === 'r' || isWet(q) || nearB(tx + i, ty + j, 3) || (j >= 0 && j < fh && i >= 0 && i < fw && roof[q])) ok = false; }
      for (let j = 1, up = BUP[k] ?? 1; j <= up && ok; j++) for (let i = 0; i < fw && ok; i++) if (block[I(tx + i, ty - j)]) ok = false;
      if (!ok) continue;
      let rd = 0; for (let d = 2; d <= 4 && !rd; d++) for (let i = 0; i < fw; i++) if (roadAt(tx + i, ty + fh - 1 + d)) { rd = d; break; }
      const sc = hyp(tx + fw / 2 - p.x, ty + fh / 2 - p.y) * 0.6 + (rd ? rd * 1.5 : 12) + rng() * 3;
      if (sc < bs) { bs = sc; best = { tx, ty, rd }; }
    }
    if (!best) return null;
    const o = put({ t: 'bld', k, tx: best.tx, ty: best.ty }); p.blds.push(o);
    for (let j = 0; j <= fh; j++) for (let i = -1; i <= fw; i++) { const x = best.tx + i, y = best.ty + j; if (inb(x, y) && terr[I(x, y)] !== 'r' && !isWet(I(x, y)) && !base[I(x, y)]) { terr[I(x, y)] = 'd'; clear[I(x, y)] = 1; } }
    if (best.rd) { const px = best.tx + (fw >> 1); for (let y = best.ty + fh; y < best.ty + fh - 1 + best.rd; y++) for (const x of [px - 1, px]) if (inb(x, y) && terr[I(x, y)] !== 'r' && !isWet(I(x, y))) { terr[I(x, y)] = 'd'; clear[I(x, y)] = 1; } }
    return o;
  };
  const BAG = {
    town: () => { const b = shuffle(['wld_house', 'wld_house', 'wld_house', 'wld_trailer', 'wld_trailer', 'wld_gas_station', 'wld_chapel', 'wld_water_tower', 'wld_shed', 'wld_burnt_house', 'wld_burnt_house']); const out = b.slice(0, ri(6, 8)); if (rng() < 0.35) out.push('wld_motel'); if (rng() < 0.7) out.push('wld_bus_shelter'); if (rng() < 0.3) out.push('wld_billboard'); return out; },
    farm: () => ['wld_barn', 'wld_house', 'wld_shed', ...(rng() < 0.5 ? ['wld_water_tower'] : []), ...(rng() < 0.6 ? ['wld_silo'] : []), ...(rng() < 0.4 ? ['wld_stables'] : []), ...(rng() < 0.4 ? ['wld_windmill'] : []), ...(rng() < 0.3 ? ['wld_grain_elevator'] : [])],
    industrial: () => [rng() < 0.55 ? 'wld_factory' : 'wld_warehouse', ...(rng() < 0.5 ? ['wld_warehouse'] : []), 'wld_substation', ...(rng() < 0.4 ? ['wld_shed'] : [])],
    stop: () => ['wld_truck_stop', 'wld_billboard', ...(rng() < 0.5 ? ['wld_bus_shelter'] : []), ...(rng() < 0.4 ? ['wld_trailer'] : [])],
    wild: () => [],
    gas: () => ['wld_gas_station', ...(rng() < 0.4 ? ['wld_motel'] : rng() < 0.5 ? ['wld_trailer'] : []), ...(rng() < 0.4 ? ['wld_shed'] : [])],
    ruin: () => ['wld_burnt_house', 'wld_burnt_house', ...(rng() < 0.5 ? ['wld_shed'] : [])],
    chapel: () => ['wld_chapel', 'wld_house', ...(rng() < 0.5 ? ['wld_shed'] : [])],
    camp: () => []
  };
  const area = k => FP[k][0] * FP[k][1];
  for (const p of pois) BAG[p.type]().sort((a, b) => area(b) - area(a)).forEach(k => placeBld(k, p));
  const bldFits = (k, tx, ty) => {
    const [fw, fh] = FP[k]; if (tx < 2 || ty < 3 || tx + fw > w - 2 || ty + fh > h - 2) return false;
    for (let j = -1; j <= fh; j++) for (let i = -1; i <= fw; i++) { const q = I(tx + i, ty + j); if (block[q] || keepOut[q] || terr[q] === 'r' || terr[q] === 'a' || isWet(q) || nearB(tx + i, ty + j, 3) || (j >= 0 && j < fh && i >= 0 && i < fw && roof[q])) return false; }
    for (let j = 1, up = BUP[k] ?? 1; j <= up; j++) for (let i = 0; i < fw; i++) if (block[I(tx + i, ty - j)]) return false;
    for (let j = fh; j <= fh + 1; j++) for (let i = -1; i <= fw; i++) { const q = I(tx + i, ty + j); if (inb(tx + i, ty + j) && block[q] && objs.some(o => o.t === 'tree' && TALL[o.k] && o.tx <= tx + i && tx + i < o.tx + fpOf(o)[0] && o.ty === ty + j)) return false; }
    return true;
  };
  // parking lots in front of the main building of industrial yards and truck stops
  const lots = [];
  for (const p of pois) {
    if (p.type !== 'industrial' && p.type !== 'stop') continue;
    const b = p.blds[0]; if (!b) continue;
    const [fw, fh] = FP[b.k], lx0 = b.tx - 1, lx1 = b.tx + fw, ly0 = b.ty + fh, ly1 = ly0 + 2; let n = 0;
    for (let y = ly0; y <= ly1; y++) for (let x = lx0; x <= lx1; x++) { if (!inb(x, y)) continue; const q = I(x, y); if (terr[q] === 'r' || isWet(q) || base[q] || block[q] || keepOut[q]) continue; terr[q] = 'L'; clear[q] = 1; n++; }
    if (n) lots.push({ x0: lx0, y0: ly0, x1: lx1, y1: ly1, p });
    if (p.type === 'stop') { const up = BUP[b.k] ?? 1, wy = b.ty - up - 1; for (let x = b.tx - 1; x <= b.tx + fw; x++) { const o = { t: 'tree', k: x === b.tx - 1 || x === b.tx + fw ? 'str_wall_brick_post' : 'str_wall_brick_h', tx: x, ty: wy }; if (inb(x, wy) && fits(o) && !keepOut[I(x, wy)] && !nearB(x, wy)) put(o); } }
  }
  // a rail spur from each industrial yard to the nearer east or west map edge; road crossings become level crossings
  stats.rail = 0;
  for (const p of pois) {
    if (p.type !== 'industrial' || !p.blds.length) continue;
    if (!C.rail) continue;
    let by1 = 0; for (const b of p.blds) by1 = Math.max(by1, b.ty + FP[b.k][1]);
    const lt = lots.find(l => l.p === p); if (lt) by1 = Math.max(by1, lt.y1 + 1);
    const dir = p.x < w / 2 ? -1 : 1; let best = null;
    for (const yr of [by1 + 1, by1 + 2, by1 + 3, p.y - p.r - 1]) {
      if (yr < 3 || yr > h - 3) continue;
      let start = -1, end = -1, edge = false, rd = 0;
      for (let x = p.x; x >= 0 && x < w; x += dir) {
        const q = I(x, yr), free = !block[q] && !keepOut[q] && !isWet(q) && !nearB(x, yr, 2) && !base[q] && !roof[q];
        rd = terr[q] === 'r' || terr[q] === 'a' ? rd + 1 : 0;
        if (start < 0) { if (free && !rd) start = x; continue; }
        if (!free || rd > 2) break; end = x; if (x === 0 || x === w - 1) edge = true;
      }
      if (start < 0 || end < 0) continue;
      while (end !== start && (terr[I(end, yr)] === 'r' || terr[I(end, yr)] === 'a')) { end -= dir; edge = false; }
      const len = Math.abs(end - start) + 1, sc = len + (edge ? 60 : 0);
      if (len >= 10 && (!best || sc > best.sc)) best = { yr, start, end, edge, sc };
    }
    if (!best) continue;
    const { yr, start, end, edge } = best, a = Math.min(start, end), z = Math.max(start, end);
    for (let x = a; x <= z; x++) { const q = I(x, yr); terr[q] = terr[q] === 'r' || terr[q] === 'a' ? 'x' : 'q'; block[q] = 4; for (const j of [-1, 0, 1]) if (inb(x, yr + j)) clear[I(x, yr + j)] = 1; }
    for (let x = a; x <= z; x++) if (terr[I(x, yr)] === 'x') {
      const prev = x > a && terr[I(x - 1, yr)] === 'x', next = x < z && terr[I(x + 1, yr)] === 'x';
      const sp = !prev ? [x - 1, yr - 1] : !next ? [x + 1, yr + 1] : null;
      if (sp && inb(sp[0], sp[1])) { const o = { t: 'tree', k: 'str_rail_signal', tx: sp[0], ty: sp[1] }; if (fits(o) && !keepOut[I(sp[0], sp[1])]) put(o); }
    }
    const ends = edge ? [start] : [start, end];
    for (const ex of ends) { const q = I(ex, yr); if (terr[q] === 'q') { block[q] = 0; put({ t: 'tree', k: 'str_rail_buffer', tx: ex, ty: yr }); } }
    p.rail = { y: yr, x0: a, x1: z }; stats.rail++;
  }
  // chain-link fence round each industrial yard, open at the middle of the south side
  for (const p of pois) {
    if (p.type !== 'industrial' || !p.blds.length) continue;
    let fx0 = w, fy0 = h, fx1 = 0, fy1 = 0;
    for (const b of p.blds) { const [fw, fh] = FP[b.k], up = BUP[b.k] ?? 1; fx0 = Math.min(fx0, b.tx - 2); fx1 = Math.max(fx1, b.tx + fw + 1); fy0 = Math.min(fy0, b.ty - up - 1); fy1 = Math.max(fy1, b.ty + fh + 1); }
    const lt = lots.find(l => l.p === p); if (lt) fy1 = Math.max(fy1, lt.y1 + 1);
    const gm = (fx0 + fx1) >> 1;
    const fence = (k, x, y) => { if (!inb(x, y)) return; const o = { t: 'tree', k, tx: x, ty: y }; if (fits(o) && !keepOut[I(x, y)] && !nearB(x, y) && terr[I(x, y)] !== 'L') put(o); };
    for (let x = fx0; x <= fx1; x++) for (const y of [fy0, fy1]) { if (y === fy1 && (x === gm || x === gm + 1)) continue; fence(x === fx0 || x === fx1 ? 'str_fence_chain_post' : 'str_fence_chain_h', x, y); }
    for (let y = fy0 + 1; y < fy1; y++) for (const x of [fx0, fx1]) fence('str_fence_chain_v', x, y);
  }
  // ranger posts: a cabin and usually a fire lookout in a forest clearing, off the road network
  for (let t = 0, c = 0; t < 400 && c < S.wild; t++) {
    const x = ri(8, w - 9), y = ri(8, h - 9), k = I(x, y);
    if (forest[k] < 0.62 || isWet(k) || block[k] || keepOut[k] || terr[k] === 'r' || hyp(x - bcx, y - bcy) < baseR + 10 || pois.some(p => hyp(p.x - x, p.y - y) < p.r + 8) || wetShare(x, y, 4) > 0.1) continue;
    const p = { x, y, r: POI_TYPES.wild.r, type: 'wild', label: POI_TYPES.wild.label, id: pois.length, blds: [] };
    if (!placeBld('wld_cabin', p)) continue;
    if (rng() < 0.75) placeBld('wld_fire_lookout', p);
    c++; p.name = p.label + (S.wild > 1 ? ' ' + c : ''); pois.push(p);
    for (let j = -p.r; j <= p.r; j++) for (let i = -p.r; i <= p.r; i++) if (inb(x + i, y + j) && hyp(i, j) <= p.r) { const q = I(x + i, y + j); clear[q] = 1; if (terr[q] === 'f') terr[q] = 'g'; }
  }
  // one fenced field per farmstead: wheat, or tilled rows of corn
  const field = new Uint8Array(N);
  for (const p of pois) {
    if (p.type !== 'farm' || !C.fields) continue;
    const wheat = rng() < 0.5, fw = ri(6, 9), fh = ri(4, 5); let at = null;
    for (let t = 0; t < 60 && !at; t++) {
      const fx = p.x + ri(-p.r - 4, p.r + 4 - fw), fy = p.y + ri(-p.r - 3, p.r + 3 - fh); let ok = true;
      for (let j = -1; j <= fh && ok; j++) for (let i = -1; i <= fw && ok; i++) {
        const X = fx + i, Y = fy + j; if (X < 1 || Y < 2 || X > w - 2 || Y > h - 2) { ok = false; break; }
        const q = I(X, Y); if (block[q] || roof[q] || front[q] || keepOut[q] || gpath[q] || isWet(q) || terr[q] === 'r' || nearB(X, Y, 2)) ok = false;
      }
      if (ok) at = [fx, fy];
    }
    if (!at) continue;
    const [fx, fy] = at, gate0 = (fw >> 1) - 1;
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) { const q = I(fx + i, fy + j); terr[q] = wheat ? 'h' : 't'; field[q] = 1; block[q] = 4; if (!wheat && j % 2 === 0) put({ t: 'tree', k: 'deco_corn', tx: fx + i, ty: fy + j }); }
    for (let i = -1; i <= fw; i++) for (const j of [-1, fh]) { if (j === fh && (i === gate0 || i === gate0 + 1)) continue; put({ t: 'tree', k: i === -1 || i === fw ? 'fence_rail_post' : 'fence_rail_h', tx: fx + i, ty: fy + j }); }
    for (let j = 0; j < fh; j++) for (const i of [-1, fw]) put({ t: 'tree', k: 'fence_rail_v', tx: fx + i, ty: fy + j });
    for (let j = -2; j <= fh + 1; j++) for (let i = -2; i <= fw + 1; i++) if (inb(fx + i, fy + j)) clear[I(fx + i, fy + j)] = 1;
    p.field = { x: fx, y: fy, w: fw, h: fh, crop: wheat ? 'wheat' : 'corn' }; stats.fields++;
  }
  // a lighthouse on the shore of each big lake
  if (WO.lighthouse) for (const L of lakes) {
    if (!L.big) continue;
    let best = null, bs = 1e9;
    for (let ty = Math.floor(L.y - L.r * 1.4) - 3; ty <= Math.ceil(L.y + L.r * 1.4) + 3; ty++) for (let tx = Math.floor(L.x - L.r * 1.7) - 3; tx <= Math.ceil(L.x + L.r * 1.7) + 3; tx++) {
      if (tx < 1 || ty < 5 || tx + 2 > w - 1 || ty + 2 > h - 1) continue;
      let ok = true, shore = false;
      for (let j = 0; j < 2 && ok; j++) for (let i = 0; i < 2 && ok; i++) {
        const X = tx + i, Y = ty + j, q = I(X, Y);
        if (block[q] || roof[q] || keepOut[q] || isWet(q) || terr[q] === 'r' || nearB(X, Y, 2)) ok = false;
        for (const [a, b] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) if (inb(X + a, Y + b) && terr[I(X + a, Y + b)] === 'w') shore = true;
      }
      for (let j = 1; j <= 4 && ok; j++) for (let i = 0; i < 2; i++) if (block[I(tx + i, ty - j)]) ok = false;
      if (!ok || !shore) continue;
      const sc = hyp(tx + 1 - L.x, ty + 1 - L.y) + hh(tx, ty, sd) * 2;
      if (sc < bs) { bs = sc; best = [tx, ty]; }
    }
    if (!best) continue;
    put({ t: 'bld', k: 'wld_lighthouse', tx: best[0], ty: best[1] }); L.lighthouse = [best[0], best[1]]; stats.lighthouses++;
    for (let j = -2; j <= 3; j++) for (let i = -2; i <= 3; i++) if (inb(best[0] + i, best[1] + j)) clear[I(best[0] + i, best[1] + j)] = 1;
  }
  // boathouses on the shore: the footprint's bottom row faces open water, with a short dock running out from it
  const docks = [];
  for (let t = 0; t < 1500 && docks.length < S.docks; t++) {
    const tx = ri(3, w - 6), ty = ri(5, h - 7);
    let ok = true;
    for (let j = 0; j < 3 && ok; j++) for (let i = -1; i <= 3 && ok; i++) { const q = I(tx + i, ty + j); if (block[q] || roof[q] || keepOut[q] || isWet(q) || terr[q] === 'r' || terr[q] === 'a' || nearB(tx + i, ty + j, 3)) ok = false; }
    for (let i = 0; i < 3 && ok; i++) { if (terr[I(tx + i, ty + 3)] !== 'w' || terr[I(tx + i, ty + 4)] !== 'w' || block[I(tx + i, ty + 3)]) ok = false; }
    if (ok && block[I(tx, ty - 1)] + block[I(tx + 1, ty - 1)] + block[I(tx + 2, ty - 1)]) ok = false;
    if (!ok || docks.some(d => hyp(d.tx - tx, d.ty - ty) < 30) || lakes.some(l => l.lighthouse && hyp(l.lighthouse[0] - tx, l.lighthouse[1] - ty) < 8)) continue;
    const o = put({ t: 'bld', k: 'wld_boathouse', tx, ty }); docks.push(o);
    for (let dy = 3; dy <= 4; dy++) { const d = { t: 'tree', k: 'str_dock', tx: tx + 2, ty: ty + dy }; if (fits(d)) put(d); }
    for (let j = -2; j <= 3; j++) for (let i = -2; i <= 4; i++) if (inb(tx + i, ty + j)) clear[I(tx + i, ty + j)] = 1;
  }
  stats.boathouses = docks.length;
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
  for (const p of pois) for (const [k, n] of DECOR[p.type]) for (let i = 0, nn = Math.round(n * C.decor); i < nn; i++) placeDecor(k, p);
  for (const p of pois) {
    const ch = p.blds.find(b => b.k === 'wld_chapel'); if (!ch || !C.graveyards) continue;
    let done = false;
    for (const [ox, oy] of shuffle([[-9, 0], [4, 0], [-9, 3], [4, 3], [-3, 4], [-3, -6]])) {
      const gx0 = ch.tx + ox, gy0 = ch.ty + oy, cells = [];
      for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) cells.push([gx0 + i * 2, gy0 + j * 2]);
      if (!cells.every(([x, y]) => inb(x, y) && !block[I(x, y)] && !roof[I(x, y)] && !keepOut[I(x, y)] && !isWet(I(x, y)) && !nearB(x, y, 1) && terr[I(x, y)] !== 'r')) continue;
      cells.forEach(([x, y]) => { if (rng() < 0.85) put({ t: 'tree', k: rng() < 0.55 ? 'deco_tombstone' : 'deco_grave_cross', tx: x, ty: y }); });
      for (let y = gy0 - 1; y <= gy0 + 5; y++) for (let x = gx0 - 1; x <= gx0 + 7; x++) if (inb(x, y)) clear[I(x, y)] = 1;
      done = true; break;
    }
    stats.graveyards += done ? 1 : 0;
  }
  for (const p of pois) for (let y = p.y - p.r; y <= p.y + p.r; y++) for (let x = p.x - p.r; x <= p.x + p.r; x++) if (inb(x, y) && hyp(x - p.x, y - p.y) < p.r * 0.75) clear[I(x, y)] = 1;

  /* roadside: utility poles, streetlights in towns, wrecks, checkpoints, vignettes, signs */
  const inTown = (x, y) => pois.some(p => (p.type === 'town' || p.type === 'gas') && hyp(x - p.x, y - p.y) <= p.r + 2);
  for (const path of C.roadside ? paths : []) for (let i = 4; i < path.length - 1; i += 9) {
    const [x, y] = path[i], [, py] = path[i - 1], hz = py === y;
    for (const [cx2, cy2] of hz ? [[x, y - 1], [x, y + 2]] : [[x - 1, y], [x + 2, y]]) {
      const k = inTown(cx2, cy2) ? 'deco_streetlight' : 'deco_pole', o = { t: 'tree', k, tx: cx2, ty: cy2 };
      if (fits(o) && !keepOut[I(cx2, cy2)] && !nearB(cx2, cy2)) { put(o); break; }
    }
  }
  const roadCells = []; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 2; x++) if (terr[I(x, y)] === 'r' && terr[I(x + 1, y)] === 'r' && !keepOut[I(x, y)]) roadCells.push([x, y]);
  const wreck = (k, n) => { for (let t = 0, c = 0; t < n * 30 && c < n; t++) { const [x, y] = roadCells[Math.floor(rng() * roadCells.length)]; const o = { t: 'tree', k, tx: x, ty: y }; if (nearB(x, y, 2) || nearB(x + 1, y, 2)) continue; if (fits(o, true) && terr[I(x, y)] === 'r' && terr[I(x + 1, y)] === 'r') { put(o); c++; } } };
  if (roadCells.length) { wreck('deco_car', S.cars); wreck('deco_barrier', Math.ceil(S.cars / 3)); wreck('deco_bus', S.cars ? Math.max(1, Math.round(S.cars / 5)) : 0); }
  const near = (k, cx0, cy0, rr, allowRoad) => { for (let t = 0; t < 30; t++) { const o = { t: 'tree', k, tx: cx0 + ri(-rr, rr), ty: cy0 + ri(-rr, rr) }; if (fits(o, allowRoad) && !keepOut[I(o.tx, o.ty)] && !nearB(o.tx, o.ty) && (!allowRoad || terr[I(o.tx, o.ty)] === 'r')) return put(o); } return null; };
  const longPaths = paths.filter(p => p.length > 12);
  for (let i = 0, t = 0; i < Math.round(Math.ceil(S.pois / 4) * C.checkpoints) && longPaths.length && t < 30; t++) {
    const path = longPaths[Math.floor(rng() * longPaths.length)], [x, y] = path[Math.floor(path.length * (0.3 + rng() * 0.4))];
    if (hyp(x - bcx, y - bcy) < baseR || pois.some(p => hyp(p.x - x, p.y - y) < p.r + 3) || wet2(x, y)) continue;
    near('deco_police_car', x, y, 2, true); near('deco_barrier', x, y, 2, true); near('deco_barrier', x, y, 3, true);
    for (const k of ['deco_sandbags', 'deco_sandbags', 'deco_wire', 'deco_wire', 'deco_skeleton', 'deco_blood', 'deco_backpack', 'deco_drum']) near(k, x, y, 4, false);
    stats.checkpoints++; i++;
  }
  const VIG = [['deco_skeleton', 'deco_backpack', 'deco_blood'], ['deco_tent', 'deco_campfire', 'deco_backpack', 'deco_logs'], ['deco_bicycle', 'deco_skeleton', 'deco_blood'], ['deco_car', 'deco_tires', 'deco_drum', 'deco_blood']];
  const nVig = Math.round(N / 1400 * C.vignettes);
  for (let t = 0, c = 0; t < nVig * 40 && c < nVig; t++) {
    const x = ri(4, w - 5), y = ri(4, h - 5), k = I(x, y);
    if (terr[k] === 'r' || isWet(k) || block[k] || keepOut[k] || clear[k] || forest[k] > 0.6 || hyp(x - bcx, y - bcy) < baseR + 4) continue;
    VIG[Math.floor(rng() * VIG.length)].forEach(key => near(key, x, y, 2, false)); c++;
  }
  // power pylons along long country roads, and billboards facing the road
  stats.pylons = 0;
  for (const path of longPaths) {
    if (path.length < 30 || !C.pylons) continue;
    for (let i = 8; i < path.length - 4; i += 12) {
      const [x, y] = path[i], [, py] = path[i - 1], hz = py === y;
      for (const [cx2, cy2] of hz ? [[x, y - 3], [x, y + 4]] : [[x - 4, y], [x + 4, y]]) {
        if (!inb(cx2 + 1, cy2) || inTown(cx2, cy2) || hyp(cx2 - bcx, cy2 - bcy) < baseR) continue;
        const o = { t: 'tree', k: 'str_pylon', tx: cx2, ty: cy2 };
        if (fits(o) && !keepOut[I(cx2, cy2)] && !keepOut[I(cx2 + 1, cy2)] && !nearB(cx2, cy2) && !nearB(cx2 + 1, cy2)) { put(o); stats.pylons++; break; }
      }
    }
  }
  for (let t = 0, c = 0; t < 300 && c < (C.roadside ? Math.ceil(S.pois / 4) : 0) && roadCells.length; t++) {
    const [x, y] = roadCells[Math.floor(rng() * roadCells.length)];
    if (inTown(x, y) || hyp(x - bcx, y - bcy) < baseR + 4) continue;
    for (const [tx, ty] of [[x - 1, y - 2], [x - 1, y + 3]]) if (bldFits('wld_billboard', tx, ty)) { put({ t: 'bld', k: 'wld_billboard', tx, ty }); for (let i = -1; i <= 3; i++) for (let j = -2; j <= 1; j++) if (inb(tx + i, ty + j)) clear[I(tx + i, ty + j)] = 1; c++; break; }
  }
  const signs = C.roadside ? Math.ceil(S.pois / 3) : 0;
  for (let t = 0, c = 0; t < 200 && c < signs; t++) { const x = ri(2, w - 3), y = ri(2, h - 3), k = I(x, y); if (terr[k] !== 'r' && !isWet(k) && !block[k] && !roof[k] && !front[k] && !keepOut[k] && !nearB(x, y) && (roadAt(x + 1, y) || roadAt(x - 1, y) || roadAt(x, y + 1) || roadAt(x, y - 1))) { put({ t: 'tree', k: 'deco_sign', tx: x, ty: y }); c++; } }

  /* 7 · foliage */
  const TR = (v, r) => r < 0.45 ? (v > 0.5 ? 'tree_pine' : 'tree_oak') : r < 0.52 ? 'nat_s2_birch' : r < 0.6 ? 'tree_dead' : r < 0.66 ? 'nat_s2_sapling' : r < 0.8 ? 'bush' : r < 0.86 ? 'nat_s2_bramble' : r < 0.9 ? 'nat_s2_apple' : 'stump';
  const vN = noise(sd ^ 0x3c), T = C.trees, Rk = C.rocks, Sc = C.scatter, Wl = C.water;
  for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) {
    const k = I(x, y); if (block[k] || roof[k] || front[k] || clear[k] || keepOut[k] || terr[k] === 'r' || isWet(k)) continue;
    const f = forest[k], r = rng(), v = vN(x / 20, y / 20); let key = null;
    if (f > 0.6) { if (r < 0.5 * T) key = rng() < 0.9 ? (v > 0.45 ? 'tree_pine' : rng() < 0.3 ? 'nat_s2_birch' : 'tree_oak') : 'tree_dead'; else if (r < 0.56 * T) key = 'bush'; }
    else if (f > 0.52) { if (r < 0.14 * T) key = TR(v, rng()); }
    else if (terr[k] === 'k') { if (r < 0.05 * Rk) key = 'deco_boulder'; else if (r < 0.07 * Rk) key = 'nat_s2_outcrop'; }
    else if (r < 0.012 * T) key = TR(v, rng()); else if (r < (T === 1 && Rk === 1 ? 0.016 : 0.012 * T + 0.004 * Rk)) key = 'deco_boulder';
    if (key && DFP[key] && (x + 1 >= w || clear[k + 1] || keepOut[k + 1])) key = null;
    if (key) { const o = { t: 'tree', k: key, tx: x, ty: y }; if (fits(o)) put(o); }
  }
  for (let y = 1; y < h; y++) for (let x = 0; x < w - 1; x++) {
    const k = I(x, y); if (block[k] || keepOut[k] || terr[k] === 'r' || base[k] || isWet(k)) continue;
    const f = forest[k], r = rng(); let key = null;
    if (f > 0.55) { if (r < 0.025 * Sc) key = 'deco_mushrooms'; else if (r < 0.045 * Sc) key = 'deco_leaves'; else if (r < 0.06 * Sc) key = 'deco_fallen_log'; else if (r < 0.075 * Sc) key = 'nat_s2_fern'; }
    else if (terr[k] === 'g') { if (r < 0.03 * Sc) key = 'deco_tuft'; else if (r < 0.042 * Sc && vN(x / 8, y / 8) > 0.5) key = 'deco_flowers'; else if (r < 0.05 * Sc) key = 'deco_pebbles'; }
    else if (r < 0.03 * Sc) key = 'deco_pebbles';
    if (key === 'deco_fallen_log' && (nearB(x, y) || nearB(x + 1, y))) key = null;
    if (key && fits({ t: 'tree', k: key, tx: x, ty: y })) put({ t: 'tree', k: key, tx: x, ty: y });
  }
  // waterside and swamp life
  const byWater = (x, y) => [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([i, j]) => inb(x + i, y + j) && terr[I(x + i, y + j)] === 'w');
  for (let y = 1; y < h; y++) for (let x = 0; x < w - 1; x++) {
    const k = I(x, y); if (block[k] || keepOut[k] || base[k] || field[k] || nearB(x, y) || nearB(x + 1, y)) continue;
    const t = terr[k]; let key = null;
    if (t === 'w') { if (rng() < 0.035 * Wl && shoreKey(terr, w, h, x, y) === 'water_a') key = 'nat_s2_lilypads'; }
    else if (t === 's') { const r = rng(); key = r < 0.07 * Wl ? 'nat_s2_cattails' : r < 0.1 * Wl ? 'tree_dead' : r < 0.12 * Wl ? 'nat_s2_bramble' : null; }
    else if (t !== 'r' && t !== 'S' && byWater(x, y)) { const r = rng(); key = r < 0.09 * Wl ? 'nat_s2_cattails' : r < 0.12 * Wl ? 'nat_s2_driftwood' : r < 0.15 * Wl ? 'nat_s2_willow' : null; }
    if (key) { const o = { t: 'tree', k: key, tx: x, ty: y }; if (fits(o)) put(o); }
  }

  /* 8 · zombie spawns */
  const zOk = (x, y) => inb(x, y) && !block[I(x, y)] && !keepOut[I(x, y)] && !isWet(I(x, y)) && hyp(x - bcx, y - bcy) > baseR + 8 && !marks.some(m => m.tx === x && m.ty === y);
  for (const p of pois) { const n = Math.round((p.type === 'town' ? 3 : 1) * C.zombies); for (let t = 0, c = 0; t < 60 && c < n; t++) { const x = p.x + ri(-p.r, p.r), y = p.y + ri(-p.r, p.r); if (zOk(x, y)) { marks.push({ mk: 'zombie', tx: x, ty: y }); c++; } } }
  for (let t = 0, c = 0; t < S.edgeZ * 40 && c < S.edgeZ; t++) { const s = ri(0, 3), a = rng(), x = s === 1 ? w - 2 : s === 3 ? 1 : Math.round(1 + a * (w - 3)), y = s === 0 ? 1 : s === 2 ? h - 2 : Math.round(1 + a * (h - 3)); if (zOk(x, y)) { marks.push({ mk: 'zombie', tx: x, ty: y }); c++; } }
  // hordes: tight packs of 4-6 spawns out in the open, well away from the camp and from each other
  const hordes = [];
  for (let t = 0; t < C.hordes * 60 && hordes.length < C.hordes; t++) {
    const x = ri(4, w - 5), y = ri(4, h - 5);
    if (!zOk(x, y) || hyp(x - bcx, y - bcy) < baseR + 16 || hordes.some(q => hyp(q.x - x, q.y - y) < 18)) continue;
    let c = 0; for (let q = 0; q < 30 && c < 6; q++) { const X = x + ri(-3, 3), Y = y + ri(-3, 3); if (zOk(X, Y)) { marks.push({ mk: 'zombie', tx: X, ty: Y, horde: hordes.length }); c++; } }
    if (c >= 4) hordes.push({ x, y, n: c }); else marks.splice(marks.length - c, c);
  }
  stats.hordes = hordes.length;

  const map = { format: 'survival-map', version: VERSION, baseKind, name: `world_${size}_${sd}`, w, h, terr, fixed: new Array(N).fill(null), base, objs, marks };
  const meta = { size, seed: sd, water: WO, baseKind, base: { x0, y0, x1, y1, side, cx: bcx, cy: bcy }, pois, nodes, edges, rivers, lakes, swamps, hordes, custom: C, camp: null, stats };

  /* 9 · tent camp replaces the compound */
  if (baseKind === 'camp') { meta.camp = campify(map, meta.base); map.campPath = meta.camp.path; }

  /* 10 · towns get streets and sidewalks; ruins and burned houses sit on rubble */
  for (const p of pois) {
    if (p.type !== 'town') continue;
    for (let y = p.y - p.r - 2; y <= p.y + p.r + 2; y++) for (let x = p.x - p.r - 2; x <= p.x + p.r + 2; x++) if (inb(x, y) && hyp(x - p.x, y - p.y) <= p.r + 2 && terr[I(x, y)] === 'r') terr[I(x, y)] = 'a';
  }
  const walk = [];
  for (const p of pois) {
    if (p.type !== 'town') continue;
    for (let y = p.y - p.r - 3; y <= p.y + p.r + 3; y++) for (let x = p.x - p.r - 3; x <= p.x + p.r + 3; x++) {
      if (!inb(x, y) || hyp(x - p.x, y - p.y) > p.r + 3) continue;
      const k = I(x, y), t = terr[k]; if (base[k] || !(t === 'g' || t === 'd' || t === 'f' || t === 'k')) continue;
      let by = false; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (inb(x + i, y + j) && terr[I(x + i, y + j)] === 'a') by = true;
      if (by) walk.push(k);
    }
  }
  walk.forEach(k => { terr[k] = 'p'; });
  for (const p of pois) if (p.type === 'ruin') for (let y = p.y - p.r; y <= p.y + p.r; y++) for (let x = p.x - p.r; x <= p.x + p.r; x++) if (inb(x, y) && terr[I(x, y)] === 'd' && hyp(x - p.x, y - p.y) <= p.r) terr[I(x, y)] = 'l';
  for (const o of objs) if (o.t === 'bld' && o.k === 'wld_burnt_house') { const [fw, fh] = FP[o.k]; for (let j = 0; j <= fh; j++) for (let i = -1; i <= fw; i++) if (inb(o.tx + i, o.ty + j) && terr[I(o.tx + i, o.ty + j)] === 'd') terr[I(o.tx + i, o.ty + j)] = 'l'; }

  const tree = k => k.startsWith('tree_') || k === 'bush' || k === 'stump' || (k.startsWith('nat_s2_') && !GROUND[k]);
  stats.road = terr.filter(t => t === 'r' || t === 'a').length;
  stats.water = terr.filter(t => t === 'w').length;
  stats.bridges = objs.filter(o => o.t === 'bridge').length;
  stats.buildings = map.objs.filter(o => o.t === 'bld' && o.k.startsWith('wld_')).length;
  stats.trees = map.objs.filter(o => o.t === 'tree' && tree(o.k)).length;
  stats.decor = map.objs.filter(o => o.t === 'tree' && !tree(o.k)).length;
  stats.zombies = map.marks.filter(m => m.mk === 'zombie').length;
  return { map, meta };
}

// Rewrites the base zone into a starter camp: tents round a campfire, a workbench with a wood pile, and a footpath to the road.
// Mutates the map; deterministic (hash-based, no rng) so the Python port matches. Returns { fire, bench, pile, spawns, path }.
export function campify(Mp, b) {
  const w = Mp.w, h = Mp.h, I = (x, y) => y * w + x, inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const fx = Math.round(b.cx), fy = Math.round(b.cy);
  const inBase = (x, y) => x >= b.x0 - 1 && x <= b.x1 + 1 && y >= b.y0 - 1 && y <= b.y1 + 1;
  Mp.objs = Mp.objs.filter(o => !inBase(o.tx, o.ty));
  Mp.marks = Mp.marks.filter(m => m.mk !== 'survivor');
  for (let y = b.y0 - 1; y <= b.y1 + 1; y++) for (let x = b.x0 - 1; x <= b.x1 + 1; x++) if (inb(x, y) && Mp.terr[I(x, y)] !== 'r') {
    const dx = (x - fx) / 4.6, dy = (y - fy) / 3.6, d = dx * dx + dy * dy + (hh(x, y, 77) - 0.5) * 0.35;
    Mp.terr[I(x, y)] = d < 1 ? 'd' : 'g';
  }
  const V = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[b.side], path = new Set();
  for (let k = 2; k < 40; k++) {
    let road = 0;
    for (const o of [0, -1]) { const x = fx + V[0] * k + (V[0] ? 0 : o), y = fy + V[1] * k + (V[1] ? 0 : o); if (!inb(x, y) || Mp.terr[I(x, y)] === 'w') { road = 2; continue; } if (Mp.terr[I(x, y)] === 'r') road++; else { Mp.terr[I(x, y)] = 'd'; path.add(I(x, y)); } }
    if (road >= 2) break;
  }
  Mp.objs = Mp.objs.filter(o => !path.has(I(o.tx, o.ty)));
  const used = new Set([I(fx, fy)]), objs = [];
  const free = (x, y, fw, m = 1) => { for (let j = -m; j <= m; j++) for (let i = -m; i < fw + m; i++) { if (!inb(x + i, y + j)) return false; const q = I(x + i, y + j); if (used.has(q)) return false; if (j === 0 && i >= 0 && i < fw && path.has(q)) return false; } return true; };
  const put = (k, x, y, fw, camp) => { for (let i = 0; i < fw; i++) used.add(I(x + i, y)); const o = { t: 'tree', k, tx: x, ty: y }; if (camp) o.camp = camp; objs.push(o); return o; };
  const place = (k, fw, cands, camp) => { for (const [dx, dy] of cands) { const x = fx + dx, y = fy + dy; if (free(x, y, fw)) return put(k, x, y, fw, camp); } return null; };
  put('deco_campfire', fx, fy, 1, 'fire');
  let tents = 0; for (const c of [[-6, -3], [3, -3], [-2, -5], [-6, 2], [4, 2], [-2, 5], [5, -1], [-7, 0]]) { if (tents >= 3) break; if (place('deco_tent', 2, [c], 'tent')) tents++; }
  const bench = place('camp_workbench', 2, [[2, 3], [-4, 3], [3, 0], [-5, 0], [-1, 4], [-1, -4]], 'bench');
  let pile = null;
  if (bench) for (const [dx, dy] of [[3, 0], [-2, 0], [0, 2], [1, -2]]) { const x = bench.tx + dx, y = bench.ty + dy; if (inb(x, y) && !used.has(I(x, y)) && !path.has(I(x, y))) { pile = put('deco_logs', x, y, 1, 'pile'); break; } }
  if (!pile) pile = place('deco_logs', 1, [[2, 1], [-2, 1], [1, 2], [-1, -2]], 'pile');
  place('deco_crates', 1, [[-3, 1], [2, -2], [-3, -2], [3, 1]], null); place('deco_backpack', 1, [[1, -1], [-1, 1], [1, 1]], null);
  const spawns = [];
  for (const [dx, dy] of [[-1, 1], [1, 1], [0, -1], [-1, -1], [1, -1], [0, 2]]) { if (spawns.length >= 3) break; const x = fx + dx, y = fy + dy; if (!used.has(I(x, y))) { spawns.push([x, y]); Mp.marks.push({ mk: 'survivor', tx: x, ty: y }); } }
  Mp.objs.push(...objs);
  return { fire: [fx, fy], bench: bench && [bench.tx, bench.ty], pile: pile && [pile.tx, pile.ty], spawns, path: [...path] };
}

// Hash of a generated map. survival_worldgen.fingerprint() in Python returns the same value for the same seed and options.
export function fingerprint(M) {
  let s = M.terr.join('') + '|' + M.base.map(v => v ? 1 : 0).join('') + '|';
  for (const o of M.objs) s += `${o.t}:${o.k || o.mat || o.gk || ''}:${o.t === 'tower' ? o.roof : ''}${o.t === 'gate' ? o.o : ''}:${o.tx},${o.ty};`;
  s += '|'; for (const m of M.marks) s += `${m.mk}:${m.tx},${m.ty};`;
  let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/* ---------- rendering helpers ---------- */
// A is any sprite table keyed by name with { w, h } per entry: the live asset table, or the "sprites" object of survival_sprites.json.
const TS = 16, DIRS = [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]], OPP = { n: 's', e: 'w', s: 'n', w: 'e' };
const OVER = { f: 1, k: 1, s: 1, S: 1, t: 1, h: 1, l: 1 };
export function groundKey(M, x, y) {
  const i = y * M.w + x, f = M.fixed && M.fixed[i]; if (f) return f;
  const t = M.terr[i], h = hh(x, y, 5), T = (a, b) => a >= 0 && b >= 0 && a < M.w && b < M.h ? M.terr[b * M.w + a] : null;
  if (t === 'g') return h < 0.55 ? 'grass_a' : h < 0.88 ? 'grass_b' : 'grass_c';
  if (t === 'd') { for (const [d, dx, dy] of DIRS) if (T(x + dx, y + dy) === 'g') return 'edge_' + d; return h < 0.8 ? 'dirt_a' : h < 0.95 ? 'dirt_b' : 'dirt_c'; }
  if (t === 'w') return shoreKey(M.terr, M.w, M.h, x, y) || 'water_a';
  if (t === 'f') return h < 0.6 ? 'forest_a' : 'forest_b';
  if (t === 'k') return h < 0.55 ? 'rocky_a' : 'rocky_b';
  if (t === 's') return 'swamp_mud';
  if (t === 'S') return 'swamp_water';
  if (t === 't') return 'field_tilled_h';
  if (t === 'h') return 'field_wheat';
  if (t === 'l') return 'lot_rubble';
  if (t === 'q') { const H_ = v => v === 'q' || v === 'x'; return H_(T(x - 1, y)) || H_(T(x + 1, y)) ? 'str_rail_h' : 'str_rail_v'; }
  if (t === 'x') return 'str_rail_x';
  if (t === 'L') return x % 3 === 0 && T(x, y + 1) === 'L' ? 'str_lot_line' : h < 0.18 ? 'str_lot_crack' : 'str_lot_a';
  if (t === 'a') return h < 0.2 ? 'street_crack' : 'street_x';
  if (t === 'p') { const st = DIRS.filter(([, dx, dy]) => T(x + dx, y + dy) === 'a'); return st.length === 1 ? 'curb_' + OPP[st[0][0]] : 'sidewalk'; }
  const g = {}; for (const [d, dx, dy] of DIRS) { const v = T(x + dx, y + dy); g[d] = v !== null && v !== 'r' && v !== 'a' && v !== 'x'; }
  const n = g.n + g.e + g.s + g.w;
  if (n === 0) return h < 0.12 ? 'road_p' : 'road_x';
  if (n === 1) return 'road_edge_' + (g.n ? 'n' : g.e ? 'e' : g.s ? 's' : 'w');
  if (n === 2) { if (g.n && g.s) return 'road_h'; if (g.e && g.w) return 'road_v'; return 'road_corner_' + (g.n ? 'n' : 's') + (g.w ? 'w' : 'e'); }
  if (n === 3) return g.n && g.s ? 'road_h' : 'road_v';
  return 'road_p';
}
// grass blend overlays drawn over a non-grass terrain tile where it meets grass
export function overlayKeys(M, x, y) {
  const t = M.terr[y * M.w + x]; if (!OVER[t]) return null;
  const G = (a, b) => a >= 0 && b >= 0 && a < M.w && b < M.h && M.terr[b * M.w + a] === 'g';
  const n = G(x, y - 1), s = G(x, y + 1), w = G(x - 1, y), e = G(x + 1, y), ov = [];
  if (n && w) ov.push('over_out_nw'); if (n && e) ov.push('over_out_ne'); if (s && w) ov.push('over_out_sw'); if (s && e) ov.push('over_out_se');
  if (n && !w && !e) ov.push('over_n'); if (s && !w && !e) ov.push('over_s'); if (w && !n && !s) ov.push('over_w'); if (e && !n && !s) ov.push('over_e');
  if (!n && !w && G(x - 1, y - 1)) ov.push('over_in_nw'); if (!n && !e && G(x + 1, y - 1)) ov.push('over_in_ne');
  if (!s && !w && G(x - 1, y + 1)) ov.push('over_in_sw'); if (!s && !e && G(x + 1, y + 1)) ov.push('over_in_se');
  return ov.length ? ov : null;
}
// ground[i]: tile key per cell; over[i]: overlay keys or null; water: cell indexes showing open water (animate with set_water_f0..2);
// draws: objects sorted back to front with pixel positions. Keys already carry the season suffix when the table has one.
export function layout(M, A, season = 'summer') {
  const sf = season === 'summer' ? '' : '_' + season, sk = k => A[k + sf] ? k + sf : k;
  const occ = new Int32Array(M.w * M.h).fill(-1);
  const fpOf = o => o.t === 'gate' ? (o.o === 'h' ? [2, 1] : [1, 2]) : o.t === 'tower' ? [2, 2] : o.t === 'bld' ? FP[o.k] : DFP[o.k] || [1, 1];
  M.objs.forEach((o, n) => { if (o.t === 'bridge') return; const [fw, fh] = fpOf(o); for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) { const x = o.tx + i, y = o.ty + j; if (x >= 0 && y >= 0 && x < M.w && y < M.h) occ[y * M.w + x] = n; } });
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
    if (o.t === 'bridge') return { key: o.k, x: o.tx * TS, y: o.k.startsWith('bridge_h') ? o.ty * TS - 8 : o.ty * TS - 4, ord: o.ty * TS - 8 };
    if (o.t === 'bld') { const [fw, fh] = FP[o.k]; return { key: o.k, x: o.tx * TS + ((fw * TS - s.w) >> 1), y: (o.ty + fh) * TS - s.h, ord: (o.ty + fh) * TS }; }
    if (FLAT[o.k]) return { key: o.k, x: o.tx * TS, y: o.ty * TS, ord: o.ty * TS + 1 };
    const fw = (DFP[o.k] || [1])[0];
    return { key: o.k, x: o.tx * TS + ((fw * TS) >> 1) - (s.w >> 1), y: o.ty * TS + 18 - s.h, ord: GROUND[o.k] ? o.ty * TS + 1 : o.ty * TS + 16 };
  };
  const ground = [], over = [], water = [];
  for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
    const k = groundKey(M, x, y); ground.push(sk(k)); if (k === 'water_a') water.push(y * M.w + x);
    const ov = overlayKeys(M, x, y); over.push(ov && ov.map(sk));
  }
  const draws = M.objs.map(o => { const d = sprOf(o); return d && { ...d, key: sk(d.key), ob: o }; }).filter(Boolean).sort((a, b) => a.ord - b.ord || a.x - b.x);
  return { ground, over, water, waterFrames: ['set_water_f0', 'set_water_f1', 'set_water_f2'].map(sk), draws, at };
}

const MINI = {
  summer: { g: [80, 103, 63], d: [122, 111, 82], tree: [40, 56, 34], w: [52, 86, 96], f: [58, 72, 44], h: [176, 150, 78] },
  spring: { g: [90, 118, 70], d: [118, 108, 85], tree: [46, 66, 38], w: [56, 92, 100], f: [64, 82, 50], h: [110, 140, 80] },
  fall: { g: [118, 104, 60], d: [122, 106, 78], tree: [110, 62, 34], w: [50, 80, 88], f: [92, 72, 44], h: [150, 126, 70] },
  winter: { g: [195, 202, 208], d: [150, 146, 136], tree: [70, 84, 80], w: [170, 192, 204], f: [168, 176, 182], h: [200, 204, 206] }
};
const MINI_T = { r: [168, 160, 134], a: [78, 80, 78], p: [150, 150, 140], k: [118, 118, 108], s: [72, 70, 50], S: [56, 72, 58], t: [120, 98, 64], l: [120, 110, 95], q: [92, 84, 70], x: [150, 140, 110], L: [66, 64, 60] };
export function minimap(M, season = 'summer') {
  const P = MINI[season] || MINI.summer, px = new Uint8ClampedArray(M.w * M.h * 4);
  const set = (i, c) => { px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = 255; };
  for (let i = 0; i < M.w * M.h; i++) { const t = M.terr[i]; set(i, P[t] || MINI_T[t] || P.g); }
  const fpOf = o => o.t === 'gate' ? (o.o === 'h' ? [2, 1] : [1, 2]) : o.t === 'tower' ? [2, 2] : o.t === 'bld' ? FP[o.k] : DFP[o.k] || [1, 1];
  for (const o of M.objs) {
    const k = o.k || '', c = o.t === 'wall' || o.t === 'gate' || o.t === 'tower' ? [197, 212, 138] : o.t === 'bridge' ? [150, 118, 80] : o.t === 'bld' ? (k.startsWith('bld_') ? [197, 212, 138] : [176, 121, 74])
      : o.camp ? [197, 212, 138] : k.startsWith('tree_') || k === 'nat_s2_birch' || k === 'nat_s2_willow' || k === 'nat_s2_apple' ? P.tree : null;
    if (!c) continue; const [fw, fh] = fpOf(o);
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) { const x = o.tx + i, y = o.ty + j; if (x >= 0 && y >= 0 && x < M.w && y < M.h) set(y * M.w + x, c); }
  }
  return px;
}

export const WATER_OPTIONS = [
  ['rivers', 'Rivers'],
  ['lakes', 'Lakes'],
  ['ponds', 'Ponds'],
  ['swamps', 'Swamps'],
  ['lighthouse', 'Lighthouses']
];
export const CUSTOM_TYPES = [
  ['farm', 'Farmsteads'],
  ['gas', 'Gas stops'],
  ['ruin', 'Ruins'],
  ['chapel', 'Chapels'],
  ['camp', 'Abandoned camps'],
  ['industrial', 'Industrial yards'],
  ['stop', 'Truck stops'],
  ['wild', 'Ranger posts']
];
export const CUSTOM_FEATURES = [
  ['fields', 'Farm fields'],
  ['rail', 'Rail spurs'],
  ['graveyards', 'Graveyards'],
  ['boathouses', 'Boathouses'],
  ['pylons', 'Power pylons'],
  ['roadside', 'Poles, signs, billboards']
];
export const CUSTOM_PRESETS = [
  ['Sparse', { places: 0.6, towns: 0.5, zombies: 0.5, hordes: 0, trees: 0.6, rocks: 0.6, scatter: 0.5, water: 0.6, decor: 0.5, wrecks: 0.5, checkpoints: 0.5, vignettes: 0.5 }],
  ['Default', { places: 1, towns: 1, zombies: 1, hordes: 0, trees: 1, rocks: 1, scatter: 1, water: 1, decor: 1, wrecks: 1, checkpoints: 1, vignettes: 1 }],
  ['Dense', { places: 1.4, towns: 1.5, zombies: 1.5, hordes: 2, trees: 1.4, rocks: 1.3, scatter: 1.6, water: 1.5, decor: 1.5, wrecks: 1.6, checkpoints: 1.5, vignettes: 1.6 }],
  ['Overrun', { places: 1, towns: 1, zombies: 3, hordes: 6, trees: 1, rocks: 1, scatter: 1, water: 1, decor: 1.3, wrecks: 2, checkpoints: 2, vignettes: 2.5 }]
];
export const CUSTOM_GROUPS = [
  ['Places', [['places', 'Places', 0.25, 2.5, 0.05], ['towns', 'Towns', 0, 3, 0.25]]],
  ['Nature', [['trees', 'Trees', 0, 2, 0.1], ['rocks', 'Rocks and boulders', 0, 3, 0.1], ['scatter', 'Ground cover', 0, 3, 0.1], ['water', 'Water life', 0, 3, 0.1]]],
  ['Props', [['decor', 'Clutter at places', 0, 3, 0.1], ['wrecks', 'Road wrecks', 0, 3, 0.1], ['checkpoints', 'Checkpoints', 0, 3, 0.25], ['vignettes', 'Remains and campsites', 0, 3, 0.1]]],
  ['Zombies', [['zombies', 'Spawn density', 0, 3, 0.1], ['hordes', 'Hordes', 0, 12, 1]]]
];

