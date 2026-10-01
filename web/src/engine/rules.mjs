// Pure rules derived from the data tables: building durability, survivor stats and geometry.
import { TUNING as T, WEAPONS, statFactor } from './survivors.mjs';
import { BUILDINGS, has } from './data.mjs';
import { isCampaignSurvivor, campaignMaxHp } from './crew.mjs';
import { campaignBuilding } from './campaignState.mjs';
export function buildingMaxHP(b) {
  // A campaign structure has the integrity the campaign gives it.
  if (b.model === 'campaign') return campaignBuilding(b.type)?.hp ?? BUILDINGS[b.type].hp;
  const extras = { fortify: 400, bunker: 600, storage: 80, reinforce: 150, plate: 250, ward: 120, reinforced_door: 150, deep_vault: 250, timber_kiln: 100, iron_lockers: 150, vault_lock: 300 };
  return BUILDINGS[b.type].hp + b.upgrades.reduce((n, id) => n + (extras[id] || 0), 0);
}
export const NEUTRAL = { str: 4, agi: 4, end: 4, int: 4, cha: 4 };
// Combat numbers come from the survivor's stats and equipped weapon (fists if none).
// Maximum health only depends on the survivor, so callers without the post building still get it right.
export function survivorStats(s, post = null, tower = null) {
  const E = T.effects, st = s.stats || NEUTRAL, weapon = WEAPONS[s.gear] || WEAPONS.fists;
  const guard = s.role === 'guard', sentry = (s.role === 'sentry' || s.stationed) && s.stationed;
  const towerBuilding = tower || (post?.type === 'tower' || post?.type === 'watchtower' ? post : null);
  const stats = {
    // A campaign survivor has 100 HP (+10 if Sturdy); a legacy one grows with Endurance.
    hp: isCampaignSurvivor(s) ? campaignMaxHp(s) : E.hpBase + E.hpPerEndurance * st.end + (guard ? 30 : 0),
    damage: weapon.damage * (weapon.melee ? statFactor(st.str, E.meleePerStrength) : statFactor(st.agi, E.rangedPerAgility)),
    range: weapon.range,
    speed: 32 * statFactor(st.agi, E.speedPerAgility),
    cooldown: weapon.cooldown * (2 - statFactor(st.agi, E.cooldownPerAgility)),
    armor: 1,
    weapon: weapon.name,
  };
  if (guard) {
    const barracks = post?.type === 'barracks' ? post : (post && has(post, 'drills') ? post : null);
    stats.damage *= 1.25 + (barracks && has(barracks, 'drills') ? .25 : 0);
    if (barracks && has(barracks, 'armory')) stats.armor *= .7;
    if (barracks && has(barracks, 'rally')) stats.speed *= 1.4;
    if (barracks && has(barracks, 'nightwatch')) stats.cooldown *= .7;
  }
  // A campaign Watchtower adds 5 tiles to a firearm's range and nothing else (spec B27); a Lookout adds nothing.
  if (sentry && isCampaignSurvivor(s)) {
    if (towerBuilding?.type === 'watchtower' && !weapon.melee) stats.range += (campaignBuilding('watchtower')?.firearmRangeBonus || 5) * 16;
  } else if (sentry) {
    stats.damage = stats.damage * 1.6 + (towerBuilding && has(towerBuilding, 'rounds') ? 6 : 0);
    stats.range += 50 + (towerBuilding && has(towerBuilding, 'scope') ? 45 : 0) + (towerBuilding && has(towerBuilding, 'spotlight') ? 55 : 0);
    stats.cooldown *= towerBuilding && has(towerBuilding, 'rapid') ? .55 : .7;
  }
  stats.damage = Math.round(stats.damage);
  return stats;
}
export function boundsOf(b, padding = 0) {
  const d = BUILDINGS[b.type];
  const w = b.rotation ? d.h : d.w, h = b.rotation ? d.w : d.h;
  return { left: b.x - w / 2 - padding, right: b.x + w / 2 + padding, top: b.y - h / 2 - padding, bottom: b.y + h / 2 + padding };
}
export function inside(p, r) { return p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom; }
export function rectDistance(p, r) { return Math.hypot(Math.max(r.left - p.x, 0, p.x - r.right), Math.max(r.top - p.y, 0, p.y - r.bottom)); }
