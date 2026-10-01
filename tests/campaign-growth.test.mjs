// M8: campaign outpost growth (P2-06 ... P2-08). Field Farm lanes, Barracks beds, the Foraging Route, the
// two-bed Field Clinic, the Watchtower's watch and firearm range, recipes C06-C10 (with C09's item input),
// the Component reserve warning, reaching structures that straddle the camp's edge, saves and the chain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HOUR_SECONDS } from '../web/src/engine/model.mjs';
import { CAMPAIGN } from '../web/src/engine/campaignState.mjs';
import { WEAPONS } from '../web/src/engine/survivors.mjs';

const TILE = 16;
function deploy(seed = 'growth', mapSize = 'standard') {
  const g = new Game();
  g.beginCampaign({ seed, mapSize, overseerName: 'Rook' });
  let s; do s = g.advanceWorldGeneration(); while (!s.done);
  return g;
}
const hours = (g, h, step = 1) => { for (let t = 0; t < h * HOUR_SECONDS; t += step) g.step(step); };
const task = g => g.currentTask?.code;
const PHASE2 = ['p1_01', 'p1_02', 'p1_03', 'p1_04', 'p1_05', 'p1_06', 'p1_07', 'p1_08', 'p1_09', 'p1_10', 'p2_01', 'p2_02', 'p2_03', 'p2_04', 'p2_05'];
function spot(g, type, from = 64) {
  const r = g.campaign.region.protectedRadius, out = [];
  for (let x = -r; x <= r; x += 16) for (let y = -r; y <= r; y += 16) if (Math.hypot(x, y) <= r && Math.hypot(x, y) >= from) out.push([x, y]);
  const p = out.sort((a, b) => Math.hypot(...a) - Math.hypot(...b)).find(([x, y]) => g.canPlace(type, x, y, 0).ok);
  if (!p) throw new Error('no spot for ' + type + ': ' + g.canPlace(type, 160, 0, 0).reason);
  return p;
}
function raise(g, type) { g.freeBuild = true; const b = g.build(type, ...spot(g, type), 0); g.freeBuild = false; return b; }
// At P2-06 with the trickle of infected off.
function atP206(seed) {
  const g = deploy(seed);
  for (const id of PHASE2) g.completeTask(id);
  g.beginPhase2(); g.campaign.threatsActive = false;
  assert.equal(task(g), 'P2-06');
  return g;
}
// An average worker: labor factor 1.
const average = s => Object.assign(s, { stats: { str: 5, end: 5, agi: 5, int: 5, cha: 5 }, traits: [], proficiency: {}, laborHours: {}, fatigue: 0 });
const at = (g, s, b) => Object.assign(s, g.goalFor(s, b), { path: [] });

test('a Field Farm works a lane per farmer: two average farmers make 12 Food in a 12-hour workday', () => {
  const g = atP206('farm');
  const farm = raise(g, 'field_farm'), [a, b] = g.survivors.map(average);
  g.post(a.id, farm.id); g.post(b.id, farm.id);
  assert.equal(g.cropLanes(farm).length, 2);
  for (const s of [a, b]) at(g, s, farm);
  const food = g.resources.food;
  for (let h = 0; h < 12; h++) g.cropTick(HOUR_SECONDS);
  assert.ok(Math.abs(g.resources.food - food - 12) < 1e-6, 'food ' + (g.resources.food - food));
  assert.equal(g.campaign.tasks.p2_06.counters.collect_farm_food, 12);
  assert.equal(g.metric('scheduledGrossFoodPerDay'), 12);
  // A Garden Plot keeps its single lane at 0.25 Food an hour.
  const plot = raise(g, 'garden_plot'), c = average(g.survivors[2]);
  g.post(c.id, plot.id); at(g, c, plot);
  assert.equal(g.cropLanes(plot).length, 1);
  assert.equal(g.metric('scheduledGrossFoodPerDay'), 15);
});

test('Barracks give six beds; the Foraging Route opens with P2-06', () => {
  const g = atP206('barracks');
  const beds = g.capacity;
  raise(g, 'barracks');
  assert.equal(g.capacity, beds + 6);
  assert.equal(g.siteOpen('food_foraging_route'), true);
  assert.deepEqual(g.siteState('food_foraging_route').stock, { food: 12 });
});

