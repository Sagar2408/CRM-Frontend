import React from "react";

export const Modal = ({ title, onClose, children, wide = false, labelledBy = "um-modal-title" }) => (
  <div className="um-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className={`um-modal ${wide ? "um-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <header className="um-modal-head">
        <h2 id={labelledBy}>{title}</h2>
        <button type="button" className="um-icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="um-modal-body">{children}</div>
    </div>
  </div>
);

const ConfirmDialog = ({ title, message, confirmLabel = "Confirm", danger = false, busy = false, onConfirm, onCancel }) => (
  <Modal title={title} onClose={onCancel} labelledBy="um-confirm-title">
    <p className="um-confirm-text">{message}</p>
    <div className="um-actions">
      <button type="button" className="um-btn um-btn-ghost" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
      <button type="button" className={`um-btn ${danger ? "um-btn-danger" : "um-btn-primary"}`} onClick={onConfirm} disabled={busy}>
        {busy ? "Please wait…" : confirmLabel}
      </button>
    </div>
  </Modal>
);

export default ConfirmDialog;
