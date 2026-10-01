// Afterlife Content Studio. Edits backend/data/*.json through /api/content and publishes it into the
// game as web/src/engine/gameContent.mjs. No build step: served as-is by server.py at /dashboard.
'use strict';

const API = '/api/content';
const RESOURCES = ['wood', 'scrap_metal', 'food'];
const STATS = ['str', 'agi', 'end', 'int', 'cha'];
const STAT_NAMES = { str: 'Strength', agi: 'Agility', end: 'Endurance', int: 'Intelligence', cha: 'Charisma' };
const OBJECTIVES = { build: 'Build structures', staff: 'Post workers', fell: 'Fell trees', survivors: 'Reach population', day: 'Reach day', kills: 'Put down the dead', upgrades: 'Own upgrades', land: 'Claim land parcels' };
const TRIGGERS = { game_start: 'Game start', quest_start: 'Quest starts', quest_complete: 'Quest completes', rank_earned: 'Status earned', day: 'Day reached', event: 'Game event', manual: 'Manual / scripted' };
const BRANCHES = ['defense', 'industry', 'medicine', 'recon'];
const PERK_TYPES = ['combat', 'survival', 'work', 'leadership'];
const TONES = { '': 'Neutral', good: 'Good news', warn: 'Warning' };
const CHAPTER_COLORS = ['#e0a84a', '#7eaac9', '#8fbf6a', '#d98e8e', '#b79be0', '#c9b27f', '#6fc2b0', '#e39a6b'];
const ART_ALIAS = { core: 'town_hall', dorm: 'bunkhouse' };

const CATS = {
  buildables: { label: 'Buildables', icon: '⌂', live: true, blurb: 'Every structure: footprint, integrity, cost and look. Tie job posts to them and give them upgrade trees. Quests decide when each can be built.' },
  jobs: { label: 'Jobs & Posts', icon: '⚒', live: true, blurb: 'Jobs are careers; posts are the assignments survivors take. A post tied to a buildable is staffed there, with a number of slots.' },
  quests: { label: 'Quests', icon: '✉', live: true, ordered: true, title: 'title', blurb: 'The orders from Command, run one at a time in this order. Each waits for its status, and unlocks structures when done.' },
  ranks: { label: 'Statuses', icon: '★', live: true, ordered: true, blurb: 'The settlement\'s status ladder. Milestones raise it; each status allows deeper upgrade tiers and releases a supply drop.' },
  chapters: { label: 'Chapters', icon: '❡', ordered: true, title: 'title', blurb: 'The story\'s chapters. Quests and messages belong to a chapter; the campaign flow shows them in play order.' },
  characters: { label: 'Characters', icon: '☺', blurb: 'Who speaks in the story: quest givers and the senders of messages.' },
  messages: { label: 'Messages', icon: '✎', title: 'subject', blurb: 'Radio messages and notes, each with the moment that triggers it.' },
  research: { label: 'Research', icon: '⚗', blurb: 'Research projects for the lab, as a tree. Exported with the game content; the engine doesn\'t run research yet.' },
  job_perks: { label: 'Job Perks', icon: '◆', blurb: 'Perk trees per job. Exported with the game content; not simulated yet.' },
  survivor_perks: { label: 'Survivor Perks', icon: '✦', blurb: 'Personal perks survivors can learn. Exported with the game content; not simulated yet.' },
  expeditions: { label: 'Expeditions', icon: '➚', live: true, blurb: 'Supply runs from the tablet: duration, cost, reward, risk and who might be found.' },
  weapons: { label: 'Weapons', icon: '⚔', live: true, blurb: 'Gear survivors fight with. Fists are the fallback.' },
  // The AfterLife campaign (Phases 0-2). Exported together as CAMPAIGN; the engine adopts them milestone by milestone.
  campaign_tasks: { label: 'Tasks', icon: '☑', ordered: true, title: 'title', campaign: true, blurb: 'The campaign chain P1-01 to P2-13 and side tasks S01-S05: copy from CentroCom and Mara Venn, objectives, rewards, unlocks and the two certifications.' },
  campaign_buildings: { label: 'Structures', icon: '⌂', campaign: true, blurb: 'Campaign structures B00-B29: footprint in tiles, cost, labor hours, workers and capacities.' },
  campaign_recipes: { label: 'Recipes', icon: '⚙', campaign: true, blurb: 'Crafting recipes C01-C11: station, inputs, output and labor hours.' },
  campaign_items: { label: 'Equipment', icon: '⚔', campaign: true, blurb: 'Weapons and medical items held in the shared equipment stock.' },
  campaign_resources: { label: 'Resources', icon: '▤', campaign: true, blurb: 'The twelve ledger resources and their unit weights for storage.' },
  campaign_sites: { label: 'Regional Sites', icon: '⌖', campaign: true, blurb: 'Scavenging sites, recurring routes and story sites. Each is placed on a generated map location by band (distance from camp) and preferred location type.' },
  campaign_expeditions: { label: 'Expeditions', icon: '➚', campaign: true, blurb: 'Authored expeditions E01-E03 with their encounter cards.' },
  campaign_jobs: { label: 'Jobs', icon: '◆', campaign: true, blurb: 'The six campaign jobs: the attribute each works with and its labor multiplier.' },
  campaign_traits: { label: 'Traits', icon: '✦', campaign: true, blurb: 'Survivor traits: at most two each, at most one drawback.' },
  campaign_difficulties: { label: 'Difficulties', icon: '◐', campaign: true, blurb: 'Standard, Assisted and Severe: resource and threat multipliers.' },
  campaign_strings: { label: 'Copy & Alerts', icon: '✎', title: 'id', campaign: true, blurb: 'The recruitment letter (Appendix A), alert copy (Appendix B) and other text. Lines marked GENERATED were written for the game, not taken from the design document.' },
  campaign_tuning: { label: 'Tuning', icon: '⚖', campaign: true, blurb: 'Every number the campaign runs on, in groups. Balance changes go here, never into code.' },
};
const CAMPAIGN_CATS = Object.keys(CATS).filter(k => CATS[k].campaign);
const NAV = [
  { items: [['overview', '◎', 'Overview']] },
  { title: 'World', items: [['buildables'], ['jobs'], ['trees', '⑂', 'Upgrade Trees']] },
  { title: 'Campaign & Story', items: [['campaign', '↧', 'Campaign Flow'], ['quests'], ['ranks'], ['chapters'], ['characters'], ['messages']] },
  { title: 'Progression', items: [['research', '⚗', 'Research Tree'], ['job_perks'], ['survivor_perks']] },
  { title: 'Field', items: [['expeditions'], ['weapons']] },
  { title: 'AfterLife Campaign', items: CAMPAIGN_CATS.map(k => [k]) },
  { items: [['issues', '⚠', 'Issues']] },
];

const S = { art: new Set(), content: {}, validation: { errors: [], warnings: [] }, campaign: null, hooks: null, summary: null, editor: null, dirty: false, search: {} };
const $view = document.getElementById('view');

// ---------------------------------------------------------------- Helpers
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'value') value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  if (value !== undefined) el.value = value;
  return el;
}
const clone = o => JSON.parse(JSON.stringify(o));
const enc = encodeURIComponent;
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : w.endsWith('s') ? 'es' : 's');
const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
function setPath(o, path, v) {
  const keys = path.split('.'), last = keys.pop();
  const target = keys.reduce((a, k) => (a[k] ??= {}), o);
  if (v === undefined) delete target[last]; else target[last] = v;
}
const items = cat => S.content[cat] || [];
const byId = (cat, id) => items(cat).find(i => i.id === id);
const titleOf = (cat, item) => item ? item[CATS[cat]?.title || 'name'] || item.id : '';
const link = (cat, id) => '#/' + cat + (id ? '/' + enc(id) : '');
const go = hash => { if (location.hash === hash) render(); else location.hash = hash; };
const allRoles = () => items('jobs').flatMap(j => (j.roles || []).map(r => ({ ...r, job: j.id, jobName: j.name })));
const hostOf = bid => allRoles().find(r => r.building === bid);
const chapterColor = id => CHAPTER_COLORS[Math.max(0, items('chapters').findIndex(c => c.id === id)) % CHAPTER_COLORS.length];
const artUrl = bid => 'art/Buildings/' + (ART_ALIAS[bid] || bid) + '.png';
const character = id => byId('characters', id);

function resText(cost, empty = 'free') {
  const entries = Object.entries(cost || {});
  if (!entries.length) return h('span', { class: 'faint small' }, empty);
  return h('span', { class: 'row wrap', style: { gap: '8px', display: 'inline-flex' } }, entries.map(([r, n]) => h('span', { class: 'res res-' + r }, n + ' ' + r)));
}
function objectiveText(x) {
  const n = x.count;
  switch (x.kind) {
    case 'fell': return `Fell ${plural(n, 'tree')}`;
    case 'build': { const name = (byId('buildables', x.type)?.name || x.type || '?').toLowerCase(); return `Build ${n > 1 ? n + ' ' : 'a '}${name}${n > 1 ? 's' : ''}`; }
    case 'staff': return `Post ${n > 1 ? n + ' ' : 'a '}${x.role || '?'}${n > 1 ? 's' : ''}`;
    case 'survivors': return `Reach ${n} survivors`;
    case 'day': return `Hold out until day ${n}`;
    case 'kills': return `Put down ${n} of the dead`;
    case 'upgrades': return `Own ${plural(n, 'upgrade')}`;
    case 'land': return `Claim ${plural(n, 'new parcel')} of land`;
    default: return x.kind;
  }
}
// Depth of an upgrade in its building's tree (1 for a root), as the engine counts it.
function upgradeDepth(tree, node) {
  let depth = 1, n = node; const seen = new Set([node.id]);
  while (n?.requires) { n = tree.find(p => p.id === n.requires); if (!n || seen.has(n.id)) break; seen.add(n.id); depth++; }
  return depth;
}
const rankForTier = tier => items('ranks').find(r => r.tier >= tier);
function issuesFor(cat, id) {
  const m = x => x.category === cat && x.id === id;
  return { errors: S.validation.errors.filter(m), warnings: S.validation.warnings.filter(m) };
}
function hookRefs(kind, key) { return S.hooks?.[kind]?.[key] || []; }
function hookChip(kind, key, { missing = 'no code', tone = 'warn' } = {}) {
  const refs = hookRefs(kind, key);
  const n = refs.reduce((a, r) => a + r.count, 0);
  return n ? h('span', { class: 'chip good', title: refs.map(r => r.file + ' ×' + r.count).join('\n') }, '⚙ coded · ' + n)
    : h('span', { class: 'chip ' + tone, title: 'Nothing in web/src refers to this id. It exists in the game but has no special behaviour.' }, missing);
}

// ---------------------------------------------------------------- API
async function api(method, path, body) {
  const res = await fetch(API + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data;
}
async function loadArt() {
  S.art = new Set((await api('GET', '/art')).buildings);
}
async function refreshAll() {
  const [all, validation, summary, campaign, hooks] = await Promise.all([
    api('GET', '/all'), api('GET', '/validate'), api('GET', '/summary'), api('GET', '/campaign'), api('GET', '/hooks'),
  ]);
  Object.assign(S, { content: all, validation, summary, campaign, hooks });
  renderChrome();
}
function toast(message, tone = 'good') {
  const t = h('div', { class: 'toast ' + tone }, message);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), tone === 'bad' ? 7000 : 3500);
}
async function attempt(fn) {
  try { return await fn(); } catch (e) { toast(e.message, 'bad'); return undefined; }
}

// ---------------------------------------------------------------- Modal
function modal(title, body, actions = [], wide = false) {
  const root = document.getElementById('modal-root');
  const close = () => root.replaceChildren();
  const back = h('div', { class: 'modal-back', onclick: e => { if (e.target === back) close(); } },
    h('div', { class: 'modal' + (wide ? ' wide' : '') },
      h('div', { class: 'card-head' }, h('h2', null, title), h('button', { class: 'btn ghost icon', onclick: close }, '✕')),
      h('div', { class: 'card-pad stack' }, body),
      actions.length ? h('div', { class: 'editor-foot', style: { justifyContent: 'flex-end' } }, actions.map(a => h('button', { class: 'btn ' + (a.class || ''), onclick: async () => { if ((await a.run?.()) !== false) close(); } }, a.label))) : null));
  root.replaceChildren(back);
  back.querySelector('input,select,textarea')?.focus();
  return close;
}
function confirmModal(title, message, label = 'Confirm', danger = false) {
  return new Promise(resolve => {
    modal(title, h('div', null, message), [
      { label: 'Cancel', run: () => resolve(false) },
      { label, class: danger ? 'danger' : 'primary', run: () => resolve(true) },
    ]);
  });
}
function askId(title, { suggestion = '', nameLabel = 'Name', name = '' } = {}) {
  return new Promise(resolve => {
    const idInput = h('input', { class: 'mono', value: suggestion, placeholder: 'lowercase_id' });
    const nameInput = h('input', { value: name, oninput: () => { if (!idInput.dataset.touched) idInput.value = slug(nameInput.value); } });
    idInput.addEventListener('input', () => { idInput.dataset.touched = '1'; });
    modal(title, [
      h('div', { class: 'field' }, h('label', null, nameLabel), nameInput),
      h('div', { class: 'field' }, h('label', null, 'Id', h('span', { class: 'hint' }, 'what the game and other content refer to')), idInput),
    ], [
      { label: 'Cancel', run: () => resolve(null) },
      { label: 'Create', class: 'primary', run: () => { if (!/^[a-z][a-z0-9_]*$/.test(idInput.value)) { toast('Ids use lowercase letters, digits and underscores, starting with a letter.', 'bad'); return false; } resolve({ id: idInput.value, name: nameInput.value.trim() }); } },
    ]);
    setTimeout(() => nameInput.focus(), 0);
  });
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'n$1');

