// Survivor system data and the deterministic stat generator (V1).
// Every balance knob lives in TUNING. In-world durations are in game hours;
// the model converts them with HOUR_SECONDS (1 game hour = 42 real seconds).
import * as CONTENT from './gameContent.mjs';

export const GENERATOR_VERSION = 1;
export const STAT_KEYS = ['str', 'agi', 'end', 'int', 'cha'];
export const STAT_NAMES = { str: 'Strength', agi: 'Agility', end: 'Endurance', int: 'Intelligence', cha: 'Charisma' };
export const STAT_USES = { str: 'Melee damage, carrying loot', agi: 'Speed, aim and fire rate', end: 'Health and bleed-out time', int: 'Medicine, repairs and farming', cha: 'Trade and recruitment' };
export const CONDITIONS = ['healthy', 'injured', 'downed'];

export const TUNING = {
  generation: { base: 15, factor: .75, floor: 2, startCap: 8, cap: 10, minBudget: 17, maxBudget: 30, aptitude: { primary: 1.6, secondary: 1.3, weak: .7, other: 1 } },
  // Provisional stat-to-output coefficients. A stat of 4 (close to the 4.5 average) is neutral.
  effects: {
    hpBase: 60, hpPerEndurance: 9,
    meleePerStrength: .075, rangedPerAgility: .0375, speedPerAgility: .0375, cooldownPerAgility: .0375,
    workPerIntelligence: .1, carryPerStrength: .04, bleedPerEndurance: .075, charismaTrade: .03, charismaRecruit: .03, charismaWalkUp: .05,
  },
  xp: { base: 45, perLevel: 15, kill: 12, dutyPerSecond: .045, expedition: 25, rescue: 10, treatPerSecond: .05 },
  health: { injuryThreshold: .5, seriousThreshold: .25, recoveryThreshold: .9, bleedOutHours: 3, stabilizeSeconds: 4, fallbackStabilizeSeconds: 10, reviveShare: .2, safeRadius: 90, medicRate: 4 },
  defense: { towerSight: 330, alertMergeRadius: 120, alertTimeoutHours: .5, localReportRange: 220, dispatch: [[1, 1], [5, 2], [Infinity, 3]], largeGroup: 6, allClearHours: 1 },
  combat: { attackRadius: 340, attackGroup: 3, sight: 170, investigateSeconds: 8 },
  shelter: { core: 8, barracks: 6, tower: 2 },
  farming: { farmerBonus: .3 },
  recruitment: { broadcastHours: .5, offerHours: 6, walkUpMinRenown: 10, walkUpBase: .03, walkUpPerRenown: .006, walkUpOfferHours: 4, maxOpenOffers: 3 },
  // Population → maximum expedition party size (a cap, not a requirement).
  expeditionParty: [[5, 1], [10, 2], [20, 3], [35, 4], [Infinity, 5]],
  expedition: { extraMemberReward: .6, extraMemberRisk: .15, deathShareOfRisk: .12, injuryDamage: 25 },
  // Open: consumption stays continuous until crops and rewards are tuned together.
  food: { perSurvivorPerSecond: .024 },
};

// Authored in the content studio (backend/dashboard). Fists are what anyone without gear fights with.
export const WEAPONS = CONTENT.WEAPONS;
// Equipment policy: the first available item in a job's list wins; a survivor only swaps for a better one.
export const GEAR_PREFERENCE = { guard: ['rifle', 'pistol', 'pipe'], default: ['pistol', 'rifle', 'pipe'] };
// A campaign hands out melee gear to everyone; firearms go to guards only.
export const CAMPAIGN_GEAR_PREFERENCE = { guard: ['basic_pistol', 'reinforced_club', 'improvised_spear', 'wooden_club'], default: ['reinforced_club', 'improvised_spear', 'wooden_club'] };

export const partyCap = population => TUNING.expeditionParty.find(([max]) => population <= max)[1];
export const statFactor = (value, per) => 1 + (value - 4) * per;

// cyrb53-style string hash → unsigned 32-bit seed; documented and stable across versions.
export function hashSeed(...parts) {
  const text = parts.join('|');
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 ^ h1) >>> 0;
}
// mulberry32 stream with small helpers.
export function stream(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    weighted(weights) {
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = next() * total;
      for (let i = 0; i < weights.length; i++) { if (weights[i] > 0 && roll < weights[i]) return i; roll -= weights[i]; }
      return weights.findLastIndex(w => w > 0);
    },
  };
}

