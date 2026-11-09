import React, { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import apiService from "../../../services/apiService";
import Panel from "./Panel";

const SOCKET_ORIGIN = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/api\/?$/, "");

export const fmtSeen = (iso) => (iso ? new Date(iso).toLocaleString() : "No activity recorded");

/** Pure helper: apply one live presence event to the employee list. */
export const applyPresence = (employees, evt) =>
  employees.map((e) =>
    e.key === evt.key
      ? { ...e, online: !!evt.online, lastSeen: evt.lastSeen || e.lastSeen, sessions: evt.online ? Math.max(1, e.sessions) : 0 }
      : e
  );

/**
 * Employee Live Status. The initial list comes from GET /api/presence
 * (this company's employees + real socket presence); changes then stream
 * in over an authenticated Socket.IO connection (server only sends them
 * to Admin sockets of the same company). No status is ever assumed
 * client-side: until the server says otherwise, nobody is shown Online.
 */
const EmployeeLiveStatus = () => {
  const [state, setState] = useState({ employees: [], loading: true, error: "" });
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await apiService.get("/presence");
      setState({ employees: data.employees || [], loading: false, error: "" });
    } catch (err) {
      console.error("Employee presence error:", err);
      setState((s) => ({ ...s, loading: false, error: "Could not load employee status." }));
    }
  }, []);

  useEffect(() => {
    load();
    const token = localStorage.getItem("token");
    if (!token) return undefined;
    const socket = io(SOCKET_ORIGIN, { auth: { token } });
    socket.on("presence_update", (evt) =>
      setState((s) => ({ ...s, employees: applyPresence(s.employees, evt) }))
    );
    // After a dropped connection we may have missed events: resync.
    socket.io.on("reconnect", load);
    return () => socket.close();
  }, [load]);

  const { employees } = state;
  const online = employees.filter((e) => e.online).length;
  const roles = useMemo(() => [...new Set(employees.map((e) => e.role))].sort(), [employees]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter(
      (e) => (!role || e.role === role) && (!q || String(e.name).toLowerCase().includes(q) || String(e.role).toLowerCase().includes(q))
    );
  }, [employees, query, role]);

  return (
    <Panel
      title="Employee Live Status"
      subtitle="Real-time online / offline status of your team"
      loading={state.loading}
      error={state.error}
      empty={!state.loading && employees.length === 0}
      emptyText="No employees found."
    >
      <div className="ad-live-counts">
        <span className="ad-live-count">
          <span className="ad-live-dot on" /> Online <strong data-testid="live-online">{online}</strong>
        </span>
        <span className="ad-live-count">
          <span className="ad-live-dot off" /> Offline <strong data-testid="live-offline">{employees.length - online}</strong>
        </span>
      </div>
      <div className="ad-live-tools">
        <input type="search" placeholder="Search employee or role" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search employees" />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      {visible.length === 0 ? (
        <div className="ad-state">No employees match your filter.</div>
      ) : (
        <ul className="ad-live-list">
          {visible.map((e) => (
            <li key={e.key} className="ad-live-item">
              <span className={`ad-live-dot ${e.online ? "on" : "off"}`} role="img" aria-label={e.online ? "Online" : "Offline"} />
              <div>
                <div className="ad-live-name">{e.name}</div>
                <div className="ad-live-role">{e.role}</div>
              </div>
              <div className={`ad-live-seen ${e.online ? "on" : ""}`}>
                {e.online ? "Online now" : `Last seen ${fmtSeen(e.lastSeen)}`}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="ad-live-note">Last-seen times are recorded while the server is running.</p>
    </Panel>
  );
};

export default EmployeeLiveStatus;
