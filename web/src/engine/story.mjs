// Campaign Phase 2's story (P2-09 ... P2-11): the authored expeditions E01-E03 to their story sites, each with an
// encounter card that holds the team (and, in the HUD, the game) until the Overseer chooses; the unique relay
// keycard and battery tokens; E01's reveal of the depot and relay sites; the maintenance crew from E02 as
// candidates or, without beds for them, safe standing contacts; and the Radio Relay, which takes the battery
// and speeds up recruitment and migration warnings. A team out on an expedition is an ordinary mission
// (operations.mjs) with provisions and an encounter. Installed onto Game.prototype by model.mjs.
import { CAMPAIGN, CENTROCOM, MARA, campaignIdOf } from './campaignState.mjs';
import { HOUR_SECONDS } from './data.mjs';

const CREW_OFFER_HOURS = 72, CONTACT_INVITE_HOURS = 24;

export class Story {
  get story() { return this.campaign.story; }
  // ---- Which expeditions can go ----
  expeditionDone(e) { return !!this.story.done[e]; }
  // E03 again, safely and in two hours, when the relay's battery was lost with the relay.
  batteryRecovery() { return this.story.tokens.relay_battery === 'lost'; }
  storyOpen(e) {
    const def = CAMPAIGN.expeditions[e], rec = this.siteRecord(def?.site);
    return !!def && !!rec?.revealed && (this.taskUnlocked('expeditions', e) || this.freeBuild) && (!this.expeditionDone(e) || (e === 'e03' && this.batteryRecovery()));
  }
  storyBlock(e) {
    const def = CAMPAIGN.expeditions[e], rec = this.siteRecord(def?.site);
    if (!rec?.revealed) return 'Location unknown';
    if (this.expeditionDone(e) && !(e === 'e03' && this.batteryRecovery())) return 'Completed';
    if (!this.storyOpen(e)) return 'Not authorized yet';
    return '';
  }
  // Six to ten hours on site; a team without INT 5 needs two more for the technical work, never a hard stop.
  expeditionHours(e) { return e === 'e03' && this.batteryRecovery() ? CAMPAIGN.expeditions.e03.repeatSafeHours : CAMPAIGN.expeditions[e].siteWorkHours; }
  provisionBlock(e) {
    const def = CAMPAIGN.expeditions[e];
    for (const [r, n] of Object.entries(def.provisions || {})) if (this.available(r) < n) return `Needs ${n} ${CAMPAIGN.resources[r]?.name || r} in provisions`;
    for (const [k, n] of Object.entries(def.itemProvisions || {})) if ((this.campaign.stock[k] || 0) < n) return `Needs ${n} ${CAMPAIGN.items[k]?.name || k} in provisions`;
    return '';
  }
  // Provisions go with the team: ammunition set aside, kits taken from the medical stock. Unused, they come back.
  packExpedition(m, e) {
    const def = CAMPAIGN.expeditions[e];
    m.expedition = e;
    m.recovery = e === 'e03' && this.batteryRecovery();
    // What an expedition brings home is authored, not carried by the pound.
    m.capacity = 9999;
    m.provisionTx = Object.keys(def.provisions || {}).length ? this.reserve(def.provisions, 'expedition', e) : null;
    m.kits = def.itemProvisions?.first_aid_kit || 0;
    this.campaign.stock.first_aid_kit -= m.kits;
    m.encounter = null;
  }

