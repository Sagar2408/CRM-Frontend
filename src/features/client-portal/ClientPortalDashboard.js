import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getClientOverview, logoutClient, clearClientSession } from "../../services/clientPortalApi";
import "../../styles/clientPortal.css";

const fmtDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(+d) ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
};
const fmtTime = (t) => (t ? String(t).slice(0, 5) : "");

// The client-facing dashboard. It only ever shows what GET /client-portal/overview returns, which the
// server limits to the signed-in client's own, client-safe data (no staff notes, no other clients).
export default function ClientPortalDashboard() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: "", disabled: false, data: null });

  const signOut = useCallback(async () => {
    await logoutClient();
    navigate("/login", { replace: true });
  }, [navigate]);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      setState({ loading: false, error: "", disabled: false, data: await getClientOverview() });
    } catch (err) {
      if (err.code === "CLIENT_PORTAL_DISABLED") {
        return setState({ loading: false, error: "", disabled: true, data: null });
      }
      if (err.status === 401 || err.status === 403) {
        // session ended / password changed / not a client token: back to the login page
        clearClientSession();
        return navigate("/login", { replace: true });
      }
      return setState({ loading: false, error: err.message || "Could not load your portal.", disabled: false, data: null });
    }
    return undefined;
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const { data } = state;
  const first = (data?.profile?.fullName || "").split(" ")[0];

  return (
    <div className="cp-shell">
      <header className="cp-header">
        <span className="cp-brand">Client Portal</span>
        <div className="cp-header__right">
          {data && <span className="cp-user">{data.profile.fullName}</span>}
          <button type="button" className="cp-btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="cp-main">
        {state.loading && (
          <div className="cp-skeleton" aria-busy="true" aria-label="Loading your portal">
            <span /><span /><span />
          </div>
        )}

        {state.disabled && (
          <section className="cp-card cp-notice" role="alert">
            <h1>Portal access is disabled</h1>
            <p>Your client portal access is currently turned off. Please contact your case officer.</p>
          </section>
        )}

        {state.error && (
          <section className="cp-card cp-notice" role="alert">
            <h1>Something went wrong</h1>
            <p>{state.error}</p>
            <button type="button" className="cp-btn cp-btn--primary" onClick={load}>
              Try again
            </button>
          </section>
        )}

        {data && (
          <>
            <section className="cp-hero">
              <div>
                <h1 className="cp-hero__title">Welcome{first ? `, ${first}` : ""}</h1>
                <p className="cp-hero__sub">Here is where your application stands.</p>
              </div>
              <span className={`cp-pill cp-pill--${data.status.code}`}>{data.status.label}</span>
            </section>

            <section className="cp-card" aria-labelledby="cp-road-h">
              <h2 id="cp-road-h" className="cp-card__title">Your progress</h2>
              {data.roadmap.total === 0 ? (
                <p className="cp-muted">Your roadmap will appear here once your case officer sets it up.</p>
              ) : (
                <>
                  <p className="cp-muted">{data.roadmap.current > 0 ? `Stage ${data.roadmap.current} of ${data.roadmap.total}` : "Not started yet"}</p>
                  <ol className="cp-roadmap">
                    {data.roadmap.stages.map((s) => (
                      <li key={s.number} className={`cp-step cp-step--${s.state}`} aria-current={s.state === "current" ? "step" : undefined}>
                        <span className="cp-step__dot" aria-hidden="true">{s.state === "completed" ? "✓" : s.number}</span>
                        <span className="cp-step__label">{s.label}</span>
                        <span className="cp-sr"> ({s.state})</span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </section>

            <div className="cp-grid">
              <section className="cp-card" aria-labelledby="cp-prof-h">
                <h2 id="cp-prof-h" className="cp-card__title">Your details</h2>
                <dl className="cp-facts">
                  <div><dt>Name</dt><dd>{data.profile.fullName}</dd></div>
                  <div><dt>Email</dt><dd>{data.profile.email}</dd></div>
                  <div><dt>Phone</dt><dd>{data.profile.phone || "-"}</dd></div>
                  <div><dt>Country</dt><dd>{data.profile.country || "-"}</dd></div>
                </dl>
              </section>

              <section className="cp-card" aria-labelledby="cp-doc-h">
                <h2 id="cp-doc-h" className="cp-card__title">Documents</h2>
                {data.documents.length === 0 ? (
                  <p className="cp-muted">No documents have been requested yet.</p>
                ) : (
                  <ul className="cp-list">
                    {data.documents.map((d) => (
                      <li key={d.name}>
                        <span className="cp-list__main">{d.name}</span>
                        <span className={`cp-pill cp-pill--${d.status.toLowerCase()}`}>{d.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="cp-card" aria-labelledby="cp-fu-h">
                <h2 id="cp-fu-h" className="cp-card__title">Appointments &amp; follow-ups</h2>
                {data.followUps.length === 0 ? (
                  <p className="cp-muted">Nothing scheduled right now.</p>
                ) : (
                  <ul className="cp-list">
                    {data.followUps.map((f) => (
                      <li key={f.id}>
                        <span className="cp-list__main">
                          {f.category}
                          {f.document ? ` - ${f.document}` : ""}
                        </span>
                        <span className="cp-muted">{[fmtDate(f.date), fmtTime(f.time)].filter(Boolean).join(", ")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="cp-card" aria-labelledby="cp-up-h">
                <h2 id="cp-up-h" className="cp-card__title">Updates for you</h2>
                {data.updates.length === 0 ? (
                  <p className="cp-muted">No updates yet.</p>
                ) : (
                  <ul className="cp-list">
                    {data.updates.map((u) => (
                      <li key={u.id}>
                        <span className="cp-list__main">{u.message}</span>
                        <span className="cp-muted">{fmtDate(u.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
