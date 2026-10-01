// Phase 1's end (P1-10 and spec §13.1): the Established Camp checklist and its 12-hour stability hold, the
// Phase 2 transition, CentroCom's one-time emergency deliveries when a required structure can't be paid
// for, and the optional side tasks S01-S05 that open when their situation arises. Installed onto
// Game.prototype by model.mjs.
import { CAMPAIGN, CENTROCOM, MARA, CLASSIFICATIONS, campaignBuilding, campaignIdOf, engineTypeOf, fill, copy } from './campaignState.mjs';
import { HOUR_SECONDS } from './data.mjs';
import { buildingMaxHP } from './rules.mjs';

const R = CAMPAIGN.tuning.recovery, F = CAMPAIGN.tuning.farming, T = CAMPAIGN.tuning.time;
const PHASE1_TASKS = ['p1_01', 'p1_02', 'p1_03', 'p1_04', 'p1_05', 'p1_06', 'p1_07', 'p1_08', 'p1_09'];
const S01_FOOD = 12, S02_BELOW = .75, S03_TIRED = 85, S03_RESTED = 40;

export class Certification {
  // ---- The Established Camp checklist ----
  // Posted people count while asleep: routine sleep doesn't break projected production or assignments.
  postedAt(id, role) { return this.survivors.filter(s => s.role === role && s.post != null && s.condition !== 'downed' && !s.expedition && campaignIdOf(this.postOf(s)?.type) === id && this.operational(this.postOf(s))); }
  get medicsPosted() { return this.postedAt('aid_station', 'medic').length + this.postedAt('field_clinic', 'medic').length; }
  get watchPosted() { return this.postedAt('lookout_post', 'sentry').length + this.postedAt('watchtower', 'sentry').length; }
  get grossFoodPerDay() { return (this.postedAt('garden_plot', 'farmer').length * F.gardenFoodPerWorkHour + this.postedAt('field_farm', 'farmer').length * F.fieldFarmFoodPerWorkHour) * (T.workEndHour - T.workStartHour); }
  certificationChecklist() {
    const c = this.campaign, pop = this.atHome.length, done = id => c.tasks?.[id]?.state === 'completed';
    const has = id => this.buildings.some(b => campaignIdOf(b.type) === id && this.operational(b));
    const downed = this.survivors.filter(s => s.condition === 'downed').length;
    const items = [
      ['tasks', 'Main tasks P1-01 to P1-09 complete', PHASE1_TASKS.every(done), `${PHASE1_TASKS.filter(done).length} / ${PHASE1_TASKS.length}`],
      ['population', 'Population 6+, nobody downed or bleeding', pop >= 6 && !downed && !this.untreatedBleeding, `${pop} living · ${downed} downed · ${this.untreatedBleeding} bleeding`],
      ['housing', 'Housing and emergency shelter for everyone', this.capacity >= pop && this.emergencyShelterCapacity >= pop, `${this.capacity} beds · ${this.emergencyShelterCapacity} shelter slots · ${pop} residents`],
      ['food', 'Food production and reserve', this.grossFoodPerDay >= pop && this.available('food') >= 2 * pop, `${this.grossFoodPerDay.toFixed(1)} / ${pop} a day · ${Math.floor(this.available('food'))} / ${2 * pop} in reserve`],
      ['medical', 'Aid Station with a Medic', this.medicsPosted > 0, has('aid_station') || has('field_clinic') ? (this.medicsPosted ? 'Staffed' : 'No Medic posted') : 'No working Aid Station'],
      ['workshop', 'Working Field Workbench', has('field_workbench') || has('workshop'), has('field_workbench') ? 'Operational' : 'None working'],
      ['defense', 'A watch Guard and a separate patrol Guard', this.watchPosted > 0 && this.postedAt('guard_post', 'guard').length > 0, `${this.watchPosted} on watch · ${this.postedAt('guard_post', 'guard').length} on patrol`],
      ['radio', 'Radio Kit and a recruit arrived', has('radio_kit') && c.recruitedCount >= 1, `${has('radio_kit') ? 'Radio working' : 'No working Radio Kit'} · ${c.recruitedCount} recruited`],
    ];
    return items.map(([id, label, ok, detail]) => ({ id, label, ok: !!ok, detail }));
  }
  // The hold resets the moment any item fails, and CentroCom says which.
  certificationHold() {
    const failed = this.certificationChecklist().find(i => !i.ok), c = this.campaign;
    if (failed && (c.tasks.p1_10.holds.cert_hold || 0) > HOUR_SECONDS / 4) this.campaignAlert('UI_HOLD_RESET', { reason: failed.label.toLowerCase() + ' (' + failed.detail + ')' });
    return !failed;
  }
  // Established Camp: Phase 2 begins, starvation protection ends, and the HUD shows the transition.
  certifyCamp() {
    const c = this.campaign, t = CAMPAIGN.tasks.find(t => t.id === 'p1_10');
    c.phase = 2; c.classification = CLASSIFICATIONS[1]; c.transition = 'phase2';
    if (t.copy.maraCopy) this.message(MARA, 'Private channel', fill(t.copy.maraCopy, this.taskVars));
    this.requestAutosave('Established Camp');
  }
  beginPhase2() {
    if (this.campaign?.transition !== 'phase2') return false;
    this.campaign.transition = null;
    this.message(CENTROCOM, 'Phase 2 authorized', copy('ui_phase2_risk'), 'warn');
    return true;
  }

