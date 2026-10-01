// M7: campaign Phase 2 operations (P2-01 ... P2-05). The Operations Board's teams walking to real sites and
// back, eligibility, rations, carry capacity, finite site stock and recurring routes, site events, the infected
// reaching a team, the Salvage Yard, the Workshop's second operator, the Storage Depot, saves mid-mission and
// the chain played headless.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HOUR_SECONDS } from '../web/src/engine/model.mjs';
import { CAMPAIGN } from '../web/src/engine/campaignState.mjs';
import { campaignMaxHp, laborFactor } from '../web/src/engine/crew.mjs';

const O = CAMPAIGN.tuning.operations;
function deploy(seed = 'operations', mapSize = 'standard') {
  const g = new Game();
  g.beginCampaign({ seed, mapSize, overseerName: 'Rook' });
  let s; do s = g.advanceWorldGeneration(); while (!s.done);
  return g;
}
const hours = (g, h, step = 1) => { for (let t = 0; t < h * HOUR_SECONDS; t += step) g.step(step); };
const task = g => g.currentTask?.code;
// The nearest legal spot on the 16-unit grid inside the protected perimeter.
function spot(g, type) {
  const r = g.campaign.region.protectedRadius, out = [];
  for (let x = -r; x <= r; x += 16) for (let y = -r; y <= r; y += 16) if (Math.hypot(x, y) <= r && Math.hypot(x, y) >= 64) out.push([x, y]);
  const p = out.sort((a, b) => Math.hypot(...a) - Math.hypot(...b)).find(([x, y]) => g.canPlace(type, x, y, 0).ok);
  if (!p) throw new Error('no spot for ' + type);
  return p;
}
function raise(g, type) { g.freeBuild = true; const b = g.build(type, ...spot(g, type), 0); g.freeBuild = false; return b; }
// Phase 2 with an Operations Board; the trickle of infected kept off unless a test wants it.
function phase2(seed) {
  const g = deploy(seed);
  for (const id of ['p1_01', 'p1_02', 'p1_03', 'p1_04', 'p1_05', 'p1_06', 'p1_07', 'p1_08', 'p1_09', 'p1_10']) g.completeTask(id);
  g.beginPhase2(); g.campaign.threatsActive = false;
  raise(g, 'operations_board');
  return g;
}
const runUntilHome = (g, max = 30) => { for (let t = 0; t < max * HOUR_SECONDS && g.mission; t++) g.step(1); };
const ids = (g, ...i) => i.map(k => g.survivors[k].id);

test('sites open with their tasks; travel is max(0.5, path tiles / 80) each way; the first two runs carry no event risk', () => {
  const g = phase2('sites');
  assert.equal(task(g), 'P2-01');
  assert.equal(g.siteOpen('grocery_annex'), true);
  assert.equal(g.siteOpen('hardware_yard'), false, 'with P2-02');
  assert.equal(g.siteOpen('old_access_road'), false, 'story sites go out as expeditions');
  const rec = g.siteRecord('grocery_annex');
  assert.equal(g.oneWayHours('grocery_annex'), Math.max(.5, rec.walkTiles / 80));
  const team = g.survivors.slice(0, 2);
  assert.equal(g.eventChance('grocery_annex', team), 0, 'a supervised first run');
  g.campaign.operations.safeRuns = 2;
  const agi = team.reduce((n, s) => n + s.stats.agi, 0) / 2;
  assert.ok(Math.abs(g.eventChance('grocery_annex', team) - Math.min(.5, Math.max(.02, .15 - .01 * (agi - 5)))) < 1e-9);
  assert.equal(g.carryCapacity(team), team.reduce((n, s) => n + 15 + 2 * s.stats.str, 0));
});

test('eligibility: no downed, infection over 50, health under 60% or fatigue over 70', () => {
  const g = phase2('eligible'), s = g.survivors[0];
  assert.equal(g.eligibility(s), '');
  s.infection = 51; assert.match(g.eligibility(s), /Infection/); s.infection = 0;
  s.hp = campaignMaxHp(s) * .59; assert.match(g.eligibility(s), /Health/); s.hp = campaignMaxHp(s);
  s.fatigue = 71; assert.match(g.eligibility(s), /Fatigue/); s.fatigue = 0;
  g.down(s); assert.equal(g.eligibility(s), 'Downed');
});

