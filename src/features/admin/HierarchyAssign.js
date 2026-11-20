import React, { useEffect, useMemo, useState } from "react";
import { ConfirmModal, Modal } from "../hr/hrUi";
import { ASSIGNABLE_ROLES, apiKeyOf, orgApi, orgErrorMessage } from "../../services/orgHierarchyApi";
import "../../styles/hr.css";

const ROLE_LABEL = { Executive: "Executive", Manager: "Manager", ProcessPerson: "Process Person" };

/** Loads managers + assignable employees (with their current manager) when `enabled`. */
const useAssignable = (enabled) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    orgApi
      .assignable()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(orgErrorMessage(e, "Could not load employees.")));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return { data, error };
};

/** Searchable multi-select of employees to put under `manager`. Employees already under another manager are moved. */
export const AssignEmployeesModal = ({ manager, onClose, onDone }) => {
  const { data, error: loadError } = useAssignable(true);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const targetKey = `manager:${manager.id}`;

  const list = useMemo(
    () =>
      (data?.employees || [])
        .filter((e) => e.key !== targetKey && e.active && e.managerId !== manager.id)
        .filter((e) => !role || e.role === role)
        .filter((e) => `${e.name} ${e.username || ""} ${e.role}`.toLowerCase().includes(q.trim().toLowerCase())),
    [data, q, role, manager.id, targetKey]
  );
  const already = (data?.employees || []).filter((e) => e.managerId === manager.id).length;
  const moving = picked.filter((k) => (data?.employees || []).find((e) => e.key === k)?.managerId != null);
  const toggle = (k) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await orgApi.assign(manager.id, picked, { reassign: moving.length > 0 });
      onDone(`${res.assigned.length} employee${res.assigned.length === 1 ? "" : "s"} now report to ${manager.name}.`);
    } catch (e) {
      setError(orgErrorMessage(e, "Could not assign the selected employees."));
      setBusy(false);
    }
  };

  return (
    <Modal title={`Assign employees to ${manager.name}`} onClose={onClose}>
      {loadError && <div className="hr-error" role="alert">{loadError}</div>}
      {!data && !loadError && <p>Loading employees…</p>}
      {data && (
        <>
          <div className="hr-toolbar">
            <input type="search" placeholder="Search by name or username" aria-label="Search employees" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            <select aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              {ASSIGNABLE_ROLES.map((r) => <option key={r} value={ROLE_LABEL[r]}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <p className="hr-help">{already} already report to {manager.name}. Selected: {picked.length}.</p>
          <ul className="oh-pick" aria-label="Employees">
            {list.length === 0 && <li className="hr-empty">No employees match.</li>}
            {list.map((e) => (
              <li key={e.key}>
                <label>
                  <input type="checkbox" checked={picked.includes(e.key)} onChange={() => toggle(e.key)} />
                  <span className="oh-pick-name">{e.name}</span>
                  <span className="hr-pill">{e.role}</span>
                  {e.managerName ? <span className="hr-help">Reports to {e.managerName} (will be moved)</span> : <span className="hr-help">Not assigned</span>}
                </label>
              </li>
            ))}
          </ul>
          {moving.length > 0 && <p className="hr-note" role="note">{moving.length} selected employee{moving.length === 1 ? "" : "s"} currently report to another manager and will be reassigned.</p>}
        </>
      )}
      {error && <div className="hr-error" role="alert">{error}</div>}
      <div className="hr-modal-actions">
        <button type="button" className="hr-btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="hr-btn" onClick={submit} disabled={busy || picked.length === 0}>
          {busy ? "Saving…" : `Assign ${picked.length || ""} ${picked.length === 1 ? "employee" : "employees"}`.replace("  ", " ")}
        </button>
      </div>
    </Modal>
  );
};

/** Pick another manager for one employee (reassign) - or a manager when they have none. */
export const ReassignModal = ({ employee, currentManagerId, onClose, onDone }) => {
  const { data, error: loadError } = useAssignable(true);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = apiKeyOf(employee);
  const managers = (data?.managers || []).filter((m) => m.active && m.key !== key && m.id !== currentManagerId);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await orgApi.assign(Number(target), [key], { reassign: true });
      const m = managers.find((x) => String(x.id) === String(target));
      onDone(`${employee.name} now reports to ${m?.name || "the selected manager"}.`);
    } catch (e) {
      setError(orgErrorMessage(e, "Could not reassign."));
      setBusy(false);
    }
  };

  return (
    <Modal title={`Reassign ${employee.name}`} onClose={onClose}>
      {loadError && <div className="hr-error" role="alert">{loadError}</div>}
      <div className="hr-form">
        <label>
          New reporting manager
          <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={!data}>
            <option value="">Select a manager</option>
            {managers.map((m) => <option key={m.key} value={m.id}>{m.name}</option>)}
          </select>
        </label>
      </div>
      {error && <div className="hr-error" role="alert">{error}</div>}
      <div className="hr-modal-actions">
        <button type="button" className="hr-btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="hr-btn" onClick={submit} disabled={busy || !target}>{busy ? "Saving…" : "Reassign"}</button>
      </div>
    </Modal>
  );
};

