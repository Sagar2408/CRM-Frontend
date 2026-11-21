import React, { useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SearchContext } from "../../context/SearchContext";
import { useProcessService } from "../../context/ProcessServiceContext";
import { useProcess } from "../../context/ProcessAuthContext";
import { getProcessFollowUpTimelineApi, getProcessClientDetailsApi } from "../../services/processService";
import {
  EDITABLE_TYPES,
  RATINGS,
  ratingLabel,
  ratingKey,
  typeLabel,
  contactLabel,
  toDateTime,
  formatWhen,
  formatStamp,
} from "../process-followup/followUpHelpers";
import "../../styles/followUpWorkspace.css";
import "../../styles/processModern.css";
import "../../styles/processFollowUpForm.css";

// Process Person follow-up categories (the stored follow_up_type values).
export const TABS = [
  { key: "all", label: "All Follow-ups", match: null },
  { key: "document", label: "Document Collection", match: "document collection" },
  { key: "payment", label: "Payment Follow-up", match: "payment follow-up" },
  { key: "visa", label: "Visa Filing", match: "visa filing" },
  { key: "meeting", label: "Meeting", match: "meeting" },
];

// A client is "in follow-up" once the first follow-up is saved (under_review) or a meeting is booked.
export const FOLLOW_UP_STATUSES = ["under_review", "meeting"];

export { RATINGS, toDateTime };

export const relativeDay = (dt, now = new Date()) => {
  if (!dt) return "";
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(dt) - startOf(now)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return diff > 0 ? `In ${diff} days` : `${Math.abs(diff)} days ago`;
};

const latestOf = (c) => (Array.isArray(c.processfollowuphistories) ? c.processfollowuphistories[0] : null);
const digits = (p) => String(p || "").replace(/[^\d]/g, "");
const typeOf = (c) => String(latestOf(c)?.follow_up_type || "").toLowerCase().trim();

