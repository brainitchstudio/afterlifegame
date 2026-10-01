// Campaign Phase 2 operations (spec §9, P2-01 ... P2-05): the Operations Board sends one team at a time to a
// regional site on the generated map. The team really walks there and back (one-way hours = max(0.5, path
// tiles / 80)), works the site for its hours, carries home what it can (Σ 15 + 2·STR) and leaves the rest.
// Food for the trip is reserved at launch; the team keeps its beds. Site events (delay, injury, cargo loss)
// roll at the site; the infected on the map can reach a team anywhere. The first two runs carry no event
// risk and hold off the ambient trickle. Also the Salvage Yard's processing. Installed onto Game.prototype by
// model.mjs.
import { CAMPAIGN, CENTROCOM, campaignIdOf, fill, emptyOperations } from './campaignState.mjs';
import { campaignMaxHp, campaignJob, laborFactor } from './crew.mjs';
import { HOUR_SECONDS, distance } from './data.mjs';
import { WEAPONS } from './survivors.mjs';

const O = CAMPAIGN.tuning.operations;
// Salvage Yard: per worker-hour, 6 Raw Salvage become 4 Scrap Metal.
const SALVAGE_IN = 6, SALVAGE_OUT = 4;
const REPORTS_KEPT = 12;
export { emptyOperations };

export class Operations {
  get ops() { return this.campaign.operations; }
  get operationsBoard() { return this.buildings.find(b => campaignIdOf(b.type) === 'operations_board' && this.operational(b)) || null; }
  get mission() { return this.campaign?.operations?.mission || null; }
  onMission(s) { return !!this.mission && this.mission.team.includes(s.id); }

  // ---- Sites ----
  siteState(id) {
    const def = CAMPAIGN.sites[id], st = this.ops.sites[id] ??= { stock: { ...(def.stock || {}) }, cooldownUntil: null, returns: 0, visits: 0 };
    // A recurring route restocks once its cooldown has run out.
    if (def.recurring && st.cooldownUntil != null && this.elapsed >= st.cooldownUntil) {
      st.cooldownUntil = null;
      st.stock = { ...def.stock };
      if (def.bonusRange) { const [lo, hi] = def.bonusRange, k = Object.keys(def.stock)[0]; st.stock[k] += lo + Math.floor(this.random() * (hi - lo + 1)); }
    }
    return st;
  }
  siteRecord(id) { return this.campaign.region?.sites?.find(s => s.id === id) || null; }
  // Scavenging sites and routes open with their task; story sites go out as expeditions (story.mjs).
  siteOpen(id) {
    const def = CAMPAIGN.sites[id], rec = this.siteRecord(id), st = this.campaign.tasks?.[def?.unlockedBy]?.state;
    if (def?.kind === 'story') return this.storyOpen(def.expedition);
    return !!def && !!rec?.revealed && (st === 'active' || st === 'completed' || this.taskUnlocked('routes', id) || this.freeBuild);
  }
  siteBlock(id) {
    const def = CAMPAIGN.sites[id], st = this.siteState(id);
    if (def?.kind === 'story') return this.storyBlock(def.expedition);
    if (!this.siteOpen(id)) return 'Not authorized yet';
    if (st.cooldownUntil != null && this.elapsed < st.cooldownUntil) return `Route recovering · ${((st.cooldownUntil - this.elapsed) / HOUR_SECONDS).toFixed(0)}h`;
    if (!Object.values(st.stock).some(n => n > 0)) return def.recurring ? 'Route recovering' : 'Depleted';
    return '';
  }
  oneWayHours(id) { return Math.max(O.minOneWayHours, (this.siteRecord(id)?.walkTiles || 0) / O.tilesPerHour); }
  // Teams whose best Intelligence is below 5 take two hours longer to find their way around a site.
  siteHours(id, team) { return (this.siteWorkHours(id)) + (team.length && Math.max(...team.map(s => s.stats.int)) < O.intSpeedupMin ? O.intPenaltyHours : 0); }
  siteWorkHours(id) { const e = CAMPAIGN.sites[id]?.expedition; return e ? this.expeditionHours(e) : CAMPAIGN.sites[id].siteWorkHours; }
  teamSize(id) { const e = CAMPAIGN.sites[id]?.expedition; return e ? CAMPAIGN.expeditions[e].team : O.scavengeTeam; }
  carryCapacity(team) { return team.reduce((n, s) => n + O.carryBase + O.carryPerStr * s.stats.str, 0); }
  // Rations: 1 Food per person per day, whole days.
  rationsFor(id, team) { return team.length * Math.ceil((2 * this.oneWayHours(id) + this.siteHours(id, team)) / 24) * CAMPAIGN.tuning.food.perPersonPerDay; }
  armedGuards(team) { return team.filter(s => s.role === 'guard' && s.gear && WEAPONS[s.gear]).length; }
  eventChance(id, team) {
    if (this.tutorialSafe(id)) return 0;
    const agi = team.reduce((n, s) => n + s.stats.agi, 0) / Math.max(1, team.length);
    return Math.min(O.eventMax, Math.max(O.eventMin, CAMPAIGN.sites[id].baseEventChance - O.eventAgiCoeff * (agi - 5) - O.eventGuardCoeff * this.armedGuards(team)));
  }
  // The first two runs to the tutorial's sites carry no event risk.
  tutorialSafe(id) { return !!CAMPAIGN.sites[id]?.tutorialSafe && this.ops.safeRuns < O.tutorialSafeRuns; }