// ---------------------------------------------------------------- Chrome
function renderChrome() {
  const route = currentRoute();
  const nav = document.getElementById('nav');
  nav.replaceChildren(...NAV.map(group => h('div', { class: 'nav-group' }, group.title && h('h4', null, group.title),
    group.items.map(([key, icon, label]) => {
      const cat = CATS[key];
      const errs = cat ? S.validation.errors.filter(e => e.category === key).length : 0;
      const warns = cat ? S.validation.warnings.filter(e => e.category === key).length : 0;
      const active = route.page === key || (key === 'trees' && route.page === 'trees');
      return h('a', { class: 'nav-link' + (active ? ' active' : ''), href: '#/' + (key === 'overview' ? '' : key) },
        h('span', { class: 'ico' }, icon || cat.icon), h('span', null, label || cat.label),
        cat?.live && h('span', { class: 'live-tag', title: 'Read by the game when published' }, 'LIVE'),
        errs ? h('span', { class: 'dot', title: errs + ' errors' }) : warns ? h('span', { class: 'dot warn', title: warns + ' warnings' }) : null,
        cat && h('span', { class: 'count' }, items(key).length),
        key === 'issues' && h('span', { class: 'count' }, S.validation.error_count + S.validation.warning_count));
    }))));
  const pill = document.getElementById('issues-pill');
  const e = S.validation.error_count || 0, w = S.validation.warning_count || 0;
  pill.className = 'pill ' + (e ? 'bad' : w ? 'warn' : 'good');
  pill.textContent = e ? `${plural(e, 'error')} · ${w} warnings` : w ? plural(w, 'warning') : 'No issues';
  pill.onclick = () => go('#/issues');
  const state = document.getElementById('publish-state');
  state.className = 'pill ' + (S.summary?.published ? 'good' : 'warn');
  state.textContent = S.summary?.published ? 'Game is up to date' : 'Unpublished changes';
  state.title = S.summary?.output || '';
  const btn = document.getElementById('publish-btn');
  btn.disabled = !!e;
  btn.title = e ? 'Fix the errors first: the game would not load this content' : 'Write ' + (S.summary?.output || 'gameContent.mjs');
}
function crumbs(...parts) {
  document.getElementById('crumbs').replaceChildren(...parts.flatMap((p, i) => [i ? h('span', { class: 'faint' }, '/') : '', i === parts.length - 1 ? h('b', null, p) : p]));
}

// ---------------------------------------------------------------- Routing
function currentRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { page: parts[0] || 'overview', args: parts.slice(1) };
}
let lastHash = location.hash;
window.addEventListener('hashchange', () => {
  if (S.dirty && !confirm('Discard unsaved changes?')) { history.replaceState(null, '', lastHash); return; }
  S.dirty = false;
  lastHash = location.hash;
  render();
});
window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (S.editor?.save && S.dirty) S.editor.save(); }
});

function render() {
  S.editor = null;
  S.dirty = false;
  const { page, args } = currentRoute();
  renderChrome();
  const pages = { overview: renderOverview, trees: renderTrees, campaign: renderCampaign, research: renderResearch, issues: renderIssues };
  const scroll = $view.scrollTop;
  $view.replaceChildren();
  if (pages[page]) pages[page](args);
  else if (CATS[page]) renderCategory(page, args[0]);
  else renderOverview();
  if (S.keepScroll) { $view.scrollTop = scroll; S.keepScroll = false; } else $view.scrollTop = 0;
}

// ---------------------------------------------------------------- Global actions
document.addEventListener('click', async e => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'publish') {
    if (S.dirty && !(await confirmModal('Unsaved changes', 'The editor has unsaved changes. Publish what is saved?', 'Publish saved content'))) return;
    const res = await attempt(() => api('POST', '/publish'));
    if (res) { toast(res.changed ? `Published to ${res.path}. The dev server reloads the game.` : 'The game already has this content.'); await refreshAll(); }
  } else if (action === 'export') {
    const blob = new Blob([JSON.stringify(S.content, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'afterlife-content.json' });
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (action === 'import') {
    document.getElementById('import-file').click();
  } else if (action === 'reset') {
    if (!(await confirmModal('Reset to shipped content', 'Replace all content with the defaults in backend/seed/? The current files are kept as backups in backend/data/backups/.', 'Reset everything', true))) return;
    if (await attempt(() => api('POST', '/reset-defaults'))) { toast('Content reset to the shipped defaults.'); await refreshAll(); render(); }
  }
});
document.getElementById('import-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast('That file is not valid JSON.', 'bad'); return; }
  const cats = Object.keys(data).filter(k => CATS[k] && Array.isArray(data[k]));
  if (!cats.length) { toast('No content categories found in that file.', 'bad'); return; }
  modal('Import content', [h('p', null, `Found ${cats.map(c => `${data[c].length} ${CATS[c].label.toLowerCase()}`).join(', ')}.`),
    h('p', { class: 'muted' }, 'Merge adds new items and overwrites ones with the same id. Replace swaps out each category in the file entirely.')], [
    { label: 'Cancel' },
    { label: 'Replace', class: 'danger', run: () => doImport(data, 'replace') },
    { label: 'Merge', class: 'primary', run: () => doImport(data, 'merge') },
  ]);
});
async function doImport(data, mode) {
  const res = await attempt(() => api('POST', '/import', { data, mode }));
  if (res) { toast(`Imported (${mode}). ${res.error_count} errors, ${res.warning_count} warnings.`, res.error_count ? 'warn' : 'good'); await refreshAll(); render(); }
}

// ---------------------------------------------------------------- Field widgets
// Each widget calls set(value) with the new value; `ed.changed(true)` rebuilds the editor for
// changes that reshape other fields.
function optionList(options) {
  return (options || []).map(o => typeof o === 'string' ? { value: o, label: o } : o);
}
function selectEl(value, options, onchange, { blank } = {}) {
  const opts = optionList(options);
  const known = value == null || value === '' || opts.some(o => o.value === value);
  return h('select', { value: value ?? '', onchange: e => onchange(e.target.value) },
    blank != null && h('option', { value: '' }, blank),
    !known && h('option', { value }, value + ' (missing)'),
    opts.map(o => h('option', { value: o.value, disabled: o.disabled }, o.label)));
}
function costWidget(value, set, { extra = [] } = {}) {
  const box = h('div', { class: 'cost-row' });
  const kinds = [...RESOURCES, ...extra];
  const draw = () => {
    const cost = value || {};
    box.replaceChildren(
      ...Object.entries(cost).map(([r, n]) => h('span', { class: 'cost-chip' },
        h('span', { class: 'res res-' + r }, r),
        h('input', { type: 'number', min: 0, step: 1, value: n, oninput: e => { cost[r] = e.target.value === '' ? 0 : Number(e.target.value); set(cost); } }),
        h('button', { class: 'btn ghost icon small', title: 'Remove', onclick: () => { delete cost[r]; value = cost; set(cost); draw(); } }, '✕'))),
      kinds.some(r => !(r in cost)) ? selectEl('', kinds.filter(r => !(r in cost)).map(r => ({ value: r, label: '+ ' + r })), r => { if (!r) return; cost[r] = 10; value = cost; set(cost); draw(); }, { blank: '+ add' }) : '',
      Object.keys(cost).length ? '' : h('span', { class: 'faint small' }, 'free'));
    box.querySelectorAll('select').forEach(el => { el.style.width = 'auto'; });
  };
  draw();
  return box;
}
function refsWidget(value, options, set, { placeholder = '+ add' } = {}) {
  const box = h('div', { class: 'chips' });
  const opts = optionList(options);
  const draw = () => {
    const list = value || [];
    box.replaceChildren(
      ...list.map(v => h('span', { class: 'chip' + (opts.some(o => o.value === v) ? '' : ' bad') }, opts.find(o => o.value === v)?.label || v,
        h('button', { title: 'Remove', onclick: () => { value = list.filter(x => x !== v); set(value); draw(); } }, '×'))),
      h('span', { style: { display: 'inline-block' } }, selectEl('', opts.filter(o => !list.includes(o.value)), v => { if (!v) return; value = [...list, v]; set(value); draw(); }, { blank: placeholder })));
    box.querySelectorAll('select').forEach(s => { s.style.width = 'auto'; s.style.padding = '2px 6px'; });
  };
  draw();
  return box;
}
function parseLoose(text) {
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text.trim() !== '' && !isNaN(Number(text))) return Number(text);
  return text;
}
function kvWidget(value, set, { keyOptions, keyPlaceholder = 'effect', valuePlaceholder = 'value' } = {}) {
  const box = h('div', { class: 'subtable' });
  const draw = () => {
    const obj = value || {};
    const entries = Object.entries(obj);
    const rename = (oldKey, newKey) => {
      const next = {};
      for (const [k, v] of Object.entries(obj)) next[k === oldKey ? newKey : k] = v;
      value = next; set(next);
    };
    box.replaceChildren(...entries.map(([k, v]) => h('div', { class: 'kv-row' },
      keyOptions ? selectEl(k, keyOptions, nk => { rename(k, nk); draw(); }) : h('input', { class: 'mono', value: k, placeholder: keyPlaceholder, onchange: e => { rename(k, e.target.value.trim() || k); draw(); } }),
      h('input', { value: typeof v === 'object' ? JSON.stringify(v) : String(v), placeholder: valuePlaceholder, oninput: e => { value[k] = parseLoose(e.target.value); set(value); } }),
      h('button', { class: 'btn ghost icon', title: 'Remove', onclick: () => { const next = { ...obj }; delete next[k]; value = next; set(next); draw(); } }, '✕'))),
    h('div', null, h('button', { class: 'btn small', onclick: () => {
      const options = keyOptions ? optionList(keyOptions).map(o => o.value) : [];
      let key = keyOptions ? options.find(o => !(o in obj)) : 'new_effect';
      if (!key) return;
      for (let i = 2; key in obj; i++) key = 'new_effect_' + i;
      value = { ...obj, [key]: keyOptions ? 5 : 0 }; set(value); draw();
    } }, '+ add')));
  };
  draw();
  return box;
}
function objectivesWidget(value, set) {
  const box = h('div', { class: 'subtable' });
  const buildOpts = items('buildables').map(b => ({ value: b.id, label: `${b.icon} ${b.name}` + (b.fixture ? ' (fixture)' : '') }));
  const roleOpts = allRoles().map(r => ({ value: r.id, label: `${r.icon} ${r.name} (${r.jobName})` }));
  const draw = () => {
    const list = value || [];
    box.replaceChildren(...list.map((x, i) => h('div', { class: 'subrow', style: { gridTemplateColumns: '170px 80px minmax(0,1fr) auto' } },
      selectEl(x.kind, Object.entries(OBJECTIVES).map(([v, l]) => ({ value: v, label: l })), k => {
        list[i] = { kind: k, count: x.count || 1 };
        if (k === 'build') list[i].type = buildOpts[0]?.value;
        if (k === 'staff') list[i].role = roleOpts[0]?.value;
        set(list); draw();
      }),
      h('input', { type: 'number', min: 1, step: 1, value: x.count, title: 'Count', oninput: e => { x.count = parseInt(e.target.value, 10) || 0; set(list); } }),
      x.kind === 'build' ? selectEl(x.type, buildOpts, v => { x.type = v; set(list); draw(); })
        : x.kind === 'staff' ? selectEl(x.role, roleOpts, v => { x.role = v; set(list); draw(); })
          : h('span'),
      h('button', { class: 'btn ghost icon', title: 'Remove', onclick: () => { list.splice(i, 1); set(list); draw(); } }, '✕'),
      h('div', { class: 'small muted', style: { gridColumn: '1 / -1' } }, '→ ', h('span', null, objectiveText(x))))));
    box.append(h('div', null, h('button', { class: 'btn small', onclick: () => { value = [...list, { kind: 'build', count: 1, type: buildOpts[0]?.value }]; set(value); draw(); } }, '+ add objective')));
  };
  draw();
  // Keep each "→ text" line in step with its count without rebuilding the row.
  box.addEventListener('input', () => {
    const rows = box.querySelectorAll('.subrow');
    (value || []).forEach((x, i) => { const t = rows[i]?.lastChild?.lastChild; if (t) t.textContent = objectiveText(x); });
  });
  return box;
}

