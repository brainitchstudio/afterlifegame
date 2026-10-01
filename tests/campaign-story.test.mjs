// M9: campaign Phase 2's story (P2-09 ... P2-11). Expeditions E01-E03 with provisions and encounter cards
// (held until chosen, saved mid-decision), INT's speed-up, site reveals, the maintenance crew as candidates or
// contacts, the unique keycard and battery tokens, the Radio Relay and its effects and battery recovery, the
// Reinforced Shelter, pathfinding into a camp split by its buildings, and the arc played headless.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HOUR_SECONDS } from '../web/src/engine/model.mjs';
import { CAMPAIGN } from '../web/src/engine/campaignState.mjs';

const R = CAMPAIGN.tuning.recruitment, M = CAMPAIGN.tuning.migration;
function deploy(seed = 'story', mapSize = 'standard') {
  const g = new Game();
  g.beginCampaign({ seed, mapSize, overseerName: 'Rook' });
  let s; do s = g.advanceWorldGeneration(); while (!s.done);
  return g;
}
const hours = (g, h, step = 1) => { for (let t = 0; t < h * HOUR_SECONDS; t += step) g.step(step); };
const task = g => g.currentTask?.code;
const UP_TO_P209 = ['p1_01', 'p1_02', 'p1_03', 'p1_04', 'p1_05', 'p1_06', 'p1_07', 'p1_08', 'p1_09', 'p1_10', 'p2_01', 'p2_02', 'p2_03', 'p2_04', 'p2_05', 'p2_06', 'p2_07', 'p2_08'];
function spot(g, type) {
  const r = g.campaign.region.protectedRadius, out = [];
  for (let x = -r; x <= r; x += 16) for (let y = -r; y <= r; y += 16) if (Math.hypot(x, y) <= r && Math.hypot(x, y) >= 64) out.push([x, y]);
  const p = out.sort((a, b) => Math.hypot(...a) - Math.hypot(...b)).find(([x, y]) => g.canPlace(type, x, y, 0).ok);
  if (!p) throw new Error('no spot for ' + type + ': ' + g.canPlace(type, 160, 0, 0).reason);
  return p;
}
function raise(g, type) { g.freeBuild = true; const b = g.build(type, ...spot(g, type), 0); g.freeBuild = false; return b; }
function atP209(seed) {
  const g = deploy(seed);
  for (const id of UP_TO_P209) g.completeTask(id);
  g.beginPhase2(); g.campaign.threatsActive = false;
  raise(g, 'operations_board');
  Object.assign(g.resources, { ammo: 40, food: 120 }); g.campaign.stock.first_aid_kit = 3;
  g.debris = [];
  return g;
}
const team = (g, n = 3) => g.survivors.slice(0, n).map(s => s.id);
const rest = g => { for (const s of g.survivors) Object.assign(s, { fatigue: 0, exhausted: false, hp: Math.max(s.hp, 95) }); };
// Out to the site, the encounter decided as `choice`, home again.
function expedition(g, site, choice, n = 3) {
  assert.ok(g.launchMission(site, team(g, n)), g.missionBlock(site, team(g, n)));
  let seen = false;
  for (let t = 0; t < 48 * HOUR_SECONDS && g.mission; t++) { g.step(1); if (g.encounter) { seen = true; assert.ok(g.chooseEncounter(choice)); } }
  assert.equal(g.mission, null, 'home');
  rest(g);
  return seen;
}

test('E01 opens with P2-09; the depot and relay sites stay hidden until it returns', () => {
  const g = atP209('e01-open');
  assert.equal(task(g), 'P2-09');
  assert.equal(g.siteOpen('old_access_road'), true);
  assert.equal(g.siteRecord('service_depot').revealed, false);
  assert.equal(g.siteBlock('service_depot'), 'Location unknown');
  assert.match(g.missionBlock('old_access_road', team(g, 2)), /Choose 3-3/);
  g.resources.ammo = 3;
  assert.match(g.missionBlock('old_access_road', team(g)), /Needs 4 Ammo/);
});

