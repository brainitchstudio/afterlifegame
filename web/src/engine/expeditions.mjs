// Parties, departures and returns. Installed onto Game.prototype by model.mjs.
import { TUNING as T, WEAPONS, partyCap } from './survivors.mjs';
import { HOUR_SECONDS, EXPEDITIONS, has, resourceLabel } from './data.mjs';
import { survivorStats } from './rules.mjs';
import { POI_EXPEDITIONS } from './worldgen.mjs';

export function pathInterpolate(points, t) {
  if (!points || !points.length) return { x: 0, y: 0, facing: 1 };
  if (points.length === 1 || t <= 0) return { x: points[0].x, y: points[0].y, facing: 1 };
  if (t >= 1) {
    const last = points.at(-1), prev = points.at(-2) || last;
    return { x: last.x, y: last.y, facing: last.x >= prev.x ? 1 : -1 };
  }
  let total = 0;
  const dists = [];
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    dists.push(d);
    total += d;
  }
  if (total === 0) return { x: points[0].x, y: points[0].y, facing: 1 };
  let targetDist = t * total;
  for (let i = 0; i < dists.length; i++) {
    if (targetDist <= dists[i] || i === dists.length - 1) {
      const segT = dists[i] > 0 ? Math.min(1, targetDist / dists[i]) : 0;
      const x = points[i].x + (points[i + 1].x - points[i].x) * segT;
      const y = points[i].y + (points[i + 1].y - points[i].y) * segT;
      const facing = points[i + 1].x >= points[i].x ? 1 : -1;
      return { x, y, facing };
    }
    targetDist -= dists[i];
  }
  const last = points.at(-1), prev = points.at(-2) || last;
  return { x: last.x, y: last.y, facing: last.x >= prev.x ? 1 : -1 };
}

