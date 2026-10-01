// Campaign defense (Phase 1): the infected's own stats and blows, guards on Guard Post routes with Intercept
// or Hold stances, the Lookout's 45-tile watch, pistols that need ammunition, P1-07's scripted Wanderer and,
// once it has been dealt with, a slow trickle of infected from beyond the perimeter. Legacy runs keep
// combat.mjs's director. Installed onto Game.prototype by model.mjs.
import { CAMPAIGN, CENTROCOM, MARA, campaignIdOf, fill } from './campaignState.mjs';
import { WEAPONS } from './survivors.mjs';
import { HOUR_SECONDS, distance } from './data.mjs';
import { boundsOf, inside } from './rules.mjs';
import { WATCH_POSTS } from './campWork.mjs';

const C = CAMPAIGN.tuning.combat, TILE = 16;
const W = C.wanderer;
export const STANCES = ['intercept', 'hold'];
export const GUARD_ROUTES = ['Perimeter loop', 'Approach watch'];
const COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
// Hours between infected arriving once threats are on, before the difficulty's multiplier. Phase 1's real test
// is the migration (P1-09); until then the trickle is a lone Wanderer now and then, a second after day 10.
const THREAT_HOURS = 10;
// The tutorial Wanderer starts 50 tiles out; an infected that wanders off this far counts as driven away.
const WANDERER_TILES = 50, DRIVEN_OFF_TILES = 75;
const SPEARS_AND_GUNS = ['improvised_spear', 'basic_pistol'];

