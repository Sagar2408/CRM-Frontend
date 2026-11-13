import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useApi } from "../../context/ApiContext";
import { SearchContext } from "../../context/SearchContext";
import {
  fetchMeetings as fetchMeetingsApi,
  createMeetingAPI,
  updateMeeting,
  updateMeetingStatus,
  deleteMeeting,
} from "../../services/apiService";
import FollowUpForm from "./FollowUpForm";
import FollowUpHistory from "./FollowUpHistory";
import MeetingForm, { REMINDER_OPTIONS } from "./MeetingForm";
import "../../styles/meetings.css";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
];

const STATUS_OPTIONS = ["All", "Scheduled", "Completed", "Cancelled", "No Show"];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const timeLabel = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const errText = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

export const inRange = (start, range, now = new Date()) => {
  const today = startOfDay(now);
  switch (range) {
    case "today":
      return start >= today && start < addDays(today, 1);
    case "week": {
      const dow = (today.getDay() + 6) % 7; // Monday = 0
      const monday = addDays(today, -dow);
      return start >= monday && start < addDays(monday, 7);
    }
    case "month":
      return start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth();
    case "upcoming":
      return start >= now;
    case "past":
      return start < now;
    default:
      return true;
  }
};

export const reminderLabel = (minutes) => {
  const m = Number(minutes);
  if (!m) return "No reminder";
  return REMINDER_OPTIONS.find((o) => o.value === m)?.label || `${m} min before`;
};

