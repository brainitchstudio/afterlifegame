// GameHud.ShowCrew, as the tablet's Crew screen: the roster (filters and expandable dossiers), jobs
// and careers, the shift scheduler (watchtower sentries, patrol sectors, facility staffing,
// scavengers) and whoever is waiting at the gate.
import { useState } from 'react';
import { B, E, L, Icon, Card, cls, bg, portrait } from './ui.jsx';
import { audio } from '../host/audio.js';
import { Heading, Gate } from './TabletParts.jsx';
import { JOBS_CONFIG, JOB_BY_ID, JOB_UPGRADES_BY_ROLE } from '../engine/data.mjs';

const pad2 = n => String(Math.floor(n)).padStart(2, '0');
// Signed whole-number percentages for the stat benefit lines.
const signed = v => { const r = Math.sign(v) * Math.round(Math.abs(v)); return r > 0 ? '+' + r : String(r); };
const isGuardLike = s => s.role === 'guard' || s.role === 'sentry' || s.role === 'patrol' || !s.role;
const isSpecialist = s => s.role === 'medic' || s.role === 'engineer' || s.role === 'farmer' || s.role === 'researcher' || s.role === 'logger';
const ROLE_ICONS = { medic: '✚ ', engineer: '⚒ ', farmer: '♧ ', guard: '⚔ ', sentry: '♜ ', scavenger: '➚ ', researcher: '⚗ ', logger: '🪓 ' };
const SHIFT_NAMES = ['Day Shift (06:00 – 14:00)', 'Evening Shift (14:00 – 22:00)', 'Night Shift (22:00 – 06:00)'];

// Campaign posts reuse engine roles; these are the names a campaign player knows them by.
const CAMPAIGN_POST = { logger: 'SALVAGE YARD', sentry: 'ON WATCH', patrol: 'UNPOSTED' };

export function CrewScreen({ game }) {
  const hud = game.hud;
  const survivors = game.frame.entities.filter(e => e.kind === 'survivor');
  const downed = survivors.filter(s => s.downed).length;
  const injured = survivors.filter(s => s.condition === 'injured' && !s.downed).length;
  const away = survivors.filter(s => s.away).length;
  let pop = `${survivors.length} / ${game.frame.capacity} SURVIVORS`;
  if (downed) pop += `  ·  ⚠ ${downed} DOWNED`;
  if (injured) pop += `  ·  ✚ ${injured} INJURED`;
  if (away) pop += `  ·  ⛺ ${away} ON EXPEDITION`;
  const tab = t => () => hud.setCrewTab(t);
  return (
    <E c="crew-embed">
      <Heading right={pop}>SURVIVORS & CREW</Heading>
      <E c="crew-tab-bar">
        <B c={cls('crew-tab-btn', hud.currentCrewTab === 'roster' && 'active')} onClick={tab('roster')}>{`👥 ROSTER (${survivors.length})`}</B>
        <B c={cls('crew-tab-btn', hud.currentCrewTab === 'jobs' && 'active')} onClick={tab('jobs')}>💼 JOBS & CAREERS (7)</B>
        <B c={cls('crew-tab-btn', hud.currentCrewTab === 'shifts' && 'active')} onClick={tab('shifts')}>⏱ SHIFTS & DUTIES</B>
        <B c={cls('crew-tab-btn', hud.currentCrewTab === 'gate' && 'active')} onClick={tab('gate')}>{`⛩ AT THE GATE (${game.data.tablet?.waiting || 0})`}</B>
      </E>
      <E c="crew-embed-body">
        {hud.currentCrewTab === 'jobs' ? <JobsTab game={game} survivors={survivors} /> : hud.currentCrewTab === 'shifts' ? <ShiftsTab game={game} survivors={survivors} /> : hud.currentCrewTab === 'gate' ? <Gate game={game} /> : <RosterTab game={game} survivors={survivors} />}
      </E>
    </E>
  );
}

