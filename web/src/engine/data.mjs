// Constants and data tables shared by the simulation and the UI.
import { validateOptions } from './survivors.mjs';
// Buildables, jobs, expeditions and their trees are authored in the content studio (backend/dashboard).
import * as CONTENT from './gameContent.mjs';
// 1 game hour = 42 real seconds at 1×, so 10 game minutes = 7 s and a 24-hour day = 16 min 48 s.
export const HOUR_SECONDS = 42;
export const DAY_SECONDS = HOUR_SECONDS * 24;
export const RUN_DAYS = 24;
export const SAVE_VERSION = 4;
export const SIDES = ['any', 'north', 'east', 'south', 'west'];
// The 24-hour day in five phases. Hours run 0-24; midnight wraps past 24.
export const PHASES = [
  { id: 'dawn', name: 'Dawn', start: 5, end: 8 },
  { id: 'day', name: 'Daylight', start: 8, end: 17 },
  { id: 'dusk', name: 'Dusk', start: 17, end: 20 },
  { id: 'midnight', name: 'Midnight swarm', start: 20, end: 25 },
  { id: 'deep', name: 'Dead of night', start: 1, end: 5 },
];
export const phaseAt = hour => PHASES.find(p => (hour >= p.start && hour < p.end) || hour + 24 < p.end) || PHASES[1];
// Circadian pressure 0-1: a flat trough around 11:00 and a sharp peak at 23:00.
export const circadian = hour => ((1 - Math.cos(2 * Math.PI * (hour - 11) / 24)) / 2) ** 3;
export const DIRECTOR_STATES = ['lull', 'buildup', 'peak', 'relief'];
export const EDGES = ['north', 'east', 'south', 'west'];
// Every ledger resource's display name (campaign content), and how amounts read in the UI: "12 wood · 4 scrap".
export const RESOURCE_NAMES = Object.fromEntries(Object.entries(CONTENT.CAMPAIGN.resources).map(([id, r]) => [id, r.name]));
const RESOURCE_SHORT = { scrap_metal: 'scrap', medical_supplies: 'med supplies', seed_packets: 'seeds', raw_salvage: 'raw salvage', metal_parts: 'metal parts' };
export const resourceLabel = r => RESOURCE_SHORT[r] || (RESOURCE_NAMES[r] || r).toLowerCase();
export const amountsText = c => Object.entries(c || {}).map(([r, n]) => n + ' ' + resourceLabel(r)).join(' · ');
// Durations are in game hours (42 real seconds each). Costs are per member.
// Each trip can turn up a survivor; recruit options can force an authored encounter (the depot's rail mechanic).
export const EXPEDITIONS = CONTENT.EXPEDITIONS;
for (const trip of Object.values(EXPEDITIONS)) validateOptions(trip.recruit.options);
export const TRADES = [
  { give: { wood: 60 }, get: { scrap_metal: 22 } },
  { give: { scrap_metal: 25 }, get: { wood: 70 } },
  { give: { wood: 40 }, get: { food: 35 } },
  { give: { food: 30 }, get: { wood: 50 } },
  { give: { scrap_metal: 20 }, get: { food: 30 } },
  { give: { food: 25 }, get: { scrap_metal: 15 } },
];
export const describeTrade = t => Object.entries(t.give).map(([r, n]) => n + ' ' + resourceLabel(r)).join(' + ') + ' for ' + Object.entries(t.get).map(([r, n]) => n + ' ' + resourceLabel(r)).join(' + ');
// Every structure: footprint, integrity, cost and look. Fixtures come with the starter camp and
// can't be built from the catalog.
export const BUILDINGS = CONTENT.BUILDINGS;
// Each structure's upgrade tree. What an upgrade does is written in code against its id.
export const BUILDING_TREES = CONTENT.BUILDING_TREES;
// Assigning a survivor to one of these buildings gives them a job. Everyone
// still fights anything in range; the role decides what they do in between.
export const ROLES = CONTENT.ROLES;
// The jobs. Patrols, barracks guards and tower sentries are all Guards on different assignments.
export const JOBS = CONTENT.JOBS;
export const JOB_OF = CONTENT.JOB_OF;
export const jobOf = s => JOB_OF[s.role || 'patrol'];
export const ROLE_FOR = CONTENT.ROLE_FOR;
// The crew screen's career cards: each job with its workplace (its first staffed post unless the
// content names one), that post's slots, its career ranks and its perk tree.
export const JOBS_CONFIG = Object.entries(JOBS).map(([id, name]) => {
  const career = CONTENT.CAREERS[id] || {};
  const posts = Object.entries(CONTENT.POSTS).filter(([, p]) => JOB_OF[p.role] === id);
  const workplace = career.workplace || posts.find(([, p]) => p.role === id)?.[0] || posts[0]?.[0] || 'core';
  return {
    id, name, role: id, icon: ROLES[id]?.icon || ROLES[posts[0]?.[1].role]?.icon || '◆', description: career.description || '',
    primaryStat: career.primaryStat, secondaryStat: career.secondaryStat, statScalingFormula: career.scaling || '',
    baseBuilding: workplace, baseBuildingName: career.workplaceName || BUILDINGS[workplace]?.name || workplace,
    postSlots: CONTENT.POSTS[workplace]?.slots || 0, buildingBonuses: career.workplaceBonus || '', careerRanks: career.careerRanks || [],
  };
});
export const JOB_BY_ID = Object.fromEntries(JOBS_CONFIG.map(j => [j.id, j]));
export const JOB_UPGRADES_BY_ROLE = CONTENT.JOB_PERKS.reduce((acc, p) => { (acc[p.job] ??= []).push(p); return acc; }, {});
// A watchtower is kept in three 8-hour shifts, one sentry each. A new sentry takes the shift on
// now if it is open, otherwise the most dangerous. Each sets out an hour early so the watch
// changes on the platform.
export const SHIFTS = [{ name: 'Day', start: 6 }, { name: 'Evening', start: 14 }, { name: 'Night', start: 22 }];
export const SHIFT_HOURS = 8;
export const SHIFT_FILL_ORDER = [2, 1, 0];
export const shiftLabel = i => SHIFTS[i].name + ' ' + String(SHIFTS[i].start).padStart(2, '0') + ':00–' + String((SHIFTS[i].start + SHIFT_HOURS) % 24).padStart(2, '0') + ':00';
// A post's slots, plus any its building's upgrades add.
export function postSlots(b) { const p = CONTENT.POSTS[b.type]; return p ? p.bonus.reduce((n, x) => n + (has(b, x.upgrade) ? x.slots : 0), p.slots) : 0; }
export const NAMES = ['Mara', 'Elias', 'June', 'Theo', 'Rosa', 'Ash', 'Nico', 'Wren', 'Finn', 'Ada', 'Leon', 'Iris', 'Ezra', 'Kit', 'Sage', 'Milo', 'Bea', 'Owen', 'Luz', 'Remy'];
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const has = (entity, id) => entity.upgrades.includes(id);
export const LEGACY_DAY_SECONDS = 180;