  // ---- Teams ----
  eligibility(s) {
    const E = O.eligibility;
    if (s.model !== 'campaign') return 'Not a campaign resident';
    if (s.condition === 'downed') return 'Downed';
    if (this.onMission(s)) return 'Already on a mission';
    if (s.arriving) return 'Still arriving';
    if ((s.infection || 0) > E.maxInfection) return 'Infection over ' + E.maxInfection;
    if (s.hp < campaignMaxHp(s) * E.minHpShare) return 'Health under ' + Math.round(E.minHpShare * 100) + '%';
    if (s.fatigue > E.maxFatigue || s.exhausted) return 'Fatigue over ' + E.maxFatigue;
    if (s.care || s.bleeding) return 'Under treatment';
    if (s.sheltered && s.shelter != null) return 'In shelter';
    return '';
  }
  missionBlock(id, ids) {
    const team = ids.map(i => this.survivors.find(s => s.id === i)).filter(Boolean), [lo, hi] = this.teamSize(id);
    if (!this.operationsBoard) return 'Build an Operations Board';
    if (this.mission) return 'A team is already out';
    if (this.sheltering) return 'Residents are sheltering';
    const site = this.siteBlock(id);
    if (site) return site;
    if (team.length < lo || team.length > hi || team.length !== ids.length) return `Choose ${lo}-${hi} residents`;
    const bad = team.find(s => this.eligibility(s));
    if (bad) return `${bad.name}: ${this.eligibility(bad)}`;
    if (this.available('food') < this.rationsFor(id, team)) return `Needs ${this.rationsFor(id, team)} Food for rations`;
    const e = CAMPAIGN.sites[id]?.expedition;
    return e ? this.provisionBlock(e) : '';
  }
  launchMission(id, ids) {
    const block = this.missionBlock(id, ids);
    if (this.status !== 'playing' || block) { if (block) this.campaignAlert('UI_MISSION_BLOCK', { reason: block }, 'warn', { force: true }); return false; }
    const team = ids.map(i => this.survivors.find(s => s.id === i)), rec = this.siteRecord(id), rations = this.rationsFor(id, team);
    const oneWay = this.oneWayHours(id), path = this.findPath(team[0], rec), len = path.length ? path.reduce((n, p, i) => n + distance(i ? path[i - 1] : team[0], p), 0) : distance(team[0], rec);
    // Essential posts left empty while the team is away.
    const posts = team.filter(s => s.post != null).map(s => `${s.name} (${CAMPAIGN.jobs[campaignJob(s)].name})`);
    if (posts.length) this.campaignAlert('UI_MISSION_STAFF', { assignments: posts.join(', ') }, 'warn', { force: true });
    const m = {
      id: 'mission:' + this.nextEventId++, site: id, team: ids.slice(), phase: 'outbound', launchedAt: this.elapsed, oneWay, siteHours: this.siteHours(id, team), siteWork: 0, delay: 0,
      speed: Math.max(8, len / (oneWay * HOUR_SECONDS)), rations, rationsTx: this.reserve({ food: rations }, 'mission', id), capacity: this.carryCapacity(team),
      safe: this.tutorialSafe(id), event: null, cargo: {}, injuries: [], recalled: false,
    };
    const e = CAMPAIGN.sites[id]?.expedition;
    if (e) this.packExpedition(m, e);
    this.ops.mission = m;
    this.paceLegs(m, team, i => this.siteSlot(m, i));
    for (const s of team) {
      Object.assign(s, { camp: null, harvest: undefined, respond: null, order: null, hunt: null, goalKey: '', path: [], missionHome: false, missionThere: false });
      if (s.resting) this.wake(s);
      this.dismount(s);
    }
    this.siteState(id).visits++;
    if (!e) for (const k of ['assemble_team', 'launch_scavenging']) this.recordInteraction(k);
    if (id === 'grocery_annex') this.recordInteraction('inspect_grocery');
    this.notify((e ? 'Expedition launched: ' + CAMPAIGN.expeditions[e].name : 'Team launched: ' + CAMPAIGN.sites[id].name), `${team.map(s => s.name).join(', ')} · ${oneWay.toFixed(1)}h each way · ${rations} Food in rations`, 'good');
    return m;
  }
  // Turn the team round. Whatever they had gathered at the site comes home with them.
  recallMission() {
    const m = this.mission;
    if (!m || m.phase === 'return') return false;
    if (m.phase === 'site' && !m.expedition) this.loadCargo(m, Math.min(1, m.siteWork / Math.max(.1, m.siteHours + m.delay)));
    this.startReturn(m, true);
    this.campaignAlert('UI_MISSION_RECALL', { eta: (m.oneWay).toFixed(1) + 'h' }, 'warn', { force: true });
    return true;
  }

