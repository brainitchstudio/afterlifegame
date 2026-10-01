// GameHud.ShowInspector and its live refresh: the floating panel for a selected building, survivor
// or zombie, framed as a small overseer tablet like the HUD cards. Details come from the simulation
// boundary (afDetails), exactly as in Unity; health and the repair button track the live frame.
import { Fragment } from 'react';
import { B, E, L, Icon, cls, bg, portrait, buildingSpriteUrl, spriteUrl, kitVars } from './ui.jsx';
import { Bar } from './TabletParts.jsx';
import { queueOrder } from './Tablet.jsx';

function Vitals({ icon, ent, details, label }) {
  const hp = ent ? ent.hp : details.hp, max = ent ? ent.maxHP : details.maxHP;
  const ratio = Math.min(1, Math.max(0, hp / Math.max(1, max)));
  return (
    <>
      <Icon name={icon} c="vital-icon-sprite" />
      <L c="vital-lbl">HP</L>
      <E c="vital-track"><E c={cls('vital-fill', ratio < 0.35 && 'low')} style={{ width: ratio * 100 + '%' }} /></E>
      <L c="vital-val">{(ent ? label : '') + Math.ceil(hp) + ' / ' + Math.ceil(max)}</L>
    </>
  );
}

// `maxHeight` keeps the panel clear of the dock; it grows only as tall as its contents.
export function Inspector({ game, id, top, maxHeight }) {
  const details = game.simulation.readDetails(id);
  if (!details?.kind) return null;
  const ent = game.frame.entities.find(e => e.id === id);
  const integrityLabel = details.kind === 'zombie' ? 'THREAT INTEGRITY  ' : 'INTEGRITY  ';
  return (
    <div className={cls('inspector inspector-tablet', 'inspector-' + details.kind)} style={{ ...kitVars(), top, maxHeight }}>
      <E c="tablet-screen">
        {details.kind === 'building' ? <BuildingInspector game={game} id={id} d={details} ent={ent} label={integrityLabel} />
          : details.kind === 'survivor' ? <SurvivorInspector game={game} id={id} d={details} ent={ent} />
            : <ZombieInspector game={game} id={id} d={details} ent={ent} />}
      </E>
    </div>
  );
}

// The tablet-style header the survivor and zombie views share: portrait, caption, name and chip,
// any extra buttons, then the kit close button.
function InspectorHead({ game, face, caption, name, chip, children }) {
  return (
    <E c="tablet-head inspector-head">
      <div className="ui-sprite tab-portrait" style={bg(face)} />
      <E c="tab-col grow">
        <L c="tab-caption">{caption}</L>
        <L c="inspector-name">{name}</L>
      </E>
      {chip && <L c="tablet-chip">{chip}</L>}
      {children}
      <B c="tablet-close" title="Close [ Esc ]" onClick={() => game.select(-1)} />
    </E>
  );
}

function Meter({ label, value, max, tone, title }) {
  return (
    <E c="inspector-meter" title={title}>
      <E c="tab-row"><L c="tab-caption">{label}</L><E c="spacer" /><L c="tab-count">{`${Math.ceil(value)} / ${Math.ceil(max)}`}</L></E>
      <Bar value={value} count={max} tone={tone} />
    </E>
  );
}

