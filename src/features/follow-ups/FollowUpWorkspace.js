import React, { useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useApi } from "../../context/ApiContext";
import { SearchContext } from "../../context/SearchContext";
import "../../styles/followUpWorkspace.css";

export const STATUS_LABELS = {
  interested: "Interested",
  appointment: "Appointment",
  "no response": "No response",
  converted: "Converted",
  "not interested": "Not interested",
  close: "Closed",
};

const TABS = [
  { key: "all", label: "All" },
  { key: "interested", label: "Interested" },
  { key: "not interested", label: "Not interested" },
];

const RATINGS = ["Hot", "Warm", "Cold"];

const titleCase = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : "");

// follow_up_date is a date-only string, follow_up_time "HH:MM:SS" - combine them
// as local time without a timezone round trip.
export const toDateTime = (date, time) => {
  if (!date) return null;
  const [y, m, d] = String(date).slice(0, 10).split("-").map(Number);
  const [hh = 0, mm = 0] = String(time || "00:00").split(":").map(Number);
  const out = new Date(y, (m || 1) - 1, d || 1, hh, mm, 0, 0);
  return Number.isNaN(+out) ? null : out;
};

export const relativeDay = (dt, now = new Date()) => {
  if (!dt) return "";
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(dt) - startOf(now)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return diff > 0 ? `In ${diff} days` : `${Math.abs(diff)} days ago`;
};