  // Each member walks at the pace that makes their own path take the formula's hours.
  paceLegs(m, team, goal) {
    m.pace = {};
    team.forEach((s, i) => {
      const to = goal(i, s); if (!to) return;
      const path = this.findPath(s, to), len = path.length ? path.reduce((n, p, k) => n + distance(k ? path[k - 1] : s, p), 0) : distance(s, to);
      m.pace[s.id] = Math.max(8, len / (m.oneWay * HOUR_SECONDS));
    });
  }
  siteSlot(m, i) { const rec = this.siteRecord(m.site); return { x: rec.x + (i - 1) * 12, y: rec.y + 10 }; }
  homeSpot(s) { const home = this.nearestStore(s) || this.core; return home && this.goalFor(s, home); }
  // ---- Each member, from the survivor loop: walk out, work, walk back ----
  missionStep(s, stats, dt) {
    const m = this.mission;
    if (!m || !m.team.includes(s.id)) { s.missionThere = s.missionHome = false; return false; }
    // A teammate down comes first: the rescue (health/medical) takes over.
    if (s.rescue != null) return false;
    const i = m.team.indexOf(s.id), pace = m.pace?.[s.id] || m.speed;
    if (m.phase === 'outbound') {
      if (s.missionThere || this.travel(s, this.siteSlot(m, i), pace, dt)) { s.missionThere = true; s.task = 'at-site'; }
      else s.task = 'travelling';
      return true;
    }
    if (m.phase === 'site') { s.task = 'scavenging'; s.facing = (Math.floor(this.elapsed / 3) + i) % 2 ? 1 : -1; return true; }
    // Home: the nearest working storage, or the campfire.
    const spot = this.homeSpot(s);
    if (s.missionHome || !spot || this.travel(s, spot, pace, dt)) { s.missionHome = true; s.task = 'unloading'; }
    else s.task = 'returning';
    return true;
  }

