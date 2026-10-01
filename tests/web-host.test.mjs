// Checks the React/Python web build: its boundary, delta frames, saves and shipped assets.
// web/src/engine is the simulation's source of truth; the Unity copy is kept only for reference.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Simulation } from '../web/src/host/simulation.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webEngine = path.join(root, 'web/src/engine');
const read = file => fs.readFileSync(file, 'utf8');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

test('web presentation assets match the Unity resources', () => {
  execFileSync(process.execPath, [path.join(root, 'Tools/export-web-assets.mjs'), '--check'], { stdio: 'pipe' });
});

test('every command the web HUD issues is on the simulation boundary allowlist', () => {
  const boundary = read(path.join(webEngine, 'unity.mjs'));
  const table = boundary.slice(boundary.indexOf('const commands = {'), boundary.indexOf('globalThis.afCommand'));
  const allowed = new Set([...table.matchAll(/(\w+):\s*(?:\([^)]*\)|\w+)\s*=>/g)].map(m => m[1]));
  const sources = [...walk(path.join(root, 'web/src/hud')), ...walk(path.join(root, 'web/src/host'))].filter(f => /\.(jsx?|mjs)$/.test(f));
  const used = new Set(sources.flatMap(f => [...read(f).matchAll(/\bcommand\(\s*'(\w+)'/g)].map(m => m[1])));
  assert.ok(used.size >= 25, 'the HUD should drive the full command set');
  for (const name of used) assert.ok(allowed.has(name), `${name} is not a boundary command`);
});

test('the delta frame reader reproduces the full frame', () => {
  const sim = new Simulation();
  sim.command('reset');
  sim.generateWorld('small', 4242);
  sim.command('devGrantResource', 'wood', 500);
  for (let i = 0; i < 400; i++) {
    sim.step(0.05);
    if (i === 100) sim.command('triggerIncursion');
    if (i % 50 === 0) sim.readFrame();
  }
  const delta = sim.readFrame(), full = sim.readFullFrame();
  const byId = new Map(delta.entities.map(e => [e.id, e]));
  assert.equal(delta.entities.length, full.entities.length);
  for (const e of full.entities) {
    const d = byId.get(e.id);
    assert.ok(d, `entity ${e.id} missing from delta frame`);
    for (const key of ['kind', 'type', 'sprite', 'hidden', 'downed', 'stationed']) assert.equal(d[key], e[key], `${key} of ${e.id}`);
    assert.ok(Math.abs(d.x - e.x) < 0.06 && Math.abs(d.y - e.y) < 0.06 && Math.abs(d.hp - e.hp) < 0.06, `position/hp of ${e.id}`);
  }
  for (const key of ['day', 'hour', 'wood', 'scrap_metal', 'food', 'kills', 'status', 'incoming']) assert.deepEqual(delta[key], full[key], key);
});

test('world loads restart the delta stream so no stale entities remain', () => {
  const sim = new Simulation();
  sim.command('reset');
  sim.readFrame();
  sim.loadOutpostMap();
  const ids = new Set(sim.readFullFrame().entities.map(e => e.id));
  assert.deepEqual(new Set(sim.readFrame().entities.map(e => e.id)), ids);
});

test('save import is validated in isolation before touching the live game', () => {
  const sim = new Simulation();
  const before = sim.serialize();
  assert.notEqual(Simulation.probe('{}'), '');
  assert.notEqual(Simulation.probe('not json'), '');
  assert.equal(Simulation.probe(before), '');
  assert.equal(sim.serialize(), before);
});

async function waitFor(url, attempts = 50) {
  for (let i = 0; i < attempts; i++) {
    try { const r = await fetch(url); if (r.ok) return r; } catch { /* not up yet */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('server did not start: ' + url);
}

test('the Python server keeps a backup, rejects invalid saves and preserves rejected ones', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afterlife-server-'));
  fs.copyFileSync(path.join(root, 'server.py'), path.join(dir, 'server.py'));
  const port = 20000 + Math.floor(Math.random() * 20000), base = `http://127.0.0.1:${port}`;
  const server = spawn('python3', ['server.py'], { cwd: dir, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  const exited = new Promise(resolve => server.on('exit', resolve));
  try {
    await waitFor(base + '/api/health');
    assert.deepEqual(await (await fetch(base + '/api/save')).json(), { save: null, backup: null, path: path.join(fs.realpathSync(dir), 'save.json') });
    const post = body => fetch(base + '/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal((await post('{"run":1}')).status, 200);
    assert.equal((await post('{"run":2}')).status, 200);
    assert.equal((await post('not json')).status, 400);
    const saved = await (await fetch(base + '/api/save')).json();
    assert.equal(saved.save, '{"run":2}');
    assert.equal(saved.backup, '{"run":1}');
    assert.equal((await fetch(base + '/api/save/reject', { method: 'POST' })).status, 200);
    assert.ok(fs.readdirSync(dir).some(f => f.startsWith('save.json.rejected-')));
    assert.equal((await fetch(base + '/api/shutdown', { method: 'POST' })).status, 200);
    assert.equal(await Promise.race([exited, new Promise(resolve => setTimeout(() => resolve('timeout'), 5000))]), 0);
  } finally {
    server.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('every design kit UI sprite ships with the game and the web build', async () => {
  const { PARTS } = await import('../Tools/ArtSource/ui-kit/pixel-supplies.js');
  const kit = ['badge_open', 'btn_close', 'btn_close_down', 'btn_close_hover', 'btn_manage', 'btn_manage_down', 'btn_manage_hover',
    'chip_away', 'chip_hurt', 'chip_idle', 'chip_working', 'mini_health', 'mini_morale', 'survivor_card', 'survivor_card_away', 'survivor_card_hurt',
    'icon_wood', 'icon_metal', 'icon_food', 'mini_wood', 'mini_metal', 'mini_food', ...Object.keys(PARTS)];
  for (const name of kit) {
    assert.ok(fs.existsSync(path.join(root, 'Assets/Afterlife/Resources/UI', name + '.png')), `${name} missing from Unity Resources`);
    assert.ok(fs.existsSync(path.join(root, 'web/public/unity/UI', name + '.png')), `${name} missing from the web build`);
  }
  assert.ok(fs.existsSync(path.join(root, 'Assets/Afterlife/Resources/FX/molotov_scorch.png')));
});
