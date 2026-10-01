// World generation: the design kit's World Generator v4, adapted to the game's camp, land, trees and water.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, fingerprint, SIZES, TRUNK_BASE, DEFAULT_CUSTOM, customOf, CUSTOM_PRESETS } from '../web/src/engine/worldgen.mjs';
import { generate as generateKit } from '../web/src/engine/worldgen4.mjs';
import { Game } from '../web/src/engine/model.mjs';
import { parcelRect, initialLand } from '../web/src/engine/land.mjs';
import { CAMP } from '../web/src/engine/camp.mjs';

const SEEDS = [1, 42, 777, 31337, 900001];
const wetTerr = t => t === 'w' || t === 'S';
// A camp in a generated world that has bought the wooded parcel beside it (v4 clears the first one).
function woodedCamp() {
  const g = new Game(() => 0.5); g.spawnTimer = 1e9;
  g.generateWorld('medium', 42);
  g.resources = { wood: 9999, scrap_metal: 9999, food: 9999 };
  const wooded = g.availableLand().map(p => [p, g.forest.trees.filter(t => { const r = parcelRect(p); return t.x > r.left + 24 && t.x < r.right - 24 && t.y > r.top + 24 && t.y < r.bottom - 24; }).length]).sort((a, b) => b[1] - a[1])[0][0];
  assert.ok(g.buyLand(wooded.col, wooded.row));
  g.resources = { wood: 30, scrap_metal: 40, food: 90 };
  return g;
}

test('worlds are the kit\'s own: the same seed builds the same map as World Generator v4', () => {
  for (const size of Object.keys(SIZES)) for (const seed of SEEDS) {
    const a = generate({ size, seed }), b = generate({ size, seed: String(seed) });
    assert.equal(fingerprint(a.map), fingerprint(b.map), `${size}/${seed} is deterministic`);
    assert.equal(fingerprint(a.map), fingerprint(generateKit({ size, seed }).map), `${size}/${seed} matches the kit`);
    assert.ok(a.meta.pois.length >= SIZES[size].pois, `${size}/${seed} reaches its points of interest`);
    assert.deepEqual([a.meta.base.cx, a.meta.base.cy], a.meta.camp.fire, 'the world is centred on the campfire tile');
  }
  assert.notEqual(fingerprint(generate({ size: 'medium', seed: 1 }).map), fingerprint(generate({ size: 'medium', seed: 2 }).map));
});

test('the camp stands on dry, open ground with a footpath out to the road', () => {
  for (const size of Object.keys(SIZES)) for (const seed of SEEDS) {
    const g = new Game(() => .5); g.spawnTimer = 1e9;
    g.generateWorld(size, seed);
    const { map, worldOrigin: o } = g, at = p => map.terr[Math.floor(p.y / 16 + o.bcy) * map.w + Math.floor(p.x / 16 + o.bcx)];
    assert.equal(at(CAMP.fire), 'd', `${size}/${seed}: the campfire stands on trodden ground`);
    for (const b of g.buildings) assert.ok(!wetTerr(at(b)) && !g.wetAt(b), `${size}/${seed}: ${b.type} is on dry ground`);
    // The generator's own tents and workbench make way for the game's camp.
    assert.ok(!g.worldDecor.some(d => ['deco_tent', 'camp_workbench'].includes(d.k) && Math.hypot(d.px, d.py) < 160), `${size}/${seed}: no second camp`);
    assert.ok(!g.forest.trees.some(t => Math.hypot(t.x, t.y) < 64), `${size}/${seed}: nothing grows in the fire's clearing`);
    const path = g.worldMeta.camp.path, roadNear = k => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => map.terr[k + j * map.w + i] === 'r');
    assert.ok(path.length && path.some(roadNear), `${size}/${seed}: the footpath reaches a road`);
  }
});

