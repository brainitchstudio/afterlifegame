import test from 'node:test';
import assert from 'node:assert/strict';
import { has } from '../web/src/engine/data.mjs';
import { Game, DAY_SECONDS, HOUR_SECONDS, RUN_DAYS, EXPEDITIONS, buildingMaxHP, survivorStats, boundsOf, postSlots, phaseAt, circadian, jobOf } from '../web/src/engine/model.mjs';
import { buildIndex } from '../web/src/engine/spatial.mjs';
import { gateSlots, parcelRect, perimeterSlots, touchesLand } from '../web/src/engine/land.mjs';
import { steerAroundTrees } from '../web/src/engine/trees.mjs';
import { wallTiles } from '../web/src/engine/walls.mjs';
import { CAMP } from '../web/src/engine/camp.mjs';
import { QUESTS, RANKS, STARTING_CACHE, upgradeTier } from '../web/src/engine/progression.mjs';
import { generateStats, grantStatPoint, validateOptions, partyCap, STAT_KEYS, TUNING } from '../web/src/engine/survivors.mjs';

// Most scenarios here exercise the walled refuge a camp grows into; camp tests say so.
const REFUGE = { start: 'refuge' };
const quietGame = () => { const g = new Game(() => .5, REFUGE); g.spawnTimer = 1e9; return g; };
const richGame = () => { const g = quietGame(); g.resources = { food: 10000, wood: 10000, scrap_metal: 10000 }; return g; };
// Watchtowers are built by the player now; tests raise one where they need it.
const raiseTower = (g, x, y) => g.addBuilding('tower', x, y);
// Survivors start out on the patrol lane and the only ways in are the gates; tests about
// work inside the wall start them inside it.
const bringIn = (...people) => people.forEach((s, i) => Object.assign(s, { x: -32 + i * 32, y: 144, path: [] }));

test('daylight, nightfall, and the next dawn follow the 24-hour clock', () => {
  const g = quietGame();
  assert.equal(g.hour, 6); assert.equal(g.day, 1); assert.equal(g.night, false);
  g.step(DAY_SECONDS / 2 + .01);
  assert.equal(g.night, true); assert.equal(g.day, 1);
  g.step(DAY_SECONDS / 2);
  assert.equal(g.night, false); assert.equal(g.day, 2);
});
test('zombies arrive beyond all four visible viewport edges', () => {
  const g = quietGame(); g.bounds = { x: 850, y: 460 };
  const [n, e, s, w] = [0, 1, 2, 3].map(side => g.spawnZombie(side));
  assert.ok(n.y < -460); assert.ok(e.x > 850); assert.ok(s.y > 460); assert.ok(w.x < -850);
});
test('farms grow food, survivors consume it, and greenhouses preserve night production', () => {
  const g = richGame(); const farm = g.buildings.find(b => b.type === 'farm');
  const initial = g.resources.food; g.step(10); assert.ok(g.resources.food > initial);
  const daylight = g.rates().food;
  g.elapsed = DAY_SECONDS * .6; assert.ok(g.rates().food < daylight);
  assert.equal(g.upgradeBuilding(farm.id, 'greenhouse'), false);
  assert.equal(g.upgradeBuilding(farm.id, 'irrigation'), true);
  assert.equal(g.upgradeBuilding(farm.id, 'greenhouse'), true);
  const night = g.rates().food; g.elapsed = 0; assert.equal(g.rates().food, night);
  g.buildings = g.buildings.filter(b => b.type !== 'farm');
  assert.ok(g.rates().food < 0);
});
test('empty food causes starvation and food recovery restores healing', () => {
  const g = quietGame(); g.buildings = g.buildings.filter(b => b.type !== 'farm'); g.resources.food = 0;
  const start = g.survivors[0].hp; g.step(10); assert.ok(g.survivors[0].hp < start);
  const hp = g.survivors[0].hp; g.resources.food = 20; g.step(10); assert.ok(g.survivors[0].hp > hp);
});
test('bunkhouse beds cap recruitment and each resident gets a bed', () => {
  const g = richGame(); assert.equal(g.capacity, 6); assert.ok(g.survivors.every(s => s.home != null));
  for (let i = 0; i < 2; i++) { assert.ok(g.recruit()); g.step(TUNING.recruitment.broadcastHours * HOUR_SECONDS + .1); assert.ok(g.acceptCandidate(g.candidates[0].id)); }
  const before = g.resources.food; assert.equal(g.recruit(), false); assert.equal(g.resources.food, before);
  const dorm = g.build('dorm', 0, -80); assert.ok(dorm); assert.equal(g.capacity, 10);
  assert.ok(g.upgradeBuilding(dorm.id, 'bunks')); assert.equal(g.capacity, 12);
  assert.ok(g.upgradeBuilding(dorm.id, 'annex')); assert.equal(g.capacity, 16);
  const homes = g.survivors.map(s => s.home), counts = {}; for (const h of homes) counts[h] = (counts[h] || 0) + 1;
  for (const b of g.buildings) assert.ok((counts[b.id] || 0) <= g.beds(b));
  assert.ok(g.acceptCandidate(g.createCandidate('walk-up').id));
});
test('construction is transactional and rejects occupied and out-of-bounds plots', () => {
  const g = richGame(); const before = { ...g.resources };
  assert.equal(g.build('farm', 0, 0), false); assert.deepEqual(g.resources, before);
  assert.equal(g.build('farm', 400, 300), false); assert.deepEqual(g.resources, before);
  const farm = g.build('farm', 0, 80); assert.ok(farm);
  assert.equal(g.resources.wood, before.wood - 45); assert.equal(g.resources.scrap_metal, before.scrap_metal - 8);
  assert.equal(g.build('dorm', 0, 80), false);
});
test('new recruits spawn clear of newly constructed buildings', () => {
  const g = richGame(); assert.ok(g.build('farm', 0, 80));
  const s = g.acceptCandidate(g.createCandidate('walk-up').id); assert.ok(s);
  for (const b of g.buildings) {
    const r = boundsOf(b, 5);
    assert.ok(!(s.x > r.left && s.x < r.right && s.y > r.top && s.y < r.bottom));
  }
  const start = { x: s.x, y: s.y }; g.step(5);
  assert.ok(Math.hypot(s.x - start.x, s.y - start.y) > 50);
});
test('building upgrade dependencies and duplicate purchases are enforced', () => {
  const g = richGame();
  const hq = g.core, hp = hq.hp; assert.equal(g.upgradeBuilding(hq.id, 'bunker'), false); assert.ok(g.upgradeBuilding(hq.id, 'fortify')); assert.equal(hq.hp, hp + 400);
  const wood = g.resources.wood; assert.equal(g.upgradeBuilding(hq.id, 'fortify'), false); assert.equal(g.resources.wood, wood);
});
test('survivors reach assigned patrols without crossing building footprints', () => {
  const g = quietGame(), s = g.survivors[0];
  assert.ok(g.assign(s.id, 'south')); assert.equal(g.assign(s.id, 'invalid'), false);
  for (let i = 0; i < 2400; i++) {
    g.step(.05);
    for (const b of g.buildings) {
      const r = boundsOf(b);
      assert.ok(!(s.x > r.left && s.x < r.right && s.y > r.top && s.y < r.bottom), 'survivor crossed ' + b.type);
    }
  }
  assert.ok(Math.abs(s.y - g.routes.south[0].y) < 1, 'survivor reaches south side');
  assert.ok(g.assign(s.id, 'any')); assert.equal(g.route(s), g.routes.any);
});
test('patrol combat kills zombies and awards salvage and experience', () => {
  const g = quietGame(), s = g.survivors[0], z = g.spawnZombie(0);
  z.x = s.x; z.y = s.y - 70;
  const xp = s.xp; g.step(4);
  assert.equal(g.kills, 1); assert.equal(g.zombies.length, 0); assert.ok(s.xp >= xp + 12);
});
test('barricades stop and take damage from approaching zombies', () => {
  const g = quietGame(); g.survivors = [];
  const top = Math.min(...g.buildings.filter(b => b.type === 'barricade' && !b.rotation).map(b => b.y));
  const wall = g.buildings.find(b => b.type === 'barricade' && b.y === top && b.x === 80);
  const z = g.spawnZombie(0); z.x = wall.x; z.y = wall.y - 23;
  g.step(5); assert.ok(wall.hp < buildingMaxHP(wall)); assert.ok(z.y < wall.y - 4);
});
test('a watchtower only fires with someone up on it', () => {
  const g = quietGame(), tower = raiseTower(g, 208, 48);
  g.survivors = []; const z = g.spawnZombie(1); Object.assign(z, { x: tower.x + 90, y: tower.y, speed: 0 });
  // Standing right at its foot is not enough any more.
  const s = g.addSurvivor('east'); s.x = tower.x - 40; s.y = tower.y; s.role = 'medic';
  g.step(.05); assert.equal(tower.staffed, false); assert.equal(z.hp, z.maxHP);
  Object.assign(s, { stationed: true, towerId: tower.id, perch: { x: tower.x, y: tower.y - 18 } });
  g.step(.05); assert.equal(tower.staffed, true); assert.ok(z.hp < z.maxHP);
});
test('destroyed dorms remove beds without deleting existing survivors', () => {
  const g = quietGame(), count = g.survivors.length; g.buildings.find(b => b.type === 'dorm').hp = 0;
  g.step(.05); assert.equal(g.capacity, 2); assert.equal(g.survivors.length, count); assert.equal(g.recruit(), false);
});
test('repair restores durability and dismantling refunds half the build cost', () => {
  const g = richGame(), farm = g.buildings.find(b => b.type === 'farm');
  farm.hp = 20; const cost = g.repairCost(farm), wood = g.resources.wood;
  assert.ok(g.repair(farm.id)); assert.equal(farm.hp, buildingMaxHP(farm)); assert.equal(g.resources.wood, wood - cost.wood);
  const before = g.resources.wood; assert.ok(g.demolish(farm.id)); assert.equal(g.resources.wood, before + 22);
  assert.equal(g.demolish(g.core.id), false);
});
test('24 completed days win the run and a destroyed HQ ends it', () => {
  const winner = quietGame(); winner.elapsed = DAY_SECONDS * RUN_DAYS - .03; winner.step(.05);
  assert.equal(winner.status, 'won'); const elapsed = winner.elapsed; winner.step(10); assert.equal(winner.elapsed, elapsed);
  const loser = quietGame(); loser.core.hp = 0; loser.step(.05); assert.equal(loser.status, 'lost'); assert.equal(loser.build('farm', 0, 80), false);
});
test('save roundtrip preserves progression and rejects malformed data', () => {
  const g = richGame(); g.upgradeBuilding(g.core.id, 'radio'); g.assign(g.survivors[0].id, 'any'); g.step(3);
  const restored = quietGame(); assert.ok(restored.restore(g.serialize())); assert.equal(restored.serialize(), g.serialize());
  const snapshot = restored.serialize(); assert.equal(restored.restore('{broken'), false); assert.equal(restored.serialize(), snapshot);
  const malformed = JSON.parse(snapshot); malformed.resources.food = 'NaN'; assert.equal(restored.restore(JSON.stringify(malformed)), false);
  const invalidSide = JSON.parse(snapshot); invalidSide.survivors[0].side = 'northeast'; assert.equal(restored.restore(JSON.stringify(invalidSide)), false);
});