// ---------------------------------------------------------------- Form fields
function fieldEl(spec, obj, ed) {
  const val = getPath(obj, spec.key);
  const issueKey = spec.issue || spec.key.split('.')[0];
  const iss = ed ? issuesFor(ed.cat, ed.origId) : { errors: [], warnings: [] };
  const errs = iss.errors.filter(x => x.field === issueKey), warns = iss.warnings.filter(x => x.field === issueKey);
  ed?.shownIssues?.add(issueKey);
  const set = v => { setPath(obj, spec.key, v); ed?.changed(spec.rerender); };
  let input;
  const opts = typeof spec.options === 'function' ? spec.options(obj) : spec.options;
  switch (spec.type) {
    case 'textarea': input = h('textarea', { rows: spec.rows || 3, value: val ?? '', placeholder: spec.placeholder, oninput: e => set(e.target.value) }); break;
    case 'number': input = h('input', { type: 'number', step: spec.step || 'any', min: spec.min, max: spec.max, value: val ?? '', oninput: e => set(e.target.value === '' ? undefined : Number(e.target.value)) }); break;
    case 'int': input = h('input', { type: 'number', step: 1, min: spec.min, max: spec.max, value: val ?? '', oninput: e => set(e.target.value === '' ? undefined : parseInt(e.target.value, 10)) }); break;
    case 'bool': input = h('label', { class: 'inline-check' }, h('input', { type: 'checkbox', checked: !!val, onchange: e => set(e.target.checked || (spec.keepFalse ? false : undefined)) }), spec.checkLabel || 'Yes'); break;
    case 'select': input = selectEl(val, opts, v => set(v === '' && spec.nullable ? null : v), { blank: spec.blank }); break;
    case 'color': {
      const text = h('input', { class: 'mono', value: val || '', oninput: e => { set(e.target.value); if (/^#[0-9a-f]{6}$/i.test(e.target.value)) picker.value = e.target.value; } });
      const picker = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(val || '') ? val : '#888888', oninput: e => { text.value = e.target.value; set(e.target.value); } });
      input = h('div', { class: 'row' }, picker, text); break;
    }
    case 'cost': input = costWidget(val ? val : (setPath(obj, spec.key, {}), getPath(obj, spec.key)), set, spec); break;
    case 'refs': input = refsWidget(val, opts, set, spec); break;
    case 'kv': input = kvWidget(val, set, spec); break;
    case 'tags': input = h('input', { value: (val || []).join(', '), placeholder: 'comma, separated', oninput: e => set(e.target.value.split(',').map(s => s.trim()).filter(Boolean)) }); break;
    case 'objectives': input = objectivesWidget(val || (setPath(obj, spec.key, []), getPath(obj, spec.key)), set); break;
    case 'custom': input = spec.render(obj, ed); break;
    case 'id': input = h('input', { class: 'mono', value: val ?? '', oninput: e => set(e.target.value.trim()) }); break;
    default: input = h('input', { value: val ?? '', placeholder: spec.placeholder, list: spec.datalist, oninput: e => set(e.target.value) });
  }
  return h('div', { class: 'field' + (spec.wide ? ' wide' : '') + (errs.length ? ' has-error' : '') },
    spec.label && h('label', null, spec.label, spec.hint && h('span', { class: 'hint' }, spec.hint)),
    input,
    errs.map(x => h('div', { class: 'issue' }, x.message)),
    warns.map(x => h('div', { class: 'issue warn' }, x.message)));
}
const section = (title, ...kids) => h('div', { class: 'section' }, title && h('h4', null, title), kids);
const fields = (obj, ed, specs) => h('div', { class: 'fields' }, specs.filter(Boolean).map(s => fieldEl(s, obj, ed)));

// ---------------------------------------------------------------- Editor
// A draft copy of one item, saved with PUT ?replace=1. Changing the id renames it everywhere.
function makeEditor(cat, item, { build, onSave, afterSave, head } = {}) {
  const ed = { cat, origId: item.id, draft: clone(item), live: [], root: h('div', { class: 'card' }) };
  ed.changed = rerender => {
    S.dirty = true;
    ed.root.querySelector('.dirty-note')?.replaceChildren('Unsaved changes');
    if (rerender) ed.rerender(); else ed.live.forEach(f => f());
  };
  ed.rerender = () => {
    const scroll = $view.scrollTop;
    ed.live = [];
    ed.root.replaceChildren(...(build || editorContent)(ed, head));
    $view.scrollTop = scroll;
  };
  ed.save = async () => {
    const payload = clone(ed.draft);
    for (const k of Object.keys(payload)) if (k.startsWith('_')) delete payload[k];
    if (onSave && (await onSave(payload, ed)) === false) return;
    const res = await attempt(() => api('PUT', `/${cat}/${enc(ed.origId)}?replace=1`, payload));
    if (!res) return;
    if (afterSave) await attempt(() => afterSave(res.item, ed));
    S.dirty = false;
    const moved = res.item._renamedReferences;
    toast(`Saved ${titleOf(cat, res.item)}.` + (moved ? ` Renamed ${plural(moved, 'reference')} to the new id.` : ''));
    await refreshAll();
    S.keepScroll = true;
    if (res.item.id !== ed.origId || location.hash !== ed.hash) go(ed.hash = ed.hashFor(res.item.id)); else render();
  };
  ed.hashFor = id => link(cat, id);
  ed.hash = ed.hashFor(item.id);
  ed.revert = () => { ed.draft = clone(item); S.dirty = false; ed.rerender(); };
  S.editor = ed;
  ed.rerender();
  return ed;
}
function editorContent(ed, head) {
  const cat = ed.cat, d = ed.draft, meta = CATS[cat];
  ed.shownIssues = new Set();
  const form = FORMS[cat](d, ed);
  const iss = issuesFor(cat, ed.origId);
  const general = { errors: iss.errors.filter(x => !ed.shownIssues.has(x.field)), warnings: iss.warnings.filter(x => !ed.shownIssues.has(x.field)) };
  const glyph = (GLYPH[cat] || (() => meta.icon))(d);
  const title = h('h2', null, titleOf(cat, d) || '(untitled)');
  ed.live.push(() => { title.textContent = titleOf(cat, d) || '(untitled)'; });
  return [
    h('div', { class: 'editor-head' },
      h('div', { class: 'big-glyph', style: { background: cat === 'buildables' || cat === 'characters' ? (d.color || '') + '33' : '' } }, glyph),
      h('div', { class: 'grow' },
        title,
        h('div', { class: 'row small muted', style: { marginTop: '2px' } }, h('code', null, cat + '/' + ed.origId), meta.live && h('span', { class: 'live-tag' }, 'LIVE'))),
      head?.(ed)),
    h('div', { class: 'editor-body' },
      (general.errors.length > 0 || general.warnings.length > 0) && h('div', { class: 'stack', style: { gap: '6px' } },
        general.errors.length > 0 && h('div', { class: 'issues-box bad' }, general.errors.map(x => h('div', null, '✖ ' + x.message))),
        general.warnings.length > 0 && h('div', { class: 'issues-box warn' }, general.warnings.map(x => h('div', null, '⚠ ' + x.message)))),
      form,
      RELATED[cat] && section('Connections', h('div', { class: 'related' }, RELATED[cat](d, ed)))),
    h('div', { class: 'editor-foot' },
      h('button', { class: 'btn primary', onclick: () => ed.save() }, 'Save'),
      h('button', { class: 'btn', onclick: () => ed.revert() }, 'Revert'),
      h('span', { class: 'dirty-note' }, S.dirty ? 'Unsaved changes' : ''),
      h('span', { class: 'grow' }),
      h('span', { class: 'faint small' }, '⌘S saves'),
      h('button', { class: 'btn', onclick: () => duplicateItem(cat, ed.origId) }, 'Duplicate'),
      h('button', { class: 'btn danger', onclick: () => deleteItem(cat, ed.origId) }, 'Delete')),
  ];
}
const idField = (label = 'Id') => ({ key: 'id', label, type: 'id', hint: 'renaming updates references' });

async function newItem(cat, preset = {}, { position, nameKey } = {}) {
  const key = nameKey || CATS[cat].title || 'name';
  const got = await askId('New ' + CATS[cat].label.replace(/s$/, '').toLowerCase(), { nameLabel: key[0].toUpperCase() + key.slice(1) });
  if (!got) return null;
  const tpl = await attempt(() => api('GET', `/${cat}/_template`));
  if (!tpl) return null;
  const body = { ...tpl, ...preset, id: got.id, [key]: got.name || tpl[key] };
  if (position != null) body._position = position;
  const res = await attempt(() => api('POST', '/' + cat, body));
  if (!res) return null;
  await refreshAll();
  return res.item;
}
async function duplicateItem(cat, id) {
  const src = byId(cat, id);
  const got = await askId('Duplicate ' + titleOf(cat, src), { suggestion: id + '_copy', name: titleOf(cat, src) + ' (copy)', nameLabel: 'Name' });
  if (!got) return;
  const key = CATS[cat].title || 'name';
  const copy = { ...clone(src), id: got.id, [key]: got.name };
  if (cat === 'jobs') copy.roles = copy.roles.map(r => ({ ...r, id: r.id + '_copy', building: null, slots: 0, slotBonus: [] }));
  const res = await attempt(() => api('POST', '/' + cat, { ...copy, _position: items(cat).findIndex(i => i.id === id) + 1 }));
  if (res) { S.dirty = false; await refreshAll(); go(link(cat, got.id)); }
}
async function deleteItem(cat, id, after) {
  const refs = (await attempt(() => api('GET', `/${cat}/${enc(id)}/references`)))?.references || [];
  const message = refs.length
    ? h('div', { class: 'stack' }, h('p', null, `${titleOf(cat, byId(cat, id))} is used by:`), h('div', { class: 'chips' }, refs.map(r => h('span', { class: 'chip' }, `${CATS[r.category]?.label || r.category}: ${r.name || r.id}`))), h('p', { class: 'muted' }, 'Deleting leaves those references pointing at nothing; the issues list will show them.'))
    : `Delete ${titleOf(cat, byId(cat, id))}? Its file keeps a backup of the previous version.`;
  if (!(await confirmModal('Delete ' + id, message, refs.length ? 'Delete anyway' : 'Delete', true))) return;
  if (await attempt(() => api('DELETE', `/${cat}/${enc(id)}${refs.length ? '?force=1' : ''}`))) {
    S.dirty = false;
    toast('Deleted ' + id + '.');
    await refreshAll();
    go(after || link(cat));
  }
}

// ---------------------------------------------------------------- Category pages (list + editor)
const GLYPH = {
  buildables: b => artImg(b.id, b.icon),
  quests: q => h('span', { style: { color: chapterColor(q.chapter) } }, '✉'),
  ranks: () => '★',
  jobs: j => j.icon,
  research: t => t.icon || '⚗',
  job_perks: p => p.icon || '◆',
  survivor_perks: p => p.icon || '✦',
  chapters: c => h('span', { style: { color: chapterColor(c.id) } }, '❡'),
  characters: c => h('span', { style: { color: c.color } }, c.icon || '☺'),
  messages: m => character(m.from)?.icon || '✎',
  expeditions: () => '➚',
  weapons: w => w.melee ? '✊' : '⌖',
};
function artImg(bid, fallback) {
  if (!S.art.has(ART_ALIAS[bid] || bid)) return fallback || '▦';
  const img = h('img', { src: artUrl(bid), alt: '', loading: 'lazy' });
  img.onerror = () => img.replaceWith(document.createTextNode(fallback || '▦'));
  return img;
}
const SUB = {
  buildables: b => [b.id, b.fixture && 'fixture', hostOf(b.id) && '⚒ ' + hostOf(b.id).name].filter(Boolean).join(' · '),
  jobs: j => (j.roles || []).map(r => r.building ? `${r.id}@${r.building}` : r.id).join(', '),
  quests: q => `${byId('ranks', q.rank)?.name || q.rank} · ${byId('chapters', q.chapter)?.title || 'no chapter'}`,
  ranks: r => `tier ${r.tier} · ${plural((r.milestones || []).length, 'milestone')}`,
  research: t => `${t.branch} · ${t.hours}h`,
  job_perks: p => `${p.job} · tier ${p.tier}`,
  survivor_perks: p => `${p.category} · tier ${p.tier}`,
  chapters: c => `act ${c.act} · ${plural(items('quests').filter(q => q.chapter === c.id).length, 'quest')}`,
  characters: c => c.faction || c.id,
  messages: m => `${character(m.from)?.name || m.from} · ${TRIGGERS[m.trigger?.on] || m.trigger?.on}${m.trigger?.ref ? ' ' + m.trigger.ref : ''}`,
  expeditions: e => `${e.hours}h · risk ${Math.round((e.risk || 0) * 100)}%`,
  weapons: w => `${w.damage} dmg · ${w.range} range`,
};
const GROUP = {
  buildables: b => b.fixture ? 'Camp fixtures' : 'Buildable',
  job_perks: p => byId('jobs', p.job)?.name || p.job,
  survivor_perks: p => p.category,
  messages: m => byId('chapters', m.chapter)?.title || 'No chapter',
  research: t => t.branch,
};
function renderCategory(cat, id) {
  const meta = CATS[cat];
  const list = items(cat);
  const selected = id ? byId(cat, id) : null;
  crumbs(meta.label, ...(selected ? [titleOf(cat, selected)] : []));
  const page = h('div', { class: 'page' });
  page.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, meta.icon + ' ' + meta.label), h('p', null, meta.blurb)),
    EXTRA_ACTIONS[cat]?.()));
  const listCard = h('div', { class: 'card sticky-list' });
  const search = h('input', { class: 'search', placeholder: 'Search', value: S.search[cat] || '', oninput: e => { S.search[cat] = e.target.value; drawList(); } });
  const listBox = h('div', { class: 'item-list' });
  listCard.append(h('div', { class: 'list-tools' }, search,
    h('button', { class: 'btn primary', title: 'New', onclick: async () => {
      const pos = meta.ordered && selected ? list.indexOf(selected) + 1 : undefined;
      const made = await newItem(cat, PRESET[cat]?.(selected) || {}, { position: pos });
      if (made) go(link(cat, made.id));
    } }, '+ New')), listBox);
  const drawList = () => {
    const q = (S.search[cat] || '').toLowerCase();
    const shown = list.filter(i => !q || JSON.stringify(i).toLowerCase().includes(q));
    let lastGroup = null;
    listBox.replaceChildren(...shown.flatMap(item => {
      const idx = list.indexOf(item);
      const group = (GROUP[cat] || CAMPAIGN_GROUP[cat])?.(item);
      const iss = issuesFor(cat, item.id);
      const out = [];
      if (group !== undefined && group !== lastGroup) out.push(h('div', { class: 'list-sep' }, group));
      lastGroup = group;
      out.push(h('div', { class: 'item-row' + (item === selected ? ' active' : ''), onclick: () => go(link(cat, item.id)) },
        meta.ordered && h('span', { class: 'order' }, idx + 1),
        h('span', { class: 'glyph', style: cat === 'buildables' ? { background: item.color + '33' } : null }, (GLYPH[cat] || (() => meta.icon))(item)),
        h('div', { style: { minWidth: 0 } }, h('div', { class: 't' }, titleOf(cat, item)), h('div', { class: 's' }, (SUB[cat] || campaignSub)(item))),
        iss.errors.length ? h('span', { class: 'flag danger-text', title: iss.errors.map(x => x.message).join('\n') }, '✖')
          : iss.warnings.length ? h('span', { class: 'flag', style: { color: 'var(--warn)' }, title: iss.warnings.map(x => x.message).join('\n') }, '⚠') : null,
        meta.ordered && item === selected && !q && h('span', { class: 'row', style: { gap: '2px', marginLeft: iss.errors.length || iss.warnings.length ? '4px' : 'auto' } },
          h('button', { class: 'btn ghost icon small', title: 'Move up', disabled: idx === 0, onclick: e => { e.stopPropagation(); move(cat, idx, -1); } }, '↑'),
          h('button', { class: 'btn ghost icon small', title: 'Move down', disabled: idx === list.length - 1, onclick: e => { e.stopPropagation(); move(cat, idx, 1); } }, '↓'))));
      return out;
    }));
    if (!shown.length) listBox.append(h('div', { class: 'empty' }, q ? 'Nothing matches.' : 'Nothing yet.'));
  };
  drawList();
  const side = h('div');
  if (selected) side.append(makeEditor(cat, selected, EDITOR_OPTS[cat]?.() || {}).root);
  else side.append(LANDING[cat] ? LANDING[cat]() : h('div', { class: 'card empty' }, list.length ? 'Pick one from the list, or add a new one.' : 'Nothing here yet. Add the first one with + New.'));
  page.append(h('div', { class: 'split' }, listCard, side));
  $view.append(page);
  listBox.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
}
async function move(cat, idx, delta) {
  if (S.dirty && !(await confirmModal('Unsaved changes', 'Reordering reloads the list and drops unsaved edits.', 'Reorder anyway'))) return;
  const order = items(cat).map(i => i.id);
  [order[idx], order[idx + delta]] = [order[idx + delta], order[idx]];
  if (await attempt(() => api('PUT', '/' + cat, { order }))) { S.dirty = false; await refreshAll(); S.keepScroll = true; render(); }
}
const PRESET = {
  quests: sel => sel ? { rank: sel.rank, chapter: sel.chapter, giver: sel.giver } : {},
  messages: sel => sel ? { chapter: sel.chapter, from: sel.from } : {},
  job_perks: sel => sel ? { job: sel.job } : {},
};
const EXTRA_ACTIONS = {
  quests: () => h('a', { class: 'btn', href: '#/campaign' }, '↧ Campaign flow'),
  ranks: () => h('a', { class: 'btn', href: '#/campaign' }, '↧ Campaign flow'),
  buildables: () => h('a', { class: 'btn', href: '#/trees' }, '⑂ Upgrade trees'),
  job_perks: () => h('a', { class: 'btn', href: '#/trees/j' }, '⑂ As trees'),
  survivor_perks: () => h('a', { class: 'btn', href: '#/trees/s' }, '⑂ As trees'),
};

