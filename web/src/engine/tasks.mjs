// The campaign's task chain (P1-01 ... P2-13, side tasks S01-S05): states, objectives, unlocks, rewards
// and the copy CentroCom and Mara send along the way. Installed onto Game.prototype by model.mjs.
//   LOCKED → AVAILABLE (predecessors done) → ACTIVE (main tasks start themselves) → OBJECTIVES_MET → COMPLETED
// Structures, recipes, jobs and SeerPad modules a task lists unlock when it starts, so its objectives can be
// met; its resource reward is paid once when it completes. Cumulative objectives count only what happens
// after the task starts; current-state objectives (a built structure, a staffed post) count whenever true.
import { CAMPAIGN, fill, CENTROCOM, MARA, campaignIdOf } from './campaignState.mjs';
import { campaignJob } from './crew.mjs';
import { HOUR_SECONDS } from './data.mjs';

export const TASK_STATES = ['locked', 'available', 'active', 'objectives_met', 'completed'];
export const TASKS = CAMPAIGN.tasks;
export const TASK_BY_ID = Object.fromEntries(TASKS.map(t => [t.id, t]));
// SeerPad modules open before any task unlocks more.
const START_MODULES = ['messages', 'tasks', 'survivors', 'resources', 'build', 'map'];
const UNLOCK_KINDS = ['buildings', 'jobs', 'recipes', 'modules', 'commands', 'routes', 'expeditions'];
// How long an alert stays quiet after it was raised, in game hours.
const ALERT_QUIET_HOURS = 2;

export class Tasks {
  // ---- Setup ----
  initTasks() {
    const c = this.campaign;
    c.tasks = Object.fromEntries(TASKS.map(t => [t.id, { state: 'locked', counters: {}, holds: {}, activatedAt: null, completedAt: null }]));
    c.unlocks = Object.fromEntries(UNLOCK_KINDS.map(k => [k, k === 'modules' ? [...START_MODULES] : []]));
    c.rewardTx = [];
    c.alertAt = {};
    this.refreshTasks();
  }
  get taskVars() { const c = this.campaign; return { overseerName: c.settings.overseerName, regionId: c.region?.id || '' }; }
  taskUnlocked(kind, id) { return !!this.campaign?.unlocks?.[kind]?.includes(id); }
  get activeTasks() { return this.campaign?.tasks ? TASKS.filter(t => this.campaign.tasks[t.id]?.state === 'active') : []; }
  get currentTask() { return this.activeTasks.find(t => t.kind === 'main') || null; }

  // ---- Lifecycle ----
  // Opens every task whose predecessors are done, and starts the main ones.
  refreshTasks() {
    const c = this.campaign;
    for (const t of TASKS) {
      const st = c.tasks[t.id];
      if (st.state !== 'locked' || t.kind !== 'main') continue;
      if (t.predecessors.every(p => c.tasks[p]?.state === 'completed')) { st.state = 'available'; this.activateTask(t.id); }
    }
  }
  activateTask(id) {
    const t = TASK_BY_ID[id], st = this.campaign.tasks[id], vars = this.taskVars;
    Object.assign(st, { state: 'active', counters: {}, holds: {}, activatedAt: this.elapsed });
    const unlocks = this.campaign.unlocks;
    for (const kind of UNLOCK_KINDS) for (const x of t.unlocks[kind] || []) if (!unlocks[kind].includes(x)) unlocks[kind].push(x);
    const first = t === TASKS[0];
    if (t.copy.centroComIssue) this.message(CENTROCOM, first ? 'Deployment confirmed: ' + vars.regionId : `${t.code} · ${t.title}`, fill(t.copy.centroComIssue, vars), first ? 'good' : '', { kind: 'quest' });
    const mara = t.copy.maraAfterWelcome || t.copy.maraBefore || t.copy.maraCopy;
    if (mara) this.message(MARA, first ? 'Private channel' : t.title, fill(mara, vars));
    if (t.copy.unlockToast) { const [title, body] = t.copy.unlockToast.split(' / '); this.notify(title, body || t.title, 'good'); }
    this.landRevision++;
  }
  completeTask(id) {
    const t = TASK_BY_ID[id], st = this.campaign.tasks[id], c = this.campaign, vars = this.taskVars;
    if (st.state === 'completed') return;
    st.state = 'objectives_met';
    // Rewards are paid exactly once, whatever reloads come in between.
    const tx = 'task:' + id;
    if (!c.rewardTx.includes(tx)) { c.rewardTx.push(tx); this.depositAll(t.reward); }
    Object.assign(st, { state: 'completed', completedAt: this.elapsed });
    const reward = Object.entries(t.reward).map(([r, n]) => `+${n} ${r.replace('_', ' ')}`).join(' · ');
    this.message(CENTROCOM, `Task complete: ${t.code} · ${t.title}`, fill(t.copy.completionText || CAMPAIGN.strings.generic_task_complete, { ...vars, taskTitle: t.title }) + (reward ? `\n\n${fill(CAMPAIGN.strings.generic_reward, { rewardSummary: reward })}` : ''), 'good', { kind: 'quest' });
    if (t.copy.maraAfter) this.message(MARA, t.title, fill(t.copy.maraAfter, vars));
    this.notify('Task complete: ' + t.title, reward || t.code, 'good');
    this.requestAutosave('Task complete: ' + t.code);
    // Dealing with the first infected ends the tutorial's protected period.
    if (id === 'p1_07') this.endProtection();
    if (id === 'p1_10') this.certifyCamp();
    this.refreshTasks();
  }
  // Twice a second: active tasks check their objectives and complete when all are met.
  tasksTick(dt) {
    const c = this.campaign;
    if (!c?.tasks) return;
    c.taskTimer = (c.taskTimer || 0) - dt;
    c.taskClock = (c.taskClock || 0) + dt;
    if (c.taskTimer > 0) return;
    c.taskTimer = .5;
    const since = c.taskClock; c.taskClock = 0;
    this.recoveryTick();
    this.sideTaskTick();
    for (const t of this.activeTasks) {
      // A hold clock runs while its condition stays true and starts over whenever it fails.
      const st = c.tasks[t.id];
      for (const o of t.objectives) if (o.type === 'continuous_time') st.holds[o.id] = this.holdMet(o) ? (st.holds[o.id] || 0) + since : 0;
      if (t.objectives.every(o => this.objectiveProgress(t, o).done)) this.completeTask(t.id);
    }
  }

