// The state and behaviour of Assets/Afterlife/Scripts/GameHud.cs. The Unity HUD built UI Toolkit
// elements imperatively; here the same state lives in this store and the React components in this
// folder render it. Methods keep GameHud's names so the host code reads like AfterlifeGame.cs.
import { SaveStore } from '../host/saveStore.js';
import { audio } from '../host/audio.js';
import { customOf } from '../engine/worldgen.mjs';

const pad2 = n => String(Math.floor(n)).padStart(2, '0');
// New Game is the AfterLife campaign: its difficulties and map sizes, in the order the setup shows them.
export const DIFFICULTIES = ['standard', 'assisted', 'severe'];
export const MAP_SIZES = ['compact', 'standard', 'large'];
// Setup steps: deployment settings, regional assignment, the recruitment letter, then the acceptance notice.
export const SETUP = { settings: 0, region: 1, letter: 2, accepted: 3 };
const randomSeed64 = () => String((BigInt(Math.floor(Math.random() * 2 ** 32)) << 32n) | BigInt(Math.floor(Math.random() * 2 ** 32)));

export class HudStore {
  constructor(game) {
    this.game = game;
    this.version = 0;
    this.listeners = new Set();
    this.modal = null; // { kind, ...props } for the backdrop dialog
    this.selected = -1;
    this.inspectorBuildingTab = 'staff';
    this.candidatePickerOpen = false;
    this.selectedCrewSurvivorId = -1;
    this.currentCrewTab = 'roster';
    this.rosterFilter = 'all';
    this.expandedCrewSurvivors = new Set();
    this.expandedSurvivorSubTabs = new Map();
    this.journal = []; // This session's notifications: the event log on the tablet's journal tab.
    this.tabletTab = 'quests';
    this.buildFilter = 'ALL';
    this.party = new Set();
    this.trip = 'woodland';
    this.lastIncoming = '';
    // Notifications collect behind the clock card's bell: an unread count, a pulse while one is new,
    // and a popover listing the latest.
    this.unreadNotices = 0;
    this.noticePulseUntil = 0;
    this.noticesOpen = false;
    this.hint = '';
    this.rosterCollapsed = false;
    this.isStartScreenOpen = false;
    this.startMenuIndex = 0;
    this.setupStep = -1;
    this.setupIndex = 1;
    this.selectedMapIndex = 1;
    this.selectedDifficulty = 'standard';
    this.setupDescriptionOverride = '';
    this.seedText = ''; // Blank means a random region.
    this.overseerName = '';
    this.pendingSeed = null; // The seed the letter was signed for; settled when the region step is left.
    this.letterRead = false;
    this.deployIntro = null; // { title } while the region fades in after deployment
    this.tabletPulse = false; // The SeerPad pulses after the welcome until it is opened.
    this.messageChannel = 'all'; // The campaign inbox's thread filter: all, official (CentroCom) or private (Mara).
    this.forecastOpen = false;
    this.worldLoading = null; // { progress, activity }
    this.closed = false;
    this.customOn = false;
    this.custom = customOf();
    this.water = { rivers: true, lakes: true, ponds: true, swamps: true, lighthouse: true };
  }

  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getVersion = () => this.version;
  bump() { this.version++; for (const listener of this.listeners) listener(); }

  get isWorldLoading() { return !!this.worldLoading; }
  get isNewGameSetupOpen() { return this.setupStep >= 0; }
  get modalOpen() { return !!this.modal || this.isStartScreenOpen; }

  tick(now) {
    this.now = now;
    if (this.noticePulseUntil && now > this.noticePulseUntil) { this.noticePulseUntil = 0; this.bump(); }
  }

  // ---- Live refresh (GameHud.Refresh) ---------------------------------------------------------
  refresh() {
    const f = this.game.frame, d = this.game.data;
    if (!f || !d) return;
    if (f.incoming) {
      if (!this.lastIncoming) { audio.playAlarm(); audio.playZombieGroan(); }
    }
    this.lastIncoming = f.incoming;
    for (const ev of d.events || []) this.notify(ev.title, ev.message);
    d.events = [];
    if (this.selected >= 0 && !f.entities.some(e => e.id === this.selected)) this.showInspector(-1);
    this.bump();
  }

  notify(title, message) {
    const f = this.game.frame;
    const stamp = f ? `Day ${f.day} · ${pad2(f.hour)}:${pad2(f.hour % 1 * 60)} · ` : '';
    this.journal.push({ title: stamp + title, message });
    if (this.journal.length > 100) this.journal.shift();
    if (!this.noticesOpen) this.unreadNotices++;
    this.noticePulseUntil = (this.now ?? performance.now() / 1000) + 8;
    this.bump();
  }

