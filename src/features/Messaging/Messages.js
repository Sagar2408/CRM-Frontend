import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaPaperclip, FaPaperPlane, FaPlus, FaRegStar, FaSearch, FaStar, FaTimes, FaUsers, FaArrowLeft } from "react-icons/fa";
import "../../styles/messaging.css";
import useMessagingAccess, { readUser } from "../../hooks/useMessagingAccess";
import { acquireSocket, releaseSocket, messagingApi, errorMessage, notifyUnreadChanged } from "../../services/messagingApi";
import {
  ACCEPT_ATTR,
  ALLOWED_EXT,
  Attachment,
  Avatar,
  GroupInfoModal,
  MAX_FILE_BYTES,
  NewGroupModal,
  StatusDot,
  Ticks,
  extOf,
  formatClock,
  formatDayLabel,
  formatLastSeen,
  formatListTime,
  formatSize,
  statusOf,
} from "./MessagingParts";

const TABS = [
  { id: "all", label: "All" },
  { id: "groups", label: "Groups" },
  { id: "starred", label: "Starred" },
  { id: "online", label: "Online" },
];

// Same key scheme as the server (presenceService.identityFromClaims). Used
// ONLY to decide which bubbles are "mine"; the server never trusts it.
function deriveMyKey() {
  const u = readUser();
  if (!u?.id) return null;
  if (u.type === "processperson") return `processperson:${u.id}`;
  const role = String(u.role || "").toLowerCase();
  if (role === "manager") return `manager:${u.id}`;
  if (role === "hr") return `hr:${u.id}`;
  return `user:${u.id}`;
}

