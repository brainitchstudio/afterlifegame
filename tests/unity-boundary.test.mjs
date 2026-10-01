import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {game} from '../web/src/engine/unity.mjs';
import {SIZES} from '../web/src/engine/worldgen.mjs';
import {CAMP_ART} from '../web/src/engine/camp.mjs';
import {buildableSprites} from '../web/src/host/campBuildArt.js';
import {BUILDINGS} from '../web/src/engine/data.mjs';
import {QUEST_UNLOCKS} from '../web/src/engine/progression.mjs';
import {perimeterSlots} from '../web/src/engine/land.mjs';
import {campaignStartingSupplies} from '../web/src/engine/campaignState.mjs';
// Scenarios about walls, gates and the HQ run in the walled refuge a camp grows into.
const refuge=()=>{game.start='refuge';game.reset();};
const camp=()=>{game.start='camp';game.mode='legacy';game.reset();};
const catalog=JSON.parse(afCatalog());
test('Unity can read terrain before a procedural map exists',()=>{
 game.reset();
 const terrain=JSON.parse(afTerrain());
 assert.equal(terrain.ground,null);
 assert.equal(terrain.mapWidth,0);
 assert.equal(terrain.mapHeight,0);
});
test('Unity world loading reports completed work and keeps the generated map deterministic',()=>{
 for(const size of ['small','medium','large']) {
  game.reset();
  afBeginWorld(size, 42067);
  let previous=0, checkpoints=0, result;
  do {
   result=JSON.parse(afAdvanceWorld());
   assert.ok(result.progress>=previous && result.progress<=1, `${size} progress must advance`);
   assert.ok(result.activity, `${size} must describe the current work`);
   previous=result.progress;
   checkpoints++;
  } while(!result.done);
  // World Generator v3 builds a map in one pass; the loading screen still sees its phases around it.
  assert.ok(checkpoints>=3, `${size} should show several generation phases`);
  assert.ok(game.map && game.map.w>0);
  const stepped=JSON.stringify(game.map);
  game.reset();
  assert.ok(afCommand('generateWorld',JSON.stringify([size,42067])));
  assert.equal(stepped,JSON.stringify(game.map),`${size} should match one-shot generation`);
 }
});
test('Unity catalog exposes every buildable construction type and all expeditions',()=>{
 assert.equal(catalog.buildings.length,Object.entries(BUILDINGS).filter(([k,b])=>k!=='core'&&!b.fixture).length);assert.equal(catalog.expeditions.length,3);
});
test('Every starting actor and catalog building resolves to exported art',()=>{
 const keys=new Set(JSON.parse(fs.readFileSync(new URL('../web/public/unity/AfterlifeAtlas.json',import.meta.url))).entries.map(e=>e.key));
 // Camp fixtures use the kit's decor art; the supply cache and the camp buildables are drawn by the host in the kit's style.
 const hostDrawn=new Set(['camp_cache',...Object.keys(buildableSprites).map(t=>'camp_'+t)]);
 const art=k=>k.startsWith('camp/')?hostDrawn.has(CAMP_ART[k])||keys.has(CAMP_ART[k]):keys.has(k);
 for(const b of catalog.buildings)assert.ok(art(b.sprite),b.sprite);
 for(const start of [camp,refuge]){start();for(const e of JSON.parse(afFrame()).entities)assert.ok(art(e.kind==='building'?e.sprite:e.sprite+'/s/0'),e.sprite);}
 camp();
});
test('Unity input boundary rejects arbitrary method execution',()=>{
 assert.throws(()=>afCommand('constructor','[]'),/Unknown Unity command/);
 assert.throws(()=>afCommand('serialize','[]'),/Unknown Unity command/);
});
test('Unity developer resource controls update the frame and reject invalid grants',()=>{
 game.reset();
 const before=JSON.parse(afFrame());
 for(const type of ['wood','scrap_metal','food'])assert.ok(afCommand('devGrantResource',JSON.stringify([type,100])));
 const after=JSON.parse(afFrame());
 for(const type of ['wood','scrap_metal','food'])assert.equal(after[type],before[type]+100);
 assert.equal(afCommand('devGrantResource',JSON.stringify(['medicine',100])),false);
 assert.equal(afCommand('devGrantResource',JSON.stringify(['wood',-1])),false);
});
test('Unity placement preview matches real construction and upgrade state',()=>{
 refuge();game.resources={wood:10000,scrap_metal:10000,food:10000};
 const p=JSON.parse(afPlacement('clinic',160,96,0));assert.ok(p.ok,p.reason);
 assert.ok(afCommand('build',JSON.stringify(['clinic',p.x,p.y,p.rotation])));
 const clinic=game.buildings.find(b=>b.type==='clinic');const before=JSON.parse(afDetails(clinic.id));
 assert.ok(before.upgrades.find(u=>u.id==='salves').enabled);
 assert.ok(afCommand('upgradeBuilding',JSON.stringify([clinic.id,'salves'])));
 assert.ok(JSON.parse(afDetails(clinic.id)).upgrades.find(u=>u.id==='salves').owned);
});
test('Unity recruitment, staffing, party and save bridge preserve model rules',()=>{
 refuge();game.resources={wood:10000,scrap_metal:10000,food:10000};game.spawnTimer=1e9;
 assert.ok(afCommand('recruit','[]'));afStep(21.1);
 const candidate=JSON.parse(afHud()).candidates[0];assert.ok(candidate);
 assert.ok(afCommand('acceptCandidate',JSON.stringify([candidate.id])));
 const workshop=game.buildings.find(b=>b.type==='workshop');
 assert.ok(afCommand('post',JSON.stringify([candidate.id,workshop.id])));
 assert.ok(JSON.parse(afDetails(candidate.id)).description.includes('Engineer'));
 const id=game.survivors[0].id;assert.equal(JSON.parse(afParty(JSON.stringify([id]),'woodland')).reason,'');
 assert.equal(JSON.parse(afFrame()).entities.find(e=>e.id===id).away,false);
 assert.ok(afCommand('sendExpedition',JSON.stringify([[id],'woodland'])));
 assert.equal(JSON.parse(afFrame()).entities.find(e=>e.id===id).away,true);
 afResetDelta();
 const delta=JSON.parse(afDeltaFrame());
 const index=delta.u.findIndex((value,i)=>i%6===0&&value===id);
 assert.ok(index>=0);
 assert.ok((delta.u[index+4]&32)!==0,'Expedition state must be present in compact survivor updates');
 const save=afSave();afCommand('reset','[]');assert.ok(afRestore(save));
 assert.equal(game.survivors.length,5);assert.ok(game.survivors.find(s=>s.id===id).expedition);
 assert.equal(afRestore('{}'),false);
});
test('Unity zombie boundary exposes sprites, attack orders, combat state, and details',()=>{
 game.reset();
 const keys=new Set(JSON.parse(fs.readFileSync(new URL('../Assets/Afterlife/Resources/AfterlifeAtlas.json',import.meta.url))).entries.map(e=>e.key));
 for(const kind of ['walker','runner','brute','bloater','soldier']) {
   for(const dir of ['s','n','e','w','se','sw','ne','nw']) {
     for(let f=0;f<4;f++) {
       assert.ok(keys.has(`zombies/${kind}/${dir}/${f}`), `Missing sprite zombies/${kind}/${dir}/${f}`);
       assert.ok(keys.has(`burning/${kind}/${dir}/${f}`), `Missing burning sprite burning/${kind}/${dir}/${f}`);
     }
   }
 }
 assert.ok(afCommand('spawnZombieAt',JSON.stringify(['walker',0,-50])));
 const frame=JSON.parse(afFrame());
 const z=frame.entities.find(e=>e.kind==='zombie');
 assert.ok(z);
 assert.equal(z.type,'walker');
 const details=JSON.parse(afDetails(z.id));
 assert.equal(details.kind,'zombie');
 assert.equal(details.name,'Walker');
 assert.ok(details.description.includes('Damage'));
 assert.equal(details.attackEnabled,true);
 assert.ok(afCommand('orderAttack',JSON.stringify([z.id])));
 const afterOrder=JSON.parse(afDetails(z.id));
 assert.ok(afterOrder.staff.length>0);
 assert.ok(afCommand('cancelAttack',JSON.stringify([z.id])));
 assert.equal(JSON.parse(afDetails(z.id)).staff.length,0);
 assert.ok(afCommand('triggerIncursion','[]'));
 assert.ok(JSON.parse(afFrame()).incoming.includes('INCURSION'));
 assert.ok(afCommand('killAllZombies','[]'));
 assert.equal(JSON.parse(afFrame()).entities.filter(e=>e.kind==='zombie').length,0);
});
test('Unity delta boundary emits added on first call, compact updates, and tracks removals',()=>{
 afResetDelta();
 const d1 = JSON.parse(afDeltaFrame());
 assert.ok(d1.added.length > 0, 'First delta call must emit all entities in added');
 assert.equal(d1.removed.length, 0);
 assert.ok(d1.u.length > 0);

 // Second call with no changes: added is empty, u contains update floats
 const d2 = JSON.parse(afDeltaFrame());
 assert.equal(d2.added.length, 0, 'Subsequent delta call with no metadata changes should have 0 added');
 assert.equal(d2.removed.length, 0);
 assert.equal(d2.u.length, d1.u.length);

 // Spawn zombie: should be in added
 assert.ok(afCommand('spawnZombieAt', JSON.stringify(['runner', 10, 20])));
 const d3 = JSON.parse(afDeltaFrame());
 assert.equal(d3.added.length, 1, 'Newly spawned zombie must be in added');
 assert.equal(d3.added[0].type, 'runner');

 // Kill zombie: should be in removed
 assert.ok(afCommand('killAllZombies', '[]'));
 const d4 = JSON.parse(afDeltaFrame());
 assert.ok(d4.removed.includes(d3.added[0].id), 'Killed zombie must be in removed');
});
test('Phase 2 ZombieBaseKit v2 buildings, smart gates, doors, bloater burst, and burning DoT',()=>{
 refuge();
 game.resources = { wood: 10000, scrap_metal: 10000, food: 10000 };

 // 1. Placement and building of shelter, lumber_mill, storage, lab, and armory
 const newTypes = [
   { type: 'shelter', x: 0, y: 112, up: 'reinforced_door' },
   { type: 'lumber_mill', x: 0, y: -112, up: 'circular_saw' },
   { type: 'storage', x: 160, y: 96, up: 'bulk_bins' },
   { type: 'lab', x: 176, y: 0, up: 'chemistry_set' },
   { type: 'armory', x: -176, y: 0, up: 'gunsmith_bench' },
 ];
 for (const item of newTypes) {
   const p = JSON.parse(afPlacement(item.type, item.x, item.y, 0));
   assert.ok(p.ok, `Placement for ${item.type} should be ok: ${p.reason}`);
   assert.ok(afCommand('build', JSON.stringify([item.type, p.x, p.y, p.rotation])));
   const b = game.buildings.find(bld => bld.type === item.type);
   assert.ok(b, `Building ${item.type} should exist in game`);
   const details = JSON.parse(afDetails(b.id));
   assert.ok(details.upgrades.some(u => u.id === item.up && u.enabled));
   assert.ok(afCommand('upgradeBuilding', JSON.stringify([b.id, item.up])));
   assert.ok(b.upgrades.includes(item.up));
 }

 // 2. Smart gate proximity
 const gate = game.buildings.find(b => b.type === 'gate');
 assert.ok(gate);
 const survivor = game.survivors[0];
 survivor.sheltered = false;
 survivor.condition = 'healthy';
 survivor.x = gate.x;
 survivor.y = gate.y;
 afStep(0.1);
 const gateSprite = JSON.parse(afFrame()).entities.find(e => e.id === gate.id).sprite;
 assert.ok(gateSprite.endsWith('/1'), 'Gate should open when survivor is near');

 // 3. Building door animation
 const shelter = game.buildings.find(b => b.type === 'shelter');
 survivor.x = shelter.x;
 survivor.y = shelter.y;
 afStep(0.6);
 assert.ok(shelter.doorFrame > 0, 'Shelter door should animate open when survivor is near');

 // 4. Bloater death toxic burst effect
 assert.ok(afCommand('spawnZombieAt', JSON.stringify(['bloater', 0, -60])));
 const bloater = game.zombies.find(z => z.kind === 'bloater');
 assert.ok(bloater);
 game.hit(bloater, bloater.hp + 10);
 const burst = game.effects.find(e => e.type === 'burst');
 assert.ok(burst, 'Bloater death must trigger toxic burst effect');

 // 5. Burning zombie DoT
 assert.ok(afCommand('spawnZombieAt', JSON.stringify(['walker', 50, 50])));
 const burnZombie = game.zombies.find(z => z.kind === 'walker' && z.x === 50 && z.y === 50);
 assert.ok(burnZombie);
 burnZombie.burning = true;
 const initialHP = burnZombie.hp;
 afStep(0.5);
 assert.ok(burnZombie.hp < initialHP, 'Burning zombie must take fire damage over time');
});

