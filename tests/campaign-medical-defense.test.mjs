// M5: campaign medicine, defense, detection and recruitment (P1-05 ... P1-08). Aid Station treatment and its
// supplies, bleeding and first aid, infection and reanimation, the downed rescue and carry, P1-05's scripted
// cut, guards (pistols and ammunition, routes, stances), the Lookout and P1-07's Wanderer, radio
// recruitment, the campaign's loss rule, saves, and the chain played headless.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HOUR_SECONDS } from '../web/src/engine/model.mjs';
import { CAMPAIGN } from '../web/src/engine/campaignState.mjs';
import { campaignMaxHp } from '../web/src/engine/crew.mjs';

const H = CAMPAIGN.tuning.health, TILE = 16;
function deploy(seed = 'medical', mapSize = 'compact') {
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
// A finished structure, straight away.
function raise(g, type) { g.freeBuild = true; const b = g.build(type, ...spot(g, type), 0); g.freeBuild = false; return b; }
const complete = (g, ...ids) => { for (const id of ids) g.completeTask(id); };
const at = (g, s, b) => { const p = g.goalFor(s, b); Object.assign(s, p, { path: [] }); };
// A camp at P1-05 with a staffed Aid Station; the dead kept away.
function clinic(seed) {
  const g = deploy(seed);
  complete(g, 'p1_01', 'p1_02', 'p1_03', 'p1_04');
  const aid = raise(g, 'aid_station'), medic = g.survivors[0];
  assert.ok(g.post(medic.id, aid.id));
  return { g, aid, medic };
}

test('the Aid Station heals 8 HP and clears 2 infection a patient-hour, using a supply per 4 patient-hours', () => {
  const { g, aid, medic } = clinic();
  const p = g.survivors[1];
  p.hp = 50; p.infection = 30;
  Object.assign(p, { care: 'waiting', careAt: aid.id }); at(g, p, aid); at(g, medic, aid);
  const supplies = g.resources.medical_supplies;
  for (let t = 0; t < 2 * HOUR_SECONDS; t++) g.medicDuty(medic, aid, g.statsOf(medic), 1);
  assert.ok(Math.abs(p.hp - 66) < .01, 'hp ' + p.hp);
  assert.ok(Math.abs(p.infection - 26) < .01, 'infection ' + p.infection);
  assert.equal(g.resources.medical_supplies, supplies - 1, 'one supply covers the first four patient-hours');
  for (let t = 0; t < 2.5 * HOUR_SECONDS; t++) g.medicDuty(medic, aid, g.statsOf(medic), 1);
  assert.equal(g.resources.medical_supplies, supplies - 2);
  // Without supplies, treatment stops.
  g.resources.medical_supplies = 0; aid.supplyCredit = 0;
  const hp = p.hp;
  g.medicDuty(medic, aid, g.statsOf(medic), 10);
  assert.equal(p.hp, hp); assert.equal(medic.task, 'no-supplies');
});

test('at night an infected survivor gets up for a free bed and the sleeping Medic gets up to treat them', () => {
  const { g, aid, medic } = clinic('night');
  g.elapsed = 14 * HOUR_SECONDS; // 21:00
  hours(g, 1, .5);
  assert.ok(medic.resting, 'the medic is in bed');
  const p = g.survivors[2];
  assert.ok(p.resting);
  p.infection = 30;
  hours(g, 1.5, .5);
  assert.equal(p.care, 'waiting'); assert.equal(p.careAt, aid.id);
  assert.ok(!medic.resting);
  assert.ok(p.infection < 30, 'treated through the night: ' + p.infection);
});

test('a hurt Medic with an empty bed treats themselves at half speed', () => {
  const { g, aid, medic } = clinic();
  medic.hp = 60; at(g, medic, aid);
  for (let t = 0; t < HOUR_SECONDS; t++) g.medicDuty(medic, aid, g.statsOf(medic), 1);
  assert.ok(Math.abs(medic.hp - 64) < .01, 'hp ' + medic.hp);
  assert.equal(medic.task, 'self-treating');
});

test('P1-05: the scripted cut waits for a staffed station and a bandage, picks the least tired worker and is treated', () => {
  const { g, aid } = clinic('cut');
  hours(g, 1);
  assert.equal(g.campaign.scripted.cut, null, 'no bandage yet');
  for (const s of g.survivors) s.fatigue = 50;
  g.survivors[3].fatigue = 5;
  g.campaign.stock.bandage = 1;
  hours(g, .1);
  const cut = g.survivors.find(s => s.id === g.campaign.scripted.cut);
  assert.equal(cut, g.survivors[3]);
  assert.ok(cut.hp <= campaignMaxHp(cut) - 15 + .1);
  assert.ok(!cut.bleeding && !(cut.infection > 0), 'no bleed, no bite');
  assert.ok(g.messages.some(m => m.title === 'Minor injury reported' && m.body.includes(cut.name)));
  for (let h = 0; h < 6 && !g.campaign.scripted.cutTreated; h++) hours(g, 1);
  assert.ok(g.campaign.scripted.cutTreated);
  assert.equal(g.metric('scriptedPatientTreated'), true);
  assert.ok(cut.hp >= 95);
  assert.equal(g.campaign.stock.bandage, 1, 'the cut does not bleed, so the bandage is kept');
  assert.ok(aid);
});

test('bleeding costs 1 HP an hour until a bandage (+10) or a kit (+25) stops it, at most one each per 6 hours', () => {
  const g = deploy('bleed'), s = g.survivors[0];
  s.hp = 60; s.bleeding = true;
  g.medicalTick(HOUR_SECONDS);
  assert.ok(Math.abs(s.hp - 59) < 1e-9);
  g.campaign.stock.bandage = 2;
  g.medicalTick(1);
  assert.equal(s.bleeding, false); assert.ok(s.hp > 68.9);
  assert.equal(g.campaign.stock.bandage, 1);
  s.bleeding = true; g.medicalTick(1);
  assert.equal(s.bleeding, true, 'the next bandage waits out the 6-hour cooldown');
  g.campaign.stock.first_aid_kit = 1; g.medicalTick(1);
  assert.equal(s.bleeding, false, 'a kit has its own cooldown');
  assert.equal(g.campaign.stock.first_aid_kit, 0);
});

test('infection grows 1 an hour; at 100 a two-hour warning, then the survivor rises unless isolated', () => {
  const g = deploy('bite'), s = g.survivors[0];
  s.infection = 98.5;
  g.medicalTick(HOUR_SECONDS);
  assert.ok(Math.abs(s.infection - 99.5) < 1e-9);
  g.medicalTick(HOUR_SECONDS);
  assert.equal(s.infection, 100);
  assert.ok(s.turnAt > g.elapsed);
  const zombies = g.zombies.length, pop = g.survivors.length;
  g.elapsed = s.turnAt; g.medicalTick(1);
  assert.equal(g.survivors.length, pop - 1);
  assert.equal(g.zombies.length, zombies + 1, 'they rise where they stood');
  assert.ok(g.messages.some(m => m.title === 'Personnel loss: ' + s.name));
  assert.ok(g.messages.some(m => m.from === 'Mara Venn' && m.body === CAMPAIGN.strings.mara_first_loss_msg));
  // In an isolated medical bed, the bed holds them.
  const { g: h, aid } = clinic('isolate');
  const p = h.survivors[2];
  aid.isolate = true;
  Object.assign(p, { infection: 100, turnAt: h.elapsed, care: 'waiting', careAt: aid.id });
  const before = h.zombies.length;
  h.medicalTick(1);
  assert.equal(h.zombies.length, before);
  assert.ok(!h.survivors.includes(p));
});

test('a downed survivor is lifted in 0.25 labor-hours and carried at half speed to a bed, which stabilizes them', () => {
  const { g, aid } = clinic('downed');
  const d = g.survivors[2];
  d.bleeding = true;
  g.down(d);
  assert.equal(d.condition, 'downed');
  assert.equal(d.bleed, H.downedHours * HOUR_SECONDS);
  assert.ok(g.notifications?.length !== 0);
  let lifted = false;
  for (let t = 0; t < 2 * HOUR_SECONDS && d.condition === 'downed'; t += .5) { g.step(.5); lifted ||= d.carriedBy != null; }
  assert.ok(lifted, 'someone carried them');
  assert.equal(d.condition, 'injured');
  assert.equal(d.care, 'waiting'); assert.equal(d.careAt, aid.id);
  assert.equal(d.bleeding, false, 'stabilizing stops the bleeding');
  assert.ok(d.hp >= 1);
});

test('a downed survivor nobody reaches within two hours dies', () => {
  const g = deploy('alone'), d = g.survivors[0];
  // Everyone else is exhausted and out of reach of a rescue for the whole two hours.
  for (const s of g.survivors) if (s !== d) Object.assign(s, { exhausted: true, fatigue: 100 });
  g.down(d);
  hours(g, 2.05, .5);
  assert.ok(!g.survivors.includes(d));
});

test('an infected blow: the tutorial Wanderer never takes anyone below 50 HP and rolls no bleed or bite', () => {
  const g = deploy('blows'), s = g.survivors[0];
  g.random = () => 0;
  const z = g.spawnZombie(0);
  assert.deepEqual([z.hp, z.damage, z.structureDamage], [45, 8, 4]);
  z.tutorial = true;
  s.hp = 55;
  g.strike(z, s); g.strike(z, s);
  assert.equal(s.hp, 50);
  assert.ok(!s.bleeding && !(s.infection > 0));
  z.tutorial = false;
  g.strike(z, s);
  assert.equal(s.hp, 42);
  assert.ok(s.bleeding, 'a 10% bleed roll');
  assert.equal(s.infection, H.infectionStart, 'a bite roll at the difficulty\'s chance');
});

test('guards draw pistols with 5+ rounds, spend a round a shot and switch to melee at none', () => {
  const g = deploy('guards');
  complete(g, 'p1_01', 'p1_02', 'p1_03', 'p1_04', 'p1_05');
  const post = raise(g, 'guard_post'), guard = g.survivors[0];
  g.resources.ammo = 4;
  g.post(guard.id, post.id);
  assert.notEqual(guard.gear, 'basic_pistol', 'not with under 5 rounds');
  assert.equal(g.metric('hasArmedGuard'), false);
  g.resources.ammo = 6; g.equipAll();
  assert.equal(guard.gear, 'basic_pistol');
  assert.equal(g.metric('hasArmedGuard'), true);
  assert.equal(g.useAmmo(guard), true); assert.equal(g.resources.ammo, 5);
  g.resources.ammo = 0;
  assert.equal(g.useAmmo(guard), false);
  assert.notEqual(guard.gear, 'basic_pistol');
  assert.ok(g.items.some(i => i.type === 'basic_pistol' && i.holder == null), 'the pistol goes back to the stock');
});

test('guard routes stay near the post; Hold guards do not answer alerts and a Lookout guard is not a patrol', () => {
  const g = deploy('routes');
  complete(g, 'p1_01', 'p1_02', 'p1_03', 'p1_04', 'p1_05', 'p1_06');
  const post = raise(g, 'guard_post'), lookout = raise(g, 'lookout_post');
  const [a, b, w] = g.survivors;
  g.post(a.id, post.id); g.post(b.id, post.id);
  for (const i of [0, 1]) {
    const route = g.guardRoute(post, i);
    assert.ok(route.length >= 2, 'route ' + i);
    assert.ok(route.every(p => Math.hypot(p.x - post.x, p.y - post.y) <= 20 * TILE + 3 * TILE));
  }
  assert.ok(g.setGuardRoute(b.id, 1)); assert.ok(g.setGuardStance(b.id, 'hold'));
  assert.equal(g.setGuardStance(w.id, 'hold'), false, 'only guards have stances');
  assert.deepEqual(g.guardsFor().map(s => s.id), [a.id], 'Hold stays on its route');
  assert.equal(g.metric('staffedLookout'), false);
  g.post(w.id, lookout.id);
  assert.equal(w.role, 'sentry');
  assert.equal(g.metric('staffedLookout'), true);
  assert.equal(g.metric('separatePatrolGuard'), true);
  assert.ok(!g.guardsFor().includes(w), 'the watch does not answer alerts');
  // The patrol hour holds only while a posted Guard is actually out on their route.
  const t = CAMPAIGN.tasks.find(t => t.id === 'p1_06'), o = t.objectives.find(o => o.type === 'continuous_time');
  g.campaign.tasks.p1_06.state = 'active';
  hours(g, .5);
  assert.ok(g.campaign.tasks.p1_06.holds[o.id] > 0);
  g.post(a.id, null); g.post(b.id, null);
  hours(g, .05);
  assert.equal(g.campaign.tasks.p1_06.holds[o.id], 0, 'the clock starts over');
});

test('the Lookout sees 45 tiles all round while its Guard is on the platform', () => {
  const g = deploy('lookout');
  complete(g, 'p1_01', 'p1_02', 'p1_03', 'p1_04', 'p1_05', 'p1_06');
  const lookout = raise(g, 'lookout_post'), w = g.survivors[0];
  g.post(w.id, lookout.id);
  const z = g.spawnZombie(0);
  Object.assign(z, { x: lookout.x + 44 * TILE, y: lookout.y, speed: 0 });
  g.perceive();
  assert.equal(g.alerts.length, 0, 'not until they are up');
  for (let t = 0; t < 60 && !w.stationed; t++) g.step(.5);
  assert.ok(w.stationed);
  z.x = lookout.x + 44 * TILE; z.y = lookout.y; g.perceive();
  assert.ok(g.alerts.some(a => a.threatIds.includes(z.id) && !a.local));
  const far = g.spawnZombie(0);
  Object.assign(far, { x: lookout.x - 46 * TILE, y: lookout.y, speed: 0 });
  g.perceive();
  assert.ok(!g.alerts.some(a => a.threatIds.includes(far.id)));
});

test('P1-07: one marked Wanderer 50 tiles out, a replacement if it dies unseen, and threats switch on after', () => {
  const g = deploy('wanderer');
  complete(g, 'p1_01', 'p1_02', 'p1_03', 'p1_04', 'p1_05', 'p1_06');
  assert.equal(task(g), 'P1-07');
  const post = raise(g, 'guard_post'), lookout = raise(g, 'lookout_post');
  g.post(g.survivors[0].id, post.id); g.post(g.survivors[1].id, lookout.id);
  g.tutorialTick();
  const w = g.campaign.scripted.wanderer, z = g.zombies.find(z => z.id === w.id);
  assert.ok(z.tutorial);
  assert.ok(Math.abs(Math.hypot(z.x, z.y) - 50 * TILE) < 2 * TILE);
  // Killed before anyone saw it: one replacement.
  z.hp = 0; g.zombies = g.zombies.filter(o => o !== z);
  g.tutorialTick(); g.tutorialTick();
  assert.equal(g.campaign.scripted.wanderer.spawns, 2);
  assert.ok(g.zombies.some(o => o.tutorial));
  for (let h = 0; h < 12 && task(g) === 'P1-07'; h++) {
    hours(g, .25, .5);
    if (g.campaign.scripted.wanderer.detected) g.recordInteraction('ack_alert');
  }
  assert.equal(task(g), 'P1-08');
  assert.ok(g.campaign.scripted.wanderer.detected && g.campaign.scripted.wanderer.neutralized);
  assert.ok(g.survivors.every(s => s.hp >= 50), 'nobody below 50 HP');
  assert.equal(g.campaign.threatsActive, true);
  assert.ok(g.messages.some(m => m.action?.kind === 'alert'));
});

test('radio: 2 Food and half an operator-hour, a 24-hour cooldown, a reply in 4-8 hours, Quality 16+ first', () => {
  const g = deploy('radio');
  complete(g, 'p1_01', 'p1_02', 'p1_03', 'p1_04', 'p1_05', 'p1_06', 'p1_07');
  assert.equal(g.broadcast(), false, 'no Radio Kit yet');
  raise(g, 'radio_kit');
  const food = g.resources.food;
  assert.equal(g.broadcast(), true);
  assert.equal(g.resources.food, food - 2);
  assert.equal(g.broadcastBlock(), 'Broadcasting');
  const started = g.elapsed;
  for (let t = 0; t < 3 * HOUR_SECONDS && g.campaign.radio.broadcast; t++) g.step(1);
  assert.equal(g.campaign.radio.broadcast, null);
  assert.ok(g.elapsed - started >= .5 * HOUR_SECONDS - 1, 'half an hour on the radio at least');
  assert.equal(g.campaign.tasks.p1_08.counters.finish_broadcast, 1);
  const p = g.campaign.radio.pending;
  assert.ok(p.at - g.elapsed >= 4 * HOUR_SECONDS - 1 && p.at - g.elapsed <= 8 * HOUR_SECONDS + 1);
  assert.equal(p.success, true, 'the first broadcast always reaches someone');
  g.elapsed = p.at; g.radioTick();
  assert.equal(g.candidates.length, 1);
  const c = g.candidates[0];
  assert.ok(c.gen.quality >= 16 && c.model === 'campaign');
  assert.match(g.broadcastBlock(), /Next broadcast in/);
  // Housing and a day's Food for the larger camp.
  assert.equal(g.acceptBlock(), 'No free bed');
  assert.equal(g.acceptCandidate(c.id), false);
  raise(g, 'tent');
  const realFood = g.resources.food; g.resources.food = 3;
  assert.match(g.acceptBlock(), /Needs 6 Food/);
  g.resources.food = realFood;
  const s = g.acceptCandidate(c.id);
  assert.ok(s && s.arriving);
  assert.equal(g.campaign.recruitedCount, 0, 'counts once they reach camp');
  for (let t = 0; t < 2 * HOUR_SECONDS && s.arriving; t++) g.step(1);
  assert.equal(s.arriving, false);
  assert.equal(g.campaign.recruitedCount, 1);
  assert.equal(g.survivors.length, 6);
});

test('rejecting a candidate costs nothing; unanswered ones move on after a day', () => {
  const g = deploy('reject');
  const c = g.createCandidate('radio', {}, true);
  const food = g.resources.food;
  assert.equal(g.declineCandidate(c.id), true);
  assert.equal(g.resources.food, food);
  assert.equal(g.candidates.length, 0);
  const d = g.createCandidate('radio', {}, true); d.expiresAt = g.elapsed + 1;
  g.elapsed += 2; g.radioTick();
  assert.equal(g.candidates.length, 0);
});

test('the campfire cannot be broken; the region is lost only when nobody is left', () => {
  const g = deploy('lost');
  const fire = g.core;
  const z = g.spawnZombie(0); Object.assign(z, { x: fire.x + 4, y: fire.y });
  for (const s of g.survivors) s.sheltered = true;
  const hp = fire.hp;
  hours(g, .2, .5);
  assert.equal(fire.hp, hp);
  assert.equal(g.status, 'playing');
  for (const s of [...g.survivors]) g.kill(s, 'test');
  g.step(.5);
  assert.equal(g.status, 'lost');
});

test('a save keeps medicine, guard orders, the radio and the tutorial state', () => {
  const { g, aid } = clinic('persist-m5');
  const [, p, guard] = g.survivors;
  Object.assign(p, { bleeding: true, infection: 42, care: 'waiting', careAt: aid.id });
  aid.isolate = true; aid.supplyCredit = 2.5;
  g.campaign.stock.bandage = 3;
  g.campaign.radio = { lastBroadcastAt: 10, broadcast: null, pending: { at: 999, success: true, qualityMin: 16 }, broadcasts: 1 };
  g.campaign.scripted.cut = p.id;
  guard.stance = 'hold'; guard.guardRoute = 1;
  const loaded = new Game(), data = g.serialize();
  assert.ok(loaded.restore(data), loaded.restoreError(data));
  const lp = loaded.survivors.find(s => s.id === p.id), lg = loaded.survivors.find(s => s.id === guard.id);
  assert.deepEqual([lp.bleeding, lp.infection, lp.care, lp.careAt], [true, 42, 'waiting', aid.id]);
  assert.deepEqual([lg.stance, lg.guardRoute], ['hold', 1]);
  const la = loaded.buildings.find(b => b.id === aid.id);
  assert.deepEqual([la.isolate, la.supplyCredit], [true, 2.5]);
  assert.deepEqual(loaded.campaign.stock, { bandage: 3, first_aid_kit: 0 });
  assert.deepEqual(loaded.campaign.radio, g.campaign.radio);
  assert.equal(loaded.campaign.scripted.cut, p.id);
  assert.equal(loaded.survivors.find(s => s.id === g.survivors[0].id).role, 'medic', 'the medic keeps their post');
});

test('P1-05 to P1-08 play through headless with nobody lost', () => {
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
  assert.equal(task(g), 'P1-05');
  const aid = place('aid_station'); built(aid);
  assert.ok(g.post(g.survivors[3].id, aid.id)); assert.ok(g.queueCraft(bench.id, 'c03'));
  until('P1-05', 48);
  assert.equal(task(g), 'P1-06');
  const gp = place('guard_post'); built(gp); assert.ok(g.post(g.survivors[4].id, gp.id));
  until('P1-06', 30);
  assert.equal(task(g), 'P1-07');
  const lo = place('lookout_post'); built(lo); assert.ok(g.post(g.survivors[0].id, lo.id));
  for (let h = 0; h < 96 && task(g) === 'P1-07'; h++) { hours(g, .5); if (g.campaign.scripted.wanderer?.detected) g.recordInteraction('ack_alert'); }
  assert.equal(task(g), 'P1-08');
  const radio = place('radio_kit'); built(radio);
  for (let h = 0; h < 30 && !g.broadcast(); h++) hours(g, 1);
  for (let h = 0; h < 48 && !g.candidates.length; h++) hours(g, .5);
  assert.equal(g.candidates.length, 1);
  assert.ok(g.acceptCandidate(g.candidates[0].id));
  until('P1-08', 24);
  assert.equal(task(g), 'P1-09');
  assert.equal(g.survivors.length, 6);
  assert.ok(g.day <= 7, 'day ' + g.day);
  assert.deepEqual(g.reservations, {});
});