test('the Field Clinic treats both beds at once, +12 HP a patient-hour, with one Medic', () => {
  const g = atP206('clinic');
  for (const id of ['p2_06']) g.completeTask(id);
  const clinic = raise(g, 'field_clinic'), [medic, p, q, r] = g.survivors;
  g.post(medic.id, clinic.id);
  for (const s of [p, q]) { s.hp = 50; Object.assign(s, { care: 'waiting', careAt: clinic.id }); at(g, s, clinic); }
  at(g, medic, clinic);
  assert.equal(g.bedFree(clinic), false);
  r.hp = 50;
  assert.equal(g.freeBedFor(r), null, 'both beds taken');
  const supplies = g.resources.medical_supplies;
  for (let t = 0; t < HOUR_SECONDS; t++) g.medicDuty(medic, clinic, g.statsOf(medic), 1);
  assert.ok(Math.abs(p.hp - 62) < .01 && Math.abs(q.hp - 62) < .01, `${p.hp} ${q.hp}`);
  assert.equal(g.resources.medical_supplies, supplies - 1);
  for (let t = 0; t < 1.5 * HOUR_SECONDS; t++) g.medicDuty(medic, clinic, g.statsOf(medic), 1);
  assert.equal(g.resources.medical_supplies, supplies - 2, 'two patients use four patient-hours in two hours');
});

test('the Watchtower: a watch post seeing 70 tiles, +5 tiles to a firearm on the platform, no damage change', () => {
  const g = atP206('tower');
  for (const id of ['p2_06', 'p2_07']) g.completeTask(id);
  const tower = raise(g, 'watchtower'), lookout = raise(g, 'lookout_post'), [w, v] = g.survivors;
  g.post(w.id, tower.id); g.post(v.id, lookout.id);
  assert.equal(w.role, 'sentry');
  assert.equal(g.metric('staffedLookout'), true);
  for (let t = 0; t < 120 && !(w.stationed && v.stationed); t++) g.step(.5);
  assert.ok(w.stationed && v.stationed);
  // Pistol on the tower: +80 range and the same damage; a club gets nothing, and neither does the Lookout.
  const pistol = g.items.find(i => i.type === 'basic_pistol' && i.holder == null) || g.addItem('basic_pistol');
  g.equip(w, pistol);
  const st = g.statsOf(w), ground = (({ stationed, ...rest }) => g.statsOf({ ...w, stationed: false, towerId: null, perch: null }))(w);
  assert.equal(st.range, WEAPONS.basic_pistol.range + 5 * TILE);
  assert.equal(st.damage, ground.damage);
  g.equip(v, g.addItem('basic_pistol'));
  assert.equal(g.statsOf(v).range, WEAPONS.basic_pistol.range);
  // Detection: 70 tiles from the tower.
  const z = g.spawnZombie(0); Object.assign(z, { x: tower.x + 68 * TILE, y: tower.y, speed: 0 });
  g.perceive();
  assert.ok(g.alerts.some(a => a.threatIds.includes(z.id)));
});

test('C06 Ammo, C09 Reinforced Club (taking a spare club) and C10 Basic Pistol at the Workshop', () => {
  const g = atP206('recipes');
  for (const id of ['p2_06', 'p2_07']) g.completeTask(id);
  const ws = raise(g, 'workshop'), eng = average(g.survivors[0]);
  g.post(eng.id, ws.id); at(g, eng, ws);
  Object.assign(g.resources, { scrap_metal: 40, components: 10, metal_parts: 20 });
  const clubs = () => g.items.filter(i => i.type === 'wooden_club').length, spare = g.spareItems('wooden_club').length;
  assert.ok(spare >= 1);
  assert.ok(g.queueCraft(ws.id, 'c09'));
  assert.equal(g.spareItems('wooden_club').length, spare - 1, 'the club is set aside');
  g.cancelCraft(ws.id, 0);
  assert.equal(g.spareItems('wooden_club').length, spare, 'and released on cancel');
  for (const r of ['c06', 'c09', 'c10']) assert.ok(g.queueCraft(ws.id, r), r);
  const before = { clubs: clubs(), ammo: g.resources.ammo };
  for (let i = 0; i < 20000 && ws.queue.length; i++) g.craftWork(eng, ws, g.statsOf(eng), 1);
  assert.equal(ws.queue.length, 0);
  assert.equal(g.resources.ammo, before.ammo + 10);
  assert.equal(clubs(), before.clubs - 1);
  assert.ok(g.items.some(i => i.type === 'reinforced_club'));
  assert.equal(g.items.filter(i => i.type === 'basic_pistol').length, 3);
  assert.equal(g.campaign.tasks.p2_08.counters.craft_ammo, 10);
  // With every spare club gone, C09 waits.
  for (const i of g.items) if (i.type === 'wooden_club' && i.holder == null) i.holder = eng.id;
  assert.equal(g.queueCraft(ws.id, 'c09'), false);
});

test('the Component reserve warning: an order that leaves fewer than 6 Components before the Relay is built', () => {
  const g = atP206('components');
  g.resources.components = 7;
  assert.equal(g.componentWarning(CAMPAIGN.recipes.c06), null, 'leaves exactly 6');
  g.resources.components = 6;
  assert.equal(g.componentWarning(CAMPAIGN.recipes.c06), 5);
  assert.equal(g.componentWarning(CAMPAIGN.recipes.c04), null, 'Planks use none');
});

