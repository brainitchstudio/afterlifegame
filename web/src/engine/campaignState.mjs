// The AfterLife campaign (Phases 0-2): the run's settings and progress. A Game in campaign mode carries
// one of these as `game.campaign`; legacy camps and the walled refuge scenario carry null.
// Every number and line of copy comes from the content studio as CAMPAIGN (backend/data/campaign_*.json).
import { CAMPAIGN } from './gameContent.mjs';

export { CAMPAIGN };
export const CAMPAIGN_VERSION = 1;
export const CLASSIFICATIONS = ['Provisional Camp', 'Established Camp', 'Established Outpost'];
// Engine building types that are campaign structures under another id, and the lookups both ways.
export const CAMPAIGN_TYPE = { cache: 'supply_cache' };
const ENGINE_TYPE = Object.fromEntries(Object.entries(CAMPAIGN_TYPE).map(([e, c]) => [c, e]));
export const campaignBuilding = type => CAMPAIGN.buildings[CAMPAIGN_TYPE[type] || type];
export const campaignIdOf = type => CAMPAIGN_TYPE[type] || type;
export const engineTypeOf = id => ENGINE_TYPE[id] || id;

// Settings a new campaign is configured with on the start screen. Unknown values fall back to the defaults.
export function campaignSettings({ difficulty, mapSize, overseerName, seed } = {}) {
  const name = typeof overseerName === 'string' ? overseerName.trim().slice(0, 24) : '';
  return {
    difficulty: CAMPAIGN.difficulties[difficulty] ? difficulty : 'standard',
    mapSize: CAMPAIGN.tuning.world.mapSizes[mapSize] ? mapSize : 'standard',
    overseerName: name || 'Overseer',
    seed: typeof seed === 'string' && seed ? seed : null,
  };
}

// The supply cache a campaign is deployed with: the spec's package scaled by difficulty, rounded up.
export function campaignStartingSupplies(difficulty = 'standard') {
  const mult = (CAMPAIGN.difficulties[difficulty] || CAMPAIGN.difficulties.standard).resourceMult;
  const out = Object.fromEntries(Object.keys(CAMPAIGN.resources).filter(r => r !== 'equipment').map(r => [r, 0]));
  for (const [r, n] of Object.entries(CAMPAIGN.tuning.deployment.startingSupplies)) out[r] = n ? Math.ceil(n * mult - 1e-9) : 0;
  return out;
}

// Campaign copy by id, with {placeholders} filled from `vars` (unknown ones are left as written).
export const fill = (template, vars = {}) => String(template).replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
export const copy = (id, vars) => fill(CAMPAIGN.strings[id] ?? id, vars);
export const CENTROCOM = 'CentroCom', MARA = 'Mara Venn';

