import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import SidebarandNavbar from "./SidebarandNavbar";
import { ThemeContext } from "../features/admin/ThemeContext";
import { SearchContext } from "../context/SearchContext";

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: "/executive" }),
}));
jest.mock("../features/Messaging/MessagingNav", () => ({ MessageNavIcon: () => null, MessagingSidebarItem: () => null }));
jest.mock("../BeepNotification", () => () => null);
jest.mock("../features/executive/ExecutiveActivity", () => () => null);
jest.mock("../features/executive/LeadSearch", () => () => <div data-testid="lead-search" />);
jest.mock("../features/executive/ExecutiveClock", () => () => <div data-testid="clock" />);
let mockInfo = { username: "sam", role: "Executive" };
jest.mock("../context/ApiContext", () => ({
  useApi: () => ({
    executiveInfo: mockInfo,
    executiveLoading: false,
    fetchNotifications: jest.fn(),
    unreadCount: 0,
    notifications: [],
    markNotificationReadAPI: jest.fn(),
  }),
}));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ logout: jest.fn() }) }));
jest.mock("../context/breakTimerContext", () => ({
  useBreakTimer: () => ({ breakTimer: "00:00:00", stopBreak: jest.fn(), isBreakActive: false, resetBreakTimer: jest.fn() }),
}));

const setViewport = (mobile) => {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: mobile && query.includes("991"),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }));
};

const renderBar = (props = {}) =>
  render(
    <ThemeContext.Provider value={{ theme: "light" }}>
      <SearchContext.Provider value={{ setSearchQuery: jest.fn() }}>
        <SidebarandNavbar collapsed={false} onToggleCollapse={jest.fn()} {...props} />
      </SearchContext.Provider>
    </ThemeContext.Provider>
  );

beforeEach(() => {
  mockInfo = { username: "sam", role: "Executive" };
  localStorage.clear();
  localStorage.setItem("user", JSON.stringify({ id: 1, role: "Executive" }));
  setViewport(false);
});

test("ELSA AI is a sidebar item and is no longer a header icon", () => {
  renderBar();
  const sidebar = document.getElementById("exec-sidebar");
  const link = within(sidebar).getByRole("link", { name: "ELSA AI" });
  expect(link).toHaveAttribute("href", "/executive/elsa");
  expect(document.querySelector(".navbar .bot_icon")).toBeNull();
  expect(document.querySelector('.navbar [title="Open ELSA AI"]')).toBeNull();
});

test("every sidebar link has a label and a tooltip text; the invoice link is gone", () => {
  renderBar();
  const sidebar = document.getElementById("exec-sidebar");
  for (const name of ["Dashboard", "Fresh Leads", "Follow-ups", "Converted Leads", "Closed Leads", "ELSA AI", "Scheduled Meetings", "Settings"]) {
    const link = within(sidebar).getByRole("link", { name });
    expect(link).toHaveAttribute("data-tip", name);
    expect(link.querySelector(".sb-label")).toHaveTextContent(name);
  }
  expect(within(sidebar).queryByText(/invoice/i)).not.toBeInTheDocument();
});

test("the Leads dropdown is gone: four direct links with the existing routes", () => {
  renderBar();
  const sidebar = document.getElementById("exec-sidebar");
  expect(within(sidebar).queryByRole("link", { name: "Leads" })).not.toBeInTheDocument();
  expect(sidebar.querySelector(".submenu_nav")).toBeNull();
  const hrefs = ["Fresh Leads", "Follow-ups", "Converted Leads", "Closed Leads"].map((n) => within(sidebar).getByRole("link", { name: n }).getAttribute("href"));
  expect(hrefs).toEqual(["/executive/freshlead", "/executive/follow-up", "/executive/customer", "/executive/close-leads"]);
});

test("collapsed: the four lead links stay as icon-only links with tooltips", () => {
  renderBar({ collapsed: true });
  const sidebar = document.getElementById("exec-sidebar");
  for (const name of ["Fresh Leads", "Follow-ups", "Converted Leads", "Closed Leads"]) {
    const link = within(sidebar).getByRole("link", { name });
    expect(link).toHaveAttribute("data-tip", name);
    expect(link.querySelector("svg")).not.toBeNull();
  }
});

