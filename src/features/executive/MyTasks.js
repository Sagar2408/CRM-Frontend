import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pager, Stat, StateBlock, fmtDate } from "../hr/hrUi";
import { PRIORITIES, STATUSES, labelOf, managerError, myTaskApi } from "../../services/managerTaskService";
import "../../styles/hr.css";
import "../../styles/managerPanel.css";

const VIEWS = [
  { id: "all", label: "All", params: {} },
  { id: "todo", label: "To do", params: { status: "todo" } },
  { id: "in_progress", label: "In progress", params: { status: "in_progress" } },
  { id: "overdue", label: "Overdue", params: { overdue: true } },
  { id: "completed", label: "Completed", params: { status: "completed" } },
];
const LIMIT = 10;

/** Executive panel -> My Tasks. Tasks a Manager assigned to the signed-in Executive. */
const MyTasks = () => {
  const [view, setView] = useState("all");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ tasks: [], total: 0 });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingId, setSavingId] = useState(null);

  const params = useMemo(() => ({ ...VIEWS.find((v) => v.id === view).params, priority, page, limit: LIMIT }), [view, priority, page]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([myTaskApi.list(params), myTaskApi.summary()]);
      setData(list);
      setSummary(sum);
      setError("");
    } catch (e) {
      setError(managerError(e, "Could not load your tasks."));
    } finally {
      setLoading(false);
    }
  }, [params]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => setPage(1), [view, priority]);

  const update = async (task, body, msg) => {
    setSavingId(task.id);
    try {
      await myTaskApi.update(task.id, body);
      setNotice(msg);
      await load();
    } catch (e) {
      setError(managerError(e, "Could not update the task."));
    } finally {
      setSavingId(null);
    }
  };

  const Controls = ({ t }) => (
    <div className="mgr-actions">
      {t.status === "todo" && (
        <button type="button" className="hr-btn sm" disabled={savingId === t.id} onClick={() => update(t, { status: "in_progress", progress: 10 }, `Started “${t.title}”.`)}>Start</button>
      )}
      {t.status === "in_progress" && (
        <>
          <select aria-label={`Progress for ${t.title}`} value={t.progress} disabled={savingId === t.id} onChange={(e) => update(t, { progress: Number(e.target.value) }, `Progress updated for “${t.title}”.`)}>
            {[...new Set([t.progress, 10, 25, 50, 75, 90])].sort((a, b) => a - b).filter((v) => v < 100).map((v) => <option key={v} value={v}>{v}%</option>)}
          </select>
          <button type="button" className="hr-btn ok sm" disabled={savingId === t.id} onClick={() => update(t, { status: "completed" }, `Completed “${t.title}”.`)}>Complete</button>
        </>
      )}
      {t.status === "completed" && (
        <button type="button" className="hr-link" disabled={savingId === t.id} onClick={() => update(t, { status: "in_progress", progress: 90 }, `Reopened “${t.title}”.`)}>Reopen</button>
      )}
    </div>
  );
  const Meta = ({ t }) => (
    <>
      <span className={`mgr-pill ${t.status}`}>{labelOf(STATUSES, t.status)}</span>
      {t.overdue && <span className="mgr-pill overdue">Overdue</span>}
    </>
  );
  const Bar = ({ v }) => (
    <div className="mgr-progress" aria-label={`Progress ${v}%`}><div className="hr-bar"><span style={{ width: `${v}%` }} /></div><span>{v}%</span></div>
  );

  return (
    <div className="hr-page">
      <div className="hr-head">
        <div>
          <h1>My Tasks</h1>
          <p>Work your manager has assigned to you. Update your progress as you go.</p>
        </div>
        <button type="button" className="hr-btn ghost" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>

      {notice && <div className="hr-ok" role="status" onClick={() => setNotice("")}>{notice}</div>}
      {error && <div className="hr-error" role="alert">{error} <button type="button" className="hr-link" onClick={load}>Retry</button></div>}

      <div className="hr-grid cols-4">
        <Stat testId="stat-open" label="Open" value={summary ? summary.todo + summary.inProgress : "—"} sub={summary ? `${summary.dueToday} due today` : ""} />
        <Stat testId="stat-progress" label="In progress" value={summary ? summary.inProgress : "—"} />
        <Stat testId="stat-overdue" label="Overdue" value={summary ? summary.overdue : "—"} tone={summary?.overdue ? "bad" : ""} />
        <Stat testId="stat-completed" label="Completed" value={summary ? summary.completed : "—"} tone="ok" sub={summary ? `${summary.completionRate}% of all` : ""} />
      </div>

      <div className="hr-tabs" role="tablist" style={{ marginTop: 20 }}>
        {VIEWS.map((v) => <button key={v.id} type="button" role="tab" className="hr-tab" aria-selected={view === v.id} onClick={() => setView(v.id)}>{v.label}</button>)}
      </div>
      <div className="hr-toolbar">
        <select aria-label="Filter by priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      <div className="hr-card">
        <StateBlock loading={loading && data.tasks.length === 0} error="" empty={!loading && data.tasks.length === 0} emptyText={view === "all" && !priority ? "You have no tasks assigned yet." : "No tasks match this view."}>
          <div className="hr-table-wrap mgr-table-desktop">
            <table className="hr-table">
              <thead><tr><th>Task</th><th>Assigned by</th><th>Priority</th><th>Due</th><th>Status</th><th>Progress</th><th>Update</th></tr></thead>
              <tbody>
                {data.tasks.map((t) => (
                  <tr key={t.id}>
                    <td><div className="mgr-task-title">{t.title}</div>{t.description ? <div className="mgr-task-desc" title={t.description}>{t.description}</div> : null}</td>
                    <td>{t.assignedBy}</td>
                    <td><span className={`mgr-pill ${t.priority}`}>{labelOf(PRIORITIES, t.priority)}</span></td>
                    <td>{fmtDate(t.dueDate)}</td>
                    <td><Meta t={t} /></td>
                    <td><Bar v={t.progress} /></td>
                    <td><Controls t={t} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mgr-cards" aria-label="Tasks">
            {data.tasks.map((t) => (
              <article key={t.id} className="mgr-card-task">
                <header>
                  <div><div className="mgr-task-title">{t.title}</div><div className="mgr-task-desc">{t.assignedBy} · due {fmtDate(t.dueDate)}</div></div>
                  <span className={`mgr-pill ${t.priority}`}>{labelOf(PRIORITIES, t.priority)}</span>
                </header>
                {t.description ? <div className="mgr-task-desc" style={{ whiteSpace: "normal" }}>{t.description}</div> : null}
                <div className="mgr-meta"><Meta t={t} /></div>
                <Bar v={t.progress} />
                <Controls t={t} />
              </article>
            ))}
          </div>
          <Pager page={page} limit={LIMIT} total={data.total} onPage={setPage} />
        </StateBlock>
      </div>
    </div>
  );
};

export default MyTasks;
