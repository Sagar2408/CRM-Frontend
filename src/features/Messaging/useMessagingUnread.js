import { useCallback, useEffect, useState } from "react";
import { acquireSocket, releaseSocket, messagingApi, UNREAD_EVENT } from "../../services/messagingApi";

/** Total unread messages for the logged-in employee, live (socket + refetch). */
export default function useMessagingUnread(enabled) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { unread: n } = await messagingApi.unread();
      setUnread(n || 0);
    } catch {
      /* hidden when messaging is unavailable; the page shows the error state */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const socket = acquireSocket();
    const onChange = () => refresh();
    socket?.on("msg:new", onChange);
    socket?.on("msg:receipt", onChange);
    socket?.on("msg:conversation_removed", onChange);
    socket?.on("connect", onChange);
    window.addEventListener(UNREAD_EVENT, onChange);
    return () => {
      socket?.off("msg:new", onChange);
      socket?.off("msg:receipt", onChange);
      socket?.off("msg:conversation_removed", onChange);
      socket?.off("connect", onChange);
      window.removeEventListener(UNREAD_EVENT, onChange);
      if (socket) releaseSocket();
    };
  }, [enabled, refresh]);

  return unread;
}