test('Phase 3 World generation, POI expeditions, all 42 decor, 8 world buildings, and 4-season dynamic cycle', () => {
  // Legacy expeditions to POIs; a campaign charts its sites on Regional Intel instead.
  game.mode = 'legacy'; game.reset();

  // 1. Procedural world generation
  assert.ok(afCommand('generateWorld', JSON.stringify(['small', 42])));
  const terrain = JSON.parse(afTerrain());
  assert.ok(terrain.pois.length > 0, 'Generated world must include POIs');
  assert.ok(terrain.worldBuildings.length > 0, 'Generated world must include world buildings');
  assert.ok(terrain.decor.length > 0, 'Generated world must include decor props');
  assert.equal(terrain.mapWidth, SIZES.small.w);
  assert.equal(terrain.mapHeight, SIZES.small.h);
  assert.equal(terrain.ground.length, terrain.mapWidth * terrain.mapHeight, 'Every generated cell needs a ground tile');

  const catalog = JSON.parse(afCatalog());
  assert.equal(catalog.pois.length, terrain.pois.length, 'Catalog POIs must match generated terrain POIs');

  // 2. All 8 world buildings x 4 seasons and all 42 decor props x 4 seasons resolve in atlas
  const atlas = JSON.parse(fs.readFileSync(new URL('../Assets/Afterlife/Resources/AfterlifeAtlas.json', import.meta.url)));
  const keys = new Set(atlas.entries.map(e => e.key));
  // v3's water, shores, new ground, overlays and structures come from the web's own world atlas.
  const worldAtlas = JSON.parse(fs.readFileSync(new URL('../web/public/world/WorldAtlas.json', import.meta.url)));
  const drawable = new Set([...keys, ...worldAtlas.entries.map(e => e.key)]);
  for (const tile of new Set([...terrain.ground, ...terrain.over.flat().filter(Boolean)]))
    assert.ok(drawable.has('tiles/' + tile), `Missing ground sprite: ${tile}`);
  for (const d of terrain.decor) for (const s of ['', '_spring', '_fall', '_winter']) assert.ok(drawable.has(d.key + s), `Missing prop sprite: ${d.key + s}`);
  for (const b of terrain.worldBuildings) assert.ok(drawable.has(b.key), `Missing world building sprite: ${b.key}`);
  for (const t of terrain.trees) assert.ok(drawable.has('tiles/' + t.k), `Missing tree sprite: ${t.k}`);
  const blds = ['wld_house', 'wld_burnt_house', 'wld_gas_station', 'wld_barn', 'wld_chapel', 'wld_water_tower', 'wld_shed', 'wld_trailer'];
  for (const b of blds) {
    for (const s of ['', '_spring', '_fall', '_winter']) {
      const k = 'world/' + b + s;
      assert.ok(keys.has(k), `Missing world building sprite: ${k}`);
    }
  }
  const decorBases = new Set(atlas.entries.filter(e => e.key.startsWith('decor/')).map(e => e.key.replace(/_(spring|fall|winter)$/, '')));
  assert.equal(decorBases.size, 42, 'Must contain all 42 decor prop types');
  for (const d of decorBases) {
    for (const s of ['', '_spring', '_fall', '_winter']) {
      const k = d + s;
      assert.ok(keys.has(k), `Missing decor sprite: ${k}`);
    }
  }

  // 3. Outpost map loading
  assert.ok(afCommand('loadOutpostMap', '[]'));
  const outpostTerrain = JSON.parse(afTerrain());
  assert.equal(outpostTerrain.mapWidth, 200);
  assert.equal(outpostTerrain.mapHeight, 100);

  // 4. 4-season dynamic progression
  game.reset();
  const DAY = 24 * 42;
  game.elapsed = 0;
  assert.equal(game.season, 'spring', 'Days 1-6 must be spring');
  game.elapsed = 6 * DAY;
  assert.equal(game.season, 'summer', 'Days 7-12 must be summer');
  game.elapsed = 12 * DAY;
  assert.equal(game.season, 'fall', 'Days 13-18 must be fall');
  game.elapsed = 18 * DAY;
  assert.equal(game.season, 'winter', 'Days 19-24 must be winter');

  assert.ok(afCommand('setSeason', JSON.stringify(['winter'])));
  assert.equal(game.season, 'winter');
  assert.equal(JSON.parse(afFrame()).season, 'winter');

  // 5. Physical POI expeditions
  game.elapsed = 0;
  game.spawnTimer = 1e9;
  game.resources.food = 10000;
  assert.ok(afCommand('generateWorld', JSON.stringify(['small', 42])));
  const survivor = game.survivors[0];
  const partyCheck = JSON.parse(afParty(JSON.stringify([survivor.id]), 'poi:0'));
  assert.equal(partyCheck.reason, '');
  assert.ok(afCommand('sendExpedition', JSON.stringify([[survivor.id], 'poi:0'])));

  const frame = JSON.parse(afFrame());
  const sEnt = frame.entities.find(e => e.id === survivor.id);
  assert.ok(sEnt, 'Survivor entity must exist in frame');
  assert.equal(sEnt.hidden, false, 'Survivor on POI expedition must not be hidden when map exists');
  assert.equal(sEnt.away, true, 'Visible POI traveler is still away from the refuge');

  const poi = game.worldPois.find(p => p.id === 0);
  assert.equal(poi.scavenged, false);

  let steps = 0;
  while (survivor.expedition && steps++ < 2000) {
    afStep(0.5);
  }
  assert.ok(steps < 2000, 'POI expedition must complete');
  assert.equal(survivor.expedition, undefined, 'Survivor expedition must clear upon return');
  assert.equal(JSON.parse(afFrame()).entities.find(e => e.id === survivor.id).away, false);
  assert.equal(poi.scavenged, true, 'POI must be marked scavenged upon return');
});

