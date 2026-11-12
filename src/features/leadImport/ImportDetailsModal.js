import React, { useCallback, useEffect, useState } from "react";
import { leadImportApi, importErrorMessage } from "../../services/leadImportApi";
import { Modal } from "./UploadWizard";
import { formatDateTime, statusLabel } from "./importUtils";

const FILTERS = [
  { id: "", label: "All" },
  { id: "inserted", label: "Imported" },
  { id: "duplicate", label: "Duplicates" },
  { id: "failed", label: "Failed" },
  { id: "skipped", label: "Skipped" },
];
const PAGE = 25;

/** Import record: summary + row-wise results and errors. */
const ImportDetailsModal = ({ batchId, onClose }) => {
  const [batch, setBatch] = useState(null);
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    leadImportApi
      .batch(batchId)
      .then((b) => alive && setBatch(b))
      .catch((e) => alive && setError(importErrorMessage(e, "Could not load this import.")));
    return () => {
      alive = false;
    };
  }, [batchId]);

  const loadRows = useCallback(async () => {
    try {
      setRows(await leadImportApi.rows(batchId, { page, limit: PAGE, ...(filter ? { status: filter } : {}) }));
    } catch (e) {
      setError(importErrorMessage(e, "Could not load rows."));
    }
  }, [batchId, page, filter]);
  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const pages = rows ? Math.max(1, Math.ceil(rows.total / PAGE)) : 1;

  return (
    <Modal title="Import details" onClose={onClose} wide>
      {error && (
        <div className="li-error" role="alert">
          {error}
        </div>
      )}
      {batch && (
        <>
          <div className="li-detail-grid">
            <div><span>Workbook</span><strong>{batch.workbookName}</strong></div>
            <div><span>Sheet</span><strong>{batch.sheetName}</strong></div>
            <div><span>Uploaded</span><strong>{formatDateTime(batch.uploadedAt)}</strong></div>
            <div><span>Uploaded by</span><strong>{batch.uploadedBy}</strong></div>
            <div><span>Source</span><strong>{batch.source ? batch.source.label : "—"}</strong></div>
            <div><span>Identified by</span><strong>{batch.source?.keyMode === "serial" ? `Column "${batch.source.identifierColumn}"` : batch.startRow ? `Row position (from row ${batch.startRow})` : "—"}</strong></div>
            <div><span>Status</span><strong><span className={`li-pill ${batch.status}`}>{statusLabel(batch.status)}</span></strong></div>
            <div><span>Rows</span><strong>{batch.totalRows} total · {batch.inserted} imported · {batch.duplicates} duplicate · {batch.skipped} skipped · {batch.failed} failed</strong></div>
          </div>
          {batch.error && <div className="li-error">{batch.error}</div>}
        </>
      )}

      <div className="li-tabs" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.id || "all"} type="button" role="tab" aria-selected={filter === f.id} className={`li-tab ${filter === f.id ? "active" : ""}`} onClick={() => { setFilter(f.id); setPage(1); }}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="li-table-wrap tall">
        <table className="li-table">
          <thead>
            <tr>
              <th>Row</th>
              <th>Name</th>
              <th>Identifier</th>
              <th>Result</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {!rows && (
              <tr>
                <td colSpan={5}>Loading…</td>
              </tr>
            )}
            {rows && rows.rows.length === 0 && (
              <tr>
                <td colSpan={5}>No rows.</td>
              </tr>
            )}
            {rows?.rows.map((r) => (
              <tr key={r.rowNumber}>
                <td>{r.rowNumber}</td>
                <td>{r.name || "—"}</td>
                <td>{r.leadKey || "—"}</td>
                <td>
                  <span className={`li-pill ${r.status}`}>{statusLabel(r.status === "failed" ? "failed_row" : r.status)}</span>
                </td>
                <td>{r.reason || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="li-pager">
        <button type="button" className="li-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button type="button" className="li-btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </Modal>
  );
};

export default ImportDetailsModal;
