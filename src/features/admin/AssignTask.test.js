import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import AssignTask from "./AssignTask";

const mockCreate = jest.fn();
jest.mock("../../context/ApiContext", () => ({ useApi: () => ({ createSingleLeadAPI: mockCreate }) }));
jest.mock("../../features/admin/ThemeContext", () => {
  const React = require("react");
  return { ThemeContext: React.createContext({ theme: "light" }) };
});
jest.mock("../../context/LoadingContext", () => ({ useLoading: () => ({ isLoading: false, variant: "", showLoader: jest.fn(), hideLoader: jest.fn() }) }));
jest.mock("../spinner/AdminSpinner", () => () => null);
jest.mock("./SidebarToggle", () => () => <div data-testid="sidebar-toggle" />);
jest.mock("../modal/alert", () => ({ Alert: () => null, soundManager: { playSound: jest.fn() } }));
jest.mock("../leadImport/LeadImportDashboard", () => ({ onAddSingle }) => (
  <div>
    <button onClick={onAddSingle}>Add Single Lead</button>
    <span>import-dashboard</span>
  </div>
));

describe("Upload Leads page", () => {
  beforeEach(() => mockCreate.mockReset());

  test("hosts the import dashboard inside the existing layout wrapper (sidebar-aware)", () => {
    const { container } = render(<AssignTask />);
    expect(screen.getByText("import-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-toggle")).toBeInTheDocument();
    expect(container.querySelector(".assign-task-container .assign-task-content")).toBeTruthy();
  });

  test("single-lead creation still works through the same API (in a modal)", async () => {
    mockCreate.mockResolvedValue({});
    render(<AssignTask />);
    fireEvent.click(screen.getByText("Add Single Lead"));
    const dialog = await screen.findByRole("dialog", { name: "Add Single Lead" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Lead" }));
    expect(mockCreate).not.toHaveBeenCalled(); // name is required
    fireEvent.change(within(dialog).getByLabelText("Name *"), { target: { value: "Solo Lead" } });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "solo@example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Lead" }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: "Solo Lead", email: "solo@example.com" })));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