// ---------------------------------------------------------------- Forms per category
const statOpts = STATS.map(s => ({ value: s, label: STAT_NAMES[s] }));
const rankOpts = () => items('ranks').map(r => ({ value: r.id, label: `${r.name} (tier ${r.tier})` }));
const chapterOpts = () => items('chapters').map(c => ({ value: c.id, label: `Act ${c.act} · ${c.title}` }));
const characterOpts = () => items('characters').map(c => ({ value: c.id, label: `${c.icon || ''} ${c.name}` }));
const buildableOpts = (filter = () => true) => items('buildables').filter(filter).map(b => ({ value: b.id, label: `${b.icon} ${b.name}` }));

const FORMS = {
  buildables: (d, ed) => [
    section('Identity', fields(d, ed, [idField(), { key: 'name', label: 'Name', rerender: false }, { key: 'icon', label: 'Icon', hint: 'glyph for menus' }, { key: 'color', label: 'Colour', type: 'color' },
      { key: 'subtitle', label: 'Subtitle', wide: true, hint: 'shown in the build menu' }])),
    section('Footprint & integrity', fields(d, ed, [
      { key: 'w', label: 'Width', type: 'int', min: 16, step: 16, hint: '16 per tile', rerender: true },
      { key: 'h', label: 'Depth', type: 'int', min: 16, hint: '16 per tile', rerender: true },
      { key: 'hp', label: 'Integrity', type: 'int', min: 1 },
      { key: 'fixture', label: 'Fixture', type: 'bool', checkLabel: 'Comes with the camp; not in the build menu' },
    ]), h('div', { class: 'row' }, footprint(d), h('span', { class: 'small muted' }, `${(d.w || 0) / 16} × ${(d.h || 0) / 16} tiles`))),
    section('Cost', fields(d, ed, [{ key: 'cost', type: 'cost', wide: true }])),
    section('Job post', postForBuildable(d, ed)),
    section('Upgrade tree', upgradeSummary(d, ed)),
  ],
  jobs: (d, ed) => [
    section('Job', fields(d, ed, [idField(), { key: 'name', label: 'Name' }, { key: 'icon', label: 'Icon' },
      { key: 'primaryStat', label: 'Primary stat', type: 'select', options: statOpts }, { key: 'secondaryStat', label: 'Secondary stat', type: 'select', options: statOpts },
      { key: 'description', label: 'Career description', type: 'textarea', wide: true },
      { key: 'scaling', label: 'How stats help', type: 'textarea', wide: true, rows: 2, hint: 'crew screen' }])),
    section('Workplace', h('p', { class: 'small muted', style: { margin: 0 } }, 'The crew screen\'s workstation card. It defaults to the building of the job\'s first staffed post.'),
      fields(d, ed, [
        { key: 'workplace', label: 'Workplace', type: 'select', blank: '— the first post\'s building —', options: () => buildableOpts() },
        { key: 'workplaceName', label: 'Shown as' },
        { key: 'workplaceBonus', label: 'What the workplace gives', type: 'textarea', wide: true, rows: 2 }])),
    section('Posts', h('p', { class: 'small muted', style: { margin: 0 } }, 'Where survivors in this job work. A post at a buildable is staffed there (one post per buildable); a post without one is a roving assignment.'), rolesEditor(d, ed)),
    section('Career ranks', careerEditor(d, ed)),
  ],
  quests: (d, ed) => [
    section('Placement', fields(d, ed, [idField(), { key: 'title', label: 'Title' },
      { key: 'rank', label: 'Needs status', type: 'select', options: rankOpts, hint: 'waits until earned' },
      { key: 'chapter', label: 'Chapter', type: 'select', options: chapterOpts, blank: '— none —' },
      { key: 'giver', label: 'Given by', type: 'select', options: characterOpts, blank: '— none —' }])),
    section('Briefing', fields(d, ed, [
      { key: 'brief', label: 'Brief', type: 'textarea', wide: true, hint: 'the orders the player reads' },
      { key: 'log', label: 'Journal entry', type: 'textarea', wide: true, rows: 2, hint: 'written when complete' }])),
    section('Objectives', fields(d, ed, [{ key: 'objectives', type: 'objectives', wide: true }])),
    section('On completion', fields(d, ed, [
      { key: 'unlock', label: 'Unlocks', type: 'refs', wide: true, options: () => buildableOpts(b => !b.fixture).map(o => { const by = items('quests').find(q => q.id !== d.id && (q.unlock || []).includes(o.value)); return by ? { ...o, label: o.label + ` (by ${by.id})` } : o; }) },
      { key: 'reward', label: 'Reward', type: 'cost', wide: true }])),
    section('On the tablet', questPreview(d, ed)),
  ],
  ranks: (d, ed) => [
    section('Status', fields(d, ed, [idField(), { key: 'name', label: 'Name' },
      { key: 'tier', label: 'Upgrade tier', type: 'int', min: 0, hint: 'deepest upgrade allowed' },
      { key: 'blurb', label: 'Blurb', type: 'textarea', wide: true, rows: 2 }])),
    section('Milestones', h('p', { class: 'small muted', style: { margin: 0 } }, 'All must be met to earn this status. Statuses are earned in order.'), fields(d, ed, [{ key: 'milestones', type: 'objectives', wide: true }])),
    section('Rewards', fields(d, ed, [{ key: 'reward', label: 'Supply drop', type: 'cost', wide: true }, { key: 'log', label: 'Journal entry', type: 'textarea', wide: true, rows: 2 }])),
  ],
  research: (d, ed) => [
    notYet('Research'),
    section('Project', fields(d, ed, [idField(), { key: 'name', label: 'Name' }, { key: 'icon', label: 'Icon' },
      { key: 'branch', label: 'Branch', datalist: 'branch-list' },
      { key: 'hours', label: 'Research time', type: 'number', min: 0.5, step: 0.5, hint: 'game hours' },
      { key: 'description', label: 'Description', type: 'textarea', wide: true }]), h('datalist', { id: 'branch-list' }, BRANCHES.map(b => h('option', { value: b })))),
    section('Cost & prerequisites', fields(d, ed, [{ key: 'cost', label: 'Cost', type: 'cost', wide: true },
      { key: 'requires', label: 'Requires', type: 'refs', wide: true, options: () => items('research').filter(t => t.id !== d.id).map(t => ({ value: t.id, label: `${t.icon || ''} ${t.name}` })) }])),
    section('Results', fields(d, ed, [
      { key: 'unlocks', label: 'Unlocks', type: 'refs', wide: true, hint: 'buildables or specific upgrades', options: () => items('buildables').flatMap(b => [{ value: b.id, label: `${b.icon} ${b.name}` }, ...(b.upgrades || []).map(u => ({ value: `${b.id}.${u.id}`, label: `  ${b.name} → ${u.name}` }))]) },
      { key: 'effects', label: 'Effects', type: 'kv', wide: true, hint: 'effect name → value' }])),
  ],
  job_perks: (d, ed) => [
    notYet('Job perks'),
    section('Perk', fields(d, ed, [idField(), { key: 'name', label: 'Name' }, { key: 'icon', label: 'Icon' },
      { key: 'job', label: 'Job', type: 'select', options: () => items('jobs').map(j => ({ value: j.id, label: `${j.icon} ${j.name}` })), rerender: true },
      { key: 'tier', label: 'Tier', type: 'int', min: 1 },
      { key: 'requires', label: 'Requires', type: 'select', nullable: true, blank: '— root —', options: () => items('job_perks').filter(p => p.job === d.job && p.id !== d.id).map(p => ({ value: p.id, label: p.name })) },
      { key: 'description', label: 'Description', type: 'textarea', wide: true }])),
    section('Cost & effect', fields(d, ed, [{ key: 'cost', label: 'Cost', type: 'cost', wide: true }, { key: 'perkEffect', label: 'Effect', type: 'kv', wide: true }])),
  ],
  survivor_perks: (d, ed) => [
    notYet('Survivor perks'),
    section('Perk', fields(d, ed, [idField(), { key: 'name', label: 'Name' }, { key: 'icon', label: 'Icon' },
      { key: 'category', label: 'Category', type: 'select', options: PERK_TYPES }, { key: 'tier', label: 'Tier', type: 'int', min: 1 },
      { key: 'tags', label: 'Tags', type: 'tags' }, { key: 'description', label: 'Description', type: 'textarea', wide: true }])),
    section('Requirements', fields(d, ed, [
      { key: 'statRequirements', label: 'Stats', type: 'kv', wide: true, keyOptions: [{ value: 'minLevel', label: 'Min level' }, ...statOpts] },
      { key: 'requires', label: 'Requires perks', type: 'refs', wide: true, options: () => items('survivor_perks').filter(p => p.id !== d.id).map(p => ({ value: p.id, label: p.name })) }])),
    section('Cost & effect', fields(d, ed, [{ key: 'cost', label: 'Cost', type: 'cost', wide: true, extra: ['xp'] }, { key: 'effects', label: 'Effects', type: 'kv', wide: true }])),
  ],
  chapters: (d, ed) => [
    section('Chapter', fields(d, ed, [idField(), { key: 'title', label: 'Title' }, { key: 'act', label: 'Act', type: 'int', min: 1 },
      { key: 'goal', label: 'Goal', hint: 'what ends the chapter' },
      { key: 'summary', label: 'Summary', type: 'textarea', wide: true, rows: 4 },
      { key: 'notes', label: 'Writer\'s notes', type: 'textarea', wide: true, rows: 4, hint: 'not exported to the player' }])),
  ],
  characters: (d, ed) => [
    section('Character', fields(d, ed, [idField(), { key: 'name', label: 'Name' },
      { key: 'inGame', label: 'Sender name in game', hint: 'as messages show it' },
      { key: 'title', label: 'Title', wide: true }, { key: 'faction', label: 'Faction' }, { key: 'icon', label: 'Icon' }, { key: 'color', label: 'Colour', type: 'color' },
      { key: 'bio', label: 'Bio', type: 'textarea', wide: true, rows: 4 }])),
  ],
  messages: (d, ed) => [
    section('Message', fields(d, ed, [idField(), { key: 'subject', label: 'Subject' },
      { key: 'from', label: 'From', type: 'select', options: characterOpts, rerender: true },
      { key: 'tone', label: 'Tone', type: 'select', options: Object.entries(TONES).map(([value, label]) => ({ value, label })), rerender: true },
      { key: 'chapter', label: 'Chapter', type: 'select', options: chapterOpts, blank: '— none —' },
      { key: 'body', label: 'Body', type: 'textarea', wide: true, rows: 5 }])),
    section('Trigger', triggerEditor(d, ed)),
    section('Preview', live(ed, () => messagePreview(d))),
  ],
  expeditions: (d, ed) => [
    section('Expedition', fields(d, ed, [idField(), { key: 'name', label: 'Name' }, { key: 'hours', label: 'Duration', type: 'number', min: 0.5, step: 0.5, hint: 'game hours' },
      { key: 'risk', label: 'Injury risk', type: 'number', min: 0, max: 1, step: 0.01, hint: '0–1' },
      { key: 'rescueChance', label: 'Rescue chance', type: 'number', min: 0, max: 1, step: 0.01, hint: '0–1' },
      { key: 'description', label: 'Description', type: 'textarea', wide: true, rows: 2 }])),
    section('Supplies', fields(d, ed, [{ key: 'cost', label: 'Cost per member', type: 'cost', wide: true }, { key: 'reward', label: 'Reward', type: 'cost', wide: true }])),
    section('Who might be found', fields(d, ed, [{ key: 'recruit.label', label: 'Label', issue: 'recruit' },
      { key: 'recruit.options', label: 'Generator options', type: 'kv', wide: true, issue: 'recruit', keyOptions: ['qualityFloor', 'qualityShift', 'budgetBonus', 'levelOverride', 'forcedPrimaryStat', 'forcedSecondaryStat', 'forcedWeakStat'] }])),
    section('Weapon finds', weaponFinds(d, ed)),
  ],
  weapons: (d, ed) => [
    section('Weapon', fields(d, ed, [idField(), { key: 'name', label: 'Name' }, { key: 'melee', label: 'Melee', type: 'bool', keepFalse: true, checkLabel: 'Close combat' },
      { key: 'damage', label: 'Damage', type: 'number', min: 0 }, { key: 'range', label: 'Range', type: 'number', min: 0 }, { key: 'cooldown', label: 'Cooldown', type: 'number', min: 0.05, step: 0.05, hint: 'seconds' }])),
    d.id !== 'fists' && section('Crafting cost', fields(d, ed, [{ key: 'cost', type: 'cost', wide: true }])),
    section('Balance', live(ed, () => h('div', { class: 'small muted' }, `${(d.damage / (d.cooldown || 1)).toFixed(1)} damage per second at ${d.range} range.`))),
  ],
};
// ---------------------------------------------------------------- Campaign forms
// Campaign items are edited as their title fields plus the rest as JSON, checked as you type.
const CAMPAIGN_GROUP = {
  campaign_tasks: t => t.kind === 'side' ? 'Side tasks' : 'Phase ' + t.phase,
  campaign_buildings: b => 'Phase ' + b.phase,
  campaign_sites: s => ({ scavenging: 'Scavenging sites', route: 'Recurring routes', story: 'Story sites' })[s.kind] || s.kind,
  campaign_strings: s => s.group,
  campaign_resources: r => r.category,
};
const campaignSub = x => [x.code, x.source === 'generated' ? 'GENERATED' : '', (x.generated || []).length ? 'generated: ' + x.generated.join(', ') : '', x.text ? x.text.slice(0, 60) : ''].filter(Boolean).join(' · ') || x.id;
function jsonBody(d, ed, skip) {
  const rest = Object.fromEntries(Object.entries(d).filter(([k]) => !skip.includes(k) && !k.startsWith('_')));
  const note = h('div', { class: 'issue', style: { display: 'none' } });
  const area = h('textarea', { class: 'mono', rows: Math.min(40, JSON.stringify(rest, null, 2).split('\n').length + 1), value: JSON.stringify(rest, null, 2),
    oninput: e => {
      let parsed;
      try { parsed = JSON.parse(e.target.value); } catch (err) { note.textContent = 'Not valid JSON yet: ' + err.message; note.style.display = ''; return; }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) { note.textContent = 'The fields must be one JSON object.'; note.style.display = ''; return; }
      note.style.display = 'none';
      for (const k of Object.keys(d)) if (!skip.includes(k) && !k.startsWith('_')) delete d[k];
      Object.assign(d, parsed);
      ed.changed(false);
    } });
  return h('div', { class: 'field wide' }, h('label', null, 'Fields', h('span', { class: 'hint' }, 'JSON')), area, note);
}
function campaignForm(cat) {
  const titleKey = CATS[cat].title || 'name';
  return (d, ed) => {
    const head = [idField(), titleKey !== 'id' && { key: titleKey, label: titleKey[0].toUpperCase() + titleKey.slice(1) }].filter(Boolean);
    const gen = (d.generated || []).length ? h('div', { class: 'issues-box warn' }, 'Generated copy (not from the design document): ' + d.generated.join(', ')) : null;
    return [section('Identity', fields(d, ed, head)), gen, section('Definition', jsonBody(d, ed, ['id', titleKey]))];
  };
}
for (const cat of CAMPAIGN_CATS) FORMS[cat] = campaignForm(cat);
FORMS.campaign_strings = (d, ed) => [
  section('Line', fields(d, ed, [idField(), { key: 'group', label: 'Group' },
    { key: 'source', label: 'Source', type: 'select', options: [{ value: 'spec', label: 'Design document' }, { value: 'generated', label: 'Generated for the game' }] },
    d.title !== undefined && { key: 'title', label: 'Section title', wide: true },
    { key: 'text', label: 'Text', type: 'textarea', wide: true, rows: 10, hint: '{placeholders} are filled in by the game' }])),
];

