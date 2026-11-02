import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import Chat from "./Chat";

const ChatbotAssistantModal = ({ onClose, token, popupRef, headerRef }) => (
  <div
    className="chatbot-popup-overlay"
    onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <div className="chatbot-popup-container" ref={popupRef}>
      <div className="chatbot-popup-header" ref={headerRef}>
        <h3>ChatBot Assistant</h3>
        <button
          className="chatbot-close-btn"
          onClick={onClose}
          aria-label="Close chatbot"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
      <div className="chatbot-popup-content">
        <Chat token={token} enableBotpress={false} />
      </div>
    </div>
  </div>
);

export default ChatbotAssistantModal;
