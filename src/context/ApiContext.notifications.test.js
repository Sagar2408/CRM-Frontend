import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { ApiProvider, useApi } from "./ApiContext";
import { AuthContext } from "./authContextObject";
import ManagerNavbar from "../layouts/ManagerNavbar";
import AdminNavbar from "../layouts/AdminNavbar";
import HrNavbar from "../layouts/HrNavbar";
import AdminNotification from "../features/admin/AdminNotification";
import { isTransientError, retryTransient, RETRY_DELAYS_MS } from "../utils/retryTransient";
import { ThemeContext } from "../features/admin/ThemeContext";
import * as apiService from "../services/apiService";

// Regression tests for the Manager notification request loop. The REAL ApiProvider,
// navbars and notification page are rendered; only the HTTP layer is mocked.
jest.mock("../services/apiService", () => {
  const fns = {};
  return new Proxy(
    {},
    {
      get: (_t, name) => {
        if (name === "__esModule") return true;
        if (!fns[name]) fns[name] = jest.fn();
        return fns[name];
      },
    }
  );
});
jest.mock("../services/fileUpload", () => new Proxy({}, { get: () => jest.fn() }));
jest.mock("react-router-dom", () => ({
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: "/manager", key: "k" }),
  Link: ({ children }) => <a href="/">{children}</a>,
}));
jest.mock("./AuthContext", () => ({ useAuth: () => ({ logout: () => {}, handleLogoutManager: () => {}, handleLogoutHr: () => {} }) }));
jest.mock("../features/admin/ThemeContext", () => {
  const ReactLib = require("react");
  return { ThemeContext: ReactLib.createContext({ theme: "light", changeTheme: () => {} }) };
});
jest.mock("../features/Messaging/MessagingNav", () => ({ MessageNavIcon: () => null }));
jest.mock("../features/admin/SidebarToggle", () => () => null);
jest.mock("../features/spinner/AdminSpinner", () => () => null);
jest.mock("../features/admin/AnnouncementsPanel", () => () => null);
jest.mock("../hooks/useCanAssignLeads", () => () => false);
const mockLoading = { isLoading: false, variant: "", showLoader: () => {}, hideLoader: () => {} };
jest.mock("./LoadingContext", () => ({ useLoading: () => mockLoading }));

const fetchMock = () => apiService.fetchNotificationsByUser;
const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data: { message: "x" } } });
const note = (id, extra = {}) => ({ id, message: `Manager notice ${id}`, targetRole: "manager", is_read: false, createdAt: "2026-11-01T10:00:00Z", ...extra });

const signInStorage = (role, id = 1, token = `${role}-token`) => {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify({ id, role }));
};
const badge = () => document.querySelector(".admin-notification_badge")?.textContent ?? null;
const unavailable = () => screen.queryByLabelText("Notifications unavailable");

/** Let pending promises and timers (retry delays) run, repeatedly. */
const settle = async (ms = 0, rounds = 20) => {
  for (let i = 0; i < rounds; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(ms / rounds);
      await Promise.resolve();
      await Promise.resolve();
    });
  }
};

let rerenderAll;
let apiRef;
const Capture = () => {
  apiRef = useApi();
  return null;
};
function mount(children) {
  const Harness = () => {
    const [tick, setTick] = React.useState(0);
    const [user, setUser] = React.useState(null);
    rerenderAll = (nextUser) => {
      if (nextUser !== undefined) setUser(nextUser);
      setTick((t) => t + 1);
    };
    return (
      <AuthContext.Provider value={{ user }}>
        <ThemeContext.Provider value={{ theme: "light", changeTheme: () => {} }}>
          <ApiProvider>
            <Capture />
            <div data-tick={tick}>{typeof children === "function" ? children(tick) : children}</div>
          </ApiProvider>
        </ThemeContext.Provider>
      </AuthContext.Provider>
    );
  };
  return render(<Harness />);
}

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  // CRA resets mock implementations before each test
  for (const name of ["adminMeeting", "fetchAllExecutivesActivities", "fetchExecutivesAPI"]) apiService[name].mockResolvedValue([]);
  apiService.getHrById.mockResolvedValue({ id: 1, name: "HR", email: "hr@x.test", role: "HR" }); // the provider reads it for HR sessions
});
afterEach(() => jest.useRealTimers());

