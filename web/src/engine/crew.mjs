// Campaign survivors: generation (stats 1-10, traits, the starting crew's archetypes), jobs and their
// proficiency, the labor factor that scales every kind of work, fatigue, morale and starvation.
// Legacy survivors keep the level/XP model in survivors.mjs. Installed onto Game.prototype by model.mjs.
import { CAMPAIGN } from './campaignState.mjs';
import { hashSeed, stream } from './survivors.mjs';
import { HOUR_SECONDS, DAY_SECONDS } from './data.mjs';

const S = CAMPAIGN.tuning.survivors, L = CAMPAIGN.tuning.labor, F = CAMPAIGN.tuning.fatigue, FOOD = CAMPAIGN.tuning.food, H = CAMPAIGN.tuning.health;
export const CORE_STATS = ['str', 'end', 'agi', 'int'];
export const CAMPAIGN_STATS = [...CORE_STATS, 'cha'];
export const CAMPAIGN_GENERATOR_VERSION = 1;
export const quality = stats => CORE_STATS.reduce((n, k) => n + stats[k], 0);
export const isCampaignSurvivor = s => s?.model === 'campaign';

// A survivor's permanent stats and traits from stable ids. `archetype` is one of the starting crew's
// A-E; `start` applies the starting crew's floors; `qualityMin` raises weak rolls (the first recruit's).
export function generateCampaignSurvivor(worldSeed, id, eventId, { archetype = null, start = false, qualityMin = 0 } = {}) {
  const seed = hashSeed(worldSeed, id, eventId, 'campaign', CAMPAIGN_GENERATOR_VERSION);
  const rng = stream(seed);
  const lo = start ? S.startStatMin : S.statMin, hi = S.statMax;
  // Each stat is a bell around the mean: the sum of three uniform rolls.
  const roll = () => Math.round(S.statMean + (rng.next() + rng.next() + rng.next() - 1.5) * S.statSpread * 2);
  const stats = Object.fromEntries(CAMPAIGN_STATS.map(k => [k, Math.min(hi, Math.max(lo, roll()))]));
  const mins = S.archetypes.find(a => a.id === archetype)?.min || {};
  for (const [k, v] of Object.entries(mins)) stats[k] = Math.max(stats[k], v);
  const floor = Math.max(qualityMin, start ? S.startQualityMin : 0);
  while (quality(stats) < floor) { const k = CORE_STATS.filter(x => stats[x] < hi).sort((a, b) => stats[a] - stats[b])[0]; if (!k) break; stats[k]++; }
  return { stats, traits: rollTraits(rng, start), seed };
}

// Up to two traits, at most one drawback. The starting crew never rolls the excluded ones.
function rollTraits(rng, start) {
  const pool = Object.entries(CAMPAIGN.traits).filter(([id]) => !start || !S.excludedStartTraits.includes(id));
  const out = [];
  for (const chance of S.traitRolls.slice(0, S.maxTraits)) {
    if (rng.next() >= chance) break;
    const drawback = rng.next() < S.drawbackShare && !out.some(t => CAMPAIGN.traits[t].type === 'drawback');
    const options = pool.filter(([id, t]) => !out.includes(id) && (t.type === 'drawback') === drawback);
    if (!options.length) continue;
    out.push(options[Math.floor(rng.next() * options.length)][0]);
  }
  return out;
}

// The legacy save format wants aptitudes; a campaign survivor's are simply their best, second and worst stats.
export function aptitudesOf(stats) {
  const order = [...CAMPAIGN_STATS].sort((a, b) => stats[b] - stats[a] || CAMPAIGN_STATS.indexOf(a) - CAMPAIGN_STATS.indexOf(b));
  return { primary: order[0], secondary: order[1], weak: order.at(-1) };
}

const traitsOf = s => (s.traits || []).map(id => CAMPAIGN.traits[id]).filter(Boolean);
export const campaignMaxHp = s => S.baseHP + traitsOf(s).reduce((n, t) => n + (t.modifiers.maxHp || 0), 0);
export const traitBonus = (s, category) => traitsOf(s).reduce((n, t) => n + (t.modifiers.labor?.[category] || 0), 0);

