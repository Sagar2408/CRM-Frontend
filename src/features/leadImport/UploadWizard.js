import React, { useMemo, useRef, useState } from "react";
import { leadImportApi, importErrorMessage } from "../../services/leadImportApi";
import { CRM_FIELDS, checkFile, formatDateTime } from "./importUtils";

const Modal = ({ title, onClose, wide, children }) => (
  <div className="li-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className={`li-modal ${wide ? "wide" : ""}`}>
      <div className="li-modal-head">
        <h3>{title}</h3>
        <button type="button" className="li-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="li-modal-body">{children}</div>
    </div>
  </div>
);
export { Modal };

const Stat = ({ label, value, tone }) => (
  <div className={`li-stat ${tone || ""}`}>
    <strong>{value}</strong>
    <span>{label}</span>
  </div>
);

/**
 * Upload New Leads workflow:
 *   1 choose workbook -> 2 sheet / mapping / identifier / source -> 3 review (dry run) -> 4 result.
 */
const UploadWizard = ({ onClose, onImported, onViewDetails }) => {
  const [step, setStep] = useState("select");
  const [file, setFile] = useState(null);
  const [info, setInfo] = useState(null);
  const [sheetName, setSheetName] = useState("");
  const [mapping, setMapping] = useState({});
  const [identifier, setIdentifier] = useState("");
  const [startRow, setStartRow] = useState("");
  const [sourceChoice, setSourceChoice] = useState("new");
  const [sourceLabel, setSourceLabel] = useState("");
  const [review, setReview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const sheet = useMemo(() => info?.sheets.find((s) => s.name === sheetName) || null, [info, sheetName]);

  const applySheetDefaults = (data, name) => {
    const s = data.sheets.find((x) => x.name === name);
    setSheetName(name);
    setMapping(s?.suggestedMapping || {});
    setIdentifier(s?.suggestedIdentifier || "");
    setStartRow("");
    setSourceChoice(s?.matchedSourceId ? `existing:${s.matchedSourceId}` : "new");
    setReview(null);
  };

  const pick = async (f) => {
    const problem = checkFile(f);
    if (problem) return setError(problem);
    setError("");
    setBusy(true);
    try {
      const data = await leadImportApi.inspect(f);
      const first = data.sheets.find((s) => !s.empty && s.totalRows > 0);
      if (!first) throw new Error("This workbook has no sheet with data rows.");
      setFile(f);
      setInfo(data);
      setSourceLabel(`${data.workbookName.replace(/\.[^.]+$/, "")}`);
      applySheetDefaults(data, first.name);
      setStep("configure");
    } catch (e) {
      setError(importErrorMessage(e, "Could not read the workbook."));
    } finally {
      setBusy(false);
    }
  };

  const buildOptions = () => {
    const clean = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v));
    const opts = { sheet: sheetName, mapping: clean };
    if (identifier) opts.identifierColumn = identifier;
    else opts.startRow = Number(startRow);
    if (sourceChoice.startsWith("existing:")) {
      opts.sourceMode = "existing";
      opts.sourceId = Number(sourceChoice.split(":")[1]);
    } else {
      opts.sourceMode = "new";
      if (sourceLabel.trim()) opts.sourceLabel = sourceLabel.trim();
    }
    return opts;
  };

  const configProblem = () => {
    if (!mapping.name) return "Map a column to Name (required).";
    if (!identifier && !(Number.isInteger(Number(startRow)) && Number(startRow) >= 1)) {
      return "No serial/ID column selected. Enter the starting row (1 = first data row) so earlier rows are not imported again.";
    }
    return "";
  };

  const runReview = async () => {
    const problem = configProblem();
    if (problem) return setError(problem);
    setError("");
    setBusy(true);
    try {
      setReview(await leadImportApi.validate(file, buildOptions()));
      setStep("review");
    } catch (e) {
      setError(importErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setError("");
    setBusy(true);
    setPct(0);
    try {
      setResult(await leadImportApi.commit(file, buildOptions(), setPct));
      setStep("done");
      onImported && onImported();
    } catch (e) {
      setError(importErrorMessage(e, "The import failed."));
    } finally {
      setBusy(false);
      setPct(null);
    }
  };

  const previewHeaders = sheet?.headers || [];

  return (
    <Modal title="Upload New Leads" onClose={onClose} wide>
      {error && (
        <div className="li-error" role="alert">
          {error}
        </div>
      )}

      {step === "select" && (
        <div
          className="li-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files?.[0]);
          }}
        >
          <p>
            <strong>Choose an Excel workbook</strong>
          </p>
          <p className="li-muted">.xlsx or .xls, up to 10 MB and 5,000 rows. You can upload the same workbook again later; only new leads are imported.</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" data-testid="li-file" hidden onChange={(e) => pick(e.target.files?.[0])} />
          <button type="button" className="li-btn primary" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Reading workbook…" : "Select file"}
          </button>
        </div>
      )}

      {step === "configure" && info && sheet && (
        <>
          <div className="li-file-line">
            <strong>{info.workbookName}</strong>
            <span className="li-muted">
              {info.sheets.length} sheet{info.sheets.length > 1 ? "s" : ""}
            </span>
          </div>
          {info.previouslyImported && (
            <div className="li-warn" role="status">
              This exact file was already imported on {formatDateTime(info.previouslyImported.at)} ({info.previouslyImported.inserted} leads). Importing it again will skip everything already imported.
            </div>
          )}

          <label className="li-label" htmlFor="li-sheet">
            Sheet
          </label>
          <select id="li-sheet" className="li-input" value={sheetName} onChange={(e) => applySheetDefaults(info, e.target.value)}>
            {info.sheets.map((s) => (
              <option key={s.name} value={s.name} disabled={s.empty || s.totalRows === 0}>
                {s.name} ({s.totalRows} rows)
              </option>
            ))}
          </select>

          <div className="li-section-title">Preview (first {sheet.previewRows.length} of {sheet.totalRows} rows)</div>
          <div className="li-table-wrap">
            <table className="li-table">
              <thead>
                <tr>
                  <th>#</th>
                  {previewHeaders.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.previewRows.map((r) => (
                  <tr key={r.rowNumber}>
                    <td>{r.rowNumber}</td>
                    {r.cells.map((c, i) => (
                      <td key={i}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="li-section-title">Map columns to CRM lead fields</div>
          <div className="li-grid">
            {CRM_FIELDS.map((f) => (
              <label key={f.key} className="li-field">
                <span>
                  {f.label}
                  {f.required && " *"}
                </span>
                <select
                  className="li-input"
                  aria-label={`Map ${f.label}`}
                  value={mapping[f.key] || ""}
                  onChange={(e) => {
                    setReview(null);
                    setMapping((m) => ({ ...m, [f.key]: e.target.value }));
                  }}
                >
                  <option value="">— not imported —</option>
                  {previewHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="li-section-title">How are leads identified?</div>
          <label className="li-field">
            <span>Serial number / unique ID column</span>
            <select className="li-input" aria-label="Identifier column" value={identifier} onChange={(e) => { setIdentifier(e.target.value); setReview(null); }}>
              <option value="">None — I will enter a starting row</option>
              {previewHeaders.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
          {!identifier && (
            <label className="li-field">
              <span>Start importing from data row</span>
              <input className="li-input" type="number" min="1" aria-label="Starting row" placeholder="e.g. 101 (1 = first data row)" value={startRow} onChange={(e) => { setStartRow(e.target.value); setReview(null); }} />
              <small className="li-muted">Rows before this are skipped. Row position is less reliable than a serial column if rows get reordered.</small>
            </label>
          )}

          <div className="li-section-title">Source</div>
          <div className="li-radio-group">
            {info.sources.length > 0 && (
              <label className="li-radio">
                <input type="radio" name="li-source" checked={sourceChoice.startsWith("existing:")} onChange={() => setSourceChoice(`existing:${sheet.matchedSourceId || info.sources[0].id}`)} />
                <span>
                  Same source as an earlier upload{sheet.matchedSourceId ? " (matched by workbook and sheet name)" : ""}
                </span>
              </label>
            )}
            {sourceChoice.startsWith("existing:") && (
              <select className="li-input" aria-label="Existing source" value={sourceChoice} onChange={(e) => setSourceChoice(e.target.value)}>
                {info.sources.map((s) => (
                  <option key={s.id} value={`existing:${s.id}`}>
                    {s.label} — {s.workbookName} / {s.sheetName} (last import {formatDateTime(s.lastImportAt)})
                  </option>
                ))}
              </select>
            )}
            <label className="li-radio">
              <input type="radio" name="li-source" checked={sourceChoice === "new"} onChange={() => setSourceChoice("new")} />
              <span>This is a new source</span>
            </label>
            {sourceChoice === "new" && <input className="li-input" aria-label="Source name" maxLength={150} value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="Source name" />}
          </div>

          <div className="li-actions">
            <button type="button" className="li-btn" onClick={() => { setStep("select"); setFile(null); setInfo(null); setError(""); }}>
              Choose another file
            </button>
            <button type="button" className="li-btn primary" disabled={busy} onClick={runReview}>
              {busy ? "Checking…" : "Review import"}
            </button>
          </div>
        </>
      )}

      {step === "review" && review && (
        <>
          <div className="li-stats">
            <Stat label="New leads to import" value={review.counts.new} tone="good" />
            <Stat label="Duplicates (skipped)" value={review.counts.duplicate} />
            <Stat label="Invalid rows" value={review.counts.failed} tone={review.counts.failed ? "bad" : ""} />
            <Stat label="Before starting row" value={review.counts.skipped} />
          </div>
          {review.issues.length > 0 ? (
            <>
              <div className="li-section-title">Rows that will not be imported</div>
              <div className="li-table-wrap tall">
                <table className="li-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Name</th>
                      <th>Result</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {review.issues.map((i) => (
                      <tr key={`${i.rowNumber}-${i.status}`}>
                        <td>{i.rowNumber}</td>
                        <td>{i.name || "—"}</td>
                        <td>
                          <span className={`li-pill ${i.status}`}>{i.status === "failed" ? "Invalid" : "Duplicate"}</span>
                        </td>
                        <td>{i.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {review.issuesTruncated && <p className="li-muted">Showing the first {review.issues.length} rows. The full list is saved with the import.</p>}
            </>
          ) : (
            <p className="li-muted">No problems found.</p>
          )}
          {pct !== null && <div className="li-progress" aria-label="Upload progress"><span style={{ width: `${pct}%` }} /></div>}
          <div className="li-actions">
            <button type="button" className="li-btn" onClick={() => setStep("configure")} disabled={busy}>
              Back
            </button>
            <button type="button" className="li-btn primary" onClick={runImport} disabled={busy || review.counts.new === 0}>
              {busy ? "Importing…" : review.counts.new === 0 ? "Nothing new to import" : `Import ${review.counts.new} new lead${review.counts.new > 1 ? "s" : ""}`}
            </button>
          </div>
        </>
      )}

      {step === "done" && result && (
        <>
          <p className={`li-result ${result.status}`}>
            {result.status === "completed" ? "Import completed." : "Import completed with some rows not imported."}
          </p>
          <div className="li-stats">
            <Stat label="Inserted" value={result.summary.inserted} tone="good" />
            <Stat label="Duplicates skipped" value={result.summary.duplicate} />
            <Stat label="Skipped (before start)" value={result.summary.skipped} />
            <Stat label="Failed" value={result.summary.failed} tone={result.summary.failed ? "bad" : ""} />
          </div>
          <p className="li-muted">New leads are now available in Lead Assign.</p>
          <div className="li-actions">
            <button type="button" className="li-btn" onClick={() => onViewDetails && onViewDetails(result.batchId)}>
              View details
            </button>
            <button type="button" className="li-btn primary" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default UploadWizard;
