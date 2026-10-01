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
import { scatterTrees, mapForest, steerAroundTrees } from './trees.mjs';
import { generate, generateSteps, parseSurvMap, applyWorldToGame } from './worldgen.mjs';
import { OUTPOST_MAP } from './outpostMap.mjs';
import { Harvest } from './harvest.mjs';
import { Water } from './water.mjs';
import { CAMP, CAMPAIGN_CAMP } from './camp.mjs';
import { Progression, STARTING_CACHE } from './progression.mjs';
import { createCampaign, campaignStartingSupplies, CAMPAIGN, copy, fill, CENTROCOM, MARA } from './campaignState.mjs';
import { Ledger, emptyLedger, LEGACY_RESOURCES } from './ledger.mjs';
import { Crew } from './crew.mjs';
import { Deployment } from './deployment.mjs';
import { Tasks } from './tasks.mjs';
import { CampWork } from './campWork.mjs';
import { Medical } from './medical.mjs';
import { Defense } from './defense.mjs';
import { Radio } from './radio.mjs';
import { Migration } from './migration.mjs';
import { Certification } from './certification.mjs';
import { Operations } from './operations.mjs';
import { Story } from './story.mjs';
import { seedStream } from './seed.mjs';
export { HOUR_SECONDS, DAY_SECONDS, RUN_DAYS, SAVE_VERSION, SIDES, PHASES, phaseAt, circadian, DIRECTOR_STATES, RESOURCE_NAMES, EXPEDITIONS, BUILDINGS, BUILDING_TREES, ROLES, JOBS, jobOf, ROLE_FOR, postSlots, clamp, distance, has } from './data.mjs';
export { buildingMaxHP, survivorStats, boundsOf } from './rules.mjs';

