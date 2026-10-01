// The overseer's tablet (Tab): every menu in one rugged device, grouped on its rail. Command holds
// quests, milestones, messages and the journal; Settlement holds construction, the stockpile and the
// crew; World holds the map and expeditions; System holds settings and the admin console. The dock's
// buttons and hotkeys open their screens here. Drawn with the design kit's parts: the tablet bezel,
// button frames, supply bars and icons from pixel-ui.js. It reads afTablet while open; the game is
// paused behind it like every other menu.
import { Fragment, useEffect, useRef, useState } from 'react';
import { B, E, L, Icon, cls, kitVars } from './ui.jsx';
import { MenuItems, ConstructionScreen, WorkshopSection, ExpeditionsScreen } from './Dialogs.jsx';
import { CrewScreen } from './CrewScreen.jsx';
import { AdminScreen } from './AdminScreen.jsx';
import { Heading, Bar, Objective, Thumb } from './TabletParts.jsx';
import { RESOURCE_INFO, RESOURCE_GROUPS, LEGACY_RESOURCES } from './resources.js';

// The rail, in groups. `key` is the screen's hotkey, shown on its button.
const TABLET_GROUPS = [
  { label: 'COMMAND', tabs: [
    { id: 'quests', label: 'QUESTS', icon: 'icon_quest' },
    { id: 'milestones', label: 'MILESTONES', icon: 'icon_milestone' },
    { id: 'messages', label: 'MESSAGES', icon: 'icon_message' },
    { id: 'journal', label: 'JOURNAL', icon: 'icon_journal', key: 'J' },
  ] },
  { label: 'SETTLEMENT', tabs: [
    { id: 'construction', label: 'CONSTRUCTION', icon: 'icon_build', key: 'B' },
    { id: 'stockpile', label: 'STOCKPILE', icon: 'icon_capacity' },
    { id: 'crew', label: 'CREW', icon: 'icon_survivor', key: 'C' },
  ] },
  { label: 'WORLD', tabs: [
    { id: 'map', label: 'MAP', icon: 'icon_map' },
    { id: 'expeditions', label: 'EXPEDITIONS', icon: 'icon_expedition', key: 'E' },
  ] },
  { label: 'SYSTEM', tabs: [
    { id: 'settings', label: 'SETTINGS', icon: 'icon_settings' },
    { id: 'admin', label: 'ADMIN', icon: 'icon_damage', key: '~' },
  ] },
];
// A campaign's SeerPad: modules open as tasks authorize them; the last group waits for later phases.
const CAMPAIGN_GROUPS = [
  { label: 'COMMAND', tabs: [
    { id: 'quests', label: 'TASKS', icon: 'icon_quest', module: 'tasks' },
    { id: 'messages', label: 'MESSAGES', icon: 'icon_message', module: 'messages' },
    { id: 'journal', label: 'JOURNAL', icon: 'icon_journal', key: 'J' },
  ] },
  { label: 'SETTLEMENT', tabs: [
    { id: 'crew', label: 'SURVIVORS', icon: 'icon_survivor', key: 'C', module: 'survivors' },
    { id: 'construction', label: 'BUILD', icon: 'icon_build', key: 'B', module: 'build' },
    { id: 'stockpile', label: 'RESOURCES', icon: 'icon_capacity', module: 'resources' },
    { id: 'crafting', label: 'CRAFTING', icon: 'icon_repair', module: 'crafting' },
    { id: 'defense', label: 'DEFENSE', icon: 'icon_wall', module: 'defense' },
    { id: 'recruitment', label: 'RECRUITMENT', icon: 'icon_bed', module: 'recruitment' },
  ] },
  { label: 'REGION', tabs: [
    { id: 'operations', label: 'OPERATIONS', icon: 'icon_expedition', module: 'operations' },
    { id: 'map', label: 'REGIONAL INTEL', icon: 'icon_map', module: 'map' },
  ] },
  { label: 'PENDING AUTHORIZATION', tabs: [
    { id: 'trade', label: 'TRADE', icon: 'icon_lock', module: 'never' },
    { id: 'research', label: 'RESEARCH', icon: 'icon_lock', module: 'never' },
    { id: 'policies', label: 'POLICIES', icon: 'icon_lock', module: 'never' },
    { id: 'municipal', label: 'MUNICIPAL', icon: 'icon_lock', module: 'never' },
  ] },
  { label: 'SYSTEM', tabs: [
    { id: 'settings', label: 'SETTINGS', icon: 'icon_settings' },
    { id: 'admin', label: 'ADMIN', icon: 'icon_damage', key: '~' },
  ] },
];
const LATER = 'Requires later settlement authorization.';
const pad2 = n => String(Math.floor(n)).padStart(2, '0');
const RESOURCES = LEGACY_RESOURCES.map(k => [k, RESOURCE_INFO[k].label]);
// Rates are per second of game time; the tablet shows them per game hour.
const perHour = r => { const v = r * 42; return (v > 0.05 ? '+' : v < -0.05 ? '−' : '') + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1) + ' / H'; };

export function Tablet({ game, modal }) {
  const hud = game.hud, tab = modal.tab || 'quests';
  const t = game.simulation.readTablet(), f = game.frame, summary = game.data?.tablet, campaign = t.campaign;
  const rank = campaign ? { name: campaign.classification } : t.ranks[t.rank];
  const badge = { messages: summary?.unread || 0, crew: t.candidates.length };
  const groups = campaign ? CAMPAIGN_GROUPS : TABLET_GROUPS;
  // A module the campaign hasn't authorized yet shows greyed with why; Phase 3 modules always do.
  // Opening Survivors, Build or Resources counts for the campaign's first task.
  useEffect(() => {
    const ix = { crew: 'open_survivors', construction: 'open_build', stockpile: 'open_resources' }[tab];
    if (campaign && ix) game.simulation.command('campaignInteraction', ix);
  }, [tab, !!campaign]);
  const lockOf = x => !campaign || !x.module ? '' : x.module === 'never' ? LATER : campaign.modules.includes(x.module) ? '' : 'Authorized by a later task.';
  return (
    <div className="tablet" style={kitVars()}>
      <L c="tablet-brand">SEERPAD</L>
      <E c="tablet-screen">
        <E c="tablet-head">
          <Icon name="icon_tablet" c="tablet-head-icon" />
          <L c="tablet-title">OVERSEER TABLET</L>
          <L c="tablet-chip">{rank.name.toUpperCase()}</L>
          <L c="tablet-clock">{`DAY ${pad2(f.day)} · ${pad2(f.hour)}:${pad2(f.hour % 1 * 60)} · ${game.data?.campaign ? (game.data.campaign.workShift ? 'WORK SHIFT' : 'REST') : f.phase.toUpperCase()}`}</L>
          <E c="spacer" />
          <L c="tablet-hint">TAB TO CLOSE</L>
          <B c="tablet-close" title="Close [Tab / Esc]" onClick={() => hud.closeModal()} />
        </E>
        <E c="tablet-body">
          <div className="ui-scroll tablet-rail">
            {groups.map(g => (
              <E key={g.label} c="tablet-group">
                <L c="tablet-group-label">{g.label}</L>
                {g.tabs.map(x => {
                  const lock = lockOf(x);
                  return (
                    <B key={x.id} c={cls('tablet-tab', tab === x.id && 'active', lock && 'locked')} title={lock || undefined} onClick={() => !lock && hud.showTablet(x.id)}>
                      <Icon name={lock ? 'icon_lock' : x.icon} c="tablet-tab-icon" />
                      <L c="tablet-tab-label">{x.label}</L>
                      {!lock && (badge[x.id] > 0 ? <L c="tablet-tab-badge">{String(badge[x.id])}</L> : x.key && <L c="tablet-tab-key">{x.key}</L>)}
                    </B>
                  );
                })}
              </E>
            ))}
          </div>
          <div className={cls('ui-scroll tablet-page', 'screen-' + tab)} key={tab}>
            {tab === 'quests' && (campaign ? <CampaignTasks game={game} c={campaign} /> : <Quests game={game} t={t} />)}
            {tab === 'crafting' && <Crafting game={game} c={campaign} />}
            {tab === 'defense' && (campaign ? <><ShelterControls game={game} sh={campaign.shelter} mg={campaign.migration} /><Defense game={game} d={campaign.defense} /></> : <Pending tab={tab} />)}
            {tab === 'recruitment' && (campaign ? <Recruitment game={game} r={campaign.recruitment} /> : <Pending tab={tab} />)}
            {tab === 'operations' && (campaign?.operations?.unlocked ? <Operations game={game} o={campaign.operations} /> : <Pending tab={tab} />)}
            {tab === 'milestones' && <Milestones t={t} />}
            {tab === 'messages' && <Messages game={game} t={t} campaign={!!campaign} />}
            {tab === 'journal' && <Journal game={game} t={t} />}
            {tab === 'construction' && <ConstructionScreen game={game} />}
            {tab === 'stockpile' && <>{campaign && <FoodForecast game={game} f={campaign.forecast} />}{campaign && <MedicalStock m={campaign.medical} />}<Inventory game={game} t={t} />{!campaign && <WorkshopSection game={game} />}</>}
            {tab === 'crew' && <CrewScreen game={game} />}
            {tab === 'map' && <MapTab game={game} />}
            {tab === 'expeditions' && <ExpeditionsScreen game={game} />}
            {tab === 'settings' && <><Heading>GAME SETTINGS</Heading><MenuItems game={game} inTablet /></>}
            {tab === 'admin' && <AdminScreen game={game} />}
          </div>
        </E>
      </E>
    </div>
  );
}