describe("Manager navbar", () => {
  test("requests the list once, shows the unread count, and never repeats on re-renders", async () => {
    signInStorage("Manager");
    fetchMock().mockResolvedValue([note(1), note(2), note(3, { is_read: true })]);
    mount(() => <ManagerNavbar />);
    await settle();
    for (let i = 0; i < 25; i += 1) act(() => rerenderAll());
    await settle(60000);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(fetchMock()).toHaveBeenCalledWith({ userId: 1, userRole: "Manager" });
    expect(badge()).toBe("2");
    expect(unavailable()).toBeNull();
  });

  test("an empty list is final too (the old loop did not need an error)", async () => {
    signInStorage("Manager");
    fetchMock().mockResolvedValue([]);
    mount(() => <ManagerNavbar />);
    await settle();
    for (let i = 0; i < 25; i += 1) act(() => rerenderAll());
    await settle(60000);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(badge()).toBeNull();
  });

  test.each([400, 401, 403, 404, 422])("a %s is requested once, never retried, and shown as unavailable", async (status) => {
    signInStorage("Manager");
    fetchMock().mockRejectedValue(httpError(status));
    mount(() => <ManagerNavbar />);
    await settle();
    for (let i = 0; i < 25; i += 1) act(() => rerenderAll());
    await settle(600000);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(unavailable()).toBeInTheDocument();
  });

  test.each([["a 503", httpError(503)], ["a 429", httpError(429)], ["a network failure", new Error("Network Error")]])(
    "%s is retried twice with a pause, then stops",
    async (_label, error) => {
      signInStorage("Manager");
      fetchMock().mockRejectedValue(error);
      mount(() => <ManagerNavbar />);
      await settle();
      expect(fetchMock()).toHaveBeenCalledTimes(1);
      await settle(RETRY_DELAYS_MS[0]);
      expect(fetchMock()).toHaveBeenCalledTimes(2);
      expect(unavailable()).toBeNull();
      await settle(RETRY_DELAYS_MS[1]);
      expect(fetchMock()).toHaveBeenCalledTimes(3);
      for (let i = 0; i < 25; i += 1) act(() => rerenderAll());
      await settle(600000);
      expect(fetchMock()).toHaveBeenCalledTimes(3);
      expect(unavailable()).toBeInTheDocument();
    }
  );

  test("a transient failure that recovers shows the notifications and no error", async () => {
    signInStorage("Manager");
    fetchMock().mockRejectedValueOnce(httpError(502)).mockResolvedValue([note(1)]);
    mount(() => <ManagerNavbar />);
    await settle(5000);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
    expect(badge()).toBe("1");
    expect(unavailable()).toBeNull();
  });
});

describe("notification page and navbar together", () => {
  test("share one request; the page shows the Manager's messages as written", async () => {
    signInStorage("Manager");
    fetchMock().mockResolvedValue([note(1, { message: "Leave approved: 2 days" }), note(2, { message: "Meeting moved to Friday" })]);
    mount(
      <>
        <ManagerNavbar />
        <AdminNotification />
      </>
    );
    await settle();
    await settle(60000);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Leave approved: 2 days")).toBeInTheDocument();
    expect(screen.getByText("Meeting moved to Friday")).toBeInTheDocument();
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
  });

  test("a failure shows a message with a manual retry that makes exactly one more request", async () => {
    signInStorage("Manager");
    fetchMock().mockRejectedValue(httpError(400));
    mount(<AdminNotification />);
    await settle();
    expect(screen.getByRole("alert")).toHaveTextContent("Notifications could not be loaded.");
    expect(screen.queryByText("No notifications yet.")).not.toBeInTheDocument();
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    fetchMock().mockResolvedValue([note(7)]);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
    await settle(60000);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Manager notice 7")).toBeInTheDocument();
  });

  test("Admin copy events keep their existing layout", async () => {
    signInStorage("Admin");
    fetchMock().mockResolvedValue([{ id: 1, userId: 4, targetRole: "admin", message: 'sam Copied: "98765"', is_read: false, createdAt: "2026-11-01T10:00:00Z" }]);
    mount(<AdminNotification />);
    await settle();
    expect(screen.getByText("Copied")).toBeInTheDocument();
    expect(screen.getByText("98765")).toBeInTheDocument();
  });

  test("marking several as read keeps every mark", async () => {
    signInStorage("Manager");
    fetchMock().mockResolvedValue([note(1), note(2)]);
    apiService.markNotificationAsRead.mockResolvedValue({});
    mount(<ManagerNavbar />);
    await settle();
    await act(async () => {
      await Promise.all([apiRef.markNotificationReadAPI(1), apiRef.markNotificationReadAPI(2)]);
    });
    expect(apiRef.unreadCount).toBe(0);
  });
});

