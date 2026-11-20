import React, { useCallback, useEffect, useMemo, useState } from "react";
import SidebarToggle from "../admin/SidebarToggle";
import { ConfirmModal, Modal, Pager, Stat, StateBlock, fmtDate, useDebounced } from "../hr/hrUi";
import { PRIORITIES, STATUSES, labelOf, managerError, taskApi } from "../../services/managerTaskService";
import "../../styles/hr.css";
import "../../styles/managerPanel.css";

const VIEWS = [
  { id: "all", label: "All tasks", params: {} },
  { id: "open", label: "Open", params: { status: "todo" } },
  { id: "in_progress", label: "In progress", params: { status: "in_progress" } },
  { id: "completed", label: "Completed", params: { status: "completed" } },
  { id: "overdue", label: "Overdue", params: { overdue: true } },
];
const LIMIT = 10;
const EMPTY = { title: "", description: "", priority: "medium", dueDate: "", assigneeId: "", status: "todo", progress: 0 };

const Progress = ({ value }) => (
  <div className="mgr-progress" aria-label={`Progress ${value}%`}>
    <div className="hr-bar"><span style={{ width: `${value}%` }} /></div>
    <span>{value}%</span>
  </div>
);

const TaskForm = ({ task, members, onClose, onSaved }) => {
  const editing = !!task;
  const [f, setF] = useState(
    editing
      ? { title: task.title, description: task.description || "", priority: task.priority, dueDate: task.dueDate || "", assigneeId: String(task.assigneeId), status: task.status, progress: task.progress }
      : EMPTY
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  // keep status and progress consistent in the form itself, mirroring the server rules
  const setStatus = (e) => {
    const status = e.target.value;
    setF((p) => ({ ...p, status, progress: status === "completed" ? 100 : status === "todo" ? 0 : p.progress >= 100 || p.progress === 0 ? (status === "in_progress" ? 50 : p.progress) : p.progress }));
  };
  const setProgress = (e) => {
    const progress = Number(e.target.value);
    setF((p) => ({ ...p, progress, status: progress >= 100 ? "completed" : progress > 0 && p.status === "todo" ? "in_progress" : progress < 100 && p.status === "completed" ? "in_progress" : p.status }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!f.title.trim()) return setError("Please enter a title.");
    if (!f.assigneeId) return setError("Please choose a team member.");
    setBusy(true);
    setError("");
    try {
      const body = { title: f.title.trim(), description: f.description.trim(), priority: f.priority, dueDate: f.dueDate || null, assigneeId: Number(f.assigneeId) };
      if (editing) {
        body.status = f.status;
        body.progress = Number(f.progress);
      }
      const saved = editing ? await taskApi.update(task.id, body) : await taskApi.create(body);
      onSaved(saved, editing);
    } catch (err) {
      setError(managerError(err, "Could not save the task."));
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? "Edit task" : "New task"} onClose={onClose}>
      <form className="hr-form" onSubmit={submit} noValidate>
        <label>
          Title
          <input value={f.title} onChange={set("title")} maxLength={150} autoFocus placeholder="What needs to be done?" />
        </label>
        <label>
          Description
          <textarea value={f.description} onChange={set("description")} maxLength={2000} placeholder="Details, links or expectations (optional)" />
        </label>
        <div className="hr-row">
          <label>
            Assign to
            <select value={f.assigneeId} onChange={set("assigneeId")}>
              <option value="">Select a team member</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.teamName ? ` — ${m.teamName}` : ""}</option>
              ))}
            </select>
            {editing && Number(f.assigneeId) !== task.assigneeId ? <span className="hr-help">The task will be reassigned and the new assignee notified.</span> : null}
          </label>
          <label>
            Priority
            <select value={f.priority} onChange={set("priority")}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
        </div>
        <div className="hr-row">
          <label>
            Due date
            <input type="date" value={f.dueDate} onChange={set("dueDate")} />
          </label>
          {editing && (
            <label>
              Status
              <select value={f.status} onChange={setStatus}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          )}
        </div>
        {editing && (
          <label>
            Progress: {f.progress}%
            <input className="mgr-range" type="range" min="0" max="100" step="5" value={f.progress} onChange={setProgress} aria-label="Progress" />
          </label>
        )}
        {error && <div className="hr-error" role="alert">{error}</div>}
        <div className="hr-modal-actions">
          <button type="button" className="hr-btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="hr-btn" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create task"}</button>
        </div>
      </form>
    </Modal>
  );
};

