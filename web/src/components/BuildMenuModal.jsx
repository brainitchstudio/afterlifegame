import React from 'react';

const CATALOG = [
  {
    type: 'dorm',
    name: 'Bunkhouse',
    cost: { wood: 45, metal: 20 },
    icon: '🏠',
    desc: 'Adds housing for 4 survivors. Crucial for expanding settlement population.',
  },
  {
    type: 'farm',
    name: 'Farm Plot',
    cost: { wood: 35, metal: 10 },
    icon: '🌱',
    desc: 'Produces continuous food for the colony. Staff with growers to boost yield.',
  },
  {
    type: 'workshop',
    name: 'Workshop',
    cost: { wood: 50, metal: 35 },
    icon: '⚙️',
    desc: 'Automates wood/metal harvesting and equips engineers to repair breaches.',
  },
  {
    type: 'clinic',
    name: 'Medical Clinic',
    cost: { wood: 40, metal: 30 },
    icon: '🏥',
    desc: 'Staffed by medics. Rapidly restores injured survivors and stops bleed-out.',
  },
  {
    type: 'barracks',
    name: 'Barracks',
    cost: { wood: 60, metal: 45 },
    icon: '🛡️',
    desc: 'Houses elite guards. Grants combat training (+30 HP, +25% DMG) and 2 beds.',
  },
  {
    type: 'tower',
    name: 'Watchtower',
    cost: { wood: 40, metal: 25 },
    icon: '🗼',
    desc: 'Elevated sniper perch. Sentries spot incursions early and shoot 360° over walls.',
  },
  {
    type: 'barricade',
    name: 'Palisade Wall',
    cost: { wood: 12, metal: 2 },
    icon: '🧱',
    desc: 'Blocks line-of-sight and zombie pathing. Press [R] during placement to rotate.',
  },
  {
    type: 'gate',
    name: 'Defensive Gate',
    cost: { wood: 24, metal: 10 },
    icon: '🚪',
    desc: 'Permits survivor transit along service roads while keeping zombies out.',
  },
];

export function BuildMenuModal({ isOpen, onClose, resources, onSelectBuilding }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window build-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h2>CONSTRUCTION CATALOG</h2>
            <p>Select a structure to enter placement mode [R to Rotate]</p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <div className="modal-content">
          <div className="building-catalog-grid">
            {CATALOG.map(bld => {
              const canAfford =
                (resources.wood || 0) >= (bld.cost.wood || 0) &&
                (resources.metal || 0) >= (bld.cost.metal || 0);

              return (
                <button
                  key={bld.type}
                  className="building-card"
                  disabled={!canAfford}
                  onClick={() => {
                    onSelectBuilding(bld.type);
                    onClose();
                  }}
                >
                  <div className="bld-header">
                    <div>
                      <span style={{ marginRight: '6px' }}>{bld.icon}</span>
                      <strong className="bld-name">{bld.name}</strong>
                    </div>
                    <span className="bld-cost">
                      {bld.cost.wood}W · {bld.cost.metal}M
                    </span>
                  </div>
                  <p className="bld-desc">{bld.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
