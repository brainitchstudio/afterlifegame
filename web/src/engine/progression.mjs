// The overseer's progression: quests unlock the structures a camp can build, milestones raise the
// settlement's status from Camp to City and each new status unlocks better versions (upgrade tiers).
// Word of the base spreads as it grows, bringing survivors to the gate. The tablet reads all of it,
// plus the messages the overseer receives and the journal they keep. Installed onto Game.prototype by model.mjs.
import { BUILDINGS, BUILDING_TREES, HOUR_SECONDS, DAY_SECONDS, resourceLabel } from './data.mjs';
import { campaignIdOf, CAMPAIGN } from './campaignState.mjs';
import { TUNING as T } from './survivors.mjs';
// Quests and statuses are authored in the content studio (backend/dashboard).
import * as CONTENT from './gameContent.mjs';

// What the overseer is dropped in with.
export const STARTING_CACHE = { wood: 30, scrap_metal: 40, food: 90 };

// Objectives read the live settlement, so they can be met in any order and are shown as progress.
//   fell: trees felled   build: buildings of a type standing   staff: survivors in a role
//   survivors: population   day: day reached   kills: dead put down   upgrades: upgrades owned
//   land: parcels claimed beyond the first nine
// Quests run one at a time, in order. A quest waits until the settlement has its status (`rank`, an
// index into RANKS); `chapter` and `giver` place it in the story.
export const QUESTS = CONTENT.QUESTS;
export const QUEST_BY_ID = Object.fromEntries(QUESTS.map(q => [q.id, q]));
// Every structure a quest unlocks. Buildings no quest unlocks (fixtures, the HQ) need none.
export const QUEST_UNLOCKS = Object.fromEntries(QUESTS.flatMap(q => q.unlock.map(type => [type, q.id])));
export const ALL_UNLOCKED = () => Object.fromEntries(Object.keys(QUEST_UNLOCKS).map(type => [type, true]));

// Settlement status. Each rank's milestones must all be met, in order; a rank once earned is kept.
// `tier` is the deepest upgrade (the better versions of each structure) the rank allows.
export const RANKS = CONTENT.RANKS;
export const MAX_RANK = RANKS.length - 1;

// How deep an upgrade sits in its building's tree: 1 for a root node, 2 for one that requires it.
export function upgradeTier(type, node) {
  const tree = BUILDING_TREES[type] || [];
  let depth = 1, n = node;
  while (n?.requires) { n = tree.find(p => p.id === n.requires); depth++; }
  return depth;
}

const COMMAND = 'Regional Command', CAMP = 'Camp', GATE = 'The gate';
const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
export const OBJECTIVE_TEXT = {
  fell: n => `Fell ${plural(n, 'tree')}`,
  build: (n, x) => `Build ${n > 1 ? n + ' ' : 'a '}${BUILDINGS[x.type].name.toLowerCase()}${n > 1 ? 's' : ''}`,
  staff: (n, x) => `Post ${n > 1 ? n + ' ' : 'a '}${x.role}${n > 1 ? 's' : ''}`,
  survivors: n => `Reach ${n} survivors`,
  day: n => `Hold out until day ${n}`,
  kills: n => `Put down ${n} of the dead`,
  upgrades: n => `Own ${plural(n, 'upgrade')}`,
  land: n => `Claim ${plural(n, 'new parcel')} of land`,
};

