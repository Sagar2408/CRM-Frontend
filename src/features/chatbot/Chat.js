import React, { useState, useEffect, useRef } from "react";
import { FaMicrophone, FaPaperPlane, FaUser } from "react-icons/fa";
import { MdSmartToy } from "react-icons/md";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

// Small ELSA AI chat used in popups (e.g. Fresh Leads). Input is text (send /
// Enter) or the microphone. Each popup is one new conversation that is saved on
// the backend like any other and shows up in the ELSA AI page list. The full
// multi-conversation workspace is features/chatbot/ElsaAI.js.
const Chat = ({ token, enableBotpress = false }) => {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [isListening, setIsListening] = useState(false);

  const chatContainerRef = useRef(null);
  const recognitionRef = useRef(null);
  const conversationIdRef = useRef(null); // set by the first reply, so follow-ups stay in one ELSA conversation

  const [authToken, setAuthToken] = useState(token);

  useEffect(() => {
    // If token is passed as prop, use it
    if (token) {
      setAuthToken(token);
    } else {
      // Fallback: try to get from localStorage
      const localToken = localStorage.getItem("token");
      if (localToken) {
        setAuthToken(localToken);
      } else {
        // Fallback: try to get from URL params (for backward compatibility)
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get("token");
        if (urlToken) {
          setAuthToken(urlToken);
        }
      }
    }
  }, [token]);

  useEffect(() => {
    if (!enableBotpress) return undefined;

    // Phase 5 (SECURITY_AUDIT.md FRONT-005): this URL is Botpress's own
    // "v3.0" line, not a specific pinned release — Botpress pushes
    // updates to this exact path on their CDN over time. A fixed
    // Subresource Integrity hash computed against today's file content
    // would start failing the moment Botpress ships an update, and with
    // SRI the browser then REFUSES to run the script at all — silently
    // breaking the chatbot for every user until someone notices and
    // recomputes the hash. That's a worse outcome than the supply-chain
    // risk SRI is meant to reduce, so a pinned hash was deliberately not
    // added here. Instead: public/index.html's CSP restricts script-src
    // to exactly https://cdn.botpress.cloud (no wildcard), which is the
    // defense that's actually safe to keep in place unattended — it
    // still means only Botpress's own origin can ever be loaded as a
    // script here, just without pinning the exact file content.
    const script = document.createElement("script");
    script.src = "https://cdn.botpress.cloud/webchat/v3.0/webchat.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      window.botpressWebChat?.init?.({
        configUrl: "https://files.bpcontent.cloud/2025/06/28/09/20250628095833-D0OMUHIV.json",
      });
    };
    document.body.appendChild(script);
    return () => script.remove();
  }, [enableBotpress]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Stop the microphone when the chat is closed.
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
        recognitionRef.current = null;
      }
    },
    []
  );

  const handleSend = async (input) => {
    const question = input.trim();
    if (!question || isTyping) return;
    if (!authToken) {
      setRequestError("Please sign in again to use ELSA AI.");
      return;
    }
    if (!API_BASE_URL) {
      setRequestError("The chat service is not configured.");
      return;
    }

    setRequestError("");
    setMessages((prev) => [...prev, { text: question, isUser: true }]);
    setUserInput("");
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE_URL}/crew/executive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(conversationIdRef.current ? { question, conversationId: conversationIdRef.current } : { question }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || `Chat request failed (${response.status}).`);
      }
      if (typeof data?.answer !== "string" || !data.answer.trim()) {
        throw new Error("ELSA AI returned an empty response.");
      }

      if (data.conversation?.id) conversationIdRef.current = data.conversation.id;
      setMessages((prev) => [...prev, { text: data.answer, isUser: false }]);
    } catch (error) {
      setRequestError(error.message || "Unable to get a response from ELSA AI.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleMicClick = () => {
    if (isListening) stopSpeechRecognition();
    else startSpeechRecognition();
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setRequestError("Voice input is not supported in this browser.");
      return;
    }
    setRequestError("");
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.trim();
      setUserInput(transcript);
      if (result.isFinal) handleSend(transcript);
    };
    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setRequestError("Microphone access was blocked. Allow it in your browser to use voice input.");
      }
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.start();
  };

  const stopSpeechRecognition = () => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch (_) {
        /* already stopped */
      }
    }
    setIsListening(false);
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-header">
          <MdSmartToy size={30} className="chat-icon" />
          <h2 style={{ color: "white" }}>ELSA AI</h2>
        </div>

        <div className="chat-messages" ref={chatContainerRef}>
          {messages.length === 0 && !isTyping && (
            <p className="chat-empty-state">Ask a question to start chatting.</p>
          )}
          {messages.map((msg, index) => (
            <div className="message-row" key={msg.id ?? `local-${index}`}>
              <div className="bot-side">
                {!msg.isUser ? (
                  <div className="message bot-message">
                    <MdSmartToy className="bot-icon" />
                    <div className="message-content">{msg.text}</div>
                  </div>
                ) : (
                  <div className="empty-placeholder" />
                )}
              </div>
              <div className="user-side">
                {msg.isUser ? (
                  <div className="message user-message">
                    <FaUser className="user-icon" />
                    <div className="message-content">{msg.text}</div>
                  </div>
                ) : (
                  <div className="empty-placeholder" />
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="typing-indicator" role="status">
              ELSA AI is responding...
            </div>
          )}
        </div>

        {requestError && (
          <div className="chat-error" role="alert">
            {requestError}
          </div>
        )}

        <div className="chat-input-container">
          <input
            type="text"
            value={userInput}
            aria-label="Message"
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(userInput);
              }
            }}
            placeholder="Type your message..."
          />
          <button
            type="button"
            onClick={() => handleSend(userInput)}
            className="send-button"
            aria-label="Send message"
            disabled={isTyping}
          >
            <FaPaperPlane />
          </button>
          <button
            type="button"
            onClick={handleMicClick}
            className={`mic-button ${isListening ? "active" : ""}`}
            aria-label={isListening ? "Stop voice input" : "Use microphone"}
            aria-pressed={isListening}
          >
            <FaMicrophone />
          </button>
        </div>
        {!authToken && (
          <div className="auth-warning">
            <p>Authentication required. Please login to use ELSA AI.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