function notYet(what) {
  return h('div', { class: 'issues-box', style: { background: 'var(--info-soft)', color: 'var(--info)' } }, `${what} isn't simulated by the game yet. It's validated and published with the content (gameContent.mjs) so the engine can pick it up.`);
}
// A node refreshed after every edit (for previews), without rebuilding the form.
function live(ed, make) {
  const box = h('div');
  const draw = () => box.replaceChildren(make());
  ed.live.push(draw);
  draw();
  return box;
}
function footprint(d) {
  const w = Math.max(1, Math.min(8, Math.round((d.w || 16) / 16))), hh = Math.max(1, Math.min(6, Math.round((d.h || 16) / 16)));
  return h('div', { class: 'footprint', style: { gridTemplateColumns: `repeat(${w}, 14px)` } }, Array.from({ length: w * hh }, () => h('i', { style: { background: (d.color || '#888') + 'aa' } })));
}
function postForBuildable(d, ed) {
  if (!('_post' in d)) { const host = hostOf(ed.origId); d._post = host?.id || ''; d._slots = host?.slots || 2; }
  const roles = allRoles();
  const current = roles.find(r => r.id === d._post);
  const bonus = current?.slotBonus || [];
  return [
    fields(d, ed, [
      { key: '_post', label: 'Staffed by', type: 'select', blank: '— nobody works here —', rerender: true,
        options: roles.map(r => ({ value: r.id, label: `${r.icon} ${r.name} (${r.jobName})` + (r.building && r.building !== ed.origId ? ` — now at ${r.building}` : '') })) },
      d._post && { key: '_slots', label: 'Slots', type: 'int', min: 1, hint: 'workers at once' },
    ]),
    d._post && h('div', { class: 'small muted' }, current?.building && current.building !== ed.origId ? `Saving moves the ${current.name} post here from ${current.building}. ` : '',
      bonus.length ? 'Upgrades add slots: ' + bonus.map(b => `${b.upgrade} +${b.slots}`).join(', ') + '. ' : '',
      h('a', { href: link('jobs', current?.job) }, 'Edit the post in ' + (current?.jobName || 'its job') + ' →')),
  ];
}
function upgradeSummary(d, ed) {
  const tree = d.upgrades || [];
  return h('div', { class: 'stack', style: { gap: '8px' } },
    tree.length ? h('div', { class: 'chips' }, tree.map(u => h('a', { class: 'chip link', href: `#/trees/b/${enc(ed.origId)}/${enc(u.id)}` }, `T${upgradeDepth(tree, u)} · ${u.name}`, ' ', hookRefs('upgrades', `${ed.origId}.${u.id}`).length ? '' : h('span', { style: { color: 'var(--warn)' }, title: 'No code uses this upgrade yet' }, '⚠'))))
      : h('span', { class: 'muted small' }, 'No upgrades.'),
    h('div', null, h('a', { class: 'btn small', href: `#/trees/b/${enc(ed.origId)}` }, '⑂ Open in the tree editor')));
}
function rolesEditor(d, ed) {
  d.roles ??= [];
  const box = h('div', { class: 'subtable' });
  const buildOpts = items('buildables').map(b => {
    const host = allRoles().find(r => r.building === b.id && r.job !== ed.origId) || null;
    return { value: b.id, label: `${b.icon} ${b.name}` + (host ? ` — ${host.name} works here` : ''), disabled: !!host };
  });
  d.roles.forEach((r, i) => {
    const tree = byId('buildables', r.building)?.upgrades || [];
    const clash = d.roles.some((o, j) => j !== i && o.building && o.building === r.building);
    box.append(h('div', { class: 'subrow' },
      h('div', { class: 'subrow-head' },
        h('input', { style: { width: '44px', textAlign: 'center' }, value: r.icon || '', title: 'Icon', oninput: e => { r.icon = e.target.value; ed.changed(); } }),
        h('input', { class: 'grow', value: r.name || '', placeholder: 'Post name', oninput: e => { r.name = e.target.value; ed.changed(); } }),
        h('input', { class: 'mono', style: { width: '140px' }, value: r.id || '', title: 'Post id', oninput: e => { r.id = e.target.value.trim(); ed.changed(); } }),
        hookChip('roles', r.id, { missing: 'no code', tone: 'info' }),
        h('button', { class: 'btn ghost icon', title: 'Remove post', onclick: () => { d.roles.splice(i, 1); ed.changed(true); } }, '✕')),
      h('div', { class: 'fields' },
        h('div', { class: 'field' }, h('label', null, 'Works at'), selectEl(r.building || '', buildOpts, v => { r.building = v || null; r.slots = v ? (r.slots || 2) : 0; r.slotBonus = []; ed.changed(true); }, { blank: '— roving (no building) —' }),
          clash && h('div', { class: 'issue' }, 'Another post in this job already works here.')),
        r.building && h('div', { class: 'field' }, h('label', null, 'Slots'), h('input', { type: 'number', min: 1, step: 1, value: r.slots || 1, oninput: e => { r.slots = parseInt(e.target.value, 10) || 0; ed.changed(); } })),
        r.building && h('div', { class: 'field wide' }, h('label', null, 'Upgrades that add slots'),
          h('div', { class: 'subtable' }, (r.slotBonus || []).map((b, k) => h('div', { class: 'row' },
            selectEl(b.upgrade, tree.map(u => ({ value: u.id, label: u.name })), v => { b.upgrade = v; ed.changed(); }),
            h('span', { class: 'muted' }, '+'), h('input', { type: 'number', class: 'num', min: 1, value: b.slots, oninput: e => { b.slots = parseInt(e.target.value, 10) || 0; ed.changed(); } }), h('span', { class: 'muted small' }, 'slots'),
            h('button', { class: 'btn ghost icon', onclick: () => { r.slotBonus.splice(k, 1); ed.changed(true); } }, '✕'))),
          tree.length ? h('div', null, h('button', { class: 'btn small', onclick: () => { (r.slotBonus ??= []).push({ upgrade: tree[0].id, slots: 1 }); ed.changed(true); } }, '+ add')) : h('span', { class: 'faint small' }, 'This buildable has no upgrades.'))),
        h('div', { class: 'field wide' }, h('label', null, 'What they do', h('span', { class: 'hint' }, 'shown on the crew screen')), h('textarea', { rows: 2, value: r.description || '', oninput: e => { r.description = e.target.value; ed.changed(); } })))));
  });
  box.append(h('div', null, h('button', { class: 'btn small', onclick: () => { d.roles.push({ id: d.id + '_' + (d.roles.length + 1), name: 'New post', icon: d.icon, description: '', building: null, slots: 0, slotBonus: [] }); ed.changed(true); } }, '+ add post')));
  return box;
}
function careerEditor(d, ed) {
  d.careerRanks ??= [];
  const box = h('div', { class: 'subtable' });
  d.careerRanks.forEach((r, i) => box.append(h('div', { class: 'subrow' },
    h('div', { class: 'subrow-head' },
      h('span', { class: 'muted small' }, 'Level'), h('input', { type: 'number', class: 'num', min: 1, value: r.level, oninput: e => { r.level = parseInt(e.target.value, 10) || 1; ed.changed(); } }),
      h('input', { class: 'grow', value: r.title || '', placeholder: 'Rank title', oninput: e => { r.title = e.target.value; ed.changed(); } }),
      h('span', { class: 'muted small' }, 'after'), h('input', { type: 'number', class: 'num', min: 0, value: r.dutyHours ?? 0, oninput: e => { r.dutyHours = Number(e.target.value) || 0; ed.changed(); } }), h('span', { class: 'muted small' }, 'duty h'),
      h('button', { class: 'btn ghost icon', onclick: () => { d.careerRanks.splice(i, 1); ed.changed(true); } }, '✕')),
    h('div', { class: 'fields' },
      h('div', { class: 'field' }, h('label', null, 'Required stats'), kvWidget(r.requiredStats || {}, v => { r.requiredStats = v; ed.changed(); }, { keyOptions: statOpts })),
      h('div', { class: 'field' }, h('label', null, 'Bonus'), h('textarea', { rows: 2, value: r.bonus || '', oninput: e => { r.bonus = e.target.value; ed.changed(); } }))))));
  box.append(h('div', null, h('button', { class: 'btn small', onclick: () => { const last = d.careerRanks.at(-1); d.careerRanks.push({ level: (last?.level || 0) + 1, title: 'New rank', requiredStats: {}, dutyHours: (last?.dutyHours || 0) + 24, bonus: '' }); ed.changed(true); } }, '+ add rank')));
  return box;
}
function questPreview(d, ed) {
  return live(ed, () => h('div', { class: 'tablet' },
    h('div', { class: 't-title' }, d.title || 'Untitled'),
    h('div', null, d.brief),
    (d.objectives || []).map(x => h('div', { class: 't-obj' }, h('span', { class: 't-box' }), `${objectiveText(x)}  0/${x.count}`)),
    h('div', { class: 't-meta' }, (d.unlock || []).length ? 'Unlocks ' + d.unlock.map(t => byId('buildables', t)?.name || t).join(', ') + ' · ' : '', 'Reward ', Object.entries(d.reward || {}).map(([r, n]) => `+${n} ${r}`).join(' · ') || 'none')));
}
function messagePreview(m) {
  const who = character(m.from);
  return h('div', { class: 'message-preview ' + (m.tone || '') }, h('div', { class: 'from' }, who?.inGame || who?.name || m.from), h('b', null, m.subject), h('div', null, m.body));
}
function triggerEditor(d, ed) {
  d.trigger ??= { on: 'manual', ref: '', day: 0 };
  const t = d.trigger;
  const refOpts = t.on === 'quest_start' || t.on === 'quest_complete' ? items('quests').map(q => ({ value: q.id, label: q.title }))
    : t.on === 'rank_earned' ? items('ranks').map(r => ({ value: r.id, label: r.name })) : null;
  return fields(d, ed, [
    { key: 'trigger.on', label: 'When', type: 'select', options: Object.entries(TRIGGERS).map(([value, label]) => ({ value, label })), rerender: true, issue: 'trigger' },
    refOpts && { key: 'trigger.ref', label: t.on === 'rank_earned' ? 'Status' : 'Quest', type: 'select', options: refOpts, blank: '— pick —', issue: 'trigger' },
    t.on === 'event' && { key: 'trigger.ref', label: 'Event', hint: 'e.g. no_beds, no_food', issue: 'trigger' },
    t.on === 'day' && { key: 'trigger.day', label: 'Day', type: 'int', min: 1, issue: 'trigger' },
  ]);
}
function weaponFinds(d, ed) {
  if (!d.weapon) return h('div', null, h('button', { class: 'btn small', onclick: () => { d.weapon = { chance: 0.2, types: [items('weapons').find(w => w.id !== 'fists')?.id].filter(Boolean) }; ed.changed(true); } }, '+ Expedition can turn up weapons'));
  return [fields(d, ed, [
    { key: 'weapon.chance', label: 'Chance', type: 'number', min: 0, max: 1, step: 0.05, issue: 'weapon' },
    { key: 'weapon.types', label: 'Weapons', type: 'refs', wide: true, issue: 'weapon', options: () => items('weapons').filter(w => w.id !== 'fists').map(w => ({ value: w.id, label: w.name })) }]),
    h('div', null, h('button', { class: 'btn small danger', onclick: () => { delete d.weapon; ed.changed(true); } }, 'No weapon finds'))];
}