// A campaign structure: blueprint progress and builders, a garden's crop, a workstation's queue.
function CampaignStructure({ game, id, c }) {
  return (
    <E c="campaign-structure">
      {c.blueprint && (
        <>
          <L c="section">{`BLUEPRINT · ${Math.floor(c.blueprint.progress * 100)}% OF ${c.laborHours} LABOR-HOURS`}</L>
          <Bar value={c.blueprint.progress} count={1} tone="amber" />
          <L c="panel-note">{c.blueprint.builders.length ? 'Building: ' + c.blueprint.builders.join(', ') : 'Waiting for a builder. Free General Workers and idle Engineers build; up to two at a time.'}</L>
        </>
      )}
      {c.lanes && c.lanes.map((l, i) => (
        <Fragment key={i}>
          <L c="section">{`${c.lanes.length > 1 ? `LANE ${i + 1} · ` : ''}${l.first ? 'FIRST CROP' : 'NEXT BATCH'} · ${l.labor.toFixed(1)} / ${l.need} WORK-HOURS${l.farmer ? ' · ' + l.farmer.toUpperCase() : ''}`}</L>
          <Bar value={l.labor} count={l.need} tone="lime" />
        </Fragment>
      ))}
      {c.lanes && (
        <>
          <L c="panel-note">A Farmer working the plot through the shift grows it. Seeds are not used up by harvests.</L>
        </>
      )}
      {c.medical && (
        <>
          <L c="section">{`${c.medical.beds > 1 ? c.medical.beds + ' BEDS' : 'BED'} · ${c.medical.isolate ? 'ISOLATION' : 'GENERAL'}`}</L>
          {c.medical.patients.map(p => (
            <E key={p.id} c="staff-row">
              <E c="staff-info">
                <L c="staff-name">{p.name + (p.arriving ? ' · on the way' : '')}</L>
                <Bar value={p.hp} count={p.maxHp} tone="lime" />
                <L c="staff-desc">{[p.bleeding && 'Bleeding', p.infection > 0 && `Infection ${Math.round(p.infection)}`].filter(Boolean).join(' · ') || 'Recovering'}</L>
              </E>
            </E>
          ))}
          {c.medical.patients.length < c.medical.beds && <L c="panel-note">{c.medical.patients.length ? 'One bed free.' : c.medical.beds > 1 ? 'The beds are empty.' : 'The bed is empty.'}</L>}
          <L c="panel-note">{`+${c.medical.rate} HP and −2 infection per patient-hour · ${Math.floor(c.medical.supplies)} Medical Supplies · ${c.medical.bandages} Bandages`}</L>
          <B c={cls('crew-filter-btn', c.medical.isolate && 'active')} title="An isolated bed takes only infected patients, and holds anyone who turns" onClick={() => game.command('toggleIsolation', id)}>{c.medical.isolate ? 'Isolation: ON' : 'Isolation: OFF'}</B>
        </>
      )}
      {c.guards && c.guards.map(g => (
        <E key={g.id} c="staff-row">
          <E c="staff-info"><L c="staff-name">{g.name}</L><L c="staff-desc">{`${g.gear} · ${c.routes[g.route]}`}</L></E>
          <B c={cls('crew-filter-btn', g.stance === 'hold' && 'active')} title="Intercept chases infected within reach of the post; Hold stays on the route" onClick={() => game.command('setGuardStance', g.id, g.stance === 'hold' ? 'intercept' : 'hold')}>{g.stance.toUpperCase()}</B>
          <B c="crew-filter-btn" title="Switch route" onClick={() => game.command('setGuardRoute', g.id, 1 - g.route)}>ROUTE</B>
        </E>
      ))}
      {c.watch && <L c="panel-note">{c.watch.watcher ? `${c.watch.watcher} ${c.watch.onWatch ? 'is on watch' : 'is posted here'} · sees ${c.watch.radius} tiles all round` : `Post a Guard here to watch ${c.watch.radius} tiles all round. A watch Guard cannot patrol.`}</L>}
      {c.radio && (
        <>
          <L c="section">RADIO</L>
          {c.radio.broadcasting != null && <Bar value={c.radio.broadcasting} count={1} tone="lime" />}
          <B c="crew-filter-btn" enabled={c.radio.canBroadcast} title={c.radio.block || 'Half an hour of an operator’s time'} onClick={() => game.command('broadcast')}>{c.radio.block || `Broadcast · ${c.radio.cost} Food`}</B>
        </>
      )}
      {c.queue && (
        <>
          <L c="section">{`QUEUE · ${c.queue.length} / ${c.queueCapacity}`}</L>
          {c.queue.map(q => (
            <E key={q.index} c="staff-row">
              <E c="staff-info"><L c="staff-name">{q.name}</L><Bar value={q.progress} count={1} tone="lime" /></E>
              <B c="btn-release" onClick={() => game.command('cancelCraft', id, q.index)}>Cancel</B>
            </E>
          ))}
          <E c="row" style={{ flexWrap: 'wrap', gap: 4 }}>
            {c.recipes.filter(r => r.unlocked).map(r => <B key={r.id} c="crew-filter-btn" enabled={r.enabled} title={r.ready ? `${r.inputs} · ${r.laborHours} labor-hours` : 'Not yet in production'} onClick={() => queueOrder(game, id, r)}>{'+ ' + r.name}</B>)}
          </E>
        </>
      )}
    </E>
  );
}

