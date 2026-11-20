import React from "react";
import { render, screen } from "@testing-library/react";
import AdminSidebar from "./AdminSidebar";

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("../features/Messaging/MessagingNav", () => ({ MessagingSidebarItem: () => null }));

describe("Admin sidebar", () => {
  test("Executive Details is replaced by Team Management; Upload Leads and Lead Assign stay separate", () => {
    render(<AdminSidebar />);
    const team = screen.getByText("Team Management").closest("a");
    expect(team).toHaveAttribute("href", "/admin/team-management");
    expect(screen.queryByText("Executive Details")).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/admin/executive-details"]')).toBeNull();
    // unrelated navigation is untouched
    expect(screen.getByText("Upload Leads").closest("a")).toHaveAttribute("href", "/admin/assign-task");
    expect(screen.getByText("Lead Assign").closest("a")).toHaveAttribute("href", "/admin/leadassign");
  });
});

describe("Admin sidebar: ELSA AI", () => {
  test("ELSA AI is a menu item that opens /admin/elsa, with an icon, next to Messaging", () => {
    render(<AdminSidebar />);
    const link = screen.getByText("ELSA AI").closest("a");
    expect(link).toHaveAttribute("href", "/admin/elsa");
    expect(link).toHaveAttribute("data-tooltip", "ELSA AI");
    expect(link.querySelector("svg")).not.toBeNull();
  });
  test("the existing Admin menu is untouched", () => {
    render(<AdminSidebar />);
    for (const [label, href] of [["Hierarchy", "/admin/heirarchy"], ["Full Report", "/admin/full-report"], ["Team Management", "/admin/team-management"], ["Settings", "/admin/settings"]]) {
      expect(screen.getByText(label).closest("a")).toHaveAttribute("href", href);
    }
  });
});
