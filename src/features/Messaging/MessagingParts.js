import React, { useEffect, useMemo, useState } from "react";
import { FaCheck, FaCheckDouble, FaDownload, FaFileAlt, FaFileExcel, FaFilePdf, FaFileWord, FaTimes, FaUsers } from "react-icons/fa";
import { messagingApi, errorMessage } from "../../services/messagingApi";

// ---------------------------------------------------------------- helpers
export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("") || "?";

const sameDay = (a, b) => a.toDateString() === b.toDateString();

export function formatListTime(value) {
  if (!value) return "";
  const d = new Date(value);
  const now = new Date();
  if (sameDay(d, now)) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export const formatClock = (value) => (value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "");

export function formatDayLabel(value) {
  const d = new Date(value);
  const now = new Date();
  if (sameDay(d, now)) return "Today";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export const formatLastSeen = (value) =>
  value ? `Last seen ${new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Offline";

export function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const extOf = (name = "") => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");
export const isImageName = (name) => ["png", "jpg", "jpeg", "gif", "webp"].includes(extOf(name));
export const ALLOWED_EXT = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "png", "jpg", "jpeg", "gif", "webp"];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ACCEPT_ATTR = ALLOWED_EXT.map((e) => `.${e}`).join(",");

/** sent | delivered | read for one of MY messages, from the other members' receipts. */
export function statusOf(messageId, receipts) {
  if (!receipts.length) return "sent";
  if (receipts.every((r) => (r.lastReadId || 0) >= messageId)) return "read";
  if (receipts.every((r) => (r.lastDeliveredId || 0) >= messageId)) return "delivered";
  return "sent";
}

// ------------------------------------------------------------- components
export const Avatar = ({ person, size = 40, group = false }) => {
  const [src, setSrc] = useState(null);
  const key = person?.hasPhoto ? person.key : null;
  useEffect(() => {
    if (!key) {
      setSrc(null);
      return undefined;
    }
    let url;
    let cancelled = false;
    messagingApi
      .avatarBlob(key)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key]);

  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (group) {
    return (
      <span className="msg-avatar msg-avatar-group" style={style} aria-hidden="true">
        <FaUsers />
      </span>
    );
  }
  return src ? (
    <img className="msg-avatar" style={style} src={src} alt={person?.name || "avatar"} />
  ) : (
    <span className="msg-avatar msg-avatar-initials" style={style} aria-hidden="true">
      {initials(person?.name)}
    </span>
  );
};

export const StatusDot = ({ online }) => (
  <span className={`msg-status-dot ${online ? "online" : "offline"}`} title={online ? "Online" : "Offline"} data-testid={online ? "dot-online" : "dot-offline"} />
);

export const Ticks = ({ status }) => {
  if (status === "read") return <FaCheckDouble className="msg-tick read" title="Read" aria-label="Read" />;
  if (status === "delivered") return <FaCheckDouble className="msg-tick" title="Delivered" aria-label="Delivered" />;
  if (status === "sending") return <span className="msg-tick sending" title="Sending" aria-label="Sending">…</span>;
  if (status === "failed") return <span className="msg-tick failed" title="Failed to send" aria-label="Failed">!</span>;
  return <FaCheck className="msg-tick" title="Sent" aria-label="Sent" />;
};

const FileIcon = ({ name }) => {
  const e = extOf(name);
  if (e === "pdf") return <FaFilePdf className="msg-file-icon pdf" />;
  if (e === "doc" || e === "docx") return <FaFileWord className="msg-file-icon word" />;
  if (e === "xls" || e === "xlsx" || e === "csv") return <FaFileExcel className="msg-file-icon excel" />;
  return <FaFileAlt className="msg-file-icon" />;
};

/** File card; images also get an authenticated inline preview (blob URL, never a public path). */
export const Attachment = ({ messageId, attachment }) => {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const image = isImageName(attachment.name);

  useEffect(() => {
    if (!image) return undefined;
    let url;
    let cancelled = false;
    messagingApi
      .attachmentBlob(messageId, true)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [messageId, image]);

  const download = async () => {
    setBusy(true);
    setErr("");
    try {
      const blob = await messagingApi.attachmentBlob(messageId, false);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setErr(errorMessage(e, "Download failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="msg-attachment">
      {image && preview && <img className="msg-attachment-preview" src={preview} alt={attachment.name} onClick={download} />}
      <div className="msg-attachment-card">
        <FileIcon name={attachment.name} />
        <div className="msg-attachment-meta">
          <span className="msg-attachment-name" title={attachment.name}>
            {attachment.name}
          </span>
          <span className="msg-attachment-sub">
            {extOf(attachment.name).toUpperCase()} · {formatSize(attachment.size)}
          </span>
        </div>
        <button type="button" className="msg-icon-btn" onClick={download} disabled={busy} aria-label={`Download ${attachment.name}`} title="Download">
          <FaDownload />
        </button>
      </div>
      {err && <div className="msg-inline-error">{err}</div>}
    </div>
  );
};

/** Modal shell. */
const Modal = ({ title, onClose, children }) => (
  <div className="msg-modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="msg-modal">
      <div className="msg-modal-head">
        <h3>{title}</h3>
        <button type="button" className="msg-icon-btn" onClick={onClose} aria-label="Close">
          <FaTimes />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const MemberPicker = ({ employees, selected, onToggle }) => {
  const [q, setQ] = useState("");
  const list = useMemo(() => employees.filter((e) => `${e.name} ${e.role}`.toLowerCase().includes(q.toLowerCase())), [employees, q]);
  return (
    <>
      <input className="msg-input" placeholder="Search employees…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search employees" />
      <div className="msg-picker">
        {list.length === 0 && <div className="msg-empty-small">No employees found.</div>}
        {list.map((e) => (
          <label key={e.key} className="msg-picker-row">
            <input type="checkbox" checked={selected.includes(e.key)} onChange={() => onToggle(e.key)} />
            <Avatar person={e} size={30} />
            <span className="msg-picker-name">{e.name}</span>
            <span className="msg-picker-role">{e.role}</span>
          </label>
        ))}
      </div>
    </>
  );
};

export const NewGroupModal = ({ employees, onClose, onCreated }) => {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toggle = (k) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Enter a group name.");
    if (!selected.length) return setError("Select at least one member.");
    setBusy(true);
    setError("");
    try {
      const { conversationId } = await messagingApi.createGroup(name.trim(), selected);
      onCreated(conversationId);
    } catch (err) {
      setError(errorMessage(err, "Could not create the group."));
      setBusy(false);
    }
  };

  return (
    <Modal title="Create group" onClose={onClose}>
      <form onSubmit={submit} className="msg-modal-body">
        <label className="msg-label" htmlFor="msg-group-name">
          Group name
        </label>
        <input id="msg-group-name" className="msg-input" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales Team" autoFocus />
        <label className="msg-label">Members ({selected.length} selected)</label>
        <MemberPicker employees={employees} selected={selected} onToggle={toggle} />
        {error && <div className="msg-inline-error" role="alert">{error}</div>}
        <div className="msg-modal-actions">
          <button type="button" className="msg-btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="msg-btn primary" disabled={busy}>
            {busy ? "Creating…" : "Create group"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const GroupInfoModal = ({ groupId, isAdmin, employees, onClose, onChanged }) => {
  const [group, setGroup] = useState(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState([]);
  const [name, setName] = useState("");

  const load = async () => {
    try {
      const { group: g } = await messagingApi.group(groupId);
      setGroup(g);
      setName(g.name);
    } catch (e) {
      setError(errorMessage(e, "Could not load group."));
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const run = async (fn) => {
    setError("");
    try {
      await fn();
      await load();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const candidates = group ? employees.filter((e) => !group.members.some((m) => m.key === e.key)) : [];

  return (
    <Modal title="Group members" onClose={onClose}>
      <div className="msg-modal-body">
        {!group && !error && <div className="msg-empty-small">Loading…</div>}
        {group && (
          <>
            {isAdmin && (
              <div className="msg-rename">
                <input className="msg-input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} aria-label="Group name" />
                <button type="button" className="msg-btn secondary" disabled={!name.trim() || name.trim() === group.name} onClick={() => run(() => messagingApi.renameGroup(groupId, name.trim()))}>
                  Rename
                </button>
              </div>
            )}
            <ul className="msg-member-list">
              {group.members.map((m) => (
                <li key={m.key}>
                  <Avatar person={{ key: m.key, name: m.name }} size={32} />
                  <div className="msg-member-info">
                    <span>{m.name}</span>
                    <small>{m.owner ? `${m.role} · Owner` : m.role}</small>
                  </div>
                  {isAdmin && !m.owner && (
                    <button type="button" className="msg-btn danger small" onClick={() => run(() => messagingApi.removeMember(groupId, m.key))}>
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {isAdmin && !adding && (
              <button type="button" className="msg-btn secondary" onClick={() => setAdding(true)} disabled={!candidates.length}>
                {candidates.length ? "Add members" : "Everyone is already in this group"}
              </button>
            )}
            {isAdmin && adding && (
              <>
                <MemberPicker employees={candidates} selected={picked} onToggle={(k) => setPicked((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))} />
                <div className="msg-modal-actions">
                  <button type="button" className="msg-btn secondary" onClick={() => { setAdding(false); setPicked([]); }}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="msg-btn primary"
                    disabled={!picked.length}
                    onClick={() =>
                      run(async () => {
                        await messagingApi.addMembers(groupId, picked);
                        setAdding(false);
                        setPicked([]);
                      })
                    }
                  >
                    Add {picked.length || ""}
                  </button>
                </div>
              </>
            )}
          </>
        )}
        {error && <div className="msg-inline-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
};
