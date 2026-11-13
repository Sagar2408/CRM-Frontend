import React from "react";
import { render, screen } from "@testing-library/react";
import { NAV, firstAllowedPath, itemPath, resolveNav } from "./navConfig";

// react-router-dom cannot be loaded by this repo's Jest setup (documented in
// AuthContext.processPerson.test.js), so it is replaced by minimal stand-ins.
let mockPath = "/hr";
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
  Navigate: ({ to }) => <div data-testid="redirect">{to}</div>,
  useLocation: () => ({ pathname: mockPath }),
}));
let mockPerms = { permissions: null, loading: false };
jest.mock("../hooks/usePermissions", () => ({ usePermissions: () => mockPerms }));
jest.mock("../features/Messaging/MessagingNav", () => ({ MessagingSidebarItem: () => <li data-testid="messaging-item">Messaging</li> }));

import { AccessGate, PermissionedSidebar } from "./PermissionedSidebar";

// The RolePermission columns the backend accepts (controllers/RolePermission.controller.js validPermissions).
const BACKEND_KEYS = [
  "overview", "assign_task", "task_management", "monitoring", "executive_details", "invoice", "dashboard", "user_management",
  "reporting", "settings", "billing", "weekly_summary", "account_updates", "marketing_emails", "push_notifications",
  "sms_notifications", "email_notifications", "create_user", "page_access", "messaging",
];

describe("navConfig", () => {
  test.each(Object.keys(NAV))("%s: every entry is tied to an EXISTING permission key (no second permission system)", (role) => {
    for (const item of [...NAV[role].general, ...NAV[role].external]) {
      expect(BACKEND_KEYS).toContain(item.perm);
    }
  });

  test("entries are unique per panel and every route lives under the panel's base path", () => {
    for (const cfg of Object.values(NAV)) {
      const ids = [...cfg.general, ...cfg.external].map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const item of [...cfg.general, ...cfg.external]) expect(itemPath(cfg, item).startsWith(cfg.base)).toBe(true);
    }
  });

  test.each(Object.keys(NAV))("%s: a user with no permission record, or all flags false, sees nothing", (role) => {
    expect(resolveNav(NAV[role], null).total).toBe(0);
    expect(resolveNav(NAV[role], {}).total).toBe(0);
    const allFalse = Object.fromEntries(BACKEND_KEYS.map((k) => [k, false]));
    expect(resolveNav(NAV[role], allFalse).total).toBe(0);
    // only an exact boolean true counts (a truthy string/1 does not grant a page)
    expect(resolveNav(NAV[role], { dashboard: "true", settings: 1 }).total).toBe(0);
  });

  test("HR: each enabled key reveals exactly its own page, split into GENERAL and EXTERNAL", () => {
    const only = (k) => resolveNav(NAV.hr, { [k]: true });
    expect(only("billing").general.map((i) => i.id)).toEqual(["payroll"]);
    expect(only("account_updates").general.map((i) => i.id)).toEqual(["leave"]);
    expect(only("user_management").general.map((i) => i.id)).toEqual(["employees"]);
    expect(only("weekly_summary").general.map((i) => i.id)).toEqual(["support"]);
    expect(only("executive_details").general.map((i) => i.id)).toEqual(["teams", "attendance"]);
    expect(only("assign_task")).toMatchObject({ general: [], external: [{ id: "upload" }] });
    expect(only("task_management").external.map((i) => i.id)).toEqual(["assign"]);
    expect(only("monitoring").external.map((i) => i.id)).toEqual(["monitoring"]);
    expect(only("messaging").external.map((i) => i.id)).toEqual(["messaging"]);
  });

  test("Team Lead no longer exists as a panel", () => {
    expect(Object.keys(NAV).sort()).toEqual(["hr", "manager"]);
  });

  test("Manager: dashboard/overview is also permission-gated, not always shown", () => {
    for (const role of ["manager"]) {
      expect(resolveNav(NAV[role], { settings: true }).general.map((i) => i.id)).toEqual(["settings"]);
      expect(resolveNav(NAV[role], { dashboard: true }).general.map((i) => i.id)).toEqual(["overview"]);
    }
  });

  test("firstAllowedPath skips pages the user cannot open and is null when nothing is enabled", () => {
    expect(firstAllowedPath(NAV.hr, { billing: true, settings: true })).toBe("/hr/payroll");
    expect(firstAllowedPath(NAV.manager, { dashboard: true })).toBe("/manager");
    expect(firstAllowedPath(NAV.manager, {})).toBeNull();
    expect(firstAllowedPath(NAV.hr, { assign_task: true })).toBe("/hr/assign-task");
  });
});

