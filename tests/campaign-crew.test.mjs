// M2: campaign survivors. The starting-crew generator, traits, jobs and proficiency, the labor factor,
// fatigue, starvation and its Phase 1 protection, 100 HP, and saving all of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, HOUR_SECONDS, DAY_SECONDS } from '../web/src/engine/model.mjs';
import { CAMPAIGN } from '../web/src/engine/campaignState.mjs';
import { generateCampaignSurvivor, laborFactor, attributeFactor, healthFactor, fatigueFactor, campaignMaxHp, campaignJob, quality, CORE_STATS, CAMPAIGN_STATS } from '../web/src/engine/crew.mjs';
import { survivorStats } from '../web/src/engine/rules.mjs';

const S = CAMPAIGN.tuning.survivors;
function campaign() {
  const g = new Game(Math.random, { mode: 'campaign' });
  g.spawnTimer = 1e12; g.director.timer = 1e12; g.zombies = [];
  return g;
}
const hours = (g, h) => { for (let t = 0; t < h * HOUR_SECONDS; t += 1) g.step(1); };
// A bare survivor record for the pure formulas.
const person = (stats = {}, extra = {}) => ({ stats: { str: 5, end: 5, agi: 5, int: 5, cha: 5, ...stats }, traits: [], proficiency: {}, fatigue: 0, hp: 100, role: 'patrol', model: 'campaign', ...extra });

test('500 starting crews meet every starting rule', () => {
  const archetypes = S.archetypes;
  for (let crew = 0; crew < 500; crew++) {
    archetypes.forEach((a, i) => {
      const { stats, traits } = generateCampaignSurvivor(crew * 7919 + 13, i + 1, 'founder:' + i, { archetype: a.id, start: true });
      for (const k of CAMPAIGN_STATS) assert.ok(Number.isInteger(stats[k]) && stats[k] >= S.startStatMin && stats[k] <= S.statMax, `${k}=${stats[k]}`);
      assert.ok(quality(stats) >= S.startQualityMin);
      for (const [k, min] of Object.entries(a.min)) assert.ok(stats[k] >= min, `archetype ${a.id} needs ${k} ≥ ${min}`);
      assert.ok(traits.length <= S.maxTraits);
      assert.ok(traits.filter(t => CAMPAIGN.traits[t].type === 'drawback').length <= S.maxDrawbacks);
      assert.ok(traits.every(t => !S.excludedStartTraits.includes(t)));
      assert.equal(new Set(traits).size, traits.length);
    });
  }
  // The same ids always give the same survivor.
  assert.deepEqual(generateCampaignSurvivor(42, 3, 'founder:2', { archetype: 'C', start: true }), generateCampaignSurvivor(42, 3, 'founder:2', { archetype: 'C', start: true }));
});

test('archetypes A-E describe the spec’s starting crew', () => {
  assert.deepEqual(S.archetypes.map(a => [a.id, a.min]), [['A', { int: 7 }], ['B', { str: 6, end: 6 }], ['C', { int: 7 }], ['D', { agi: 6, end: 6 }], ['E', {}]]);
  const g = campaign();
  assert.ok(g.survivors.every(s => s.model === 'campaign' && quality(s.stats) >= 9));
  assert.ok(g.survivors[0].stats.int >= 7, 'the first founder is archetype A');
  assert.ok(g.survivors[1].stats.str >= 6 && g.survivors[1].stats.end >= 6, 'the second is B');
});

