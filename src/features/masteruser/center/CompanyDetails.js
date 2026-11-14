import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { masterAdmin, errorMessage, fmtDate, fmtDateTime, SUBSCRIPTION_LABELS, STAGE_LABELS } from "../../../services/masterAdminService";
import { masterSupport } from "../../../services/supportService";
import OverviewTab from "./setup/OverviewTab";
import SubscriptionTab from "./setup/SubscriptionTab";
import AdminTab from "./setup/AdminTab";
import DatabaseTab from "./setup/DatabaseTab";
import { Msg, useReportDirty, confirmAction } from "./setup/common";
import "../../../styles/masterCenter.css";

export const TABS = ["Overview", "Subscription", "Admin Users", "Activity", "Promotions", "Support Tickets", "Features", "Internal Notes", "Database Configuration"];

const Activity = ({ company }) => {
  const [rows, setRows] = useState(null);
  useEffect(() => { masterAdmin.activity(company.id).then(setRows).catch(() => setRows([])); }, [company.id]);
  if (!rows) return <div className="mc-card"><div className="mc-skel" aria-busy="true" /></div>;
  return (
    <div className="mc-card">
      {rows.length === 0 ? <p className="mc-empty">No recorded activity for this company yet.</p> : (
        <div className="mc-table-wrap"><table className="mc-table"><thead><tr><th>When</th><th>Action</th><th>By</th></tr></thead>
          <tbody>{rows.map((a) => <tr key={a.id}><td>{fmtDateTime(a.createdAt)}</td><td>{String(a.action).replace(/[._]/g, " ")}</td><td>{a.actorEmail || "—"}</td></tr>)}</tbody></table></div>
      )}
    </div>
  );
};

const CompanyPromotions = ({ company }) => {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    masterAdmin.promotions({ limit: 100 }).then((r) => setRows(r.promotions.filter((p) => p.audienceType === "all" || (p.companyIds || []).includes(company.id)))).catch(() => setRows([]));
  }, [company.id]);
  if (!rows) return <div className="mc-card"><div className="mc-skel" aria-busy="true" /></div>;
  return (
    <div className="mc-card">
      {rows.length === 0 ? <p className="mc-empty">No promotions target this company.</p> : (
        <div className="mc-table-wrap"><table className="mc-table"><thead><tr><th>Title</th><th>Category</th><th>Audience</th><th>Status</th><th>Published</th></tr></thead>
          <tbody>{rows.map((p) => <tr key={p.id}><td>{p.title}</td><td>{p.category}</td><td>{p.audienceType === "all" ? "All companies" : "Selected"}</td><td><span className={`mc-badge ${p.status}`}>{p.status}</span></td><td>{fmtDate(p.publishedAt)}</td></tr>)}</tbody></table></div>
      )}
    </div>
  );
};

const Tickets = ({ company }) => {
  const [rows, setRows] = useState(null);
  useEffect(() => { masterSupport.list({ companyId: company.id, limit: 20 }).then((r) => setRows(r.tickets)).catch(() => setRows([])); }, [company.id]);
  if (!rows) return <div className="mc-card"><div className="mc-skel" aria-busy="true" /></div>;
  return (
    <div className="mc-card">
      {rows.length === 0 ? <p className="mc-empty">This company has no support tickets.</p> : (
        <div className="mc-table-wrap"><table className="mc-table"><thead><tr><th>Ticket</th><th>Subject</th><th>Priority</th><th>Status</th><th>Assigned</th></tr></thead>
          <tbody>{rows.map((t) => <tr key={t.id}><td>{t.ticketNumber}</td><td>{t.subject}</td><td>{t.priority}</td><td>{t.status}</td><td>{t.assignedTo || "—"}</td></tr>)}</tbody></table></div>
      )}
      <p className="mc-muted"><Link className="mc-link" to="/master/support">Open the support queue</Link> to reply or assign.</p>
    </div>
  );
};

export const Features = ({ company }) => {
  const [modules, setModules] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { masterAdmin.features(company.id).then(setModules).catch((e) => setMsg({ type: "error", text: errorMessage(e, "Could not load features.") })); }, [company.id]);
  const toggle = async (m) => {
    try {
      setModules(await masterAdmin.updateFeatures(company.id, { [m.key]: !m.enabled }));
      setMsg({ type: "ok", text: `${m.label} ${m.enabled ? "disabled" : "enabled"}. Enforced on the server immediately.` });
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not update the feature.") });
    }
  };
  return (
    <div className="mc-card">
      <p className="mc-muted">Disabling a module blocks its API for this company on the server (not just the menu). Core access — login, settings, notifications, support, leads — is always on.</p>
      <Msg msg={msg} />
      {!modules && !msg && <div className="mc-skel" aria-busy="true" />}
      {(modules || []).map((m) => (
        <div className="mc-switch-row" key={m.key}>
          <span>{m.label}</span>
          <label><input type="checkbox" role="switch" aria-label={m.label} checked={m.enabled} onChange={() => toggle(m)} /> {m.enabled ? "Enabled" : "Disabled"}</label>
        </div>
      ))}
    </div>
  );
};

