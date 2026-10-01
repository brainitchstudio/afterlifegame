// Spawning, the threat director, perception, alarms and attack orders. Installed onto Game.prototype by model.mjs.
import { TUNING as T } from './survivors.mjs';
import { HOUR_SECONDS, DAY_SECONDS, EDGES, jobOf, clamp, distance, has } from './data.mjs';
import { buildingMaxHP } from './rules.mjs';

export class Combat {
  // Ambient arrivals per real second at 1×: follows the circadian curve, grows each day,
  // and is shaped by the director (quiet lulls, no arrivals during relief).
  spawnRate() {
    const mood = { lull: .45, buildup: 1, peak: .6, relief: 0 }[this.director.state];
    const difficulty = { easy: .7, normal: 1, hard: 1.35 }[this.difficulty] ?? 1;
    return (3 + 19 * this.pressure) / 60 * (1 + this.day * .065) * mood * (this.hordeNight ? 1.5 : 1) * difficulty;
  }
  get towerRadar() { return this.survivors.some(s => s.stationed); }
  // The wall blocks sight. On the ground you only see the dead on your own side of it; up on a tower you see both.
  canSee(s, z) { return !!s.perch || this.outside(s) === this.outside(z); }
  // Ambient arrivals lean toward the side the dead are drifting from, and some follow the roads.
  ambientSide() { return this.random() < .4 ? this.threatSide : Math.floor(this.random() * 4); }
  spawnZombie(side = Math.floor(this.random() * 4), p = this.random() < .25 ? (this.random() - .5) * .16 : this.random() * 2 - 1) {
    const x = this.bounds.x + 12, y = this.bounds.y + 12;
    p = clamp(p, -1, 1);
    const position = [{ x: p * x, y: -y }, { x, y: p * y }, { x: p * x, y }, { x: -x, y: p * y }][side];
    const brute = this.day >= 5 && this.random() < .10 + this.day * .003;
    const runner = !brute && this.day >= 3 && this.random() < (this.night ? .26 : .14);
    const maxHP = (32 + this.day * 3) * (brute ? 2.4 : 1);
    const z = { id: this.nextId++, ...position, hp: maxHP, maxHP, kind: brute ? 'brute' : runner ? 'runner' : 'walker', speed: (11 + this.random() * 5 + this.day * .2) * (runner ? 1.8 : brute ? .7 : 1), damage: (4 + this.day * .3) * (brute ? 2 : 1), seed: this.random() * 100, facing: 1, side };
    if (this.campaign) this.campaignInfected(z);
    this.zombies.push(z);
    return z;
  }

