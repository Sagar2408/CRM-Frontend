import React, { useMemo, useState } from "react";
import { teamApi, teamErrorMessage } from "../../services/teamManagementApi";
import { GOAL_METRICS } from "./teamUtils";

export const Modal = ({ title, onClose, children, narrow }) => (
  <div className="tm-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className={`tm-modal ${narrow ? "narrow" : ""}`}>
      <div className="tm-modal-head">
        <h3>{title}</h3>
        <button type="button" className="tm-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="tm-modal-body">{children}</div>
    </div>
  </div>
);

/** Destructive-action confirmation. */
export const ConfirmDialog = ({ title, message, confirmLabel, busy, onConfirm, onCancel }) => (
  <Modal title={title} onClose={onCancel} narrow>
    <p>{message}</p>
    <div className="tm-actions">
      <button type="button" className="tm-btn" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
      <button type="button" className="tm-btn danger" onClick={onConfirm} disabled={busy}>
        {busy ? "Working…" : confirmLabel}
      </button>
    </div>
  </Modal>
);

/** Role-agnostic employee picker: any mix of Admin/TL/Executive/Manager/HR/Process Person. */
export const EmployeePicker = ({ employees, selected, onToggle, excludeKeys = [] }) => {
  const [q, setQ] = useState("");
  const list = useMemo(
    () => employees.filter((e) => !excludeKeys.includes(e.key)).filter((e) => `${e.name} ${e.role}`.toLowerCase().includes(q.toLowerCase())),
    [employees, excludeKeys, q]
  );
  return (
    <>
      <input className="tm-input" placeholder="Search employees…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search employees" />
      <div className="tm-picker">
        {list.length === 0 && <div className="tm-empty-small">No employees found.</div>}
        {list.map((e) => {
          const blocked = !e.active || !!e.currentTeam;
          return (
            <label key={e.key} className={`tm-picker-row ${blocked ? "blocked" : ""}`}>
              <input type="checkbox" disabled={blocked} checked={selected.includes(e.key)} onChange={() => onToggle(e.key)} />
              <span className="tm-picker-name">{e.name}</span>
              <span className="tm-role">{e.role}</span>
              {!e.active && <span className="tm-note">Deactivated</span>}
              {e.active && e.currentTeam && <span className="tm-note">In {e.currentTeam.name}</span>}
            </label>
          );
        })}
      </div>
    </>
  );
};

const today = () => new Date().toISOString().slice(0, 10);

/** Create (with members) or edit (details only; members are managed in the drawer). */
export const TeamFormModal = ({ team, employees, onClose, onSaved }) => {
  const editing = !!team;
  const [form, setForm] = useState({
    name: team?.name || "",
    description: team?.description || "",
    goal: team?.goalText || "",
    goalMetric: team?.goalMetric || "assigned",
    targetValue: team?.targetValue || "",
    startDate: team?.startDate || today(),
    endDate: team?.endDate || "",
  });
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const problem = () => {
    if (!form.name.trim()) return "Enter a team name.";
    const t = Number(form.targetValue);
    if (!Number.isInteger(t) || t < 1) return "Target value must be a whole number of at least 1.";
    if (!form.startDate) return "Choose a start date.";
    if (form.endDate && form.endDate < form.startDate) return "End date cannot be before the start date.";
    if (!editing && members.length === 0) return "Select at least one team member.";
    return "";
  };

  const submit = async (e) => {
    e.preventDefault();
    const p = problem();
    if (p) return setError(p);
    setBusy(true);
    setError("");
    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      goal: form.goal.trim(),
      goalMetric: form.goalMetric,
      targetValue: Number(form.targetValue),
      startDate: form.startDate,
      endDate: form.endDate || null,
    };
    try {
      const res = editing ? await teamApi.update(team.id, body) : await teamApi.create({ ...body, endDate: form.endDate || undefined, memberKeys: members });
      onSaved(res.team);
    } catch (err) {
      setError(teamErrorMessage(err, "Could not save the team."));
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? "Edit team" : "Create team"} onClose={onClose}>
      <form onSubmit={submit}>
        <label className="tm-label" htmlFor="tm-name">Team name *</label>
        <input id="tm-name" className="tm-input" maxLength={100} value={form.name} onChange={set("name")} autoFocus />
        <label className="tm-label" htmlFor="tm-desc">Description</label>
        <textarea id="tm-desc" className="tm-input" rows={2} maxLength={500} value={form.description} onChange={set("description")} />
        <label className="tm-label" htmlFor="tm-goal">Team goal</label>
        <input id="tm-goal" className="tm-input" maxLength={200} value={form.goal} onChange={set("goal")} placeholder="e.g. Convert 40 leads this quarter" />
        <div className="tm-row">
          <div>
            <label className="tm-label" htmlFor="tm-metric">Goal metric *</label>
            <select id="tm-metric" className="tm-input" value={form.goalMetric} onChange={set("goalMetric")}>
              {GOAL_METRICS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="tm-label" htmlFor="tm-target">Target value *</label>
            <input id="tm-target" className="tm-input" type="number" min="1" value={form.targetValue} onChange={set("targetValue")} />
          </div>
        </div>
        <div className="tm-row">
          <div>
            <label className="tm-label" htmlFor="tm-start">Start date *</label>
            <input id="tm-start" className="tm-input" type="date" value={form.startDate} onChange={set("startDate")} />
          </div>
          <div>
            <label className="tm-label" htmlFor="tm-end">End date (optional)</label>
            <input id="tm-end" className="tm-input" type="date" value={form.endDate} min={form.startDate} onChange={set("endDate")} />
          </div>
        </div>
        {!editing && (
          <>
            <label className="tm-label">Team members ({members.length} selected)</label>
            <p className="tm-muted">Any mix of roles is allowed. An employee can be in one active team at a time.</p>
            <EmployeePicker employees={employees} selected={members} onToggle={(k) => setMembers((m) => (m.includes(k) ? m.filter((x) => x !== k) : [...m, k]))} />
          </>
        )}
        {error && (
          <div className="tm-error" role="alert">
            {error}
          </div>
        )}
        <div className="tm-actions">
          <button type="button" className="tm-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="tm-btn primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create team"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
