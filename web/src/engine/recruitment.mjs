// Candidates, broadcasts, walk-ups and new survivors. Installed onto Game.prototype by model.mjs.
import { TUNING as T, generateStats, statFactor } from './survivors.mjs';
import { HOUR_SECONDS, BUILDINGS, NAMES, ROLES, distance, has } from './data.mjs';
import { survivorStats } from './rules.mjs';
import { generateCampaignSurvivor, aptitudesOf, quality } from './crew.mjs';

export class Recruitment {
  // One creation service for every source. Stats are generated once, when the candidate is created,
  // from stable ids; viewing or accepting a candidate never rerolls them.
  createCandidate(source, options = {}, store = true, label = '') {
    const id = this.nextId++, eventId = source + ':' + this.nextEventId++, index = this.recruited++;
    const name = NAMES[index % NAMES.length] + (index >= NAMES.length ? ' ' + (Math.floor(index / NAMES.length) + 1) : '');
    let c;
    if (this.campaign) {
      // A campaign survivor: stats 1-10 and up to two traits; founders get the starting crew's floors and archetype.
      const r = generateCampaignSurvivor(this.worldSeed, id, eventId, { archetype: options.archetype, start: source === 'founder', qualityMin: options.qualityMin || 0 });
      c = { id, source, eventId, label, name, look: index % 6, level: 1, stats: r.stats, aptitudes: aptitudesOf(r.stats), unspent: 0, traits: r.traits, model: 'campaign', gen: { seed: r.seed, version: 1, quality: quality(r.stats), budget: 0, source, eventId }, createdAt: this.elapsed, expiresAt: null };
    } else {
      const r = generateStats(this.worldSeed, id, eventId, options);
      c = { id, source, eventId, label, name, look: index % 6, level: r.level, stats: r.stats, aptitudes: r.aptitudes, unspent: r.unspent, gen: { seed: r.seed, version: r.generatorVersion, quality: r.quality, budget: r.budget, source, eventId }, createdAt: this.elapsed, expiresAt: null };
    }
    if (store) {
      c.expiresAt = this.elapsed + (source === 'walk-up' ? T.recruitment.walkUpOfferHours : T.recruitment.offerHours) * HOUR_SECONDS;
      this.candidates.push(c);
    }
    return c;
  }
  addSurvivor(side = 'any', candidate = null) {
    const c = candidate || this.createCandidate('founder', {}, false);
    const start = this.safePatrolPosition(side);
    const s = { id: c.id, name: c.name, look: c.look, x: start[0], y: start[1], hp: 1, side, role: 'patrol', post: null, xp: 0, level: c.level, stats: { ...c.stats }, aptitudes: { ...c.aptitudes }, gen: { ...c.gen }, unspent: c.unspent, condition: 'healthy', home: null, weapon: null, gear: null, cooldown: 0, patrolIndex: 0, path: [], pathVersion: -1, lastHit: -100, facing: 1, ...(c.model === 'campaign' ? this.campaignFields(c) : {}) };
    s.hp = survivorStats(s).hp;
    this.survivors.push(s);
    this.assignHome(s);
    return s;
  }
  instantSpawnSurvivor(role = 'patrol', x = null, y = null) {
    if (this.status !== 'playing') return null;
    const c = this.createCandidate('admin', {}, false, 'Admin Recruit');
    const start = (x != null && y != null) ? [x, y] : this.safePatrolPosition('any');
    const validRole = role && ROLES[role] ? role : 'patrol';
    const s = {
      id: c.id, name: c.name, look: c.look, x: start[0], y: start[1], hp: 1,
      side: 'any', role: validRole, post: null, xp: 0,
      level: c.level, stats: { ...c.stats }, aptitudes: { ...c.aptitudes },
      gen: { ...c.gen }, unspent: c.unspent, condition: 'healthy', home: null,
      weapon: null, gear: null, cooldown: 0, patrolIndex: 0, path: [],
      pathVersion: -1, lastHit: -100, facing: 1, ...(c.model === 'campaign' ? this.campaignFields(c) : {})
    };
    s.hp = survivorStats(s).hp;
    this.survivors.push(s);
    this.assignHome(s);
    this.equipAll();
    this.notify(s.name + ' spawned', `New survivor (${ROLES[validRole]?.name || validRole}) arrived instantly.`, 'good');
    return s;
  }
  get bestCharisma() { return Math.max(1, ...this.patrols.filter(s => s.condition !== 'downed').map(s => s.stats.cha)); }
  get recruitCost() { const f = 1 - (this.bestCharisma - 4) * T.effects.charismaRecruit; return { food: Math.round((this.core && has(this.core, 'radio') ? 14 : 18) * f), wood: Math.round(12 * f) }; }
  // Radio recruitment: a broadcast produces one candidate after half a game hour.
  recruit() {
    if (this.status !== 'playing' || this.campaign) return false;
    if (this.freeBeds <= 0) { this.notify('No beds available', 'Build or upgrade a bunkhouse before broadcasting for survivors.', 'warn'); return false; }
    if (this.broadcasting || !this.spend(this.recruitCost)) return false;
    this.broadcasting = true;
    this.recruitTimer = T.recruitment.broadcastHours * HOUR_SECONDS;
    this.notify('Broadcasting on the radio', 'Someone may answer within half an hour.', 'good');
    return true;
  }
  acceptCandidate(id) {
    if (this.campaign) return this.acceptRecruit(id);
    const c = this.candidates.find(c => c.id === id);
    if (this.status !== 'playing' || !c) return false;
    this.rehouse();
    if (this.freeBeds <= 0) { this.notify('No beds available', c.name + ' needs a bed. Build or upgrade a bunkhouse.', 'warn'); return false; }
    this.candidates = this.candidates.filter(x => x !== c);
    const s = this.addSurvivor('any', c);
    this.equipAll();
    const home = this.buildings.find(b => b.id === s.home), road = this.walkIn(s);
    this.progress.tally.recruited++;
    this.writeJournal(s.name + ' joined', `${s.name} came in ${road ? 'along the ' + road + ' road' : 'through the gate'}. ${this.survivors.length} of us now.`);
    this.notify(s.name + ' joined the refuge', (road ? 'Walking in along the ' + road + ' road. ' : '') + 'Given a bed in the ' + BUILDINGS[home.type].name.toLowerCase() + '. Patrolling all sides until you give them a job.', 'good');
    return s;
  }
  // A new recruit appears out on a road beyond the edge of sight and walks in through its gate,
  // preferring the road with the fewest of the dead about. Returns the road's side.
  walkIn(s) {
    const risk = g => this.zombies.filter(z => z.hp > 0 && distance(z, g.outer) < 260).length + this.random() * .5;
    const gate = this.gateways.filter(g => g.road).map(g => ({ g, risk: risk(g) })).sort((a, b) => a.risk - b.risk)[0]?.g;
    if (!gate) return null;
    const n = gate.outward;
    Object.assign(s, { x: n.x ? n.x * (this.bounds.x + 16) : gate.x, y: n.y ? n.y * (this.bounds.y + 16) : gate.y, arriving: true, facing: n.x > 0 ? -1 : 1, path: [], pathVersion: -1 });
    return gate.side;
  }
  declineCandidate(id) {
    if (this.campaign) return this.declineRecruit(id);
    const before = this.candidates.length;
    this.candidates = this.candidates.filter(c => c.id !== id);
    return this.candidates.length < before;
  }