// Crafted consumables held as counts beside the ledger: they weigh as equipment and are used up.
export const CONSUMABLES = ['bandage', 'first_aid_kit'];
export const emptyMigration = () => ({ state: 'none', kind: null, triggered: false, arriveAt: null, spawnEvery: 0, nextSpawnAt: null, spawned: 0, total: 0, from: 0, lastContactAt: null, cooldownUntil: null, hold: 0, bestHold: 0, cleared: 0, killsAtStart: 0 });
export const emptyRecovery = () => ({ sent: {}, pending: [] });
export const emptyStory = () => ({ done: {}, tokens: { relay_keycard: null, relay_battery: null }, contacts: [], crewContacted: false, relayBroadcasts: 0 });
export const emptyOperations = () => ({ mission: null, sites: {}, runs: 0, safeRuns: 0, unloaded: {}, reports: [] });
const emptyRadio = () => ({ lastBroadcastAt: null, broadcast: null, pending: null, broadcasts: 0 });
export function createCampaign(settings = {}) {
  return {
    version: CAMPAIGN_VERSION, phase: 0, classification: CLASSIFICATIONS[0], settings: campaignSettings(settings), dayLog: { producedFood: 0, consumedFood: 0 }, foodShortageHours: 0, threatsActive: false, region: null,
    stock: Object.fromEntries(CONSUMABLES.map(k => [k, 0])), radio: emptyRadio(), recruitedCount: 0, threatTimer: null,
    // The tutorial's scripted moments: P1-05's cut and P1-07's wanderer.
    scripted: { cut: null, cutTreated: false, wanderer: null, losses: 0 },
    // Emergency shelter and migrations (migration.mjs); deliveries, side tasks and the Phase 2 screen (certification.mjs).
    shelter: null, migration: emptyMigration(), recovery: emptyRecovery(), side: {}, transition: null,
    // Regional operations (operations.mjs).
    operations: emptyOperations(),
    // Expeditions, tokens and contacts (story.mjs).
    story: emptyStory(),
  };
}
const num = (v, d = 0) => Number.isFinite(v) ? v : d;
function restoreRadio(r) {
  if (!r || typeof r !== 'object') return emptyRadio();
  const b = r.broadcast, p = r.pending;
  return {
    lastBroadcastAt: Number.isFinite(r.lastBroadcastAt) ? r.lastBroadcastAt : null,
    broadcast: b && Number.isInteger(b.radio) && Number.isFinite(b.progress) ? { radio: b.radio, progress: Math.min(1, Math.max(0, b.progress)) } : null,
    pending: p && Number.isFinite(p.at) ? { at: p.at, success: p.success === true, qualityMin: num(p.qualityMin) } : null,
    broadcasts: Math.max(0, Math.floor(num(r.broadcasts))),
  };
}
function restoreMigration(m) {
  const out = emptyMigration();
  if (!m || typeof m !== 'object') return out;
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'number') out[k] = num(m[k], v);
    else if (v === null) out[k] = Number.isFinite(m[k]) ? m[k] : k === 'kind' && ['first', 'readiness'].includes(m[k]) ? m[k] : null;
  }
  out.state = ['none', 'warning', 'passage', 'clearing', 'cleared'].includes(m.state) ? m.state : 'none';
  out.triggered = m.triggered === true;
  return out;
}
function restoreRecovery(r) {
  const out = emptyRecovery();
  if (!r || typeof r !== 'object') return out;
  out.sent = Object.fromEntries(Object.entries(r.sent || {}).filter(([k, v]) => CAMPAIGN.resources[k] && v === true));
  out.pending = (Array.isArray(r.pending) ? r.pending : []).filter(p => Number.isFinite(p?.at) && p.amounts && typeof p.amounts === 'object')
    .map(p => ({ at: p.at, amounts: Object.fromEntries(Object.entries(p.amounts).filter(([k, v]) => CAMPAIGN.resources[k] && Number.isFinite(v) && v > 0)) })).slice(0, 10);
  return out;
}
const amounts = a => Object.fromEntries(Object.entries(a && typeof a === 'object' ? a : {}).filter(([k, v]) => CAMPAIGN.resources[k] && Number.isFinite(v) && v >= 0));
function restoreOperations(o) {
  const out = emptyOperations();
  if (!o || typeof o !== 'object') return out;
  out.runs = Math.max(0, Math.floor(num(o.runs))); out.safeRuns = Math.max(0, Math.floor(num(o.safeRuns)));
  for (const [id, st] of Object.entries(o.sites || {})) if (CAMPAIGN.sites[id] && st && typeof st === 'object')
    out.sites[id] = { stock: amounts(st.stock), cooldownUntil: Number.isFinite(st.cooldownUntil) ? st.cooldownUntil : null, returns: Math.max(0, Math.floor(num(st.returns))), visits: Math.max(0, Math.floor(num(st.visits))) };
  for (const [id, a] of Object.entries(o.unloaded || {})) if (CAMPAIGN.sites[id]) out.unloaded[id] = amounts(a);
  out.reports = (Array.isArray(o.reports) ? o.reports : []).filter(r => r && CAMPAIGN.sites[r.site] && Number.isFinite(r.at)).slice(0, 12)
    .map(r => ({ id: String(r.id), site: r.site, at: r.at, team: (Array.isArray(r.team) ? r.team : []).filter(n => typeof n === 'string').slice(0, 4), cargo: amounts(r.cargo), event: ['delay', 'injury', 'cargoLoss'].includes(r.event) ? r.event : null,
      injuries: (Array.isArray(r.injuries) ? r.injuries : []).filter(i => typeof i?.name === 'string' && Number.isFinite(i.hp)).slice(0, 4), recalled: r.recalled === true, left: typeof r.left === 'string' ? r.left.slice(0, 200) : '', reviewed: r.reviewed === true,
      ...(CAMPAIGN.expeditions[r.expedition] ? { expedition: r.expedition, story: typeof r.story === 'string' ? r.story.slice(0, 600) : '', choice: typeof r.choice === 'string' ? r.choice.slice(0, 600) : '' } : {}) }));
  const m = o.mission;
  if (m && typeof m === 'object' && CAMPAIGN.sites[m.site] && ['outbound', 'site', 'return'].includes(m.phase) && Array.isArray(m.team) && m.team.every(Number.isInteger) && ['launchedAt', 'oneWay', 'siteHours', 'siteWork', 'delay', 'speed', 'rations', 'capacity'].every(k => Number.isFinite(m[k])))
    out.mission = { id: String(m.id), site: m.site, team: m.team.slice(0, 4), phase: m.phase, launchedAt: m.launchedAt, oneWay: m.oneWay, siteHours: m.siteHours, siteWork: m.siteWork, delay: m.delay, speed: m.speed, rations: m.rations,
      rationsTx: typeof m.rationsTx === 'string' ? m.rationsTx : null, capacity: m.capacity, safe: m.safe === true, event: ['delay', 'injury', 'cargoLoss'].includes(m.event) ? m.event : null, cargo: amounts(m.cargo),
      injuries: (Array.isArray(m.injuries) ? m.injuries : []).filter(i => typeof i?.name === 'string' && Number.isFinite(i.hp)).slice(0, 4), recalled: m.recalled === true,
      pace: Object.fromEntries(Object.entries(m.pace && typeof m.pace === 'object' ? m.pace : {}).filter(([, v]) => Number.isFinite(v) && v > 0)),
      // An expedition's provisions, its encounter (saved mid-decision) and what it brings home.
      ...(CAMPAIGN.expeditions[m.expedition] ? { expedition: m.expedition, recovery: m.recovery === true, provisionTx: typeof m.provisionTx === 'string' ? m.provisionTx : null, kits: Math.max(0, Math.floor(num(m.kits))),
        encounter: m.encounter && typeof m.encounter === 'object' ? { open: m.encounter.open === true, choice: typeof m.encounter.choice === 'string' ? m.encounter.choice : null, result: typeof m.encounter.result === 'string' ? m.encounter.result : '' } : null,
        tokens: Array.isArray(m.tokens) ? m.tokens.filter(t => ['relay_keycard', 'relay_battery'].includes(t)) : undefined } : {}) };
  return out;
}
function restoreStory(d) {
  const out = emptyStory();
  if (!d || typeof d !== 'object') return out;
  out.done = Object.fromEntries(Object.entries(d.done || {}).filter(([k, v]) => CAMPAIGN.expeditions[k] && v === true));
  for (const t of Object.keys(out.tokens)) out.tokens[t] = ['held', 'installed', 'lost'].includes(d.tokens?.[t]) ? d.tokens[t] : null;
  const stats = x => x && ['str', 'end', 'agi', 'int', 'cha'].every(k => Number.isInteger(x[k]) && x[k] >= 1 && x[k] <= 10);
  out.contacts = (Array.isArray(d.contacts) ? d.contacts : []).filter(c => c && Number.isInteger(c.id) && typeof c.name === 'string' && stats(c.stats)).slice(0, 8)
    .map(c => ({ ...c, traits: Array.isArray(c.traits) ? c.traits.filter(t => CAMPAIGN.traits[t]) : [], crew: true }));
  out.crewContacted = d.crewContacted === true;
  out.relayBroadcasts = Math.max(0, Math.floor(num(d.relayBroadcasts)));
  return out;
}
function restoreSide(s) {
  if (!s || typeof s !== 'object') return {};
  const ids = v => Array.isArray(v) ? v.filter(Number.isInteger).slice(0, 4) : [];
  const out = {};
  if (s.s01 && typeof s.s01 === 'object') out.s01 = typeof s.s01.node === 'string' ? { node: s.s01.node } : {};
  if (s.s02 && typeof s.s02 === 'object') out.s02 = Number.isInteger(s.s02.building) ? { building: s.s02.building } : {};
  if (s.s03 && typeof s.s03 === 'object') out.s03 = { survivors: ids(s.s03.survivors) };
  if (s.s04 && typeof s.s04 === 'object') out.s04 = Number.isInteger(s.s04.candidate) ? { candidate: s.s04.candidate } : {};
  if (s.s05 && typeof s.s05 === 'object') out.s05 = {};
  return out;
}
function restoreScripted(d) {
  const w = d?.wanderer;
  return {
    cut: Number.isInteger(d?.cut) ? d.cut : null, cutTreated: d?.cutTreated === true, losses: Math.max(0, Math.floor(num(d?.losses))),
    wanderer: w && typeof w === 'object' ? { id: Number.isInteger(w.id) ? w.id : null, spawns: Math.max(0, Math.floor(num(w.spawns))), detected: w.detected === true, neutralized: w.neutralized === true, direction: typeof w.direction === 'string' ? w.direction.slice(0, 12) : '' } : null,
  };
}