  toggleNotices() {
    this.noticesOpen = !this.noticesOpen;
    this.unreadNotices = 0;
    this.noticePulseUntil = 0;
    this.bump();
  }

  setHint(text) {
    if (this.hint === text) return;
    this.hint = text;
    this.bump();
  }

  // ---- Dialogs --------------------------------------------------------------------------------
  open(kind, props = {}) {
    this.modal = { kind, ...props };
    this.bump();
  }

  closeModal() {
    this.modal = null;
    this.bump();
  }

  // Which tablet screen is showing, or '' when the tablet is closed.
  get tabletScreen() { return this.modal?.kind === 'tablet' ? this.modal.tab : ''; }
  get isCrewOpen() { return this.tabletScreen === 'crew'; }

  confirm(title, message, action) { this.open('confirm', { title, message, action }); }
  setBuildFilter(filter) { this.buildFilter = filter; this.bump(); }
  toggleRoster() { this.rosterCollapsed = !this.rosterCollapsed; this.bump(); }
  setInspectorBuildingTab(tab) { this.inspectorBuildingTab = tab; this.bump(); }
  toggleCandidatePicker(open = !this.candidatePickerOpen) { this.candidatePickerOpen = open; this.bump(); }
  setRosterFilter(filter) { this.rosterFilter = filter; this.showCrew(this.selectedCrewSurvivorId, 'roster'); }
  setCrewTab(tab) { this.currentCrewTab = tab; this.showCrew(this.selectedCrewSurvivorId, tab); }
  setDossierTab(id, tab) { this.expandedSurvivorSubTabs.set(id, tab); this.showCrew(this.selectedCrewSurvivorId, 'roster'); }
  dossierTab(id) { return this.expandedSurvivorSubTabs.get(id) || 'stats'; }
  collapseDossier(id) { this.expandedCrewSurvivors.delete(id); this.showCrew(id, 'roster'); }
  // The overseer's tablet, open at a screen; Tab toggles it. Every menu the dock opens is a screen.
  showTablet(tab = this.tabletTab) { this.tabletTab = tab; this.tabletPulse = false; this.open('tablet', { tab }); }
  // A hotkey opens its screen, or closes the tablet when that screen is already showing.
  toggleScreen(tab) {
    if (this.tabletScreen === tab) this.closeModal();
    else if (!this.modal || this.modal.kind === 'tablet') ({ crew: () => this.showCrew(), construction: () => this.showBuild(), expeditions: () => this.showExpeditions() }[tab] || (() => this.showTablet(tab)))();
  }
  showBuild() { this.buildFilter = 'ALL'; this.showTablet('construction'); }
  markMessagesRead() {
    this.game.simulation.command('readMessages');
    this.game.data = this.game.simulation.readHud();
    this.bump();
  }
  toggleTablet() { if (this.modal?.kind === 'tablet') this.closeModal(); else if (!this.modal) this.showTablet(); }
  showRecruitment() { this.currentCrewTab = 'gate'; this.showTablet('crew'); }
  showStockpile() { this.showTablet('stockpile'); }
  showJournal() { this.noticesOpen = false; this.unreadNotices = 0; this.showTablet('journal'); }
  // Over the title screen the menu is its own dialog; in a run it is the tablet's settings.
  showMenu() { if (this.isStartScreenOpen) this.open('menu'); else this.showTablet('settings'); }
  showOutcome() { this.open('outcome'); }
  showCustomGameSetup() { this.open('custom'); }
  showImport(message = '') { this.open('import', { message }); }
  showAdmin() { this.showTablet('admin'); }

  async showLicenses() {
    this.open('licenses', { text: 'Loading...' });
    const text = await fetch('unity/ThirdPartyNotices.txt').then(r => r.text()).catch(error => 'Could not load the notices: ' + error.message);
    if (this.modal?.kind === 'licenses') this.open('licenses', { text });
  }

  showInspector(id) {
    this.selected = id;
    this.bump();
  }

  refreshInspector() { this.bump(); }

  showCrew(initialSurvivorId = -1, targetTab = null) {
    const survivors = (this.game.frame?.entities || []).filter(e => e.kind === 'survivor');
    if (initialSurvivorId >= 0 && survivors.some(s => s.id === initialSurvivorId)) {
      this.selectedCrewSurvivorId = initialSurvivorId;
      this.expandedCrewSurvivors.add(initialSurvivorId);
      this.currentCrewTab = targetTab === 'dossier' || targetTab == null ? 'roster' : targetTab;
    } else if (targetTab != null) {
      this.currentCrewTab = targetTab === 'dossier' ? 'roster' : targetTab;
    }
    if (this.selectedCrewSurvivorId < 0 && survivors.length > 0) this.selectedCrewSurvivorId = survivors[0].id;
    this.showTablet('crew');
  }

