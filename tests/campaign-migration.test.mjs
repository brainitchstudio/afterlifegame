// M6: the end of campaign Phase 1 (P1-09, P1-10). Makeshift Shelter and Shelter All / Seal / Release, the
// first migration along the corridor, emergency deliveries, side tasks S01-S05, the Established Camp checklist
// and its 12-hour hold, the Phase 2 transition, saves, and a headless run from deployment to Established Camp
// that kills nothing during the migration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HOUR_SECONDS } from '../web/src/engine/model.mjs';
import { CAMPAIGN } from '../web/src/engine/campaignState.mjs';

const M = CAMPAIGN.tuning.migration;
function deploy(seed = 'migration', mapSize = 'compact') {
  const g = new Game();
  g.beginCampaign({ seed, mapSize, overseerName: 'Rook' });
  let s; do s = g.advanceWorldGeneration(); while (!s.done);
  return g;
}
const hours = (g, h, step = 1) => { for (let t = 0; t < h * HOUR_SECONDS; t += step) g.step(step); };
const task = g => g.currentTask?.code;
function spot(g, type) {
  for (let r = 96; r < 300; r += 16) for (let a = 0; a < 24; a++) {
    const x = Math.round(Math.cos(a / 24 * 2 * Math.PI) * r / 16) * 16, y = Math.round(Math.sin(a / 24 * 2 * Math.PI) * r / 16) * 16;
    if (g.canPlace(type, x, y, 0).ok) return [x, y];
  }
  throw new Error('no spot for ' + type);
}
function raise(g, type) { g.freeBuild = true; const b = g.build(type, ...spot(g, type), 0); g.freeBuild = false; return b; }
// A camp at P1-09 with a shelter, the dead's trickle switched off.
function atP109(seed, { shelter = true } = {}) {
  const g = deploy(seed);
  for (const id of ['p1_01', 'p1_02', 'p1_03', 'p1_04', 'p1_05', 'p1_06', 'p1_07', 'p1_08']) g.completeTask(id);
  g.campaign.threatsActive = false;
  assert.equal(task(g), 'P1-09');
  return { g, shelter: shelter ? raise(g, 'makeshift_shelter') : null };
}
const shelterAllIn = g => { assert.ok(g.shelterAll()); for (let t = 0; t < 3 * HOUR_SECONDS && !g.atHome.every(s => s.sheltered); t += .5) g.step(.5); };

test('a Makeshift Shelter gives 8 emergency slots and no beds', () => {
  const { g, shelter } = atP109('slots');
  assert.equal(g.shelterCapacity(shelter), 8);
  assert.equal(g.beds(shelter), 0);
  assert.equal(g.metric('emergencyShelterCapacity'), 8);
});

test('Shelter All: the ill first, guards last, four through a door at a time, and a named list of who is left out', () => {
  const { g } = atP109('priority');
  const gp = raise(g, 'guard_post');
  for (let i = 0; i < 5; i++) g.addSurvivor('any', g.createCandidate('radio', {}, false));
  const guard = g.survivors[0], ill = g.survivors[9];
  g.post(guard.id, gp.id);
  ill.infection = 20;
  assert.ok(g.shelterAll());
  assert.equal(g.campaign.tasks.p1_09.counters.shelter_all, 1);
  assert.equal(g.campaign.shelter.outside.length, 2);
  assert.ok(g.campaign.shelter.outside.includes(guard.name), 'guards go last');
  assert.ok(ill.shelter != null, 'the ill go first');
  // Everyone at the door at once: four enter together, each taking ten game minutes.
  const b = g.shelters[0], inside = g.survivors.filter(s => s.shelter === b.id);
  for (const s of inside) Object.assign(s, g.goalFor(s, b), { path: [] });
  g.step(.5);
  assert.equal(inside.filter(s => s.entering > 0).length, M.shelterSimultaneous);
  for (let t = 0; t < M.shelterEntryMinutes / 60 * HOUR_SECONDS - 1; t += .5) g.step(.5);
  assert.equal(inside.filter(s => s.sheltered).length, 0);
  g.step(1.5);
  assert.equal(inside.filter(s => s.sheltered).length, M.shelterSimultaneous);
  assert.ok(g.workShift && !g.campWorker(g.survivors.find(s => !s.shelter && s.role === 'patrol') || g.survivors[1]), 'work is suspended');
});

