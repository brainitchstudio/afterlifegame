// World generation for the game: the design kit's World Generator v4 (worldgen4.mjs, kept verbatim so a
// seed builds the same world as the kit and its Python port), adapted to the simulation. The generator
// lays out a starting camp in its base zone; the game builds its own camp fixtures there, centred on the
// generator's campfire. Output uses the survival-map format, so a world can be opened in the Map Editor.
import { computeRules } from './pixelRules.mjs';
import { generate as generateV4, POI_TYPES, FP, DFP, GROUND, FLAT } from './worldgen4.mjs';

export {
  SIZES, POI_TYPES, FP, DFP, hh, seedOf, fingerprint, groundKey, overlayKeys, shoreKey, TERRAIN,
  PLACE_TYPES, DEFAULT_CUSTOM, customOf, isDefaultCustom,
  WATER_OPTIONS, CUSTOM_TYPES, CUSTOM_FEATURES, CUSTOM_PRESETS, CUSTOM_GROUPS
} from './worldgen4.mjs';
const hyp = (a, b) => Math.sqrt(a * a + b * b);

export const POI_EXPEDITIONS = {
  farm: { name: 'Farmstead Foraging', hours: 4, cost: { food: 6 }, reward: { food: 65, wood: 20 }, risk: .15, rescueChance: .18, recruit: { label: 'Stranded Farmer', options: { forcedPrimaryStat: 'int' } } },
  gas: { name: 'Gas Stop Salvage', hours: 5, cost: { food: 8 }, reward: { metal: 50, wood: 15 }, risk: .22, rescueChance: .15, recruit: { label: 'Depot Mechanic', options: { forcedPrimaryStat: 'str' } }, weapon: { chance: .35, types: ['pipe', 'pistol', 'rifle'] } },
  ruin: { name: 'Ruin Excavation', hours: 5, cost: { food: 7 }, reward: { wood: 40, metal: 35 }, risk: .20, rescueChance: .12, recruit: { label: 'Scavenger', options: {} }, weapon: { chance: .25, types: ['pipe', 'pistol'] } },
  chapel: { name: 'Chapel Sanctuary', hours: 4, cost: { food: 5 }, reward: { food: 35, metal: 15 }, risk: .12, rescueChance: .25, recruit: { label: 'Field Medic', options: { forcedPrimaryStat: 'int' } } },
  town: { name: 'Town Sweep', hours: 7, cost: { food: 12 }, reward: { food: 50, metal: 55, wood: 35 }, risk: .32, rescueChance: .25, recruit: { label: 'Town Survivor', options: { qualityFloor: 7 } }, weapon: { chance: .45, types: ['pistol', 'rifle'] } },
  camp: { name: 'Camp Recon', hours: 3, cost: { food: 4 }, reward: { wood: 45, food: 25 }, risk: .10, rescueChance: .20, recruit: { label: 'Lost Hiker', options: {} } },
  industrial: { name: 'Industrial Salvage', hours: 6, cost: { food: 10 }, reward: { metal: 75, wood: 20 }, risk: .28, rescueChance: .15, recruit: { label: 'Factory Hand', options: { forcedPrimaryStat: 'str' } }, weapon: { chance: .3, types: ['pipe', 'pistol'] } },
  stop: { name: 'Truck Stop Raid', hours: 5, cost: { food: 8 }, reward: { food: 40, metal: 35 }, risk: .22, rescueChance: .18, recruit: { label: 'Long-haul Trucker', options: { forcedPrimaryStat: 'end' } }, weapon: { chance: .3, types: ['pistol', 'rifle'] } },
  wild: { name: 'Ranger Post Search', hours: 5, cost: { food: 7 }, reward: { wood: 45, food: 30 }, risk: .14, rescueChance: .2, recruit: { label: 'Park Ranger', options: { forcedPrimaryStat: 'agi' } }, weapon: { chance: .4, types: ['rifle'] } }
};

// Generates in steps so the loading screen can show progress between them. The world's origin (the
// game's (0, 0), where the campfire stands) is the top-left corner of the generator's campfire tile,
// so the game's 16-unit placement grid lines up with the tiles.
export function* generateSteps(options = {}) {
  const opts = typeof options === 'string' ? { size: options } : { ...options };
  if (!opts.size) opts.size = 'medium';
  if (opts.seed == null) opts.seed = 1;
  yield { progress: 0.05, activity: 'Surveying the wilderness...' };
  yield { progress: 0.2, activity: 'Carving rivers, lakes and roads...' };
  const { map, meta } = generateV4(opts);
  yield { progress: 0.8, activity: 'Placing zombie spawns and hordes...' };
  const rules = computeRules(map);
  map.rules = rules.grid;
  map.baseRect = rules.baseRect;
  const [fx, fy] = meta.camp?.fire || [Math.round(meta.base.cx), Math.round(meta.base.cy)];
  meta.base = { ...meta.base, cx: fx, cy: fy };
  return { map, meta };
}

