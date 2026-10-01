// M4: campaign Phase 1 camp work. The task engine (states, unlocks, rewards paid once, cumulative counters),
// blueprints and their escrow, builders, debris gathering, garden plots, the workbench queue, placement rules,
// the P1-01 ... P1-04 chain played headless, and saving all of it mid-task.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HOUR_SECONDS } from '../web/src/engine/model.mjs';
import { CAMPAIGN } from '../web/src/engine/campaignState.mjs';
import { boundsOf } from '../web/src/engine/rules.mjs';

const F = CAMPAIGN.tuning.farming;
const P1_01 = ['open_survivors', 'select_resident', 'open_resources', 'inspect_food', 'open_build'];
function deploy(seed = 'camp-work', mapSize = 'compact') {
  const g = new Game();
  g.beginCampaign({ seed, mapSize, overseerName: 'Rook' });
  let s; do s = g.advanceWorldGeneration(); while (!s.done);
  return g;
}
const hours = (g, h) => { for (let t = 0; t < h * HOUR_SECONDS; t++) g.step(1); };
const task = g => g.currentTask?.code;
// The first legal spot for a structure, ringing out from `near`.
function spot(g, type, near = { x: 0, y: 0 }) {
  for (let r = 96; r < 300; r += 16) for (let a = 0; a < 24; a++) {
    const x = Math.round((near.x + Math.cos(a / 24 * 2 * Math.PI) * r) / 16) * 16, y = Math.round((near.y + Math.sin(a / 24 * 2 * Math.PI) * r) / 16) * 16;
    if (g.canPlace(type, x, y, 0).ok) return [x, y];
  }
  throw new Error('no spot for ' + type);
}
const place = (g, type) => { const [x, y] = spot(g, type); return g.build(type, x, y, 0); };
const finishP1_01 = g => { for (const id of P1_01) g.recordInteraction(id); hours(g, .05); };

test('the task engine: interactions, unlocks on activation, rewards paid exactly once', () => {
  const g = deploy();
  assert.equal(task(g), 'P1-01');
  assert.equal(g.autosaveReason, 'Deployment - Day 1'); g.autosaveReason = null;
  assert.ok(!g.taskUnlocked('buildings', 'tent'), 'tents unlock with P1-02');
  assert.equal(g.canPlace('tent', 128, 0, 0).ok, false);
  assert.equal(g.recordInteraction('no_such_thing'), false);
  for (const id of P1_01.slice(0, 4)) assert.equal(g.recordInteraction(id), true);
  hours(g, .05);
  assert.equal(task(g), 'P1-01', 'one interaction is still missing');
  g.recordInteraction('open_build'); hours(g, .05);
  assert.equal(g.campaign.tasks.p1_01.state, 'completed');
  assert.equal(task(g), 'P1-02');
  assert.ok(g.taskUnlocked('buildings', 'tent') && g.taskUnlocked('buildings', 'supply_stash'));
  assert.ok(g.messages.some(m => m.from === 'CentroCom' && /Task complete: P1-01/.test(m.title)));
  assert.equal(g.autosaveReason, 'Task complete: P1-01');
  // A reward is a transaction: completing the task again pays nothing.
  const cloth = g.resources.cloth;
  g.completeTask('p1_02');
  assert.equal(g.resources.cloth, cloth + 6);
  g.campaign.tasks.p1_02.state = 'active'; g.completeTask('p1_02');
  assert.equal(g.resources.cloth, cloth + 6, 'paid once');
});

test('cumulative objectives count only what happens after their task starts', () => {
  const g = deploy();
  g.tallyTask('gather', 'wood', 50);
  finishP1_01(g);
  assert.equal(g.campaign.tasks.p1_02.counters.gather_wood || 0, 0);
  g.tallyTask('gather', 'wood', 7); g.tallyTask('gather', 'scrap_metal', 3); g.tallyTask('gather', 'wood', 0);
  const p = Object.fromEntries(CAMPAIGN.tasks.find(t => t.id === 'p1_02').objectives.map(o => [o.id, g.objectiveProgress(g.currentTask, o)]));
  assert.deepEqual([p.gather_wood.value, p.gather_wood.count, p.gather_wood.done], [7, 20, false]);
  assert.equal(p.gather_scrap.value, 3);
  assert.equal(p.build_tent.done, false);
});

test('legacy walk-ups and radio broadcasts stay off in the campaign', () => {
  const g = deploy();
  Object.defineProperty(g, 'arrivalRate', { value: 1000 });
  hours(g, 4);
  assert.deepEqual(g.candidates, []);
  assert.equal(g.recruit(), false);
});