  // ---- The mission's clock ----
  operationsTick(dt) {
    const m = this.mission;
    if (m) {
      const team = m.team.map(id => this.survivors.find(s => s.id === id)).filter(Boolean);
      m.team = team.map(s => s.id);
      if (!team.length) { this.endMission(m, 'lost'); return; }
      // A downed member brings the team home; the rescue goes to whoever is nearest.
      if (team.some(s => s.condition === 'downed') && m.phase !== 'return') this.recallMission();
      const up = team.filter(s => s.condition !== 'downed');
      if (m.phase === 'outbound' && up.length && up.every(s => s.missionThere)) this.arriveAtSite(m, up);
      // An expedition waits at the site for its encounter to be decided.
      if (m.phase === 'site' && !m.encounter?.open) {
        m.siteWork += dt / HOUR_SECONDS;
        if (m.siteWork >= m.siteHours + m.delay) { if (!m.expedition) this.loadCargo(m, 1); else this.expeditionHaul(m); this.startReturn(m, false); }
      }
      if (m.phase === 'return' && (!up.length || up.every(s => s.missionHome))) this.endMission(m, 'returned');
    }
    this.salvageTick(dt);
  }
  arriveAtSite(m, team) {
    m.phase = 'site'; m.siteWork = 0;
    if (m.expedition) { this.openEncounter(m); return; }
    const chance = this.eventChance(m.site, team), name = CAMPAIGN.sites[m.site].name;
    if (!(this.random() < chance)) return;
    const W = O.outcomes, r = this.random() * (W.delay.weight + W.injury.weight + W.cargoLoss.weight);
    if (r < W.delay.weight) {
      m.delay += W.delay.hours; m.event = 'delay';
      this.notify(...this.split(fill(CAMPAIGN.strings.scav_event_delay, { siteName: name })), 'warn');
    } else if (r < W.delay.weight + W.injury.weight) {
      const s = team[Math.floor(this.random() * team.length)];
      let hp = W.injury.hp;
      if (this.campaign.stock.first_aid_kit > 0) { this.campaign.stock.first_aid_kit--; hp = W.injury.kitMitigatedHp; }
      else if (this.available('ammo') >= W.injury.ammoMin) { this.resources.ammo -= W.injury.ammoCost; hp = W.injury.ammoMitigatedHp; }
      s.hp = Math.max(1, s.hp - hp); s.lastHit = this.elapsed;
      m.event = 'injury'; m.injuries.push({ name: s.name, hp });
      this.notify(...this.split(fill(CAMPAIGN.strings.scav_event_injury, { survivorName: s.name, siteName: name, damage: hp })), 'warn');
    } else { m.event = 'cargoLoss'; this.notify(...this.split(fill(CAMPAIGN.strings.scav_event_cargo, { siteName: name })), 'warn'); }
  }
  split(text) { const [head, ...rest] = text.split(' / '); return [head, rest.join(' / ') || head]; }
  // What the team carries home: in the site's stock order, up to their capacity (a share of it if recalled).
  loadCargo(m, share) {
    const st = this.siteState(m.site);
    let room = Math.floor(m.capacity * share);
    for (const [r, n] of Object.entries(st.stock)) {
      const take = Math.min(n, room);
      if (take <= 0) continue;
      m.cargo[r] = (m.cargo[r] || 0) + take; st.stock[r] -= take; room -= take;
    }
    // A cargo loss drops a fifth of anything a current task isn't waiting on.
    if (m.event === 'cargoLoss') for (const r of Object.keys(m.cargo)) if (!this.questCargo().includes(r)) m.cargo[r] = Math.floor(m.cargo[r] * (1 - O.outcomes.cargoLoss.share));
  }
  questCargo() { const t = this.currentTask?.id; return t === 'p2_02' ? ['food'] : t === 'p2_03' ? ['raw_salvage'] : []; }
  startReturn(m, recalled) {
    m.phase = 'return'; m.recalled = recalled;
    const team = m.team.map(id => this.survivors.find(x => x.id === id)).filter(Boolean);
    for (const s of team) { s.missionHome = false; s.path = []; s.goalKey = ''; }
    this.paceLegs(m, team, (i, s) => this.homeSpot(s));
  }
  // Home: unload into storage (overflow if it must), settle the rations, write the report.
  endMission(m, how) {
    const team = m.team.map(id => this.survivors.find(s => s.id === id)).filter(Boolean), def = CAMPAIGN.sites[m.site], st = this.siteState(m.site);
    const days = (this.elapsed - m.launchedAt) / (24 * HOUR_SECONDS), eaten = Math.min(m.rations, team.length * days * CAMPAIGN.tuning.food.perPersonPerDay);
    if (m.rationsTx) this.releaseReservation(m.rationsTx);
    this.resources.food = Math.max(0, this.resources.food - eaten);
    if (m.expedition) this.settleExpedition(m, how);
    if (how === 'returned') {
      this.depositAll(m.cargo);
      const u = this.ops.unloaded[m.site] ??= {};
      for (const [r, n] of Object.entries(m.cargo)) u[r] = (u[r] || 0) + n;
      st.returns++;
      if (def.recurring) st.cooldownUntil = this.elapsed + def.cooldownHours * HOUR_SECONDS;
      this.ops.runs++;
      if (m.safe) this.ops.safeRuns++;
    }
    const left = Object.entries(st.stock).filter(([, n]) => n > 0).map(([r, n]) => `${n} ${CAMPAIGN.resources[r]?.name || r}`).join(', ');
    const got = Object.entries(m.cargo).filter(([, n]) => n > 0).map(([r, n]) => `${n} ${CAMPAIGN.resources[r]?.name || r}`).join(', ');
    const report = { id: m.id, site: m.site, at: this.elapsed, team: team.map(s => s.name), cargo: { ...m.cargo }, event: m.event, injuries: m.injuries, recalled: m.recalled, left: left || 'nothing', reviewed: false,
      ...(m.expedition ? { expedition: m.expedition, story: how === 'returned' && !m.recalled ? (m.recovery ? 'The battery was recovered from the relay ruin.' : CAMPAIGN.expeditions[m.expedition].report) : '', choice: m.encounter?.result || '' } : {}) };
    this.ops.reports.unshift(report); this.ops.reports.length = Math.min(this.ops.reports.length, REPORTS_KEPT);
    this.ops.mission = null;
    for (const s of team) Object.assign(s, { missionHome: false, missionThere: false, goalKey: '', path: [] });
    const text = fill(CAMPAIGN.strings.ui_mission_return, { recoveredSummary: 'Recovered: ' + (got || 'nothing'), leftBehindSummary: m.expedition ? report.story || 'The objective was not completed' : def.recurring ? 'The route will recover in ' + def.cooldownHours + ' hours' : 'Left at the site: ' + (left || 'nothing') });
    this.message(CENTROCOM, `Team returned: ${def.name}`, this.split(text)[1], how === 'returned' ? 'good' : 'warn', { kind: 'report' });
    if (this.outputBlocked) this.campaignAlert('UI_OUTPUT_BLOCKED');
    this.requestAutosave('Team returned: ' + def.name);
  }
  reviewReport() {
    if (this.ops.reports.some(r => r.expedition === 'e01' && r.story)) this.recordInteraction('read_survey_report');
    for (const r of this.ops.reports) r.reviewed = true;
    return this.recordInteraction('review_report');
  }