test('New Game reset initializes fresh Day 1 starter camp and ready gameplay state', () => {
  // Simulate clicking New Game button
  camp();
  assert.ok(afCommand('reset', '[]'));
  const frame = JSON.parse(afFrame());
  assert.equal(frame.day, 1, 'New game must start on Day 1');
  assert.equal(frame.status, 'playing', 'New game status must be playing');
  assert.equal(frame.season, 'spring', 'New game starts in spring');
  assert.equal(frame.kills, 0, 'New game has 0 kills');
  assert.equal(frame.alarm, false, 'New game starts without alarm');
  assert.equal(frame.incoming, '', 'New game has no incoming wave');

  const survivors = frame.entities.filter(e => e.kind === 'survivor');
  assert.equal(survivors.length, 5, 'A campaign deploys five survivors around the campfire');
  for (const s of survivors) {
    assert.ok(s.hp > 0, 'Survivor must be alive');
    assert.equal(s.downed, false, 'Survivor must not be downed');
    assert.equal(s.burning, false, 'Survivor must not be burning');
  }

  const buildings = frame.entities.filter(e => e.kind === 'building');
  assert.ok(buildings.length > 0, 'New game has starting buildings');
  const fire = buildings.find(b => b.type === 'campfire');
  assert.ok(fire, 'New game must have a campfire');
  assert.ok(fire.hp > 0, 'The campfire must be undamaged at start');
  assert.deepEqual(buildings.map(b => b.type).sort(), ['cache', 'campfire', 'tent', 'tent', 'tent', 'tent', 'tent']);
  assert.equal(frame.wood, campaignStartingSupplies('standard').wood, 'A campaign starts with the supply cache');
  const hud = JSON.parse(afHud());
  assert.equal(hud.tablet.quest.title, 'Firewood'); assert.equal(hud.tablet.rank, 'Camp');
  assert.equal(hud.tablet.unread, 0, 'CentroCom writes once the deployment lands, not on reset');
  // The campaign's build menu: its Phase 1 structures, each locked until its task authorizes it.
  const cat = JSON.parse(afCatalog()).buildings;
  assert.ok(cat.length > 0 && cat.every(b => b.locked), 'Every structure is locked until a task authorizes it');
  assert.equal(cat.find(b => b.id === 'tent').unlockedBy, 'P1-02 · Room for one more');
  assert.ok(!cat.some(b => b.id === 'salvage_pile' || b.id === 'barricade'), 'no Phase 1 salvage pile, no legacy walls');
});