test('posting survivors to buildings gives them roles, respects slots, and survives demolition', () => {
  const g = richGame(), [a, b, c] = g.survivors;
  const workshop = g.buildings.find(x => x.type === 'workshop');
  const clinic = g.build('clinic', 0, 80); assert.ok(clinic);
  assert.ok(g.post(a.id, clinic.id)); assert.equal(a.role, 'medic');
  assert.ok(g.post(b.id, clinic.id)); assert.equal(g.post(c.id, clinic.id), false, 'clinic holds two medics');
  assert.ok(g.post(c.id, workshop.id)); assert.equal(c.role, 'engineer');
  assert.ok(g.assign(c.id, 'west')); assert.equal(c.role, 'patrol'); assert.equal(c.post, null);
  assert.ok(g.demolish(clinic.id)); assert.equal(a.role, 'patrol'); assert.equal(b.post, null);
  assert.equal(g.post(a.id, g.core.id), false, 'the HQ has no posts');
});
test('loggers stationed at the sawmill harvest wood and scale with strength', () => {
  const g = richGame(), [a, b, c] = g.survivors;
  bringIn(a, b, c);
  const mill = g.build('lumber_mill', 0, 80);
  assert.ok(mill, 'lumber mill constructed');

  // Baseline wood rate with unstaffed lumber mill
  const baseRate = g.rates().wood;
  assert.equal(g.loggerLabor(mill), 1.0);

  // Post first logger
  assert.ok(g.post(a.id, mill.id));
  assert.equal(a.role, 'logger');
  assert.equal(jobOf(a), 'logger');
  assert.ok(g.loggerLabor(mill) > 1.0, 'labor multiplier increased with logger');
  const rateWithOne = g.rates().wood;
  assert.ok(rateWithOne > baseRate, 'wood rate increased with one logger');

  // Post second logger (cap is 2)
  assert.ok(g.post(b.id, mill.id));
  assert.equal(b.role, 'logger');
  assert.equal(g.post(c.id, mill.id), false, 'lumber mill holds two loggers');
  const rateWithTwo = g.rates().wood;
  assert.ok(rateWithTwo > rateWithOne, 'wood rate increased with two loggers');

  // Demolish lumber mill resets roles
  assert.ok(g.demolish(mill.id));
  assert.equal(a.role, 'patrol');
  assert.equal(b.role, 'patrol');
});
test('the injured walk to a staffed clinic and a medic treats them; without one they stay injured', () => {
  const run = withMedic => {
    const g = richGame(), [medic, patient] = g.survivors; bringIn(medic, patient);
    if (withMedic) assert.ok(g.post(medic.id, g.build('clinic', 0, 80).id));
    const max = survivorStats(patient).hp; patient.hp = max * .3; patient.lastHit = -100;
    g.step(45); return { g, patient, ratio: patient.hp / max };
  };
  const untreated = run(false);
  assert.equal(untreated.patient.condition, 'injured'); assert.ok(untreated.ratio < .31, 'no invisible healing');
  assert.ok(untreated.g.warnings().some(w => w.includes('injured')));
  const treated = run(true);
  assert.ok(treated.ratio >= TUNING.health.recoveryThreshold - .01, 'treated to ' + treated.ratio);
  assert.equal(treated.patient.condition, 'healthy'); assert.equal(treated.patient.care, null);
});
test('engineers repair damaged barricades and spend wood doing it', () => {
  const g = richGame(), eng = g.survivors[0]; bringIn(eng);
  assert.ok(g.post(eng.id, g.buildings.find(b => b.type === 'workshop').id));
  const wall = g.buildings.find(b => b.perimeter && b.y < 0 && b.x > 0); wall.hp = 20;
  const wood = g.resources.wood; g.resources.food = 10000;
  g.step(40);
  assert.equal(wall.hp, buildingMaxHP(wall)); assert.ok(g.resources.wood < wood + 40 * g.rates().wood);
  const broke = richGame(), fixer = broke.survivors[0];
  broke.post(fixer.id, broke.buildings.find(b => b.type === 'workshop').id);
  const farm = broke.buildings.find(b => b.type === 'farm'); farm.hp = 50; broke.resources.wood = 0;
  broke.rates = () => ({ wood: 0, scrap_metal: 0, food: 0 });
  broke.step(20); assert.equal(farm.hp, 50); assert.equal(fixer.task, 'no-wood');
});
test('barracks guards gain health and run down zombies beyond their firing range', () => {
  const g = richGame(), guard = g.survivors[0], cap = g.capacity;
  const barracks = g.build('barracks', 0, 80); assert.ok(barracks); assert.equal(g.capacity, cap + 2);
  assert.equal(postSlots(barracks), 4);
  const before = guard.hp, maxBefore = survivorStats(guard).hp, damage = g.statsOf(guard).damage; assert.ok(g.post(guard.id, barracks.id));
  assert.equal(guard.hp, before + 30); assert.equal(survivorStats(guard).hp, maxBefore + 30);
  assert.ok(g.statsOf(guard).damage > damage);
  g.survivors = [guard]; g.step(3);
  Object.assign(guard, { x: g.territory.right + 30, y: -250, path: [] });
  const z = g.spawnZombie(1); z.x = g.territory.right + 20; z.y = 0; z.speed = 0;
  assert.ok(Math.hypot(z.x - guard.x, z.y - guard.y) > g.statsOf(guard).range);
  g.step(12); assert.equal(g.kills, 1, 'guard hunted the zombie down');
  assert.ok(g.assign(guard.id, 'north')); assert.equal(survivorStats(guard).hp, maxBefore); assert.ok(guard.hp <= maxBefore);
});
test('sentries man their watchtower for boosted stats and are shielded by it', () => {
  const g = quietGame(), tower = raiseTower(g, 208, 48), s = g.survivors[0]; bringIn(s);
  const base = g.statsOf(s);
  assert.ok(g.post(s.id, tower.id));
  for (const o of g.survivors.slice(1, 3)) assert.ok(g.post(o.id, tower.id));
  assert.equal(g.post(g.survivors[3].id, tower.id), false, 'one sentry per shift');
  assert.deepEqual(g.staffOf(tower).map(o => o.shift), [0, 2, 1], 'the shift on now, then night, then evening');
  g.survivors = [s];
  for (let i = 0; i < 40 && !s.stationed; i++) g.step(.5);
  assert.ok(s.stationed, 'sentry reached the tower'); assert.equal(s.task, 'manning');
  const buffed = g.statsOf(s);
  assert.ok(buffed.damage > base.damage && buffed.range > base.range && buffed.cooldown < base.cooldown);
  g.step(.05); assert.equal(tower.staffed, true);
  const z = g.spawnZombie(1); z.x = s.x + 5; z.y = s.y; z.speed = 0; z.hp = z.maxHP = 1e6;
  const hp = s.hp, towerHP = tower.hp; g.step(2);
  assert.equal(s.hp, hp); assert.ok(tower.hp < towerHP);
  tower.hp = 0; g.step(.05);
  assert.equal(s.role, 'patrol'); assert.equal(s.stationed, false); assert.equal(s.perch, null);
});
test('roles survive a save roundtrip and older saves load as patrols', () => {
  const g = richGame(), [a, b] = g.survivors;
  g.post(a.id, g.buildings.find(x => x.type === 'workshop').id);
  g.post(b.id, raiseTower(g, 208, 48).id); g.step(10);
  const restored = quietGame(); assert.ok(restored.restore(g.serialize()));
  assert.equal(restored.survivors[0].role, 'engineer'); assert.equal(restored.survivors[1].role, 'sentry');
  assert.equal(restored.serialize(), g.serialize());
  const legacy = JSON.parse(g.serialize()); for (const s of legacy.survivors) { delete s.role; delete s.post; }
  assert.ok(restored.restore(JSON.stringify(legacy))); assert.ok(restored.survivors.every(s => s.role === 'patrol' && s.post === null));
  const orphan = JSON.parse(g.serialize()); orphan.survivors[0].post = 99999;
  assert.ok(restored.restore(JSON.stringify(orphan))); assert.equal(restored.survivors[0].role, 'patrol');
});

const atHour = (g, hour) => { g.elapsed = ((hour - 6 + 24) % 24) / 24 * DAY_SECONDS; return g; };
test('the day flows through five phases with a quiet midday and a midnight peak', () => {
  assert.deepEqual([6, 12, 18, 22, 0.5, 3].map(h => phaseAt(h).id), ['dawn', 'day', 'dusk', 'midnight', 'midnight', 'deep']);
  assert.equal(circadian(11), 0); assert.ok(Math.abs(circadian(23) - 1) < 1e-9);
  const g = quietGame(); g.director.state = 'buildup';
  const noon = atHour(g, 11).spawnRate(), midnight = atHour(g, 23).spawnRate();
  assert.ok(midnight > noon * 6);
  g.director.state = 'relief'; assert.equal(g.spawnRate(), 0);
});
test('ambient arrivals follow the clock instead of jumping at nightfall', () => {
  const g = new Game(() => .5, REFUGE); g.director = { state: 'buildup', timer: 1e9, tension: 0, stressAt: -1e9 };
  const count = hour => { atHour(g, hour); g.zombies = []; g.spawnTimer = 0; let n = 0; for (let i = 0; i < 200; i++) { g.step(.05); n += g.zombies.length; g.zombies = []; } return n; };
  const noon = count(11), midnight = count(22.5);
  assert.ok(midnight > noon * 3, noon + ' vs ' + midnight);
});
test('the director telegraphs an incursion, then releases it beyond the announced edge', () => {
  const g = new Game(() => .5, REFUGE); atHour(g, 23); g.zombies = [];
  g.director = { state: 'buildup', timer: 30, tension: 99.9, stressAt: -1e9 };
  g.step(.05);
  assert.equal(g.director.state, 'peak'); assert.ok(g.incoming); assert.equal(g.incoming.eta, 5);
  const { side, count } = g.incoming;
  g.step(5.1);
  assert.equal(g.incoming, null);
  const swarm = g.zombies.filter(z => z.swarm);
  assert.equal(swarm.length, count);
  assert.ok(swarm.every(z => [z.y < -g.bounds.y, z.x > g.bounds.x, z.y > g.bounds.y, z.x < -g.bounds.x][side]));
});
test('a sentry on a watchtower spots incursions earlier', () => {
  const g = new Game(() => .5, REFUGE); atHour(g, 23);
  g.survivors[0].stationed = true; g.director.tension = 100; g.director.state = 'buildup';
  g.step(.05); assert.equal(g.incoming.total, 9); assert.equal(g.incoming.spotted, true);
});
test('a critically damaged HQ forces a respite at most every three game hours', () => {
  const g = new Game(() => .5, REFUGE); atHour(g, 23); g.core.hp = 50;
  g.step(.05); assert.equal(g.director.state, 'relief'); assert.equal(g.spawnRate(), 0);
  g.director.timer = 0; g.step(.05); assert.equal(g.director.state, 'lull');
  g.step(.05); assert.equal(g.director.state, 'lull');
  g.elapsed += DAY_SECONDS / 8; g.step(.05); assert.equal(g.director.state, 'relief');
});
test('director pacing survives a save roundtrip and older saves still load', () => {
  const g = new Game(() => .5, REFUGE); atHour(g, 23); g.director = { state: 'buildup', timer: 30, tension: 99.9, stressAt: -1e9 }; g.step(.05);
  const restored = quietGame(); assert.ok(restored.restore(g.serialize()));
  assert.deepEqual(restored.incoming, g.incoming); assert.equal(restored.director.state, 'peak'); assert.equal(restored.serialize(), g.serialize());
  const old = JSON.parse(g.serialize()); delete old.director; delete old.incoming; delete old.threatSide;
  assert.ok(restored.restore(JSON.stringify(old))); assert.equal(restored.director.state, 'lull'); assert.equal(restored.incoming, null);
});
test('game time runs at 42 real seconds per hour and saves from the 3-minute day keep their date and time', () => {
  assert.equal(DAY_SECONDS, 1008);
  const g = quietGame(); const start = g.hour; g.step(7); assert.ok(Math.abs((g.hour - start) * 60 - 10) < 1e-6);
  g.elapsed = DAY_SECONDS * 2.5; assert.equal(g.day, 3); assert.equal(g.hour, 18);
  const legacy = JSON.parse(g.serialize()); delete legacy.dayLength; legacy.elapsed = 180 * 2.5;
  const restored = quietGame(); assert.ok(restored.restore(JSON.stringify(legacy)));
  assert.equal(restored.day, 3); assert.equal(restored.hour, 18);
});

