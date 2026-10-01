import React from 'react';

export function NotificationToast({ notifications = [] }) {
  if (!notifications.length) return null;

  return (
    <div className="toast-stack">
      {notifications.map(n => (
        <div key={n.id} className={`toast-item ${n.tone || 'info'}`}>
          <strong>{n.title}</strong>
          <p>{n.message}</p>
        </div>
      ))}
    </div>
  );
}