test('New Game after loading a refuge save starts a starter camp, not another refuge', () => {
  refuge();
  const save = afSave();
  camp(); assert.ok(afRestore(save));
  assert.equal(game.start, 'refuge', 'the loaded run is still a refuge');
  assert.ok(afCommand('reset', '[]'));
  const types = JSON.parse(afFrame()).entities.filter(e => e.kind === 'building').map(e => e.type).sort();
  assert.deepEqual(types, ['cache', 'campfire', 'tent', 'tent', 'tent', 'tent', 'tent']);
  afBeginWorld('small', 7); let step; do step = JSON.parse(afAdvanceWorld()); while (!step.done);
  assert.ok(game.buildings.some(b => b.type === 'campfire') && !game.buildings.some(b => b.type === 'core'), 'a generated new world is a camp too');
});

test('Camp boundary: marking a tree, completing a quest and building what it unlocked', () => {
  camp(); game.spawnTimer = 1e9;
  const tree = [...game.forest.trees].sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0];
  assert.ok(afCommand('harvest', JSON.stringify([tree.id])));
  assert.match(afTreeHint(tree.id), /marked|is on it/);
  assert.equal(JSON.parse(afFrame()).harvest.jobs.length, 1);
  assert.ok(afCommand('harvest', JSON.stringify([tree.id])), 'clicking again takes the mark off');
  assert.equal(JSON.parse(afFrame()).harvest.jobs.length, 0);
  const t = JSON.parse(afTerrain());
  assert.ok(t.trees.every(x => typeof x.id === 'string'));
  assert.deepEqual(t.camp.map(p => p.key), ['decor/deco_logs', 'decor/deco_crates', 'decor/deco_backpack']);

  assert.equal(JSON.parse(afPlacement('barricade', 0, 400, 0)).ok, false, 'walls are locked');
  let tab = JSON.parse(afTablet());
  assert.equal(tab.quests[0].state, 'active'); assert.deepEqual(tab.quests[0].objectives[0], { text: 'Fell 3 trees', value: 0, count: 3, done: false });
  assert.equal(tab.quests[1].state, 'locked'); assert.equal(tab.ranks[0].current, true);
  game.progress.tally.felled = 3; afStep(1.1);
  tab = JSON.parse(afTablet());
  assert.equal(tab.quests[0].state, 'done'); assert.equal(tab.quests[1].state, 'active');
  assert.equal(tab.messages[0].title, 'New orders: Draw a Line', 'newest first');
  assert.equal(tab.journal[0].title, 'Firewood');
  assert.ok(!tab.inventory.locked.some(l => l.type === 'barricade'));
  const slot = perimeterSlots(game.land)[0], p = JSON.parse(afPlacement('barricade', slot.x, slot.y, slot.rotation));
  assert.ok(p.ok, p.reason);
  assert.ok(afCommand('build', JSON.stringify(['barricade', p.x, p.y, p.rotation])));
  const wall = game.buildings.find(b => b.type === 'barricade'), up = JSON.parse(afDetails(wall.id)).upgrades.find(u => u.id === 'reinforce');
  assert.equal(up.locked, 'Needs Outpost status'); assert.equal(up.enabled, false);
  assert.ok(afCommand('readMessages', '[]'));
  assert.equal(JSON.parse(afHud()).tablet.unread, 0);
});

