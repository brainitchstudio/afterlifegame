// The save format, one schema per SAVE_VERSION. A save must pass before restore() touches the game.
// Only vendor/valibot.mjs is imported here, so swapping the library touches this file alone.
// Unknown extra fields are allowed and kept (looseObject), so checks can still read them.
import * as v from './vendor/valibot.mjs';
import { validLand } from './land.mjs';
import { TUNING as T, WEAPONS, STAT_KEYS, CONDITIONS } from './survivors.mjs';
import { DAY_SECONDS, RUN_DAYS, SIDES, EXPEDITIONS, BUILDINGS, BUILDING_TREES, ROLES } from './data.mjs';

const finite = v.pipe(v.number(), v.finite());
const id = v.pipe(v.number(), v.integer());
const optionalId = v.nullish(id);
const name = v.pipe(v.string(), v.maxLength(49));
const amount = v.pipe(finite, v.minValue(0));
const gear = v.picklist(Object.keys(WEAPONS).filter(k => k !== 'fists'));

const stats = v.strictObject(Object.fromEntries(STAT_KEYS.map(k => [k, v.pipe(id, v.minValue(1), v.maxValue(T.generation.cap))])));
const aptitudes = v.pipe(
  v.looseObject({ primary: v.picklist(STAT_KEYS), secondary: v.picklist(STAT_KEYS), weak: v.picklist(STAT_KEYS) }),
  v.check(a => new Set([a.primary, a.secondary, a.weak]).size === 3, 'Primary, secondary and weak stats must differ'));
const gen = v.looseObject({ seed: finite, version: finite, source: v.string() });

// Buildings, survivors and zombies share an id space and a position. Only the downed may sit at zero health.
const entity = { id, x: finite, y: finite, hp: finite };
const alive = v.check(e => e.hp > 0 || (e.condition === 'downed' && e.hp === 0), 'Health must be above zero unless downed');

const building = v.pipe(
  v.looseObject({ ...entity, type: v.picklist(Object.keys(BUILDINGS)), upgrades: v.array(v.string()) }),
  v.check(b => b.upgrades.every(u => BUILDING_TREES[b.type].some(n => n.id === u)), 'Unknown upgrade for this building'),
  alive);
const zombie = v.pipe(
  v.looseObject({ ...entity, kind: v.picklist(['walker', 'runner', 'brute']), speed: finite, damage: finite, maxHP: finite, seed: finite }),
  alive);
// An expedition is absent, falsy, or a trip that still has time left.
const trip = v.pipe(
  v.looseObject({ kind: v.picklist(Object.keys(EXPEDITIONS)), remaining: finite, total: finite }),
  v.check(e => e.remaining > 0 && e.remaining <= e.total, 'Trip time must be within its total'));
const expedition = v.optional(v.union([v.literal(null), v.literal(false), v.literal(0), v.literal(''), trip]));

const survivorV1 = {
  ...entity, role: v.optional(v.picklist(Object.keys(ROLES))), post: optionalId, side: v.picklist(SIDES), name,
  level: v.pipe(finite, v.minValue(1)), xp: finite, look: finite, cooldown: finite, patrolIndex: finite, lastHit: finite, expedition,
};
// Version 3 added generated stats, conditions, beds, gear and clinic care.
const survivorV3 = {
  ...survivorV1, stats, aptitudes, gen, unspent: finite, condition: v.picklist(CONDITIONS),
  home: optionalId, weapon: optionalId, shelter: optionalId, rescue: optionalId, rescuer: optionalId, careAt: optionalId,
  gear: v.nullish(gear), care: v.nullish(v.picklist(['seek', 'waiting'])),
};
const bleeding = v.check(s => s.condition !== 'downed' || (Number.isFinite(s.bleed) && s.bleed > 0 && Number.isFinite(s.stabilize)), 'Downed survivors need bleed-out and stabilize timers');
const item = v.looseObject({ id, type: gear, holder: optionalId });
const candidate = v.looseObject({ id, name, look: finite, level: finite, stats, aptitudes, gen, expiresAt: finite, source: v.string() });

const common = {
  elapsed: v.pipe(finite, v.minValue(0), v.maxValue(DAY_SECONDS * RUN_DAYS)),
  status: v.picklist(['playing', 'won', 'lost']),
  resources: v.looseObject({ wood: amount, metal: amount, food: amount }),
  buildings: v.pipe(v.array(building), v.maxLength(500)),
  zombies: v.pipe(v.array(zombie), v.maxLength(220)),
  kills: finite, nextId: finite, spawnTimer: finite, recruitTimer: finite, recruited: finite,
  alerts: v.optional(v.custom(a => !Array.isArray(a) || a.every(x => x != null), 'Alerts cannot contain null')),
};
const land = v.custom(validLand, 'Land must be a connected set of owned parcels');
const survivors = shape => v.pipe(v.array(v.pipe(v.looseObject(shape), alive, ...(shape === survivorV3 ? [bleeding] : []))), v.maxLength(150));

const ids = d => [...d.buildings, ...d.survivors, ...d.zombies, ...(d.version >= 3 ? [...d.items, ...d.candidates] : [])].map(e => e.id);
export const SaveSchema = v.pipe(
  v.variant('version', [
    v.looseObject({ version: v.literal(1), ...common, survivors: survivors(survivorV1) }),
    // Version 2 added purchasable land.
    v.looseObject({ version: v.literal(2), ...common, land, survivors: survivors(survivorV1) }),
    // Version 3 added survivor stats, the weapon stockpile and recruitment offers.
    v.looseObject({ version: v.literal(3), ...common, land, survivors: survivors(survivorV3), items: v.pipe(v.array(item), v.maxLength(300)), candidates: v.pipe(v.array(candidate), v.maxLength(20)) }),
  ]),
  v.check(d => new Set(ids(d)).size === ids(d).length, 'Ids must be unique'),
  v.check(d => d.status === 'lost' || d.buildings.filter(b => b.type === 'core' || b.type === 'campfire').length === 1, 'A game in progress needs exactly one HQ or campfire'),
  v.check(d => d.nextId > Math.max(0, ...ids(d)), 'nextId must be above every id'));

// '' when the parsed save is valid, otherwise where and why the first problem is.
export function checkSave(data) {
  const result = v.safeParse(SaveSchema, data);
  if (result.success) return '';
  const issue = result.issues[0], path = v.getDotPath(issue);
  return (path ? path + ': ' : '') + issue.message;
}
