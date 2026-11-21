import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaPhoneAlt, FaEnvelope, FaCalendarAlt, FaGlobeAsia, FaSearch, FaTimes, FaFileUpload, FaChartLine, FaSyncAlt, FaKey, FaLock } from "react-icons/fa";
import { useProcessService } from "../../context/ProcessServiceContext";
import { getManagedClients, lockClientAccess } from "../../services/clientAccess";
import ClientPortalCredentialsModal from "../manage-clients/ClientPortalCredentialsModal";
import "../../styles/processModern.css";
import "../../styles/manageClients.css";

const STATUS_LABEL = { pending: "Pending", under_review: "Under review", meeting: "Meeting", approved: "Approved", rejected: "Rejected" };
const FOLLOW_UP_LABEL = { "document collection": "Document collection", "payment follow-up": "Payment follow-up", "visa filing": "Visa filing", meeting: "Meeting", rejected: "Rejected", final: "Final stage", other: "Follow-up" };
const PORTAL_LABEL = { active: "Portal active", disabled: "Portal disabled", not_set: "Portal not set" };

const formatPhone = (phone) => (phone ? `+91 ${String(phone).replace(/^(\+?91)?/, "").slice(-10)}` : "No phone");

const formatDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(+d) ? "-" : d.toLocaleDateString("en-GB");
};

