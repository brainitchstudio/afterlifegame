import { Game, BUILDINGS, BUILDING_TREES, EXPEDITIONS, SIDES, DAY_SECONDS, HOUR_SECONDS, phaseAt, RUN_DAYS, ROLES, ROLE_FOR, JOBS, jobOf, postSlots, buildingMaxHP, survivorStats, has, clamp } from './model.mjs';
import { STAT_KEYS, STAT_NAMES, STAT_USES, WEAPONS } from './survivors.mjs';
import { shiftLabel } from './data.mjs';
import { View } from './view.mjs';
import { parcelAt } from './land.mjs';
import { applyHudSkin } from './hudSkin.mjs';
import { portraitURL, outfitOf } from './art.mjs';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const costText = cost => Object.entries(cost).map(([r, amount]) => amount + ' ' + r).join(' · ');
const icon = { wood: '▰', metal: '⬡', food: '♧' };
const svg = paths => '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>';
const SVG = { build: svg('<path d="M13 3h5l3 3v3l-2 2-6-6z"/><path d="M14 9 4 19l1.5 1.5L15.5 10.5"/>'), trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>') };
const TASKS = { engaging: 'ENGAGING', patrol: 'ON PATROL', healing: 'TREATING A PATIENT', 'to-patient': 'REACHING PATIENT', treated: 'BEING TREATED', repairing: 'REPAIRING', 'to-repair': 'HEADING TO REPAIR', 'no-wood': 'NEEDS WOOD', 'to-rebuild': 'HEADING TO A BREACH', rebuilding: 'REBUILDING THE FENCE', 'rebuild-blocked': 'WAITING TO REBUILD', hunting: 'HUNTING', manning: 'ON THE TOWER', 'to-tower': 'HEADING TO A WATCHTOWER', resting: 'RESTING BETWEEN SHIFTS', 'to-bed': 'OFF SHIFT · HEADING TO BED', 'falling-back': 'FALLING BACK INSIDE', 'to-post': 'HEADING TO POST', standby: 'STANDING BY',
  'to-clinic': 'HEADING TO CLINIC', 'awaiting-care': 'WAITING FOR A MEDIC', 'to-rescue': 'RUSHING TO HELP', stabilizing: 'STABILIZING', 'waiting-safe': 'WAITING FOR A SAFE MOMENT', responding: 'RESPONDING TO ALERT', investigating: 'INVESTIGATING', attacking: 'ATTACKING', holding: 'HOLDING POSITION', 'to-position': 'TAKING POSITION',
  'to-shelter': 'HEADING TO SHELTER', sheltered: 'SHELTERED', 'no-route': 'NO ROUTE TO SHELTER', planting: 'PLANTING', tending: 'TENDING CROPS', harvesting: 'HARVESTING', 'to-field': 'HEADING TO FIELD', preparing: 'PREPARING SUPPLY RUNS' };
const hoursText = seconds => (seconds / HOUR_SECONDS).toFixed(1) + 'h';
const taskText = s => s.expedition ? 'ON EXPEDITION' : s.arriving && s.condition !== 'downed' && s.task !== 'engaging' ? 'WALKING IN' : s.condition === 'downed' ? 'DOWNED · ' + hoursText(s.bleed) + (s.rescuer != null ? ' · HELP COMING' : '') : TASKS[s.task] || (s.role === 'guard' || s.role === 'patrol' ? 'ON PATROL' : 'STANDING BY');
const roleLabel = s => s.role === 'patrol' || !s.role ? s.side : ROLES[s.role].name;
// Job plus assignment, e.g. GUARD · NORTH, GUARD · TOWER, MEDIC.
const dutyLabel = s => JOBS[jobOf(s)].toUpperCase() + (s.role === 'patrol' || !s.role ? ' · ' + (s.side === 'any' ? 'ALL SIDES' : s.side.toUpperCase()) : s.role === 'sentry' ? ' · TOWER' : s.role === 'guard' ? ' · BARRACKS' : '');
const clockAt = seconds => { const h = (6 + (game.elapsed + seconds) / DAY_SECONDS * 24) % 24; return String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor(h % 1 * 60)).padStart(2, '0'); };
const statBars = stats => '<div class="stat-bars">' + STAT_KEYS.map(k => '<div class="stat-row" title="' + STAT_NAMES[k] + ': ' + STAT_USES[k] + '"><span>' + k.toUpperCase() + '</span><i>' + Array.from({ length: 10 }, (_, n) => '<b class="' + (n < stats[k] ? 'on' : '') + '"></b>').join('') + '</i><strong>' + stats[k] + '</strong></div>').join('') + '</div>';
const conditionTag = s => s.condition === 'downed' ? '<span class="cond-tag downed">DOWNED</span>' : s.condition === 'injured' ? '<span class="cond-tag injured">INJURED</span>' : s.sheltered ? '<span class="cond-tag sheltered">SHELTERED</span>' : '';
const where = b => ((b.y < -40 ? 'N' : b.y > 40 ? 'S' : '') + (b.x < -40 ? 'W' : b.x > 40 ? 'E' : '')) || 'CENTRE';
// Portraits show the same kit outfit the survivor wears on the map (it follows their job).
const portraitStyle = s => 'background-image:url(' + portraitURL(outfitOf(jobOf(s), s.look)) + ')';
const portrait = s => '<span class="portrait"><span style="' + portraitStyle(s) + '"></span></span>';
// Staffing changes (posts, deaths, expeditions, new buildings) rebuild the inspector.
const staffKey = () => game.survivors.map(s => s.id + ':' + s.post + ':' + s.role + ':' + !!s.expedition + ':' + s.condition + ':' + (s.shelter ?? '') + ':' + (s.order?.zombieId ?? '') + ':' + (s.gear || '') + ':' + (s.home ?? '')).join('|') + '#' + game.items.length + ':' + (game.shelterOrder?.buildingId ?? '') + '#' + game.buildings.filter(b => ROLE_FOR[b.type]).map(b => b.id + ':' + postSlots(b)).join(',');
const storageKey = 'afterlife.save.v1';
const game = new Game();
let saved = false, saveFailed = false;
try { const data = localStorage.getItem(storageKey); if (data) { saved = game.restore(data); if (!saved) { console.warn('Save rejected:', game.restoreError(data)); try { localStorage.setItem(storageKey + '.unreadable', data); } catch {} game.notify('A fresh start', 'The previous save could not be read, so it was set aside. A new refuge is ready.', 'warn'); } } } catch { saveFailed = true; }
const view = new View(game, $('game'));
let paused = false, speed = 1, modalOpen = false, modalKind = '', rosterOpen = true, expanding = false;
let expeditionKind = 'woodland', inspectorTab = 'duty', pickerOpen = false;
let active = null, lastRoster = '', inspectorShowsExpedition = false, inspectorKey = '', endShown = false, returnFocus = null;
let uiTimer = 0, saveTimer = 0, lastTime = performance.now(), realTime = 0;