// A campaign's stockpile: one shared storage by weight, then each group of resources with what is
// available, what is reserved for work in progress and the net rate.
function LedgerStock({ inv }) {
  const l = inv.ledger, cap = l.capacity ?? 0, weight = Math.round(l.weight), over = l.overflow > 0;
  return (
    <>
      <Heading right={over ? `OVERFLOW ${Math.ceil(l.overflow)}` : `${Math.max(0, cap - weight)} FREE`}>STORAGE</Heading>
      <E c="tab-card">
        <E c="tab-row"><L c="tab-caption">WEIGHT STORED</L><E c="spacer" /><L c={cls('tab-big', over && 'amber')}>{`${weight}`}<span className="tab-dim">{` / ${cap}`}</span></L></E>
        <Bar value={Math.min(weight, cap)} count={Math.max(1, cap)} tone={over ? 'amber' : 'lime'} />
        <L c="tab-sub">{over ? 'Output is ready but storage is full. Use stock or add operational storage. Overflowing stock stays usable.' : 'Ammo weighs a quarter each, spare equipment 2, everything else 1.'}</L>
      </E>
      {RESOURCE_GROUPS.map(g => (
        <Fragment key={g.label}>
          <Heading right="AVAILABLE · RESERVED · PER GAME HOUR">{g.label}</Heading>
          <E c="tab-grid3">
            {g.ids.map(k => {
              const n = Math.floor(l.available[k] ?? 0), held = l.reserved[k] || 0, r = inv.rates[k] || 0;
              return (
                <E key={k} c="tab-card tab-resource" title={RESOURCE_INFO[k].about}>
                  <E c="tab-row">
                    <Icon name={RESOURCE_INFO[k].icon} c="tab-icon" />
                    <E c="tab-col">
                      <L c="tab-caption">{RESOURCE_INFO[k].label}</L>
                      <L c="tab-big">{`${n}`}{held > 0 && <span className="tab-dim">{` +${held} reserved`}</span>}</L>
                    </E>
                  </E>
                  <L c={cls('tab-rate', r > 0.001 ? 'lime' : r < -0.001 ? 'red' : '')}>{perHour(r)}</L>
                </E>
              );
            })}
          </E>
        </Fragment>
      ))}
    </>
  );
}

function Inventory({ game, t }) {
  const inv = t.inventory;
  return (
    <>
      {game.data?.campaign ? <LedgerStock inv={inv} /> : <>
      <Heading right="STOCK / STORAGE · PER GAME HOUR">STOCKPILE</Heading>
      <E c="tab-grid3">
        {RESOURCES.map(([k, label]) => {
          const n = Math.floor(inv.resources[k]), cap = inv.storage?.[k] || 1, r = inv.rates[k] || 0;
          return (
            <E key={k} c="tab-card tab-resource">
              <E c="tab-row">
                <Icon name={RESOURCE_INFO[k].icon} c="tab-icon" />
                <E c="tab-col">
                  <L c="tab-caption">{label}</L>
                  <L c={cls('tab-big', n > cap && 'amber')}>{`${n}`}<span className="tab-dim">{` / ${cap}`}</span></L>
                </E>
              </E>
              <Bar value={n} count={cap} tone={n > cap ? 'amber' : n < cap * .15 ? 'red' : 'lime'} />
              <L c={cls('tab-rate', r > 0.001 ? 'lime' : r < -0.001 ? 'red' : '')}>{perHour(r)}</L>
            </E>
          );
        })}
      </E></>}
      <Heading right={`${inv.items.reduce((n, i) => n + i.count, 0)} ITEMS`}>EQUIPMENT</Heading>
      {inv.items.length === 0 && <L c="tab-empty">No weapons in the stockpile.</L>}
      <E c="tab-grid3">
        {inv.items.map(i => (
          <E key={i.id} c="tab-card tab-row">
            <Icon name="icon_damage" c="tab-icon" />
            <E c="tab-col"><L c="tab-name">{i.name}</L><L c="tab-sub">{`${i.count} owned · ${i.held} carried`}</L></E>
          </E>
        ))}
      </E>
      <Heading right={`${inv.structures.reduce((n, s) => n + s.count, 0)} STANDING`}>STRUCTURES</Heading>
      <E c="tab-grid4">
        {inv.structures.map(s => (
          <E key={s.type} c="tab-card tab-row">
            <Thumb game={game} type={s.type} />
            <E c="tab-col"><L c="tab-name">{s.name}</L><L c="tab-sub">{'× ' + s.count}</L></E>
          </E>
        ))}
      </E>
    </>
  );
}