// ---- Survivor system V1 ----
test('stat generation holds its invariants and is deterministic', () => {
  for (let i = 0; i < 400; i++) {
    const r = generateStats(12345, i, 'test:' + i);
    const values = STAT_KEYS.map(k => r.stats[k]), sum = values.reduce((a, b) => a + b, 0);
    assert.ok(values.every(v => v >= 2 && v <= 8)); assert.equal(sum, r.budget);
    assert.equal(r.budget, Math.min(30, Math.max(17, 15 + Math.floor(.75 * r.quality))));
    assert.ok(r.rawQuality >= 3 && r.rawQuality <= 18);
    assert.equal(new Set(Object.values(r.aptitudes)).size, 3);
  }
  assert.deepEqual(generateStats(7, 1, 'radio:1'), generateStats(7, 1, 'radio:1'));
  assert.notDeepEqual(generateStats(7, 1, 'radio:1').stats, generateStats(7, 2, 'radio:2').stats);
});
test('the unmodified budget averages about 22.5 across a fixed-seed population', () => {
  let total = 0; const n = 4000;
  for (let i = 0; i < n; i++) total += generateStats(99, i, 'sim:' + i).budget;
  assert.ok(Math.abs(total / n - 22.5) < .25, 'mean budget ' + total / n);
});
test('authored overrides shape a survivor, and bad overrides are rejected at load', () => {
  for (let i = 0; i < 50; i++) {
    const nurse = generateStats(1, i, 'quest:' + i, { qualityFloor: 10, forcedPrimaryStat: 'int' });
    assert.ok(nurse.quality >= 10); assert.equal(nurse.aptitudes.primary, 'int');
  }
  const vet = generateStats(1, 1, 'vet', { levelOverride: 30 });
  assert.ok(STAT_KEYS.every(k => vet.stats[k] <= 10)); assert.equal(STAT_KEYS.reduce((a, k) => a + vet.stats[k], 0) + vet.unspent, vet.budget + 29);
  assert.throws(() => validateOptions({ forcedPrimaryStat: 'int', forcedWeakStat: 'int' }));
  assert.throws(() => validateOptions({ forcedPrimaryStat: 'luck' }));
  assert.throws(() => validateOptions({ qualityFloor: 2 }));
});
test('level-ups grant one seeded stat point up to the cap of 10', () => {
  const stats = { str: 10, agi: 10, end: 10, int: 10, cha: 9 }, apt = { primary: 'str', secondary: 'agi', weak: 'cha' };
  assert.equal(grantStatPoint(stats, apt, 5, 2), 'cha'); assert.equal(grantStatPoint(stats, apt, 5, 3), null);
  const g = quietGame(), s = g.survivors[0], sum = () => STAT_KEYS.reduce((a, k) => a + s.stats[k], 0), before = sum();
  g.grantXP(s, g.xpNeeded(s)); assert.equal(s.level, 2); assert.equal(sum(), before + 1);
  const copy = new Game(() => .5, REFUGE); copy.spawnTimer = 1e9; copy.grantXP(copy.survivors[0], copy.xpNeeded(copy.survivors[0]));
  assert.deepEqual(copy.survivors[0].stats, s.stats, 'same seed, same level, same point');
});
test('candidates are generated once and never reroll across save and load', () => {
  const g = richGame(); assert.ok(g.recruit()); g.step(TUNING.recruitment.broadcastHours * HOUR_SECONDS + .1);
  const c = g.candidates[0]; assert.equal(c.source, 'radio'); const stats = { ...c.stats };
  const restored = quietGame(); assert.ok(restored.restore(g.serialize())); assert.deepEqual(restored.candidates[0].stats, stats);
  const s = restored.acceptCandidate(c.id); assert.deepEqual(s.stats, stats); assert.equal(s.id, c.id);
  assert.equal(restored.candidates.length, 0);
  const walk = restored.createCandidate('walk-up'); assert.ok(restored.declineCandidate(walk.id)); assert.equal(restored.acceptCandidate(walk.id), false);
});
test('weapons are reserved to one survivor, favour guards, and are released on death', () => {
  const g = richGame(); const held = g.items.filter(i => i.holder != null);
  assert.equal(new Set(held.map(i => i.holder)).size, held.length);
  assert.ok(g.survivors.every(s => s.weapon == null || g.items.find(i => i.id === s.weapon).holder === s.id));
  const rifleman = g.survivors.find(s => s.gear === 'rifle'); assert.equal(jobOf(rifleman), 'guard');
  g.kill(rifleman, 'test'); assert.ok(g.items.find(i => i.type === 'rifle').holder !== rifleman.id);
  const unarmed = richGame(); unarmed.items = []; for (const s of unarmed.survivors) { s.weapon = null; s.gear = null; }
  assert.equal(unarmed.statsOf(unarmed.survivors[0]).weapon, 'Bare hands');
  assert.ok(unarmed.fabricate('pistol')); assert.ok(unarmed.survivors.some(s => s.gear === 'pistol'));
});
test('a downed survivor is rescued by a medic, or bleeds out and is fully cleaned up', () => {
  const g = richGame(), [medic, victim] = g.survivors;
  const clinic = g.build('clinic', 0, 80); assert.ok(g.post(medic.id, clinic.id));
  victim.hp = -1; g.step(.05); g.step(.05);
  assert.equal(victim.condition, 'downed'); assert.equal(victim.rescuer, medic.id); assert.equal(medic.rescue, victim.id);
  for (let i = 0; i < 400 && victim.condition === 'downed'; i++) g.step(.1);
  assert.equal(victim.condition, 'injured'); assert.ok(victim.hp > 0); assert.equal(medic.rescue, null);
  const lonely = quietGame(), [a] = lonely.survivors; lonely.survivors = [a];
  a.hp = -1; lonely.step(.05); assert.equal(a.condition, 'downed');
  const bed = a.home, weapon = a.weapon; lonely.step(a.bleed + 1);
  assert.equal(lonely.survivors.length, 0); assert.equal(lonely.items.find(i => i.id === weapon).holder, null); assert.equal(lonely.residents({ id: bed }).length, 0);
});
test('without a medic a healthy survivor stabilizes the downed more slowly', () => {
  const g = richGame(), [victim, helper] = g.survivors;
  victim.hp = -1; g.step(.05); g.step(.05);
  assert.ok(victim.rescuer != null); const rescuer = g.survivors.find(s => s.id === victim.rescuer); assert.notEqual(rescuer.role, 'medic');
  for (let i = 0; i < 600 && victim.condition === 'downed'; i++) g.step(.1);
  assert.equal(victim.condition, 'injured');
});
test('an occupied watchtower raises one merged alert and dispatches the nearest guards', () => {
  const g = quietGame(), tower = raiseTower(g, 208, 48), [sentry, ...guards] = g.survivors; bringIn(sentry);
  assert.ok(g.post(sentry.id, tower.id)); for (let i = 0; i < 40 && !sentry.stationed; i++) g.step(.5);
  assert.ok(sentry.stationed);
  const a = g.spawnZombie(1), b = g.spawnZombie(1); for (const z of [a, b]) { z.x = tower.x + 280; z.y = tower.y + (z === a ? 0 : 20); z.speed = 0; }
  g.perceiveTimer = 0; g.step(.05);
  assert.equal(g.alerts.length, 1); assert.equal(g.alerts[0].severity, 2); assert.equal(g.alerts[0].local, false);
  assert.equal(guards.filter(s => s.respond === g.alerts[0].id).length, 2, 'a pair dispatches two guards');
  tower.hp = 0; g.step(.05); a.hp = 0; b.hp = 0; g.perceiveTimer = 0; g.step(.6); assert.equal(g.alerts.length, 0);
  assert.ok(guards.every(s => !s.respond));
});
test('the alarm pulls guards off routine patrols and clears itself after an hour of quiet', () => {
  const g = quietGame(); assert.ok(g.raiseAlarm()); assert.equal(g.raiseAlarm(), false);
  g.step(5); assert.ok(g.survivors.every(s => ['holding', 'to-position'].includes(s.task)));
  g.step(TUNING.defense.allClearHours * HOUR_SECONDS + 2); assert.equal(g.alarm.raised, false);
});
test('a player attack order sends nearby survivors, guards first, and ends when the target dies', () => {
  const g = quietGame(), z = g.spawnZombie(1); z.x = g.territory.right + 60; z.y = 40; z.speed = 0;
  const result = g.orderAttack(z.id); assert.ok(result.ok); assert.ok(result.team.length <= TUNING.combat.attackGroup);
  assert.ok(result.team.every(s => s.order.zombieId === z.id));
  g.step(20); assert.equal(z.hp <= 0 || !g.zombies.includes(z), true); assert.ok(g.survivors.every(s => !s.order));
  assert.equal(g.orderAttack(z.id).ok, false);
});
test('shelter respects capacity, reports who is left out, keeps guards on duty and all-clear restores work', () => {
  const g = richGame(); const workshop = g.buildings.find(b => b.type === 'workshop'), farm = g.buildings.find(b => b.type === 'farm');
  const [a, b, c] = g.survivors; bringIn(a, b, c); g.post(a.id, workshop.id); g.post(b.id, farm.id); g.post(c.id, 'scavenger');
  TUNING.shelter.core = 2; const result = g.orderShelter(g.core.id); TUNING.shelter.core = 8;
  assert.equal(result.placed.length, 2); assert.equal(result.unplaced.length, 1);
  assert.ok(g.survivors.filter(s => jobOf(s) === 'guard').every(s => s.shelter == null));
  g.step(20); const inside = g.survivors.filter(s => s.sheltered); assert.equal(inside.length, 2);
  const z = g.spawnZombie(1); z.x = inside[0].x + 5; z.y = inside[0].y; z.speed = 0; const hp = inside[0].hp; g.step(1); assert.equal(inside[0].hp, hp, 'the dead cannot reach sheltered survivors');
  assert.ok(g.clearShelter()); assert.ok(g.survivors.every(s => !s.sheltered && s.shelter == null));
});
test('expedition parties are capped by population, share an outcome, and release and reclaim gear', () => {
  assert.deepEqual([1, 5, 6, 10, 11, 20, 21, 35, 36].map(partyCap), [1, 1, 2, 2, 3, 3, 4, 4, 5]);
  const g = richGame(), [a, b] = g.survivors;
  assert.equal(g.partyCap, 1); assert.equal(g.sendExpedition([a.id, b.id], 'woodland'), false);
  for (let i = 0; i < 2; i++) g.addSurvivor('any', g.createCandidate('walk-up', {}, false));
  assert.equal(g.survivors.length, 6); assert.equal(g.partyCap, 2);
  const wood = g.resources.wood, weaponA = a.weapon;
  assert.ok(g.sendExpedition([a.id, b.id], 'woodland'));
  assert.equal(a.expedition.party, b.expedition.party); assert.equal(a.weapon, null); assert.equal(g.items.find(i => i.id === weaponA).holder === a.id, false);
  assert.equal(a.expedition.total, EXPEDITIONS.woodland.hours * HOUR_SECONDS);
  g.step(a.expedition.total + .1);
  assert.ok(!a.expedition && !b.expedition); assert.ok(g.resources.wood > wood + EXPEDITIONS.woodland.reward.wood);
  assert.ok(a.weapon != null || b.weapon != null);
});
test('saves from before the survivor system migrate to stable stats, gear and beds', () => {
  const g = richGame(); const save = JSON.parse(g.serialize());
  save.version = 2; delete save.items; delete save.candidates; delete save.worldSeed;
  for (const s of save.survivors) { for (const k of ['stats', 'aptitudes', 'gen', 'unspent', 'condition', 'home', 'weapon', 'gear']) delete s[k]; s.points = 1; s.upgrades = ['aim']; s.level = 3; }
  const a = quietGame(), b = quietGame(); assert.ok(a.restore(JSON.stringify(save))); assert.ok(b.restore(JSON.stringify(save)));
  assert.deepEqual(a.survivors.map(s => s.stats), b.survivors.map(s => s.stats));
  assert.ok(a.survivors.every(s => s.home != null && s.weapon != null && s.upgrades === undefined));
  assert.ok(a.survivors.every(s => STAT_KEYS.reduce((n, k) => n + s.stats[k], 0) === s.gen.budget + 2));
  assert.equal(a.restore(a.serialize()), true);
});
test('an injured medic keeps their clinic running instead of queueing at it as a patient', () => {
  const g = richGame(), clinic = g.build('clinic', 200, 0), [medic, patient] = g.survivors;
  g.post(medic.id, clinic.id);
  for (const s of [medic, patient]) { s.hp *= .3; g.updateCondition(s); }
  g.step(HOUR_SECONDS * 3);
  assert.equal(patient.condition, 'healthy'); assert.equal(medic.care ?? null, null);
  // With two medics, each treats the other.
  const h = richGame(), c = h.build('clinic', 200, 0), pair = h.survivors.slice(0, 2);
  for (const m of pair) { h.post(m.id, c.id); m.hp *= .3; h.updateCondition(m); }
  h.step(HOUR_SECONDS * 3);
  assert.deepEqual(pair.map(m => m.condition), ['healthy', 'healthy']);
});
test('corrupt experience or levels in a save cannot freeze the game', () => {
  const save = JSON.parse(quietGame().serialize());
  save.survivors[0].xp = 1e300;
  const g = quietGame(); assert.ok(g.restore(JSON.stringify(save)));
  g.grantXP(g.survivors[0], 1); assert.equal(g.survivors[0].level, 2);
  const legacy = JSON.parse(quietGame().serialize()); legacy.version = 2; delete legacy.items; delete legacy.candidates;
  legacy.survivors[0].level = 1e300;
  const h = quietGame(), started = Date.now(); assert.ok(h.restore(JSON.stringify(legacy))); assert.ok(Date.now() - started < 1000);
  assert.ok(Object.values(h.survivors[0].stats).every(v => v === 10));
});
test('trees grow in the wilds, clear of claimed land and the service roads', () => {
  const g = quietGame(), { trees } = g.forest, area = g.territory;
  assert.ok(trees.length > 20);
  assert.ok(trees.every(t => !(t.x > area.left - 42 && t.x < area.right + 42 && t.y > area.top - 20 && t.y < area.bottom + 75) && Math.abs(t.x) >= 50 && Math.abs(t.y) >= 38));
});
test('the dead walk around tree trunks instead of through them', () => {
  const tree = { x: 0, y: 0, radius: 5 }, forest = { trees: [tree], index: buildIndex([tree]) };
  for (const [startX, bias] of [[0, 1], [0, -1], [2, 1], [-3, 1]]) {
    let p = { x: startX, y: -60 }, closest = Infinity;
    for (let i = 0; i < 200; i++) {
      const dx = startX - p.x, dy = 60 - p.y, d = Math.hypot(dx, dy);
      if (d < 1) break;
      p = steerAroundTrees(forest, p, { x: dx / d, y: dy / d }, .8, 4, bias);
      closest = Math.min(closest, Math.hypot(p.x, p.y));
    }
    assert.ok(closest >= 9 - 1e-6, 'never clipped the trunk: ' + closest);
    assert.ok(p.y > 55, 'reached the far side: ' + p.y);
  }
});
test('every road has a gate and the fence closes around them', () => {
  const g = quietGame(), t = g.territory, gates = g.buildings.filter(b => b.type === 'gate');
  assert.deepEqual(gates.map(b => g.gateways.find(s => s.x === b.x && s.y === b.y && s.rotation === (b.rotation || 0)).side).sort(), ['east', 'north', 'south', 'west']);
  assert.deepEqual(gates.map(b => [b.x, b.y, b.rotation || 0]).sort(), [[0, t.bottom - 8, 0], [0, t.top + 8, 0], [t.left + 8, 0, 1], [t.right - 8, 0, 1]].sort());
  // Gates and barricades close the whole run of every side of the fence, gate panels meeting the road edges.
  const on = { north: r => r.top === t.top, south: r => r.bottom === t.bottom, west: r => r.left === t.left, east: r => r.right === t.right };
  for (const side of ['north', 'south', 'east', 'west']) {
    const vertical = side === 'east' || side === 'west', lo = r => vertical ? r.top : r.left, hi = r => vertical ? r.bottom : r.right;
    const r = g.buildings.filter(b => b.perimeter && !!b.rotation === vertical && on[side](boundsOf(b))).map(b => boundsOf(b)).sort((a, b) => lo(a) - lo(b));
    for (let i = 1; i < r.length; i++) assert.equal(lo(r[i]), hi(r[i - 1]), side);
    assert.ok(r.some(q => lo(q) === -32 && hi(q) === 32), side + ' gate spans the road');
  }
  assert.ok(!g.buildings.some(b => b.type === 'tower'), 'no towers come with the wall');
  // Nothing in the wall overlaps anything else in it, apart from the corner panels.
  const wall = g.buildings.filter(b => b.perimeter).map(b => boundsOf(b)), corner = r => (r.left === t.left || r.right === t.right) && (r.top === t.top || r.bottom === t.bottom);
  for (const a of wall) for (const b of wall) if (a !== b && !(corner(a) && corner(b))) assert.ok(!(a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top));
  // Survivors can still path straight through the south and west gates.
  const south = g.findPath({ x: 0, y: t.bottom - 32 }, { x: 0, y: 80 }), west = g.findPath({ x: t.left + 32, y: 0 }, { x: -96, y: 0 });
  assert.ok(south.length && south.every(p => Math.abs(p.x) <= 16));
  assert.ok(west.length && west.every(p => Math.abs(p.y) <= 16));
});
test('the dead coming down a road must break its gate to get in', () => {
  for (const [side, n] of [[2, { x: 0, y: 1 }], [3, { x: -1, y: 0 }]]) {
    const g = quietGame(), gate = g.buildings.find(b => b.type === 'gate' && Math.sign(b.x) === n.x && Math.sign(b.y) === n.y), hp = gate.hp;
    g.survivors = []; // Nobody to shoot it first.
    const z = g.spawnZombie(side, 0); Object.assign(z, { x: gate.x + n.x * 60, y: gate.y + n.y * 60, seed: Math.PI / .6 });
    g.step(12);
    assert.ok(gate.hp < hp, 'the gate took the hits');
    assert.ok(g.outside(z), 'the zombie is still outside');
  }
});
test('an accepted recruit walks in along a road and through its gate', () => {
  const g = richGame(), s = g.acceptCandidate(g.createCandidate('walk-up').id);
  assert.ok(s.arriving && g.outside(s));
  assert.ok(Math.abs(s.x) > g.bounds.x || Math.abs(s.y) > g.bounds.y, 'starts beyond the edge of sight');
  assert.ok(s.x === 0 || s.y === 0, 'starts on a road');
  const road = g.events.at(-1).message.match(/Walking in along the (\w+) road/)?.[1], gate = g.gateways.find(w => w.side === road);
  assert.ok(gate, 'came along a road with a gate');
  let through = false;
  for (let i = 0; i < 1200 && s.arriving; i++) { g.step(.05); if (Math.hypot(s.x - gate.x, s.y - gate.y) < 12) through = true; }
  assert.ok(!s.arriving && !g.outside(s), 'made it inside'); assert.ok(through, 'came in by the gate');
});
test('buying land moves a gate out with its road and keeps its upgrades', () => {
  const g = richGame(), gate = g.buildings.find(b => b.type === 'gate' && b.y > 0);
  assert.ok(g.upgradeBuilding(gate.id, 'reinforce'));
  assert.ok(g.buyLand(0, 2));
  assert.equal(gate.y, parcelRect({ col: 0, row: 2 }).bottom - 8); assert.deepEqual(gate.upgrades, ['reinforce']);
  assert.equal(g.buildings.filter(b => b.type === 'gate').length, 4);
  // Land along the other roads carries their gates out too.
  const east = g.buildings.find(b => b.type === 'gate' && b.x > 0);
  assert.ok(g.buyLand(0, -2)); assert.ok(g.buyLand(2, 0));
  assert.deepEqual([east.x, east.y, east.rotation], [parcelRect({ col: 2, row: 0 }).right - 8, 0, 1]);
  assert.equal(gateSlots(g.land).length, 4); assert.equal(g.buildings.filter(b => b.type === 'gate').length, 4);
  assert.deepEqual(g.breaches(), [], 'the fence is closed all the way round');
});
test('a broken gate can be rebuilt, snapping onto its road opening', () => {
  const g = richGame(), gate = g.buildings.find(b => b.type === 'gate' && b.y > 0), west = g.buildings.find(b => b.type === 'gate' && b.x < 0);
  assert.equal(g.canPlace('gate', 0, 0).ok, false, 'not away from the road opening');
  assert.equal(g.canPlace('gate', 0, g.territory.top + 8).ok, false, 'not while the north gate stands');
  assert.equal(g.canPlace('gate', gate.x, gate.y).ok, false, 'not while the gate stands');
  gate.hp = 0; g.step(.01);
  const built = g.build('gate', gate.x + 16, gate.y - 16);
  assert.ok(built); assert.deepEqual([built.x, built.y, built.rotation], [gate.x, gate.y, 0]);
  // An east or west gate goes back up hung upright.
  west.hp = 0; g.step(.01);
  const upright = g.build('gate', west.x + 16, west.y + 16);
  assert.ok(upright); assert.deepEqual([upright.x, upright.y, upright.rotation], [west.x, west.y, 1]);
});
test('a gate built on the fence replaces the panels under it and becomes a way through', () => {
  const g = richGame(), t = g.territory, y = t.top + 8, panels = g.buildings.filter(b => b.type === 'barricade' && b.perimeter && b.y === y && (b.x === 80 || b.x === 112));
  assert.equal(panels.length, 2);
  const nearCorner = g.snapPlacement('gate', t.left + 32, y);
  assert.ok(nearCorner.x - 32 >= t.left + 32, 'never across a corner: it moves along to the next whole panels');
  const wood = g.resources.wood, gate = g.build('gate', 100, y + 10);
  assert.ok(gate); assert.deepEqual([gate.x, gate.y, gate.rotation, gate.perimeter], [96, y, 0, true]);
  assert.ok(!panels.some(p => g.buildings.includes(p)), 'the panels came down');
  assert.equal(g.resources.wood, wood - 30 + 12, 'paid for the gate, refunded the panels');
  assert.deepEqual(g.breaches(), []);
  const way = g.gateways.find(w => w.x === 96 && w.y === y);
  assert.ok(way && way.side === 'north' && !way.road);
  // Someone heading out from the east side of the refuge goes through it rather than the north road.
  const path = g.findPath({ x: 96, y: t.top + 48 }, { x: 96, y: t.top - 60 });
  assert.ok(path.some(p => p.x === way.inner.x && p.y === way.inner.y), 'walks through the new gate');
  // Upright on the east fence too.
  const east = g.build('gate', t.right - 8, 100);
  assert.ok(east); assert.equal(east.rotation, 1); assert.equal(g.gateways.find(w => w.x === east.x && w.y === east.y)?.side, 'east');
  // Survives a save and still counts as the wall.
  const again = quietGame(); assert.ok(again.restore(g.serialize())); assert.deepEqual(again.breaches(), []);
  // Taken down, its stretch is left open on purpose rather than reported as a breach.
  assert.ok(g.demolish(gate.id)); assert.deepEqual(g.breaches(), []);
  assert.ok(!g.gateways.some(w => w.x === 96 && w.y === y));
  assert.ok(g.build('barricade', 80, y), 'the panel slots can be filled again');
});
test('a gate on the fence stays put when land elsewhere is bought, and moves with the road when its fence goes', () => {
  const g = richGame(), t = g.territory, gate = g.build('gate', t.right - 8, 100);
  assert.ok(gate); assert.deepEqual([gate.x, gate.y], [t.right - 8, 96]);
  assert.ok(g.buyLand(0, 2));
  assert.deepEqual([gate.x, gate.y], [t.right - 8, 96], 'untouched by land to the south');
  assert.ok(g.buildings.includes(gate)); assert.deepEqual(g.breaches(), []);
  assert.ok(g.buyLand(2, 0));
  assert.equal(g.buildings.filter(b => b.type === 'gate').length, 4, 'the old east fence is gone and its gate with it');
  assert.deepEqual(g.breaches(), []);
});
// Open ground inside the refuge: only the perimeter fence stands, and anything may be built.
const openGround = () => { const g = richGame(); g.freeBuild = true; g.buildings = g.buildings.filter(b => b.perimeter); return g; };
test('barricades snap to the wall cell grid, whichever way they face', () => {
  const g = openGround();
  // A horizontal panel spans two cells of one row; an upright one two cells of one column.
  assert.deepEqual(g.snapPlacement('barricade', 150, 100, 0), { x: 144, y: 104, rotation: 0 });
  assert.deepEqual(g.snapPlacement('barricade', 150, 100, 1), { x: 152, y: 96, rotation: 1 });
  const snapped = g.snapPlacement('barricade', 144, 104, 0);
  assert.deepEqual(g.snapPlacement('barricade', snapped.x, snapped.y, 0), snapped, 'snapping twice changes nothing');
});
test('player barricades lie flush in straight runs and meet at corners', () => {
  const g = openGround();
  assert.ok(g.build('barricade', 160, 104, 0));
  assert.ok(g.canPlace('barricade', 192, 104, 0).ok, 'flush to the right');
  assert.ok(g.canPlace('barricade', 128, 104, 0).ok, 'flush to the left');
  assert.equal(g.canPlace('barricade', 176, 104, 0).ok, false, 'not over half the panel');
  assert.ok(g.canPlace('barricade', 184, 112, 1).ok, 'an upright panel against its end');
  assert.ok(g.canPlace('barricade', 168, 112, 1).ok, 'an upright panel sharing its end cell');
  assert.ok(g.build('barricade', 168, 112, 1));
  assert.equal(g.canPlace('barricade', 168, 128, 1).ok, false, 'not over half the upright panel');
  assert.ok(g.canPlace('barricade', 168, 144, 1).ok, 'the upright run carries on below');
  assert.equal(g.canPlace('tower', 168, 140, 0).ok, false, 'other buildings still keep their distance');
});
test('wall cells take the straight or corner tile their neighbours call for', () => {
  const shapes = pieces => wallTiles(pieces).map(cells => cells.map(c => c.shape));
  // ┌── with the upright panel sharing the horizontal panel's left cell.
  assert.deepEqual(shapes([{ x: 160, y: 104, rotation: 0 }, { x: 152, y: 112, rotation: 1 }]), [['tl', 'h'], ['tl', 'v']]);
  // ──┐ with the upright panel flush against the horizontal panel's end.
  assert.deepEqual(shapes([{ x: 160, y: 104, rotation: 0 }, { x: 184, y: 112, rotation: 1 }]), [['h', 'h'], ['tr', 'v']]);
  // └── and ──┘
  assert.deepEqual(shapes([{ x: 160, y: 120, rotation: 0 }, { x: 152, y: 112, rotation: 1 }]), [['bl', 'h'], ['v', 'bl']]);
  assert.deepEqual(shapes([{ x: 160, y: 120, rotation: 0 }, { x: 168, y: 112, rotation: 1 }]), [['h', 'br'], ['v', 'br']]);
  // Two walls side by side stay straight rather than turning into each other.
  assert.deepEqual(shapes([{ x: 160, y: 104, rotation: 0 }, { x: 160, y: 120, rotation: 0 }]), [['h', 'h'], ['h', 'h']]);
  assert.deepEqual(shapes([{ x: 152, y: 112, rotation: 1 }, { x: 168, y: 112, rotation: 1 }]), [['v', 'v'], ['v', 'v']]);
  // A lone panel is straight; the cells sit where the panel is.
  assert.deepEqual(wallTiles([{ x: 160, y: 104, rotation: 0 }]), [[{ x: 152, y: 104, shape: 'h' }, { x: 168, y: 104, shape: 'h' }]]);
});
test('a gate placed over a barricade run takes the place of the panels under it', () => {
  const g = openGround();
  const run = [128, 160, 192].map(x => g.build('barricade', x, 104, 0));
  const wood = g.resources.wood;
  g.freeBuild = false;
  // Over the middle panel: it lines up with the run and swaps two whole panels, never half of one.
  assert.deepEqual(g.snapPlacement('gate', 165, 108, 0), { x: 176, y: 104, rotation: 0, replaces: [run[1].id, run[2].id] });
  const gate = g.build('gate', 165, 108, 0);
  assert.ok(gate); assert.deepEqual([gate.x, gate.y, gate.rotation, !!gate.perimeter], [176, 104, 0, false]);
  assert.deepEqual(g.buildings.filter(b => b.type === 'barricade' && !b.perimeter).map(b => b.id), [run[0].id], 'the panels under it came down');
  assert.equal(g.resources.wood, wood - 30 + 12, 'paid for the gate, refunded the panels');
  // An upright wall gets an upright gate, whichever way round it was being placed.
  g.freeBuild = true;
  const column = [144, 176].map(y => g.build('barricade', 216, y, 1));
  const upright = g.build('gate', 216, 150, 0);
  assert.ok(upright); assert.deepEqual([upright.x, upright.y, upright.rotation], [216, 160, 1]);
  assert.ok(!column.some(b => g.buildings.includes(b)));
});
test('a gate stands free on the wall grid and barricades join it on either side', () => {
  const g = openGround(), gates = g.buildings.filter(b => b.type === 'gate').length;
  assert.deepEqual(g.snapPlacement('gate', 70, 230, 0), { x: 64, y: 232, rotation: 0 });
  const gate = g.build('gate', 70, 230, 0);
  assert.ok(gate); assert.equal(!!gate.perimeter, false);
  assert.ok(g.canPlace('barricade', 16, 232, 0).ok, 'flush to its west end');
  assert.ok(g.canPlace('barricade', 112, 232, 0).ok, 'flush to its east end');
  assert.equal(g.canPlace('barricade', 32, 232, 0).ok, false, 'not over its end');
  assert.equal(g.canPlace('barricade', 40, 240, 1).ok, false, 'not across it');
  assert.ok(g.canPlace('barricade', 104, 240, 1).ok, 'an upright panel against its end');
  assert.equal(g.canPlace('gate', 96, 232, 0).ok, false, 'not over another gate');
  // It is the player's own gate: no way in for recruits, and it stays put when land is bought.
  assert.ok(!g.gateways.some(w => w.x === gate.x && w.y === gate.y));
  assert.ok(g.buyLand(0, 2));
  assert.ok(g.buildings.includes(gate)); assert.deepEqual([gate.x, gate.y], [64, 232]);
  assert.equal(g.buildings.filter(b => b.type === 'gate').length, gates + 1);
});
test('a barricade against the end of a gate turns the corner onto it', () => {
  const shapes = wallTiles([{ x: 104, y: 240, rotation: 1 }], [{ x: 64, y: 232, rotation: 0 }]).map(cells => cells.map(c => c.shape));
  assert.deepEqual(shapes, [['tr', 'v']]);
  assert.deepEqual(wallTiles([{ x: 16, y: 232, rotation: 0 }], [{ x: 64, y: 232, rotation: 0 }]).map(cells => cells.map(c => c.shape)), [['h', 'h']]);
});
test('older saves keep every gate as part of the wall', () => {
  const g = quietGame(), old = JSON.parse(g.serialize());
  for (const b of old.buildings) if (b.type === 'gate') delete b.perimeter;
  delete old.freeGates;
  const copy = new Game(() => .5); assert.ok(copy.restore(JSON.stringify(old)));
  assert.ok(copy.buildings.filter(b => b.type === 'gate').every(b => b.perimeter));
});
test('older saves move free-standing barricades onto the wall cell grid', () => {
  const g = quietGame();
  g.addBuilding('barricade', 80, -128, 0); g.addBuilding('barricade', 96, 64, 1);
  const fence = g.buildings.filter(b => b.perimeter).map(b => [b.x, b.y]);
  const old = JSON.parse(g.serialize()); delete old.wallGrid;
  const copy = new Game(() => .5); assert.ok(copy.restore(JSON.stringify(old)));
  const walls = copy.buildings.filter(b => b.type === 'barricade' && !b.perimeter).map(b => [b.x, b.y, b.rotation]);
  assert.deepEqual(walls, [[80, -120, 0], [104, 64, 1]]);
  assert.deepEqual(copy.buildings.filter(b => b.perimeter).map(b => [b.x, b.y]), fence, 'the fence already sits on the grid');
  const again = new Game(() => .5); assert.ok(again.restore(copy.serialize()));
  assert.deepEqual(again.buildings.filter(b => b.type === 'barricade' && !b.perimeter).map(b => [b.x, b.y, b.rotation]), walls, 'and they stay put');
});
test('the perimeter fence turns its corners with corner tiles', () => {
  const g = quietGame(), t = g.territory, fence = g.buildings.filter(b => b.type === 'barricade' && b.perimeter);
  const cells = new Map();
  wallTiles(fence).flat().forEach(c => cells.set(c.x + ',' + c.y, c.shape));
  assert.equal(cells.get(`${t.left + 8},${t.top + 8}`), 'tl');
  assert.equal(cells.get(`${t.right - 8},${t.top + 8}`), 'tr');
  assert.equal(cells.get(`${t.left + 8},${t.bottom - 8}`), 'bl');
  assert.equal(cells.get(`${t.right - 8},${t.bottom - 8}`), 'br');
  assert.equal([...cells.values()].filter(s => s.length === 2).length, 4, 'only the four outer corners turn');
});
test('a broken fence panel can be rebuilt in its slot from the placement grid', () => {
  const g = richGame(), grid = v => Math.round(v / 16) * 16;
  const t = g.territory, panels = [
    g.buildings.find(b => b.perimeter && b.type === 'barricade' && b.y === t.top + 8 && b.x > 64),
    g.buildings.find(b => b.perimeter && b.type === 'barricade' && b.x === t.right - 8 && b.y > 64),
    g.buildings.find(b => b.perimeter && b.type === 'barricade' && b.x === t.left + 16 && b.y === t.top + 8), // at the corner
  ];
  for (const wall of panels) {
    assert.ok(wall);
    const { x, y, rotation } = wall;
    assert.equal(g.canPlace('barricade', x, y, rotation).ok, false, 'not while the panel stands');
    wall.hp = 0; g.step(.01);
    assert.ok(!g.buildings.includes(wall));
    const built = g.build('barricade', grid(x), grid(y), 0);
    assert.ok(built, g.canPlace('barricade', grid(x), grid(y), 0).reason);
    assert.deepEqual([built.x, built.y, built.rotation, built.perimeter], [x, y, rotation, true]);
  }
  // Rebuilt panels behave like the originals when the fence moves out.
  assert.ok(g.buyLand(1, -2));
  assert.ok(g.buildings.every(b => b.type !== 'barricade' || !b.perimeter || perimeterSlots(g.land).some(s => s.x === b.x && s.y === b.y)));
});
test('engineers rebuild fence panels the dead tore down, but not ones the player dismantled', () => {
  const g = richGame(), eng = g.survivors[0]; bringIn(eng);
  assert.ok(g.post(eng.id, g.buildings.find(b => b.type === 'workshop').id));
  const walls = g.buildings.filter(b => b.perimeter && b.type === 'barricade' && b.y < 0 && b.x > 0);
  const [broken, dismantled] = walls, spot = b => [b.x, b.y, b.rotation];
  broken.hp = 0; g.step(.01);
  assert.ok(g.demolish(dismantled.id));
  assert.deepEqual(g.breaches().map(h => [h.x, h.y, h.rotation]), [spot(broken)]);
  const spent = [], spend = g.spend.bind(g); g.spend = cost => { spent.push(cost); return spend(cost); };
  g.step(60);
  const rebuilt = g.buildings.find(b => b.type === 'barricade' && b.x === broken.x && b.y === broken.y);
  assert.ok(rebuilt, 'the breach is closed'); assert.ok(rebuilt.perimeter);
  assert.equal(rebuilt.hp, buildingMaxHP(rebuilt)); assert.equal(rebuilt.raising, undefined);
  assert.deepEqual(spent, [{ wood: 12, scrap_metal: 2 }], 'paid the usual barricade cost once');
  assert.ok(!g.buildings.some(b => b.x === dismantled.x && b.y === dismantled.y), 'a dismantled panel stays open');
  assert.deepEqual(g.breaches(), []);
  // The choice survives a save, and building the panel back makes it a normal fence panel again.
  const restored = quietGame(); assert.ok(restored.restore(g.serialize()));
  assert.deepEqual(restored.openings, g.openings);
  restored.resources = { food: 1e4, wood: 1e4, scrap_metal: 1e4 };
  assert.ok(restored.build('barricade', dismantled.x, dismantled.y, 0)); assert.deepEqual(restored.openings, []);
});
test('barricades from older saves keep their share of the sturdier durability', () => {
  const g = quietGame(), d = JSON.parse(g.serialize());
  const wall = d.buildings.find(b => b.type === 'barricade'); wall.hp = 75; delete d.sturdyWalls;
  const restored = quietGame(); assert.ok(restored.restore(JSON.stringify(d)));
  const b = restored.buildings.find(b => b.id === wall.id);
  assert.equal(b.hp, 150); assert.equal(buildingMaxHP(b), 300);
  const again = quietGame(); assert.ok(again.restore(restored.serialize()));
  assert.equal(again.buildings.find(b => b.id === wall.id).hp, 150);
});
test('saves from before gates get one on every road', () => {
  const g = quietGame(), d = JSON.parse(g.serialize());
  d.buildings = d.buildings.filter(b => b.type !== 'gate'); delete d.gates;
  const restored = quietGame(); assert.ok(restored.restore(JSON.stringify(d)));
  assert.equal(restored.buildings.filter(b => b.type === 'gate').length, 4);
});
test('saves with only the south gate trade the panels across the other roads for gates', () => {
  const g = quietGame(), d = JSON.parse(g.serialize());
  delete d.roadGates;
  // Then, two panels closed each of the north, east and west roads.
  const others = g.gateways.filter(w => w.side !== 'south');
  d.buildings = d.buildings.filter(b => b.type !== 'gate' || !others.some(w => w.x === b.x && w.y === b.y));
  let id = 800;
  for (const w of others) for (const d2 of [-16, 16]) d.buildings.push({ id: id++, type: 'barricade', perimeter: true, x: w.x + (w.rotation ? 0 : d2), y: w.y + (w.rotation ? d2 : 0), rotation: w.rotation, hp: 300, upgrades: [], cooldown: 0 });
  d.nextId = 1000;
  const restored = quietGame(), wood = d.resources.wood;
  assert.ok(restored.restore(JSON.stringify(d)));
  assert.ok(!restored.buildings.some(b => b.id >= 800 && b.id < id), 'the road panels are gone');
  assert.equal(restored.resources.wood, wood + 6 * 6, 'refunded like any spare panel');
  assert.deepEqual(restored.buildings.filter(b => b.type === 'gate').map(b => restored.gateways.find(w => w.x === b.x && w.y === b.y)?.side).sort(), ['east', 'north', 'south', 'west']);
  assert.deepEqual(restored.breaches(), []);
  const again = quietGame(); assert.ok(again.restore(restored.serialize())); assert.equal(again.serialize(), restored.serialize());
});
test('watchtowers go inside the refuge or out in the open, clear of the wall', () => {
  const g = richGame(), t = g.territory;
  assert.ok(g.canPlace('tower', 208, 48).ok, 'inside the refuge');
  assert.ok(g.canPlace('tower', 160, t.top - 64).ok, 'outside, beyond the north wall');
  assert.ok(g.canPlace('tower', t.right + 80, 0).ok, 'outside, beyond the east wall');
  assert.equal(g.canPlace('tower', 160, t.top).ok, false, 'not on the wall');
  assert.equal(g.canPlace('tower', 160, t.top - 16).ok, false, 'not hugging the wall');
  assert.equal(g.canPlace('tower', 160, t.top - 400).ok, false, 'not out of sight of the wall');
  const tree = g.forest.trees.find(p => Math.abs(p.x) + 40 < g.bounds.x && Math.abs(p.y) + 40 < g.bounds.y);
  if (tree) assert.equal(g.canPlace('tower', tree.x, tree.y).reason, 'Trees are in the way.');
  const built = g.build('tower', 160, t.top - 64);
  assert.ok(built); assert.deepEqual([built.x, built.y, built.perimeter], [160, t.top - 64, undefined]);
  assert.ok(g.outside(built));
});
test('buying land over an outside watchtower refunds it in full', () => {
  // The new parcel's east fence runs through the first; the second ends up inside, clear of the fence.
  const g = richGame(), t = g.territory, tower = g.build('tower', 128, t.top - 64), kept = g.build('tower', 32, t.top - 56), s = g.survivors[0];
  assert.ok(tower && kept);
  assert.ok(g.upgradeBuilding(tower.id, 'scope')); assert.ok(g.post(s.id, tower.id));
  const wood = g.resources.wood;
  assert.ok(g.buyLand(0, -2));
  assert.ok(!g.buildings.includes(tower)); assert.equal(s.role, 'patrol');
  assert.equal(g.resources.wood, wood - 80 + 40 + 20, 'land paid, tower and upgrade refunded');
  assert.ok(g.buildings.includes(kept) && !g.outside(kept));
  // One the new land leaves room around stays put.
  const far = g.build('tower', t.right + 80, 0); assert.ok(g.buyLand(1, -2)); assert.ok(g.buildings.includes(far));
});
test('sentries walk out to an outside watchtower for their shift and back to bed between shifts', () => {
  const g = quietGame(), t = g.territory, s = g.survivors[0], [other] = g.survivors.slice(1);
  g.survivors = [s, other];
  const tower = raiseTower(g, 160, t.top - 64);
  atHour(g, 22.5); assert.ok(g.post(s.id, tower.id)); assert.equal(s.shift, 2, 'took the night shift that is on now');
  let out = false;
  for (let i = 0; i < 400 && !s.stationed; i++) { g.step(.25); if (g.outside(s)) out = true; }
  assert.ok(s.stationed && out, 'walked out through the gate and climbed the tower'); assert.equal(s.towerId, tower.id);
  g.step(.05); assert.equal(tower.staffed, true);
  // Off shift at 06:00, they go home to their bed and rest inside it.
  atHour(g, 6.2); g.step(.05); assert.equal(s.stationed, false);
  for (let i = 0; i < 600 && !s.resting; i++) g.step(.25);
  assert.ok(s.resting && s.sheltered, 'resting'); assert.equal(s.restAt, s.home); assert.equal(s.task, 'resting');
  assert.ok(!g.outside(s)); g.step(.05); assert.equal(tower.staffed, false);
  g.step(5); assert.ok(s.resting, 'stays in bed through the day');
  // An hour before the night shift they get up and walk back out.
  atHour(g, 21.1); g.step(.05); assert.ok(!s.resting && !s.sheltered);
  for (let i = 0; i < 600 && !s.stationed; i++) g.step(.25);
  assert.ok(s.stationed, 'back on the tower for the next shift');
  // The alarm turns out a resting sentry.
  atHour(g, 12); for (let i = 0; i < 600 && !s.resting; i++) g.step(.25);
  assert.ok(s.resting); g.raiseAlarm(); g.step(.05); assert.ok(!s.resting);
  // Shift and rest survive a save.
  const restored = quietGame(); assert.ok(restored.restore(g.serialize()));
  assert.equal(restored.survivors[0].shift, 2);
});
test('a sentry with the shift covered elsewhere cannot double up, and releasing one frees their shift', () => {
  const g = quietGame(), tower = raiseTower(g, 208, 48), [a, b, c, d] = g.survivors;
  for (const s of [a, b, c]) assert.ok(g.post(s.id, tower.id));
  assert.equal(new Set([a, b, c].map(s => s.shift)).size, 3);
  const freed = b.shift; assert.ok(g.post(b.id, null)); assert.equal(b.shift, null);
  assert.ok(g.post(d.id, tower.id)); assert.equal(d.shift, freed);
});
test('the wall blocks sight: only a survivor up on a tower sees over it', () => {
  const g = quietGame(), [s] = g.survivors, t = g.territory; g.survivors = [s];
  const z = g.spawnZombie(0, 0); Object.assign(z, { x: 120, y: t.top - 30, speed: 0 });
  Object.assign(s, { role: 'medic', x: 120, y: t.top + 48, path: [] });
  g.step(1); assert.equal(z.hp, z.maxHP, 'a worker behind the wall cannot see it');
  const tower = raiseTower(g, 80, t.top - 60);
  Object.assign(s, { stationed: true, towerId: tower.id, perch: { x: tower.x, y: tower.y - 18 } });
  g.step(1); assert.ok(z.hp < z.maxHP, 'from the tower they can');
  // And a breach is visible from inside.
  s.stationed = false; s.perch = null; s.towerId = null; const inside = g.spawnZombie(0, 0); Object.assign(inside, { x: 120, y: t.top + 90, speed: 0 });
  g.step(1); assert.ok(inside.hp < inside.maxHP);
});
test('guards go out through the south gate and patrol outside the wall without crossing it', () => {
  const g = quietGame(), s = g.survivors[0]; g.survivors = [s];
  Object.assign(s, { x: 0, y: 144, path: [] }); assert.ok(g.assign(s.id, 'north'));
  let gate = false;
  for (let i = 0; i < 1600; i++) {
    const was = { x: s.x, y: s.y }; g.step(.05);
    for (const b of g.buildings) if (b.type !== 'gate') { const r = boundsOf(b); assert.ok(!(s.x > r.left && s.x < r.right && s.y > r.top && s.y < r.bottom), 'crossed ' + b.type); }
    if (g.outside(was) !== g.outside(s)) assert.ok(g.gateways.some(w => Math.hypot(s.x - w.x, s.y - w.y) < 50), 'left through a gate');
    if (g.buildings.some(b => b.type === 'gate' && Math.hypot(s.x - b.x, s.y - b.y) < 20)) gate = true;
  }
  assert.ok(gate && g.outside(s), 'out on the lane'); assert.ok(s.y < g.territory.top);
  // Round to the far side, the lane goes the long way round rather than through the refuge.
  const path = g.findPath({ x: 0, y: g.territory.top - 30 }, { x: 60, y: g.territory.bottom + 30 });
  let prev = { x: 0, y: g.territory.top - 30 };
  for (const p of path) { assert.ok(g.clearOfLand(prev, p, 1)); prev = p; }
});
test('a wounded guard climbs a watchtower inside the wall instead of going out', () => {
  const g = quietGame(), s = g.survivors[0]; g.survivors = [s];
  raiseTower(g, 0, g.territory.top - 64); // Closer, but outside the wall.
  const inside = raiseTower(g, 208, 48);
  Object.assign(s, { x: 0, y: 144, path: [] }); s.hp = survivorStats(s).hp * .3;
  for (let i = 0; i < 60 && !s.stationed; i++) g.step(.5);
  assert.ok(s.stationed && s.perch, 'up on a tower'); assert.equal(s.towerId, inside.id);
  assert.ok(!g.outside(s));
  // Healed, they come down and go back out.
  s.hp = survivorStats(s).hp; g.step(.1); assert.equal(s.stationed, false); assert.equal(s.towerId, null);
});
test('saves with wall towers and four gates keep their gates and move the towers outside', () => {
  const g = quietGame(), t = g.territory, d = JSON.parse(g.serialize()), [s] = d.survivors;
  delete d.southGate; delete d.roadGates;
  // The old wall: panels only where the old layout had them, a gate on the north road and wall towers.
  const legacy = new Set(perimeterSlots(g.land, true).map(p => p.x + ',' + p.y));
  d.buildings = d.buildings.filter(b => b.type !== 'barricade' || legacy.has(b.x + ',' + b.y));
  d.buildings = d.buildings.filter(b => !(b.type === 'gate' && b.y === t.top + 8));
  d.buildings.push({ id: 900, type: 'gate', perimeter: true, x: 0, y: t.top + 8, rotation: 0, hp: 360, upgrades: ['reinforce'], cooldown: 0 });
  d.buildings.push({ id: 901, type: 'tower', perimeter: true, x: 48, y: t.top + 16, rotation: 0, hp: 420, upgrades: ['scope'], cooldown: 0 });
  d.buildings.push({ id: 902, type: 'tower', perimeter: true, x: t.right - 16, y: t.top + 16, rotation: 0, hp: 420, upgrades: [], cooldown: 0 });
  Object.assign(s, { role: 'sentry', post: 901 }); d.nextId = 1000;
  const restored = quietGame(), wood = d.resources.wood;
  assert.ok(restored.restore(JSON.stringify(d)));
  assert.deepEqual(restored.buildings.find(b => b.id === 900)?.upgrades, ['reinforce'], 'the north gate stays, upgrades and all');
  assert.equal(restored.resources.wood, wood, 'nothing to refund');
  assert.deepEqual(restored.buildings.filter(b => b.type === 'gate').map(b => g.gateways.find(w => w.x === b.x && w.y === b.y)?.side).sort(), ['east', 'north', 'south', 'west']);
  const side = restored.buildings.find(b => b.id === 901), corner = restored.buildings.find(b => b.id === 902);
  assert.deepEqual([side.x, side.y, side.perimeter, side.upgrades], [48, t.top - 32, undefined, ['scope']]);
  assert.deepEqual([corner.x, corner.y], [t.right + 32, t.top - 32]);
  assert.ok(restored.outside(side) && restored.outside(corner));
  const sentry = restored.survivors.find(x => x.id === s.id);
  assert.equal(sentry.role, 'sentry'); assert.equal(sentry.post, 901); assert.equal(sentry.shift, 0);
  assert.deepEqual(restored.breaches(), [], 'the wall is closed where the gate and towers stood');
  const again = quietGame(); assert.ok(again.restore(restored.serialize())); assert.equal(again.serialize(), restored.serialize());
});
test('survivors leave a bunkhouse or barracks to start their day and return to end it', () => {
  const g = quietGame();
  const dorm = g.buildings.find(b => b.type === 'dorm');
  const [patrol, guardCandidate] = g.survivors;

  // Patrol survivor has a bed in the bunkhouse
  assert.equal(patrol.home, dorm.id);

  // Build a barracks and post a guard to it
  const barracks = g.build('barracks', 0, 80);
  assert.ok(barracks);
  assert.ok(g.post(guardCandidate.id, barracks.id));
  assert.equal(guardCandidate.role, 'guard');
  assert.equal(guardCandidate.home, barracks.id, 'guard takes residence in the barracks');

  // During daylight (10:00), survivors are on duty and not resting
  atHour(g, 10);
  g.step(.05);
  assert.equal(g.onDuty(patrol), true);
  assert.equal(g.onDuty(guardCandidate), true);
  assert.ok(!patrol.resting);
  assert.ok(!guardCandidate.resting);

  // At dusk / nightfall (18:20), day ends and survivors return to bed
  atHour(g, 18.3);
  g.step(.05);
  assert.equal(g.onDuty(patrol), false);
  assert.equal(g.onDuty(guardCandidate), false);

  // Step until both reach their respective quarters
  for (let i = 0; i < 800 && (!patrol.resting || !guardCandidate.resting); i++) g.step(.25);

  assert.ok(patrol.resting && patrol.sheltered, 'patrol is resting in bed');
  assert.equal(patrol.restAt, dorm.id, 'patrol returned to bunkhouse');
  assert.equal(patrol.task, 'resting');

  assert.ok(guardCandidate.resting && guardCandidate.sheltered, 'guard is resting in bed');
  assert.equal(guardCandidate.restAt, barracks.id, 'guard returned to barracks');
  assert.equal(guardCandidate.task, 'resting');

  // Both stay resting through the dead of night
  g.step(5);
  assert.ok(patrol.resting && guardCandidate.resting, 'stay in quarters through the night');

  // The alarm turns out resting survivors from their quarters
  g.raiseAlarm();
  g.step(.05);
  assert.ok(!patrol.resting && !guardCandidate.resting, 'alarm wakes everyone from bunkhouse and barracks');
  g.clearAlarm();
  g.step(.05);

  // A new day begins at dawn (06:00): survivors leave bunkhouse or barracks to start their day
  for (let i = 0; i < 800 && (!patrol.resting || !guardCandidate.resting); i++) g.step(.25);
  atHour(g, 6.0);
  g.step(.05);
  assert.ok(!patrol.resting && !patrol.sheltered, 'patrol left bunkhouse to start the day');
  assert.equal(patrol.restAt, null);
  assert.ok(!guardCandidate.resting && !guardCandidate.sheltered, 'guard left barracks to start the day');
  assert.equal(guardCandidate.restAt, null);
  assert.equal(g.onDuty(patrol), true);
  assert.equal(g.onDuty(guardCandidate), true);

  // Night rest state survives a save/restore roundtrip
  atHour(g, 22.0);
  for (let i = 0; i < 800 && (!patrol.resting || !guardCandidate.resting); i++) g.step(.25);
  assert.ok(patrol.resting && guardCandidate.resting);
  const restored = quietGame();
  assert.ok(restored.restore(g.serialize()));
  const rPatrol = restored.survivors.find(s => s.id === patrol.id);
  const rGuard = restored.survivors.find(s => s.id === guardCandidate.id);
  assert.equal(rPatrol.resting, true);
  assert.equal(rPatrol.restAt, dorm.id);
  assert.equal(rGuard.resting, true);
  assert.equal(rGuard.restAt, barracks.id);
});
test('facility workers (farmers, engineers, medics) leave bunkhouse for work and return at night', () => {
  const g = richGame();
  const dorm = g.buildings.find(b => b.type === 'dorm');
  const farm = g.buildings.find(b => b.type === 'farm');
  const workshop = g.buildings.find(b => b.type === 'workshop');
  const clinic = g.build('clinic', 0, 80);
  const [farmer, engineer, medic] = g.survivors;

  assert.ok(g.post(farmer.id, farm.id));
  assert.ok(g.post(engineer.id, workshop.id));
  assert.ok(g.post(medic.id, clinic.id));

  // In the morning (08:00), all workers leave the bunkhouse to perform their duties
  atHour(g, 8.0);
  g.step(.05);
  for (let i = 0; i < 200 && (!farmer.task || !engineer.task || !medic.task); i++) g.step(.25);
  assert.ok(!farmer.resting && !farmer.sheltered, 'farmer is active');
  assert.ok(!engineer.resting && !engineer.sheltered, 'engineer is active');
  assert.ok(!medic.resting && !medic.sheltered, 'medic is active');

  // At dusk (18.3), all workers return to the bunkhouse to end their day
  atHour(g, 18.3);
  g.step(.05);
  for (let i = 0; i < 800 && (!farmer.resting || !engineer.resting || !medic.resting); i++) g.step(.25);
  assert.ok(farmer.resting && farmer.sheltered);
  assert.equal(farmer.restAt, dorm.id);
  assert.ok(engineer.resting && engineer.sheltered);
  assert.equal(engineer.restAt, dorm.id);
  assert.ok(medic.resting && medic.sheltered);
  assert.equal(medic.restAt, dorm.id);

  // At dawn (06:00), workers wake up and leave the bunkhouse
  atHour(g, 6.0);
  g.step(.05);
  assert.ok(!farmer.resting && !farmer.sheltered);
  assert.ok(!engineer.resting && !engineer.sheltered);
  assert.ok(!medic.resting && !medic.sheltered);
});
test('watchtowers can be built inside the base and outside the base', () => {
  const g = richGame(), t = g.territory;
  // Inside the base
  assert.ok(g.canPlace('tower', 208, 48).ok, 'inside near center');
  assert.ok(g.canPlace('tower', 160, t.top + 40).ok, 'inside near north perimeter');
  const insideTower = g.build('tower', 208, 48);
  assert.ok(insideTower);
  assert.ok(!g.outside(insideTower));

  // Outside the base
  assert.ok(g.canPlace('tower', 160, t.top - 64).ok, 'outside north');
  assert.ok(g.canPlace('tower', t.right + 80, 0).ok, 'outside east');
  const outsideTower = g.build('tower', 160, t.top - 64);
  assert.ok(outsideTower);
  assert.ok(g.outside(outsideTower));
});
test('guards go out of their way to use watchtowers if guards are not assigned to them', () => {
  const g = richGame(), t = g.territory;
  const [guardA, guardB] = g.survivors;
  // Build an unassigned watchtower inside the base and one outside the base
  const insideTower = g.build('tower', 208, 48);
  const outsideTower = g.build('tower', 160, t.top - 64);
  assert.ok(insideTower && outsideTower);
  assert.equal(g.staffOf(insideTower).length, 0, 'no sentry assigned to inside tower');
  assert.equal(g.staffOf(outsideTower).length, 0, 'no sentry assigned to outside tower');

  // Guards are patrols / barracks guards with no watchtower assignment
  // They step forward and seek the free watchtowers
  for (let i = 0; i < 400 && (!guardA.stationed || !guardB.stationed); i++) g.step(.25);
  assert.ok(guardA.stationed, 'guardA climbed an unassigned tower');
  assert.ok(guardB.stationed, 'guardB climbed an unassigned tower');
  assert.ok([insideTower.id, outsideTower.id].includes(guardA.towerId));
  assert.ok([insideTower.id, outsideTower.id].includes(guardB.towerId));
  assert.notEqual(guardA.towerId, guardB.towerId, 'each guard took a different tower');
  assert.equal(insideTower.staffed, true, 'inside tower is staffed by opportunistic guard');
  assert.equal(outsideTower.staffed, true, 'outside tower is staffed by opportunistic guard');

  // If a sentry is explicitly posted to the inside tower, the opportunistic guard dismounts
  const sentry = g.addSurvivor('any');
  assert.ok(g.post(sentry.id, insideTower.id));
  g.step(.1);
  const guardOnInside = [guardA, guardB].find(s => s.towerId === insideTower.id);
  assert.equal(guardOnInside, undefined, 'opportunistic guard dismounted so assigned sentry can man it');
});
test('regular base survivors with other jobs use towers as shelter when needed', () => {
  const g = richGame();
  const farm = g.buildings.find(b => b.type === 'farm');
  const workshop = g.buildings.find(b => b.type === 'workshop');
  const tower = g.build('tower', 208, 48);
  const [farmer, engineer] = g.survivors;
  g.post(farmer.id, farm.id);
  g.post(engineer.id, workshop.id);

  assert.equal(g.shelterCapacity(tower), 2, 'tower provides shelter capacity for 2');

  // Shelter ordered specifically at the watchtower
  const result = g.orderShelter(tower.id);
  assert.ok(result.placed.includes(farmer.name));
  assert.ok(result.placed.includes(engineer.name));
  assert.equal(farmer.shelter, tower.id);
  assert.equal(engineer.shelter, tower.id);

  for (let i = 0; i < 200 && (!farmer.sheltered || !engineer.sheltered); i++) g.step(.25);
  assert.ok(farmer.sheltered && engineer.sheltered, 'workers sheltered inside the tower');
  assert.equal(farmer.task, 'sheltered');

  // Zombies cannot reach sheltered survivors in the tower
  const z = g.spawnZombie(1); z.x = tower.x; z.y = tower.y; z.speed = 0;
  const fHp = farmer.hp;
  g.step(1);
  assert.equal(farmer.hp, fHp, 'sheltered workers are safe from zombies');

  // All-clear restores workers back to their jobs
  assert.ok(g.clearShelter());
  g.step(.05);
  assert.equal(farmer.sheltered, false);
  assert.equal(engineer.sheltered, false);
});
// ---- Starter camp ----
const campGame = () => { const g = new Game(() => .5); g.spawnTimer = 1e9; return g; };
// The nearest tree out in the wilds, where felled trees grow back (a camp's own land keeps its trees too).
const nearestTree = g => g.forest.trees.filter(t => g.outside(t)).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0];
test('a new run starts as an open camp: campfire, tents, the supply cache, three survivors and the starting cache', () => {
  const g = campGame();
  assert.deepEqual(g.buildings.map(b => b.type).sort(), ['cache', 'campfire', 'tent', 'tent', 'tent']);
  assert.equal(g.core.type, 'campfire');
  assert.equal(g.survivors.length, 3);
  assert.ok(g.survivors.every(s => g.buildings.find(b => b.id === s.home)?.type === 'tent'), 'everyone has a tent');
  assert.deepEqual(g.resources, STARTING_CACHE); assert.equal(g.rates().wood, 0, 'wood only comes from felling');
  assert.equal(g.walled, false);
  assert.equal(g.breaches().length, 0, 'an open camp has no holes to fix');
  assert.equal(g.openings.length, perimeterSlots(g.land).length);
  assert.ok(g.gateways.length > gateSlots(g.land).length, 'the camp can be left anywhere along its edge');
  assert.equal(g.demolish(g.core.id), false); assert.equal(g.demolish(g.buildings.find(b => b.type === 'cache').id), false);
  assert.equal(g.canPlace('tent', 160, 96).ok, false, 'fixtures are not in the catalog');
});
test('a wall built once walls are unlocked makes the camp walled, and bought land then comes with fence', () => {
  const g = campGame(); g.resources = { wood: 999, scrap_metal: 999, food: 999 };
  g.unlocked.barricade = true;
  const slot = perimeterSlots(g.land)[0];
  assert.ok(g.build('barricade', slot.x, slot.y, slot.rotation));
  assert.equal(g.walled, true);
  const before = g.buildings.filter(b => b.type === 'barricade').length, open = g.availableLand()[0];
  assert.ok(g.buyLand(open.col, open.row));
  assert.ok(g.buildings.filter(b => b.type === 'barricade').length > before);
});
test('buying land for an open camp keeps it open', () => {
  const g = campGame(); g.resources = { wood: 999, scrap_metal: 999, food: 999 };
  const open = g.availableLand()[0];
  assert.ok(g.buyLand(open.col, open.row));
  assert.equal(g.walled, false);
  assert.equal(g.buildings.filter(b => b.perimeter).length, 0);
  assert.equal(g.breaches().length, 0);
});
test('a marked tree is felled by the nearest free survivor, carried to the pile and grows back', () => {
  const g = campGame(), t = nearestTree(g);
  assert.ok(g.toggleHarvest(t.id));
  g.step(.3);
  const s = g.survivors.find(s => s.harvest?.tree === t.id);
  assert.ok(s, 'someone took the job');
  const others = g.survivors.filter(o => o !== s);
  assert.ok(others.every(o => Math.hypot(o.x - t.x, o.y - t.y) >= Math.hypot(s.x - t.x, s.y - t.y) - 1), 'the nearest survivor');
  let chopped = false;
  const start = g.resources.wood;
  for (let i = 0; i < 1200 && g.resources.wood === start; i++) { g.step(.05); chopped ||= s.task === 'chopping'; }
  assert.ok(chopped);
  assert.ok(g.resources.wood >= start + 4, 'the logs were stacked');
  assert.equal(g.progress.tally.felled, 1, 'counted towards the Firewood quest');
  assert.ok(Math.hypot(s.x - CAMP.pile.x, s.y - CAMP.pile.y) < 24, 'at the wood pile');
  assert.ok(g.regrowing(t)); assert.equal(g.toggleHarvest(t.id), false, 'a felled tree cannot be marked while it grows back');
  assert.equal(g.harvestJobs.length, 0);
  g.step(61);
  assert.equal(g.regrowing(t), false); assert.ok(g.toggleHarvest(t.id));
});
test('taking the mark off a tree sends its survivor back to their rounds', () => {
  const g = campGame(), t = nearestTree(g);
  g.toggleHarvest(t.id); g.step(.3);
  const s = g.survivors.find(s => s.harvest);
  assert.ok(g.toggleHarvest(t.id));
  assert.equal(s.harvest, undefined); assert.equal(g.harvestJobs.length, 0);
});
test('nobody goes out to fell trees at night or under the alarm', () => {
  const night = campGame(); night.elapsed = HOUR_SECONDS * 16; // 22:00
  night.toggleHarvest(nearestTree(night).id); night.step(.3);
  assert.ok(night.survivors.every(s => !s.harvest));
  const alarm = campGame(); alarm.raiseAlarm();
  alarm.toggleHarvest(nearestTree(alarm).id); alarm.step(.3);
  assert.ok(alarm.survivors.every(s => !s.harvest));
});
test('a camp survives a save: quests, unlocks, messages, journal, marked trees, regrowth and logs being carried', () => {
  const g = campGame(), [a, b] = [...g.forest.trees].sort((p, q) => Math.hypot(p.x, p.y) - Math.hypot(q.x, q.y));
  g.progress.tally.felled = 3; g.step(1.1);
  g.toggleHarvest(a.id); g.treeRegrow[b.id] = g.elapsed + 50;
  g.survivors[0].harvest = { phase: 'toPile', carry: 5 };
  g.readMessages([g.messages[0].id]);
  const copy = new Game(() => .5); assert.ok(copy.restore(g.serialize()));
  assert.equal(copy.start, 'camp'); assert.deepEqual(copy.unlocked, { barricade: true });
  assert.equal(copy.progress.quest, 1); assert.equal(copy.progress.tally.felled, 3);
  assert.deepEqual(copy.messages, g.messages); assert.deepEqual(copy.journal, g.journal);
  assert.ok(copy.messages[0].read && !copy.messages.at(-1).read);
  copy.message('Camp', 'After the load', ''); assert.ok(copy.messages.at(-1).id > g.messages.at(-1).id, 'message ids keep counting');
  assert.deepEqual(copy.harvestJobs, [{ tree: a.id, by: null }]); assert.ok(copy.regrowing(b));
  assert.deepEqual(copy.survivors[0].harvest, { phase: 'toPile', carry: 5 });
});
test('a save from before the camp loads as a refuge with every structure unlocked', () => {
  const old = JSON.parse(quietGame().serialize());
  for (const k of ['start', 'unlocked', 'harvestJobs', 'treeRegrow', 'progress', 'messages', 'journal', 'nextMessageId']) delete old[k];
  const g = campGame(); assert.ok(g.restore(JSON.stringify(old)));
  assert.equal(g.start, 'refuge'); assert.ok(g.isUnlocked('tower') && g.isUnlocked('dorm'));
  assert.equal(g.progress.rank, RANKS.length - 1, 'every upgrade tier');
});
test('a workbench camp save loads with a supply cache and quests picked up from what it had', () => {
  const g = campGame(); g.resources = { wood: 999, scrap_metal: 999, food: 999 };
  const old = JSON.parse(g.serialize());
  for (const k of ['progress', 'messages', 'journal', 'nextMessageId']) delete old[k];
  old.buildings.find(b => b.type === 'cache').type = 'workbench';
  old.unlocked = { walls: true, gate: true, mill: true };
  old.buildings.push({ id: old.nextId++, type: 'farm', x: -112, y: 64, rotation: 0, hp: 190, upgrades: [], cooldown: 0 });
  const copy = new Game(() => .5); assert.ok(copy.restore(JSON.stringify(old)));
  assert.ok(copy.buildings.some(b => b.type === 'cache') && !copy.buildings.some(b => b.type === 'workbench'));
  assert.deepEqual(Object.keys(copy.unlocked).sort(), ['barricade', 'farm', 'gate', 'lumber_mill']);
  assert.equal(QUESTS[copy.progress.quest].id, 'crops', 'the first quest with something left to unlock');
});
// ---- Quests, status and arrivals (progression.mjs) ----
test('quests unlock structures one at a time, with rewards, orders and journal entries', () => {
  const g = campGame(); g.resources = { wood: 999, scrap_metal: 999, food: 999 };
  for (const type of ['barricade', 'gate', 'farm', 'dorm', 'lumber_mill', 'shelter', 'storage', 'workshop', 'tower', 'clinic', 'barracks', 'lab', 'armory'])
    assert.equal(g.isUnlocked(type), false, type + ' starts locked');
  assert.match(g.canPlace('farm', -160, 128).reason, /quests on your tablet/);
  assert.equal(g.quest.id, 'firewood');
  assert.ok(g.messages.some(m => m.title === 'New orders: Firewood')); assert.equal(g.journal.length, 1);
  g.progress.tally.felled = 3; g.step(1.1);
  assert.equal(g.quest.id, 'palisade'); assert.ok(g.isUnlocked('barricade')); assert.equal(Math.floor(g.resources.scrap_metal), 1009, 'the metal reward');
  assert.ok(g.messages.some(m => m.title === 'New orders: Draw a Line')); assert.equal(g.journal.at(-1).title, 'Firewood');
  const slots = perimeterSlots(g.land).filter(slot => g.canPlace('barricade', slot.x, slot.y, slot.rotation).ok).slice(0, 6);
  assert.equal(slots.length, 6, 'fence slots clear of trees');
  for (const slot of slots) assert.ok(g.build('barricade', slot.x, slot.y, slot.rotation));
  g.step(1.1);
  assert.equal(g.quest.id, 'gate'); assert.ok(g.isUnlocked('gate')); assert.equal(g.isUnlocked('farm'), false);
});
test('later orders wait for the settlement status they need', () => {
  const g = campGame(); g.resources = { wood: 999, scrap_metal: 999, food: 999 };
  g.progress.quest = QUESTS.findIndex(q => q.id === 'depot');
  g.step(1.1);
  assert.equal(g.quest, null, 'Stockpile needs Outpost status'); assert.equal(g.progress.rank, 0);
  for (const type of ['farm', 'gate']) g.addBuilding(type, type === 'farm' ? -112 : 112, 64);
  g.addSurvivor('any'); g.elapsed = DAY_SECONDS + 10;
  g.step(1.1);
  assert.equal(g.progress.rank, 1); assert.equal(g.quest.id, 'depot');
  assert.ok(g.messages.some(m => m.title === 'Status confirmed: Outpost'));
  assert.ok(g.messages.some(m => m.title === 'New orders: Stockpile'));
});
test('status unlocks the better versions: each upgrade tier needs its rank', () => {
  const g = campGame(); g.resources = { wood: 999, scrap_metal: 999, food: 999 };
  const wall = g.addBuilding('barricade', 0, 200);
  assert.equal(upgradeTier('barricade', { id: 'reinforce' }), 1); assert.equal(upgradeTier('barricade', { id: 'plate', requires: 'reinforce' }), 2);
  assert.equal(g.upgradeBuilding(wall.id, 'reinforce'), false, 'a camp has no upgrades yet');
  g.progress.rank = 1;
  assert.ok(g.upgradeBuilding(wall.id, 'reinforce'));
  assert.equal(g.upgradeBuilding(wall.id, 'plate'), false, 'steel plating needs Settlement status');
  g.progress.rank = 2;
  assert.ok(g.upgradeBuilding(wall.id, 'plate'));
});
test('word of the base brings survivors: none before the gate, more as it grows, with housing and food prompts', () => {
  const g = campGame();
  assert.equal(g.arrivalRate, 0, 'nobody has heard of the camp yet');
  g.progress.quest = 3; const early = g.arrivalRate;
  assert.ok(early > 0, 'the gate is up and word is out');
  g.progress.rank = 2; assert.ok(g.arrivalRate > early);
  // Every tent is taken: the arrival and a reminder say to build housing.
  const c = g.createCandidate('walk-up'); g.arrivalMessage(c);
  assert.equal(g.shortage, 'beds');
  assert.deepEqual(g.messages.at(-1).action, { kind: 'candidate', id: c.id, need: 'beds' });
  g.step(1.1);
  assert.ok(g.messages.some(m => m.title === 'Not enough housing' && m.action.type === 'dorm'));
  const count = g.messages.length; g.step(1.1); assert.equal(g.messages.length, count, 'reminded once');
  // With beds but an empty larder, the prompt is about farms.
  g.addBuilding('dorm', 112, -64); g.rehouse(); g.resources.food = 5; g.step(1.1);
  assert.equal(g.shortage, 'food');
  assert.ok(g.messages.some(m => m.title === 'Not enough food' && m.action.type === 'farm'));
});
test('the dead make for the campfire, and the run ends if it goes out', () => {
  const g = campGame(), z = g.spawnZombie(0); Object.assign(z, { x: 0, y: -200 });
  const d = Math.hypot(z.x, z.y); g.survivors = []; g.step(1);
  assert.ok(Math.hypot(z.x, z.y) < d);
  g.core.hp = 0; g.step(.05); assert.equal(g.status, 'lost');
});
