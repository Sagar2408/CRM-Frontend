import React from "react";

// Shared card shell with consistent loading / error / empty states, so every
// dashboard section looks and behaves the same.
const Panel = ({ title, subtitle, actions, loading, error, empty, emptyText, children, className = "" }) => (
  <section className={`ad-panel ${className}`}>
    <header className="ad-panel-head">
      <div>
        <h2 className="ad-panel-title">{title}</h2>
        {subtitle && <p className="ad-panel-sub">{subtitle}</p>}
      </div>
      {actions}
    </header>
    <div className="ad-panel-body">
      {loading ? (
        <div className="ad-state" role="status">Loading…</div>
      ) : error ? (
        <div className="ad-state ad-state-error" role="alert">{error}</div>
      ) : empty ? (
        <div className="ad-state">{emptyText || "Nothing to show yet."}</div>
      ) : (
        children
      )}
    </div>
  </section>
);

export default Panel;