  // ---- The encounter card ----
  openEncounter(m) {
    if (m.recovery) { m.encounter = { open: false, choice: null, result: 'A short, quiet search of the ruin.' }; return; }
    m.encounter = { open: true, choice: null, result: '' };
    const def = CAMPAIGN.expeditions[m.expedition];
    this.notify(def.encounter.title, def.name + ' · a decision is waiting.', 'warn');
  }
  get encounter() { const m = this.mission; return m?.encounter?.open ? { mission: m, def: CAMPAIGN.expeditions[m.expedition] } : null; }
  chooseEncounter(choiceId) {
    const m = this.mission, def = m && CAMPAIGN.expeditions[m.expedition], c = def?.encounter.choices.find(x => x.id === choiceId);
    if (!m?.encounter?.open || !c) return false;
    const team = m.team.map(id => this.survivors.find(s => s.id === id)).filter(Boolean);
    m.delay += c.addHours || 0;
    for (const [r, n] of Object.entries(c.grant || {})) m.cargo[r] = (m.cargo[r] || 0) + n;
    // A risky choice hurts one member; a First Aid Kit from the provisions halves it.
    if (c.injury && team.length) {
      const s = team[Math.floor(this.random() * team.length)], kit = m.kits > 0;
      const hp = kit ? c.injury.mitigatedHp : c.injury.hp;
      if (kit) m.kits--;
      s.hp = Math.max(1, s.hp - hp); s.lastHit = this.elapsed;
      m.injuries.push({ name: s.name, hp });
    }
    for (const [k, n] of Object.entries(c.consumeItems || {})) if (k === 'first_aid_kit') m.kits = Math.max(0, m.kits - n);
    // E02: the crew comes as candidates, or stays put as contacts. Either way the contact is made.
    if (m.expedition === 'e02') {
      this.story.crewContacted = true;
      const crew = [0, 1].map(() => this.createCandidate('radio', {}, false, 'Maintenance crew'));
      for (const x of crew) x.crew = true;
      if (c.candidates) for (const x of crew) { x.expiresAt = this.elapsed + CREW_OFFER_HOURS * HOUR_SECONDS; this.candidates.push(x); }
      else this.story.contacts.push(...crew);
    }
    m.encounter = { open: false, choice: c.id, result: c.result };
    this.message(CENTROCOM, def.encounter.title, c.result, '', { kind: 'report' });
    return true;
  }
  // What the expedition brings home besides the encounter's grant: its reward, tokens and, for E03, its blueprint.
  expeditionHaul(m) {
    const def = CAMPAIGN.expeditions[m.expedition];
    if (!m.recovery) for (const [r, n] of Object.entries(def.reward || {})) m.cargo[r] = (m.cargo[r] || 0) + n;
    m.tokens = m.recovery ? ['relay_battery'] : [...(def.tokens || [])];
  }
  // Home (or turned back): tokens, reveals and messages; unused provisions return.
  settleExpedition(m, how) {
    const def = CAMPAIGN.expeditions[m.expedition], st = this.story;
    if (m.provisionTx) this.releaseReservation(m.provisionTx);
    this.campaign.stock.first_aid_kit += m.kits || 0;
    if (how !== 'returned' || m.recalled || !m.tokens) return;
    for (const t of m.tokens) st.tokens[t] = 'held';
    st.done[m.expedition] = true;
    for (const id of def.reveals || []) { const r = this.siteRecord(id); if (r) r.revealed = true; }
    if ((def.reveals || []).length) this.landRevision++;
    if (m.expedition === 'e01') this.recordInteraction('launch_e01');
    if (def.blueprint && !this.campaign.unlocks.buildings.includes(def.blueprint)) this.campaign.unlocks.buildings.push(def.blueprint);
    if (m.recovery) this.notify('Relay battery recovered', 'Rebuild the Radio Relay to put it back to work.', 'good');
  }

  // ---- The maintenance crew as standing contacts ----
  inviteContact(id) {
    const x = this.story.contacts.find(c => c.id === id);
    if (!x) return false;
    this.story.contacts = this.story.contacts.filter(c => c !== x);
    x.expiresAt = this.elapsed + CONTACT_INVITE_HOURS * HOUR_SECONDS;
    this.candidates.push(x);
    this.notify(x.name + ' is on the way to talk', 'Their card is on the Recruitment screen. Beds and Food still apply.', 'good');
    return true;
  }
  // A crew candidate who isn't taken in goes back to being a contact rather than leaving.
  keepCrewContacts() {
    for (const x of this.candidates.filter(x => x.crew && this.elapsed >= x.expiresAt)) { this.candidates = this.candidates.filter(y => y !== x); this.story.contacts.push(x); }
  }

  // ---- The Radio Relay and its battery ----
  get radioRelay() { return this.buildings.find(b => campaignIdOf(b.type) === 'radio_relay' && this.operational(b)) || null; }
  // The relay's blueprint takes the battery; cancelling or demolishing gives it back; destruction loses it.
  relayPlaced(b) { if (campaignIdOf(b.type) === 'radio_relay') { this.story.tokens.relay_battery = 'installed'; b.battery = true; } }
  relayGone(b, destroyed) {
    if (campaignIdOf(b.type) !== 'radio_relay' || !b.battery) return;
    this.story.tokens.relay_battery = destroyed && !b.blueprint ? 'lost' : 'held';
    if (destroyed && !b.blueprint) this.message(MARA, 'Private channel', CAMPAIGN.strings.relay_lost_mara);
  }
  tokenBlock(type) { return campaignIdOf(type) === 'radio_relay' && this.story.tokens.relay_battery !== 'held' ? 'The Radio Relay needs the relay battery (E03).' : ''; }
  storyMetric(name) {
    const st = this.story;
    switch (name) {
      case 'maintenanceCrewContacted': return !!st.crewContacted;
      case 'hasBatteryToken': return ['held', 'installed'].includes(st.tokens.relay_battery);
      case 'radioKitOperational': return !!this.radioKit;
      case 'relayBroadcastFinished': return st.relayBroadcasts > 0;
      default: return undefined;
    }
  }
}
