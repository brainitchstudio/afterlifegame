// healthy → injured → downed → dead, rescues and clinic care. Installed onto Game.prototype by model.mjs.
import { TUNING as T, statFactor } from './survivors.mjs';
import { HOUR_SECONDS, distance, has } from './data.mjs';
import { survivorStats } from './rules.mjs';

export class Health {
  // ---- Health: healthy → injured → downed → dead ----
  active(s) { return !s.expedition && s.condition !== 'downed' && !s.sheltered; }
  sceneSafe(p) { return !this.zombiesNear(p, T.health.safeRadius).some(z => z.hp > 0 && distance(z, p) < T.health.safeRadius); }
  updateCondition(s, max = survivorStats(s).hp) {
    if (s.condition === 'downed') return;
    s.condition = s.hp < max * T.health.injuryThreshold ? 'injured' : 'healthy';
  }
  down(s) {
    this.releaseRescue(s);
    Object.assign(s, { hp: 0, condition: 'downed', bleed: T.health.bleedOutHours * HOUR_SECONDS * statFactor(s.stats.end, T.effects.bleedPerEndurance), stabilize: 0, stabilizing: false, rescuer: null });
    Object.assign(s, { stationed: false, perch: null, towerId: null, goalKey: '', care: null, careAt: null, order: null, respond: null, sheltered: false, resting: false, restAt: null, fighting: false, path: [] });
    this.notify(s.name + ' is down', 'About ' + (s.bleed / HOUR_SECONDS).toFixed(1) + ' game hours to bleed out unless someone stabilizes them.', 'warn');
  }
  releaseRescue(s) {
    if (s.rescue == null) return;
    const patient = this.survivors.find(x => x.id === s.rescue);
    if (patient && patient.rescuer === s.id) { patient.rescuer = null; patient.stabilizing = false; }
    s.rescue = null;
  }
  // Death is permanent: release gear, bed, rescue claims and orders, then refresh gear for everyone else.
  kill(s, message) {
    this.equip(s, null);
    this.releaseRescue(s);
    for (const o of this.survivors) if (o.rescuer === s.id) { o.rescuer = null; o.stabilizing = false; }
    this.survivors = this.survivors.filter(x => x !== s);
    this.notify(s.name + ' has died', message, 'warn');
    this.equipAll();
  }
  // One rescuer per downed survivor: medics first; anyone healthy only when no medic is on duty.
  scheduleRescues() {
    for (const d of this.survivors) {
      if (d.condition !== 'downed' || d.expedition) continue;
      const current = d.rescuer != null && this.survivors.find(r => r.id === d.rescuer);
      if (current && this.active(current) && current.rescue === d.id) continue;
      d.rescuer = null; d.stabilizing = false;
      const free = r => r !== d && this.active(r) && r.rescue == null && !r.order;
      const medics = this.survivors.filter(r => r.role === 'medic' && free(r));
      const onDuty = this.survivors.some(r => r.role === 'medic' && this.active(r));
      const pool = medics.length ? medics : onDuty ? [] : this.survivors.filter(r => free(r) && !r.stationed && r.condition === 'healthy');
      const r = pool.sort((a, b) => distance(a, d) - distance(b, d))[0];
      if (r) { d.rescuer = r.id; r.rescue = d.id; r.path = []; }
    }
  }
  doRescue(s, stats, dt) {
    const d = this.survivors.find(x => x.id === s.rescue);
    if (!d || d.condition !== 'downed' || d.rescuer !== s.id) { s.rescue = null; return false; }
    // Wait at a distance rather than walk into the dead.
    if (!this.sceneSafe(d)) { d.stabilizing = false; s.task = 'waiting-safe'; return true; }
    if (distance(s, d) > 14) { d.stabilizing = false; this.travel(s, d, stats.speed * 1.15, dt); s.task = 'to-rescue'; return true; }
    const seconds = s.role === 'medic' ? T.health.stabilizeSeconds / statFactor(s.stats.int, T.effects.workPerIntelligence) : T.health.fallbackStabilizeSeconds;
    d.stabilizing = true;
    d.stabilize += dt / seconds;
    s.task = 'stabilizing';
    if (d.stabilize >= 1) {
      Object.assign(d, { condition: 'injured', hp: survivorStats(d).hp * T.health.reviveShare, bleed: null, stabilize: 0, stabilizing: false, rescuer: null, lastHit: this.elapsed });
      s.rescue = null;
      this.grantXP(s, T.xp.rescue);
      this.notify(d.name + ' stabilized', s.name + ' got them back on their feet. They need clinic care.', 'good');
    }
    return true;
  }
  clinicsWithMedics() { return this.buildings.filter(b => b.type === 'clinic' && this.staffOf(b).some(m => this.active(m))); }
  // Injured survivors walk to a staffed clinic when it is safe, wait, and are treated.
  // Without a clinic and a medic they stay injured: no invisible healing.
  // Only another medic who isn't a patient themselves can treat you, so an injured medic
  // never queues at their own clinic and leaves it with nobody working.
  seekCare(s, stats, dt) {
    const max = survivorStats(s).hp;
    const clinics = this.buildings.filter(b => b.type === 'clinic' && this.staffOf(b).some(m => m !== s && this.active(m) && !m.care));
    if (s.care && !clinics.some(b => b.id === s.careAt)) { s.care = null; s.careAt = null; }
    if (s.care && s.hp >= max * T.health.recoveryThreshold) { s.care = null; s.careAt = null; s.treatedBy = null; return false; }
    if (!s.care && s.condition === 'injured' && clinics.length && this.sceneSafe(s)) {
      s.care = 'seek'; s.careAt = clinics.sort((a, b) => distance(s, a) - distance(s, b))[0].id;
      this.dismount(s);
    }
    if (!s.care) return false;
    const clinic = clinics.find(b => b.id === s.careAt);
    if (s.care === 'seek') {
      const spot = this.goalFor(s, clinic);
      if (!spot) { s.care = null; s.careAt = null; return false; }
      if (this.travel(s, spot, stats.speed, dt)) s.care = 'waiting';
      s.task = 'to-clinic';
      return true;
    }
    s.task = this.survivors.some(m => m.role === 'medic' && m.job === s.id) ? 'treated' : 'awaiting-care';
    return true;
  }
}