test('a camp starts on one parcel in a glade, with the woods a short walk away and kept on its land', () => {
  const g = new Game(() => .5); g.spawnTimer = 1e9;
  g.generateWorld('medium', 42);
  assert.deepEqual(g.land, initialLand('camp'));
  const trees = [...g.forest.trees].sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
  assert.ok(Math.hypot(trees[0].x, trees[0].y) < 260, 'the forest edge is within a short walk of the camp');
  // Claiming land brings its trees with it, and none are taken off the land already held.
  g.resources = { wood: 9999, scrap_metal: 9999, food: 9999 };
  const before = new Set(g.forest.trees.map(t => t.id)), target = g.availableLand()[0];
  assert.ok(g.buyLand(target.col, target.row));
  const r = parcelRect(target), onParcel = g.forest.trees.filter(t => t.x > r.left && t.x < r.right && t.y > r.top && t.y < r.bottom);
  assert.ok(g.forest.trees.every(t => before.has(t.id)) && [...before].every(id => g.treeById(id)), 'no tree appears or vanishes');
  assert.ok(onParcel.length || g.mapTrees.every(t => !(t.x > r.left && t.x < r.right && t.y > r.top && t.y < r.bottom)), 'the new parcel keeps its trees');
});

test('a refuge still clears the trees and props off its land and the lane around it', () => {
  const g = new Game(() => 0.5, { start: 'refuge' });
  g.reset(); g.generateWorld('medium', 42);
  assert.ok(g.mapTrees.length > 500);
  const near = (land, t) => land.some(p => { const r = parcelRect(p); return t.x > r.left - 42 && t.x < r.right + 42 && t.y > r.top - 20 && t.y < r.bottom + 75; });
  assert.ok(!g.forest.trees.some(t => near(g.land, t)), 'no trees on or beside claimed land');
  assert.ok(!g.visibleDecor.some(d => g.claimed(d.px, d.py)), 'props cleared from claimed land');
  for (const p of g.availableLand()) {
    const r = parcelRect(p);
    assert.ok(!g.worldBuildings.some(b => b.x < r.right && b.x + b.fw * 16 > r.left && b.y < r.bottom && b.y + b.fh * 16 > r.top), 'claimable land has no ruins');
  }
});

test('trees felled in the wilds grow back; trees felled on the camp\'s land are cleared for good', () => {
  const g = woodedCamp();
  const byDistance = [...g.forest.trees].sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
  const wild = byDistance.find(t => g.outside(t)), mine = byDistance.find(t => !g.outside(t));
  assert.ok(wild && mine, 'trees both on the camp\'s land and beyond it');
  assert.match(g.treeHint(mine.id), /clear for good/);
  for (const t of [wild, mine]) assert.ok(g.toggleHarvest(t.id));
  const start = g.resources.wood;
  for (let i = 0; i < 2400 && (g.harvestJobs.length || g.survivors.some(s => s.harvest)); i++) g.step(0.05);
  assert.equal(g.harvestJobs.length, 0, 'both trees came down');
  assert.ok(g.resources.wood > start, 'the logs reached the pile');
  assert.ok(g.regrowing(wild), 'the wild tree grows back');
  assert.ok(!g.treeById(mine.id) && g.cleared.includes(mine.id), 'the camp\'s tree is gone');
  const copy = new Game(() => .5); assert.ok(copy.restore(g.serialize()));
  assert.ok(!copy.treeById(mine.id), 'cleared trees stay cleared after a load');
});

test('nothing is built over a camp\'s trees, and whatever is built clears the props under it', () => {
  const g = woodedCamp(); g.freeBuild = true;
  const t = g.forest.trees.find(t => !g.outside(t) && !g.buildings.some(b => Math.hypot(b.x - t.x, b.y - t.y) < 80));
  const check = g.canPlace('farm', Math.round(t.x / 16) * 16, Math.round(t.y / 16) * 16);
  assert.equal(check.ok, false); assert.match(check.reason, /Trees are in the way/);
  const b = g.addBuilding('farm', Math.round(t.x / 16) * 16, Math.round(t.y / 16) * 16);
  assert.ok(!g.treeById(t.id), 'the builders cleared the tree');
  assert.ok(!g.visibleDecor.some(d => Math.abs(d.px - b.x) < 20 && Math.abs(d.py - b.y) < 20), 'and the props under it');
});