test('alerts speak at most once per two game hours', () => {
  const g = deploy();
  assert.equal(g.campaignAlert('UI_NO_FARMER'), true);
  assert.equal(g.campaignAlert('UI_NO_FARMER'), false);
  g.elapsed += 2 * HOUR_SECONDS;
  assert.equal(g.campaignAlert('UI_NO_FARMER'), true);
});

test('placement: unlocked structures go on open ground inside the protected perimeter', () => {
  const g = deploy();
  finishP1_01(g);
  const [x, y] = spot(g, 'tent'), r = g.campaign.region.protectedRadius;
  assert.equal(g.canPlace('tent', x, y, 0).ok, true);
  assert.match(g.canPlace('tent', r + 64, 0, 0).reason, /protected perimeter/);
  assert.match(g.canPlace('garden_plot', x, y, 0).reason, /not authorized/);
  const tent = g.buildings.find(b => b.type === 'tent');
  assert.match(g.canPlace('tent', tent.x, tent.y, 0).reason, /occupied/);
  const n = g.debris.find(n => Math.hypot(n.x, n.y) < r - 32);
  if (n) assert.equal(g.canPlace('tent', n.x, n.y + 6, 0).ok, false, 'debris is in the way');
  const lane = g.campaign.region.corridor.points.find(p => Math.hypot(p.x, p.y) < r - 16);
  if (lane) assert.equal(g.canPlace('tent', lane.x, lane.y, 0).ok, false, 'the corridor stays open');
  g.reserved.wood = g.resources.wood;
  assert.match(g.canPlace('tent', x, y, 0).reason, /Not enough supplies/);
});

test('blueprints reserve their cost, are raised by at most two builders and commit on completion', () => {
  const g = deploy();
  finishP1_01(g);
  const wood = g.resources.wood, cloth = g.resources.cloth;
  const b = place(g, 'tent');
  assert.ok(b.blueprint);
  assert.deepEqual([g.reserved.wood, g.reserved.cloth], [10, 4]);
  assert.equal(g.available('wood'), wood - 10);
  assert.equal(g.resources.wood, wood, 'still owned while in escrow');
  assert.equal(g.beds(b), 0, 'nobody sleeps in a blueprint');
  assert.equal(g.operational(b), false);
  hours(g, .3);
  const builders = g.survivors.filter(s => s.camp?.kind === 'build' && s.camp.id === b.id);
  assert.ok(builders.length >= 1 && builders.length <= 2, builders.length + ' builders');
  hours(g, 3);
  assert.equal(b.blueprint, undefined, 'a one-hour tent is done in a few hours');
  assert.equal(b.hp, 100);
  assert.deepEqual([g.reserved.wood, g.reserved.cloth, g.resources.wood, g.resources.cloth], [0, 0, wood - 10, cloth - 4]);
  assert.ok(g.survivors.every(s => s.camp?.id !== b.id));
});

test('builders work from an approach point that crowding pushes beyond arm’s reach', () => {
  // This layout put the second plot's only approach point 24 px out; its builders used to wait there forever.
  const g = deploy('smoke-region', 'standard');
  for (const id of ['p1_01', 'p1_02']) g.completeTask(id);
  for (const [type, x, y] of [['tent', 80, 0], ['supply_stash', 64, 64], ['garden_plot', -32, 64], ['garden_plot', 16, 80]]) assert.ok(g.build(type, x, y, 0), type);
  hours(g, 8);
  assert.deepEqual(g.buildings.filter(b => b.blueprint).map(b => [b.type, b.x, b.y]), []);
});

test('cancelling a blueprint refunds everything unstarted, floor(cost x (1 - progress/2)) once started', () => {
  const g = deploy();
  finishP1_01(g);
  const wood = g.resources.wood, scrap = g.resources.scrap_metal;
  const a = place(g, 'supply_stash');
  g.demolish(a.id);
  assert.deepEqual([g.resources.wood, g.resources.scrap_metal, g.reserved.wood], [wood, scrap, 0]);
  const b = place(g, 'supply_stash');
  b.blueprint.progress = .5;
  g.demolish(b.id);
  assert.equal(g.resources.wood, wood - 15 + Math.floor(15 * .75));
  assert.equal(g.resources.scrap_metal, scrap - 5 + Math.floor(5 * .75));
  assert.equal(g.reserved.wood, 0);
  assert.deepEqual(g.reservations, {});
});