  // ---- Perception, tower alerts, guard dispatch and the alarm ----
  // Wall towers with someone up on them see farther; a sighting shares a last known position, not live tracking.
  perceive() {
    const D = T.defense;
    for (const b of this.buildings) {
      if (b.type !== 'tower' || b.hp <= 0 || !this.survivors.some(s => s.stationed && s.towerId === b.id && this.active(s))) continue;
      for (const z of this.zombiesNear(b, D.towerSight)) if (z.hp > 0 && distance(b, z) < D.towerSight) this.sight(z, { towerId: b.id });
    }
    if (this.campaign) { this.watchLookouts(); this.campNotices(); }
    // Nobody can see over the wall, but everyone hears the dead battering it or a building.
    for (const z of this.zombies) if (z.hp > 0 && this.elapsed - (z.bashing ?? -1e9) < 1) this.sight(z, { heard: true });
    const live = new Set(this.zombies.filter(z => z.hp > 0).map(z => z.id));
    for (const a of this.alerts) a.threatIds = a.threatIds.filter(id => live.has(id));
    this.alerts = this.alerts.filter(a => a.threatIds.length && this.elapsed < a.expiresAt);
    const ids = new Set(this.alerts.map(a => a.id));
    for (const s of this.survivors) if (s.respond && !ids.has(s.respond)) s.respond = null;
    this.dispatch();
    if (this.alarm.raised) {
      const area = this.territory, near = this.zombies.some(z => z.hp > 0 && z.x > area.left - 60 && z.x < area.right + 60 && z.y > area.top - 60 && z.y < area.bottom + 60);
      this.alarm.quiet = this.alerts.length || near ? 0 : this.alarm.quiet + .5;
      if (this.alarm.quiet >= D.allClearHours * HOUR_SECONDS) this.clearAlarm(true);
    }
  }
  // Sightings of the same group merge into one alert.
  sight(z, source) {
    const D = T.defense;
    let a = this.alerts.find(a => distance(a.lastKnown, z) < D.alertMergeRadius);
    if (!a) { a = { id: 'alert:' + this.nextEventId++, towerId: null, survivorId: source.survivorId ?? null, local: true, threatIds: [], lastKnown: { x: z.x, y: z.y }, severity: 0, createdAt: this.elapsed, lastSeenAt: this.elapsed, expiresAt: 0, warned: false }; this.alerts.push(a); }
    if (source.towerId != null) { a.local = false; a.towerId = source.towerId; }
    if (source.heard) a.local = false;
    if (!a.threatIds.includes(z.id)) a.threatIds.push(z.id);
    Object.assign(a, { lastKnown: { x: Math.round(z.x), y: Math.round(z.y) }, lastSeenAt: this.elapsed, expiresAt: this.elapsed + D.alertTimeoutHours * HOUR_SECONDS, severity: a.threatIds.length });
    if (!a.local && a.severity >= D.largeGroup && !a.warned && !this.alarm.raised) {
      a.warned = true;
      this.notify('Large group sighted', a.severity + ' of the dead spotted from a watchtower. Consider raising the alarm.', 'warn');
    }
  }
  // A campaign's responders are its posted Guards on Intercept; the rest of the camp keeps working.
  guardsFor() {
    if (this.campaign) return this.survivors.filter(s => s.role === 'guard' && s.post != null && this.guardStance(s) === 'intercept' && this.active(s) && this.onDuty(s) && !s.order && s.rescue == null && !s.care);
    return this.survivors.filter(s => (s.role === 'patrol' || s.role === 'guard') && this.active(s) && s.condition === 'healthy' && !s.order && s.rescue == null);
  }
  dispatch() {
    const D = T.defense, guards = this.guardsFor();
    for (const a of [...this.alerts].sort((x, y) => y.severity - x.severity)) {
      const want = this.alarm.raised ? Infinity : D.dispatch.find(([max]) => a.severity <= max)[1];
      let have = guards.filter(g => g.respond === a.id).length;
      const pool = guards.filter(g => !g.respond && (!a.local || distance(g, a.lastKnown) < D.localReportRange)).sort((x, y) => distance(x, a.lastKnown) - distance(y, a.lastKnown));
      for (const g of pool) { if (have >= want) break; g.respond = a.id; g.path = []; have++; }
    }
  }
  respond(s, stats, dt) {
    const alert = this.alerts.find(a => a.id === s.respond);
    if (!alert) { s.respond = null; return false; }
    // A campaign guard answers only within reach of their post, and waits on their route until then.
    if (this.campaign && !this.inChase(s, alert.lastKnown)) return false;
    s.task = this.travel(s, this.campaign ? alert.lastKnown : this.huntPoint(alert.lastKnown), stats.speed * 1.1, dt) ? 'investigating' : 'responding';
    return true;
  }
  raiseAlarm() {
    if (this.status !== 'playing' || this.alarm.raised) return false;
    this.alarm = { raised: true, quiet: 0 };
    this.dispatch();
    this.notify('Alarm raised', 'Guards drop routine patrols to hold positions and chase known threats. It clears itself after an hour of quiet.', 'warn');
    return true;
  }
  clearAlarm(auto = false) {
    if (!this.alarm.raised) return false;
    this.alarm = { raised: false, quiet: 0 };
    this.notify(auto ? 'All clear' : 'Alarm lowered', 'Guards return to their normal patrols.', 'good');
    return true;
  }

