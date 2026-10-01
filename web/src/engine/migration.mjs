// Emergency shelter and migrations (P1-09). Shelter All calls every resident into the Makeshift Shelters in
// priority order (the downed and ill, then non-combatants, then guards), four through each door at a time and
// ten game minutes each, and names anyone left outside. Seal locks the doors: a sealed, quiet shelter is
// never noticed. A migration is announced three hours ahead and walks the corridor over two; once the route
// has been clear for an hour the shelters open again. Installed onto Game.prototype by model.mjs.
import { CAMPAIGN, CENTROCOM, MARA, campaignIdOf, fill, emptyMigration } from './campaignState.mjs';
import { HOUR_SECONDS, distance } from './data.mjs';

const M = CAMPAIGN.tuning.migration;
const ENTRY_SECONDS = M.shelterEntryMinutes / 60 * HOUR_SECONDS;
// How close (as a share of an infected's sight) an unsealed, occupied shelter is noticed: the Makeshift
// Shelter cuts detection by 75%, the Reinforced Shelter by 90%.
const SHELTERS = { makeshift_shelter: .25, reinforced_shelter: .1 };


export class Migration {
  // ---- Shelter ----
  get shelters() { return this.buildings.filter(b => SHELTERS[campaignIdOf(b.type)] && this.operational(b)); }
  get emergencyShelterCapacity() { return this.shelters.reduce((n, b) => n + this.shelterCapacity(b), 0); }
  get atHome() { return this.survivors.filter(s => !s.expedition && !s.arriving && !this.onMission(s)); }
  get sheltering() { return !!this.campaign?.shelter; }
  // Who goes first: the downed and ill, then everyone who doesn't fight, then the guards.
  shelterRank(s) { return s.condition === 'downed' || s.care || this.needsCare(s) ? 0 : ['guard', 'sentry'].includes(s.role) ? 2 : 1; }
  shelterAll() {
    if (this.status !== 'playing' || !this.campaign || !this.taskUnlocked('commands', 'shelter_all') && !this.freeBuild) return false;
    const shelters = this.shelters;
    if (!shelters.length) { this.notify('No emergency shelter', 'Build a Makeshift Shelter first.', 'warn'); return false; }
    const free = new Map(shelters.map(b => [b.id, this.shelterCapacity(b)])), outside = [];
    for (const s of this.atHome.sort((a, b) => this.shelterRank(a) - this.shelterRank(b) || a.id - b.id)) {
      const b = shelters.filter(b => free.get(b.id) > 0).sort((p, q) => distance(s, p) - distance(s, q))[0];
      if (!b) { outside.push(s.name); continue; }
      free.set(b.id, free.get(b.id) - 1);
      if (s.resting) this.wake(s);
      Object.assign(s, { shelter: b.id, sheltered: false, entering: 0, goalKey: '', camp: null, care: null, careAt: null, respond: null, order: null, hunt: null });
      this.dismount(s);
    }
    this.campaign.shelter = { sealed: false, outside };
    this.recordInteraction('shelter_all');
    const pop = this.atHome.length, cap = this.emergencyShelterCapacity;
    if (outside.length) this.campaignAlert('UI_SHELTER_SHORT', { capacity: cap, population: pop, outsideCount: outside.length }, 'warn', { force: true });
    const away = this.survivors.filter(s => s.expedition || this.onMission(s)).length;
    if (away) this.campaignAlert('UI_SHELTER_OFFSITE', { offsiteCount: away });
    this.notify('Shelter All', `${pop - outside.length} of ${pop} residents heading into shelter. Work is suspended.` + (outside.length ? ' Outside: ' + outside.join(', ') + '.' : ''), outside.length ? 'warn' : 'good');
    return true;
  }
  // Sealing stops arrivals: anyone not yet inside stays out.
  sealShelter() {
    const sh = this.campaign?.shelter;
    if (!sh || sh.sealed) return false;
    sh.sealed = true;
    for (const s of this.survivors) if (s.shelter != null && !s.sheltered && this.shelters.some(b => b.id === s.shelter)) { s.shelter = null; s.entering = 0; sh.outside.push(s.name); }
    this.campaignAlert('UI_SHELTER_SEALED', {}, 'good', { force: true });
    return true;
  }
  // Opening the shelters. Before the route is clear it takes `force` (the HUD asks first).
  releaseShelter(force = false) {
    const c = this.campaign;
    if (!c?.shelter) return false;
    if (!force && ['warning', 'passage', 'clearing'].includes(c.migration.state)) return false;
    for (const s of this.survivors) if (s.shelter != null && this.shelters.some(b => b.id === s.shelter) || s.entering) Object.assign(s, { shelter: null, sheltered: false, entering: 0, goalKey: '' });
    c.shelter = null;
    this.notify('Shelters open', 'Residents are returning to work.', 'good');
    return true;
  }
  // Walking to the door, waiting for one of its four places, then ten minutes to get in.
  campaignShelterStep(s, stats, dt) {
    const b = this.shelters.find(b => b.id === s.shelter);
    if (!b) { s.shelter = null; s.entering = 0; return false; }
    if (!this.atSite(s, b)) {
      const spot = this.goalFor(s, b);
      if (!spot) { s.task = 'no-route'; return true; }
      this.travel(s, spot, stats.speed * 1.1, dt); s.task = 'to-shelter';
      return true;
    }
    if (!(s.entering > 0) && this.survivors.filter(o => o !== s && o.shelter === b.id && o.entering > 0).length >= M.shelterSimultaneous) { s.task = 'queueing'; return true; }
    s.entering = (s.entering || 0) + dt;
    s.task = 'entering-shelter';
    if (s.entering >= ENTRY_SECONDS) { s.entering = 0; s.sheltered = true; s.task = 'sheltered'; s.fighting = false; s.path = []; }
    return true;
  }
  // The infected notice an occupied shelter only when unsealed, and then only at a quarter of their sight.
  shelterNoticed(b, z) {
    const share = SHELTERS[campaignIdOf(b.type)];
    if (!share || this.campaign?.shelter?.sealed) return false;
    return this.survivors.some(s => s.shelter === b.id && s.sheltered) && distance(z, b) < (z.sight || 192) * share;
  }
  // A sealed shelter is no obstacle and no target: the dead walk past it.
  sealedShelter(b) { return !!this.campaign?.shelter?.sealed && !!SHELTERS[campaignIdOf(b.type)]; }

