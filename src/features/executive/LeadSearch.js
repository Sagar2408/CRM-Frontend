import React, { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faXmark, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { searchLeads } from "../../services/apiService";
import { SearchContext } from "../../context/SearchContext";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

export const STAGE_LABEL = { fresh: "Fresh", followup: "Follow-up", converted: "Converted", closed: "Closed" };

// Where a result opens. Fresh and follow-up leads open the same screens the lists
// use (add follow-up / follow-up editor); converted and closed leads open their
// list pre-filtered to that client.
export const targetFor = (r) => {
  const base = { ...(r.client || {}), name: r.name, email: r.email, phone: r.phone };
  if (r.stage === "followup" && r.followUpId) {
    return {
      path: `/executive/clients/${encodeURIComponent(r.followUpId)}/details`,
      state: { client: { ...base, id: r.followUpId, followUpId: r.followUpId, fresh_lead_id: r.freshLeadId }, createFollowUp: false, from: "search" },
    };
  }
  if (r.stage === "followup") return { path: "/executive/schedule", state: undefined };
  if (r.stage === "converted") return { path: "/executive/customer", filter: r.name };
  if (r.stage === "closed") return { path: "/executive/close-leads", filter: r.name };
  const id = r.clientLeadId || r.freshLeadId;
  return {
    path: `/executive/clients/${encodeURIComponent(id)}`,
    state: { client: { ...base, id, freshLeadId: r.freshLeadId }, createFollowUp: true, followUpHistory: [], clientId: id },
  };
};

// Header lead search: debounced, abortable, keyboard accessible. The backend only
// ever returns the signed-in executive's own leads in their own tenant.
const LeadSearch = () => {
  const navigate = useNavigate();
  const { setSearchQuery } = useContext(SearchContext) || {};
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef(null);
  const abortRef = useRef(null);

  const query = value.trim();

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    if (query.length < MIN_CHARS) {
      setStatus("idle");
      setResults([]);
      return undefined;
    }
    setStatus("loading");
    const timer = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const rows = await searchLeads(query, controller.signal);
        if (controller.signal.aborted) return;
        setResults(rows);
        setActive(rows.length ? 0 : -1);
        setStatus("done");
      } catch (err) {
        if (controller.signal.aborted || err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
        setError(err?.response?.data?.error || "Search failed. Please try again.");
        setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query]);

  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const change = (next) => {
    setValue(next);
    setOpen(true);
    setError("");
    setSearchQuery?.(next); // pages with their own list (Fresh leads, Follow-ups...) keep filtering live
  };

  const clear = () => {
    setValue("");
    setResults([]);
    setStatus("idle");
    setOpen(false);
    setSearchQuery?.("");
  };

  const choose = (r) => {
    const t = targetFor(r);
    setValue("");
    setResults([]);
    setStatus("idle");
    setOpen(false);
    setSearchQuery?.(t.filter || "");
    navigate(t.path, t.state ? { state: t.state } : undefined);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && open && status === "done" && results[active]) {
      e.preventDefault();
      choose(results[active]);
    }
  };

  const showPanel = open && query.length >= MIN_CHARS;

  return (
    <div className="lead-search" ref={boxRef} role="search">
      <FontAwesomeIcon icon={status === "loading" ? faSpinner : faMagnifyingGlass} spin={status === "loading"} className="lead-search__icon" aria-hidden="true" />
      <input
        type="search"
        className="lead-search__input search-input-exec"
        placeholder="Search leads by name, email or phone"
        aria-label="Search leads"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="lead-search-list"
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 && status === "done" ? `lead-opt-${active}` : undefined}
        autoComplete="off"
        maxLength={80}
        value={value}
        onChange={(e) => change(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {value && (
        <button type="button" className="lead-search__clear" aria-label="Clear search" onClick={clear}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
      )}

      {showPanel && (
        <div className="lead-search__panel">
          {status === "loading" && <div className="lead-search__state">Searching...</div>}
          {status === "error" && (
            <div className="lead-search__state is-error" role="alert">
              {error}
            </div>
          )}
          {status === "done" && results.length === 0 && (
            <div className="lead-search__state">
              No leads match &ldquo;{query}&rdquo;.
            </div>
          )}
          {status === "done" && results.length > 0 && (
            <ul id="lead-search-list" role="listbox" aria-label="Matching leads">
              {results.map((r, i) => (
                <li key={r.freshLeadId} id={`lead-opt-${i}`} role="option" aria-selected={i === active}>
                  <button type="button" className={`lead-search__item ${i === active ? "is-active" : ""}`} onMouseEnter={() => setActive(i)} onClick={() => choose(r)}>
                    <span className="lead-search__avatar" aria-hidden="true">
                      {(r.name || "?").charAt(0).toUpperCase()}
                    </span>
                    <span className="lead-search__main">
                      <span className="lead-search__name">{r.name}</span>
                      <span className="lead-search__sub">{[r.phone, r.email].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className={`lead-search__stage is-${r.stage}`}>{STAGE_LABEL[r.stage] || r.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default LeadSearch;
