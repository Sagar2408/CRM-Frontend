import React, { useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SearchContext } from "../../context/SearchContext";
import { useProcessService } from "../../context/ProcessServiceContext";
import { getProcessFollowUpTimelineApi } from "../../services/processService";
import "../../styles/followUpWorkspace.css";
import "../../styles/processModern.css";

// Process Person follow-up categories (the stored follow_up_type values).
export const TABS = [
  { key: "all", label: "All Follow-ups", match: null },
  { key: "document", label: "Document Collection", match: "document collection" },
  { key: "payment", label: "Payment Follow-up", match: "payment follow-up" },
  { key: "visa", label: "Visa Filing", match: "visa filing" },
];

export const TYPE_LABELS = {
  "document collection": "Document collection",
  "payment follow-up": "Payment follow-up",
  "visa filing": "Visa filing",
  other: "Other",
  rejected: "Rejected",
  final: "Final",
  meeting: "Meeting",
};

// Stored ratings are "Agressive" | "Calm" | "Neutral" (spelling is part of the data).
export const RATINGS = [
  { value: "agressive", label: "Aggressive" },
  { value: "calm", label: "Calm" },
  { value: "neutral", label: "Neutral" },
];
const ratingLabel = (v) => RATINGS.find((r) => r.value === String(v || "").toLowerCase())?.label || v || "";

const titleCase = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : "");
const typeLabel = (t) => TYPE_LABELS[String(t || "").toLowerCase()] || titleCase(t) || "-";

