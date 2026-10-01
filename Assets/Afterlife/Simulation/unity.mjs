// Unity boundary only. All gameplay decisions remain in the original Game subsystems.
import { Game, BUILDINGS, BUILDING_TREES, EXPEDITIONS, buildingMaxHP, survivorStats, boundsOf, jobOf, postSlots } from './model.mjs';
import { ROLE_FOR, ROLES, JOBS, shiftLabel, describeTrade } from './data.mjs';
import { WEAPONS } from './survivors.mjs';
import { parcelRect, parcelAt } from './land.mjs';
import { groundKey, overlayKeys } from './worldgen.mjs';
import { CAMP } from './camp.mjs';
import { QUESTS, QUEST_UNLOCKS, QUEST_BY_ID, RANKS, MAX_RANK, stamp } from './progression.mjs';
export const game = new Game();
const cost = c => Object.entries(c).map(([r,n])=>`${n} ${r}`).join(' · ') || 'Free';
const outfit = s => ({guard:['guard','ranger'],medic:['doctor','nurse'],engineer:['mechanic','engineer'],farmer:['elder','grower'],scavenger:['hunter','scavenger']}[jobOf(s)] || ['guard','ranger'])[s.look%2];
const material = b => b.upgrades.includes('plate') ? 'scrap' : b.upgrades.includes('reinforce') ? 'planks' : 'palisade';
// The starter camp's fixtures are drawn with the kit's decor art (camp/* keys resolve to it in the view).
const CAMP_SPRITES = {
  campfire: 'camp/fire', tent: 'camp/tent', cache: 'camp/cache',
  ...Object.fromEntries(['supply_stash', 'garden_plot', 'field_workbench', 'aid_station', 'lookout_post', 'guard_post', 'radio_kit', 'makeshift_shelter', 'salvage_pile'].map(t => [t, 'camp/' + t])),
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
  role:e.role||'',task:e.expedition?`${e.expedition.phase?e.task:(EXPEDITIONS[e.expedition.kind]?.name||e.expedition.kind)} · ${(e.expedition.remaining/42).toFixed(1)}h`:e.task||'',condition:e.condition||'',gear:e.gear||'fists',level:e.level||0,targetId:e.order?.zombieId??-1,side:e.side||'any',
  shift:e.shift??-1,post:e.post??-1,burning:!!e.burning,doorFrame:e.doorFrame!=null?Math.min(3,Math.max(0,Math.round(e.doorFrame))):0});
