import React, { useState } from 'react';

export function JournalModal({ isOpen, onClose, entries = [] }) {
  const [filter, setFilter] = useState('all');

  if (!isOpen) return null;

  const filtered = entries.filter(e => {
    if (filter === 'alerts') return e.tone === 'warn';
    if (filter === 'milestones') return e.tone === 'good';
    return true;
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window journal-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h2>SETTLEMENT JOURNAL & EVENT LOG</h2>
            <p>Historical Record of Incursions, Construction & Colony Events</p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <div className="modal-content">
          <div className="filter-bar">
            {['all', 'alerts', 'milestones'].map(f => (
              <button
                key={f}
                className={`filter-pill ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="journal-list">
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--ink-dim)', padding: '24px', fontSize: '10px' }}>
                No recorded journal entries for this category yet.
              </div>
            ) : (
              filtered.map((item, idx) => (
                <div key={idx} className={`journal-entry ${item.tone || 'info'}`}>
                  <span className="journal-time">
                    {item.time || 'Day 1'}
                  </span>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--ink)', marginBottom: '3px' }}>
                      {item.title}
                    </strong>
                    <p style={{ margin: 0, color: 'var(--ink-muted)', lineHeight: 1.4 }}>
                      {item.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
