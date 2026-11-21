import React from "react";
import { render, screen } from "@testing-library/react";
import fs from "fs";
import path from "path";
import ProcessSidebarNavbar from "./ProcessSidebarNavbar";
import { ThemeContext } from "../features/admin/ThemeContext";

let mockPath = "/process";
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: mockPath }),
}));
jest.mock("../features/Messaging/MessagingNav", () => ({ MessagingSidebarItem: () => <li>Messaging</li> }));
jest.mock("../BeepNotification", () => () => null);
jest.mock("../features/executive/ProcessActivity", () => () => null);
jest.mock("../features/process-client/ProcessClock", () => () => null);
jest.mock("../features/executive/ProfileAvatar", () => () => null);
jest.mock("../context/ApiContext", () => ({
  useApi: () => ({ executiveLoading: false, fetchNotifications: jest.fn(), unreadCount: 0, notifications: [], markNotificationReadAPI: jest.fn() }),
}));
jest.mock("../context/ProcessAuthContext", () => ({ useProcess: () => ({ logout: jest.fn() }) }));

beforeEach(() => localStorage.setItem("user", JSON.stringify({ id: 1, fullName: "Pat Process", type: "processperson" })));

const links = () => screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")]);

describe("Process Person sidebar", () => {
  test("has ELSA AI and no Invoice", () => {
    render(
      <ThemeContext.Provider value={{ theme: "light" }}>
        <ProcessSidebarNavbar clock={{}} />
      </ThemeContext.Provider>
    );
    const items = links();
    expect(items).toContainEqual(["ELSA AI", "/process/elsa"]);
    expect(items.map(([label]) => label)).not.toContain("Invoice");
    expect(items.map(([, href]) => href).some((h) => /invoice/i.test(h))).toBe(false);
    // existing navigation is untouched
    ["Dashboard", "Fresh Leads", "Follow-ups", "Rejected Leads", "Final Stage", "Completed Clients", "Scheduled Meetings", "Manage Clients", "Settings"].forEach((l) =>
      expect(items.map(([label]) => label)).toContain(l)
    );
  });
});

describe("Manage Clients is pinned at the very bottom", () => {
  const renderBar = () =>
    render(
      <ThemeContext.Provider value={{ theme: "light" }}>
        <ProcessSidebarNavbar clock={{}} />
      </ThemeContext.Provider>
    );

  test("the main list keeps the other items in order; Manage Clients is NOT in it but last, in its own pinned list", () => {
    mockPath = "/process";
    renderBar();
    const lists = [...document.querySelectorAll(".navbar_container ul")];
    expect(lists).toHaveLength(2);
    const labels = (ul) => [...ul.querySelectorAll("a")].map((a) => a.textContent);
    expect(labels(lists[0])).toEqual(["Dashboard", "Fresh Leads", "Follow-ups", "Rejected Leads", "Final Stage", "Completed Clients", "Scheduled Meetings", "ELSA AI", "Settings"]); // (Messaging is a stub <li> in this test)
    expect(labels(lists[1])).toEqual(["Manage Clients"]);
    expect(lists[1].className).toContain("pp-nav-bottom");
    // it is the last item of the whole nav
    const all = [...document.querySelectorAll(".navbar_container a")].map((a) => a.textContent);
    expect(all[all.length - 1]).toBe("Manage Clients");
  });

  test("it is active on every Manage Clients route and on no other", () => {
    for (const p of ["/processperson/client/all-clients", "/processperson/client/dashboard/4"]) {
      mockPath = p;
      const { unmount } = renderBar();
      expect(screen.getByRole("link", { name: "Manage Clients" }).className).toContain("active");
      expect(screen.getByRole("link", { name: "Settings" }).className).not.toContain("active");
      unmount();
    }
    mockPath = "/process/process-settings/profile";
    renderBar();
    expect(screen.getByRole("link", { name: "Manage Clients" }).className).not.toContain("active");
    expect(screen.getByRole("link", { name: "Settings" }).className).toContain("active");
  });

  test("CSS contract: the sidebar is a flex column and the bottom list is pushed to the end (any height), scoped to the Process shell", () => {
    const css = fs.readFileSync(path.join(__dirname, "../styles/manageClients.css"), "utf8");
    expect(css).toMatch(/\.pp-shell \.sidebar_container\s*\{[^}]*display: flex;[^}]*flex-direction: column/);
    expect(css).toMatch(/\.pp-shell \.sidebar_container \.navbar_container\s*\{[^}]*flex: 1 1 auto[^}]*flex-direction: column/);
    expect(css).toMatch(/ul\.pp-nav-bottom\s*\{[^}]*margin-top: auto/);
    // never leaks into the Executive / other shells
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/(^|\n)\s*\.sidebar_container/);
  });

  test("it collapses with the rest of the sidebar (icon + label markup identical to other items)", () => {
    mockPath = "/process";
    renderBar();
    const link = screen.getByRole("link", { name: "Manage Clients" });
    expect(link.querySelector(".sb-label").textContent).toBe("Manage Clients");
    expect(link.getAttribute("data-tip")).toBe("Manage Clients");
  });
});
