import React, { useState } from 'react';

const DESTINATIONS = [
  {
    id: 'woodland',
    name: 'Overgrown Woodlands',
    danger: 'Low Risk',
    time: '2.5 Game Hours',
    foodCost: 15,
    loot: 'Wood, Wild Herbs, Small Scraps',
    icon: '🌲',
    desc: 'Dense forest canopy east of the refuge. Great source of timber and basic provisions.',
  },
  {
    id: 'outpost',
    name: 'Highway Service Outpost',
    danger: 'Moderate Risk',
    time: '4.0 Game Hours',
    foodCost: 25,
    loot: 'Metal Sheeting, Pipe Weapons, Ammo',
    icon: '⛽',
    desc: 'Abandoned transit hub along Route 9. High probability of spare mechanical parts.',
  },
  {
    id: 'supermarket',
    name: 'Suburban Supermarket',
    danger: 'Elevated Threat',
    time: '5.5 Game Hours',
    foodCost: 35,
    loot: 'Large Food Stocks, Medical Salves',
    icon: '🏪',
    desc: 'Commercial grocery complex. Scavengers often find canned rations and first-aid kits.',
  },
  {
    id: 'depot',
    name: 'Industrial Rail Depot',
    danger: 'High Lethality',
    time: '8.0 Game Hours',
    foodCost: 50,
    loot: 'Heavy Salvage, Firearms, Stranded Survivors',
    icon: '🚂',
    desc: 'Railyard freight depot. Dangerous runner packs roam here, but military crates remain intact.',
  },
];

export function ExpeditionsModal({
  isOpen,
  onClose,
  survivors,
  foodStock,
  onLaunchExpedition,
  activeExpeditions = [],
}) {
  const [selectedDest, setSelectedDest] = useState(DESTINATIONS[0]);
  const [selectedCrewIds, setSelectedCrewIds] = useState([]);

  if (!isOpen) return null;

  // Available survivors: healthy/standing by, not already away
  const availableCrew = survivors.filter(s => !s.expedition && s.condition === 'healthy');

  const toggleCrew = id => {
    setSelectedCrewIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const canLaunch =
    foodStock >= selectedDest.foodCost &&
    selectedCrewIds.length > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window expeditions-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h2>EXPEDITIONS & RECONNAISSANCE</h2>
            <p>Deploy Scavenger Parties to Secure Valuable Salvage & Supplies</p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <div className="modal-content">
          <div className="destinations-grid">
            {DESTINATIONS.map(dest => {
              const isSelected = selectedDest.id === dest.id;

              return (
                <div
                  key={dest.id}
                  className={`dest-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedDest(dest)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>
                      <span style={{ marginRight: '6px' }}>{dest.icon}</span>
                      {dest.name}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--amber)' }}>{dest.danger}</span>
                  </div>
                  <p style={{ fontSize: '9px', color: 'var(--ink-dim)', margin: '0 0 8px', lineHeight: 1.4 }}>
                    {dest.desc}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                    <span style={{ color: 'var(--ink-muted)' }}>Duration: {dest.time}</span>
                    <span style={{ color: foodStock >= dest.foodCost ? 'var(--accent)' : 'var(--red)' }}>
                      Rations: {dest.foodCost} Food
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '16px' }}>
            <h3 style={{ fontSize: '11px', letterSpacing: '1px', color: 'var(--ink-dim)', textTransform: 'uppercase', marginBottom: '10px' }}>
              SELECT EXPEDITION CREW ({selectedCrewIds.length} / 4)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {availableCrew.map(s => {
                const isPicked = selectedCrewIds.includes(s.id);

                return (
                  <button
                    key={s.id}
                    className={`filter-pill ${isPicked ? 'active' : ''}`}
                    onClick={() => toggleCrew(s.id)}
                    style={{ padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}
                  >
                    <strong>{s.name}</strong>
                    <small style={{ fontSize: '8px', color: 'var(--ink-dim)' }}>
                      {s.job.toUpperCase()} · {s.gear || 'Unarmed'}
                    </small>
                  </button>
                );
              })}
              {availableCrew.length === 0 && (
                <div style={{ gridColumn: '1 / -1', fontSize: '10px', color: 'var(--ink-dim)', padding: '12px', textAlign: 'center' }}>
                  No healthy survivors currently available for deployment.
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              className="filter-pill"
              onClick={onClose}
              style={{ padding: '10px 18px' }}
            >
              Cancel
            </button>
            <button
              className="filter-pill active"
              disabled={!canLaunch}
              onClick={() => {
                onLaunchExpedition(selectedDest.id, selectedCrewIds);
                onClose();
              }}
              style={{ padding: '10px 20px', fontWeight: 'bold' }}
            >
              🚀 Dispatch Expedition
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