export class Expeditions {
  get partyCap() { return partyCap(this.survivors.length); }
  findExpedition(kind) {
    if (EXPEDITIONS[kind]) return EXPEDITIONS[kind];
    if (POI_EXPEDITIONS[kind]) return POI_EXPEDITIONS[kind];
    if (kind && String(kind).startsWith('poi:')) {
      const id = parseInt(String(kind).slice(4), 10);
      const poi = this.worldPois?.find(p => p.id === id);
      if (poi && POI_EXPEDITIONS[poi.type]) {
        return { ...POI_EXPEDITIONS[poi.type], name: poi.name, poiId: id, targetX: poi.x, targetY: poi.y };
      }
    }
    return null;
  }
  // Why a survivor can't leave right now, or '' when they can.
  expeditionBlock(s, kind) {
    const trip = this.findExpedition(kind);
    if (this.status !== 'playing' || !s || !trip) return 'Unavailable';
    if (s.expedition) return 'Already away';
    if (s.condition === 'downed') return 'Downed';
    if (s.hp < survivorStats(s).hp * .5) return 'Too hurt to travel';
    if (s.shelter != null) return 'Sheltering';
    if (this.patrols.length < 2) return 'Someone must stay behind';
    if (!this.afford(trip.cost)) return 'Not enough supplies';
    return '';
  }
  partyCost(kind, size) {
    const trip = this.findExpedition(kind);
    return trip ? Object.fromEntries(Object.entries(trip.cost).map(([r, n]) => [r, n * size])) : {};
  }
  partyBlock(party, kind) {
    const trip = this.findExpedition(kind);
    if (!trip) return 'Unknown destination';
    if (!party.length) return 'Choose who goes';
    if (party.length > this.partyCap) return 'Party limit is ' + this.partyCap;
    if (new Set(party.map(s => s?.id)).size !== party.length) return 'Duplicate member';
    for (const s of party) { const block = this.expeditionBlock(s, kind); if (block) return (s?.name || 'Someone') + ': ' + block; }
    if (this.patrols.length - party.length < 1) return 'Someone must stay behind';
    if (!this.afford(this.partyCost(kind, party.length))) return 'Not enough supplies';
    return '';
  }
  expeditionRisk(kind, size = 1) {
    const trip = this.findExpedition(kind);
    const baseRisk = trip ? trip.risk : .2;
    return baseRisk * (this.clinic && has(this.clinic, 'surgeon') ? .6 : 1) * Math.max(.5, 1 - T.expedition.extraMemberRisk * (size - 1));
  }
  sendExpedition(ids, kind) {
    const party = [].concat(ids).map(id => this.survivors.find(s => s.id === id)), trip = this.findExpedition(kind);
    if (!trip || this.partyBlock(party, kind) || !this.spend(this.partyCost(kind, party.length))) return false;
    const total = trip.hours * HOUR_SECONDS, id = 'trip:' + this.nextEventId++;
    const targetX = trip.targetX != null ? trip.targetX : (this.worldPois?.length ? this.worldPois[0].x : 0);
    const targetY = trip.targetY != null ? trip.targetY : (this.worldPois?.length ? this.worldPois[0].y : 0);
    let path = null, returnPath = null;
    if (this.map) {
      const p = this.findPath({ x: party[0]?.x || 0, y: party[0]?.y || 0 }, { x: targetX, y: targetY });
      if (p && p.length > 0) path = [{ x: party[0]?.x || 0, y: party[0]?.y || 0 }, ...p];
      const rp = this.findPath({ x: targetX, y: targetY }, { x: 0, y: 0 });
      if (rp && rp.length > 0) returnPath = [{ x: targetX, y: targetY }, ...rp];
    }
    for (let idx = 0; idx < party.length; idx++) {
      const s = party[idx];
      s.expedition = { kind, remaining: total, total, party: id, size: party.length, memberIndex: idx, targetX, targetY, phase: 'traveling', startX: s.x, startY: s.y, poiId: trip.poiId, path, returnPath };
      s.fighting = false; s.path = []; s.pathVersion = -1; this.dismount(s); s.goalKey = '';
      s.order = null; s.respond = null; s.care = null; s.careAt = null; s.shelter = null; s.sheltered = false; s.resting = false; s.restAt = null;
      this.releaseRescue(s);
      this.equip(s, null);
    }
    this.equipAll();
    this.notify(party.map(s => s.name).join(', ') + ' departed', trip.name + ' · back in about ' + trip.hours + ' game hours. Their posts are uncovered until then.', 'good');
    return true;
  }
  // The whole party returns together and shares one outcome roll per member.
  resolveExpeditions(dt) {
    const parties = new Map();
    for (const s of this.survivors) if (s.expedition) {
      s.expedition.remaining -= dt;
      const key = s.expedition.party || 'solo:' + s.id;
      parties.set(key, [...(parties.get(key) || []), s]);

      // Physical movement towards POI destination when on a world map
      if (this.map && s.expedition.targetX != null) {
        const trip = this.findExpedition(s.expedition.kind);
        const tripName = trip?.name || s.expedition.kind;
        const progress = Math.max(0, Math.min(1, 1 - (s.expedition.remaining / s.expedition.total)));
        if (!s.expedition.path) {
          const p = this.findPath({ x: s.expedition.startX ?? s.x, y: s.expedition.startY ?? s.y }, { x: s.expedition.targetX, y: s.expedition.targetY });
          s.expedition.path = p && p.length > 0 ? [{ x: s.expedition.startX ?? s.x, y: s.expedition.startY ?? s.y }, ...p] : null;
        }
        if (!s.expedition.returnPath) {
          const rp = this.findPath({ x: s.expedition.targetX, y: s.expedition.targetY }, { x: 0, y: 0 });
          s.expedition.returnPath = rp && rp.length > 0 ? [{ x: s.expedition.targetX, y: s.expedition.targetY }, ...rp] : null;
        }
        const stagger = ((s.expedition.memberIndex || 0) % (s.expedition.size || 1)) * 0.015;
        if (progress < 0.35) {
          s.expedition.phase = 'traveling';
          const t = Math.max(0, Math.min(1, progress / 0.35 - stagger));
          if (s.expedition.path && s.expedition.path.length > 1) {
            const pos = pathInterpolate(s.expedition.path, t);
            s.x = pos.x; s.y = pos.y; s.facing = pos.facing;
          } else {
            s.x = s.expedition.startX != null ? s.expedition.startX + (s.expedition.targetX - s.expedition.startX) * t : s.expedition.targetX * t;
            s.y = s.expedition.startY != null ? s.expedition.startY + (s.expedition.targetY - s.expedition.startY) * t : s.expedition.targetY * t;
            s.facing = s.expedition.targetX >= s.x ? 1 : -1;
          }
          s.task = `Heading to ${tripName}`;
        } else if (progress < 0.70) {
          s.expedition.phase = 'scavenging';
          const wander = Math.sin((this.elapsed + s.id) * 2) * 12;
          s.x = s.expedition.targetX + wander;
          s.y = s.expedition.targetY + Math.cos((this.elapsed + s.id) * 2) * 8;
          s.facing = wander >= 0 ? 1 : -1;
          s.task = `Scavenging at ${tripName}`;
        } else {
          s.expedition.phase = 'returning';
          const t = Math.max(0, Math.min(1, (progress - 0.70) / 0.30 - stagger));
          if (s.expedition.returnPath && s.expedition.returnPath.length > 1) {
            const pos = pathInterpolate(s.expedition.returnPath, t);
            s.x = pos.x; s.y = pos.y; s.facing = pos.facing;
          } else {
            s.x = s.expedition.targetX * (1 - t);
            s.y = s.expedition.targetY * (1 - t);
            s.facing = 0 >= s.x ? 1 : -1;
          }
          s.task = `Returning from ${tripName}`;
        }
      }
    }
    for (const members of parties.values()) {
      if (members.some(s => s.expedition.remaining > 0)) continue;
      const kind = members[0].expedition.kind, trip = this.findExpedition(kind), n = members.length, E = T.expedition;
      if (!trip) continue;
      if (trip.poiId != null && this.worldPois) {
        const poi = this.worldPois.find(p => p.id === trip.poiId);
        if (poi) poi.scavenged = true;
      }
      const carry = Math.max(.5, 1 + members.reduce((sum, s) => sum + (s.stats.str - 4) * T.effects.carryPerStrength, 0) / n);
      const loot = Object.fromEntries(Object.entries(trip.reward).map(([r, amount]) => [r, Math.round(amount * (1 + E.extraMemberReward * (n - 1)) * carry)]));
      this.depositAll(loot);
      const risk = this.expeditionRisk(kind, n), lines = [Object.entries(loot).map(([r, amount]) => '+' + amount + ' ' + resourceLabel(r)).join(' · ')], lost = [];
      for (const s of members) {
        delete s.expedition;
        const [x, y] = this.safePatrolPosition(s.side); s.x = x; s.y = y;
        this.resetPatrol(s);
        const roll = this.random();
        if (roll < risk * E.deathShareOfRisk) { lost.push(s); continue; }
        if (roll < risk) { s.hp = Math.max(15, s.hp - E.injuryDamage); s.lastHit = this.elapsed; lines.push(s.name + ' was injured'); }
        this.grantXP(s, T.xp.expedition);
        this.updateCondition(s);
      }
      if (trip.weapon && this.random() < trip.weapon.chance) {
        const validTypes = (trip.weapon.types || []).filter(t => WEAPONS[t]);
        if (validTypes.length > 0) {
          const item = this.addItem(validTypes[Math.floor(this.random() * validTypes.length)]);
          if (item && WEAPONS[item.type]) lines.push('found a ' + WEAPONS[item.type].name.toLowerCase());
        }
      }
      if (this.random() < trip.rescueChance) { const c = this.createCandidate('expedition', trip.recruit.options, true, trip.recruit.label); lines.push('met ' + c.name + ', who wants to join'); }
      for (const s of lost) this.kill(s, 'Lost on the ' + trip.name.toLowerCase() + ' run.');
      this.equipAll();
      this.notify(members.map(s => s.name).join(', ') + (n > 1 ? ' are' : ' is') + ' back', lines.join('. ') + '.', lost.length || lines.some(l => l.includes('injured')) ? 'warn' : 'good');
    }
  }
}
