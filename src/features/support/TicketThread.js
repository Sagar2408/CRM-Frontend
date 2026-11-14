import React, { useState } from "react";

// Shared conversation view + reply box, used by the company Admin's
// Support History and the Master Admin's Support Queries. Message text is
// rendered as plain text (React escapes it) — never as HTML.

const MAX_FILE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export const validateAttachment = (file) => {
  if (!file) return "";
  if (!ALLOWED_TYPES.includes(file.type)) return "Attachment must be a JPEG, PNG, WEBP or PDF file.";
  if (file.size > MAX_FILE) return "Attachment must be 5MB or smaller.";
  return "";
};

export const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "");
const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export const StatusBadge = ({ status }) => (
  <span className={`sp-badge sp-badge-${String(status).toLowerCase().replace(/\s+/g, "-")}`}>{status}</span>
);

const TicketThread = ({
  ticket,
  conversation,
  onReply, // async (message, file, status?) => void
  onDownload, // (message) => void
  statusOptions, // master only: [{value,label}] to pick alongside reply
  defaultReplyStatus,
  placeholder = "Write a reply…",
  sendLabel = "Send Reply",
}) => {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(defaultReplyStatus || "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const pickFile = (e) => {
    const f = e.target.files?.[0] || null;
    const problem = validateAttachment(f);
    setError(problem);
    setFile(problem ? null : f);
    if (problem) e.target.value = "";
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await onReply(text.trim(), file, status || undefined);
      setText("");
      setFile(null);
      e.target.reset?.();
    } catch (err) {
      setError(err.message || "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="sp-thread">
      <div className="sp-thread-head">
        <div>
          <div className="sp-ticket-no">{ticket.ticketNumber}</div>
          <h3>{ticket.subject}</h3>
          <div className="sp-meta">
            {ticket.category} · {fmtDate(ticket.createdAt)}
            {ticket.companyName ? ` · ${ticket.companyName}` : ""}
          </div>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      <div className="sp-messages">
        {conversation.map((m) => (
          <div key={m.id} className={`sp-msg ${m.internal ? "sp-msg-internal" : m.senderType === "master_admin" ? "sp-msg-master" : "sp-msg-company"}`}>
            <div className="sp-msg-head">
              <strong>{m.senderName}</strong>
              <span className="sp-role">{m.internal ? "Internal note" : m.senderType === "master_admin" ? "Support" : "Company Admin"}</span>
              <span className="sp-time">{fmtDate(m.createdAt)}</span>
            </div>
            <div className="sp-msg-body">{m.body}</div>
            {m.attachment && (
              <button type="button" className="sp-attach" onClick={() => onDownload(m)}>
                📎 {m.attachment.name} <small>({fmtSize(m.attachment.size)})</small>
              </button>
            )}
          </div>
        ))}
      </div>

      <form className="sp-reply" onSubmit={submit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          maxLength={5000}
          rows={3}
          required
        />
        <div className="sp-reply-row">
          <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={pickFile} />
          {statusOptions && (
            <label className="sp-inline">
              Set status
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="submit" className="sp-btn" disabled={sending || !text.trim()}>
            {sending ? "Sending…" : sendLabel}
          </button>
        </div>
        {error && <p className="sp-error">{error}</p>}
      </form>
    </div>
  );
};

export default TicketThread;
