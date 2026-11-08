import React, { useEffect, useState } from "react";
import { useApi } from "../../../context/ApiContext";
import Panel from "./Panel";

const fmtDate = (v) =>
  new Date(v).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// Upcoming meetings (GET /meetings, future only, soonest first) and the most
// recently updated leads (GET /client-leads/recent-activity).
const MeetingsActivity = ({ executives = [] }) => {
  const { adminMeeting, fetchRecentLeadActivity } = useApi();
  const [meetings, setMeetings] = useState({ items: [], loading: true, error: "" });
  const [activity, setActivity] = useState({ items: [], loading: true, error: "" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await adminMeeting();
        const now = Date.now();
        const upcoming = (Array.isArray(all) ? all : [])
          .filter((m) => new Date(m.startTime).getTime() >= now)
          .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
          .slice(0, 5);
        if (!cancelled) setMeetings({ items: upcoming, loading: false, error: "" });
      } catch (err) {
        console.error("Meetings error:", err);
        if (!cancelled) setMeetings({ items: [], loading: false, error: "Could not load meetings." });
      }
    })();
    (async () => {
      try {
        const items = await fetchRecentLeadActivity(6);
        if (!cancelled) setActivity({ items, loading: false, error: "" });
      } catch (err) {
        console.error("Activity error:", err);
        if (!cancelled) setActivity({ items: [], loading: false, error: "Could not load recent activity." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminMeeting, fetchRecentLeadActivity]);

  const execName = (id) => executives.find((e) => String(e.id) === String(id))?.username;

  return (
    <Panel title="Meetings & Activity" subtitle="What is coming up and what just changed">
      <h3 className="ad-sub-head">Upcoming meetings</h3>
      {meetings.loading ? (
        <div className="ad-state" role="status">Loading…</div>
      ) : meetings.error ? (
        <div className="ad-state ad-state-error" role="alert">{meetings.error}</div>
      ) : meetings.items.length === 0 ? (
        <div className="ad-state">No upcoming meetings.</div>
      ) : (
        <ul className="ad-list">
          {meetings.items.map((m) => (
            <li key={m.id}>
              <span className="ad-list-main">{m.clientName}</span>
              <span className="ad-list-meta">
                {fmtDate(m.startTime)}
                {execName(m.executiveId) ? ` · ${execName(m.executiveId)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="ad-sub-head">Recent lead activity</h3>
      {activity.loading ? (
        <div className="ad-state" role="status">Loading…</div>
      ) : activity.error ? (
        <div className="ad-state ad-state-error" role="alert">{activity.error}</div>
      ) : activity.items.length === 0 ? (
        <div className="ad-state">No recent activity.</div>
      ) : (
        <ul className="ad-list">
          {activity.items.map((a) => (
            <li key={a.id}>
              <span className="ad-list-main">
                {a.name} <span className="ad-chip">{a.status}</span>
              </span>
              <span className="ad-list-meta">
                {a.assignedToExecutive ? `${a.assignedToExecutive} · ` : ""}
                {fmtDate(a.updatedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};

export default MeetingsActivity;
