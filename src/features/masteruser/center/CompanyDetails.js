import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { masterAdmin, errorMessage, fmtDate, fmtDateTime, toInputDate, SUBSCRIPTION_LABELS } from "../../../services/masterAdminService";
import { masterSupport } from "../../../services/supportService";
import CompanyProfileFields, { EMPTY_PROFILE, toBody, validateProfile } from "./CompanyProfileFields";
import "../../../styles/masterCenter.css";

export const TABS = ["Overview", "Subscription", "Admin Users", "Activity", "Promotions", "Support Tickets", "Features", "Internal Notes"];

const formFrom = (c) => ({
  ...EMPTY_PROFILE,
  ...Object.fromEntries(Object.keys(EMPTY_PROFILE).map((k) => [k, k === "isTrial" ? !!c.isTrial : ["subscriptionStart", "expiryDate", "trialEndsAt"].includes(k) ? toInputDate(c[k]) : c[k] ?? ""])),
});

const Msg = ({ msg }) => (msg ? <p className={msg.type === "error" ? "mc-error" : "mc-ok"} role={msg.type === "error" ? "alert" : "status"}>{msg.text}</p> : null);

// ---------------------------------------------------------------- tabs
const Overview = ({ company, reload }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => formFrom(company));
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);

  const save = async () => {
    const problems = validateProfile(form);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    const { plan, subscriptionStart, expiryDate, userLimit, storageLimitMb, isTrial, trialEndsAt, ...profile } = toBody(form);
    try {
      await masterAdmin.updateCompany(company.id, profile);
      setEditing(false);
      setMsg({ type: "ok", text: "Company updated." });
      reload();
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not update the company.") });
    }
  };
  const setStatus = async (status) => {
    try {
      await masterAdmin.updateCompany(company.id, { status });
      setMsg({ type: "ok", text: status === "active" ? "Company activated." : "Company suspended." });
      reload();
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not change the status.") });
    }
  };

  const rows = [
    ["Legal name", company.legalName], ["Display name", company.displayName], ["Company code", company.code], ["Industry", company.industry],
    ["Website", company.website], ["Contact person", company.contactPerson], ["Contact email", company.contactEmail], ["Contact phone", company.contactPhone],
    ["Account manager", company.accountManager], ["Location", [company.city, company.state, company.country].filter(Boolean).join(", ")],
    ["Address", company.address], ["Description", company.description], ["Registered", fmtDate(company.createdAt)],
    ["Admin account", company.adminClaimedAt ? `Registered ${fmtDate(company.adminClaimedAt)}` : "Not registered yet"],
  ];
  return (
    <div className="mc-card">
      <Msg msg={msg} />
      {editing ? (
        <>
          <CompanyProfileFields values={form} onChange={setForm} errors={errors} withSubscription={false} />
          <div className="mc-actions">
            <button type="button" className="mc-btn" onClick={() => { setEditing(false); setForm(formFrom(company)); setErrors({}); }}>Cancel</button>
            <button type="button" className="mc-btn primary" onClick={save}>Save changes</button>
          </div>
        </>
      ) : (
        <>
          <dl className="mc-dl">{rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>))}</dl>
          <div className="mc-actions">
            <button type="button" className="mc-btn" onClick={() => setEditing(true)}>Edit company</button>
            {company.status === "active"
              ? <button type="button" className="mc-btn danger" onClick={() => setStatus("paused")}>Suspend company</button>
              : <button type="button" className="mc-btn primary" onClick={() => setStatus("active")}>Activate company</button>}
          </div>
        </>
      )}
    </div>
  );
};

const Subscription = ({ company, reload }) => {
  const [form, setForm] = useState(() => formFrom(company));
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  const save = async () => {
    const problems = validateProfile(form);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    const b = toBody(form);
    try {
      await masterAdmin.updateSubscription(company.id, { plan: b.plan, subscriptionStart: b.subscriptionStart, expiryDate: b.expiryDate, userLimit: b.userLimit, storageLimitMb: b.storageLimitMb, isTrial: b.isTrial, trialEndsAt: b.trialEndsAt });
      setMsg({ type: "ok", text: "Subscription updated. Tenant data and database connection are unchanged." });
      reload();
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not update the subscription.") });
    }
  };
  const renew = async (months) => {
    try {
      await masterAdmin.renew(company.id, months);
      setMsg({ type: "ok", text: `Renewed for ${months} month(s).` });
      reload();
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not renew.") });
    }
  };
  const remind = async () => {
    try {
      const r = await masterAdmin.expiryReminder(company.id);
      setMsg({ type: "ok", text: r.message });
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not send the reminder.") });
    }
  };
  return (
    <div className="mc-card">
      <p>Status: <span className={`mc-badge ${company.subscriptionStatus}`}>{SUBSCRIPTION_LABELS[company.subscriptionStatus]}</span> · Expires {fmtDate(company.expiryDate)}</p>
      <Msg msg={msg} />
      <div className="mc-form" style={{ margin: "12px 0" }}>
        {[["plan", "Subscription plan", "text"], ["subscriptionStart", "Subscription start", "date"], ["expiryDate", "Subscription expiry", "date"], ["userLimit", "Employee / user limit", "number"], ["storageLimitMb", "Storage limit (MB)", "number"]].map(([k, l, t]) => (
          <div className="mc-field" key={k}>
            <label htmlFor={`sub-${k}`}>{l}</label>
            <input id={`sub-${k}`} type={t} className="mc-input" value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            {errors[k] && <span className="mc-error">{errors[k]}</span>}
          </div>
        ))}
        <div className="mc-field">
          <label htmlFor="sub-trial">Trial</label>
          <label className="mc-switch-row" style={{ border: 0, padding: 0 }}><input id="sub-trial" type="checkbox" checked={!!form.isTrial} onChange={(e) => setForm({ ...form, isTrial: e.target.checked })} /> Trial account</label>
        </div>
        {form.isTrial && (
          <div className="mc-field">
            <label htmlFor="sub-trialends">Trial ends</label>
            <input id="sub-trialends" type="date" className="mc-input" value={form.trialEndsAt || ""} onChange={(e) => setForm({ ...form, trialEndsAt: e.target.value })} />
          </div>
        )}
      </div>
      <div className="mc-actions" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="mc-btn primary" onClick={save}>Save subscription</button>
        {[1, 3, 6, 12].map((m) => <button key={m} type="button" className="mc-btn" onClick={() => renew(m)}>Renew +{m} mo</button>)}
        <button type="button" className="mc-btn" onClick={remind}>Send expiry reminder</button>
      </div>
    </div>
  );
};