test('launching: a board, 2-3 residents, one team at a time, rations reserved and beds kept', () => {
  const g = phase2('launch');
  assert.match(g.missionBlock('grocery_annex', ids(g, 0)), /Choose 2-3/);
  assert.match(g.missionBlock('grocery_annex', ids(g, 0, 1, 2, 3)), /Choose 2-3/);
  const food = g.available('food'), [a, b] = g.survivors, homes = [a.home, b.home];
  const m = g.launchMission('grocery_annex', ids(g, 0, 1));
  assert.ok(m);
  assert.equal(g.reserved.food, m.rations);
  assert.equal(g.available('food'), food - m.rations);
  assert.deepEqual([a.home, b.home], homes, 'they keep their beds');
  assert.match(g.missionBlock('grocery_annex', ids(g, 2, 3)), /already out/);
  for (const k of ['assemble_team', 'inspect_grocery', 'launch_scavenging']) assert.equal(g.campaign.tasks.p2_01.counters[k], 1, k);
  assert.equal(g.campWorker(a), false, 'out of camp work');
});

test('the Grocery run: out and back in the formula’s hours, 24 Food and 12 Cloth home, the report, then P2-02', () => {
  const g = phase2('grocery');
  hours(g, .1);
  const m = g.launchMission('grocery_annex', ids(g, 0, 1)), t0 = g.elapsed;
  let there = null, left = null;
  for (let t = 0; t < 12 * HOUR_SECONDS && g.mission; t++) {
    g.step(1);
    if (there == null && g.mission?.phase === 'site') there = (g.elapsed - t0) / HOUR_SECONDS;
    if (left == null && g.mission?.phase === 'return') left = (g.elapsed - t0) / HOUR_SECONDS;
  }
  const home = (g.elapsed - t0) / HOUR_SECONDS;
  assert.ok(Math.abs(there - m.oneWay) < m.oneWay * .15 + .05, `out ${there} vs ${m.oneWay}`);
  assert.ok(Math.abs(left - there - m.siteHours) < .05);
  assert.ok(Math.abs(home - left - m.oneWay) < m.oneWay * .15 + .05, `back ${home - left} vs ${m.oneWay}`);
  const r = g.campaign.operations.reports[0];
  assert.deepEqual(r.cargo, { food: 24, cloth: 12 });
  assert.equal(g.reserved.food, 0, 'rations settled');
  assert.equal(g.metric('firstGroceryReturned'), true);
  assert.equal(g.metric('unloadedGroceryFood'), 24);
  assert.ok(g.messages.some(x => x.action?.kind === 'report'));
  hours(g, .05);
  assert.equal(task(g), 'P2-02');
  g.reviewReport(); hours(g, .05);
  assert.equal(task(g), 'P2-03');
  assert.match(g.siteBlock('grocery_annex'), /Depleted/);
});

test('a team carries Σ(15 + 2·STR); the rest waits at the site for the next run', () => {
  const g = phase2('carry');
  for (const id of ['p2_01', 'p2_02']) g.completeTask(id);
  const team = g.survivors.slice(0, 2);
  for (const s of team) s.stats.str = 5;
  g.launchMission('hardware_yard', team.map(s => s.id)); runUntilHome(g);
  assert.deepEqual(g.campaign.operations.reports[0].cargo, { raw_salvage: 50 });
  assert.deepEqual(g.siteState('hardware_yard').stock, { raw_salvage: 30, wood: 30, components: 4 });
  for (const s of team) s.fatigue = 0;
  g.launchMission('hardware_yard', team.map(s => s.id)); runUntilHome(g);
  assert.deepEqual(g.campaign.operations.reports[0].cargo, { raw_salvage: 30, wood: 20 });
  assert.equal(g.metric('recoveredRawSalvage'), 80);
});

test('the Scrapyard Route recovers 48 hours after a run, restocked with its 0-10 bonus', () => {
  const g = phase2('route');
  for (const id of ['p2_01', 'p2_02', 'p2_03']) g.completeTask(id);
  assert.ok(g.siteOpen('scrapyard_route'));
  g.launchMission('scrapyard_route', ids(g, 0, 1)); runUntilHome(g);
  assert.match(g.siteBlock('scrapyard_route'), /Route recovering/);
  g.elapsed += 48 * HOUR_SECONDS;
  const stock = g.siteState('scrapyard_route').stock.raw_salvage;
  assert.ok(stock >= 30 && stock <= 40, 'stock ' + stock);
  assert.equal(g.siteBlock('scrapyard_route'), '');
});

