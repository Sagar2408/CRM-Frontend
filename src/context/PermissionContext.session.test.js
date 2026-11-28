import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { PermissionProvider } from "./PermissionContext";
import { AuthContext } from "./authContextObject";
import { AccessGate, PermissionedSidebar } from "../layouts/PermissionedSidebar";
import { NAV } from "../layouts/navConfig";
import { permissionService } from "../services/permissionService";

// Regression tests for "HR sees 'No pages are available yet' although every permission is
// enabled": PermissionProvider is mounted once, above the login page, and login navigates
// without reloading. It must (re)load permissions whenever the signed-in account changes.
// The REAL provider, gate and sidebar are used; only the HTTP service is mocked.

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
  Navigate: ({ to }) => <div data-testid="redirect">{to}</div>,
  useLocation: () => ({ pathname: "/hr" }),
}));
jest.mock("../features/Messaging/MessagingNav", () => ({ MessagingSidebarItem: () => <li>Messaging</li> }));
jest.mock("../services/permissionService", () => ({ permissionService: { fetchPermissionsForUser: jest.fn() } }));

const HR_ALL = {
  dashboard: true, user_management: true, executive_details: true, account_updates: true, billing: true,
  weekly_summary: true, settings: true, assign_task: true, task_management: true, monitoring: true, messaging: true,
};
const fetch = permissionService.fetchPermissionsForUser;

// What AuthContext.login / logout do: write the session to storage, then set `user`.
let signIn;
let signOut;
const seen = [];
const Auth = ({ children }) => {
  const [user, setUser] = React.useState(null);
  signIn = (account, token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(account));
    setUser(account);
  };
  signOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };
  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
};
const Panel = () => {
  const stored = localStorage.getItem("user");
  if (!stored) return <p>LOGIN PAGE</p>;
  return (
    <>
      <PermissionedSidebar config={NAV.hr} />
      <AccessGate config={NAV.hr}><p>PANEL CONTENT</p></AccessGate>
    </>
  );
};
const Screen = () => {
  React.useContext(AuthContext);
  // records every frame in which the "no pages" message was on screen
  React.useLayoutEffect(() => {
    if (document.querySelector('[data-testid="no-pages"]')) seen.push("no-pages");
  });
  return <Panel />;
};
const mount = () => render(<Auth><PermissionProvider><Screen /></PermissionProvider></Auth>);
const links = () => screen.queryAllByRole("link").map((a) => a.getAttribute("href"));
const hr = { id: 1, role: "HR", name: "Kanchan" };

beforeEach(() => {
  localStorage.clear();
  seen.length = 0;
  fetch.mockReset();
});

test("logging in on an already-open app loads that user's permissions, with no false 'no pages' frame", async () => {
  fetch.mockResolvedValue(HR_ALL);
  mount();
  expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();

  await act(async () => signIn(hr, "t1"));

  expect(fetch).toHaveBeenCalledWith(1, "HR");
  expect(screen.getByText("PANEL CONTENT")).toBeInTheDocument();
  expect(links()).toEqual(expect.arrayContaining(["/hr", "/hr/employees", "/hr/payroll", "/hr/leave-management", "/hr/settings", "/hr/monitoring"]));
  expect(seen).toEqual([]);
});

test("after an Admin session in the same tab, HR gets HR permissions (not the Admin's cached FULL_ACCESS)", async () => {
  fetch.mockResolvedValue(HR_ALL);
  mount();
  await act(async () => signIn({ id: 1, role: "Admin" }, "admin-token"));
  expect(fetch).not.toHaveBeenCalled(); // Admin needs no record
  await act(async () => signOut());
  await act(async () => signIn(hr, "hr-token"));
  expect(screen.getByText("PANEL CONTENT")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("the next account never sees the previous account's pages", async () => {
  fetch.mockResolvedValueOnce(HR_ALL);
  mount();
  await act(async () => signIn(hr, "t1"));
  expect(links().length).toBeGreaterThan(5);
  await act(async () => signOut());

  let answer;
  fetch.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
  await act(async () => signIn({ id: 2, role: "HR" }, "t2"));
  expect(screen.getByText(/loading permissions/i)).toBeInTheDocument();
  expect(links()).toEqual([]);
  await act(async () => answer({ billing: true }));
  expect(links()).toEqual(["/hr/payroll"]);
});

test("a new login of the same role and id (e.g. another company) reloads, and a late old answer is ignored", async () => {
  let first;
  fetch.mockImplementationOnce(() => new Promise((resolve) => (first = resolve)));
  fetch.mockResolvedValueOnce({ settings: true });
  mount();
  await act(async () => signIn(hr, "company-a"));
  await act(async () => signIn(hr, "company-b"));
  await act(async () => first(HR_ALL));
  expect(links()).toEqual(["/hr/settings"]);
});

test("a disabled permission disappears on the next load", async () => {
  localStorage.setItem("token", "t");
  localStorage.setItem("user", JSON.stringify(hr));
  fetch.mockResolvedValueOnce(HR_ALL).mockResolvedValueOnce({ ...HR_ALL, billing: false });
  const first = mount();
  expect(await screen.findByText("Payroll")).toBeInTheDocument();
  first.unmount(); // refresh
  mount();
  expect(await screen.findByText("Settings")).toBeInTheDocument();
  expect(screen.queryByText("Payroll")).not.toBeInTheDocument();
});

test("a failed request says so and can be retried, instead of claiming nothing is enabled", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  fetch.mockRejectedValueOnce(new Error("Network Error")).mockResolvedValueOnce(HR_ALL);
  mount();
  await act(async () => signIn(hr, "t1"));
  expect(screen.getByTestId("permissions-error")).toBeInTheDocument();
  expect(screen.queryByTestId("no-pages")).not.toBeInTheDocument();
  expect(screen.queryByText("PANEL CONTENT")).not.toBeInTheDocument();
  expect(links()).toEqual([]);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
  expect(screen.getByText("PANEL CONTENT")).toBeInTheDocument();
});

test("no record (404) or nothing enabled still shows 'no pages' and no content", async () => {
  fetch.mockRejectedValueOnce({ response: { status: 404 } });
  mount();
  await act(async () => signIn(hr, "t1"));
  expect(screen.getByTestId("no-pages")).toBeInTheDocument();
  expect(screen.queryByText("PANEL CONTENT")).not.toBeInTheDocument();
});
