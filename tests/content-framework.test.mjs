// The engine reads its buildables, jobs, quests, statuses, expeditions and weapons from the content
// studio's published module, and server.py serves the studio and its API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as CONTENT from '../web/src/engine/gameContent.mjs';
import { BUILDINGS, BUILDING_TREES, ROLES, ROLE_FOR, JOB_OF, JOBS, EXPEDITIONS, postSlots } from '../web/src/engine/data.mjs';
import { QUESTS, RANKS, QUEST_UNLOCKS } from '../web/src/engine/progression.mjs';
import { WEAPONS } from '../web/src/engine/survivors.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('engine tables come from the published content', () => {
  assert.equal(BUILDINGS, CONTENT.BUILDINGS);
  assert.equal(BUILDING_TREES, CONTENT.BUILDING_TREES);
  assert.equal(ROLES, CONTENT.ROLES);
  assert.equal(QUESTS, CONTENT.QUESTS);
  assert.equal(RANKS, CONTENT.RANKS);
  assert.equal(EXPEDITIONS, CONTENT.EXPEDITIONS);
  assert.equal(WEAPONS, CONTENT.WEAPONS);
  assert.match(CONTENT.CONTENT_HASH, /^[0-9a-f]{12}$/);
});

test('job posts tie roles to buildables with their slots', () => {
  for (const [building, role] of Object.entries(ROLE_FOR)) {
    assert.ok(BUILDINGS[building], building);
    assert.equal(ROLES[role].building, building);
    assert.ok(JOBS[JOB_OF[role]], role);
  }
  assert.equal(postSlots({ type: 'barracks', upgrades: [] }), 4);
  assert.equal(postSlots({ type: 'barracks', upgrades: ['nightwatch'] }), 6);
  assert.equal(postSlots({ type: 'tower', upgrades: [] }), 3);
  assert.equal(postSlots({ type: 'farm', upgrades: [] }), 2);
  assert.equal(postSlots({ type: 'dorm', upgrades: ['bunks'] }), 0);
  for (const role of Object.keys(ROLES)) assert.ok(JOB_OF[role], role);
});

test('quests and statuses reference real content', () => {
  for (const q of QUESTS) {
    assert.ok(RANKS[q.rank], q.id);
    for (const type of q.unlock) assert.ok(BUILDINGS[type] && !BUILDINGS[type].fixture, `${q.id} unlocks ${type}`);
    for (const x of q.objectives) {
      if (x.kind === 'build') assert.ok(BUILDINGS[x.type], `${q.id} builds ${x.type}`);
      if (x.kind === 'staff') assert.ok(ROLES[x.role], `${q.id} staffs ${x.role}`);
    }
  }
  assert.equal(QUEST_UNLOCKS.barricade, 'firewood');
  const maxTier = Math.max(...RANKS.map(r => r.tier));
  for (const [type, tree] of Object.entries(BUILDING_TREES)) for (const node of tree) {
    assert.ok(node.requires === null || tree.some(n => n.id === node.requires), `${type}.${node.id}`);
    let depth = 1;
    for (let n = node; n.requires; n = tree.find(p => p.id === n.requires)) depth++;
    assert.ok(depth <= maxTier, `${type}.${node.id} is tier ${depth}`);
  }
});

async function waitFor(url, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try { const r = await fetch(url); if (r.ok) return r; } catch { /* not up yet */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('server did not start: ' + url);
}

test('server serves the content studio and its read API', async () => {
  const port = 25000 + Math.floor(Math.random() * 10000);
  const base = `http://127.0.0.1:${port}`;
  const server = spawn('python3', ['server.py'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  try {
    await waitFor(base + '/api/health');
    const summary = await (await fetch(base + '/api/content/summary')).json();
    assert.ok(summary.valid, 'shipped content validates');
    assert.equal(summary.error_count, 0);
    assert.equal(summary.categories.buildables, Object.keys(BUILDINGS).length);
    assert.equal(summary.categories.quests, QUESTS.length);
    assert.ok(summary.published, 'gameContent.mjs is up to date with backend/data');

    const jobs = await (await fetch(base + '/api/content/jobs')).json();
    assert.equal(jobs.items.find(j => j.id === 'logger').roles[0].building, 'lumber_mill');
    const campaign = await (await fetch(base + '/api/content/campaign')).json();
    assert.deepEqual(campaign.stuck, []);

    for (const file of ['', 'studio.js', 'studio.css']) {
      const res = await fetch(base + '/dashboard/' + file);
      assert.equal(res.status, 200, file || 'index');
    }
    assert.match(await (await fetch(base + '/dashboard/')).text(), /studio\.js/);
    assert.equal((await fetch(base + '/dashboard/art/Buildings/farm.png')).headers.get('content-type'), 'image/png');
    assert.equal((await fetch(base + '/dashboard/art/Buildings/nope.png')).status, 404);
    // Raw requests: fetch would resolve the dot segments before sending.
    const raw = p => new Promise((resolve, reject) => http.get({ host: '127.0.0.1', port, path: p }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject));
    for (const p of ['/dashboard/../../server.py', '/dashboard/%2e%2e/%2e%2e/server.py', '/dashboard/art/../../../../server.py', '/dashboard/art/%2e%2e/%2e%2e/%2e%2e/%2e%2e/server.py']) assert.equal(await raw(p), 404, p);
  } finally {
    server.kill();
  }
});
