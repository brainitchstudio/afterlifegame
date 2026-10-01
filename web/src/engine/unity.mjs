// Unity boundary only. All gameplay decisions remain in the original Game subsystems.
import { Game, BUILDINGS, BUILDING_TREES, EXPEDITIONS, buildingMaxHP, survivorStats, boundsOf, jobOf, postSlots } from './model.mjs';
import { ROLE_FOR, ROLES, JOBS, shiftLabel, describeTrade, amountsText, HOUR_SECONDS as HOUR } from './data.mjs';
import { CAMPAIGN, campaignBuilding, campaignIdOf, MARA, fill } from './campaignState.mjs';
import { CAMPAIGN_CATALOG } from './campWork.mjs';
import { TASKS, TASK_BY_ID } from './tasks.mjs';
import { GUARD_ROUTES } from './defense.mjs';
import { campaignJob, laborFactor, quality, fatigueFactor, campaignMaxHp } from './crew.mjs';
import { WEAPONS } from './survivors.mjs';
import { parcelRect, parcelAt } from './land.mjs';
import { groundKey, overlayKeys } from './worldgen.mjs';
import { CAMP } from './camp.mjs';
import { QUESTS, QUEST_UNLOCKS, QUEST_BY_ID, RANKS, MAX_RANK } from './progression.mjs';
export const game = new Game();
const cost = c => amountsText(c) || 'Free';
const outfit = s => ({guard:['guard','ranger'],medic:['doctor','nurse'],engineer:['mechanic','engineer'],farmer:['elder','grower'],scavenger:['hunter','scavenger']}[jobOf(s)] || ['guard','ranger'])[s.look%2];
const material = b => b.upgrades.includes('plate') ? 'scrap' : b.upgrades.includes('reinforce') ? 'planks' : 'palisade';
// The starter camp's fixtures are drawn with the kit's decor art (camp/* keys resolve to it in the view).
const CAMP_SPRITES = {
  campfire: 'camp/fire', tent: 'camp/tent', cache: 'camp/cache',
  ...Object.fromEntries(['supply_stash', 'garden_plot', 'field_workbench', 'aid_station', 'lookout_post', 'guard_post', 'radio_kit', 'makeshift_shelter', 'salvage_pile', 'operations_board', 'salvage_yard', 'storage_depot', 'field_farm', 'field_clinic', 'watchtower', 'reinforced_shelter', 'radio_relay'].map(t => [t, 'camp/' + t])),
};
export function buildingSprite(b) {
  if(CAMP_SPRITES[b.type]) return CAMP_SPRITES[b.type];
  if(b.type==='barricade') return `plots/barricade/${material(b)}/${b.rotation?1:0}`;
  if(b.type==='gate') {
    const open = b.gateOpen || game.survivors.some(s=>!s.sheltered&&s.condition!=='downed'&&!s.expedition&&Math.hypot(s.x-b.x,s.y-b.y)<36);
    const base = `plots/gate/${material(b)}/${b.rotation?1:0}/${open?1:0}`;
    return b.rotation && open ? `${base}/${b.x<0?'w':'e'}` : base;
  }
  const doorF = b.doorFrame != null ? Math.min(3, Math.max(0, Math.round(b.doorFrame))) : 0;
  const level = b.upgrades.length >= 2 ? 1 : 0;
  return doorF > 0 ? `plots/${b.type}/${level}/${doorF}` : `plots/${b.type}/${level}`;
}
const entity = (e, kind) => ({id:e.id,kind,type:e.type||e.kind||'',name:e.name||BUILDINGS[e.type]?.name||e.kind,x:e.perch?.x??e.x,y:e.perch?.y??e.y,groundY:e.y,hp:e.hp,maxHP:kind==='building'?buildingMaxHP(e):kind==='survivor'?survivorStats(e,game.postOf(e)).hp:e.maxHP,
  sprite:kind==='building'?buildingSprite(e):`${kind==='survivor'?'survivors':'zombies'}/${kind==='survivor'?outfit(e):e.kind==='walker'&&e.id%7===0?'soldier':e.kind}`,
  width:kind==='building'?boundsOf(e).right-boundsOf(e).left:24,height:kind==='building'?boundsOf(e).bottom-boundsOf(e).top:28,
  facing:e.facing||1,hidden:!!(e.sheltered||(e.expedition&&!game.map)),away:!!e.expedition,stationed:!!e.perch,downed:e.condition==='downed',fighting:!!(e.fighting||(kind==='zombie'&&(game.elapsed-Math.max(e.bashing??-1e9,e.attacking??-1e9)<0.35))),
  role:e.role||'',task:e.expedition?`${e.expedition.phase?e.task:(EXPEDITIONS[e.expedition.kind]?.name||e.expedition.kind)} · ${(e.expedition.remaining/42).toFixed(1)}h`:e.task||'',condition:e.condition||'',gear:e.gear||'fists',level:e.level||0,campaignJob:kind==='survivor'&&e.model==='campaign'?CAMPAIGN.jobs[campaignJob(e)].name:'',targetId:e.order?.zombieId??-1,side:e.side||'any',
  shift:e.shift??-1,post:e.post??-1,blueprint:!!e.blueprint,burning:!!e.burning,doorFrame:e.doorFrame!=null?Math.min(3,Math.max(0,Math.round(e.doorFrame))):0});