test('Build mode allows watchtowers inside the base corners and preserves them through perimeter extension', () => {
  refuge();
  game.resources = { wood: 5000, scrap_metal: 5000, food: 5000 };

  // Place watchtowers in all four starter corners inside the base
  const corners = [
    { x: -352, y: -256, label: 'NW corner' },
    { x: 320, y: -256, label: 'NE corner' },
    { x: -352, y: 224, label: 'SW corner' },
    { x: 320, y: 224, label: 'SE corner' },
  ];
  for (const c of corners) {
    const p = JSON.parse(afPlacement('tower', c.x, c.y, 0));
    assert.ok(p.ok, `${c.label} (${c.x}, ${c.y}) should be placeable: ${p.reason}`);
    assert.ok(afCommand('build', JSON.stringify(['tower', p.x, p.y, p.rotation])));
  }

  // Placement flush against north wall
  const pWall = JSON.parse(afPlacement('tower', 64, -256, 0));
  assert.ok(pWall.ok, `Tower flush against north wall (64, -256) should be placeable: ${pWall.reason}`);
  assert.ok(afCommand('build', JSON.stringify(['tower', pWall.x, pWall.y, pWall.rotation])));

  // Placement directly on top of a perimeter barricade panel must fail
  const pOnWall = JSON.parse(afPlacement('tower', -368, -256, 0));
  assert.equal(pOnWall.ok, false, 'Tower on top of barricade panel must be rejected');
  assert.equal(afCommand('build', JSON.stringify(['tower', -368, -256, 0])), false, 'afCommand build on wall must return false');

  const countBefore = game.buildings.filter(b => b.type === 'tower').length;
  assert.equal(countBefore, 5, 'Five watchtowers must be built');

  // Trigger extendPerimeter (simulating perimeter rebuild)
  const oldLand = [...game.land];
  game.extendPerimeter(oldLand);

  const countAfter = game.buildings.filter(b => b.type === 'tower').length;
  assert.equal(countAfter, 5, 'Inside watchtowers must NOT be dismantled by extendPerimeter');

  // Buy adjacent land parcel; all corner towers must remain intact
  assert.ok(afCommand('buyLand', JSON.stringify([0, -2])));
  const countAfterBuy = game.buildings.filter(b => b.type === 'tower').length;
  assert.equal(countAfterBuy, 5, 'Inside watchtowers must remain intact after land expansion');

  // Verify ghost art files exist in Resources/UI for catalog buildings
  const ghostTypes = ['town_hall', 'bunkhouse', 'farm', 'workshop', 'clinic', 'barracks', 'tower', 'wall', 'shelter', 'lumber_mill', 'storage', 'lab', 'armory'];
  for (const t of ghostTypes) {
    assert.ok(fs.existsSync(new URL(`../Assets/Afterlife/Resources/UI/ghost_${t}_ok.png`, import.meta.url)), `ghost_${t}_ok.png must exist`);
    assert.ok(fs.existsSync(new URL(`../Assets/Afterlife/Resources/UI/ghost_${t}_bad.png`, import.meta.url)), `ghost_${t}_bad.png must exist`);
  }
});

