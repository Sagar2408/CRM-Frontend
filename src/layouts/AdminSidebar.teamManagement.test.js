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