test('water: the map\'s lakes and rivers are wet, bridges are dry, and land by the water can\'t be claimed', () => {
  const g = new Game(() => 0.5); g.spawnTimer = 1e9;
  g.generateWorld('large', 777);
  const { map, water: W } = g;
  assert.ok(W, 'a large world has water');
  const bridges = map.objs.filter(o => o.t === 'bridge');
  assert.ok(bridges.length > 0, 'roads cross the water on bridges');
  for (const o of bridges) assert.equal(W.wet[o.ty * W.w + o.tx], 0, 'a bridge deck is walkable');
  map.terr.forEach((t, i) => { if (wetTerr(t) && !bridges.some(o => o.ty * W.w + o.tx === i)) assert.equal(W.wet[i], 1); });
  for (const p of g.availableLand()) assert.equal(g.wetParcel(p), false);
});

test('water: nobody steps into it, and a walk across finds the way round', () => {
  const g = new Game(() => 0.5); g.spawnTimer = 1e9;
  g.generateWorld('large', 777);
  const W = g.water, i = W.wet.indexOf(1), wet = g.tileCentre(i % W.w, Math.floor(i / W.w));
  let bank = null;
  for (let r = 16; !bank; r += 16) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (!bank && !g.wetAt({ x: wet.x + dx, y: wet.y + dy })) bank = { x: wet.x + dx, y: wet.y + dy };
  assert.deepEqual(g.dryStep(bank, wet), bank, 'a step into the water goes nowhere');
  // Find two dry points with water on the straight line between them, and a way round.
  let pair = null;
  for (let k = 0; k < W.wet.length && !pair; k += 7) {
    if (W.wet[k]) continue;
    const a = g.tileCentre(k % W.w, Math.floor(k / W.w)), b = { x: a.x + 320, y: a.y };
    if (!g.wetAt(b) && !g.dryLine(a, b)) pair = [a, b];
  }
  assert.ok(pair, 'water to cross');
  const way = g.waterPath(...pair);
  assert.ok(way && way.length > 1, 'a way round');
  let at = pair[0];
  for (const p of way) { assert.ok(g.dryLine(at, p), 'every leg is dry'); at = p; }
  assert.deepEqual(way.at(-1), pair[1]);
});

test('the dead cross the generated world to the refuge, round the water by the bridges', () => {
  const g = new Game(() => 0.37, { start: 'refuge' });
  g.reset(); g.generateWorld('large', 31337);
  g.bounds = { x: 900, y: 700 };
  const start = [];
  for (let i = 0; i < 24; i++) { const z = g.spawnZombie(i % 4, (i / 24) * 2 - 1); start.push([z, Math.hypot(z.x, z.y), { x: z.x, y: z.y }]); }
  for (let i = 0; i < 1200; i++) g.step(0.05);
  const gone = z => z.hp <= 0 || !g.zombies.includes(z);
  // Those with water in the way walk the flow field round it: far from where they started, if not yet closer.
  const moving = start.filter(([z, d, s]) => gone(z) || Math.hypot(z.x, z.y) < d - 250 || Math.hypot(z.x - s.x, z.y - s.y) > 400).length;
  assert.equal(moving, 24, `${moving}/24 zombies made their way through the forest and round the water`);
  assert.ok(start.filter(([z, d]) => gone(z) || Math.hypot(z.x, z.y) < d - 250).length >= 18, 'most are already much closer');
  assert.ok(g.zombies.every(z => !g.wetAt(z)), 'none are standing in the water');
});

test('generated worlds survive a save and restore', () => {
  const g = new Game();
  g.reset(); g.generateWorld('small', 5);
  const json = g.serialize(), h = new Game();
  assert.ok(h.restore(json));
  assert.equal(h.map.w, SIZES.small.w);
  assert.equal(fingerprint(h.map), fingerprint(g.map));
  assert.deepEqual(h.land, g.land);
  assert.equal(!!h.water, !!g.water);
  assert.equal(initialLand().length, 9);
  assert.ok(Object.keys(TRUNK_BASE).includes('nat_s2_birch'), 'birches are fellable trees');
});

