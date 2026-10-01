// The in-game HUD from GameHud.cs: the clock card (day strip, refuge integrity, notifications and
// orders), supplies, survivor roster, action dock, helper prompt, incursion banner, inspector and
// dialogs, plus the title screen.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { B, E, L, Icon, cls, portrait, bg, spriteUrl, kitVars } from './ui.jsx';
import { Bar } from './TabletParts.jsx';
import { DayDial } from './DayDial.jsx';
import { Inspector } from './Inspector.jsx';
import { SuppliesCard } from './SuppliesCard.jsx';
import { Dialog } from './Dialogs.jsx';
import { StartScreen } from './StartScreen.jsx';
import { DEFAULT_TACTICAL_ZOOM, MIN_ZOOM, MAX_ZOOM } from '../host/worldView.js';
import { audio } from '../host/audio.js';

const pad2 = n => String(Math.floor(n)).padStart(2, '0');
// The dock and its zoom row, plus a gap: the inspector never reaches lower than this.
const DOCK_CLEARANCE = 132;
const NEXT_SIDE = { north: 'east', east: 'south', south: 'west', west: 'any' };

// PanelSettings: scale with screen size against 1440 × 900, matching width and height equally.
// HUD_SIZE shrinks the whole HUD relative to that reference.
const HUD_SIZE = 0.8;
function usePanelScale() {
  const measure = () => ({ w: window.innerWidth, h: window.innerHeight, scale: HUD_SIZE * Math.sqrt((window.innerWidth / 1440) * (window.innerHeight / 900)) });
  const [size, setSize] = useState(measure);
  useEffect(() => {
    const onResize = () => setSize(measure());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

export function Hud({ game }) {
  const hud = game.hud;
  useSyncExternalStore(hud.subscribe, hud.getVersion);
  const { w, h, scale } = usePanelScale();
  // The supplies card folds; the inspector sits below whatever it shows.
  const [suppliesHeight, setSuppliesHeight] = useState(285);
  const inspectorTop = 16 + suppliesHeight + 8;
  const rootStyle = { width: w / scale, height: h / scale, transform: `scale(${scale})` };

  if (game.fatal) {
    return (
      <div className="hud-root root fatal-screen" style={rootStyle}>
        <L c="heading">Afterlife could not continue</L>
        <pre className="fatal-trace">{game.fatal}</pre>
      </div>
    );
  }
  if (hud.closed) {
    return (
      <div className="hud-root root" style={rootStyle}>
        <E c="start-screen"><E c="world-loading-panel">
          <L c="world-loading-eyebrow">AFTERLIFE</L>
          <L c="world-loading-heading">YOUR REFUGE IS SAVED</L>
          <L c="world-loading-description">The game server has stopped. You can close this tab.</L>
        </E></E>
      </div>
    );
  }
  const f = game.frame, d = game.data;
  if (!game.ready || !f || !d) return <div className="hud-root root" style={rootStyle}><E c="boot-screen"><L c="world-loading-activity">Loading Afterlife...</L></E></div>;
  const inGame = !hud.isStartScreenOpen;
  return (
    <div className="hud-root root" style={rootStyle}>
      {inGame && <ClockCard game={game} f={f} d={d} />}
      {inGame && <SuppliesCard game={game} onHeight={setSuppliesHeight} />}
      {inGame && <RosterCard game={game} f={f} d={d} />}
      {inGame && <ActionDock game={game} f={f} d={d} />}
      {/* Only while placing a building or claiming land: why a spot is refused and how to finish. */}
      {inGame && hud.hint && <L c="hud-helper-bar">{hud.hint}</L>}
      {inGame && hud.deployIntro && <div className="deploy-intro" aria-live="polite"><L c="deploy-intro-title">{hud.deployIntro.title}</L></div>}
      {inGame && f.incoming && <L c="incursion-alert-card">{'⚠ ' + f.incoming}</L>}
      {inGame && !hud.modal && hud.selected >= 0 && <Inspector game={game} id={hud.selected} top={inspectorTop} maxHeight={h / scale - inspectorTop - DOCK_CLEARANCE} />}
      {hud.isStartScreenOpen && <StartScreen game={game} />}
      {hud.modal && <E c="backdrop"><Dialog game={game} modal={hud.modal} /></E>}
    </div>
  );
}

// The clock card, top left, as a small overseer tablet: the day strip beside the day, time and speed
// controls and the notification bell, then refuge integrity and the current orders.
function ClockCard({ game, f, d }) {
  const hud = game.hud, hour = f.hour, campaign = d.campaign;
  // A campaign runs on work shifts (07:00-19:00); a legacy run counts down to nightfall and dawn.
  const countdown = campaign
    ? (campaign.workShift ? Math.ceil(19 - hour) + 'h left in the work shift' : Math.ceil((7 - hour + 24) % 24 || 24) + 'h until the work shift')
    : hour >= 6 && hour < 18 ? Math.ceil(18 - hour) + 'h until nightfall' : hour >= 18 ? Math.ceil(24 - hour + 6) + 'h until dawn' : Math.ceil(6 - hour) + 'h until dawn';
  const stopped = game.clockStopped;
  const speed = n => cls('tablet-btn clock-speed', !stopped && game.speed === n && 'primary');
  return (
    <div className="clock-tablet" style={kitVars()}>
      <E c="tablet-screen">
        <E c="clock-main">
          <DayDial hour={hour} />
          <E c="tab-col grow clock-info">
            <E c="tab-row">
              <L c="clock-day">{campaign ? `DAY ${pad2(f.day)}` : `DAY ${pad2(f.day)} / 24`}</L>
              <E c="spacer" />
              <NoticeBell hud={hud} />
            </E>
            <E c="tab-row clock-time-row">
              <L c="clock-time">{`${pad2(hour)}:${pad2(hour % 1 * 60)}`}</L>
              <L c="tablet-chip">{campaign ? (campaign.workShift ? 'WORK SHIFT' : 'REST') : f.phase.toUpperCase()}</L>
            </E>
            <L c="clock-countdown">{countdown}</L>
            <E c="tab-row clock-speeds">
              <B c={cls('tablet-btn clock-speed', stopped && 'primary')} title="Pause [ Space ]" onClick={() => game.togglePause()}>{stopped ? '▶' : '⏸'}</B>
              <B c={speed(1)} onClick={() => game.setSpeed(1)}>1×</B>
              <B c={speed(2)} onClick={() => game.setSpeed(2)}>2×</B>
              <B c={speed(4)} onClick={() => game.setSpeed(4)}>4×</B>
            </E>
          </E>
        </E>
        <Integrity f={f} />
        <OrdersRow game={game} summary={d.tablet} />
      </E>
      {hud.noticesOpen && <NoticeList hud={hud} />}
    </div>
  );
}

// Game notifications wait behind this bell: it counts the unread ones and pulses while one is new.
function NoticeBell({ hud }) {
  const n = hud.unreadNotices;
  return (
    <B c={cls('tablet-btn clock-bell', hud.noticesOpen && 'primary', hud.noticePulseUntil > 0 && 'pulse')} title="Notifications" onClick={() => hud.toggleNotices()}>
      <Icon name="icon_message" c="clock-bell-icon" />
      {n > 0 && <L c="clock-bell-badge">{n > 9 ? '9+' : String(n)}</L>}
    </B>
  );
}

function NoticeList({ hud }) {
  const latest = hud.journal.slice(-6).reverse();
  return (
    <E c="clock-notices">
      <E c="tab-heading"><L c="tab-heading-text">NOTIFICATIONS</L><E c="spacer" /><B c="tablet-btn clock-notices-journal" onClick={() => hud.showJournal()}>JOURNAL [ J ]</B></E>
      {latest.length === 0 && <L c="tab-empty">Nothing to report yet.</L>}
      {latest.map((e, i) => (
        <E key={hud.journal.length - i} c="tab-message">
          <L c="tab-from">{e.title}</L>
          <L c="tab-body">{e.message}</L>
        </E>
      ))}
    </E>
  );
}

// The current orders under the clock, from the tablet: the quest and its next unmet objective.
function OrdersRow({ game, summary }) {
  const q = summary?.quest;
  if (!q) return null;
  const next = q.objectives.find(o => !o.done) || q.objectives[0];
  return (
    <B c="orders-row" title="Open your orders on the tablet [ Tab ]" onClick={() => game.hud.showTablet('quests')}>
      <Icon name="icon_quest" c="orders-icon" />
      <E c="orders-text">
        <L c="orders-caption">{`ORDERS · ${summary.rank.toUpperCase()}`}</L>
        <L c="orders-title">{q.title}</L>
        <L c="orders-objective">{next ? `${next.text} · ${Math.floor(next.value)}/${next.count}` : q.pending}</L>
      </E>
      {summary.unread > 0 && <L c="orders-unread">{summary.unread + ' NEW'}</L>}
    </B>
  );
}

// Refuge integrity: the core's (or the campfire's) health, on the kit's supply bar.
function Integrity({ f }) {
  const core = f.entities.find(e => e.kind === 'building' && (e.type === 'core' || e.type === 'campfire'));
  const integrity = core && core.maxHP > 0 ? Math.min(1, Math.max(0, core.hp / core.maxHP)) : 1;
  return (
    <E c="clock-integrity">
      <E c="tab-row">
        <Icon name="icon_integrity" c="clock-integrity-icon" />
        <L c="tab-caption">{core?.type === 'campfire' ? 'CAMPFIRE INTEGRITY' : 'REFUGE INTEGRITY'}</L>
        <E c="spacer" />
        <L c={cls('tab-count', integrity < 0.35 && 'clock-integrity-low')}>{Math.round(integrity * 100) + '%'}</L>
      </E>
      <Bar value={integrity} count={1} tone={integrity < 0.35 ? 'red' : integrity < 0.7 ? 'amber' : 'lime'} />
    </E>
  );
}

// The survivors card, drawn as a small overseer tablet: the kit bezel around a dark screen, the
// tablet's list rows and buttons. The CREW button opens the full crew screen on the real tablet.
function RosterCard({ game, f, d }) {
  const hud = game.hud, world = game.world;
  const survivors = f.entities.filter(e => e.kind === 'survivor');
  // Patrol summary as the Unity HUD counts it: unassigned sides fall back to id % 4, "any" to north.
  const counts = { n: 0, e: 0, s: 0, w: 0 };
  for (const s of survivors) {
    const side = s.side ?? '';
    if (side === 'north' || (side === '' && s.id % 4 === 0)) counts.n++;
    else if (side === 'east' || (side === '' && s.id % 4 === 1)) counts.e++;
    else if (side === 'south' || (side === '' && s.id % 4 === 2)) counts.s++;
    else if (side === 'west' || (side === '' && s.id % 4 === 3)) counts.w++;
    else counts.n++;
  }
  const toggleFollow = sid => {
    if (world.followTargetId === sid) world.clearFollow();
    else { game.select(sid); world.follow(sid); }
    hud.bump();
  };
  return (
    <div className="roster-tablet" style={kitVars()}>
      <E c="tablet-screen">
        <E c="tablet-head roster-head">
          <Icon name="icon_survivor" c="tablet-head-icon" />
          <L c="tablet-title">SURVIVORS</L>
          <L c="tablet-chip">{`${survivors.length} / ${f.capacity}`}</L>
          <E c="spacer" />
          <B c="tablet-btn roster-head-btn" title="Tablet · Crew [ C ]" onClick={() => hud.showCrew()}>CREW</B>
          <B c="tablet-btn roster-head-btn roster-fold" title={hud.rosterCollapsed ? 'Show survivors' : 'Hide survivors'} onClick={() => hud.toggleRoster()}>{hud.rosterCollapsed ? '+' : '−'}</B>
        </E>
        {!hud.rosterCollapsed && (
          <div className="ui-scroll roster-list">
            {survivors.length === 0 && <L c="tab-empty">Nobody is left at the refuge.</L>}
            {survivors.map(s => {
              const followed = world.followTargetId === s.id;
              const status = s.downed ? 'DOWNED' : s.task ? s.task : s.role ? s.role : s.condition;
              const badge = s.side && s.side !== 'any' ? s.side.toUpperCase() : s.role ? s.role.toUpperCase() : 'PATROL';
              const hp = s.maxHP > 0 ? Math.max(0, s.hp) / s.maxHP : 1;
              return (
                <E key={s.id} c={cls('tab-list-row tab-survivor roster-row', hud.selected === s.id && 'active')}
                  onClick={e => { if (e.target.closest('button')) return; audio.playClick(); game.select(s.id); }}>
                  <div className="ui-sprite tab-portrait small" style={bg(portrait(s.id))} />
                  <E c="tab-col grow">
                    <L c="tab-name">{s.name}</L>
                    <L c={cls('tab-sub roster-status', s.downed && 'downed')}>{`${s.campaignJob ? s.campaignJob.toUpperCase() : 'LVL ' + s.level} · ${status}`}</L>
                    <Bar value={hp} count={1} tone={hp < 0.35 ? 'red' : hp < 0.7 ? 'amber' : 'lime'} />
                  </E>
                  <B c={cls('tablet-btn roster-focus', followed && 'primary')} title={followed ? 'Click to stop following survivor' : 'Focus camera & follow survivor'} onClick={() => toggleFollow(s.id)}>⌖</B>
                  <B c="tab-pill roster-side" title="Cycle patrol side" onClick={() => game.command('assign', s.id, NEXT_SIDE[s.side] || 'north')}>{badge}</B>
                </E>
              );
            })}
          </div>
        )}
        {!hud.rosterCollapsed && !d.campaign && (
          <B c="tablet-btn primary roster-recruit" enabled={d.freeBeds > 0 && !d.broadcasting} onClick={() => hud.showRecruitment()}>
            <L c="roster-recruit-label">+ RECRUIT SURVIVOR</L>
            <L c="roster-recruit-cost">{d.recruitCost}</L>
          </B>
        )}
        <E c="roster-patrol">
          <L c="tab-caption">PATROL</L>
          {[['N', counts.n], ['E', counts.e], ['S', counts.s], ['W', counts.w]].map(([k, n]) => <L key={k} c={cls('tab-pill', n > 0 && 'lime')}>{`${k} ${n}`}</L>)}
        </E>
      </E>
    </div>
  );
}

function DockSquare({ sprite, fallback, label, onClick, active, title, badge = 0, pulse = false }) {
  return (
    <B c={cls('btn-dock-square', active && 'alarm-active', pulse && 'dock-pulse')} onClick={onClick} title={title}>
      {spriteUrl(sprite) ? <Icon name={sprite} c="dock-icon-sprite" /> : <L c="dock-icon">{fallback}</L>}
      <L c="dock-label">{label}</L>
      {badge > 0 && <L c="dock-badge">{String(badge)}</L>}
    </B>
  );
}

function ActionDock({ game, f, d }) {
  const hud = game.hud, world = game.world;
  const zoomPct = Math.round(DEFAULT_TACTICAL_ZOOM / Math.max(0.01, world.currentZoom) * 100);
  return (
    <E c="action-dock-container">
      <E c="telemetry-row">
        <E c="zoom-group">
          <B c="btn-zoom" title="Zoom Out [ - / Scroll Down ]" enabled={world.targetZoom < MAX_ZOOM - 0.005} onClick={() => world.zoomCamera(-0.06)}>−</B>
          <B c="btn-zoom-level" title="Reset Tactical Zoom [ Home ]" onClick={() => game.focusOrResetCamera()}>{zoomPct + '%'}</B>
          <B c="btn-zoom" title="Zoom In [ + / Scroll Up ]" enabled={world.targetZoom > MIN_ZOOM + 0.005} onClick={() => world.zoomCamera(0.06)}>+</B>
          <B c="btn-zoom-reset" title="Center Camera / Focus Selected [ F ]" onClick={() => game.focusOrResetCamera()}>⌂</B>
        </E>
      </E>
      <E c="dock-buttons-row">
        <DockSquare sprite="icon_build" fallback="⚒" label="BUILD" title="Tablet · Construction [ B ]" onClick={() => hud.showBuild()} />
        <DockSquare sprite="icon_tablet" fallback="▣" label="TABLET" title="Overseer tablet: orders, messages, milestones [ Tab ]" badge={d.tablet?.unread || 0} pulse={hud.tabletPulse} onClick={() => hud.showTablet()} />
        <DockSquare sprite="icon_survivor" fallback="👥" label="CREW" title="Tablet · Crew [ C ]" badge={d.tablet?.waiting || 0} onClick={() => hud.showCrew()} />
        <DockSquare sprite="icon_expedition" fallback="⛺" label="EXPED" title="Tablet · Expeditions [ E ]" onClick={() => hud.showExpeditions()} />
        <DockSquare sprite="icon_map" fallback="⛶" label="LAND" title="Claim land [ L ]" onClick={() => game.toggleExpansion()} />
        <DockSquare sprite="icon_alarm" fallback="🔔" label="ALARM" active={f.alarm} onClick={() => game.command(f.alarm ? 'clearAlarm' : 'raiseAlarm')} />
        <DockSquare sprite="icon_base" fallback="▦" label="BASE" title="Tablet · Stockpile, workshop & trader" onClick={() => hud.showStockpile()} />
        <DockSquare sprite="icon_damage" fallback="⚡" label="ADMIN" active={f.freeBuild} title="Tablet · Admin [ ~ / F1 ]" onClick={() => hud.showAdmin()} />
        <DockSquare sprite="icon_menu" fallback="⚙" label="MENU" title="Tablet · Settings" onClick={() => hud.showMenu()} />
      </E>
    </E>
  );
}
