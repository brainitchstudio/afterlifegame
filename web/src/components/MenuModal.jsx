import React, { useState } from 'react';

export function MenuModal({
  isOpen,
  onClose,
  onSaveGame,
  onResetGame,
  soundEnabled,
  onToggleSound,
  onExportSave,
  onImportSave,
}) {
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleCopySave = () => {
    const data = onExportSave();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(data).then(() => {
        setMessage('Save data copied to clipboard!');
        setTimeout(() => setMessage(''), 3000);
      });
    }
  };

  const handleApplyImport = () => {
    if (!importText.trim()) return;
    const ok = onImportSave(importText.trim());
    if (ok) {
      setMessage('Save imported successfully!');
      setTimeout(() => {
        setMessage('');
        setShowImport(false);
        onClose();
      }, 1000);
    } else {
      setMessage('Error: Invalid save data format');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window" style={{ width: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h2>SETTLEMENT COMMAND MENU</h2>
            <p>Preferences, Persistence & Operations</p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {message && (
            <div style={{ padding: '8px 12px', background: 'rgba(194, 209, 139, 0.15)', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '10px' }}>
              {message}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              className="filter-pill active"
              onClick={onSaveGame}
              style={{ padding: '10px' }}
            >
              💾 Save Colony
            </button>

            <button
              className="filter-pill"
              onClick={onToggleSound}
              style={{ padding: '10px' }}
            >
              {soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: MUTED'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              className="filter-pill"
              onClick={handleCopySave}
              style={{ padding: '10px' }}
            >
              📋 Copy Save to Clipboard
            </button>

            <button
              className="filter-pill"
              onClick={() => setShowImport(!showImport)}
              style={{ padding: '10px' }}
            >
              📥 Import Save
            </button>
          </div>

          {showImport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder="Paste JSON save string here..."
                style={{
                  height: '70px',
                  background: '#121812',
                  border: '1px solid var(--panel-border)',
                  color: 'var(--ink)',
                  fontFamily: 'inherit',
                  fontSize: '9px',
                  padding: '8px',
                  resize: 'none',
                }}
              />
              <button
                className="filter-pill active"
                onClick={handleApplyImport}
                style={{ padding: '8px' }}
              >
                Apply Imported Save
              </button>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '12px' }}>
            <div style={{ fontSize: '9px', color: 'var(--ink-dim)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
              TACTICAL KEYBOARD SHORTCUTS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '9px', color: 'var(--ink-muted)' }}>
              <div><strong>WASD / Drag</strong> : Pan Viewport</div>
              <div><strong>Mouse Wheel</strong> : Cursor Zoom</div>
              <div><strong>Space</strong> : Pause / Resume</div>
              <div><strong>1 / 2 / 4</strong> : Game Speed</div>
              <div><strong>B</strong> : Construction Catalog</div>
              <div><strong>C</strong> : Crew & Dossier</div>
              <div><strong>E</strong> : Expeditions</div>
              <div><strong>L</strong> : Land Expansion</div>
              <div><strong>J</strong> : Settlement Journal</div>
              <div><strong>R</strong> : Rotate Wall / Gate</div>
              <div><strong>F / Home</strong> : Focus / Reset View</div>
              <div><strong>ESC</strong> : Cancel / Close</div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              className="filter-pill"
              onClick={() => {
                if (window.confirm('Start a fresh refuge run? All current progress will be reset.')) {
                  onResetGame();
                  onClose();
                }
              }}
              style={{ color: 'var(--red)', borderColor: 'rgba(223, 104, 83, 0.4)', padding: '6px 12px' }}
            >
              New Run (Reset)
            </button>

            <span style={{ fontSize: '8px', color: 'var(--ink-dim)' }}>
              Afterlife Web v2.0 · React + Python
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