export class Progression {
  // A fresh run. A camp starts at the beginning; the walled refuge scenario starts with it all.
  initProgress(complete = false) {
    this.progress = { quest: complete ? QUESTS.length : 0, rank: complete ? MAX_RANK : 0, tally: { felled: 0, recruited: 0 }, day: 0, noticed: {}, timer: 0 };
    this.unlocked = complete ? ALL_UNLOCKED() : {};
    this.messages = [];
    this.journal = [];
    this.nextMessageId = 1;
  }
  isUnlocked(type) {
    if (this.campaign) return this.freeBuild || this.taskUnlocked('buildings', campaignIdOf(type));
    return !QUEST_UNLOCKS[type] || !!this.unlocked?.[type];
  }
  // Why this upgrade can't be bought yet because of status, or ''.
  upgradeLock(type, node) {
    const tier = upgradeTier(type, node);
    if (this.freeBuild || tier <= RANKS[this.progress.rank].tier) return '';
    return 'Needs ' + RANKS.find(r => r.tier >= tier).name + ' status';
  }
  unlockAll() {
    if (this.campaign?.unlocks) {
      // Every structure, recipe, job and SeerPad module the campaign has.
      const u = this.campaign.unlocks, add = (kind, ids) => { for (const id of ids) if (!u[kind].includes(id)) u[kind].push(id); };
      add('buildings', Object.keys(CAMPAIGN.buildings)); add('recipes', Object.keys(CAMPAIGN.recipes)); add('jobs', Object.keys(CAMPAIGN.jobs));
      add('modules', ['crafting', 'defense', 'recruitment', 'operations', 'regional_intelligence']);
      this.landRevision++;
      this.notify('All structures unlocked', 'Every campaign structure, recipe and SeerPad module is authorized.', 'good');
      return true;
    }
    this.unlocked = ALL_UNLOCKED();
    this.progress.rank = MAX_RANK;
    this.notify('All structures unlocked', 'Every building and upgrade tier is available.', 'good');
    return true;
  }

  // ---- Objectives ----
  objectiveValue(x) {
    switch (x.kind) {
      case 'fell': return this.progress.tally.felled;
      case 'build': return this.buildings.filter(b => b.type === x.type).length;
      case 'staff': return this.survivors.filter(s => s.role === x.role).length;
      case 'survivors': return this.survivors.length;
      case 'day': return this.day;
      case 'kills': return this.kills;
      case 'upgrades': return this.buildings.reduce((n, b) => n + b.upgrades.length, 0);
      case 'land': return this.landBought;
      default: return 0;
    }
  }
  objectiveView(x) {
    const value = this.objectiveValue(x);
    return { text: OBJECTIVE_TEXT[x.kind](x.count, x), value: Math.min(value, x.count), count: x.count, done: value >= x.count };
  }
  get quest() { const q = QUESTS[this.progress.quest]; return q && q.rank <= this.progress.rank ? q : null; }

  // ---- Once a second: quests, status, the day's journal entry and gate prompts ----
  progressTick(dt) {
    const p = this.progress;
    p.timer -= dt;
    if (p.timer > 0) return;
    p.timer = 1;
    if (p.day !== this.day) { p.day = this.day; if (this.day > 1) this.dayEntry(); }
    for (let q = this.quest; q && q.objectives.every(x => this.objectiveValue(x) >= x.count); q = this.quest) this.completeQuest(q);
    while (p.rank < MAX_RANK && RANKS[p.rank + 1].milestones.every(x => this.objectiveValue(x) >= x.count)) this.earnRank(p.rank + 1);
    this.gatePrompts();
  }
  completeQuest(q) {
    const p = this.progress;
    p.quest++;
    for (const type of q.unlock) this.unlocked = { ...this.unlocked, [type]: true };
    this.depositAll(q.reward);
    const unlocked = q.unlock.map(t => BUILDINGS[t].name).join(', ');
    const rewards = Object.entries(q.reward).map(([r, n]) => `+${n} ${resourceLabel(r)}`).join(' · ');
    this.notify('Quest complete: ' + q.title, (unlocked ? unlocked + ' unlocked. ' : '') + rewards, 'good');
    this.message(COMMAND, 'Orders fulfilled: ' + q.title, (unlocked ? `Plans released: ${unlocked} can now be built. ` : '') + `Supplies released to you: ${rewards}.`, 'good');
    this.writeJournal(q.title, q.log);
    const next = QUESTS[p.quest];
    if (next && next.rank <= p.rank) this.message(COMMAND, 'New orders: ' + next.title, next.brief, '', { kind: 'quest' });
    else if (next) this.message(COMMAND, 'Orders pending', `Further orders are released when the camp reaches ${RANKS[next.rank].name} status. Check the milestones on your tablet.`);
  }
  earnRank(rank) {
    const r = RANKS[rank], p = this.progress;
    p.rank = rank;
    this.depositAll(r.reward);
    const rewards = Object.entries(r.reward).map(([k, n]) => `+${n} ${resourceLabel(k)}`).join(' · ');
    this.notify(r.name + ' status earned', r.blurb, 'good');
    this.message(COMMAND, `Status confirmed: ${r.name}`, `${r.blurb} A supply drop is on its way: ${rewards}.`, 'good', { kind: 'milestones' });
    this.writeJournal(r.name, r.log);
    const next = QUESTS[p.quest];
    if (next && next.rank === rank) this.message(COMMAND, 'New orders: ' + next.title, next.brief, '', { kind: 'quest' });
  }
  dayEntry() {
    const dead = this.kills, people = this.survivors.length;
    this.writeJournal('Day ' + this.day, `${plural(people, 'survivor')} at the ${RANKS[this.progress.rank].name.toLowerCase()}. ${dead} of the dead put down so far. ${Math.floor(this.resources.food)} food in store.`);
  }