  // ---- Emergency deliveries: once per resource, when the current main task's structure can't be paid for ----
  structuresNeeded() {
    const t = this.currentTask;
    if (!t) return [];
    const out = [];
    for (const o of t.objectives) if (o.type === 'build' && !this.objectiveProgress(t, o).done) out.push(...Array(o.count - this.objectiveProgress(t, o).value).fill(o.target));
    if (t.id === 'p1_09' && this.emergencyShelterCapacity < this.atHome.length) out.push('makeshift_shelter');
    // A structure already placed as a blueprint has its materials set aside.
    const placed = {};
    for (const b of this.buildings) if (b.blueprint) placed[campaignIdOf(b.type)] = (placed[campaignIdOf(b.type)] || 0) + 1;
    return out.filter(id => !(placed[id]-- > 0));
  }
  recoveryTick() {
    const c = this.campaign, rc = c.recovery;
    for (const p of rc.pending.filter(p => this.elapsed >= p.at)) {
      this.depositAll(p.amounts);
      this.notify('Emergency delivery arrived', this.amountsLine(p.amounts), 'good');
      this.writeJournal('Emergency delivery', 'CentroCom delivered ' + this.amountsLine(p.amounts) + '.');
    }
    rc.pending = rc.pending.filter(p => this.elapsed < p.at);
    const need = {};
    for (const id of this.structuresNeeded()) for (const [r, n] of Object.entries(campaignBuilding(engineTypeOf(id))?.cost || {})) need[r] = (need[r] || 0) + n;
    const amounts = {};
    for (const [r, n] of Object.entries(need)) {
      if (rc.sent[r] || !(r in R.deliveryCaps)) continue;
      const gatherable = (this.debris || []).filter(d => d.resource === r).reduce((a, d) => a + d.stock, 0);
      const short = n - this.available(r) - gatherable;
      if (short > 0) { amounts[r] = Math.min(R.deliveryCaps[r], Math.ceil(short)); rc.sent[r] = true; }
    }
    if (!Object.keys(amounts).length) return;
    rc.pending.push({ at: this.elapsed + R.deliveryHours * HOUR_SECONDS, amounts });
    this.message(CENTROCOM, 'Emergency allocation', fill(CAMPAIGN.strings.recovery_delivery, { resourceSummary: this.amountsLine(amounts) }), 'warn');
    this.writeJournal('Supply shortfall', 'Required materials ran short; CentroCom approved a one-time delivery of ' + this.amountsLine(amounts) + '.');
  }
  amountsLine(a) { return Object.entries(a).map(([r, n]) => n + ' ' + (CAMPAIGN.resources[r]?.name || r)).join(', '); }