function save(manual = false) {
  try { localStorage.setItem(storageKey, game.serialize()); saveFailed = false; if (manual) toast('Settlement saved', 'Your survivors will be here when you return.', 'good'); }
  catch { saveFailed = true; if (manual) toast('Unable to save', 'Browser storage is unavailable. This run is still playable.', 'warn'); }
  $('save-status').textContent = saveFailed ? 'SAVE UNAVAILABLE' : 'AUTOSAVE ON';
}
function toast(title, message, tone = '') {
  const div = document.createElement('div'); div.className = 'notification ' + tone;
  div.innerHTML = '<strong>' + escape(title) + '</strong><p>' + escape(message) + '</p>';
  $('notifications').append(div);
  while ($('notifications').children.length > 3) $('notifications').firstElementChild.remove();
  setTimeout(() => div.remove(), 6500);
}
function selectedEntity() { return active && (active.kind === 'building' ? game.buildings : active.kind === 'zombie' ? game.zombies : game.survivors).find(e => e.id === active.id && (active.kind !== 'zombie' || e.hp > 0)); }
function closeInspector() { active = null; view.selected = null; $('inspector').hidden = true; lastRoster = ''; }
function select(selection) {
  if (!selection) { closeInspector(); return; }
  cancelPlacement(); cancelExpansion();
  $('build-menu').hidden = true;
  if (active?.kind !== selection.kind || active?.id !== selection.id) pickerOpen = false;
  active = selection; view.selected = selection;
  renderInspector(); positionInspector(); lastRoster = '';
}
function positionInspector() {
  const e = selectedEntity(); if (!e) return;
  const panel = $('inspector'), p = view.toScreen(e);
  const width = Math.min(348, innerWidth - 24), height = panel.offsetHeight;
  let left = p.x + 65 * view.scale;
  if (left + width > innerWidth - 14) left = p.x - width - 65 * view.scale;
  if (innerWidth < 700) left = (innerWidth - width) / 2;
  panel.style.left = clamp(left, 12, innerWidth - width - 12) + 'px';
  panel.style.top = clamp(p.y - height / 2, 14, Math.max(14, innerHeight - height - 14)) + 'px';
}
const costHTML = (cost, check = true) => '<span class="cost-list">' + Object.entries(cost).map(([r, amount]) => '<span class="cost-item' + (check && game.resources[r] < amount ? ' short' : '') + '" title="' + amount + ' ' + r + '"><i class="res-' + r + '">' + icon[r] + '</i>' + amount + '</span>').join('') + '</span>';
const sideLabel = side => side === 'any' ? 'ANY SIDE' : side.toUpperCase();
function tabs(items) {
  return '<nav class="panel-tabs" role="tablist">' + items.map(([id, label, extra]) => '<button role="tab" data-action="inspector-tab" data-tab="' + id + '" aria-selected="' + (inspectorTab === id) + '" class="' + (inspectorTab === id ? 'active' : '') + '">' + label + (extra || '') + '</button>').join('') + '</nav>';
}
function upgradeTree(nodes, entity, survivor = false) {
  return '<div class="upgrade-tree ' + (survivor ? 'survivor-tree' : '') + '">' + nodes.map(n => {
    const owned = has(entity, n.id), locked = n.requires && !has(entity, n.requires), parent = locked && nodes.find(p => p.id === n.requires);
    return '<button class="upgrade-node ' + (n.requires ? 'child ' : '') + (owned ? 'owned ' : '') + (locked ? 'locked' : '') + '" data-action="upgrade" data-upgrade="' + n.id + '" ' + (owned || locked ? 'disabled' : '') + ' title="' + escape(n.name + ': ' + n.description + (locked ? '. Requires ' + parent.name : '')) + '"><strong>' + escape(n.name) + '</strong><small>' + escape(n.description) + '</small><span class="node-cost">' + (owned ? '✓ Owned' : locked ? 'After ' + escape(parent.name) : survivor ? '<span class="cost-item">' + n.cost + ' pt' + (n.cost !== 1 ? 's' : '') + '</span>' : costHTML(n.cost)) + '</span></button>';
  }).join('') + '</div>';
}
function postList(s) {
  const order = Object.keys(ROLE_FOR), posts = game.buildings.filter(b => ROLE_FOR[b.type]).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  const scavenger = '<button class="post-option ' + (s.role === 'scavenger' ? 'active' : '') + '" data-action="' + (s.role === 'scavenger' ? 'unpost' : 'post') + '" data-id="' + s.id + '" data-building="scavenger" title="' + escape(ROLES.scavenger.description) + '"><span class="post-icon">' + ROLES.scavenger.icon + '</span><span><strong>Scavenger</strong><small>' + (s.role === 'scavenger' ? 'Current job' : 'HQ · supply runs') + '</small></span>' + (s.role === 'scavenger' ? '<em>×</em>' : '') + '</button>';
  return '<div class="post-grid">' + scavenger + posts.map(b => {
    const role = ROLES[ROLE_FOR[b.type]], staff = game.staffOf(b).length, slots = postSlots(b), current = s.post === b.id;
    return '<button class="post-option ' + (current ? 'active' : '') + '" data-action="' + (current ? 'unpost' : 'post') + '" data-id="' + s.id + '" data-building="' + b.id + '" ' + (staff >= slots && !current ? 'disabled' : '') + ' title="' + escape(current ? 'Return ' + s.name + ' to patrol' : role.description) + '"><span class="post-icon">' + role.icon + '</span><span><strong>' + role.name + '</strong><small>' + where(b) + ' · ' + (current ? 'Posted' : staff + '/' + slots) + '</small></span>' + (current ? '<em>×</em>' : '') + '</button>';
  }).join('') + '</div>' + (posts.length ? '' : '<p class="panel-note">Build a clinic, workshop, farm, barracks or watchtower for more jobs.</p>');
}
function staffPanel(b) {
  const role = ROLES[ROLE_FOR[b.type]], staff = game.staffOf(b), slots = postSlots(b), open = slots - staff.length;
  let html = '<p class="panel-note">' + escape(role.description) + '</p><div class="staff-list">';
  if (b.type === 'tower') staff.sort((a, c) => a.shift - c.shift);
  html += staff.map(s => '<div class="staff-row">' + portrait(s) + '<span><strong>' + escape(s.name) + (b.type === 'tower' && s.shift != null ? ' · ' + shiftLabel(s.shift) : '') + '</strong><small id="staff-task-' + s.id + '">' + taskText(s) + '</small></span><button class="row-action" data-action="unpost" data-id="' + s.id + '" title="Return ' + escape(s.name) + ' to patrol">Release</button></div>').join('');
  if (open > 0) html += '<button class="open-slot' + (pickerOpen ? ' active' : '') + '" data-action="toggle-picker" aria-expanded="' + pickerOpen + '"><span class="slot-plus">+</span><span>Assign ' + (/^[aeiou]/i.test(role.name) ? 'an ' : 'a ') + role.name.toLowerCase() + '</span><em>' + open + ' open post' + (open !== 1 ? 's' : '') + '</em></button>';
  html += '</div>';
  if (open > 0 && pickerOpen) {
    const rank = s => (!s.role || s.role === 'patrol' ? 0 : 1);
    const candidates = game.survivors.filter(s => !s.expedition && s.post !== b.id).sort((a, c) => rank(a) - rank(c) || c.level - a.level);
    html += candidates.length ? '<div class="candidate-list">' + candidates.map(s => '<button data-action="post-here" data-id="' + s.id + '" title="Make ' + escape(s.name) + ' a ' + role.name.toLowerCase() + '">' + portrait(s) + '<span><strong>' + escape(s.name) + '</strong><small>' + escape(roleLabel(s)) + ' · LVL ' + s.level + '</small></span><em>Assign</em></button>').join('') + '</div>' : '<p class="panel-note">Every available survivor is already posted here or away.</p>';
  }
  return html;
}
// Beds, shelter orders and the armory, shown under a building's main tab.
function buildingExtras(b) {
  let html = '';
  if (game.beds(b)) {
    const residents = game.residents(b);
    html += '<div class="field-label section-gap">Beds<span>' + residents.length + ' / ' + game.beds(b) + '</span></div><p class="panel-note">' + (residents.length ? residents.map(s => escape(s.name)).join(', ') : 'Empty') + '</p>';
  }
  if (game.shelterCapacity(b)) {
    const here = game.shelterOrder?.buildingId === b.id;
    html += '<div class="field-label section-gap">Shelter<span>Room for ' + game.shelterCapacity(b) + '</span></div>' + (here ? '<p class="panel-note">' + game.survivors.filter(s => s.shelter === b.id && s.sheltered).length + ' inside. Guards stay on duty.</p><div class="action-row"><button data-action="all-clear">Sound the all clear</button></div>' : '<div class="action-row"><button data-action="shelter">Shelter everyone but guards here</button></div>');
  }
  if (b.type === 'workshop') {
    const stock = type => game.items.filter(i => i.type === type), spare = game.items.filter(i => i.holder == null).length;
    html += '<div class="field-label section-gap">Armory<span>' + game.items.length + ' weapons · ' + spare + ' spare</span></div><div class="fab-grid">' + ['pipe', 'pistol', 'rifle'].map(type => '<button data-action="fabricate" data-type="' + type + '" title="' + WEAPONS[type].name + ': ' + WEAPONS[type].damage + ' damage, ' + WEAPONS[type].range + ' range"><strong>' + WEAPONS[type].name + '</strong><small>' + stock(type).length + ' owned</small>' + costHTML(WEAPONS[type].cost) + '</button>').join('') + '</div>';
  }
  return html;
}
function meter(label, id, extra = '') {
  return '<div class="vital"><span class="vital-label">' + label + '</span><div class="meter"><span id="' + id + '-bar"></span></div><strong id="' + id + '"></strong>' + extra + '</div>';
}
function renderInspector() {
  const e = selectedEntity(); if (!e) { closeInspector(); return; }
  const survivor = active.kind === 'survivor', definition = survivor ? null : BUILDINGS[e.type];
  inspectorKey = staffKey();
  let body;
  if (active.kind === 'zombie') {
    const team = game.survivors.filter(s => s.order?.zombieId === e.id);
    body = '<div class="floating-header"><span class="building-emblem zombie-emblem">☠</span><div class="title-block"><h2>' + { walker: 'Walker', runner: 'Runner', brute: 'Brute' }[e.kind] + '</h2><div class="eyebrow">THE DEAD · ' + (e.swarm ? 'PART OF A PACK' : 'STRAGGLER') + '</div></div><button class="icon-button" data-action="close-inspector" aria-label="Close details">×</button></div>';
    body += '<div class="vitals">' + meter('HP', 'selected-hp') + '<div class="stat-strip"><span>DMG <b>' + Math.round(e.damage) + '/s</b></span><span>SPEED <b>' + Math.round(e.speed) + '</b></span></div></div><div class="inspector-body">';
    body += team.length ? '<div class="field-label">Attacking<span>' + team.length + ' survivor' + (team.length > 1 ? 's' : '') + '</span></div><div class="staff-list">' + team.map(s => '<div class="staff-row">' + portrait(s) + '<span><strong>' + escape(s.name) + '</strong><small>' + taskText(s) + '</small></span></div>').join('') + '</div><div class="action-row"><button class="danger-button" data-action="cancel-attack">Cancel attack</button></div>'
      : '<p class="panel-note">Send the nearest free survivors after this one. Guards go first, but anyone can fight. They give up if it slips out of sight for a few seconds.</p><div class="action-row"><button data-action="attack">Attack</button></div>';
  } else if (survivor) {
    const role = e.role || 'patrol', tab = inspectorTab = inspectorTab === 'stats' ? 'stats' : 'duty';
    inspectorShowsExpedition = !!e.expedition;
    body = '<div class="floating-header"><span class="portrait large"><span style="' + portraitStyle(e) + '"></span></span><div class="title-block"><h2>' + escape(e.name) + ' ' + conditionTag(e) + '</h2><div class="eyebrow"><span class="role-tag ' + (role !== 'patrol' ? 'role-' + role : '') + '">' + dutyLabel(e) + '</span>LVL <span id="selected-level">' + e.level + '</span></div></div><button class="icon-button" data-action="close-inspector" aria-label="Close details">×</button></div>';
    body += '<div class="vitals">' + meter('HP', 'selected-hp') + meter('XP', 'selected-xp') + '<div class="stat-strip"><span>DMG <b id="selected-damage"></b></span><span>RANGE <b id="selected-range"></b></span><span class="stat-task" id="selected-task"></span></div></div>';
    body += tabs([['duty', 'Duty'], ['stats', 'Stats']]) + '<div class="inspector-body">';
    if (tab === 'duty' && e.condition === 'downed') {
      const rescuer = game.survivors.find(r => r.id === e.rescuer);
      body += '<div class="expedition-status danger"><strong>Downed · <span id="selected-bleed">' + hoursText(e.bleed) + '</span> to bleed out</strong><p>' + (rescuer ? escape(rescuer.name) + ' is on the way to stabilize them.' : 'Nobody free to help yet. Post a medic at a clinic, or keep a healthy survivor nearby.') + '</p></div>';
    } else if (tab === 'duty' && e.expedition) {
      const trip = EXPEDITIONS[e.expedition.kind];
      body += '<div class="expedition-status"><strong>Away · ' + escape(trip.name) + '</strong><p>Back around <span id="selected-expedition-remaining">' + clockAt(e.expedition.remaining) + '</span>. Their ' + (role === 'patrol' ? 'patrol side' : 'post') + ' is uncovered until then.</p></div>';
    } else if (tab === 'duty') {
      if (e.resting) body += '<div class="expedition-status"><strong>Resting between shifts</strong><p>Back to the watchtower for their ' + shiftLabel(e.shift) + ' shift, or sooner if the alarm sounds.</p></div>';
      else if (e.sheltered || e.shelter != null) body += '<div class="expedition-status"><strong>' + (e.sheltered ? 'Sheltering' : 'Heading to shelter') + '</strong><p>They return to work at the all clear.</p></div>';
      if (e.condition === 'injured') body += '<div class="expedition-status warn"><strong>Injured</strong><p>' + (game.clinicsWithMedics().length ? 'They will walk to the clinic when it is safe.' : 'Resting will not heal this. Post a medic at a clinic.') + '</p></div>';
      body += '<div class="field-label">Guard · patrol side' + (role !== 'patrol' ? '<span>Picking one makes them a guard again</span>' : '') + '</div><div class="segmented">' + SIDES.map(side => '<button data-action="assign" data-side="' + side + '" class="' + (role === 'patrol' && e.side === side ? 'active' : '') + '">' + (side === 'any' ? 'Any' : side[0].toUpperCase() + side.slice(1)) + '</button>').join('') + '</div>';
      body += '<div class="field-label">Other jobs</div>' + postList(e);
    } else {
      const home = game.buildings.find(b => b.id === e.home), weapon = WEAPONS[e.gear] || WEAPONS.fists;
      body += statBars(e.stats) + '<div class="fact-grid"><div><span>Weapon</span><strong>' + weapon.name + '</strong></div><div><span>Bed</span><strong>' + (home ? BUILDINGS[home.type].name : 'None') + '</strong></div><div><span>Origin</span><strong>' + escape({ founder: 'Founder', radio: 'Radio call', 'walk-up': 'Walked up', expedition: 'Found on a run', legacy: 'Founder' }[e.gen.source] || e.gen.source) + '</strong></div><div><span>Condition</span><strong>' + e.condition[0].toUpperCase() + e.condition.slice(1) + '</strong></div></div>';
      body += '<p class="panel-note">Each level adds one point to a stat, weighted toward their natural talents, up to 10.' + (e.unspent ? ' ' + e.unspent + ' point' + (e.unspent > 1 ? 's' : '') + ' unspent: every stat is maxed.' : '') + '</p>';
    }
  } else {
    const staffed = !!ROLE_FOR[e.type], tree = BUILDING_TREES[e.type];
    const tab = inspectorTab = staffed && inspectorTab !== 'upgrades' ? 'staff' : 'upgrades';
    const tier = e.type === 'core' ? 'ESSENTIAL' : 'TIER ' + (1 + Math.floor(e.upgrades.length / 2));
    body = '<div class="floating-header"><span class="building-emblem em-' + e.type + '" style="color:' + definition.color + '">' + definition.icon + '</span><div class="title-block"><h2>' + escape(definition.name) + '</h2><div class="eyebrow">' + tier + ' · ' + where(e) + '</div></div>' + (e.type !== 'core' ? '<button class="icon-button danger" data-action="demolish" aria-label="Dismantle building" title="Dismantle">' + SVG.trash + '</button>' : '') + '<button class="icon-button" data-action="close-inspector" aria-label="Close details">×</button></div>';
    body += '<div class="vitals">' + meter('HP', 'selected-hp', '<button class="repair-inline" data-action="repair" id="repair-button"></button>') + '<div class="output-line"><span>' + escape(definition.subtitle) + '</span><strong id="selected-output"></strong></div></div>';
    const staff = staffed ? game.staffOf(e).length : 0;
    body += staffed ? tabs([['staff', ROLES[ROLE_FOR[e.type]].name.replace(/y$/, 'ie') + 's', '<i class="tab-count">' + staff + '/' + postSlots(e) + '</i>'], ['upgrades', 'Upgrades', '<i class="tab-count">' + e.upgrades.length + '/' + tree.length + '</i>']]) : '<div class="field-label section-top">Upgrades<span>' + e.upgrades.length + ' / ' + tree.length + ' built</span></div>';
    body += '<div class="inspector-body">' + (tab === 'staff' ? staffPanel(e) : upgradeTree(tree, e)) + buildingExtras(e);
  }
  body += '</div>';
  $('inspector').innerHTML = body; $('inspector').hidden = false;
  refreshInspector();
}
function refreshInspector() {
  const e = selectedEntity(); if (!e) { if (active) closeInspector(); return; }
  if (staffKey() !== inspectorKey) { renderInspector(); return; }
  const survivor = active.kind === 'survivor', hp = active.kind === 'zombie' ? e.maxHP : survivor ? survivorStats(e).hp : buildingMaxHP(e);
  $('selected-hp').textContent = Math.ceil(e.hp) + ' / ' + hp;
  $('selected-hp-bar').style.width = e.hp / hp * 100 + '%';
  $('selected-hp-bar').classList.toggle('low', e.hp / hp < .35);
  if (active.kind === 'zombie') {
    // nothing else changes live
  } else if (survivor) {
    if (!!e.expedition !== inspectorShowsExpedition) { renderInspector(); return; }
    const stats = game.statsOf(e), need = game.xpNeeded(e);
    $('selected-damage').textContent = stats.damage; $('selected-range').textContent = stats.range;
    $('selected-xp').textContent = Math.floor(e.xp) + ' / ' + need;
    $('selected-xp-bar').style.width = Math.min(100, e.xp / need * 100) + '%';
    $('selected-level').textContent = e.level;
    $('selected-task').textContent = taskText(e);
    if ($('selected-bleed')) $('selected-bleed').textContent = hoursText(e.bleed);
    if (e.expedition && $('selected-expedition-remaining')) $('selected-expedition-remaining').textContent = clockAt(e.expedition.remaining);
  } else {
    let output = '';
    const staff = game.staffOf(e), count = (n, word) => n + ' ' + word + (n !== 1 ? 's' : '');
    for (const s of staff) { const label = $('staff-task-' + s.id); if (label) label.textContent = taskText(s); }
    if (e.type === 'farm') output = (60 * .23 * (1 + (has(e, 'irrigation') ? .5 : 0) + (has(e, 'storage') ? .25 : 0) + (has(e, 'greenhouse') ? .75 : 0) + (has(e, 'harvest') ? .75 : 0)) * (game.night && !has(e, 'greenhouse') ? .4 : 1) * game.farmLabor(e)).toFixed(1) + ' food / min' + (staff.length ? ' · ' + count(staff.length, 'farmer') : '') + (game.night && !has(e, 'greenhouse') ? ' · night' : '');
    if (e.type === 'dorm') output = game.residents(e).length + ' / ' + game.beds(e) + ' beds taken';
    if (e.type === 'workshop') output = (16.2 * (1 + (has(e, 'sawbench') ? .6 : 0) + (has(e, 'machinery') ? 1 : 0))).toFixed(1) + ' wood · ' + (7.2 * (1 + (has(e, 'forge') ? .7 : 0) + (has(e, 'recycling') ? 1 : 0))).toFixed(1) + ' metal / min';
    if (e.type === 'barracks') output = count(staff.length, 'guard') + ' hunting · +2 beds';
    if (e.type === 'clinic') output = count(staff.length, 'medic') + ' · ' + count(game.survivors.filter(p => p.careAt === e.id && p.care).length, 'patient') + (has(e, 'salves') || has(e, 'ward') ? ' · faster healing' : '') + (has(e, 'surgeon') ? ' · safer trips' : '') + (has(e, 'antibiotics') ? ' · no starvation' : '');
    const up = game.survivors.find(s => s.stationed && s.towerId === e.id);
    const due = staff.filter(s => game.onDuty(s) && game.active(s));
    if (e.type === 'tower') output = (up ? (up.role === 'sentry' ? up.name + ' on watch · alerting guards' : up.name + ' on watch') : due.length ? 'Sentry on the way' : staff.length ? 'Unmanned this shift' : 'Unmanned · assign guards to keep watch') + (staff.length ? ' · ' + staff.length + '/' + postSlots(e) + ' shifts covered' : '');
    if (e.type === 'core') output = 'If it falls, the run ends';
    if (e.type === 'gate') output = 'Opens for survivors' + (has(e, 'wire') ? ' · ' + (4 + (has(e, 'spikes') ? 10 : 0)) + ' dmg / sec' : '');
    if (e.type === 'barricade') output = has(e, 'wire') ? (4 + (has(e, 'spikes') ? 10 : 0)) + ' dmg / sec' : 'Blocking';
    $('selected-output').textContent = output;
    const cost = game.repairCost(e), repair = $('repair-button');
    repair.hidden = e.hp >= hp;
    const repairHTML = 'Repair ' + costHTML(cost);
    if (repair.dataset.html !== repairHTML) { repair.innerHTML = repairHTML; repair.dataset.html = repairHTML; }
    repair.disabled = !game.afford(cost) || game.status !== 'playing';
  }
  for (const button of $('inspector').querySelectorAll('[data-upgrade]')) {
    const n = BUILDING_TREES[e.type].find(n => n.id === button.dataset.upgrade);
    const affordable = game.afford(n.cost);
    button.disabled = game.status !== 'playing' || has(e, n.id) || (n.requires && !has(e, n.requires)) || !affordable;
    button.classList.toggle('ready', !button.disabled);
    if (!has(e, n.id) && !(n.requires && !has(e, n.requires))) for (const item of button.querySelectorAll('.cost-item')) { const [r, amount] = item.title.split(' ').reverse(); item.classList.toggle('short', game.resources[r] < Number(amount)); }
  }
}
function renderRoster() {
  const key = game.survivors.map(s => [s.id, s.side, s.role, s.level, s.condition, !!s.sheltered, active?.id === s.id].join(':')).join('|');
  if (key !== lastRoster) {
    lastRoster = key;
    $('roster').innerHTML = game.survivors.map(s => '<button class="roster-row ' + (active?.id === s.id ? 'selected ' : '') + (s.condition !== 'healthy' ? 'cond-' + s.condition : '') + '" data-action="select-survivor" data-id="' + s.id + '" aria-label="Inspect ' + escape(s.name) + '">' + portrait(s) + '<span><span class="survivor-name">' + escape(s.name) + '</span><span class="survivor-meta" style="display:block">LVL ' + s.level + ' <span id="survivor-state-' + s.id + '">· ON PATROL</span></span><span class="roster-health" style="display:block"><i id="survivor-health-' + s.id + '"></i></span></span><span class="assignment-chip ' + (s.role && s.role !== 'patrol' ? 'role-' + s.role : '') + '">' + escape(roleLabel(s)) + '</span></button>').join('');
    if (!game.survivors.length) $('roster').innerHTML = '<p class="menu-footnote">No survivors remain. Recruit someone to defend the refuge.</p>';
  }
  for (const s of game.survivors) {
    $('survivor-health-' + s.id).style.width = s.hp / survivorStats(s).hp * 100 + '%';
    $('survivor-state-' + s.id).textContent = '· ' + taskText(s);
  }
  $('crew-count').textContent = game.survivors.length + ' / ' + game.capacity;
  $('patrol-summary').innerHTML = SIDES.slice(1).map(side => { const count = game.coverage(side); return '<span>' + side[0].toUpperCase() + '<b class="' + (count ? '' : 'empty') + '">' + count + '</b></span>'; }).join('');
  const button = $('recruit-button'), offers = game.candidates.length;
  button.disabled = game.status !== 'playing';
  button.classList.toggle('has-offers', offers > 0);
  button.firstElementChild.textContent = offers ? offers + ' survivor' + (offers > 1 ? 's' : '') + ' waiting · review' : game.broadcasting ? 'Broadcasting · ' + hoursText(game.recruitTimer) : '+ Recruit survivors';
  button.lastElementChild.textContent = game.freeBeds + ' free bed' + (game.freeBeds !== 1 ? 's' : '');
}
function recruits() {
  const cost = game.recruitCost, beds = game.freeBeds, noBeds = beds <= 0;
  let html = '<button class="icon-button modal-close" data-action="close-modal" aria-label="Close recruitment">×</button><div class="eyebrow">NEW FACES / RECRUITMENT</div><h2>Who can we take in?</h2><p>Survivors reach you by radio, by walking up to the gate, or on expeditions. Everyone needs a bed. What you see is who they are: stats never change until they level up.</p>';
  html += '<div class="section-label">RADIO <span>' + beds + ' FREE BED' + (beds !== 1 ? 'S' : '') + ' · ' + game.capacity + ' TOTAL</span></div>';
  html += '<button class="modal-button" data-action="broadcast" ' + (game.broadcasting || noBeds || !game.afford(cost) || game.status !== 'playing' ? 'disabled' : '') + '>' + (game.broadcasting ? 'Broadcasting · an answer within ' + hoursText(game.recruitTimer) : noBeds ? 'No free beds · build or upgrade a bunkhouse' : 'Broadcast for survivors · ' + costText(cost)) + '</button>';
  html += '<div class="section-label">WAITING AT THE GATE <span>' + game.candidates.length + ' OFFER' + (game.candidates.length !== 1 ? 'S' : '') + '</span></div>';
  html += game.candidates.length ? '<div class="candidate-cards">' + game.candidates.map(c => {
    const source = { radio: 'Answered the radio', 'walk-up': 'Walked up to the gate', expedition: 'Met on an expedition' }[c.source] || c.source;
    return '<div class="candidate-card"><div class="candidate-head">' + portrait(c) + '<span><strong>' + escape(c.name) + (c.label ? ' <em>' + escape(c.label) + '</em>' : '') + '</strong><small>' + escape(source) + ' · leaves in ' + hoursText(c.expiresAt - game.elapsed) + '</small></span></div>' + statBars(c.stats) + '<div class="action-row"><button data-action="accept-candidate" data-id="' + c.id + '" ' + (noBeds ? 'disabled title="No free beds"' : '') + '>' + (noBeds ? 'No free bed' : 'Take them in') + '</button><button class="danger-button" data-action="decline-candidate" data-id="' + c.id + '">Turn away</button></div></div>';
  }).join('') + '</div>' : '<p class="menu-footnote">Nobody is waiting. Broadcast on the radio, or keep an eye on the gate during the day.</p>';
  openModal('recruits', html);
}
function buildMenu() {
  const open = $('build-menu').hidden;
  cancelPlacement(); cancelExpansion(); closeInspector(); $('build-menu').hidden = !open;
  if (!open) return;
  $('build-menu').innerHTML = '<div class="floating-header compact"><span class="building-emblem em-build">' + SVG.build + '</span><div class="title-block"><h2>Construction</h2><div class="eyebrow">Pick a building, then a plot</div></div><button class="icon-button" data-action="build-menu" aria-label="Close construction">×</button></div><div class="build-catalog">' + Object.entries(BUILDINGS).filter(([key]) => key !== 'core').map(([key, b]) => '<button class="build-card" data-action="place" data-type="' + key + '" title="' + escape(b.subtitle) + '"><span class="building-emblem em-' + key + '" style="color:' + b.color + '">' + b.icon + '</span><span class="build-info"><h3>' + b.name + '</h3><p>' + b.subtitle + '</p>' + costHTML(b.cost) + '</span></button>').join('') + '</div><p class="menu-footnote"><kbd>R</kbd> rotate · <kbd>Esc</kbd> / right-click done</p>';
  refreshBuildMenu();
}
function refreshBuildMenu() {
  if ($('build-menu').hidden) return;
  for (const b of $('build-menu').querySelectorAll('[data-type]')) {
    const cost = BUILDINGS[b.dataset.type].cost;
    b.disabled = !game.afford(cost) || game.status !== 'playing';
    for (const item of b.querySelectorAll('.cost-item')) { const [r, amount] = item.title.split(' ').reverse(); item.classList.toggle('short', game.resources[r] < Number(amount)); }
  }
}
function startPlacement(type) {
  closeInspector(); cancelExpansion(); $('build-menu').hidden = true;
  view.placement = { type, rotation: 0 }; $('placement-banner').hidden = false;
  $('placement-banner').innerHTML = '<strong>PLACING ' + BUILDINGS[type].name.toUpperCase() + '</strong><p id="placement-status">' + (type === 'gate' ? 'Choose a road opening, or a stretch of fence to turn into a gate.' : type === 'tower' ? 'Choose a spot inside the refuge, or out in the open beyond the wall.' : 'Choose an empty plot inside the refuge.') + '</p><button data-action="cancel-placement">Done [Esc]</button>' + (type === 'barricade' ? ' <button data-action="rotate">Rotate [R]</button>' : '');
  document.body.classList.add('placing');
}
function cancelPlacement() { view.placement = null; $('placement-banner').hidden = true; document.body.classList.remove('placing'); }
function toggleExpansion() {
  if (expanding) { cancelExpansion(); return; }
  cancelPlacement(); closeInspector(); $('build-menu').hidden = true;
  expanding = true; view.setExpansion(true);
  renderExpansionBanner();
}
function cancelExpansion() { if (!expanding) return; expanding = false; view.setExpansion(false); $('expansion-banner').hidden = true; }
function renderExpansionBanner() {
  $('expansion-banner').hidden = false;
  $('expansion-banner').innerHTML = '<strong>CLAIMING TERRITORY</strong><p id="expansion-status">Click a highlighted plot to claim it · ' + costText(game.landCost) + '</p><button data-action="cancel-expansion">Done [Esc]</button>';
}
function openModal(kind, html) {
  if (!modalOpen) returnFocus = document.activeElement;
  const refresh = modalOpen && modalKind === kind, scroll = $('modal').scrollTop;
  modalOpen = true; modalKind = kind;
  $('modal').innerHTML = html; $('modal-backdrop').hidden = false;
  const title = $('modal').querySelector('h2'); if (title) title.id = 'modal-title';
  $('modal').className = kind === 'expeditions' || kind === 'recruits' ? 'wide' : '';
  // Re-rendering the same menu keeps its scroll position instead of jumping to the top.
  if (refresh) $('modal').scrollTop = scroll; else $('modal').querySelector('button')?.focus();
}
function closeModal() { if (modalKind === 'end') return; modalOpen = false; modalKind = ''; $('modal-backdrop').hidden = true; returnFocus?.focus?.(); }
function help() {
  openModal('help', '<div class="eyebrow">FIELD GUIDE / AFTERLIFE</div><h2>A place for the living.</h2><p>You have 24 days to hold this refuge. Each game hour lasts 42 seconds at normal speed, so a full day lasts 16 min 48 s. Each day flows through five phases: <strong>Dawn</strong> (05–08), <strong>Daylight</strong> (08–17), <strong>Dusk</strong> (17–20), the <strong>Midnight swarm</strong> (20–01) and the <strong>Dead of night</strong> (01–05). Days are nearly quiet — use them to build and scavenge. Pressure climbs through dusk and peaks around 23:00.</p><ul class="modal-list"><li><strong>Build & sustain.</strong> Workshops supply wood and metal. Farms grow food automatically; every survivor eats. Farms produce less at night until you unlock a greenhouse.</li><li><strong>Beds and recruits.</strong> Every survivor needs a bed: the HQ has 2, each bunkhouse 4 (more with upgrades), barracks 2. Recruit by radio broadcast, take in people who walk up to the gate by day, or bring back someone met on an expedition. You see their stats before you decide.</li><li><strong>Claim more land.</strong> The refuge starts on nine parcels. Press LAND to buy neighboring parcels with wood and metal — more room to build, with fences and patrol routes extending automatically.</li><li><strong>Five stats.</strong> Strength (melee, carrying), Agility (speed, aim, fire rate), Endurance (health, bleed-out time), Intelligence (medicine, repairs, farming) and Charisma (trade, recruitment), each 1–10. Every level adds one point, weighted toward their talents.</li><li><strong>The wall.</strong> The fence is a real wall; the only ways through are its gates. Each road has one, and you can build more on the fence itself. Nobody on the ground can see or shoot over it; only someone up on a watchtower sees both sides. Build watchtowers inside the refuge or out in the open beyond the wall. Guards go out through the gate and fight the dead outside; the wounded climb a tower inside the wall instead. Workers inside only fight what gets through.</li><li><strong>Five jobs.</strong> Guards patrol a side outside the wall, hunt from the barracks, or stand watch at a watchtower in 8-hour shifts (day, evening, night), walking back to their bed to rest in between. Medics work the clinic. Engineers repair. Farmers raise a farm’s output. Scavengers prepare supply runs. Everyone fights anything in range whatever their job, and a job never decides who may carry a weapon.</li><li><strong>Weapons.</strong> The refuge shares a stockpile of pipes, pistols and rifles; each is reserved to one person, guards first. Make more at a workshop. Without one, survivors fight bare-handed.</li><li><strong>Watchtowers and the alarm.</strong> A sentry on a tower spots the dead far out and sends the nearest guards to the last known position. Raise the ALARM to pull every guard off routine patrol (barracks guards climb the watchtowers and resting sentries turn out); it clears after an hour of quiet. Click a zombie to order an attack.</li><li><strong>Wounds.</strong> Under half health a survivor is injured: resting will not fix it, so they walk to a clinic with a medic on duty. At zero they are downed and bleed out in about three game hours unless a medic (or, without one, anyone healthy) stabilizes them. Death is permanent.</li><li><strong>Shelter.</strong> Select the HQ, a bunkhouse or the barracks to shelter everyone except guards. The dead cannot reach them inside, but the building can still fall. Sound the all clear to send them back to work.</li><li><strong>Send expeditions.</strong> Open EXPED (E) to pick a site and a party. Parties grow with population (1 member up to 5 people, 2 up to 10, and so on); bigger parties carry more and are safer. Trips take 4–7 game hours, cost food per member, and can end in injury or, rarely, death.</li><li><strong>Grow stronger.</strong> Buildings have branching upgrades. Repair damaged defenses before nightfall — or repair everything at once from the BASE overview.</li><li><strong>Read the rhythm.</strong> The dead come in waves: a quiet lull, a build-up as they stir, then an incursion — a pack that bursts in from one edge. A red edge alert gives you a few seconds of warning (more if a sentry is on a watchtower). After each incursion comes a short respite. Most packs drift in from the side named at dusk.</li><li><strong>Brace for horde nights.</strong> Every fifth night brings a much larger wave, with a warning beforehand. Survive it for a salvage bonus at dawn.</li><li><strong>Trade when you can.</strong> A traveling trader occasionally offers to exchange resources for a short time — accept from the banner before they move on.</li><li><strong>Keep the HQ standing.</strong> Losing survivors is survivable. Losing your Refuge HQ ends the run. Survive all 24 days to win.</li></ul><p><strong>B</strong> build · <strong>L</strong> claim land · <strong>E</strong> expeditions · <strong>Space</strong> pause · <strong>R</strong> rotate barricade · <strong>Esc</strong> close. Progress saves automatically. The game pauses while this guide is open or the tab is hidden.</p><button class="modal-button primary" data-action="close-modal">Back to the refuge</button>');
}
function settings() {
  openModal('settings', '<div class="eyebrow">AFTERLIFE / PAUSED</div><h2>Take a breath.</h2><p>Your settlement is safe while this menu is open. Progress is saved in this browser every five seconds.</p><button class="modal-button primary" data-action="close-modal">Return to game</button><button class="modal-button" data-action="save">Save settlement</button><button class="modal-button" data-action="help">How to play</button><button class="modal-button danger" data-action="restart-confirm">Start a new refuge</button>');
}
let party = new Set();
function expeditions() {
  const away = game.survivors.filter(s => s.expedition), home = game.survivors.filter(s => !s.expedition), chosen = EXPEDITIONS[expeditionKind], cap = game.partyCap;
  for (const id of party) if (!home.some(s => s.id === id)) party.delete(id);
  const members = [...party].map(id => game.survivors.find(s => s.id === id)), block = game.partyBlock(members, expeditionKind);
  let html = '<button class="icon-button modal-close" data-action="close-modal" aria-label="Close expeditions">×</button><div class="eyebrow">OUTSIDE THE WALLS / EXPEDITIONS</div><h2>Scavenge the ruins.</h2><p>Send a party to a nearby site. Bigger parties carry more and are safer, and strong survivors haul extra. Their posts stay uncovered until they return, and they leave their weapons for those at home. Party size grows with your population.</p>';
  html += '<div class="section-label">UNDERWAY <span>' + away.length + ' AWAY · ' + home.length + ' AT THE REFUGE</span></div>';
  html += away.length ? '<div class="staff-list">' + away.map(s => {
    const trip = EXPEDITIONS[s.expedition.kind], done = 1 - s.expedition.remaining / s.expedition.total;
    return '<div class="staff-row trip-row">' + portrait(s) + '<span><strong>' + escape(s.name) + '</strong><small>' + escape(trip.name) + ' · back ~' + clockAt(s.expedition.remaining) + '</small><i class="trip-progress"><b style="width:' + done * 100 + '%"></b></i></span></div>';
  }).join('') + '</div>' : '<p class="menu-footnote">No one is outside the walls.</p>';
  html += '<div class="section-label">DESTINATION <span>' + (game.clinic && has(game.clinic, 'surgeon') ? 'FIELD SURGEON · −40% RISK' : 'CHOOSE A SITE') + '</span></div><div class="destination-list">' + Object.entries(EXPEDITIONS).map(([kind, trip]) =>
    '<button class="destination ' + (kind === expeditionKind ? 'active' : '') + '" data-action="expedition-kind" data-kind="' + kind + '" aria-pressed="' + (kind === expeditionKind) + '"><strong>' + escape(trip.name) + '</strong><small>' + escape(trip.description) + '</small><span>' + trip.hours + ' game hours · ' + Math.round(game.expeditionRisk(kind, Math.max(1, party.size)) * 100) + '% injury risk each</span><span class="cost">' + costText(trip.cost) + ' each → ' + costText(trip.reward) + '+</span></button>').join('') + '</div>';
  html += '<div class="section-label">PARTY <span>' + party.size + ' / ' + cap + ' · POPULATION ' + game.survivors.length + '</span></div>';
  html += home.length ? '<div class="candidate-list crew-pick">' + home.slice().sort((a, b) => (b.role === 'scavenger') - (a.role === 'scavenger') || a.id - b.id).map(s => {
    const why = game.expeditionBlock(s, expeditionKind), picked = party.has(s.id), full = !picked && party.size >= cap;
    return '<button class="' + (picked ? 'picked' : '') + '" data-action="toggle-member" data-id="' + s.id + '" aria-pressed="' + picked + '" ' + (why || full ? 'disabled' : '') + ' title="' + escape(why || (full ? 'Party is full' : 'Add ' + s.name)) + '">' + portrait(s) + '<span><strong>' + escape(s.name) + (s.role === 'scavenger' ? ' <em>Scavenger</em>' : '') + '</strong><small>' + escape(roleLabel(s)) + ' · STR ' + s.stats.str + ' · ' + Math.ceil(s.hp) + ' HP · ' + escape(why || (full ? 'Party full' : 'Ready')) + '</small></span><em>' + (picked ? '✓' : why || full ? '—' : '+') + '</em></button>';
  }).join('') + '</div>' : '<p class="menu-footnote">Everyone is already away.</p>';
  html += '<button class="modal-button primary" data-action="depart" ' + (block ? 'disabled' : '') + '>' + (block ? escape(block) : 'Depart · ' + costText(game.partyCost(expeditionKind, party.size)) + ' · back ~' + clockAt(chosen.hours * HOUR_SECONDS)) + '</button>';
  openModal('expeditions', html);
}
function overview() {
  const count = type => game.buildings.filter(b => b.type === type).length;
  const rates = game.rates();
  const repairCost = game.repairAllCost();
  const repairLabel = !repairCost.wood ? 'Everything is fully repaired' : 'Repair everything · ' + costText(repairCost);
  openModal('overview', '<div class="eyebrow">REFUGE 01 / SETTLEMENT REPORT</div><h2>Still standing.</h2><div class="overview-grid"><div>SURVIVORS<strong>' + game.survivors.length + ' / ' + game.capacity + '</strong></div><div>DEAD NEUTRALIZED<strong>' + game.kills + '</strong></div><div>FARMS<strong>' + count('farm') + '</strong></div><div>DORMITORIES<strong>' + count('dorm') + '</strong></div></div><ul class="modal-list"><li><strong>Net production per real minute at 1× (1 game hour = 42 s)</strong><br>' + Object.entries(rates).map(([r, n]) => (n >= 0 ? '+' : '') + (n * 60).toFixed(1) + ' ' + r).join(' · ') + '</li><li><strong>' + count('workshop') + ' workshops · ' + count('barracks') + ' barracks · ' + count('tower') + ' watchtowers · ' + count('barricade') + ' barricades</strong><br>Each survivor consumes 1.44 food per real minute. Build more farms as your population grows.</li><li><strong>Population & housing</strong><br>' + game.survivors.length + ' survivors · ' + game.capacity + ' beds' + (game.unhoused.length ? ' · ' + game.unhoused.length + ' without a bed' : '') + ' · daily food demand ' + Math.round(game.dailyFoodDemand) + ' (' + Math.round(game.dailyFoodDemand / Math.max(1, game.survivors.length)) + ' each). Expedition parties up to ' + game.partyCap + '.</li><li><strong>Armory</strong><br>' + ['pipe', 'pistol', 'rifle'].map(t => game.items.filter(i => i.type === t).length + ' ' + WEAPONS[t].name.toLowerCase() + (game.items.filter(i => i.type === t).length !== 1 ? 's' : '')).join(' · ') + ' · ' + game.survivors.filter(s => !s.gear && !s.expedition).length + ' unarmed. Make more at a workshop.</li><li><strong>Territory</strong><br>' + game.land.length + ' parcels claimed · expand with the LAND button for more room to build.</li><li><strong>Mission progress</strong><br>' + (game.elapsed / (DAY_SECONDS * RUN_DAYS) * 100).toFixed(1) + '% of the 24-day survival run completed.</li></ul><button class="modal-button primary" data-action="close-modal">Return to the refuge</button><button class="modal-button" data-action="repair-all" ' + (!repairCost.wood || !game.afford(repairCost) || game.status !== 'playing' ? 'disabled' : '') + '>' + repairLabel + '</button>');
}
function showEnd() {
  if (endShown) return;
  endShown = true; save(); closeInspector(); cancelPlacement(); cancelExpansion(); $('build-menu').hidden = true;
  const won = game.status === 'won';
  openModal('end', '<div class="eyebrow">' + (won ? 'DAY 24 / MISSION COMPLETE' : 'DAY ' + game.day + ' / REFUGE LOST') + '</div><h2>' + (won ? 'There is an afterlife.' : 'The walls fell silent.') + '</h2><p>' + (won ? 'Twenty-four days after everything ended, your people are still here. You built something that survived.' : 'The dead reached your Refuge HQ. A new beginning is another chance to build stronger defenses and keep every side covered.') + '</p><div class="overview-grid"><div>DAYS REACHED<strong>' + game.day + '</strong></div><div>NEUTRALIZED<strong>' + game.kills + '</strong></div><div>SURVIVORS<strong>' + game.survivors.length + '</strong></div><div>BUILDINGS LEFT<strong>' + game.buildings.filter(b => b.type !== 'barricade').length + '</strong></div></div><button class="modal-button primary" data-action="restart">Begin a new refuge</button>');
}
function reset() {
  game.reset(); party.clear(); endShown = false; paused = false; speed = 1; modalOpen = false; modalKind = ''; $('modal-backdrop').hidden = true;
  closeInspector(); cancelPlacement(); cancelExpansion(); $('build-menu').hidden = true; $('notifications').innerHTML = ''; $('objective').hidden = false;
  save(); updateUI();
}

