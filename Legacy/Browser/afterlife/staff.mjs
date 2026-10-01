// Posts, roles, patrol routes, levelling and daily work. Installed onto Game.prototype by model.mjs.
import { TUNING as T, STAT_NAMES, grantStatPoint, statFactor } from './survivors.mjs';
import { HOUR_SECONDS, SIDES, BUILDINGS, ROLES, ROLE_FOR, SHIFTS, SHIFT_HOURS, SHIFT_FILL_ORDER, postSlots, distance, has } from './data.mjs';
import { buildingMaxHP, survivorStats, boundsOf, inside, rectDistance } from './rules.mjs';

export class Staff {
  // Guards cover every side; posted medics, engineers and sentries cover none.
  coverage(side) { return this.patrols.filter(s => s.condition !== 'downed' && !s.sheltered).filter(s => s.role === 'guard' || ((!s.role || s.role === 'patrol') && (s.side === side || s.side === 'any'))).length; }
  safePatrolPosition(side = 'any') {
    const route = this.routes[side];
    const candidates = [route[Math.floor(route.length / 2)], ...route, ...this.routes.any];
    const p = candidates.find(p => !this.buildings.some(b => inside(p, boundsOf(b, 6)))) || { x: 0, y: 144 };
    return [p.x, p.y];
  }
  // Choosing a patrol side also takes a survivor off any building post.
  assign(id, side) {
    const s = this.survivors.find(s => s.id === id);
    if (this.status !== 'playing' || !s || s.expedition || !SIDES.includes(side)) return false;
    s.side = side;
    if (s.post != null) this.setPost(s, null);
    this.resetPatrol(s);
    return true;
  }
  resetPatrol(s) {
    s.path = [];
    s.pathVersion = -1;
    const route = this.route(s);
    s.patrolIndex = route.reduce((best, p, i) => distance(s, p) < distance(s, route[best]) ? i : best, 0);
  }
  postOf(s) { return s.post == null ? null : this.buildings.find(b => b.id === s.post) || null; }
  staffOf(b) { return this.survivors.filter(s => s.post === b.id); }
  statsOf(s) {
    const post = this.postOf(s), tower = s.stationed && s.towerId != null ? this.buildings.find(b => b.id === s.towerId) : null;
    return survivorStats(s, post, tower);
  }
  post(id, buildingId) {
    const s = this.survivors.find(s => s.id === id);
    if (this.status !== 'playing' || !s || s.expedition) return false;
    if (buildingId == null) {
      if (s.post == null && s.role !== 'scavenger') return false;
      this.setPost(s, null);
      this.notify(s.name + ' returned to patrol', 'Covering ' + (s.side === 'any' ? 'all sides' : 'the ' + s.side + ' side') + ' again.', 'good');
      return true;
    }
    if (buildingId === 'scavenger') {
      if (s.role === 'scavenger') return false;
      this.setPost(s, null); s.role = 'scavenger'; this.equipAll();
      this.notify(s.name + ' is now a scavenger', ROLES.scavenger.description, 'good');
      return true;
    }
    const b = this.buildings.find(b => b.id === buildingId);
    if (!b || !ROLE_FOR[b.type] || s.post === b.id || this.staffOf(b).length >= postSlots(b)) return false;
    this.setPost(s, b);
    this.notify(s.name + ' is now a ' + ROLES[s.role].name.toLowerCase(), ROLES[s.role].description, 'good');
    return true;
  }
  setPost(s, b) {
    const before = survivorStats(s).hp;
    s.post = b ? b.id : null;
    s.role = b ? ROLE_FOR[b.type] : 'patrol';
    s.shift = b?.type === 'tower' ? this.openShift(b, s) : null;
    if (s.resting) this.wake(s);
    this.dismount(s); s.goalKey = ''; s.job = null; s.hunt = null; s.task = ''; s.respond = null; s.tendSpot = null;
    const after = survivorStats(s).hp;
    s.hp = after > before ? s.hp + after - before : Math.min(s.hp, after);
    this.resetPatrol(s);
    this.equipAll();
    if (b?.type === 'barracks' && this.beds(b) > this.residents(b).length) {
      s.home = b.id;
    } else if (!b && s.home != null) {
      const currentHome = this.buildings.find(h => h.id === s.home);
      if (currentHome?.type === 'barracks') {
        s.home = null;
        this.assignHome(s);
      }
    }
  }
  // A shift at this tower that none of its other sentries keeps: the one on now if it is open,
  // otherwise the most dangerous.
  openShift(b, s) {
    const taken = new Set(this.staffOf(b).filter(o => o !== s).map(o => o.shift));
    const now = SHIFTS.findIndex(sh => (this.hour - sh.start + 24) % 24 < SHIFT_HOURS);
    return [now, ...SHIFT_FILL_ORDER].find(i => !taken.has(i)) ?? null;
  }
  // Sentries keep rotating 8-hour tower shifts; everyone else works during daylight. Everyone turns out for the alarm.
  onDuty(s) {
    if (this.alarm.raised) return true;
    if (s.role === 'sentry') {
      if (!SHIFTS[s.shift]) return true;
      return (this.hour - SHIFTS[s.shift].start + 1 + 48) % 24 < SHIFT_HOURS + 1;
    }
    return !this.night;
  }
  // At the end of a shift the sentry on the platform stays up to two hours over until the next one arrives.
  awaitingRelief(s, post) {
    if (!s.stationed || !SHIFTS[s.shift] || (this.hour - SHIFTS[s.shift].start - SHIFT_HOURS + 48) % 24 >= 2) return false;
    return this.staffOf(post).some(o => o !== s && this.onDuty(o) && this.active(o) && !(o.stationed && o.towerId === post.id));
  }
  bedOf(s) {
    const home = s.home != null && this.buildings.find(b => b.id === s.home);
    if (home) return home;
    if (s.role === 'guard' && s.post != null) {
      const barracks = this.buildings.find(b => b.id === s.post);
      if (barracks) return barracks;
    }
    if (s.role === 'guard') {
      const anyBarracks = this.buildings.find(b => b.type === 'barracks');
      if (anyBarracks) return anyBarracks;
    }
    const dorm = this.buildings.find(b => b.type === 'dorm');
    if (dorm) return dorm;
    return this.core;
  }
  // Off shift or off duty, survivors walk back to their bed (bunkhouse, barracks or HQ) and rest inside out of reach.
  rest(s, stats, dt) {
    const bed = this.bedOf(s);
    const spot = bed && this.goalFor(s, bed);
    if (!spot) { s.task = 'standby'; return; }
    if (this.travel(s, spot, stats.speed, dt)) Object.assign(s, { resting: true, sheltered: true, restAt: bed.id, task: 'resting', fighting: false });
    else s.task = 'to-bed';
  }
  wake(s) {
    s.resting = false;
    s.sheltered = false;
    s.restAt = null;
    s.path = [];
    s.pathVersion = -1;
    s.goalKey = '';
  }
  // Off whatever watchtower they were on or heading to.
  dismount(s) { s.stationed = false; s.perch = null; s.towerId = null; }
  // Walk to the foot of a watchtower and climb onto its platform. With no tower given, take the
  // nearest one nobody else is on, heading to, or posted at; `inside` keeps to towers within the
  // wall. False if there is none.
  climbTower(s, tower, stats, dt, inside = false) {
    if (!tower) {
      const claimed = new Set(this.survivors.filter(o => o !== s && o.towerId != null).map(o => o.towerId));
      for (const o of this.survivors) if (o !== s && o.role === 'sentry' && o.post != null) claimed.add(o.post);
      tower = this.buildings.find(b => b.id === s.towerId && b.type === 'tower' && b.hp > 0) || this.buildings.filter(b => b.type === 'tower' && b.hp > 0 && !claimed.has(b.id) && !(inside && this.outside(b))).sort((a, b) => distance(s, a) - distance(s, b))[0];
      if (!tower) return false;
    }
    if (s.towerId !== tower.id) this.dismount(s);
    s.towerId = tower.id;
    if (s.stationed) { s.task = 'manning'; return true; }
    const spot = this.goalFor(s, tower);
    if (!spot) { s.task = 'standby'; return true; }
    if (this.travel(s, spot, stats.speed, dt)) { s.stationed = true; s.perch = { x: tower.x, y: tower.y - 34 }; s.task = 'manning'; }
    else s.task = 'to-tower';
    return true;
  }
  releasePost(b) {
    const staff = this.staffOf(b);
    for (const s of staff) this.setPost(s, null);
    if (staff.length) this.notify(BUILDINGS[b.type].name + ' staff reassigned', staff.map(s => s.name).join(', ') + (staff.length > 1 ? ' are' : ' is') + ' back on patrol.', 'warn');
  }
  xpNeeded(s) { return T.xp.base + s.level * T.xp.perLevel; }
  // XP → level → one automatic, seeded stat point per level (V1 policy), capped at 10.
  grantXP(s, amount) {
    s.xp += amount;
    for (let need = this.xpNeeded(s); s.xp >= need; need = this.xpNeeded(s)) {
      s.xp -= need; s.level++;
      const before = survivorStats(s).hp, key = grantStatPoint(s.stats, s.aptitudes, s.gen.seed, s.level);
      if (!key) s.unspent++;
      const after = survivorStats(s).hp;
      if (after > before) s.hp += after - before;
      this.notify(s.name + ' reached level ' + s.level, key ? '+1 ' + STAT_NAMES[key] + ' (now ' + s.stats[key] + ').' : 'Every stat is already at 10.', 'good');
    }
  }
  route(s) { return this.routes[s.role === 'guard' ? 'any' : s.side]; }
  work(s, post, stats, dt) {
    if (s.role === 'sentry' && post) {
      if (this.onDuty(s) || this.awaitingRelief(s, post)) { this.climbTower(s, post, stats, dt); return; }
      if (s.towerId != null) this.dismount(s);
      return this.rest(s, stats, dt);
    }
    if (!this.onDuty(s)) {
      if (s.towerId != null) this.dismount(s);
      s.job = null; s.hunt = null; s.tendSpot = null;
      return this.rest(s, stats, dt);
    }
    // Medics work from the clinic and treat the most serious patient who has come in.
    if (s.role === 'medic' && post) {
      const ratio = p => p.hp / survivorStats(p).hp;
      const patients = this.survivors.filter(p => p.care === 'waiting' && p.careAt === post.id && p.condition !== 'downed' && !p.expedition);
      let patient = patients.find(p => p.id === s.job);
      if (!patient) {
        const taken = new Set(this.survivors.filter(m => m !== s && m.role === 'medic' && m.job != null).map(m => m.job));
        patient = patients.filter(p => !taken.has(p.id)).sort((a, b) => ratio(a) - ratio(b))[0];
        s.job = patient?.id ?? null;
      }
      if (!patient) return this.standBy(s, post, stats.speed, dt);
      if (patient !== s && distance(s, patient) > 22) { this.travel(s, patient, stats.speed, dt); s.task = 'to-patient'; return; }
      const rate = T.health.medicRate * (1 + (has(post, 'salves') ? .5 : 0) + (has(post, 'ward') ? .5 : 0)) * statFactor(s.stats.int, T.effects.workPerIntelligence);
      patient.hp = Math.min(survivorStats(patient).hp, patient.hp + rate * dt);
      patient.treatedBy = s.id;
      this.grantXP(s, T.xp.treatPerSecond * dt);
      if (patient.hp >= survivorStats(patient).hp * T.health.recoveryThreshold) { patient.care = null; patient.careAt = null; patient.treatedBy = null; this.updateCondition(patient); s.job = null; }
      s.task = 'healing';
      s.facing = patient.x < s.x ? -1 : patient.x > s.x ? 1 : s.facing;
      s.fxTimer = (s.fxTimer || 0) - dt;
      if (s.fxTimer <= 0) { s.fxTimer = .4; this.effects.push({ type: 'heal', x: patient.x, y: patient.y - 14, life: .7, maxLife: .7 }); }
      return;
    }
    // Farmers cycle around their plot: plant, tend, harvest.
    if (s.role === 'farmer' && post) {
      s.tendTimer = (s.tendTimer || 0) - dt;
      if (!s.tendSpot || s.tendTimer <= 0) {
        const r = boundsOf(post), corners = [{ x: r.left, y: r.top }, { x: r.right, y: r.top }, { x: r.right, y: r.bottom }, { x: r.left, y: r.bottom }];
        s.tendIndex = ((s.tendIndex ?? s.id) + 1) % 4; s.tendSpot = this.approachPoint(post, corners[s.tendIndex]); s.tendTimer = 6;
      }
      if (!s.tendSpot) return this.standBy(s, post, stats.speed, dt);
      if (!this.travel(s, s.tendSpot, stats.speed, dt)) { s.task = 'to-field'; return; }
      s.task = ['planting', 'tending', 'harvesting'][Math.floor(this.elapsed / (HOUR_SECONDS * 2)) % 3];
      return;
    }
    if (s.role === 'scavenger') {
      if (!this.core) { s.task = 'standby'; return; }
      this.standBy(s, this.core, stats.speed, dt);
      if (s.task === 'standby') s.task = 'preparing';
      return;
    }
    if (s.role === 'engineer' && post) {
      const missing = b => b.type === 'breach' ? 1 : 1 - b.hp / buildingMaxHP(b);
      // A hole in the fence counts as fully damaged, so it comes first. Each engineer takes a different hole.
      const taken = new Set(this.survivors.filter(o => o !== s && o.role === 'engineer' && typeof o.job === 'string').map(o => o.job));
      const breaches = this.afford(BUILDINGS.barricade.cost) ? this.breaches().filter(h => !taken.has(h.key)).map(h => ({ ...h, id: h.key, type: 'breach' })) : [];
      // Finish a started repair or rebuild; only pick up new jobs that are noticeably damaged.
      let job = typeof s.job === 'string' ? breaches.find(h => h.key === s.job) : this.buildings.find(b => b.id === s.job && missing(b) > 0);
      if (!job) {
        job = [...this.buildings.filter(b => missing(b) > .002), ...breaches].sort((a, b) => missing(b) - missing(a) || distance(s, a) - distance(s, b))[0];
        s.job = job?.id ?? null;
      }
      if (!job) return this.standBy(s, post, stats.speed, dt);
      const panel = job.type === 'breach' ? { id: job.key, type: 'barricade', x: job.x, y: job.y, rotation: job.rotation } : job;
      if (job.type !== 'breach' && !job.raising && this.resources.wood < .1) { this.standBy(s, post, stats.speed, dt); s.task = 'no-wood'; return; }
      const spot = this.goalFor(s, panel);
      if (!spot) { s.job = null; return; }
      if (rectDistance(s, boundsOf(panel)) > 26 && !this.travel(s, spot, stats.speed, dt)) { s.task = job.type === 'breach' ? 'to-rebuild' : 'to-repair'; return; }
      if (job.type === 'breach') {
        // Frame a new panel for the usual barricade cost, then raise it to full strength like a repair.
        if (!this.canPlace('barricade', job.x, job.y, job.rotation).ok) { s.task = 'rebuild-blocked'; return; }
        this.spend(BUILDINGS.barricade.cost);
        job = this.addBuilding('barricade', job.x, job.y, job.rotation);
        Object.assign(job, { perimeter: true, raising: true, hp: 1 });
        s.job = job.id; s.goalKey = '';
      }
      // Repairs cost the same wood per point of durability as a manual repair; raising a new panel is already paid for.
      const amount = Math.min(14 * (has(post, 'machinery') ? 1.5 : 1) * statFactor(s.stats.int, T.effects.workPerIntelligence) * dt, buildingMaxHP(job) - job.hp, job.raising ? Infinity : this.resources.wood * 16);
      job.hp += amount;
      if (!job.raising) this.resources.wood -= amount / 16;
      else if (job.hp >= buildingMaxHP(job)) delete job.raising;
      s.task = job.raising ? 'rebuilding' : 'repairing';
      s.facing = job.x < s.x ? -1 : 1;
      s.fxTimer = (s.fxTimer || 0) - dt;
      if (s.fxTimer <= 0) { s.fxTimer = .3; this.effects.push({ type: 'repair', x: s.x + s.facing * 9, y: s.y - 8, life: .45, maxLife: .45 }); }
      return;
    }
    // Guards work outside the wall. The wounded don't go out: they shoot from a watchtower inside
    // the wall instead, or wait inside the gate if there is none free.
    if (s.role === 'guard' || s.role === 'patrol' || !s.role) {
      if (s.towerCooldown > 0) s.towerCooldown -= dt;
      if (s.condition === 'injured') {
        s.injuredRefuge = true;
        if (this.climbTower(s, null, stats, dt, true)) return;
        const gate = this.gateways.reduce((a, g) => !a || distance(g.inner, s) < distance(a.inner, s) ? g : a, null);
        s.task = !gate || this.travel(s, gate.inner, stats.speed, dt) ? 'holding' : 'falling-back';
        return;
      }
      if (s.injuredRefuge) {
        s.injuredRefuge = false;
        s.towerCooldown = 1;
        if (s.towerId != null) this.dismount(s);
      }
      if (s.towerId != null) {
        const tower = this.buildings.find(b => b.id === s.towerId);
        const sentryAssigned = tower && this.staffOf(tower).some(o => o.role === 'sentry' && o !== s);
        if (!tower || tower.hp <= 0 || (sentryAssigned && s.role !== 'sentry')) {
          this.dismount(s);
        } else {
          if (s.stationed) { s.task = 'manning'; return; }
          const spot = this.goalFor(s, tower);
          if (spot && this.travel(s, spot, stats.speed, dt)) {
            s.stationed = true;
            s.perch = { x: tower.x, y: tower.y - 34 };
            s.task = 'manning';
          } else s.task = 'to-tower';
          return;
        }
      }
      // Guards go out of their way to use watchtowers if guards are not assigned to them
      if (!s.towerCooldown || s.towerCooldown <= 0) {
        if (this.climbTower(s, null, stats, dt, false)) return;
      }
    }
    if (s.role === 'guard') {
      if (this.alarm.raised && s.stationed) { s.task = 'holding'; return; }
      s.huntTimer = (s.huntTimer || 0) - dt;
      if (s.huntTimer <= 0) {
        s.huntTimer = .4;
        const reach = 260 * (post && has(post, 'rally') ? 1.5 : 1);
        const prey = this.zombiesNear(s, reach).filter(z => z.hp > 0 && distance(s, z) < reach && this.canSee(s, z)).sort((a, b) => distance(s, a) - distance(s, b))[0];
        s.hunt = prey ? this.huntPoint(prey) : null;
      }
      if (s.hunt) { if (s.towerId != null) this.dismount(s); this.travel(s, s.hunt, stats.speed * 1.15, dt); s.task = 'hunting'; return; }
      // Under the alarm, barracks guards with nothing to chase get up on a watchtower.
      if (this.alarm.raised && this.climbTower(s, null, stats, dt)) return;
      return this.patrol(s, stats.speed, dt);
    }
    this.patrol(s, stats.speed, dt);
  }
}