export const DEFAULT_OPTIONS = { qualityFloor: 3, qualityShift: 0, budgetBonus: 0, forcedPrimaryStat: null, forcedSecondaryStat: null, forcedWeakStat: null, levelOverride: 1 };
// Content validation: throws on invalid overrides so bad quest/encounter data fails at load time.
export function validateOptions(options = {}) {
  const o = { ...DEFAULT_OPTIONS, ...options };
  const int = v => Number.isInteger(v);
  if (!int(o.qualityFloor) || o.qualityFloor < 3 || o.qualityFloor > 18) throw new Error('qualityFloor must be an integer from 3 to 18');
  if (!int(o.qualityShift) || Math.abs(o.qualityShift) > 15) throw new Error('qualityShift must be an integer from -15 to 15');
  if (!int(o.budgetBonus) || Math.abs(o.budgetBonus) > 13) throw new Error('budgetBonus is out of range');
  if (!int(o.levelOverride) || o.levelOverride < 1 || o.levelOverride > 50) throw new Error('levelOverride must be an integer from 1 to 50');
  const forced = [o.forcedPrimaryStat, o.forcedSecondaryStat, o.forcedWeakStat].filter(Boolean);
  if (forced.some(k => !STAT_KEYS.includes(k))) throw new Error('Unknown forced stat');
  if (new Set(forced).size !== forced.length) throw new Error('A stat can hold only one aptitude role');
  return o;
}

function allocate(stats, weights, count, cap, per, rng) {
  let unspent = 0;
  for (let n = 0; n < count; n++) {
    const w = STAT_KEYS.map(k => stats[k] < cap ? weights[k] * (cap - stats[k]) / per : 0);
    if (!w.some(x => x > 0)) { unspent++; continue; }
    stats[STAT_KEYS[rng.weighted(w)]]++;
  }
  return unspent;
}
export function aptitudeWeights(aptitudes) {
  const A = TUNING.generation.aptitude;
  return Object.fromEntries(STAT_KEYS.map(k => [k, k === aptitudes.primary ? A.primary : k === aptitudes.secondary ? A.secondary : k === aptitudes.weak ? A.weak : A.other]));
}

// Generates a survivor's permanent starting stats. The same world seed, survivor id,
// spawn event id, options and generator version always give the same survivor.
export function generateStats(worldSeed, survivorId, eventId, options = {}) {
  const o = validateOptions(options), G = TUNING.generation;
  const seed = hashSeed(worldSeed, survivorId, eventId, GENERATOR_VERSION);
  const rngQ = stream(hashSeed(seed, 'quality')), rngA = stream(hashSeed(seed, 'aptitude')), rngS = stream(hashSeed(seed, 'allocation')), rngL = stream(hashSeed(seed, 'experience'));
  const rawQuality = rngQ.int(1, 6) + rngQ.int(1, 6) + rngQ.int(1, 6);
  const quality = Math.min(18, Math.max(3, Math.max(rawQuality + o.qualityShift, o.qualityFloor)));
  const budget = Math.min(G.maxBudget, Math.max(G.minBudget, G.base + Math.floor(G.factor * quality) + o.budgetBonus));
  const pool = STAT_KEYS.filter(k => ![o.forcedPrimaryStat, o.forcedSecondaryStat, o.forcedWeakStat].includes(k));
  const pick = () => pool.splice(rngA.int(0, pool.length - 1), 1)[0];
  const aptitudes = { primary: o.forcedPrimaryStat || pick(), secondary: o.forcedSecondaryStat || pick(), weak: o.forcedWeakStat || pick() };
  const stats = Object.fromEntries(STAT_KEYS.map(k => [k, G.floor]));
  const weights = aptitudeWeights(aptitudes);
  if (allocate(stats, weights, budget - G.floor * STAT_KEYS.length, G.startCap, 6, rngS)) throw new Error('Budget exceeds the starting stat cap');
  const unspent = allocate(stats, weights, o.levelOverride - 1, G.cap, 8, rngL);
  return { stats, aptitudes, rawQuality, quality, budget, seed, generatorVersion: GENERATOR_VERSION, level: o.levelOverride, unspent };
}

// GrantLevelStatPoint with the V1 automatic policy: seeded, aptitude-weighted, capped at 10.
// The stream is keyed by survivor seed and level, so a reload never changes the outcome.
export function grantStatPoint(stats, aptitudes, seed, level) {
  const G = TUNING.generation;
  const w = STAT_KEYS.map(k => stats[k] < G.cap ? aptitudeWeights(aptitudes)[k] * (G.cap - stats[k]) / 8 : 0);
  if (!w.some(x => x > 0)) return null;
  const key = STAT_KEYS[stream(hashSeed(seed, 'level', level)).weighted(w)];
  stats[key]++;
  return key;
}