// The campaign job behind each engine role. Unassigned survivors are General Workers.
const JOB_FOR_ROLE = { farmer: 'farmer', engineer: 'engineer', medic: 'medic', scavenger: 'scavenger', guard: 'guard', sentry: 'guard' };
export const campaignJob = s => JOB_FOR_ROLE[s.role] || 'general_worker';

// Labor factor = attribute factor x job multiplier x (1 + proficiency + traits) x health factor x fatigue factor.
export const attributeFactor = value => L.attributeBase + L.attributePer * value;
export const healthFactor = share => L.healthBands.find(b => share > b.above)?.factor ?? 0;
export const fatigueFactor = fatigue => L.fatigueBands.find(b => fatigue <= b.upTo)?.factor ?? 0;
export function laborFactor(s, category, { job = campaignJob(s), hpShare = s.hp / campaignMaxHp(s) } = {}) {
  const def = CAMPAIGN.jobs[job];
  const attr = L.attributeFor[category] || def?.attribute || 'str';
  const jobMult = def?.multiplierAppliesTo?.includes(category) ? def.multiplier : 1;
  const proficiency = (s.proficiency?.[job] || 0) * L.proficiencyBonusPerPoint;
  return attributeFactor(s.stats[attr]) * jobMult * (1 + proficiency + traitBonus(s, category)) * healthFactor(hpShare) * fatigueFactor(s.fatigue || 0);
}

// A saved campaign survivor's own fields, checked and clamped; unknown traits and jobs are dropped.
export function restoreCrewFields(s) {
  const num = (v, lo, hi, d) => Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  const perJob = o => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([j, v]) => CAMPAIGN.jobs[j] && Number.isFinite(v)));
  s.traits = Array.isArray(s.traits) ? [...new Set(s.traits.filter(t => CAMPAIGN.traits[t]))].slice(0, S.maxTraits) : [];
  s.proficiency = Object.fromEntries(Object.entries(perJob(s.proficiency)).map(([j, v]) => [j, num(Math.floor(v), 0, L.proficiencyMax, 0)]));
  s.laborHours = Object.fromEntries(Object.entries(perJob(s.laborHours)).map(([j, v]) => [j, num(v, 0, L.proficiencyHoursPerPoint, 0)]));
  s.fatigue = num(s.fatigue, 0, 100, 0);
  s.morale = num(s.morale, 0, S.moraleMax, S.startMorale);
  s.exhausted = s.exhausted === true;
  // Medicine (medical.mjs) and guard orders (defense.mjs).
  s.bleeding = s.bleeding === true;
  s.infection = num(s.infection, 0, 100, 0);
  s.turnAt = s.infection >= 100 && Number.isFinite(s.turnAt) ? s.turnAt : null;
  for (const k of ['bandageAt', 'kitAt', 'treatedAt']) if (!Number.isFinite(s[k])) delete s[k];
  if (!['intercept', 'hold'].includes(s.stance)) delete s.stance;
  if (![0, 1].includes(s.guardRoute)) delete s.guardRoute;
  s.lift = num(s.lift, 0, 1, 0);
  s.entering = num(s.entering, 0, 1e4, 0);
  s.hp = Math.min(s.hp, campaignMaxHp(s));
}

