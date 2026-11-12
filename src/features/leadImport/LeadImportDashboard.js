import React, { useCallback, useEffect, useState } from "react";
import { leadImportApi, importErrorMessage } from "../../services/leadImportApi";
import { formatDateTime, statusLabel } from "./importUtils";
import UploadWizard from "./UploadWizard";
import ImportDetailsModal from "./ImportDetailsModal";
import "../../styles/leadImport.css";

const PAGE = 10;

const Card = ({ label, value, testId }) => (
  <div className="li-card" data-testid={testId}>
    <span className="li-card-label">{label}</span>
    <strong className="li-card-value">{value}</strong>
  </div>
);

/** Lead Import Management: summary cards, latest import, history, upload workflow. */
const LeadImportDashboard = ({ onAddSingle }) => {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [detailsId, setDetailsId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([leadImportApi.summary(), leadImportApi.batches(page, PAGE)]);
      setSummary(s);
      setHistory(h);
      setError("");
    } catch (e) {
      setError(importErrorMessage(e, "Could not load import history."));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const latest = summary?.latest;
  const pages = history ? Math.max(1, Math.ceil(history.total / PAGE)) : 1;
  const n = (v) => (summary ? Number(v).toLocaleString() : "—");

  return (
    <div className="li-dashboard">
      <div className="li-header">
        <div>
          <h1>Upload Leads</h1>
          <p className="li-muted">Import Excel workbooks, track every upload and never import the same lead twice.</p>
        </div>
        <div className="li-header-actions">
          {onAddSingle && (
            <button type="button" className="li-btn" onClick={onAddSingle}>
              Add Single Lead
            </button>
          )}
          <button type="button" className="li-btn primary" onClick={() => setShowUpload(true)}>
            Upload New Leads
          </button>
        </div>
      </div>

      {error && (
        <div className="li-error" role="alert">
          {error} <button type="button" className="li-link" onClick={load}>Retry</button>
        </div>
      )}

      <div className="li-cards">
        <Card testId="card-imports" label="Total Imports" value={n(summary?.totalImports)} />
        <Card testId="card-rows" label="Total Rows Uploaded" value={n(summary?.totalRows)} />
        <Card testId="card-new" label="New Leads Imported" value={n(summary?.newLeads)} />
        <Card testId="card-dup" label="Duplicate Rows Skipped" value={n(summary?.duplicatesSkipped)} />
      </div>

      <section className="li-panel" aria-label="Latest import">
        <h2>Latest import</h2>
        {loading ? (
          <p className="li-muted">Loading…</p>
        ) : latest ? (
          <div className="li-detail-grid">
            <div><span>Workbook</span><strong>{latest.workbookName}</strong></div>
            <div><span>Sheet</span><strong>{latest.sheetName}</strong></div>
            <div><span>Uploaded</span><strong>{formatDateTime(latest.uploadedAt)}</strong></div>
            <div><span>Status</span><strong><span className={`li-pill ${latest.status}`}>{statusLabel(latest.status)}</span></strong></div>
          </div>
        ) : (
          <p className="li-muted">No workbook has been imported yet. Use “Upload New Leads” to get started.</p>
        )}
      </section>

      <section className="li-panel" aria-label="Import history">
        <h2>Import history</h2>
        <div className="li-table-wrap">
          <table className="li-table">
            <thead>
              <tr>
                <th>Workbook</th>
                <th>Sheet</th>
                <th>Uploaded</th>
                <th>Uploaded by</th>
                <th>Total rows</th>
                <th>New leads</th>
                <th>Duplicates</th>
                <th>Failed</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10}>Loading…</td>
                </tr>
              )}
              {!loading && history && history.batches.length === 0 && (
                <tr>
                  <td colSpan={10}>No imports yet.</td>
                </tr>
              )}
              {history?.batches.map((b) => (
                <tr key={b.id}>
                  <td title={b.workbookName}>{b.workbookName}</td>
                  <td>{b.sheetName}</td>
                  <td>{formatDateTime(b.uploadedAt)}</td>
                  <td>{b.uploadedBy}</td>
                  <td>{b.totalRows}</td>
                  <td>{b.inserted}</td>
                  <td>{b.duplicates}</td>
                  <td>{b.failed}</td>
                  <td>
                    <span className={`li-pill ${b.status}`}>{statusLabel(b.status)}</span>
                  </td>
                  <td>
                    <button type="button" className="li-link" onClick={() => setDetailsId(b.id)} aria-label={`View details for ${b.workbookName}`}>
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {history && history.total > PAGE && (
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
        )}
      </section>

      {showUpload && (
        <UploadWizard
          onClose={() => setShowUpload(false)}
          onImported={() => {
            setPage(1);
            load();
          }}
          onViewDetails={(id) => {
            setShowUpload(false);
            setDetailsId(id);
          }}
        />
      )}
      {detailsId && <ImportDetailsModal batchId={detailsId} onClose={() => setDetailsId(null)} />}
    </div>
  );
};

export default LeadImportDashboard;