test('site events: a two-hour delay; an injury softened by a kit or by ammunition; a fifth of non-task cargo lost', () => {
  const g = phase2('events');
  g.campaign.operations.safeRuns = 2;
  for (const id of ['p2_01', 'p2_02']) g.completeTask(id);
  const team = g.survivors.slice(0, 2);
  const roll = (...vals) => { const q = [...vals]; g.random = () => q.length ? q.shift() : .99; };
  // Delay.
  let m = { site: 'abandoned_clinic', delay: 0, injuries: [], event: null };
  roll(0, 0); g.arriveAtSite(m, team);
  assert.deepEqual([m.event, m.delay], ['delay', 2]);
  // Injury: a kit makes it −5, ammunition −8 and two rounds, otherwise −15.
  for (const [setup, hp] of [[() => { g.campaign.stock.first_aid_kit = 1; }, 5], [() => { g.resources.ammo = 4; }, 8], [() => { g.resources.ammo = 0; }, 15]]) {
    setup(); const s = team[0]; s.hp = 100; m = { site: 'abandoned_clinic', delay: 0, injuries: [], event: null };
    roll(0, .6, 0); g.arriveAtSite(m, team);
    assert.deepEqual([m.event, 100 - s.hp], ['injury', hp]);
  }
  assert.equal(g.resources.ammo, 0);
  // Cargo loss spares what the current task is waiting on (raw salvage during P2-03).
  m = { site: 'hardware_yard', delay: 0, injuries: [], event: 'cargoLoss', capacity: 120, cargo: {} };
  g.loadCargo(m, 1);
  assert.deepEqual(m.cargo, { raw_salvage: 80, wood: 24, components: 3 });
});

test('the infected on the map can reach a team on the road', () => {
  const g = phase2('ambush');
  g.launchMission('grocery_annex', ids(g, 0, 1));
  hours(g, .15);
  const s = g.survivors[0], z = g.spawnZombie(0);
  Object.assign(z, { x: s.x + 30, y: s.y, speed: 20 });
  const hp = s.hp + g.survivors[1].hp;
  let fought = false;
  for (let t = 0; t < 120 && z.hp > 0; t++) { g.step(.5); fought ||= g.survivors.slice(0, 2).some(x => x.fighting); }
  assert.ok(fought, 'they fight it');
  assert.ok(z.hp <= 0 || g.survivors[0].hp + g.survivors[1].hp < hp);
});

test('a downed teammate turns the team round and a teammate carries the rescue', () => {
  const g = phase2('downed-team');
  g.launchMission('grocery_annex', ids(g, 0, 1, 2));
  hours(g, .2);
  const [a] = g.survivors;
  g.down(a); g.step(1);
  assert.equal(g.mission.phase, 'return');
  assert.ok(g.mission.recalled);
  assert.ok(g.mission.team.includes(g.survivors.find(s => s.rescue === a.id)?.id), 'a teammate goes to them');
});

test('the Salvage Yard turns 6 Raw Salvage into 4 Scrap Metal per worker-hour', () => {
  const g = phase2('salvage');
  for (const id of ['p2_01', 'p2_02']) g.completeTask(id);
  const yard = raise(g, 'salvage_yard'), w = g.survivors[0];
  assert.ok(g.post(w.id, yard.id));
  assert.equal(w.role, 'logger');
  g.resources.raw_salvage = 60;
  Object.assign(w, g.goalFor(w, yard), { path: [] });
  const scrap = g.resources.scrap_metal;
  g.salvageTick(HOUR_SECONDS);
  const used = 60 - g.resources.raw_salvage;
  assert.ok(used > 0);
  assert.ok(Math.abs((g.resources.scrap_metal - scrap) / used - 4 / 6) < 1e-9);
  assert.ok(Math.abs(g.campaign.tasks.p2_03.counters.process_scrap - used * 4 / 6) < 1e-9);
  g.resources.raw_salvage = 0; g.salvageTick(HOUR_SECONDS);
  assert.equal(w.task, 'no-salvage');
});

test('the Workshop: a 20-order queue, Planks and Metal Parts, a second operator at 0.75', () => {
  const g = phase2('workshop');
  for (const id of ['p2_01', 'p2_02', 'p2_03']) g.completeTask(id);
  const ws = raise(g, 'workshop'), [a, b] = g.survivors;
  g.post(a.id, ws.id); g.post(b.id, ws.id);
  // Enough for twenty orders without overflowing storage (which would hold the output).
  g.resources.wood = 100; g.resources.scrap_metal = 90;
  for (let i = 0; i < 20; i++) assert.ok(g.queueCraft(ws.id, i % 2 ? 'c05' : 'c04'));
  assert.equal(g.queueCraft(ws.id, 'c04'), false, 'twenty orders');
  for (const s of [a, b]) Object.assign(s, g.goalFor(s, ws), { path: [] });
  const p0 = ws.queue[0].progress;
  g.craftWork(a, ws, g.statsOf(a), 1); const one = ws.queue[0].progress - p0;
  g.craftWork(b, ws, g.statsOf(b), 1); const two = ws.queue[0].progress - p0 - one;
  assert.ok(Math.abs(two / one - .75 * laborFactor(b, 'craft') / laborFactor(a, 'craft')) < 1e-9, 'the second works at 0.75');
  for (let i = 0; i < 4000 && ws.queue.length > 18; i++) g.craftWork(a, ws, g.statsOf(a), 1);
  assert.equal(g.resources.planks, 5); assert.equal(g.resources.metal_parts, 3);
});