function Quests({ game, t }) {
  const active = t.quests.find(q => q.state === 'active'), waiting = t.quests.find(q => q.state === 'waiting');
  const done = t.quests.filter(q => q.state === 'done').length;
  return (
    <>
      <Heading right={`${done} / ${t.quests.length} COMPLETE`}>ORDERS FROM REGIONAL COMMAND</Heading>
      {active && (
        <E c="tab-card tab-feature">
          <E c="tab-row">
            <Icon name="icon_quest" c="tab-icon" />
            <E c="tab-col"><L c="tab-caption">CURRENT ORDERS</L><L c="tab-title">{active.title}</L></E>
          </E>
          <L c="tab-body">{active.brief}</L>
          {active.objectives.map((o, i) => <Objective key={i} o={o} />)}
          <E c="tab-reward">
            <L c="tab-caption">REWARD</L>
            {active.unlocks.map(u => <L key={u} c="tab-pill lime">{'UNLOCKS ' + u.toUpperCase()}</L>)}
            <L c="tab-pill amber">{active.reward.toUpperCase()}</L>
          </E>
        </E>
      )}
      {waiting && (
        <E c="tab-card tab-feature waiting">
          <E c="tab-row">
            <Icon name="badge_time" c="tab-badge" />
            <E c="tab-col"><L c="tab-caption">NEXT ORDERS SEALED</L><L c="tab-title">{`Reach ${waiting.rank} status`}</L></E>
          </E>
          <L c="tab-body">Command releases the next orders when the camp earns its new status. Your milestones show what is still needed.</L>
          <E c="tab-actions"><B c="tablet-btn primary" onClick={() => game.hud.showTablet('milestones')}>View milestones</B></E>
        </E>
      )}
      {!active && !waiting && <L c="tab-empty">Every order is fulfilled. Hold the city.</L>}
      <Heading>ALL ORDERS</Heading>
      {t.quests.map((q, i) => (
        <E key={q.id} c={cls('tab-list-row', q.state)}>
          <Icon name={q.state === 'done' ? 'badge_check' : q.state === 'active' ? 'badge_new' : q.state === 'waiting' ? 'badge_time' : 'badge_lock'} c="tab-badge" />
          <L c="tab-list-index">{pad2(i + 1)}</L>
          <L c="tab-name">{q.title}</L>
          <E c="spacer" />
          <L c="tab-sub">{q.unlocks.length ? 'Unlocks ' + q.unlocks.join(', ') : q.reward}</L>
          <L c="tab-list-rank">{q.rank.toUpperCase()}</L>
        </E>
      ))}
    </>
  );
}

function Journal({ game, t }) {
  const events = game.hud.journal;
  return (
    <>
      <Heading right={`${t.journal.length} ENTRIES`}>OVERSEER'S JOURNAL</Heading>
      {t.journal.length === 0 && <L c="tab-empty">Nothing written yet.</L>}
      {t.journal.map((j, i) => (
        <E key={i} c="tab-entry">
          <L c="tab-when">{j.when}</L>
          <L c="tab-title">{j.title}</L>
          <L c="tab-body">{j.text}</L>
        </E>
      ))}
      <Heading right="THIS SESSION">EVENT LOG</Heading>
      {events.length === 0 && <L c="tab-empty">No events recorded yet.</L>}
      {[...events].reverse().slice(0, 40).map((j, i) => (
        <E key={i} c="tab-log"><L c="tab-name">{j.title}</L><L c="tab-sub">{j.message}</L></E>
      ))}
    </>
  );
}

function Messages({ game, t, campaign }) {
  const hud = game.hud, warnings = game.data?.warnings || [];
  // A campaign's inbox has two threads: CentroCom's official channel and Mara Venn's private one.
  const channel = hud.messageChannel || 'all';
  const shown = campaign && channel !== 'all' ? t.messages.filter(m => m.channel === channel) : t.messages;
  // Opening the inbox reads everything in it.
  useEffect(() => { if (game.data?.tablet?.unread) game.hud.markMessagesRead(); }, [game]);
  const welcome = id => { if (game.command('acceptCandidate', id)) hud.bump(); };
  return (
    <>
      <Heading right={`${t.messages.length} RECEIVED`}>MESSAGES</Heading>
      {campaign && (
        <E c="tab-row tab-channels">
          {[['all', 'ALL'], ['official', 'CENTROCOM · OFFICIAL'], ['private', 'MARA VENN · PRIVATE']].map(([id, label]) => (
            <B key={id} c={cls('tablet-btn', channel === id && 'primary')} onClick={() => { hud.messageChannel = id; hud.bump(); }}>{label}</B>
          ))}
        </E>
      )}
      {warnings.length > 0 && (
        <E c="tab-card tab-warnings">
          <E c="tab-row"><Icon name="icon_warning" c="tab-badge" /><L c="tab-caption">CURRENT WARNINGS</L></E>
          {warnings.map((w, i) => <L key={i} c="tab-body">{'• ' + w}</L>)}
        </E>
      )}
      {shown.map(m => (
        <E key={m.id} c={cls('tab-message', m.tone, !m.read && 'unread')}>
          <E c="tab-row">
            {!m.read && <div className="tab-dot" />}
            <L c="tab-from">{m.from.toUpperCase()}</L>
            <E c="spacer" />
            <L c="tab-when">{m.when}</L>
          </E>
          <L c="tab-title">{m.title}</L>
          <L c="tab-body">{m.body}</L>
          {m.action?.kind === 'report' && <E c="tab-actions"><B c="tablet-btn primary" onClick={() => hud.showTablet('operations')}>Open report</B></E>}
          {m.action?.kind === 'alert' && <E c="tab-actions"><B c="tablet-btn primary" onClick={() => { game.command('campaignInteraction', 'ack_alert'); hud.showTablet('defense'); }}>Acknowledge · open Defense</B></E>}
          {m.action?.kind === 'candidate' && campaign && <E c="tab-actions"><B c="tablet-btn primary" onClick={() => hud.showTablet('recruitment')}>Review candidate</B></E>}
          {m.action?.kind === 'candidate' && !campaign && m.candidate && (
            <E c="tab-actions">
              <B c="tablet-btn primary" enabled={t.freeBeds > 0} onClick={() => welcome(m.action.id)}>{t.freeBeds > 0 ? 'Welcome them in' : 'No free bed'}</B>
              <B c="tablet-btn" onClick={() => game.command('declineCandidate', m.action.id)}>Turn away</B>
            </E>
          )}
          {m.action?.kind === 'build' && (
            <E c="tab-actions"><B c="tablet-btn primary" onClick={() => game.hud.showBuild()}>Open construction</B></E>
          )}
          {m.action?.kind === 'quest' && <E c="tab-actions"><B c="tablet-btn" onClick={() => hud.showTablet('quests')}>View orders</B></E>}
          {m.action?.kind === 'milestones' && <E c="tab-actions"><B c="tablet-btn" onClick={() => hud.showTablet('milestones')}>View milestones</B></E>}
        </E>
      ))}
    </>
  );
}

function Milestones({ t }) {
  return (
    <>
      <Heading right={`WORD OF THE BASE ${t.renown} / 100`}>STATUS & MILESTONES</Heading>
      <E c="tab-card">
        <L c="tab-body">{t.arrivalsPerDay > 0 ? `Survivors have heard of you. About ${t.arrivalsPerDay} a day come to the gate in daylight; more as the base grows and earns its status.` : 'Nobody has heard of the camp yet. Build a gate and fulfil your orders, and word will spread.'}</L>
        <Bar value={t.renown} count={100} tone="lime" />
      </E>
      <E c="tab-ladder">
        {t.ranks.map((r, i) => (
          <E key={r.id} c={cls('tab-card tab-rank', r.earned && 'earned', r.current && 'current', r.next && 'next')}>
            <E c="tab-row">
              <Icon name={r.earned ? 'icon_milestone' : 'badge_lock'} c={r.earned ? 'tab-icon' : 'tab-badge'} />
              <E c="tab-col grow">
                <L c="tab-caption">{`RANK ${i} · ${r.current ? 'CURRENT STATUS' : r.earned ? 'EARNED' : r.next ? 'NEXT' : 'LOCKED'}`}</L>
                <L c="tab-title">{r.name}</L>
              </E>
              {r.tier > (t.ranks[i - 1]?.tier ?? 0) && <L c="tab-pill lime">{'UPGRADES TIER ' + 'I'.repeat(r.tier)}</L>}
            </E>
            <L c="tab-body">{r.blurb}</L>
            {!r.earned && r.milestones.map((o, k) => <Objective key={k} o={o} />)}
            {r.reward && !r.earned && <E c="tab-reward"><L c="tab-caption">SUPPLY DROP</L><L c="tab-pill amber">{r.reward.toUpperCase()}</L></E>}
          </E>
        ))}
      </E>
    </>
  );
}

