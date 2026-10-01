// Parties, departures and returns. Installed onto Game.prototype by model.mjs.
import { TUNING as T, WEAPONS, partyCap } from './survivors.mjs';
import { HOUR_SECONDS, EXPEDITIONS, has } from './data.mjs';
import { survivorStats } from './rules.mjs';

export class Expeditions {
  get partyCap() { return partyCap(this.survivors.length); }
  // Why a survivor can't leave right now, or '' when they can.
  expeditionBlock(s, kind) {
    const trip = EXPEDITIONS[kind];
    if (this.status !== 'playing' || !s || !trip) return 'Unavailable';
    if (s.expedition) return 'Already away';
    if (s.condition === 'downed') return 'Downed';
    if (s.hp < survivorStats(s).hp * .5) return 'Too hurt to travel';
    if (s.shelter != null) return 'Sheltering';
    if (this.patrols.length < 2) return 'Someone must stay behind';
    if (!this.afford(trip.cost)) return 'Not enough supplies';
    return '';
  }
  partyCost(kind, size) { return Object.fromEntries(Object.entries(EXPEDITIONS[kind].cost).map(([r, n]) => [r, n * size])); }
  partyBlock(party, kind) {
    if (!party.length) return 'Choose who goes';
    if (party.length > this.partyCap) return 'Party limit is ' + this.partyCap;
    if (new Set(party.map(s => s?.id)).size !== party.length) return 'Duplicate member';
    for (const s of party) { const block = this.expeditionBlock(s, kind); if (block) return (s?.name || 'Someone') + ': ' + block; }
    if (this.patrols.length - party.length < 1) return 'Someone must stay behind';
    if (!this.afford(this.partyCost(kind, party.length))) return 'Not enough supplies';
    return '';
  }
  expeditionRisk(kind, size = 1) { return EXPEDITIONS[kind].risk * (this.clinic && has(this.clinic, 'surgeon') ? .6 : 1) * Math.max(.5, 1 - T.expedition.extraMemberRisk * (size - 1)); }
  sendExpedition(ids, kind) {
    const party = [].concat(ids).map(id => this.survivors.find(s => s.id === id)), trip = EXPEDITIONS[kind];
    if (!trip || this.partyBlock(party, kind) || !this.spend(this.partyCost(kind, party.length))) return false;
    const total = trip.hours * HOUR_SECONDS, id = 'trip:' + this.nextEventId++;
    for (const s of party) {
      s.expedition = { kind, remaining: total, total, party: id, size: party.length };
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
    }
    for (const members of parties.values()) {
      if (members.some(s => s.expedition.remaining > 0)) continue;
      const kind = members[0].expedition.kind, trip = EXPEDITIONS[kind], n = members.length, E = T.expedition;
      const carry = Math.max(.5, 1 + members.reduce((sum, s) => sum + (s.stats.str - 4) * T.effects.carryPerStrength, 0) / n);
      const loot = Object.fromEntries(Object.entries(trip.reward).map(([r, amount]) => [r, Math.round(amount * (1 + E.extraMemberReward * (n - 1)) * carry)]));
      for (const [r, amount] of Object.entries(loot)) this.resources[r] += amount;
      const risk = this.expeditionRisk(kind, n), lines = [Object.entries(loot).map(([r, amount]) => '+' + amount + ' ' + r).join(' · ')], lost = [];
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
      if (trip.weapon && this.random() < trip.weapon.chance) { const item = this.addItem(trip.weapon.types[Math.floor(this.random() * trip.weapon.types.length)]); lines.push('found a ' + WEAPONS[item.type].name.toLowerCase()); }
      if (this.random() < trip.rescueChance) { const c = this.createCandidate('expedition', trip.recruit.options, true, trip.recruit.label); lines.push('met ' + c.name + ', who wants to join'); }
      for (const s of lost) this.kill(s, 'Lost on the ' + trip.name.toLowerCase() + ' run.');
      this.equipAll();
      this.notify(members.map(s => s.name).join(', ') + (n > 1 ? ' are' : ' is') + ' back', lines.join('. ') + '.', lost.length || lines.some(l => l.includes('injured')) ? 'warn' : 'good');
    }
  }
}