test('the labor factor follows the formula', () => {
  assert.equal(attributeFactor(5), 1);
  assert.ok(Math.abs(attributeFactor(10) - 1.2) < 1e-12);
  assert.deepEqual([0.6, 0.5, 0.25, 0.2].map(healthFactor), [1, 0.75, 0, 0]);
  assert.deepEqual([60, 61, 85, 86, 99, 100].map(fatigueFactor), [1, 0.75, 0.75, 0.5, 0.5, 0]);
  // STR 7 Engineer building, proficiency 5, Handy: 1.08 x 1.5 x (1 + 0.05 + 0.10).
  const eng = person({ str: 7 }, { role: 'engineer', proficiency: { engineer: 5 }, traits: ['handy'] });
  assert.equal(campaignJob(eng), 'engineer');
  assert.ok(Math.abs(laborFactor(eng, 'build') - 1.08 * 1.5 * 1.15) < 1e-12);
  assert.ok(Math.abs(laborFactor(eng, 'gather') - 1.08 * 1.05) < 1e-12, 'the engineer multiplier is for building and crafting only');
  // Each attribute governs its own work; health and fatigue scale it down.
  const p = person({ int: 9, end: 3, agi: 8 });
  assert.ok(Math.abs(laborFactor(p, 'craft') - 1.16) < 1e-12);
  assert.ok(Math.abs(laborFactor(p, 'farm') - 0.92) < 1e-12);
  assert.ok(Math.abs(laborFactor(p, 'scavenge') - 1.12) < 1e-12);
  assert.ok(Math.abs(laborFactor({ ...p, hp: 40 }, 'craft') - 1.16 * 0.75) < 1e-12);
  assert.ok(Math.abs(laborFactor({ ...p, fatigue: 90 }, 'craft') - 1.16 * 0.5) < 1e-12);
  assert.equal(laborFactor({ ...p, fatigue: 100 }, 'craft'), 0);
  assert.ok(Math.abs(laborFactor(person({}, { traits: ['slow_learner'] }), 'craft') - 0.9) < 1e-12);
});

test('campaign survivors have 100 HP, 110 if Sturdy; legacy ones grow with Endurance', () => {
  assert.equal(campaignMaxHp(person()), 100);
  assert.equal(campaignMaxHp(person({}, { traits: ['sturdy'] })), 110);
  assert.equal(survivorStats(person({ end: 10 })).hp, 100);
  const legacy = new Game().survivors[0];
  assert.equal(survivorStats(legacy).hp, 60 + 9 * legacy.stats.end);
  const g = campaign();
  for (const s of g.survivors) assert.equal(s.hp, campaignMaxHp(s));
});

test('work tires survivors and a bed restores them; sleeping rough recovers half as fast', () => {
  const g = campaign(), [a, b] = g.survivors;
  a.traits = []; b.traits = [];
  hours(g, 6);
  assert.ok(Math.abs(a.fatigue - 24) < 0.2, `six hours of work: ${a.fatigue}`);
  // 19:00: everyone goes to rest.
  hours(g, 6.5);
  assert.equal(g.workShift, false);
  assert.ok(a.resting, 'off shift they rest');
  const before = a.fatigue;
  b.home = null; g.wake(b); b.fatigue = before;
  hours(g, 1);
  assert.ok(a.fatigue <= before - 7.5, 'housed rest: -8 an hour');
  assert.ok(b.fatigue > a.fatigue, 'without a bed recovery is slower');
});

test('at 100 fatigue a survivor stops working until they are down to 40', () => {
  const g = campaign(), s = g.survivors[0];
  s.fatigue = 99.9;
  hours(g, 0.1);
  assert.ok(s.exhausted);
  assert.equal(g.onDuty(s), false, 'they rest even during the work shift');
  s.fatigue = 41; g.crewTick(0.01); assert.ok(s.exhausted);
  s.fatigue = 40; g.crewTick(0.01); assert.equal(s.exhausted, false);
  assert.equal(g.onDuty(s), true);
  // Restless survivors tire 10% faster.
  const t = g.survivors[1]; t.traits = ['restless']; t.fatigue = 0; t.resting = false; t.sheltered = false;
  const u = g.survivors[2]; u.traits = []; u.fatigue = 0; u.resting = false; u.sheltered = false;
  g.crewTick(HOUR_SECONDS);
  assert.ok(Math.abs(t.fatigue - 4.4) < 1e-9 && Math.abs(u.fatigue - 4) < 1e-9);
});

