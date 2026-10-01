// Serialization, validation and migration of saves, keyed on SAVE_VERSION. Installed onto Game.prototype by model.mjs.
import { initialLand, patrolRoutes } from './land.mjs';
import { generateStats, grantStatPoint, hashSeed } from './survivors.mjs';
import { HOUR_SECONDS, DAY_SECONDS, RUN_DAYS, SAVE_VERSION, DIRECTOR_STATES, EXPEDITIONS, ROLE_FOR, SHIFTS, LEGACY_DAY_SECONDS } from './data.mjs';
import { survivorStats } from './rules.mjs';
import { checkSave } from './saveSchema.mjs';
const TRANSIENT = { tendSpot: undefined, tendTimer: undefined, tendIndex: undefined, treatedBy: undefined, path: [], pathVersion: -1, pathGoal: undefined, pathRetry: undefined, goal: undefined, goalKey: undefined, hunt: undefined, huntTimer: undefined, job: undefined, fxTimer: undefined, heldUntil: undefined, stationed: undefined, perch: undefined, towerId: undefined, patrolDir: undefined, task: undefined, injuredRefuge: undefined, towerCooldown: undefined, emergencyShelter: undefined };

export class Save {
  serialize() {
    const { elapsed, status, resources, buildings, survivors, zombies, kills, nextId, spawnTimer, recruitTimer, recruited, director, incoming, threatSide, worldSeed, nextEventId, items, candidates, alerts, alarm, shelterOrder, broadcasting } = this;
    return JSON.stringify({ version: SAVE_VERSION, land: this.land, elapsed, status, resources, buildings, survivors: survivors.map(s => ({ ...s, ...TRANSIENT, resting: s.resting || undefined, restAt: s.resting ? s.restAt : undefined, shift: s.role === 'sentry' ? s.shift : undefined })), zombies, kills, nextId, spawnTimer, recruitTimer, recruited, director, incoming, threatSide, dayLength: DAY_SECONDS, worldSeed, nextEventId, items, candidates, alerts, alarm, shelterOrder, broadcasting, gates: true, sturdyWalls: true, wallTowers: true, southGate: true, roadGates: true, openings: this.openings });
  }
  // Why a save would be rejected, or '' when it is valid.
  restoreError(json) {
    try { return checkSave(JSON.parse(json)); } catch { return 'Not valid JSON'; }
  }
  restore(json) {
    try {
      const d = JSON.parse(json);
      if (checkSave(d)) return false;
      const finite = value => typeof value === 'number' && Number.isFinite(value), id = v => Number.isInteger(v);
      const legacy = d.version < 3, items = legacy ? [] : d.items, candidates = legacy ? [] : d.candidates;
      // Director state is optional so saves from before the 24-hour pacing still load.
      const director = d.director && DIRECTOR_STATES.includes(d.director.state) && [d.director.timer, d.director.tension].every(finite) ? d.director : { state: 'lull', timer: 40, tension: 0 };
      const incoming = d.incoming && director.state === 'peak' && [0, 1, 2, 3].includes(d.incoming.side) && [d.incoming.count, d.incoming.eta, d.incoming.total].every(finite) && d.incoming.count >= 0 && d.incoming.count <= 18 ? d.incoming : null;
      for (const key of ['elapsed', 'status', 'resources', 'buildings', 'survivors', 'zombies', 'kills', 'nextId', 'spawnTimer', 'recruitTimer', 'recruited']) this[key] = d[key];
      this.director = { state: director.state, timer: director.timer, tension: director.tension, stressAt: finite(director.stressAt) ? director.stressAt : -1e9 };
      // Saves from the 3-minute day keep their date and time of day.
      if (d.dayLength !== DAY_SECONDS) this.elapsed = Math.min(DAY_SECONDS * RUN_DAYS, d.elapsed * DAY_SECONDS / (finite(d.dayLength) && d.dayLength > 0 ? d.dayLength : LEGACY_DAY_SECONDS));
      this.incoming = incoming && { side: incoming.side, count: incoming.count, eta: incoming.eta, total: incoming.total, spotted: !!incoming.spotted };
      this.threatSide = [0, 1, 2, 3].includes(d.threatSide) ? d.threatSide : 0;
      this.worldSeed = finite(d.worldSeed) ? d.worldSeed : hashSeed('legacy-world', d.nextId, d.kills, d.recruited);
      this.nextEventId = finite(d.nextEventId) ? d.nextEventId : 1;
      this.items = items.map(i => ({ id: i.id, type: i.type, holder: i.holder ?? null }));
      this.candidates = candidates;
      this.alerts = Array.isArray(d.alerts) ? d.alerts.filter(a => typeof a.id === 'string' && Array.isArray(a.threatIds) && a.threatIds.every(id) && a.lastKnown && finite(a.lastKnown.x) && finite(a.lastKnown.y) && finite(a.expiresAt) && finite(a.lastSeenAt)) : [];
      this.alarm = d.alarm && typeof d.alarm.raised === 'boolean' && finite(d.alarm.quiet) ? { raised: d.alarm.raised, quiet: d.alarm.quiet } : { raised: false, quiet: 0 };
      this.shelterOrder = d.shelterOrder && id(d.shelterOrder.buildingId) && this.buildings.some(b => b.id === d.shelterOrder.buildingId) ? { buildingId: d.shelterOrder.buildingId } : null;
      this.broadcasting = d.broadcasting === true && this.recruitTimer > 0;
      if (!this.broadcasting) this.recruitTimer = 0;
      this.land = d.version === 1 ? initialLand() : d.land;
      // Older saves didn't record dismantled fence panels, so every hole is treated as a breach.
      this.openings = Array.isArray(d.openings) ? d.openings.filter(k => typeof k === 'string') : [];
      this.landRevision++;
      this.routes = patrolRoutes(this.land);
      this.navigation = null;
      if (d.version === 1) {
        for (const b of this.buildings) if (b.type === 'barricade' && (Math.abs(b.x) === 240 || Math.abs(b.y) === 176)) b.perimeter = true;
        this.extendPerimeter([]);
      }
      if (!d.gates) this.addMissingGates();
      if (!d.southGate) this.migrateSouthGate();
      if (!d.roadGates) this.openRoadGates();
      // Barricades used to start at 150 durability; older saves keep the same share of the new maximum.
      if (!d.sturdyWalls) for (const b of this.buildings) if (b.type === 'barricade') b.hp *= 2;
      if (legacy) this.migrateSurvivors();
      const survivorIds = new Set(this.survivors.map(s => s.id)), zombieIds = new Set(this.zombies.map(z => z.id));
      for (const s of this.survivors) {
        Object.assign(s, TRANSIENT, { path: [] });
        const post = this.postOf(s);
        // Older saves have no roles; a post whose building is gone reverts to patrol. Scavengers have no post.
        if (s.role === 'scavenger') s.post = null;
        else if (!post || ROLE_FOR[post.type] !== s.role) { s.role = 'patrol'; s.post = null; }
        // Drop references to things that no longer exist rather than trusting them.
        if (s.rescue != null && !survivorIds.has(s.rescue)) s.rescue = null;
        if (s.rescuer != null && !survivorIds.has(s.rescuer)) { s.rescuer = null; s.stabilizing = false; }
        if (s.order && !(id(s.order.zombieId) && zombieIds.has(s.order.zombieId) && s.order.lastKnown && finite(s.order.lastKnown.x) && finite(s.order.lastKnown.y) && finite(s.order.lost))) s.order = null;
        if (s.respond && !this.alerts.some(a => a.id === s.respond)) s.respond = null;
        if (s.shelter != null && !this.buildings.some(b => b.id === s.shelter)) { s.shelter = null; s.sheltered = false; }
        if (s.resting && (this.onDuty(s) || !this.buildings.some(b => b.id === s.restAt))) this.wake(s);
        const item = s.weapon != null && this.items.find(i => i.id === s.weapon && i.holder === s.id);
        if (!item) { s.weapon = null; s.gear = null; } else s.gear = item.type;
        if (s.condition !== 'downed') s.hp = Math.min(s.hp, survivorStats(s).hp);
        // A saved survivor never holds a full level of unspent XP; more would level-up in a runaway loop.
        s.xp = Math.min(s.xp, this.xpNeeded(s));
      }
      // Each sentry keeps one shift at their tower; older saves and clashes get the next open one.
      for (const s of this.survivors) {
        if (s.role !== 'sentry') { s.shift = undefined; continue; }
        const b = this.postOf(s), clash = this.staffOf(b).some(o => o !== s && o.shift === s.shift && o.id < s.id);
        if (!SHIFTS[s.shift] || !Number.isInteger(s.shift) || clash) s.shift = this.openShift(b, s);
      }
      for (const i of this.items) if (i.holder != null && !this.survivors.some(s => s.weapon === i.id)) i.holder = null;
      this.rehouse();
      if (legacy) this.equipAll();
      this.navVersion++;
      this.events = [];
      this.effects = [];
      this.trader = null;
      this.traderTimer = 45 + this.random() * 60;
      return true;
    } catch { return false; }
  }
  // Saves from before the survivor system: generate stable stats from the save's own ids,
  // replay one stat point per level gained, rescale trips to game hours and stock a pistol each.
  migrateSurvivors() {
    for (const s of this.survivors) {
      const r = generateStats(this.worldSeed, s.id, 'legacy:' + s.id);
      Object.assign(s, { stats: r.stats, aptitudes: r.aptitudes, unspent: 0, gen: { seed: r.seed, version: r.generatorVersion, quality: r.quality, budget: r.budget, source: 'legacy', eventId: 'legacy:' + s.id }, condition: 'healthy', home: null, weapon: null, gear: null });
      // Once every stat is maxed, each remaining level is an unspent point; count them rather than loop.
      for (let level = 2; level <= s.level; level++) if (!grantStatPoint(s.stats, s.aptitudes, s.gen.seed, level)) { s.unspent += Math.floor(s.level) - level + 1; break; }
      delete s.points; delete s.upgrades;
      if (s.expedition) {
        const total = EXPEDITIONS[s.expedition.kind].hours * HOUR_SECONDS, share = s.expedition.remaining / s.expedition.total;
        s.expedition = { kind: s.expedition.kind, remaining: Math.max(1, share * total), total, party: 'legacy:' + s.id, size: 1 };
      }
      this.updateCondition(s);
    }
    for (const type of ['rifle', ...this.survivors.map(() => 'pistol')]) this.addItem(type);
  }
}
