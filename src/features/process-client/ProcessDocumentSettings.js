import React, { useCallback, useEffect, useState } from "react";
import {
  getProcessDocumentTypesApi,
  createProcessDocumentTypeApi,
  renameProcessDocumentTypeApi,
  deleteProcessDocumentTypeApi,
} from "../../services/processService";
import "../../styles/processModern.css";
import "../../styles/processPortal.css";
import "../../styles/processFollowUpForm.css";

// Settings > Documents: the documents this Process Person asks clients for. The same list is what
// "Document Collection" offers in Add follow-up, so a new type shows up there immediately and a
// deleted one can no longer be picked. Saved follow-ups keep the name they were recorded with.
export default function ProcessDocumentSettings() {
  const [state, setState] = useState({ loading: true, error: "", docs: [] });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ kind: "", text: "" });
  const [editing, setEditing] = useState(null); // { id, name }
  const [confirmId, setConfirmId] = useState(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      setState({ loading: false, error: "", docs: await getProcessDocumentTypesApi() });
    } catch (err) {
      setState({ loading: false, error: err.message || "Could not load your documents.", docs: [] });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn, okText) => {
    setBusy(true);
    setMessage({ kind: "", text: "" });
    try {
      await fn();
      await load();
      setMessage({ kind: "ok", text: okText });
      return true;
    } catch (err) {
      setMessage({ kind: "error", text: err.message || "Something went wrong." });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const clean = name.replace(/\s+/g, " ").trim();
    if (!clean) return setMessage({ kind: "error", text: "Enter a document name." });
    if (state.docs.some((d) => d.name.toLowerCase() === clean.toLowerCase())) return setMessage({ kind: "error", text: "That document is already in your list." });
    if (await run(() => createProcessDocumentTypeApi(clean), `"${clean}" added.`)) setName("");
  };

  const saveRename = async (e) => {
    e.preventDefault();
    const clean = editing.name.replace(/\s+/g, " ").trim();
    if (!clean) return setMessage({ kind: "error", text: "Enter a document name." });
    if (await run(() => renameProcessDocumentTypeApi(editing.id, clean), "Document renamed. Earlier follow-ups keep their original wording.")) setEditing(null);
  };

  const remove = async (doc) => {
    if (await run(() => deleteProcessDocumentTypeApi(doc.id), `"${doc.name}" deleted.`)) setConfirmId(null);
  };

  return (
    <section className="pfu-docs" aria-labelledby="pfu-docs-h">
      <h2 id="pfu-docs-h" className="pfu-card__title">Documents</h2>
      <p className="pfu-hint">These are the documents you can choose when adding a Document Collection follow-up. Changes apply to new follow-ups straight away; follow-ups you already saved are not changed.</p>

      <form className="pfu-docs__add" onSubmit={add} noValidate>
        <label className="pfu-sr" htmlFor="pfu-doc-new" style={{ position: "absolute", left: -9999 }}>
          New document name
        </label>
        <input id="pfu-doc-new" className="pfu-doc-input" type="text" maxLength={100} placeholder="e.g. Bank statement" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
        <button type="submit" className="pp-btn pp-btn--primary" disabled={busy}>
          Add document
        </button>
      </form>

      {message.text && (
        <p className={`pfu-msg pfu-msg--${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      {state.loading && <div className="pfu-skel" aria-busy="true">Loading documents...</div>}
      {state.error && (
        <div className="pp-alert pp-alert--error" role="alert">
          {state.error}{" "}
          <button type="button" className="pfu-link" onClick={load}>
            Retry
          </button>
        </div>
      )}
      {!state.loading && !state.error && state.docs.length === 0 && (
        <div className="pp-empty">
          <h3>No documents yet</h3>
          <p>Add the documents you collect from clients. They will appear in Add follow-up &rarr; Document Collection.</p>
        </div>
      )}

      {state.docs.length > 0 && (
        <ul className="pfu-doclist">
          {state.docs.map((d) =>
            editing?.id === d.id ? (
              <li key={d.id}>
                <form onSubmit={saveRename} style={{ display: "flex", gap: 10, flexWrap: "wrap", width: "100%" }} noValidate>
                  <input className="pfu-doc-input" style={{ flex: "1 1 200px" }} type="text" maxLength={100} value={editing.name} aria-label={`Rename ${d.name}`} onChange={(e) => setEditing({ ...editing, name: e.target.value })} disabled={busy} autoFocus />
                  <button type="submit" className="pp-btn pp-btn--primary" disabled={busy}>
                    Save
                  </button>
                  <button type="button" className="pp-btn" onClick={() => setEditing(null)} disabled={busy}>
                    Cancel
                  </button>
                </form>
              </li>
            ) : (
              <li key={d.id}>
                <span className="pfu-doclist__name">{d.name}</span>
                {confirmId === d.id ? (
                  <>
                    <span className="pfu-muted" style={{ margin: 0 }}>Delete this document?</span>
                    <button type="button" className="pp-btn pfu-danger" onClick={() => remove(d)} disabled={busy}>
                      Yes, delete
                    </button>
                    <button type="button" className="pp-btn" onClick={() => setConfirmId(null)} disabled={busy}>
                      Keep
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="pp-btn" onClick={() => setEditing({ id: d.id, name: d.name })} disabled={busy} aria-label={`Rename ${d.name}`}>
                      Rename
                    </button>
                    <button type="button" className="pp-btn" onClick={() => setConfirmId(d.id)} disabled={busy} aria-label={`Delete ${d.name}`}>
                      Delete
                    </button>
                  </>
                )}
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}