const Notes = ({ company, reload, setDirty }) => {
  const [text, setText] = useState(company.internalNotes || "");
  useReportDirty(text !== (company.internalNotes || ""), setDirty);
  const [msg, setMsg] = useState(null);
  const save = async () => {
    try {
      await masterAdmin.updateCompany(company.id, { internalNotes: text });
      setMsg({ type: "ok", text: "Notes saved." });
      reload();
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not save notes.") });
    }
  };
  return (
    <div className="mc-card">
      <p className="mc-muted">Private to Master admins. Never shown to the company.</p>
      <textarea className="mc-textarea" aria-label="Internal notes" style={{ minHeight: 180 }} value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} />
      <Msg msg={msg} />
      <div className="mc-actions"><button type="button" className="mc-btn primary" onClick={save}>Save notes</button></div>
    </div>
  );
};

// ---------------------------------------------------------------- page
// One workspace for both setting up a NEW company (route /master/companies/new) and managing an
// existing one (/master/companies/:id). A new company only exists after "Save draft"; until then
// only the Overview tab is available.
const CompanyDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const [company, setCompany] = useState(null);
  const [tab, setTab] = useState("Overview");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setCompany(await masterAdmin.company(id));
      setError("");
    } catch (e) {
      setError(errorMessage(e, "Could not load this company."));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Warn before closing / reloading the browser tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const leaveOk = () => !dirtyRef.current || confirmAction("You have unsaved changes. Discard them?");
  const goTab = (t) => {
    if (t === tab || !leaveOk()) return;
    setDirty(false);
    setTab(t);
  };
  const onCreated = (newId) => navigate(`/master/companies/${newId}`, { replace: true });

  if (error) return <div className="mc-card"><p className="mc-error" role="alert">{error}</p><Link className="mc-link" to="/master/companies">← Back to companies</Link></div>;
  if (!isNew && !company) return <div className="mc-card"><div className="mc-skel" aria-busy="true" /></div>;

  const shared = { company: isNew ? null : company, reload: load, setDirty };
  const body = {
    Overview: <OverviewTab key={isNew ? "new" : company.updatedAt} {...shared} goTab={goTab} onCreated={onCreated} />,
    Subscription: <SubscriptionTab key={company?.updatedAt} {...shared} />,
    "Admin Users": <AdminTab {...shared} />,
    Activity: <Activity company={company} />,
    Promotions: <CompanyPromotions company={company} />,
    "Support Tickets": <Tickets company={company} />,
    Features: <Features company={company} />,
    "Internal Notes": <Notes key={company?.updatedAt} {...shared} />,
    "Database Configuration": <DatabaseTab {...shared} />,
  }[tab];

  const stage = company?.setup?.stage;
  return (
    <div>
      <div className="mc-head">
        <div>
          <Link className="mc-link" to="/master/companies" onClick={(e) => { if (!leaveOk()) e.preventDefault(); }}>← Companies</Link>
          <h1 className="mc-title">{isNew ? "New company" : company.displayName || company.name}</h1>
          <p className="mc-sub">
            {isNew ? "Enter the company details, then save the draft to continue setup." : (
              <>
                {company.code} · <span className={`mc-badge stage-${stage}`}>{STAGE_LABELS[stage] || stage}</span>
                {company.provisioning !== "draft" && <> · <span className={`mc-badge ${company.subscriptionStatus}`}>{SUBSCRIPTION_LABELS[company.subscriptionStatus]}</span></>}
              </>
            )}
            {dirty && <span className="mc-unsaved" role="status"> · Unsaved changes</span>}
          </p>
        </div>
      </div>
      <div className="mc-tabs" role="tablist" aria-label="Company sections">
        {TABS.map((t) => {
          const locked = isNew && t !== "Overview";
          return (
            <button key={t} type="button" role="tab" aria-selected={tab === t} aria-disabled={locked || undefined} disabled={locked}
              title={locked ? "Save the draft first" : undefined} className={`mc-tab${tab === t ? " active" : ""}`} onClick={() => goTab(t)}>{t}</button>
          );
        })}
      </div>
      {body}
    </div>
  );
};

export default CompanyDetails;