describe("<PermissionedSidebar />", () => {
  beforeEach(() => {
    mockPath = "/hr";
    mockPerms = { permissions: null, loading: false };
  });

  test("shows a GENERAL and an EXTERNAL section with only the enabled pages", () => {
    mockPerms = { permissions: { dashboard: true, billing: true, assign_task: true, monitoring: true }, loading: false };
    render(<PermissionedSidebar config={NAV.hr} />);
    expect(screen.getByTestId("nav-general")).toHaveTextContent("General");
    expect(screen.getByTestId("nav-external")).toHaveTextContent("External");
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Payroll")).toBeInTheDocument();
    expect(screen.getByText("Upload Leads")).toBeInTheDocument();
    expect(screen.getByText("Monitoring")).toBeInTheDocument();
    for (const hidden of ["Employee Management", "Leave Management", "Settings", "Lead Assign", "Help & Support"]) {
      expect(screen.queryByText(hidden)).not.toBeInTheDocument();
    }
    expect(screen.queryByTestId("messaging-item")).not.toBeInTheDocument();
  });

  test("hides the External heading when no external page is enabled", () => {
    mockPerms = { permissions: { settings: true }, loading: false };
    render(<PermissionedSidebar config={NAV.manager} />);
    expect(screen.getByTestId("nav-general")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-external")).not.toBeInTheDocument();
  });

  test("messaging appears under External only with the messaging permission", () => {
    mockPerms = { permissions: { messaging: true }, loading: false };
    render(<PermissionedSidebar config={NAV.manager} />);
    expect(screen.getByTestId("messaging-item")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-general")).not.toBeInTheDocument();
  });

  test("a user with nothing enabled gets an explanatory empty state, never a link", () => {
    mockPerms = { permissions: null, loading: false };
    render(<PermissionedSidebar config={NAV.hr} />);
    expect(screen.getByTestId("nav-empty")).toHaveTextContent(/No pages enabled/i);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("<AccessGate />", () => {
  beforeEach(() => {
    mockPerms = { permissions: null, loading: false };
  });

  test("blocks all content and explains why when no page is authorised", () => {
    render(<AccessGate config={NAV.hr} landing><div>secret dashboard</div></AccessGate>);
    expect(screen.getByTestId("no-pages")).toBeInTheDocument();
    expect(screen.queryByText("secret dashboard")).not.toBeInTheDocument();
  });

  test("the landing page redirects to the first authorised page when the dashboard is not allowed", () => {
    mockPerms = { permissions: { billing: true }, loading: false };
    render(<AccessGate config={NAV.hr} landing><div>secret dashboard</div></AccessGate>);
    expect(screen.getByTestId("redirect")).toHaveTextContent("/hr/payroll");
    expect(screen.queryByText("secret dashboard")).not.toBeInTheDocument();
  });

  test("renders the content once at least one page is authorised (non-landing routes)", () => {
    mockPerms = { permissions: { billing: true }, loading: false };
    render(<AccessGate config={NAV.hr}><div>payroll page</div></AccessGate>);
    expect(screen.getByText("payroll page")).toBeInTheDocument();
  });

  test("shows a loading state (and no content) while permissions load", () => {
    mockPerms = { permissions: null, loading: true };
    render(<AccessGate config={NAV.hr}><div>x</div></AccessGate>);
    expect(screen.getByText(/Loading permissions/)).toBeInTheDocument();
    expect(screen.queryByText("x")).not.toBeInTheDocument();
  });
});