function BuildingInspector({ game, id, d, ent, label }) {
  const hud = game.hud;
  const sprite = buildingSpriteUrl(d.type);
  const upgrades = d.upgrades || [];
  const owned = upgrades.filter(u => u.owned).length;
  const staff = d.staff || [];
  const hasStaffSlots = d.slots > 0;
  const tab = hasStaffSlots ? (hud.inspectorBuildingTab === 'upgrades' && upgrades.length ? 'upgrades' : 'staff') : 'upgrades';
  const setTab = t => hud.setInspectorBuildingTab(t);
  const openSlots = d.slots - staff.length;
  const hp = ent ? ent.hp : d.hp, maxHP = ent ? ent.maxHP : d.maxHP;
  return (
    <>
      <E c="floating-header">
        <E c="building-emblem" style={sprite ? undefined : { borderColor: d.color }}>
          {sprite ? <div className="ui-sprite building-sprite-preview" style={bg(sprite)} /> : <L c="emblem-icon" style={{ color: d.color }}>{d.icon || '⌂'}</L>}
        </E>
        <E c="title-block">
          <L c="eyebrow">{d.tier || 'STRUCTURE'}</L>
          <L c="heading">{d.name}</L>
        </E>
        {d.demolish && (
          <B c="btn-trash" title={d.demolishLabel || 'Dismantle'} onClick={() => hud.confirm(d.demolishLabel ? d.demolishLabel + ': ' + d.name : 'Dismantle ' + d.name, d.demolishLabel ? `Cancel the work and get back ${d.demolishRefund}.` : `Recover ${d.demolishRefund}. Residents and staff will need new assignments.`, () => { game.command('demolish', id); game.select(-1); })}>
            <Icon name="icon_demolish" c="trash-icon-sprite" />
          </B>
        )}
        <B c="close" onClick={() => game.select(-1)}>×</B>
      </E>
      <E c="vitals-box">
        <E c="vital-row">
          <Vitals icon="icon_integrity" ent={ent} details={d} label={label} />
          {d.repairCost && hp < maxHP && <B c="btn-repair-inline" enabled={d.repairEnabled} onClick={() => game.command('repair', id)}>{'Repair · ' + d.repairCost}</B>}
        </E>
        <E c="output-line">
          <L c="output-sub">{d.description}</L>
          {d.output && <L c="output-metric">{d.output}</L>}
        </E>
      </E>
      <div className="ui-scroll inspector-scroll">
        {d.campaign && <CampaignStructure game={game} id={id} c={d.campaign} />}
        {hasStaffSlots ? (
          <E c="panel-tabs">
            <B c={cls('tab-btn', tab === 'staff' && 'active')} onClick={() => setTab('staff')}>{`${d.roleName ? d.roleName.toUpperCase() : 'STAFF'} (${staff.length}/${d.slots})`}</B>
            {upgrades.length > 0 && <B c={cls('tab-btn', tab === 'upgrades' && 'active')} onClick={() => setTab('upgrades')}>{`Upgrades (${owned}/${upgrades.length})`}</B>}
          </E>
        ) : upgrades.length > 0 && <L c="section">{`Upgrades (${owned} / ${upgrades.length} Built)`}</L>}

        {tab === 'staff' && hasStaffSlots ? (
          <>
            {d.roleDescription && <L c="panel-note">{d.roleDescription}</L>}
            <E c="staff-list">
              {staff.map(s => (
                <E key={s.id} c="staff-row">
                  <L c="staff-avatar">{s.name ? s.name[0].toUpperCase() : '웃'}</L>
                  <E c="staff-info">
                    <L c="staff-name">{s.name}</L>
                    <L c="staff-desc">{s.description}</L>
                  </E>
                  <B c="btn-release" onClick={() => game.command('post', s.id, null)}>Release</B>
                </E>
              ))}
            </E>
            {openSlots > 0 && (
              <>
                <B c={cls('btn-slot-open', hud.candidatePickerOpen && 'active')} onClick={() => hud.toggleCandidatePicker()}>
                  {`+ Assign ${d.roleName || 'worker'} (${openSlots} open)`}
                </B>
                {hud.candidatePickerOpen && (
                  <E c="candidate-drawer">
                    {d.assignable?.length ? d.assignable.map(c => (
                      <E key={c.id} c="staff-row">
                        <L c="staff-avatar">{c.name ? c.name[0].toUpperCase() : '웃'}</L>
                        <E c="staff-info">
                          <L c="staff-name">{c.name}</L>
                          <L c="staff-desc">{`${c.description} · LVL ${c.level}`}</L>
                        </E>
                        <B c="primary" enabled={c.enabled} onClick={() => { game.command('post', c.id, id); if (openSlots <= 1) hud.toggleCandidatePicker(false); }}>Assign</B>
                      </E>
                    )) : <L c="small">No unassigned survivors available.</L>}
                  </E>
                )}
              </>
            )}
          </>
        ) : upgrades.length > 0 ? upgrades.map(u => {
          const locked = !u.owned && ((u.requires && !upgrades.some(p => p.id === u.requires && p.owned)) || !!u.locked);
          return (
            <E key={u.id} c={cls('upgrade-node-card', u.owned && 'owned', locked && 'locked')}>
              <E c="node-title-row">
                <E c="row-center">
                  <Icon name={u.owned ? 'badge_check' : locked ? 'badge_lock' : 'badge_up'} c="badge-icon" />
                  <L c="node-title">{u.name}</L>
                </E>
                {u.owned && <L c="node-owned-tag">INSTALLED</L>}
              </E>
              <L c="node-desc">{u.description}</L>
              {!u.owned && u.parentName && (
                <E c="row-center">
                  <Icon name="badge_lock" c="badge-icon-sm" />
                  <L c="node-req">{'Requires: ' + u.parentName}</L>
                </E>
              )}
              {!u.owned && u.locked && (
                <E c="row-center">
                  <Icon name="icon_milestone" c="badge-icon-sm" />
                  <L c="node-req">{u.locked + ' · see Milestones on your tablet'}</L>
                </E>
              )}
              {!u.owned && <B c={u.enabled ? 'primary' : ''} enabled={u.enabled} onClick={() => game.command('upgradeBuilding', id, u.id)}>{'Upgrade · ' + u.cost}</B>}
            </E>
          );
        }) : <L c="small">No upgrades available for this structure.</L>}

        {d.beds > 0 && (
          <>
            <E c="section-header-row">
              <Icon name="icon_bed" c="section-header-icon" />
              <L c="section-header-text">{`RESIDENTS (${d.residents?.length ?? 0} / ${d.beds} BEDS)`}</L>
            </E>
            {d.residents?.length ? <L c="panel-note">{d.residents.join(', ')}</L> : <L c="small">No residents assigned yet.</L>}
          </>
        )}

        {d.shelter > 0 && (
          <>
            <E c="section-header-row">
              <Icon name="icon_warning" c="section-header-icon" />
              <L c="section-header-text">{`EMERGENCY SHELTER (ROOM FOR ${d.shelter})`}</L>
            </E>
            {d.isShelteringHere || (game.data.sheltered && d.shelteredCount > 0) ? (
              <>
                <E c="shelter-banner"><L c="small">{`⚠ ${d.shelteredCount} survivors sheltering inside. Guards remain on duty.`}</L></E>
                <B c="primary" onClick={() => game.command('clearShelter')}>Sound All Clear · Release workers</B>
              </>
            ) : <B onClick={() => game.command('orderShelter', id)}>{`Shelter workers here · ${d.shelter} spaces`}</B>}
          </>
        )}

        {d.armory?.length > 0 && (
          <>
            <E c="section-header-row">
              <Icon name="icon_damage" c="section-header-icon" />
              <L c="section-header-text">ARMORY FABRICATION</L>
            </E>
            {d.armory.map(w => (
              <E key={w.id} c="armory-row">
                <E c="armory-info">
                  <L c="armory-name">{w.name}</L>
                  <L c="armory-count">{`Stock: ${w.count} · Cost: ${w.cost}`}</L>
                </E>
                <B c={w.enabled ? 'primary' : ''} enabled={w.enabled} onClick={() => game.command('fabricate', w.id)}>Fabricate</B>
              </E>
            ))}
          </>
        )}
      </div>
    </>
  );
}

