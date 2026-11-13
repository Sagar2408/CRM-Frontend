import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaMicrophone, FaPaperPlane, FaPlus, FaPen, FaTrash, FaBars, FaCheck, FaTimes, FaRedo } from "react-icons/fa";
import { MdSmartToy } from "react-icons/md";
import {
  elsaListConversations,
  elsaGetMessages,
  elsaRenameConversation,
  elsaDeleteConversation,
  elsaSendMessage,
} from "../../services/apiService";
import "../../styles/elsa.css";

const SUGGESTIONS = [
  "What documents are needed for a Canada study permit?",
  "Explain the Express Entry points system.",
  "What are the main Australia skilled visa options?",
];

const errorText = (err, fallback) =>
  err?.response?.data?.error ||
  (err?.code === "ECONNABORTED" ? "ELSA took too long to answer. Please try again." : null) ||
  err?.message ||
  fallback;

export const relativeTime = (iso, now = new Date()) => {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return "";
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (days <= 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

// ELSA AI workspace: a list of the user's conversations (new chat, rename,
// delete, reopen) next to the active chat. Everything is stored on the backend
// per user and tenant. Input = text (send / Enter) or the microphone.
const ElsaAI = () => {
  const [conversations, setConversations] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [activeId, setActiveId] = useState(null); // null = a new, unsaved chat
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [listening, setListening] = useState(false);

  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const loadToken = useRef(0); // ignores a slow response for a chat the user already left
  const localId = useRef(0);
  const activeIdRef = useRef(null); // latest active chat id, for async callbacks
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError("");
    try {
      setConversations(await elsaListConversations());
    } catch (err) {
      setListError(errorText(err, "Could not load your chats."));
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  useEffect(
    () => () => {
      const rec = recognitionRef.current;
      if (rec) {
        rec.onend = null;
        try {
          rec.stop();
        } catch (_) {
          /* already stopped */
        }
      }
    },
    []
  );

  const openConversation = async (id) => {
    if (id === activeId) {
      setDrawer(false);
      return;
    }
    const token = ++loadToken.current;
    setActiveId(id);
    setMessages([]);
    setError("");
    setDrawer(false);
    setMessagesLoading(true);
    try {
      const list = await elsaGetMessages(id);
      if (token === loadToken.current) setMessages(list);
    } catch (err) {
      if (token === loadToken.current) {
        setError(errorText(err, "Could not open this chat."));
        if (err?.response?.status === 404) loadList();
      }
    } finally {
      if (token === loadToken.current) setMessagesLoading(false);
    }
  };

  const newChat = () => {
    loadToken.current += 1;
    setActiveId(null);
    setMessages([]);
    setError("");
    setInput("");
    setDrawer(false);
    setMessagesLoading(false);
  };

  const send = async (text, retryOf) => {
    const question = String(text ?? "").trim();
    if (!question || sending) return;
    setError("");
    setInput("");
    const mine = retryOf ?? `local-${++localId.current}`;
    setMessages((prev) => {
      const without = retryOf ? prev.filter((m) => m.localId !== retryOf) : prev;
      return [...without, { localId: mine, text: question, isUser: true }];
    });
    setSending(true);
    const targetId = activeId;
    try {
      const data = await elsaSendMessage(question, targetId);
      if (typeof data?.answer !== "string" || !data.answer.trim()) throw new Error("ELSA returned an empty response.");
      const conv = data.conversation;
      // Decide now (state updaters run later, after the ref below changes): is the
      // user still looking at the chat this question was sent from?
      const stillHere = targetId === activeIdRef.current;
      if (stillHere) setMessages((prev) => [...prev, { localId: `a-${mine}`, text: data.answer, isUser: false }]);
      if (conv) {
        if (targetId === null && activeIdRef.current === null) {
          setActiveId(conv.id);
          activeIdRef.current = conv.id;
        }
        setConversations((prev) => [
          { id: conv.id, title: conv.title, lastMessageAt: conv.lastMessageAt },
          ...prev.filter((c) => c.id !== conv.id),
        ]);
      }
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.localId === mine ? { ...m, failed: true } : m)));
      setError(errorText(err, "ELSA could not answer. Please try again."));
    } finally {
      setSending(false);
    }
  };

  const startRename = (c) => {
    setEditingId(c.id);
    setEditValue(c.title);
    setConfirmDeleteId(null);
  };

  const commitRename = async () => {
    const id = editingId;
    const title = editValue.trim();
    setEditingId(null);
    const current = conversations.find((c) => c.id === id);
    if (!current || !title || title === current.title) return;
    if (title.length > 120) {
      setListError("Chat names can be at most 120 characters.");
      return;
    }
    setListError("");
    const before = conversations;
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    try {
      await elsaRenameConversation(id, title);
    } catch (err) {
      setConversations(before);
      setListError(errorText(err, "Could not rename this chat."));
    }
  };

  const removeConversation = async (id) => {
    setConfirmDeleteId(null);
    try {
      await elsaDeleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === activeId) newChat();
    } catch (err) {
      if (err?.response?.status === 404) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (id === activeId) newChat();
      } else {
        setListError(errorText(err, "Could not delete this chat."));
      }
    }
  };

  const toggleMic = () => {
    if (listening) {
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.stop();
        } catch (_) {
          /* already stopped */
        }
      }
      setListening(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Voice input is not supported in this browser.");
      return;
    }
    setError("");
    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onstart = () => setListening(true);
    rec.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.trim();
      setInput(transcript);
      if (result.isFinal) send(transcript);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Microphone access was blocked. Allow it in your browser to use voice input.");
      }
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    rec.start();
  };

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className={`elsa ${drawer ? "is-drawer-open" : ""}`}>
      <aside className="elsa__list" aria-label="Chats">
        <button type="button" className="elsa__new" onClick={newChat}>
          <FaPlus aria-hidden="true" /> New chat
        </button>

        {listError && (
          <div className="elsa__banner" role="alert">
            {listError} <button onClick={loadList}>Retry</button>
          </div>
        )}

        <ul className="elsa__items">
          {listLoading && [0, 1, 2].map((i) => <li key={i} className="elsa__skeleton" aria-hidden="true" />)}
          {!listLoading && conversations.length === 0 && !listError && <li className="elsa__empty">No chats yet. Ask ELSA anything to start one.</li>}
          {conversations.map((c) => (
            <li key={c.id} className={`elsa__item ${c.id === activeId ? "is-active" : ""}`}>
              {editingId === c.id ? (
                <form
                  className="elsa__rename"
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitRename();
                  }}
                >
                  <input
                    autoFocus
                    aria-label="Chat name"
                    maxLength={120}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && setEditingId(null)}
                    onBlur={commitRename}
                  />
                </form>
              ) : confirmDeleteId === c.id ? (
                <div className="elsa__confirm" role="alertdialog" aria-label={`Delete ${c.title}?`}>
                  <span>Delete this chat?</span>
                  <button type="button" aria-label="Confirm delete" onClick={() => removeConversation(c.id)}>
                    <FaCheck />
                  </button>
                  <button type="button" aria-label="Cancel delete" onClick={() => setConfirmDeleteId(null)}>
                    <FaTimes />
                  </button>
                </div>
              ) : (
                <>
                  <button type="button" className="elsa__open" onClick={() => openConversation(c.id)} title={c.title}>
                    <span className="elsa__title">{c.title}</span>
                    <span className="elsa__time">{relativeTime(c.lastMessageAt)}</span>
                  </button>
                  <span className="elsa__actions">
                    <button type="button" aria-label={`Rename ${c.title}`} title="Rename" onClick={() => startRename(c)}>
                      <FaPen />
                    </button>
                    <button type="button" aria-label={`Delete ${c.title}`} title="Delete" onClick={() => setConfirmDeleteId(c.id)}>
                      <FaTrash />
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      </aside>
      {drawer && <div className="elsa__scrim" onClick={() => setDrawer(false)} aria-hidden="true" />}

      <section className="elsa__chat" aria-label="Conversation">
        <header className="elsa__head">
          <button type="button" className="elsa__drawer-btn" aria-label="Show chats" onClick={() => setDrawer(true)}>
            <FaBars />
          </button>
          <MdSmartToy size={26} aria-hidden="true" />
          <div>
            <h2>ELSA AI</h2>
            <span className="elsa__sub">{active ? active.title : "New chat"}</span>
          </div>
        </header>

        <div className="elsa__messages" ref={scrollRef} aria-live="polite">
          {messagesLoading && <p className="elsa__hint">Loading chat...</p>}
          {!messagesLoading && messages.length === 0 && !sending && (
            <div className="elsa__welcome">
              <MdSmartToy size={44} aria-hidden="true" />
              <h3>How can I help with immigration today?</h3>
              <div className="elsa__suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={m.id ?? m.localId ?? i} className={`elsa__msg ${m.isUser ? "is-user" : "is-bot"} ${m.failed ? "is-failed" : ""}`}>
              {!m.isUser && <MdSmartToy className="elsa__avatar" aria-hidden="true" />}
              <div className="elsa__bubble">
                {m.text}
                {m.failed && (
                  <button type="button" className="elsa__retry" onClick={() => send(m.text, m.localId)} disabled={sending}>
                    <FaRedo aria-hidden="true" /> Retry
                  </button>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="elsa__msg is-bot" role="status">
              <MdSmartToy className="elsa__avatar" aria-hidden="true" />
              <div className="elsa__bubble elsa__typing">
                ELSA is thinking<span>.</span>
                <span>.</span>
                <span>.</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="elsa__error" role="alert">
            {error}
          </div>
        )}

        <div className="elsa__input">
          <input
            type="text"
            aria-label="Message"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            maxLength={4000}
          />
          <button type="button" className="elsa__send" aria-label="Send message" onClick={() => send(input)} disabled={sending || !input.trim()}>
            <FaPaperPlane />
          </button>
          <button
            type="button"
            className={`elsa__mic ${listening ? "is-live" : ""}`}
            aria-label={listening ? "Stop voice input" : "Use microphone"}
            aria-pressed={listening}
            onClick={toggleMic}
          >
            <FaMicrophone />
          </button>
        </div>
      </section>
    </div>
  );
};

export default ElsaAI;