// Keeps a buildable's job post in step when the buildable is saved (the post lives on the job).
const EDITOR_OPTS = {
  buildables: () => ({
    head: ed => hookChip('buildables', ed.origId, { missing: 'no special code', tone: 'info' }),
    afterSave: async (saved, ed) => {
      const want = ed.draft._post || '', slots = ed.draft._slots || 1;
      const jobs = clone(items('jobs'));
      const touched = new Set();
      for (const j of jobs) for (const r of j.roles || []) {
        const bid = r.building === ed.origId ? saved.id : r.building;
        if (r.building !== bid) r.building = bid; // the server already renamed it; keep the local copy in step
        if (r.id === want && (r.building !== saved.id || r.slots !== slots)) {
          if (r.building !== saved.id) r.slotBonus = [];
          r.building = saved.id; r.slots = slots; touched.add(j.id);
        } else if (r.id !== want && r.building === saved.id) { r.building = null; r.slots = 0; r.slotBonus = []; touched.add(j.id); }
      }
      for (const j of jobs.filter(j => touched.has(j.id))) await api('PUT', `/jobs/${enc(j.id)}?replace=1`, j);
    },
  }),
  jobs: () => ({}),
  quests: () => ({ head: ed => { const i = items('quests').findIndex(q => q.id === ed.origId); return h('span', { class: 'chip' }, `#${i + 1} of ${items('quests').length}`); } }),
};

// ---------------------------------------------------------------- Connections panels
const rel = (k, ...v) => h('div', { class: 'related-row' }, h('span', { class: 'k' }, k), h('div', { class: 'chips' }, v.flat().length ? v : h('span', { class: 'faint small' }, 'none')));
const itemChip = (cat, id, label) => h('a', { class: 'chip link', href: link(cat, id) }, label || titleOf(cat, byId(cat, id)) || id);
const RELATED = {
  buildables: (d, ed) => {
    const id = ed.origId;
    const unlockedBy = items('quests').filter(q => (q.unlock || []).includes(id));
    const locked = unlockedBy.length || d.fixture;
    return [
      rel('Unlocked by', unlockedBy.map(q => itemChip('quests', q.id)), !locked && h('span', { class: 'chip info' }, 'available from the start')),
      rel('Asked for by', items('quests').filter(q => (q.objectives || []).some(x => x.type === id)).map(q => itemChip('quests', q.id)), items('ranks').filter(r => (r.milestones || []).some(x => x.type === id)).map(r => itemChip('ranks', r.id, '★ ' + r.name))),
      rel('Research', items('research').filter(t => (t.unlocks || []).some(u => u === id || u.startsWith(id + '.'))).map(t => itemChip('research', t.id))),
      rel('Code', hookRefs('buildables', id).map(r => h('span', { class: 'chip', title: r.count + ' references' }, r.file.replace('web/src/', '')))),
    ];
  },
  jobs: (d, ed) => [
    rel('Perks', items('job_perks').filter(p => p.job === ed.origId).map(p => h('a', { class: 'chip link', href: `#/trees/j/${enc(ed.origId)}/${enc(p.id)}` }, p.name))),
    rel('Quests', items('quests').filter(q => (q.objectives || []).some(x => x.kind === 'staff' && (d.roles || []).some(r => r.id === x.role))).map(q => itemChip('quests', q.id))),
  ],
  quests: (d, ed) => {
    const all = items('quests'), i = all.findIndex(q => q.id === ed.origId);
    const msgs = items('messages').filter(m => ['quest_start', 'quest_complete'].includes(m.trigger?.on) && m.trigger.ref === ed.origId);
    return [
      rel('Before / after', i > 0 && itemChip('quests', all[i - 1].id, '← ' + all[i - 1].title), i < all.length - 1 && itemChip('quests', all[i + 1].id, all[i + 1].title + ' →')),
      rel('Messages', msgs.map(m => itemChip('messages', m.id, `${m.trigger.on === 'quest_start' ? '▶' : '✔'} ${m.subject}`)),
        h('button', { class: 'btn small', onclick: () => addMessage({ trigger: { on: 'quest_start', ref: ed.origId, day: 0 }, chapter: d.chapter, from: d.giver || 'command', subject: 'New orders: ' + d.title, body: d.brief }) }, '+ on start'),
        h('button', { class: 'btn small', onclick: () => addMessage({ trigger: { on: 'quest_complete', ref: ed.origId, day: 0 }, chapter: d.chapter, from: d.giver || 'command', subject: 'Orders fulfilled: ' + d.title, body: '' }) }, '+ on complete')),
      rel('Campaign', (() => { const stuck = S.campaign?.stuck?.find(s => s.id === ed.origId); const reached = S.campaign?.steps?.some(s => s.kind === 'quest' && s.id === ed.origId); return stuck ? h('span', { class: 'chip bad' }, stuck.message) : reached ? h('a', { class: 'chip good link', href: '#/campaign' }, 'reachable ✓') : h('span', { class: 'chip warn' }, 'never reached (an earlier step is stuck)'); })()),
    ];
  },
  ranks: (d, ed) => {
    const i = items('ranks').findIndex(r => r.id === ed.origId);
    const prevTier = i > 0 ? items('ranks')[i - 1].tier : -1;
    const opened = items('buildables').flatMap(b => (b.upgrades || []).filter(u => { const t = upgradeDepth(b.upgrades, u); return t > prevTier && t <= d.tier; }).map(u => ({ b, u })));
    return [
      rel('Quests waiting', items('quests').filter(q => q.rank === ed.origId).map(q => itemChip('quests', q.id))),
      rel('Opens upgrades', opened.length ? h('span', { class: 'chip' }, `${opened.length} upgrades across ${new Set(opened.map(x => x.b.id)).size} structures`) : []),
      rel('Messages', items('messages').filter(m => m.trigger?.on === 'rank_earned' && m.trigger.ref === ed.origId).map(m => itemChip('messages', m.id, m.subject)),
        h('button', { class: 'btn small', onclick: () => addMessage({ trigger: { on: 'rank_earned', ref: ed.origId, day: 0 }, from: 'command', subject: 'Status confirmed: ' + d.name, body: d.blurb }) }, '+ add')),
    ];
  },
  research: (d, ed) => [rel('Leads to', items('research').filter(t => (t.requires || []).includes(ed.origId)).map(t => itemChip('research', t.id)))],
  chapters: (d, ed) => [
    rel('Quests', items('quests').filter(q => q.chapter === ed.origId).map(q => itemChip('quests', q.id))),
    rel('Messages', items('messages').filter(m => m.chapter === ed.origId).map(m => itemChip('messages', m.id, m.subject))),
  ],
  characters: (d, ed) => [
    rel('Gives quests', items('quests').filter(q => q.giver === ed.origId).map(q => itemChip('quests', q.id))),
    rel('Sends', items('messages').filter(m => m.from === ed.origId).map(m => itemChip('messages', m.id, m.subject))),
  ],
  weapons: (d, ed) => [rel('Found on', items('expeditions').filter(e => (e.weapon?.types || []).includes(ed.origId)).map(e => itemChip('expeditions', e.id)))],
};
async function addMessage(preset) {
  if (S.dirty && !(await confirmModal('Unsaved changes', 'Creating a message leaves this page and drops unsaved edits.', 'Continue'))) return;
  S.dirty = false;
  const made = await newItem('messages', preset);
  if (made) go(link('messages', made.id));
}

// ---------------------------------------------------------------- Landing panels
const LANDING = {
  jobs: () => {
    const rows = items('buildables').filter(b => !b.fixture);
    return h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Who works where'), h('span', { class: 'muted small' }, 'Pick a buildable to change its post; pick a job to edit posts')),
      h('table', { class: 'grid' }, h('thead', null, h('tr', null, ['Buildable', 'Post', 'Job', 'Slots', 'Code'].map(t => h('th', null, t)))),
        h('tbody', null, rows.map(b => { const r = hostOf(b.id); return h('tr', { class: 'click', onclick: () => go(link('buildables', b.id)) },
          h('td', null, `${b.icon} ${b.name}`), h('td', null, r ? `${r.icon} ${r.name}` : h('span', { class: 'faint' }, '—')), h('td', null, r ? itemChip('jobs', r.job, r.jobName) : ''),
          h('td', null, r ? r.slots + (r.slotBonus?.length ? ` (+${r.slotBonus.map(x => x.slots).join('+')})` : '') : ''), h('td', null, r ? hookChip('roles', r.id, { missing: '—', tone: 'info' }) : '')); })),
        h('tbody', null, allRoles().filter(r => !r.building).map(r => h('tr', { class: 'click', onclick: () => go(link('jobs', r.job)) }, h('td', { class: 'faint' }, 'roving'), h('td', null, `${r.icon} ${r.name}`), h('td', null, r.jobName), h('td'), h('td', null, hookChip('roles', r.id, { missing: '—', tone: 'info' })))))));
  },
};

// ---------------------------------------------------------------- Tree graphs
// Lays nodes out in columns by depth (longest prerequisite chain) and draws connectors.
function treeGraph(nodes, { colHead, onAdd, addLabel = '+ add root' } = {}) {
  const ids = new Set(nodes.map(n => n.id));
  const depth = new Map();
  const depthOf = (n, seen = new Set()) => {
    if (depth.has(n.id)) return depth.get(n.id);
    if (seen.has(n.id)) return 1;
    seen.add(n.id);
    const parents = (n.parents || []).filter(p => ids.has(p)).map(p => nodes.find(x => x.id === p));
    const d = 1 + Math.max(0, ...parents.map(p => depthOf(p, seen)));
    depth.set(n.id, d);
    return d;
  };
  nodes.forEach(n => depthOf(n));
  const maxDepth = Math.max(1, ...depth.values());
  const cols = Array.from({ length: maxDepth }, (_, i) => h('div', { class: 'tree-col' }, colHead && h('div', { class: 'tree-col-head' }, colHead(i + 1))));
  for (const n of nodes) cols[depth.get(n.id) - 1].append(n.el);
  if (onAdd) cols[0].append(h('button', { class: 'tree-add', onclick: onAdd }, addLabel));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'tree-lines');
  const wrap = h('div', { class: 'tree-wrap' }, svg, h('div', { class: 'tree-cols' }, cols));
  const draw = () => {
    const box = wrap.getBoundingClientRect();
    svg.replaceChildren();
    for (const n of nodes) for (const p of n.parents || []) {
      const from = nodes.find(x => x.id === p)?.el;
      if (!from || !n.el.isConnected) continue;
      const a = from.getBoundingClientRect(), b = n.el.getBoundingClientRect();
      const x1 = a.right - box.left + wrap.scrollLeft, y1 = a.top + a.height / 2 - box.top, x2 = b.left - box.left + wrap.scrollLeft, y2 = b.top + b.height / 2 - box.top;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const mid = (x1 + x2) / 2;
      path.setAttribute('d', `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`);
      svg.append(path);
    }
  };
  requestAnimationFrame(draw);
  new ResizeObserver(draw).observe(wrap);
  return wrap;
}
function nodeCard({ title, sub, foot, active, bad, onclick, icon }) {
  return h('div', { class: 'tree-node' + (active ? ' active' : '') + (bad ? ' bad' : ''), onclick },
    h('div', { class: 'n-title' }, icon && h('span', null, icon), title), sub && h('div', { class: 'n-sub' }, sub), foot && h('div', { class: 'n-foot' }, foot));
}