function RosterTab({ game, survivors }) {
  const hud = game.hud, world = game.world;
  const armed = survivors.filter(s => s.gear && s.gear !== 'fists').length;
  const resting = survivors.filter(s => s.task === 'resting' || s.task === 'to-bed').length;
  const filters = [
    ['all', `ALL (${survivors.length})`],
    ['guard', `GUARDS & PATROL (${survivors.filter(isGuardLike).length})`],
    ['specialist', `SPECIALISTS (${survivors.filter(isSpecialist).length})`],
    ['scavenger', `SCAVENGERS (${survivors.filter(s => s.role === 'scavenger').length})`],
    ['casualty', `CASUALTIES (${survivors.filter(s => s.condition === 'injured' || s.downed).length})`],
  ];
  const filtered = survivors.filter(s => {
    if (hud.rosterFilter === 'guard') return isGuardLike(s);
    if (hud.rosterFilter === 'specialist') return isSpecialist(s);
    if (hud.rosterFilter === 'scavenger') return s.role === 'scavenger';
    if (hud.rosterFilter === 'casualty') return s.condition === 'injured' || s.downed;
    return true;
  });
  return (
    <>
      <E c="crew-summary-banner">
        <E c="row-center">
          <Icon name="icon_base" c="vital-icon-sprite" />
          <L c="crew-summary-text">{`COLONY ROSTER  ·  ${game.data.freeBeds} Free Beds  ·  ${armed}/${survivors.length} Armed  ·  ${resting} Resting`}</L>
        </E>
        {!game.data.campaign && <B c="primary" onClick={() => hud.showRecruitment()}>+ RECRUIT SURVIVOR</B>}
      </E>
      <E c="crew-filter-bar">
        <L c="eyebrow">FILTER:</L>
        {filters.map(([key, label]) => (
          <B key={key} c={cls('crew-filter-btn', hud.rosterFilter === key && 'active')} onClick={() => hud.setRosterFilter(key)}>{label}</B>
        ))}
      </E>
      {filtered.length === 0 && <L c="panel-note">No survivors match this filter.</L>}
      {filtered.map(s => {
        const expanded = hud.expandedCrewSurvivors.has(s.id);
        const cond = s.downed ? 'downed' : s.condition === 'injured' ? 'injured' : s.away ? 'away' : 'healthy';
        const condText = s.downed ? 'DOWNED' : s.condition === 'injured' ? 'INJURED' : s.away ? 'EXPEDITION' : 'HEALTHY';
        const followed = world.followTargetId === s.id;
        const ratio = Math.min(1, Math.max(0, s.hp / Math.max(1, s.maxHP)));
        const task = s.downed ? 'Critically wounded! Needs rescue.' : s.task ? s.task : s.role === 'sentry' ? 'Watchtower sentry duty' : s.role === 'guard' ? 'Perimeter defense' : 'Active on duty';
        return (
          <E key={s.id} c={cls('crew-card', cond, expanded && 'expanded')}>
            <E c="crew-card-header" onClick={e => { if (e.target.closest('button')) return; audio.playClick(); hud.toggleCrewExpansion(s.id); }}>
              <E c="crew-card-row">
                <E c="row-center">
                  <E c="staff-avatar">
                    {portrait(s.id) ? <div className="ui-sprite avatar-portrait" style={bg(portrait(s.id))} /> : <L c="avatar-text">{s.name ? s.name[0] : 'S'}</L>}
                  </E>
                  <L c="staff-name">{s.name}</L>
                  <L c="eyebrow">{s.campaignJob ? s.campaignJob.toUpperCase() : `LVL ${s.level}`}</L>
                  <L c="crew-role-badge">{(ROLE_ICONS[s.role] || '◇ ') + (s.campaignJob ? CAMPAIGN_POST[s.role] || (s.role || 'patrol').toUpperCase() : s.role ? s.role.toUpperCase() : 'PATROL')}</L>
                </E>
                <E c="row-center">
                  <B c={cls('btn-survivor-focus', followed && 'focused')} title={followed ? 'Click to stop following survivor' : 'Focus camera & follow survivor'}
                    onClick={() => { if (followed) { world.clearFollow(); hud.bump(); } else { game.select(s.id); world.follow(s.id); hud.closeModal(); } }}>⌖</B>
                  <L c={cls('crew-status-badge', cond)}>{condText}</L>
                  <L c="crew-expand-indicator">{expanded ? '▲' : '▼'}</L>
                </E>
              </E>
              <E c="crew-card-row" style={{ marginTop: 4, marginBottom: 4 }}>
                <E c="row-center">
                  <Icon name="icon_health" c="vital-icon-sprite" />
                  <E c="vital-track" style={{ width: 110 }}><E c={cls('vital-fill', ratio < 0.35 && 'low')} style={{ width: ratio * 100 + '%' }} /></E>
                  <L c="vital-val">{`${Math.ceil(s.hp)}/${Math.ceil(s.maxHP)}`}</L>
                </E>
                <L c="output-sub">{task}</L>
              </E>
              <E c="crew-card-row" style={{ marginTop: 2 }}>
                <E c="row-center">
                  <Icon name="icon_damage" c="vital-icon-sprite" />
                  <L c="eyebrow">{s.gear ? s.gear.toUpperCase() : 'FISTS'}</L>
                  <L c="eyebrow">{'  ·  ' + (s.side && s.side !== 'any' ? `SECTOR: ${s.side.toUpperCase()}` : 'SECTOR: ALL SIDES')}</L>
                </E>
                <B c={expanded ? 'primary' : 'crew-filter-btn'} style={{ margin: 0 }} onClick={() => hud.toggleCrewExpansion(s.id)}>{expanded ? '▲ COLLAPSE DOSSIER' : '▼ EXPAND DOSSIER'}</B>
              </E>
            </E>
            {expanded && <E c="crew-card-expanded-body"><Dossier game={game} sid={s.id} /></E>}
          </E>
        );
      })}
    </>
  );
}

function StatRow({ code, value, primary, secondary, weak, benefit }) {
  return (
    <>
      <E c="stat-row">
        <E c="row-center stat-name-col">
          <L c="stat-name-col">{code}</L>
          {primary ? <L c="stat-aptitude-badge primary">★PRI</L> : secondary ? <L c="stat-aptitude-badge secondary">▲SEC</L> : weak ? <L c="stat-aptitude-badge weak">▼WEAK</L> : null}
        </E>
        <E c="stat-bar-track">
          <E c="stat-bar-fill" style={{ width: Math.min(100, Math.max(0, value * 10)) + '%', backgroundColor: primary ? 'rgb(199,224,148)' : weak ? 'rgb(191,115,97)' : undefined }} />
        </E>
        <L c="stat-val-col">{`${value}/10`}</L>
      </E>
      <L c="stat-desc-sub">{benefit}</L>
    </>
  );
}

