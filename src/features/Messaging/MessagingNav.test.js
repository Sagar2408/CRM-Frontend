import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MessageNavIcon, MessagingSidebarItem } from "./MessagingNav";
import { messagingApi, acquireSocket } from "../../services/messagingApi";
import { usePermissionContext } from "../../context/PermissionContext";

jest.mock("../../services/messagingApi", () => ({
  messagingApi: { unread: jest.fn() },
  acquireSocket: jest.fn(),
  releaseSocket: jest.fn(),
  UNREAD_EVENT: "messaging:unread-changed",
}));
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
  useNavigate: () => mockNavigate,
}));
jest.mock("../../context/PermissionContext", () => ({ usePermissionContext: jest.fn() }));

const fakeSocket = () => {
  const h = {};
  return { on: (e, f) => ((h[e] = h[e] || []).push(f), undefined), off: () => {}, fire: (e, p) => (h[e] || []).forEach((f) => f(p)) };
};

const setUser = (user) => localStorage.setItem("user", JSON.stringify(user));
const page = (ui) => render(ui);

let socket;
beforeEach(() => {
  jest.clearAllMocks();
  socket = fakeSocket();
  acquireSocket.mockReturnValue(socket);
  messagingApi.unread.mockResolvedValue({ unread: 0 });
  usePermissionContext.mockReturnValue({ permissions: null, loading: false });
});

describe("navbar message icon / sidebar item", () => {
  test("hidden for an employee without the messaging permission", () => {
    setUser({ id: 2, role: "Executive" });
    usePermissionContext.mockReturnValue({ permissions: { messaging: false }, loading: false });
    page(
      <>
        <MessageNavIcon />
        <MessagingSidebarItem />
      </>
    );
    expect(screen.queryByLabelText("Messaging")).not.toBeInTheDocument();
    expect(screen.queryByText("Messaging")).not.toBeInTheDocument();
    expect(messagingApi.unread).not.toHaveBeenCalled();
  });

  test("hidden for customer-shaped users", () => {
    setUser({ id: 9, type: "customer" });
    page(<MessageNavIcon />);
    expect(screen.queryByLabelText("Messaging")).not.toBeInTheDocument();
  });

  test.each([
    [{ id: 1, role: "Admin" }, null],
    [{ id: 4, role: "TL" }, { messaging: true }],
    [{ id: 2, role: "Executive" }, { messaging: true }],
    [{ id: 3, role: "Manager" }, { messaging: true }],
    [{ id: 5, role: "HR" }, { messaging: true }],
    [{ id: 6, type: "processperson" }, null],
  ])("shown for %j and shows a red dot only when there are unread messages", async (user, permissions) => {
    setUser(user);
    usePermissionContext.mockReturnValue({ permissions, loading: false });
    messagingApi.unread.mockResolvedValue({ unread: 3 });
    page(<MessageNavIcon />);
    expect(screen.getByLabelText("Messaging")).toBeInTheDocument();
    expect(await screen.findByTestId("msg-unread-dot")).toBeInTheDocument();
  });

  test("no dot at zero; dot appears live on a new message", async () => {
    setUser({ id: 1, role: "Admin" });
    page(<MessageNavIcon />);
    await waitFor(() => expect(messagingApi.unread).toHaveBeenCalled());
    expect(screen.queryByTestId("msg-unread-dot")).not.toBeInTheDocument();
    messagingApi.unread.mockResolvedValue({ unread: 1 });
    act(() => socket.fire("msg:new", {}));
    expect(await screen.findByTestId("msg-unread-dot")).toBeInTheDocument();
  });

  test("clicking the navbar icon goes to the role's messaging page", () => {
    setUser({ id: 4, role: "TL" });
    usePermissionContext.mockReturnValue({ permissions: { messaging: true }, loading: false });
    page(<MessageNavIcon />);
    fireEvent.click(screen.getByLabelText("Messaging"));
    expect(mockNavigate).toHaveBeenCalledWith("/team-lead/messaging");
  });

  test("sidebar item links to the right path per role", () => {
    setUser({ id: 1, role: "Admin" });
    const { unmount } = page(<MessagingSidebarItem />);
    expect(screen.getByText("Messaging").closest("a")).toHaveAttribute("href", "/admin/messaging");
    unmount();
    setUser({ id: 6, type: "processperson" });
    page(<MessagingSidebarItem variant="exec" />);
    expect(screen.getByText(/Messaging/).closest("a")).toHaveAttribute("href", "/process/messaging");
  });
});