// ---------------------------------------------------------------- Upgrade trees page
function renderTrees(args) {
  const tab = args[0] || 'b';
  crumbs('Upgrade Trees');
  const page = h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, '⑂ Upgrade Trees'), h('p', null, 'Each column is a tier: an upgrade needs the one it hangs off, and a status that allows its tier. Upgrades marked ⚠ can be bought but nothing in the code acts on them yet.'))),
    h('div', { class: 'tabs' }, [['b', 'Buildings'], ['j', 'Job perks'], ['s', 'Survivor perks']].map(([k, l]) => h('a', { class: 'tab' + (tab === k ? ' active' : ''), href: '#/trees/' + k }, l))));
  $view.append(page);
  if (tab === 'j') return perkTrees(page, args[1], args[2]);
  if (tab === 's') return survivorTrees(page, args[1]);
  buildingTrees(page, args[1], args[2]);
}
function buildingTrees(page, bid, nid) {
  const all = items('buildables');
  const b = byId('buildables', bid) || all.find(x => (x.upgrades || []).length) || all[0];
  if (!b) return;
  crumbs('Upgrade Trees', b.name);
  const listCard = h('div', { class: 'card sticky-list' }, h('div', { class: 'item-list' }, all.map(x => {
    const unhooked = (x.upgrades || []).filter(u => !hookRefs('upgrades', `${x.id}.${u.id}`).length).length;
    return h('div', { class: 'item-row' + (x === b ? ' active' : ''), onclick: () => go('#/trees/b/' + enc(x.id)) },
      h('span', { class: 'glyph', style: { background: x.color + '33' } }, artImg(x.id, x.icon)),
      h('div', { style: { minWidth: 0 } }, h('div', { class: 't' }, x.name), h('div', { class: 's' }, plural((x.upgrades || []).length, 'upgrade'))),
      unhooked ? h('span', { class: 'flag', style: { color: 'var(--warn)' }, title: `${unhooked} without code` }, '⚠ ' + unhooked) : null);
  })));
  const main = h('div', { class: 'stack' });
  page.append(h('div', { class: 'split' }, listCard, main));
  const ed = makeEditor('buildables', b, { build: ed => treeEditorContent(ed, nid) });
  ed.hashFor = id => '#/trees/b/' + enc(id) + (ed.selected ? '/' + enc(ed.selected) : '');
  main.append(ed.root);
}
function treeEditorContent(ed, initial) {
  const d = ed.draft;
  d.upgrades ??= [];
  const tree = d.upgrades;
  if (ed.selected === undefined) ed.selected = tree.some(u => u.id === initial) ? initial : null;
  const iss = issuesFor('buildables', ed.origId);
  const treeIssues = [...iss.errors, ...iss.warnings].filter(x => x.field === 'upgrades');
  const addNode = parent => {
    let id = 'upgrade_' + (tree.length + 1);
    for (let i = 2; tree.some(u => u.id === id); i++) id = 'upgrade_' + (tree.length + i);
    tree.push({ id, name: 'New upgrade', description: '', cost: { wood: 20, scrap_metal: 10 }, requires: parent || null });
    ed.selected = id; ed.changed(true);
  };
  const nodes = tree.map(u => ({
    id: u.id, parents: u.requires ? [u.requires] : [],
    el: nodeCard({
      title: u.name || u.id, sub: u.description, active: ed.selected === u.id, bad: treeIssues.some(x => x.message.includes(`'${u.id}'`)),
      foot: [resText(u.cost), hookRefs('upgrades', `${ed.origId}.${u.id}`).length ? h('span', { class: 'small', style: { color: 'var(--good)' }, title: 'Code acts on this upgrade' }, '⚙') : h('span', { class: 'small', style: { color: 'var(--warn)' }, title: 'No code acts on this upgrade yet' }, '⚠')],
      onclick: () => { ed.selected = u.id; history.replaceState(null, '', '#/trees/b/' + enc(ed.origId) + '/' + enc(u.id)); lastHash = location.hash; ed.rerender(); },
    }),
  }));
  const colHead = t => { const r = rankForTier(t); return h('span', null, h('b', null, 'Tier ' + t), ' · ', r ? 'needs ' + r.name : h('span', { class: 'danger-text' }, 'no status allows it')); };
  const sel = tree.find(u => u.id === ed.selected);
  const descendants = id => tree.filter(u => u.requires === id).flatMap(u => [u.id, ...descendants(u.id)]);
  return [
    h('div', { class: 'editor-head' },
      h('div', { class: 'big-glyph', style: { background: d.color + '33' } }, artImg(d.id, d.icon)),
      h('div', { class: 'grow' }, h('h2', null, d.name + ' upgrades'), h('div', { class: 'row small muted' }, h('a', { href: link('buildables', ed.origId) }, 'Edit ' + d.name + ' →'))),
      h('button', { class: 'btn', onclick: () => addNode(null) }, '+ Root upgrade')),
    h('div', { class: 'editor-body' },
      treeIssues.length ? h('div', { class: 'issues-box bad' }, treeIssues.map(x => h('div', null, x.message))) : null,
      tree.length ? treeGraph(nodes, { colHead }) : h('div', { class: 'empty' }, 'No upgrades yet. Add a root upgrade to start the tree.'),
      sel && h('div', { class: 'card', style: { background: 'var(--panel-2)' } },
        h('div', { class: 'card-head' }, h('h3', null, sel.name || sel.id),
          h('div', { class: 'row' },
            h('button', { class: 'btn small', onclick: () => addNode(sel.id) }, '+ Upgrade that needs this'),
            h('button', { class: 'btn small danger', onclick: () => { for (const u of tree) if (u.requires === sel.id) u.requires = sel.requires || null; d.upgrades = tree.filter(u => u !== sel); ed.selected = null; ed.changed(true); } }, 'Remove'))),
        h('div', { class: 'card-pad stack' },
          h('div', { class: 'fields' },
            h('div', { class: 'field' }, h('label', null, 'Id', h('span', { class: 'hint' }, 'code refers to this')), h('input', { class: 'mono', value: sel.id, onchange: e => { const nv = e.target.value.trim(); for (const u of tree) if (u.requires === sel.id) u.requires = nv; sel.id = nv; ed.selected = nv; ed.changed(true); } })),
            h('div', { class: 'field' }, h('label', null, 'Name'), h('input', { value: sel.name || '', oninput: e => { sel.name = e.target.value; ed.changed(); } })),
            h('div', { class: 'field' }, h('label', null, 'Requires'), selectEl(sel.requires || '', tree.filter(u => u !== sel && !descendants(sel.id).includes(u.id)).map(u => ({ value: u.id, label: u.name })), v => { sel.requires = v || null; ed.changed(true); }, { blank: '— root —' })),
            h('div', { class: 'field wide' }, h('label', null, 'What it does', h('span', { class: 'hint' }, 'shown to the player')), h('textarea', { rows: 2, value: sel.description || '', oninput: e => { sel.description = e.target.value; ed.changed(); } })),
            h('div', { class: 'field wide' }, h('label', null, 'Cost'), costWidget(sel.cost ??= {}, v => { sel.cost = v; ed.changed(); }))),
          h('div', { class: 'related' },
            rel('Tier', h('span', { class: 'chip' }, `Tier ${upgradeDepth(tree, sel)} · ${rankForTier(upgradeDepth(tree, sel))?.name || 'unreachable'}`)),
            rel('Code', hookRefs('upgrades', `${ed.origId}.${sel.id}`).map(r => h('span', { class: 'chip good' }, r.file.replace('web/src/', '') + ' ×' + r.count)),
              !hookRefs('upgrades', `${ed.origId}.${sel.id}`).length && h('span', { class: 'chip warn' }, 'nothing acts on this yet — add the effect in the engine (search for has(b, \'' + sel.id + '\'))')),
            rel('Slot bonus', allRoles().filter(r => r.building === ed.origId && (r.slotBonus || []).some(x => x.upgrade === sel.id)).map(r => h('span', { class: 'chip' }, `${r.name} +${r.slotBonus.find(x => x.upgrade === sel.id).slots}`))),
            rel('Research', items('research').filter(t => (t.unlocks || []).includes(`${ed.origId}.${sel.id}`)).map(t => itemChip('research', t.id))))))),
    h('div', { class: 'editor-foot' },
      h('button', { class: 'btn primary', onclick: () => ed.save() }, 'Save tree'),
      h('button', { class: 'btn', onclick: () => { ed.selected = undefined; ed.revert(); } }, 'Revert'),
      h('span', { class: 'dirty-note' }, S.dirty ? 'Unsaved changes' : ''), h('span', { class: 'grow' }), h('span', { class: 'faint small' }, '⌘S saves')),
  ];
}
function perkTrees(page, jobId, perkId) {
  const jobs = items('jobs');
  const job = byId('jobs', jobId) || jobs[0];
  if (!job) return;
  crumbs('Upgrade Trees', 'Job perks', job.name);
  const perks = items('job_perks').filter(p => p.job === job.id);
  const selected = byId('job_perks', perkId);
  const listCard = h('div', { class: 'card sticky-list' }, h('div', { class: 'item-list' }, jobs.map(j => h('div', { class: 'item-row' + (j === job ? ' active' : ''), onclick: () => go('#/trees/j/' + enc(j.id)) },
    h('span', { class: 'glyph' }, j.icon), h('div', null, h('div', { class: 't' }, j.name), h('div', { class: 's' }, plural(items('job_perks').filter(p => p.job === j.id).length, 'perk')))))));
  const nodes = perks.map(p => ({ id: p.id, parents: p.requires ? [p.requires] : [], el: nodeCard({ icon: p.icon, title: p.name, sub: p.description, active: p === selected, bad: issuesFor('job_perks', p.id).errors.length, foot: [resText(p.cost), h('span', { class: 'faint small' }, 'T' + p.tier)], onclick: () => go(`#/trees/j/${enc(job.id)}/${enc(p.id)}`) }) }));
  const main = h('div', { class: 'stack' },
    notYet('Job perks'),
    h('div', { class: 'card card-pad' }, h('div', { class: 'row', style: { marginBottom: '8px' } }, h('h2', { class: 'grow' }, `${job.icon} ${job.name} perks`),
      h('button', { class: 'btn', onclick: async () => { const made = await newItem('job_perks', { job: job.id, requires: selected?.id || null, tier: selected ? (selected.tier || 1) + 1 : 1 }); if (made) go(`#/trees/j/${enc(job.id)}/${enc(made.id)}`); } }, selected ? '+ Perk that needs this' : '+ Root perk')),
    perks.length ? treeGraph(nodes, { colHead: t => h('b', null, 'Step ' + t) }) : h('div', { class: 'empty' }, 'No perks for this job yet.')));
  if (selected) { const ed = makeEditor('job_perks', selected); ed.hashFor = id => `#/trees/j/${enc(job.id)}/${enc(id)}`; main.append(ed.root); }
  page.append(h('div', { class: 'split' }, listCard, main));
}
function survivorTrees(page, perkId) {
  crumbs('Upgrade Trees', 'Survivor perks');
  const perks = items('survivor_perks');
  const selected = byId('survivor_perks', perkId);
  const main = h('div', { class: 'stack' }, notYet('Survivor perks'));
  const lanes = h('div', { class: 'card card-pad' });
  for (const cat of new Set([...PERK_TYPES, ...perks.map(p => p.category)])) {
    const group = perks.filter(p => p.category === cat);
    const ids = new Set(group.map(p => p.id));
    const nodes = group.map(p => ({ id: p.id, parents: (p.requires || []).filter(r => ids.has(r)), el: nodeCard({ icon: p.icon, title: p.name, sub: p.description, active: p === selected, bad: issuesFor('survivor_perks', p.id).errors.length, foot: [resText(p.cost), h('span', { class: 'faint small' }, 'T' + p.tier)], onclick: () => go('#/trees/s/' + enc(p.id)) }) }));
    lanes.append(h('div', { class: 'lane' }, h('div', { class: 'lane-head' }, h('h3', { class: 'grow', style: { textTransform: 'capitalize' } }, cat), h('span', { class: 'faint small' }, plural(group.length, 'perk')),
      h('button', { class: 'btn small', onclick: async () => { const made = await newItem('survivor_perks', { category: cat }); if (made) go('#/trees/s/' + enc(made.id)); } }, '+ Perk')),
    group.length ? treeGraph(nodes, { colHead: t => 'Step ' + t }) : h('div', { class: 'faint small' }, 'None.')));
  }
  main.append(lanes);
  if (selected) { const ed = makeEditor('survivor_perks', selected); ed.hashFor = id => '#/trees/s/' + enc(id); main.append(ed.root); }
  page.append(main);
}

// ---------------------------------------------------------------- Research page
function renderResearch(args) {
  const selected = byId('research', args[0]);
  crumbs('Research Tree', ...(selected ? [selected.name] : []));
  const all = items('research');
  const page = h('div', { class: 'page' }, h('div', { class: 'page-head' }, h('div', null, h('h1', null, '⚗ Research Tree'), h('p', null, CATS.research.blurb)),
    h('a', { class: 'btn', href: link('research') }, '☰ As a list')));
  const lanes = h('div', { class: 'card card-pad' });
  for (const branch of new Set([...BRANCHES, ...all.map(t => t.branch)])) {
    const group = all.filter(t => t.branch === branch);
    const nodes = group.map(t => ({ id: t.id, parents: t.requires || [], el: nodeCard({ icon: t.icon, title: t.name, sub: t.description, active: t === selected, bad: issuesFor('research', t.id).errors.length,
      foot: [resText(t.cost), h('span', { class: 'faint small' }, t.hours + 'h')], onclick: () => go('#/research/' + enc(t.id)) }) }));
    // Prerequisites in another branch are shown as a note rather than a line.
    for (const n of nodes) { const cross = (byId('research', n.id).requires || []).filter(r => !group.some(g => g.id === r)); if (cross.length) n.el.append(h('div', { class: 'small faint' }, '↰ also needs ' + cross.join(', '))); }
    lanes.append(h('div', { class: 'lane' }, h('div', { class: 'lane-head' }, h('h3', { class: 'grow', style: { textTransform: 'capitalize' } }, branch), h('span', { class: 'faint small' }, plural(group.length, 'project')),
      h('button', { class: 'btn small', onclick: async () => { const made = await newItem('research', { branch, requires: selected && selected.branch === branch ? [selected.id] : [] }); if (made) go('#/research/' + enc(made.id)); } }, selected?.branch === branch ? '+ Needs ' + selected.name : '+ Project')),
    group.length ? treeGraph(nodes, { colHead: t => 'Step ' + t }) : h('div', { class: 'faint small' }, 'None yet.')));
  }
  page.append(h('div', { class: 'stack' }, notYet('Research'), lanes));
  if (selected) { const ed = makeEditor('research', selected); ed.hashFor = id => '#/research/' + enc(id); page.append(h('div', { style: { marginTop: '16px' } }, ed.root)); }
  $view.append(page);
}