/**
 * Assignment controls shown in the details panel:
 *  - selected Manager: "Assign employees" + Reassign / Remove on each direct report
 *  - selected Executive / Process Person / Manager: Assign / Reassign / Remove their own line
 */
const HierarchyAssign = ({ node, onChanged }) => {
  const [modal, setModal] = useState(null); // {type:"assign"|"reassign"|"remove", employee?}
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isManager = node.role === "Manager";
  const canBeAssigned = ASSIGNABLE_ROLES.includes(node.role);
  const underManager = node.reportsTo?.role === "Manager";
  const reports = (node.children || []).filter((c) => ASSIGNABLE_ROLES.includes(c.role));

  const done = (msg) => {
    setModal(null);
    setError("");
    onChanged(msg);
  };
  const managerIdOf = (emp) => (emp.reportsTo?.role === "Manager" ? Number(String(emp.reportsTo.key).split(":")[1]) : null);

  const confirmRemove = async () => {
    const emp = modal.employee;
    setBusy(true);
    try {
      await orgApi.remove(managerIdOf(emp), apiKeyOf(emp));
      done(`${emp.name} was removed from ${emp.reportsTo.name}.`);
    } catch (e) {
      setError(orgErrorMessage(e, "Could not remove."));
      setModal(null);
    } finally {
      setBusy(false);
    }
  };

  if (!isManager && !canBeAssigned) return null;

  return (
    <div className="oh-assign" data-testid="oh-assign">
      <h3>Reporting</h3>
      {error && <div className="hr-error" role="alert">{error}</div>}

      {isManager && (
        <>
          <button type="button" className="hr-btn sm" onClick={() => setModal({ type: "assign" })}>Assign employees</button>
          {reports.length > 0 && (
            <ul className="oh-members oh-members-edit" aria-label={`Reports of ${node.name}`}>
              {reports.map((c) => (
                <li key={c.key}>
                  <span>{c.name} <em>{ROLE_LABEL[c.role]}</em></span>
                  <span className="oh-row-actions">
                    <button type="button" className="hr-link" aria-label={`Reassign ${c.name}`} onClick={() => setModal({ type: "reassign", employee: c })}>Reassign</button>
                    <button type="button" className="hr-link danger" aria-label={`Remove ${c.name}`} onClick={() => setModal({ type: "remove", employee: c })}>Remove</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {canBeAssigned && (
        <div className="oh-line-actions">
          <button type="button" className="hr-btn sm ghost" onClick={() => setModal({ type: "reassign", employee: node })}>
            {underManager ? "Reassign to another manager" : "Assign to a manager"}
          </button>
          {underManager && (
            <button type="button" className="hr-btn sm ghost danger" onClick={() => setModal({ type: "remove", employee: node })}>Remove from manager</button>
          )}
        </div>
      )}

      {modal?.type === "assign" && <AssignEmployeesModal manager={{ id: node.id, name: node.name }} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === "reassign" && (
        <ReassignModal employee={modal.employee} currentManagerId={managerIdOf(modal.employee)} onClose={() => setModal(null)} onDone={done} />
      )}
      {modal?.type === "remove" && (
        <ConfirmModal
          title="Remove from manager"
          message={`${modal.employee.name} will no longer report to ${modal.employee.reportsTo?.name}. Team Management teams are not changed.`}
          confirmLabel="Remove"
          danger
          busy={busy}
          onConfirm={confirmRemove}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
};

export default HierarchyAssign;
