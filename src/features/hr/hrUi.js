import React, { useEffect, useRef, useState } from "react";
import "../../styles/hr.css";

export const useDebounced = (value, ms = 300) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

export const Stat = ({ label, value, sub, tone = "", testId }) => (
  <div className={`hr-card hr-stat ${tone}`} data-testid={testId}>
    <span className="hr-stat-label">{label}</span>
    <span className="hr-stat-value">{value}</span>
    {sub ? <span className="hr-stat-sub">{sub}</span> : null}
  </div>
);

export const Pager = ({ page, limit, total, onPage }) => {
  const pages = Math.max(1, Math.ceil(total / limit));
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  return (
    <div className="hr-pager">
      <span>{total === 0 ? "0 results" : `Showing ${first}–${Math.min(page * limit, total)} of ${total}`}</span>
      <span>
        <button type="button" className="hr-btn ghost sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Prev</button>
        <span style={{ margin: "0 10px" }}>Page {page} of {pages}</span>
        <button type="button" className="hr-btn ghost sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next ›</button>
      </span>
    </div>
  );
};

export const Modal = ({ title, onClose, children }) => {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="hr-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="hr-modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
};

export const ConfirmModal = ({ title, message, confirmLabel = "Confirm", danger, busy, onConfirm, onCancel, children }) => (
  <Modal title={title} onClose={onCancel}>
    <p>{message}</p>
    {children}
    <div className="hr-modal-actions">
      <button type="button" className="hr-btn ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      <button type="button" className={`hr-btn ${danger ? "danger" : ""}`} onClick={onConfirm} disabled={busy}>
        {busy ? "Working…" : confirmLabel}
      </button>
    </div>
  </Modal>
);

export const StateBlock = ({ loading, error, onRetry, empty, emptyText, children }) => {
  if (loading) return <div className="hr-loading" aria-busy="true">Loading…</div>;
  if (error) {
    return (
      <div className="hr-error" role="alert">
        {error} {onRetry && <button type="button" className="hr-link" onClick={onRetry}>Retry</button>}
      </div>
    );
  }
  if (empty) return <div className="hr-empty">{emptyText}</div>;
  return children;
};

export const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};
export const fmtDateTime = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