function Dossier({ game, sid }) {
  const hud = game.hud;
  const d = game.simulation.readDetails(sid);
  if (d?.kind !== 'survivor') return <L c="panel-note">Could not load detailed survivor dossier telemetry.</L>;
  const active = hud.dossierTab(sid);
  const setTab = t => () => hud.setDossierTab(sid, t);
  const reopen = () => hud.showCrew(d.id, 'roster');
  const run = (...args) => () => { game.command(...args); reopen(); };
  const crew = d.crew;
  const stat = (code, key, value, benefit) => <StatRow code={code} value={value} primary={!crew && d.primaryStat === key} secondary={!crew && d.secondaryStat === key} weak={!crew && d.weakStat === key} benefit={benefit} />;
  // A campaign attribute's work factor: 0.8 + 0.04 per point.
  const work = v => `×${(0.8 + 0.04 * v).toFixed(2)}`;
  return (
    <>
      <E c="crew-card-subtab-bar">
        <B c={cls('crew-card-subtab-btn', active === 'stats' && 'active')} onClick={setTab('stats')}>📊 ATTRIBUTES & STATS</B>
        <B c={cls('crew-card-subtab-btn', active === 'duties' && 'active')} onClick={setTab('duties')}>⚔ DUTIES & LOADOUT</B>
        <B c={cls('crew-card-subtab-btn', active === 'upgrades' && 'active')} onClick={setTab('upgrades')}>{d.jobName ? `⚡ ${d.jobName.toUpperCase()} UPGRADES` : '⚡ JOB UPGRADES'}</B>
      </E>
      <E c="crew-subtab-pane">
        {active === 'stats' && crew && (
          <>
            <E c="crew-card-row" style={{ marginBottom: 6, alignItems: 'center' }}>
              <E c="row-center" style={{ flexGrow: 1 }}><L c="panel-note">{`${crew.jobName} · proficiency ${crew.proficiency}/${crew.proficiencyMax}${crew.laborFactor != null ? ` · works at ×${crew.laborFactor.toFixed(2)}` : ''}`}</L></E>
              <E c="row-center">
                <Icon name="icon_stamina" c="vital-icon-sprite" />
                <L c="vital-lbl">FATIGUE</L>
                <E c="vital-track" style={{ width: 110 }}>
                  <E c="vital-fill" style={{ backgroundColor: crew.fatigue > 85 ? 'rgb(208,105,79)' : crew.fatigue > 60 ? 'rgb(212,162,74)' : 'rgb(97,166,217)', width: Math.min(100, crew.fatigue) + '%' }} />
                </E>
                <L c="vital-val">{`${Math.round(crew.fatigue)}/100`}</L>
              </E>
            </E>
            {crew.exhausted && <E c="crew-summary-banner bleedout-alert"><L c="danger">EXHAUSTED: resting until fatigue falls to 40. A bed recovers 8 an hour, sleeping rough 4.</L></E>}
            {d.condition === 'downed' && (
              <E c="crew-summary-banner bleedout-alert">
                <L c="danger">{`⚠ CRITICAL BLEEDOUT: ${(d.bleed / 42).toFixed(1)}h remaining until death! Requires immediate medical triage.`}</L>
              </E>
            )}
            <L c="card-title">{`ATTRIBUTES · QUALITY ${crew.quality} · MORALE ${Math.round(crew.morale)}`}</L>
            <L c="panel-note">Each point of an attribute adds 4% to the work it governs (×0.80 at 0, ×1.20 at 10). Quality is STR + END + AGI + INT.</L>
            {stat('STR', 'str', d.str, `Gathering & Construction ${work(d.str)} · Melee damage, carrying`)}
            {stat('AGI', 'agi', d.agi, `Scavenging ${work(d.agi)} · Speed, aim`)}
            {stat('END', 'end', d.end, `Farming & Food ${work(d.end)} · Stamina`)}
            {stat('INT', 'int', d.intel, `Crafting & Treatment ${work(d.intel)}`)}
            {stat('CHA', 'cha', d.cha, 'Trade and relations (later authorization)')}
            <L c="card-title">TRAITS</L>
            {crew.traits.length ? crew.traits.map(t => (
              <E key={t.id} c="crew-card-row"><L c={t.type === 'drawback' ? 'danger' : 'staff-name'}>{t.name.toUpperCase()}</L><L c="output-sub">{t.effect}</L></E>
            )) : <L c="panel-note">No notable traits.</L>}
          </>
        )}
        {active === 'stats' && !crew && (
          <>
            <E c="crew-card-row" style={{ marginBottom: 6, alignItems: 'center' }}>
              <E c="row-center" style={{ flexGrow: 1 }}><L c="panel-note">{d.roleDescription || `${d.jobName} duty specialist`}</L></E>
              <E c="row-center">
                <Icon name="icon_expedition" c="vital-icon-sprite" />
                <L c="vital-lbl">XP</L>
                <E c="vital-track" style={{ width: 110 }}>
                  <E c="vital-fill" style={{ backgroundColor: 'rgb(97,166,217)', width: Math.min(100, Math.max(0, d.xp / Math.max(1, d.xpNeeded) * 100)) + '%' }} />
                </E>
                <L c="vital-val">{`${Math.floor(d.xp)}/${Math.floor(d.xpNeeded)}`}</L>
              </E>
            </E>
            {d.condition === 'downed' && (
              <E c="crew-summary-banner bleedout-alert">
                <L c="danger">{`⚠ CRITICAL BLEEDOUT: ${(d.bleed / 42).toFixed(1)}h remaining until death! Requires immediate medical triage.`}</L>
              </E>
            )}
            <L c="card-title">PERMANENT RPG ATTRIBUTES & APTITUDES</L>
            <L c="panel-note">Aptitudes (★PRI, ▲SEC, ▼WEAK) bias seeded growth on level-up. Stats scale combat potency and facility output.</L>
            {stat('STR', 'str', d.str, `Melee Damage: ${signed((d.str - 4) * 7.5)}%, Carrying Loot`)}
            {stat('AGI', 'agi', d.agi, `Speed: ${signed((d.agi - 4) * 3.75)}%, Attack Cooldown: ${signed(-(d.agi - 4) * 3.75)}%`)}
            {stat('END', 'end', d.end, `Health Bonus: ${signed((d.end - 4) * 9)} HP, Bleed-out: ${signed((d.end - 4) * 7.5)}%`)}
            {stat('INT', 'int', d.intel, `Medicine & Repairs: ${signed((d.intel - 4) * 10)}%, Farming Yield`)}
            {stat('CHA', 'cha', d.cha, `Trading: ${signed((d.cha - 4) * 3)}%, Recruitment: ${signed((d.cha - 4) * 3)}%`)}
          </>
        )}
        {active === 'duties' && (
          <>
            <L c="card-title">COMBAT LOADOUT & ASSIGNMENT</L>
            <E c="shift-row">
              <E c="row-center">
                <Icon name="icon_damage" c="vital-icon-sprite" />
                <L c="staff-name">{d.weaponName.toUpperCase()}</L>
                <L c="eyebrow">{'  ·  ' + (d.weaponIsMelee ? 'MELEE' : 'FIREARM')}</L>
              </E>
              <L c="output-sub">{`DMG ${d.weaponDamage.toFixed(1)}  ·  RNG ${Math.round(d.weaponRange)}m  ·  CD ${d.weaponCooldown.toFixed(1)}s`}</L>
            </E>
            <E c="shift-row">
              <E c="row-center">
                <Icon name="icon_base" c="vital-icon-sprite" />
                <L c="staff-name">{(d.postName || 'Perimeter Patrol') + (d.shiftName ? ' · ' + d.shiftName : '')}</L>
              </E>
              <L c="output-sub">{`Task: ${d.task || 'On Duty'}  ·  Sector: ${d.side && d.side !== 'any' ? d.side.toUpperCase() : 'ALL SIDES'}`}</L>
            </E>
            <L c="section">REASSIGN DUTIES & FACILITY POSTS</L>
            <E c="row" style={{ flexWrap: 'wrap' }}>
              {(d.posts || []).map(p => <B key={p.id} c="crew-filter-btn" enabled={p.enabled && !d.away} onClick={run('post', d.id, p.id)}>{p.name}</B>)}
              <B c="crew-filter-btn" enabled={d.role !== 'scavenger' && !d.away} onClick={run('post', d.id, 'scavenger')}>Scavenger at HQ</B>
              <B c="crew-filter-btn" enabled={d.post >= 0 || d.role === 'scavenger'} onClick={run('post', d.id, null)}>Return to Patrol</B>
            </E>
            <L c="section">PATROL SECTOR DEFENSE</L>
            <E c="row">
              {['north', 'east', 'south', 'west', 'any'].map(side => (
                <B key={side} c={d.side === side ? 'primary' : 'crew-filter-btn'} enabled={!d.away} onClick={run('assign', d.id, side)}>{(d.side === side ? '• ' : '') + side.toUpperCase()}</B>
              ))}
            </E>
            <E c="row" style={{ marginTop: 6 }}>
              <B c="crew-filter-btn" enabled={!d.away} onClick={run('orderShelter', d.id)}>{d.sheltered ? 'Step Outside (Clear Shelter)' : 'Order Shelter in Bunkhouse'}</B>
            </E>
          </>
        )}
        {active === 'upgrades' && (
          <>
            <L c="card-title">{`${d.jobName.toUpperCase()} UPGRADE TREE & FACILITY SYNERGY`}</L>
            <L c="panel-note">{`Upgrades researched at ${d.jobName} facilities directly enhance this survivor's operational efficiency.`}</L>
            {d.upgrades?.length ? (
              <E c="tree-node-grid">
                {d.upgrades.map(u => (
                  <E key={u.id} c={cls('tree-node-card', u.owned ? 'unlocked' : u.enabled ? 'researchable' : 'locked')}>
                    <E c="crew-card-row">
                      <L c="card-title">{u.name}</L>
                      {u.owned ? <L c="crew-status-badge healthy">✓ UNLOCKED</L> : u.enabled ? <L c="eyebrow">{u.cost}</L> : u.locked ? <L c="eyebrow">{u.locked.toUpperCase()}</L> : u.requires ? <L c="eyebrow">{`REQ: ${u.parentName}`}</L> : null}
                    </E>
                    <L c="output-sub">{u.description}</L>
                    {!u.owned && (u.enabled && u.buildingId >= 0
                      ? <B c="primary" onClick={run('upgradeBuilding', u.buildingId, u.id)}>{`Research Upgrade (${u.cost})`}</B>
                      : u.buildingId < 0 ? <L c="output-sub">Requires building to be constructed first.</L> : null)}
                  </E>
                ))}
              </E>
            ) : <L c="output-sub">No job tech tree available for this role.</L>}
          </>
        )}
      </E>
      <E c="row-center" style={{ justifyContent: 'center', marginTop: 6 }}>
        <B c="crew-filter-btn" style={{ paddingLeft: 16, paddingRight: 16 }} onClick={() => hud.collapseDossier(sid)}>▲ COLLAPSE DOSSIER</B>
      </E>
    </>
  );
}

