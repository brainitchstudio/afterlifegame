// M1: the campaign clock and the supply ledger (escrow, weight-based storage, overflow) and save version 4.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HOUR_SECONDS, DAY_SECONDS, RUN_DAYS } from '../web/src/engine/model.mjs';
import { CAMPAIGN, campaignStartingSupplies } from '../web/src/engine/campaignState.mjs';
import { checkSave } from '../web/src/engine/saveSchema.mjs';

// A campaign with the dead kept away, so only the ledger and the clock move.
function campaign(settings = {}) {
  const g = new Game(Math.random, { mode: 'campaign', campaign: settings });
  g.spawnTimer = 1e12; g.director.timer = 1e12; g.zombies = [];
  return g;
}
const run = (g, seconds) => { for (let t = 0; t < seconds; t += 1) g.step(1); };

test('a game hour is 42 seconds and a campaign day 1008', () => {
  assert.equal(HOUR_SECONDS, 42);
  assert.equal(DAY_SECONDS, 1008);
  assert.equal(CAMPAIGN.tuning.time.hourSeconds, HOUR_SECONDS);
});

test('a campaign starts on day 1 at 07:00, turns the day at midnight and has no last day', () => {
  const g = campaign();
  assert.equal(g.day, 1); assert.equal(g.hour, 7); assert.ok(g.workShift);
  g.elapsed = 12 * HOUR_SECONDS; assert.equal(g.hour, 19); assert.equal(g.workShift, false);
  g.elapsed = 17 * HOUR_SECONDS - 1; assert.equal(g.day, 1);
  g.elapsed = 17 * HOUR_SECONDS; assert.equal(g.day, 2); assert.equal(g.hour, 0);
  assert.equal(g.stampAt(17 * HOUR_SECONDS + 90 * 0.7), 'DAY 2 · 01:30');
  g.elapsed = DAY_SECONDS * (RUN_DAYS + 5); g.step(0.05);
  assert.equal(g.status, 'playing', 'the 24-day run limit is a legacy rule');
  assert.equal(g.day, RUN_DAYS + 6);
  // A legacy run keeps its 06:00 start and dawn day change.
  const legacy = new Game();
  assert.equal(legacy.hour, 6); legacy.elapsed = DAY_SECONDS - 1; assert.equal(legacy.day, 1);
});

test('CentroCom sends the daily operations summary at 07:00', () => {
  const g = campaign();
  const before = g.messages.length;
  g.elapsed = DAY_SECONDS - 2;
  run(g, 4);
  const report = g.messages.slice(before).find(m => m.title === 'Day 2 operations summary');
  assert.ok(report, 'a report on the morning of day 2');
  assert.equal(report.from, 'CentroCom');
  assert.match(report.body, /^DAY 2 OPERATIONS SUMMARY\. Population: 5\./);
});

test('residents eat one ration a day and there is no passive income', () => {
  const g = campaign();
  const food = g.resources.food, wood = g.resources.wood, scrap = g.resources.scrap_metal;
  g.step(DAY_SECONDS);
  assert.ok(Math.abs(g.resources.food - (food - g.survivors.length)) < 1e-6, 'one food each per day');
  assert.equal(g.resources.wood, wood); assert.equal(g.resources.scrap_metal, scrap);
});

test('starting supplies follow the difficulty and fit the cache', () => {
  const standard = campaign();
  assert.deepEqual(campaignStartingSupplies('standard'), { ...CAMPAIGN.tuning.deployment.startingSupplies, raw_salvage: 0, planks: 0, metal_parts: 0 });
  assert.equal(standard.storedWeight, 347.5, 'supplies plus four spare weapons');
  assert.equal(standard.storageCapacity, 600);
  assert.equal(standard.overflow, 0);
  const assisted = campaign({ difficulty: 'assisted' });
  assert.equal(assisted.resources.wood, 225); assert.equal(assisted.resources.ammo, 45);
  assert.equal(assisted.storedWeight, 517.25);
});

test('a reservation sets resources aside; committing spends them, releasing refunds by progress', () => {
  const g = campaign();
  const cost = { wood: 15, scrap_metal: 10, cloth: 6 };
  const tx = g.reserve(cost, 'build', 'aid_station');
  assert.ok(tx);
  assert.equal(g.resources.wood, 150, 'reserved stock is still owned');
  assert.equal(g.available('wood'), 135);
  assert.equal(g.afford({ cloth: 15 }), false, 'reserved cloth cannot be spent twice');
  assert.equal(g.spend({ cloth: 15 }), false);
  assert.ok(g.commitReservation(tx));
  assert.equal(g.resources.wood, 135); assert.equal(g.available('wood'), 135); assert.equal(g.reserved.wood, 0);
  assert.equal(g.commitReservation(tx), false, 'a reservation completes once');

  const a = g.reserve(cost);
  assert.deepEqual(g.releaseReservation(a), cost, 'unstarted work refunds everything');
  assert.equal(g.resources.wood, 135); assert.equal(g.reserved.wood, 0);
  const b = g.reserve(cost);
  assert.deepEqual(g.releaseReservation(b, 0.5), { wood: 11, scrap_metal: 7, cloth: 4 }, 'floor(cost x (1 - 0.5 x progress))');
  assert.equal(g.resources.wood, 131); assert.equal(g.resources.scrap_metal, 87); assert.equal(g.resources.cloth, 12);
  assert.equal(g.reserve({ components: 99 }), null, 'nothing is reserved that is not available');
  assert.deepEqual(g.reservations, {});
});