// `reset` begins a new run, which is always a starter camp, even after a refuge save was loaded.
const commands = {
  build:(type,x,y,r)=>game.build(type,x,y,r), upgradeBuilding:(id,node)=>game.upgradeBuilding(id,node),repair:id=>game.repair(id),repairAll:()=>game.repairAll(),demolish:id=>game.demolish(id),
  devGrantResource:(type,amount)=>{if(!['wood','metal','food'].includes(type)||!Number.isFinite(amount)||amount<=0)return false;game.resources[type]+=amount;return true;},
  buyLand:(col,row)=>game.buyLand(col,row),assign:(id,side)=>{game.post(id,null);return game.assign(id,side);},post:(id,b)=>game.post(id,b),
  assignShift:(id,towerId,shiftIndex)=>{const s=game.survivors.find(x=>x.id===id),tower=game.buildings.find(b=>b.id===towerId&&b.type==='tower');if(!s||!tower||s.expedition)return false;if(s.post!==tower.id&&!game.post(id,tower.id))return false;const other=game.staffOf(tower).find(o=>o.id!==s.id&&o.shift===shiftIndex);if(other)other.shift=s.shift;s.shift=shiftIndex;return true;},
  equipWeapon:(id,type)=>{const s=game.survivors.find(x=>x.id===id);if(!s||s.expedition||s.condition==='downed')return false;const item=game.items.find(i=>i.type===type&&i.holder==null);if(item){game.equip(s,item);return true;}return false;},
  orderShelter:id=>game.orderShelter(id),clearShelter:()=>game.clearShelter(),recruit:()=>game.recruit(),acceptCandidate:id=>game.acceptCandidate(id),declineCandidate:id=>game.declineCandidate(id),
  fabricate:type=>game.fabricate(type),trade:()=>game.trade(),dismissTrader:()=>game.dismissTrader(),raiseAlarm:()=>game.raiseAlarm(),clearAlarm:()=>game.clearAlarm(),
  orderAttack:id=>{const r=game.orderAttack(id);return r&&r.ok!==false;},cancelAttack:id=>game.cancelAttack(id),sendExpedition:(ids,kind)=>game.sendExpedition(ids,kind),reset:()=>{game.start='camp';game.reset();resetDelta();return true;},
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
  devAdvanceDay:()=>game.advanceDay(),
  devSpawnHorde:(count,kind)=>game.spawnHorde(count,kind)
};
globalThis.afCommand = (name,json) => { if(!Object.hasOwn(commands,name)) throw new Error('Unknown Unity command: '+name); return !!commands[name](...JSON.parse(json)); };
globalThis.afStep = dt => game.step(dt);
globalThis.afBeginWorld = (size, seed, options) => game.beginWorldGeneration(size, seed, options);
globalThis.afAdvanceWorld = () => {
  const progress = game.advanceWorldGeneration();
  if (progress.done) resetDelta();
  return JSON.stringify(progress);
};
globalThis.afSave = () => game.serialize();
globalThis.afRestore = json => { resetDelta(); return game.restore(json); };
globalThis.afRestoreError = json => game.restoreError(json);
globalThis.afBounds = (x,y) => { if (game.map) game.bounds = { ...game.bounds, x, y }; else game.bounds = {x,y}; };
globalThis.afFrame = () => JSON.stringify({elapsed:game.elapsed,day:game.day,hour:game.hour,phase:game.phase.name,status:game.status,season:game.season,wood:game.resources.wood,metal:game.resources.metal,food:game.resources.food,capacity:game.capacity,kills:game.kills,alarm:game.alarm.raised,landRevision:game.landRevision,
  territory:game.territory,entities:[...game.buildings.map(e=>entity(e,'building')),...game.survivors.map(e=>entity(e,'survivor')),...game.zombies.map(e=>entity(e,'zombie'))],effects:game.effects,
  incoming:game.incoming?`${['NORTH','EAST','SOUTH','WEST'][game.incoming.side]} INCURSION · ${Math.ceil(game.incoming.eta)}s`:'',director:game.director.state,
  scavengedPois:(game.worldPois||[]).filter(p=>p.scavenged).map(p=>p.id),harvest:game.harvestView(),freeBuild:!!game.freeBuild,godmode:!!game.godmode});

let deltaKnownIds = new Set();
let deltaMetaCache = new Map();
export function resetDelta() { deltaKnownIds.clear(); deltaMetaCache.clear(); }
globalThis.afResetDelta = resetDelta;