  // ---- Side tasks: offered when their situation arises, taken on by the Overseer ----
  sideTaskTick() {
    const c = this.campaign, side = c.side ??= {};
    const offer = (id, data) => {
      const st = c.tasks[id], t = CAMPAIGN.tasks.find(t => t.id === id);
      if (st?.state !== 'locked') return;
      st.state = 'available'; side[id] = data;
      this.message(CENTROCOM, `Optional task available: ${t.code} · ${t.title}`, fill(t.copy.body, this.taskVars) + '\n\nAccept it from Tasks on the SeerPad.', '', { kind: 'quest' });
    };
    const withdraw = id => { if (c.tasks[id]?.state === 'available') { c.tasks[id].state = 'locked'; delete side[id]; } };
    const pop = this.atHome.length, days = this.dailyFoodDemand > 0 ? this.available('food') / this.dailyFoodDemand : Infinity;
    if (c.phase >= 1 && days < 1.5) offer('s01', {});
    const damaged = this.buildings.filter(b => !b.blueprint && b.type !== 'campfire' && b.hp < buildingMaxHP(b) * S02_BELOW).sort((a, b) => a.hp / buildingMaxHP(a) - b.hp / buildingMaxHP(b))[0];
    if (damaged) offer('s02', { building: damaged.id }); else if (!c.tasks.s02 || c.tasks.s02.state === 'available') withdraw('s02');
    const tired = this.survivors.filter(s => s.fatigue >= S03_TIRED || s.exhausted);
    if (tired.length >= 2) offer('s03', { survivors: tired.slice(0, 2).map(s => s.id) });
    const waiting = this.candidates[0];
    if (waiting && this.capacity - pop <= 0) offer('s04', { candidate: waiting.id }); else if (!waiting) withdraw('s04');
    if (this.taskUnlocked('recipes', 'c08')) offer('s05', {});
  }
  acceptSideTask(id) {
    const t = CAMPAIGN.tasks.find(t => t.id === id), c = this.campaign;
    if (!t || t.kind !== 'side' || c?.tasks[id]?.state !== 'available') return false;
    this.activateTask(id);
    // S01 marks a ration crate inside the perimeter for anyone to gather.
    if (id === 's01') {
      const p = this.outerPoint(Math.max(4, (c.region?.protectedRadius || 288) / 16 * .5));
      const node = { id: 'debris-s01', kind: 'rations', resource: 'food', size: 'small', workers: 1, stock: S01_FOOD, max: S01_FOOD, key: 'decor/deco_crates', x: p.x, y: p.y, footprint: 1, ordered: true, marked: true };
      this.debris = [...(this.debris || []).filter(d => d.id !== node.id), node];
      c.side.s01 = { node: node.id };
      this.landRevision++;
    }
    return true;
  }
  sideMetric(name) {
    const c = this.campaign, side = c.side || {};
    switch (name) {
      case 'emergencyFoodRecovered': return !!side.s01?.node && !(this.debris || []).some(d => d.id === side.s01.node) && !this.survivors.some(s => s.camp?.id === side.s01.node);
      case 'selectedStructureRepaired': { const b = this.buildings.find(b => b.id === side.s02?.building); return !b || b.hp >= buildingMaxHP(b) - .01; }
      case 'exhaustedRested': return (side.s03?.survivors || []).map(id => this.survivors.find(s => s.id === id)).filter(Boolean).every(s => s.fatigue <= S03_RESTED && !s.exhausted);
      case 'candidateDecidedWithBedOrDeclined': return !this.candidates.some(x => x.id === side.s04?.candidate) || this.capacity - this.atHome.length > 0;
      case 'availableKits': return c.stock.first_aid_kit;
      default: return undefined;
    }
  }
  // What the shelter and migration objectives read.
  migrationMetric(name) {
    const mg = this.campaign.migration;
    switch (name) {
      case 'emergencyShelterCapacity': return this.emergencyShelterCapacity;
      case 'firstMigrationTriggered': return mg.triggered;
      case 'shelteredContinuousHours': return mg.bestHold;
      case 'firstMigrationCleared': return mg.cleared > 0;
      default: return undefined;
    }
  }
}