const STATS = [
  ['str', 'STR', 'Strength'], ['agi', 'AGI', 'Agility'], ['end', 'END', 'Endurance'], ['intel', 'INT', 'Intellect'], ['cha', 'CHA', 'Charisma'],
];
const STAT_KEY = { intel: 'int' };
const SIDES = ['any', 'north', 'east', 'south', 'west'];

// A campaign survivor's job: proficiency toward 20, the labor factor their work runs at, morale and traits.
function CrewJob({ crew }) {
  const factor = crew.laborFactor;
  return (
    <>
      <E c="tab-heading"><L c="tab-heading-text">JOB</L></E>
      <E c="tab-card inspector-crew-job">
        <E c="tab-row">
          <E c="tab-col grow">
            <L c="tab-name">{crew.jobName}</L>
            <L c="tab-sub" title={`Proficiency: +1 for every ${crew.hoursPerPoint} hours of effective work in this job, up to ${crew.proficiencyMax}; each point adds 1% output.`}>{`PROFICIENCY ${crew.proficiency} / ${crew.proficiencyMax}`}</L>
          </E>
          {factor != null && <E c="inspector-weapon-stat" title={`Labor factor — how much work they get done per hour compared with an average worker, from ${crew.attribute.toUpperCase()}, job, proficiency, traits, health and fatigue.`}><L c="tab-caption">RATE</L><L c="tab-count">{'×' + factor.toFixed(2)}</L></E>}
          <E c="inspector-weapon-stat" title="Morale, 0-100. Hunger lowers it."><L c="tab-caption">MORALE</L><L c="tab-count">{String(Math.round(crew.morale))}</L></E>
        </E>
        <Bar value={crew.proficiencyHours} count={crew.hoursPerPoint} tone="lime" />
      </E>
      {(crew.health.bleeding || crew.health.infection > 0 || crew.health.care || crew.health.downedIn != null) && (
        <E c="tab-card warn">
          <L c="tab-caption">MEDICAL</L>
          {crew.health.downedIn != null && <L c="tab-body">{`Downed · ${crew.health.carried ? 'being carried to a bed' : 'needs rescue'} · ${crew.health.downedIn.toFixed(1)}h left`}</L>}
          {crew.health.bleeding && <L c="tab-body">Bleeding · −1 HP an hour until bandaged</L>}
          {crew.health.infection > 0 && <L c="tab-body">{`Infection ${crew.health.infection} / 100${crew.health.turnIn != null ? ` · turns in ${crew.health.turnIn.toFixed(1)}h` : ''}`}</L>}
          {crew.health.care && <L c="tab-body">{crew.health.care === 'seek' ? 'Walking to the Aid Station' : 'In an Aid Station bed'}</L>}
        </E>
      )}
      {crew.traits.length > 0 && (
        <E c="tab-row inspector-traits">
          {crew.traits.map(t => <L key={t.id} c={cls('tab-pill', t.type === 'drawback' ? 'amber' : 'lime')} title={t.effect}>{t.name.toUpperCase()}</L>)}
        </E>
      )}
    </>
  );
}