test('a structure across the nearest way out of camp no longer cuts off the wilds beyond it', () => {
  const g = atP206('edge');
  // The way out nearest to a point in the wilds, and a big structure standing over its inner end.
  const land = g.territory, far = { x: land.left - 120, y: 8 };
  const gate = [...g.gateways].sort((a, b) => Math.hypot(a.outer.x - far.x, a.outer.y - far.y) - Math.hypot(b.outer.x - far.x, b.outer.y - far.y))[0];
  g.buildings.push({ id: g.nextId++, type: 'storage_depot', model: 'campaign', x: gate.inner.x + 24, y: gate.inner.y, rotation: 0, hp: 500, upgrades: [], built: true });
  g.navVersion++;
  assert.ok(!g.walkable(gate.inner), 'that way out is blocked');
  const path = g.findPath({ x: 0, y: 40 }, far);
  assert.ok(path.length > 0, 'another way out is taken');
  assert.deepEqual(path.at(-1), far);
});

test('a save keeps farm lanes and items set aside for an order', () => {
  const g = atP206('persist-m8');
  for (const id of ['p2_06', 'p2_07']) g.completeTask(id);
  const farm = raise(g, 'field_farm'), ws = raise(g, 'workshop');
  g.cropLanes(farm)[1].labor = 4.5;
  g.resources.scrap_metal = 20;
  assert.ok(g.queueCraft(ws.id, 'c09'));
  const loaded = new Game(), data = g.serialize();
  assert.ok(loaded.restore(data), loaded.restoreError(data));
  const lf = loaded.buildings.find(b => b.id === farm.id);
  assert.equal(loaded.cropLanes(lf)[1].labor, 4.5);
  assert.equal(loaded.items.filter(i => i.reservedFor).length, 1);
  loaded.cancelCraft(ws.id, 0);
  assert.equal(loaded.items.filter(i => i.reservedFor).length, 0);
});

test('P2-06 to P2-08 play through headless', () => {
  const g = atP206('chain');
  const s = g.survivors;
  const plots = [raise(g, 'garden_plot'), raise(g, 'garden_plot')]; raise(g, 'storage_depot');
  const ws = raise(g, 'workshop'), aid = raise(g, 'aid_station'), gp = raise(g, 'guard_post'), lo = raise(g, 'lookout_post'); raise(g, 'radio_kit');
  g.post(s[0].id, plots[0].id); g.post(s[1].id, plots[1].id); g.post(s[2].id, ws.id); g.post(s[3].id, aid.id); g.post(s[4].id, gp.id);
  Object.assign(g.resources, { planks: 50, metal_parts: 25, cloth: 30, seed_packets: 2 });
  const place = t => g.build(t, ...spot(g, t), 0), built = b => { for (let h = 0; h < 30 && b.blueprint; h++) hours(g, 1); };
  const farm = place('field_farm'), bar = place('barracks'); built(farm); built(bar);
  assert.ok(!farm.blueprint && !bar.blueprint);
  for (let i = 0; i < 3; i++) g.addSurvivor('any', g.createCandidate('radio', {}, false));
  g.post(g.survivors[5].id, farm.id); g.post(g.survivors[6].id, farm.id); g.post(g.survivors[7].id, lo.id);
  for (let h = 0; h < 48 && task(g) === 'P2-06'; h++) hours(g, 1);
  assert.equal(task(g), 'P2-07');
  Object.assign(g.resources, { planks: 20, metal_parts: 20, components: 4, medical_supplies: 8, cloth: 30 });
  const clinic = place('field_clinic'); built(clinic); g.post(s[3].id, clinic.id);
  g.queueCraft(ws.id, 'c07'); g.queueCraft(ws.id, 'c07'); g.queueCraft(ws.id, 'c08'); g.queueCraft(ws.id, 'c08');
  for (let h = 0; h < 24 && task(g) === 'P2-07'; h++) hours(g, 1);
  assert.equal(task(g), 'P2-08', JSON.stringify({ q: ws.queue, c: g.campaign.tasks.p2_07.counters, staff: g.staffOf(ws).map(x => x.task), clinic: g.staffOf(clinic).map(x => x.name), over: g.overflow, bleeding: g.untreatedBleeding, bp: clinic.blueprint }));
  Object.assign(g.resources, { planks: 25, metal_parts: 20, components: 3 });
  const tower = place('watchtower'); built(tower); g.post(g.survivors[7].id, tower.id);
  assert.ok(g.queueCraft(ws.id, 'c06'));
  for (let h = 0; h < 24 && task(g) === 'P2-08'; h++) hours(g, 1);
  assert.equal(task(g), 'P2-09');
  assert.ok(g.available('ammo') >= 20);
  assert.equal(g.survivors.length, 8);
});