  // ---- Word of the base and the survivors it brings ----
  // 0-100: grows with every order fulfilled, every step in status and the size of the place.
  get renown() {
    const p = this.progress, built = this.buildings.filter(b => !BUILDINGS[b.type].fixture && b.type !== 'barricade').length;
    return Math.min(100, p.quest * 5 + p.rank * 15 + built * 2);
  }
  // Walk-ups per game hour of daylight: none until word has got out (the gate is up), then more
  // the better known the base is.
  get arrivalRate() { const r = this.renown, R = T.recruitment; return r < R.walkUpMinRenown ? 0 : R.walkUpBase + r * R.walkUpPerRenown; }
  // What stops the settlement taking another survivor in, if anything: no bed, or not enough food.
  get shortage() {
    if (this.freeBeds <= 0) return 'beds';
    const rate = this.rates().food;
    if (this.resources.food < 20 + this.survivors.length * 6 || (rate < 0 && this.resources.food / -rate < DAY_SECONDS / 2)) return 'food';
    return '';
  }
  arrivalMessage(c) {
    const need = this.shortage;
    const body = need === 'beds' ? `${c.name} is asking to join, but there is no free bed. Build a bunkhouse (or add bunks) before they give up and move on.`
      : need === 'food' ? `${c.name} is asking to join, but food is short. Build more farms, or post farmers, before you take in another mouth.`
      : `${c.name} ${c.source === 'radio' ? 'answered your broadcast and is waiting at the gate' : `heard about the ${RANKS[this.progress.rank].name.toLowerCase()} and walked up to the gate`}. There is a bed for them.`;
    this.message(GATE, c.source === 'radio' ? 'Someone answered the radio' : 'A survivor at the gate', body, need ? 'warn' : 'good', { kind: 'candidate', id: c.id, need });
  }
  // While someone waits at the gate the overseer is reminded, once per shortage, what is missing.
  gatePrompts() {
    const n = this.progress.noticed, need = this.candidates.length ? this.shortage : '';
    if (need && !n[need]) {
      n[need] = true;
      if (need === 'beds') this.message(CAMP, 'Not enough housing', 'People are waiting at the gate and every bed is taken. Build a bunkhouse or upgrade one with bunk beds.', 'warn', { kind: 'build', type: 'dorm' });
      else this.message(CAMP, 'Not enough food', 'The stores cannot feed more mouths. Build more farms and post farmers before taking anyone else in.', 'warn', { kind: 'build', type: 'farm' });
    }
    if (need !== 'beds') n.beds = false;
    if (need !== 'food') n.food = false;
  }

  // ---- Messages and journal ----
  message(from, title, body, tone = '', action = null) {
    this.messages.push({ id: this.nextMessageId++, at: this.elapsed, from, title, body, tone, action, read: false });
    if (this.messages.length > 60) this.messages.shift();
  }
  readMessages(ids = null) {
    for (const m of this.messages) if (!ids || ids.includes(m.id)) m.read = true;
    return true;
  }
  writeJournal(title, text) {
    this.journal.push({ at: this.elapsed, title, text });
    if (this.journal.length > 80) this.journal.shift();
  }
  welcomeOverseer() {
    this.message(COMMAND, 'Welcome, Overseer', 'You have been dropped into the region with three volunteers and a cache of supplies. Establish a foothold, grow it, and earn it full city status. Your orders and milestones are on this tablet; open it any time with Tab.', 'good', { kind: 'quest' });
    this.message(COMMAND, 'New orders: ' + QUESTS[0].title, QUESTS[0].brief, '', { kind: 'quest' });
    this.writeJournal('Day 1', 'The drop put us down in a clearing with a crate of supplies and this tablet. Three volunteers, one fire. Command wants a city. We start with firewood.');
  }

