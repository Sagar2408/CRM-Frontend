import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPhoneAlt,
  FaEnvelope,
  FaCalendarAlt,
  FaGlobeAsia,
  FaSearch,
  FaTimes,
  FaFileUpload,
  FaChartLine,
  FaSyncAlt,
} from "react-icons/fa";
import { useProcessService } from "../../context/ProcessServiceContext";
import "../../styles/processModern.css";

const STATUS_LABEL = { pending: "Pending", under_review: "Under review" };

const formatPhone = (phone) => (phone ? `+91 ${String(phone).replace(/^(\+?91)?/, "").slice(-10)}` : "No phone");

const formatDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(+d) ? "-" : d.toLocaleDateString("en-GB");
};

const AllClient = () => {
  const { fetchCustomers, customers, setCustomers, handleImportConvertedClients } = useProcessService();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError("");
    fetchCustomers()
      .then((data) => {
        if (!alive) return;
        if (data && Array.isArray(data)) {
          setCustomers(data.map((client) => ({ ...client, id: client.id || client._id })));
        }
      })
      .catch((err) => {
        console.error("❌ Error fetching clients:", err);
        if (alive) setLoadError("Could not load your clients. Please try again.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [fetchCustomers, setCustomers]);

  // Only the signed-in Process Person's assigned customers come from the API;
  // this keeps the same pending / under-review view the page always showed.
  const customerData = useMemo(
    () => (Array.isArray(customers) ? customers : []).filter((c) => c.status === "pending" || c.status === "under_review"),
    [customers]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customerData.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (!q) return true;
      return [c.fullName, c.email, c.phone, c.country].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [customerData, query, status]);

  const handleImport = async () => {
    setImportError("");
    setImporting(true);
    try {
      await handleImportConvertedClients();
      await fetchCustomers();
    } catch (error) {
      setImportError("Failed to import: " + (error?.message || "Unknown error"));
    } finally {
      setImporting(false);
    }
  };

  const openDashboard = (client) =>
    navigate(`/processperson/client/dashboard/${client.id}`, {
      state: { clientId: client.id, clientName: client.fullName },
    });
  const openUpload = (client) => navigate(`/processperson/client/upload/${client.id}`, { state: { client } });

  const filtering = query.trim() !== "" || status !== "all";

  return (
    <div className="pp-page">
      <header className="pp-page__head">
        <div>
          <h1 className="pp-page__title">All Clients</h1>
          <p className="pp-page__sub">
            {loading ? "Loading your assigned clients…" : `${customerData.length} assigned client${customerData.length === 1 ? "" : "s"}`}
            {!loading && filtering ? ` · ${visible.length} shown` : ""}
          </p>
        </div>
        <button type="button" className="pp-btn pp-btn--primary" onClick={handleImport} disabled={importing}>
          <FaSyncAlt aria-hidden="true" className={importing ? "pp-spin" : ""} /> {importing ? "Importing…" : "Import clients"}
        </button>
      </header>

      {importError && (
        <div className="pp-alert pp-alert--error" role="alert">
          {importError}
        </div>
      )}

      <div className="pp-toolbar">
        <div className="pp-search">
          <FaSearch aria-hidden="true" className="pp-search__icon" />
          <input
            type="search"
            className="pp-search__input"
            placeholder="Search by name, email, phone or country"
            aria-label="Search clients"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="pp-search__clear" onClick={() => setQuery("")} aria-label="Clear search">
              <FaTimes aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="pp-chips" role="group" aria-label="Filter by status">
          {[["all", "All"], ["pending", "Pending"], ["under_review", "Under review"]].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`pp-chip ${status === key ? "is-active" : ""}`}
              aria-pressed={status === key}
              onClick={() => setStatus(key)}
            >
              {label}
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
          <button type="button" className="pp-btn pp-btn--primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="pp-empty">
          <h3>{filtering ? "No clients match your search" : "No clients assigned yet"}</h3>
          <p>
            {filtering
              ? "Try a different name, email or phone number, or clear the filters."
              : "Clients assigned to you will appear here. Use “Import clients” to bring in newly converted clients."}
          </p>
          {filtering && (
            <button
              type="button"
              className="pp-btn"
              onClick={() => {
                setQuery("");
                setStatus("all");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <ul className="pp-grid">
          {visible.map((client) => (
            <li className="pp-card" key={client.id}>
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
                  <FaPhoneAlt aria-hidden="true" />
                  <dt className="pp-sr">Phone</dt>
                  <dd>{formatPhone(client.phone)}</dd>
                </div>
                <div>
                  <FaEnvelope aria-hidden="true" />
                  <dt className="pp-sr">Email</dt>
                  <dd title={client.email}>{client.email || "No email"}</dd>
                </div>
                <div>
                  <FaGlobeAsia aria-hidden="true" />
                  <dt className="pp-sr">Country</dt>
                  <dd>{client.country || "No country"}</dd>
                </div>
                <div>
                  <FaCalendarAlt aria-hidden="true" />
                  <dt className="pp-sr">Last contacted</dt>
                  <dd>{formatDate(client.last_contacted || client.createdAt)}</dd>
                </div>
              </dl>
              <div className="pp-card__actions">
                <button type="button" className="pp-btn pp-btn--primary" onClick={() => openDashboard(client)}>
                  <FaChartLine aria-hidden="true" /> Dashboard
                </button>
                <button type="button" className="pp-btn" onClick={() => openUpload(client)}>
                  <FaFileUpload aria-hidden="true" /> Documents
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AllClient;