// The world from above: ground, trees, the settlement's land, its buildings and people, the dead and
// the sites to scavenge. Clicking moves the camera there.
const GROUND = {
  g: '#4b6138', // grass
  d: '#7a6f52', // dirt
  w: '#3c6b78', // water (rivers and lakes)
  f: '#38482a', // forest floor
  h: '#ad954e', // farmland
  r: '#a8a086', // road
  a: '#4e504e', // asphalt
  p: '#96968c', // pavement
  k: '#76766c', // parking
  s: '#484632', // sand
  S: '#3a5440', // swamp pool
  t: '#786240', // dirt track
  l: '#786e5f', // hiking trail
  q: '#5c5446', // quarry
  x: '#968c6e', // railroad
  L: '#42403c'  // lighthouse rock
};

function MapTab({ game }) {
  const ref = useRef(null), [info, setInfo] = useState(''), [hoverPoi, setHoverPoi] = useState(null);
  const f = game.frame, landRevision = f.landRevision;
  useEffect(() => {
    const canvas = ref.current, m = game.simulation.readMinimap();
    const tile = 16, world = m.w ? { left: -m.originX, top: -m.originY, width: m.w * tile, height: m.h * tile } : { left: -m.bounds.x, top: -m.bounds.y, width: m.bounds.x * 2, height: m.bounds.y * 2 };
    const W = canvas.width = 760, H = canvas.height = 440, k = Math.min(W / world.width, H / world.height);
    const ox = (W - world.width * k) / 2, oy = (H - world.height * k) / 2, X = x => ox + (x - world.left) * k, Y = y => oy + (y - world.top) * k;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0e100c'; ctx.fillRect(0, 0, W, H);
    if (m.w) for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) { ctx.fillStyle = GROUND[m.terr[ty * m.w + tx]] || GROUND.g; ctx.fillRect(Math.floor(ox + tx * tile * k), Math.floor(oy + ty * tile * k), Math.ceil(tile * k), Math.ceil(tile * k)); }
    else { ctx.fillStyle = GROUND.g; ctx.fillRect(ox, oy, world.width * k, world.height * k); }
    ctx.fillStyle = '#223223';
    const treeSize = k > 0.25 ? 2 : 1;
    for (const [x, y] of m.trees) ctx.fillRect(Math.round(X(x)), Math.round(Y(y)), treeSize, treeSize);
    ctx.fillStyle = 'rgba(197,212,138,.12)'; ctx.strokeStyle = 'rgba(197,212,138,.65)'; ctx.lineWidth = 1;
    for (const r of m.land) { ctx.fillRect(X(r.left), Y(r.top), (r.right - r.left) * k, (r.bottom - r.top) * k); ctx.strokeRect(X(r.left), Y(r.top), (r.right - r.left) * k, (r.bottom - r.top) * k); }
    for (const e of f.entities) {
      if (e.hidden) continue;
      if (e.kind === 'building') { ctx.fillStyle = e.type === 'barricade' || e.type === 'gate' ? '#b89d6e' : e.type === 'campfire' || e.type === 'core' ? '#e6c874' : '#d6d8c6'; ctx.fillRect(Math.round(X(e.x - e.width / 2)), Math.round(Y(e.groundY - e.height / 2)), Math.max(2, Math.round(e.width * k)), Math.max(2, Math.round(e.height * k))); }
    }
    for (const e of f.entities) {
      if (e.hidden || e.kind === 'building') continue;
      ctx.fillStyle = e.kind === 'zombie' ? '#cf6a55' : '#cfe08e';
      ctx.fillRect(Math.round(X(e.x)) - 1, Math.round(Y(e.y)) - 1, 3, 3);
    }
    // Camera viewport box: shows how much of the vast region is currently on screen
    if (game.world?.cam && game.world.orthographicSize) {
      const vh = 2 * game.world.orthographicSize;
      const vw = vh * (game.world.aspect || 1.777);
      const vx = game.world.cam.x - vw / 2;
      const vy = game.world.cam.y - vh / 2;
      ctx.fillStyle = 'rgba(255, 255, 230, 0.08)';
      ctx.fillRect(X(vx), Y(vy), vw * k, vh * k);
      ctx.strokeStyle = 'rgba(255, 255, 230, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(X(vx), Y(vy), vw * k, vh * k);
    }
    ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'middle';
    const region = m.region;
    if (region) {
      // The protected perimeter, the ground reserved for the first structures, local debris and the migration corridor.
      ctx.strokeStyle = 'rgba(196,216,137,.45)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(X(0), Y(0), region.protectedRadius * k, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(126,170,201,.8)';
      for (const p of region.patches) ctx.strokeRect(X(p.x), Y(p.y), p.w * k, p.h * k);
      const DEBRIS = { wood: '#b88a52', scrap_metal: '#a9b4bf', cloth: '#d6c8a8', components: '#7eaac9', seed_packets: '#8fbf6a' };
      for (const d of region.debris) { ctx.fillStyle = DEBRIS[d.resource] || '#ccc'; ctx.fillRect(Math.round(X(d.x)) - 1, Math.round(Y(d.y)) - 1, 3, 3); }
      if (region.corridor.length > 1) {
        ctx.strokeStyle = 'rgba(207,106,85,.85)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath();
        region.corridor.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)))); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
      }
      for (const s of region.sites) {
        const x = Math.round(X(s.x)), y = Math.round(Y(s.y)), hover = hoverPoi?.siteId === s.id;
        ctx.fillStyle = '#0b0d09'; ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y); ctx.fill();
        ctx.fillStyle = s.kind === 'story' ? '#b79be0' : '#6fc2b0'; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.fill();
        if (hover || k > 0.15) { ctx.fillStyle = '#0b0d09'; ctx.fillText(s.name.toUpperCase(), x + 9, y + 1); ctx.fillStyle = s.kind === 'story' ? '#cdb8f0' : '#9fe0d0'; ctx.fillText(s.name.toUpperCase(), x + 8, y); }
      }
    }
    for (const p of region ? [] : m.pois) {
      const x = Math.round(X(p.x)), y = Math.round(Y(p.y));
      const isTown = p.type === 'town';
      const isHovered = hoverPoi?.id === p.id;
      ctx.fillStyle = '#1a1e16'; ctx.fillRect(x - (isTown ? 5 : 4), y - (isTown ? 5 : 4), isTown ? 11 : 9, isTown ? 11 : 9);
      ctx.fillStyle = p.scavenged ? '#8b8f78' : isTown ? '#e6744a' : '#d4a24a';
      ctx.fillRect(x - (isTown ? 4 : 3), y - (isTown ? 4 : 3), isTown ? 9 : 7, isTown ? 9 : 7);
      if (isTown || isHovered || k > 0.22) {
        ctx.fillStyle = '#0b0d09'; ctx.fillText(p.name.toUpperCase(), x + 8, y + 1);
        ctx.fillStyle = p.scavenged ? '#8b8f78' : isTown ? '#f09070' : '#e6c874'; ctx.fillText(p.name.toUpperCase(), x + 7, y);
      }
    }
    canvas.onclick = e => {
      const r = canvas.getBoundingClientRect(), cx = (e.clientX - r.left) / r.width * W, cy = (e.clientY - r.top) / r.height * H;
      const x = world.left + (cx - ox) / k, y = world.top + (cy - oy) / k, near = m.region ? null : m.pois.find(p => Math.hypot(p.x - x, p.y - y) < 10 / k);
      // A site opens its expedition (legacy runs; the campaign's Operations Board comes later); anywhere else moves the camera there.
      if (near && !near.scavenged) { game.hud.showPoiExpedition(near.id); return; }
      game.hud.closeModal(); game.world.clearFollow?.(); game.world.focusOn({ x, y });
    };
    canvas.onmousemove = e => {
      const r = canvas.getBoundingClientRect(), cx = (e.clientX - r.left) / r.width * W, cy = (e.clientY - r.top) / r.height * H;
      const x = world.left + (cx - ox) / k, y = world.top + (cy - oy) / k;
      if (m.region) {
        const site = m.region.sites.find(s => Math.hypot(s.x - x, s.y - y) < 10 / k);
        setHoverPoi(site ? { siteId: site.id } : null);
        setInfo(site ? `${site.name} · ${site.description} · about ${site.walkTiles} tiles on foot${site.poiName ? ' · ' + site.poiName : ' · roadside'}` : '');
        return;
      }
      const near = m.pois.find(p => Math.hypot(p.x - x, p.y - y) < 10 / k);
      setHoverPoi(near || null);
      setInfo(near ? `${near.name}${near.scavenged ? ' · scavenged' : ' · click to plan an expedition'}` : '');
    };
  }, [game, f, landRevision, hoverPoi]);
  const counts = { people: f.entities.filter(e => e.kind === 'survivor' && !e.hidden).length, dead: f.entities.filter(e => e.kind === 'zombie').length };
  const m = game.simulation.readMinimap();
  const sizeSubtitle = m.w ? `${m.w} × ${m.h} TILES (${m.w * 16} × ${m.h * 16} PX) · ` : '';
  return (
    <>
      <Heading right={`${sizeSubtitle}${counts.people} SURVIVORS · ${counts.dead} OF THE DEAD`}>{m.region ? `REGIONAL INTELLIGENCE · REGION ${m.region.id}` : 'REGION MAP'}</Heading>
      <canvas ref={ref} className="tab-map" />
      {m.region ? (
        <E c="tab-row tab-legend">
          <L c="tab-key lime">SURVIVOR</L><L c="tab-key cloth">STRUCTURE</L><L c="tab-key teal">SITE</L><L c="tab-key violet">STORY SITE</L><L c="tab-key red">MIGRATION ROUTE</L><L c="tab-key wood">DEBRIS</L>
          <E c="spacer" /><L c="tab-sub">{info || 'Hover a site for details; click anywhere to move the camera there. The dashed ring is the protected perimeter; blue squares are reserved building ground.'}</L>
        </E>
      ) : (
        <E c="tab-row tab-legend">
          <L c="tab-key lime">SURVIVOR</L><L c="tab-key red">THE DEAD</L><L c="tab-key cloth">STRUCTURE</L><L c="tab-key wood">WALL</L><L c="tab-key amber">SITE</L>
          <E c="spacer" /><L c="tab-sub">{info || 'Click a site to plan an expedition, or anywhere else to move the camera there.'}</L>
        </E>
      )}
    </>
  );
}