// `reset` begins a new run, which is always a starter camp, even after a refuge save was loaded.
const commands = {
  build:(type,x,y,r)=>game.build(type,x,y,r), upgradeBuilding:(id,node)=>game.upgradeBuilding(id,node),repair:id=>game.repair(id),repairAll:()=>game.repairAll(),demolish:id=>game.demolish(id),
  devGrantResource:(type,amount)=>{if(!game.ledgerResources.includes(type)||!Number.isFinite(amount)||amount<=0)return false;game.deposit(type,amount,true);return true;},
  buyLand:(col,row)=>game.buyLand(col,row),assign:(id,side)=>{game.post(id,null);return game.assign(id,side);},post:(id,b)=>game.post(id,b),
  assignShift:(id,towerId,shiftIndex)=>{const s=game.survivors.find(x=>x.id===id),tower=game.buildings.find(b=>b.id===towerId&&b.type==='tower');if(!s||!tower||s.expedition)return false;if(s.post!==tower.id&&!game.post(id,tower.id))return false;const other=game.staffOf(tower).find(o=>o.id!==s.id&&o.shift===shiftIndex);if(other)other.shift=s.shift;s.shift=shiftIndex;return true;},
  equipWeapon:(id,type)=>{const s=game.survivors.find(x=>x.id===id);if(!s||s.expedition||s.condition==='downed')return false;const item=game.items.find(i=>i.type===type&&i.holder==null);if(item){game.equip(s,item);return true;}return false;},
  orderShelter:id=>game.orderShelter(id),clearShelter:()=>game.clearShelter(),recruit:()=>game.recruit(),acceptCandidate:id=>game.acceptCandidate(id),declineCandidate:id=>game.declineCandidate(id),
  fabricate:type=>game.fabricate(type),trade:()=>game.trade(),dismissTrader:()=>game.dismissTrader(),raiseAlarm:()=>game.raiseAlarm(),clearAlarm:()=>game.clearAlarm(),
  orderAttack:id=>{const r=game.orderAttack(id);return r&&r.ok!==false;},cancelAttack:id=>game.cancelAttack(id),sendExpedition:(ids,kind)=>game.sendExpedition(ids,kind),reset:()=>{game.start='camp';game.mode='campaign';game.reset();resetDelta();return true;},
  spawnZombie:(kind,side)=>{const z=game.spawnZombie(side??Math.floor(game.random()*4));if(kind&&['walker','runner','brute','soldier','bloater'].includes(kind)){z.kind=kind;if(kind==='brute'){z.maxHP=z.hp=z.maxHP*2.4;z.speed*=0.7;z.damage*=2;}else if(kind==='runner'){z.speed*=1.8;}}return true;},
  spawnZombieAt:(kind,x,y)=>{const z=game.spawnZombie(0);z.x=x;z.y=y;if(kind&&['walker','runner','brute','soldier','bloater'].includes(kind)){z.kind=kind;if(kind==='brute'){z.maxHP=z.hp=z.maxHP*2.4;z.speed*=0.7;z.damage*=2;}else if(kind==='runner'){z.speed*=1.8;}}return true;},
  triggerIncursion:()=>{game.announceIncursion();return true;},
  killAllZombies:()=>{for(const z of game.zombies)game.hit(z,z.hp+1000);game.zombies=game.zombies.filter(z=>z.hp>0);return true;},
  generateWorld:(size,seed,options)=>{const r=game.generateWorld(size,seed,options);resetDelta();return !!r;},
  loadSurvMap:json=>{const r=game.loadSurvMap(json);resetDelta();return !!r;},
  loadOutpostMap:()=>{const r=game.loadOutpostMap();resetDelta();return !!r;},
  setSeason:season=>{game.seasonOverride=season;game.landRevision=(game.landRevision||0)+1;return true;},
  setDifficulty:value=>game.setDifficulty(value),
  harvest:treeId=>game.toggleHarvest(String(treeId)),readMessages:ids=>game.readMessages(Array.isArray(ids)?ids:null),
  devAddWood:amount=>{if(!Number.isFinite(amount))return false;game.resources.wood=Math.max(0,game.resources.wood+amount);game.notify('Wood added',`${amount>=0?'+':''}${amount} wood. Total: ${Math.round(game.resources.wood)}`,'good');return true;},
  devUnlockAll:()=>game.unlockAll(),
  devSetFreeBuild:enabled=>game.setFreeBuild(enabled),
  spawnSurvivor:(role,x,y)=>!!game.instantSpawnSurvivor(role,x,y),
  devClaimAllLand:()=>game.claimAllLand(),
  devRepairAllFree:()=>game.repairAllFree(),
  devHealAllSurvivors:()=>game.healAllSurvivors(),
  devSetGodmode:enabled=>game.setGodmode(enabled),
  devSetTime:hour=>game.setTime(hour),
  gatherDebris:id=>game.toggleGather(id),queueCraft:(id,recipe)=>game.queueCraft(id,recipe),cancelCraft:(id,index)=>game.cancelCraft(id,index),campaignInteraction:id=>{game.recordInteraction(id);return true;},
  broadcast:()=>game.broadcast(),setGuardStance:(id,stance)=>game.setGuardStance(id,stance),setGuardRoute:(id,route)=>game.setGuardRoute(id,route),
  launchMission:(site,ids)=>!!game.launchMission(site,ids),chooseEncounter:id=>game.chooseEncounter(id),inviteContact:id=>game.inviteContact(id),recallMission:()=>game.recallMission(),reviewReport:()=>game.reviewReport(),
  shelterAll:()=>game.shelterAll(),sealShelter:()=>game.sealShelter(),releaseShelter:force=>game.releaseShelter(!!force),acceptSideTask:id=>game.acceptSideTask(id),beginPhase2:()=>game.beginPhase2(),
  toggleIsolation:id=>{const b=game.buildings.find(b=>b.id===id&&['aid_station','field_clinic'].includes(campaignIdOf(b.type)));if(!b)return false;b.isolate=!b.isolate;return true;},
  devAdvanceDay:()=>game.advanceDay(),
  devSpawnHorde:(count,kind)=>game.spawnHorde(count,kind)
};
globalThis.afCommand = (name,json) => { if(!Object.hasOwn(commands,name)) throw new Error('Unknown Unity command: '+name); return !!commands[name](...JSON.parse(json)); };
globalThis.afStep = dt => game.step(dt);
globalThis.afBeginWorld = (size, seed, options) => game.beginWorldGeneration(size, seed, options);
// A new campaign: settings { difficulty, mapSize, overseerName, seed (any text; blank for random), world (generator options) }.
globalThis.afBeginCampaign = json => game.beginCampaign(JSON.parse(json));
globalThis.afAdvanceWorld = () => {
  const progress = game.advanceWorldGeneration();
  if (progress.done) resetDelta();
  return JSON.stringify(progress);
};
globalThis.afSave = () => game.serialize();
globalThis.afDebrisHint = id => game.debrisHint(id);
globalThis.afRestore = json => { resetDelta(); return game.restore(json); };
globalThis.afRestoreError = json => game.restoreError(json);
globalThis.afBounds = (x,y) => { if (game.map) game.bounds = { ...game.bounds, x, y }; else game.bounds = {x,y}; };
globalThis.afFrame = () => JSON.stringify({elapsed:game.elapsed,day:game.day,hour:game.hour,phase:game.phase.name,status:game.status,season:game.season,wood:game.resources.wood,scrap_metal:game.resources.scrap_metal,food:game.resources.food,capacity:game.capacity,kills:game.kills,alarm:game.alarm.raised,landRevision:game.landRevision,
  territory:game.territory,entities:[...game.buildings.map(e=>entity(e,'building')),...game.survivors.map(e=>entity(e,'survivor')),...game.zombies.map(e=>entity(e,'zombie'))],effects:game.effects,
  incoming:game.incoming?`${['NORTH','EAST','SOUTH','WEST'][game.incoming.side]} INCURSION · ${Math.ceil(game.incoming.eta)}s`:'',director:game.director.state,
  scavengedPois:(game.worldPois||[]).filter(p=>p.scavenged).map(p=>p.id),harvest:game.harvestView(),freeBuild:!!game.freeBuild,godmode:!!game.godmode});

let deltaKnownIds = new Set();
let deltaMetaCache = new Map();
export function resetDelta() { deltaKnownIds.clear(); deltaMetaCache.clear(); }
globalThis.afResetDelta = resetDelta;

function entityMetaKey(e, kind) {
  if (kind === 'building') return `${buildingSprite(e)}|${buildingMaxHP(e)}|${e.rotation?1:0}|${e.blueprint?1:0}`;
  if (kind === 'survivor') {
    const post = game.postOf(e);
    const taskKey = e.expedition ? e.expedition.kind : (e.task || '');
    return `${outfit(e)}|${survivorStats(e, post).hp}|${e.role||''}|${taskKey}|${e.condition||''}|${e.gear||'fists'}|${e.level||0}|${e.side||'any'}|${e.shift??-1}|${e.post??-1}|${e.name}`;
  }
  return `${e.kind}|${e.maxHP}`;
}

