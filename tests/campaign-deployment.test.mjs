// M3: campaign Phase 0. Seeds, the regional audit (landing site, exits, corridor, reserved ground, debris,
// sites), the deployment package and its autosave, protection from the dead, and the start-screen flow.
// SWEEP_SEEDS sets how many seeds per map size the sweep runs (default 6); web/tools/campaignSeedSweep.mjs runs 1000.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, DAY_SECONDS } from '../web/src/engine/model.mjs';
import { CAMPAIGN } from '../web/src/engine/campaignState.mjs';
import { murmur3x64, seedFromText, regionIdOf } from '../web/src/engine/seed.mjs';
import { regionScaleOf } from '../web/src/engine/deployment.mjs';
import { HudStore, SETUP, MAP_SIZES } from '../web/src/hud/hudStore.js';

const SWEEP = Number(process.env.SWEEP_SEEDS) || 6;
const D = CAMPAIGN.tuning.deployment;
function deploy(settings) {
  const g = new Game();
  g.beginCampaign(settings);
  const steps = [];
  let s; do { s = g.advanceWorldGeneration(); steps.push(s.activity); } while (!s.done);
  return { g, steps };
}
const hex = s => murmur3x64(new TextEncoder().encode(s)).map(x => x.toString(16).padStart(16, '0')).join('');

test('seeds: numbers pass through, text is MurmurHash3 x64-128 over UTF-8', () => {
  assert.equal(hex(''), '0'.repeat(32));
  assert.equal(hex('hello'), 'cbd8a7b341bd9b025b1e906a48ae1d19');
  assert.equal(hex('The quick brown fox jumps over the lazy dog'), 'e34bbc7bbc071b6c7a433ca9c49a9347');
  assert.equal(seedFromText('42'), '42');
  assert.equal(seedFromText('18446744073709551615'), '18446744073709551615', 'the largest 64-bit seed');
  assert.notEqual(seedFromText('18446744073709551616'), '18446744073709551616', 'beyond 64 bits it is hashed as text');
  assert.equal(seedFromText('ashfall'), murmur3x64(new TextEncoder().encode('ashfall'))[0].toString());
  assert.notEqual(seedFromText('Überlebende 生存者'), seedFromText('Uberlebende'), 'any script hashes as UTF-8');
  assert.match(seedFromText('', () => 0.5), /^\d+$/);
  assert.match(regionIdOf(seedFromText('ashfall')), /^[A-Z]{2}-\d{4}$/);
});

test('a deployment lands the package in an audited region', () => {
  const { g, steps } = deploy({ seed: 'ashfall', overseerName: 'Rook', mapSize: 'standard' });
  const r = g.campaign.region, R = regionScaleOf('standard');
  assert.equal(r.fallback, null);
  assert.equal(r.id, regionIdOf(seedFromText('ashfall')));
  // The eleven progress messages, in order, ending with the authorization.
  const seen = [...new Set(steps)];
  assert.ok(seen.length >= 11);
  assert.equal(steps.at(-1), CAMPAIGN.strings.deploy_step_11);
  for (let i = 1; i <= 11; i++) assert.ok(seen.some(a => a.startsWith(CAMPAIGN.strings['deploy_step_' + String(i).padStart(2, '0')])), 'step ' + i);
  // The package: five crew, five tents, the cache, five clubs carried, two clubs and two pistols spare.
  assert.equal(g.survivors.length, 5);
  assert.equal(g.buildings.filter(b => b.type === 'tent').length, 5);
  assert.deepEqual(g.items.map(i => i.type).sort(), ['basic_pistol', 'basic_pistol', ...Array(7).fill('wooden_club')]);
  assert.equal(g.items.filter(i => i.holder != null).length, 5);
  assert.ok(g.survivors.every(s => s.gear === 'wooden_club'));
  assert.equal(g.storedWeight, 347.5); assert.equal(g.overflow, 0);
  // Debris covers the guaranteed local quotas exactly, at least half of each inside the protected perimeter.
  for (const [resource, quota] of Object.entries(D.guaranteedLocal)) {
    const nodes = g.debris.filter(d => d.resource === resource), total = nodes.reduce((n, d) => n + d.stock, 0);
    const inside = nodes.filter(d => Math.hypot(d.x, d.y) <= r.protectedRadius + 32).reduce((n, d) => n + d.stock, 0);
    assert.equal(total, quota, resource);
    assert.ok(inside >= quota / 2, `${resource}: ${inside} of ${quota} inside`);
    assert.ok(nodes.every(d => Math.hypot(d.x, d.y) <= r.localRadius + 32), resource + ' within the local radius');
  }
  assert.equal(r.patches.length, 3);
  assert.ok(r.corridor.closestTiles >= R.corridor[0] - 0.5 && r.corridor.closestTiles <= R.corridor[1]);
  assert.equal(r.sites.length, Object.keys(CAMPAIGN.sites).length);
  assert.deepEqual(r.sites.filter(s => !s.revealed).map(s => s.id).sort(), ['regional_relay', 'service_depot']);
  // Landing: CentroCom and Mara write, Phase 1 begins, and the deployment autosave is requested.
  assert.equal(g.campaign.phase, 1);
  assert.deepEqual(g.messages.map(m => m.from), ['CentroCom', 'Mara Venn']);
  assert.match(g.messages[0].body, /^Overseer Rook, deployment to Region [A-Z]{2}-\d{4} is confirmed/);
  assert.equal(g.autosaveReason, 'Deployment - Day 1');
  assert.equal(g.day, 1); assert.equal(g.hour, 7);
});

