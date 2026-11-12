import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ThemeContext } from "../admin/ThemeContext";
import SidebarToggle from "../admin/SidebarToggle";
import { teamApi, teamErrorMessage } from "../../services/teamManagementApi";
import { TeamFormModal } from "./TeamParts";
import TeamDrawer from "./TeamDrawer";
import TeamComparison from "./TeamComparison";
import { STATUS_LABEL, barWidth, duration, pct } from "./teamUtils";
import "../../styles/teamManagement.css";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "archived", label: "Archived" },
];

const Card = ({ label, value, sub, testId }) => (
  <div className="tm-card" data-testid={testId}>
    <span className="tm-card-label">{label}</span>
    <strong className="tm-card-value">{value}</strong>
    {sub && <span className="tm-card-sub">{sub}</span>}
  </div>
);

/** Admin → Team Management (replaces Executive Details for Admin). */
const TeamManagement = () => {
  const { theme } = useContext(ThemeContext) || {};
  const isSidebarExpanded = localStorage.getItem("adminSidebarExpanded") === "true";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [form, setForm] = useState(null); // {team?}
  const [employees, setEmployees] = useState([]);
  const [openId, setOpenId] = useState(null);

  const range = useMemo(() => ({ startDate, endDate }), [startDate, endDate]);
  const rangeInvalid = startDate && endDate && startDate > endDate;

  const load = useCallback(async () => {
    if (rangeInvalid) return;
    setLoading(true);
    try {
      setData(await teamApi.overview(range));
      setError("");
    } catch (e) {
      setError(teamErrorMessage(e, "Could not load teams."));
    } finally {
      setLoading(false);
    }
  }, [range, rangeInvalid]);
  useEffect(() => {
    load();
  }, [load]);

  const openCreate = async () => {
    try {
      setEmployees((await teamApi.employees()).employees);
      setForm({});
    } catch (e) {
      setError(teamErrorMessage(e, "Could not load employees."));
    }
  };

  const teams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.teams || [])
      .filter((t) => (filter === "archived" ? t.status === "archived" : filter === "active" ? t.status === "active" : true))
      .filter((t) => !q || `${t.name} ${t.goal?.metricLabel || ""} ${t.description || ""}`.toLowerCase().includes(q));
  }, [data, search, filter]);

  const cards = data?.cards;

  return (
    <div className={`assign-task-container ${isSidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"}`} data-theme={theme}>
      <SidebarToggle />
      <div className="assign-task-content" style={{ width: "100%", alignItems: "flex-start" }}>
        <div className="tm-page">
          <div className="tm-header">
            <div>
              <h1>Team Management</h1>
              <p className="tm-muted">Create cross-role teams, set goals and track real performance from CRM records.</p>
            </div>
            <button type="button" className="tm-btn primary" onClick={openCreate}>
              Create Team
            </button>
          </div>

          {error && (
            <div className="tm-error" role="alert">
              {error} <button type="button" className="tm-link" onClick={load}>Retry</button>
            </div>
          )}

          <div className="tm-cards">
            <Card testId="card-total" label="Total Teams" value={cards ? cards.totalTeams : "—"} sub={cards ? `${cards.archivedTeams} archived` : ""} />
            <Card testId="card-active" label="Active Teams" value={cards ? cards.activeTeams : "—"} />
            <Card testId="card-members" label="Total Team Members" value={cards ? cards.totalMembers : "—"} />
            <Card testId="card-achievement" label="Overall Goal Achievement" value={cards ? (cards.overallAchievement === null ? "—" : pct(cards.overallAchievement)) : "—"} sub="avg. of active teams (each capped at 100%)" />
            <Card testId="card-best" label="Best Performing Team" value={cards ? (cards.bestTeam ? cards.bestTeam.name : "—") : "—"} sub={cards?.bestTeam ? pct(cards.bestTeam.percent) : "no activity yet"} />
          </div>

          <div className="tm-toolbar">
            <input className="tm-input" type="search" placeholder="Search teams" aria-label="Search teams" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="tm-tabs" role="tablist">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={`tm-tab ${filter === f.id ? "active" : ""}`} onClick={() => setFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="tm-dates">
              <label>
                From <input className="tm-input" type="date" aria-label="From date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label>
                To <input className="tm-input" type="date" aria-label="To date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
              {(startDate || endDate) && (
                <button type="button" className="tm-link" onClick={() => { setStartDate(""); setEndDate(""); }}>
                  Clear
                </button>
              )}
            </div>
          </div>
          {rangeInvalid && <div className="tm-error" role="alert">The “From” date must not be after the “To” date.</div>}
          {(startDate || endDate) && !rangeInvalid && <p className="tm-muted">Progress is shown for the selected period only.</p>}

          {loading && !data && (
            <div className="tm-grid" aria-busy="true" aria-label="Loading teams">
              {[0, 1, 2].map((i) => (
                <div key={i} className="tm-skeleton" />
              ))}
            </div>
          )}
          {data && teams.length === 0 && (
            <div className="tm-empty">
              <h3>{data.teams.length === 0 ? "No teams yet" : "No teams match your filters"}</h3>
              <p>{data.teams.length === 0 ? "Create your first team to start tracking goals." : "Try a different search or status filter."}</p>
            </div>
          )}
          <div className="tm-grid">
            {teams.map((t) => (
              <button key={t.id} type="button" className="tm-team-card" onClick={() => setOpenId(t.id)} aria-label={`Open ${t.name}`}>
                <div className="tm-team-top">
                  <strong>{t.name}</strong>
                  <span className={`tm-pill ${t.status}`}>{STATUS_LABEL[t.status]}</span>
                </div>
                <div className="tm-muted">{t.goal.metricLabel} · target {t.goal.target}</div>
                {t.goal && t.description && <div className="tm-desc">{t.description}</div>}
                <div className="tm-goal-line">
                  <span>
                    {t.goal.achieved} / {t.goal.target}
                  </span>
                  <strong>{pct(t.goal.percent)}</strong>
                </div>
                <div className="tm-progress" aria-label={`${t.name} progress`}>
                  <span style={{ width: barWidth(t.goal.percent) }} />
                </div>
                <div className="tm-team-foot">
                  <span>{t.memberCount} member{t.memberCount === 1 ? "" : "s"}</span>
                  <span>{duration(t)}</span>
                </div>
              </button>
            ))}
          </div>

          <TeamComparison teams={data?.teams || []} range={range} />
        </div>
      </div>

      {form && (
        <TeamFormModal
          team={form.team}
          employees={employees}
          onClose={() => setForm(null)}
          onSaved={(team) => {
            const editing = !!form.team;
            setForm(null);
            load();
            if (!editing) setOpenId(team.id);
          }}
        />
      )}
      {openId && (
        <TeamDrawer
          teamId={openId}
          range={range}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onEdit={(team) => setForm({ team })}
        />
      )}
    </div>
  );
};

export default TeamManagement;