test('an encounter holds the team on site until chosen, survives a save, and its choice counts', () => {
  const g = atP209('encounter');
  const ammo = g.available('ammo');
  const m = g.launchMission('old_access_road', team(g));
  assert.equal(g.available('ammo'), ammo - 4, 'ammunition packed');
  for (let t = 0; t < 12 * HOUR_SECONDS && !g.encounter; t++) g.step(1);
  assert.ok(g.encounter);
  hours(g, 3);
  assert.equal(g.mission.siteWork, 0, 'nothing happens until the Overseer decides');
  const loaded = new Game(), data = g.serialize();
  assert.ok(loaded.restore(data), loaded.restoreError(data));
  assert.ok(loaded.encounter, 'still waiting after a reload');
  assert.ok(loaded.chooseEncounter('clear_lane'));
  assert.equal(loaded.mission.delay, 2);
  assert.equal(loaded.mission.cargo.scrap_metal, 10);
  for (let t = 0; t < 30 * HOUR_SECONDS && loaded.mission; t++) loaded.step(1);
  assert.equal(loaded.available('ammo'), ammo, 'unused provisions come back');
  assert.ok(['service_depot', 'regional_relay'].every(id => loaded.siteRecord(id).revealed));
  assert.equal(loaded.campaign.tasks.p2_09.counters.launch_e01, 1);
  loaded.reviewReport(); hours(loaded, .05);
  assert.equal(task(loaded), 'P2-10');
  assert.equal(loaded.siteBlock('old_access_road'), 'Completed');
  assert.ok(m);
});

test('a team without INT 5 takes two more hours on site, and is never refused', () => {
  const g = atP209('int');
  for (const s of g.survivors.slice(0, 3)) s.stats.int = 4;
  assert.equal(g.missionBlock('old_access_road', team(g)), '');
  assert.equal(g.siteHours('old_access_road', g.survivors.slice(0, 3)), CAMPAIGN.expeditions.e01.siteWorkHours + 2);
  g.survivors[0].stats.int = 5;
  assert.equal(g.siteHours('old_access_road', g.survivors.slice(0, 3)), CAMPAIGN.expeditions.e01.siteWorkHours);
});

test('E02: offered places become candidates who still need beds; aid instead leaves them as contacts', () => {
  const g = atP209('e02');
  g.completeTask('p2_09'); g.siteRecord('service_depot').revealed = true;
  assert.equal(expedition(g, 'service_depot', 'offer_place'), true);
  assert.equal(g.story.tokens.relay_keycard, 'held');
  assert.equal(g.metric('maintenanceCrewContacted'), true);
  const crew = g.candidates.filter(c => c.crew);
  assert.equal(crew.length, 2);
  assert.equal(g.acceptBlock(), 'No free bed', 'no bypassing the housing check');
  // Left waiting, they become standing contacts rather than leaving; invited, they come back as candidates.
  g.elapsed += 80 * HOUR_SECONDS; g.radioTick();
  assert.equal(g.candidates.filter(c => c.crew).length, 0);
  assert.equal(g.story.contacts.length, 2);
  assert.ok(g.inviteContact(g.story.contacts[0].id));
  assert.equal(g.candidates.filter(c => c.crew).length, 1);
  // The other choice: a kit spent, 20 Food, two contacts.
  const h = atP209('e02-aid');
  h.completeTask('p2_09'); h.siteRecord('service_depot').revealed = true;
  const food = h.resources.food, kits = h.campaign.stock.first_aid_kit;
  expedition(h, 'service_depot', 'deliver_aid');
  assert.equal(h.campaign.stock.first_aid_kit, kits - 1);
  assert.equal(h.story.contacts.length, 2);
  assert.ok(h.resources.food >= food + 20 - 4, 'the crew’s food came home, less rations');
});