test('sealing leaves anyone not yet inside outside; release waits for a clear route unless forced', () => {
  const { g } = atP109('seal');
  assert.ok(g.shelterAll());
  g.step(.5);
  assert.ok(g.sealShelter());
  assert.ok(g.atHome.every(s => s.shelter == null || s.sheltered));
  assert.ok(g.campaign.shelter.outside.length > 0, 'nobody was inside yet');
  g.campaign.migration.state = 'passage';
  assert.equal(g.releaseShelter(), false);
  assert.equal(g.releaseShelter(true), true);
  assert.equal(g.campaign.shelter, null);
  assert.ok(g.survivors.every(s => !s.sheltered || s.resting));
});

test('a sealed shelter is never noticed; an unsealed one with people inside is, at a quarter of an infected’s sight', () => {
  const { g, shelter } = atP109('noticed');
  shelterAllIn(g);
  const z = g.spawnZombie(0);
  Object.assign(z, { x: shelter.x + 30, y: shelter.y + 30 });
  assert.equal(g.shelterNoticed(shelter, z), true);
  g.sealShelter();
  assert.equal(g.shelterNoticed(shelter, z), false);
  assert.equal(g.sealedShelter(shelter), true);
  const hp = shelter.hp;
  Object.assign(z, { x: shelter.x - 60, y: shelter.y, speed: 20 });
  hours(g, .1, .25);
  assert.equal(shelter.hp, hp, 'not attacked');
});

test('the first migration: scheduled once everyone fits, 3 hours’ warning, 12 along the corridor over 2, clear after an hour', () => {
  const { g } = atP109('first-migration', { shelter: false });
  hours(g, .2);
  assert.equal(g.campaign.migration.state, 'none', 'not without shelter for everyone');
  raise(g, 'makeshift_shelter');
  g.step(1);
  const mg = g.campaign.migration;
  assert.equal(mg.state, 'warning');
  assert.equal(g.metric('firstMigrationTriggered'), true);
  assert.ok(Math.abs(mg.arriveAt - g.elapsed - M.first.warningHours * HOUR_SECONDS) < 2);
  assert.ok(g.messages.some(m => m.title === 'MIGRATION WARNING'));
  shelterAllIn(g); g.sealShelter();
  g.elapsed = mg.arriveAt; g.step(.5);
  assert.equal(mg.state, 'passage');
  const route = g.migrationRoute();
  assert.ok(route.length >= 2);
  const kills = g.kills;
  let most = 0;
  for (let t = 0; t < 12 * HOUR_SECONDS && mg.state !== 'cleared'; t += .5) { g.step(.5); most = Math.max(most, g.zombies.filter(z => z.migrant).length); }
  assert.equal(mg.spawned, M.first.count);
  assert.ok(most > 1 && most <= M.first.count);
  assert.equal(mg.state, 'cleared');
  assert.equal(g.kills, kills, 'nobody had to fight');
  assert.ok(mg.bestHold >= 1, 'sheltered and sealed through the passage');
  assert.equal(g.campaign.shelter, null, 'the shelters open by themselves');
  assert.ok(mg.cooldownUntil - g.elapsed > (M.cooldownHours - .1) * HOUR_SECONDS);
  hours(g, .1);
  assert.equal(task(g), 'P1-10');
});

test('a migrant drawn off its corridor rejoins it, and one that makes no headway leaves', () => {
  const { g } = atP109('rejoin');
  g.campaign.migration.state = 'passage';
  const route = g.migrationRoute(), z = g.spawnZombie(0);
  Object.assign(z, { ...route[1], migrant: true, route, routeIndex: 3, chased: true });
  g.migrantHeading(z, .5);
  assert.ok(z.routeIndex <= 2, 'back to the nearest waypoint');
  z.chased = false;
  for (let i = 0; i < 40 && z.hp > 0; i++) g.migrantHeading(z, .5);
  assert.equal(z.hp, 0); assert.ok(z.left);
});