describe("one session never sees another's notifications", () => {
  test("after logout and a new login in the same tab the list is reloaded, not inherited", async () => {
    signInStorage("Admin", 1, "admin-token");
    fetchMock().mockResolvedValueOnce([note(1, { targetRole: "admin" }), note(2, { targetRole: "admin" })]);
    let view = "admin";
    mount(() => (view === "admin" ? <AdminNavbar /> : view === "manager" ? <ManagerNavbar /> : null));
    await settle();
    expect(badge()).toBe("2");

    localStorage.clear();
    view = null;
    act(() => rerenderAll(null));
    expect(apiRef.notifications).toEqual([]);

    let answer;
    fetchMock().mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    signInStorage("Manager", 1, "manager-token");
    view = "manager";
    act(() => rerenderAll({ id: 1, role: "Manager" }));
    await settle();
    expect(badge()).toBeNull(); // nothing of the Admin's while loading
    await act(async () => answer([note(9)]));
    expect(badge()).toBe("1");
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  test("a late answer for the previous session is ignored", async () => {
    signInStorage("Manager", 1, "t1");
    let late;
    fetchMock().mockImplementationOnce(() => new Promise((resolve) => (late = resolve))).mockResolvedValue([note(2)]);
    let key = 1;
    mount(() => <ManagerNavbar key={key} />);
    await settle();
    signInStorage("Manager", 2, "t2");
    key = 2;
    act(() => rerenderAll({ id: 2 }));
    await settle();
    await act(async () => late([note(1), note(3), note(4)]));
    expect(badge()).toBe("1");
  });
});

describe.each([
  ["Admin", AdminNavbar],
  ["HR", HrNavbar],
])("%s navbar", (role, Navbar) => {
  test("still loads once and shows the unread count", async () => {
    signInStorage(role);
    fetchMock().mockResolvedValue([note(1, { targetRole: role.toLowerCase() })]);
    mount(() => <Navbar />);
    await settle();
    for (let i = 0; i < 25; i += 1) act(() => rerenderAll());
    await settle(60000);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(badge()).toBe("1");
  });

  test.each([[400, 1], [500, 3]])("a %s makes %s request(s) and then stops", async (status, calls) => {
    signInStorage(role);
    fetchMock().mockRejectedValue(httpError(status));
    mount(() => <Navbar />);
    await settle(10000);
    for (let i = 0; i < 25; i += 1) act(() => rerenderAll());
    await settle(600000);
    expect(fetchMock()).toHaveBeenCalledTimes(calls);
    expect(unavailable()).toBeInTheDocument();
  });
});

describe("retry rules", () => {
  test("only network failures and temporary statuses are transient", () => {
    expect([undefined, 408, 429, 500, 502, 503, 504].map((s) => isTransientError(s ? httpError(s) : new Error("net")))).toEqual(Array(7).fill(true));
    expect([400, 401, 403, 404, 409, 422, 501].map((s) => isTransientError(httpError(s)))).toEqual(Array(7).fill(false));
    expect(isTransientError({ code: "ERR_CANCELED" })).toBe(false);
  });

  test("retries are abandoned when no longer wanted", async () => {
    const task = jest.fn().mockRejectedValue(httpError(503));
    const run = retryTransient(task, { isStillWanted: () => false }).catch((e) => e);
    await settle(10000);
    await run;
    expect(task).toHaveBeenCalledTimes(1);
  });
});
