import React, { useCallback, useEffect, useRef, useState } from "react";
import "../../styles/support.css";
import SidebarToggle from "./SidebarToggle";
import { Alert, soundManager } from "../modal/alert";
import TicketThread, { StatusBadge, fmtDate, validateAttachment } from "../support/TicketThread";
import { companySupport, formatCountdown, SUPPORT_CATEGORIES } from "../../services/supportService";

const EMPTY = { category: "", subject: "", description: "", contactNumber: "" };

const SupportTickets = () => {
  const [ctx, setCtx] = useState(null); // auto-filled admin/company details
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [fieldError, setFieldError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [wait, setWait] = useState(0); // seconds until next new query allowed
  const [tickets, setTickets] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [open, setOpen] = useState(null); // { ticket, conversation }
  const [alerts, setAlerts] = useState([]);
  const threadRef = useRef(null);

  const notify = useCallback((type, title, message) => {
    setAlerts((a) => [...a, { id: Date.now() + Math.random(), type, title, message, duration: 5000 }]);
    soundManager.playSound(type === "success" ? "success" : "error");
  }, []);

  const loadList = useCallback(async () => {
    try {
      const data = await companySupport.list(1, 50);
      setTickets(data.tickets);
    } catch (e) {
      notify("error", "Load Failed", e.message);
    } finally {
      setLoadingList(false);
    }
  }, [notify]);

  useEffect(() => {
    (async () => {
      try {
        const c = await companySupport.form();
        setCtx(c);
        setWait(c.retryAfterSeconds || 0);
        setForm((f) => ({ ...f, contactNumber: c.contactNumber || "" }));
      } catch (e) {
        notify("error", "Load Failed", e.message);
      }
    })();
    loadList();
  }, [loadList, notify]);

  // Countdown. The server is the source of truth; this only mirrors it.
  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => clearInterval(t);
  }, [wait > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const pickFile = (e) => {
    const f = e.target.files?.[0] || null;
    const problem = validateAttachment(f);
    setFieldError(problem);
    if (problem) {
      e.target.value = "";
      setFile(null);
    } else setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting || wait > 0) return;
    setSubmitting(true);
    setFieldError("");
    try {
      await companySupport.create(form, file);
      notify("success", "Query Submitted", "Our team will get back to you soon.");
      setForm({ ...EMPTY, contactNumber: form.contactNumber });
      setFile(null);
      setFileKey((k) => k + 1);
      setWait(ctx?.cooldownSeconds || 600);
      loadList();
    } catch (err) {
      if (err.code === "SUPPORT_COOLDOWN") {
        setWait(err.retryAfterSeconds || 0);
        notify("error", "Please wait", err.message);
      } else {
        setFieldError(err.errors?.map((x) => x.message).join(" ") || err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openTicket = async (id) => {
    try {
      setOpen(await companySupport.get(id));
      setTickets((ts) => ts.map((t) => (t.id === id ? { ...t, unread: false } : t)));
      setTimeout(() => threadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      notify("error", "Load Failed", e.message);
    }
  };

  const reply = async (message, attachment) => {
    await companySupport.reply(open.ticket.id, message, attachment);
    setOpen(await companySupport.get(open.ticket.id));
    loadList();
  };

  return (
    <>
      <SidebarToggle />
      <div className="sp-page">
        <h2 className="sp-title">Help &amp; Support</h2>
        <p className="sp-sub">Submit a query to our support team and track every reply here.</p>

        <section className="sp-card">
          <h3>Submit a Support Query</h3>
          <form onSubmit={submit} className="sp-form">
            <div className="sp-grid">
              <label>
                Admin Name
                <input value={ctx?.adminName || ""} readOnly />
              </label>
              <label>
                Company Name
                <input value={ctx?.companyName || ""} readOnly />
              </label>
              <label>
                Email Address
                <input value={ctx?.email || ""} readOnly />
              </label>
              <label>
                Contact Number
                <input name="contactNumber" value={form.contactNumber} onChange={change} placeholder="+91 98765 43210" required maxLength={20} />
              </label>
              <label>
                Problem Category
                <select name="category" value={form.category} onChange={change} required>
                  <option value="" disabled>
                    Select a category
                  </option>
                  {(ctx?.categories || SUPPORT_CATEGORIES).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Problem Subject
                <input name="subject" value={form.subject} onChange={change} required minLength={3} maxLength={200} />
              </label>
            </div>
            <label>
              Problem Description / Message
              <textarea name="description" value={form.description} onChange={change} rows={5} required minLength={10} maxLength={5000} />
            </label>
            <label>
              Attachment (optional — JPEG, PNG, WEBP or PDF, max 5MB)
              <input key={fileKey} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={pickFile} />
            </label>
            {fieldError && <p className="sp-error">{fieldError}</p>}
            {wait > 0 && (
              <p className="sp-wait">
                You can submit another query in <strong>{formatCountdown(wait)}</strong>. You can still reply to existing tickets.
              </p>
            )}
            <button type="submit" className="sp-btn" disabled={submitting || wait > 0}>
              {submitting ? "Submitting…" : "Submit Query"}
            </button>
          </form>
        </section>

        <section className="sp-card">
          <h3>Support History</h3>
          {loadingList ? (
            <p className="sp-muted">Loading…</p>
          ) : tickets.length === 0 ? (
            <p className="sp-muted">You haven't submitted any queries yet.</p>
          ) : (
            <div className="sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Subject</th>
                    <th>Category</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Latest Reply</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} className={`sp-row ${t.unread ? "sp-unread" : ""}`} onClick={() => openTicket(t.id)}>
                      <td>
                        {t.ticketNumber}
                        {t.unread && <span className="sp-new">New reply</span>}
                      </td>
                      <td>{t.subject}</td>
                      <td>{t.category}</td>
                      <td>{fmtDate(t.createdAt)}</td>
                      <td>
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="sp-latest">{t.latestReply ? t.latestReply.body : <span className="sp-muted">No reply yet</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {open && (
          <section className="sp-card" ref={threadRef}>
            <button className="sp-link" onClick={() => setOpen(null)}>
              ← Close conversation
            </button>
            <TicketThread
              ticket={open.ticket}
              conversation={open.conversation}
              onReply={reply}
              onDownload={(m) => companySupport.download(open.ticket.id, m.id, m.attachment.name).catch((e) => notify("error", "Download Failed", e.message))}
              placeholder="Add a follow-up message…"
              sendLabel="Send Message"
            />
          </section>
        )}
      </div>
      <Alert alerts={alerts} onClose={(id) => setAlerts((a) => a.filter((x) => x.id !== id))} />
    </>
  );
};

export default SupportTickets;