test('debris: marked piles are gathered, carried to storage, counted and removed when empty', () => {
  const g = deploy();
  finishP1_01(g);
  const n = g.debris.filter(n => n.resource === 'wood').sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0];
  const stock = n.stock, wood = g.resources.wood;
  assert.match(g.debrisHint(n.id), /click to gather/);
  assert.equal(g.toggleGather(n.id), true);
  assert.ok(n.ordered);
  for (let h = 0; h < 30 && g.debris.includes(n); h++) hours(g, 1);
  assert.ok(!g.debris.includes(n), 'the emptied pile is gone');
  hours(g, 1);
  assert.equal(g.resources.wood, wood + stock);
  assert.equal(g.campaign.tasks.p1_02.counters.gather_wood, stock);
  assert.ok(g.survivors.every(s => s.camp?.id !== n.id));
  // Unmarking calls the gatherers off.
  const m = g.debris.find(o => o.resource === 'scrap_metal');
  g.toggleGather(m.id); hours(g, .5);
  g.toggleGather(m.id);
  assert.ok(g.survivors.every(s => s.camp?.id !== m.id || s.camp.phase === 'toStore'));
});

test('gathering stops delivering while storage overflows', () => {
  const g = deploy();
  g.resources.wood += 2000;
  assert.ok(g.outputBlocked);
  assert.equal(g.deposit('wood', 5), 0);
  assert.equal(g.deposit('wood', 5, true), 5, 'rewards and refunds still land');
});

test('garden plots: the first crop after 12 effective hours, then a batch every 3', () => {
  const g = deploy();
  for (const id of ['p1_01', 'p1_02']) g.completeTask(id);
  const plot = place(g, 'garden_plot');
  plot.blueprint.progress = 1 - 1e-9; hours(g, .2);
  assert.equal(plot.blueprint, undefined);
  const food = () => g.resources.food;
  plot.crop = { labor: F.firstCropHours - .001, first: true, pending: 0 };
  let before = food(); g.cropTick(0);
  assert.equal(food(), before, 'not ripe yet');
  plot.crop.labor = F.firstCropHours; g.cropTick(0);
  assert.equal(food(), before + F.firstCropHours * F.gardenFoodPerWorkHour);
  assert.equal(plot.crop.first, false);
  before = food(); plot.crop.labor = F.batchHours; g.cropTick(0);
  assert.equal(food(), before + F.batchHours * F.gardenFoodPerWorkHour);
  // A posted farmer at the plot adds the labor; nobody posted raises the alert.
  g.campaign.alertAt = {};
  g.cropTick(0);
  assert.ok(g.campaign.alertAt.UI_NO_FARMER != null);
  const farmer = g.survivors[0];
  assert.ok(g.post(farmer.id, plot.id));
  const labor = plot.crop.labor;
  hours(g, 2);
  assert.ok(plot.crop.labor > labor || plot.crop.first === false, 'labor accrues');
  assert.equal(g.campaign.tasks.p1_03.counters.deliver_food > 0, true);
});

test('the workbench queue: inputs reserved on queueing, ten orders, refunds, and a new operator keeps progress', () => {
  const g = deploy();
  for (const id of ['p1_01', 'p1_02', 'p1_03']) g.completeTask(id);
  const bench = place(g, 'field_workbench');
  assert.equal(g.queueCraft(bench.id, 'c01'), false, 'not while a blueprint');
  bench.blueprint.progress = 1 - 1e-9; hours(g, .2);
  assert.equal(bench.blueprint, undefined);
  assert.equal(g.queueCraft(bench.id, 'c02'), false, 'spears unlock with P1-06');
  g.completeTask('p1_04');
  assert.ok(g.taskUnlocked('recipes', 'c03'));
  assert.equal(g.queueCraft(bench.id, 'c03'), true, 'bandages go to the medical stock');
  g.cancelCraft(bench.id, bench.queue.length - 1);
  g.resources.wood = 100;
  for (let i = 0; i < 10; i++) assert.equal(g.queueCraft(bench.id, 'c01'), true);
  assert.equal(g.queueCraft(bench.id, 'c01'), false, 'ten orders');
  assert.equal(g.reserved.wood, 40);
  for (let i = 0; i < 9; i++) g.cancelCraft(bench.id, 1);
  assert.equal(g.reserved.wood, 4);
  assert.equal(g.resources.wood, 100, 'unstarted orders refund in full');
  // One operator starts the club, another finishes it.
  const [a, b] = g.survivors;
  const near = s => { const r = boundsOf(bench); Object.assign(s, { x: r.left - 4, y: (r.top + r.bottom) / 2 }); };
  near(a); near(b);
  const clubs = g.items.filter(i => i.type === 'wooden_club').length;
  g.craftWork(a, bench, { speed: 40 }, HOUR_SECONDS * .1);
  const progress = bench.queue[0].progress;
  assert.ok(progress > 0 && progress < 1);
  g.craftWork(b, bench, { speed: 40 }, 1);
  assert.ok(bench.queue[0].progress > progress, 'the second operator continues');
  for (let i = 0; i < 200 && bench.queue.length; i++) g.craftWork(b, bench, { speed: 40 }, 1);
  assert.equal(bench.queue.length, 0);
  assert.equal(g.items.filter(i => i.type === 'wooden_club').length, clubs + 1);
  assert.deepEqual([g.resources.wood, g.reserved.wood], [96, 0]);
});

