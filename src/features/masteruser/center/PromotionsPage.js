import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { masterAdmin, errorMessage, fmtDateTime, toInputDateTime, PROMOTION_CATEGORIES, PROMOTION_STATUSES } from "../../../services/masterAdminService";
import "../../../styles/masterCenter.css";

const EMPTY = { title: "", description: "", category: "Announcement", bannerUrl: "", audienceType: "all", companyIds: [], ctaLabel: "", ctaUrl: "", publishAt: "", expiresAt: "", sendEmail: false, mode: "publish" };
const isHttp = (u) => /^https?:\/\//i.test(u || "");

/** Client-side checks that mirror the server rules (the server stays authoritative). */
export const validatePromotion = (f, now = new Date()) => {
  const e = {};
  if ((f.title || "").trim().length < 3) e.title = "Add a title (at least 3 characters).";
  if ((f.description || "").trim().length < 3) e.description = "Add a description.";
  if (f.bannerUrl && !isHttp(f.bannerUrl)) e.bannerUrl = "Banner must be an http(s) URL.";
  if (f.ctaUrl && !isHttp(f.ctaUrl)) e.ctaUrl = "CTA link must be an http(s) URL.";
  if (f.ctaUrl && !f.ctaLabel.trim()) e.ctaLabel = "Add a CTA label for the link.";
  if (f.audienceType === "selected" && f.companyIds.length === 0) e.companyIds = "Select at least one company.";
  if (f.mode === "schedule") {
    if (!f.publishAt) e.publishAt = "Choose when to publish.";
    else if (new Date(f.publishAt) <= now) e.publishAt = "The publish time must be in the future.";
  }
  if (f.expiresAt) {
    const from = f.mode === "schedule" && f.publishAt ? new Date(f.publishAt) : now;
    if (new Date(f.expiresAt) <= from) e.expiresAt = "Expiry must be after the publish time.";
  }
  return e;
};

export const toPayload = (f) => ({
  title: f.title.trim(),
  description: f.description.trim(),
  category: f.category,
  bannerUrl: f.bannerUrl || null,
  audienceType: f.audienceType,
  companyIds: f.audienceType === "selected" ? f.companyIds : [],
  ctaLabel: f.ctaLabel || null,
  ctaUrl: f.ctaUrl || null,
  publishAt: f.mode === "schedule" && f.publishAt ? new Date(f.publishAt).toISOString() : null,
  expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : null,
  sendEmail: !!f.sendEmail,
  action: f.mode === "publish" ? "publish" : f.mode === "schedule" ? "schedule" : "draft",
});

const Preview = ({ f }) => (
  <div className="mc-card" aria-label="Preview" data-testid="promo-preview">
    <p className="mc-muted">Preview — as a company admin sees it</p>
    {isHttp(f.bannerUrl) && <img className="mc-banner" src={f.bannerUrl} alt="" />}
    <span className="mc-badge">{f.category}</span>
    <h3>{f.title || "Title"}</h3>
    <div className="mc-prewrap">{f.description || "Description…"}</div>
    {isHttp(f.ctaUrl) && f.ctaLabel && <span className="mc-btn primary" style={{ marginTop: 10 }}>{f.ctaLabel}</span>}
  </div>
);