// The campaign's task chain: the current task with CentroCom's issue, objectives, Mara's note and the
// tutorial tip, then every task in order.
function CampaignTasks({ game, c }) {
  const current = c.tasks.find(x => x.kind === 'main' && x.state === 'active');
  const done = c.tasks.filter(x => x.kind === 'main' && x.state === 'completed').length, total = c.tasks.filter(x => x.kind === 'main').length;
  return (
    <>
      <Heading right={`${done} / ${total} COMPLETE · ${c.classification.toUpperCase()}`}>TASKS</Heading>
      {current ? (
        <E c="tab-card tab-feature">
          <E c="tab-row">
            <Icon name="icon_quest" c="tab-icon" />
            <E c="tab-col"><L c="tab-caption">{`CURRENT TASK · ${current.code}`}</L><L c="tab-title">{current.title}</L></E>
          </E>
          {current.centroCom && <L c="tab-body task-issue">{current.centroCom}</L>}
          {current.body && <L c="tab-body">{current.body}</L>}
          {current.objectives.map(o => <Objective key={o.id} o={o} />)}
          {current.tutorial && <L c="tab-body task-tip">{'TIP · ' + current.tutorial}</L>}
          {current.mara && <L c="tab-body task-mara">{'MARA VENN · “' + current.mara + '”'}</L>}
          <E c="tab-reward">
            <L c="tab-caption">AUTHORIZES</L>
            {current.unlocks.map(u => <L key={u} c="tab-pill lime">{u.toUpperCase()}</L>)}
            {current.reward && <L c="tab-pill amber">{current.reward.toUpperCase()}</L>}
          </E>
        </E>
      ) : <L c="tab-empty">No task is active. CentroCom will be in touch.</L>}
      {c.certification?.active && <Certification cert={c.certification} />}
      {c.tasks.some(x => x.kind === 'side' && ['available', 'active'].includes(x.state)) && <Heading>OPTIONAL TASKS</Heading>}
      {c.tasks.filter(x => x.kind === 'side' && ['available', 'active'].includes(x.state)).map(x => (
        <E key={x.id} c="tab-card">
          <E c="tab-row">
            <E c="tab-col grow"><L c="tab-caption">{`${x.code} · ${x.state === 'active' ? 'IN PROGRESS' : 'OFFERED'}`}</L><L c="tab-title">{x.title}</L></E>
            {x.state === 'available' && <B c="tablet-btn primary" onClick={() => { game.command('acceptSideTask', x.id); game.hud.bump(); }}>ACCEPT</B>}
          </E>
          {x.body && <L c="tab-body">{x.body}</L>}
          {x.objectives.map(o => <Objective key={o.id} o={o} />)}
          {x.mara && <L c="tab-body task-mara">{'MARA VENN · “' + x.mara + '”'}</L>}
          {x.reward && <E c="tab-reward"><L c="tab-pill amber">{x.reward.toUpperCase()}</L></E>}
        </E>
      ))}
      <Heading>TASK CHAIN</Heading>
      {c.tasks.filter(x => x.kind === 'main').map(x => (
        <E key={x.id} c={cls('tab-list-row', x.state === 'completed' ? 'done' : x.state)} title={x.state === 'completed' ? x.completion : x.body}>
          <Icon name={x.state === 'completed' ? 'badge_check' : x.state === 'active' ? 'badge_new' : 'badge_lock'} c="tab-badge" />
          <L c="tab-list-index">{x.code}</L>
          <L c="tab-name">{x.title}</L>
          <E c="spacer" />
          <L c="tab-sub">{x.unlocks.length ? 'Authorizes ' + x.unlocks.join(', ') : x.reward}</L>
          <L c="tab-list-rank">{'PHASE ' + x.phase}</L>
        </E>
      ))}
    </>
  );
}

