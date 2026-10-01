// Campaign Phase 0: regional assignment. Generates the world from the campaign seed, audits the landing site
// (up to 32 attempts, then a logged fallback), lays the finite debris the camp gathers from, reserves room for
// the first structures, plots the migration corridor and places the campaign's regional sites on real map
// locations. Every distance in the spec is scaled to the generated map (tuning.world.mapSizes[].regionScale).
// Works in map tiles; results are stored in simulation units around the campfire.
import { CAMPAIGN, campaignSettings, copy, fill, CENTROCOM, MARA } from './campaignState.mjs';
import { generate, applyWorldToGame, DFP } from './worldgen.mjs';
import { fpOf, kindOf } from './pixelRules.mjs';
import { stream } from './survivors.mjs';
import { seedStream, regionIdOf, seedFromText } from './seed.mjs';
import { PARCEL_W, PARCEL_H } from './land.mjs';

const W = CAMPAIGN.tuning.world, GATHER = CAMPAIGN.tuning.gathering;
const BUILDABLE = new Set(['g', 'd', 'f', 'l', 't', 'h']); // grass, dirt, forest floor, rubble lot, fields; not rock (too steep), swamp, water or road
const ROAD = new Set(['r', 'a', 'x']);
const STEPS = Array.from({ length: 11 }, (_, i) => 'deploy_step_' + String(i + 1).padStart(2, '0'));

// The spec's distances (in its 512-tile tiles) on this map. Ground round the camp (landing square, protected
// perimeter, local debris, migration corridor) uses one local scale for every size; the bands regional sites
// are placed in scale with the map, so a larger region spreads its sites further out.
export function regionScaleOf(mapSize) {
  const s = (W.mapSizes[mapSize] || W.mapSizes.standard).regionScale, T = W.specTiles, local = n => Math.round(n * W.localScale);
  return {
    scale: s, landing: Math.max(10, local(W.landingAreaTiles)), protectedRadius: local(T.protectedPerimeter), localRadius: local(T.localResourceRadius),
    corridor: T.migrationCorridor.map(local), bands: Object.fromEntries(Object.entries(T.bands).map(([k, v]) => [k, v.map(n => Math.round(n * s))])),
  };
}

// ---------------------------------------------------------------- Map analysis
function analyse(map) {
  const { w, h, terr } = map, N = w * h, I = (x, y) => y * w + x, inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  // occupied: any object's footprint; solid: anything but trees and plants, which the camp can clear.
  const blocked = new Uint8Array(N), occupied = new Uint8Array(N), solid = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (terr[i] === 'w' || terr[i] === 'S') blocked[i] = 1;
  const cover = (o, fn) => { const [fw, fh] = fpOf(o); for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) if (inb(o.tx + i, o.ty + j)) fn(I(o.tx + i, o.ty + j)); };
  for (const o of map.objs || []) {
    if (o.t === 'bridge') continue;
    const foliage = kindOf(o) === 'foliage' || kindOf(o) === 'ground';
    cover(o, k => { occupied[k] = 1; if (!foliage) solid[k] = 1; if (o.t === 'bld' || o.t === 'wall' || o.t === 'tower') blocked[k] = 1; });
  }
  for (const o of map.objs || []) if (o.t === 'bridge') cover(o, k => { blocked[k] = 0; });
  const buildable = k => !blocked[k] && !occupied[k] && BUILDABLE.has(terr[k]);
  const clearable = k => !blocked[k] && !solid[k] && BUILDABLE.has(terr[k]);
  return { w, h, N, I, inb, terr, blocked, occupied, buildable, clearable };
}

// Walking distance in tiles from the campfire to every tile (-1 where it can't be reached).
function walkDistances(a, fx, fy) {
  const dist = new Int32Array(a.N).fill(-1), queue = new Int32Array(a.N);
  let head = 0, tail = 0;
  const start = a.I(fx, fy); dist[start] = 0; queue[tail++] = start;
  while (head < tail) {
    const k = queue[head++], x = k % a.w, y = (k - x) / a.w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy; if (!a.inb(X, Y)) continue;
      const n = a.I(X, Y); if (dist[n] >= 0 || a.blocked[n]) continue;
      dist[n] = dist[k] + 1; queue[tail++] = n;
    }
  }
  return dist;
}