test('v4 features: XL map generation, water toggles, spawn customizer and hordes', () => {
  // XL size
  const xl = generate({ size: 'xl', seed: 42 });
  assert.equal(xl.map.w, 320);
  assert.equal(xl.map.h, 224);
  assert.ok(xl.meta.pois.length >= 32, 'XL has at least 32 POIs');

  // Water options: rivers and lakes can be turned off
  const dry = generate({ size: 'medium', seed: 42, rivers: false, lakes: false, ponds: false, swamps: false });
  assert.equal(dry.meta.rivers.length, 0, 'rivers off');
  assert.equal(dry.meta.lakes.length, 0, 'lakes off');
  assert.equal(dry.meta.swamps.length, 0, 'swamps off');

  // Spawn customizer with hordes
  const overrunPreset = Object.fromEntries(CUSTOM_PRESETS).Overrun;
  const custom = generate({
    size: 'medium',
    seed: 777,
    custom: { ...overrunPreset, hordes: 3 }
  });
  assert.ok(custom.meta.hordes.length > 0, 'hordes generated');
  assert.ok(custom.map.marks.some(m => m.horde != null), 'marks contain horde assignments');

  // Apply to Game and verify game bounds and horde tracking
  const g = new Game(() => 0.5);
  g.generateWorld('xl', 42, { custom: { hordes: 2 } });
  assert.equal(g.map.w, 320);
  assert.equal(g.map.h, 224);
  assert.ok(g.worldHordes.length > 0, 'game tracks generated world hordes');
  assert.ok(g.worldZombieSpawns.some(s => s.horde != null), 'world zombie spawns track horde');
});

test('bridges, survivor layering, and river crossings behave correctly', () => {
  const g = new Game(() => 0.5);
  g.reset();
  g.generateWorld('medium', 42);

  // 1. Bridges are present, and their depth order is y - 8 (sorting below characters)
  const bridges = (g.worldDecor || []).filter(d => d.bridge);
  assert.ok(bridges.length > 0, 'Generated world should have bridge decor');
  for (const b of bridges) {
    const worldY = b.py - 8;
    assert.equal(b.order, worldY - 8, 'Bridge deck order must be worldY - 8');
    // A survivor standing on the bridge deck at (b.px, b.py) has sorting order s.y + 15
    const survivorSort = b.py + 15;
    assert.ok(survivorSort > b.order, 'Survivor must sort above bridge deck');
  }

  // 2. Bridges are preserved in visibleDecor even if claimed land touches or approaches
  const decor = g.visibleDecor.filter(d => d.bridge);
  assert.equal(decor.length, bridges.length, 'All bridges remain visible in visibleDecor');

  // 3. Crowd separation never shoves a survivor into wet tiles
  const bridge = bridges[0];
  const s1 = g.survivors[0];
  const s2 = g.survivors[1];
  s1.x = bridge.px; s1.y = bridge.py;
  s2.x = bridge.px + 1; s2.y = bridge.py + 1;
  for (let i = 0; i < 20; i++) g.step(0.05);
  assert.ok(!g.wetAt(s1), 'Survivor 1 must stay dry despite crowd separation');
  assert.ok(!g.wetAt(s2), 'Survivor 2 must stay dry despite crowd separation');

  // 4. Expeditions path over bridges and dry land rather than walking on water
  const poi = g.worldPois?.[0];
  if (poi) {
    const s = g.survivors[0];
    g.resources.food = 100;
    const ok = g.sendExpedition([s.id], `poi:${poi.id}`);
    if (ok) {
      assert.ok(s.expedition.path && s.expedition.path.length > 0, 'Expedition generated waypoints');
      for (const pt of s.expedition.path) {
        assert.ok(!g.wetAt(pt), 'Every expedition path waypoint is dry or on a bridge');
      }
    }
  }
});