// Workstations and their queues: order recipes (inputs are reserved at once), watch progress, cancel.
function Crafting({ game, c }) {
  const stations = c?.stations || [];
  const reopen = () => game.hud.bump();
  return (
    <>
      <Heading right={`${stations.length} STATION${stations.length === 1 ? '' : 'S'}`}>CRAFTING</Heading>
      {!stations.length && <L c="tab-empty">No workstation yet. Build a Field Workbench and assign an operator.</L>}
      {stations.map(s => (
        <E key={s.id} c="tab-card craft-station">
          <E c="tab-row">
            <Thumb game={game} type={game.frame.entities.find(e => e.id === s.id)?.type || 'field_workbench'} />
            <E c="tab-col grow"><L c="tab-title">{s.name}</L><L c="tab-sub">{s.blueprint ? 'Under construction' : s.operator ? 'Operator: ' + s.operator : 'No operator: post an Engineer or any survivor from the crew screen'}</L></E>
            <L c="tab-pill">{`${s.queue?.length || 0} / ${s.queueCapacity}`}</L>
          </E>
          {(s.queue || []).map(q => (
            <E key={q.index} c="tab-row craft-entry">
              <L c="tab-name">{q.name}</L>
              <E c="grow"><Bar value={q.progress} count={1} tone="lime" /></E>
              <L c="tab-sub">{Math.floor(q.progress * 100) + '%'}</L>
              <B c="tablet-btn" title="Cancel: inputs come back less half the progress made" onClick={() => { game.command('cancelCraft', s.id, q.index); reopen(); }}>✕</B>
            </E>
          ))}
          <E c="tab-row craft-recipes">
            {s.recipes.map(r => (
              <B key={r.id} c={cls('tablet-btn', !r.unlocked && 'locked')} enabled={r.enabled} title={!r.unlocked ? 'Not authorized yet' : !r.ready ? 'Not yet in production' : `${r.code} · ${r.inputs} · ${r.laborHours} labor-hours`}
                onClick={() => queueOrder(game, s.id, r, reopen)}>{`${r.unlocked ? '+ ' : '🔒 '}${r.name.toUpperCase()} · ${[r.inputs, r.itemInputs].filter(Boolean).join(', ')}`}</B>
            ))}
          </E>
        </E>
      ))}
    </>
  );
}

// How long the food lasts and what the gardens add. Opening the breakdown counts as inspecting it.
function FoodForecast({ game, f }) {
  const hud = game.hud, open = !!hud.forecastOpen;
  const days = f.days == null ? '∞' : f.days.toFixed(1);
  const toggle = () => { hud.forecastOpen = !open; if (!open) game.command('campaignInteraction', 'inspect_food'); hud.bump(); };
  return (
    <B c={cls('tab-card food-forecast', f.days != null && f.days < 2 && 'warn')} title="Show the food breakdown" onClick={toggle}>
      <E c="tab-row">
        <Icon name="icon_food" c="tab-icon" />
        <E c="tab-col grow"><L c="tab-caption">FOOD FORECAST</L><L c="tab-big">{`${days} DAYS`}</L></E>
        <L c="tab-sub">{open ? 'HIDE ▲' : 'BREAKDOWN ▼'}</L>
      </E>
      {open && (
        <E c="tab-col">
          <L c="tab-body">{`${Math.floor(f.food)} Food available · residents eat ${f.perDay.toFixed(1)} a day.`}</L>
          <L c="tab-body">{`${f.staffedGardens} of ${f.gardens} plot${f.gardens === 1 ? '' : 's'} and farm${f.gardens === 1 ? '' : 's'} staffed · about ${f.gardenPerDay.toFixed(1)} Food a day from a full work shift.`}</L>
          <L c="tab-body">{f.gardenPerDay >= f.perDay ? 'Production covers consumption.' : 'Production does not cover consumption yet.'}</L>
        </E>
      )}
    </B>
  );
}

// Queues a craft order, asking first when it would eat into the Components the Radio Relay needs.
export function queueOrder(game, stationId, r, after = () => {}) {
  const go = () => { game.command('queueCraft', stationId, r.id); after(); };
  if (r.warning) { const [title, ...rest] = r.warning.split(' / '); game.hud.confirm(title, rest.join(' / '), go); } else go();
}

// The Operations Board: pick a site, pick a team, launch; watch the team out; read what came back.
function Operations({ game, o }) {
  const hud = game.hud, reopen = () => hud.bump();
  const site = o.sites.find(s => s.id === hud.opsSite) || null, team = (hud.opsTeam || []).filter(id => o.residents.some(r => r.id === id && !r.block));
  const preview = site ? game.simulation.mission(site.id, team) : null;
  const pickSite = id => { hud.opsSite = id; if (id === 'grocery_annex') game.command('campaignInteraction', 'inspect_grocery'); reopen(); };
  const toggle = id => {
    const next = team.includes(id) ? team.filter(x => x !== id) : [...team, id].slice(-(site?.teamSize || o.teamSize)[1]);
    hud.opsTeam = next;
    if (next.length >= (site?.teamSize || o.teamSize)[0]) game.command('campaignInteraction', 'assemble_team');
    reopen();
  };
  const unread = o.reports.some(r => !r.reviewed);
  return (
    <>
      <Heading right={o.board ? 'ONE TEAM AT A TIME' : 'NO OPERATIONS BOARD'}>OPERATIONS</Heading>
      {o.mission && (
        <E c="tab-card warn">
          <E c="tab-row">
            <E c="tab-col grow"><L c="tab-caption">{`TEAM OUT · ${o.mission.phase.toUpperCase()}`}</L><L c="tab-title">{o.mission.name}</L></E>
            {o.mission.phase !== 'return' && <B c="tablet-btn" onClick={() => { game.command('recallMission'); reopen(); }}>RECALL</B>}
          </E>
          <L c="tab-body">{o.mission.team.map(m => `${m.name}${m.downed ? ' (DOWNED)' : ` ${m.hp} HP`}`).join(' · ')}</L>
          {o.mission.progress != null && <Bar value={o.mission.progress} count={1} tone="lime" />}
          <L c="tab-sub">{`Back in about ${o.mission.etaHours.toFixed(1)}h · carries ${o.mission.capacity}${o.mission.cargo ? ' · carrying ' + o.mission.cargo : ''}${o.mission.safe ? ' · a supervised first run: no site events' : ''}`}</L>
        </E>
      )}
      {!o.board && <L c="tab-empty">Build an Operations Board to plan regional missions.</L>}
      <Heading right={`${o.sites.filter(s => s.open).length} OPEN`}>SITES</Heading>
      {o.sites.filter(s => s.revealed).map(s => (
        <B key={s.id} c={cls('tab-card ops-site', site?.id === s.id && 'selected', !s.open && 'locked')} enabled={s.open} onClick={() => pickSite(s.id)}>
          <E c="tab-row">
            <E c="tab-col grow"><L c="tab-name">{s.name + (s.recurring ? ' · ROUTE' : s.expedition ? ' · EXPEDITION' : '')}</L><L c="tab-sub">{s.open ? `${s.walkTiles} tiles · ${s.oneWay.toFixed(1)}h each way · ${s.siteHours}h on site · ${s.expedition ? (s.expedition.recovery ? 'battery recovery, no risk' : 'team of ' + s.teamSize.join('-') + ' · ' + s.expedition.provisions) : s.stock || 'nothing left'}` : s.expedition?.done ? 'Completed' : 'Not authorized yet'}</L></E>
            <L c={cls('tab-pill', s.block ? 'amber' : 'lime')}>{s.block ? s.block.toUpperCase() : s.expedition ? 'ENCOUNTER' : s.safe ? 'SAFE RUN' : `RISK ${Math.round(s.baseRisk * 100)}%`}</L>
          </E>
        </B>
      ))}
      {site && o.board && !o.mission && (
        <E c="tab-card">
          <L c="tab-title">{site.name}</L>
          <L c="tab-body">{site.description}</L>
          {site.expedition && <L c="tab-body">{`Objective: ${site.expedition.objective} · Provisions: ${site.expedition.provisions || 'rations'}. A team without INT 5 takes two hours longer on the technical work.`}</L>}
          <L c="tab-caption">{`TEAM · ${site.teamSize[0]}${site.teamSize[1] > site.teamSize[0] ? '-' + site.teamSize[1] : ''} RESIDENTS`}</L>
          {o.residents.map(r => (
            <B key={r.id} c={cls('tab-row tab-list-row', team.includes(r.id) && 'selected')} enabled={!r.block} onClick={() => toggle(r.id)}>
              <L c="tab-name">{(team.includes(r.id) ? '☑ ' : '☐ ') + r.name}</L><E c="spacer" />
              <L c="tab-sub">{r.block || `${r.job}${r.posted ? ' (posted)' : ''} · STR ${r.str} AGI ${r.agi} INT ${r.int} · ${r.hp} HP · fatigue ${r.fatigue}`}</L>
            </B>
          ))}
          {preview && (
            <L c="tab-body">{`${preview.hours.toFixed(1)}h away · carries ${preview.capacity} · ${preview.rations} Food reserved for rations` + (preview.risk != null ? ` · event risk ${Math.round(preview.risk * 100)}%` : '') + (preview.posted.length ? ` · leaves posts: ${preview.posted.join(', ')}` : '')}</L>
          )}
          <E c="tab-actions">
            <B c="tablet-btn primary" enabled={!preview?.block} title={preview?.block || ''} onClick={() => { if (game.command('launchMission', site.id, team)) { hud.opsTeam = []; } reopen(); }}>{preview?.block ? preview.block.toUpperCase() : 'LAUNCH'}</B>
          </E>
        </E>
      )}
      <Heading right={unread ? 'NEW' : `${o.reports.length}`}>RETURN REPORTS</Heading>
      {!o.reports.length && <L c="tab-empty">No team has come back yet.</L>}
      {o.reports.map(r => (
        <E key={r.id} c={cls('tab-card', !r.reviewed && 'warn')}>
          <E c="tab-row"><L c="tab-name grow">{r.name}</L><L c="tab-sub">{r.when}</L></E>
          <L c="tab-body">{`${r.team.join(', ')} · recovered ${r.cargo || 'nothing'}${r.recalled ? ' (recalled)' : ''}`}</L>
          {r.choice && <L c="tab-body">{r.choice}</L>}
          {r.story && <L c="tab-body">{r.story}</L>}
          {r.event && <L c="tab-body">{{ delay: 'Delayed two hours on site.', injury: 'Injury: ' + r.injuries.map(i => `${i.name} −${i.hp} HP`).join(', '), cargoLoss: 'Part of the haul was lost on the way out.' }[r.event]}</L>}
          <L c="tab-sub">{'Left at the site: ' + r.left}</L>
        </E>
      ))}
      {unread && <E c="tab-actions"><B c="tablet-btn primary" onClick={() => { game.command('reviewReport'); reopen(); }}>MARK REPORTS REVIEWED</B></E>}
    </>
  );
}

