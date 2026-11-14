import React, { useCallback, useEffect, useState } from "react";
import { announcements, errorMessage, fmtDateTime } from "../../services/masterAdminService";
import "../../styles/masterCenter.css";

// Company-admin view of Master announcements, shown at the top of the Admin
// notification centre. The server returns only announcements delivered to THIS
// company (taken from the JWT); opening one marks it read for this admin.
const isSafeUrl = (u) => /^https?:\/\//i.test(u || "");

const AnnouncementsPanel = () => {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await announcements.list();
      setItems(res.promotions || []);
      setUnread(res.unread || 0);
      setError("");
    } catch (e) {
      setError(errorMessage(e, "Could not load announcements."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openItem = async (item) => {
    try {
      const full = await announcements.get(item.id);
      setOpen(full);
      if (!full.read) {
        await announcements.markRead(item.id);
        load();
      }
    } catch (e) {
      setError(errorMessage(e, "Could not open this announcement."));
    }
  };

  if (!loading && !error && items.length === 0) return null; // nothing to announce: no empty box

  return (
    <section className="mc-announcements" aria-label="Announcements">
      <h3>
        📢 Announcements {unread > 0 && <span className="mc-badge warn" data-testid="announcement-unread">{unread} new</span>}
      </h3>
      {loading && <p className="mc-muted" role="status">Loading announcements…</p>}
      {error && <p className="mc-error" role="alert">{error}</p>}
      <ul className="mc-announce-list">
        {items.map((p) => (
          <li key={p.id} className={p.read ? "" : "unread"}>
            <button type="button" onClick={() => openItem(p)}>
              <span className="mc-badge">{p.category}</span>
              <strong>{p.title}</strong>
              <span className="mc-muted">{fmtDateTime(p.publishedAt)}</span>
              {!p.read && <span className="mc-dot" aria-label="Unread" />}
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <div className="mc-modal-backdrop" role="dialog" aria-modal="true" aria-label={open.title}>
          <div className="mc-modal">
            {isSafeUrl(open.bannerUrl) && <img className="mc-banner" src={open.bannerUrl} alt="" />}
            <span className="mc-badge">{open.category}</span>
            <h3>{open.title}</h3>
            <p className="mc-muted">Published {fmtDateTime(open.publishedAt)}{open.expiresAt ? ` · valid until ${fmtDateTime(open.expiresAt)}` : ""}</p>
            <div className="mc-prewrap">{open.description}</div>
            <div className="mc-actions">
              {isSafeUrl(open.ctaUrl) && open.ctaLabel && (
                <a className="mc-btn primary" href={open.ctaUrl} target="_blank" rel="noopener noreferrer">{open.ctaLabel}</a>
              )}
              <button type="button" className="mc-btn" onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AnnouncementsPanel;