test('a Storage Depot adds 1000: P2-05 completes once overflow is gone', () => {
  const g = phase2('depot');
  for (const id of ['p2_01', 'p2_02', 'p2_03', 'p2_04']) g.completeTask(id);
  assert.equal(task(g), 'P2-05');
  raise(g, 'supply_stash');
  const before = g.storageCapacity;
  g.resources.wood += 2000;
  assert.ok(g.outputBlocked);
  raise(g, 'storage_depot');
  assert.equal(g.storageCapacity, before + 1000);
  hours(g, .05);
  assert.equal(task(g), 'P2-05', 'still overflowing');
  g.resources.wood -= 1500;
  hours(g, .05);
  assert.equal(task(g), 'P2-06');
});

test('a team out walking survives a save and reload and still comes home', () => {
  const g = phase2('persist-m7');
  g.launchMission('grocery_annex', ids(g, 0, 1));
  hours(g, .2);
  const loaded = new Game(), data = g.serialize();
  assert.ok(loaded.restore(data), loaded.restoreError(data));
  assert.deepEqual(loaded.mission, g.mission);
  assert.deepEqual(loaded.reservations, g.reservations);
  runUntilHome(loaded);
  assert.deepEqual(loaded.campaign.operations.reports[0].cargo, { food: 24, cloth: 12 });
  assert.equal(loaded.reserved.food, 0);
});

test('the ambient trickle holds off while a supervised first run is out', () => {
  const g = phase2('safe-runs');
  g.campaign.threatsActive = true; g.campaign.threatTimer = 1;
  g.launchMission('grocery_annex', ids(g, 0, 1));
  hours(g, 1);
  assert.equal(g.zombies.length, 0);
});

test('P2-01 to P2-05 play through headless', () => {
  const g = phase2('chain');
  const plots = [raise(g, 'garden_plot'), raise(g, 'garden_plot')]; raise(g, 'supply_stash');
  g.post(g.survivors[0].id, plots[0].id); g.post(g.survivors[1].id, plots[1].id);
  const place = t => g.build(t, ...spot(g, t), 0), built = b => { for (let h = 0; h < 30 && b.blueprint; h++) hours(g, 1); };
  g.launchMission('grocery_annex', ids(g, 2, 3)); runUntilHome(g); g.reviewReport(); hours(g, .1);
  assert.equal(task(g), 'P2-03');
  g.launchMission('hardware_yard', ids(g, 2, 3, 4)); runUntilHome(g);
  const yard = place('salvage_yard'); built(yard); g.post(g.survivors[4].id, yard.id);
  for (let h = 0; h < 30 && task(g) === 'P2-03'; h++) hours(g, 1);
  assert.equal(task(g), 'P2-04');
  const ws = place('workshop'); built(ws); g.post(g.survivors[3].id, ws.id); g.post(g.survivors[2].id, ws.id);
  // Room for the materials (overflow holds a workshop's output, which is P2-05's point).
  raise(g, 'supply_stash');
  g.resources.wood += 60; g.resources.scrap_metal += 60;
  for (let i = 0; i < 6; i++) g.queueCraft(ws.id, 'c04'); for (let i = 0; i < 5; i++) g.queueCraft(ws.id, 'c05');
  for (let h = 0; h < 40 && (task(g) === 'P2-04' || g.available('planks') < 25 || g.available('metal_parts') < 15); h++) hours(g, 1);
  assert.equal(task(g), 'P2-05', JSON.stringify({ q: ws.queue.length, planks: g.available('planks'), parts: g.available('metal_parts'), wood: g.available('wood'), scrap: g.available('scrap_metal'), over: g.overflow, staff: g.staffOf(ws).map(s => s.task) }));
  assert.ok(g.available('planks') >= 25 && g.available('metal_parts') >= 15, JSON.stringify({ q: ws.queue.length, planks: g.available('planks'), parts: g.available('metal_parts'), over: g.overflow, staff: g.staffOf(ws).map(s => s.task) }));
  const depot = place('storage_depot'); built(depot);
  for (let h = 0; h < 10 && task(g) === 'P2-05'; h++) hours(g, 1);
  assert.equal(task(g), 'P2-06');
  assert.equal(g.storageCapacity, 600 + 2 * 200 + 1000);
  assert.deepEqual(g.reservations, {});
});
