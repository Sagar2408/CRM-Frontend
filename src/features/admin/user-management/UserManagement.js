import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import "../../../styles/userManagement.css";
import SidebarToggle from "../SidebarToggle";
import { Alert, soundManager } from "../../modal/alert";
import Avatar from "./Avatar";
import ConfirmDialog from "./ConfirmDialog";
import CreateUserModal from "./CreateUserModal";
import EditUserModal from "./EditUserModal";
import ViewUserModal from "./ViewUserModal";
import { RoleBadge, StatusBadge, fmtDate } from "./badges";
import { apiError, listUsers, ROLE_OPTIONS, setUserActive, setUserManagementBase } from "../../../services/userManagementService";

const PAGE_SIZE = 10;

/**
 * Admin User Management. HR "Employee Management" renders the same page with:
 *   base          API prefix (default: the Admin endpoints)
 *   roleOptions   roles offered in the filter
 *   createRoles   roles the Create dialog offers (default: all)
 *   readOnlyRoles roles whose rows can be viewed but not edited/deactivated
 */
const UserManagement = ({
  base = null,
  title = "User Management",
  subtitle = "Create, view and manage everyone in your organisation.",
  roleOptions = ROLE_OPTIONS,
  createRoles = null,
  readOnlyRoles = [],
}) => {
  // useLayoutEffect runs before any child's passive (data-fetching) effect.
  useLayoutEffect(() => {
    setUserManagementBase(base);
    return () => setUserManagementBase(null);
  }, [base]);

  const [filters, setFilters] = useState({ q: "", role: "", status: "" });
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ users: [], total: 0 });
  const [state, setState] = useState({ loading: true, error: "" });
  const [reload, setReload] = useState(0);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [modal, setModal] = useState(null); // {type:'create'|'view'|'edit', user?}
  const [confirm, setConfirm] = useState(null); // user pending deactivation
  const [busy, setBusy] = useState(false);
  const [alerts, setAlerts] = useState([]);

  const notify = useCallback((type, title, message) => {
    setAlerts((a) => [...a, { id: Date.now() + Math.random(), type, title, message, duration: 5000 }]);
    soundManager.playSound(type === "success" ? "success" : "error");
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(filters.q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [filters.q]);

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: "" });
    const params = { page, limit: PAGE_SIZE };
    if (debouncedQ) params.q = debouncedQ;
    if (filters.role) params.role = filters.role;
    if (filters.status) params.status = filters.status;
    listUsers(params)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setState({ loading: false, error: "" });
      })
      .catch((e) => alive && setState({ loading: false, error: apiError(e, "Failed to load users") }));
    return () => {
      alive = false;
    };
  }, [page, debouncedQ, filters.role, filters.status, reload]);

  const refresh = () => setReload((n) => n + 1);
  const setFilter = (name, value) => {
    setFilters((f) => ({ ...f, [name]: value }));
    if (name !== "q") setPage(1);
  };

  const changeStatus = async (user, active) => {
    setBusy(true);
    try {
      await setUserActive(user.kind, user.id, active);
      notify("success", active ? "User activated" : "User deactivated", `${user.name} is now ${active ? "active" : "inactive"}.`);
      refresh();
    } catch (e) {
      notify("error", "Update failed", apiError(e, "Failed to update status"));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const onToggle = (user) => (user.active ? setConfirm(user) : changeStatus(user, true));

  const afterEdit = (message) => {
    setModal(null);
    setPhotoVersion((v) => v + 1);
    if (message) notify("success", "Saved", message);
    refresh();
  };

  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const firstRow = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const filtered = !!(debouncedQ || filters.role || filters.status);

  return (
    <>
      <SidebarToggle />
      <div className="um-page">
        <div className="um-header">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="um-btn um-btn-primary" onClick={() => setModal({ type: "create" })}>
            + Create User
          </button>
        </div>

        <div className="um-card">
          <div className="um-toolbar">
            <input
              type="search"
              placeholder="Search by name, username, email or ID"
              value={filters.q}
              onChange={(e) => setFilter("q", e.target.value)}
              aria-label="Search users"
            />
            <select value={filters.role} onChange={(e) => setFilter("role", e.target.value)} aria-label="Filter by role">
              <option value="">All roles</option>
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {state.error ? (
            <div className="um-state um-state-error" role="alert">
              <p>{state.error}</p>
              <button type="button" className="um-btn um-btn-ghost" onClick={refresh}>Retry</button>
            </div>
          ) : (
            <div className="um-table-wrap">
              <table className="um-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Employee ID</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th className="um-col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.loading &&
                    Array.from({ length: 5 }, (_, i) => (
                      <tr key={`sk${i}`} className="um-skeleton-row" aria-hidden="true">
                        {Array.from({ length: 8 }, (_, j) => (
                          <td key={j}><span className="um-skel" /></td>
                        ))}
                      </tr>
                    ))}
                  {!state.loading && data.users.length === 0 && (
                    <tr>
                      <td colSpan={8} className="um-empty">
                        {filtered ? "No users match your search or filters." : "No users yet. Click “+ Create User” to add the first one."}
                      </td>
                    </tr>
                  )}
                  {!state.loading &&
                    data.users.map((u) => (
                      <tr key={u.key}>
                        <td>
                          <div className="um-user-cell">
                            <Avatar user={u} version={photoVersion} />
                            <span className="um-user-name">{u.name}</span>
                          </div>
                        </td>
                        <td>{u.username || "—"}</td>
                        <td className="um-email">{u.email}</td>
                        <td><RoleBadge role={u.role} label={u.roleLabel} /></td>
                        <td className="um-mono">{u.employeeId}</td>
                        <td><StatusBadge active={u.active} /></td>
                        <td>{fmtDate(u.createdAt)}</td>
                        <td className="um-col-actions">
                          <div className="um-row-actions">
                            <button type="button" className="um-link" onClick={() => setModal({ type: "view", user: u })} aria-label={`View ${u.name}`}>View</button>
                            {!readOnlyRoles.includes(u.role) && (
                              <>
                                <button type="button" className="um-link" onClick={() => setModal({ type: "edit", user: u })} aria-label={`Edit ${u.name}`}>Edit</button>
                                <button
                                  type="button"
                                  className={`um-link ${u.active ? "um-link-danger" : "um-link-ok"}`}
                                  onClick={() => onToggle(u)}
                                  disabled={busy}
                                  aria-label={`${u.active ? "Deactivate" : "Activate"} ${u.name}`}
                                >
                                  {u.active ? "Deactivate" : "Activate"}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {!state.error && (
            <div className="um-pager">
              <span>
                {data.total === 0 ? "0 users" : `Showing ${firstRow}–${Math.min(page * PAGE_SIZE, data.total)} of ${data.total}`}
              </span>
              <div>
                <button type="button" className="um-btn um-btn-ghost um-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
                <span className="um-page-no">Page {page} of {pages}</span>
                <button type="button" className="um-btn um-btn-ghost um-btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal?.type === "create" && (
        <CreateUserModal
          roles={createRoles}
          onClose={() => setModal(null)}
          onCreated={(message) => {
            setModal(null);
            notify("success", "User created", message);
            setPage(1);
            refresh();
          }}
        />
      )}
      {modal?.type === "view" && (
        <ViewUserModal user={modal.user} version={photoVersion} onClose={() => setModal(null)} onEdit={readOnlyRoles.includes(modal.user.role) ? null : (u) => setModal({ type: "edit", user: u })} />
      )}
      {modal?.type === "edit" && <EditUserModal user={modal.user} onClose={() => setModal(null)} onSaved={afterEdit} />}
      {confirm && (
        <ConfirmDialog
          title="Deactivate account?"
          message={`${confirm.name} will no longer be able to log in. You can reactivate the account at any time.`}
          confirmLabel="Deactivate"
          danger
          busy={busy}
          onConfirm={() => changeStatus(confirm, false)}
          onCancel={() => setConfirm(null)}
        />
      )}
      <Alert alerts={alerts} onClose={(id) => setAlerts((a) => a.filter((x) => x.id !== id))} />
    </>
  );
};

export default UserManagement;
