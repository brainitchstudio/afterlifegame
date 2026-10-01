// The AfterLife campaign's foundation: New Game starts a campaign run, its settings survive a save,
// and the campaign content published from the studio is in the shape the engine reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../web/src/engine/model.mjs';
import { CAMPAIGN, createCampaign, campaignSettings } from '../web/src/engine/campaignState.mjs';
import { game } from '../web/src/engine/unity.mjs';

test('New Game starts a campaign run; scenario games stay legacy', () => {
  afCommand('reset', '[]');
  assert.equal(game.mode, 'campaign');
  assert.deepEqual(game.campaign, createCampaign());
  assert.deepEqual([game.campaign.version, game.campaign.phase, game.campaign.classification, game.campaign.threatsActive, game.campaign.region], [1, 0, 'Provisional Camp', false, null]);
  assert.deepEqual(game.campaign.settings, { difficulty: 'standard', mapSize: 'standard', overseerName: 'Overseer', seed: null });
  assert.equal(new Game().campaign, null);
  assert.equal(new Game(Math.random, { start: 'refuge', mode: 'campaign' }).campaign, null, 'the walled refuge is never a campaign');
});

test('campaign settings are sanitized and survive a save', () => {
  assert.deepEqual(campaignSettings({ difficulty: 'nightmare', mapSize: 'huge', overseerName: '   ' + 'x'.repeat(40) }),
    { difficulty: 'standard', mapSize: 'standard', overseerName: 'x'.repeat(24), seed: null });
  const g = new Game(Math.random, { mode: 'campaign', campaign: { difficulty: 'assisted', mapSize: 'compact', overseerName: 'Rook', seed: 'ashfall' } });
  const loaded = new Game();
  loaded.restore(g.serialize());
  assert.equal(loaded.mode, 'campaign');
  assert.deepEqual(loaded.campaign, createCampaign({ difficulty: 'assisted', mapSize: 'compact', overseerName: 'Rook', seed: 'ashfall' }));
  const legacy = new Game();
  legacy.restore(new Game().serialize());
  assert.equal(legacy.mode, 'legacy');
  assert.equal(legacy.campaign, null);
});

test('published campaign content is complete and internally consistent', () => {
  assert.equal(Object.keys(CAMPAIGN.resources).length, 12);
  const main = CAMPAIGN.tasks.filter(t => t.kind === 'main');
  assert.equal(main.length, 23);
  const ids = new Set(CAMPAIGN.tasks.map(t => t.id));
  for (const b of Object.values(CAMPAIGN.buildings)) assert.ok(b.unlockedBy === 'starter' || ids.has(b.unlockedBy), b.name);
  for (const r of Object.values(CAMPAIGN.recipes)) {
    assert.ok(CAMPAIGN.buildings[r.station], r.name + ' station');
    for (const k of Object.keys(r.inputs)) assert.ok(CAMPAIGN.resources[k], r.name + ' input ' + k);
  }
  for (const b of Object.values(CAMPAIGN.buildings)) for (const k of Object.keys(b.cost)) assert.ok(CAMPAIGN.resources[k], b.name + ' cost ' + k);
  // Copy placeholders are filled from these names only.
  const known = new Set(['overseerName', 'regionId', 'reason', 'foodDays', 'survivorName', 'assignments', 'recoveredSummary', 'leftBehindSummary', 'eta',
    'capacity', 'population', 'outsideCount', 'offsiteCount', 'buildingName', 'moduleName', 'actionSummary', 'taskTitle', 'rewardSummary', 'day',
    'producedFood', 'consumedFood', 'availableFood', 'injuryCount', 'alertCount', 'direction', 'siteName', 'damage', 'teamName', 'location',
    'resourceSummary', 'components', 'operatorName', 'minHours', 'maxHours', 'candidateName']);
  const texts = [...Object.values(CAMPAIGN.strings), ...CAMPAIGN.tasks.flatMap(t => Object.values(t.copy))];
  for (const text of texts) for (const [, key] of text.matchAll(/\{(\w+)\}/g)) assert.ok(known.has(key), `unknown placeholder {${key}}`);
});