export class Defense {
  // ---- The infected ----
  // A campaign infected (spec Wanderer): blows of 8 every 2 seconds at arm's reach, 4 a second against structures.
  campaignInfected(z) {
    const k = .9 + this.random() * .2;
    return Object.assign(z, { kind: 'walker', hp: W.hp, maxHP: W.hp, speed: W.speed * TILE * k, damage: W.attackDamage, structureDamage: W.structureDamage, swing: 0, sight: W.sightTiles * TILE });
  }
  // One blow from an infected: armor, the tutorial's cap (never below 50 HP), then the bleed and bite rolls.
  strike(z, prey, armor = 1) {
    let damage = z.damage * armor;
    if (z.tutorial) damage = Math.min(damage, Math.max(0, prey.hp - 50));
    if (this.godmode || damage <= 0) return;
    prey.hp -= damage; prey.lastHit = this.elapsed;
    this.effects.push({ type: 'damage', x: prey.x, y: prey.y, text: '-' + Math.round(damage), life: 1, maxLife: 1 });
    this.woundRolls(prey, z);
  }
  compassOf(p) { return COMPASS[Math.round(((Math.atan2(p.y, p.x) / (Math.PI * 2)) * 8 + 8)) % 8]; }
  // A dry, open point `tiles` out from camp: toward `toward` if given, otherwise the first that works.
  outerPoint(tiles, toward = null) {
    const r = tiles * TILE, base = toward ? Math.atan2(toward.y, toward.x) : this.random() * Math.PI * 2;
    for (let i = 0; i < 24; i++) {
      const a = base + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 12, p = { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) };
      if (Math.abs(p.x) > this.bounds.x || Math.abs(p.y) > this.bounds.y || this.wetAt?.(p)) continue;
      if ((this.worldBuildings || []).some(w => p.x > w.x && p.x < w.x + w.fw * TILE && p.y > w.y && p.y < w.y + w.fh * TILE)) continue;
      return p;
    }
    return { x: Math.round(Math.cos(base) * r), y: Math.round(Math.sin(base) * r) };
  }
  // Once the tutorial is past, an infected or two drift in from beyond the perimeter every few hours.
  campaignThreatTick(dt) {
    const c = this.campaign;
    // The trickle stands aside while a migration is on its way through.
    // ... and while one of the first two (risk-free) runs is out.
    if (!c.threatsActive || this.spawnTimer >= 1e6 || ['warning', 'passage', 'clearing'].includes(c.migration?.state) || this.mission?.safe) return;
    const mult = (CAMPAIGN.difficulties[c.settings.difficulty] || CAMPAIGN.difficulties.standard).threatMult;
    c.threatTimer ??= THREAT_HOURS * HOUR_SECONDS / mult;
    c.threatTimer -= dt;
    if (c.threatTimer > 0) return;
    c.threatTimer = THREAT_HOURS * HOUR_SECONDS / mult * (.75 + this.random() * .5);
    const from = this.outerPoint(Math.max(WANDERER_TILES, (c.region?.localRadius || 400) / TILE + 10));
    for (let i = 0, n = 1 + Math.floor(this.day / 10); i < n && this.zombies.length < 220; i++) {
      const z = this.spawnZombie(0);
      Object.assign(z, { x: from.x + (this.random() - .5) * 48, y: from.y + (this.random() - .5) * 48 });
    }
  }

  // ---- Guards: routes, stances and response ----
  guardStance(s) { return STANCES.includes(s.stance) ? s.stance : 'intercept'; }
  // Intercept chases up to 10 tiles past the post's patrol radius; Hold never leaves its route.
  chaseRadius(post) { return ((CAMPAIGN.buildings.guard_post.patrolRadius || 20) + C.interceptChaseTiles) * TILE; }
  inChase(s, p) { const post = this.postOf(s); return !!post && distance(post, p) <= this.chaseRadius(post); }
  // A Guard Post's two routes: a loop round the post, and a watch out toward the approach (the migration
  // corridor, or the camp's open side) and back. Points snap to open ground and are cached until the map changes.
  guardRoute(post, index) {
    const key = `${post.id}:${index}:${this.navVersion}:${this.landRevision}`;
    this._routes ??= new Map();
    if (this._routes.has(key)) return this._routes.get(key);
    const radius = (CAMPAIGN.buildings.guard_post.patrolRadius || 20) * TILE;
    let raw;
    if (index === 1) {
      const lane = this.campaign.region?.corridor?.points?.reduce((a, p) => !a || distance(p, post) < distance(a, post) ? p : a, null);
      const dir = lane ? Math.atan2(lane.y - post.y, lane.x - post.x) : Math.atan2(post.y, post.x) || 0;
      raw = [.25, .5, .75, 1, .75, .5].map(f => ({ x: post.x + Math.cos(dir) * radius * f, y: post.y + Math.sin(dir) * radius * f }));
    } else raw = Array.from({ length: 8 }, (_, i) => ({ x: post.x + Math.cos(i / 8 * Math.PI * 2) * radius * .55, y: post.y + Math.sin(i / 8 * Math.PI * 2) * radius * .55 }));
    const route = raw.map(p => this.openSpot(p)).filter(Boolean);
    if (this._routes.size > 64) this._routes.clear();
    this._routes.set(key, route.length ? route : [this.openSpot(post) || { x: post.x, y: post.y + 24 }]);
    return this._routes.get(key);
  }
  // The nearest open, dry grid point within three tiles: walkable on the camp's grid, or clear of trunks,
  // structures and ruins out in the wilds.
  openSpot(p) {
    const open = q => this.outside(q)
      ? !this.wetAt?.(q) && !this.forest.trees.some(t => distance(t, q) < t.radius + 6) && !this.buildings.some(b => inside(q, boundsOf(b, 6)))
        && !(this.worldBuildings || []).some(w => q.x > w.x && q.x < w.x + w.fw * TILE && q.y > w.y && q.y < w.y + w.fh * TILE)
      : this.walkable(q) && !this.wetAt?.(q);
    const g = { x: Math.round(p.x / TILE) * TILE, y: Math.round(p.y / TILE) * TILE };
    for (let r = 0; r <= 3; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const q = { x: g.x + dx * TILE, y: g.y + dy * TILE };
      if (open(q)) return q;
    }
    return null;
  }
  // A posted Guard's shift: Intercept chases what it can see within reach of the post; both stances walk
  // their route and fight whatever comes within weapon range.
  guardDuty(s, post, stats, dt) {
    if (this.guardStance(s) === 'intercept') {
      s.huntTimer = (s.huntTimer || 0) - dt;
      if (s.huntTimer <= 0) {
        s.huntTimer = .4;
        const reach = this.chaseRadius(post);
        const prey = this.zombiesNear(post, reach).filter(z => z.hp > 0 && distance(post, z) < reach && (distance(s, z) < C.wanderer.sightTiles * TILE * 2 || this.alerts.some(a => a.threatIds.includes(z.id) && !a.local))).sort((a, b) => distance(s, a) - distance(s, b))[0];
        s.hunt = prey ? { x: Math.round(prey.x), y: Math.round(prey.y) } : null;
      }
      if (s.hunt) { this.travel(s, s.hunt, stats.speed * 1.15, dt); s.task = 'intercepting'; return; }
    }
    const route = this.guardRoute(post, s.guardRoute === 1 ? 1 : 0);
    s.patrolIndex = (s.patrolIndex || 0) % route.length;
    if (this.travel(s, route[s.patrolIndex], stats.speed, dt)) s.patrolIndex = (s.patrolIndex + 1) % route.length;
    s.task = 'patrol';
  }
  setGuardStance(id, stance) {
    const s = this.survivors.find(s => s.id === id);
    if (!s || s.role !== 'guard' || !STANCES.includes(stance)) return false;
    s.stance = stance; s.hunt = null; s.respond = null;
    return true;
  }
  setGuardRoute(id, route) {
    const s = this.survivors.find(s => s.id === id);
    if (!s || s.role !== 'guard' || ![0, 1].includes(route)) return false;
    s.guardRoute = route; s.patrolIndex = 0; s.path = [];
    return true;
  }

  // ---- Pistols and ammunition ----
  // A firearm takes a round a shot. Out of rounds, the guard puts it back for a melee weapon.
  useAmmo(s) {
    const w = WEAPONS[s.gear];
    if (!this.campaign || !w || w.melee) return true;
    if (this.available('ammo') >= 1) { this.resources.ammo -= 1; if (this.available('ammo') < C.guardPistolMinAmmo) this.campaignAlert('UI_AMMO_LOW'); return true; }
    this.campaignAlert('UI_AMMO_LOW');
    this.equipAll();
    return false;
  }
  // Pistols are handed out only with at least 5 rounds in stock and taken back at none.
  gearAllowed(type) { return !this.campaign || WEAPONS[type]?.melee !== false || this.available('ammo') >= C.guardPistolMinAmmo; }

  // ---- The Lookout ----
  // A guard on watch sees 45 tiles all round. New contacts raise an alert the patrol answers.
  // Inside the protected perimeter the camp notices an infected without any watch.
  campNotices() {
    const r = this.campaign.region?.protectedRadius || 288;
    for (const z of this.zombies) if (z.hp > 0 && Math.hypot(z.x, z.y) < r) this.sight(z, { heard: true });
  }
  // The Lookout and the Watchtower.
  watchLookouts() {
    for (const b of this.buildings) {
      if (!WATCH_POSTS.includes(campaignIdOf(b.type)) || !this.operational(b)) continue;
      if (!this.survivors.some(s => s.stationed && s.towerId === b.id && this.active(s))) continue;
      const range = (CAMPAIGN.buildings[campaignIdOf(b.type)].detectionRadius || 45) * TILE;
      for (const z of this.zombiesNear(b, range)) {
        if (z.hp <= 0 || distance(b, z) >= range) continue;
        const known = this.alerts.some(a => a.threatIds.includes(z.id));
        this.sight(z, { towerId: b.id });
        if (z.tutorial) this.tutorialDetected(z);
        else if (!known) this.notify('INFECTED DETECTED', `The Lookout reports a contact to the ${this.compassOf(z)}. Patrol response requested.`, 'warn');
      }
    }
  }

  // ---- P1-07: one marked Wanderer, seen by the Lookout and met by the patrol ----
  tutorialTick() {
    const c = this.campaign, task = c.tasks?.p1_07;
    if (task?.state !== 'active') return;
    let w = c.scripted.wanderer;
    const z = w?.id != null ? this.zombies.find(z => z.id === w.id && z.hp > 0) : null;
    if (w && !z && w.id != null) {
      if (w.detected) w.neutralized = true;
      else if (w.spawns < 2) w.id = null; // Killed before anyone saw it: one replacement.
      else { w.detected = true; w.neutralized = true; }
    }
    if (z && w.detected && Math.hypot(z.x, z.y) > DRIVEN_OFF_TILES * TILE) { this.zombies = this.zombies.filter(o => o !== z); w.neutralized = true; }
    if (w?.id != null || w?.neutralized) return;
    // It comes once a watch and a separate patrol are both in place, during the work shift.
    if (!this.metric('staffedLookout') || !this.metric('separatePatrolGuard') || !this.workShift) return;
    const lookout = this.buildings.find(b => campaignIdOf(b.type) === 'lookout_post' && this.operational(b));
    const lane = c.region?.corridor?.points?.reduce((a, p) => !a || Math.abs(Math.hypot(p.x, p.y) - WANDERER_TILES * TILE) < Math.abs(Math.hypot(a.x, a.y) - WANDERER_TILES * TILE) ? p : a, null);
    const p = this.outerPoint(WANDERER_TILES, lane || lookout);
    const nz = this.spawnZombie(0);
    Object.assign(nz, p, { tutorial: true, marked: true });
    c.scripted.wanderer = w = { id: nz.id, spawns: (w?.spawns || 0) + 1, detected: false, neutralized: false, direction: this.compassOf(p) };
  }
  tutorialDetected(z) {
    const w = this.campaign.scripted.wanderer;
    if (!w || w.detected || w.id !== z.id) return;
    w.detected = true; w.direction = this.compassOf(z);
    const t = CAMPAIGN.tasks.find(t => t.id === 'p1_07'), text = fill(t.copy.alertCopy, { direction: 'the ' + w.direction }), [head, ...rest] = text.split(' / ');
    this.message(CENTROCOM, head, rest.join(' / '), 'warn', { kind: 'alert' });
    this.notify(head, rest.join(' / '), 'warn');
  }
  // P1-07 done: the protected period is over.
  endProtection() {
    if (this.campaign.threatsActive) return;
    this.campaign.threatsActive = true;
    this.message(MARA, 'Private channel', CAMPAIGN.strings.threats_active_mara);
  }

  // ---- Every step, after the survivors move ----
  defenseTick() {
    if (!this.campaign) return;
    this.tutorialTick();
  }
  // What the P1-06 / P1-07 objectives read.
  guardsAt(id) { return this.survivors.filter(s => s.role === 'guard' && s.post != null && campaignIdOf(this.postOf(s)?.type) === id && this.operational(this.postOf(s))); }
  get hasArmedGuard() { return this.guardsAt('guard_post').some(s => SPEARS_AND_GUNS.includes(s.gear)); }
  get staffedLookout() { return this.survivors.some(s => s.role === 'sentry' && s.post != null && WATCH_POSTS.includes(campaignIdOf(this.postOf(s)?.type)) && this.operational(this.postOf(s))); }
  // Patrolling right now: a posted Guard who is up and walking their route or answering a threat.
  get patrolling() { return this.guardsAt('guard_post').some(s => this.active(s) && this.onDuty(s) && ['patrol', 'intercepting', 'responding', 'investigating', 'engaging'].includes(s.task)); }
}