// P1-10's live checklist and the 12-hour stability hold.
function Certification({ cert }) {
  return (
    <E c="tab-card">
      <E c="tab-row"><L c="tab-caption grow">ESTABLISHED CAMP CHECKLIST</L><L c="tab-pill">{`${cert.holdHours.toFixed(1)} / ${cert.target} H HELD`}</L></E>
      <Bar value={cert.holdHours} count={cert.target} tone="lime" />
      {cert.items.map(i => (
        <E key={i.id} c={cls('tab-row tab-list-row', i.ok ? 'done' : 'warn')}>
          <Icon name={i.ok ? 'badge_check' : 'icon_warning'} c="tab-badge" />
          <L c="tab-name">{i.label}</L><E c="spacer" /><L c="tab-sub">{i.detail}</L>
        </E>
      ))}
      <L c="tab-sub">Any failing item resets the hold. Sleep and scheduled shifts don't count against it; missing staff, illness and broken buildings do.</L>
    </E>
  );
}

// Shelter All, Seal and Release, and what the migration is doing.
function ShelterControls({ game, sh, mg }) {
  const hud = game.hud, reopen = () => hud.bump();
  const release = () => {
    if (mg && ['warning', 'passage', 'clearing'].includes(mg.state)) hud.confirm('Release early', sh.releaseWarning, () => game.command('releaseShelter', true));
    else { game.command('releaseShelter', false); reopen(); }
  };
  return (
    <>
      <Heading right={`${sh.capacity} SLOTS · ${sh.population} RESIDENTS`}>EMERGENCY SHELTER</Heading>
      {mg && (
        <E c={cls('tab-card', mg.state !== 'cleared' && 'warn')}>
          <L c="tab-title">{{ warning: 'MIGRATION WARNING', passage: 'MIGRATION IN PROGRESS', clearing: 'MIGRATION CLEARING', cleared: 'MIGRATION ROUTE CLEAR' }[mg.state]}</L>
          <L c="tab-body">{mg.state === 'warning' ? `${mg.total} infected expected along the corridor in ${mg.etaHours.toFixed(1)}h.`
            : mg.state === 'cleared' ? `Passed without incident.${mg.cooldownHours ? ` Next migration no sooner than ${mg.cooldownHours.toFixed(0)}h.` : ''}`
            : `${mg.spawned} / ${mg.total} arrived · ${mg.onMap} on the route${mg.clearInHours != null ? ` · clear in ${mg.clearInHours.toFixed(1)}h` : ''}.`}</L>
        </E>
      )}
      {!sh.unlocked ? <L c="tab-empty">Shelter All is authorized with P1-09.</L> : !sh.shelters ? <L c="tab-empty">No working Makeshift Shelter. It holds 8 and is not housing.</L> : (
        <E c="tab-card">
          <E c="tab-row">
            <L c="tab-caption grow">{sh.active ? (sh.sealed ? 'SEALED' : 'SHELTERING') : 'OPEN'}</L>
            {!sh.active && <B c="tablet-btn primary" onClick={() => { game.command('shelterAll'); reopen(); }}>SHELTER ALL</B>}
            {sh.active && !sh.sealed && <B c="tablet-btn primary" onClick={() => { game.command('sealShelter'); reopen(); }}>{`SEAL${sh.entering.length ? ` (${sh.entering.length} NOT IN)` : ''}`}</B>}
            {sh.active && <B c="tablet-btn" onClick={release}>RELEASE</B>}
          </E>
          {sh.active && <L c="tab-body">{`Inside: ${sh.inside.join(', ') || 'nobody yet'}`}</L>}
          {sh.entering.length > 0 && <L c="tab-body">{`On the way in: ${sh.entering.join(', ')}`}</L>}
          {sh.outside.length > 0 && <L c="tab-body warn">{`OUTSIDE: ${sh.outside.join(', ')}`}</L>}
          {sh.away.length > 0 && <L c="tab-sub">{`Away on operations: ${sh.away.join(', ')}`}</L>}
          <L c="tab-sub">Shelter All stops work and calls everyone in: the ill first, then non-combatants, then guards, four through each door at a time. A sealed shelter is quiet and is never noticed.</L>
        </E>
      )}
    </>
  );
}

// Bandages, kits and Medical Supplies: what the Aid Station and first aid draw on.
function MedicalStock({ m }) {
  return (
    <E c="tab-card">
      <E c="tab-row"><Icon name="icon_heal" c="tab-icon" /><L c="tab-caption grow">MEDICAL STOCK</L></E>
      <L c="tab-body">{`${m.stock.bandage} Bandage${m.stock.bandage === 1 ? '' : 's'} · ${m.stock.first_aid_kit} First Aid Kit${m.stock.first_aid_kit === 1 ? '' : 's'} · ${Math.floor(m.supplies)} Medical Supplies`}</L>
      <L c="tab-sub">A bleeding survivor uses a Bandage (+10 HP) or a Kit (+25 HP) by themselves, at most one every 6 hours. Treatment in an Aid Station bed uses a Medical Supply every 4 patient-hours.</L>
    </E>
  );
}