test('Admin command tool suite: add wood, unlock all, free building, instant spawners, godmode and repair', () => {
  // Reset as fresh starter camp
  assert.ok(afCommand('reset', '[]'));
  game.resources.wood = 0;

  // 1. devAddWood
  assert.ok(afCommand('devAddWood', JSON.stringify([500])));
  assert.equal(game.resources.wood, 500);
  assert.ok(afCommand('devAddWood', JSON.stringify([-200])));
  assert.equal(game.resources.wood, 300);

  // 2. devUnlockAll: in a campaign, every campaign structure.
  game.initTasks();
  assert.equal(game.isUnlocked('garden_plot'), false);
  assert.ok(afCommand('devUnlockAll', '[]'));
  assert.equal(game.isUnlocked('garden_plot'), true);
  assert.equal(game.isUnlocked('makeshift_shelter'), true);
  assert.equal(game.isUnlocked('lookout_post'), true);

  // 3. devSetFreeBuild
  // Reset back to camp without unlocks or wood
  assert.ok(afCommand('reset', '[]'));
  game.initTasks();
  game.resources.wood = 0;
  assert.equal(game.isUnlocked('makeshift_shelter'), false);
  // Before free build, shelter placement fails because locked & afford check
  const pLocked = JSON.parse(afPlacement('makeshift_shelter', 0, 112, 0));
  assert.equal(pLocked.ok, false);

  // Enable Free Build
  assert.ok(afCommand('devSetFreeBuild', JSON.stringify([true])));
  const pFree = JSON.parse(afPlacement('makeshift_shelter', 0, 112, 0));
  assert.ok(pFree.ok, 'Free build should permit building locked structures without cost');
  assert.ok(afCommand('build', JSON.stringify(['makeshift_shelter', pFree.x, pFree.y, 0])));
  assert.equal(game.resources.wood, 0, 'Free build should not deduct supplies');
  assert.ok(game.buildings.some(b => b.type === 'makeshift_shelter'));

  // 4. Instant spawn survivors
  const survivorCountBefore = game.survivors.length;
  assert.ok(afCommand('spawnSurvivor', JSON.stringify(['guard', 20, 20])));
  assert.equal(game.survivors.length, survivorCountBefore + 1);
  const newGuard = game.survivors[game.survivors.length - 1];
  assert.equal(newGuard.role, 'guard');
  assert.equal(newGuard.x, 20);
  assert.equal(newGuard.y, 20);
  assert.ok(newGuard.hp > 0);

  // 5. Instant spawn zombies
  const zombieCountBefore = game.zombies.length;
  assert.ok(afCommand('spawnZombie', JSON.stringify(['brute', 0])));
  assert.equal(game.zombies.length, zombieCountBefore + 1);
  const brute = game.zombies[game.zombies.length - 1];
  assert.equal(brute.kind, 'brute');
  assert.ok(afCommand('spawnZombieAt', JSON.stringify(['bloater', 50, 50])));
  const bloater = game.zombies[game.zombies.length - 1];
  assert.equal(bloater.kind, 'bloater');
  assert.equal(bloater.x, 50);

  // 6. Free Repair All
  const shelter = game.buildings.find(b => b.type === 'makeshift_shelter');
  shelter.hp = 10;
  assert.ok(afCommand('devRepairAllFree', '[]'));
  assert.equal(shelter.hp, 500, 'a campaign Makeshift Shelter has 500 integrity');

  // 7. Heal All Survivors
  newGuard.hp = 5;
  newGuard.condition = 'injured';
  assert.ok(afCommand('devHealAllSurvivors', '[]'));
  assert.equal(newGuard.condition, 'healthy');
  assert.ok(newGuard.hp > 30);

  // 8. Godmode
  assert.ok(afCommand('devSetGodmode', JSON.stringify([true])));
  assert.equal(game.godmode, true);

  // 9. Time & Day
  assert.ok(afCommand('devSetTime', JSON.stringify([14])));
  assert.equal(Math.floor(game.hour), 14);
  const dayBefore = game.day;
  assert.ok(afCommand('devAdvanceDay', '[]'));
  assert.equal(game.day, dayBefore + 1);

  // 10. Claim all land
  const landBefore = game.land.length;
  assert.ok(afCommand('devClaimAllLand', '[]'));
  assert.ok(game.land.length > landBefore);
});