const ScheduleMeeting = () => {
  const navigate = useNavigate();
  const {
    fetchFollowUpHistoriesAPI,
    updateFollowUp,
    createFollowUp,
    createFollowUpHistoryAPI,
    fetchFreshLeadsAPI,
    refreshMeetings,
    createConvertedClientAPI,
    createCloseLeadAPI,
    getAllFollowUps,
    updateClientLead,
  } = useApi();
  const { searchQuery } = useContext(SearchContext);

  const [meetings, setMeetings] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("week");
  const [status, setStatus] = useState("All");
  const [formMeeting, setFormMeeting] = useState(undefined); // undefined = closed, null = new, object = edit
  const [followUpMeeting, setFollowUpMeeting] = useState(null);
  const [historyMeeting, setHistoryMeeting] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMeetings(await fetchMeetingsApi());
    } catch (err) {
      setMeetings([]);
      setError(errText(err, "Could not load your meetings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The executive's own assigned leads, for the "New meeting" picker.
  useEffect(() => {
    (async () => {
      const data = await fetchFreshLeadsAPI();
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setLeads(list.filter((l) => ["New", "Assigned", "Follow-Up", "Meeting"].includes(l.clientLead?.status)));
    })();
  }, [fetchFreshLeadsAPI]);

  const now = new Date();

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const scheduled = meetings.filter((m) => m.status === "Scheduled");
    return {
      today: scheduled.filter((m) => inRange(new Date(m.startTime), "today")).length,
      upcoming: scheduled.filter((m) => new Date(m.startTime) >= new Date()).length,
      completed: meetings.filter((m) => m.status === "Completed" && new Date(m.startTime) >= addDays(today, -30)).length,
      attention: scheduled.filter((m) => new Date(m.startTime) < new Date()).length,
    };
  }, [meetings]);

  const visible = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    return meetings
      .filter((m) => inRange(new Date(m.startTime), range))
      .filter((m) => status === "All" || m.status === status)
      .filter(
        (m) =>
          !q ||
          `${m.clientName || ""} ${m.clientEmail || ""} ${m.clientPhone || ""} ${m.reasonForFollowup || ""}`.toLowerCase().includes(q)
      )
      .sort((a, b) => (range === "past" ? new Date(b.startTime) - new Date(a.startTime) : new Date(a.startTime) - new Date(b.startTime)));
  }, [meetings, range, status, searchQuery]);

  const groups = useMemo(() => {
    const map = new Map();
    visible.forEach((m) => {
      const key = startOfDay(new Date(m.startTime)).getTime();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    });
    return [...map.entries()];
  }, [visible]);

  const dayHeading = (ts) => {
    const d = new Date(ts);
    const today = startOfDay(new Date()).getTime();
    const rel = ts === today ? "Today" : ts === today + 86400000 ? "Tomorrow" : ts === today - 86400000 ? "Yesterday" : "";
    return `${rel ? `${rel} - ` : ""}${d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}`;
  };

  const afterChange = async () => {
    await Promise.all([load(), refreshMeetings()]);
  };

  const saveMeeting = async (payload) => {
    if (formMeeting) {
      await updateMeeting(formMeeting.id, payload);
    } else {
      await createMeetingAPI(payload);
    }
    setFormMeeting(undefined);
    await Promise.all([afterChange(), fetchFreshLeadsAPI()]);
    Swal.fire({ icon: "success", title: formMeeting ? "Meeting updated" : "Meeting scheduled", timer: 1400, showConfirmButton: false });
  };

  const changeStatus = async (meeting, next) => {
    if (["Cancelled", "No Show"].includes(next)) {
      const { isConfirmed } = await Swal.fire({
        icon: "question",
        title: next === "Cancelled" ? "Cancel this meeting?" : "Mark as no-show?",
        text: `${meeting.clientName} - ${new Date(meeting.startTime).toLocaleString()}`,
        showCancelButton: true,
        confirmButtonText: next === "Cancelled" ? "Yes, cancel it" : "Yes, mark no-show",
      });
      if (!isConfirmed) return;
    }
    setBusyId(meeting.id);
    try {
      await updateMeetingStatus(meeting.id, next);
      await afterChange();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Could not update", text: errText(err, "Please try again.") });
    } finally {
      setBusyId(null);
    }
  };

  const removeMeeting = async (meeting) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "Delete this meeting?",
      text: "This cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Delete",
    });
    if (!isConfirmed) return;
    setBusyId(meeting.id);
    try {
      await deleteMeeting(meeting.id);
      await afterChange();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Could not delete", text: errText(err, "Please try again.") });
    } finally {
      setBusyId(null);
    }
  };

  // Follow-up recorded straight from a meeting (kept from the previous page).
  const handleFollowUpSubmit = async (formData) => {
    const { reason_for_follow_up, connect_via, follow_up_type, interaction_rating, follow_up_date, follow_up_time } = formData;
    const meeting = followUpMeeting;
    const freshLeadId = meeting.fresh_lead_id;
    const clientLeadId = meeting.clientLead?.id;

    if (!freshLeadId || !clientLeadId) {
      Swal.fire({ icon: "error", title: "Missing lead info", text: "Unable to find the lead for this meeting." });
      return;
    }

    try {
      let followUpId;
      const histories = await fetchFollowUpHistoriesAPI();
      if (Array.isArray(histories)) {
        const recent = histories
          .filter((h) => String(h.fresh_lead_id) === String(freshLeadId))
          .sort((a, b) => new Date(b.createdAt || b.follow_up_date) - new Date(a.createdAt || a.follow_up_date))[0];
        followUpId = recent?.follow_up_id;
      }

      const payload = {
        connect_via,
        follow_up_type,
        interaction_rating,
        reason_for_follow_up,
        follow_up_date,
        follow_up_time,
        fresh_lead_id: freshLeadId,
      };

      if (followUpId) {
        await updateFollowUp(followUpId, payload);
      } else {
        const res = await createFollowUp(payload);
        followUpId = res.data.id;
      }

      if (["interested", "not interested", "no response"].includes(follow_up_type)) {
        await updateClientLead(clientLeadId, { status: "Follow-Up", companyId: meeting.clientLead?.companyId });
      }

      await createFollowUpHistoryAPI({ ...payload, follow_up_id: followUpId });

      if (follow_up_type === "converted") await createConvertedClientAPI({ fresh_lead_id: freshLeadId });
      else if (follow_up_type === "close") await createCloseLeadAPI({ fresh_lead_id: freshLeadId });

      // The meeting has now been acted on.
      if (meeting.status === "Scheduled") await updateMeetingStatus(meeting.id, "Completed").catch(() => {});

      setFollowUpMeeting(null);
      await Promise.all([fetchFreshLeadsAPI(), afterChange(), getAllFollowUps()]);

      if (follow_up_type === "converted") {
        Swal.fire({ icon: "success", title: "Client converted successfully" });
        navigate("/executive/customer");
      } else if (follow_up_type === "close") {
        Swal.fire({ icon: "success", title: "Lead closed successfully" });
        navigate("/executive/close-leads");
      } else {
        navigate("/executive/follow-up", { state: { activeTab: "All Follow Ups" } });
      }
    } catch (error) {
      console.error("Follow-up submission error:", error);
      Swal.fire({ icon: "error", title: "Operation failed", text: errText(error, "Something went wrong. Please try again.") });
    }
  };

  return (
    <div className="mtg">
      <header className="mtg__header">
        <div>
          <h2>Meetings</h2>
          <p>Your scheduled client meetings, reminders and outcomes.</p>
        </div>
        <div className="mtg__header-actions">
          <button type="button" className="mtg-btn" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" className="mtg-btn mtg-btn--primary" onClick={() => setFormMeeting(null)}>
            + New meeting
          </button>
        </div>
      </header>

      <div className="mtg__stats">
        <div className="mtg__stat">
          <span>Today</span>
          <strong>{stats.today}</strong>
        </div>
        <div className="mtg__stat">
          <span>Upcoming</span>
          <strong>{stats.upcoming}</strong>
        </div>
        <div className="mtg__stat">
          <span>Completed (30 days)</span>
          <strong>{stats.completed}</strong>
        </div>
        <div className={`mtg__stat ${stats.attention ? "is-warn" : ""}`}>
          <span>Needs an outcome</span>
          <strong>{stats.attention}</strong>
        </div>
      </div>

      <div className="mtg__toolbar">
        <div className="mtg__tabs" role="tablist" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r.key} type="button" role="tab" aria-selected={range === r.key} className={range === r.key ? "is-active" : ""} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
        <label className="mtg__select">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="mtg-error" role="alert">
          {error} <button onClick={load}>Retry</button>
        </div>
      )}

      {loading && meetings.length === 0 ? (
        <div className="mtg__skeletons" aria-hidden="true">
          <div />
          <div />
          <div />
        </div>
      ) : groups.length === 0 ? (
        <div className="mtg__empty">
          <strong>No meetings here</strong>
          <span>{meetings.length ? "Try another date range or status." : "Schedule your first meeting with a lead."}</span>
          <button type="button" className="mtg-btn mtg-btn--primary" onClick={() => setFormMeeting(null)}>
            + New meeting
          </button>
        </div>
      ) : (
        groups.map(([ts, items]) => (
          <section key={ts} className="mtg__day">
            <h3>{dayHeading(ts)}</h3>
            <ul>
              {items.map((m) => {
                const start = new Date(m.startTime);
                const end = m.endTime ? new Date(m.endTime) : null;
                const overdue = m.status === "Scheduled" && start < now;
                const busy = busyId === m.id;
                return (
                  <li key={m.id} className={`mtg__card status-${m.status.replace(/\s+/g, "-").toLowerCase()} ${overdue ? "is-overdue" : ""}`}>
                    <div className="mtg__time">
                      <strong>{timeLabel(start)}</strong>
                      {end && <span>{timeLabel(end)}</span>}
                    </div>
                    <div className="mtg__main">
                      <div className="mtg__title">
                        <h4>{m.clientName}</h4>
                        <span className={`mtg__badge mtg__badge--${m.status.replace(/\s+/g, "-").toLowerCase()}`}>{overdue ? "Needs outcome" : m.status}</span>
                      </div>
                      <div className="mtg__contact">
                        {m.clientPhone && <span>{m.clientPhone}</span>}
                        {m.clientEmail && <span>{m.clientEmail}</span>}
                      </div>
                      {m.reasonForFollowup && <p className="mtg__reason">{m.reasonForFollowup}</p>}
                      {m.notes && <p className="mtg__notes">Notes: {m.notes}</p>}
                      <span className="mtg__reminder">{reminderLabel(m.reminderMinutes)}</span>
                    </div>
                    <div className="mtg__actions">
                      {m.status === "Scheduled" && (
                        <button type="button" className="mtg-btn mtg-btn--primary" disabled={busy} onClick={() => changeStatus(m, "Completed")}>
                          Mark completed
                        </button>
                      )}
                      {m.status !== "Scheduled" && (
                        <button type="button" className="mtg-btn" disabled={busy} onClick={() => changeStatus(m, "Scheduled")}>
                          Reopen
                        </button>
                      )}
                      <button type="button" className="mtg-btn" onClick={() => setFollowUpMeeting(m)}>
                        Add follow-up
                      </button>
                      <details className="mtg__more">
                        <summary className="mtg-btn" aria-label="More actions">
                          More
                        </summary>
                        <div className="mtg__menu">
                          <button type="button" onClick={() => setFormMeeting(m)}>
                            Edit / reschedule
                          </button>
                          <button type="button" onClick={() => setHistoryMeeting(m)}>
                            Follow-up history
                          </button>
                          {m.status === "Scheduled" && (
                            <>
                              <button type="button" onClick={() => changeStatus(m, "No Show")}>
                                Mark no-show
                              </button>
                              <button type="button" onClick={() => changeStatus(m, "Cancelled")}>
                                Cancel meeting
                              </button>
                            </>
                          )}
                          <button type="button" className="is-danger" onClick={() => removeMeeting(m)}>
                            Delete
                          </button>
                        </div>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {formMeeting !== undefined && (
        <MeetingForm meeting={formMeeting} leads={leads} onSubmit={saveMeeting} onClose={() => setFormMeeting(undefined)} />
      )}
      {followUpMeeting && (
        <FollowUpForm meeting={followUpMeeting} onClose={() => setFollowUpMeeting(null)} onSubmit={handleFollowUpSubmit} />
      )}
      {historyMeeting && <FollowUpHistory meeting={historyMeeting} onClose={() => setHistoryMeeting(null)} />}
    </div>
  );
};

export default ScheduleMeeting;
