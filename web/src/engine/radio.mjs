// Campaign recruitment by Radio Kit (P1-08): a broadcast costs 2 Food and half an hour of an operator's
// time, then a 24-hour cooldown. A candidate may answer 4-8 hours later; accepting needs a free bed and a
// day's Food for the larger camp, and the recruit walks in along a safe road. Rejecting costs nothing.
// Installed onto Game.prototype by model.mjs.
import { CAMPAIGN, CENTROCOM, campaignIdOf, fill } from './campaignState.mjs';
import { campaignMaxHp } from './crew.mjs';
import { HOUR_SECONDS, distance } from './data.mjs';

const R = CAMPAIGN.tuning.recruitment;
// The first Phase 1 recruit is guaranteed sound: Quality 16 or better.
const FIRST_RECRUIT_QUALITY = 16, OFFER_HOURS = 24, WALK_IN_TILES = 32;

export class Radio {
  get radioKit() { return this.buildings.find(b => campaignIdOf(b.type) === 'radio_kit' && this.operational(b)) || null; }
  // Why a broadcast can't start now, or ''.
  broadcastBlock() {
    const r = this.campaign?.radio;
    if (!r) return 'Not available';
    if (!this.radioKit) return 'Build a Radio Kit';
    if (r.broadcast) return 'Broadcasting';
    if (r.pending) return 'Waiting for replies';
    const ready = r.lastBroadcastAt == null ? 0 : r.lastBroadcastAt + (this.radioRelay ? R.relayCooldownHours : R.cooldownHours) * HOUR_SECONDS - this.elapsed;
    if (ready > 0) return `Next broadcast in ${(ready / HOUR_SECONDS).toFixed(1)}h`;
    if (this.available('food') < R.broadcastFood) return `Needs ${R.broadcastFood} Food`;
    return '';
  }
  broadcast() {
    if (this.status !== 'playing' || this.broadcastBlock()) return false;
    this.resources.food -= R.broadcastFood;
    this.campaign.radio.broadcast = { radio: this.radioKit.id, progress: 0 };
    this.notify('Broadcast scheduled', `${R.broadcastFood} Food set aside for the offer. An operator will spend half an hour on the radio.`, 'good');
    return true;
  }
  // Whoever is free and best with people takes the radio.
  assignOperator() {
    const b = this.campaign?.radio?.broadcast;
    if (!b || this.sheltering || this.survivors.some(s => s.camp?.kind === 'radio')) return;
    const pick = this.survivors.filter(s => !s.camp && this.campWorker(s)).sort((p, q) => q.stats.cha - p.stats.cha || p.id - q.id)[0];
    if (pick) { pick.camp = { kind: 'radio', id: b.radio }; pick.path = []; pick.pathVersion = -1; }
  }
  radioWork(s, stats, dt) {
    const r = this.campaign.radio, kit = r.broadcast && this.buildings.find(b => b.id === r.broadcast.radio && this.operational(b));
    if (!kit) { s.camp = null; if (r.broadcast) r.broadcast = null; return false; }
    if (!this.atSite(s, kit)) {
      const spot = this.goalFor(s, kit);
      if (!spot) { s.camp = null; return false; }
      this.travel(s, spot, stats.speed, dt); s.task = 'to-radio';
      return true;
    }
    r.broadcast.progress = Math.min(1, r.broadcast.progress + dt / HOUR_SECONDS / R.broadcastHours);
    s.task = 'broadcasting'; s.facing = kit.x < s.x ? -1 : 1;
    if (r.broadcast.progress >= 1) { s.camp = null; this.finishBroadcast(s); }
    return true;
  }
  // The first broadcast always reaches someone; later ones succeed at the difficulty's rate.
  finishBroadcast(operator) {
    const r = this.campaign.radio, first = r.broadcasts === 0;
    // A working Radio Relay answers sooner and reaches more people.
    const relay = !!this.radioRelay;
    const chance = Math.min(R.successCap, (CAMPAIGN.difficulties[this.campaign.settings.difficulty] || CAMPAIGN.difficulties.standard).recruitChance + (relay ? R.relaySuccessBonus : 0));
    const [lo, hi] = relay ? R.relayArrivalHours : R.arrivalHours;
    if (relay) this.story.relayBroadcasts++;
    r.broadcast = null; r.lastBroadcastAt = this.elapsed; r.broadcasts++;
    r.pending = { at: this.elapsed + (lo + this.random() * (hi - lo)) * HOUR_SECONDS, success: first || this.random() < chance, qualityMin: first ? FIRST_RECRUIT_QUALITY : 0 };
    this.recordInteraction('finish_broadcast');
    this.message(CENTROCOM, 'Broadcast complete', fill(CAMPAIGN.strings.broadcast_done, { operatorName: operator.name, minHours: lo, maxHours: hi }));
  }
  radioTick() {
    const c = this.campaign;
    if (!c) return;
    this.assignOperator();
    this.keepCrewContacts();
    const p = c.radio.pending;
    if (p && this.elapsed >= p.at) {
      c.radio.pending = null;
      if (!p.success) this.campaignAlert('UI_RECRUIT_MISS');
      else {
        const cand = this.createCandidate('radio', { qualityMin: p.qualityMin }, true);
        cand.expiresAt = this.elapsed + OFFER_HOURS * HOUR_SECONDS;
        const t = CAMPAIGN.tasks.find(t => t.id === 'p1_08');
        this.message(cand.name + ' (radio)', 'Reply to your broadcast', t.copy.candidateResponse, 'good', { kind: 'candidate', id: cand.id });
        this.campaignAlert('UI_CANDIDATE_WAIT');
      }
    }
    for (const cand of this.candidates.filter(x => this.elapsed >= x.expiresAt)) this.message(CENTROCOM, cand.name + ' moved on', fill(CAMPAIGN.strings.candidate_expired, { candidateName: cand.name }));
    this.candidates = this.candidates.filter(x => this.elapsed < x.expiresAt);
  }
  // Why a candidate can't be accepted, or ''.
  acceptBlock() {
    const pop = this.survivors.length;
    if (this.capacity - pop <= 0) return 'No free bed';
    const need = (pop + 1) * CAMPAIGN.tuning.food.perPersonPerDay;
    if (this.available('food') < need) return `Needs ${Math.ceil(need)} Food (a day for ${pop + 1})`;
    return '';
  }
  acceptRecruit(id) {
    const cand = this.candidates.find(c => c.id === id);
    if (this.status !== 'playing' || !cand) return false;
    this.recordInteraction('review_candidate');
    const block = this.acceptBlock();
    if (block) { this.campaignAlert(block === 'No free bed' ? 'UI_NO_BED' : 'UI_FOOD_LOW', { foodDays: (this.available('food') / Math.max(1, this.dailyFoodDemand)).toFixed(1) }); return false; }
    this.candidates = this.candidates.filter(c => c !== cand);
    const s = this.addSurvivor('any', cand);
    // They walk in from a road beyond the perimeter, ignored by the infected until they reach camp.
    const from = this.outerPoint(Math.min(WALK_IN_TILES, (this.campaign.region?.localRadius || 512) / 16), this.campaign.region?.corridor?.points?.[0] || null);
    Object.assign(s, from, { arriving: true, hp: campaignMaxHp(s) });
    this.equipAll();
    this.notify(s.name + ' accepted', 'They are walking in. A bed is waiting.', 'good');
    return s;
  }
  declineRecruit(id) {
    const before = this.candidates.length;
    this.candidates = this.candidates.filter(c => c.id !== id);
    if (this.candidates.length === before) return false;
    this.recordInteraction('review_candidate');
    this.campaignAlert('UI_RECRUIT_REJECT');
    return true;
  }
  // A recruit on the road heads for the campfire and counts once inside the perimeter's heart.
  walkInTick(s, stats, dt) {
    const fire = this.core, spot = fire && this.goalFor(s, fire);
    const home = !fire || distance(s, fire) < (this.campaign.region?.protectedRadius || 288) * .5;
    if (!home && spot && !this.travel(s, spot, stats.speed, dt)) { s.task = 'walking-in'; return true; }
    s.arriving = false;
    this.campaign.recruitedCount++;
    if (this.progress?.tally) this.progress.tally.recruited++;
    this.message(CENTROCOM, s.name + ' arrived', fill(CAMPAIGN.strings.recruit_arrived, { survivorName: s.name, population: this.survivors.length }), 'good');
    return false;
  }
}