  // ---- Migrations ----
  // Scheduled once P1-09 is active, shelter covers everyone, nobody is down and nothing is fighting.
  migrationTick(dt) {
    const c = this.campaign, mg = c.migration;
    if (mg.state === 'none' || mg.state === 'cleared') {
      if (c.tasks?.p1_09?.state !== 'active' || mg.triggered) return;
      if (mg.cooldownUntil != null && this.elapsed < mg.cooldownUntil) return;
      const pop = this.atHome.length;
      if (this.emergencyShelterCapacity < pop || this.survivors.some(s => s.condition === 'downed') || this.zombies.some(z => z.hp > 0 && Math.hypot(z.x, z.y) < (c.region?.localRadius || 400))) return;
      this.scheduleMigration('first');
      return;
    }
    const corridor = this.migrationRoute();
    if (mg.state === 'warning' && this.elapsed >= mg.arriveAt) {
      Object.assign(mg, { state: 'passage', nextSpawnAt: this.elapsed, killsAtStart: this.kills });
      const t = this.migrationTask(mg.kind), [head, ...rest] = (t?.copy.passageText || '').split(' / ');
      if (head) { this.message(CENTROCOM, head, rest.join(' / '), 'warn'); this.notify(head, rest.join(' / '), 'warn'); }
    }
    if (mg.state === 'passage') {
      while (mg.spawned < mg.total && this.elapsed >= mg.nextSpawnAt && corridor.length) {
        const route = mg.from ? [...corridor].reverse() : corridor, z = this.spawnZombie(0);
        Object.assign(z, { x: route[0].x + (this.random() - .5) * 40, y: route[0].y + (this.random() - .5) * 40, migrant: true, route, routeIndex: 1 });
        mg.spawned++; mg.nextSpawnAt += mg.spawnEvery;
      }
      if (mg.spawned >= mg.total || !corridor.length) mg.state = 'clearing';
    }
    const migrants = this.zombies.filter(z => z.migrant && z.hp > 0);
    if (['passage', 'clearing'].includes(mg.state)) {
      // Everyone sheltered behind sealed doors, held continuously.
      const sealed = !!c.shelter?.sealed && this.atHome.every(s => s.sheltered && s.shelter != null);
      mg.hold = sealed ? mg.hold + dt / HOUR_SECONDS : 0;
      mg.bestHold = Math.max(mg.bestHold, mg.hold);
      if (migrants.length || mg.state === 'passage') mg.lastContactAt = this.elapsed;
    }
    if (mg.state === 'clearing' && !migrants.length && this.elapsed - mg.lastContactAt >= M.clearHours * HOUR_SECONDS) this.migrationCleared();
  }
  // The stretch of the corridor a migration walks: from where it comes within sight of the Lookout's range of
  // camp to where it leaves it again, thinned to a waypoint every few tiles.
  migrationRoute() {
    const pts = this.campaign.region?.corridor?.points || [], reach = Math.max(720, (this.campaign.region?.localRadius || 400) + 240);
    const i = pts.findIndex(p => Math.hypot(p.x, p.y) <= reach), j = pts.findLastIndex(p => Math.hypot(p.x, p.y) <= reach);
    if (i < 0) return pts.filter((_, k) => k % 3 === 0);
    return pts.slice(Math.max(0, i - 1), Math.min(pts.length, j + 2)).filter((_, k, a) => k % 3 === 0 || k === a.length - 1);
  }
  migrationTask(kind) { return CAMPAIGN.tasks.find(t => t.id === (kind === 'first' ? 'p1_09' : 'p2_12')); }
  scheduleMigration(kind) {
    const c = this.campaign, def = kind === 'first' ? M.first : M.readiness, t = this.migrationTask(kind);
    Object.assign(c.migration, emptyMigration(), {
      // A working Radio Relay hears it coming six hours sooner.
      state: 'warning', kind, triggered: true, total: def.count, arriveAt: this.elapsed + (def.warningHours + (this.radioRelay ? M.relayWarningBonusHours : 0)) * HOUR_SECONDS, spawnEvery: def.passageHours * HOUR_SECONDS / def.count,
      from: this.random() < .5 ? 0 : 1, cooldownUntil: c.migration.cooldownUntil,
    });
    const [head, ...rest] = (t?.copy.warningText || 'MIGRATION WARNING').split(' / ');
    this.message(CENTROCOM, head, rest.join(' / '), 'warn', { kind: 'alert' });
    this.notify(head, rest.join(' / '), 'warn');
    if (t?.copy.maraBefore) this.message(MARA, 'Private channel', fill(t.copy.maraBefore, this.taskVars));
  }
  migrationCleared() {
    const c = this.campaign, mg = c.migration, t = this.migrationTask(mg.kind);
    Object.assign(mg, { state: 'cleared', cleared: mg.cleared + 1, cooldownUntil: this.elapsed + M.cooldownHours * HOUR_SECONDS });
    const [head, ...rest] = (t?.copy.clearText || 'MIGRATION ROUTE CLEAR').split(' / ');
    this.message(CENTROCOM, head, rest.join(' / '), 'good');
    this.notify(head, rest.join(' / '), 'good');
    if (c.shelter) this.releaseShelter(true);
  }
  // A migrant walks its corridor and leaves the map at the far end; it turns aside only for prey it sees.
  // Back from a chase it rejoins the corridor at the nearest waypoint (the way it came is dry; a straight line to
  // the next one may not be), and one that makes no headway for 15 seconds wanders off out of sight.
  migrantHeading(z, dt) {
    const route = z.route || [];
    if (z.chased) {
      z.chased = false;
      z.routeIndex = route.reduce((best, p, i) => distance(z, p) < distance(z, route[best]) ? i : best, Math.min(z.routeIndex, route.length - 1));
    }
    while (z.routeIndex < route.length && distance(z, route[z.routeIndex]) < 24) { z.routeIndex++; z.stuck = 0; z.bestD = null; }
    if (z.routeIndex >= route.length) { z.hp = 0; z.left = true; return null; }
    const d = distance(z, route[z.routeIndex]);
    if (z.bestD == null || d < z.bestD - 1) { z.bestD = d; z.stuck = 0; } else if ((z.stuck = (z.stuck || 0) + dt) > 15) { z.hp = 0; z.left = true; return null; }
    return route[z.routeIndex];
  }
}
