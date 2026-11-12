import React from "react";
import { render, screen, waitFor, act, within, fireEvent } from "@testing-library/react";
import Messages from "./Messages";
import { messagingApi, acquireSocket } from "../../services/messagingApi";
import useMessagingAccess from "../../hooks/useMessagingAccess";

// axios (pulled in by apiService) ships ESM that this CRA/jest setup cannot
// parse, so the whole API/socket layer is replaced by a controllable fake.
jest.mock("../../services/messagingApi", () => ({
  messagingApi: {
    directory: jest.fn(),
    conversations: jest.fn(),
    openDirect: jest.fn(),
    messages: jest.fn(),
    send: jest.fn(),
    markRead: jest.fn(),
    star: jest.fn(),
    upload: jest.fn(),
    attachmentBlob: jest.fn(),
    avatarBlob: jest.fn(),
    createGroup: jest.fn(),
    group: jest.fn(),
    renameGroup: jest.fn(),
    addMembers: jest.fn(),
    removeMember: jest.fn(),
  },
  acquireSocket: jest.fn(),
  releaseSocket: jest.fn(),
  notifyUnreadChanged: jest.fn(),
  errorMessage: (e, f) => e?.response?.data?.message || e?.message || f,
}));
jest.mock("../../hooks/useMessagingAccess", () => {
  const fn = jest.fn();
  fn.readUser = () => JSON.parse(localStorage.getItem("user"));
  return { __esModule: true, default: fn, readUser: () => JSON.parse(localStorage.getItem("user")) };
});

function makeSocket() {
  const handlers = {};
  return {
    connected: true,
    emitted: [],
    on: (e, h) => ((handlers[e] = handlers[e] || []).push(h), undefined),
    off: (e, h) => {
      handlers[e] = (handlers[e] || []).filter((x) => x !== h);
    },
    emit: jest.fn(function (ev, payload, ack) {
      this.emitted.push([ev, payload]);
      if (ev === "msg:send" && ack) ack({ ok: true, message: { id: 500, conversationId: payload.conversationId, senderKey: "user:2", senderName: "Me", kind: "text", body: payload.body, createdAt: new Date().toISOString(), status: "sent" } });
    }),
    fire: (e, p) => (handlers[e] || []).forEach((h) => h(p)),
  };
}

const EMPLOYEES = [
  { key: "user:4", kind: "user", id: 4, name: "Tom Lead", role: "TL", hasPhoto: false, online: true, lastSeen: null },
  { key: "hr:1", kind: "hr", id: 1, name: "Hana HR", role: "HR", hasPhoto: false, online: false, lastSeen: "2026-11-10T09:30:00.000Z" },
  { key: "processperson:1", kind: "processperson", id: 1, name: "Pat Process", role: "Process Person", hasPhoto: false, online: false, lastSeen: null },
];
const CONV_TOM = { id: "11111111-1111-4111-8111-111111111111", type: "direct", name: "Tom Lead", otherKey: "user:4", memberCount: 2, starred: false, unread: 2, lastMessage: { id: 7, senderKey: "user:4", senderName: "Tom Lead", kind: "text", body: "ping", createdAt: new Date().toISOString() }, lastActivity: new Date().toISOString() };
const CONV_GROUP = { id: "22222222-2222-4222-8222-222222222222", type: "group", name: "Sales Team", otherKey: null, memberCount: 3, starred: false, unread: 0, lastMessage: null, lastActivity: "2026-11-01T00:00:00.000Z" };

let socket;
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("user", JSON.stringify({ id: 2, role: "Executive" }));
  localStorage.setItem("token", "t");
  socket = makeSocket();
  acquireSocket.mockReturnValue(socket);
  useMessagingAccess.mockReturnValue({ allowed: true, loading: false, isAdmin: false, path: "/executive/messaging" });
  messagingApi.directory.mockResolvedValue({ employees: EMPLOYEES });
  messagingApi.conversations.mockResolvedValue({ conversations: [CONV_TOM, CONV_GROUP] });
  messagingApi.messages.mockResolvedValue({
    messages: [{ id: 6, conversationId: CONV_TOM.id, senderKey: "user:2", senderName: "Me", kind: "text", body: "hello", createdAt: new Date().toISOString(), status: "sent" }, { id: 7, conversationId: CONV_TOM.id, senderKey: "user:4", senderName: "Tom Lead", kind: "text", body: "ping", createdAt: new Date().toISOString() }],
    hasMore: false,
    receipts: [{ memberKey: "user:4", lastReadId: 6, lastDeliveredId: 7 }],
  });
  messagingApi.markRead.mockResolvedValue({});
});