test('E03: the battery and 6 Components; the risky way hurts one member, a kit halves it', () => {
  for (const [kits, hurt] of [[1, 5], [0, 10]]) {
    const g = atP209('e03-' + kits);
    for (const id of ['p2_09', 'p2_10']) g.completeTask(id);
    g.siteRecord('regional_relay').revealed = true;
    g.campaign.stock.first_aid_kit = kits;
    if (!kits) { CAMPAIGN.expeditions.e03.itemProvisions.first_aid_kit = 0; }
    try {
      const before = g.survivors.slice(0, 3).map(s => s.hp);
      g.launchMission('regional_relay', team(g));
      for (let t = 0; t < 30 * HOUR_SECONDS && !g.encounter; t++) g.step(1);
      g.chooseEncounter('grab_battery');
      assert.deepEqual(g.mission.injuries.map(i => i.hp), [hurt]);
      const hit = g.survivors.slice(0, 3).findIndex((s, i) => before[i] - s.hp >= hurt - 1e-9);
      assert.ok(hit >= 0);
      for (let t = 0; t < 30 * HOUR_SECONDS && g.mission; t++) g.step(1);
      assert.equal(g.story.tokens.relay_battery, 'held');
      assert.equal(g.campaign.operations.reports[0].cargo.components, 6);
      assert.ok(g.metric('hasBatteryToken'));
    } finally { CAMPAIGN.expeditions.e03.itemProvisions.first_aid_kit = 1; }
  }
});

test('the Radio Relay takes the battery; cancelling gives it back; losing the relay means a safe two-hour trip for it', () => {
  const g = atP209('relay');
  for (const id of ['p2_09', 'p2_10']) g.completeTask(id);
  g.siteRecord('regional_relay').revealed = true;
  assert.match(g.canPlace('radio_relay', ...spot(g, 'tent'), 0).reason, /relay battery/);
  g.story.tokens.relay_battery = 'held'; g.story.done.e03 = true;
  Object.assign(g.resources, { planks: 60, metal_parts: 40, components: 20 });
  const b = g.build('radio_relay', ...spot(g, 'radio_relay'), 0);
  assert.equal(g.story.tokens.relay_battery, 'installed');
  assert.match(g.canPlace('radio_relay', ...spot(g, 'tent'), 0).reason, /relay battery/, 'one battery, one relay');
  g.demolish(b.id);
  assert.equal(g.story.tokens.relay_battery, 'held');
  const relay = raise(g, 'radio_relay');
  assert.equal(g.story.tokens.relay_battery, 'installed');
  relay.hp = 0; g.step(.5);
  assert.equal(g.story.tokens.relay_battery, 'lost');
  assert.equal(g.siteOpen('regional_relay'), true, 'E03 again');
  assert.equal(g.siteWorkHours('regional_relay'), CAMPAIGN.expeditions.e03.repeatSafeHours);
  g.launchMission('regional_relay', team(g));
  let encounter = false;
  for (let t = 0; t < 20 * HOUR_SECONDS && g.mission; t++) { g.step(1); encounter ||= !!g.encounter; }
  assert.equal(encounter, false, 'no encounter on the recovery trip');
  assert.equal(g.story.tokens.relay_battery, 'held');
  assert.equal(g.campaign.operations.reports[0].cargo.components, undefined, 'no second reward');
});

