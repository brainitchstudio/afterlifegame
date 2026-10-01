import React from 'react';

export function ActionDock({
  threatText,
  isThreatActive,
  killCount,
  onOpenBuild,
  onOpenCrew,
  onOpenExped,
  onToggleLand,
  isLandActive,
  alarmActive,
  onToggleAlarm,
  onOpenJournal,
  onOpenMenu,
  onZoomIn,
  onZoomOut,
  onResetCamera,
}) {
  return (
    <footer className="hud-card command-dock" aria-label="Settlement Command Dock">
      <div className="threat-status-line">
        <div className={`threat-left ${isThreatActive ? 'danger' : ''}`}>
          <span className="live-indicator threat-dot" />
          <span>{threatText}</span>
        </div>
        <strong>{killCount} NEUTRALIZED</strong>
      </div>

      <div className="command-grid">
        <button
          className="dock-build-btn"
          onClick={onOpenBuild}
          title="Open Construction Catalog [B]"
        >
          <span>🔨 BUILD</span>
          <small>[B]</small>
        </button>

        <button
          className="dock-utility-btn"
          onClick={() => onOpenCrew('roster')}
          title="Colony Roster & Management [C]"
        >
          <span>👥</span>
          <small>CREW [C]</small>
        </button>

        <button
          className="dock-utility-btn"
          onClick={onOpenExped}
          title="Expeditions & Supply Runs [E]"
        >
          <span>🗺️</span>
          <small>EXPED [E]</small>
        </button>

        <button
          className={`dock-utility-btn ${isLandActive ? 'alarm-active' : ''}`}
          onClick={onToggleLand}
          title="Expand Territory [L]"
        >
          <span>📐</span>
          <small>LAND [L]</small>
        </button>

        <button
          className={`dock-utility-btn ${alarmActive ? 'alarm-active' : ''}`}
          onClick={onToggleAlarm}
          title="Raise / Lower Emergency Alarm"
        >
          <span>🚨</span>
          <small>ALARM</small>
        </button>

        <button
          className="dock-utility-btn"
          onClick={onOpenJournal}
          title="Settlement Journal & Alerts [J]"
        >
          <span>📜</span>
          <small>LOG [J]</small>
        </button>

        <button
          className="dock-utility-btn"
          onClick={onOpenMenu}
          title="Game Menu & Settings"
        >
          <span>⚙️</span>
          <small>MENU</small>
        </button>
      </div>

      <div className="dock-footer">
        <span>SPACE TO PAUSE · ESC TO CANCEL</span>
        <div className="camera-controls">
          <button className="cam-btn" onClick={onZoomOut} title="Zoom Out [-]">−</button>
          <button className="cam-btn" onClick={onResetCamera} title="Reset Camera [F]">⌂ [F]</button>
          <button className="cam-btn" onClick={onZoomIn} title="Zoom In [+]">+</button>
        </div>
      </div>
    </footer>
  );
}
