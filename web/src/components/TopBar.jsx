import React from 'react';

export function TopBar({
  day,
  hour,
  clock,
  phase,
  phaseCountdown,
  dayProgress,
  paused,
  speed,
  onTogglePause,
  onSetSpeed,
  soundEnabled,
  onToggleSound,
  onOpenMenu,
  saveStatus,
}) {
  return (
    <header className="hud-card identity-card">
      <div className="brand-row">
        <div className="brand-left">
          <div className="brand-badge">A<span>+</span></div>
          <div className="brand-text">
            <h1>AFTERLIFE</h1>
            <p>Hold Until Dawn</p>
          </div>
        </div>
        <button
          className="audio-btn"
          onClick={onToggleSound}
          title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
          aria-label="Toggle Sound"
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      </div>

      <div className="clock-row">
        <span className="live-indicator" />
        <strong>DAY {String(day).padStart(2, '0')} <span style={{ color: 'var(--ink-dim)' }}>/ 24</span></strong>
        <span className="phase-pill">{phase}</span>
        <span className="time-clock">{clock}</span>
      </div>

      <div className="day-track" title="Day timeline: Dawn · Daylight · Dusk · Midnight · Dead of night">
        <div
          className="day-progress-bar"
          style={{ width: `${Math.min(100, Math.max(0, dayProgress * 100))}%` }}
        />
      </div>

      <div className="time-actions">
        <span>{phaseCountdown}</span>
        <div className="speed-group">
          <button
            className={`time-btn ${paused ? 'active' : ''}`}
            onClick={onTogglePause}
            title="Pause / Resume [Space]"
          >
            {paused ? '▶' : '⏸'}
          </button>
          <button
            className={`time-btn ${!paused && speed === 1 ? 'active' : ''}`}
            onClick={() => onSetSpeed(1)}
          >
            1×
          </button>
          <button
            className={`time-btn ${!paused && speed === 2 ? 'active' : ''}`}
            onClick={() => onSetSpeed(2)}
          >
            2×
          </button>
          <button
            className={`time-btn ${!paused && speed === 4 ? 'active' : ''}`}
            onClick={() => onSetSpeed(4)}
          >
            4×
          </button>
        </div>
      </div>
    </header>
  );
}