test('certification: eight live checks, a 12-hour hold that resets on any failure, then Established Camp and Phase 2', () => {
  const g = deploy('certify');
  for (const id of ['p1_01', 'p1_02', 'p1_03', 'p1_04', 'p1_05', 'p1_06', 'p1_07', 'p1_08', 'p1_09']) g.completeTask(id);
  g.campaign.threatsActive = false;
  assert.equal(task(g), 'P1-10');
  const items = () => Object.fromEntries(g.certificationChecklist().map(i => [i.id, i.ok]));
  assert.deepEqual(Object.keys(items()), ['tasks', 'population', 'housing', 'food', 'medical', 'workshop', 'defense', 'radio']);
  assert.equal(items().tasks, true);
  assert.equal(items().population, false, 'five is not six');
  // Build the camp the checklist wants.
  const [a, b, c, d, e] = g.survivors;
  for (const t of ['tent', 'makeshift_shelter', 'field_workbench', 'radio_kit']) raise(g, t);
  const plots = [raise(g, 'garden_plot'), raise(g, 'garden_plot')], aid = raise(g, 'aid_station'), gp = raise(g, 'guard_post'), lo = raise(g, 'lookout_post');
  g.post(a.id, plots[0].id); g.post(b.id, plots[1].id); g.post(c.id, aid.id); g.post(d.id, gp.id); g.post(e.id, lo.id);
  const f = g.addSurvivor('any', g.createCandidate('radio', {}, false));
  g.campaign.recruitedCount = 1; g.resources.food = 40;
  assert.deepEqual(Object.values(items()).every(Boolean), true, JSON.stringify(g.certificationChecklist().filter(i => !i.ok)));
  hours(g, 6);
  assert.ok(g.campaign.tasks.p1_10.holds.cert_hold > 5.5 * HOUR_SECONDS);
  // Someone leaves the watch: the hold starts over and CentroCom says why.
  g.post(e.id, null);
  hours(g, .1);
  assert.equal(g.campaign.tasks.p1_10.holds.cert_hold, 0);
  assert.ok(g.campaign.alertAt.UI_HOLD_RESET != null);
  g.post(e.id, lo.id);
  hours(g, 12.2);
  assert.equal(g.campaign.tasks.p1_10.state, 'completed');
  assert.deepEqual([g.campaign.phase, g.campaign.classification, g.campaign.transition], [2, 'Established Camp', 'phase2']);
  assert.equal(task(g), 'P2-01');
  assert.ok(g.beginPhase2());
  assert.equal(g.campaign.transition, null);
  assert.ok(f);
});

test('emergency deliveries: once per resource, capped, six hours after the shortfall', () => {
  const { g } = atP109('delivery', { shelter: false });
  for (const r of ['wood', 'scrap_metal', 'cloth']) g.resources[r] = 0;
  g.debris = [];
  g.step(1);
  const rc = g.campaign.recovery;
  assert.deepEqual(rc.sent, { wood: true, scrap_metal: true, cloth: true });
  const p = rc.pending[0];
  assert.deepEqual(p.amounts, { wood: 35, scrap_metal: 25, cloth: 8 });
  assert.ok(Math.abs(p.at - g.elapsed - CAMPAIGN.tuning.recovery.deliveryHours * HOUR_SECONDS) < 2);
  for (const r of ['wood', 'scrap_metal', 'cloth']) g.resources[r] = 0;
  g.step(1);
  assert.equal(rc.pending.length, 1, 'never twice for the same resource');
  g.elapsed = p.at; g.step(1);
  assert.deepEqual([g.resources.wood, g.resources.scrap_metal, g.resources.cloth].map(Math.floor), [35, 25, 8]);
  assert.equal(rc.pending.length, 0);
});

test('side tasks open when their situation arises and complete once accepted', () => {
  const g = deploy('side');
  for (const id of ['p1_01', 'p1_02']) g.completeTask(id);
  // S01: food under a day and a half marks a ration crate inside the perimeter.
  g.resources.food = 2; g.step(1);
  assert.equal(g.campaign.tasks.s01.state, 'available');
  assert.ok(g.acceptSideTask('s01'));
  const crate = g.debris.find(d => d.id === 'debris-s01');
  assert.ok(crate && crate.ordered && crate.resource === 'food');
  for (let h = 0; h < 12 && g.campaign.tasks.s01.state !== 'completed'; h++) hours(g, 1);
  assert.equal(g.campaign.tasks.s01.state, 'completed');
  // S03: two exhausted residents, rested to 40 fatigue.
  const [a, b] = g.survivors;
  Object.assign(a, { fatigue: 99, exhausted: true }); Object.assign(b, { fatigue: 90 });
  g.step(1);
  assert.equal(g.campaign.tasks.s03.state, 'available');
  g.acceptSideTask('s03');
  for (let h = 0; h < 16 && g.campaign.tasks.s03.state !== 'completed'; h++) hours(g, 1);
  assert.equal(g.campaign.tasks.s03.state, 'completed');
  // S04: a candidate with no bed for them; declining settles it.
  const cand = g.createCandidate('radio', {}, true);
  g.step(1);
  assert.equal(g.campaign.tasks.s04.state, 'available');
  g.acceptSideTask('s04');
  g.declineCandidate(cand.id); hours(g, .05);
  assert.equal(g.campaign.tasks.s04.state, 'completed');
  // S02: a damaged structure, repaired.
  const tent = g.buildings.find(b => b.type === 'tent');
  tent.hp = 40; g.step(1);
  assert.equal(g.campaign.tasks.s02.state, 'available');
  g.acceptSideTask('s02');
  g.resources.wood = 50; assert.ok(g.repair(tent.id)); hours(g, .05);
  assert.equal(g.campaign.tasks.s02.state, 'completed');
  assert.equal(g.acceptSideTask('s05'), false, 'S05 waits for First Aid Kits (Phase 2)');
});