  // ---- Saves ----
  serializeProgress() {
    const { quest, rank, tally, noticed } = this.progress;
    return { progress: { quest, rank, tally, noticed }, unlocked: this.unlocked, messages: this.messages, journal: this.journal, nextMessageId: this.nextMessageId };
  }
  // `d` is the parsed save. Older saves have no progress: a refuge gets everything, and a camp from
  // the workbench days is credited with what it had unlocked and built.
  restoreProgress(d) {
    const finite = v => typeof v === 'number' && Number.isFinite(v), int = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
    const p = d.progress;
    if (p && typeof p === 'object') {
      this.initProgress();
      this.progress.quest = int(p.quest, QUESTS.length) ? p.quest : 0;
      this.progress.rank = int(p.rank, MAX_RANK) ? p.rank : 0;
      this.progress.tally = { felled: finite(p.tally?.felled) ? p.tally.felled : 0, recruited: finite(p.tally?.recruited) ? p.tally.recruited : 0 };
      this.progress.noticed = { beds: !!p.noticed?.beds, food: !!p.noticed?.food };
      this.unlocked = Object.fromEntries(Object.keys(QUEST_UNLOCKS).filter(t => d.unlocked?.[t] === true).map(t => [t, true]));
    } else if (this.start === 'refuge') this.initProgress(true);
    else {
      // Workbench unlock ids and every structure already standing count as unlocked; the quest
      // chain picks up at the first quest whose unlocks are not all in hand.
      const legacy = { walls: 'barricade', gate: 'gate', shelter: 'shelter', mill: 'lumber_mill', tower: 'tower', storage: 'storage', workshop: 'workshop', bunkhouse: 'dorm' };
      this.initProgress();
      for (const [id, type] of Object.entries(legacy)) if (d.unlocked?.[id] === true) this.unlocked[type] = true;
      for (const b of this.buildings) if (QUEST_UNLOCKS[b.type]) this.unlocked[b.type] = true;
      const q = QUESTS.findIndex(q => q.unlock.some(t => !this.unlocked[t]));
      this.progress.quest = q < 0 ? QUESTS.length : q;
    }
    const text = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
    this.messages = (Array.isArray(d.messages) ? d.messages : []).filter(m => m && Number.isInteger(m.id) && finite(m.at)).slice(-60)
      .map(m => ({ id: m.id, at: m.at, from: text(m.from, 40), title: text(m.title, 120), body: text(m.body, 600), tone: ['good', 'warn'].includes(m.tone) ? m.tone : '', read: !!m.read, action: restoreAction(m.action) }));
    this.journal = (Array.isArray(d.journal) ? d.journal : []).filter(j => j && finite(j.at)).slice(-80).map(j => ({ at: j.at, title: text(j.title, 80), text: text(j.text, 600) }));
    this.nextMessageId = Math.max(Number.isInteger(d.nextMessageId) ? d.nextMessageId : 1, ...this.messages.map(m => m.id + 1));
    this.progress.day = this.day;
  }
}

// A message's link into the game, keeping only the fields its kind uses.
function restoreAction(a) {
  if (!a || typeof a !== 'object' || !['quest', 'milestones', 'candidate', 'build', 'alert', 'report'].includes(a.kind)) return null;
  const out = { kind: a.kind };
  if (a.kind === 'candidate' && Number.isInteger(a.id)) Object.assign(out, { id: a.id, need: ['beds', 'food'].includes(a.need) ? a.need : '' });
  if (a.kind === 'build' && BUILDINGS[a.type]) out.type = a.type;
  return out;
}
// When a message or journal entry happened, as the tablet shows it.
export const stamp = at => { const day = Math.floor(at / DAY_SECONDS) + 1, hour = (at % DAY_SECONDS) / HOUR_SECONDS; return `DAY ${day} · ${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor(hour % 1 * 60)).padStart(2, '0')}`; };
