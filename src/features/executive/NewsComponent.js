import React, { useCallback, useEffect, useState } from "react";
import { fetchNewsSources, fetchImmigrationNews } from "../../services/apiService";
import "../../styles/executiveNews.css";

const DEFAULT_SOURCE = "cic";
const PREF_KEY = "crm.newsSource";

const readPref = () => {
  try {
    return localStorage.getItem(PREF_KEY) || "";
  } catch (_) {
    return "";
  }
};

export const formatNewsDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(+d)) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

// Latest immigration news. The backend fetches and parses the curated feeds
// (CIC News by default); the executive can switch between trusted sources for
// Canada, Australia, the UK, the USA and New Zealand. Every item links to its
// original article and shows its publication date.
const NewsComponent = () => {
  const [sources, setSources] = useState([]);
  const [active, setActive] = useState("");
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (key) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchImmigrationNews(key);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setMeta({ stale: !!data?.stale, fetchedAt: data?.fetchedAt, source: data?.source });
    } catch (err) {
      setItems([]);
      setMeta(null);
      setError(err?.response?.data?.message || "Could not load the latest news. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Source list first, then the saved (or default CIC) source.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchNewsSources();
        if (cancelled) return;
        const list = Array.isArray(data?.sources) ? data.sources : [];
        setSources(list);
        const saved = readPref();
        const start = list.some((s) => s.key === saved) ? saved : data?.default || DEFAULT_SOURCE;
        setActive(start);
      } catch (err) {
        if (cancelled) return;
        setError(err?.response?.data?.message || "Could not load the news sources.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (active) load(active);
  }, [active, load]);

  const choose = (key) => {
    if (key === active) return;
    setActive(key);
    try {
      localStorage.setItem(PREF_KEY, key);
    } catch (_) {
      /* preference only */
    }
  };

  const current = sources.find((s) => s.key === active);

  return (
    <section className="news exec-news" aria-labelledby="exec-news-title">
      <div className="exec-news__head">
        <div>
          <h1 id="exec-news-title" className="latest-news">
            Latest Immigration News
          </h1>
          {current && (
            <p className="exec-news__sub">
              {current.label} &middot; {current.country}
              {current.website && (
                <>
                  {" "}
                  &middot;{" "}
                  <a href={current.website} target="_blank" rel="noopener noreferrer">
                    Visit website
                  </a>
                </>
              )}
            </p>
          )}
        </div>
        <button type="button" className="exec-news__refresh" onClick={() => active && load(active)} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {sources.length > 0 && (
        <div className="exec-news__tabs" role="tablist" aria-label="News source">
          {sources.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={s.key === active}
              className={`exec-news__tab ${s.key === active ? "is-active" : ""}`}
              onClick={() => choose(s.key)}
              title={`${s.label} (${s.country})`}
            >
              <span className="exec-news__tab-label">{s.label}</span>
              <span className="exec-news__tab-country">{s.country}</span>
            </button>
          ))}
        </div>
      )}

      {meta?.stale && (
        <p className="exec-news__notice" role="status">
          This source is not responding right now - showing the last copy we have
          {meta.fetchedAt ? ` (from ${new Date(meta.fetchedAt).toLocaleString()})` : ""}.
        </p>
      )}

      <div className="exec-news__body" aria-busy={loading}>
        {loading && (
          <ul className="exec-news__list" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="exec-news__item exec-news__item--skeleton" />
            ))}
          </ul>
        )}

        {!loading && error && (
          <div className="exec-news__error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => (active ? load(active) : window.location.reload())}>
              Try again
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="exec-news__empty">No recent updates were published by this source.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="exec-news__list">
            {items.map((item) => (
              <li key={item.link} className="exec-news__item">
                <div className="exec-news__meta">
                  <span className="exec-news__source">{meta?.source?.label || current?.label}</span>
                  {item.publishedAt && <time dateTime={item.publishedAt}>{formatNewsDate(item.publishedAt)}</time>}
                </div>
                <a className="exec-news__title" href={item.link} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
                {item.summary && <p className="exec-news__summary">{item.summary}</p>}
                <a className="exec-news__read" href={item.link} target="_blank" rel="noopener noreferrer">
                  Read on source &rarr;
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default NewsComponent;