export function generate(options = {}) {
  const steps = generateSteps(options);
  for (let result = steps.next(); ; result = steps.next()) if (result.done) return result.value;
}

export function parseSurvMap(jsonOrObj) {
  const raw = typeof jsonOrObj === 'string' ? JSON.parse(jsonOrObj) : jsonOrObj;
  if (!raw || (!raw.objs && !raw.objects && !raw.ground && !raw.terr)) throw new Error('Invalid map format');
  const w = raw.w || raw.width || 112;
  const h = raw.h || raw.height || 80;
  const objs = (raw.objs || raw.objects || []).map(o => ({
    t: o.t || o.type,
    k: o.k || o.kind,
    tx: o.tx,
    ty: o.ty,
    fw: o.fw,
    fh: o.fh,
    sprite: o.sprite,
    order: o.order
  }));
  const marks = (raw.marks || raw.markers || []).map(m => ({
    mk: m.mk || m.type,
    tx: m.tx,
    ty: m.ty
  }));
  const base = raw.base || raw.buildable || null;
  const map = {
    ...raw,
    w,
    h,
    objs,
    marks,
    base
  };
  let baseCoords = null;
  if (map.base) {
    let minX = w, maxX = 0, minY = h, maxY = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (map.base[y * w + x] === 1) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (minX <= maxX && minY <= maxY) {
      baseCoords = { x0: minX, y0: minY, x1: maxX, y1: maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
    }
  }
  if (!baseCoords) baseCoords = { x0: Math.round(w / 2 - 10), y0: Math.round(h / 2 - 8), x1: Math.round(w / 2 + 10), y1: Math.round(h / 2 + 7), cx: w / 2, cy: h / 2 };

  // Collect POIs from wld_ buildings if not explicitly provided
  const pois = [];
  const wldBuildings = (map.objs || []).filter(o => o.t === 'bld' && o.k && o.k.startsWith('wld_'));
  const visited = new Set();
  wldBuildings.forEach((b, idx) => {
    if (visited.has(idx)) return;
    const cluster = [b];
    visited.add(idx);
    wldBuildings.forEach((o, oIdx) => {
      if (!visited.has(oIdx) && hyp(o.tx - b.tx, o.ty - b.ty) <= 12) {
        cluster.push(o);
        visited.add(oIdx);
      }
    });
    const avgX = cluster.reduce((sum, c) => sum + c.tx, 0) / cluster.length;
    const avgY = cluster.reduce((sum, c) => sum + c.ty, 0) / cluster.length;
    let type = 'ruin';
    if (cluster.some(c => c.k === 'wld_gas_station')) type = 'gas';
    else if (cluster.some(c => c.k === 'wld_barn')) type = 'farm';
    else if (cluster.some(c => c.k === 'wld_chapel')) type = 'chapel';
    else if (cluster.length >= 4) type = 'town';
    else if (cluster.some(c => c.k === 'wld_trailer')) type = 'camp';
    pois.push({
      id: pois.length,
      type,
      label: POI_TYPES[type]?.label || type,
      name: (POI_TYPES[type]?.label || type) + ' ' + (pois.length + 1),
      x: avgX,
      y: avgY,
      r: POI_TYPES[type]?.r || 6,
      blds: cluster
    });
  });

  // Compute placement rules if not already present
  if (!map.rules || !map.baseRect) {
    const rules = computeRules(map);
    map.rules = rules.grid;
    map.baseRect = rules.baseRect;
  }
  return { map, meta: { base: baseCoords, pois, stats: { buildings: wldBuildings.length } } };
}

// Rows between a tree sprite's bottom edge and its trunk base (sprite height minus the atlas anchor row).
export const TRUNK_BASE = { tree_oak: 4, tree_pine: 3, tree_dead: 2, nat_s2_birch: 2, nat_s2_apple: 2, nat_s2_willow: 2 };
// Where an object's sprite stands, as the kit's layout() draws it: props centred on their footprint with
// their bottom edge two pixels below its last row; flat ones (docks) lie on the tile; bridge decks sit
// across the water (an east-west deck 8 pixels up, a north-south one 4). `order` sorts back to front.
function propPlacement(o, x, y) {
  const fw = (DFP[o.k] || [1])[0];
  if (o.t === 'bridge') return { x, y: y + (o.k.startsWith('bridge_h') ? -8 : -4), anchor: 'top', order: y - 8 };
  if (FLAT[o.k]) return { x, y, anchor: 'top', order: y + 1 };
  return { x: x + fw * 8, y: y + 18, anchor: 'bottom', order: GROUND[o.k] ? y + 1 : y + 16 };
}
const ZONE_PROPS = new Set(['deco_campfire', 'deco_tent', 'camp_workbench', 'deco_logs', 'deco_crates', 'deco_backpack']);

// Mapping from worldgen building keys to game building types
const BLD_TO_GAME = {
  bld_town_hall: 'core',
  bld_farm: 'farm',
  bld_bunkhouse: 'dorm',
  bld_workshop: 'workshop',
  bld_clinic: 'clinic',
  bld_barracks: 'barracks',
  bld_storage: 'storage',
  bld_shelter: 'shelter',
  bld_lumber_mill: 'lumber_mill',
  bld_lab: 'lab',
  bld_armory: 'armory'
};

export function applyWorldToGame(game, map, meta) {
  const base = meta?.base || { cx: map.w / 2, cy: map.h / 2, x0: map.w / 2 - 10, y0: map.h / 2 - 8, x1: map.w / 2 + 10, y1: map.h / 2 + 7 };
  const bcx = base.cx, bcy = base.cy;
  game.worldOrigin = { bcx, bcy };
  game.map = map;
  game.worldMeta = meta;

  // Transform world POIs to simulation coordinates centered on base
  game.worldPois = (meta?.pois || []).map(p => ({
    id: p.id,
    type: p.type,
    label: p.label || POI_TYPES[p.type]?.label || p.type,
    name: p.name || (p.label + ' ' + (p.id + 1)),
    x: Math.round((p.x - bcx) * 16),
    y: Math.round((p.y - bcy) * 16),
    r: Math.round((p.r || 6) * 16),
    tx: Math.round(p.x),
    ty: Math.round(p.y),
    scavenged: false,
    blds: (p.blds || []).map(b => ({
      k: b.k,
      tx: b.tx,
      ty: b.ty,
      x: Math.round((b.tx - bcx) * 16),
      y: Math.round((b.ty - bcy) * 16)
    }))
  }));

  // Separate map objects: world buildings, decor props, map trees, and base buildings
  const worldBuildings = [];
  const worldDecor = [];
  const mapTrees = [];
  const baseBuildings = []; // generated bld_* placed inside the starting base

  // The generator's own camp (tents, fire, workbench, logs and a few props in its base zone) makes way
  // for the one the game builds.
  const zone = map.baseKind === 'camp' && meta?.base;
  const campProp = o => zone && o.t === 'tree' && ZONE_PROPS.has(o.k) && o.tx >= zone.x0 - 1 && o.tx <= zone.x1 + 1 && o.ty >= zone.y0 - 1 && o.ty <= zone.y1 + 1;
  (map.objs || []).forEach(o => {
    const x = Math.round((o.tx - bcx) * 16);
    const y = Math.round((o.ty - bcy) * 16);
    if (campProp(o)) return;
    if (o.t === 'bridge') {
      worldDecor.push({ key: 'tiles/' + o.k, k: o.k, tx: o.tx, ty: o.ty, px: x + 8, py: y + 8, bridge: true, ...propPlacement(o, x, y) });
    } else if (o.t === 'bld' && o.k && o.k.startsWith('wld_')) {
      const [fw, fh] = FP[o.k] || [3, 3];
      worldBuildings.push({
        key: 'world/' + o.k,
        k: o.k,
        x,
        y,
        tx: o.tx,
        ty: o.ty,
        fw,
        fh,
        order: Math.round((o.ty + fh - bcy) * 16)
      });
    } else if (o.t === 'bld' && o.k && BLD_TO_GAME[o.k]) {
      // Base buildings: remember their generated positions for repositioning
      const [fw, fh] = FP[o.k] || [3, 3];
      baseBuildings.push({
        genKey: o.k,
        gameType: BLD_TO_GAME[o.k],
        tx: o.tx,
        ty: o.ty,
        fw, fh,
        // Center of the footprint in simulation coordinates
        cx: Math.round((o.tx + fw / 2 - bcx) * 16),
        cy: Math.round((o.ty + fh / 2 - bcy) * 16)
      });
    } else if (o.t === 'tree' && TRUNK_BASE[o.k] != null) {
      // Trunks stand where the sprite's base meets the ground (the Map Editor draws trees 18 below the tile top).
      const fw = (DFP[o.k] || [1])[0];
      mapTrees.push({
        id: o.tx + ',' + o.ty,
        x: x + fw * 8,
        y: y + 18 - TRUNK_BASE[o.k],
        scale: 1,
        alpha: 1,
        kind: o.k === 'tree_pine' ? 2 : o.k === 'tree_dead' ? 0 : 1,
        k: o.k,
        trunk: TRUNK_BASE[o.k],
        radius: o.k === 'tree_dead' ? 4 : 4.5,
        order: Math.round((o.ty + 1 - bcy) * 16)
      });
    } else if (o.t === 'tree' && o.k) {
      // Props, plants, fences and structures: drawn, never in the way; (px, py) is the centre of their
      // first tile, which claimed land and buildings clear. Older maps' decor keeps the
      // Unity atlas's own placement (the tile's centre, standing on its bottom edge).
      const key = (o.k.startsWith('deco_') ? 'decor/' : 'tiles/') + o.k;
      const at = map.version >= 3 ? propPlacement(o, x, y) : { x: x + 8, y: y + 16, anchor: 'bottom', order: y + 16 };
      worldDecor.push({ key, k: o.k, tx: o.tx, ty: o.ty, px: x + 8, py: y + 8, ...at });
    }
  });

  game.worldBuildings = worldBuildings;
  game.worldDecor = worldDecor;
  game.mapTrees = mapTrees;
  // Open water and swamp pools can't be walked; bridge decks cross them (water.mjs).
  const wet = new Uint8Array(map.w * map.h);
  (map.terr || []).forEach((t, i) => { if (t === 'w' || t === 'S') wet[i] = 1; });
  for (const o of map.objs || []) if (o.t === 'bridge' && o.tx >= 0 && o.ty >= 0 && o.tx < map.w && o.ty < map.h) wet[o.ty * map.w + o.tx] = 0;
  game.water = wet.includes(1) ? { wet, w: map.w, h: map.h, ox: bcx, oy: bcy } : null;

  // Reposition the starting game buildings to match the generated base layout.
  // The generator places bld_town_hall, bld_farm, etc. inside the base; the game's
  // reset() added core, farm, dorm, workshop at hardcoded positions. Move each one
  // to the center of its generated footprint.
  for (const gen of baseBuildings) {
    const gameBuilding = game.buildings.find(b => b.type === gen.gameType);
    if (gameBuilding) {
      gameBuilding.x = gen.cx;
      gameBuilding.y = gen.cy;
    }
  }

  // Rebuild the perimeter barricades so walls, gates and patrol routes reflect
  // the parcel grid rather than the stale positions from reset().
  if (typeof game.extendPerimeter === 'function') {
    game.extendPerimeter([]);
  }

  // Ensure placement rules are computed and store them on the game for runtime queries
  if (!map.rules || !map.baseRect) {
    const rules = computeRules(map);
    map.rules = rules.grid;
    map.baseRect = rules.baseRect;
  }
  game.mapRules = { grid: map.rules, baseRect: map.baseRect };

  // Set game bounds to encompass map
  game.bounds = {
    x: Math.max(bcx, map.w - bcx) * 16 + 128,
    y: Math.max(bcy, map.h - bcy) * 16 + 128,
    width: map.w * 16,
    height: map.h * 16,
    left: -bcx * 16,
    right: (map.w - bcx) * 16,
    top: -bcy * 16,
    bottom: (map.h - bcy) * 16
  };

  // Zombie spawn points outside the base
  if (map.marks) {
    game.worldZombieSpawns = map.marks.filter(m => m.mk === 'zombie').map(m => ({
      x: Math.round((m.tx - bcx) * 16),
      y: Math.round((m.ty - bcy) * 16),
      tx: m.tx,
      ty: m.ty,
      ...(m.horde != null ? { horde: m.horde } : {})
    }));
  }

  if (meta?.hordes) {
    game.worldHordes = meta.hordes.map(h => ({
      ...h,
      x: Math.round((h.x - bcx) * 16),
      y: Math.round((h.y - bcy) * 16)
    }));
  }

  game.landRevision = (game.landRevision || 0) + 1;
  return { pois: game.worldPois.length, buildings: worldBuildings.length, decor: worldDecor.length, trees: mapTrees.length, hordes: game.worldHordes?.length || 0 };
}
