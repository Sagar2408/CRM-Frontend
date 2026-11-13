import React, { useEffect, useMemo, useState } from "react";

export const REMINDER_OPTIONS = [
  { value: 0, label: "No reminder" },
  { value: 5, label: "5 minutes before" },
  { value: 10, label: "10 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 1440, label: "1 day before" },
];

const pad = (n) => String(n).padStart(2, "0");
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const combine = (date, time) => (date && time ? new Date(`${date}T${time}:00`) : null);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Create / edit / reschedule a meeting. For a NEW meeting the executive picks one
// of their own assigned leads (real data from /freshleads); when editing, the
// lead is fixed. `onSubmit(payload)` must throw to keep the dialog open.
const MeetingForm = ({ meeting, leads = [], onSubmit, onClose }) => {
  const editing = !!meeting;
  const initialStart = meeting ? new Date(meeting.startTime) : null;
  const initialEnd = meeting?.endTime ? new Date(meeting.endTime) : null;

  const [leadId, setLeadId] = useState(meeting?.fresh_lead_id ? String(meeting.fresh_lead_id) : "");
  const [leadQuery, setLeadQuery] = useState("");
  const [clientName, setClientName] = useState(meeting?.clientName || "");
  const [clientEmail, setClientEmail] = useState(meeting?.clientEmail || "");
  const [clientPhone, setClientPhone] = useState(meeting?.clientPhone || "");
  const [date, setDate] = useState(initialStart ? toDateInput(initialStart) : "");
  const [startTime, setStartTime] = useState(initialStart ? toTimeInput(initialStart) : "");
  const [endTime, setEndTime] = useState(initialEnd ? toTimeInput(initialEnd) : "");
  const [reminder, setReminder] = useState(meeting ? Number(meeting.reminderMinutes ?? 10) : 10);
  const [reason, setReason] = useState(meeting?.reasonForFollowup || "");
  const [notes, setNotes] = useState(meeting?.notes || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const filteredLeads = useMemo(() => {
    const q = leadQuery.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => `${l.name || ""} ${l.phone || ""} ${l.email || ""}`.toLowerCase().includes(q));
  }, [leads, leadQuery]);

  const pickLead = (id) => {
    setLeadId(id);
    const lead = leads.find((l) => String(l.id) === String(id));
    if (lead) {
      setClientName(lead.name || "");
      setClientEmail(lead.email || "");
      setClientPhone(lead.phone ? String(lead.phone) : "");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const start = combine(date, startTime);
    const end = endTime ? combine(date, endTime) : null;
    const startChanged = !editing || +start !== +initialStart;

    if (!editing && !leadId) return setError("Choose the lead this meeting is with.");
    if (!clientName.trim()) return setError("Client name is required.");
    if (!EMAIL_RE.test(clientEmail)) return setError("Enter a valid client email address.");
    if (!clientPhone.trim()) return setError("Client phone is required.");
    if (!start) return setError("Choose a date and start time.");
    if (startChanged && start < new Date()) return setError("The meeting must start in the future.");
    if (end && end <= start) return setError("The end time must be after the start time.");

    const payload = {
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      clientPhone: clientPhone.trim(),
      reasonForFollowup: reason.trim() || null,
      notes: notes.trim() || null,
      startTime: start.toISOString(),
      endTime: end ? end.toISOString() : null,
      reminderMinutes: Number(reminder),
    };
    if (!editing) payload.fresh_lead_id = Number(leadId);

    setError("");
    setSaving(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not save the meeting.");
      setSaving(false);
    }
  };

  const minDate = toDateInput(new Date());

  return (
    <div className="mtg-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <form className="mtg-modal" role="dialog" aria-modal="true" aria-labelledby="mtg-form-title" onSubmit={submit} noValidate>
        <h3 id="mtg-form-title">{editing ? "Edit / reschedule meeting" : "New meeting"}</h3>

        {!editing && (
          <div className="mtg-field">
            <label htmlFor="mtg-lead">Lead</label>
            <input
              id="mtg-lead-search"
              type="search"
              aria-label="Search leads"
              placeholder="Search your leads by name, phone or email"
              value={leadQuery}
              onChange={(e) => setLeadQuery(e.target.value)}
            />
            <select id="mtg-lead" size={Math.min(5, Math.max(2, filteredLeads.length))} value={leadId} onChange={(e) => pickLead(e.target.value)}>
              {filteredLeads.length === 0 && <option disabled>No matching leads</option>}
              {filteredLeads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} {l.phone ? `- ${l.phone}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mtg-grid">
          <div className="mtg-field">
            <label htmlFor="mtg-name">Client name</label>
            <input id="mtg-name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </div>
          <div className="mtg-field">
            <label htmlFor="mtg-phone">Client phone</label>
            <input id="mtg-phone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
          </div>
          <div className="mtg-field mtg-span">
            <label htmlFor="mtg-email">Client email</label>
            <input id="mtg-email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
          </div>
          <div className="mtg-field">
            <label htmlFor="mtg-date">Date</label>
            <input id="mtg-date" type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="mtg-field">
            <label htmlFor="mtg-start">Start time</label>
            <input id="mtg-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="mtg-field">
            <label htmlFor="mtg-end">End time (optional)</label>
            <input id="mtg-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <div className="mtg-field">
            <label htmlFor="mtg-reminder">Reminder</label>
            <select id="mtg-reminder" value={reminder} onChange={(e) => setReminder(e.target.value)}>
              {REMINDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mtg-field mtg-span">
            <label htmlFor="mtg-reason">Purpose</label>
            <input id="mtg-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Profile assessment" />
          </div>
          <div className="mtg-field mtg-span">
            <label htmlFor="mtg-notes">Notes</label>
            <textarea id="mtg-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {error && (
          <div className="mtg-error" role="alert">
            {error}
          </div>
        )}

        <div className="mtg-modal-actions">
          <button type="button" className="mtg-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="mtg-btn mtg-btn--primary" disabled={saving}>
            {saving ? "Saving..." : editing ? "Save changes" : "Schedule meeting"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MeetingForm;