function SurvivorInspector({ game, id, d, ent }) {
  const world = game.world, hud = game.hud;
  const followed = world.followTargetId === d.id;
  const hp = ent ? ent.hp : d.hp, maxHP = ent ? ent.maxHP : d.maxHP, ratio = hp / Math.max(1, maxHP);
  const condition = d.resting ? 'sleeping' : d.condition;
  const state = d.away ? 'ON EXPEDITION' : d.crew?.mission ? 'ON OPERATION' : d.crew?.exhausted ? 'EXHAUSTED' : d.sheltered ? 'SHELTERING' : condition === 'downed' ? 'DOWNED' : 'ACTIVE';
  const crew = d.crew;
  // Role, what they are doing, where they are posted; the task often just repeats the role's name.
  const doing = [d.roleName, d.away ? d.expedition : d.task || condition, d.postName, d.shiftName && 'Shift ' + d.shiftName]
    .filter((part, i, all) => part && all.findIndex(p => p && p.toLowerCase() === part.toLowerCase()) === i).join(' · ');
  return (
    <>
      <InspectorHead game={game} face={portrait(d.id) || spriteUrl('icon_survivor')} caption={'SURVIVOR · ' + state} name={d.name} chip={crew ? crew.jobName.toUpperCase() : 'LVL ' + d.level}>
        <B c={cls('tablet-btn inspector-follow', followed && 'primary')} title={followed ? 'Stop following' : 'Focus the camera and follow [ F ]'}
          onClick={() => { if (followed) world.clearFollow(); else world.follow(d.id); hud.bump(); }}>⌖</B>
      </InspectorHead>
      <div className="ui-scroll inspector-body">
        <L c="inspector-doing" title={d.roleDescription || undefined}>{doing}</L>
        {condition === 'downed' && <E c="tab-message warn"><L c="tab-body">{`Bleeding out in ${(d.bleed / 42).toFixed(1)}h. Get a medic or carry them to a clinic.`}</L></E>}
        <E c="tab-grid2 inspector-meters">
          <Meter label="HEALTH" value={Math.max(0, hp)} max={maxHP} tone={ratio < 0.35 ? 'red' : ratio < 0.7 ? 'amber' : 'lime'} title={`Health — ${Math.ceil(hp)} of ${Math.ceil(maxHP)}. Condition: ${condition}.`} />
          {crew
            ? <Meter label="FATIGUE" value={crew.fatigue} max={100} tone={crew.fatigue > 85 ? 'red' : crew.fatigue > 60 ? 'amber' : 'lime'} title={`Fatigue — ${Math.round(crew.fatigue)} of 100. Work rate ×${crew.fatigueFactor}. Work adds 4 an hour; a bed takes off 8 an hour, sleeping rough 4. At 100 they stop and rest.`} />
            : <Meter label="EXPERIENCE" value={d.xp} max={d.xpNeeded} tone="lime" title={`Experience — ${d.xp} of ${d.xpNeeded} to reach level ${d.level + 1}.`} />}
        </E>
        {crew && <CrewJob crew={crew} />}

        <E c="tab-heading"><L c="tab-heading-text">ATTRIBUTES</L></E>
        <E c="inspector-stats">
          {STATS.map(([k, short, long]) => {
            const key = STAT_KEY[k] || k, primary = !crew && d.primaryStat === key, secondary = !crew && d.secondaryStat === key, weak = !crew && d.weakStat === key;
            return (
              <E key={k} c={cls('inspector-stat', primary && 'primary', secondary && 'secondary', weak && 'weak')}
                title={`${long} (${short}): ${d[k]}${primary ? ' · primary aptitude' : secondary ? ' · secondary aptitude' : weak ? ' · weak aptitude' : ''}`}>
                <L c="inspector-stat-label">{short}</L>
                <L c="inspector-stat-value">{String(d[k])}</L>
              </E>
            );
          })}
        </E>

        <E c="tab-heading"><L c="tab-heading-text">EQUIPMENT</L></E>
        <E c="tab-card inspector-weapon" title={`${d.weaponName} — ${d.weaponIsMelee ? 'melee' : 'ranged'} weapon. Hand out weapons from the crew screen or the stockpile.`}>
          <E c="tab-row">
            <Icon name="icon_damage" c="tab-icon" />
            <E c="tab-col grow">
              <L c="tab-name">{d.weaponName}</L>
              <L c="tab-sub">{d.weaponIsMelee ? 'MELEE' : 'RANGED'}</L>
            </E>
            <E c="inspector-weapon-stat" title="Damage per hit"><L c="tab-caption">DMG</L><L c="tab-count">{d.weaponDamage.toFixed(1)}</L></E>
            <E c="inspector-weapon-stat" title="Reach in world pixels"><L c="tab-caption">RANGE</L><L c="tab-count">{String(Math.round(d.weaponRange))}</L></E>
            <E c="inspector-weapon-stat" title="Seconds between attacks"><L c="tab-caption">RATE</L><L c="tab-count">{d.weaponCooldown.toFixed(1) + 's'}</L></E>
          </E>
        </E>

        <E c="tab-heading"><L c="tab-heading-text">PATROL SIDE</L></E>
        <E c="inspector-sides">
          {SIDES.map(side => (
            <B key={side} c={cls('tablet-btn', d.side === side && 'primary')} enabled={!d.away} title={side === 'any' ? 'Patrol wherever they are needed' : `Patrol the ${side} side`}
              onClick={() => game.command('assign', id, side)}>{side.toUpperCase()}</B>
          ))}
        </E>

        <E c="tab-heading"><L c="tab-heading-text">JOBS & POSTS</L></E>
        <B c="tab-list-row inspector-job" enabled={!d.away} title="Head to the HQ and gear up to scavenge" onClick={() => game.command('post', id, 'scavenger')}>
          <E c="tab-col grow"><L c="tab-name">Scavenger</L><L c="tab-sub">Prepare at HQ</L></E>
        </B>
        {(d.posts || []).map(post => (
          <B key={post.id} c={cls('tab-list-row inspector-job', d.post === post.id && 'active')} enabled={post.enabled && !d.away} title={d.post === post.id ? 'Their current post' : 'Post them here'} onClick={() => game.command('post', id, post.id)}>
            <E c="tab-col grow"><L c="tab-name">{post.name}</L><L c="tab-sub">{post.description}</L></E>
            {d.post === post.id && <L c="tab-pill lime">POSTED</L>}
          </B>
        ))}
        <B c="tab-list-row inspector-job" enabled={!d.away} title="Send them out with a party [ E ]" onClick={() => hud.showExpeditions()}>
          <E c="tab-col grow"><L c="tab-name">Expedition</L><L c="tab-sub">Choose a destination and a party</L></E>
        </B>
      </div>
      <E c="inspector-foot">
        <B c="tablet-btn primary inspector-dossier" onClick={() => hud.showCrew(d.id, 'roster')}>OPEN CREW DOSSIER  [ C ]</B>
      </E>
    </>
  );
}

