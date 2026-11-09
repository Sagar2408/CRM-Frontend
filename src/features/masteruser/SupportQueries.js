import React, { useCallback, useEffect, useState } from "react";
import "../../styles/support.css";
import TicketThread, { StatusBadge, fmtDate } from "../support/TicketThread";
import { masterSupport, SUPPORT_CATEGORIES, SUPPORT_STATUSES } from "../../services/supportService";
import { useCompany } from "../../context/CompanyContext";

const FILTERS = { companyId: "", status: "", category: "", from: "", to: "", unread: false, q: "" };

const SupportQueries = () => {
  const { companies } = useCompany();
  const [filters, setFilters] = useState(FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ tickets: [], total: 0, limit: 20 });
  const [summary, setSummary] = useState({ unread: 0, byStatus: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 20 };
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== "" && v !== false) params[k] = v;
      });
      const [list, sum] = await Promise.all([masterSupport.list(params), masterSupport.summary()]);
      setData(list);
      setSummary(sum);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (name, value) => {
    setPage(1);
    setFilters((f) => ({ ...f, [name]: value }));
  };

  const openTicket = async (id) => {
    try {
      setOpen(await masterSupport.get(id));
      load(); // clears the unread marker in the list + counters
    } catch (e) {
      setError(e.message);
    }
  };

  const reply = async (message, file, status) => {
    await masterSupport.reply(open.ticket.id, message, status, file);
    setOpen(await masterSupport.get(open.ticket.id));
    load();
  };

  const changeStatus = async (status) => {
    try {
      await masterSupport.setStatus(open.ticket.id, status);
      setOpen(await masterSupport.get(open.ticket.id));
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const pages = Math.max(1, Math.ceil(data.total / (data.limit || 20)));

  return (
    <div className="table-section-wrapper sp-master">
      <div className="table-section">
        <div className="table-header">
          <h2>
            Support Queries
            {summary.unread > 0 && <span className="sp-count">{summary.unread} new</span>}
          </h2>
          <div className="sp-stats">
            {SUPPORT_STATUSES.map((s) => (
              <span key={s}>
                {s}: <strong>{summary.byStatus?.[s] ?? 0}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="sp-filters">
          <input placeholder="Search subject / company / admin" value={filters.q} onChange={(e) => setFilter("q", e.target.value)} />
          <select value={filters.companyId} onChange={(e) => setFilter("companyId", e.target.value)}>
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">All statuses</option>
            {SUPPORT_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select value={filters.category} onChange={(e) => setFilter("category", e.target.value)}>
            <option value="">All categories</option>
            {SUPPORT_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="sp-inline">
            From <input type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} />
          </label>
          <label className="sp-inline">
            To <input type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} />
          </label>
          <label className="sp-inline">
            <input type="checkbox" checked={filters.unread} onChange={(e) => setFilter("unread", e.target.checked)} /> Unread only
          </label>
          <button className="sp-link" onClick={() => { setPage(1); setFilters(FILTERS); }}>
            Clear
          </button>
        </div>

        {error && <p className="sp-error">{error}</p>}

        <div className="sp-table-wrap">
          <table className="sp-table company-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Company</th>
                <th>Admin</th>
                <th>Email</th>
                <th>Category</th>
                <th>Subject</th>
                <th>Submitted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {!loading && data.tickets.length === 0 && (
                <tr>
                  <td colSpan={8} className="sp-muted">
                    No support queries match these filters.
                  </td>
                </tr>
              )}
              {data.tickets.map((t) => (
                <tr key={t.id} className={`sp-row ${t.unread ? "sp-unread" : ""}`} onClick={() => openTicket(t.id)}>
                  <td>
                    {t.ticketNumber}
                    {t.unread && <span className="sp-new">New</span>}
                  </td>
                  <td>{t.companyName}</td>
                  <td>{t.adminName}</td>
                  <td>{t.adminEmail}</td>
                  <td>{t.category}</td>
                  <td>{t.subject}</td>
                  <td>{fmtDate(t.createdAt)}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sp-pager">
          <button className="sp-link" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ‹ Prev
          </button>
          <span>
            Page {page} of {pages} · {data.total} total
          </span>
          <button className="sp-link" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next ›
          </button>
        </div>

        {open && (
          <div className="sp-detail">
            <div className="sp-detail-bar">
              <button className="sp-link" onClick={() => setOpen(null)}>
                ← Close
              </button>
              <div className="sp-detail-info">
                <span>
                  <strong>{open.ticket.adminName}</strong> · {open.ticket.adminEmail}
                  {open.ticket.contactNumber ? ` · ${open.ticket.contactNumber}` : ""}
                </span>
                <label className="sp-inline">
                  Status
                  <select value={open.ticket.status} onChange={(e) => changeStatus(e.target.value)}>
                    {SUPPORT_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <TicketThread
              ticket={open.ticket}
              conversation={open.conversation}
              onReply={reply}
              onDownload={(m) => masterSupport.download(open.ticket.id, m.id, m.attachment.name).catch((e) => setError(e.message))}
              statusOptions={[{ value: "", label: "Replied (default)" }, ...SUPPORT_STATUSES.map((s) => ({ value: s, label: s }))]}
              defaultReplyStatus=""
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportQueries;
