// Campaign medicine (spec §2.4): bleeding, bandages and first-aid kits, the infection meter and reanimation,
// rescue by carrying a downed survivor to a medical bed, Aid Station treatment with its supply use, medical
// isolation, and P1-05's scripted cut. Legacy runs keep health.mjs's clinic model. Installed onto
// Game.prototype by model.mjs.
import { CAMPAIGN, CENTROCOM, MARA, campaignIdOf, copy, fill } from './campaignState.mjs';
import { campaignMaxHp, isCampaignSurvivor } from './crew.mjs';
import { HOUR_SECONDS, distance } from './data.mjs';

const H = CAMPAIGN.tuning.health;
// Treatment per patient-hour by station: the Aid Station's one bed, the Field Clinic's two.
const TREAT_HP_PER_HOUR = { aid_station: 8, field_clinic: 12 };
const BANDAGE_HP = 10, KIT_HP = 25, FIRST_AID_COOLDOWN_HOURS = 6, SCRIPTED_CUT = 15, CUT_TREATED_HP = 95;
// Below this share of full health a survivor goes for treatment when a staffed bed is free.
const CARE_BELOW = .95;

export class Medical {
  // ---- Who needs what ----
  needsCare(s) { return isCampaignSurvivor(s) && s.condition !== 'downed' && (!!s.bleeding || (s.infection || 0) > 0 || s.hp < campaignMaxHp(s) * CARE_BELOW); }
  healed(s) { return !s.bleeding && !(s.infection > 0) && s.hp >= campaignMaxHp(s) - 1e-6; }
  get aidStations() { return this.buildings.filter(b => TREAT_HP_PER_HOUR[campaignIdOf(b.type)] && this.operational(b)); }
  bedCount(b) { return CAMPAIGN.buildings[campaignIdOf(b.type)]?.capacity?.beds || 1; }
  // The patients in a station's beds, or on their way to one.
  bedOccupants(b) { return this.survivors.filter(p => p.careAt === b.id && (p.care === 'waiting' || p.care === 'seek')); }
  bedFree(b) { return this.bedOccupants(b).length < this.bedCount(b); }
  // A posted Medic staffs the station even asleep: they get up for a patient in the bed (staff.mjs onDuty).
  stationMedic(b, except = null) { return this.staffOf(b).find(m => m !== except && m.role === 'medic' && !m.expedition && m.condition !== 'downed') || null; }
  // A free, staffed bed this survivor may take.
  freeBedFor(s) { return this.aidStations.filter(b => this.stationMedic(b, s) && this.bedFree(b) && (!b.isolate || s.infection > 0)).sort((a, b) => distance(s, a) - distance(s, b))[0] || null; }
  get untreatedBleeding() { return this.survivors.filter(s => s.bleeding).length; }

  // ---- Every step: bleeding, first aid, infection, and the tutorial's cut ----
  medicalTick(dt) {
    if (!this.campaign) return;
    const hours = dt / HOUR_SECONDS, stock = this.campaign.stock;
    for (const s of [...this.survivors]) {
      if (!isCampaignSurvivor(s) || s.expedition) continue;
      if (s.bleeding) {
        s.hp -= H.bleedHpPerHour * hours;
        // Anyone can dress their own wound between fights: a bandage first, a kit if there is none.
        if (s.condition !== 'downed' && !s.fighting) this.firstAid(s, stock);
      }
      if (s.infection > 0) {
        if (!(this.elapsed - (s.treatedAt ?? -1e9) < 1)) s.infection = Math.min(100, s.infection + H.infectionPerHour * hours);
        if (s.infection >= 100 && s.turnAt == null) {
          s.turnAt = this.elapsed + H.reanimateWarningHours * HOUR_SECONDS;
          this.notify('REANIMATION WARNING', fill(CAMPAIGN.strings.reanimation_warning, { survivorName: s.name }), 'warn');
        } else if (s.infection < 100) s.turnAt = null;
        if (s.turnAt != null && this.elapsed >= s.turnAt) { this.reanimate(s); continue; }
      }
      if (s.hp <= 0 && s.condition !== 'downed') this.down(s);
    }
    this.scriptedCut();
  }
  firstAid(s, stock) {
    const ready = at => this.elapsed - (at ?? -1e9) >= FIRST_AID_COOLDOWN_HOURS * HOUR_SECONDS;
    if (stock.bandage > 0 && ready(s.bandageAt)) { stock.bandage--; s.bandageAt = this.elapsed; this.dress(s, BANDAGE_HP, 'a bandage'); }
    else if (stock.first_aid_kit > 0 && ready(s.kitAt)) { stock.first_aid_kit--; s.kitAt = this.elapsed; this.dress(s, KIT_HP, 'a first aid kit'); }
  }
  dress(s, hp, what) {
    s.bleeding = false;
    s.hp = Math.min(campaignMaxHp(s), s.hp + hp);
    this.notify(s.name + ' is patched up', `The bleeding stopped with ${what} (+${hp} HP).`, 'good');
  }
  // A bite or a bleed from an infected's blow (spec §2.4). The tutorial's infected rolls neither.
  woundRolls(s, z) {
    if (z.tutorial || !isCampaignSurvivor(s)) return;
    if (!s.bleeding && this.random() < H.bleedChance) {
      s.bleeding = true;
      this.notify(s.name + ' is bleeding', 'Losing 1 HP an hour until bandaged. Bandages are used automatically while any are in stock.', 'warn');
    }
    const bite = (CAMPAIGN.difficulties[this.campaign.settings.difficulty] || CAMPAIGN.difficulties.standard).biteChance;
    if (!(s.infection > 0) && this.random() < bite) {
      s.infection = H.infectionStart;
      this.campaignAlert('UI_INFECTION', { survivorName: s.name });
    }
  }
  // At 100 infection and two hours' warning the survivor dies and rises. An isolated medical bed holds them.
  reanimate(s) {
    const bed = s.care === 'waiting' && this.buildings.find(b => b.id === s.careAt), contained = !!bed?.isolate, at = { x: s.x, y: s.y };
    this.kill(s, contained ? 'The infection took them in isolation. The bed held.' : 'The infection took them, and they rose again.');
    if (!contained) { const z = this.spawnZombie(0); Object.assign(z, at, { reanimated: s.name }); }
  }