  toggleCrewExpansion(id) {
    this.selectedCrewSurvivorId = id;
    if (!this.expandedCrewSurvivors.delete(id)) this.expandedCrewSurvivors.add(id);
    this.showCrew(this.selectedCrewSurvivorId, 'roster');
  }

  openDossier(id, subTab = 'duties') {
    this.selectedCrewSurvivorId = id;
    this.expandedCrewSurvivors.add(id);
    this.expandedSurvivorSubTabs.set(id, subTab);
    this.currentCrewTab = 'roster';
    this.showCrew(id, 'roster');
  }

  showPoiExpedition(poiId) {
    this.trip = 'poi:' + poiId;
    this.party.clear();
    this.showExpeditions();
  }

  showExpeditions() {
    const catalog = this.game.catalog;
    const known = catalog.expeditions.some(e => e.id === this.trip) || (catalog.pois || []).some(p => String(p.id) === this.trip);
    if (!known && catalog.expeditions.length > 0) this.trip = catalog.expeditions[0].id;
    this.showTablet('expeditions');
  }

  chooseTrip(id) { this.trip = id; this.party.clear(); this.bump(); }
  toggleParty(id) { if (!this.party.delete(id)) this.party.add(id); this.bump(); }

  clearJournal() {
    this.journal = [];
    this.party.clear();
    this.lastIncoming = '';
    this.unreadNotices = 0;
    this.noticePulseUntil = 0;
    this.noticesOpen = false;
    this.hint = '';
    this.bump();
  }

  // ---- Title screen, new game setup and world loading -----------------------------------------
  showStartScreen() {
    this.worldLoading = null;
    this.setupStep = -1;
    this.isStartScreenOpen = true;
    this.modal = null;
    this.game.paused = true;
    this.startMenuIndex = 0;
    this.bump();
  }

  hideStartScreen() {
    this.setupStep = -1;
    this.isStartScreenOpen = false;
    this.game.paused = false;
    this.game.speed = 1;
    this.bump();
  }

  setStartMenuSelection(index) { this.startMenuIndex = Math.min(3, Math.max(0, index)); this.bump(); }
  selectPreviousStartMenuItem() {
    if (this.isNewGameSetupOpen) this.setSetupSelection((this.setupIndex + 2) % 3);
    else this.setStartMenuSelection((this.startMenuIndex + 3) % 4);
  }
  selectNextStartMenuItem() {
    if (this.isNewGameSetupOpen) this.setSetupSelection((this.setupIndex + 1) % 3);
    else this.setStartMenuSelection((this.startMenuIndex + 1) % 4);
  }
  activateCurrentStartMenuItem() {
    if (this.isNewGameSetupOpen) { this.advanceNewGameSetup(); return; }
    [() => this.startNewGame(), () => this.continueGame(), () => this.showMenu(), () => this.game.quit()][this.startMenuIndex]();
  }

  startNewGame() {
    this.selectedDifficulty = 'standard';
    this.pendingSeed = null;
    this.showSetupStep(SETUP.settings);
  }

  // A new refuge from inside a run (outcome screen, settings) goes through the same setup and world generator as the title screen.
  beginNewRefuge() {
    this.showStartScreen();
    this.startNewGame();
  }

  continueGame() {
    if (!SaveStore.hasSave) { this.startNewGame(); return; }
    this.hideStartScreen();
    this.notify('Refuge Resumed', `Day ${this.game.frame?.day ?? 1} · Stay vigilant.`);
  }

  showSetupStep(step) {
    this.setupStep = step;
    this.setupDescriptionOverride = '';
    this.setupIndex = step === SETUP.settings ? DIFFICULTIES.indexOf(this.selectedDifficulty) : step === SETUP.region ? this.selectedMapIndex : 0;
    if (step === SETUP.letter) this.letterRead = false;
    this.bump();
  }

  // A seed is any text up to 64 characters: a whole number up to 2^64 - 1 is used as it is, anything else
  // is hashed (engine/seed.mjs). Changing it lets the next letter settle a new one.
  setSeedText(text) {
    this.seedText = [...String(text).replace(/[\u0000-\u001f\u007f]/g, '')].slice(0, 64).join('');
    this.pendingSeed = null;
    this.bump();
  }
  randomizeSeed() { this.setSeedText(randomSeed64()); }
  // The Overseer's name for official correspondence: 1-24 characters, any script.
  setOverseerName(text) {
    this.overseerName = [...String(text).replace(/[\u0000-\u001f\u007f<>]/g, '')].slice(0, 24).join('');
    this.bump();
  }
  // The recruitment letter's I AGREE unlocks once it has been read to the end.
  markLetterRead() { if (!this.letterRead) { this.letterRead = true; this.bump(); } }