test('the ledger reconciles: owned = start - spent - lost, reserved = open reservations', () => {
  const g = campaign();
  const start = { ...g.resources };
  const txs = [g.reserve({ wood: 20, scrap_metal: 10 }), g.reserve({ wood: 12, scrap_metal: 4, seed_packets: 1 }), g.reserve({ wood: 4 })];
  g.commitReservation(txs[0]);
  const refund = g.releaseReservation(txs[1], 0.4);
  const lost = Object.fromEntries(Object.entries({ wood: 12, scrap_metal: 4, seed_packets: 1 }).map(([r, n]) => [r, n - refund[r]]));
  assert.equal(g.resources.wood, start.wood - 20 - lost.wood);
  assert.equal(g.resources.scrap_metal, start.scrap_metal - 10 - lost.scrap_metal);
  assert.equal(g.resources.seed_packets, start.seed_packets - lost.seed_packets);
  assert.deepEqual(Object.fromEntries(Object.entries(g.reserved).filter(([, n]) => n)), { wood: 4 });
});

test('demolition returns 40% of structural materials and a ruin holds 25%', () => {
  const g = campaign();
  assert.deepEqual(g.demolitionRefund({ planks: 30, metal_parts: 15, cloth: 12 }), { planks: 12, metal_parts: 6 });
  assert.deepEqual(g.ruinStock({ wood: 35, scrap_metal: 25, cloth: 8 }), { wood: 8, scrap_metal: 6 });
});

test('stock beyond working storage overflows: still spendable, but production stops delivering', () => {
  const g = campaign();
  const cache = g.buildings.find(b => b.type === 'cache');
  // 1000 weight against the cache's 600.
  g.deposit('wood', 1000 - g.storedWeight, true);
  assert.equal(g.storedWeight, 1000);
  assert.equal(g.overflow, 400); assert.ok(g.outputBlocked);
  assert.equal(g.deposit('scrap_metal', 5), 0, 'gathering and production are held');
  assert.equal(g.deposit('food', 5, true), 5, 'mission cargo and rewards unload into overflow');
  assert.ok(g.spend({ wood: 10 }), 'overflowing stock is still usable');
  // Two stashes bring capacity to 1000: intake resumes once everything fits.
  g.spend({ wood: 5 });
  g.addBuilding('supply_stash', -120, 80); g.addBuilding('supply_stash', 120, 80);
  assert.equal(g.storageCapacity, 1000);
  assert.equal(g.outputBlocked, false);
  assert.equal(g.deposit('scrap_metal', 5), 5);
  // Broken storage holds nothing, but its contents are never deleted.
  const owned = { ...g.resources };
  cache.hp = 1;
  assert.equal(g.storageCapacity, 400);
  assert.deepEqual(g.resources, owned);
  assert.ok(g.outputBlocked);
});

test('spare equipment weighs 2 each; carried equipment weighs nothing', () => {
  const g = campaign(), base = g.storedWeight;
  g.addItem('pipe');
  assert.equal(g.storedWeight, base + 2);
  g.equip(g.survivors[0], g.items.at(-1));
  assert.equal(g.storedWeight, base + 2, 'the survivor dropped their old weapon into the stores');
});

test('campaign saves keep the ledger and open reservations, and outlast the 24-day limit', () => {
  const g = campaign({ overseerName: 'Rook' });
  const tx = g.reserve({ wood: 30, cloth: 4 }, 'build', 'tent');
  g.elapsed = DAY_SECONDS * 40;
  const json = g.serialize(), data = JSON.parse(json);
  assert.equal(data.version, 4);
  assert.equal(checkSave(data), '');
  const loaded = new Game();
  assert.ok(loaded.restore(json));
  assert.equal(loaded.available('wood'), 120);
  assert.deepEqual(loaded.reservations[tx].cost, { wood: 30, cloth: 4 });
  assert.equal(loaded.resources.components, 8);
  assert.ok(loaded.commitReservation(tx));
  assert.equal(loaded.resources.wood, 120);
  const legacy = JSON.parse(new Game().serialize()); legacy.elapsed = DAY_SECONDS * 40;
  assert.match(checkSave(legacy), /past the end of the run/);
});

test('version 3 saves load with their metal as scrap metal', () => {
  const old = JSON.parse(new Game().serialize());
  old.version = 3; delete old.reservations; delete old.nextTxId;
  old.resources = { wood: 12, metal: 34, food: 56 };
  const g = new Game();
  assert.ok(g.restore(JSON.stringify(old)), checkSave(old));
  assert.deepEqual(g.resources, { wood: 12, food: 56, scrap_metal: 34 });
  assert.equal(g.mode, 'legacy');
});
