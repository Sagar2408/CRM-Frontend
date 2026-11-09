import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { io } from "socket.io-client";

const SOCKET_ORIGIN = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/api\/?$/, "");

/**
 * Keeps ONE authenticated Socket.IO connection open for every logged-in
 * employee so the Admin's Employee Live Status is real. The server
 * derives identity and company from the token in the handshake; nothing
 * about who we are is sent in a payload. Closing the tab, logging out
 * (token removed) or the network dropping ends the session server-side.
 */
const PresenceConnector = () => {
  useLocation(); // re-render on navigation so a login/logout token change is noticed
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) return undefined;
    const socket = io(SOCKET_ORIGIN, { auth: { token } });
    return () => socket.close();
  }, [token]);

  return null;
};

export default PresenceConnector;