  // ---- P1-05: a routine handling injury, once a staffed station and a bandage are ready ----
  scriptedCut() {
    const c = this.campaign, sc = c.scripted;
    if (sc.cut != null && !sc.cutTreated) {
      const s = this.survivors.find(x => x.id === sc.cut);
      if (!s) sc.cut = null;
      else if (s.hp >= CUT_TREATED_HP && !s.bleeding && s.condition !== 'downed') sc.cutTreated = true;
    }
    if (sc.cut != null || c.tasks?.p1_05?.state !== 'active' || c.stock.bandage < 1 || !this.workShift) return;
    if (!this.aidStations.some(b => this.stationMedic(b))) return;
    const s = this.survivors.filter(x => isCampaignSurvivor(x) && x.role !== 'medic' && x.condition === 'healthy' && !x.expedition && !x.resting && !x.sheltered && !x.arriving && x.hp >= campaignMaxHp(x) * .6)
      .sort((a, b) => a.fatigue - b.fatigue || a.id - b.id)[0];
    if (!s) return;
    s.hp -= SCRIPTED_CUT; s.lastHit = this.elapsed;
    sc.cut = s.id;
    const t = CAMPAIGN.tasks.find(t => t.id === 'p1_05');
    this.message(CENTROCOM, 'Minor injury reported', fill(t.copy.injuryNotice, { survivorName: s.name }), 'warn');
    this.notify(s.name + ' cut their hand', 'A minor injury: they will walk to the Aid Station for treatment.', 'warn');
  }

  // ---- Going for treatment (called from the survivor loop instead of the legacy clinic visit) ----
  campaignCare(s, stats, dt) {
    if (s.care) {
      const b = this.aidStations.find(b => b.id === s.careAt);
      if (!b || this.healed(s)) return this.leaveCare(s, !!b);
      if (s.care === 'seek') {
        const spot = this.goalFor(s, b);
        if (!spot) return this.leaveCare(s);
        if (this.travel(s, spot, stats.speed, dt)) s.care = 'waiting';
        s.task = 'to-aid-station';
        return true;
      }
      s.task = this.stationMedic(b, s) && this.onDuty(this.stationMedic(b, s)) ? 'in-treatment' : 'awaiting-medic';
      if (!this.stationMedic(b, s)) this.campaignAlert('UI_NO_MEDIC');
      return true;
    }
    // A posted medic treats themselves at their station instead of taking the bed.
    if (!this.needsCare(s) || s.fighting || (s.role === 'medic' && s.post != null) || !this.sceneSafe(s)) return false;
    const b = this.freeBedFor(s);
    if (!b) return false;
    Object.assign(s, { care: 'seek', careAt: b.id, goalKey: '', camp: null, harvest: s.harvest?.phase === 'toPile' ? s.harvest : undefined });
    this.dismount(s);
    return true;
  }
  leaveCare(s, recovered = false) {
    if (recovered) this.notify(s.name + ' is back on duty', 'Treatment complete.', 'good');
    Object.assign(s, { care: null, careAt: null, goalKey: '' });
    return false;
  }

