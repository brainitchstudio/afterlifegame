import React from 'react';

export function InspectorPanel({
  selected,
  onClose,
  onAssignJob,
  onAssignSide,
  onEquipGear,
  onRepairBuilding,
  onDismantleBuilding,
  onPurchaseUpgrade,
  onOpenDossier,
  onFocusEntity,
  resources,
}) {
  if (!selected) return null;

  const { kind, data } = selected;
  if (!data) return null;

  return (
    <aside className="hud-card inspector-card" style={{ right: '20px', top: '160px' }}>
      <div className="inspector-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>
            {kind === 'building' ? '🏛️' : kind === 'survivor' ? '👤' : '🧟'}
          </span>
          <div>
            <div className="inspector-title">{data.name || data.type || 'Entity'}</div>
            <div style={{ fontSize: '8px', color: 'var(--ink-dim)', textTransform: 'uppercase' }}>
              {kind.toUpperCase()} {data.level ? `· LEVEL ${data.level}` : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className="cam-btn"
            onClick={() => onFocusEntity && onFocusEntity(data)}
            title="Focus Camera [F]"
          >
            ⌖
          </button>
          <button className="close-btn" onClick={onClose} style={{ width: '22px', height: '22px', fontSize: '12px' }}>
            ✕
          </button>
        </div>
      </div>

      {/* HEALTH / INTEGRITY BAR */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '4px' }}>
          <span style={{ color: 'var(--ink-dim)' }}>
            {kind === 'building' ? 'STRUCTURE INTEGRITY' : 'VITALITY'}
          </span>
          <strong style={{ color: 'var(--accent)' }}>
            {Math.round(data.hp || 0)} / {Math.round(data.maxHp || 100)}
          </strong>
        </div>
        <div className="integrity-bar-track">
          <div
            className="integrity-bar-fill"
            style={{ width: `${Math.max(0, Math.min(100, (data.hp / (data.maxHp || 100)) * 100))}%` }}
          />
        </div>
      </div>

      {/* BUILDING INSPECTOR */}
      {kind === 'building' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data.staffSlots > 0 && (
            <div>
              <div style={{ fontSize: '9px', color: 'var(--ink-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
                STAFF SLOTS ({data.assignedStaff?.length || 0} / {data.staffSlots})
              </div>
              <div style={{ fontSize: '10px', color: 'var(--ink-muted)' }}>
                {data.assignedStaff && data.assignedStaff.length > 0 ? (
                  data.assignedStaff.map(s => <span key={s.id} className="filter-pill" style={{ marginRight: '4px' }}>{s.name}</span>)
                ) : (
                  <span style={{ color: 'var(--ink-dim)', fontSize: '9px' }}>No staff assigned</span>
                )}
              </div>
            </div>
          )}

          {data.upgrades && data.upgrades.length > 0 && (
            <div>
              <div style={{ fontSize: '9px', color: 'var(--ink-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>
                AVAILABLE UPGRADES
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {data.upgrades.map(u => (
                  <button
                    key={u.id}
                    className="filter-pill"
                    disabled={u.purchased || (resources.wood < u.cost.wood || resources.metal < u.cost.metal)}
                    onClick={() => onPurchaseUpgrade(data.id, u.id)}
                    style={{ justifyContent: 'space-between', padding: '6px 8px' }}
                  >
                    <span>{u.name}</span>
                    <span style={{ color: u.purchased ? 'var(--accent)' : 'var(--amber)' }}>
                      {u.purchased ? '✓ RESEARCHED' : `${u.cost.wood}W · ${u.cost.metal}M`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            {data.hp < data.maxHp && (
              <button
                className="filter-pill active"
                onClick={() => onRepairBuilding(data.id)}
                style={{ flex: 1, padding: '6px' }}
              >
                🔨 Repair
              </button>
            )}
            {data.type !== 'core' && (
              <button
                className="filter-pill"
                onClick={() => onDismantleBuilding(data.id)}
                style={{ color: 'var(--red)', padding: '6px' }}
              >
                Dismantle
              </button>
            )}
          </div>
        </div>
      )}

      {/* SURVIVOR INSPECTOR */}
      {kind === 'survivor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--ink-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
              CURRENT ROLE: <strong style={{ color: 'var(--accent)' }}>{data.job?.toUpperCase() || 'UNASSIGNED'}</strong>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {['guard', 'medic', 'engineer', 'farmer', 'scavenger'].map(j => (
                <button
                  key={j}
                  className={`filter-pill ${data.job === j ? 'active' : ''}`}
                  onClick={() => onAssignJob && onAssignJob(data.id, j)}
                  style={{ padding: '3px 6px', fontSize: '8px' }}
                >
                  {j.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '9px', color: 'var(--ink-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
              PATROL SECTOR
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['north', 'east', 'south', 'west', 'any'].map(s => (
                <button
                  key={s}
                  className={`filter-pill ${data.side === s ? 'active' : ''}`}
                  onClick={() => onAssignSide && onAssignSide(data.id, s)}
                  style={{ padding: '3px 6px', fontSize: '8px' }}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '9px', color: 'var(--ink-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
              WEAPON LOADOUT
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['pipe', 'pistol', 'rifle'].map(w => (
                <button
                  key={w}
                  className={`filter-pill ${data.gear === w ? 'active' : ''}`}
                  onClick={() => onEquipGear && onEquipGear(data.id, w)}
                  style={{ padding: '3px 6px', fontSize: '8px' }}
                >
                  {w.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <button
            className="filter-pill active"
            onClick={() => onOpenDossier && onOpenDossier(data.id)}
            style={{ width: '100%', marginTop: '6px', padding: '6px' }}
          >
            Open Full RPG Dossier [C] →
          </button>
        </div>
      )}

      {/* ZOMBIE INSPECTOR */}
      {kind === 'zombie' && (
        <div style={{ fontSize: '10px', color: 'var(--ink-muted)' }}>
          <p style={{ margin: '0 0 6px' }}>Threat Classification: <strong style={{ color: 'var(--red)' }}>{data.kind?.toUpperCase()}</strong></p>
          <p style={{ margin: 0, fontSize: '9px', color: 'var(--ink-dim)' }}>
            Aggressive infected advancing toward refuge perimeter. Guards and sentries prioritize threats automatically.
          </p>
        </div>
      )}
    </aside>
  );
}
