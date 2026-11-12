import { io } from "socket.io-client";
import apiService from "./apiService";

// REST + Socket.IO client for internal messaging. Identity, company and role
// are NEVER sent by the client: the server derives them from the JWT (in the
// REST Authorization header and in the Socket.IO handshake `auth.token`).

const SOCKET_ORIGIN = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/api\/?$/, "");

// ---- shared socket (ref-counted so the navbar icon and the page share one) ----
let socket = null;
let socketToken = null;
let refs = 0;

export function acquireSocket() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  if (!socket || socketToken !== token) {
    if (socket) socket.close();
    // auth as a function => a refreshed token is used on reconnect.
    socket = io(SOCKET_ORIGIN, { auth: (cb) => cb({ token: localStorage.getItem("token") }) });
    socketToken = token;
  }
  refs += 1;
  return socket;
}

export function releaseSocket() {
  refs = Math.max(0, refs - 1);
  if (refs === 0 && socket) {
    socket.close();
    socket = null;
    socketToken = null;
  }
}

// Lets the navbar dot refresh when the page marks things read.
export const UNREAD_EVENT = "messaging:unread-changed";
export const notifyUnreadChanged = () => window.dispatchEvent(new Event(UNREAD_EVENT));

// ---- REST ----
const get = async (url, config) => (await apiService.get(`/messaging${url}`, config)).data;
const post = async (url, body, config) => (await apiService.post(`/messaging${url}`, body, config)).data;

export const messagingApi = {
  directory: () => get("/directory"),
  conversations: () => get("/conversations"),
  unread: () => get("/unread"),
  openDirect: (employeeKey) => post("/conversations/direct", { employeeKey }),
  messages: (id, params) => get(`/conversations/${id}/messages`, { params }),
  send: (id, body) => post(`/conversations/${id}/messages`, { body }),
  markRead: (id, upToId) => post(`/conversations/${id}/read`, upToId ? { upToId } : {}),
  star: async (id, starred) => (await apiService.patch(`/messaging/conversations/${id}/star`, { starred })).data,
  upload: (id, file, caption, onProgress) => {
    const form = new FormData();
    form.append("file", file);
    if (caption) form.append("body", caption);
    return post(`/conversations/${id}/attachments`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => onProgress && e.total && onProgress(Math.round((e.loaded / e.total) * 100)),
    });
  },
  attachmentBlob: async (messageId, inline = false) =>
    (await apiService.get(`/messaging/messages/${messageId}/download`, { params: inline ? { inline: "1" } : {}, responseType: "blob" })).data,
  avatarBlob: async (key) => (await apiService.get(`/messaging/avatars/${encodeURIComponent(key)}`, { responseType: "blob" })).data,
  createGroup: (name, memberKeys) => post("/groups", { name, memberKeys }),
  group: (id) => get(`/groups/${id}`),
  renameGroup: async (id, name) => (await apiService.patch(`/messaging/groups/${id}`, { name })).data,
  addMembers: (id, memberKeys) => post(`/groups/${id}/members`, { memberKeys }),
  removeMember: async (id, memberKey) => (await apiService.delete(`/messaging/groups/${id}/members/${encodeURIComponent(memberKey)}`)).data,
};

export const errorMessage = (err, fallback = "Something went wrong.") => err?.response?.data?.message || err?.message || fallback;