// Guards on their Guard Post routes, the Lookout's watch, the ammunition and what has been seen.
function Defense({ game, d }) {
  const reopen = () => game.hud.bump();
  return (
    <>
      <Heading right={d.threatsActive ? 'THREATS ACTIVE' : 'PROTECTED PERIOD'}>DEFENSE</Heading>
      {d.ackNeeded && (
        <E c="tab-card warn">
          <L c="tab-title">INFECTED DETECTED</L>
          <L c="tab-body">The Lookout reported a contact. Acknowledge the alert so CentroCom knows someone read it.</L>
          <E c="tab-actions"><B c="tablet-btn primary" onClick={() => { game.command('campaignInteraction', 'ack_alert'); reopen(); }}>Acknowledge alert</B></E>
        </E>
      )}
      <E c="tab-card">
        <E c="tab-row"><L c="tab-caption grow">AMMUNITION</L><L c={cls('tab-pill', d.ammo < d.pistolMinAmmo && 'amber')}>{`${Math.floor(d.ammo)} ROUNDS`}</L></E>
        <L c="tab-sub">{`Guards are issued pistols while ${d.pistolMinAmmo} or more rounds are in stock, a round a shot, and switch to melee when none are left.`}</L>
      </E>
      <Heading right={`${d.guards.length} POSTED`}>PATROL</Heading>
      {!d.guards.length && <L c="tab-empty">No Guard posted. Build a Guard Post and assign a survivor to it.</L>}
      {d.guards.map(g => (
        <E key={g.id} c="tab-card">
          <E c="tab-row">
            <E c="tab-col grow"><L c="tab-name">{g.name}</L><L c="tab-sub">{`${g.gear} · ${g.onDuty ? g.task || 'on duty' : 'off shift'}`}</L></E>
          </E>
          <E c="tab-row">
            <L c="tab-caption">STANCE</L>
            {[['intercept', 'INTERCEPT'], ['hold', 'HOLD']].map(([id, label]) => <B key={id} c={cls('tablet-btn', g.stance === id && 'primary')} title={id === 'intercept' ? 'Chase infected seen within 10 tiles past the patrol radius' : 'Stay on the route and fight only what comes close'} onClick={() => { game.command('setGuardStance', g.id, id); reopen(); }}>{label}</B>)}
          </E>
          <E c="tab-row">
            <L c="tab-caption">ROUTE</L>
            {d.routes.map((name, i) => <B key={i} c={cls('tablet-btn', g.route === i && 'primary')} onClick={() => { game.command('setGuardRoute', g.id, i); reopen(); }}>{name.toUpperCase()}</B>)}
          </E>
        </E>
      ))}
      <Heading right={`${d.watch.length} ON WATCH`}>WATCH</Heading>
      {!d.watch.length && <L c="tab-empty">Nobody on watch. A Guard posted at a Lookout Post sees 45 tiles all round during the work shift. They cannot patrol at the same time.</L>}
      {d.watch.map(w => <E key={w.id} c="tab-row tab-list-row"><L c="tab-name">{w.name}</L><E c="spacer" /><L c="tab-sub">{w.onWatch ? 'On the platform' : w.onDuty ? 'Climbing up' : 'Off shift'}</L></E>)}
      <Heading right={`${d.alerts.length} OPEN`}>ALERTS</Heading>
      {!d.alerts.length && <L c="tab-empty">No contacts reported.</L>}
      {d.alerts.map(a => (
        <E key={a.id} c={cls('tab-row tab-list-row', a.tutorial && 'warn')}>
          <L c="tab-name">{`${a.count} infected · ${a.direction}`}</L><E c="spacer" />
          <L c="tab-sub">{`${a.lookout ? 'Lookout' : 'Camp'} · seen ${a.agoHours < .05 ? 'now' : a.agoHours.toFixed(1) + 'h ago'}`}</L>
        </E>
      ))}
    </>
  );
}

// The Radio Kit's broadcast and the candidates who answered it.
function Recruitment({ game, r }) {
  const hud = game.hud, reopen = () => hud.bump();
  // Seeing a candidate's card counts as reviewing it.
  useEffect(() => { if (r.candidates.length) game.command('campaignInteraction', 'review_candidate'); }, [r.candidates.length]);
  const radio = r.radio;
  return (
    <>
      <Heading right={`${r.population} RESIDENTS · ${r.beds} BEDS`}>RECRUITMENT</Heading>
      <E c="tab-card">
        <E c="tab-row">
          <E c="tab-col grow">
            <L c="tab-title">RADIO KIT</L>
            <L c="tab-sub">{!radio ? 'No working Radio Kit. Build one to broadcast.' : radio.broadcasting != null ? `Broadcasting · ${radio.operator || 'waiting for an operator'}` : radio.waiting ? 'Broadcast sent. Replies take 4-8 hours, if any come.' : radio.block || `Ready · costs ${radio.cost} Food and half an hour of an operator's time`}</L>
          </E>
          {radio && <B c="tablet-btn primary" enabled={radio.canBroadcast} onClick={() => { game.command('broadcast'); reopen(); }}>{`BROADCAST · ${radio.cost} FOOD`}</B>}
        </E>
        {radio?.broadcasting != null && <Bar value={radio.broadcasting} count={1} tone="lime" />}
      </E>
      {r.contacts.length > 0 && <Heading right={`${r.contacts.length} STANDING`}>CONTACTS</Heading>}
      {r.contacts.map(c => (
        <E key={c.id} c="tab-row tab-list-row">
          <L c="tab-name">{c.name}</L><E c="spacer" />
          <L c="tab-sub">{`Maintenance crew · Quality ${c.quality}`}</L>
          <B c="tablet-btn" onClick={() => { game.command('inviteContact', c.id); reopen(); }}>INVITE</B>
        </E>
      ))}
      <Heading right={`${r.candidates.length} WAITING`}>CANDIDATES</Heading>
      {!r.candidates.length && <L c="tab-empty">Nobody is waiting. Rejecting a candidate costs nothing and keeps the channel open.</L>}
      {r.candidates.map(c => (
        <E key={c.id} c="tab-card candidate-card">
          <E c="tab-row">
            <E c="tab-col grow"><L c="tab-title">{c.name}</L><L c="tab-sub">{`Quality ${c.quality} · ${c.hp} HP · eats ${c.food} Food a day · waits ${c.expiresIn.toFixed(0)}h more`}</L></E>
          </E>
          <L c="tab-body">{`STR ${c.stats.str}   END ${c.stats.end}   AGI ${c.stats.agi}   INT ${c.stats.int}   CHA ${c.stats.cha}`}</L>
          {c.traits.length > 0 && <E c="tab-row">{c.traits.map(t => <L key={t.id} c={cls('tab-pill', t.type === 'drawback' ? 'amber' : 'lime')} title={t.effect}>{t.name.toUpperCase()}</L>)}</E>}
          <E c="tab-actions">
            <B c="tablet-btn primary" enabled={!r.acceptBlock} title={r.acceptBlock || 'They walk in along a safe road'} onClick={() => { game.command('acceptCandidate', c.id); reopen(); }}>{r.acceptBlock ? r.acceptBlock.toUpperCase() : 'ACCEPT'}</B>
            <B c="tablet-btn" onClick={() => { game.command('declineCandidate', c.id); reopen(); }}>REJECT</B>
          </E>
        </E>
      ))}
    </>
  );
}

function Pending({ tab }) {
  const what = { defense: 'Guard patrols, watch posts and threat alerts', recruitment: 'Radio broadcasts and candidate review', operations: 'Scavenging runs and expeditions' }[tab];
  return (<><Heading>{tab.toUpperCase()}</Heading><L c="tab-empty">{`${what} arrive with the next stage of the campaign.`}</L></>);
}