  setSetupSelection(index) {
    if (this.setupStep > SETUP.region) return;
    const max = this.setupStep === SETUP.settings ? DIFFICULTIES.length - 1 : MAP_SIZES.length - 1;
    this.setupIndex = Math.min(max, Math.max(0, index));
    this.bump();
  }
  chooseSetupOption(index) { this.setSetupSelection(index); this.advanceNewGameSetup(); }

  setCustomOn(on) { this.customOn = !!on; this.bump(); }
  toggleCustomOn() { this.customOn = !this.customOn; this.bump(); }
  toggleWater(key) { this.water = { ...this.water, [key]: !this.water[key] }; this.bump(); }
  setCustomSlider(key, val) { this.custom = { ...this.custom, [key]: Number(val) }; this.bump(); }
  toggleCustomType(type) {
    const types = { ...this.custom.types };
    const enabled = Object.values(types).filter(Boolean).length;
    if (types[type] && enabled <= 1) return;
    types[type] = !types[type];
    this.custom = { ...this.custom, types };
    this.bump();
  }
  toggleCustomFeature(feat) {
    this.custom = { ...this.custom, [feat]: !this.custom[feat] };
    this.bump();
  }
  applyCustomPreset(preset) {
    this.custom = { ...this.custom, ...preset };
    this.bump();
  }
  resetCustom() {
    this.custom = customOf();
    this.water = { rivers: true, lakes: true, ponds: true, swamps: true, lighthouse: true };
    this.bump();
  }

  advanceNewGameSetup() {
    if (this.worldLoading) return;
    const step = this.setupStep;
    if (step === SETUP.settings) {
      // CentroCom needs a name for the paperwork.
      if (!this.overseerName.trim()) { this.setupDescriptionOverride = 'Enter your name (1-24 characters). CentroCom will not process an anonymous Overseer.'; this.bump(); return; }
      this.selectedDifficulty = DIFFICULTIES[this.setupIndex];
      this.showSetupStep(SETUP.region);
    } else if (step === SETUP.region) {
      this.selectedMapIndex = this.setupIndex;
      // The seed is settled here, so rereading the letter or going back never rolls a different region.
      this.pendingSeed ??= this.seedText.trim() || randomSeed64();
      this.showSetupStep(SETUP.letter);
    } else if (step === SETUP.letter) {
      if (this.letterRead) this.showSetupStep(SETUP.accepted);
    } else if (step === SETUP.accepted) {
      this.launchCampaign();
    }
  }
  campaignSettings() {
    return {
      difficulty: this.selectedDifficulty, mapSize: MAP_SIZES[this.selectedMapIndex], overseerName: this.overseerName.trim() || 'Overseer', seed: this.pendingSeed,
      world: { ...this.water, ...(this.customOn ? { custom: this.custom } : {}) },
    };
  }
  launchCampaign() {
    this.game.save();
    this.beginWorldLoading();
    this.game.startCampaignWithLoading(this.campaignSettings());
  }

  backFromNewGameSetup() {
    if (this.setupStep > SETUP.settings) this.showSetupStep(this.setupStep === SETUP.accepted ? SETUP.region : this.setupStep - 1);
    else { this.setupStep = -1; this.startMenuIndex = 0; this.bump(); }
  }

  beginWorldLoading() {
    this.setupStep = -1;
    this.worldLoading = { progress: 0, activity: 'Selecting regional assignment...' };
    this.bump();
  }

  // The camp has landed: the region fades in over two seconds under its title, then the SeerPad pulses.
  finishDeployment(regionId) {
    this.worldLoading = null;
    this.hideStartScreen();
    this.deployIntro = { title: `REGION ${regionId} / DAY 1 / 07:00` };
    this.tabletPulse = false;
    this.bump();
  }
  endDeployIntro() { this.deployIntro = null; this.tabletPulse = true; this.bump(); }

  updateWorldLoading(progress, activity) {
    this.worldLoading = { progress: Math.min(1, Math.max(0, progress)), activity };
    this.bump();
  }

  finishWorldLoading(size, difficulty, seed) {
    this.worldLoading = null;
    this.hideStartScreen();
    this.notify('New Refuge Established', size.toUpperCase() + ' world · ' + difficulty.toUpperCase() + ' difficulty' + (seed ? ' · seed ' + seed : '') + '. Survive 24 days.');
  }

  failWorldLoading(message) {
    this.worldLoading = null;
    this.showSetupStep(SETUP.region);
    this.setupDescriptionOverride = 'World generation failed. ' + message;
    this.bump();
  }

  showClosed() {
    this.closed = true;
    this.bump();
  }
}