  // ---- Objectives ----
  objectiveProgress(t, o) {
    const st = this.campaign.tasks[t.id], count = o.count || 1;
    let value = 0;
    switch (o.type) {
      case 'interaction': value = st.counters[o.id] ? 1 : 0; break;
      case 'build': value = this.buildings.filter(b => campaignIdOf(b.type) === o.target && b.built && this.operational(b)).length; break;
      case 'staff': value = this.survivors.filter(s => s.model === 'campaign' && campaignJob(s) === o.role && (o.role !== 'guard' || s.role === 'guard') && s.post != null && this.operational(this.postOf(s) || { blueprint: true })).length; break;
      case 'cumulative_gather': case 'cumulative_harvest': case 'cumulative_craft': case 'cumulative_process': value = st.counters[o.id] || 0; break;
      case 'predicate': value = (o.conditions || []).every(x => this.conditionMet(x)) ? 1 : 0; break;
      case 'continuous_time': value = (st.holds[o.id] || 0) / HOUR_SECONDS; return { value, count: o.targetHours, done: value >= o.targetHours };
    }
    return { value: Math.min(value, count), count, done: value >= count };
  }
  // Something happened that cumulative objectives count: gathered, harvested, crafted or processed.
  tallyTask(kind, target, amount, building = null) {
    if (!this.campaign?.tasks || !(amount > 0)) return;
    const type = 'cumulative_' + kind;
    for (const t of this.activeTasks) for (const o of t.objectives) {
      if (o.type !== type || o.target !== target || (o.building && building && o.building !== building)) continue;
      const st = this.campaign.tasks[t.id];
      st.counters[o.id] = (st.counters[o.id] || 0) + amount;
    }
  }
  // A screen opened or a resident selected: interaction objectives of active tasks.
  recordInteraction(id) {
    if (!this.campaign?.tasks) return false;
    let hit = false;
    for (const t of this.activeTasks) for (const o of t.objectives) if (o.type === 'interaction' && o.id === id) { this.campaign.tasks[t.id].counters[o.id] = 1; hit = true; }
    return hit;
  }

