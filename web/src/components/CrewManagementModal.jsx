import React, { useState } from 'react';
import { JOBS_CONFIG, JOB_BY_ID, JOB_UPGRADES_BY_ROLE } from '../engine/data.mjs';

const SHIFTS = [
  { id: 'day', label: 'Day Shift', hours: '06:00 – 14:00', icon: '☀️' },
  { id: 'evening', label: 'Evening Shift', hours: '14:00 – 22:00', icon: '🌅' },
  { id: 'night', label: 'Night Shift', hours: '22:00 – 06:00', icon: '🌙' },
];

const STAT_INFO = {
  str: { label: 'STR', name: 'Strength', desc: 'Melee damage & carry capacity' },
  agi: { label: 'AGI', name: 'Agility', desc: 'Speed, ranged damage & fire rate' },
  end: { label: 'END', name: 'Endurance', desc: 'Max health & bleed-out timer' },
  int: { label: 'INT', name: 'Intelligence', desc: 'Treatment, repair & farm speed' },
  cha: { label: 'CHA', name: 'Charisma', desc: 'Trading deals & radio reception' },
};

export function CrewManagementModal({
  isOpen,
  onClose,
  initialTab = 'roster',
  survivors,
  buildings,
  resources,
  hour,
  onAssignJob,
  onAssignSide,
  onAssignShift,
  onEquipWeapon,
  availableWeapons,
  onResearchUpgrade,
  purchasedUpgrades,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [rosterFilter, setRosterFilter] = useState('all');
  const [selectedSurvivorIndex, setSelectedSurvivorIndex] = useState(0);
  const [selectedJobId, setSelectedJobId] = useState('guard');

  if (!isOpen) return null;

  const currentShift = hour >= 6 && hour < 14 ? 'day' : hour >= 14 && hour < 22 ? 'evening' : 'night';

  // Filter survivors
  const filteredSurvivors = survivors.filter(s => {
    if (rosterFilter === 'guards') return s.role === 'guard' || s.role === 'patrol' || s.role === 'sentry';
    if (rosterFilter === 'specialists') return s.job === 'medic' || s.job === 'engineer' || s.job === 'farmer' || s.job === 'researcher' || s.job === 'logger' || s.role === 'medic' || s.role === 'engineer' || s.role === 'farmer' || s.role === 'researcher' || s.role === 'logger';
    if (rosterFilter === 'scavengers') return s.job === 'scavenger' || s.role === 'scavenger';
    if (rosterFilter === 'casualties') return s.condition === 'injured' || s.condition === 'downed';
    return true;
  });

  const selectedSurvivor = survivors[selectedSurvivorIndex] || survivors[0];

  const handlePrevSurvivor = () => {
    setSelectedSurvivorIndex(idx => (idx > 0 ? idx - 1 : survivors.length - 1));
  };

  const handleNextSurvivor = () => {
    setSelectedSurvivorIndex(idx => (idx < survivors.length - 1 ? idx + 1 : 0));
  };

  // Facility staffing counts
  const clinicStaff = survivors.filter(s => s.job === 'medic' || s.role === 'medic');
  const workshopStaff = survivors.filter(s => s.job === 'engineer' || s.role === 'engineer');
  const farmStaff = survivors.filter(s => s.job === 'farmer' || s.role === 'farmer');
  const barracksStaff = survivors.filter(s => s.job === 'guard' || s.role === 'guard');
  const labStaff = survivors.filter(s => s.job === 'researcher' || s.role === 'researcher');
  const sawmillStaff = survivors.filter(s => s.job === 'logger' || s.role === 'logger');
  const scavengers = survivors.filter(s => s.job === 'scavenger' || s.role === 'scavenger');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window crew-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h2>SURVIVOR & CREW MANAGEMENT CENTER</h2>
            <p>Tactical Command, Shifts Synchronization & RPG Dossier</p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <nav className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'roster' ? 'active' : ''}`}
            onClick={() => setActiveTab('roster')}
          >
            📋 Colony Roster ({survivors.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            💼 Jobs & Careers (7)
          </button>
          <button
            className={`tab-btn ${activeTab === 'shifts' ? 'active' : ''}`}
            onClick={() => setActiveTab('shifts')}
          >
            🕒 Shifts & Duties Scheduler
          </button>
          <button
            className={`tab-btn ${activeTab === 'dossier' ? 'active' : ''}`}
            onClick={() => setActiveTab('dossier')}
          >
            🎖️ Survivor RPG Dossier
          </button>
        </nav>

        <div className="modal-content">
          {/* TAB 1: COLONY ROSTER */}
          {activeTab === 'roster' && (
            <div>
              <div className="filter-bar">
                {['all', 'guards', 'specialists', 'scavengers', 'casualties'].map(f => (
                  <button
                    key={f}
                    className={`filter-pill ${rosterFilter === f ? 'active' : ''}`}
                    onClick={() => setRosterFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="crew-table-container">
                <table className="crew-table">
                  <thead>
                    <tr>
                      <th>Survivor</th>
                      <th>Level</th>
                      <th>Condition</th>
                      <th>Role & Duty</th>
                      <th>Weapon</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSurvivors.map(s => {
                      const isDowned = s.condition === 'downed';
                      const isInjured = s.condition === 'injured';
                      const hpPct = Math.round((s.hp / (s.maxHp || 100)) * 100);

                      return (
                        <tr key={s.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="survivor-portrait" style={{ width: '28px', height: '28px' }}>
                                {s.portraitUrl ? <img src={s.portraitUrl} alt={s.name} /> : '👤'}
                              </div>
                              <strong>{s.name}</strong>
                            </div>
                          </td>
                          <td>Lv.{s.level || 1}</td>
                          <td>
                            <div style={{ minWidth: '90px' }}>
                              <span style={{
                                fontSize: '9px',
                                color: isDowned ? 'var(--red)' : isInjured ? 'var(--amber)' : 'var(--accent)',
                                fontWeight: 'bold'
                              }}>
                                {isDowned ? 'DOWNED' : isInjured ? 'INJURED' : 'HEALTHY'} ({s.hp}/{s.maxHp || 100})
                              </span>
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
                          </td>
                          <td>
                            <span className="survivor-duty-badge">{s.dutyLabel || s.role}</span>
                          </td>
                          <td>{s.gear || 'Unarmed'}</td>
                          <td>
                            <button
                              className="filter-pill"
                              style={{ padding: '3px 8px', fontSize: '9px' }}
                              onClick={() => {
                                const idx = survivors.findIndex(item => item.id === s.id);
                                if (idx !== -1) setSelectedSurvivorIndex(idx);
                                setActiveTab('dossier');
                              }}
                            >
                              Dossier →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: SHIFTS & DUTIES SCHEDULER */}
          {activeTab === 'shifts' && (
            <div className="shifts-layout">
              <div className="shift-cards-row">
                {SHIFTS.map(shift => {
                  const isActive = currentShift === shift.id;
                  const shiftSentries = survivors.filter(s => s.shift === shift.id);

                  return (
                    <div key={shift.id} className={`shift-card ${isActive ? 'active-shift' : ''}`}>
                      <div className="shift-title-row">
                        <div>
                          <span style={{ marginRight: '6px' }}>{shift.icon}</span>
                          <span className="shift-name">{shift.label}</span>
                        </div>
                        <span className="shift-hours">{shift.hours}</span>
                      </div>
                      <p style={{ fontSize: '9px', color: 'var(--ink-dim)', margin: '0 0 10px' }}>
                        {isActive ? '● CURRENTLY ACTIVE' : 'Scheduled shift'}
                      </p>
                      <div style={{ fontSize: '10px', color: 'var(--ink-muted)' }}>
                        Assigned Sentries: <strong style={{ color: 'var(--accent)' }}>{shiftSentries.length}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '10px' }}>
                <h3 style={{ fontSize: '11px', letterSpacing: '1px', color: 'var(--ink-dim)', textTransform: 'uppercase', marginBottom: '10px' }}>
                  FACILITY STAFFING ALLOCATIONS
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  <div className="shift-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong>🏥 Clinic Medics</strong>
                      <span style={{ color: 'var(--accent)' }}>{clinicStaff.length}</span>
                    </div>
                    <p style={{ fontSize: '9px', color: 'var(--ink-dim)', margin: 0 }}>
                      Treats injured survivors and stabilizes downed casualties.
                    </p>
                  </div>

                  <div className="shift-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong>⚙️ Workshop Engineers</strong>
                      <span style={{ color: 'var(--accent)' }}>{workshopStaff.length}</span>
                    </div>
                    <p style={{ fontSize: '9px', color: 'var(--ink-dim)', margin: 0 }}>
                      Repairs broken wall panels and restores building durability.
                    </p>
                  </div>

                  <div className="shift-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong>🌱 Farm Growers</strong>
                      <span style={{ color: 'var(--accent)' }}>{farmStaff.length}</span>
                    </div>
                    <p style={{ fontSize: '9px', color: 'var(--ink-dim)', margin: 0 }}>
                      Boosts crop production and prevents starvation.
                    </p>
                  </div>

                  <div className="shift-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong>🛡️ Barracks Guards</strong>
                      <span style={{ color: 'var(--accent)' }}>{barracksStaff.length}</span>
                    </div>
                    <p style={{ fontSize: '9px', color: 'var(--ink-dim)', margin: 0 }}>
                      Active perimeter combat hunters with bonus HP & firepower.
                    </p>
                  </div>

                  <div className="shift-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong>⚗️ Research Lab</strong>
                      <span style={{ color: 'var(--accent)' }}>{labStaff.length}</span>
                    </div>
                    <p style={{ fontSize: '9px', color: 'var(--ink-dim)', margin: 0 }}>
                      Synthesizes doctrines, advances tech tree, and creates antidotes.
                    </p>
                  </div>

                  <div className="shift-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong>🪓 Lumber Mill</strong>
                      <span style={{ color: 'var(--accent)' }}>{sawmillStaff.length}</span>
                    </div>
                    <p style={{ fontSize: '9px', color: 'var(--ink-dim)', margin: 0 }}>
                      Harvests timber and produces wood for defenses and constructions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2.5: JOBS & CAREERS HUB */}
          {activeTab === 'jobs' && (() => {
            const currentJob = JOB_BY_ID[selectedJobId] || JOBS_CONFIG[0];
            const jobRole = currentJob.role;
            const assignedSurvivors = survivors.filter(s =>
              jobRole === 'guard'
                ? (s.role === 'guard' || s.role === 'patrol' || s.role === 'sentry')
                : (s.job === jobRole || s.role === jobRole)
            );
            const baseBuildings = (buildings || []).filter(b => b.type === currentJob.baseBuilding);
            const upgradesList = JOB_UPGRADES_BY_ROLE[jobRole] || [];

            return (
              <div style={{ padding: '4px 0' }}>
                {/* 7 Profession Selector */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                  {JOBS_CONFIG.map(j => {
                    const count = survivors.filter(s =>
                      j.role === 'guard'
                        ? (s.role === 'guard' || s.role === 'patrol' || s.role === 'sentry')
                        : (s.job === j.role || s.role === j.role)
                    ).length;
                    const isActive = selectedJobId === j.id;

                    return (
                      <button
                        key={j.id}
                        className={`filter-pill ${isActive ? 'active' : ''}`}
                        style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => setSelectedJobId(j.id)}
                      >
                        <span>{j.icon}</span>
                        <span>{j.name.toUpperCase()}</span>
                        <span style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: '8px', fontSize: '10px' }}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Job Hero Card */}
                <div className="shift-card" style={{ marginBottom: '14px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '24px' }}>{currentJob.icon}</span>
                      <div>
                        <h2 style={{ fontSize: '16px', margin: 0, color: 'var(--ink)' }}>{currentJob.name.toUpperCase()}</h2>
                        <p style={{ fontSize: '11px', color: 'var(--ink-dim)', margin: '2px 0 0' }}>{currentJob.description}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span className="filter-pill active" style={{ fontSize: '10px' }}>
                        ★ PRI: {(currentJob.primaryStat || 'str').toUpperCase()}
                      </span>
                      <span className="filter-pill" style={{ fontSize: '10px' }}>
                        ▲ SEC: {(currentJob.secondaryStat || 'agi').toUpperCase()}
                      </span>
                      <span style={{ background: 'rgba(156, 184, 130, 0.2)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: 'bold' }}>
                        {assignedSurvivors.length} ACTIVE
                      </span>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '3px', borderLeft: '3px solid var(--accent)', fontSize: '11px', color: 'var(--ink-muted)' }}>
                    <strong style={{ color: 'var(--accent)' }}>Labor Scaling: </strong>{currentJob.statScalingFormula}
                  </div>
                </div>

                {/* Base Workstation Panel */}
                <div className="shift-card" style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '11px', letterSpacing: '1px', color: 'var(--ink-dim)', textTransform: 'uppercase', margin: 0 }}>
                      BASE WORKSTATION: {currentJob.baseBuildingName.toUpperCase()}
                    </h3>
                    <span style={{ fontSize: '10px', color: baseBuildings.length > 0 ? 'var(--accent)' : '#e5a498' }}>
                      {baseBuildings.length > 0 ? `✓ ${baseBuildings.length} Built in Refuge` : '⚠ Workstation Not Yet Built'}
                    </span>
                  </div>
                  <p style={{ fontSize: '10px', color: 'var(--ink-muted)', margin: '0 0 10px' }}>
                    {currentJob.buildingBonuses}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: '3px' }}>
                    <span style={{ fontSize: '11px' }}>
                      Worker Capacity: <strong>{currentJob.postSlots || 2} Slots per building</strong>
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--ink-dim)' }}>
                      Currently Stationed: <strong style={{ color: 'var(--accent)' }}>{assignedSurvivors.length} survivors</strong>
                    </span>
                  </div>
                </div>

                {/* Career Level-Up Requirements Ladder */}
                <div style={{ marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '11px', letterSpacing: '1px', color: 'var(--ink-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    CAREER LADDER & LEVEL-UP REQUIREMENTS
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', background: 'rgba(0,0,0,0.15)', borderRadius: '4px', overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,0,0,0.3)', textAlign: 'left', color: 'var(--ink-dim)', fontSize: '10px' }}>
                        <th style={{ padding: '8px 10px' }}>CAREER RANK</th>
                        <th style={{ padding: '8px 10px' }}>MIN LEVEL</th>
                        <th style={{ padding: '8px 10px' }}>REQUIRED STATS</th>
                        <th style={{ padding: '8px 10px' }}>DUTY HOURS</th>
                        <th style={{ padding: '8px 10px' }}>SPECIALIST PERK / TRAIT</th>
                        <th style={{ padding: '8px 10px' }}>QUALIFIED CREW</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(currentJob.careerRanks || []).map(rank => {
                        const reqStatsStr = Object.entries(rank.requiredStats || {})
                          .map(([s, val]) => `${s.toUpperCase()} ≥ ${val}`)
                          .join(', ') || 'None';
                        const qualified = assignedSurvivors.filter(s => {
                          const lvl = s.level || 1;
                          const stats = s.stats || {};
                          return lvl >= rank.level && Object.entries(rank.requiredStats || {}).every(([k, v]) => (stats[k] || 5) >= v);
                        });

                        return (
                          <tr key={rank.level} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: qualified.length > 0 ? 'rgba(156,184,130,0.06)' : undefined }}>
                            <td style={{ padding: '8px 10px' }}>
                              <strong style={{ color: 'var(--accent)' }}>{`Rank ${rank.level}: `}</strong>
                              <span>{rank.title}</span>
                            </td>
                            <td style={{ padding: '8px 10px' }}>Lv.{rank.level}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--ink-muted)' }}>{reqStatsStr}</td>
                            <td style={{ padding: '8px 10px' }}>{rank.dutyHours > 0 ? `${rank.dutyHours}h` : 'Immediate'}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--ink)' }}>{rank.bonus}</td>
                            <td style={{ padding: '8px 10px' }}>
                              {qualified.length === 0 ? (
                                <span style={{ color: 'var(--ink-dim)', fontSize: '10px' }}>—</span>
                              ) : (
                                qualified.map(q => q.name).join(', ')
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Job Perks & Upgrades Mini-Tree */}
                <div>
                  <h3 style={{ fontSize: '11px', letterSpacing: '1px', color: 'var(--ink-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    {currentJob.name.toUpperCase()} SPECIALIST PERKS & UPGRADES
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                    {upgradesList.map(u => {
                      const isPurchased = (purchasedUpgrades || []).includes(u.id);
                      const costStr = Object.entries(u.cost || {}).map(([r, a]) => `${a} ${r}`).join(' · ');

                      return (
                        <div key={u.id} className="shift-card" style={{ borderColor: isPurchased ? 'var(--accent)' : undefined }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <strong>{u.name}</strong>
                            <span style={{ fontSize: '9px', color: isPurchased ? 'var(--accent)' : 'var(--ink-dim)' }}>
                              {isPurchased ? '✓ RESEARCHED' : `TIER ${u.tier || 1}`}
                            </span>
                          </div>
                          <p style={{ fontSize: '10px', color: 'var(--ink-muted)', margin: '0 0 8px' }}>
                            {u.description}
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px' }}>
                            <span style={{ color: 'var(--ink-dim)' }}>
                              {u.requires ? `Requires: ${u.requires}` : `Cost: ${costStr}`}
                            </span>
                            {!isPurchased && onResearchUpgrade && (
                              <button
                                className="filter-pill"
                                style={{ fontSize: '9px', padding: '2px 8px' }}
                                onClick={() => onResearchUpgrade(u.id)}
                              >
                                Research ({costStr})
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TAB 3: SURVIVOR RPG DOSSIER */}
          {activeTab === 'dossier' && selectedSurvivor && (
            <div className="dossier-layout">
              <aside className="dossier-sidebar">
                <div className="dossier-portrait-large">
                  {selectedSurvivor.portraitUrl ? (
                    <img src={selectedSurvivor.portraitUrl} alt={selectedSurvivor.name} />
                  ) : (
                    <span style={{ fontSize: '32px' }}>👤</span>
                  )}
                </div>

                <div className="dossier-name">{selectedSurvivor.name}</div>
                <div className="dossier-role">{selectedSurvivor.dutyLabel || selectedSurvivor.role}</div>

                <div style={{ width: '100%', fontSize: '10px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--ink-dim)' }}>Level:</span>
                    <strong>Lv.{selectedSurvivor.level || 1}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--ink-dim)' }}>Health:</span>
                    <strong style={{ color: 'var(--accent)' }}>{selectedSurvivor.hp} / {selectedSurvivor.maxHp || 100}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--ink-dim)' }}>Weapon:</span>
                    <strong>{selectedSurvivor.gear || 'Unarmed'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--ink-dim)' }}>Task:</span>
                    <span style={{ color: 'var(--accent)', fontSize: '9px' }}>{selectedSurvivor.task || 'STANDBY'}</span>
                  </div>
                </div>

                <div className="dossier-nav-btns">
                  <button className="dossier-nav-btn" onClick={handlePrevSurvivor}>◄ Prev</button>
                  <button className="dossier-nav-btn" onClick={handleNextSurvivor}>Next ►</button>
                </div>
              </aside>

              <main className="dossier-stats-panel">
                <div>
                  <h3 style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--ink-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    CORE RPG ATTRIBUTES
                  </h3>
                  <div className="attributes-grid">
                    {Object.entries(STAT_INFO).map(([key, info]) => {
                      const val = (selectedSurvivor.stats && selectedSurvivor.stats[key]) || 5;

                      return (
                        <div key={key} className="attr-card" title={`${info.name}: ${info.desc}`}>
                          <div className="attr-name">{info.label}</div>
                          <div className="attr-val">{val}</div>
                          <div className="attr-pips">
                            {Array.from({ length: 10 }).map((_, i) => (
                              <div key={i} className={`pip ${i < val ? 'filled' : ''}`} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--ink-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    DUTY ASSIGNMENT
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['guard', 'medic', 'engineer', 'farmer', 'scavenger', 'researcher', 'logger'].map(job => (
                      <button
                        key={job}
                        className={`filter-pill ${selectedSurvivor.job === job || selectedSurvivor.role === job ? 'active' : ''}`}
                        onClick={() => onAssignJob && onAssignJob(selectedSurvivor.id, job)}
                      >
                        {job.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--ink-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    PATROL SECTOR
                  </h3>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['north', 'east', 'south', 'west', 'any'].map(side => (
                      <button
                        key={side}
                        className={`filter-pill ${selectedSurvivor.side === side ? 'active' : ''}`}
                        onClick={() => onAssignSide && onAssignSide(selectedSurvivor.id, side)}
                      >
                        {side.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--ink-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    EQUIP WEAPON
                  </h3>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['pipe', 'pistol', 'rifle'].map(w => (
                      <button
                        key={w}
                        className={`filter-pill ${selectedSurvivor.gear === w ? 'active' : ''}`}
                        onClick={() => onEquipWeapon && onEquipWeapon(selectedSurvivor.id, w)}
                      >
                        {w.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </main>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