function ShiftsTab({ game, survivors }) {
  const hud = game.hud, f = game.frame;
  const hour = f.hour ?? 12;
  const curShift = hour >= 6 && hour < 14 ? 0 : hour >= 14 && hour < 22 ? 1 : 2;
  const again = () => hud.showCrew(hud.selectedCrewSurvivorId, 'shifts');
  const run = (...args) => () => { game.command(...args); again(); };
  const dossier = id => () => hud.openDossier(id, 'duties');
  const buildings = type => f.entities.filter(e => e.kind === 'building' && e.type === type);
  const towers = buildings('tower');
  const scavengers = survivors.filter(s => s.role === 'scavenger');
  const nonScav = survivors.find(s => s.role !== 'scavenger' && s.post < 0 && !s.away);
  return (
    <>
      <E c="crew-summary-banner">
        <E c="row-center">
          <Icon name="icon_time" c="vital-icon-sprite" />
          <L c="crew-summary-text">{`COLONY CLOCK: Day ${f.day ?? 1} · ${pad2(hour)}:00  ·  ACTIVE SHIFT: ${SHIFT_NAMES[curShift].toUpperCase()}`}</L>
        </E>
        {curShift === 2 && <L c="eyebrow">⚠ NIGHT IN EFFECT: Deadliest swarm hours</L>}
      </E>

      <L c="section">WATCHTOWER SENTRY SHIFTS</L>
      <L c="panel-note">Watchtowers are kept across three 8-hour shifts. Sentries spot incursions early, alert guards, and gain +60% damage, +50 range, and 30% faster fire on the platform.</L>
      {towers.length === 0 ? (
        <Card title="NO WATCHTOWERS CONSTRUCTED" body="Construct a Watchtower [ B ] to assign sentries to 8-hour rotating shifts and watch over the perimeter.">
          <B c="primary" onClick={() => hud.showBuild()}>Open Construction [ B ]</B>
        </Card>
      ) : towers.map(tower => (
        <E key={tower.id} c="shift-schedule-box">
          <E c="row-center">
            <Icon name="icon_alarm" c="vital-icon-sprite" />
            <L c="card-title">{`♜ WATCHTOWER #${tower.id}  ·  LOCATION: (${Math.round(tower.x)}, ${Math.round(tower.y)})`}</L>
          </E>
          {[0, 1, 2].map(shift => {
            const sentry = survivors.find(s => s.post === tower.id && s.shift === shift);
            const eligible = survivors.filter(s => !s.away && !s.downed && s.post !== tower.id).slice(0, 3);
            const state = sentry && (sentry.stationed ? 'On Platform' : sentry.task === 'to-tower' ? 'En Route to Tower' : sentry.task === 'resting' ? 'Resting in Bunk' : sentry.task);
            return (
              <E key={shift} c={cls('shift-row', curShift === shift && 'active-shift')}>
                <E c="row-center">
                  <L c="shift-time-badge">{SHIFT_NAMES[shift]}</L>
                  {curShift === shift && <L c="shift-duty-pill">ON DUTY</L>}
                </E>
                {sentry ? (
                  <>
                    <E c="row-center" style={{ flexGrow: 1 }}>
                      <L c="staff-name">{`${sentry.name} (Lv.${sentry.level}) · ${(sentry.gear || '').toUpperCase()} · ${Math.ceil(sentry.hp)}/${Math.ceil(sentry.maxHP)} HP`}</L>
                      <L c="output-sub">{` [${state}]`}</L>
                    </E>
                    <E c="row-center">
                      <B c="crew-filter-btn" onClick={dossier(sentry.id)}>Dossier</B>
                      <B c="btn-release" onClick={run('post', sentry.id, null)}>Relieve</B>
                    </E>
                  </>
                ) : (
                  <E c="row-center" style={{ flexGrow: 1 }}>
                    <L c="eyebrow">— VACANT SHIFT —</L>
                    {eligible.map(c => <B key={c.id} c="crew-filter-btn" onClick={run('assignShift', c.id, tower.id, shift)}>{`+ Assign ${c.name}`}</B>)}
                  </E>
                )}
              </E>
            );
          })}
        </E>
      ))}

      <L c="section">PERIMETER DEFENSE SECTORS</L>
      <L c="panel-note">Guards and Patrol survivors walk outside the wall and engage incoming hostiles. Assign coverage to vulnerable approaches.</L>
      {['north', 'east', 'south', 'west', 'any'].map(side => {
        const guards = survivors.filter(s => (s.role === 'guard' || s.role === 'patrol' || !s.role) && s.side === side);
        const movable = survivors.find(s => (s.role === 'guard' || s.role === 'patrol' || !s.role) && s.side !== side && !s.away);
        return (
          <E key={side} c="sector-box">
            <E c="row-center" style={{ width: 160 }}>
              <L c="card-title">{`${side.toUpperCase()} SECTOR`}</L>
              <L c="eyebrow">{`  (${guards.length} guards)`}</L>
            </E>
            <E c="row-center" style={{ flexGrow: 1 }}>
              {guards.length === 0 ? <L c="output-sub">Unmanned · Higher risk of surprise incursion</L>
                : guards.map(s => <B key={s.id} c="crew-filter-btn" onClick={dossier(s.id)}>{`${s.name} (Lv.${s.level})`}</B>)}
            </E>
            {movable && <B c="crew-filter-btn" onClick={run('assign', movable.id, side)}>{`+ Move ${movable.name}`}</B>}
          </E>
        );
      })}

      <L c="section">FACILITY & WORKPLACE STAFFING</L>
      <L c="panel-note">Specialists posted to facilities heal the wounded, repair damage, and cultivate food supplies.</L>
      {[
        ['clinic', '✚ CLINIC (MEDICS)', 'Treats wounded survivors and rescues the downed. Intelligence speeds treatment.'],
        ['workshop', '⚒ WORKSHOP (ENGINEERS)', 'Rebuilds fence breaches and repairs buildings. Intelligence speeds work.'],
        ['farm', '♧ FARM (FARMERS)', 'Tends crops to feed the colony. Each farmer boosts food production rate.'],
        ['barracks', '⚔ BARRACKS (GUARDS)', 'Roves all sides of the wall and runs down incoming zombies. +30 HP, +25% DMG.'],
        ['lab', '⚗ RESEARCH LAB (RESEARCHERS)', 'Synthesizes tech doctrines, advances colony science, and formulates antidotes. Intelligence speeds research.'],
        ['lumber_mill', '🪓 LUMBER MILL (LOGGERS)', 'Harvests timber and cuts raw wood for barricades and reinforcements. Strength speeds yield.'],
      ].map(([type, title, description]) => {
        const list = buildings(type);
        const maxSlots = type === 'barracks' ? 4 : type === 'lumber_mill' ? 3 : 2;
        return (
          <E key={type} c="shift-schedule-box">
            <L c="card-title">{title}</L>
            <L c="panel-note">{description}</L>
            {list.length === 0 ? <L c="output-sub">{`No ${type} constructed yet. Build one via Construction [ B ].`}</L> : list.map(b => {
              const staff = survivors.filter(s => s.post === b.id);
              const candidate = staff.length < maxSlots ? survivors.find(s => s.post !== b.id && !s.away && !s.downed) : null;
              return (
                <E key={b.id} c="shift-row">
                  <E c="row-center"><L c="shift-time-badge">{`#${b.id} (Staff ${staff.length})`}</L></E>
                  <E c="row-center" style={{ flexGrow: 1 }}>
                    {staff.length === 0 ? <L c="output-sub">No workers posted.</L> : staff.map(w => (
                      <E key={w.id} c="row-center">
                        <B c="crew-filter-btn" onClick={dossier(w.id)}>{`${w.name} (Lv.${w.level})`}</B>
                        <B c="btn-trash" onClick={run('post', w.id, null)}>×</B>
                      </E>
                    ))}
                  </E>
                  {candidate && <B c="primary" onClick={run('post', candidate.id, b.id)}>{`+ Post ${candidate.name}`}</B>}
                </E>
              );
            })}
          </E>
        );
      })}

      <E c="shift-schedule-box">
        <L c="card-title">➚ REFUGE HQ SCAVENGERS</L>
        <L c="panel-note">Prepares supply runs at the core and first in line for expeditions.</L>
        <E c="row-center">
          {scavengers.length === 0 ? <L c="output-sub">No dedicated scavengers.</L> : scavengers.map(s => (
            <E key={s.id} c="row-center">
              <B c="crew-filter-btn" onClick={dossier(s.id)}>{`${s.name} (Lv.${s.level})`}</B>
              <B c="btn-trash" onClick={run('post', s.id, null)}>×</B>
            </E>
          ))}
        </E>
        {nonScav && <B c="crew-filter-btn" onClick={run('post', nonScav.id, 'scavenger')}>{`+ Make ${nonScav.name} Scavenger`}</B>}
      </E>
    </>
  );
}