// follow_up_date is a date-only string, follow_up_time "HH:MM:SS": combine as local time.
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
    ? `${dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}, ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "Not set";

const latestOf = (c) => (Array.isArray(c.processfollowuphistories) ? c.processfollowuphistories[0] : null);
const digits = (p) => String(p || "").replace(/[^\d]/g, "");

// Process Person Follow-ups: the assigned clients that already have a follow-up
// (customer status "under_review"), searchable list on the left, selected client's
// current follow-up and timeline on the right. The API scopes every list to
// Customer.process_person_id, so only the signed-in person's clients are ever shown.
// "Update follow-up" opens the existing editor; nothing here writes data itself.
const ProcessFollowUpWorkspace = ({ loadTimeline = getProcessFollowUpTimelineApi }) => {
  const { fetchCustomers, customers } = useProcessService();
  const { searchQuery, setActivePage } = useContext(SearchContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [tab, setTab] = useState(() => TABS.find((t) => t.label === location.state?.activeTab)?.key || "all");
  const [rating, setRating] = useState("all");
  const [sort, setSort] = useState("reminder");
  const [localQuery, setLocalQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeline, setTimeline] = useState({ loading: false, error: "", rows: [], forId: null });

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      await fetchCustomers();
    } catch (err) {
      setError("Could not load follow-ups. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [fetchCustomers]);

  useEffect(() => {
    setActivePage?.("follow-up");
    load();
  }, [load, setActivePage]);

  const base = useMemo(() => (Array.isArray(customers) ? customers : []).filter((c) => c.status === "under_review"), [customers]);

  const visible = useMemo(() => {
    const q = `${localQuery} ${searchQuery || ""}`.trim().toLowerCase();
    const wanted = TABS.find((t) => t.key === tab)?.match;
    const list = base.filter((c) => {
      const latest = latestOf(c);
      if (wanted && String(latest?.follow_up_type || "").toLowerCase().trim() !== wanted) return false;
      if (rating !== "all" && String(latest?.interaction_rating || "").toLowerCase() !== rating) return false;
      if (q) {
        const hay = `${c.fullName || ""} ${c.phone || ""} ${c.email || ""} ${c.freshLead?.name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const when = (c) => {
      const l = latestOf(c);
      return toDateTime(l?.follow_up_date, l?.follow_up_time)?.getTime() ?? Infinity;
    };
    const updated = (c) => new Date(latestOf(c)?.createdAt || c.updatedAt || 0).getTime();
    return [...list].sort((a, b) => (sort === "reminder" ? when(a) - when(b) : sort === "name" ? String(a.fullName).localeCompare(String(b.fullName)) : updated(b) - updated(a)));
  }, [base, tab, rating, localQuery, searchQuery, sort]);

  const counts = useMemo(() => {
    const out = { all: base.length };
    TABS.forEach((t) => {
      if (t.match) out[t.key] = base.filter((c) => String(latestOf(c)?.follow_up_type || "").toLowerCase().trim() === t.match).length;
    });
    return out;
  }, [base]);

  const selected = useMemo(() => (visible.length ? visible.find((c) => c.id === selectedId) || visible[0] : null), [visible, selectedId]);
  const selectedLead = selected?.fresh_lead_id || selected?.freshLead?.id || null;
  const selectedKey = selected?.id ?? null;

  // History of the selected client (only this Process Person's own follow-ups).
  useEffect(() => {
    if (!selectedKey || !selectedLead) {
      setTimeline({ loading: false, error: "", rows: [], forId: selectedKey });
      return undefined;
    }
    let alive = true;
    setTimeline({ loading: true, error: "", rows: [], forId: selectedKey });
    Promise.resolve(loadTimeline(selectedLead))
      .then((rows) => alive && setTimeline({ loading: false, error: "", rows: Array.isArray(rows) ? rows : [], forId: selectedKey }))
      .catch((err) => alive && setTimeline({ loading: false, error: err?.message || "Could not load history.", rows: [], forId: selectedKey }));
    return () => {
      alive = false;
    };
  }, [selectedKey, selectedLead, loadTimeline]);

  const openEditor = (client) => {
    const freshLeadId = client.fresh_lead_id || client.freshLead?.id;
    if (!freshLeadId) return;
    navigate(`/process/clients/details/${encodeURIComponent(freshLeadId)}/${freshLeadId}`, {
      state: { client: { ...client.freshLead, fresh_lead_id: freshLeadId, id: client.id }, createFollowUp: false, from: "followup" },
    });
  };

  const now = new Date();
  const renderReminder = (c) => {
    const l = latestOf(c);
    const dt = toDateTime(l?.follow_up_date, l?.follow_up_time);
    if (!dt) return <span className="fuw__reminder">No reminder</span>;
    const past = +dt < +now;
    return (
      <span className={`fuw__reminder ${past ? "is-past" : ""}`} title={formatWhen(dt)}>
        {relativeDay(dt, now)} &middot; {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  };

  const latest = selected ? latestOf(selected) : null;
  const clientLead = selected?.freshLead?.lead?.clientLead || {};
  const rows = timeline.rows;

  return (
    <div className="fuw">
      <header className="fuw__header">
        <div>
          <h2>Follow-ups</h2>
          <p>Clients you are actively working. Pick one to see the full picture and update it.</p>
        </div>
        <button type="button" className="fuw__ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <div className="fuw__toolbar">
        <div className="fuw__tabs" role="tablist" aria-label="Follow-up category">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`fuw__tab ${tab === t.key ? "is-active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label} <span className="fuw__count">{counts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="fuw__filters">
          <label>
            Search
            <input type="search" placeholder="Name, phone or email" aria-label="Search follow-ups" value={localQuery} onChange={(e) => setLocalQuery(e.target.value)} />
          </label>
          <label>
            Rating
            <select value={rating} onChange={(e) => setRating(e.target.value)}>
              <option value="all">All</option>
              {RATINGS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="reminder">Next follow-up</option>
              <option value="updated">Recently updated</option>
              <option value="name">Client name</option>
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div className="fuw__error" role="alert">
          {error} <button type="button" onClick={load}>Retry</button>
        </div>
      )}

      <div className="fuw__layout">
        <ul className="fuw__list" aria-label="Follow-up clients">
          {loading && visible.length === 0 && [0, 1, 2, 3].map((i) => <li key={i} className="fuw__skeleton" aria-hidden="true" />)}
          {!loading && visible.length === 0 && !error && (
            <li className="fuw__empty">
              <strong>No follow-ups found</strong>
              <span>{base.length === 0 ? "Clients move here after you add their first follow-up." : "Try a different filter or clear the search."}</span>
            </li>
          )}
          {visible.map((c) => {
            const l = latestOf(c);
            const active = selected && selected.id === c.id;
            const ratingKey = String(l?.interaction_rating || "").toLowerCase();
            return (
              <li key={c.id}>
                <button type="button" className={`fuw__item ${active ? "is-active" : ""}`} onClick={() => setSelectedId(c.id)}>
                  <span className="fuw__avatar" aria-hidden="true">{(c.fullName || "?").charAt(0).toUpperCase()}</span>
                  <span className="fuw__item-main">
                    <span className="fuw__name">{c.fullName || "Unnamed client"}</span>
                    <span className="fuw__sub">{c.phone || c.email || "No contact"}</span>
                    <span className="fuw__chips">
                      {l?.follow_up_type && <span className="fuw__chip fuw__chip--status">{typeLabel(l.follow_up_type)}</span>}
                      {ratingKey && <span className={`fuw__chip fuw__chip--${ratingKey}`}>{ratingLabel(l.interaction_rating)}</span>}
                    </span>
                  </span>
                  <span className="fuw__item-side">{renderReminder(c)}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <section className="fuw__detail" aria-live="polite">
          {!selected ? (
            <div className="fuw__placeholder">Select a client to see their follow-up details and history.</div>
          ) : (
            <>
              <div className="fuw__detail-head">
                <span className="fuw__avatar fuw__avatar--lg" aria-hidden="true">{(selected.fullName || "?").charAt(0).toUpperCase()}</span>
                <div>
                  <h3>{selected.fullName || "Unnamed client"}</h3>
                  <p>{[selected.country, clientLead.state].filter(Boolean).join(", ") || "Location not recorded"}</p>
                </div>
                <div className="fuw__actions">
                  {digits(selected.phone).length > 1 && (
                    <>
                      <a className="fuw__btn" href={`tel:${String(selected.phone).replace(/[^\d+]/g, "")}`}>Call</a>
                      <a className="fuw__btn" href={`https://wa.me/${digits(selected.phone)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                    </>
                  )}
                  <button type="button" className="fuw__btn fuw__btn--primary" onClick={() => openEditor(selected)}>Update follow-up</button>
                </div>
              </div>

              <div className="fuw__grid">
                <div className="fuw__card">
                  <h4>Current follow-up</h4>
                  <dl>
                    <div><dt>Interaction type</dt><dd>{latest?.connect_via || "-"}</dd></div>
                    <div><dt>Category</dt><dd>{typeLabel(latest?.follow_up_type)}</dd></div>
                    <div><dt>Rating</dt><dd>{ratingLabel(latest?.interaction_rating) || "-"}</dd></div>
                    <div><dt>Next follow-up</dt><dd>{formatWhen(toDateTime(latest?.follow_up_date, latest?.follow_up_time))}</dd></div>
                  </dl>
                  <div className="fuw__notes">
                    <span>Notes</span>
                    <p>{latest?.comments || "No notes recorded."}</p>
                  </div>
                </div>

                <div className="fuw__card">
                  <h4>Client details</h4>
                  <dl>
                    <div><dt>Email</dt><dd>{selected.email || "-"}</dd></div>
                    <div><dt>Phone</dt><dd>{selected.phone || "-"}</dd></div>
                    <div><dt>Education</dt><dd>{clientLead.education || "-"}</dd></div>
                    <div><dt>Experience</dt><dd>{clientLead.experience || "-"}</dd></div>
                    <div><dt>Date of birth</dt><dd>{clientLead.dob || "-"}</dd></div>
                  </dl>
                </div>
              </div>

              <div className="fuw__card fuw__card--history">
                <h4>
                  Follow-up history <span className="fuw__count">{rows.length}</span>
                </h4>
                {timeline.loading ? (
                  <p className="fuw__muted">Loading history...</p>
                ) : timeline.error ? (
                  <p className="fuw__muted" role="alert">{timeline.error}</p>
                ) : rows.length === 0 ? (
                  <p className="fuw__muted">No earlier interactions recorded for this client.</p>
                ) : (
                  <ol className="fuw__timeline">
                    {rows.map((h, i) => {
                      const scheduled = toDateTime(h.follow_up_date, h.follow_up_time);
                      const logged = h.createdAt ? new Date(h.createdAt) : null;
                      return (
                        <li key={h.id ?? i} className={i === 0 ? "is-latest" : ""}>
                          <div className="fuw__tl-top">
                            <strong>{typeLabel(h.follow_up_type)}</strong>
                            {i === 0 && <span className="fuw__chip fuw__chip--latest">Latest</span>}
                            {h.connect_via && <span className="fuw__chip">{h.connect_via}</span>}
                            {h.interaction_rating && <span className={`fuw__chip fuw__chip--${String(h.interaction_rating).toLowerCase()}`}>{ratingLabel(h.interaction_rating)}</span>}
                            {logged && !Number.isNaN(+logged) && (
                              <time className="fuw__tl-time" dateTime={h.createdAt}>
                                Logged {logged.toLocaleDateString()}, {logged.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </time>
                            )}
                          </div>
                          <p>{h.comments || "No notes."}</p>
                          {scheduled && <span className="fuw__tl-reminder">Follow-up: {formatWhen(scheduled)}</span>}
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

export default ProcessFollowUpWorkspace;