const renderPage = async () => {
  render(<Messages />);
  await screen.findByText("Tom Lead");
};

describe("Messages page", () => {
  test("lists employees with green/red presence dots, role, preview and unread badge", async () => {
    await renderPage();
    const tom = screen.getByText("Tom Lead").closest("button");
    expect(within(tom).getByTestId("dot-online")).toBeInTheDocument();
    expect(within(tom).getByLabelText("2 unread")).toBeInTheDocument();
    expect(within(tom).getByText(/ping/)).toBeInTheDocument();
    const hana = screen.getByText("Hana HR").closest("button");
    expect(within(hana).getByTestId("dot-offline")).toBeInTheDocument();
    expect(screen.getByText("Pat Process")).toBeInTheDocument(); // process person listed
    expect(screen.getByText("Sales Team")).toBeInTheDocument();
  });

  test("tabs All / Groups / Starred / Online and search", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Groups" }));
    expect(screen.getByText("Sales Team")).toBeInTheDocument();
    expect(screen.queryByText("Hana HR")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Online" }));
    expect(screen.getByText("Tom Lead")).toBeInTheDocument();
    expect(screen.queryByText("Hana HR")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Starred" }));
    expect(screen.getByText("No starred conversations")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "All" }));
    fireEvent.change(screen.getByLabelText("Search employees or groups"), { target: { value: "hana" } });
    expect(screen.getByText("Hana HR")).toBeInTheDocument();
    expect(screen.queryByText("Tom Lead")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search employees or groups"), { target: { value: "zzz" } });
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  test("opening a conversation loads history, marks it read and shows delivery ticks", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("Tom Lead").closest("button"));
    await screen.findByText("hello");
    expect(socket.emitted).toContainEqual(["msg:read", { conversationId: CONV_TOM.id }]);
    await waitFor(() => expect(screen.queryByLabelText("2 unread")).not.toBeInTheDocument());
    // my message 6 was read by Tom (lastReadId 6)
    expect(screen.getByLabelText("Read")).toBeInTheDocument();
  });

  test("starting a chat with an employee creates the conversation", async () => {
    messagingApi.openDirect.mockResolvedValue({ conversationId: "33333333-3333-4333-8333-333333333333" });
    messagingApi.conversations.mockResolvedValueOnce({ conversations: [] }).mockResolvedValue({
      conversations: [{ ...CONV_TOM, id: "33333333-3333-4333-8333-333333333333", name: "Hana HR", otherKey: "hr:1", unread: 0, lastMessage: null }],
    });
    messagingApi.messages.mockResolvedValue({ messages: [], hasMore: false, receipts: [] });
    render(<Messages />);
    fireEvent.click((await screen.findByText("Hana HR")).closest("button"));
    await waitFor(() => expect(messagingApi.openDirect).toHaveBeenCalledWith("hr:1"));
    await screen.findByText("No messages yet");
  });

  test("sends over the socket (optimistic -> acked) and clears the draft", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("Tom Lead").closest("button"));
    await screen.findByText("hello");
    const box = screen.getByLabelText("Message");
    fireEvent.change(box, { target: { value: "  on my way  " } });
    fireEvent.click(screen.getByLabelText("Send message"));
    await screen.findByText("on my way");
    expect(socket.emitted.find(([e]) => e === "msg:send")[1]).toMatchObject({ conversationId: CONV_TOM.id, body: "on my way" });
    expect(box.value).toBe("");
    expect(messagingApi.send).not.toHaveBeenCalled(); // socket path, not HTTP
  });

  test("falls back to HTTP when the socket is down", async () => {
    socket.connected = false;
    messagingApi.send.mockResolvedValue({ message: { id: 501, conversationId: CONV_TOM.id, senderKey: "user:2", senderName: "Me", kind: "text", body: "offline msg", createdAt: new Date().toISOString(), status: "sent" } });
    await renderPage();
    fireEvent.click(screen.getByText("Tom Lead").closest("button"));
    await screen.findByText("hello");
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "offline msg" } });
    fireEvent.click(screen.getByLabelText("Send message"));
    await screen.findByText("offline msg");
    expect(messagingApi.send).toHaveBeenCalledWith(CONV_TOM.id, "offline msg");
  });

  test("a failed send is shown with a retry affordance", async () => {
    socket.emit.mockImplementation(function (ev, payload, ack) {
      if (ack) ack({ ok: false, error: "Messaging access is disabled." });
    });
    await renderPage();
    fireEvent.click(screen.getByText("Tom Lead").closest("button"));
    await screen.findByText("hello");
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "will fail" } });
    fireEvent.click(screen.getByLabelText("Send message"));
    await screen.findByText(/tap to retry/);
  });

  test("incoming realtime message appends in the open chat and is marked read", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("Tom Lead").closest("button"));
    await screen.findByText("hello");
    act(() => socket.fire("msg:new", { message: { id: 9, conversationId: CONV_TOM.id, senderKey: "user:4", senderName: "Tom Lead", kind: "text", body: "live message", createdAt: new Date().toISOString() } }));
    await waitFor(() => expect(screen.getAllByText("live message").length).toBeGreaterThan(1));
    expect(socket.emitted.filter(([e]) => e === "msg:read").length).toBeGreaterThan(1);
  });

  test("incoming message for a closed chat raises the unread badge", async () => {
    await renderPage();
    act(() => socket.fire("msg:new", { message: { id: 12, conversationId: CONV_GROUP.id, senderKey: "user:4", senderName: "Tom Lead", kind: "text", body: "team update", createdAt: new Date().toISOString() } }));
    const group = screen.getByText("Sales Team").closest("button");
    await waitFor(() => expect(within(group).getByLabelText("1 unread")).toBeInTheDocument());
    expect(within(group).getByText(/team update/)).toBeInTheDocument();
  });

  test("presence events flip the dot and show last seen for offline employees", async () => {
    await renderPage();
    const hana = () => screen.getByText("Hana HR").closest("button");
    act(() => socket.fire("msg:presence", { key: "hr:1", online: true, lastSeen: null }));
    expect(within(hana()).getByTestId("dot-online")).toBeInTheDocument();
    act(() => socket.fire("msg:presence", { key: "user:4", online: false, lastSeen: "2026-11-12T10:15:00.000Z" }));
    expect(within(screen.getByText("Tom Lead").closest("button")).getByTestId("dot-offline")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Tom Lead").closest("button"));
    await screen.findByText(/Last seen/);
  });

  test("receipt events upgrade sent -> delivered -> read ticks", async () => {
    messagingApi.messages.mockResolvedValue({
      messages: [{ id: 20, conversationId: CONV_TOM.id, senderKey: "user:2", senderName: "Me", kind: "text", body: "tick test", createdAt: new Date().toISOString(), status: "sent" }],
      hasMore: false,
      receipts: [{ memberKey: "user:4", lastReadId: 0, lastDeliveredId: 0 }],
    });
    await renderPage();
    fireEvent.click(screen.getByText("Tom Lead").closest("button"));
    await screen.findByText("tick test");
    expect(screen.getByLabelText("Sent")).toBeInTheDocument();
    act(() => socket.fire("msg:receipt", { conversationId: CONV_TOM.id, memberKey: "user:4", lastDeliveredId: 20 }));
    expect(screen.getByLabelText("Delivered")).toBeInTheDocument();
    act(() => socket.fire("msg:receipt", { conversationId: CONV_TOM.id, memberKey: "user:4", lastReadId: 20 }));
    expect(screen.getByLabelText("Read")).toBeInTheDocument();
  });

  test("attachments: shows filename/type/size and rejects bad type or oversized files", async () => {
    messagingApi.messages.mockResolvedValue({
      messages: [{ id: 30, conversationId: CONV_TOM.id, senderKey: "user:4", senderName: "Tom Lead", kind: "file", body: null, attachment: { name: "Q3 Report.pdf", mime: "application/pdf", size: 2048 }, createdAt: new Date().toISOString() }],
      hasMore: false,
      receipts: [],
    });
    await renderPage();
    fireEvent.click(screen.getByText("Tom Lead").closest("button"));
    await screen.findByText("Q3 Report.pdf");
    expect(screen.getByText(/PDF · 2\.0 KB/)).toBeInTheDocument();
    expect(screen.getByLabelText("Download Q3 Report.pdf")).toBeInTheDocument();

    const input = screen.getByTestId("msg-file-input");
    fireEvent.change(input, { target: { files: [new File(["x"], "virus.exe", { type: "application/octet-stream" })] } });
    expect(await screen.findByText(/Unsupported file type/)).toBeInTheDocument();
    const big = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByText(/10MB or smaller/)).toBeInTheDocument();

    messagingApi.upload.mockResolvedValue({ message: { id: 31, conversationId: CONV_TOM.id, senderKey: "user:2", senderName: "Me", kind: "file", body: null, attachment: { name: "sheet.xlsx", mime: "x", size: 10 }, createdAt: new Date().toISOString(), status: "sent" } });
    fireEvent.change(input, { target: { files: [new File(["x"], "sheet.xlsx")] } });
    fireEvent.click(screen.getByLabelText("Send message"));
    await screen.findByText("sheet.xlsx");
    expect(messagingApi.upload).toHaveBeenCalled();
  });

  test("Groups: Admin can create a group, non-admin cannot", async () => {
    await renderPage();
    expect(screen.queryByLabelText("Create group")).not.toBeInTheDocument();

    useMessagingAccess.mockReturnValue({ allowed: true, loading: false, isAdmin: true, path: "/admin/messaging" });
    messagingApi.createGroup.mockResolvedValue({ conversationId: CONV_GROUP.id });
    messagingApi.messages.mockResolvedValue({ messages: [], hasMore: false, receipts: [] });
    const { unmount } = render(<Messages />);
    unmount();
    render(<Messages />);
    const create = await screen.findAllByLabelText("Create group");
    fireEvent.click(create[create.length - 1]);
    const dialog = await screen.findByRole("dialog", { name: "Create group" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create group" }));
    expect(await within(dialog).findByText("Enter a group name.")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Group name"), { target: { value: "Ops" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create group" }));
    expect(await within(dialog).findByText("Select at least one member.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText(/Tom Lead/));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create group" }));
    await waitFor(() => expect(messagingApi.createGroup).toHaveBeenCalledWith("Ops", ["user:4"]));
  });

  test("no voice/video/screen-share call controls exist", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("Tom Lead").closest("button"));
    await screen.findByText("hello");
    expect(screen.queryByRole("button", { name: /call|video|voice|screen/i })).not.toBeInTheDocument();
  });

  test("shows an access-disabled state when the server refuses (403) and when permission is revoked live", async () => {
    messagingApi.directory.mockRejectedValue({ response: { status: 403, data: { message: "no" } } });
    render(<Messages />);
    expect(await screen.findByText("Messaging unavailable")).toBeInTheDocument();
  });

  test("revoked event replaces the page with the disabled state", async () => {
    await renderPage();
    act(() => socket.fire("msg:revoked", {}));
    expect(await screen.findByText("Messaging unavailable")).toBeInTheDocument();
  });

  test("shows a retryable error when loading fails (non-403)", async () => {
    messagingApi.conversations.mockRejectedValue(new Error("Network down"));
    render(<Messages />);
    expect(await screen.findByText("Network down")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  test("blocked users see the unavailable state without any data calls", async () => {
    useMessagingAccess.mockReturnValue({ allowed: false, loading: false, isAdmin: false, path: null });
    render(<Messages />);
    expect(screen.getByText("Messaging unavailable")).toBeInTheDocument();
    expect(messagingApi.directory).not.toHaveBeenCalled();
    expect(acquireSocket).not.toHaveBeenCalled();
  });
});