  // ---- Metrics the predicates read ----
  metric(name) {
    switch (name) {
      case 'livingPopulation': return this.survivors.length;
      case 'housingCapacity': return this.buildings.filter(b => this.operational(b)).reduce((n, b) => n + this.beds(b), 0);
      case 'hasOverflow': return this.outputBlocked;
      case 'totalStorageCapacity': return this.storageCapacity;
      case 'availableFood': return this.available('food');
      case 'availableAmmo': return this.available('ammo');
      case 'unreservedFood': return this.available('food');
      case 'availableMedicalSupplies': return this.available('medical_supplies');
      case 'downedCount': return this.survivors.filter(s => s.condition === 'downed').length;
      case 'tasksCompleted': return TASKS.filter(t => this.campaign.tasks[t.id]?.state === 'completed').map(t => t.id);
      case 'scriptedPatientTreated': return this.campaign.scripted.cutTreated;
      case 'hasArmedGuard': return this.hasArmedGuard;
      case 'staffedLookout': return this.staffedLookout;
      // The watch and the patrol are different people by construction: a Lookout post makes its Guard a sentry.
      case 'separatePatrolGuard': return this.staffedLookout && this.guardsAt('guard_post').length > 0;
      case 'tutorialInfectedDetected': return !!this.campaign.scripted.wanderer?.detected;
      case 'tutorialThreatNeutralized': return !!this.campaign.scripted.wanderer?.neutralized;
      case 'recruitedCount': return this.campaign.recruitedCount;
      case 'untreatedBleeding': case 'untreatedBleedingCount': return this.untreatedBleeding;
      case 'scheduledGrossFoodPerDay': return this.grossFoodPerDay;
      case 'availableKits': case 'emergencyFoodRecovered': case 'selectedStructureRepaired': case 'exhaustedRested': case 'candidateDecidedWithBedOrDeclined': return this.sideMetric(name);
      case 'maintenanceCrewContacted': case 'hasBatteryToken': case 'radioKitOperational': case 'relayBroadcastFinished': return this.storyMetric(name);
      case 'firstGroceryReturned': case 'unloadedGroceryFood': case 'recoveredRawSalvage': return this.operationsMetric(name);
      case 'emergencyShelterCapacity': case 'firstMigrationTriggered': case 'shelteredContinuousHours': case 'firstMigrationCleared': return this.migrationMetric(name);
      default: return undefined;
    }
  }
  // The condition a continuous_time objective holds for.
  holdMet(o) {
    switch (o.id) {
      case 'patrol_duration': return this.patrolling;
      case 'cert_hold': return this.certificationHold();
      default: return (o.conditions || []).every(x => this.conditionMet(x));
    }
  }
  conditionMet(x) {
    const v = this.metric(x.metric);
    if (v === undefined) return false;
    const target = x.ref ? this.metric(x.ref) * (x.times || 1) : x.value;
    switch (x.op) {
      case 'true': return !!v;
      case 'false': return !v;
      case '>=': return v >= target;
      case '>': return v > target;
      case '<=': return v <= target;
      case '<': return v < target;
      case '==': return v === target;
      case 'includesAll': return (x.value || []).every(id => v.includes(id));
      default: return false;
    }
  }

  // ---- Alerts (Appendix B): each key speaks at most once per two game hours ----
  // `force` speaks whatever the last time was (one survivor's emergency must not silence another's).
  campaignAlert(key, vars = {}, tone = 'warn', { force = false } = {}) {
    const c = this.campaign;
    if (!c) return false;
    c.alertAt ??= {};
    if (!force && this.elapsed - (c.alertAt[key] ?? -1e9) < ALERT_QUIET_HOURS * HOUR_SECONDS) return false;
    c.alertAt[key] = this.elapsed;
    const text = fill(CAMPAIGN.strings[key.toLowerCase()] || key, vars), [head, ...rest] = text.split(' / ');
    if (rest.length) this.notify(head, rest.join(' / '), tone); else this.notify('CentroCom', text, tone);
    return true;
  }

  // ---- Saves ----
  restoreTasks(d) {
    const c = this.campaign;
    if (!d?.tasks || typeof d.tasks !== 'object') { if (c.phase > 0) this.initTasks(); return; }
    const num = v => Number.isFinite(v) ? v : 0;
    c.tasks = Object.fromEntries(TASKS.map(t => {
      const s = d.tasks[t.id] || {};
      const state = TASK_STATES.includes(s.state) ? s.state : 'locked';
      return [t.id, { state: state === 'objectives_met' ? 'active' : state, counters: Object.fromEntries(Object.entries(s.counters || {}).map(([k, v]) => [k, num(v)])),
        holds: Object.fromEntries(Object.entries(s.holds || {}).map(([k, v]) => [k, num(v)])), activatedAt: Number.isFinite(s.activatedAt) ? s.activatedAt : null, completedAt: Number.isFinite(s.completedAt) ? s.completedAt : null }];
    }));
    c.unlocks = Object.fromEntries(UNLOCK_KINDS.map(k => [k, Array.isArray(d.unlocks?.[k]) ? d.unlocks[k].filter(x => typeof x === 'string') : k === 'modules' ? [...START_MODULES] : []]));
    c.rewardTx = Array.isArray(d.rewardTx) ? d.rewardTx.filter(x => typeof x === 'string') : [];
    c.alertAt = d.alertAt && typeof d.alertAt === 'object' ? Object.fromEntries(Object.entries(d.alertAt).filter(([, v]) => Number.isFinite(v))) : {};
  }
}