// ---------------------------------------------------------------- Campaign flow
function renderCampaign() {
  crumbs('Campaign Flow');
  const c = S.campaign || { steps: [], stuck: [], never_unlocked: [] };
  const quests = items('quests'), ranks = items('ranks');
  const msgsFor = (on, ref) => items('messages').filter(m => m.trigger?.on === on && m.trigger.ref === ref);
  const msgLine = m => h('a', { class: 'flow-msg', href: link('messages', m.id), onclick: e => e.stopPropagation() }, h('span', null, character(m.from)?.icon || '✎'), `${m.trigger.on === 'quest_complete' ? 'after' : 'with'}: “${m.subject}”`);
  const flow = h('div', { class: 'flow' });
  const step = (cls, when, body) => h('div', { class: 'flow-step ' + cls }, h('div', { class: 'flow-when' }, when), h('div', { class: 'flow-rail' }, h('div', { class: 'flow-dot' })), h('div', { class: 'flow-body' }, body));
  let chapter = null, rankName = ranks[0]?.name || '';
  const start = items('messages').filter(m => m.trigger?.on === 'game_start');
  flow.append(step('rank', 'start', h('div', { class: 'flow-rank', onclick: () => ranks[0] && go(link('ranks', ranks[0].id)) }, '▶ New run · ' + rankName, start.map(msgLine))));
  const questCard = (q, i, dim) => {
    if (q.chapter !== chapter) {
      chapter = q.chapter;
      const ch = byId('chapters', chapter);
      flow.append(h('div', { class: 'chapter-band' }, h('span', { class: 'chapter-swatch', style: { background: chapterColor(chapter) } }), ch ? [h('span', { class: 'act' }, 'Act ' + ch.act), h('a', { href: link('chapters', ch.id) }, h('b', null, ch.title)), h('span', { class: 'muted small' }, ch.goal)] : h('span', { class: 'muted' }, 'No chapter')));
    }
    const iss = issuesFor('quests', q.id);
    return h('div', { class: 'flow-card', style: { borderLeft: `3px solid ${chapterColor(q.chapter)}`, opacity: dim ? .5 : 1 }, onclick: () => go(link('quests', q.id)) },
      h('div', { class: 'fc-head' }, h('b', null, q.title), h('code', { class: 'faint' }, q.id), q.giver && h('span', { class: 'chip' }, (character(q.giver)?.icon || '') + ' ' + (character(q.giver)?.name || q.giver)),
        iss.errors.length ? h('span', { class: 'chip bad' }, plural(iss.errors.length, 'error')) : iss.warnings.length ? h('span', { class: 'chip warn' }, plural(iss.warnings.length, 'warning')) : null),
      h('div', { class: 'small muted' }, (q.objectives || []).map(objectiveText).join(' · ')),
      h('div', { class: 'row wrap small' }, (q.unlock || []).map(t => h('span', { class: 'chip good' }, '🔓 ' + (byId('buildables', t)?.name || t))), resText(q.reward, '')),
      [...msgsFor('quest_start', q.id), ...msgsFor('quest_complete', q.id)].map(msgLine));
  };
  const reached = new Set();
  c.steps.forEach(s => {
    if (s.kind === 'quest') {
      const i = quests.findIndex(q => q.id === s.id);
      reached.add(s.id);
      flow.append(step('', `#${i + 1} · ${byId('ranks', s.rank)?.name || ''}`, questCard(quests[i], i)));
    } else {
      const r = byId('ranks', s.id);
      rankName = r?.name;
      flow.append(step('rank', 'tier ' + r?.tier, h('div', { class: 'flow-rank', onclick: () => go(link('ranks', r.id)) }, '★ ' + r?.name + ' status', h('span', { class: 'muted small', style: { fontWeight: 400 } }, (r?.milestones || []).map(objectiveText).join(' · ')), msgsFor('rank_earned', r.id).map(msgLine))));
    }
  });
  for (const s of c.stuck) flow.append(step('stuck', 'stuck', h('div', { class: 'issues-box bad' }, h('b', null, 'Dead end: '), s.message, ' ', h('a', { href: link(s.category, s.id) }, 'Fix →'))));
  const unreached = quests.filter(q => !reached.has(q.id));
  unreached.forEach(q => flow.append(step('', 'unreached', questCard(q, quests.indexOf(q), true))));
  if (!c.stuck.length) flow.append(step('rank', 'end', h('div', { class: 'flow-rank' }, '■ ' + (c.steps.filter(s => s.kind === 'quest').length === quests.length ? 'All orders complete' : 'End'))));

  const dayMsgs = items('messages').filter(m => m.trigger?.on === 'day').sort((a, b) => a.trigger.day - b.trigger.day);
  const eventMsgs = items('messages').filter(m => ['event', 'manual'].includes(m.trigger?.on));
  const locked = new Set(quests.flatMap(q => q.unlock || []));
  const free = items('buildables').filter(b => !b.fixture && !locked.has(b.id));
  const side = h('div', { class: 'stack' },
    h('div', { class: 'card card-pad stack' }, h('h3', null, 'At a glance'),
      h('div', { class: 'related' },
        rel('Length', h('span', { class: 'chip' }, plural(quests.length, 'quest')), h('span', { class: 'chip' }, plural(ranks.length, 'status')), h('span', { class: 'chip' }, plural(items('chapters').length, 'chapter'))),
        rel('Playable', c.stuck.length ? h('span', { class: 'chip bad' }, 'dead end') : h('span', { class: 'chip good' }, 'start to finish ✓')),
        rel('From the start', free.map(b => itemChip('buildables', b.id, b.icon + ' ' + b.name))),
        rel('Never unlocked', c.never_unlocked.map(t => itemChip('buildables', t))))),
    h('div', { class: 'card card-pad stack' }, h('h3', null, 'Chapters'),
      items('chapters').map(ch => h('a', { class: 'row', href: link('chapters', ch.id), style: { color: 'inherit' } }, h('span', { class: 'chapter-swatch', style: { background: chapterColor(ch.id) } }), h('span', { class: 'grow' }, `Act ${ch.act} · ${ch.title}`), h('span', { class: 'faint small' }, plural(quests.filter(q => q.chapter === ch.id).length, 'quest')))),
      h('div', null, h('button', { class: 'btn small', onclick: async () => { const made = await newItem('chapters', { act: Math.max(1, ...items('chapters').map(c => c.act || 1)) }); if (made) go(link('chapters', made.id)); } }, '+ Chapter'))),
    h('div', { class: 'card card-pad stack' }, h('h3', null, 'Timed & event messages'),
      dayMsgs.map(m => h('a', { class: 'flow-msg', href: link('messages', m.id) }, h('b', null, 'Day ' + m.trigger.day), m.subject)),
      eventMsgs.map(m => h('a', { class: 'flow-msg', href: link('messages', m.id) }, h('b', null, m.trigger.ref || m.trigger.on), m.subject)),
      !dayMsgs.length && !eventMsgs.length && h('span', { class: 'faint small' }, 'None.'),
      h('div', null, h('button', { class: 'btn small', onclick: () => addMessage({ trigger: { on: 'day', ref: '', day: 3 } }) }, '+ Message on a day'))));
  $view.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, '↧ Campaign Flow'), h('p', null, 'The campaign played forward: each quest in order, statuses as they are earned, and the messages each moment sends. A dead end means some quest or status needs a structure nothing unlocks in time.')),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async () => { const made = await newItem('quests', {}); if (made) go(link('quests', made.id)); } }, '+ Quest'), h('a', { class: 'btn', href: link('quests') }, '☰ Reorder quests'))),
    h('div', { class: 'overview-grid flow-grid' }, flow, side)));
}

// ---------------------------------------------------------------- Overview
function renderOverview() {
  crumbs('Overview');
  const sum = S.summary || { categories: {} };
  const unhooked = items('buildables').flatMap(b => (b.upgrades || []).filter(u => !hookRefs('upgrades', `${b.id}.${u.id}`).length).map(u => ({ b, u })));
  const emptyChapters = items('chapters').filter(ch => !items('quests').some(q => q.chapter === ch.id));
  const noChapter = items('quests').filter(q => !q.chapter);
  const campaignOk = !S.campaign?.stuck?.length;
  const stat = (key, label) => h('div', { class: 'card stat', onclick: () => go('#/' + key) }, h('div', { class: 'v' }, sum.categories[key] ?? 0), h('div', { class: 'l' }, label || CATS[key].label));
  $view.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Content Studio'), h('p', null, 'Everything the game is built from: structures, jobs, upgrade trees, the quest chain and status ladder, research, and the story around them. Edits are saved to backend/data/; ', h('b', null, 'Publish to game'), ' writes them into ', h('code', null, sum.output || 'gameContent.mjs'), ' where the engine reads them.'))),
    h('div', { class: 'grid-cards', style: { marginBottom: '16px' } },
      h('div', { class: 'card card-pad stack', style: { gap: '6px' } }, h('h4', null, 'Game build'),
        h('div', { class: 'row' }, h('span', { class: 'pill ' + (sum.published ? 'good' : 'warn') }, sum.published ? 'Up to date' : 'Unpublished changes')),
        h('div', { class: 'small muted' }, S.validation.error_count ? `Fix ${plural(S.validation.error_count, 'error')} before publishing.` : sum.published ? 'The game runs exactly this content.' : 'Saved edits are not in the game yet.'),
        h('div', null, h('button', { class: 'btn primary small', 'data-action': 'publish', disabled: !!S.validation.error_count }, 'Publish to game'))),
      h('div', { class: 'card card-pad stack', style: { gap: '6px', cursor: 'pointer' }, onclick: () => go('#/campaign') }, h('h4', null, 'Campaign'),
        h('div', { class: 'row' }, h('span', { class: 'pill ' + (campaignOk ? 'good' : 'bad') }, campaignOk ? 'Playable start to finish' : 'Dead end')),
        h('div', { class: 'small muted' }, `${plural(items('quests').length, 'quest')} over ${plural(items('chapters').length, 'chapter')}, ${plural(items('ranks').length, 'status')}.`)),
      h('div', { class: 'card card-pad stack', style: { gap: '6px', cursor: 'pointer' }, onclick: () => go('#/issues') }, h('h4', null, 'Issues'),
        h('div', { class: 'row' }, h('span', { class: 'pill ' + (S.validation.error_count ? 'bad' : 'good') }, plural(S.validation.error_count || 0, 'error')), h('span', { class: 'pill ' + (S.validation.warning_count ? 'warn' : '') }, plural(S.validation.warning_count || 0, 'warning'))),
        h('div', { class: 'small muted' }, 'Errors block publishing; warnings are advice.'))),
    h('div', { class: 'overview-grid' },
      h('div', { class: 'stack' },
        h('h4', null, 'Live in the game'), h('div', { class: 'grid-cards' }, ['buildables', 'jobs', 'quests', 'ranks', 'expeditions', 'weapons'].map(k => stat(k))),
        h('h4', null, 'Story'), h('div', { class: 'grid-cards' }, ['chapters', 'characters', 'messages'].map(k => stat(k))),
        h('h4', null, 'Designed, not simulated yet'), h('div', { class: 'grid-cards' }, ['research', 'job_perks', 'survivor_perks'].map(k => stat(k))),
        h('h4', null, 'AfterLife campaign'), h('div', { class: 'grid-cards' }, CAMPAIGN_CATS.map(k => stat(k)))),
      h('div', { class: 'card card-pad stack' }, h('h3', null, 'Needs attention'),
        h('ul', { class: 'attention' },
          !campaignOk && S.campaign.stuck.map(s => h('li', { class: 'danger-text' }, s.message)),
          unhooked.length ? h('li', null, h('b', null, plural(unhooked.length, 'upgrade')), ' can be bought but have no effect in code: ', unhooked.slice(0, 8).map(({ b, u }) => h('a', { href: `#/trees/b/${enc(b.id)}/${enc(u.id)}`, style: { marginRight: '6px' } }, `${b.name} → ${u.name}`)), unhooked.length > 8 ? '…' : '') : null,
          S.campaign?.never_unlocked?.length ? h('li', null, 'Never unlocked: ', S.campaign.never_unlocked.join(', ')) : null,
          emptyChapters.length ? h('li', null, 'Chapters without quests: ', emptyChapters.map(c => h('a', { href: link('chapters', c.id), style: { marginRight: '6px' } }, c.title))) : null,
          noChapter.length ? h('li', null, plural(noChapter.length, 'quest'), ' not in any chapter: ', noChapter.map(q => h('a', { href: link('quests', q.id), style: { marginRight: '6px' } }, q.title))) : null,
          h('li', { class: 'muted' }, 'Research, job perks and survivor perks are published for reference; the engine has no systems for them yet.'))))));
}

// ---------------------------------------------------------------- Issues
function renderIssues(args) {
  crumbs('Issues');
  const filter = args[0] || 'all';
  const rows = [...S.validation.errors.map(e => ({ ...e, sev: 'error' })), ...S.validation.warnings.map(w => ({ ...w, sev: 'warning' }))].filter(r => filter === 'all' || r.sev === filter);
  const target = r => {
    if (r.category === 'buildables' && r.field === 'upgrades') return '#/trees/b/' + enc(r.id);
    return CATS[r.category] && byId(r.category, r.id) ? link(r.category, r.id) : CATS[r.category] ? link(r.category) : '#/';
  };
  $view.append(h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, '⚠ Issues'), h('p', null, 'Errors would break the game or the campaign and block publishing. Warnings point at content that is probably unintended.'))),
    h('div', { class: 'tabs' }, [['all', 'All'], ['error', 'Errors'], ['warning', 'Warnings']].map(([k, l]) => h('a', { class: 'tab' + (filter === k ? ' active' : ''), href: '#/issues/' + k }, l))),
    rows.length ? h('div', { class: 'card' }, h('table', { class: 'grid' },
      h('thead', null, h('tr', null, ['', 'Where', 'Item', 'Problem'].map(t => h('th', null, t)))),
      h('tbody', null, rows.map(r => h('tr', { class: 'click', onclick: () => go(target(r)) },
        h('td', { style: { width: '24px' } }, r.sev === 'error' ? h('span', { class: 'danger-text' }, '✖') : h('span', { style: { color: 'var(--warn)' } }, '⚠')),
        h('td', { class: 'muted' }, CATS[r.category]?.label || r.category, r.field ? h('span', { class: 'faint' }, ' · ' + r.field) : ''),
        h('td', null, h('code', null, r.id)),
        h('td', null, r.message))))))
      : h('div', { class: 'card empty' }, 'Nothing to fix. ✓')));
}

// ---------------------------------------------------------------- Boot
(async () => {
  $view.replaceChildren(h('div', { class: 'page muted' }, 'Loading content…'));
  try {
    await Promise.all([refreshAll(), loadArt()]);
  } catch (e) {
    $view.replaceChildren(h('div', { class: 'page' }, h('div', { class: 'card card-pad' }, h('h2', null, 'Can\'t reach the content API'), h('p', { class: 'muted' }, e.message + '.'), h('p', null, 'Start the game server (python3 server.py) and open this page from it at /dashboard. If it is already running, restart it: it loads the studio\'s backend once at startup, so a server started before the backend changed serves an older API.'))));
    return;
  }
  render();
})();