function entityMetaKey(e, kind) {
  if (kind === 'building') return `${buildingSprite(e)}|${buildingMaxHP(e)}|${e.rotation?1:0}`;
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
    wood: game.resources.wood, metal: game.resources.metal, food: game.resources.food,
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
    pois: game.worldPois || [],
    decor: game.visibleDecor,
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
globalThis.afHud = () => JSON.stringify({tablet:tabletSummary(),unlockKey:Object.keys(game.unlocked).join(',')+'|'+!!game.freeBuild,storage:game.storage,warnings:game.warnings(),events:game.events.splice(0),rates:game.rates(),freeBeds:game.freeBeds,recruitCost:cost(game.recruitCost),broadcasting:game.broadcasting,recruitTimer:game.recruitTimer,landCost:cost(game.landCost),repairAllCost:cost(game.repairAllCost()),sheltered:!!game.shelterOrder,partyCap:game.partyCap,
  candidates:game.candidates.map(c=>({id:c.id,name:c.name,label:c.label||c.source,stats:statsText(c),expires:(c.expiresAt-game.elapsed)/42})),
  trader:game.trader?describeTrade(game.trader):'',tradeEnabled:!!game.trader&&game.afford(game.trader.give),
  weapons:Object.entries(WEAPONS).filter(([,w])=>w.cost).map(([id,w])=>({id,name:w.name,cost:cost(w.cost),count:game.items.filter(i=>i.type===id).length,enabled:game.afford(w.cost)&&game.buildings.some(b=>b.type==='workshop')}))});
function statsText(s) {return `STR ${s.stats.str}   AGI ${s.stats.agi}   END ${s.stats.end}   INT ${s.stats.int}   CHA ${s.stats.cha}`;}
globalThis.afCatalog = () => JSON.stringify({
  buildings:Object.entries(BUILDINGS).filter(([k,b])=>k!=='core'&&!b.fixture).map(([id,b])=>({id,name:b.name,description:b.subtitle,cost:cost(b.cost),sprite:buildingSprite({type:id,upgrades:[],rotation:0}),locked:!game.freeBuild&&!game.isUnlocked(id),unlockedBy:QUEST_UNLOCKS[id]?QUEST_BY_ID[QUEST_UNLOCKS[id]].title:''})),
  expeditions:Object.entries(EXPEDITIONS).map(([id,t])=>({id,name:t.name,description:t.description,cost:cost(t.cost),hours:t.hours,reward:cost(t.reward),risk:t.risk})),
  pois:(game.worldPois||[]).map(p=>({id:'poi:'+p.id,name:p.name,description:p.label,x:p.x,y:p.y,type:p.type}))
});
globalThis.afDetails = id => {
 const b=game.buildings.find(e=>e.id===id),s=game.survivors.find(e=>e.id===id),z=game.zombies.find(e=>e.id===id);
 if(b) {
  const staffed=!!ROLE_FOR[b.type], tree=BUILDING_TREES[b.type]||[];
  const staff=game.staffOf(b), hp=buildingMaxHP(b);
  let output='';
  if (b.type==='farm') output=(60*.23*(1+(b.upgrades.includes('irrigation')?.5:0)+(b.upgrades.includes('storage')?.25:0)+(b.upgrades.includes('greenhouse')?.75:0)+(b.upgrades.includes('harvest')?.75:0))*(game.night&&!b.upgrades.includes('greenhouse')?.4:1)*game.farmLabor(b)).toFixed(1)+' food / min'+(staff.length?' · '+staff.length+' farmer'+(staff.length>1?'s':''):'');
  else if (b.type==='dorm') output=game.residents(b).length+' / '+game.beds(b)+' beds taken';
  else if (b.type==='workshop') output=(16.2*(1+(b.upgrades.includes('sawbench')?.6:0)+(b.upgrades.includes('machinery')?1:0))).toFixed(1)+' wood · '+(7.2*(1+(b.upgrades.includes('forge')?.7:0)+(b.upgrades.includes('recycling')?1:0))).toFixed(1)+' metal / min';
  else if (b.type==='barracks') output=staff.length+' guard'+(staff.length!==1?'s':'')+' hunting · +2 beds';
  else if (b.type==='clinic') output=staff.length+' medic'+(staff.length!==1?'s':'')+' · '+game.survivors.filter(p=>p.careAt===b.id&&p.care).length+' patients';
  else if (b.type==='tower') {
    const up=game.survivors.find(s=>s.stationed&&s.towerId===b.id);
    output=up?(up.role==='sentry'?up.name+' on watch · alerting guards':up.name+' on watch'):(staff.length?'Shifts covered: '+staff.length+'/'+postSlots(b):'Unmanned · assign sentry');
  }
  else if (b.type==='core') output='Heart of the settlement · If it falls, the run ends';
  else if (b.type==='campfire') output='Heart of the camp · If it goes out, the run ends';
  else if (b.type==='tent') output=game.residents(b).length+' / '+game.beds(b)+' bedroll taken';
  else if (b.type==='cache') output=`${Math.floor(game.resources.wood)} wood · ${Math.floor(game.resources.metal)} metal · ${Math.floor(game.resources.food)} food · open your tablet [Tab]`;
  else if (b.type==='gate') output='Opens for survivors'+(b.upgrades.includes('wire')?' · '+(4+(b.upgrades.includes('spikes')?10:0))+' dmg/s':'');
  else if (b.type==='barricade') output=b.upgrades.includes('wire')?(4+(b.upgrades.includes('spikes')?10:0))+' dmg/s':'Blocking hostiles';
  else if (b.type==='shelter') output='Emergency shelter · Capacity: '+game.shelterCapacity(b)+' survivors';
  else if (b.type==='lumber_mill') output=((.35*(1+(b.upgrades.includes('circular_saw')?.4:0)+(b.upgrades.includes('steam_engine')?.7:0))*(game.loggerLabor?game.loggerLabor(b):1))*60).toFixed(1)+' wood / min'+(staff.length?' · '+staff.length+' logger'+(staff.length>1?'s':''):'');
  else if (b.type==='storage') output='Caches supplies · Prevents resource loss in swarms';
  else if (b.type==='lab') output='Synthesizes medicine and incendiary research';
  else if (b.type==='armory') output='Weapon fabrication depot · Reinforces guard combat stats';

  const residentNames=game.residents(b).map(s=>s.name);
  const shelterInside=game.survivors.filter(s=>s.shelter===b.id&&s.sheltered).length;
  const refundWood=Math.floor((BUILDINGS[b.type].cost.wood||0)/2), refundMetal=Math.floor((BUILDINGS[b.type].cost.metal||0)/2);

  return JSON.stringify({
   kind:'building',id,type:b.type,name:BUILDINGS[b.type].name,description:BUILDINGS[b.type].subtitle,
   icon:BUILDINGS[b.type].icon||'',color:BUILDINGS[b.type].color||'#c8d19d',
   tier:b.type==='core'||b.type==='campfire'?'ESSENTIAL':BUILDINGS[b.type].fixture?'CAMP':'TIER '+(1+Math.floor(b.upgrades.length/2)),
   hp:Math.ceil(b.hp),maxHP:hp,output,
   repairCost:cost(game.repairCost(b)),repairEnabled:b.hp<hp&&game.afford(game.repairCost(b)),
   demolish:b.type!=='core'&&!BUILDINGS[b.type].fixture,demolishRefund:cost({wood:refundWood,metal:refundMetal}),
   shelter:game.shelterCapacity(b),shelteredCount:shelterInside,isShelteringHere:game.shelterOrder?.buildingId===b.id,
   beds:game.beds(b),residents:residentNames,slots:postSlots(b),staffed,
   roleName:staffed?ROLES[ROLE_FOR[b.type]].name:'',roleDescription:staffed?ROLES[ROLE_FOR[b.type]].description:'',
   upgrades:tree.map(n=>{const locked=game.upgradeLock(b.type,n);return {id:n.id,name:n.name,description:n.description,cost:cost(n.cost),requires:n.requires||'',parentName:n.requires?(tree.find(p=>p.id===n.requires)?.name||n.requires):'',owned:b.upgrades.includes(n.id),locked,enabled:!locked&&!b.upgrades.includes(n.id)&&(!n.requires||b.upgrades.includes(n.requires))&&game.afford(n.cost)};}),
   staff:staff.map(s=>({id:s.id,name:s.name,description:b.type==='tower'&&s.shift!=null?shiftLabel(s.shift):(s.task||s.role),level:s.level})),
   assignable:game.survivors.filter(s=>!s.expedition&&s.post!==b.id).map(s=>({id:s.id,name:s.name,description:s.role||'patrol',level:s.level,enabled:staff.length<postSlots(b)})),
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
    upgrades,buildingId:relatedBuilding?relatedBuilding.id:-1,
    description:`${ROLES[s.role].name} · Level ${s.level} · ${s.resting?'Sleeping':s.condition}\n${statsText(s)}\n${WEAPONS[s.gear||'fists'].name} · Damage ${a.damage.toFixed(1)} · Range ${Math.round(a.range)}\n${s.xp.toFixed(0)} / ${game.xpNeeded(s)} XP${s.role==='sentry'?'\nShift: '+shiftLabel(s.shift):''}${s.resting?'\nResting in '+(BUILDINGS[game.buildings.find(b=>b.id===s.restAt)?.type]?.name||'quarters'):''}${s.condition==='downed'?'\nBleed out in '+(s.bleed/42).toFixed(1)+'h':''}`,
    posts:game.buildings.filter(b=>ROLE_FOR[b.type]).map(b=>({id:b.id,name:ROLES[ROLE_FOR[b.type]].name+' · '+BUILDINGS[b.type].name+' #'+b.id,description:game.staffOf(b).length+'/'+postSlots(b)+' posts',enabled:s.post!==b.id&&game.staffOf(b).length<postSlots(b)}))
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
  const q=game.quest,next=QUESTS[game.progress.quest];
  return {unread:game.messages.filter(m=>!m.read).length,rank:RANKS[game.progress.rank].name,waiting:game.candidates.length,
    quest:q?{title:q.title,objectives:objectives(q.objectives)}:next?{title:'Awaiting orders',pending:`Reach ${RANKS[next.rank].name} status`,objectives:[]}:null};
}
// Everything on the tablet's tabs. Read only while the tablet is open.
globalThis.afTablet = () => {
  const p=game.progress,names=types=>types.map(t=>BUILDINGS[t].name);
  const count=type=>game.buildings.filter(b=>b.type===type).length;
  return JSON.stringify({
    rank:p.rank,renown:game.renown,arrivalsPerDay:+(game.arrivalRate*11).toFixed(1),shortage:game.shortage,
    quests:QUESTS.map((q,i)=>({id:q.id,title:q.title,brief:q.brief,rank:RANKS[q.rank].name,unlocks:names(q.unlock),reward:cost(q.reward),
      state:i<p.quest?'done':i===p.quest?(q.rank<=p.rank?'active':'waiting'):'locked',objectives:i===p.quest?objectives(q.objectives):[]})),
    ranks:RANKS.map((r,i)=>({id:r.id,name:r.name,blurb:r.blurb,tier:r.tier,reward:r.reward?cost(r.reward):'',earned:i<=p.rank,current:i===p.rank,next:i===p.rank+1,milestones:objectives(r.milestones)})),
    maxRank:MAX_RANK,
    messages:[...game.messages].reverse().map(m=>({...m,when:stamp(m.at),candidate:m.action?.kind==='candidate'?game.candidates.some(c=>c.id===m.action.id):false})),
    journal:[...game.journal].reverse().map(j=>({...j,when:stamp(j.at)})),
    inventory:{resources:{...game.resources},storage:game.storage,rates:game.rates(),
      items:Object.entries(WEAPONS).filter(([k])=>k!=='fists').map(([id,w])=>({id,name:w.name,count:game.items.filter(i=>i.type===id).length,held:game.items.filter(i=>i.type===id&&i.holder!=null).length})).filter(i=>i.count>0),
      structures:Object.keys(BUILDINGS).filter(t=>count(t)>0).map(t=>({type:t,name:BUILDINGS[t].name,count:count(t)})),
      locked:Object.keys(QUEST_UNLOCKS).filter(t=>!game.isUnlocked(t)).map(t=>({type:t,name:BUILDINGS[t].name,quest:QUEST_BY_ID[QUEST_UNLOCKS[t]].title}))},
    survivors:game.survivors.map(s=>({id:s.id,name:s.name,role:ROLES[s.role||'patrol'].name,job:JOBS[jobOf(s)],level:s.level,hp:Math.ceil(s.hp),maxHP:Math.ceil(survivorStats(s,game.postOf(s)).hp),condition:s.condition,away:!!s.expedition,task:s.expedition?'On expedition':s.task||'',home:!!s.home})),
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
    pois:(game.worldPois||[]).map(p=>({id:p.id,name:p.name,type:p.type,x:p.x,y:p.y,scavenged:!!p.scavenged}))
  });
};