globalThis.afDeltaFrame = () => {
  const currentIds = new Set();
  const added = [];
  const u = [];
  const all = [
    ...game.buildings.map(e => [e, 'building']),
    ...game.survivors.map(e => [e, 'survivor']),
    ...game.zombies.map(e => [e, 'zombie'])
  ];

  for (let i = 0; i < all.length; i++) {
    const [e, kind] = all[i];
    currentIds.add(e.id);
    const meta = entityMetaKey(e, kind);
    if (!deltaKnownIds.has(e.id) || deltaMetaCache.get(e.id) !== meta) {
      deltaKnownIds.add(e.id);
      deltaMetaCache.set(e.id, meta);
      added.push(entity(e, kind));
    }
    const x = e.perch?.x ?? e.x;
    const y = e.perch?.y ?? e.y;
    const fighting = !!(e.fighting || (kind === 'zombie' && (game.elapsed - Math.max(e.bashing ?? -1e9, e.attacking ?? -1e9) < 0.35)));
    const hidden = !!(e.sheltered || (e.expedition && !game.map));
    const stationed = !!e.perch;
    const downed = e.condition === 'downed';
    const flags = (e.facing < 0 ? 1 : 0) | (fighting ? 2 : 0) | (downed ? 4 : 0) | (hidden ? 8 : 0) | (stationed ? 16 : 0) | (e.expedition ? 32 : 0);
    const targetId = e.order?.zombieId ?? -1;
    u.push(e.id, Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(e.hp * 10) / 10, flags, targetId);
  }

  const removed = [];
  for (const id of deltaKnownIds) {
    if (!currentIds.has(id)) removed.push(id);
  }
  for (let i = 0; i < removed.length; i++) {
    deltaKnownIds.delete(removed[i]);
    deltaMetaCache.delete(removed[i]);
  }

  return JSON.stringify({
    elapsed: game.elapsed, day: game.day, hour: game.hour, phase: game.phase.name, status: game.status, season: game.season,
    wood: game.resources.wood, scrap_metal: game.resources.scrap_metal, food: game.resources.food,
    capacity: game.capacity, kills: game.kills, alarm: game.alarm.raised, landRevision: game.landRevision,
    territory: game.territory, effects: game.effects,
    incoming: game.incoming ? `${['NORTH','EAST','SOUTH','WEST'][game.incoming.side]} INCURSION · ${Math.ceil(game.incoming.eta)}s` : '',
    director: game.director.state,
    scavengedPois: (game.worldPois || []).filter(p => p.scavenged).map(p => p.id),
    harvest: game.harvestView(),
    freeBuild: !!game.freeBuild,
    godmode: !!game.godmode,
    removed, added, u
  });
};
globalThis.afTerrain = () => {
  const trees = game.forest.trees;
  const map = game.map;
  let ground = null, over = null;
  if (map && map.terr?.length === map.w * map.h) {
    // A refuge's claimed parcels are cleared dirt; roads run on through them. A camp keeps the
    // generated clearing, grass and all.
    const o = game.start === 'refuge' && game.worldOrigin, terr = o ? map.terr.map((t, i) => t !== 'r' && game.claimed(((i % map.w) - o.bcx) * 16 + 8, (Math.floor(i / map.w) - o.bcy) * 16 + 8, 0) ? 'd' : t) : map.terr;
    const view = { ...map, terr };
    ground = Array.from({ length: map.w * map.h }, (_, i) => groundKey(view, i % map.w, Math.floor(i / map.w)));
    // Grass blending over forest floor, rocky ground, swamp, fields and rubble.
    over = Array.from({ length: map.w * map.h }, (_, i) => overlayKeys(view, i % map.w, Math.floor(i / map.w)));
  }
  return JSON.stringify({
    land: game.land,
    trees,
    // Changes when a camp clears trees off its land, so the view redraws them.
    treeKey: game.cleared?.length || 0,
    frontier: game.availableLand(),
    // A campaign's regional sites are on the SeerPad's Regional Intel; the legacy expedition badges stay off its map.
    pois: game.campaign ? [] : game.worldPois || [],
    // A campaign's debris piles are drawn with the props; each is gone once emptied.
    decor: [...game.visibleDecor, ...(game.debris||[]).map(d=>({key:d.key,x:d.x,y:d.y,anchor:'bottom',order:d.y-2,debris:d.id}))],
    // The camp's wood pile and the odds and ends around its fire.
    camp: game.woodPile ? [{ key: 'decor/deco_logs', x: CAMP.pile.x, y: CAMP.pile.y, pile: true }, ...CAMP.props.map(p => ({ key: 'decor/' + p.key, x: p.x, y: p.y }))] : [],
    worldBuildings: game.visibleWorldBuildings,
    ground,
    over,
    season: game.season,
    mapWidth: game.map ? game.map.w : 0,
    mapHeight: game.map ? game.map.h : 0,
    originX: game.worldOrigin ? game.worldOrigin.bcx * 16 : 0,
    originY: game.worldOrigin ? game.worldOrigin.bcy * 16 : 0
  });
};
globalThis.afHud = () => JSON.stringify({tablet:tabletSummary(),ledger:game.ledgerSummary(),campaign:campaignSummary(),autosave:takeAutosave(),unlockKey:Object.keys(game.unlocked).join(',')+'|'+(game.campaign?.unlocks?.buildings||[]).join(',')+'|'+!!game.freeBuild,storage:game.storage,warnings:game.warnings(),events:game.events.splice(0),rates:game.rates(),freeBeds:game.freeBeds,recruitCost:cost(game.recruitCost),broadcasting:game.broadcasting,recruitTimer:game.recruitTimer,landCost:cost(game.landCost),repairAllCost:cost(game.repairAllCost()),sheltered:!!game.shelterOrder,partyCap:game.partyCap,
  candidates:game.candidates.map(c=>({id:c.id,name:c.name,label:c.label||c.source,stats:statsText(c),expires:(c.expiresAt-game.elapsed)/42})),
  trader:game.trader?describeTrade(game.trader):'',tradeEnabled:!!game.trader&&game.afford(game.trader.give),
  weapons:Object.entries(WEAPONS).filter(([,w])=>w.cost).map(([id,w])=>({id,name:w.name,cost:cost(w.cost),count:game.items.filter(i=>i.type===id).length,enabled:game.afford(w.cost)&&game.buildings.some(b=>b.type==='workshop')}))});