function ZombieInspector({ game, id, d, ent }) {
  const [status, ...lines] = (d.description || '').split('\n');
  const hp = ent?.hp ?? 0, max = ent?.maxHP ?? 0;
  return (
    <>
      <InspectorHead game={game} face={spriteUrl('icon_zombie')} caption={status || 'THE DEAD'} name={d.name} chip="HOSTILE" />
      <div className="ui-scroll inspector-body">
        {max > 0 && <Meter label="THREAT" value={Math.max(0, hp)} max={max} tone="red" title={`Remaining health — ${Math.ceil(hp)} of ${Math.ceil(max)}`} />}
        {lines.map(line => <L key={line} c="tab-body">{line}</L>)}
        {d.staff?.length > 0 ? (
          <>
            <E c="tab-heading"><L c="tab-heading-text">{`ENGAGED SURVIVORS (${d.staff.length})`}</L></E>
            {d.staff.map(p => <E key={p.id} c="tab-list-row"><L c="tab-name">{p.name}</L><E c="spacer" /><L c="tab-sub">{p.description}</L></E>)}
          </>
        ) : null}
      </div>
      <E c="inspector-foot">
        {d.staff?.length > 0
          ? <B c="tablet-btn inspector-dossier" onClick={() => game.command('cancelAttack', id)}>CANCEL ATTACK ORDER</B>
          : <B c="tablet-btn primary inspector-dossier" enabled={d.attackEnabled} title="Order up to three nearby survivors to attack" onClick={() => game.command('orderAttack', id)}>ATTACK WITH NEARBY SURVIVORS</B>}
      </E>
    </>
  );
}