// A* over walkable tiles that never comes closer than `minR` tiles to (fx, fy). Returns tile indices or null.
function corridorPath(a, from, to, fx, fy, minR) {
  const near = k => { const x = k % a.w, y = (k - x) / a.w; return Math.hypot(x - fx, y - fy) < minR; };
  if (a.blocked[from] || a.blocked[to] || near(from) || near(to)) return null;
  const g = new Float64Array(a.N).fill(Infinity), came = new Int32Array(a.N).fill(-1), closed = new Uint8Array(a.N);
  const tx = to % a.w, ty = (to - tx) / a.w, hcost = k => { const x = k % a.w; return Math.hypot(x - tx, (k - x) / a.w - ty); };
  const heap = [[hcost(from), from]];
  const push = item => { heap.push(item); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  g[from] = 0;
  while (heap.length) {
    const [, k] = pop();
    if (k === to) { const out = []; for (let n = to; n >= 0; n = came[n]) out.push(n); return out.reverse(); }
    if (closed[k]) continue; closed[k] = 1;
    const x = k % a.w, y = (k - x) / a.w;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const X = x + dx, Y = y + dy; if (!a.inb(X, Y)) continue;
      const n = a.I(X, Y); if (closed[n] || a.blocked[n] || near(n)) continue;
      if (dx && dy && (a.blocked[a.I(x + dx, y)] || a.blocked[a.I(x, y + dy)])) continue;
      const cost = g[k] + (dx && dy ? Math.SQRT2 : 1);
      if (cost < g[n]) { g[n] = cost; came[n] = k; push([cost + hcost(n), n]); }
    }
  }
  return null;
}

