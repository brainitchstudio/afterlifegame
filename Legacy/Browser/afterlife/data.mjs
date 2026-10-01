// Constants and data tables shared by the simulation and the UI.
import { validateOptions } from './survivors.mjs';
// 1 game hour = 42 real seconds at 1×, so 10 game minutes = 7 s and a 24-hour day = 16 min 48 s.
export const HOUR_SECONDS = 42;
export const DAY_SECONDS = HOUR_SECONDS * 24;
export const RUN_DAYS = 24;
export const SAVE_VERSION = 3;
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
export const RESOURCE_NAMES = { wood: 'Wood', metal: 'Metal', food: 'Food' };
// Durations are in game hours (42 real seconds each). Costs are per member.
// Each trip can turn up a survivor; the depot's rail mechanic is an authored encounter with explicit overrides.
export const EXPEDITIONS = {
  woodland: { name: 'Woodland salvage', description: 'Recover timber from an abandoned logging camp.', hours: 4, cost: { food: 8 }, reward: { wood: 65, metal: 8 }, risk: .15, rescueChance: .12, recruit: { label: 'Lost hiker', options: {} } },
  depot: { name: 'Industrial depot', description: 'Search the old rail yard for machinery and weapons.', hours: 7, cost: { food: 12 }, reward: { wood: 15, metal: 40 }, risk: .3, rescueChance: .15, recruit: { label: 'Rail mechanic', options: { qualityFloor: 8, forcedPrimaryStat: 'int', forcedSecondaryStat: 'str' } }, weapon: { chance: .35, types: ['pistol', 'rifle'] } },
  market: { name: 'Empty supermarket', description: 'Bring back canned food and preserved supplies.', hours: 5, cost: { food: 6 }, reward: { food: 55, wood: 10 }, risk: .2, rescueChance: .25, recruit: { label: 'Stranded shopper', options: {} }, weapon: { chance: .15, types: ['pipe', 'pistol'] } },
};
for (const trip of Object.values(EXPEDITIONS)) validateOptions(trip.recruit.options);
export const TRADES = [
  { give: { wood: 60 }, get: { metal: 22 } },
  { give: { metal: 25 }, get: { wood: 70 } },
  { give: { wood: 40 }, get: { food: 35 } },
  { give: { food: 30 }, get: { wood: 50 } },
  { give: { metal: 20 }, get: { food: 30 } },
  { give: { food: 25 }, get: { metal: 15 } },
];
export const describeTrade = t => Object.entries(t.give).map(([r, n]) => n + ' ' + r).join(' + ') + ' for ' + Object.entries(t.get).map(([r, n]) => n + ' ' + r).join(' + ');
export const BUILDINGS = {
  core: { name: 'Refuge HQ', subtitle: 'The heart of your settlement', w: 80, h: 64, hp: 800, cost: {}, icon: '⌂', color: '#d6c69b' },
  farm: { name: 'Farm', subtitle: 'Grow food to sustain your survivors', w: 80, h: 64, hp: 190, cost: { wood: 45, metal: 8 }, icon: '♧', color: '#afc879' },
  dorm: { name: 'Bunkhouse', subtitle: 'Four beds for new survivors', w: 80, h: 64, hp: 280, cost: { wood: 60, metal: 15 }, icon: '▤', color: '#c6bba0' },
  workshop: { name: 'Workshop', subtitle: 'Produce wood and salvage metal', w: 80, h: 64, hp: 240, cost: { wood: 50, metal: 18 }, icon: '⚒', color: '#d3a56b' },
  clinic: { name: 'Clinic', subtitle: 'Treat the injured and speed recovery', w: 80, h: 64, hp: 210, cost: { wood: 55, metal: 30 }, icon: '✚', color: '#d98e8e' },
  barracks: { name: 'Barracks', subtitle: 'Train guards to hunt the dead; +2 beds', w: 80, h: 64, hp: 320, cost: { wood: 70, metal: 35 }, icon: '⚔', color: '#9fb7c9' },
  tower: { name: 'Watchtower', subtitle: 'Stands free, even outside the wall; guards keep watch from it in shifts', w: 32, h: 32, hp: 420, cost: { wood: 40, metal: 22 }, icon: '♜', color: '#c4c9a9' },
  barricade: { name: 'Barricade', subtitle: 'Slow the dead at your perimeter', w: 32, h: 16, hp: 300, cost: { wood: 12, metal: 2 }, icon: '▥', color: '#bca885' },
  gate: { name: 'Gate', subtitle: 'Seals a road, or makes a way through the fence; opens for your own', w: 64, h: 16, hp: 360, cost: { wood: 30, metal: 12 }, icon: '⊓', color: '#c9b27f' },
};
export const node = (id, name, description, cost, requires = null) => ({ id, name, description, cost, requires });
export const BUILDING_TREES = {
  core: [node('fortify', 'Reinforced walls', '+400 maximum integrity', { wood: 35, metal: 20 }), node('radio', 'Radio antenna', 'Recruit for 25% less food; +2 housing', { wood: 25, metal: 20 }), node('bunker', 'Last refuge', '+600 integrity; slowly self-repairs', { wood: 90, metal: 55 }, 'fortify'), node('beacon', 'Signal beacon', 'Walk-up survivors find you twice as often', { wood: 60, metal: 50 }, 'radio')],
  farm: [node('irrigation', 'Irrigation', '+50% food production', { wood: 25, metal: 12 }), node('storage', 'Seed stores', '+80 durability; +25% food production', { wood: 30, metal: 8 }), node('greenhouse', 'Greenhouse', '+75% production; full output at night', { wood: 65, metal: 35 }, 'irrigation'), node('harvest', 'Rich harvest', '+75% food production', { wood: 60, metal: 25 }, 'storage')],
  dorm: [node('bunks', 'Bunk beds', '+2 survivor spaces', { wood: 35, metal: 8 }), node('comfort', 'Warm bedding', 'Survivors heal 25% faster', { wood: 25, metal: 10 }), node('annex', 'Bunkhouse annex', '+4 survivor spaces', { wood: 80, metal: 30 }, 'bunks'), node('infirmary', 'Recovery room', 'Survivors heal 75% faster', { wood: 50, metal: 40 }, 'comfort')],
  workshop: [node('sawbench', 'Saw bench', '+60% wood production', { wood: 30, metal: 15 }), node('forge', 'Salvage forge', '+70% metal production', { wood: 25, metal: 20 }), node('machinery', 'Power tools', '+100% wood production; engineers repair 50% faster', { wood: 65, metal: 40 }, 'sawbench'), node('recycling', 'Recycling line', '+100% metal production', { wood: 60, metal: 45 }, 'forge')],
  clinic: [node('salves', 'Herbal salves', '+40% healing refuge-wide; medics +50%', { wood: 25, metal: 12 }), node('surgeon', 'Field surgeon', '40% less expedition injury risk', { wood: 30, metal: 15 }), node('ward', 'Recovery ward', '+120 durability; +40% healing; medics +50%', { wood: 55, metal: 30 }, 'salves'), node('antibiotics', 'Antibiotics', 'Survivors no longer lose health to starvation', { wood: 70, metal: 40 }, 'surgeon')],
  barracks: [node('drills', 'Combat drills', 'Guards deal +25% damage', { wood: 30, metal: 20 }), node('armory', 'Armory', 'Guards take 30% less damage', { wood: 30, metal: 25 }), node('rally', 'Rapid response', 'Guards move 40% faster and hunt 50% farther', { wood: 55, metal: 35 }, 'drills'), node('nightwatch', 'Night watch', 'Guards fire 30% faster; +2 guard posts', { wood: 60, metal: 45 }, 'armory')],
  tower: [node('scope', 'Long sight', '+45 attack range', { wood: 20, metal: 15 }), node('rounds', 'Heavy rounds', '+12 damage per shot', { wood: 20, metal: 20 }), node('spotlight', 'Spotlight', '+55 range; illuminate nearby dead', { wood: 45, metal: 35 }, 'scope'), node('rapid', 'Quick reload', 'Fire twice as fast', { wood: 50, metal: 45 }, 'rounds')],
  barricade: [node('reinforce', 'Cross bracing', '+150 durability', { wood: 14, metal: 4 }), node('wire', 'Barbed wire', 'Deal 4 damage/sec to attackers', { wood: 8, metal: 10 }), node('plate', 'Steel plating', '+250 durability', { wood: 20, metal: 18 }, 'reinforce'), node('spikes', 'Steel spikes', 'Deal 10 additional damage/sec', { wood: 15, metal: 22 }, 'wire')],
  gate: [node('reinforce', 'Cross bracing', '+150 durability', { wood: 24, metal: 8 }), node('wire', 'Barbed wire', 'Deal 4 damage/sec to attackers', { wood: 12, metal: 14 }), node('plate', 'Steel plating', '+250 durability', { wood: 30, metal: 30 }, 'reinforce'), node('spikes', 'Steel spikes', 'Deal 10 additional damage/sec', { wood: 22, metal: 32 }, 'wire')],
};
// Assigning a survivor to one of these buildings gives them a job. Everyone
// still fights anything in range; the role decides what they do in between.
export const ROLES = {
  patrol: { name: 'Patrol', icon: '◇', description: 'Goes out through the nearest gate and walks their side of the wall from outside, fighting anything in range. Climbs a watchtower inside the wall when wounded.' },
  medic: { name: 'Medic', building: 'clinic', icon: '✚', description: 'Works from the clinic: rescues the downed first, then treats patients who come in. Intelligence speeds treatment.' },
  engineer: { name: 'Engineer', building: 'workshop', icon: '⚒', description: 'Rebuilds fence panels the dead tore down, then repairs the most damaged building or barricade, spending wood as they work. Intelligence speeds repairs.' },
  farmer: { name: 'Farmer', building: 'farm', icon: '♧', description: 'Plants, tends and harvests. Each farmer raises the farm\'s output; Intelligence helps.' },
  guard: { name: 'Guard', building: 'barracks', icon: '⚔', description: 'Patrols all the way round outside the wall and runs down any zombie that comes close; mans the watchtowers when the alarm sounds. +30 health, +25% damage.' },
  sentry: { name: 'Sentry', building: 'tower', icon: '♜', description: 'A guard on watchtower duty. Walks out to the tower for an 8-hour shift, sees over the wall, spots the dead early and alerts the guards, then goes back to their bed to rest until the next shift. Everyone turns out when the alarm sounds. On the tower: +60% damage, +50 range, 30% faster fire.' },
  scavenger: { name: 'Scavenger', icon: '➚', description: 'Prepares supply runs at the HQ and is first in line for expeditions.' },
};
// Five jobs. Patrols, barracks guards and tower sentries are all Guards on different assignments.
export const JOBS = { guard: 'Guard', medic: 'Medic', engineer: 'Engineer', farmer: 'Farmer', scavenger: 'Scavenger' };
export const JOB_OF = { patrol: 'guard', guard: 'guard', sentry: 'guard', medic: 'medic', engineer: 'engineer', farmer: 'farmer', scavenger: 'scavenger' };
export const jobOf = s => JOB_OF[s.role || 'patrol'];
export const ROLE_FOR = { clinic: 'medic', workshop: 'engineer', farm: 'farmer', barracks: 'guard', tower: 'sentry' };
// A watchtower is kept in three 8-hour shifts, one sentry each. A new sentry takes the shift on
// now if it is open, otherwise the most dangerous. Each sets out an hour early so the watch
// changes on the platform.
export const SHIFTS = [{ name: 'Day', start: 6 }, { name: 'Evening', start: 14 }, { name: 'Night', start: 22 }];
export const SHIFT_HOURS = 8;
export const SHIFT_FILL_ORDER = [2, 1, 0];
export const shiftLabel = i => SHIFTS[i].name + ' ' + String(SHIFTS[i].start).padStart(2, '0') + ':00–' + String((SHIFTS[i].start + SHIFT_HOURS) % 24).padStart(2, '0') + ':00';
export function postSlots(b) { return { clinic: 2, workshop: 2, farm: 2, barracks: 4 + (has(b, 'nightwatch') ? 2 : 0), tower: SHIFTS.length }[b.type] || 0; }
export const NAMES = ['Mara', 'Elias', 'June', 'Theo', 'Rosa', 'Ash', 'Nico', 'Wren', 'Finn', 'Ada', 'Leon', 'Iris', 'Ezra', 'Kit', 'Sage', 'Milo', 'Bea', 'Owen', 'Luz', 'Remy'];
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const has = (entity, id) => entity.upgrades.includes(id);
export const LEGACY_DAY_SECONDS = 180;
