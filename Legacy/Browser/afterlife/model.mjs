// The simulation has no browser dependencies so combat, economy and progression
// can be exercised with the same fixed timestep used by the renderer.
import { initialLand, landBounds, patrolRoutes } from './land.mjs';
import { TUNING as T } from './survivors.mjs';
import { HOUR_SECONDS, DAY_SECONDS, RUN_DAYS, SIDES, phaseAt, circadian, TRADES, describeTrade, BUILDINGS, jobOf, distance, has } from './data.mjs';
import { buildingMaxHP, survivorStats, boundsOf, inside } from './rules.mjs';
import { Buildings } from './buildings.mjs';
import { Economy } from './economy.mjs';
import { Expeditions } from './expeditions.mjs';
import { Recruitment } from './recruitment.mjs';
import { Staff } from './staff.mjs';
import { Navigation } from './navigation.mjs';
import { Health } from './health.mjs';
import { Combat } from './combat.mjs';
import { Save } from './save.mjs';
import { buildIndex, near, buildingReach } from './spatial.mjs';
import { scatterTrees, steerAroundTrees } from './trees.mjs';
export { HOUR_SECONDS, DAY_SECONDS, RUN_DAYS, SAVE_VERSION, SIDES, PHASES, phaseAt, circadian, DIRECTOR_STATES, RESOURCE_NAMES, EXPEDITIONS, BUILDINGS, BUILDING_TREES, ROLES, JOBS, jobOf, ROLE_FOR, postSlots, clamp, distance, has } from './data.mjs';
export { buildingMaxHP, survivorStats, boundsOf } from './rules.mjs';