export class Crew {
  // The fields a campaign survivor carries on top of the shared ones.
  campaignFields(c) {
    return { model: 'campaign', traits: [...(c.traits || [])], proficiency: {}, laborHours: {}, fatigue: 0, morale: S.startMorale, exhausted: false };
  }
  // What a survivor is doing for fatigue this hour: resting (housed or not), off-site, fighting, working or working late.
  fatigueActivity(s) {
    if (s.expedition || this.onMission(s)) return 'offsite';
    if (s.care === 'waiting') return 'housedRest';
    if (s.sheltered && s.shelter != null) return 'unhousedRest';
    if (s.resting) return this.buildings.some(b => b.id === s.restAt && b.id === s.home) ? 'housedRest' : 'unhousedRest';
    if (s.fighting) return 'combat';
    if (s.condition === 'downed') return null;
    return this.workShift ? 'work' : 'overtime';
  }
  // Fatigue, proficiency and morale for every campaign survivor; starvation for the camp.
  crewTick(dt) {
    if (!this.campaign) return;
    const hours = dt / HOUR_SECONDS;
    for (const s of this.survivors) {
      if (!isCampaignSurvivor(s)) continue;
      const activity = this.fatigueActivity(s);
      if (activity) {
        const rate = F[activity] * (F[activity] > 0 ? 1 + traitsOf(s).reduce((n, t) => n + (t.modifiers.fatigueCost || 0), 0) : 1);
        s.fatigue = Math.min(100, Math.max(0, s.fatigue + rate * hours));
      }
      // At 100 fatigue a survivor stops and rests until they are back down to the recovery mark.
      if (s.fatigue > 85 && s.fatigue - (F[activity] || 0) * hours <= 85) this.campaignAlert('UI_FATIGUE', { survivorName: s.name });
      if (s.fatigue >= F.forcedRestAt && !s.exhausted) { s.exhausted = true; this.notify(s.name + ' collapsed into rest', 'Exhausted. They will not work until they have recovered.', 'warn'); }
      else if (s.exhausted && s.fatigue <= F.forcedRestUntil) s.exhausted = false;
      // Effective labor builds proficiency in the current job: +1 per 4 effective hours, up to 20.
      if (activity === 'work' || activity === 'overtime') {
        const job = campaignJob(s), effort = hours * healthFactor(s.hp / campaignMaxHp(s)) * fatigueFactor(s.fatigue);
        s.laborHours[job] = (s.laborHours[job] || 0) + effort;
        while (s.laborHours[job] >= L.proficiencyHoursPerPoint && (s.proficiency[job] || 0) < L.proficiencyMax) {
          s.laborHours[job] -= L.proficiencyHoursPerPoint;
          s.proficiency[job] = (s.proficiency[job] || 0) + 1;
        }
        if ((s.proficiency[job] || 0) >= L.proficiencyMax) s.laborHours[job] = 0;
      }
      // Light wounds mend slowly while resting; real treatment comes from a medic.
      if (s.resting && s.condition !== 'downed') s.hp = Math.min(campaignMaxHp(s), s.hp + H.restHealPerHour * hours);
    }
    this.starvation(dt);
    // Under a day and a half of food: CentroCom says so (at most every two hours).
    const perDay = this.dailyFoodDemand, days = perDay > 0 ? this.available('food') / perDay : Infinity;
    if (days < 1.5 && this.campaign.tasks) this.campaignAlert('UI_FOOD_LOW', { foodDays: days.toFixed(1) });
  }
  // Without food for 12 hours morale falls 5 a day; after 24 hours health falls 10 a day. In Phase 1 hunger
  // never takes anyone below 1 HP.
  starvation(dt) {
    const c = this.campaign;
    c.foodShortageHours = this.resources.food <= 1e-9 ? (c.foodShortageHours || 0) + dt / HOUR_SECONDS : 0;
    if (c.foodShortageHours <= FOOD.moraleShortageHours) return;
    const days = dt / DAY_SECONDS, floor = c.phase < 2 ? FOOD.phase1HpFloor : 0;
    for (const s of this.survivors) {
      if (!isCampaignSurvivor(s) || s.expedition) continue;
      s.morale = Math.max(0, s.morale + FOOD.moralePerDay * days);
      if (c.foodShortageHours > FOOD.healthShortageHours && s.condition !== 'downed') {
        s.hp = Math.max(Math.min(s.hp, floor), s.hp + FOOD.hpPerDay * days);
        if (s.hp <= 0) this.down(s);
      }
    }
  }
}
