import React, { useCallback, useEffect, useState } from "react";
import { teamApi, teamErrorMessage } from "../../services/teamManagementApi";
import { ConfirmDialog, EmployeePicker, Modal } from "./TeamParts";
import { STAT_TILES, STATUS_LABEL, barWidth, duration, pct } from "./teamUtils";

const Tile = ({ label, value, testId }) => (
  <div className="tm-tile" data-testid={testId}>
    <strong>{value}</strong>
    <span>{label}</span>
  </div>
);

/** Detailed team dashboard (right-hand drawer). */
const TeamDrawer = ({ teamId, range, onClose, onEdit, onChanged }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null); // {type:'archive'|'remove', member?}
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [picked, setPicked] = useState([]);

  const load = useCallback(async () => {
    try {
      setData(await teamApi.detail(teamId, range));
      setError("");
    } catch (e) {
      setError(teamErrorMessage(e, "Could not load this team."));
    }
  }, [teamId, range]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setConfirm(null);
      await load();
      onChanged();
    } catch (e) {
      setError(teamErrorMessage(e));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const openAdd = async () => {
    setAdding(true);
    setPicked([]);
    try {
      setEmployees((await teamApi.employees()).employees);
    } catch (e) {
      setError(teamErrorMessage(e));
    }
  };

  const t = data?.team;
  const archived = t?.status === "archived";
  const current = (data?.members || []).filter((m) => m.current);
  const former = (data?.members || []).filter((m) => !m.current);

  return (
    <div className="tm-drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="tm-drawer" role="dialog" aria-label="Team details">
        <div className="tm-drawer-head">
          <div>
            <h2>{t ? t.name : "Team"}</h2>
            {t && (
              <div className="tm-muted">
                <span className={`tm-pill ${t.status}`}>{STATUS_LABEL[t.status]}</span> {duration(t)}
              </div>
            )}
          </div>
          <button type="button" className="tm-x" onClick={onClose} aria-label="Close details">
            ×
          </button>
        </div>

        {error && (
          <div className="tm-error" role="alert">
            {error}
          </div>
        )}
        {!data && !error && <p className="tm-muted">Loading…</p>}

        {t && (
          <>
            {t.description && <p>{t.description}</p>}
            <div className="tm-goal-box">
              <div className="tm-goal-line">
                <span>
                  <strong>{t.goal.metricLabel}</strong> · {t.goal.achieved} of {t.goal.target}
                </span>
                <strong data-testid="goal-percent">{pct(t.goal.percent)}</strong>
              </div>
              <div className="tm-progress" aria-label="Goal achievement">
                <span style={{ width: barWidth(t.goal.percent) }} />
              </div>
            </div>
            <div className="tm-tiles">
              {STAT_TILES.map((s) => (
                <Tile key={s.key} testId={`stat-${s.key}`} label={s.label} value={t.stats[s.key]} />
              ))}
              <Tile testId="stat-conversion" label="Conversion rate" value={t.conversionRate === null ? "—" : pct(t.conversionRate)} />
            </div>

            <div className="tm-section-head">
              <h3>Members ({t.memberCount})</h3>
              {!archived && (
                <button type="button" className="tm-btn small" onClick={openAdd}>
                  Add members
                </button>
              )}
            </div>
            <div className="tm-table-wrap">
              <table className="tm-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Assigned</th>
                    <th>Follow-ups</th>
                    <th>Converted</th>
                    <th>Closed</th>
                    <th>Meetings</th>
                    <th>Contribution</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...current, ...former].map((m) => (
                    <tr key={m.key} className={m.current ? "" : "former"}>
                      <td>
                        {m.name}
                        {!m.current && <span className="tm-note">Former member</span>}
                        {m.current && m.active === false && <span className="tm-note">Deactivated</span>}
                      </td>
                      <td>{m.role}</td>
                      {m.tracked ? (
                        <>
                          <td>{m.metrics.assigned}</td>
                          <td>{m.metrics.followUps}</td>
                          <td>{m.metrics.converted}</td>
                          <td>{m.metrics.closed}</td>
                          <td>{m.metrics.meetings}</td>
                        </>
                      ) : (
                        <td colSpan={5} className="tm-muted" title="Lead activity is not tracked for this role">
                          No lead activity tracked for this role
                        </td>
                      )}
                      <td>
                        {m.tracked ? (
                          <div className="tm-mini-bar" title={pct(m.contributionPct)}>
                            <span style={{ width: barWidth(m.contributionPct) }} />
                            <em>{pct(m.contributionPct)}</em>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {m.current && !archived && (
                          <button type="button" className="tm-link danger" aria-label={`Remove ${m.name}`} onClick={() => setConfirm({ type: "remove", member: m })}>
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.members.length === 0 && (
                    <tr>
                      <td colSpan={9}>No members yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="tm-actions spread">
              {archived ? (
                <button type="button" className="tm-btn" disabled={busy} onClick={() => run(() => teamApi.restore(t.id))}>
                  Restore team
                </button>
              ) : (
                <>
                  <button type="button" className="tm-btn" onClick={() => onEdit(t)}>
                    Edit team
                  </button>
                  <button type="button" className="tm-btn danger" onClick={() => setConfirm({ type: "archive" })}>
                    Archive team
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </aside>

      {confirm?.type === "archive" && (
        <ConfirmDialog
          title="Archive team?"
          message={`"${t.name}" will be archived and its members released so they can join other teams. Performance history is kept. You can restore the team later.`}
          confirmLabel="Archive team"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => run(() => teamApi.archive(t.id))}
        />
      )}
      {confirm?.type === "remove" && (
        <ConfirmDialog
          title="Remove member?"
          message={`${confirm.member.name} will be removed from "${t.name}". Their past contribution stays in the team's history.`}
          confirmLabel="Remove member"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => run(() => teamApi.removeMember(t.id, confirm.member.key))}
        />
      )}
      {adding && (
        <Modal title="Add members" onClose={() => setAdding(false)}>
          <EmployeePicker employees={employees} selected={picked} excludeKeys={current.map((m) => m.key)} onToggle={(k) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))} />
          <div className="tm-actions">
            <button type="button" className="tm-btn" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="tm-btn primary"
              disabled={!picked.length || busy}
              onClick={() =>
                run(async () => {
                  await teamApi.addMembers(t.id, picked);
                  setAdding(false);
                })
              }
            >
              Add {picked.length || ""} member{picked.length === 1 ? "" : "s"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default TeamDrawer;
