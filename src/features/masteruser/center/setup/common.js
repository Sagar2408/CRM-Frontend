import React, { useEffect } from "react";

export const Msg = ({ msg }) =>
  msg ? (
    <p className={msg.type === "error" ? "mc-error" : "mc-ok"} role={msg.type === "error" ? "alert" : "status"}>
      {msg.text}
    </p>
  ) : null;

/** Reports a tab's unsaved-changes state to the page (which guards tab switches / leaving). */
export function useReportDirty(dirty, setPageDirty) {
  useEffect(() => {
    setPageDirty(!!dirty);
    return () => setPageDirty(false);
  }, [dirty, setPageDirty]);
}

export const Field = ({ id, label, error, hint, wide, children }) => (
  <div className={`mc-field${wide ? " wide" : ""}`}>
    <label htmlFor={id}>{label}</label>
    {children}
    {hint && <span className="mc-muted mc-hint">{hint}</span>}
    {error && <span className="mc-error" id={`${id}-err`}>{error}</span>}
  </div>
);

export const confirmAction = (text) => (typeof window.confirm === "function" ? window.confirm(text) : true);
