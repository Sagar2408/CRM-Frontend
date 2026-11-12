import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaComment } from "react-icons/fa";
import { MessageSquare } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComments } from "@fortawesome/free-solid-svg-icons";
import useMessagingAccess from "../../hooks/useMessagingAccess";
import useMessagingUnread from "./useMessagingUnread";
import "../../styles/messaging.css";

const Dot = ({ count }) =>
  count > 0 ? (
    <span className="msg-nav-dot" data-testid="msg-unread-dot" aria-label={`${count} unread messages`} />
  ) : null;

/** Navbar message icon -> role's Messaging page, with a red dot when unread. */
export const MessageNavIcon = ({ variant = "react" }) => {
  const { allowed, path } = useMessagingAccess();
  const navigate = useNavigate();
  const unread = useMessagingUnread(allowed);
  if (!allowed || !path) return null;
  const go = () => navigate(path);
  if (variant === "fa") {
    return (
      <span className="msg-nav-fa" style={{ position: "relative", display: "inline-flex" }}>
        <FontAwesomeIcon className="navbar_icon" icon={faComments} title="Messaging" onClick={go} style={{ cursor: "pointer" }} />
        <Dot count={unread} />
      </span>
    );
  }
  return (
    <div className="icon-wrapper icon-comment" style={{ position: "relative" }} onClick={go} role="button" aria-label="Messaging" title="Messaging">
      <FaComment size={20} />
      <Dot count={unread} />
    </div>
  );
};

/** Sidebar entry. variant "aside" = admin-style sidebars, "exec" = executive/process sidebars. */
export const MessagingSidebarItem = ({ variant = "aside" }) => {
  const { allowed, path } = useMessagingAccess();
  const unread = useMessagingUnread(allowed);
  if (!allowed || !path) return null;
  return (
    <li>
      {variant === "exec" ? (
        <Link to={path} className="sidebar_nav" style={{ position: "relative" }}>
          <FontAwesomeIcon icon={faComments} /> Messaging
          <Dot count={unread} />
        </Link>
      ) : (
        <Link to={path} className="admin-aside-link" data-tooltip="Messaging" style={{ position: "relative" }}>
          <MessageSquare className="admin-aside-icon" />
          <span className="sidebar-label">Messaging</span>
          <Dot count={unread} />
        </Link>
      )}
    </li>
  );
};