test('with a Relay: an 18-hour cooldown, replies in 2-4 hours, +10% success, migrations heard 6 hours sooner', () => {
  const g = atP209('relay-effects');
  raise(g, 'radio_kit');
  g.story.tokens.relay_battery = 'held';
  raise(g, 'radio_relay');
  g.campaign.radio.broadcasts = 1;
  assert.ok(g.broadcast());
  const op = g.survivors[0];
  g.finishBroadcast(op);
  const p = g.campaign.radio.pending, wait = (p.at - g.elapsed) / HOUR_SECONDS;
  assert.ok(wait >= R.relayArrivalHours[0] - 1e-9 && wait <= R.relayArrivalHours[1] + 1e-9, 'reply in ' + wait);
  assert.equal(g.metric('relayBroadcastFinished'), true);
  g.campaign.radio.pending = null;
  g.elapsed += 18 * HOUR_SECONDS - 10;
  assert.match(g.broadcastBlock(), /Next broadcast/);
  g.elapsed += 20;
  assert.equal(g.broadcastBlock(), '');
  g.scheduleMigration('first');
  assert.ok(Math.abs((g.campaign.migration.arriveAt - g.elapsed) / HOUR_SECONDS - (M.first.warningHours + M.relayWarningBonusHours)) < 1e-9);
});

test('the Reinforced Shelter: 16 slots alongside the Makeshift Shelter’s 8, noticed only at a tenth of sight', () => {
  const g = atP209('bunker');
  g.completeTask('p2_09');
  const a = raise(g, 'makeshift_shelter'), b = raise(g, 'reinforced_shelter');
  assert.equal(g.emergencyShelterCapacity, 24);
  assert.ok(g.shelterAll());
  for (let t = 0; t < 3 * HOUR_SECONDS && !g.atHome.every(s => s.sheltered); t += .5) g.step(.5);
  const z = g.spawnZombie(0), inB = g.survivors.some(s => s.shelter === b.id && s.sheltered);
  if (inB) {
    Object.assign(z, { x: b.x + 19, y: b.y });
    assert.equal(g.shelterNoticed(b, z), true);
    Object.assign(z, { x: b.x + 25, y: b.y });
    assert.equal(g.shelterNoticed(b, z), false);
  }
  assert.ok(a);
});

test('a camp walled in two by its buildings: a way in is chosen that leads to where the walker is going', () => {
  const g = atP209('split');
  const land = g.territory;
  // A wall of structures straight across the camp, west of centre.
  for (let y = land.top; y <= land.bottom; y += 16) g.buildings.push({ id: g.nextId++, type: 'supply_stash', model: 'campaign', x: -48, y, rotation: 0, hp: 140, upgrades: [], built: true });
  g.navVersion++;
  const west = { x: land.left - 160, y: 0 }, east = { x: 64, y: 16 };
  assert.ok(g.walkable(east));
  assert.notEqual(g.areaAt({ x: land.left + 24, y: 0 }), g.areaAt(east), 'two areas');
  const path = g.findPath(west, east);
  assert.ok(path.length > 0);
  assert.deepEqual(path.at(-1), east);
});

test('P2-09 to P2-11 play through headless', () => {
  const g = atP209('arc');
  raise(g, 'makeshift_shelter'); raise(g, 'radio_kit'); raise(g, 'barracks');
  const place = t => g.build(t, ...spot(g, t), 0), built = b => { for (let h = 0; h < 30 && b.blueprint; h++) hours(g, 1); };
  expedition(g, 'old_access_road', 'drainage_path'); g.reviewReport(); hours(g, .1);
  assert.equal(task(g), 'P2-10');
  expedition(g, 'service_depot', 'offer_place');
  Object.assign(g.resources, { planks: 60, metal_parts: 40, cloth: 30 });
  built(place('reinforced_shelter'));
  for (let h = 0; h < 6 && task(g) === 'P2-10'; h++) hours(g, 1);
  assert.equal(task(g), 'P2-11');
  expedition(g, 'regional_relay', 'secure_door');
  Object.assign(g.resources, { planks: 40, metal_parts: 30, components: 10 });
  built(place('radio_relay'));
  g.campaign.radio.lastBroadcastAt = null;
  assert.ok(g.broadcast());
  for (let h = 0; h < 12 && task(g) === 'P2-11'; h++) hours(g, 1);
  assert.equal(task(g), 'P2-12');
  assert.equal(g.story.tokens.relay_battery, 'installed');
});