  // ---- The medic's shift at an Aid Station ----
  // Treats the bed's patient (+8 HP and −2 infection per patient-hour, a supply per 4 patient-hours), dressing
  // a bleed first; with nobody in the bed, a hurt medic treats themselves at half speed.
  // One Medic treats every bed of their station at once; each patient-hour draws on the supplies.
  medicDuty(s, post, stats, dt) {
    const patients = this.survivors.filter(p => p.care === 'waiting' && p.careAt === post.id && p !== s);
    const self = !patients.length && this.needsCare(s) ? s : null, treated = patients.length ? patients : self ? [self] : [];
    if (!treated.length) { this.standBy(s, post, stats.speed, dt); if (s.task === 'standby') s.task = 'on-call'; return; }
    if (!this.atSite(s, post)) { const spot = this.goalFor(s, post); if (spot) this.travel(s, spot, stats.speed, dt); s.task = 'to-aid-station'; return; }
    const hours = dt / HOUR_SECONDS * (self ? H.selfTreatRate : 1), rate = TREAT_HP_PER_HOUR[campaignIdOf(post.type)] || TREAT_HP_PER_HOUR.aid_station;
    // Supplies are drawn at the start of each four patient-hours.
    if (!(post.supplyCredit > 0)) {
      if (this.available('medical_supplies') < 1) { s.task = 'no-supplies'; this.campaignAlert('UI_NO_SUPPLIES'); return; }
      this.resources.medical_supplies -= 1;
      post.supplyCredit = (post.supplyCredit || 0) + H.suppliesPerPatientHours;
    }
    post.supplyCredit -= hours * treated.length;
    for (const who of treated) {
      if (who.bleeding && this.campaign.stock.bandage > 0) { this.campaign.stock.bandage--; who.bandageAt = this.elapsed; this.dress(who, BANDAGE_HP, 'a bandage from ' + s.name); }
      who.hp = Math.min(campaignMaxHp(who), who.hp + rate * hours);
      if (who.infection > 0) { who.infection = Math.max(0, who.infection + H.infectionTreatedPerHour * hours); who.treatedAt = this.elapsed; }
    }
    const who = treated[Math.floor(this.elapsed / 3) % treated.length];
    s.task = self ? 'self-treating' : 'healing';
    s.facing = who.x < s.x ? -1 : who.x > s.x ? 1 : s.facing;
    s.fxTimer = (s.fxTimer || 0) - dt;
    if (s.fxTimer <= 0) { s.fxTimer = .4; this.effects.push({ type: 'heal', x: who.x, y: who.y - 14, life: .7, maxLife: .7 }); }
    for (const p of patients) if (this.healed(p)) this.leaveCare(p, true);
  }

  // ---- Rescue: 0.25 labor-hours to lift a downed survivor, then a carry at half speed to a medical bed ----
  // Delivery stabilizes them at once. With no Aid Station standing at all, they are stabilized where they lie.
  campaignRescue(s, stats, dt) {
    const d = this.survivors.find(x => x.id === s.rescue);
    if (!d || d.condition !== 'downed' || d.rescuer !== s.id) { if (d?.carriedBy === s.id) d.carriedBy = null; s.rescue = null; return false; }
    if (d.carriedBy !== s.id) {
      if (!this.sceneSafe(d)) { d.stabilizing = false; s.task = 'waiting-safe'; return true; }
      if (distance(s, d) > 14) { this.travel(s, d, stats.speed * 1.15, dt); s.task = 'to-rescue'; return true; }
      d.stabilizing = true;
      d.lift = (d.lift || 0) + dt / HOUR_SECONDS / H.rescueLaborHours;
      s.task = 'lifting';
      if (d.lift < 1) return true;
      d.lift = 0; d.carriedBy = s.id; s.path = []; s.goalKey = '';
    }
    // A bed that is free, or held by someone less hurt than a downed survivor.
    const bed = this.aidStations.filter(b => this.bedFree(b) || this.bedOccupants(b).some(p => p.condition !== 'downed' && p !== d)).sort((a, b) => (!!this.stationMedic(b) - !!this.stationMedic(a)) || distance(s, a) - distance(s, b))[0];
    if (!bed) { this.stabilize(d, s, null); return true; }
    const spot = this.goalFor(s, bed);
    const there = !spot || this.travel(s, spot, stats.speed * H.carrySpeed, dt);
    d.x = s.x + 5 * s.facing; d.y = s.y - 2;
    s.task = 'carrying-patient';
    if (there) this.stabilize(d, s, bed);
    return true;
  }
  stabilize(d, rescuer, bed) {
    const bumped = bed && !this.bedFree(bed) && this.bedOccupants(bed).find(p => p !== d && p.condition !== 'downed');
    if (bumped) Object.assign(bumped, { care: null, careAt: null });
    // Stabilizing stops the bleeding along with everything else.
    Object.assign(d, { condition: 'injured', hp: Math.max(1, d.hp), bleeding: false, bleed: null, lift: 0, stabilizing: false, rescuer: null, carriedBy: null, lastHit: this.elapsed });
    if (bed) Object.assign(d, { care: 'waiting', careAt: bed.id });
    rescuer.rescue = null;
    this.notify(d.name + ' stabilized', bed ? `${rescuer.name} carried them to the Aid Station.` : `${rescuer.name} stabilized them where they fell. There is no medical bed to carry them to.`, 'good');
  }

  // ---- Deaths are recorded with CentroCom; Mara writes after the first ----
  recordLoss(s) {
    const sc = this.campaign.scripted;
    this.message(CENTROCOM, 'Personnel loss: ' + s.name, fill(CAMPAIGN.strings.ui_death, { survivorName: s.name }).replace(/^PERSONNEL LOSS \/ /, '') + '\n\n' + copy('centrocom_loss_msg'), 'warn');
    if (!sc.losses) this.message(MARA, 'Private channel', copy('mara_first_loss_msg'));
    sc.losses = (sc.losses || 0) + 1;
  }
}