const formatWhen = (dt) =>
  dt
    ? `${dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}, ${dt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "Not set";

const leadIdOf = (row) => row.freshLead?.id || row.fresh_lead_id;

const FollowUpWorkspace = () => {
  const { followUps, getAllFollowUps, fetchFollowUpHistoriesAPI, followUpLoading } = useApi();
  const { searchQuery, setActivePage } = useContext(SearchContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [tab, setTab] = useState(location.state?.activeTab === "Interested" ? "interested" : "all");
  const [rating, setRating] = useState("All");
  const [sort, setSort] = useState("reminder");
  const [selectedId, setSelectedId] = useState(null);
  const [histories, setHistories] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");

  const rows = useMemo(() => (Array.isArray(followUps?.data) ? followUps.data : []), [followUps]);

  const load = useCallback(async () => {
    setError("");
    setHistoryLoading(true);
    try {
      await getAllFollowUps();
      const all = await fetchFollowUpHistoriesAPI();
      setHistories(Array.isArray(all) ? all : []);
    } catch (err) {
      setError("Could not load follow-ups. Please try again.");
    } finally {
      setHistoryLoading(false);
    }
  }, [getAllFollowUps, fetchFollowUpHistoriesAPI]);

  useEffect(() => {
    setActivePage?.("follow-up");
    load();
  }, [load, setActivePage]);

  const historyByLead = useMemo(() => {
    const map = new Map();
    histories.forEach((h) => {
      const key = String(h.fresh_lead_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(h);
    });
    map.forEach((list) => list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    return map;
  }, [histories]);

  const visible = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    const list = rows.filter((row) => {
      if ((row.clientLeadStatus || "").toLowerCase() !== "follow-up") return false;
      const type = (row.follow_up_type || "").toLowerCase();
      if (tab !== "all" && type !== tab) return false;
      if (rating !== "All" && (row.interaction_rating || "").toLowerCase() !== rating.toLowerCase()) return false;
      if (q) {
        const hay = `${row.freshLead?.name || ""} ${row.freshLead?.phone || ""} ${row.freshLead?.email || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const when = (r) => toDateTime(r.follow_up_date, r.follow_up_time)?.getTime() ?? Infinity;
    return [...list].sort((a, b) =>
      sort === "reminder" ? when(a) - when(b) : new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    );
  }, [rows, tab, rating, searchQuery, sort]);

  const counts = useMemo(() => {
    const base = rows.filter((r) => (r.clientLeadStatus || "").toLowerCase() === "follow-up");
    return {
      all: base.length,
      interested: base.filter((r) => (r.follow_up_type || "").toLowerCase() === "interested").length,
      "not interested": base.filter((r) => (r.follow_up_type || "").toLowerCase() === "not interested").length,
    };
  }, [rows]);

  const selected = useMemo(() => {
    if (!visible.length) return null;
    return visible.find((r) => leadIdOf(r) === selectedId) || visible[0];
  }, [visible, selectedId]);

  const openEditor = (row) => {
    const freshLeadId = leadIdOf(row);
    if (!freshLeadId) return;
    navigate(`/executive/clients/${encodeURIComponent(row.id)}/details`, {
      state: {
        client: { ...row, ...(row.freshLead || {}), fresh_lead_id: freshLeadId, followUpId: row.id },
        createFollowUp: false,
        from: "followup",
      },
    });
  };

  const loading = followUpLoading || historyLoading;
  const now = new Date();

  const renderReminder = (row) => {
    const dt = toDateTime(row.follow_up_date, row.follow_up_time);
    if (!dt) return <span className="fuw-reminder">No reminder</span>;
    const past = +dt < +now;
    return (
      <span className={`fuw-reminder ${past ? "is-past" : ""}`} title={formatWhen(dt)}>
        {relativeDay(dt, now)} &middot; {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  };

  return (
    <div className="fuw">
      <header className="fuw__header">
        <div>
          <h2>Follow-ups</h2>
          <p>Leads you are actively working. Pick one to see the full picture and update it.</p>
        </div>
        <button type="button" className="fuw__ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <div className="fuw__toolbar">
        <div className="fuw__tabs" role="tablist" aria-label="Follow-up status">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`fuw__tab ${tab === t.key ? "is-active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label} <span className="fuw__count">{counts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="fuw__filters">
          <label>
            Rating
            <select value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="All">All</option>
              {RATINGS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="reminder">Next reminder</option>
              <option value="updated">Recently updated</option>
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div className="fuw__error" role="alert">
          {error} <button onClick={load}>Retry</button>
        </div>
      )}

      <div className="fuw__layout">
        <ul className="fuw__list" aria-label="Follow-up leads">
          {loading && visible.length === 0 && [0, 1, 2, 3].map((i) => <li key={i} className="fuw__skeleton" aria-hidden="true" />)}
          {!loading && visible.length === 0 && !error && (
            <li className="fuw__empty">
              <strong>No follow-ups found</strong>
              <span>Try a different filter or clear the search box.</span>
            </li>
          )}
          {visible.map((row) => {
            const id = leadIdOf(row);
            const active = selected && leadIdOf(selected) === id;
            const ratingKey = (row.interaction_rating || "").toLowerCase();
            return (
              <li key={row.id}>
                <button type="button" className={`fuw__item ${active ? "is-active" : ""}`} onClick={() => setSelectedId(id)}>
                  <span className="fuw__avatar" aria-hidden="true">
                    {(row.freshLead?.name || "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="fuw__item-main">
                    <span className="fuw__name">{row.freshLead?.name || "Unnamed lead"}</span>
                    <span className="fuw__sub">{row.freshLead?.phone || row.freshLead?.email || "No contact"}</span>
                    <span className="fuw__chips">
                      <span className={`fuw__chip fuw__chip--status`}>{STATUS_LABELS[row.follow_up_type] || titleCase(row.follow_up_type)}</span>
                      {ratingKey && <span className={`fuw__chip fuw__chip--${ratingKey}`}>{titleCase(ratingKey)}</span>}
                    </span>
                  </span>
                  <span className="fuw__item-side">{renderReminder(row)}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <section className="fuw__detail" aria-live="polite">
          {!selected ? (
            <div className="fuw__placeholder">Select a lead to see its details and history.</div>
          ) : (
            <>
              <div className="fuw__detail-head">
                <span className="fuw__avatar fuw__avatar--lg" aria-hidden="true">
                  {(selected.freshLead?.name || "?").charAt(0).toUpperCase()}
                </span>
                <div>
                  <h3>{selected.freshLead?.name || "Unnamed lead"}</h3>
                  <p>{[selected.country, selected.state].filter(Boolean).join(", ") || "Location not recorded"}</p>
                </div>
                <div className="fuw__actions">
                  {selected.freshLead?.phone && (
                    <>
                      <a className="fuw__btn" href={`tel:${String(selected.freshLead.phone).replace(/[^\d+]/g, "")}`}>
                        Call
                      </a>
                      <a
                        className="fuw__btn"
                        href={`https://wa.me/${String(selected.freshLead.phone).replace(/[^\d]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        WhatsApp
                      </a>
                    </>
                  )}
                  <button type="button" className="fuw__btn fuw__btn--primary" onClick={() => openEditor(selected)}>
                    Update follow-up
                  </button>
                </div>
              </div>

              <div className="fuw__grid">
                <div className="fuw__card">
                  <h4>Current follow-up</h4>
                  <dl>
                    <div>
                      <dt>Interaction type</dt>
                      <dd>{selected.connect_via || "-"}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{STATUS_LABELS[selected.follow_up_type] || titleCase(selected.follow_up_type) || "-"}</dd>
                    </div>
                    <div>
                      <dt>Rating</dt>
                      <dd>{titleCase(selected.interaction_rating) || "-"}</dd>
                    </div>
                    <div>
                      <dt>Next reminder</dt>
                      <dd>{formatWhen(toDateTime(selected.follow_up_date, selected.follow_up_time))}</dd>
                    </div>
                  </dl>
                  <div className="fuw__notes">
                    <span>Notes</span>
                    <p>{selected.reason_for_follow_up || "No notes recorded."}</p>
                  </div>
                </div>

                <div className="fuw__card">
                  <h4>Lead details</h4>
                  <dl>
                    <div>
                      <dt>Email</dt>
                      <dd>{selected.freshLead?.email || "-"}</dd>
                    </div>
                    <div>
                      <dt>Phone</dt>
                      <dd>{selected.freshLead?.phone || "-"}</dd>
                    </div>
                    <div>
                      <dt>Education</dt>
                      <dd>{selected.education || "-"}</dd>
                    </div>
                    <div>
                      <dt>Experience</dt>
                      <dd>{selected.experience || "-"}</dd>
                    </div>
                    <div>
                      <dt>Date of birth</dt>
                      <dd>{selected.dob || "-"}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="fuw__card fuw__card--history">
                <h4>
                  Follow-up history{" "}
                  <span className="fuw__count">{(historyByLead.get(String(leadIdOf(selected))) || []).length}</span>
                </h4>
                {historyLoading ? (
                  <p className="fuw__muted">Loading history...</p>
                ) : (historyByLead.get(String(leadIdOf(selected))) || []).length === 0 ? (
                  <p className="fuw__muted">No earlier interactions recorded for this lead.</p>
                ) : (
                  <ol className="fuw__timeline">
                    {(historyByLead.get(String(leadIdOf(selected))) || []).map((h, i) => {
                      const scheduled = toDateTime(h.follow_up_date, h.follow_up_time);
                      return (
                        <li key={h.id ?? i} className={i === 0 ? "is-latest" : ""}>
                          <div className="fuw__tl-top">
                            <strong>{STATUS_LABELS[h.follow_up_type] || titleCase(h.follow_up_type)}</strong>
                            {i === 0 && <span className="fuw__chip fuw__chip--latest">Latest</span>}
                            <span className="fuw__chip">{h.connect_via}</span>
                            {h.interaction_rating && (
                              <span className={`fuw__chip fuw__chip--${h.interaction_rating.toLowerCase()}`}>{h.interaction_rating}</span>
                            )}
                            <time className="fuw__tl-time" dateTime={h.createdAt}>
                              Logged {new Date(h.createdAt).toLocaleDateString()},{" "}
                              {new Date(h.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </time>
                          </div>
                          <p>{h.reason_for_follow_up || "No notes."}</p>
                          {scheduled && <span className="fuw__tl-reminder">Reminder: {formatWhen(scheduled)}</span>}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default FollowUpWorkspace;
