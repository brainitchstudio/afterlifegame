import React from 'react';

export function PlacementBanner({ placement, expanding, landCost, onCancel, onRotate }) {
  if (!placement && !expanding) return null;

  return (
    <div className="placement-banner-box">
      {placement && (
        <>
          <div>
            <strong>CONSTRUCTING: {placement.type.toUpperCase()}</strong>
            <div style={{ fontSize: '9px', color: 'var(--ink-muted)', marginTop: '2px' }}>
              Click valid highlighted tile to place · Press [ R ] to rotate
            </div>
          </div>
          <button className="cancel-action-btn" onClick={onRotate}>
            Rotate [R]
          </button>
          <button className="cancel-action-btn" onClick={onCancel}>
            Cancel [ESC]
          </button>
        </>
      )}

      {expanding && (
        <>
          <div>
            <strong>EXPANDING TERRITORY</strong>
            <div style={{ fontSize: '9px', color: 'var(--ink-muted)', marginTop: '2px' }}>
              Click highlighted perimeter parcel to claim ({landCost.wood}W · {landCost.metal}M)
            </div>
          </div>
          <button className="cancel-action-btn" onClick={onCancel}>
            Cancel [ESC]
          </button>
        </>
      )}
    </div>
  );
}