test('P1-01 to P1-04 play through headless in under three days with nothing left in escrow', () => {
  const g = deploy('playthrough', 'standard');
  finishP1_01(g);
  assert.equal(task(g), 'P1-02');
  const near = r => g.debris.filter(n => n.resource === r).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
  for (const n of [near('wood')[0], near('scrap_metal')[0], near('scrap_metal')[1]]) g.toggleGather(n.id);
  assert.ok(place(g, 'tent')); assert.ok(place(g, 'supply_stash'));
  for (let h = 0; h < 12 && task(g) === 'P1-02'; h++) hours(g, 1);
  assert.equal(task(g), 'P1-03');
  const plots = [place(g, 'garden_plot'), place(g, 'garden_plot')];
  for (let h = 0; h < 24 && plots.some(p => p.blueprint); h++) hours(g, 1);
  plots.forEach((p, i) => assert.ok(g.post(g.survivors[i].id, p.id)));
  for (let h = 0; h < 72 && task(g) === 'P1-03'; h++) hours(g, 1);
  assert.equal(task(g), 'P1-04');
  const bench = place(g, 'field_workbench');
  for (let h = 0; h < 24 && bench.blueprint; h++) hours(g, 1);
  assert.ok(g.post(g.survivors[2].id, bench.id));
  assert.ok(g.queueCraft(bench.id, 'c01'));
  for (let h = 0; h < 48 && task(g) === 'P1-04'; h++) hours(g, 1);
  assert.equal(task(g), 'P1-05');
  assert.ok(g.day <= 3, 'day ' + g.day);
  assert.ok(['p1_01', 'p1_02', 'p1_03', 'p1_04'].every(id => g.campaign.tasks[id].state === 'completed'));
  assert.deepEqual(g.reservations, {});
  assert.ok(Object.values(g.reserved).every(n => Math.abs(n) < 1e-9));
  assert.equal(g.survivors.length, 5);
});

test('a save mid-task keeps tasks, blueprints and their escrow, craft queues and debris orders', () => {
  const g = deploy('persist-work');
  for (const id of ['p1_01', 'p1_02', 'p1_03']) g.completeTask(id);
  g.tallyTask('craft', 'wooden_club', 0);
  const tent = place(g, 'tent'); tent.blueprint.progress = .4;
  const bench = place(g, 'field_workbench'); bench.blueprint.progress = 1 - 1e-9; hours(g, .2);
  g.resources.wood += 20;
  g.queueCraft(bench.id, 'c01'); bench.queue[0].progress = .3;
  const n = g.debris[0]; g.toggleGather(n.id);
  const loaded = new Game(), data = g.serialize();
  assert.ok(loaded.restore(data), loaded.restoreError(data));
  assert.deepEqual(loaded.campaign.tasks, g.campaign.tasks);
  assert.deepEqual(loaded.campaign.unlocks, g.campaign.unlocks);
  assert.deepEqual(loaded.campaign.rewardTx, g.campaign.rewardTx);
  assert.equal(task(loaded), 'P1-04');
  const lt = loaded.buildings.find(b => b.id === tent.id);
  assert.deepEqual(lt.blueprint, tent.blueprint);
  assert.deepEqual(loaded.reservations, g.reservations);
  assert.deepEqual(loaded.reserved, g.reserved);
  assert.deepEqual(loaded.buildings.find(b => b.id === bench.id).queue, bench.queue);
  assert.equal(loaded.debris.find(o => o.id === n.id).ordered, true);
  // Cancelling after the load refunds against the restored reservation.
  const wood = loaded.resources.wood, p = lt.blueprint.progress;
  assert.ok(p >= .4 && p < 1);
  loaded.demolish(lt.id);
  assert.equal(loaded.resources.wood, wood - 10 + Math.floor(10 * (1 - p / 2)));
  assert.equal(loaded.reservations[tent.blueprint.tx], undefined);
});
