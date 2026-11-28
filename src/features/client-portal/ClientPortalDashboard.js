import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCheck, FaFilePdf, FaFileImage, FaFileWord, FaFileAlt, FaCloudUploadAlt, FaEye, FaDownload,
  FaSignOutAlt, FaCalendarAlt, FaBell, FaUser, FaEnvelope, FaPhoneAlt, FaGlobe, FaRegClock, FaFolderOpen, FaPaperclip,
} from "react-icons/fa";
import { getClientOverview, logoutClient, clearClientSession, uploadClientDocument, fetchClientDocumentBlob } from "../../services/clientPortalApi";
import "../../styles/clientPortal.css";

const fmtDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(+d) ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
};
const dateParts = (v) => {
  const m = /^(d{4})-(d{2})-(d{2})/.exec(String(v || ""));
  return m ? { y: +m[1], mo: +m[2] - 1, d: +m[3] } : null;
};
const dayOf = (v) => (dateParts(v) ? dateParts(v).d : "");
const monthOf = (v) => (dateParts(v) ? new Date(2000, dateParts(v).mo, 1).toLocaleDateString(undefined, { month: "short" }) : "");
const fmtTime = (t) => (t ? String(t).slice(0, 5) : "");
const initials = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "C";

const STATE_LABEL = { completed: "Completed", current: "Current stage", upcoming: "Pending" };
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx";

function FileIcon({ mime, name }) {
  const m = String(mime || "");
  const n = String(name || "").toLowerCase();
  if (m === "application/pdf" || n.endsWith(".pdf")) return <FaFilePdf className="cp-ficon cp-ficon--pdf" aria-hidden="true" />;
  if (m.startsWith("image/")) return <FaFileImage className="cp-ficon cp-ficon--img" aria-hidden="true" />;
  if (m.includes("word") || /\.docx?$/.test(n)) return <FaFileWord className="cp-ficon cp-ficon--doc" aria-hidden="true" />;
  return <FaFileAlt className="cp-ficon" aria-hidden="true" />;
}

function SectionHead({ id, icon, title, hint }) {
  return (
    <div className="cp-sechead">
      <span className="cp-sechead__icon" aria-hidden="true">{icon}</span>
      <div>
        <h2 id={id} className="cp-card__title">{title}</h2>
        {hint && <p className="cp-sechead__hint">{hint}</p>}
      </div>
    </div>
  );
}