// Process Person Follow-ups: the assigned clients that already have a follow-up, a searchable list on
// the left, the selected client's current follow-up, shared client details and history on the right.
// The API scopes every list to Customer.process_person_id, so only the signed-in person's clients are
// ever shown. Creating / correcting a follow-up happens on the follow-up form (/process/follow-up/:id).
const ProcessFollowUpWorkspace = ({ loadTimeline = getProcessFollowUpTimelineApi, loadDetails = getProcessClientDetailsApi }) => {
  const { fetchCustomers, customers } = useProcessService();
  const { searchQuery, setActivePage } = useContext(SearchContext);
  const { user } = useProcess() || {};
  const navigate = useNavigate();
  const location = useLocation();

  const [tab, setTab] = useState(() => TABS.find((t) => t.label === location.state?.activeTab)?.key || "all");
  const [rating, setRating] = useState("all");
  const [sort, setSort] = useState("reminder");
  const [localQuery, setLocalQuery] = useState("");
  const [selectedId, setSelectedId] = useState(location.state?.focusCustomerId ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice] = useState(location.state?.notice || "");
  const [timeline, setTimeline] = useState({ loading: false, error: "", rows: [], forId: null });
  const [details, setDetails] = useState({ loading: false, error: "", client: null, forId: null });

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

  const base = useMemo(() => (Array.isArray(customers) ? customers : []).filter((c) => FOLLOW_UP_STATUSES.includes(c.status)), [customers]);

  const visible = useMemo(() => {
    const q = `${localQuery} ${searchQuery || ""}`.trim().toLowerCase();
    const wanted = TABS.find((t) => t.key === tab)?.match;
    const list = base.filter((c) => {
      const latest = latestOf(c);
      if (wanted && typeOf(c) !== wanted) return false;
      if (rating !== "all" && ratingKey(latest?.interaction_rating) !== rating) return false;
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
      if (t.match) out[t.key] = base.filter((c) => typeOf(c) === t.match).length;
    });
    return out;
  }, [base]);

  const selected = useMemo(() => (visible.length ? visible.find((c) => c.id === selectedId) || visible[0] : null), [visible, selectedId]);
  const selectedLead = selected?.fresh_lead_id || selected?.freshLead?.id || null;
  const selectedKey = selected?.id ?? null;

  // History of the selected client.
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

  // Shared client details: the latest values the Executive / Process Person saved.
  useEffect(() => {
    if (!selectedKey) {
      setDetails({ loading: false, error: "", client: null, forId: null });
      return undefined;
    }
    let alive = true;
    setDetails({ loading: true, error: "", client: null, forId: selectedKey });
    Promise.resolve(loadDetails(selectedKey))
      .then((client) => alive && setDetails({ loading: false, error: "", client: client || null, forId: selectedKey }))
      .catch((err) => alive && setDetails({ loading: false, error: err?.message || "Could not load client details.", client: null, forId: selectedKey }));
    return () => {
      alive = false;
    };
  }, [selectedKey, loadDetails]);

  const openForm = (client, entryId) =>
    navigate(`/process/follow-up/${encodeURIComponent(client.id)}${entryId ? `?entry=${entryId}` : ""}`, {
      state: { client: { id: client.id, freshLeadId: client.fresh_lead_id, fullName: client.fullName } },
    });

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
  const shared = details.forId === selectedKey ? details.client : null;
  const rows = timeline.rows;
  const show = (v) => v || "-";

  return (
    <div className="fuw">
      <header className="fuw__header">
        <div>
          <h2>Follow-ups</h2>
          <p>Clients you are actively working. Pick one to see the full picture, add a follow-up or correct an earlier one.</p>
        </div>
        <button type="button" className="fuw__ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {notice && (
        <div className="pp-alert" role="status">
          {notice}
        </div>
      )}

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
                <option key={r.value} value={ratingKey(r.value)}>
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
            const rKey = ratingKey(l?.interaction_rating);
            return (
              <li key={c.id}>
                <button type="button" className={`fuw__item ${active ? "is-active" : ""}`} onClick={() => setSelectedId(c.id)}>
                  <span className="fuw__avatar" aria-hidden="true">{(c.fullName || "?").charAt(0).toUpperCase()}</span>
                  <span className="fuw__item-main">
                    <span className="fuw__name">{c.fullName || "Unnamed client"}</span>
                    <span className="fuw__sub">{c.phone || c.email || "No contact"}</span>
                    <span className="fuw__chips">
                      {l?.follow_up_type && <span className="fuw__chip fuw__chip--status">{typeLabel(l.follow_up_type)}</span>}
                      {rKey && <span className={`fuw__chip fuw__chip--${rKey}`}>{ratingLabel(l.interaction_rating)}</span>}
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
                  <h3>{shared?.fullName || selected.fullName || "Unnamed client"}</h3>
                  <p>{[shared?.state, shared?.country || selected.country].filter(Boolean).join(", ") || "Location not recorded"}</p>
                </div>
                <div className="fuw__actions">
                  {digits(selected.phone).length > 1 && (
                    <>
                      <a className="fuw__btn" href={`tel:${String(selected.phone).replace(/[^\d+]/g, "")}`}>Call</a>
                      <a className="fuw__btn" href={`https://wa.me/${digits(selected.phone)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                    </>
                  )}
                  <button type="button" className="fuw__btn" onClick={() => openForm(selected)}>Add follow-up</button>
                  {latest?.id && EDITABLE_TYPES.includes(typeOf(selected)) && (
                    <button type="button" className="fuw__btn fuw__btn--primary" onClick={() => openForm(selected, latest.id)}>Update follow-up</button>
                  )}
                </div>
              </div>

              <div className="fuw__grid">
                <div className="fuw__card">
                  <h4>Current follow-up</h4>
                  <dl>
                    <div><dt>Contact method</dt><dd>{contactLabel(latest?.connect_via)}</dd></div>
                    <div><dt>Category</dt><dd>{typeLabel(latest?.follow_up_type)}{latest?.document_name ? ` - ${latest.document_name}` : ""}</dd></div>
                    <div><dt>Rating</dt><dd>{ratingLabel(latest?.interaction_rating) || "-"}</dd></div>
                    <div><dt>Scheduled</dt><dd>{formatWhen(toDateTime(latest?.follow_up_date, latest?.follow_up_time))}</dd></div>
                  </dl>
                  <div className="fuw__notes">
                    <span>Comments</span>
                    <p>{latest?.comments || "No comments recorded."}</p>
                  </div>
                </div>

                <div className="fuw__card">
                  <h4>Client details</h4>
                  {details.loading && <p className="fuw__muted">Loading client details...</p>}
                  {details.error && <p className="fuw__muted" role="alert">{details.error}</p>}
                  <dl>
                    <div><dt>Email</dt><dd>{show(shared?.email || selected.email)}</dd></div>
                    <div><dt>Phone</dt><dd>{show(shared?.phone || selected.phone)}</dd></div>
                    <div><dt>Education</dt><dd>{show(shared?.education)}</dd></div>
                    <div><dt>Experience</dt><dd>{show(shared?.experience)}</dd></div>
                    <div><dt>Date of birth</dt><dd>{show(shared?.dob)}</dd></div>
                  </dl>
                  <button type="button" className="fuw__ghost" onClick={() => openForm(selected)}>Edit details</button>
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
                      const mine = user?.id != null && Number(h.process_person_id) === Number(user.id);
                      const canEdit = mine && EDITABLE_TYPES.includes(String(h.follow_up_type).toLowerCase());
                      return (
                        <li key={h.id ?? i} className={i === 0 ? "is-latest" : ""}>
                          <div className="fuw__tl-top">
                            <strong>{typeLabel(h.follow_up_type)}</strong>
                            {i === 0 && <span className="fuw__chip fuw__chip--latest">Latest</span>}
                            {h.document_name && <span className="fuw__chip">{h.document_name}</span>}
                            {h.connect_via && <span className="fuw__chip">{contactLabel(h.connect_via)}</span>}
                            {h.interaction_rating && <span className={`fuw__chip fuw__chip--${ratingKey(h.interaction_rating)}`}>{ratingLabel(h.interaction_rating)}</span>}
                            {h.createdAt && <time className="fuw__tl-time" dateTime={h.createdAt}>Logged {formatStamp(h.createdAt)}</time>}
                          </div>
                          <p>{h.comments || "No comments."}</p>
                          <span className="fuw__tl-reminder">
                            {scheduled ? `Follow-up: ${formatWhen(scheduled)}` : "Follow-up time not set"} &middot; Recorded by {h.recordedBy || "Process Person"}
                          </span>
                          {canEdit && (
                            <button type="button" className="pfu-link" style={{ marginLeft: 10 }} onClick={() => openForm(selected, h.id)}>
                              Edit
                            </button>
                          )}
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