// The deployment's region record (deployment.mjs), kept as long as its shape is sound.
function restoreRegion(r) {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || typeof r.seed !== 'string') return null;
  const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  return {
    ...r,
    patches: Array.isArray(r.patches) ? r.patches.filter(point) : [],
    sites: Array.isArray(r.sites) ? r.sites.filter(s => point(s) && CAMPAIGN.sites[s.id]) : [],
    corridor: r.corridor && Array.isArray(r.corridor.points) ? { ...r.corridor, points: r.corridor.points.filter(point) } : null,
  };
}

// A saved campaign, checked field by field; anything malformed comes back as a fresh campaign with the same settings.
export function restoreCampaign(d) {
  if (!d || typeof d !== 'object') return null;
  const fresh = createCampaign(d.settings);
  return {
    ...fresh,
    phase: [0, 1, 2].includes(d.phase) ? d.phase : fresh.phase,
    classification: CLASSIFICATIONS.includes(d.classification) ? d.classification : fresh.classification,
    dayLog: { producedFood: Number(d.dayLog?.producedFood) || 0, consumedFood: Number(d.dayLog?.consumedFood) || 0 },
    foodShortageHours: Math.max(0, Number(d.foodShortageHours) || 0),
    threatsActive: d.threatsActive === true,
    region: restoreRegion(d.region),
    stock: Object.fromEntries(CONSUMABLES.map(k => [k, Math.max(0, Math.floor(num(d.stock?.[k])))])),
    radio: restoreRadio(d.radio),
    recruitedCount: Math.max(0, Math.floor(num(d.recruitedCount))),
    threatTimer: Number.isFinite(d.threatTimer) ? d.threatTimer : null,
    scripted: restoreScripted(d.scripted),
    shelter: d.shelter && typeof d.shelter === 'object' ? { sealed: d.shelter.sealed === true, outside: Array.isArray(d.shelter.outside) ? d.shelter.outside.filter(n => typeof n === 'string').slice(0, 40) : [] } : null,
    migration: restoreMigration(d.migration),
    recovery: restoreRecovery(d.recovery),
    side: restoreSide(d.side),
    transition: d.transition === 'phase2' ? 'phase2' : null,
    operations: restoreOperations(d.operations),
    story: restoreStory(d.story),
  };
}