  // ---- Salvage Yard: posted workers turn Raw Salvage into Scrap Metal ----
  salvageTick(dt) {
    for (const b of this.buildings) {
      if (campaignIdOf(b.type) !== 'salvage_yard' || !this.operational(b)) continue;
      for (const s of this.staffOf(b)) {
        if (!this.active(s) || s.fighting || !this.onDuty(s) || this.onMission(s) || !this.atSite(s, b)) continue;
        const want = SALVAGE_IN * dt / HOUR_SECONDS * laborFactor(s, 'gather'), use = Math.min(want, this.available('raw_salvage'));
        if (use <= 0) { s.task = 'no-salvage'; continue; }
        if (this.outputBlocked) { s.task = 'output-blocked'; this.campaignAlert('UI_OUTPUT_BLOCKED'); continue; }
        this.resources.raw_salvage -= use;
        const scrap = use * SALVAGE_OUT / SALVAGE_IN;
        this.deposit('scrap_metal', scrap);
        this.tallyTask('process', 'scrap_metal', scrap);
        s.task = 'processing';
      }
    }
  }
  // What the P2-01 ... P2-05 objectives read.
  operationsMetric(name) {
    const u = this.ops.unloaded;
    switch (name) {
      case 'firstGroceryReturned': return (this.ops.sites.grocery_annex?.returns || 0) > 0;
      case 'unloadedGroceryFood': return u.grocery_annex?.food || 0;
      case 'recoveredRawSalvage': return u.hardware_yard?.raw_salvage || 0;
      default: return undefined;
    }
  }
}