export class Game {
  // `start` is 'camp' (the starter camp) or 'refuge' (the walled refuge a camp grows into, with its
  // HQ, starting buildings and full perimeter; scenario tests use it). `mode` is 'campaign' for the
  // AfterLife campaign (a camp start run by its rules, campaignState.mjs) or 'legacy'.
  constructor(random = Math.random, { start = 'camp', mode = 'legacy', campaign = {} } = {}) {
    this.random = random;
    this.start = start;
    this.mode = mode;
    this.campaignSettings = campaign;
    this.bounds = { x: 640, y: 400 };
    this.events = [];
    this.effects = [];
    this.reset();
  }
  reset() {
    this._worldGeneration = null;
    this.difficulty = 'normal';
    this.elapsed = 0;
    this.status = 'playing';
    this.freeBuild = false;
    this.godmode = false;
    this.campaign = this.mode === 'campaign' && this.start === 'camp' ? createCampaign(this.campaignSettings) : null;
    this.resources = this.campaign ? campaignStartingSupplies(this.campaign.settings.difficulty) : this.start === 'refuge' ? { wood: 145, scrap_metal: 75, food: 90 } : { ...STARTING_CACHE };
    this.reserved = emptyLedger(this.campaign ? undefined : LEGACY_RESOURCES);
    this.reservations = {};
    this.nextTxId = 1;
    this.autosaveReason = null;    this.buildings = [];
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
    // A campaign's crew comes from its seed; anything else from the random source.
    this.worldSeed = this.mode === 'campaign' && this.campaignSettings?.seed ? seedStream(this.campaignSettings.seed, 'crew') : Math.floor(this.random() * 4294967296);
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
    this.land = initialLand(this.start);
    this.landRevision = (this.landRevision || 0) + 1;
    this.navigation = null;
    this.routes = patrolRoutes(this.land);
    this.starvationWarning = false;
    this.trader = null;
    this.traderTimer = 60 + this.random() * 60;
    this.seasonOverride = null;
    this._lastSeason = 'spring';
    this.worldPois = [];
    this.worldDecor = [];
    this.worldBuildings = [];
    this.mapTrees = [];
    this.water = null; // A generated world's lakes and rivers (water.mjs).
    this.map = null;
    this.worldMeta = null;
    this.worldOrigin = null;
    this.debris = []; // A campaign's finite salvage nodes (deployment.mjs).
    this.harvestJobs = []; // Trees marked for felling: { tree, by } with the survivor on it, if any.
    this.treeRegrow = {}; // Tree id → game time it has grown back.
    this.cleared = []; // Trees felled on a camp's own land: they never grow back.
    if (this.start === 'refuge') this.startRefuge(); else this.startCamp();
  }
  startRefuge() {
    this.initProgress(true);
    this.addBuilding('core', 0, 0);
    this.addBuilding('workshop', -112, -64);
    this.addBuilding('dorm', 112, -64);
    this.addBuilding('farm', -112, 64);
    this.extendPerimeter([], false, true);
    for (const side of SIDES.slice(1)) this.addSurvivor(side);
    for (const type of ['rifle', 'pistol', 'pistol', 'pistol', 'pipe']) this.addItem(type);
    this.equipAll();
    this.notify('A new beginning', 'Four survivors. One refuge. Make it to Day 24.', 'good');
  }
  // The overseer is dropped in: three survivors around a campfire with tents and a supply cache,
  // no walls, and quests on the tablet to unlock everything else.
  startCamp() {
    this.initProgress();
    const layout = this.campaign ? CAMPAIGN_CAMP : CAMP;
    this.addBuilding('campfire', layout.fire.x, layout.fire.y);
    for (const t of layout.tents) this.addBuilding('tent', t.x, t.y);
    this.addBuilding('cache', layout.cache.x, layout.cache.y);
    // The camp has no fence: every slot of the perimeter starts open.
    this.extendPerimeter([], false, false);
    // A campaign's founders are the starting crew's archetypes in order (A-E).
    const archetypes = CAMPAIGN.tuning.survivors.archetypes;
    layout.spawns.forEach((p, i) => Object.assign(this.addSurvivor('any', this.campaign ? this.createCandidate('founder', { archetype: archetypes[i % archetypes.length].id }, false) : null), { x: p.x, y: p.y }));
    if (this.campaign) {
      // The deployment package: everyone gets a club; the spares (two clubs, two pistols) go in the cache.
      for (const e of CAMPAIGN.tuning.deployment.startingEquipment) for (let i = 0; i < e.count; i++) this.addItem(e.item);
      this.equipAll();
      return;
    }
    for (const type of ['rifle', 'pistol', 'pipe']) this.addItem(type);
    this.equipAll();
    this.notify('A new beginning', 'You are the overseer: three volunteers, a campfire and a cache of supplies. Press Tab for your tablet and your first orders.', 'good');
    this.welcomeOverseer();
  }
  // A legacy run's clock starts at 06:00 and its day turns at dawn; a campaign starts at 07:00 and its day turns at midnight.
  get clockOrigin() { return this.campaign ? CAMPAIGN.tuning.time.startHour : 6; }
  get day() {
    if (this.campaign) return Math.floor((this.elapsed + this.clockOrigin * HOUR_SECONDS) / DAY_SECONDS) + 1;
    return Math.min(RUN_DAYS, Math.floor(this.elapsed / DAY_SECONDS) + 1);
  }
  // Campaign work runs 07:00-19:00; the rest of the day is for sleeping.
  get workShift() { const h = this.hour, t = CAMPAIGN.tuning.time; return h >= t.workStartHour && h < t.workEndHour; }
  // When a game time (elapsed seconds) falls, as "DAY 3 · 14:20".
  stampAt(at) {
    const hours = at / HOUR_SECONDS + this.clockOrigin, day = this.campaign ? Math.floor(hours / 24) + 1 : Math.floor(at / DAY_SECONDS) + 1, hour = hours % 24;
    return `DAY ${day} · ${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor(hour % 1 * 60)).padStart(2, '0')}`;
  }
  // Ask the host to save now (deployment, task completions, missions...); it saves on its next frame.
  requestAutosave(reason) { this.autosaveReason = this.autosaveReason || reason; }
  // CentroCom's report at the start of each work day, covering the 24 hours since the last one.
  dailySummary() {
    const log = this.campaign.dayLog, injured = this.survivors.filter(s => s.condition !== 'healthy').length;
    this.message(CENTROCOM, 'Day ' + this.day + ' operations summary', copy('generic_daily_report', {
      day: this.day, population: this.survivors.length, producedFood: Math.floor(log.producedFood), consumedFood: Math.ceil(log.consumedFood),
      availableFood: Math.floor(this.available('food')), injuryCount: injured, alertCount: this.alerts.length,
    }));
    this.campaign.dayLog = { producedFood: 0, consumedFood: 0 };
  }
  get season() {
    if (this.seasonOverride) return this.seasonOverride;
    return ['spring', 'summer', 'fall', 'winter'][Math.floor(Math.max(0, this.day - 1) / 6) % 4];
  }
  generateWorld(size = 'medium', seed = 1, options = {}) {
    const opts = typeof size === 'object' ? size : { size, seed, ...(typeof seed === 'object' ? seed : options) };
    const res = generate(opts);
    return applyWorldToGame(this, res.map, res.meta);
  }
  beginWorldGeneration(size = 'medium', seed = 1, options = {}) {
    const opts = typeof size === 'object' ? size : { size, seed, ...(typeof seed === 'object' ? seed : options) };
    this._worldGeneration = generateSteps(opts);
  }
  advanceWorldGeneration() {
    if (!this._worldGeneration) throw new Error('No world generation in progress');
    const step = this._worldGeneration.next();
    if (!step.done) return step.value;
    this._worldGeneration = null;
    // A campaign deployment lands itself (deployment.mjs).
    if (step.value.deployed) return step.value;
    applyWorldToGame(this, step.value.map, step.value.meta);
    return { progress: 1, activity: 'The refuge is ready.', done: true };
  }
  loadSurvMap(jsonOrObj) {
    const res = parseSurvMap(jsonOrObj);
    return applyWorldToGame(this, res.map, res.meta);
  }
  loadOutpostMap() {
    return this.loadSurvMap(OUTPOST_MAP);
  }
  get hour() { return (this.clockOrigin + this.elapsed / HOUR_SECONDS) % 24; }
  get night() { return this.hour >= 18 || this.hour < 6; }
  get hordeNight() { return this.night && this.day % 5 === 0; }
  get phase() { return phaseAt(this.hour); }
  get pressure() { return circadian(this.hour); }
  setDifficulty(value) {
    if (!['easy', 'normal', 'hard'].includes(value)) return false;
    this.difficulty = value;
    return true;
  }
  setTime(targetHour) {
    const current = this.hour;
    let diff = (targetHour - current + 24) % 24;
    this.elapsed += diff * (DAY_SECONDS / 24);
    this.notify('Time updated', `Clock set to ${String(Math.floor(targetHour)).padStart(2, '0')}:00.`, 'good');
    return true;
  }
  advanceDay() {
    this.elapsed += DAY_SECONDS;
    this.notify('Day advanced', `Fast-forwarded to Day ${this.day}.`, 'good');
    return true;
  }
  // The refuge's heart: the HQ, or the campfire of a starter camp. Lose it and the run is over.
  get core() { return this.buildings.find(b => b.type === 'core' || b.type === 'campfire'); }
  // Whether any of the perimeter fence has been built. A starter camp is open on every side.
  get walled() { return this.buildings.some(b => b.perimeter); }
  get clinic() { return this.buildings.find(b => b.type === 'clinic'); }
  get territory() { return landBounds(this.land); }
  get patrols() { return this.survivors.filter(s => !s.expedition); }
  // The wild trees depend on the claimed land and the visible world, so rebuild when either changes.
  // A camp keeps the trees on its land, so it also changes as they are cleared.
  get forest() {
    const camp = this.start === 'camp';
    const key = this.landRevision + ':' + this.bounds.x + ':' + this.bounds.y + ':' + (this.mapTrees?.length || 0) + (camp ? ':' + this.cleared.length : '');
    if (this._forest?.key !== key) {
      const options = camp ? { keepOnLand: true, cleared: new Set(this.cleared) } : {};
      // A generated world brings its own trees; otherwise the wilds are scattered around the territory.
      this._forest = { key, ...(this.mapTrees?.length ? mapForest(this.mapTrees, this.land, options) : scatterTrees(this.land, this.bounds, options)) };
    }
    return this._forest;
  }
  // Clears a camp's trees for good where something now stands: felled by the builders, not grown back.
  // The props there go too (visibleDecor); either way the view has to redraw the land.
  clearTreesUnder(buildings) {
    if (this.start !== 'camp' || !buildings.length) return;
    const rects = buildings.map(b => boundsOf(b, 2)), ids = this.forest.trees.filter(t => rects.some(r => inside(t, r))).map(t => t.id);
    if (ids.length) this.cleared.push(...ids);
    const props = buildings.map(b => boundsOf(b, 4));
    if (ids.length || (this.worldDecor || []).some(d => props.some(r => inside({ x: d.px, y: d.py }, r)))) this.landRevision++;
  }
  warnings() {
    const warnings = [];
    const empty = (!this.night || this.alarm.raised) ? SIDES.slice(1).filter(side => !this.coverage(side)) : [];
    if (empty.length) warnings.push('No patrol: ' + empty.join(', '));
    const foodRate = this.rates().food;
    if (this.resources.food <= 1) warnings.push('Starvation! Build a farm or scavenge food.');
    else if (foodRate < 0 && this.resources.food / -foodRate < 180) warnings.push('Food runs out in ' + Math.ceil(this.resources.food / -foodRate) + 's at 1×');
    if (this.core && this.core.hp < buildingMaxHP(this.core) * .5) warnings.push((this.core.type === 'campfire' ? 'Campfire' : 'HQ') + ' integrity critical — repair now');
    if (!this.night && this.day % 5 === 0) warnings.push('Horde tonight — reinforce your defenses before dusk.');
    for (const d of this.survivors.filter(s => s.condition === 'downed')) warnings.push(d.name + ' is down — ' + (d.bleed / HOUR_SECONDS).toFixed(1) + 'h to bleed out' + (d.rescuer != null ? ' · help is coming' : ''));
    const injured = this.survivors.filter(s => s.condition === 'injured' && !s.expedition).length;
    if (injured && !this.clinicsWithMedics().length) warnings.push(injured + ' injured — post a medic at a clinic');
    if (this.unhoused.length) warnings.push(this.unhoused.length + ' without a bed — build a bunkhouse');
    return warnings;
  }
  notify(title, message, tone = '') { this.events.push({ title, message, tone }); }
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
    const wasHour = this.hour;
    this.elapsed += dt;
    if (!this.campaign && this.elapsed >= DAY_SECONDS * RUN_DAYS) {
      this.elapsed = DAY_SECONDS * RUN_DAYS;
      this.status = 'won';
      this.notify('You made it through', 'Twenty-four days. Your refuge is still standing.', 'good');
      return;
    }
    const wasHorde = wasNight && wasDay % 5 === 0;
    const phase = this.phase.id;
    if (wasPhase !== phase) this.phaseChanged(phase);
    if (this.campaign && wasHour < CAMPAIGN.tuning.time.dailySummaryHour && this.hour >= CAMPAIGN.tuning.time.dailySummaryHour) this.dailySummary();
    if (wasDay !== this.day) {
      if (!this.campaign) this.notify('Day ' + this.day + ' — still here', 'A new dawn. Repair the walls and prepare for tonight.', 'good');
      if (wasHorde) {
        this.depositAll({ wood: 45, scrap_metal: 20, food: 15 });
        this.notify('The horde is broken', 'Salvaged from the fallen: +45 wood · +20 scrap · +15 food.', 'good');
      }
      const curSeason = this.season;
      if (this._lastSeason && this._lastSeason !== curSeason) {
        this.landRevision = (this.landRevision || 0) + 1;
        this.notify('Season shift', 'The refuge enters ' + curSeason + '. Foliage and terrain adapt to the climate.', 'good');
      }
      this._lastSeason = curSeason;
    }
    // Consumption always draws down; production stops delivering while the stores overflow.
    const rates = this.rates(), log = this.campaign?.dayLog;
    for (const [r, rate] of Object.entries(rates)) {
      if (rate < 0) { const used = Math.min(this.resources[r], -rate * dt); this.resources[r] -= used; if (log && r === 'food') log.consumedFood += used; }
      else { const got = this.deposit(r, rate * dt); if (log && r === 'food') log.producedFood += got; }
    }
    if (this.resources.food < 1 && !this.starvationWarning) { this.starvationWarning = true; this.notify('Food has run out', 'Survivors are losing health. Build or upgrade a farm.', 'warn'); }
    if (this.resources.food > 5) this.starvationWarning = false;
    if (this.trader) {
      this.trader.remaining -= dt;
      if (this.trader.remaining <= 0) { this.trader = null; this.traderTimer = 150 + this.random() * 120; this.notify('The trader moved on', 'Their offer is gone for now.', ''); }
    } else if (!this.campaign) {
      this.traderTimer -= dt;
      if (this.traderTimer <= 0) {
        const offer = TRADES[Math.floor(this.random() * TRADES.length)], f = 1 + (this.bestCharisma - 4) * T.effects.charismaTrade;
        this.trader = { give: offer.give, get: Object.fromEntries(Object.entries(offer.get).map(([r, n]) => [r, Math.round(n * f)])), remaining: 45 };
        this.notify('A trader arrived', 'Offering ' + describeTrade(this.trader) + ' · 45 seconds to decide.', 'good');
      }
    }
    // A disabled spawner (spawnTimer parked far in the future) also silences the director. A campaign's
    // camp is protected until the tutorial's first infected (P1-07) switches threats on.
    if (this.campaign) this.campaignThreatTick(dt);
    else if (this.spawnTimer < 1e6) {
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
    // Campaign recruitment (applicants, the recruitment office) arrives with Phase 1's later tasks.
    if (!this.campaign) this.recruitment(dt);
    this.resolveExpeditions(dt);
    this.perceiveTimer -= dt;
    if (this.perceiveTimer <= 0) { this.perceiveTimer = .5; this.perceive(); }
    this.scheduleRescues();
    this.assignHarvest(dt);
    // A campaign runs its task chain and camp work; a legacy run its quests and statuses.
    if (this.campaign) { this.assignCampWork(dt); this.cropTick(dt); this.tasksTick(dt); this.medicalTick(dt); this.radioTick(); this.migrationTick(dt); this.operationsTick(dt); } else this.progressTick(dt);
    this.crewTick(dt);
    // Priority: emergency (downed) → combat → orders → shelter → rescue → medical need → alerts → job → idle.
    for (const s of [...this.survivors]) {
      const legacy = s.model !== 'campaign';
      if (s.expedition) { if (starving && legacy) s.hp -= dt * .65; continue; }
      if (s.condition === 'downed') {
        // A campaign survivor is down for two hours whatever is done for them, until they reach a bed.
        if (!s.stabilizing || !legacy) s.bleed -= dt;
        if (s.bleed <= 0) this.kill(s, legacy ? 'They bled out before anyone could reach them.' : 'They were not carried to a medical bed in time.');
        continue;
      }
      if (s.arriving && legacy && !this.outside(s)) s.arriving = false;
      const post = this.postOf(s), tower = s.stationed && s.towerId != null ? this.buildings.find(b => b.id === s.towerId) : null;
      const stats = survivorStats(s, post, tower), max = stats.hp;
      s.cooldown = Math.max(0, s.cooldown - dt);
      if (!s.sheltered) this.grantXP(s, dt * T.xp.dutyPerSecond);
      // Campaign hunger and healing run in crewTick.
      if (!legacy) { /* crew.mjs */ }
      else if (starving) s.hp -= dt * .65;
      // Resting only mends light wounds; the injured need a clinic.
      else if (this.elapsed - s.lastHit > 8 && s.hp >= max * T.health.injuryThreshold) s.hp = Math.min(max, s.hp + heal * dt);
      this.updateCondition(s, max);
      s.pathRetry = Math.max(0, (s.pathRetry || 0) - dt);
      // A resting survivor gets up for their duty or the alarm, or to see a medic.
      if (s.resting && (this.onDuty(s) || (legacy ? s.condition === 'injured' && this.clinicsWithMedics().length : (s.bleeding || s.infection > 0) && this.freeBedFor(s)))) this.wake(s);
      if (s.sheltered) { s.task = s.resting ? 'resting' : 'sheltered'; s.fighting = false; continue; }
      // A campaign recruit walks in from the road, untouched, before doing anything else.
      if (s.arriving && !legacy && this.walkInTick(s, stats, dt)) continue;
      const origin = s.perch || s, ordered = s.order && this.zombies.find(z => z.id === s.order.zombieId && z.hp > 0);
      // Only the dead on this side of the wall are visible, unless the survivor is up on a tower.
      let target = ordered && distance(origin, ordered) < stats.range && this.canSee(s, ordered) ? ordered : null, nearest = stats.range;
      if (!target) for (const z of this.zombiesNear(origin, stats.range)) { const d = distance(origin, z); if (z.hp > 0 && d < nearest && this.canSee(s, z)) { target = z; nearest = d; } }
      s.fighting = !!target;
      if (target) {
        s.task = 'engaging';
        s.facing = target.x < origin.x ? -1 : 1;
        if (s.cooldown <= 0 && this.useAmmo(s)) { this.fire(s, target, stats.damage); s.cooldown = stats.cooldown; }
        // Workers shout a short-range report so nearby guards come to help.
        if (jobOf(s) !== 'guard') this.sight(target, { survivorId: s.id });
        continue;
      }
      if (s.order && this.pursue(s, stats, dt)) continue;
      // A team out on an operation walks, works and comes home; it still fights what reaches it.
      if (!legacy && this.mission && this.missionStep(s, stats, dt)) continue;
      // Workers use towers / shelters when in danger
      if (!legacy) { /* campaign shelter is ordered, never automatic */ }
      else if (jobOf(s) !== 'guard' && s.shelter == null && !this.shelterOrder) {
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
      if (s.shelter != null && (legacy ? this.goShelter(s, stats, dt) : this.campaignShelterStep(s, stats, dt))) continue;
      if (s.rescue != null && (legacy ? this.doRescue(s, stats, dt) : this.campaignRescue(s, stats, dt))) continue;
      if (legacy ? this.seekCare(s, stats, dt) : this.campaignCare(s, stats, dt)) continue;
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
    const activeGround = this.survivors.filter(s => !s.sheltered && !s.stationed && !s.expedition && s.condition !== 'downed');
    if (activeGround.length > 1) {
      const SEP = 6;
      for (let i = 0; i < activeGround.length; i++) {
        const p = activeGround[i];
        let fx = 0, fy = 0;
        for (let j = 0; j < activeGround.length; j++) {
          if (i === j) continue;
          const q = activeGround[j];
          const dx = p.x - q.x, dy = (p.y - q.y) * 1.4, d = Math.hypot(dx, dy);
          if (d >= SEP || d === 0) continue;
          const k = (SEP - d) / SEP;
          fx += (dx / d) * k;
          fy += (dy / d) * k;
        }
        if (fx || fy) {
          const push = 8 * dt;
          const nx = p.x + fx * push, ny = p.y + fy * push;
          if (!this.wetAt({ x: nx, y: ny }) && !this.buildings.some(b => inside({ x: nx, y: ny }, boundsOf(b, 2)))) {
            p.x = nx;
            p.y = ny;
          }
        }
      }
    }
    for (const b of this.buildings) {
      if (b.type === 'core' && has(b, 'bunker')) b.hp = Math.min(buildingMaxHP(b), b.hp + dt * .7);
      if (b.type === 'gate') {
        const near = this.survivors.some(s => !s.sheltered && s.condition !== 'downed' && !s.expedition && Math.hypot(s.x - b.x, s.y - b.y) < 36);
        if (near) { b.gateOpen = true; b.gateHold = 0.6; }
        else if ((b.gateHold = (b.gateHold || 0) - dt) <= 0) { b.gateOpen = false; }
      }
      if (['core', 'dorm', 'workshop', 'clinic', 'barracks', 'shelter', 'storage', 'lab', 'armory'].includes(b.type)) {
        const near = this.survivors.some(s => !s.sheltered && !s.expedition && s.condition !== 'downed' && Math.hypot(s.x - b.x, s.y - b.y) < 26);
        const hasSheltered = this.survivors.some(s => s.shelter === b.id && s.sheltered);
        const hasResting = this.survivors.some(s => s.restAt === b.id && s.resting);
        const targetDoor = (near || hasSheltered || hasResting) ? 3 : 0;
        b.doorFrame = (b.doorFrame || 0) + Math.sign(targetDoor - (b.doorFrame || 0)) * Math.min(Math.abs(targetDoor - (b.doorFrame || 0)), 6 * dt);
      }
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
      if (z.burning) {
        z.hp -= 12 * dt;
        if (z.hp <= 0) { this.hit(z, 0); continue; }
      }
      // Campaign infected see 12 tiles; recruits walking in and survivors being carried are left alone.
      const sight = z.sight || 38;
      const prey = this.patrolsNear(z, sight).filter(s => s.hp > 0 && !s.sheltered && !(s.arriving && this.campaign) && s.carriedBy == null && distance(z, s) < sight).sort((a, b) => distance(a, z) - distance(b, z))[0];
      // A migrant keeps to its corridor; an unsealed shelter with people in it can draw an infected close by.
      const lure = !prey && this.campaign && this.shelters.find(b => this.shelterNoticed(b, z));
      if (z.migrant && (prey || lure)) { z.chased = true; z.bestD = null; }
      const target = prey || lure || (z.migrant ? this.migrantHeading(z, dt) : this.core);
      if (z.hp <= 0) continue;
      if (!target) break;
      const d = distance(z, target);
      const wobble = prey ? 0 : Math.sin(this.elapsed * .6 + z.seed) * .4;
      const angle = Math.atan2(target.y - z.y, target.x - z.x) + wobble;
      let heading = { x: Math.cos(angle), y: Math.sin(angle) };
      // With water in the way the dead follow the flow field to the camp, which crosses at the bridges.
      if (this.water && !prey) {
        if (!(z.waterCheck > this.elapsed)) { z.detour = !this.dryLine(z, target); z.waterCheck = this.elapsed + .5; }
        if (z.detour) heading = this.flowDirection(z) || heading;
      }
      // The dead shamble around tree trunks rather than through them, and along the bank rather than into the water.
      const next = this.dryStep(z, steerAroundTrees(this.forest, z, heading, z.speed * dt, z.kind === 'brute' ? 6 : 4, z.seed % 2 < 1 ? 1 : -1));
      const pad = z.kind === 'brute' ? 9 : 5, obstacle = this.buildingsNear(next, pad).find(b => b.hp > 0 && inside(next, boundsOf(b, pad)) && !(this.campaign && this.sealedShelter(b)));
      if (obstacle) {
        // A campaign's campfire is a ring of stones: nothing to break.
        if (!this.godmode && !(this.campaign && obstacle.type === 'campfire')) obstacle.hp -= (z.structureDamage ?? z.damage) * dt;
        z.bashing = this.elapsed; // Heard across the refuge, wall or no wall.
        z.facing = obstacle.x < z.x ? -1 : 1;
        if (has(obstacle, 'wire')) this.hit(z, (4 + (has(obstacle, 'spikes') ? 10 : 0)) * dt);
      } else if (prey && d < 13) {
        const tower = prey.stationed && this.buildings.find(b => b.id === prey.towerId);
        if (tower) { if (!this.godmode) tower.hp -= (z.structureDamage ?? z.damage) * dt; z.bashing = this.elapsed; }
        else if (z.swing != null) {
          // A campaign infected lands a blow every couple of seconds.
          z.swing -= dt;
          if (z.swing <= 0) { z.swing = CAMPAIGN.tuning.combat.wanderer.attackInterval; this.strike(z, prey, survivorStats(prey, this.postOf(prey)).armor); }
          z.attacking = this.elapsed;
        } else {
          const preyTower = prey.stationed && prey.towerId != null ? this.buildings.find(b => b.id === prey.towerId) : null;
          if (!this.godmode) {
            prey.hp -= z.damage * survivorStats(prey, this.postOf(prey), preyTower).armor * dt;
            prey.lastHit = this.elapsed;
          }
          z.attacking = this.elapsed;
        }
        z.facing = prey.x < z.x ? -1 : 1;
      } else { z.x = next.x; z.y = next.y; z.facing = next.dx < 0 ? -1 : 1; }
    }
    if (this.campaign) this.defenseTick();
    for (const s of this.survivors.filter(s => s.hp <= 0 && s.condition !== 'downed')) {
      if (s.expedition) this.kill(s, 'They starved on the road.');
      else this.down(s);
    }
    // A campaign region is lost when nobody is left alive in it.
    if (this.campaign && this.status === 'playing' && !this.survivors.length) {
      this.status = 'lost';
      this.notify(CAMPAIGN.strings.loss_title, fill(CAMPAIGN.strings.loss_body, { regionId: this.campaign.region?.id || '' }), 'warn');
      this.message(MARA, 'Private channel', CAMPAIGN.strings.loss_mara);
    }
    const fallen = this.buildings.filter(b => b.hp <= 0);
    this.buildings = this.buildings.filter(b => b.hp > 0);
    for (const b of fallen) {
      this.navVersion++;
      if (this.campaign) this.relayGone(b, true);
      this.releasePost(b);
      this.buildingLost(b);
      if (b.type === 'core' || b.type === 'campfire') { this.status = 'lost'; this.notify(b.type === 'campfire' ? 'The camp has fallen' : 'The refuge has fallen', b.type === 'campfire' ? 'The dead overran the campfire.' : 'The dead broke through your last line of defense.', 'warn'); }
      else if (b.type !== 'barricade') this.notify(BUILDINGS[b.type].name + ' destroyed', 'Rebuild it from the construction menu.', 'warn');
    }
    this.zombieIndex = this.patrolIndex = this.buildingIndex = null;
    this.zombies = this.zombies.filter(z => z.hp > 0);
    this.effects.forEach(e => e.life -= dt);
    this.effects = this.effects.filter(e => e.life > 0);
  }
}
// Each subsystem is a class whose methods and getters run with `this` bound to the Game.
for (const part of [Ledger, Crew, Deployment, Tasks, CampWork, Medical, Defense, Radio, Migration, Certification, Operations, Story, Buildings, Economy, Expeditions, Recruitment, Staff, Navigation, Health, Combat, Save, Harvest, Progression, Water]) {
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(part.prototype))) {
    if (key === 'constructor') continue;
    if (Object.hasOwn(Game.prototype, key)) throw new Error('Game.' + key + ' is defined twice');
    Object.defineProperty(Game.prototype, key, descriptor);
  }
}