// A campaign structure's one-line output for the inspector.
function campaignOutput(b,def,staff) {
  if (b.blueprint) { const n=game.survivors.filter(s=>s.camp?.kind==='build'&&s.camp.id===b.id).length; return `Blueprint ${Math.floor(b.blueprint.progress*100)}% · ${n?n+' building':'waiting for a builder'}`; }
  const id=campaignIdOf(b.type);
  if (id==='garden_plot'||id==='field_farm') { const c=game.cropLanes(b)[0], need=c.first?CAMPAIGN.tuning.farming.firstCropHours:CAMPAIGN.tuning.farming.batchHours; return `${staff.length?staff.map(s=>s.name).join(', ')+' tending':'No Farmer'} · ${c.first?'first crop':'next batch'} ${c.labor.toFixed(1)}/${need}h`; }
  if (def.capacity?.storage) return `Storage ${def.capacity.storage} · camp holds ${Math.round(game.storedWeight)}/${game.storageCapacity}`;
  if (b.queue) return b.queue.length?`${CAMPAIGN.recipes[b.queue[0].recipe].name} ${Math.floor(b.queue[0].progress*100)}% · ${b.queue.length} queued`:'Queue empty';
  return '';
}
// A campaign structure's own panel: blueprint progress and builders, the crop, the craft queue and its recipes.
function campaignBuildingView(b,def,staff) {
  const id=campaignIdOf(b.type), builders=game.survivors.filter(s=>s.camp?.kind==='build'&&s.camp.id===b.id).map(s=>s.name);
  const recipes=Object.entries(CAMPAIGN.recipes).filter(([,r])=>r.station===id).map(([rid,r])=>({id:rid,code:r.code,name:r.name,inputs:cost(r.inputs),laborHours:r.laborHours,
    unlocked:game.freeBuild||game.taskUnlocked('recipes',rid),enabled:!b.blueprint&&(game.freeBuild||game.taskUnlocked('recipes',rid))&&game.afford(r.inputs)&&(b.queue?.length||0)<(def.queueCapacity||10)&&game.recipeReady(r)&&game.itemsAvailable(r),ready:game.recipeReady(r),
    itemInputs:Object.entries(r.itemInputs||{}).map(([t,n])=>`${n} ${WEAPONS[t]?.name||t}`).join(', '),componentWarning:game.componentWarning(r),
    warning:game.componentWarning(r)!=null?fill(CAMPAIGN.strings.component_reserve_warning,{components:game.componentWarning(r)}):''}));
  return {
    code:def.code,phase:def.phase,laborHours:def.laborHours,workers:def.workerSlots,job:def.job?CAMPAIGN.jobs[def.job].name:'',
    blueprint:b.blueprint?{progress:b.blueprint.progress,builders}:null,
    lanes:(id==='garden_plot'||id==='field_farm')&&!b.blueprint?game.cropLanes(b).map((l,i)=>({labor:l.labor,first:l.first,farmer:game.staffOf(b).sort((p,q)=>p.id-q.id)[i]?.name||'',need:l.first?CAMPAIGN.tuning.farming.firstCropHours:CAMPAIGN.tuning.farming.batchHours})):null,
    queue:recipes.length?(b.queue||[]).map((e,i)=>({index:i,name:CAMPAIGN.recipes[e.recipe].name,progress:e.progress})):null,queueCapacity:def.queueCapacity||0,recipes,
    medical:['aid_station','field_clinic'].includes(id)&&!b.blueprint?(()=>{const ps=game.bedOccupants(b);return {beds:game.bedCount(b),patients:ps.map(p=>({id:p.id,name:p.name,hp:p.hp,maxHp:campaignMaxHp(p),bleeding:!!p.bleeding,infection:p.infection||0,arriving:p.care==='seek'})),isolate:!!b.isolate,supplyHours:Math.max(0,b.supplyCredit||0),supplies:game.available('medical_supplies'),bandages:game.campaign.stock.bandage,rate:id==='field_clinic'?12:8};})():null,
    guards:id==='guard_post'&&!b.blueprint?staff.map(guardView):null,routes:GUARD_ROUTES,
    watch:['lookout_post','watchtower'].includes(id)&&!b.blueprint?{radius:def.detectionRadius,watcher:staff[0]?.name||'',onWatch:staff.some(s=>s.stationed&&s.towerId===b.id)}:null,
    radio:id==='radio_kit'&&!b.blueprint?radioView():null,
  };
}
// The Operations Board: the regional sites, the team out (if any), who could go and the return reports.
function operationsView(){
  const c=game.campaign, m=game.mission, name=id=>CAMPAIGN.sites[id]?.name||id, amt=a=>Object.entries(a||{}).filter(([,n])=>n>0).map(([r,n])=>`${Math.floor(n)} ${CAMPAIGN.resources[r]?.name||r}`).join(', ');
  const team=m?m.team.map(id=>game.survivors.find(s=>s.id===id)).filter(Boolean):[];
  const eta=m?(m.phase==='outbound'?m.oneWay*2+m.siteHours+m.delay:m.phase==='site'?m.oneWay+m.siteHours+m.delay-m.siteWork:m.oneWay)-(m.phase==='outbound'?(game.elapsed-m.launchedAt)/HOUR:0):null;
  return {board:!!game.operationsBoard,unlocked:c.unlocks.modules.includes('operations'),teamSize:CAMPAIGN.tuning.operations.scavengeTeam,
    mission:m?{site:m.site,name:name(m.site),phase:m.phase,team:team.map(s=>({id:s.id,name:s.name,hp:Math.round(s.hp),downed:s.condition==='downed'})),progress:m.phase==='site'?m.siteWork/(m.siteHours+m.delay):null,etaHours:Math.max(0,eta),capacity:m.capacity,cargo:amt(m.cargo),event:m.event,safe:m.safe}:null,
    sites:Object.entries(CAMPAIGN.sites).map(([id,d])=>{const r=game.siteRecord(id),st=game.siteState(id),e=d.expedition&&CAMPAIGN.expeditions[d.expedition];return {id,name:e?`${e.code} · ${e.name}`:d.name,kind:d.kind,description:e?e.briefing:d.description,open:game.siteOpen(id),revealed:!!r?.revealed,
      walkTiles:r?.walkTiles||0,oneWay:game.oneWayHours(id),siteHours:game.siteWorkHours(id),stock:e?'':amt(st.stock),returns:st.returns,recurring:!!d.recurring,cooldownHours:st.cooldownUntil!=null?Math.max(0,(st.cooldownUntil-game.elapsed)/HOUR):null,
      block:game.siteBlock(id),safe:game.tutorialSafe(id),baseRisk:d.baseEventChance||0,teamSize:game.teamSize(id),
      expedition:e?{code:e.code,objective:e.objective,provisions:[amt(e.provisions),...Object.entries(e.itemProvisions||{}).map(([k,n])=>`${n} ${CAMPAIGN.items[k]?.name||k}`)].filter(Boolean).join(', '),recovery:d.expedition==='e03'&&game.batteryRecovery(),done:game.expeditionDone(d.expedition)}:null};}),
    residents:game.survivors.filter(s=>s.model==='campaign').map(s=>({id:s.id,name:s.name,job:CAMPAIGN.jobs[campaignJob(s)].name,str:s.stats.str,agi:s.stats.agi,int:s.stats.int,hp:Math.round(s.hp),fatigue:Math.round(s.fatigue),block:game.eligibility(s),posted:s.post!=null})),
    reports:c.operations.reports.map(r=>({...r,name:name(r.site),cargo:amt(r.cargo),when:game.stampAt(r.at)}))};
}
// What a team for a site would mean: the blocker, rations, carry capacity, event risk and hours away.
globalThis.afMission = (site,json) => {
  const ids=JSON.parse(json), team=ids.map(id=>game.survivors.find(s=>s.id===id)).filter(Boolean);
  if(!game.campaign||!CAMPAIGN.sites[site]) return JSON.stringify({block:'Unknown site'});
  const oneWay=game.oneWayHours(site), hours=game.siteHours(site,team);
  return JSON.stringify({block:game.missionBlock(site,ids),rations:game.rationsFor(site,team),capacity:game.carryCapacity(team),risk:team.length?game.eventChance(site,team):null,hours:oneWay*2+hours,oneWay,siteHours:hours,
    posted:team.filter(s=>s.post!=null).map(s=>s.name)});
};
// Emergency shelter: who is inside, entering, on the way or left outside.
function shelterView(){
  const c=game.campaign, inShelter=s=>s.shelter!=null&&game.shelters.some(b=>b.id===s.shelter), pop=game.atHome;
  return {releaseWarning:CAMPAIGN.strings.ui_release_early,unlocked:game.freeBuild||game.taskUnlocked('commands','shelter_all'),capacity:game.emergencyShelterCapacity,population:pop.length,shelters:game.shelters.length,active:!!c.shelter,sealed:!!c.shelter?.sealed,
    inside:pop.filter(s=>inShelter(s)&&s.sheltered).map(s=>s.name),entering:pop.filter(s=>inShelter(s)&&!s.sheltered).map(s=>s.name),
    outside:c.shelter?pop.filter(s=>!inShelter(s)).map(s=>s.name):[],away:game.survivors.filter(s=>s.expedition).map(s=>s.name)};
}
function migrationView(){
  const m=game.campaign.migration;
  if(m.state==='none') return null;
  return {state:m.state,kind:m.kind,total:m.total,spawned:m.spawned,onMap:game.zombies.filter(z=>z.migrant&&z.hp>0).length,
    etaHours:m.state==='warning'?Math.max(0,(m.arriveAt-game.elapsed)/HOUR):null,
    clearInHours:m.state==='clearing'&&!game.zombies.some(z=>z.migrant&&z.hp>0)?Math.max(0,CAMPAIGN.tuning.migration.clearHours-(game.elapsed-m.lastContactAt)/HOUR):null,
    shelteredHours:m.hold,cooldownHours:m.cooldownUntil!=null?Math.max(0,(m.cooldownUntil-game.elapsed)/HOUR):null};
}
function guardView(s){return {id:s.id,name:s.name,stance:game.guardStance(s),route:s.guardRoute===1?1:0,gear:WEAPONS[s.gear||'fists'].name,task:s.task||'',onDuty:game.onDuty(s)};}
function radioView(){
  const r=game.campaign.radio, block=game.broadcastBlock();
  return {block,canBroadcast:!block,broadcasting:r.broadcast?r.broadcast.progress:null,operator:game.survivors.find(s=>s.camp?.kind==='radio')?.name||'',waiting:!!r.pending,broadcasts:r.broadcasts,
    cost:CAMPAIGN.tuning.recruitment.broadcastFood,cooldownHours:CAMPAIGN.tuning.recruitment.cooldownHours};
}
// Medicine on a campaign survivor: bleeding, infection and the reanimation clock, care and the downed timer.
function healthView(s){
  return {bleeding:!!s.bleeding,infection:Math.round(s.infection||0),turnIn:s.turnAt!=null?Math.max(0,(s.turnAt-game.elapsed)/HOUR):null,care:s.care||null,
    downedIn:s.condition==='downed'?Math.max(0,s.bleed/HOUR):null,carried:s.carriedBy!=null,maxHp:campaignMaxHp(s)};
}
// A campaign survivor's job, proficiency, traits, fatigue, morale and labor factor; null for a legacy survivor.
function crewSummary(s) {
  if (s.model!=='campaign') return null;
  const job=campaignJob(s), def=CAMPAIGN.jobs[job], prof=s.proficiency[job]||0, category=def.workCategory;
  return {
    job,jobName:def.name,workCategory:category,attribute:category?CAMPAIGN.tuning.labor.attributeFor[category]:def.attribute,
    proficiency:prof,proficiencyMax:CAMPAIGN.tuning.labor.proficiencyMax,proficiencyHours:s.laborHours[job]||0,hoursPerPoint:CAMPAIGN.tuning.labor.proficiencyHoursPerPoint,
    laborFactor:category?laborFactor(s,category):null,fatigue:s.fatigue,fatigueFactor:fatigueFactor(s.fatigue),morale:s.morale,exhausted:!!s.exhausted,quality:quality(s.stats),
    traits:s.traits.map(id=>({id,name:CAMPAIGN.traits[id].name,type:CAMPAIGN.traits[id].type,effect:CAMPAIGN.traits[id].effect})),
    health:healthView(s),mission:game.onMission(s)?CAMPAIGN.sites[game.mission.site].name:null,
  };
}
// What Regional Intelligence knows: the region code, the sites revealed so far, local debris, the camp's
// reserved ground, its protected perimeter and the migration corridor. Null outside a campaign.
function regionSummary() {
  const r=game.campaign?.region;
  if(!r) return null;
  return {
    id:r.id,seed:r.seed,mapSize:r.mapSize,fallback:!!r.fallback,protectedRadius:r.protectedRadius,localRadius:r.localRadius,
    sites:r.sites.filter(s=>s.revealed).map(s=>({id:s.id,name:CAMPAIGN.sites[s.id].name,kind:CAMPAIGN.sites[s.id].kind,description:CAMPAIGN.sites[s.id].description,x:s.x,y:s.y,walkTiles:s.walkTiles,poiName:s.poiName})),
    debris:(game.debris||[]).map(d=>({x:d.x,y:d.y,resource:d.resource,stock:d.stock})),
    patches:r.patches.map(p=>({x:p.x-8,y:p.y-8,w:p.w,h:p.h})),corridor:r.corridor?.points||[],
  };
}
// The campaign's state for the HUD; null in a legacy run.
function campaignSummary() {
  const c=game.campaign;
  return c?{phase:c.phase,classification:c.classification,settings:c.settings,workShift:game.workShift,regionId:c.region?.id||'',fallback:!!c.region?.fallback,transition:c.transition,
    shelter:c.shelter?{sealed:c.shelter.sealed}:null,migration:c.migration.state,killed:game.kills,
    encounter:game.encounter?{name:game.encounter.def.name,code:game.encounter.def.code,title:game.encounter.def.encounter.title,text:game.encounter.def.encounter.text,
      team:game.encounter.mission.team.map(id=>game.survivors.find(s=>s.id===id)?.name).filter(Boolean),kits:game.encounter.mission.kits,choices:game.encounter.def.encounter.choices.map(x=>({id:x.id,label:x.label,detail:x.detail}))}:null,
    tokens:{...c.story.tokens},
    phase2:c.transition==='phase2'?{title:CAMPAIGN.strings.phase2_transition_title,body:fill(TASK_BY_ID.p1_10.copy.completionText,game.taskVars).replace(CAMPAIGN.strings.phase2_transition_title+'.','').trim(),mara:fill(TASK_BY_ID.p1_10.copy.maraCopy||'',game.taskVars),risk:CAMPAIGN.strings.ui_phase2_risk,button:CAMPAIGN.strings.phase2_begin}:null,
    loss:game.status==='lost'?{title:CAMPAIGN.strings.loss_title,body:fill(CAMPAIGN.strings.loss_body,{regionId:c.region?.id||''}),mara:CAMPAIGN.strings.loss_mara}:null}:null;
}
// A save the simulation asked for (deployment, task completion, ...), handed to the host once.
function takeAutosave() { const r=game.autosaveReason; game.autosaveReason=null; return r; }
function statsText(s) {return `STR ${s.stats.str}   AGI ${s.stats.agi}   END ${s.stats.end}   INT ${s.stats.int}   CHA ${s.stats.cha}`;}
globalThis.afCatalog = () => JSON.stringify({
  buildings:game.campaign?CAMPAIGN_CATALOG.map(id=>{const d=campaignBuilding(id),t=TASKS.find(t=>t.id===d.unlockedBy);
      return {id,name:d.name,description:d.effect,cost:cost(d.cost),costMap:d.cost,laborHours:d.laborHours,sprite:buildingSprite({type:id,upgrades:[],rotation:0}),locked:!game.freeBuild&&!game.isUnlocked(id),unlockedBy:t?t.code+' · '+t.title:''};})
    :Object.entries(BUILDINGS).filter(([k,b])=>k!=='core'&&!b.fixture).map(([id,b])=>({id,name:b.name,description:b.subtitle,cost:cost(b.cost),costMap:b.cost,sprite:buildingSprite({type:id,upgrades:[],rotation:0}),locked:!game.freeBuild&&!game.isUnlocked(id),unlockedBy:QUEST_UNLOCKS[id]?QUEST_BY_ID[QUEST_UNLOCKS[id]].title:''})),
  expeditions:Object.entries(EXPEDITIONS).map(([id,t])=>({id,name:t.name,description:t.description,cost:cost(t.cost),hours:t.hours,reward:cost(t.reward),risk:t.risk})),
  pois:(game.worldPois||[]).map(p=>({id:'poi:'+p.id,name:p.name,description:p.label,x:p.x,y:p.y,type:p.type}))
});
globalThis.afDetails = id => {
 const b=game.buildings.find(e=>e.id===id),s=game.survivors.find(e=>e.id===id),z=game.zombies.find(e=>e.id===id);
 if(b) {
  const role=game.postRole(b), staffed=!!role, slots=game.postCapacity(b), tree=game.campaign?[]:BUILDING_TREES[b.type]||[], def=b.model==='campaign'?campaignBuilding(b.type):null;
  const staff=game.staffOf(b), hp=buildingMaxHP(b);
  let output='';
  if (b.type==='farm') output=(60*.23*(1+(b.upgrades.includes('irrigation')?.5:0)+(b.upgrades.includes('storage')?.25:0)+(b.upgrades.includes('greenhouse')?.75:0)+(b.upgrades.includes('harvest')?.75:0))*(game.night&&!b.upgrades.includes('greenhouse')?.4:1)*game.farmLabor(b)).toFixed(1)+' food / min'+(staff.length?' · '+staff.length+' farmer'+(staff.length>1?'s':''):'');
  else if (b.type==='dorm') output=game.residents(b).length+' / '+game.beds(b)+' beds taken';
  else if (b.type==='workshop') output=(16.2*(1+(b.upgrades.includes('sawbench')?.6:0)+(b.upgrades.includes('machinery')?1:0))).toFixed(1)+' wood · '+(7.2*(1+(b.upgrades.includes('forge')?.7:0)+(b.upgrades.includes('recycling')?1:0))).toFixed(1)+' scrap / min';
  else if (b.type==='barracks') output=staff.length+' guard'+(staff.length!==1?'s':'')+' hunting · +2 beds';
  else if (b.type==='clinic') output=staff.length+' medic'+(staff.length!==1?'s':'')+' · '+game.survivors.filter(p=>p.careAt===b.id&&p.care).length+' patients';
  else if (b.type==='tower') {
    const up=game.survivors.find(s=>s.stationed&&s.towerId===b.id);
    output=up?(up.role==='sentry'?up.name+' on watch · alerting guards':up.name+' on watch'):(staff.length?'Shifts covered: '+staff.length+'/'+slots:'Unmanned · assign sentry');
  }
  else if (b.type==='core') output='Heart of the settlement · If it falls, the run ends';
  else if (b.type==='campfire') output='Heart of the camp · If it goes out, the run ends';
  else if (b.type==='tent') output=game.residents(b).length+' / '+game.beds(b)+' bedroll taken';
  else if (b.type==='cache') output=`${Math.floor(game.resources.wood)} wood · ${Math.floor(game.resources.scrap_metal)} scrap · ${Math.floor(game.resources.food)} food · open your tablet [Tab]`;
  else if (b.type==='gate') output='Opens for survivors'+(b.upgrades.includes('wire')?' · '+(4+(b.upgrades.includes('spikes')?10:0))+' dmg/s':'');
  else if (b.type==='barricade') output=b.upgrades.includes('wire')?(4+(b.upgrades.includes('spikes')?10:0))+' dmg/s':'Blocking hostiles';
  else if (b.type==='shelter') output='Emergency shelter · Capacity: '+game.shelterCapacity(b)+' survivors';
  else if (b.type==='lumber_mill') output=((.35*(1+(b.upgrades.includes('circular_saw')?.4:0)+(b.upgrades.includes('steam_engine')?.7:0))*(game.loggerLabor?game.loggerLabor(b):1))*60).toFixed(1)+' wood / min'+(staff.length?' · '+staff.length+' logger'+(staff.length>1?'s':''):'');
  else if (b.type==='storage') output='Caches supplies · Prevents resource loss in swarms';
  else if (b.type==='lab') output='Synthesizes medicine and incendiary research';
  else if (b.type==='armory') output='Weapon fabrication depot · Reinforces guard combat stats';

  const residentNames=game.residents(b).map(s=>s.name);
  const shelterInside=game.survivors.filter(s=>s.shelter===b.id&&s.sheltered).length;
  const refundWood=Math.floor((BUILDINGS[b.type].cost.wood||0)/2), refundMetal=Math.floor((BUILDINGS[b.type].cost.scrap_metal||0)/2);
  const refund=def?(b.blueprint?game.reservations[b.blueprint.tx]&&Object.fromEntries(Object.entries(game.reservations[b.blueprint.tx].cost).map(([r,n])=>[r,b.blueprint.progress>0?Math.floor(n*(1-.5*b.blueprint.progress)):n])):game.demolitionRefund(def.cost))||{}:{wood:refundWood,scrap_metal:refundMetal};
  if (def) output=campaignOutput(b,def,staff)||output;

  return JSON.stringify({
   kind:'building',id,type:b.type,name:def?.name||BUILDINGS[b.type].name,description:def?.effect||BUILDINGS[b.type].subtitle,campaign:def?campaignBuildingView(b,def,staff):null,
   icon:BUILDINGS[b.type].icon||'',color:BUILDINGS[b.type].color||'#c8d19d',
   tier:b.blueprint?'BLUEPRINT':b.type==='core'||b.type==='campfire'?'ESSENTIAL':BUILDINGS[b.type].fixture?'CAMP':def?'PHASE '+def.phase:'TIER '+(1+Math.floor(b.upgrades.length/2)),
   hp:Math.ceil(b.hp),maxHP:hp,output,
   repairCost:cost(game.repairCost(b)),repairEnabled:!b.blueprint&&b.hp<hp&&game.afford(game.repairCost(b)),
   demolish:b.type!=='core'&&!BUILDINGS[b.type].fixture,demolishLabel:b.blueprint?'Cancel blueprint':'',demolishRefund:cost(refund),
   shelter:game.shelterCapacity(b),shelteredCount:shelterInside,isShelteringHere:game.shelterOrder?.buildingId===b.id,
   beds:game.beds(b),residents:residentNames,slots,staffed,
   roleName:staffed?(def?.job?CAMPAIGN.jobs[def.job].name:ROLES[role].name):'',roleDescription:staffed?(def?.job&&CAMPAIGN.strings['job_'+def.job]||ROLES[role].description):'',
   upgrades:tree.map(n=>{const locked=game.upgradeLock(b.type,n);return {id:n.id,name:n.name,description:n.description,cost:cost(n.cost),requires:n.requires||'',parentName:n.requires?(tree.find(p=>p.id===n.requires)?.name||n.requires):'',owned:b.upgrades.includes(n.id),locked,enabled:!locked&&!b.upgrades.includes(n.id)&&(!n.requires||b.upgrades.includes(n.requires))&&game.afford(n.cost)};}),
   staff:staff.map(s=>({id:s.id,name:s.name,description:b.type==='tower'&&s.shift!=null?shiftLabel(s.shift):(s.task||s.role),level:s.level})),
   assignable:game.survivors.filter(s=>!s.expedition&&s.post!==b.id).map(s=>({id:s.id,name:s.name,description:s.role||'patrol',level:s.level,enabled:staffed&&staff.length<slots})),
   armory:b.type==='workshop'?['pipe','pistol','rifle'].map(type=>({id:type,name:WEAPONS[type].name,cost:cost(WEAPONS[type].cost),count:game.items.filter(i=>i.type===type).length,enabled:game.afford(WEAPONS[type].cost)})):[]
  });
 }
 if(s) {
  const a=game.statsOf(s), currentPost=s.post!=null?game.buildings.find(b=>b.id===s.post):null, jobKey=jobOf(s);
  const targetBuildingType={clinic:'clinic',medic:'clinic',engineer:'workshop',workshop:'workshop',farmer:'farm',farm:'farm',guard:'barracks',barracks:'barracks',sentry:'tower',tower:'tower',logger:'lumber_mill',lumber_mill:'lumber_mill',researcher:'lab',lab:'lab'}[s.role]||(jobKey==='guard'?'barracks':'core');
  const relatedBuilding=currentPost||game.buildings.find(b=>b.type===targetBuildingType);
  const bType=relatedBuilding?relatedBuilding.type:targetBuildingType;
  const tree=BUILDING_TREES[bType]||BUILDING_TREES.core||[];
  const upgrades=tree.map(n=>({
    id:n.id,name:n.name,description:n.description,cost:cost(n.cost),requires:n.requires||'',
    parentName:n.requires?(tree.find(p=>p.id===n.requires)?.name||n.requires):'',
    owned:relatedBuilding?relatedBuilding.upgrades.includes(n.id):false,
    locked:game.upgradeLock(bType,n),
    enabled:relatedBuilding?(!game.upgradeLock(bType,n)&&!relatedBuilding.upgrades.includes(n.id)&&(!n.requires||relatedBuilding.upgrades.includes(n.requires))&&game.afford(n.cost)):false,
    buildingId:relatedBuilding?relatedBuilding.id:-1,buildingType:bType
  }));
  return JSON.stringify({
    kind:'survivor',id,name:s.name,role:s.role||'patrol',roleName:ROLES[s.role]?.name||'Patrol',
    roleDescription:ROLES[s.role]?.description||'',job:jobKey,jobName:JOBS[jobKey]||'Guard',
    condition:s.condition||'healthy',hp:Math.ceil(s.hp),maxHP:Math.ceil(survivorStats(s,currentPost).hp),
    level:s.level||0,xp:Math.floor(s.xp||0),xpNeeded:game.xpNeeded(s),side:s.side||'any',away:!!s.expedition,
    expedition:s.expedition?`${EXPEDITIONS[s.expedition.kind]?.name||'Expedition'} · ${(s.expedition.remaining/42).toFixed(1)}h`:'',
    sheltered:!!s.sheltered,resting:!!s.resting,shift:s.shift!=null?s.shift:-1,shiftName:s.shift!=null?shiftLabel(s.shift):'',
    post:s.post!=null?s.post:-1,postName:currentPost?(BUILDINGS[currentPost.type]?.name+' #'+currentPost.id):'',
    bleed:s.bleed||0,task:s.task||'',gear:s.gear||'fists',weaponName:WEAPONS[s.gear||'fists']?.name||'Bare hands',
    weaponDamage:a.damage,weaponRange:a.range,weaponCooldown:a.cooldown,weaponIsMelee:WEAPONS[s.gear||'fists']?.melee??true,
    str:s.stats.str,agi:s.stats.agi,end:s.stats.end,intel:s.stats.int,cha:s.stats.cha,
    primaryStat:s.aptitudes.primary,secondaryStat:s.aptitudes.secondary,weakStat:s.aptitudes.weak,
    upgrades,buildingId:relatedBuilding?relatedBuilding.id:-1,crew:crewSummary(s),
    description:`${ROLES[s.role].name} · Level ${s.level} · ${s.resting?'Sleeping':s.condition}\n${statsText(s)}\n${WEAPONS[s.gear||'fists'].name} · Damage ${a.damage.toFixed(1)} · Range ${Math.round(a.range)}\n${s.xp.toFixed(0)} / ${game.xpNeeded(s)} XP${s.role==='sentry'?'\nShift: '+shiftLabel(s.shift):''}${s.resting?'\nResting in '+(BUILDINGS[game.buildings.find(b=>b.id===s.restAt)?.type]?.name||'quarters'):''}${s.condition==='downed'?'\nBleed out in '+(s.bleed/42).toFixed(1)+'h':''}`,
    posts:game.buildings.filter(b=>game.postRole(b)).map(b=>({id:b.id,name:ROLES[game.postRole(b)].name+' · '+(campaignBuilding(b.type)?.name||BUILDINGS[b.type].name)+' #'+b.id,description:game.staffOf(b).length+'/'+game.postCapacity(b)+' posts',enabled:s.post!==b.id&&game.staffOf(b).length<game.postCapacity(b)}))
  });
 }
 if(z) {
  const team=game.survivors.filter(s=>s.order?.zombieId===z.id);
  const kindNames={walker:'Walker',runner:'Runner',brute:'Brute',bloater:'Bloater',soldier:'Soldier'};
  const skin=z.kind==='walker'&&z.id%7===0?'soldier':z.kind;
  const name=kindNames[skin]||(z.kind.charAt(0).toUpperCase()+z.kind.slice(1));
  const status=z.swarm?'PART OF A PACK':'STRAGGLER';
  const desc=`THE DEAD · ${status}\nDamage ${Math.round(z.damage)}/s · Speed ${Math.round(z.speed)}\n`+(team.length?`Attacking: ${team.length} survivor${team.length>1?'s':''}`:'Order up to three nearby survivors to attack.');
  return JSON.stringify({kind:'zombie',id,name,description:desc,attackEnabled:team.length===0&&game.attackCandidates(z).length>0,staff:team.map(s=>({id:s.id,name:s.name,description:s.task||'attacking'}))});
 }
 return '{}';
};
globalThis.afTreeHint = id => game.treeHint(String(id));
// Walls and gates snap to the wall cell under the pointer themselves; everything else to the 16-unit grid.
globalThis.afPlacement = (type,x,y,r) => { const grid=v=>type==='barricade'||type==='gate'?v:Math.round(v/16)*16,spot=game.snapPlacement(type,grid(x),grid(y),r),check=game.canPlace(type,spot.x,spot.y,spot.rotation);return JSON.stringify({type,...spot,...check,sprite:buildingSprite({type,rotation:spot.rotation,upgrades:[]})}); };
globalThis.afParty = (json,kind) => {const ids=JSON.parse(json),party=ids.map(id=>game.survivors.find(s=>s.id===id));return JSON.stringify({reason:game.partyBlock(party,kind),cost:cost(game.partyCost(kind,party.length)),risk:game.expeditionRisk(kind,party.length),members:game.survivors.map(s=>({id:s.id,name:s.name,description:game.expeditionBlock(s,kind)||s.role,enabled:!game.expeditionBlock(s,kind)}))});};