/** Manager panel -> Task Management (/manager/teams). Everything comes from /api/manager-tasks. */
const TaskManagement = () => {
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ tasks: [], total: 0 });
  const [summary, setSummary] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // null | { task? }
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const q = useDebounced(search);

  const params = useMemo(
    () => ({ ...VIEWS.find((v) => v.id === view).params, priority, assigneeId, search: q, page, limit: LIMIT }),
    [view, priority, assigneeId, q, page]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([taskApi.list(params), taskApi.summary()]);
      setData(list);
      setSummary(sum);
      setError("");
    } catch (e) {
      setError(managerError(e, "Could not load tasks."));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    taskApi.members().then((r) => setMembers(r.members || [])).catch(() => setMembers([]));
  }, []);
  useEffect(() => setPage(1), [view, priority, assigneeId, q]);

  const saved = (task, wasEdit) => {
    setForm(null);
    setNotice(wasEdit ? `Task “${task.title}” updated.` : `Task “${task.title}” assigned to ${task.assigneeName}.`);
    load();
  };

  const quick = async (task, patch, msg) => {
    try {
      await taskApi.update(task.id, patch);
      setNotice(msg);
      load();
    } catch (e) {
      setError(managerError(e, "Could not update the task."));
    }
  };

  const confirmRemove = async () => {
    setBusy(true);
    try {
      await taskApi.remove(removing.id);
      setNotice(`Task “${removing.title}” deleted.`);
      setRemoving(null);
      load();
    } catch (e) {
      setError(managerError(e, "Could not delete the task."));
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  };

  const noTeam = members.length === 0;
  const Actions = ({ t }) => (
    <div className="mgr-actions">
      {t.status !== "completed" && <button type="button" className="hr-link" onClick={() => quick(t, { status: "completed" }, `Task “${t.title}” marked complete.`)}>Complete</button>}
      {t.status === "completed" && <button type="button" className="hr-link" onClick={() => quick(t, { status: "in_progress" }, `Task “${t.title}” reopened.`)}>Reopen</button>}
      <button type="button" className="hr-link" onClick={() => setForm({ task: t })}>Edit</button>
      <button type="button" className="hr-link danger" onClick={() => setRemoving(t)}>Delete</button>
    </div>
  );
  const Pills = ({ t }) => (
    <>
      <span className={`mgr-pill ${t.status}`}>{labelOf(STATUSES, t.status)}</span>
      {t.overdue && <span className="mgr-pill overdue">Overdue</span>}
    </>
  );

  return (
    <div className="hr-page">
      <SidebarToggle />
      <div className="hr-head">
        <div>
          <h1>Task Management</h1>
          <p>Assign work to your team members, track progress and follow up on what is overdue.</p>
        </div>
        <button type="button" className="hr-btn" onClick={() => setForm({})} disabled={noTeam}>+ New task</button>
      </div>

      {notice && <div className="hr-ok" role="status" onClick={() => setNotice("")}>{notice}</div>}
      {error && <div className="hr-error" role="alert">{error} <button type="button" className="hr-link" onClick={load}>Retry</button></div>}

      <div className="hr-grid cols-4">
        <Stat testId="stat-total" label="Total tasks" value={summary?.total ?? "—"} sub={summary ? `${summary.completionRate}% completed` : ""} />
        <Stat testId="stat-progress" label="In progress" value={summary ? summary.inProgress : "—"} sub={summary ? `${summary.todo} not started` : ""} />
        <Stat testId="stat-completed" label="Completed" value={summary ? summary.completed : "—"} tone="ok" />
        <Stat testId="stat-overdue" label="Overdue" value={summary ? summary.overdue : "—"} tone={summary?.overdue ? "bad" : ""} sub={summary ? `${summary.dueToday} due today` : ""} />
      </div>

      {noTeam && !loading && (
        <div className="hr-note" role="note" style={{ marginTop: 16 }} data-testid="no-team">
          No team members are assigned to you yet. Ask your administrator to add Executives to your team, then you can assign tasks here.
        </div>
      )}

      <div className="hr-tabs" role="tablist" style={{ marginTop: 20 }}>
        {VIEWS.map((v) => (
          <button key={v.id} type="button" role="tab" className="hr-tab" aria-selected={view === v.id} onClick={() => setView(v.id)}>{v.label}</button>
        ))}
      </div>

      <div className="hr-toolbar">
        <input type="search" placeholder="Search by task or team member" aria-label="Search tasks" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter by member" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">All members</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select aria-label="Filter by priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      <div className="hr-card">
        <StateBlock loading={loading && data.tasks.length === 0} error="" empty={!loading && data.tasks.length === 0} emptyText={view === "all" && !q && !priority && !assigneeId ? "No tasks yet. Create the first one with “New task”." : "No tasks match these filters."}>
          <div className="hr-table-wrap mgr-table-desktop">
            <table className="hr-table">
              <thead>
                <tr><th>Task</th><th>Assignee</th><th>Priority</th><th>Due</th><th>Status</th><th>Progress</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {data.tasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="mgr-task-title">{t.title}</div>
                      {t.description ? <div className="mgr-task-desc" title={t.description}>{t.description}</div> : null}
                    </td>
                    <td>{t.assigneeName}</td>
                    <td><span className={`mgr-pill ${t.priority}`}>{labelOf(PRIORITIES, t.priority)}</span></td>
                    <td>{fmtDate(t.dueDate)}</td>
                    <td><Pills t={t} /></td>
                    <td><Progress value={t.progress} /></td>
                    <td><Actions t={t} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mgr-cards" aria-label="Tasks">
            {data.tasks.map((t) => (
              <article key={t.id} className="mgr-card-task">
                <header>
                  <div>
                    <div className="mgr-task-title">{t.title}</div>
                    <div className="mgr-task-desc">{t.assigneeName} · due {fmtDate(t.dueDate)}</div>
                  </div>
                  <span className={`mgr-pill ${t.priority}`}>{labelOf(PRIORITIES, t.priority)}</span>
                </header>
                <div className="mgr-meta"><Pills t={t} /></div>
                <Progress value={t.progress} />
                <Actions t={t} />
              </article>
            ))}
          </div>
          <Pager page={page} limit={LIMIT} total={data.total} onPage={setPage} />
        </StateBlock>
      </div>

      {form && <TaskForm task={form.task} members={members} onClose={() => setForm(null)} onSaved={saved} />}
      {removing && (
        <ConfirmModal title="Delete task" message={`Delete “${removing.title}”? This cannot be undone.`} confirmLabel="Delete" danger busy={busy} onConfirm={confirmRemove} onCancel={() => setRemoving(null)} />
      )}
    </div>
  );
};

export default TaskManagement;