test('a save mid-migration keeps the shelter, the migration and the delivery ledger', () => {
  const { g } = atP109('persist-m6');
  g.step(1);
  shelterAllIn(g); g.sealShelter();
  g.elapsed = g.campaign.migration.arriveAt; hours(g, .3, .5);
  g.campaign.recovery.sent.wood = true;
  const loaded = new Game(), data = g.serialize();
  assert.ok(loaded.restore(data), loaded.restoreError(data));
  assert.deepEqual(loaded.campaign.migration, g.campaign.migration);
  assert.deepEqual(loaded.campaign.shelter, g.campaign.shelter);
  assert.deepEqual(loaded.campaign.recovery, g.campaign.recovery);
  assert.equal(loaded.zombies.filter(z => z.migrant).length, g.zombies.filter(z => z.migrant).length);
  assert.ok(loaded.atHome.every(s => s.sheltered));
  for (let t = 0; t < 12 * HOUR_SECONDS && loaded.campaign.migration.state !== 'cleared'; t += .5) loaded.step(.5);
  assert.equal(loaded.campaign.migration.state, 'cleared');
});

test('deployment to Established Camp, headless, with nobody lost and nothing killed during the migration', () => {
  const g = deploy('playthrough', 'standard');
  const place = t => g.build(t, ...spot(g, t), 0);
  const built = b => { for (let h = 0; h < 24 && b.blueprint; h++) hours(g, 1); };
  const until = (code, max) => { for (let h = 0; h < max && task(g) === code; h++) hours(g, 1); };
  for (const id of ['open_survivors', 'select_resident', 'open_resources', 'inspect_food', 'open_build']) g.recordInteraction(id);
  hours(g, .1);
  const near = r => g.debris.filter(n => n.resource === r).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
  for (const n of [near('wood')[0], near('scrap_metal')[0], near('scrap_metal')[1]]) g.toggleGather(n.id);
  place('tent'); place('supply_stash'); until('P1-02', 14);
  const plots = [place('garden_plot'), place('garden_plot')]; plots.forEach(built);
  plots.forEach((p, i) => g.post(g.survivors[i].id, p.id)); until('P1-03', 72);
  const bench = place('field_workbench'); built(bench); g.post(g.survivors[2].id, bench.id); g.queueCraft(bench.id, 'c01'); until('P1-04', 48);
  const aid = place('aid_station'); built(aid); g.post(g.survivors[3].id, aid.id); g.queueCraft(bench.id, 'c03'); until('P1-05', 48);
  const gp = place('guard_post'); built(gp); g.post(g.survivors[4].id, gp.id); until('P1-06', 30);
  const lo = place('lookout_post'); built(lo); g.post(g.survivors[0].id, lo.id);
  for (let h = 0; h < 96 && task(g) === 'P1-07'; h++) { hours(g, .5); if (g.campaign.scripted.wanderer?.detected) g.recordInteraction('ack_alert'); }
  const radio = place('radio_kit'); built(radio);
  for (let h = 0; h < 30 && !g.broadcast(); h++) hours(g, 1);
  for (let h = 0; h < 48 && !g.candidates.length; h++) hours(g, .5);
  const recruit = g.acceptCandidate(g.candidates[0].id);
  until('P1-08', 24);
  assert.equal(task(g), 'P1-09');
  // The recruit takes the farm the watch Guard left.
  g.post(recruit.id, plots[0].id);
  const sh = place('makeshift_shelter'); built(sh);
  for (let h = 0; h < 48 && g.campaign.migration.state === 'none'; h++) hours(g, .5);
  assert.equal(g.campaign.migration.state, 'warning');
  shelterAllIn(g); assert.ok(g.sealShelter());
  const kills = g.kills;
  until('P1-09', 30);
  assert.equal(task(g), 'P1-10');
  assert.equal(g.kills, kills, 'strategic non-engagement');
  until('P1-10', 72);
  assert.equal(g.campaign.classification, 'Established Camp');
  assert.equal(g.campaign.phase, 2);
  assert.equal(g.survivors.length, 6);
  assert.ok(g.day <= 8, 'day ' + g.day);
});