  // ---- Player Attack orders ----
  attackCandidates(z) {
    const C = T.combat;
    return this.survivors.filter(s => this.active(s) && !s.stationed && s.rescue == null && distance(s, z) < C.attackRadius)
      .sort((a, b) => (jobOf(a) === 'guard' ? 0 : 1) - (jobOf(b) === 'guard' ? 0 : 1) || distance(a, z) - distance(b, z)).slice(0, C.attackGroup);
  }
  orderAttack(zombieId) {
    const z = this.zombies.find(z => z.id === zombieId && z.hp > 0);
    if (this.status !== 'playing' || !z) return { ok: false, reason: 'That target is gone.' };
    const team = this.attackCandidates(z);
    if (!team.length) return { ok: false, reason: 'Nobody is close enough and free to respond.' };
    for (const s of team) { s.order = { zombieId: z.id, lastKnown: { x: Math.round(z.x), y: Math.round(z.y) }, lost: 0 }; s.respond = null; s.path = []; }
    this.notify('Attack ordered', team.map(s => s.name).join(', ') + ' moving to engage.', 'good');
    return { ok: true, team };
  }
  cancelAttack(zombieId) {
    const team = this.survivors.filter(s => s.order?.zombieId === zombieId);
    for (const s of team) s.order = null;
    return team.length > 0;
  }
  // Pursue while someone can see the target, then check its last known position briefly.
  pursue(s, stats, dt) {
    const z = this.zombies.find(z => z.id === s.order.zombieId && z.hp > 0);
    if (!z) { s.order = null; return false; }
    const seen = this.survivors.some(o => o.order?.zombieId === z.id && this.active(o) && distance(o, z) < T.combat.sight && this.canSee(o, z)) || this.alerts.some(a => a.threatIds.includes(z.id) && !a.local && this.elapsed - a.lastSeenAt < 1);
    if (seen) { s.order.lastKnown = { x: Math.round(z.x), y: Math.round(z.y) }; s.order.lost = 0; }
    else if ((s.order.lost += dt) > T.combat.investigateSeconds) { s.order = null; return false; }
    s.task = this.travel(s, this.huntPoint(s.order.lastKnown), stats.speed * 1.15, dt) && !seen ? 'investigating' : 'attacking';
    return true;
  }
  phaseChanged(phase) {
    if (phase === 'dusk') {
      this.threatSide = Math.floor(this.random() * 4);
      if (this.day % 5 === 0) this.notify('HORDE NIGHT', 'Far more of the dead are coming tonight, drifting in from the ' + EDGES[this.threatSide] + '. Brace every side.', 'warn');
      else this.notify('Dusk', 'The dead are stirring to the ' + EDGES[this.threatSide] + '. Bring expeditions home and man the towers.', 'warn');
    }
    if (phase === 'midnight') this.notify('Midnight swarm', 'Peak danger until 01:00. Keep every side covered.', 'warn');
  }
  // Threat director: lull -> buildup -> peak (a telegraphed incursion) -> relief -> lull.
  setDirector(state, timer) { Object.assign(this.director, { state, timer, tension: state === 'buildup' ? this.director.tension : 0 }); }
  direct(dt) {
    const d = this.director;
    d.timer -= dt;
    const core = this.core, stressed = core && core.hp < buildingMaxHP(core) * .35;
    if (stressed && d.state !== 'relief' && this.elapsed - d.stressAt >= DAY_SECONDS / 8) {
      d.stressAt = this.elapsed; this.incoming = null; this.setDirector('relief', 20);
      this.notify('A break in the attack', 'The dead fall back for a moment. Repair the HQ while you can.', 'good');
      return;
    }
    if (d.state === 'lull' && d.timer <= 0) this.setDirector('buildup', 90);
    else if (d.state === 'buildup') {
      d.tension += dt * (.6 + 2.4 * this.pressure) * (1 + this.day * .04) * (this.hordeNight ? 1.4 : 1);
      if (d.tension >= 100) this.announceIncursion();
      else if (d.timer <= 0) this.setDirector('lull', 30 + this.random() * 30);
    } else if (d.state === 'peak') {
      if (this.incoming) {
        this.incoming.eta -= dt;
        if (this.incoming.eta <= 0) this.releaseIncursion();
      } else if (d.timer <= 0 || !this.zombies.some(z => z.swarm)) this.setDirector('relief', 25 + this.random() * 15);
    } else if (d.state === 'relief' && d.timer <= 0) this.setDirector('lull', 30 + this.random() * 30);
  }
  announceIncursion() {
    const side = this.random() < .65 ? this.threatSide : Math.floor(this.random() * 4);
    const difficulty = { easy: .75, normal: 1, hard: 1.3 }[this.difficulty] ?? 1;
    const count = Math.min(18, Math.max(1, Math.round((3 + this.day * .45) * (.6 + this.pressure) * (this.hordeNight ? 1.6 : 1) * difficulty)));
    // A sentry on a tower spots the pack earlier.
    const eta = this.towerRadar ? 9 : 5;
    this.incoming = { side, count, eta, total: eta, spotted: this.towerRadar };
    this.setDirector('peak', 60);
  }
  releaseIncursion() {
    const { side, count } = this.incoming, centre = this.random() < .6 ? 0 : this.random() * 1.4 - .7;
    for (let i = 0; i < count && this.zombies.length < 220; i++) {
      const z = this.spawnZombie(side, centre + (this.random() - .5) * .22);
      z.swarm = true;
      const out = 6 + this.random() * 30;
      if (side === 0) z.y -= out; else if (side === 1) z.x += out; else if (side === 2) z.y += out; else z.x -= out;
    }
    if (this.day >= 5 && count >= 6) {
      const lead = this.zombies.filter(z => z.swarm).at(-1);
      if (lead && lead.kind !== 'brute') { lead.kind = 'brute'; lead.maxHP = lead.hp = lead.maxHP * 2.4; lead.speed *= .7; lead.damage *= 2; }
    }
    this.incoming = null;
  }
  hit(z, damage, attacker) {
    if (z.hp <= 0) return;
    z.hp -= damage;
    if (z.hp <= 0) {
      this.kills++;
      this.deposit('wood', .65);
      this.deposit('scrap_metal', .35);
      this.effects.push({ type: 'death', x: z.x, y: z.y, life: 3, maxLife: 3 });
      if (z.kind === 'bloater') {
        this.effects.push({ type: 'burst', x: z.x, y: z.y, radius: 40, life: 0.8, maxLife: 0.8 });
        for (const s of this.survivors) {
          if (distance(s, z) < 40 && !s.sheltered && !s.stationed) {
            if (!this.godmode) {
              s.hp = Math.max(1, s.hp - 18);
              s.lastHit = this.elapsed;
            }
            this.effects.push({ type: 'damage', x: s.x, y: s.y, text: '-18', life: 1, maxLife: 1 });
          }
        }
      }
      if (attacker && 'xp' in attacker) this.grantXP(attacker, T.xp.kill);
    }
  }
  fire(attacker, target, damage) {
    const origin = attacker.perch || attacker;
    this.effects.push({ type: 'shot', x: origin.x, y: origin.y - 7, tx: target.x, ty: target.y - 5, life: .13, maxLife: .13 });
    if (this.buildings.some(b => b.type === 'lab' && has(b, 'incendiary')) && this.random() < 0.35) {
      target.burning = true;
    }
    this.hit(target, damage, attacker);
  }
  setGodmode(enabled) {
    this.godmode = enabled !== undefined ? !!enabled : !this.godmode;
    this.notify(this.godmode ? 'Godmode active' : 'Godmode disabled', this.godmode ? 'Survivors and buildings take no damage.' : 'Normal damage restored.', 'good');
    return this.godmode;
  }
  spawnHorde(count = 10, kind = 'mixed') {
    const kinds = ['walker', 'runner', 'brute', 'bloater', 'soldier'];
    for (let i = 0; i < count; i++) {
      const k = kind === 'mixed' ? kinds[Math.floor(this.random() * kinds.length)] : kind;
      const side = Math.floor(this.random() * 4);
      const z = this.spawnZombie(side);
      if (k && kinds.includes(k)) {
        z.kind = k;
        if (k === 'brute') { z.maxHP = z.hp = z.maxHP * 2.4; z.speed *= 0.7; z.damage *= 2; }
        else if (k === 'runner') { z.speed *= 1.8; }
        else if (k === 'soldier') { z.maxHP = z.hp = z.maxHP * 1.8; z.damage *= 1.5; }
        else if (k === 'bloater') { z.maxHP = z.hp = z.maxHP * 1.5; z.speed *= 0.8; }
      }
    }
    this.notify('Horde spawned', `Spawned ${count} ${kind} zombies.`, 'warn');
    return true;
  }
}