const AdminUsers = ({ company }) => {
  const [admins, setAdmins] = useState(null);
  const [pw, setPw] = useState({});
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    masterAdmin.admins(company.id).then((r) => setAdmins(r.admins)).catch((e) => setMsg({ type: "error", text: errorMessage(e, "Could not load admins.") }));
  }, [company.id]);
  const reset = async (id) => {
    if ((pw[id] || "").length < 8) return setMsg({ type: "error", text: "Password must be at least 8 characters." });
    try {
      await masterAdmin.resetAdminPassword(company.id, id, pw[id]);
      setPw({ ...pw, [id]: "" });
      setMsg({ type: "ok", text: "Admin password updated. Share it securely." });
    } catch (e) {
      setMsg({ type: "error", text: errorMessage(e, "Could not reset the password.") });
    }
  };
  return (
    <div className="mc-card">
      <Msg msg={msg} />
      {admins === null && !msg && <div className="mc-skel" aria-busy="true" />}
      {admins && admins.length === 0 && <p className="mc-empty">No admin has registered yet. Generate an admin token from the Companies list.</p>}
      {admins && admins.length > 0 && (
        <div className="mc-table-wrap">
          <table className="mc-table">
            <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Access</th><th>Reset password</th></tr></thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td>{[a.firstname, a.lastname].filter(Boolean).join(" ") || "—"}</td>
                  <td>{a.username}</td>
                  <td>{a.email}</td>
                  <td>{a.can_login ? "Enabled" : "Disabled"}</td>
                  <td>
                    <input className="mc-input" type="password" autoComplete="new-password" aria-label={`New password for ${a.username}`} value={pw[a.id] || ""} onChange={(e) => setPw({ ...pw, [a.id]: e.target.value })} />{" "}
                    <button type="button" className="mc-btn" onClick={() => reset(a.id)}>Reset</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

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

const Notes = ({ company, reload }) => {
  const [text, setText] = useState(company.internalNotes || "");
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
const CompanyDetails = () => {
  const { id } = useParams();
  const [company, setCompany] = useState(null);
  const [tab, setTab] = useState("Overview");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setCompany(await masterAdmin.company(id));
      setError("");
    } catch (e) {
      setError(errorMessage(e, "Could not load this company."));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="mc-card"><p className="mc-error" role="alert">{error}</p><Link className="mc-link" to="/master/companies">← Back to companies</Link></div>;
  if (!company) return <div className="mc-card"><div className="mc-skel" aria-busy="true" /></div>;

  const body = {
    Overview: <Overview key={company.updatedAt} company={company} reload={load} />,
    Subscription: <Subscription key={company.updatedAt} company={company} reload={load} />,
    "Admin Users": <AdminUsers company={company} />,
    Activity: <Activity company={company} />,
    Promotions: <CompanyPromotions company={company} />,
    "Support Tickets": <Tickets company={company} />,
    Features: <Features company={company} />,
    "Internal Notes": <Notes key={company.updatedAt} company={company} reload={load} />,
  }[tab];

  return (
    <div>
      <div className="mc-head">
        <div>
          <Link className="mc-link" to="/master/companies">← Companies</Link>
          <h1 className="mc-title">{company.displayName || company.name}</h1>
          <p className="mc-sub">
            {company.code} · <span className={`mc-badge ${company.subscriptionStatus}`}>{SUBSCRIPTION_LABELS[company.subscriptionStatus]}</span>
            {company.status !== "active" && <> · <span className="mc-badge suspended">{company.status}</span></>}
          </p>
        </div>
      </div>
      <div className="mc-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`mc-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {body}
    </div>
  );
};

export default CompanyDetails;