  // ---- Walk-up recruits, broadcasts and offer expiry ----
  recruitment(dt) {
    const R = T.recruitment;
    if (this.broadcasting) {
      this.recruitTimer = Math.max(0, this.recruitTimer - dt);
      if (this.recruitTimer <= 0) {
        this.broadcasting = false;
        const c = this.createCandidate('radio');
        this.notify('Someone answered', c.name + ' heard your broadcast and is waiting at the gate. Welcome them from your tablet [Tab].', 'good');
        this.arrivalMessage(c);
      }
    }
    // Walk-ups come as word of the base spreads (progression.mjs): none before the gate is up.
    const open = this.candidates.length < R.maxOpenOffers, daylight = this.hour >= 7 && this.hour < 18;
    const chance = this.arrivalRate * (this.core && has(this.core, 'beacon') ? 2 : 1) * statFactor(this.bestCharisma, T.effects.charismaWalkUp) * dt / HOUR_SECONDS;
    if (open && daylight && this.random() < chance) {
      const c = this.createCandidate('walk-up');
      const need = this.shortage;
      this.notify('A survivor at the gate', c.name + (need === 'beds' ? ' wants to join, but every bed is taken.' : need === 'food' ? ' wants to join, but food is short.' : ' walked up and asked to stay.') + ' They will wait about ' + R.walkUpOfferHours + ' game hours. See your tablet [Tab].', need ? 'warn' : 'good');
      this.arrivalMessage(c);
    }
    for (const c of this.candidates.filter(c => this.elapsed >= c.expiresAt)) { this.notify(c.name + ' moved on', 'They could not wait any longer.', ''); this.message('The gate', c.name + ' moved on', 'They could not wait any longer.'); }
    this.candidates = this.candidates.filter(c => this.elapsed < c.expiresAt);
  }
}
