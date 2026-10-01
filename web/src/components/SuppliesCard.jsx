import React from 'react';

export function SuppliesCard({ resources, rates, integrity, integrityHp, maxIntegrityHp, warnings, saveStatus }) {
  const isCritical = integrity < 35;

  return (
    <section className="hud-card supplies-card" aria-label="Settlement Supplies">
      <div className="supplies-header">
        <span>SETTLEMENT SUPPLIES</span>
        <span className="save-pill">{saveStatus || 'AUTOSAVE ON'}</span>
      </div>

      <div className="resources-grid">
        <div className="resource-col">
          <div className="res-header">
            <span className="res-glyph" style={{ color: '#d8b277' }}>🪵</span>
            <span className="res-val">{Math.floor(resources.wood || 0)}</span>
          </div>
          <span className="res-name">Wood</span>
          <span className={`res-rate ${(rates.wood || 0) < 0 ? 'negative' : ''}`}>
            {(rates.wood || 0) >= 0 ? `+${(rates.wood || 0).toFixed(1)}/h` : `${(rates.wood || 0).toFixed(1)}/h`}
          </span>
        </div>

        <div className="resource-col">
          <div className="res-header">
            <span className="res-glyph" style={{ color: '#a6b9cc' }}>⚙️</span>
            <span className="res-val">{Math.floor(resources.metal || 0)}</span>
          </div>
          <span className="res-name">Metal</span>
          <span className={`res-rate ${(rates.metal || 0) < 0 ? 'negative' : ''}`}>
            {(rates.metal || 0) >= 0 ? `+${(rates.metal || 0).toFixed(1)}/h` : `${(rates.metal || 0).toFixed(1)}/h`}
          </span>
        </div>

        <div className="resource-col">
          <div className="res-header">
            <span className="res-glyph" style={{ color: '#a0cc77' }}>🍞</span>
            <span className="res-val">{Math.floor(resources.food || 0)}</span>
          </div>
          <span className="res-name">Food</span>
          <span className={`res-rate ${(rates.food || 0) < 0 ? 'negative' : ''}`}>
            {(rates.food || 0) >= 0 ? `+${(rates.food || 0).toFixed(1)}/h` : `${(rates.food || 0).toFixed(1)}/h`}
          </span>
        </div>
      </div>

      <div className="base-integrity-block">
        <div className="integrity-label-row">
          <span>REFUGE INTEGRITY</span>
          <strong style={{ color: isCritical ? 'var(--red)' : 'var(--accent)' }}>
            {Math.round(integrity)}%
          </strong>
        </div>
        <div className="integrity-bar-track">
          <div
            className={`integrity-bar-fill ${isCritical ? 'critical' : ''}`}
            style={{ width: `${Math.max(0, Math.min(100, integrity))}%` }}
          />
        </div>
      </div>

      {warnings && warnings.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          {warnings.map((w, idx) => (
            <div key={idx} style={{ color: 'var(--red)', fontSize: '9px', display: 'flex', gap: '5px', marginTop: '4px' }}>
              <span>⚠️</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