const newClientId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const Messages = () => {
  const access = useMessagingAccess();
  const myKey = useMemo(deriveMyKey, []);

  const [employees, setEmployees] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [uploadPct, setUploadPct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [notice, setNotice] = useState("");

  const socketRef = useRef(null);
  const activeRef = useRef(null);
  const convsRef = useRef([]);
  const listEndRef = useRef(null);
  const fileRef = useRef(null);
  activeRef.current = activeId;
  convsRef.current = conversations;

  // ------------------------------------------------------------- loading
  const handleLoadError = useCallback((e, fallback) => {
    if (e?.response?.status === 403) setDenied(true);
    else setError(errorMessage(e, fallback));
  }, []);

  const loadDirectory = useCallback(async () => {
    try {
      const { employees: list } = await messagingApi.directory();
      setEmployees(list);
    } catch (e) {
      handleLoadError(e, "Could not load employees.");
    }
  }, [handleLoadError]);

  const loadConversations = useCallback(async () => {
    try {
      const { conversations: list } = await messagingApi.conversations();
      setConversations(list);
    } catch (e) {
      handleLoadError(e, "Could not load conversations.");
    }
  }, [handleLoadError]);

  const markReadNow = useCallback(async (conversationId) => {
    if (!conversationId || document.visibilityState === "hidden") return;
    try {
      const socket = socketRef.current;
      if (socket?.connected) socket.emit("msg:read", { conversationId });
      else await messagingApi.markRead(conversationId);
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)));
      notifyUnreadChanged();
    } catch {
      /* next focus/reconnect retries */
    }
  }, []);

  const loadMessages = useCallback(
    async (conversationId) => {
      setLoadingMessages(true);
      setError("");
      try {
        const data = await messagingApi.messages(conversationId, { limit: 50 });
        if (activeRef.current !== conversationId) return;
        setMessages(data.messages);
        setReceipts(data.receipts);
        setHasMore(data.hasMore);
        markReadNow(conversationId);
      } catch (e) {
        handleLoadError(e, "Could not load messages.");
      } finally {
        setLoadingMessages(false);
      }
    },
    [handleLoadError, markReadNow]
  );

  const loadEarlier = async () => {
    if (!messages.length || !activeId) return;
    const oldest = messages.find((m) => typeof m.id === "number");
    if (!oldest) return;
    try {
      const data = await messagingApi.messages(activeId, { before: oldest.id, limit: 50 });
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMore(data.hasMore);
    } catch (e) {
      setError(errorMessage(e, "Could not load earlier messages."));
    }
  };

  // initial load
  useEffect(() => {
    if (!access.allowed) return undefined;
    let alive = true;
    (async () => {
      await Promise.all([loadDirectory(), loadConversations()]);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [access.allowed, loadDirectory, loadConversations]);

  // ------------------------------------------------------------- realtime
  useEffect(() => {
    if (!access.allowed) return undefined;
    const socket = acquireSocket();
    socketRef.current = socket;
    if (!socket) return undefined;
    setConnected(socket.connected);

    const onConnect = () => {
      setConnected(true);
      // Reconnect: resync anything missed while offline.
      loadDirectory();
      loadConversations();
      if (activeRef.current) loadMessages(activeRef.current);
    };
    const onDisconnect = () => setConnected(false);

    const onNew = ({ message }) => {
      const isMine = message.senderKey === myKey;
      const open = message.conversationId === activeRef.current && document.visibilityState !== "hidden";
      if (message.conversationId === activeRef.current) {
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
        if (!isMine) markReadNow(message.conversationId);
      }
      const known = convsRef.current.some((c) => c.id === message.conversationId);
      if (!known) {
        loadConversations();
        return;
      }
      setConversations((prev) =>
        prev
          .map((c) =>
            c.id === message.conversationId
              ? {
                  ...c,
                  unread: isMine || open ? c.unread : c.unread + 1,
                  lastActivity: message.createdAt,
                  lastMessage: { id: message.id, senderKey: message.senderKey, senderName: message.senderName, kind: message.kind, body: message.kind === "file" ? message.attachment?.name : message.body, createdAt: message.createdAt },
                }
              : c
          )
          .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
      );
    };

    const onReceipt = (r) => {
      if (r.memberKey === myKey) {
        // My own read from another tab/device: refresh unread counts.
        loadConversations();
        return;
      }
      if (r.conversationId !== activeRef.current) return;
      setReceipts((prev) => {
        const found = prev.find((x) => x.memberKey === r.memberKey);
        const merged = {
          memberKey: r.memberKey,
          lastReadId: Math.max(found?.lastReadId || 0, r.lastReadId || 0),
          lastDeliveredId: Math.max(found?.lastDeliveredId || 0, r.lastDeliveredId || 0, r.lastReadId || 0),
        };
        return found ? prev.map((x) => (x.memberKey === r.memberKey ? merged : x)) : [...prev, merged];
      });
    };

    const onPresence = ({ key, online, lastSeen }) =>
      setEmployees((prev) => prev.map((e) => (e.key === key ? { ...e, online, lastSeen: lastSeen || e.lastSeen } : e)));
    const onSnapshot = ({ presence }) =>
      setEmployees((prev) => prev.map((e) => (presence?.[e.key] ? { ...e, online: !!presence[e.key].online, lastSeen: presence[e.key].lastSeen || e.lastSeen } : e)));
    const onUpdated = () => {
      loadConversations();
      loadDirectory();
    };
    const onRemoved = ({ conversationId }) => {
      if (activeRef.current === conversationId) {
        setActiveId(null);
        setShowChat(false);
        setNotice("You were removed from that group.");
      }
      loadConversations();
    };
    const onRevoked = () => setDenied(true);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("msg:new", onNew);
    socket.on("msg:receipt", onReceipt);
    socket.on("msg:presence", onPresence);
    socket.on("msg:presence_snapshot", onSnapshot);
    socket.on("msg:conversation_updated", onUpdated);
    socket.on("msg:conversation_removed", onRemoved);
    socket.on("msg:revoked", onRevoked);

    const onFocus = () => activeRef.current && markReadNow(activeRef.current);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("msg:new", onNew);
      socket.off("msg:receipt", onReceipt);
      socket.off("msg:presence", onPresence);
      socket.off("msg:presence_snapshot", onSnapshot);
      socket.off("msg:conversation_updated", onUpdated);
      socket.off("msg:conversation_removed", onRemoved);
      socket.off("msg:revoked", onRevoked);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      socketRef.current = null;
      releaseSocket();
    };
  }, [access.allowed, myKey, loadDirectory, loadConversations, loadMessages, markReadNow]);

  // keep the newest message in view
  useEffect(() => {
    listEndRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length, activeId]);

  // ------------------------------------------------------------ selection
  const select = useCallback(
    (conversationId) => {
      setActiveId(conversationId);
      activeRef.current = conversationId;
      setShowChat(true);
      setMessages([]);
      setReceipts([]);
      setHasMore(false);
      setDraft("");
      setPendingFile(null);
      setNotice("");
      loadMessages(conversationId);
    },
    [loadMessages]
  );

  const employeesByKey = useMemo(() => Object.fromEntries(employees.map((e) => [e.key, e])), [employees]);
  const convByOther = useMemo(() => Object.fromEntries(conversations.filter((c) => c.type === "direct" && c.otherKey).map((c) => [c.otherKey, c])), [conversations]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const people = employees.map((e) => ({ type: "employee", id: e.key, name: e.name, role: e.role, employee: e, conv: convByOther[e.key] || null }));
    const groups = conversations.filter((c) => c.type === "group").map((c) => ({ type: "group", id: c.id, name: c.name, role: `${c.memberCount} members`, conv: c }));
    let list;
    if (tab === "groups") list = groups;
    else if (tab === "starred") list = [...people, ...groups].filter((i) => i.conv?.starred);
    else if (tab === "online") list = people.filter((i) => i.employee.online);
    else list = [...people, ...groups];
    if (q) list = list.filter((i) => `${i.name} ${i.role}`.toLowerCase().includes(q));
    const stamp = (i) => (i.conv?.lastMessage ? new Date(i.conv.lastActivity).getTime() : 0);
    return list.sort((a, b) => stamp(b) - stamp(a) || String(a.name).localeCompare(String(b.name)));
  }, [employees, conversations, convByOther, tab, search]);

  const activeConv = conversations.find((c) => c.id === activeId) || null;
  const activeEmployee = activeConv?.type === "direct" ? employeesByKey[activeConv.otherKey] : null;

  const openItem = async (item) => {
    setError("");
    try {
      if (item.conv) return select(item.conv.id);
      const { conversationId } = await messagingApi.openDirect(item.employee.key);
      await loadConversations();
      select(conversationId);
    } catch (e) {
      setError(errorMessage(e, "Could not open the conversation."));
    }
  };

  const toggleStar = async () => {
    if (!activeConv) return;
    const next = !activeConv.starred;
    setConversations((prev) => prev.map((c) => (c.id === activeConv.id ? { ...c, starred: next } : c)));
    try {
      await messagingApi.star(activeConv.id, next);
    } catch (e) {
      setConversations((prev) => prev.map((c) => (c.id === activeConv.id ? { ...c, starred: !next } : c)));
      setError(errorMessage(e));
    }
  };

  // -------------------------------------------------------------- sending
  const settle = (clientId, message) =>
    setMessages((prev) => {
      const rest = prev.filter((m) => m.clientId !== clientId);
      return rest.some((m) => m.id === message.id) ? rest : [...rest, message];
    });
  const fail = (clientId, why) => setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: "failed", error: why } : m)));

  const sendText = async (text, existingClientId) => {
    const conversationId = activeRef.current;
    const clientId = existingClientId || newClientId();
    const optimistic = { id: `tmp-${clientId}`, clientId, conversationId, senderKey: myKey, kind: "text", body: text, createdAt: new Date().toISOString(), status: "sending" };
    setMessages((prev) => (existingClientId ? prev.map((m) => (m.clientId === clientId ? optimistic : m)) : [...prev, optimistic]));
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("msg:send", { conversationId, body: text, clientId }, (ack) => (ack?.ok ? settle(clientId, ack.message) : fail(clientId, ack?.error)));
      return;
    }
    try {
      const { message } = await messagingApi.send(conversationId, text);
      settle(clientId, message);
    } catch (e) {
      fail(clientId, errorMessage(e, "Failed to send."));
    }
  };

  const sendAll = async () => {
    if (!activeId) return;
    const text = draft.trim();
    if (pendingFile) {
      const file = pendingFile;
      setUploadPct(0);
      setError("");
      try {
        const { message } = await messagingApi.upload(activeId, file, text, setUploadPct);
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
        setPendingFile(null);
        setDraft("");
      } catch (e) {
        setError(errorMessage(e, "Upload failed."));
      } finally {
        setUploadPct(null);
      }
      return;
    }
    if (!text) return;
    setDraft("");
    sendText(text);
  };

  const onFilePicked = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_EXT.includes(extOf(file.name))) return setError("Unsupported file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, CSV, PNG, JPG, GIF, WEBP.");
    if (file.size > MAX_FILE_BYTES) return setError("File must be 10MB or smaller.");
    setError("");
    setPendingFile(file);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendAll();
    }
  };

  // ------------------------------------------------------------ rendering
  const messageStatus = (m) => (m.status === "sending" || m.status === "failed" ? m.status : statusOf(m.id, receipts));

  const rows = useMemo(() => {
    const out = [];
    let lastDay = "";
    for (const m of messages) {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) {
        out.push({ divider: formatDayLabel(m.createdAt), key: `d-${day}` });
        lastDay = day;
      }
      out.push({ m, key: m.clientId ? `c-${m.clientId}` : `m-${m.id}` });
    }
    return out;
  }, [messages]);

  if (!access.allowed || denied) {
    return (
      <div className="msg-page">
        <div className="msg-state" role="alert">
          <h2>Messaging unavailable</h2>
          <p>Messaging access is disabled for your account. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  const emptyTitle = tab === "groups" ? "No groups yet" : tab === "starred" ? "No starred conversations" : tab === "online" ? "Nobody else is online" : "No employees found";

  return (
    <div className="msg-page">
      <div className={`msg-shell ${showChat ? "show-chat" : ""}`}>
        {/* ------------------------------------------------ left panel */}
        <aside className="msg-list-panel" aria-label="Conversations">
          <div className="msg-list-head">
            <h2>Messages</h2>
            <span className={`msg-conn ${connected ? "up" : "down"}`} title={connected ? "Connected" : "Reconnecting…"}>
              {connected ? "Live" : "Offline"}
            </span>
            {access.isAdmin && (
              <button type="button" className="msg-icon-btn solid" onClick={() => setShowNewGroup(true)} title="Create group" aria-label="Create group">
                <FaPlus />
              </button>
            )}
          </div>
          <div className="msg-search">
            <FaSearch aria-hidden="true" />
            <input type="search" placeholder="Search employees or groups" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search employees or groups" />
          </div>
          <div className="msg-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={`msg-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="msg-items">
            {loading && (
              <div className="msg-skeletons" aria-busy="true" aria-label="Loading">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="msg-skeleton" />
                ))}
              </div>
            )}
            {!loading && error && !activeId && (
              <div className="msg-banner" role="alert">
                {error}
                <button type="button" className="msg-btn secondary small" onClick={() => { setError(""); loadDirectory(); loadConversations(); }}>
                  Retry
                </button>
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="msg-empty-small">
                <strong>{search ? "No matches" : emptyTitle}</strong>
                {tab === "groups" && access.isAdmin && !search && <p>Use + to create a group.</p>}
              </div>
            )}
            {!loading &&
              items.map((item) => {
                const last = item.conv?.lastMessage;
                const unread = item.conv?.unread || 0;
                const active = item.conv && item.conv.id === activeId;
                return (
                  <button key={`${item.type}-${item.id}`} type="button" className={`msg-item ${active ? "active" : ""}`} onClick={() => openItem(item)}>
                    <span className="msg-item-avatar">
                      <Avatar person={item.employee} size={42} group={item.type === "group"} />
                      {item.type === "employee" && <StatusDot online={item.employee.online} />}
                    </span>
                    <span className="msg-item-main">
                      <span className="msg-item-top">
                        <span className="msg-item-name">{item.name}</span>
                        <span className="msg-item-time">{formatListTime(last?.createdAt)}</span>
                      </span>
                      <span className="msg-item-bottom">
                        <span className="msg-item-preview">
                          {last ? `${last.senderKey === myKey ? "You: " : item.type === "group" ? `${(last.senderName || "").split(" ")[0]}: ` : ""}${last.kind === "file" ? "📎 " : ""}${last.body || ""}` : item.role}
                        </span>
                        {unread > 0 && (
                          <span className="msg-badge" aria-label={`${unread} unread`}>
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </span>
                    </span>
                    {item.conv?.starred && <FaStar className="msg-item-star" aria-label="Starred" />}
                  </button>
                );
              })}
          </div>
        </aside>

        {/* ------------------------------------------------ right panel */}
        <section className="msg-chat-panel" aria-label="Conversation">
          {!activeId || !activeConv ? (
            <div className="msg-empty">
              <FaUsers size={42} aria-hidden="true" />
              <h3>Select a conversation</h3>
              <p>Pick an employee or group on the left to start messaging.</p>
              {notice && <p className="msg-notice">{notice}</p>}
            </div>
          ) : (
            <>
              <header className="msg-chat-head">
                <button type="button" className="msg-icon-btn msg-back" onClick={() => setShowChat(false)} aria-label="Back to conversations">
                  <FaArrowLeft />
                </button>
                <span className="msg-item-avatar">
                  <Avatar person={activeEmployee} size={42} group={activeConv.type === "group"} />
                  {activeEmployee && <StatusDot online={activeEmployee.online} />}
                </span>
                <div className="msg-chat-title">
                  <strong>{activeConv.name}</strong>
                  {activeConv.type === "group" ? (
                    <span>{activeConv.memberCount} members</span>
                  ) : activeEmployee ? (
                    <span className={activeEmployee.online ? "msg-online-text" : ""}>
                      {activeEmployee.role} · {activeEmployee.online ? "Online" : formatLastSeen(activeEmployee.lastSeen)}
                    </span>
                  ) : null}
                </div>
                <div className="msg-chat-actions">
                  {activeConv.type === "group" && (
                    <button type="button" className="msg-btn secondary small" onClick={() => setShowMembers(true)}>
                      <FaUsers /> Members
                    </button>
                  )}
                  <button type="button" className="msg-icon-btn" onClick={toggleStar} aria-label={activeConv.starred ? "Unstar conversation" : "Star conversation"} title={activeConv.starred ? "Unstar" : "Star"}>
                    {activeConv.starred ? <FaStar className="starred" /> : <FaRegStar />}
                  </button>
                </div>
              </header>

              <div className="msg-thread" role="log" aria-live="polite">
                {hasMore && (
                  <button type="button" className="msg-btn secondary small msg-load-more" onClick={loadEarlier}>
                    Load earlier messages
                  </button>
                )}
                {loadingMessages && messages.length === 0 && <div className="msg-empty-small">Loading messages…</div>}
                {!loadingMessages && messages.length === 0 && (
                  <div className="msg-empty-small">
                    <strong>No messages yet</strong>
                    <p>Say hello to {activeConv.name}.</p>
                  </div>
                )}
                {rows.map((row) =>
                  row.divider ? (
                    <div key={row.key} className="msg-day">
                      <span>{row.divider}</span>
                    </div>
                  ) : (
                    <div key={row.key} className={`msg-row ${row.m.senderKey === myKey ? "mine" : "theirs"}`}>
                      <div className={`msg-bubble ${row.m.status === "failed" ? "failed" : ""}`}>
                        {activeConv.type === "group" && row.m.senderKey !== myKey && <div className="msg-sender">{row.m.senderName}</div>}
                        {row.m.attachment && <Attachment messageId={row.m.id} attachment={row.m.attachment} />}
                        {row.m.body && <div className="msg-text">{row.m.body}</div>}
                        <div className="msg-meta">
                          <time dateTime={row.m.createdAt}>{formatClock(row.m.createdAt)}</time>
                          {row.m.senderKey === myKey && <Ticks status={messageStatus(row.m)} />}
                        </div>
                        {row.m.status === "failed" && (
                          <button type="button" className="msg-retry" onClick={() => sendText(row.m.body, row.m.clientId)}>
                            {row.m.error || "Not sent"} — tap to retry
                          </button>
                        )}
                      </div>
                    </div>
                  )
                )}
                <div ref={listEndRef} />
              </div>

              {error && (
                <div className="msg-banner" role="alert">
                  {error}
                  <button type="button" className="msg-icon-btn" onClick={() => setError("")} aria-label="Dismiss">
                    <FaTimes />
                  </button>
                </div>
              )}

              {pendingFile && (
                <div className="msg-pending-file">
                  <FaPaperclip aria-hidden="true" />
                  <span className="msg-pending-name">{pendingFile.name}</span>
                  <small>{formatSize(pendingFile.size)}</small>
                  {uploadPct !== null && <small>{uploadPct}%</small>}
                  <button type="button" className="msg-icon-btn" onClick={() => setPendingFile(null)} disabled={uploadPct !== null} aria-label="Remove attachment">
                    <FaTimes />
                  </button>
                </div>
              )}

              <footer className="msg-composer">
                <input ref={fileRef} type="file" hidden accept={ACCEPT_ATTR} onChange={onFilePicked} data-testid="msg-file-input" />
                <button type="button" className="msg-icon-btn" onClick={() => fileRef.current?.click()} aria-label="Attach file" title="Attach file (PDF, DOC, XLS, CSV, images — max 10MB)">
                  <FaPaperclip />
                </button>
                <textarea
                  rows={1}
                  value={draft}
                  maxLength={4000}
                  placeholder={pendingFile ? "Add a caption (optional)" : "Type a message"}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                  aria-label="Message"
                />
                <button type="button" className="msg-send" onClick={sendAll} disabled={uploadPct !== null || (!draft.trim() && !pendingFile)} aria-label="Send message">
                  <FaPaperPlane />
                </button>
              </footer>
            </>
          )}
        </section>
      </div>

      {showNewGroup && (
        <NewGroupModal
          employees={employees}
          onClose={() => setShowNewGroup(false)}
          onCreated={async (conversationId) => {
            setShowNewGroup(false);
            await loadConversations();
            setTab("groups");
            select(conversationId);
          }}
        />
      )}
      {showMembers && activeConv?.type === "group" && (
        <GroupInfoModal groupId={activeConv.id} isAdmin={access.isAdmin} employees={employees} onClose={() => setShowMembers(false)} onChanged={loadConversations} />
      )}
    </div>
  );
};

export default Messages;