// ---------------------------------------------------------------- The audit, phase by phase
// Yields { phase } between phases so the loading screen can follow along; returns { ok, failures, region }.
export function* auditRegion(map, meta, { seed, attempt = 0, mapSize = 'standard', relaxed = false }) {
  const R = regionScaleOf(mapSize), a = analyse(map), failures = [];
  const [fx, fy] = meta.camp?.fire || [Math.round(meta.base.cx), Math.round(meta.base.cy)];
  // A failed audit still hands back what it placed, so the fallback is never empty.
  const partial = { fire: [fx, fy], patches: [], debris: [], sites: [], corridor: null };
  const fail = reason => { failures.push(reason); return { ok: false, failures, attempt, region: partial }; };
  const toSim = (tx, ty) => ({ x: (tx - fx) * 16 + 8, y: (ty - fy) * 16 + 8 });
  const tileDist = k => { const x = k % a.w; return Math.hypot(x - fx, (k - x) / a.w - fy); };

  // 1. The landing site: a clear square of buildable, gently sloped ground round the campfire.
  yield { phase: 4 };
  const half = Math.floor(R.landing / 2);
  let good = 0, total = 0;
  for (let y = fy - half; y < fy - half + R.landing; y++) for (let x = fx - half; x < fx - half + R.landing; x++) {
    total++;
    if (a.inb(x, y) && (a.buildable(a.I(x, y)) || map.campPath?.includes(a.I(x, y)))) good++;
  }
  if (good / total < W.buildableShare) return fail(`landing site only ${Math.round(good / total * 100)}% buildable`);

  // 2. A footpath to the road network, and the road network out to at least two map exits.
  yield { phase: 5 };
  const path = map.campPath || [];
  const roadNear = path.some(k => { const x = k % a.w, y = (k - x) / a.w; return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => a.inb(x + dx, y + dy) && ROAD.has(a.terr[a.I(x + dx, y + dy)])); });
  if (!path.length || !roadNear) return fail('no footpath from camp to the road');
  const nodes = meta.nodes || [], links = nodes.map(() => []);
  for (const [p, q] of meta.edges || []) { links[p]?.push(q); links[q]?.push(p); }
  const seen = new Set([nodes.findIndex(n => n.base)]), queue = [...seen];
  while (queue.length) for (const n of links[queue.shift()] || []) if (!seen.has(n)) { seen.add(n); queue.push(n); }
  const exits = [...seen].filter(i => nodes[i]?.exit).length;
  if (exits < (relaxed ? 1 : W.campExits)) return fail(`camp reaches ${exits} of the ${W.campExits} map exits it needs`);
  const dist = walkDistances(a, fx, fy);

  // 3. The migration corridor: a walkable route between two map edges that passes the camp inside the band.
  yield { phase: 6 };
  const rng = stream(seedStream(seed, 'region', attempt));
  const [lo, hi] = relaxed ? [Math.round(R.corridor[0] * 0.6), Math.round(R.corridor[1] * 1.6)] : R.corridor;
  const edgeTile = (x, y) => {
    x = Math.max(1, Math.min(a.w - 2, Math.round(x))); y = Math.max(1, Math.min(a.h - 2, Math.round(y)));
    for (let r = 0; r < 12; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const X = x + i, Y = y + j; if (a.inb(X, Y) && !a.blocked[a.I(X, Y)]) return a.I(X, Y); }
    return -1;
  };
  let corridor = null;
  for (let t = 0; t < W.corridorAttempts && !corridor; t++) {
    const angle = rng.next() * Math.PI, offset = lo + 1 + rng.next() * Math.max(1, hi - lo - 2), ux = Math.cos(angle), uy = Math.sin(angle);
    const cx = fx - uy * offset, cy = fy + ux * offset, far = a.w + a.h;
    // The line's two ends, clipped to the map.
    const clip = sign => { let s = 0; while (s < far) { const X = cx + ux * s * sign, Y = cy + uy * s * sign; if (X < 1 || Y < 1 || X > a.w - 2 || Y > a.h - 2) break; s++; } return [cx + ux * (s - 1) * sign, cy + uy * (s - 1) * sign]; };
    const A = edgeTile(...clip(-1)), B = edgeTile(...clip(1));
    if (A < 0 || B < 0 || A === B) continue;
    const route = corridorPath(a, A, B, fx, fy, lo);
    if (!route) continue;
    const closest = Math.min(...route.map(tileDist));
    if (closest >= lo - 0.5 && closest <= hi) corridor = { route, closest };
  }
  if (!corridor) return fail(`no migration corridor ${lo}-${hi} tiles from camp`);
  partial.corridor = { points: corridor.route.filter((_, i) => i % 3 === 0 || i === corridor.route.length - 1).map(k => { const x = k % a.w; return toSim(x, (k - x) / a.w); }), closestTiles: Math.round(corridor.closest * 10) / 10, band: [lo, hi] };
  const corridorMask = new Uint8Array(a.N), cw = Math.floor(W.corridorWidthTiles / 2) + 1;
  for (const k of corridor.route) { const x = k % a.w, y = (k - x) / a.w; for (let j = -cw; j <= cw; j++) for (let i = -cw; i <= cw; i++) if (a.inb(x + i, y + j)) corridorMask[a.I(x + i, y + j)] = 1; }

  // The camp's own parcel holds its fixtures; nothing else is placed there.
  const pw = PARCEL_W / 32 + 1, ph = PARCEL_H / 32 + 1;
  const inCamp = (x, y) => Math.abs(x - fx) <= pw && Math.abs(y - fy) <= ph;
  // free: open ground for debris; patchable: open or wooded ground a reserved patch may claim (its trees are cleared).
  const free = new Uint8Array(a.N), patchable = new Uint8Array(a.N);
  for (let k = 0; k < a.N; k++) {
    const x = k % a.w, y = (k - x) / a.w, ok = dist[k] >= 0 && !corridorMask[k] && !inCamp(x, y);
    free[k] = ok && a.buildable(k) ? 1 : 0;
    patchable[k] = ok && a.clearable(k) ? 1 : 0;
  }

  // 4. Reserved patches near camp for the food, shelter and workstation tutorials.
  const P = W.reservedPatchTiles, patches = [], taken = new Uint8Array(a.N);
  const spots = [];
  for (let y = fy - R.protectedRadius; y <= fy + R.protectedRadius; y++) for (let x = fx - R.protectedRadius; x <= fx + R.protectedRadius; x++) {
    if (!a.inb(x, y) || !a.inb(x + P - 1, y + P - 1) || Math.hypot(x + P / 2 - fx, y + P / 2 - fy) > R.protectedRadius) continue;
    spots.push([Math.hypot(x + P / 2 - fx, y + P / 2 - fy), x, y]);
  }
  spots.sort((p, q) => p[0] - q[0]);
  // Open ground first; then wooded ground, whose trees are cleared for the patch.
  for (const mask of [free, patchable]) for (const [, x, y] of spots) {
    if (patches.length >= W.reservedPatches) break;
    let ok = true;
    for (let j = -1; j <= P && ok; j++) for (let i = -1; i <= P && ok; i++) { const X = x + i, Y = y + j; if (!a.inb(X, Y)) { ok = false; break; } const k = a.I(X, Y); if (taken[k] || (i >= 0 && j >= 0 && i < P && j < P && !mask[k])) ok = false; }
    if (!ok) continue;
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) taken[a.I(x + i, y + j)] = 1;
    patches.push({ tx: x, ty: y, size: P, ...toSim(x, y), w: P * 16, h: P * 16, cleared: mask === patchable });
  }
  partial.patches = patches;
  if (patches.length < W.reservedPatches) return fail(`only ${patches.length} of ${W.reservedPatches} reserved patches fit near camp`);

  // 5. Finite debris: the guaranteed local resources, at least half inside the protected perimeter.
  yield { phase: 7 };
  const shuffle = list => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; };
  const inside = [], outside = [];
  for (let k = 0; k < a.N; k++) {
    if (!free[k] || taken[k]) continue;
    const d = tileDist(k);
    if (d >= W.minDebrisTiles && d <= R.protectedRadius) inside.push(k); else if (d > R.protectedRadius && d <= R.localRadius) outside.push(k);
  }
  shuffle(inside); shuffle(outside);
  const used = new Uint8Array(a.N), debris = [], spacing = GATHER.nodeSpacingTiles;
  const fits = (k, fw) => { const x = k % a.w, y = (k - x) / a.w; for (let j = -spacing; j <= spacing; j++) for (let i = -spacing; i < fw + spacing; i++) { if (!a.inb(x + i, y + j)) return false; const n = a.I(x + i, y + j); if (used[n] || (j === 0 && i >= 0 && i < fw && (!free[n] || taken[n]))) return false; } return true; };
  const place = (pool, kind, size, stock) => {
    const def = GATHER.nodes[kind][size], fw = (DFP[def.key.replace('decor/', '')] || [1])[0];
    const at = pool.findIndex(k => fits(k, fw));
    if (at < 0) return false;
    const k = pool.splice(at, 1)[0], tx = k % a.w, ty = (k - tx) / a.w;
    for (let i = 0; i < fw; i++) used[k + i] = 1;
    debris.push({ id: 'debris-' + debris.length, kind, resource: GATHER.nodes[kind].resource, size, workers: def.workers, stock, max: stock, key: def.key, tx, ty,
      x: (tx - fx) * 16 + fw * 8, y: (ty - fy) * 16 + 18, footprint: fw });
    return true;
  };
  for (const [kind, spec] of Object.entries(GATHER.nodes)) {
    const quota = CAMPAIGN.tuning.deployment.guaranteedLocal[spec.resource] || 0;
    let left = quota, insideLeft = Math.ceil(quota * CAMPAIGN.tuning.deployment.localInsidePerimeterShare);
    while (left > 0) {
      const size = spec.large && left >= spec.large.stock * 1.5 ? 'large' : 'small', stock = Math.min(spec[size].stock, left);
      const pool = insideLeft > 0 ? inside : outside.length ? outside : inside;
      partial.debris = debris;
      if (!place(pool, kind, size, stock) && !(pool !== inside && place(inside, kind, size, stock))) return fail(`not enough open ground for ${spec.resource} debris`);
      left -= stock; if (pool === inside) insideLeft -= stock;
    }
  }

  // 6. Regional sites on the map's real locations, by walking distance band and location type.
  yield { phase: 8 };
  const cap = p => W.siteCapacity[p.type] || 1;
  const pois = (meta.pois || []).map(p => {
    // The nearest reachable tile within the location stands for it.
    let best = -1, bestD = Infinity;
    for (let j = -p.r; j <= p.r; j++) for (let i = -p.r; i <= p.r; i++) { const X = Math.round(p.x) + i, Y = Math.round(p.y) + j; if (!a.inb(X, Y)) continue; const k = a.I(X, Y), d = Math.hypot(i, j); if (dist[k] >= 0 && d < bestD) { best = k; bestD = d; } }
    return { ...p, tile: best, walk: best >= 0 ? dist[best] : -1, hosted: [] };
  }).filter(p => p.walk >= 0);
  const order = ['near', 'far', 'mid'];
  const defs = Object.entries(CAMPAIGN.sites).sort((p, q) => order.indexOf(p[1].band) - order.indexOf(q[1].band));
  const sites = [];
  for (const [id, def] of defs) {
    const [blo, bhi] = R.bands[def.band], mid = (blo + bhi) / 2;
    const score = p => (p.walk < blo ? blo - p.walk : p.walk > bhi ? p.walk - bhi : 0) * 2 + (def.preferredPoiTypes.includes(p.type) ? 0 : 8) + p.hosted.length * 4 + Math.abs(p.walk - mid) * 0.05;
    const poi = pois.filter(p => p.hosted.length < cap(p)).sort((p, q) => score(p) - score(q))[0];
    let tile, walk, poiId = null, poiName = '';
    if (poi) { poi.hosted.push(id); tile = poi.tile; walk = poi.walk; poiId = poi.id; poiName = poi.name; }
    else {
      // No location left: a roadside spot at the right distance, clear of the other sites.
      let best = -1, bestScore = Infinity;
      for (let k = 0; k < a.N; k++) {
        if (!ROAD.has(a.terr[k]) || dist[k] < 0) continue;
        const x = k % a.w, y = (k - x) / a.w;
        if (sites.some(s => Math.hypot(s.tx - x, s.ty - y) < 8)) continue;
        const s = Math.abs(dist[k] - mid); if (s < bestScore) { bestScore = s; best = k; }
      }
      if (best < 0) { partial.sites = sites; return fail(`no place for ${def.name}`); }
      tile = best; walk = dist[best];
    }
    const tx = tile % a.w, ty = (tile - tx) / a.w;
    sites.push({ id, poiId, poiName, tx, ty, ...toSim(tx, ty), walkTiles: walk, inBand: walk >= blo && walk <= bhi, revealed: def.kind !== 'story' || def.revealed !== false, stock: { ...(def.stock || {}) } });
  }

  return {
    ok: true, failures, attempt,
    region: { ...partial, scale: R, patches, debris, sites, exits, landingShare: Math.round(good / total * 100) / 100 },
  };
}

