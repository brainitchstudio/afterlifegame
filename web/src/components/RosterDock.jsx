import React from 'react';

export function RosterDock({
  survivors,
  freeBeds,
  totalBeds,
  onRecruit,
  canRecruit,
  recruitCost,
  patrolCounts,
  selectedId,
  onSelectSurvivor,
  onOpenCrewModal,
}) {
  return (
    <aside className="hud-card roster-dock" aria-label="Settlement Survivors">
      <div className="roster-header">
        <div className="roster-header-left">
          <span style={{ color: 'var(--accent)' }}>✚</span>
          <span>SURVIVORS</span>
          <span className="roster-count">{survivors.length} / {totalBeds}</span>
        </div>
        <button
          onClick={() => onOpenCrewModal('roster')}
          title="Open Military Crew Management [C]"
          style={{ fontSize: '9px', color: 'var(--accent)', textDecoration: 'underline' }}
        >
          MANAGE [C]
        </button>
      </div>

      <div className="roster-scroll">
        {survivors.map(s => {
          const isSelected = selectedId === s.id;
          const hpPct = Math.round((s.hp / (s.maxHp || 100)) * 100);
          const isDowned = s.condition === 'downed';
          const isInjured = s.condition === 'injured';

          return (
            <button
              key={s.id}
              className={`survivor-chip-row ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectSurvivor(s)}
            >
              <div className="survivor-portrait">
                {s.portraitUrl ? (
                  <img src={s.portraitUrl} alt={s.name} />
                ) : (
                  <span>👤</span>
                )}
              </div>
              <div className="survivor-info">
                <div className="survivor-name-row">
                  <span className="survivor-name">{s.name}</span>
                  <span className="survivor-duty-badge">{s.dutyLabel || s.role}</span>
                </div>
                <div className="survivor-sub">
                  Lv.{s.level || 1} · {s.gear || 'Unarmed'} {isDowned ? '· DOWNED' : isInjured ? '· INJURED' : ''}
                </div>
                <div className="survivor-hp-mini">
                  <div
                    className="survivor-hp-mini-fill"
                    style={{
                      width: `${hpPct}%`,
                      backgroundColor: isDowned ? 'var(--red)' : isInjured ? 'var(--amber)' : 'var(--accent)',
                    }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        className="quick-recruit-btn"
        onClick={onRecruit}
        disabled={!canRecruit}
        title={freeBeds > 0 ? `Recruit Survivor (${recruitCost.food} food, ${recruitCost.wood} wood)` : 'No free beds available'}
      >
        <span>+ Recruit Survivor</span>
        <span style={{ color: 'var(--ink-dim)' }}>
          {freeBeds > 0 ? `${freeBeds} free ${freeBeds === 1 ? 'bed' : 'beds'}` : 'Need Bunkhouse'}
        </span>
      </button>

      <div className="patrol-matrix-bar">
        <span>N: <b>{patrolCounts.north || 0}</b></span>
        <span>E: <b>{patrolCounts.east || 0}</b></span>
        <span>S: <b>{patrolCounts.south || 0}</b></span>
        <span>W: <b>{patrolCounts.west || 0}</b></span>
      </div>
    </aside>
  );
}