test("the hamburger lives INSIDE the sidebar header (beside the logo) and not in the top bar on desktop", () => {
  renderBar();
  const sidebar = document.getElementById("exec-sidebar");
  const burger = within(sidebar).getByRole("button", { name: "Collapse sidebar" });
  expect(burger.closest(".sidebar_heading")).not.toBeNull();
  expect(burger.closest(".sidebar_heading")).toHaveTextContent("CRM");
  expect(document.querySelector(".navbar .exec-hamburger")).toBeNull();
});

test("the hamburger collapses / expands the sidebar on desktop", () => {
  const onToggleCollapse = jest.fn();
  const { rerender } = renderBar({ onToggleCollapse });
  const burger = screen.getByRole("button", { name: "Collapse sidebar" });
  expect(burger).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(burger);
  expect(onToggleCollapse).toHaveBeenCalledTimes(1);

  rerender(
    <ThemeContext.Provider value={{ theme: "light" }}>
      <SearchContext.Provider value={{ setSearchQuery: jest.fn() }}>
        <SidebarandNavbar collapsed onToggleCollapse={onToggleCollapse} />
      </SearchContext.Provider>
    </ThemeContext.Provider>
  );
  expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
});

test("mobile: a header button opens the off-canvas drawer, the in-sidebar hamburger and the backdrop close it", () => {
  setViewport(true);
  const onToggleCollapse = jest.fn();
  renderBar({ collapsed: true, onToggleCollapse });
  const sidebar = document.getElementById("exec-sidebar");
  expect(sidebar).not.toHaveClass("active");
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  expect(onToggleCollapse).not.toHaveBeenCalled(); // mobile never uses the desktop preference
  expect(sidebar).toHaveClass("active");
  fireEvent.click(within(sidebar).getByRole("button", { name: "Close menu" }));
  expect(sidebar).not.toHaveClass("active");
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  fireEvent.click(document.querySelector(".exec-backdrop"));
  expect(sidebar).not.toHaveClass("active");
});

test("utility bar: search, clock, notifications, messaging, tracker and a profile menu with logout", () => {
  renderBar();
  const bar = document.querySelector(".navbar");
  expect(within(bar).getByTestId("lead-search")).toBeInTheDocument();
  expect(within(bar).getByTestId("clock")).toBeInTheDocument();
  expect(within(bar).getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  expect(within(bar).getByRole("button", { name: "Activity tracker" })).toBeInTheDocument();
  const profile = within(bar).getByRole("button", { name: /sam/ });
  expect(profile).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(profile);
  expect(within(bar).getByRole("menuitem", { name: "Logout" })).toBeInTheDocument();
  expect(within(bar).getByRole("menuitem", { name: /Settings/ })).toHaveAttribute("href", "/executive/settings");
});

test("profile shows the employee's real name and e-mail (not the login username)", () => {
  mockInfo = { id: 7, username: "executive2", firstname: "Dev Kumar", lastname: "Singh", email: "dev@gmail.com", role: "Executive" };
  renderBar();
  const bar = document.querySelector(".navbar");
  const profile = within(bar).getByRole("button", { name: /Dev Kumar Singh/ });
  expect(profile).not.toHaveTextContent("executive2");
  expect(profile.querySelector(".exec-profile__avatar")).toHaveTextContent("D");
  fireEvent.click(profile);
  const menu = within(bar).getByRole("menu");
  expect(within(menu).getByText("Dev Kumar Singh")).toBeInTheDocument();
  expect(within(menu).getByText("dev@gmail.com")).toBeInTheDocument();
  expect(within(menu).getByText("Executive")).toBeInTheDocument();
  expect(within(menu).getByRole("menuitem", { name: "Logout" })).toBeInTheDocument();
  expect(within(menu).getByRole("menuitem", { name: /Settings/ })).toBeInTheDocument();
});

test("falls back to the username when no name is stored", () => {
  mockInfo = { username: "sam", email: "sam@x.com", role: "Executive" };
  renderBar();
  const profile = within(document.querySelector(".navbar")).getByRole("button", { name: /sam/ });
  expect(profile.querySelector(".exec-profile__avatar")).toHaveTextContent("S");
});