const Editor = ({ initial, companies, onClose, onSaved }) => {
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");
  const set = (e) => setF((x) => ({ ...x, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const toggleCompany = (id) => setF((x) => ({ ...x, companyIds: x.companyIds.includes(id) ? x.companyIds.filter((c) => c !== id) : [...x.companyIds, id] }));

  const submit = async () => {
    const problems = validatePromotion(f);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setBusy(true);
    setServerError("");
    try {
      const body = toPayload(f);
      if (initial.id) await masterAdmin.updatePromotion(initial.id, body);
      else await masterAdmin.createPromotion(body);
      onSaved();
    } catch (e) {
      setServerError(errorMessage(e, "Could not save the promotion."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mc-modal-backdrop" role="dialog" aria-modal="true" aria-label={initial.id ? "Edit promotion" : "New promotion"}>
      <div className="mc-modal wide">
        <h3>{initial.id ? "Edit promotion" : "New promotion"}</h3>
        <div className="mc-form">
          <div className="mc-field wide"><label htmlFor="p-title">Title</label><input id="p-title" name="title" className="mc-input" value={f.title} onChange={set} maxLength={200} />{errors.title && <span className="mc-error">{errors.title}</span>}</div>
          <div className="mc-field wide"><label htmlFor="p-desc">Description</label><textarea id="p-desc" name="description" className="mc-textarea" value={f.description} onChange={set} maxLength={5000} />{errors.description && <span className="mc-error">{errors.description}</span>}</div>
          <div className="mc-field"><label htmlFor="p-cat">Category</label>
            <select id="p-cat" name="category" className="mc-select" value={f.category} onChange={set}>{PROMOTION_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="mc-field"><label htmlFor="p-banner">Banner image URL (optional)</label><input id="p-banner" name="bannerUrl" className="mc-input" value={f.bannerUrl} onChange={set} />{errors.bannerUrl && <span className="mc-error">{errors.bannerUrl}</span>}</div>
          <div className="mc-field"><label htmlFor="p-cta">CTA label (optional)</label><input id="p-cta" name="ctaLabel" className="mc-input" value={f.ctaLabel} onChange={set} maxLength={60} />{errors.ctaLabel && <span className="mc-error">{errors.ctaLabel}</span>}</div>
          <div className="mc-field"><label htmlFor="p-url">CTA URL (optional)</label><input id="p-url" name="ctaUrl" className="mc-input" value={f.ctaUrl} onChange={set} />{errors.ctaUrl && <span className="mc-error">{errors.ctaUrl}</span>}</div>

          <div className="mc-field wide">
            <label htmlFor="p-aud">Audience</label>
            <select id="p-aud" name="audienceType" className="mc-select" value={f.audienceType} onChange={set}>
              <option value="all">All active companies</option>
              <option value="selected">Selected companies</option>
            </select>
            {f.audienceType === "selected" && (
              <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--mc-border)", borderRadius: 9, padding: 8 }}>
                {companies.map((c) => (
                  <label key={c.id} style={{ display: "flex", gap: 8, padding: "3px 0" }}>
                    <input type="checkbox" checked={f.companyIds.includes(c.id)} onChange={() => toggleCompany(c.id)} /> {c.displayName || c.name} <span className="mc-muted">({c.code})</span>
                  </label>
                ))}
              </div>
            )}
            {errors.companyIds && <span className="mc-error">{errors.companyIds}</span>}
          </div>

          <div className="mc-field"><label htmlFor="p-mode">When</label>
            <select id="p-mode" name="mode" className="mc-select" value={f.mode} onChange={set}>
              <option value="draft">Save as draft</option>
              <option value="publish">Publish now</option>
              <option value="schedule">Schedule for later</option>
            </select></div>
          {f.mode === "schedule" && (
            <div className="mc-field"><label htmlFor="p-pub">Publish at</label><input id="p-pub" type="datetime-local" name="publishAt" className="mc-input" value={f.publishAt} onChange={set} />{errors.publishAt && <span className="mc-error">{errors.publishAt}</span>}</div>
          )}
          <div className="mc-field"><label htmlFor="p-exp">Expires at (optional)</label><input id="p-exp" type="datetime-local" name="expiresAt" className="mc-input" value={f.expiresAt} onChange={set} />{errors.expiresAt && <span className="mc-error">{errors.expiresAt}</span>}</div>
        </div>

        <div style={{ marginTop: 14 }}><Preview f={f} /></div>
        {serverError && <p className="mc-error" role="alert">{serverError}</p>}
        <div className="mc-actions">
          <button type="button" className="mc-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="mc-btn primary" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : f.mode === "publish" ? "Publish now" : f.mode === "schedule" ? "Schedule" : "Save draft"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Details = ({ id, onClose }) => {
  const [d, setD] = useState(null);
  useEffect(() => { masterAdmin.promotion(id).then(setD).catch(() => setD({ error: true })); }, [id]);
  return (
    <div className="mc-modal-backdrop" role="dialog" aria-modal="true" aria-label="Campaign details">
      <div className="mc-modal wide">
        {!d && <div className="mc-skel" aria-busy="true" />}
        {d?.error && <p className="mc-error" role="alert">Could not load the campaign.</p>}
        {d?.promotion && (
          <>
            <h3>{d.promotion.title}</h3>
            <p className="mc-muted">{d.promotion.category} · <span className={`mc-badge ${d.promotion.status}`}>{d.promotion.status}</span></p>
            <p data-testid="promo-stats">
              Delivered to <strong>{d.promotion.stats.deliveredCompanies}</strong> · Read by <strong>{d.promotion.stats.readCompanies}</strong> · Unread <strong>{d.promotion.stats.unreadCompanies}</strong> · Admins notified <strong>{d.promotion.stats.notifiedAdmins}</strong>
            </p>
            <div className="mc-table-wrap"><table className="mc-table"><thead><tr><th>Company</th><th>Delivered</th><th>Read</th></tr></thead>
              <tbody>
                {d.deliveries.length === 0 && <tr><td colSpan={3} className="mc-empty">Not delivered to anyone yet.</td></tr>}
                {d.deliveries.map((x) => <tr key={x.companyId}><td>{x.companyName}</td><td>{fmtDateTime(x.deliveredAt)}</td><td>{x.read ? "Read" : "Unread"}</td></tr>)}
              </tbody></table></div>
          </>
        )}
        <div className="mc-actions"><button type="button" className="mc-btn" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
};

const PromotionsPage = () => {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ promotions: [], total: 0 });
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(params.get("new") === "1" ? EMPTY : null);
  const [details, setDetails] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await masterAdmin.promotions({ status, q, page, limit }));
    } catch (e) {
      setError(errorMessage(e, "Could not load promotions."));
    } finally {
      setLoading(false);
    }
  }, [status, q, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { masterAdmin.companies({ limit: 100 }).then((r) => setCompanies(r.companies)).catch(() => setCompanies([])); }, []);

  const edit = (p) => setEditor({ ...EMPTY, id: p.id, title: p.title, description: p.description, category: p.category, bannerUrl: p.bannerUrl || "", audienceType: p.audienceType, companyIds: p.companyIds || [], ctaLabel: p.ctaLabel || "", ctaUrl: p.ctaUrl || "", publishAt: toInputDateTime(p.publishAt), expiresAt: toInputDateTime(p.expiresAt), sendEmail: p.sendEmail, mode: p.status === "Scheduled" ? "schedule" : "draft" });
  const cancel = async (p) => {
    try {
      await masterAdmin.cancelPromotion(p.id);
      setConfirmCancel(null);
      load();
    } catch (e) {
      setError(errorMessage(e, "Could not cancel the promotion."));
    }
  };
  const closeEditor = () => { setEditor(null); if (params.get("new")) setParams({}); };
  const pages = Math.max(1, Math.ceil(data.total / limit));

  return (
    <div>
      <div className="mc-head">
        <div><h1 className="mc-title">Promotions &amp; Announcements</h1><p className="mc-sub">Reach company administrators in their notification centre.</p></div>
        <button type="button" className="mc-btn primary" onClick={() => setEditor(EMPTY)}>+ New promotion</button>
      </div>
      <div className="mc-card">
        <div className="mc-filters">
          <input className="mc-input" placeholder="Search by title…" aria-label="Search promotions" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
          <select className="mc-select" aria-label="Status filter" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            <option value="">All statuses</option>{PROMOTION_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        {error && <p className="mc-error" role="alert">{error}</p>}
        {loading && <div className="mc-skel" aria-busy="true" />}
        <div className="mc-table-wrap">
          <table className="mc-table">
            <thead><tr><th>Title</th><th>Category</th><th>Audience</th><th>Status</th><th>Publish</th><th>Expires</th><th>Delivered</th><th>Read / Unread</th><th /></tr></thead>
            <tbody>
              {!loading && data.promotions.length === 0 && <tr><td colSpan={9} className="mc-empty">No promotions yet. Create your first campaign.</td></tr>}
              {data.promotions.map((p) => (
                <tr key={p.id}>
                  <td><button type="button" className="mc-link" onClick={() => setDetails(p.id)}>{p.title}</button></td>
                  <td>{p.category}</td>
                  <td>{p.audienceType === "all" ? "All companies" : `${(p.companyIds || []).length} selected`}</td>
                  <td><span className={`mc-badge ${p.status}`}>{p.status}</span></td>
                  <td>{fmtDateTime(p.publishedAt || p.publishAt)}</td>
                  <td>{p.expiresAt ? fmtDateTime(p.expiresAt) : "—"}</td>
                  <td>{p.stats.deliveredCompanies}</td>
                  <td>{p.stats.readCompanies} / {p.stats.unreadCompanies}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {["Draft", "Scheduled"].includes(p.status) && <button type="button" className="mc-btn" onClick={() => edit(p)}>Edit</button>}{" "}
                    {["Draft", "Scheduled", "Published"].includes(p.status) && (confirmCancel === p.id
                      ? <><button type="button" className="mc-btn danger" onClick={() => cancel(p)}>Confirm cancel</button> <button type="button" className="mc-btn" onClick={() => setConfirmCancel(null)}>Keep</button></>
                      : <button type="button" className="mc-btn danger" onClick={() => setConfirmCancel(p.id)}>Cancel</button>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mc-pager">
          <button type="button" className="mc-btn" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>‹ Prev</button>
          <span className="mc-muted">Page {page} of {pages} · {data.total} campaigns</span>
          <button type="button" className="mc-btn" disabled={page >= pages} onClick={() => setPage((x) => x + 1)}>Next ›</button>
        </div>
      </div>
      {editor && <Editor initial={editor} companies={companies} onClose={closeEditor} onSaved={() => { closeEditor(); load(); }} />}
      {details && <Details id={details} onClose={() => setDetails(null)} />}
    </div>
  );
};

export default PromotionsPage;