$('resources').innerHTML = ['wood', 'metal', 'food'].map(r => '<div class="resource"><div class="resource-top"><span class="resource-icon res-' + r + '">' + icon[r] + '</span><strong class="resource-value" id="resource-' + r + '">0</strong></div><span class="resource-label">' + r.toUpperCase() + '</span><span class="resource-rate" id="rate-' + r + '"></span></div>').join('');
function updateUI() {
  const rates = game.rates();
  for (const r of Object.keys(rates)) {
    $('resource-' + r).textContent = Math.floor(game.resources[r]).toLocaleString();
    $('rate-' + r).textContent = (rates[r] >= 0 ? '+' : '') + (rates[r] * 60).toFixed(1) + '/min';
    $('rate-' + r).classList.toggle('negative', rates[r] < 0);
  }
  $('day-label').innerHTML = 'DAY ' + String(game.day).padStart(2, '0') + ' <span>/ 24</span>';
  const hour = Math.floor(game.hour), minute = Math.floor((game.hour - hour) * 60);
  $('clock-label').textContent = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
  const phase = game.phase, horde = game.hordeNight && ['midnight', 'deep'].includes(phase.id);
  $('phase-label').textContent = paused || modalOpen ? 'PAUSED' : horde ? 'HORDE NIGHT' : phase.id === 'midnight' ? 'MIDNIGHT' : phase.name.toUpperCase();
  const hoursLeft = (phase.end - game.hour + 24) % 24 || 24, next = phaseAt(phase.end % 24);
  $('phase-countdown').textContent = (hoursLeft < 1 ? '<1' : Math.floor(hoursLeft)) + 'h until ' + (next.id === 'midnight' ? 'midnight' : next.name.toLowerCase());
  $('day-progress').style.left = (game.elapsed % DAY_SECONDS) / DAY_SECONDS * 100 + '%';
  for (const id of ['dawn', 'day', 'dusk', 'midnight', 'deep']) document.body.classList.toggle('phase-' + id, phase.id === id);
  document.body.classList.toggle('night', game.night); document.body.classList.toggle('paused', paused || modalOpen);
  document.body.classList.toggle('horde', game.hordeNight);
  $('pause-button').textContent = paused ? '▶' : 'Ⅱ'; $('pause-button').ariaLabel = paused ? 'Resume game' : 'Pause game';
  $('pause-button').classList.toggle('active', paused);
  for (const b of document.querySelectorAll('[data-speed]')) b.classList.toggle('active', Number(b.dataset.speed) === speed);
  const integrity = game.core ? game.core.hp / buildingMaxHP(game.core) * 100 : 0;
  $('integrity-label').textContent = Math.ceil(integrity) + '%'; $('integrity-bar').style.width = integrity + '%'; $('integrity-bar').classList.toggle('low', integrity < 35);
  const hostiles = game.zombies.length, count = hostiles + ' HOSTILE' + (hostiles !== 1 ? 'S' : ''), state = game.director.state;
  $('threat-label').textContent = game.incoming ? 'INCURSION INBOUND · ' + count : state === 'peak' ? 'INCURSION · ' + count : state === 'relief' ? 'RESPITE' + (hostiles ? ' · ' + count : '') : state === 'buildup' ? 'THE DEAD ARE STIRRING · ' + count : hostiles ? count + ' NEARBY' : 'PERIMETER QUIET';
  $('threat-label').parentElement.classList.toggle('danger', !!game.incoming || state === 'peak' || hostiles > 12);
  const alert = $('edge-alert'), edge = game.incoming && ['north', 'east', 'south', 'west'][game.incoming.side];
  alert.hidden = !edge; document.body.classList.toggle('alert-north', edge === 'north');
  if (edge) {
    alert.className = 'edge-alert edge-' + edge;
    alert.innerHTML = '<span>' + { north: '▲', east: '▶', south: '▼', west: '◀' }[edge] + ' INCOMING SWARM · ' + edge.toUpperCase() + ' · ' + Math.ceil(game.incoming.eta) + 's<small>' + (game.incoming.spotted ? 'Spotted by a watchtower sentry' : 'About ' + game.incoming.count + ' of the dead') + '</small></span>';
  }
  $('kill-count').textContent = game.kills + ' NEUTRALIZED';
  const away = game.survivors.filter(s => s.expedition).length;
  $('expedition-badge').textContent = away; $('expedition-badge').hidden = !away;
  $('alarm-button').classList.toggle('raised', game.alarm.raised); $('alarm-button').setAttribute('aria-pressed', game.alarm.raised);
  $('alarm-button').title = game.alarm.raised ? 'Lower the alarm' : 'Raise the alarm: guards hold positions and chase known threats';
  const shelter = game.shelterOrder && game.buildings.find(b => b.id === game.shelterOrder.buildingId);
  $('order-banner').hidden = !shelter && !game.alarm.raised;
  if (!$('order-banner').hidden) {
    const inside = game.survivors.filter(s => s.sheltered && !s.resting).length, moving = game.survivors.filter(s => s.shelter != null && !s.sheltered).length;
    const html = (game.alarm.raised ? '<span><strong>ALARM RAISED</strong> · guards on alert · <button data-action="alarm">Lower</button></span>' : '') + (shelter ? '<span><strong>SHELTERING</strong> in the ' + BUILDINGS[shelter.type].name.toLowerCase() + ' · ' + inside + ' inside' + (moving ? ' · ' + moving + ' on the way' : '') + ' · <button data-action="all-clear">All clear</button></span>' : '');
    if ($('order-banner').innerHTML !== html) $('order-banner').innerHTML = html;
  }
  renderRoster(); refreshInspector(); refreshBuildMenu();
  const warnings = game.warnings();
  $('warnings').innerHTML = warnings.map(w => '<p class="warning-line">' + escape(w) + '</p>').join('');
  $('warnings').hidden = !warnings.length;
  if (view.placement) {
    const { type, rotation } = view.placement;
    $('placement-status').textContent = game.canPlace(type, Math.round(view.pointer.x / 16) * 16, Math.round(view.pointer.y / 16) * 16, rotation).reason;
  }
  if (expanding) $('expansion-status').textContent = 'Click a highlighted plot to claim it · ' + costText(game.landCost);
  if (game.trader && !view.placement && !expanding) {
    $('trader-banner').hidden = false;
    const traderHTML = '<strong>TRADER AVAILABLE</strong><p>' + costText(game.trader.give) + ' → ' + costText(game.trader.get) + ' · <span id="trader-time"></span>s left</p><div class="action-row"><button data-action="accept-trade" ' + (!game.afford(game.trader.give) || game.status !== 'playing' ? 'disabled' : '') + '>Accept trade</button><button class="danger-button" data-action="dismiss-trade">Not now</button></div>';
    if ($('trader-banner').dataset.html !== traderHTML) { $('trader-banner').innerHTML = traderHTML; $('trader-banner').dataset.html = traderHTML; }
    $('trader-time').textContent = Math.ceil(game.trader.remaining);
  } else $('trader-banner').hidden = true;
  while (game.events.length) { const e = game.events.shift(); toast(e.title, e.message, e.tone); }
  if (game.status !== 'playing') showEnd();
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === 'pause') paused = !paused;
  if (action === 'speed') { speed = Number(button.dataset.speed); paused = false; }
  if (action === 'help') help();
  if (action === 'settings') settings();
  if (action === 'overview') overview();
  if (action === 'close-modal') closeModal();
  if (action === 'save') save(true);
  if (action === 'restart-confirm') openModal('confirm', '<div class="eyebrow">NEW BEGINNING</div><h2>Leave this refuge?</h2><p>This replaces your current saved run with a fresh settlement on Day 1.</p><button class="modal-button danger" data-action="restart">Start over</button><button class="modal-button primary" data-action="close-modal">Keep this refuge</button>');
  if (action === 'restart') reset();
  if (action === 'dismiss-objective') $('objective').hidden = true;
  if (action === 'toggle-roster') { rosterOpen = !rosterOpen; $('roster-content').hidden = !rosterOpen; $('roster-chevron').textContent = rosterOpen ? '−' : '+'; }
  if (action === 'select-survivor') select({ kind: 'survivor', id: Number(button.dataset.id) });
  if (action === 'close-inspector') closeInspector();
  if (action === 'inspector-tab' && active) { inspectorTab = button.dataset.tab; renderInspector(); positionInspector(); }
  if (action === 'toggle-picker' && active) { pickerOpen = !pickerOpen; renderInspector(); positionInspector(); }
  if (action === 'build-menu') buildMenu();
  if (action === 'place') startPlacement(button.dataset.type);
  if (action === 'cancel-placement') cancelPlacement();
  if (action === 'rotate' && view.placement) view.placement.rotation = view.placement.rotation ? 0 : 1;
  if (action === 'expand-land') toggleExpansion();
  if (action === 'cancel-expansion') cancelExpansion();
  if (action === 'repair-all') { game.repairAll(); overview(); }
  if (action === 'accept-trade') { game.trade(); save(); }
  if (action === 'dismiss-trade') game.dismissTrader();
  if (action === 'recruit') recruits();
  if (action === 'broadcast') { game.recruit(); recruits(); save(); }
  if (action === 'accept-candidate') { const s = game.acceptCandidate(Number(button.dataset.id)); if (s) { save(); closeModal(); select({ kind: 'survivor', id: s.id }); } else recruits(); }
  if (action === 'decline-candidate') { game.declineCandidate(Number(button.dataset.id)); recruits(); save(); }
  if (action === 'attack' && active?.kind === 'zombie') { const r = game.orderAttack(active.id); if (!r.ok) toast('No one can respond', r.reason, 'warn'); renderInspector(); }
  if (action === 'cancel-attack' && active?.kind === 'zombie') { game.cancelAttack(active.id); renderInspector(); }
  if (action === 'alarm') { if (game.alarm.raised) game.clearAlarm(); else game.raiseAlarm(); save(); }
  if (action === 'shelter' && active) { game.orderShelter(active.id); renderInspector(); save(); }
  if (action === 'all-clear') { game.clearShelter(); if (active) renderInspector(); save(); }
  if (action === 'fabricate') { game.fabricate(button.dataset.type); renderInspector(); save(); }
  if (action === 'toggle-member') { const id = Number(button.dataset.id); if (party.has(id)) party.delete(id); else party.add(id); expeditions(); }
  if (action === 'depart') { if (game.sendExpedition([...party], expeditionKind)) { party.clear(); if (active) renderInspector(); save(); } expeditions(); }
  if (action === 'assign' && active) { game.assign(active.id, button.dataset.side); renderInspector(); }
  if (action === 'post' && active) { game.post(Number(button.dataset.id), button.dataset.building === 'scavenger' ? 'scavenger' : Number(button.dataset.building)); renderInspector(); save(); }
  if (action === 'post-here' && active) { game.post(Number(button.dataset.id), active.id); const b = selectedEntity(); if (!b || game.staffOf(b).length >= postSlots(b)) pickerOpen = false; renderInspector(); save(); }
  if (action === 'unpost' && active) { game.post(Number(button.dataset.id), null); renderInspector(); save(); }
  if (action === 'expeditions') expeditions();
  if (action === 'expedition-kind') { expeditionKind = button.dataset.kind; expeditions(); }
  if (action === 'upgrade' && active) {
    game.upgradeBuilding(active.id, button.dataset.upgrade);
    renderInspector(); save();
  }
  if (action === 'repair' && active) { game.repair(active.id); refreshInspector(); }
  if (action === 'demolish' && active && selectedEntity()) {
    const e = selectedEntity();
    openModal('demolish', '<div class="eyebrow">RECLAIM MATERIALS</div><h2>Dismantle ' + BUILDINGS[e.type].name + '?</h2><p>You will recover half its original construction cost. Its upgrades will be lost.' + (e.type === 'dorm' ? ' Losing these beds will block recruitment until you have room again.' : '') + '</p><button class="modal-button danger" data-action="demolish-confirm">Dismantle building</button><button class="modal-button primary" data-action="close-modal">Keep building</button>');
  }
  if (action === 'demolish-confirm' && active) { game.demolish(active.id); closeModal(); closeInspector(); save(); }
  updateUI();
});
view.app.view.addEventListener('pointermove', event => {
  view.pointer = view.toWorld(event.clientX, event.clientY);
  const hit = view.placement || expanding ? null : view.hit(view.pointer);
  view.hovered = hit;
  document.body.classList.toggle('hover-zombie', hit?.kind === 'zombie');
  const tip = $('hover-tip');
  if (!hit || active || modalOpen) { tip.hidden = true; return; }
  const e = (hit.kind === 'building' ? game.buildings : hit.kind === 'zombie' ? game.zombies : game.survivors).find(e => e.id === hit.id);
  if (!e) { tip.hidden = true; return; }
  tip.innerHTML = escape(hit.kind === 'building' ? BUILDINGS[e.type].name : hit.kind === 'zombie' ? { walker: 'Walker', runner: 'Runner', brute: 'Brute' }[e.kind] : e.name) + '<small>' + (hit.kind === 'building' ? 'CLICK TO INSPECT & UPGRADE' : hit.kind === 'zombie' ? 'CLICK TO ORDER AN ATTACK' : dutyLabel(e) + ' · ' + taskText(e)) + '</small>';
  tip.hidden = false; tip.style.left = Math.min(event.clientX + 18, innerWidth - tip.offsetWidth - 10) + 'px'; tip.style.top = Math.max(10, event.clientY - 46) + 'px';
});
view.app.view.addEventListener('pointerleave', () => { view.hovered = null; document.body.classList.remove('hover-zombie'); $('hover-tip').hidden = true; });
view.app.view.addEventListener('click', event => {
  if (modalOpen) return;
  const point = view.toWorld(event.clientX, event.clientY);
  if (view.placement) {
    const { type, rotation } = view.placement;
    const b = game.build(type, Math.round(point.x / 16) * 16, Math.round(point.y / 16) * 16, rotation);
    if (b) save(); // Stay in placement mode so the next one goes down with another click.
  } else if (expanding) {
    const { col, row } = parcelAt(point);
    if (game.buyLand(col, row)) { save(); renderExpansionBanner(); }
  } else select(view.hit(point));
  $('hover-tip').hidden = true; updateUI();
});
view.app.view.addEventListener('contextmenu', event => { event.preventDefault(); cancelPlacement(); cancelExpansion(); closeInspector(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Tab' && modalOpen) {
    const buttons = [...$('modal').querySelectorAll('button:not(:disabled)')];
    if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); }
    return;
  }
  if (event.repeat) return;
  if (event.key === 'Escape') { if (modalOpen) closeModal(); else { cancelPlacement(); cancelExpansion(); closeInspector(); $('build-menu').hidden = true; } updateUI(); return; }
  if (modalOpen) return;
  if (event.code === 'Space') { event.preventDefault(); paused = !paused; }
  if (event.key.toLowerCase() === 'b') buildMenu();
  if (event.key.toLowerCase() === 'l') toggleExpansion();
  if (event.key.toLowerCase() === 'e') { cancelPlacement(); cancelExpansion(); expeditions(); }
  if (event.key.toLowerCase() === 'r' && view.placement) view.placement.rotation = view.placement.rotation ? 0 : 1;
  updateUI();
});
window.addEventListener('resize', () => { if (active) positionInspector(); });
window.addEventListener('pagehide', () => save());
document.addEventListener('visibilitychange', () => { lastTime = performance.now(); if (document.hidden) save(); });

view.app.ticker.stop();
let drawFailed = false;
function frame(now) {
  // The first frame can be stamped before lastTime; never step backwards.
  const dt = Math.max(0, Math.min((now - lastTime) / 1000, .12)); lastTime = now;
  if (!document.hidden) {
    realTime += dt;
    if (!paused && !modalOpen) game.step(dt * speed);
    // A drawing error is reported once and must not stop the loop (and the HUD with it).
    try { view.draw(paused || modalOpen ? game.elapsed : realTime); } catch (error) { if (!drawFailed) console.error('Map drawing failed', error); drawFailed = true; }
    view.app.renderer.render(view.app.stage);
    uiTimer += dt; saveTimer += dt;
    if (uiTimer >= .2) { updateUI(); uiTimer = 0; }
    if (saveTimer >= 5) { save(); saveTimer = 0; }
  }
  requestAnimationFrame(frame);
}
$('loading').hidden = true;
// Pixel HUD skin (Survival HUD Kit); the original CSS stays as the fallback if it fails.
applyHudSkin().catch(error => console.warn('HUD skin unavailable', error));
if (saved) game.notify('Welcome back', 'Your refuge is exactly where you left it.', 'good');
updateUI();
requestAnimationFrame(frame);