test('four effective hours of a job earn a proficiency point, up to 20', () => {
  const g = campaign(), s = g.survivors[0];
  s.role = 'farmer';
  hours(g, 4.1);
  assert.equal(s.proficiency.farmer, 1);
  s.proficiency.farmer = 20; s.laborHours.farmer = 3.9;
  hours(g, 1);
  assert.equal(s.proficiency.farmer, 20);
});

test('campaign survivors improve by job, not levels', () => {
  const g = campaign(), s = g.survivors[0], stats = { ...s.stats };
  g.grantXP(s, 1e6);
  assert.equal(s.level, 1); assert.deepEqual(s.stats, stats);
});

test('hunger: morale falls after 12 hours without food, health after 24; Phase 1 never kills', () => {
  const g = campaign(), s = g.survivors[0], max = campaignMaxHp(s);
  g.resources.food = 0;
  hours(g, 11.9);
  assert.equal(s.morale, S.startMorale, 'the first 12 hours cost nothing');
  hours(g, 11.9);
  assert.ok(s.morale < S.startMorale);
  assert.equal(s.hp, max, 'health holds for the first day');
  hours(g, 24);
  assert.ok(s.hp < max && s.hp > max - 10, `about 10 a day: ${s.hp}`);
  s.hp = 1.5;
  hours(g, 12);
  assert.equal(s.hp, 1, 'Phase 1 hunger stops at 1 HP');
  assert.equal(s.condition !== 'downed', true);
  g.resources.food = 50; g.step(1);
  assert.equal(g.campaign.foodShortageHours, 0, 'eating resets the clock');
  // From Phase 2 hunger can down a survivor.
  g.resources.food = 0; g.campaign.phase = 2; g.campaign.foodShortageHours = 30; s.hp = 0.05;
  let downed = false;
  for (let t = 0; t < 0.5 * HOUR_SECONDS && !downed; t += 0.25) { g.step(0.25); downed = s.condition === 'downed'; }
  assert.ok(downed, 'hunger can down a survivor once Phase 1 is over');
});

test('a saved crew keeps traits, proficiency, fatigue and morale; bad values are clamped', () => {
  const g = campaign(), s = g.survivors[0];
  s.traits = ['sturdy', 'restless']; s.proficiency = { engineer: 7 }; s.laborHours = { engineer: 2.5 }; s.fatigue = 33; s.morale = 61; s.hp = 105;
  g.campaign.foodShortageHours = 5;
  const loaded = new Game();
  assert.ok(loaded.restore(g.serialize()));
  const t = loaded.survivors[0];
  assert.deepEqual([t.traits, t.proficiency, t.laborHours, t.fatigue, t.morale, t.hp], [['sturdy', 'restless'], { engineer: 7 }, { engineer: 2.5 }, 33, 61, 105]);
  assert.equal(loaded.campaign.foodShortageHours, 5);
  const bad = JSON.parse(g.serialize());
  Object.assign(bad.survivors[0], { traits: ['sturdy', 'nonsense', 'sturdy', 'handy', 'alert'], proficiency: { engineer: 99, pilot: 3 }, fatigue: 250, morale: -4, exhausted: 'yes' });
  assert.ok(loaded.restore(JSON.stringify(bad)));
  const u = loaded.survivors[0];
  assert.deepEqual([u.traits, u.proficiency, u.fatigue, u.morale, u.exhausted], [['sturdy', 'handy'], { engineer: 20 }, 100, 0, false]);
});

test('campaign survivors follow the 07:00-19:00 work shift', () => {
  const g = campaign(), s = g.survivors[0];
  assert.equal(g.onDuty(s), true);
  g.elapsed = 13 * HOUR_SECONDS; // 20:00
  assert.equal(g.onDuty(s), false);
  g.elapsed = DAY_SECONDS; // 07:00 on day 2
  assert.equal(g.onDuty(s), true);
});