export class Game {
  constructor(random = Math.random) {
    this.random = random;
    this.bounds = { x: 640, y: 400 };
    this.events = [];
    this.effects = [];
    this.reset();
  }
  reset() {
    this.elapsed = 0;
    this.status = 'playing';
    this.resources = { wood: 145, metal: 75, food: 90 };
    this.buildings = [];
    this.survivors = [];
    this.zombies = [];
    this.effects = [];
    this.events = [];
    this.kills = 0;
    this.nextId = 1;
    this.spawnTimer = 8;
    this.director = { state: 'lull', timer: 40, tension: 0, stressAt: -1e9 };
    this.incoming = null;
    this.threatSide = Math.floor(this.random() * 4);
    this.recruitTimer = 0;
    this.recruited = 0;
    this.worldSeed = Math.floor(this.random() * 4294967296);
    this.nextEventId = 1;
    this.items = [];
    this.candidates = [];
    this.alerts = [];
    this.alarm = { raised: false, quiet: 0 };
    this.shelterOrder = null;
    this.broadcasting = false;
    this.openings = []; // Fence slots the player dismantled on purpose; engineers leave them open.
    this.perceiveTimer = 0;
    this.navVersion = 0;
    this.land = initialLand();
    this.landRevision = (this.landRevision || 0) + 1;
    this.navigation = null;
    this.routes = patrolRoutes(this.land);
    this.starvationWarning = false;
    this.trader = null;
    this.traderTimer = 60 + this.random() * 60;
    this.addBuilding('core', 0, 0);
    this.addBuilding('workshop', -112, -64);
    this.addBuilding('dorm', 112, -64);
    this.addBuilding('farm', -112, 64);
    this.extendPerimeter([]);
    for (const side of SIDES.slice(1)) this.addSurvivor(side);
    for (const type of ['rifle', 'pistol', 'pistol', 'pistol', 'pipe']) this.addItem(type);
    this.equipAll();
    this.notify('A new beginning', 'Four survivors. One refuge. Make it to Day 24.', 'good');
  }
  get day() { return Math.min(RUN_DAYS, Math.floor(this.elapsed / DAY_SECONDS) + 1); }
  get hour() { return (6 + this.elapsed / DAY_SECONDS * 24) % 24; }
  get night() { return this.hour >= 18 || this.hour < 6; }
  get hordeNight() { return this.night && this.day % 5 === 0; }
  get phase() { return phaseAt(this.hour); }
  get pressure() { return circadian(this.hour); }
  get core() { return this.buildings.find(b => b.type === 'core'); }
  get clinic() { return this.buildings.find(b => b.type === 'clinic'); }
  get territory() { return landBounds(this.land); }
  get patrols() { return this.survivors.filter(s => !s.expedition); }
  // The wild trees depend on the claimed land and the visible world, so rebuild when either changes.
  get forest() {
    const key = this.landRevision + ':' + this.bounds.x + ':' + this.bounds.y;
    if (this._forest?.key !== key) this._forest = { key, ...scatterTrees(this.land, this.bounds) };
    return this._forest;
  }
  warnings() {
    const warnings = [];
    const empty = (!this.night || this.alarm.raised) ? SIDES.slice(1).filter(side => !this.coverage(side)) : [];
    if (empty.length) warnings.push('No patrol: ' + empty.join(', '));
    const foodRate = this.rates().food;
    if (this.resources.food <= 1) warnings.push('Starvation! Build a farm or scavenge food.');
    else if (foodRate < 0 && this.resources.food / -foodRate < 180) warnings.push('Food runs out in ' + Math.ceil(this.resources.food / -foodRate) + 's at 1×');
    if (this.core && this.core.hp < buildingMaxHP(this.core) * .5) warnings.push('HQ integrity critical — repair now');
    if (!this.night && this.day % 5 === 0) warnings.push('Horde tonight — reinforce your defenses before dusk.');
    for (const d of this.survivors.filter(s => s.condition === 'downed')) warnings.push(d.name + ' is down — ' + (d.bleed / HOUR_SECONDS).toFixed(1) + 'h to bleed out' + (d.rescuer != null ? ' · help is coming' : ''));
    const injured = this.survivors.filter(s => s.condition === 'injured' && !s.expedition).length;
    if (injured && !this.clinicsWithMedics().length) warnings.push(injured + ' injured — post a medic at a clinic');
    if (this.unhoused.length) warnings.push(this.unhoused.length + ' without a bed — build a bunkhouse');
    return warnings;
  }
  notify(title, message, tone = '') { this.events.push({ title, message, tone }); }
  afford(cost) { return Object.entries(cost).every(([r, value]) => this.resources[r] >= value); }
  spend(cost) { if (!this.afford(cost)) return false; for (const [r, value] of Object.entries(cost)) this.resources[r] -= value; return true; }
  // Proximity queries. Inside step() they use indexes built for the current positions;
  // anywhere else they return every candidate, so a stale index is never read. Callers apply exact checks.
  zombiesNear(p, r) { return this.zombieIndex ? near(this.zombieIndex, p, r) : this.zombies; }
  patrolsNear(p, r) { return this.patrolIndex ? near(this.patrolIndex, p, r) : this.patrols; }
  buildingsNear(p, padding) { return this.buildingIndex ? near(this.buildingIndex, p, buildingReach(padding)) : this.buildings; }
  step(dt) {
    this.zombieIndex = this.patrolIndex = this.buildingIndex = null;
    if (this.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    // Split long steps so fast-forward and automated checks preserve collisions.
    if (dt > .05) { let left = dt; while (left > 1e-8 && this.status === 'playing') { const part = Math.min(.05, left); this.step(part); left -= part; } return; }
    const wasNight = this.night, wasDay = this.day, wasPhase = this.phase.id;
    this.elapsed += dt;
    if (this.elapsed >= DAY_SECONDS * RUN_DAYS) {
      this.elapsed = DAY_SECONDS * RUN_DAYS;
      this.status = 'won';
      this.notify('You made it through', 'Twenty-four days. Your refuge is still standing.', 'good');
      return;
    }
    const wasHorde = wasNight && wasDay % 5 === 0;
    const phase = this.phase.id;
    if (wasPhase !== phase) this.phaseChanged(phase);
    if (wasDay !== this.day) {
      this.notify('Day ' + this.day + ' — still here', 'A new dawn. Repair the walls and prepare for tonight.', 'good');
      if (wasHorde) {
        this.resources.wood += 45; this.resources.metal += 20; this.resources.food += 15;
        this.notify('The horde is broken', 'Salvaged from the fallen: +45 wood · +20 metal · +15 food.', 'good');
      }
    }
    const rates = this.rates();
    for (const r of Object.keys(rates)) this.resources[r] = Math.max(0, this.resources[r] + rates[r] * dt);
    if (this.resources.food < 1 && !this.starvationWarning) { this.starvationWarning = true; this.notify('Food has run out', 'Survivors are losing health. Build or upgrade a farm.', 'warn'); }
    if (this.resources.food > 5) this.starvationWarning = false;
    if (this.trader) {
      this.trader.remaining -= dt;
      if (this.trader.remaining <= 0) { this.trader = null; this.traderTimer = 150 + this.random() * 120; this.notify('The trader moved on', 'Their offer is gone for now.', ''); }
    } else {
      this.traderTimer -= dt;
      if (this.traderTimer <= 0) {
        const offer = TRADES[Math.floor(this.random() * TRADES.length)], f = 1 + (this.bestCharisma - 4) * T.effects.charismaTrade;
        this.trader = { give: offer.give, get: Object.fromEntries(Object.entries(offer.get).map(([r, n]) => [r, Math.round(n * f)])), remaining: 45 };
        this.notify('A trader arrived', 'Offering ' + describeTrade(this.trader) + ' · 45 seconds to decide.', 'good');
      }
    }
    // A disabled spawner (spawnTimer parked far in the future) also silences the director.
    if (this.spawnTimer < 1e6) {
      this.direct(dt);
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const rate = this.spawnRate(), count = this.pressure > .3 ? 1 + Math.floor(this.day / 7) : 1;
        if (rate > 0) for (let i = 0; i < count; i++) if (this.zombies.length < 220) this.spawnZombie(this.ambientSide());
        this.spawnTimer = rate > 0 ? count / rate * (.7 + this.random() * .6) : 1;
      }
    }
    // Zombies hold still from here until their own movement loop below.
    this.zombieIndex = buildIndex(this.zombies);
    let heal = .38;
    for (const b of this.buildings) {
      if (b.type === 'dorm') heal += (has(b, 'comfort') ? .095 : 0) + (has(b, 'infirmary') ? .285 : 0);
      if (b.type === 'clinic') heal += (has(b, 'salves') ? .15 : 0) + (has(b, 'ward') ? .15 : 0);
    }
    const antibiotics = this.clinic && has(this.clinic, 'antibiotics'), starving = this.resources.food <= 0 && !antibiotics;
    this.recruitment(dt);
    this.resolveExpeditions(dt);
    this.perceiveTimer -= dt;
    if (this.perceiveTimer <= 0) { this.perceiveTimer = .5; this.perceive(); }
    this.scheduleRescues();
    // Priority: emergency (downed) → combat → orders → shelter → rescue → medical need → alerts → job → idle.
    for (const s of [...this.survivors]) {
      if (s.expedition) { if (starving) s.hp -= dt * .65; continue; }
      if (s.condition === 'downed') {
        if (!s.stabilizing) s.bleed -= dt;
        if (s.bleed <= 0) this.kill(s, 'They bled out before anyone could reach them.');
        continue;
      }
      if (s.arriving && !this.outside(s)) s.arriving = false;
      const post = this.postOf(s), tower = s.stationed && s.towerId != null ? this.buildings.find(b => b.id === s.towerId) : null;
      const stats = survivorStats(s, post, tower), max = stats.hp;
      s.cooldown = Math.max(0, s.cooldown - dt);
      if (!s.sheltered) this.grantXP(s, dt * T.xp.dutyPerSecond);
      if (starving) s.hp -= dt * .65;
      // Resting only mends light wounds; the injured need a clinic.
      else if (this.elapsed - s.lastHit > 8 && s.hp >= max * T.health.injuryThreshold) s.hp = Math.min(max, s.hp + heal * dt);
      this.updateCondition(s, max);
      s.pathRetry = Math.max(0, (s.pathRetry || 0) - dt);
      // A resting survivor gets up for their duty or the alarm, or to see a medic.
      if (s.resting && (this.onDuty(s) || (s.condition === 'injured' && this.clinicsWithMedics().length))) this.wake(s);
      if (s.sheltered) { s.task = s.resting ? 'resting' : 'sheltered'; s.fighting = false; continue; }
      const origin = s.perch || s, ordered = s.order && this.zombies.find(z => z.id === s.order.zombieId && z.hp > 0);
      // Only the dead on this side of the wall are visible, unless the survivor is up on a tower.
      let target = ordered && distance(origin, ordered) < stats.range && this.canSee(s, ordered) ? ordered : null, nearest = stats.range;
      if (!target) for (const z of this.zombiesNear(origin, stats.range)) { const d = distance(origin, z); if (z.hp > 0 && d < nearest && this.canSee(s, z)) { target = z; nearest = d; } }
      s.fighting = !!target;
      if (target) {
        s.task = 'engaging';
        s.facing = target.x < origin.x ? -1 : 1;
        if (s.cooldown <= 0) { this.fire(s, target, stats.damage); s.cooldown = stats.cooldown; }
        // Workers shout a short-range report so nearby guards come to help.
        if (jobOf(s) !== 'guard') this.sight(target, { survivorId: s.id });
        continue;
      }
      if (s.order && this.pursue(s, stats, dt)) continue;
      // Workers use towers / shelters when in danger
      if (jobOf(s) !== 'guard' && s.shelter == null && !this.shelterOrder) {
        if (s.lastHit > 0 && this.elapsed - s.lastHit < 4 && s.condition === 'injured') {
          const shelters = this.buildings.filter(b => this.shelterCapacity(b) > 0 && b.hp > 0);
          const occupied = b => this.survivors.filter(o => o.shelter === b.id).length;
          const targetShelter = shelters.filter(b => occupied(b) < this.shelterCapacity(b)).sort((a, b) => distance(s, a) - distance(s, b))[0];
          if (targetShelter) {
            s.shelter = targetShelter.id;
            s.emergencyShelter = true;
            s.goalKey = '';
          }
        }
      } else if (s.emergencyShelter && !this.shelterOrder) {
        const danger = this.zombiesNear(s, 110).some(z => z.hp > 0) || (s.lastHit > 0 && this.elapsed - s.lastHit < 6);
        if (!danger) {
          s.shelter = null;
          s.sheltered = false;
          s.emergencyShelter = false;
          s.goalKey = '';
        }
      }
      if (s.shelter != null && this.goShelter(s, stats, dt)) continue;
      if (s.rescue != null && this.doRescue(s, stats, dt)) continue;
      if (this.seekCare(s, stats, dt)) continue;
      if (s.respond && this.respond(s, stats, dt)) continue;
      if (this.alarm.raised && s.role === 'patrol' && s.condition !== 'injured') {
        const route = this.route(s), spot = route[Math.floor(route.length / 2)];
        s.task = this.travel(s, spot, stats.speed, dt) ? 'holding' : 'to-position';
        continue;
      }
      // A new arrival checks in through the nearest gate before taking up any duty.
      if (s.arriving) {
        const gate = this.gateways.reduce((a, g) => !a || distance(g.outer, s) < distance(a.outer, s) ? g : a, null);
        if (gate) { this.travel(s, gate.inner, stats.speed, dt); continue; }
      }
      this.work(s, post, stats, dt);
    }
    for (const b of this.buildings) {
      if (b.type === 'core' && has(b, 'bunker')) b.hp = Math.min(buildingMaxHP(b), b.hp + dt * .7);
      if (b.type !== 'tower') continue;
      b.cooldown -= dt;
      // A wall tower's gun only fires with someone up on the platform.
      b.staffed = this.patrols.some(s => s.hp > 0 && !s.sheltered && s.stationed && s.towerId === b.id);
      if (!b.staffed || b.cooldown > 0) continue;
      const range = 155 + (has(b, 'scope') ? 45 : 0) + (has(b, 'spotlight') ? 55 : 0);
      const target = this.zombiesNear(b, range).filter(z => z.hp > 0 && distance(z, b) < range).sort((a, c) => distance(a, b) - distance(c, b))[0];
      if (target) { this.fire(b, target, 22 + (has(b, 'rounds') ? 12 : 0)); b.cooldown = has(b, 'rapid') ? .8 : 1.6; }
    }
    // Survivors and buildings hold still while the zombies move.
    this.patrolIndex = buildIndex(this.patrols);
    this.buildingIndex = buildIndex(this.buildings);
    for (const z of this.zombies) {
      if (z.hp <= 0) continue;
      const prey = this.patrolsNear(z, 38).filter(s => s.hp > 0 && !s.sheltered && distance(z, s) < 38).sort((a, b) => distance(a, z) - distance(b, z))[0];
      const target = prey || this.core;
      if (!target) break;
      const d = distance(z, target);
      const wobble = prey ? 0 : Math.sin(this.elapsed * .6 + z.seed) * .4;
      const angle = Math.atan2(target.y - z.y, target.x - z.x) + wobble;
      // The dead shamble around tree trunks rather than through them.
      const next = steerAroundTrees(this.forest, z, { x: Math.cos(angle), y: Math.sin(angle) }, z.speed * dt, z.kind === 'brute' ? 6 : 4, z.seed % 2 < 1 ? 1 : -1);
      const pad = z.kind === 'brute' ? 9 : 5, obstacle = this.buildingsNear(next, pad).find(b => b.hp > 0 && inside(next, boundsOf(b, pad)));
      if (obstacle) {
        obstacle.hp -= z.damage * dt;
        z.bashing = this.elapsed; // Heard across the refuge, wall or no wall.
        z.facing = obstacle.x < z.x ? -1 : 1;
        if (has(obstacle, 'wire')) this.hit(z, (4 + (has(obstacle, 'spikes') ? 10 : 0)) * dt);
      } else if (prey && d < 13) {
        const tower = prey.stationed && this.buildings.find(b => b.id === prey.towerId);
        if (tower) { tower.hp -= z.damage * dt; z.bashing = this.elapsed; }
        else {
          const preyTower = prey.stationed && prey.towerId != null ? this.buildings.find(b => b.id === prey.towerId) : null;
          prey.hp -= z.damage * survivorStats(prey, this.postOf(prey), preyTower).armor * dt;
          prey.lastHit = this.elapsed;
          z.attacking = this.elapsed;
        }
        z.facing = prey.x < z.x ? -1 : 1;
      } else { z.x = next.x; z.y = next.y; z.facing = next.dx < 0 ? -1 : 1; }
    }
    for (const s of this.survivors.filter(s => s.hp <= 0 && s.condition !== 'downed')) {
      if (s.expedition) this.kill(s, 'They starved on the road.');
      else this.down(s);
    }
    const fallen = this.buildings.filter(b => b.hp <= 0);
    this.buildings = this.buildings.filter(b => b.hp > 0);
    for (const b of fallen) {
      this.navVersion++;
      this.releasePost(b);
      this.buildingLost(b);
      if (b.type === 'core') { this.status = 'lost'; this.notify('The refuge has fallen', 'The dead broke through your last line of defense.', 'warn'); }
      else if (b.type !== 'barricade') this.notify(BUILDINGS[b.type].name + ' destroyed', 'Rebuild it from the construction menu.', 'warn');
    }
    this.zombieIndex = this.patrolIndex = this.buildingIndex = null;
    this.zombies = this.zombies.filter(z => z.hp > 0);
    this.effects.forEach(e => e.life -= dt);
    this.effects = this.effects.filter(e => e.life > 0);
  }
}
// Each subsystem is a class whose methods and getters run with `this` bound to the Game.
for (const part of [Buildings, Economy, Expeditions, Recruitment, Staff, Navigation, Health, Combat, Save]) {
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(part.prototype))) {
    if (key === 'constructor') continue;
    if (Object.hasOwn(Game.prototype, key)) throw new Error('Game.' + key + ' is defined twice');
    Object.defineProperty(Game.prototype, key, descriptor);
  }
}