// How much of the region a failed survey managed to place, to choose the best one.
const completeness = r => (r.region?.corridor ? 1 : 0) + (r.region?.patches?.length || 0) + (r.region?.debris?.length || 0) / 10 + (r.region?.sites?.length || 0);

// ---------------------------------------------------------------- Deployment
// The loading screen's steps. The game has been reset into a campaign camp (crew, tents, cache) before this
// runs; this generates and audits the region, then lands the camp in it. The last value is { deployed: true }.
export function* deploymentSteps(game, settings) {
  const S = campaignSettings(settings), seed = S.seed, R = regionScaleOf(S.mapSize);
  const size = (W.mapSizes[S.mapSize] || W.mapSizes.standard).worldgen;
  const say = (n, progress, extra = '') => ({ progress, activity: copy(STEPS[n - 1]) + extra });
  yield say(1, 0.02);
  let chosen = null, best = null;
  for (let attempt = 0; attempt < W.landingAttempts && !chosen; attempt++) {
    yield say(2, 0.05 + 0.4 * attempt / W.landingAttempts, attempt ? ` (survey ${attempt + 1} of ${W.landingAttempts})` : '');
    yield say(3, 0.06 + 0.4 * attempt / W.landingAttempts);
    const { map, meta } = generate({ ...(settings.world || {}), size, seed: seedStream(seed, 'terrain', attempt) });
    const audit = auditRegion(map, meta, { seed, attempt, mapSize: S.mapSize });
    let r;
    while (!(r = audit.next()).done) yield say(r.value.phase, 0.5 + r.value.phase * 0.03);
    const result = { map, meta, ...r.value };
    if (result.ok) chosen = result;
    else if (!best || completeness(result) > completeness(best)) best = result;
  }
  let fallback = null;
  if (!chosen) {
    // The approved fallback clearing: the seed's surveys again without water, audited less strictly. If even
    // that fails, the most complete survey is used as it stands.
    yield { progress: 0.8, activity: copy('deploy_fallback') };
    for (let attempt = 0; attempt < 8 && !chosen; attempt++) {
      const { map, meta } = generate({ size, seed: seedStream(seed, 'terrain', attempt), rivers: false, lakes: false, ponds: false, swamps: false });
      const audit = auditRegion(map, meta, { seed, attempt: W.landingAttempts + attempt, mapSize: S.mapSize, relaxed: true });
      let r; while (!(r = audit.next()).done);
      if (r.value.ok) chosen = { map, meta, ...r.value };
    }
    fallback = { reason: best?.failures?.[0] || 'unknown', relaxedPassed: !!chosen };
    chosen ??= best;
    console.warn('AfterLife deployment fallback for seed ' + seed + ': ' + fallback.reason);
  }
  yield say(9, 0.9);
  // Reserved patches on wooded ground have their trees cleared.
  for (const p of chosen.region?.patches || []) if (p.cleared) chosen.map.objs = chosen.map.objs.filter(o => !(o.tx >= p.tx && o.tx < p.tx + p.size && o.ty >= p.ty && o.ty < p.ty + p.size && (kindOf(o) === 'foliage' || kindOf(o) === 'ground')));
  applyWorldToGame(game, chosen.map, chosen.meta);
  const region = chosen.region || {};
  game.debris = region.debris || [];
  game.campaign.region = {
    id: regionIdOf(seed, W.regionLetters), seed, mapSize: S.mapSize, attempt: chosen.attempt, fallback,
    protectedRadius: R.protectedRadius * 16, localRadius: R.localRadius * 16, patches: region.patches || [], corridor: region.corridor || null, sites: region.sites || [],
  };
  game.landRevision++;
  yield say(10, 0.96);
  game.deployCampaign();
  return { progress: 1, activity: copy(STEPS[10]), done: true, deployed: true };
}

export class Deployment {
  // Starts a new campaign: a fresh camp with the deployment package, then the region's generation in steps.
  beginCampaign(settings = {}) {
    const S = campaignSettings({ ...settings, seed: seedFromText(settings.seed, this.random) });
    this.mode = 'campaign';
    this.start = 'camp';
    this.campaignSettings = { ...S, world: settings.world || {} };
    this.reset();
    this._worldGeneration = deploymentSteps(this, this.campaignSettings);
  }
  // The landing: Phase 1 begins, the deployment autosave is written, and CentroCom and Mara write in.
  deployCampaign() {
    const c = this.campaign, vars = { overseerName: c.settings.overseerName, regionId: c.region?.id || '' };
    c.phase = 1;
    // The task chain starts: P1-01 brings CentroCom's welcome and Mara's first note.
    this.initTasks();
    this.requestAutosave('Deployment - Day 1');
  }
}