function JobsTab({ game, survivors }) {
  const hud = game.hud, f = game.frame;
  const [selectedJobId, setSelectedJobId] = useState('guard');
  const job = JOB_BY_ID[selectedJobId] || JOBS_CONFIG[0];
  const role = job.role;

  const again = () => hud.showCrew(hud.selectedCrewSurvivorId, 'jobs');
  const run = (...args) => () => { game.command(...args); again(); };
  const dossier = id => () => hud.openDossier(id, 'stats');

  const getJobCount = j => {
    if (j.role === 'guard') return survivors.filter(isGuardLike).length;
    return survivors.filter(s => s.role === j.role).length;
  };

  const assigned = survivors.filter(s => job.role === 'guard' ? isGuardLike(s) : s.role === job.role);
  const buildings = f.entities.filter(e => e.kind === 'building' && e.type === job.baseBuilding);
  const upgrades = JOB_UPGRADES_BY_ROLE[job.role] || [];
  const candidates = survivors.filter(s => !s.away && !s.downed && (job.role === 'guard' ? !isGuardLike(s) : s.role !== job.role));

  const primaryStat = (job.primaryStat || 'str').toUpperCase();
  const secondaryStat = (job.secondaryStat || 'agi').toUpperCase();

  return (
    <>
      <E c="crew-summary-banner">
        <E c="row-center">
          <Icon name="icon_base" c="vital-icon-sprite" />
          <L c="crew-summary-text">COLONY PROFESSIONS HUB · 7 CAREER DISCIPLINES · PERKS, CAREER LADDERS & WORKSTATIONS</L>
        </E>
      </E>

      {/* 7 Jobs Selector Bar */}
      <E c="jobs-selector-strip">
        {JOBS_CONFIG.map(j => {
          const count = getJobCount(j);
          const active = selectedJobId === j.id;
          return (
            <button
              key={j.id}
              type="button"
              className={cls('jobs-tab-pill', active && 'active')}
              onClick={() => { audio.playClick(); setSelectedJobId(j.id); }}
            >
              <span>{j.icon}</span>
              <span>{j.name.toUpperCase()}</span>
              <span className="jobs-count-tag">{count}</span>
            </button>
          );
        })}
      </E>

      {/* Hero Overview Panel for Selected Job */}
      <E c="job-overview-hero">
        <E c="job-hero-top">
          <E c="job-hero-title-box">
            <E c="job-hero-icon">{job.icon}</E>
            <E>
              <L c="heading" style={{ fontSize: 16 }}>{job.name.toUpperCase()}</L>
              <L c="output-sub">{job.description}</L>
            </E>
          </E>
          <E c="job-hero-badges">
            <span className="job-stat-tag pri">{`★ PRI: ${primaryStat}`}</span>
            <span className="job-stat-tag sec">{`▲ SEC: ${secondaryStat}`}</span>
            <L c="crew-status-badge healthy">{`${assigned.length} ACTIVE`}</L>
          </E>
        </E>
        <E c="job-formula-box">
          <L c="eyebrow" style={{ color: '#8da46e', marginBottom: 2 }}>LABOR & COMBAT SCALING FORMULA</L>
          <L c="body">{job.statScalingFormula}</L>
        </E>
      </E>

      {/* Workstation & Building Synergies */}
      <E c="job-workstation-card">
        <E c="job-workstation-header">
          <E c="row-center">
            <Icon name="icon_base" c="vital-icon-sprite" />
            <L c="card-title">{`BASE WORKSTATION: ${job.baseBuildingName.toUpperCase()}`}</L>
          </E>
          {buildings.length > 0 ? (
            <L c="crew-status-badge healthy">{`✓ ${buildings.length} OPERATIONAL`}</L>
          ) : (
            <L c="crew-status-badge injured">⚠ NOT CONSTRUCTED</L>
          )}
        </E>
        <L c="panel-note" style={{ marginBottom: 8 }}>{job.buildingBonuses}</L>

        {buildings.length === 0 ? (
          <Card title={`NO ${job.baseBuildingName.toUpperCase()} IN COLONY`} body={`Construct a ${job.baseBuildingName} via Construction [ B ] to provide work posts, specialized equipment, and trigger facility bonuses.`}>
            <B c="primary" onClick={() => hud.showBuild()}>Open Construction [ B ]</B>
          </Card>
        ) : (
          buildings.map(b => {
            const staff = survivors.filter(s => s.post === b.id);
            const candidate = staff.length < (job.postSlots || 2) ? candidates[0] : null;
            return (
              <E key={b.id} c="shift-row">
                <E c="row-center">
                  <L c="shift-time-badge">{`Facility #${b.id} · HP ${Math.ceil(b.hp)}`}</L>
                  <L c="eyebrow">{`Posts: ${staff.length}/${job.postSlots || 2}`}</L>
                </E>
                <E c="row-center" style={{ flexGrow: 1 }}>
                  {staff.length === 0 ? (
                    <L c="output-sub">No survivors stationed at this post.</L>
                  ) : staff.map(w => (
                    <E key={w.id} c="row-center">
                      <B c="crew-filter-btn" onClick={dossier(w.id)}>{`${w.name} (Lv.${w.level})`}</B>
                      <B c="btn-trash" onClick={run('post', w.id, null)} title="Unassign from post">×</B>
                    </E>
                  ))}
                </E>
                {candidate && (
                  <B c="primary" onClick={run('post', candidate.id, b.id)}>{`+ Post ${candidate.name}`}</B>
                )}
              </E>
            );
          })
        )}
      </E>

      {/* Career Level-Up & Rank Requirements */}
      <L c="section">CAREER LADDER & LEVEL-UP REQUIREMENTS</L>
      <L c="panel-note">Survivors advance through 4 career tiers by meeting survivor levels, key RPG stat thresholds, and accumulated duty milestones.</L>
      <table className="career-ladder-table">
        <thead>
          <tr>
            <th>CAREER RANK</th>
            <th>MIN LEVEL</th>
            <th>REQUIRED STATS</th>
            <th>DUTY HOURS</th>
            <th>SPECIALIST BONUS / PERK</th>
            <th>QUALIFIED CREW</th>
          </tr>
        </thead>
        <tbody>
          {(job.careerRanks || []).map(rank => {
            const reqStatsStr = Object.entries(rank.requiredStats || {})
              .map(([s, val]) => `${s.toUpperCase()} ≥ ${val}`)
              .join(', ') || 'None';
            const qualified = assigned.filter(s => {
              const meetsLvl = (s.level || 1) >= rank.level;
              const stats = s.stats || {};
              const meetsStats = Object.entries(rank.requiredStats || {}).every(
                ([k, v]) => (stats[k] || 5) >= v
              );
              return meetsLvl && meetsStats;
            });
            const badgeClass = `rank-badge-pill r${rank.level}`;
            return (
              <tr key={rank.level} className={cls(qualified.length > 0 && 'qualified-row')}>
                <td>
                  <span className={badgeClass}>{`RANK ${rank.level}`}</span>
                  <strong style={{ marginLeft: 6, color: '#f0f5e1' }}>{rank.title}</strong>
                </td>
                <td><strong style={{ color: '#d8e5c4' }}>{`Lv. ${rank.level}`}</strong></td>
                <td><span style={{ color: '#8da46e' }}>{reqStatsStr}</span></td>
                <td>{rank.dutyHours > 0 ? `${rank.dutyHours}h On Duty` : 'Immediate'}</td>
                <td style={{ color: '#d8e0ce' }}>{rank.bonus}</td>
                <td>
                  {qualified.length === 0 ? (
                    <span style={{ color: '#68785e', fontSize: 10 }}>— None —</span>
                  ) : (
                    qualified.map(q => (
                      <B key={q.id} c="crew-filter-btn" style={{ padding: '2px 6px', margin: '1px 2px' }} onClick={dossier(q.id)}>
                        {q.name}
                      </B>
                    ))
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Job Perks & Upgrades Tree */}
      <L c="section">{`${job.name.toUpperCase()} SPECIALIST PERKS & FACILITY UPGRADES`}</L>
      <L c="panel-note">{`Researching specialized perks at the ${job.baseBuildingName} permanently empowers all survivors assigned to this profession.`}</L>
      {upgrades.length === 0 ? (
        <L c="output-sub">No job upgrade tech tree defined for this discipline.</L>
      ) : (
        <E c="tree-node-grid">
          {upgrades.map(u => {
            const building = buildings[0];
            const isOwned = building ? building.upgrades?.includes(u.id) : false;
            const parentMet = !u.requires || (building && building.upgrades?.includes(u.requires));
            const costStr = Object.entries(u.cost || {}).map(([res, amt]) => `${amt} ${res}`).join(' · ');
            return (
              <E key={u.id} c={cls('tree-node-card', isOwned ? 'unlocked' : parentMet && building ? 'researchable' : 'locked')}>
                <E c="crew-card-row">
                  <E>
                    <L c="card-title">{u.name}</L>
                    <L c="eyebrow" style={{ color: '#8da46e' }}>{`TIER ${u.tier || 1}`}</L>
                  </E>
                  {isOwned ? (
                    <L c="crew-status-badge healthy">✓ RESEARCHED</L>
                  ) : u.requires ? (
                    <L c="eyebrow">{`REQ: ${u.requires}`}</L>
                  ) : (
                    <L c="eyebrow">{costStr}</L>
                  )}
                </E>
                <L c="output-sub" style={{ marginTop: 4, marginBottom: 6 }}>{u.description}</L>
                {!isOwned && building && (
                  <B c="primary" enabled={parentMet} onClick={run('upgradeBuilding', building.id, u.id)}>
                    {`Research (${costStr})`}
                  </B>
                )}
                {!isOwned && !building && (
                  <L c="output-sub" style={{ color: '#a08960' }}>Requires base workstation constructed first.</L>
                )}
              </E>
            );
          })}
        </E>
      )}

      {/* Currently Assigned Survivors to this Job */}
      <L c="section" style={{ marginTop: 14 }}>{`ACTIVE ${job.name.toUpperCase()} CREW (${assigned.length})`}</L>
      <E c="shift-schedule-box">
        {assigned.length === 0 ? (
          <L c="output-sub">No survivors currently assigned to this profession.</L>
        ) : (
          <E c="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {assigned.map(s => (
              <E key={s.id} c="row-center" style={{ backgroundColor: '#1d2719', padding: '4px 8px', borderRadius: 3, border: '1px solid #36482c' }}>
                <L c="staff-name" style={{ marginRight: 6 }}>{`${s.name} (Lv.${s.level})`}</L>
                <B c="crew-filter-btn" onClick={dossier(s.id)}>Dossier</B>
                <B c="btn-trash" onClick={run('post', s.id, null)} title="Reassign to Patrol">×</B>
              </E>
            ))}
          </E>
        )}
      </E>
    </>
  );
}