// Manage Clients (behind ManageClientsGate): the signed-in Process Person's assigned clients as cards.
// The list comes from /processperson/managed-clients, which the SERVER scopes to that person's own
// clients and only answers while the access grant is valid.
const AllClient = () => {
  const { handleImportConvertedClients } = useProcessService();
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [credFor, setCredFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setClients(await getManagedClients());
    } catch (err) {
      // an expired / missing grant re-locks the page (the gate listens); anything else is shown
      if (err.code !== "CLIENT_ACCESS_REQUIRED" && err.code !== "CLIENT_ACCESS_EXPIRED") setLoadError("Could not load your clients. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statuses = useMemo(() => ["all", ...Object.keys(STATUS_LABEL).filter((k) => clients.some((c) => c.status === k))], [clients]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (!q) return true;
      return [c.fullName, c.email, c.phone, c.country].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [clients, query, status]);

  const handleImport = async () => {
    setImportError("");
    setImporting(true);
    try {
      await handleImportConvertedClients();
      await load();
    } catch (error) {
      setImportError("Failed to import: " + (error?.message || "Unknown error"));
    } finally {
      setImporting(false);
    }
  };

  const openDashboard = (client) =>
    navigate(`/processperson/client/dashboard/${client.id}`, { state: { clientId: client.id, clientName: client.fullName } });
  const openUpload = (client) => navigate(`/processperson/client/upload/${client.id}`, { state: { client } });

  const filtering = query.trim() !== "" || status !== "all";

  return (
    <div className="pp-page mc-page">
      <header className="pp-page__head">
        <div>
          <h1 className="pp-page__title">Manage Clients</h1>
          <p className="pp-page__sub">
            {loading ? "Loading your assigned clients..." : `${clients.length} assigned client${clients.length === 1 ? "" : "s"}`}
            {!loading && filtering ? ` · ${visible.length} shown` : ""}
          </p>
        </div>
        <div className="mc-head-actions">
          <button type="button" className="pp-btn" onClick={lockClientAccess} title="Lock Manage Clients now (asks for the access password again)">
            <FaLock aria-hidden="true" /> Lock
          </button>
          <button type="button" className="pp-btn pp-btn--primary" onClick={handleImport} disabled={importing}>
            <FaSyncAlt aria-hidden="true" className={importing ? "pp-spin" : ""} /> {importing ? "Importing..." : "Import clients"}
          </button>
        </div>
      </header>

      {importError && (
        <div className="pp-alert pp-alert--error" role="alert">
          {importError}
        </div>
      )}

      <div className="pp-toolbar">
        <div className="pp-search">
          <FaSearch aria-hidden="true" className="pp-search__icon" />
          <input type="search" className="pp-search__input" placeholder="Search by name, email, phone or country" aria-label="Search clients" value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && (
            <button type="button" className="pp-search__clear" onClick={() => setQuery("")} aria-label="Clear search">
              <FaTimes aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="pp-chips" role="group" aria-label="Filter by status">
          {statuses.map((key) => (
            <button key={key} type="button" className={`pp-chip ${status === key ? "is-active" : ""}`} aria-pressed={status === key} onClick={() => setStatus(key)}>
              {key === "all" ? "All" : STATUS_LABEL[key]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="pp-grid" aria-busy="true" aria-label="Loading clients">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div className="pp-card pp-card--skeleton" key={i}>
              <span className="pp-skel pp-skel--avatar" />
              <span className="pp-skel pp-skel--line" />
              <span className="pp-skel pp-skel--line short" />
              <span className="pp-skel pp-skel--line" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="pp-empty" role="alert">
          <h3>Something went wrong</h3>
          <p>{loadError}</p>
          <button type="button" className="pp-btn pp-btn--primary" onClick={load}>
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="pp-empty">
          <h3>{filtering ? "No clients match your search" : "No clients assigned yet"}</h3>
          <p>{filtering ? "Try a different name, email or phone number, or clear the filters." : "Clients assigned to you will appear here. Use Import clients to bring in newly converted clients."}</p>
          {filtering && (
            <button type="button" className="pp-btn" onClick={() => { setQuery(""); setStatus("all"); }}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <ul className="pp-grid mc-grid">
          {visible.map((client) => (
            <li className="pp-card mc-card" key={client.id}>
              <div className="pp-card__top">
                <span className="pp-avatar" aria-hidden="true">
                  {(client.fullName || "?").trim().charAt(0).toUpperCase()}
                </span>
                <div className="pp-card__id">
                  <h3 className="pp-card__name" title={client.fullName}>{client.fullName || "Unnamed client"}</h3>
                  <span className={`pp-badge pp-badge--${client.status}`}>{STATUS_LABEL[client.status] || client.status}</span>
                </div>
              </div>
              <dl className="pp-card__rows">
                <div>
                  <FaEnvelope aria-hidden="true" />
                  <dt className="pp-sr">Email</dt>
                  <dd title={client.email}>{client.email || "No email"}</dd>
                </div>
                <div>
                  <FaPhoneAlt aria-hidden="true" />
                  <dt className="pp-sr">Phone</dt>
                  <dd>{formatPhone(client.phone)}</dd>
                </div>
                <div>
                  <FaGlobeAsia aria-hidden="true" />
                  <dt className="pp-sr">Country</dt>
                  <dd>{client.country || "No country"}</dd>
                </div>
                <div>
                  <FaCalendarAlt aria-hidden="true" />
                  <dt className="pp-sr">Last activity</dt>
                  <dd>
                    {formatDate(client.lastActivityAt)}
                    {client.latestFollowUp?.type ? ` · ${FOLLOW_UP_LABEL[client.latestFollowUp.type] || "Follow-up"}` : ""}
                  </dd>
                </div>
              </dl>
              <p className="mc-portal">
                <span className={`mc-badge mc-badge--${client.portal?.status || "not_set"}`}>{PORTAL_LABEL[client.portal?.status || "not_set"]}</span>
              </p>
              <div className="pp-card__actions mc-card__actions">
                <button type="button" className="pp-btn pp-btn--primary" onClick={() => openDashboard(client)}>
                  <FaChartLine aria-hidden="true" /> Dashboard
                </button>
                <button type="button" className="pp-btn" onClick={() => setCredFor(client)}>
                  <FaKey aria-hidden="true" /> Client Portal Credentials
                </button>
                <button type="button" className="pp-btn" onClick={() => openUpload(client)}>
                  <FaFileUpload aria-hidden="true" /> Documents
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {credFor && <ClientPortalCredentialsModal client={credFor} onClose={() => setCredFor(null)} onChanged={load} />}
    </div>
  );
};

export default AllClient;