// The client-facing dashboard. It only ever shows what GET /client-portal/overview returns, which the
// server limits to the signed-in client's own, client-safe data (no staff notes, no other clients).
export default function ClientPortalDashboard() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: "", disabled: false, data: null });
  const [busy, setBusy] = useState(null); // request name (or "__extra") currently uploading
  const [notice, setNotice] = useState(null); // { kind: "ok" | "error", text }
  const currentRef = useRef(null);

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

  // keep the current stage in view on a long, horizontally scrolling journey
  const currentStage = state.data?.roadmap?.current;
  useEffect(() => {
    const el = currentRef.current;
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest", inline: "center" });
  }, [currentStage]);

  const upload = async (file, requestName) => {
    if (!file) return;
    setBusy(requestName || "__extra");
    setNotice(null);
    try {
      await uploadClientDocument(file, requestName);
      setNotice({ kind: "ok", text: requestName ? `${requestName} uploaded.` : "Document uploaded." });
      setState({ loading: false, error: "", disabled: false, data: await getClientOverview() });
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        clearClientSession();
        navigate("/login", { replace: true });
      } else {
        setNotice({ kind: "error", text: err.message || "Upload failed." });
      }
    } finally {
      setBusy(null);
    }
  };

  const openFile = async (doc, download) => {
    try {
      const blob = await fetchClientDocumentBlob(doc.id, download);
      const url = URL.createObjectURL(blob);
      if (download || !doc.previewable) {
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.fileName;
        a.click();
      } else {
        window.open(url, "_blank", "noopener");
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setNotice({ kind: "error", text: err.message || "Could not open the document." });
    }
  };

  const { data } = state;
  const first = (data?.profile?.fullName || "").split(" ")[0];
  const requests = data?.documentRequests || [];
  const uploads = data?.uploads || [];
  const pending = requests.filter((r) => r.status !== "Received").length;
  const roadmap = data?.roadmap;
  const pct = roadmap && roadmap.total > 0 ? Math.round((roadmap.current / roadmap.total) * 100) : 0;

  const picker = (label, ariaLabel, requestName, primary) => (
    <label className={`cp-btn cp-btn--sm${primary ? " cp-btn--primary" : ""}${busy ? " is-disabled" : ""}`}>
      <FaCloudUploadAlt aria-hidden="true" />
      <span>{busy === (requestName || "__extra") ? "Uploading…" : label}</span>
      <input
        type="file"
        className="cp-file"
        aria-label={ariaLabel}
        disabled={!!busy}
        accept={ACCEPT}
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          e.target.value = "";
          upload(f, requestName);
        }}
      />
    </label>
  );

  return (
    <div className="cp-shell">
      <header className="cp-header">
        <div className="cp-header__inner">
          <span className="cp-brand">
            <span className="cp-brand__mark" aria-hidden="true">A</span>
            <span className="cp-brand__text">Client Portal</span>
          </span>
          <div className="cp-header__right">
            {data && (
              <span className="cp-profile">
                <span className="cp-avatar" aria-hidden="true">{initials(data.profile.fullName)}</span>
                <span className="cp-user">{data.profile.fullName}</span>
              </span>
            )}
            <button type="button" className="cp-btn cp-btn--ghost" onClick={signOut}>
              <FaSignOutAlt aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="cp-main">
        {state.loading && !data && (
          <div className="cp-skeleton" aria-busy="true" aria-label="Loading your portal">
            <span className="cp-sk cp-sk--hero" />
            <span className="cp-sk cp-sk--journey" />
            <div className="cp-sk-row"><span className="cp-sk cp-sk--card" /><span className="cp-sk cp-sk--card" /></div>
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
            <section className="cp-hero" aria-label="Application summary">
              <div className="cp-hero__lead">
                <span className="cp-avatar cp-avatar--lg" aria-hidden="true">{initials(data.profile.fullName)}</span>
                <div>
                  <h1 className="cp-hero__title">Welcome{first ? `, ${first}` : ""}</h1>
                  <p className="cp-hero__sub">Here is where your application stands.</p>
                  {data.profile.memberSince && <p className="cp-hero__meta">Client since {fmtDate(data.profile.memberSince)}</p>}
                </div>
              </div>
              <div className="cp-hero__stats">
                <div className="cp-stat">
                  <span className="cp-stat__label">Status</span>
                  <span className={`cp-pill cp-pill--${data.status.code}`}>{data.status.label}</span>
                </div>
                {roadmap.total > 0 && (
                  <div className="cp-stat">
                    <span className="cp-stat__label">Progress</span>
                    <span className="cp-stat__value">{pct}%</span>
                  </div>
                )}
                <div className="cp-stat">
                  <span className="cp-stat__label">Documents to upload</span>
                  <span className="cp-stat__value">{pending}</span>
                </div>
              </div>
            </section>

            <section className="cp-card" aria-labelledby="cp-road-h">
              <SectionHead
                id="cp-road-h"
                icon={<FaRegClock />}
                title="Your progress"
                hint={roadmap.total === 0 ? null : roadmap.current > 0 ? `Stage ${roadmap.current} of ${roadmap.total}` : "Not started yet"}
              />
              {roadmap.total === 0 ? (
                <p className="cp-empty">Your roadmap will appear here once your case officer sets it up.</p>
              ) : (
                <>
                  <div className="cp-bar" role="presentation"><span style={{ width: `${pct}%` }} /></div>
                  <ol className="cp-roadmap">
                    {roadmap.stages.map((s) => (
                      <li
                        key={s.number}
                        ref={s.state === "current" ? currentRef : null}
                        className={`cp-step cp-step--${s.state}`}
                        aria-current={s.state === "current" ? "step" : undefined}
                      >
                        <span className="cp-step__dot" aria-hidden="true">{s.state === "completed" ? <FaCheck /> : s.number}</span>
                        <span className="cp-step__body">
                          <span className="cp-step__label">{s.label}</span>
                          <span className="cp-step__state">{STATE_LABEL[s.state]}</span>
                          {s.reachedAt && s.state !== "upcoming" && <span className="cp-step__date">{fmtDate(s.reachedAt)}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </section>

            <section className="cp-card" aria-labelledby="cp-doc-h">
              <SectionHead id="cp-doc-h" icon={<FaFolderOpen />} title="Documents" hint="Upload what your case officer asked for and keep track of what you have sent." />
              {notice && (
                <p className={`cp-notice-line cp-notice-line--${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p>
              )}
              <div className="cp-docs">
                <div className="cp-panel cp-panel--requested">
                  <h3 className="cp-subtitle">Documents Requested</h3>
                  {requests.length === 0 ? (
                    <p className="cp-empty">No documents have been requested yet.</p>
                  ) : (
                    <ul className="cp-list">
                      {requests.map((r) => (
                        <li key={r.name} className={r.status === "Received" ? "is-done" : "is-pending"}>
                          <span className="cp-list__main">
                            <span className="cp-list__title">{r.name}</span>
                            <span className="cp-muted cp-block">
                              {r.requestedAt ? `Requested ${fmtDate(r.requestedAt)}` : "Requested"}
                              {r.uploadedAt ? ` · Uploaded ${fmtDate(r.uploadedAt)}` : ""}
                            </span>
                          </span>
                          <span className="cp-actions">
                            <span className={`cp-pill cp-pill--${r.status === "Received" ? "received" : "requested"}`}>{r.status}</span>
                            {r.status !== "Received" && picker("Upload", `Upload ${r.name}`, r.name, true)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="cp-panel">
                  <h3 className="cp-subtitle">My Uploaded Documents</h3>
                  {uploads.length === 0 ? (
                    <p className="cp-empty">You have not uploaded any documents yet.</p>
                  ) : (
                    <ul className="cp-list">
                      {uploads.map((u) => (
                        <li key={u.id}>
                          <FileIcon mime={u.mimeType} name={u.fileName} />
                          <span className="cp-list__main">
                            <span className="cp-list__title">{u.fileName}</span>
                            <span className="cp-muted cp-block">Uploaded {fmtDate(u.uploadedAt)}</span>
                          </span>
                          <span className="cp-actions">
                            <span className="cp-pill cp-pill--received">{u.status}</span>
                            {u.previewable && (
                              <button type="button" className="cp-btn cp-btn--sm cp-btn--icon" onClick={() => openFile(u, false)} aria-label={`Preview ${u.fileName}`} title="Preview">
                                <FaEye aria-hidden="true" />
                              </button>
                            )}
                            <button type="button" className="cp-btn cp-btn--sm cp-btn--icon" onClick={() => openFile(u, true)} aria-label={`Download ${u.fileName}`} title="Download">
                              <FaDownload aria-hidden="true" />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="cp-extra">{picker("Upload another document", "Upload another document", null, false)}</div>
                </div>
              </div>
            </section>

            <div className="cp-grid">
              <section className="cp-card" aria-labelledby="cp-prof-h">
                <SectionHead id="cp-prof-h" icon={<FaUser />} title="Your details" />
                <dl className="cp-facts">
                  <div><dt><FaUser aria-hidden="true" /> Name</dt><dd>{data.profile.fullName}</dd></div>
                  <div><dt><FaEnvelope aria-hidden="true" /> Email</dt><dd>{data.profile.email}</dd></div>
                  <div><dt><FaPhoneAlt aria-hidden="true" /> Phone</dt><dd>{data.profile.phone || "-"}</dd></div>
                  <div><dt><FaGlobe aria-hidden="true" /> Country</dt><dd>{data.profile.country || "-"}</dd></div>
                </dl>
              </section>

              <section className="cp-card" aria-labelledby="cp-fu-h">
                <SectionHead id="cp-fu-h" icon={<FaCalendarAlt />} title="Appointments & follow-ups" />
                {data.followUps.length === 0 ? (
                  <p className="cp-empty">Nothing scheduled right now.</p>
                ) : (
                  <ul className="cp-list cp-list--compact">
                    {data.followUps.map((f) => (
                      <li key={f.id}>
                        <span className="cp-datechip" aria-hidden="true">
                          <b>{dayOf(f.date)}</b>
                          <i>{monthOf(f.date)}</i>
                        </span>
                        <span className="cp-list__main">
                          <span className="cp-list__title">
                            {f.category}
                            {f.document ? ` - ${f.document}` : ""}
                          </span>
                          <span className="cp-muted cp-block">{[fmtDate(f.date), fmtTime(f.time)].filter(Boolean).join(", ")}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="cp-card cp-card--wide" aria-labelledby="cp-up-h">
                <SectionHead id="cp-up-h" icon={<FaBell />} title="Updates for you" />
                {data.updates.length === 0 ? (
                  <p className="cp-empty">No updates yet.</p>
                ) : (
                  <ul className="cp-list cp-list--compact">
                    {data.updates.map((u) => (
                      <li key={u.id}>
                        <FaPaperclip className="cp-ficon" aria-hidden="true" />
                        <span className="cp-list__main"><span className="cp-list__title">{u.message}</span></span>
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
