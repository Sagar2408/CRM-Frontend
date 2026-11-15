import React from "react";
import { render, screen } from "@testing-library/react";
import ProcessSidebarNavbar from "./ProcessSidebarNavbar";
import { ThemeContext } from "../features/admin/ThemeContext";

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: "/process" }),
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