// ---- The overseer's tablet ----
const objectives=list=>list.map(x=>game.objectiveView(x));
// The little that shows on the HUD all the time: the current orders and what is unread.
function tabletSummary(){
  if (game.campaign?.tasks) {
    const t=game.currentTask;
    return {unread:game.messages.filter(m=>!m.read).length,rank:game.campaign.classification,waiting:game.candidates.length,
      quest:t?{title:t.code+' · '+t.title,objectives:t.objectives.map(o=>taskObjective(t,o))}:{title:'Awaiting authorization',objectives:[]}};
  }
  const q=game.quest,next=QUESTS[game.progress.quest];
  return {unread:game.messages.filter(m=>!m.read).length,rank:RANKS[game.progress.rank].name,waiting:game.candidates.length,
    quest:q?{title:q.title,objectives:objectives(q.objectives)}:next?{title:'Awaiting orders',pending:`Reach ${RANKS[next.rank].name} status`,objectives:[]}:null};
}
// One objective of a campaign task, as the HUD shows it.
function taskObjective(t,o){ const p=game.objectiveProgress(t,o); return {id:o.id,text:o.description,value:Math.floor(p.value*10)/10,count:p.count,done:p.done}; }
// The campaign's side of the tablet: the task chain, unlocked modules, workstations and the food forecast.
function campaignTablet(){
  const c=game.campaign; if(!c?.tasks) return null;
  const vars=game.taskVars, food=game.available('food'), perDay=game.dailyFoodDemand;
  const gardens=game.buildings.filter(b=>['garden_plot','field_farm'].includes(campaignIdOf(b.type))&&game.operational(b));
  return {
    classification:c.classification,phase:c.phase,modules:c.unlocks.modules,
    tasks:TASKS.filter(t=>t.kind==='main'||c.tasks[t.id].state!=='locked').map(t=>{const st=c.tasks[t.id];return {id:t.id,code:t.code,title:t.title,kind:t.kind,phase:t.phase,state:st.state,
      body:fill(t.copy.body||'',vars),centroCom:fill(t.copy.centroComIssue||'',vars),mara:fill(t.copy.maraCopy||t.copy.maraBefore||t.copy.maraAfterWelcome||'',vars),tutorial:t.copy.tutorial||'',completion:fill(t.copy.completionText||'',vars),
      reward:amountsText(t.reward),unlocks:(t.unlocks.buildings||[]).map(id=>CAMPAIGN.buildings[id]?.name||id),objectives:st.state==='active'?t.objectives.map(o=>taskObjective(t,o)):[]};}),
    stations:game.buildings.filter(b=>b.model==='campaign'&&Object.values(CAMPAIGN.recipes).some(r=>r.station===campaignIdOf(b.type))).map(b=>({id:b.id,name:campaignBuilding(b.type).name,operator:game.staffOf(b).map(s=>s.name).join(', '),
      ...campaignBuildingView(b,campaignBuilding(b.type),game.staffOf(b))})),
    defense:{threatsActive:c.threatsActive,ammo:game.available('ammo'),pistolMinAmmo:CAMPAIGN.tuning.combat.guardPistolMinAmmo,routes:GUARD_ROUTES,
      guards:game.survivors.filter(s=>s.role==='guard'&&s.post!=null).map(guardView),
      watch:game.survivors.filter(s=>s.role==='sentry'&&s.post!=null).map(s=>({id:s.id,name:s.name,onWatch:!!s.stationed,onDuty:game.onDuty(s)})),
      alerts:game.alerts.map(a=>({id:a.id,count:a.threatIds.length,direction:game.compassOf(a.lastKnown),lookout:!a.local,agoHours:(game.elapsed-a.lastSeenAt)/HOUR,tutorial:a.threatIds.includes(c.scripted.wanderer?.id)})),
      ackNeeded:!!c.scripted.wanderer?.detected&&c.tasks.p1_07?.state==='active'&&!c.tasks.p1_07.counters.ack_alert},
    recruitment:{contacts:c.story.contacts.map(x=>({id:x.id,name:x.name,quality:quality(x.stats),stats:x.stats})),radio:game.radioKit?radioView():null,acceptBlock:game.acceptBlock(),population:game.survivors.length,beds:game.capacity,
      candidates:game.candidates.map(x=>({id:x.id,name:x.name,look:x.look,stats:x.stats,quality:quality(x.stats),traits:(x.traits||[]).map(id=>({id,name:CAMPAIGN.traits[id].name,type:CAMPAIGN.traits[id].type,effect:CAMPAIGN.traits[id].effect})),
        hp:CAMPAIGN.tuning.survivors.baseHP+(x.traits||[]).reduce((n,id)=>n+(CAMPAIGN.traits[id].modifiers.maxHp||0),0),food:CAMPAIGN.tuning.food.perPersonPerDay,expiresIn:Math.max(0,(x.expiresAt-game.elapsed)/HOUR)}))},
    medical:{stock:{...c.stock},supplies:game.available('medical_supplies')},
    shelter:shelterView(),migration:migrationView(),operations:operationsView(),
    certification:c.tasks.p1_10?.state==='active'||c.tasks.p1_10?.state==='completed'?{active:c.tasks.p1_10.state==='active',holdHours:(c.tasks.p1_10.holds.cert_hold||0)/HOUR,target:TASK_BY_ID.p1_10.objectives[0].targetHours,items:game.certificationChecklist()}:null,
    forecast:{food,perDay,days:perDay>0?food/perDay:null,gardens:gardens.length,staffedGardens:gardens.filter(b=>game.staffOf(b).length).length,
      gardenPerDay:game.grossFoodPerDay},
  };
}
// Everything on the tablet's tabs. Read only while the tablet is open.
globalThis.afTablet = () => {
  const p=game.progress,names=types=>types.map(t=>BUILDINGS[t].name);
  const count=type=>game.buildings.filter(b=>b.type===type).length;
  return JSON.stringify({
    campaign:campaignTablet(),rank:p.rank,renown:game.renown,arrivalsPerDay:+(game.arrivalRate*11).toFixed(1),shortage:game.shortage,
    quests:QUESTS.map((q,i)=>({id:q.id,title:q.title,brief:q.brief,rank:RANKS[q.rank].name,unlocks:names(q.unlock),reward:cost(q.reward),
      state:i<p.quest?'done':i===p.quest?(q.rank<=p.rank?'active':'waiting'):'locked',objectives:i===p.quest?objectives(q.objectives):[]})),
    ranks:RANKS.map((r,i)=>({id:r.id,name:r.name,blurb:r.blurb,tier:r.tier,reward:r.reward?cost(r.reward):'',earned:i<=p.rank,current:i===p.rank,next:i===p.rank+1,milestones:objectives(r.milestones)})),
    maxRank:MAX_RANK,
    messages:[...game.messages].reverse().map(m=>({...m,channel:m.from===MARA?'private':'official',when:game.stampAt(m.at),candidate:m.action?.kind==='candidate'?game.candidates.some(c=>c.id===m.action.id):false})),
    journal:[...game.journal].reverse().map(j=>({...j,when:game.stampAt(j.at)})),
    inventory:{ledger:game.ledgerSummary(),resources:{...game.resources},storage:game.storage,rates:game.rates(),
      items:Object.entries(WEAPONS).filter(([k])=>k!=='fists').map(([id,w])=>({id,name:w.name,count:game.items.filter(i=>i.type===id).length,held:game.items.filter(i=>i.type===id&&i.holder!=null).length})).filter(i=>i.count>0),
      structures:Object.keys(BUILDINGS).filter(t=>count(t)>0).map(t=>({type:t,name:BUILDINGS[t].name,count:count(t)})),
      locked:Object.keys(QUEST_UNLOCKS).filter(t=>!game.isUnlocked(t)).map(t=>({type:t,name:BUILDINGS[t].name,quest:QUEST_BY_ID[QUEST_UNLOCKS[t]].title}))},
    survivors:game.survivors.map(s=>({id:s.id,name:s.name,role:ROLES[s.role||'patrol'].name,job:JOBS[jobOf(s)],campaignJob:s.model==='campaign'?CAMPAIGN.jobs[campaignJob(s)].name:'',level:s.level,hp:Math.ceil(s.hp),maxHP:Math.ceil(survivorStats(s,game.postOf(s)).hp),condition:s.condition,away:!!s.expedition,task:s.expedition?'On expedition':s.task||'',home:!!s.home})),
    candidates:game.candidates.map(c=>({id:c.id,name:c.name,label:c.label||c.source,level:c.level,stats:statsText(c),expires:(c.expiresAt-game.elapsed)/42})),
    freeBeds:game.freeBeds,beds:game.capacity,recruitCost:cost(game.recruitCost),broadcasting:game.broadcasting,recruitTimer:game.recruitTimer,recruitEnabled:!game.broadcasting&&game.freeBeds>0&&game.afford(game.recruitCost)
  });
};
// The tablet's map: the ground by tile, the trees, the land and the world's points of interest.
globalThis.afMinimap = () => {
  const m=game.map,o=game.worldOrigin;
  return JSON.stringify({
    w:m?m.w:0,h:m?m.h:0,terr:m&&m.terr.length===m.w*m.h?m.terr.join(''):'',originX:o?o.bcx*16:0,originY:o?o.bcy*16:0,
    bounds:game.bounds,land:game.land.map(p=>parcelRect(p)),trees:game.forest.trees.filter(t=>!game.regrowing(t)).map(t=>[Math.round(t.x),Math.round(t.y)]),
    pois:(game.worldPois||[]).map(p=>({id:p.id,name:p.name,type:p.type,x:p.x,y:p.y,scavenged:!!p.scavenged})),
    region:regionSummary()
  });
};