test('the same seed always deploys the same region and crew; another seed differs', () => {
  const a = deploy({ seed: 'repeatable', mapSize: 'compact' }).g, b = deploy({ seed: 'repeatable', mapSize: 'compact' }).g, c = deploy({ seed: 'different', mapSize: 'compact' }).g;
  assert.deepEqual(a.campaign.region, b.campaign.region);
  assert.deepEqual(a.debris, b.debris);
  assert.deepEqual(a.survivors.map(s => [s.name, s.stats, s.traits]), b.survivors.map(s => [s.name, s.stats, s.traits]));
  assert.equal(JSON.stringify(a.map.terr), JSON.stringify(b.map.terr));
  assert.notDeepEqual(a.campaign.region.sites, c.campaign.region.sites);
  assert.notDeepEqual(a.survivors.map(s => s.stats), c.survivors.map(s => s.stats));
});

test('Assisted deploys 517.25 weight of supplies with no overflow', () => {
  const { g } = deploy({ seed: 'assisted', difficulty: 'assisted', mapSize: 'compact' });
  assert.equal(g.storedWeight, 517.25);
  assert.equal(g.overflow, 0);
});

test(`seed sweep: ${SWEEP} seeds per map size pass the audit with every site reachable`, () => {
  for (const mapSize of MAP_SIZES) for (let i = 0; i < SWEEP; i++) {
    const { g } = deploy({ seed: `sweep-${mapSize}-${i}`, mapSize }), r = g.campaign.region;
    const label = `${mapSize} seed ${i}`;
    assert.equal(r.fallback, null, label + ' needed the fallback');
    assert.equal(r.sites.length, 11, label);
    assert.ok(r.sites.every(s => s.walkTiles > 0), label + ' unreachable site');
    assert.equal(r.patches.length, 3, label);
    assert.equal(g.debris.reduce((n, d) => n + d.stock, 0), Object.values(D.guaranteedLocal).reduce((a, b) => a + b, 0), label);
  }
});

test('a deployed campaign saves and loads with its region, debris and settings', () => {
  const { g } = deploy({ seed: 'persist', overseerName: 'Wren', mapSize: 'large' });
  g.debris[0].stock = 3;
  const loaded = new Game();
  assert.ok(loaded.restore(g.serialize()), loaded.restoreError(g.serialize()));
  assert.deepEqual(loaded.campaign.region, g.campaign.region);
  assert.deepEqual(loaded.debris, g.debris);
  assert.equal(loaded.map.w, 320, 'the Large (XL) map survives a save');
  assert.equal(loaded.campaign.settings.overseerName, 'Wren');
});

test('the camp is protected: no infected arrive before the first threat is switched on', () => {
  const { g } = deploy({ seed: 'quiet', mapSize: 'compact' });
  for (let t = 0; t < DAY_SECONDS * 2; t += 1) g.step(1);
  assert.equal(g.zombies.length, 0);
  g.campaign.threatsActive = true;
  const kills = g.kills;
  for (let t = 0; t < DAY_SECONDS; t += 1) g.step(1);
  // Arrivals may already have been dealt with by the end of the day.
  assert.ok(g.zombies.length + g.kills - kills > 0, 'once switched on, infected arrive');
});

test('the start screen: settings, region, a letter read to the end, acceptance, deployment', () => {
  const launched = [];
  const hud = new HudStore({ save() {}, startCampaignWithLoading: s => launched.push(s) });
  hud.startNewGame();
  assert.equal(hud.setupStep, SETUP.settings);
  hud.setSetupSelection(1); hud.setOverseerName('  Ведущий-Overseer-with-a-very-long-name  ');
  hud.advanceNewGameSetup();
  assert.equal(hud.selectedDifficulty, 'assisted');
  assert.equal(hud.setupStep, SETUP.region);
  hud.setSetupSelection(2); hud.setSeedText('x'.repeat(80));
  assert.equal(hud.seedText.length, 64);
  hud.setSeedText('Night Shift');
  hud.advanceNewGameSetup();
  assert.equal(hud.setupStep, SETUP.letter); assert.equal(hud.pendingSeed, 'Night Shift');
  hud.advanceNewGameSetup();
  assert.equal(hud.setupStep, SETUP.letter, 'I AGREE waits for the end of the letter');
  hud.backFromNewGameSetup(); hud.advanceNewGameSetup();
  assert.equal(hud.pendingSeed, 'Night Shift', 'rereading the letter keeps the seed');
  hud.markLetterRead(); hud.advanceNewGameSetup();
  assert.equal(hud.setupStep, SETUP.accepted);
  hud.advanceNewGameSetup();
  assert.equal(launched.length, 1);
  assert.deepEqual({ ...launched[0], world: undefined }, { difficulty: 'assisted', mapSize: 'large', overseerName: 'Ведущий-Overseer-with-', seed: 'Night Shift', world: undefined });
  assert.equal([...hud.overseerName].length, 24);
  assert.ok(hud.isWorldLoading);
});

test('a blank seed is settled once and kept through the letter', () => {
  const hud = new HudStore({ save() {}, startCampaignWithLoading() {} });
  hud.startNewGame(); hud.advanceNewGameSetup();
  assert.equal(hud.setupStep, SETUP.settings, 'a name is required');
  hud.setOverseerName('Rook'); hud.advanceNewGameSetup(); hud.advanceNewGameSetup();
  const seed = hud.pendingSeed;
  assert.match(seed, /^\d+$/);
  hud.backFromNewGameSetup(); hud.advanceNewGameSetup();
  assert.equal(hud.pendingSeed, seed);
  hud.backFromNewGameSetup(); hud.setSeedText('changed'); hud.advanceNewGameSetup();
  assert.equal(hud.pendingSeed, 'changed', 'changing the seed text settles the new one');
});
