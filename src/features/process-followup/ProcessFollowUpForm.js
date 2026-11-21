import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createProcessFollowUpEntryApi,
  updateProcessFollowUpEntryApi,
  createProcessMeetingApi,
  rejectProcessClientApi,
  moveProcessClientToFinalApi,
  getProcessFollowUpTimelineApi,
  getProcessDocumentTypesApi,
} from "../../services/processService";
import { useProcess } from "../../context/ProcessAuthContext";
import RejectionKindPicker from "../process-client/RejectionKindPicker";
import ClientDetailsCard from "./ClientDetailsCard";
import {
  CATEGORIES,
  CONTACT_METHODS,
  RATINGS,
  EDITABLE_TYPES,
  ratingLabel,
  ratingKey,
  typeLabel,
  contactLabel,
  localDate,
  localTime,
  toDateTime,
  formatWhen,
  formatStamp,
  validateFollowUp,
} from "./followUpHelpers";
import "../../styles/followUpWorkspace.css"; // history chips (.fuw__chip)
import "../../styles/processModern.css";
import "../../styles/processPortal.css";
import "../../styles/processFollowUpForm.css";

const EMPTY = () => ({ contactMethod: "", category: "", rating: "", comments: "", documentName: "", date: localDate(), time: localTime() });

// The one Process Person follow-up screen. It replaces the old Executive-style pages:
//   /process/follow-up/:customerId             -> add a follow-up (Fresh Leads / Follow-ups)
//   /process/follow-up/:customerId?entry=<id>  -> correct one of your own earlier follow-ups
// The client is always re-read from the server by customer id, so the page survives a reload and a
// pasted link. Nothing on this screen sends an email: "contact method" only records how you reached them.
export default function ProcessFollowUpForm() {
  const { customerId } = useParams();
  const [params] = useSearchParams();
  const entryId = params.get("entry");
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useProcess() || {};

  const [client, setClient] = useState(location.state?.client?.id ? { id: location.state.client.id, fullName: location.state.client.fullName } : null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState({ kind: "", text: "" });
  const [docs, setDocs] = useState({ loading: true, error: "", list: [] });
  const [timeline, setTimeline] = useState({ loading: false, error: "", rows: [] });
  const [rejectKind, setRejectKind] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [entryLoaded, setEntryLoaded] = useState(!entryId);

  const freshLeadId = client?.freshLeadId;
  const editing = !!entryId;
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  // ---- the person's configured documents (Settings > Documents) ----
  const loadDocs = useCallback(async () => {
    setDocs((d) => ({ ...d, loading: true, error: "" }));
    try {
      setDocs({ loading: false, error: "", list: await getProcessDocumentTypesApi() });
    } catch (err) {
      setDocs({ loading: false, error: err.message || "Could not load your document list.", list: [] });
    }
  }, []);
  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // ---- history of this client ----
  const loadTimeline = useCallback(async () => {
    if (!freshLeadId) return [];
    setTimeline((t) => ({ ...t, loading: true, error: "" }));
    try {
      const rows = await getProcessFollowUpTimelineApi(freshLeadId);
      setTimeline({ loading: false, error: "", rows });
      return rows;
    } catch (err) {
      setTimeline({ loading: false, error: err.message || "Could not load history.", rows: [] });
      return [];
    }
  }, [freshLeadId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const rows = await loadTimeline();
      if (!alive || !entryId) return;
      const row = rows.find((r) => String(r.id) === String(entryId));
      if (row) {
        setForm({
          contactMethod: row.connect_via || "",
          category: row.follow_up_type || "",
          rating: ratingLabel(row.interaction_rating) || "",
          comments: row.comments || "",
          documentName: row.document_name || "",
          date: String(row.follow_up_date || "").slice(0, 10) || localDate(),
          time: String(row.follow_up_time || "").slice(0, 5) || localTime(),
        });
      } else {
        setBanner({ kind: "error", text: "That follow-up could not be found. You can add a new one instead." });
      }
      setEntryLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [loadTimeline, entryId]);

  const editedRow = useMemo(() => timeline.rows.find((r) => String(r.id) === String(entryId)), [timeline.rows, entryId]);
  const locked = editing && entryLoaded && !!editedRow && !EDITABLE_TYPES.includes(String(editedRow.follow_up_type).toLowerCase());

  // the saved document may no longer be in the list (deleted/renamed in Settings): keep it visible
  const docOptions = useMemo(() => {
    const names = docs.list.map((d) => d.name);
    if (form.documentName && !names.some((n) => n.toLowerCase() === form.documentName.toLowerCase())) names.unshift(form.documentName);
    return names;
  }, [docs.list, form.documentName]);
  const docIsStale = !!form.documentName && !docs.list.some((d) => d.name.toLowerCase() === form.documentName.toLowerCase());

  const goBack = (notice) => navigate("/process/process-follow-up", { state: { focusCustomerId: Number(customerId), notice } });

  const basePayload = () => ({
    fresh_lead_id: freshLeadId,
    connect_via: form.contactMethod,
    interaction_rating: form.rating,
    follow_up_date: form.date,
    follow_up_time: form.time,
    comments: form.comments.trim(),
  });

  const submit = async (e) => {
    e.preventDefault();
    if (busy || locked) return;
    const found = validateFollowUp(form);
    setErrors(found);
    if (Object.keys(found).length) {
      setBanner({ kind: "error", text: "Please fix the highlighted fields." });
      return;
    }
    if (!freshLeadId) return setBanner({ kind: "error", text: "Client details are still loading. Try again in a moment." });
    setBusy(true);
    setBanner({ kind: "", text: "" });
    try {
      if (form.category === "meeting") {
        await createProcessMeetingApi({
          fresh_lead_id: freshLeadId,
          reasonForFollowup: form.comments.trim(),
          startTime: toDateTime(form.date, form.time).toISOString(),
          connect_via: form.contactMethod,
          interaction_rating: form.rating,
          follow_up_date: form.date,
          follow_up_time: form.time,
        });
        return goBack("Meeting scheduled.");
      }
      const body = { ...basePayload(), follow_up_type: form.category, ...(form.category === "document collection" ? { document_name: form.documentName } : {}) };
      if (editing) {
        const { fresh_lead_id: _lead, ...patch } = body;
        await updateProcessFollowUpEntryApi(entryId, patch);
        return goBack("Follow-up updated.");
      }
      const res = await createProcessFollowUpEntryApi(body);
      return goBack(res.duplicate ? "That follow-up was already saved." : "Follow-up saved.");
    } catch (err) {
      setBanner({ kind: "error", text: err.message || "Could not save the follow-up." });
    } finally {
      setBusy(false);
    }
  };

  // Secondary actions that already existed on the old page: end-of-process outcomes.
  const closeOut = async (kind) => {
    const found = validateFollowUp({ ...form, category: form.category || "other" });
    delete found.category;
    delete found.documentName;
    setErrors(found);
    if (Object.keys(found).length) return setBanner({ kind: "error", text: "Fill in contact method, rating, comment, date and time first." });
    if (kind === "rejected" && !rejectKind) return setBanner({ kind: "error", text: "Choose whether the client withdrew or was rejected internally." });
    setBusy(true);
    setBanner({ kind: "", text: "" });
    try {
      if (kind === "rejected") {
        await rejectProcessClientApi({ ...basePayload(), follow_up_type: "rejected", rejection_kind: rejectKind });
        navigate("/process/rejected-leads");
      } else {
        await moveProcessClientToFinalApi({ ...basePayload(), follow_up_type: "final" });
        navigate("/process/finalstage-leads");
      }
    } catch (err) {
      setBanner({ kind: "error", text: err.message || "Could not complete that action." });
      setBusy(false);
    }
  };

  const meetingInPast = form.category === "meeting" && form.date && form.time && toDateTime(form.date, form.time) <= new Date();

  return (
    <div className="pp-page pfu">
      <header className="pp-page__head">
        <div style={{ minWidth: 0 }}>
          <h1 className="pp-page__title">{editing ? "Edit follow-up" : "Add follow-up"}</h1>
          <p className="pp-page__sub">{client?.fullName ? `for ${client.fullName}` : "Loading client..."}</p>
        </div>
        <button type="button" className="pp-btn" onClick={() => navigate(-1)}>
          &larr; Back
        </button>
      </header>

      <div className="pfu-layout">
        <div className="pfu-col">
          <ClientDetailsCard customerId={customerId} onLoaded={setClient} onSaved={setClient} />
          <section className="pfu-card" aria-labelledby="pfu-hist-h">
            <h2 id="pfu-hist-h" className="pfu-card__title">
              Follow-up history <span className="pfu-count">{timeline.rows.length}</span>
            </h2>
            {timeline.loading && <p className="pfu-muted">Loading history...</p>}
            {timeline.error && (
              <p className="pfu-muted" role="alert">
                {timeline.error}
              </p>
            )}
            {!timeline.loading && !timeline.error && timeline.rows.length === 0 && <p className="pfu-muted">No follow-ups recorded for this client yet.</p>}
            <ol className="pfu-timeline">
              {timeline.rows.map((h) => {
                const when = toDateTime(h.follow_up_date, h.follow_up_time);
                const mine = user?.id != null && Number(h.process_person_id) === Number(user.id);
                const canEdit = mine && EDITABLE_TYPES.includes(String(h.follow_up_type).toLowerCase());
                return (
                  <li key={h.id} className={String(h.id) === String(entryId) ? "is-editing" : ""}>
                    <div className="pfu-tl__top">
                      <strong>{typeLabel(h.follow_up_type)}</strong>
                      {h.document_name && <span className="fuw__chip">{h.document_name}</span>}
                      {h.interaction_rating && <span className={`fuw__chip fuw__chip--${ratingKey(h.interaction_rating)}`}>{ratingLabel(h.interaction_rating)}</span>}
                      <span className="fuw__chip">{contactLabel(h.connect_via)}</span>
                      {canEdit && (
                        <Link className="pfu-link pfu-tl__edit" to={`/process/follow-up/${customerId}?entry=${h.id}`} replace>
                          Edit
                        </Link>
                      )}
                    </div>
                    <p>{h.comments || "No comments."}</p>
                    <div className="pfu-muted pfu-tl__meta">
                      <span>Scheduled: {formatWhen(when)}</span>
                      <span>Recorded by {h.recordedBy || "Process Person"}</span>
                      <span>Logged {formatStamp(h.createdAt)}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <div className="pfu-col">
          <form className="pfu-card" onSubmit={submit} noValidate aria-labelledby="pfu-form-h">
            <h2 id="pfu-form-h" className="pfu-card__title">
              {editing ? "Update this follow-up" : "New follow-up"}
            </h2>
            {locked && <div className="pp-alert">Meetings, final-stage and rejection records cannot be edited. Add a new follow-up instead.</div>}
            {banner.text && (
              <div className={`pp-alert ${banner.kind === "error" ? "pp-alert--error" : ""}`} role={banner.kind === "error" ? "alert" : "status"}>
                {banner.text}
              </div>
            )}

            <fieldset className="pfu-fieldset" disabled={locked || busy}>
              <legend>Contact method</legend>
              <div className="pfu-seg" role="radiogroup" aria-label="Contact method">
                {CONTACT_METHODS.map((m) => (
                  <label key={m.value} className={`pfu-seg__opt ${form.contactMethod === m.value ? "is-on" : ""}`}>
                    <input type="radio" name="contactMethod" value={m.value} checked={form.contactMethod === m.value} onChange={() => set({ contactMethod: m.value })} />
                    {m.label}
                  </label>
                ))}
              </div>
              {errors.contactMethod && <p className="pfu-err">{errors.contactMethod}</p>}
            </fieldset>

            <fieldset className="pfu-fieldset" disabled={locked || busy}>
              <legend>Follow-up category</legend>
              <div className="pfu-seg" role="radiogroup" aria-label="Follow-up category">
                {CATEGORIES.map((c) => (
                  <label key={c.value} className={`pfu-seg__opt ${form.category === c.value ? "is-on" : ""}`}>
                    <input type="radio" name="category" value={c.value} checked={form.category === c.value} disabled={editing && c.value === "meeting"} onChange={() => set({ category: c.value })} />
                    {c.label}
                  </label>
                ))}
              </div>
              {errors.category && <p className="pfu-err">{errors.category}</p>}
            </fieldset>

            {form.category === "document collection" && (
              <div className="pfu-field pfu-field--wide">
                <label htmlFor="pfu-doc">Document being collected</label>
                <select id="pfu-doc" value={form.documentName} disabled={locked || busy || docs.loading} onChange={(e) => set({ documentName: e.target.value })}>
                  <option value="">{docs.loading ? "Loading documents..." : "Select a document"}</option>
                  {docOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                {docIsStale && <p className="pfu-hint">This document is no longer in your Settings list. It stays on the saved record; pick a current one to change it.</p>}
                {docs.error && (
                  <p className="pfu-err" role="alert">
                    {docs.error}{" "}
                    <button type="button" className="pfu-link" onClick={loadDocs}>
                      Retry
                    </button>
                  </p>
                )}
                {!docs.loading && !docs.error && docs.list.length === 0 && (
                  <p className="pfu-hint">
                    You have no document types yet. <Link to="/process/process-settings/documents">Add some in Settings &rarr; Documents</Link>.
                  </p>
                )}
                {errors.documentName && <p className="pfu-err">{errors.documentName}</p>}
              </div>
            )}

            <fieldset className="pfu-fieldset" disabled={locked || busy}>
              <legend>Interaction rating</legend>
              <div className="pfu-seg" role="radiogroup" aria-label="Interaction rating">
                {RATINGS.map((r) => (
                  <label key={r.value} className={`pfu-seg__opt ${form.rating === r.value ? "is-on" : ""}`}>
                    <input type="radio" name="rating" value={r.value} checked={form.rating === r.value} onChange={() => set({ rating: r.value })} />
                    {r.label}
                  </label>
                ))}
              </div>
              {errors.rating && <p className="pfu-err">{errors.rating}</p>}
            </fieldset>

            <label className="pfu-field pfu-field--wide">
              <span>Comments</span>
              <textarea rows={4} maxLength={2000} value={form.comments} disabled={locked || busy} placeholder="What was discussed? What happens next?" onChange={(e) => set({ comments: e.target.value })} />
              <small className="pfu-muted">{form.comments.length}/2000</small>
              {errors.comments && <p className="pfu-err">{errors.comments}</p>}
            </label>

            <div className="pfu-when">
              <label className="pfu-field">
                <span>{form.category === "meeting" ? "Meeting date" : "Follow-up date"}</span>
                <input type="date" value={form.date} disabled={locked || busy} min={form.category === "meeting" ? localDate() : undefined} onChange={(e) => set({ date: e.target.value })} />
                {errors.date && <p className="pfu-err">{errors.date}</p>}
              </label>
              <label className="pfu-field">
                <span>{form.category === "meeting" ? "Meeting time" : "Follow-up time"}</span>
                <input type="time" value={form.time} disabled={locked || busy} onChange={(e) => set({ time: e.target.value })} />
                {errors.time && <p className="pfu-err">{errors.time}</p>}
              </label>
            </div>
            {meetingInPast && !errors.date && <p className="pfu-err">Choose a future date and time for the meeting.</p>}

            <div className="pfu-actions">
              <button type="submit" className="pp-btn pp-btn--primary" disabled={busy || locked || !client}>
                {busy ? "Saving..." : editing ? "Save changes" : form.category === "meeting" ? "Schedule meeting" : "Save follow-up"}
              </button>
              <button type="button" className="pp-btn" onClick={() => navigate(-1)} disabled={busy}>
                Cancel
              </button>
            </div>

            {!editing && (
              <div className="pfu-more">
                <button type="button" className="pfu-link" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
                  {moreOpen ? "Hide" : "Show"} end-of-process actions
                </button>
                {moreOpen && (
                  <div className="pfu-more__body">
                    <p className="pfu-hint">Uses the contact method, rating, comment and date above as the closing note.</p>
                    <div className="pfu-actions">
                      <button type="button" className="pp-btn" disabled={busy} onClick={() => closeOut("final")}>
                        Move to final stage
                      </button>
                    </div>
                    <RejectionKindPicker value={rejectKind} onChange={setRejectKind} />
                    <div className="pfu-actions">
                      <button type="button" className="pp-btn pfu-danger" disabled={busy} onClick={() => closeOut("rejected")}>
                        Reject client
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>

        </div>
      </div>
    </div>
  );
}
