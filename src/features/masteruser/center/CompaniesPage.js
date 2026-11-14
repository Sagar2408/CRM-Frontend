import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { masterAdmin, errorMessage, fmtDate, SUBSCRIPTION_LABELS, STAGE_LABELS } from "../../../services/masterAdminService";
import "../../../styles/masterCenter.css";

const FILTERS = [["", "All"], ["active", "Active"], ["expiring_soon", "Expiring soon"], ["expired", "Expired"], ["trial", "Trial"], ["suspended", "Suspended"]];

const CompaniesPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [subscription, setSubscription] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ companies: [], total: 0, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await masterAdmin.companies({ q, subscription, page, limit }));
    } catch (e) {
      setError(errorMessage(e, "Could not load companies."));
    } finally {
      setLoading(false);
    }
  }, [q, subscription, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    if (params.get("add") === "1") navigate("/master/companies/new", { replace: true });
  }, [params, navigate]);

  const toggle = async (c) => {
    if (c.status === "active" && !window.confirm(`Suspend ${c.name}? Its users will lose access immediately.`)) return;
    try {
      await masterAdmin.updateCompany(c.id, { status: c.status === "active" ? "paused" : "active" });
      load();
    } catch (e) {
      setError(errorMessage(e, "Could not change the company status."));
    }
  };

  const pages = Math.max(1, Math.ceil(data.total / limit));

  return (
    <div>
      <div className="mc-head">
        <div>
          <h1 className="mc-title">Companies</h1>
          <p className="mc-sub">Create, review and manage every tenant company.</p>
        </div>
        <button type="button" className="mc-btn primary" onClick={() => navigate("/master/companies/new")}>+ Add company</button>
      </div>

      <div className="mc-card">
        <div className="mc-filters">
          <input className="mc-input" placeholder="Search name, code, contact…" aria-label="Search companies" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
          <select className="mc-select" aria-label="Subscription filter" value={subscription} onChange={(e) => { setPage(1); setSubscription(e.target.value); }}>
            {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {error && <p className="mc-error" role="alert">{error}</p>}
        {loading && <div className="mc-skel" aria-busy="true" />}
        <div className="mc-table-wrap">
          <table className="mc-table">
            <thead>
              <tr><th>Company</th><th>Code</th><th>Plan</th><th>Setup</th><th>Subscription</th><th>Expiry</th><th>Admin</th><th>Registered</th><th>Action</th></tr>
            </thead>
            <tbody>
              {!loading && data.companies.length === 0 && (
                <tr><td colSpan={9} className="mc-empty">No companies match these filters.</td></tr>
              )}
              {data.companies.map((c) => (
                <tr key={c.id} data-testid={`company-row-${c.code}`}>
                  <td>
                    <Link className="mc-link" to={`/master/companies/${c.id}`}>{c.displayName || c.name}</Link>
                    {c.displayName && c.displayName !== c.name && <div className="mc-muted">{c.name}</div>}
                  </td>
                  <td>{c.code}</td>
                  <td>{c.plan || "—"}</td>
                  <td><span className={`mc-badge stage-${c.setup?.stage || "active"}`}>{STAGE_LABELS[c.setup?.stage || "active"]}</span></td>
                  <td><span className={`mc-badge ${c.subscriptionStatus}`}>{SUBSCRIPTION_LABELS[c.subscriptionStatus]}</span></td>
                  <td>{fmtDate(c.expiryDate)}</td>
                  <td>{c.adminClaimedAt ? "Registered" : "Not registered"}</td>
                  <td>{fmtDate(c.createdAt)}</td>
                  <td>
                    {c.provisioning === "draft" ? (
                      <Link className="mc-btn" to={`/master/companies/${c.id}`}>Continue setup</Link>
                    ) : (
                      <button type="button" className={`mc-btn${c.status === "active" ? "" : " danger"}`} onClick={() => toggle(c)} aria-label={`${c.status === "active" ? "Suspend" : "Activate"} ${c.name}`}>
                        {c.status === "active" ? "Suspend" : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mc-pager">
          <button type="button" className="mc-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
          <span className="mc-muted">Page {page} of {pages} · {data.total} companies</span>
          <button type="button" className="mc-btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
        </div>
      </div>

    </div>
  );
};

export default CompaniesPage;
