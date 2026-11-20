import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";

jest.mock("../../services/orgHierarchyApi", () => {
  const KIND = { Executive: "user", Manager: "manager", ProcessPerson: "processperson" };
  return {
    orgApi: { assignable: jest.fn(), assign: jest.fn(), remove: jest.fn() },
    orgErrorMessage: (e, f) => e?.response?.data?.message || e?.message || f,
    ASSIGNABLE_ROLES: Object.keys(KIND),
    apiKeyOf: (n) => (KIND[n.role] ? `${KIND[n.role]}:${n.id}` : null),
  };
});

import { orgApi } from "../../services/orgHierarchyApi";
import HierarchyAssign from "./HierarchyAssign";

const node = (role, id, name, extra = {}) => ({ key: `${role}:${id}`, id, name, role, children: [], reportsTo: null, ...extra });
const EVE = node("Executive", 2, "Eve Executive", { reportsTo: { key: "Manager:1", name: "Mia Manager", role: "Manager" } });
const ED = node("Executive", 3, "Ed Executive", { reportsTo: { key: "Manager:1", name: "Mia Manager", role: "Manager" } });
const MIA = node("Manager", 1, "Mia Manager", { reportsTo: { key: "Admin:1", name: "Boss", role: "Admin" }, children: [EVE, ED] });

const ASSIGNABLE = {
  managers: [
    { key: "manager:1", id: 1, name: "Mia Manager", active: true },
    { key: "manager:2", id: 2, name: "Max Manager", active: true },
    { key: "manager:4", id: 4, name: "Off Manager", active: false },
  ],
  employees: [
    { key: "user:2", kind: "user", id: 2, name: "Eve Executive", username: "eve", role: "Executive", active: true, managerId: 1, managerName: "Mia Manager" },
    { key: "user:4", kind: "user", id: 4, name: "Cy Executive", username: "cy", role: "Executive", active: true, managerId: null, managerName: null },
    { key: "user:6", kind: "user", id: 6, name: "Dee Executive", username: "dee", role: "Executive", active: true, managerId: 2, managerName: "Max Manager" },
    { key: "user:5", kind: "user", id: 5, name: "Gone Executive", username: "gone", role: "Executive", active: false, managerId: null, managerName: null },
    { key: "processperson:1", kind: "processperson", id: 1, name: "Pat Process", username: null, role: "Process Person", active: true, managerId: null, managerName: null },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  orgApi.assignable.mockResolvedValue(ASSIGNABLE);
});

describe("Manager node: assign employees", () => {
  test("opens a searchable picker that hides people already under this manager and deactivated employees", async () => {
    render(<HierarchyAssign node={MIA} onChanged={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Assign employees" }));
    const dlg = await screen.findByRole("dialog");
    await within(dlg).findByText("Cy Executive");
    expect(within(dlg).queryByText("Eve Executive")).not.toBeInTheDocument(); // already Mia's report: no duplicate offered
    expect(within(dlg).queryByText("Gone Executive")).not.toBeInTheDocument(); // deactivated
    expect(within(dlg).queryByText("Mia Manager")).not.toBeInTheDocument(); // no self-assignment
    expect(within(dlg).getByText("Reports to Max Manager (will be moved)")).toBeInTheDocument();

    fireEvent.change(within(dlg).getByLabelText("Search employees"), { target: { value: "pat" } });
    expect(within(dlg).getByText("Pat Process")).toBeInTheDocument();
    expect(within(dlg).queryByText("Cy Executive")).not.toBeInTheDocument();
    fireEvent.change(within(dlg).getByLabelText("Search employees"), { target: { value: "zzz" } });
    expect(within(dlg).getByText("No employees match.")).toBeInTheDocument();
  });

  test("assigns several employees in one request; moving someone from another manager sends reassign", async () => {
    const onChanged = jest.fn();
    orgApi.assign.mockResolvedValue({ assigned: ["user:4", "user:6"], unchanged: [] });
    render(<HierarchyAssign node={MIA} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Assign employees" }));
    const dlg = await screen.findByRole("dialog");
    const submit = within(dlg).getByRole("button", { name: /^Assign/ });
    expect(submit).toBeDisabled();
    fireEvent.click(await within(dlg).findByLabelText(/Cy Executive/));
    expect(within(dlg).queryByRole("note")).not.toBeInTheDocument();
    fireEvent.click(within(dlg).getByLabelText(/Dee Executive/));
    expect(within(dlg).getByRole("note")).toHaveTextContent("1 selected employee currently report to another manager and will be reassigned");
    fireEvent.click(within(dlg).getByRole("button", { name: "Assign 2 employees" }));
    await waitFor(() => expect(orgApi.assign).toHaveBeenCalledWith(1, ["user:4", "user:6"], { reassign: true }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("2 employees now report to Mia Manager."));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("no reassign flag when everyone selected is unassigned", async () => {
    orgApi.assign.mockResolvedValue({ assigned: ["user:4"], unchanged: [] });
    render(<HierarchyAssign node={MIA} onChanged={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Assign employees" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByLabelText(/Cy Executive/));
    fireEvent.click(within(dlg).getByRole("button", { name: "Assign 1 employee" }));
    await waitFor(() => expect(orgApi.assign).toHaveBeenCalledWith(1, ["user:4"], { reassign: false }));
  });

  test("server refusals (e.g. circular reporting) are shown and the dialog stays open", async () => {
    orgApi.assign.mockRejectedValue({ response: { data: { message: "This would create a circular reporting line." } } });
    render(<HierarchyAssign node={MIA} onChanged={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Assign employees" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByLabelText(/Cy Executive/));
    fireEvent.click(within(dlg).getByRole("button", { name: "Assign 1 employee" }));
    expect(await within(dlg).findByRole("alert")).toHaveTextContent("circular reporting line");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("remove and reassign", () => {
  test("lists the manager's reports with Reassign and Remove; reassign offers only other active managers", async () => {
    const onChanged = jest.fn();
    orgApi.assign.mockResolvedValue({ assigned: ["user:2"], unchanged: [] });
    render(<HierarchyAssign node={MIA} onChanged={onChanged} />);
    const list = screen.getByRole("list", { name: "Reports of Mia Manager" });
    expect(within(list).getByText("Eve Executive")).toBeInTheDocument();
    fireEvent.click(within(list).getByRole("button", { name: "Reassign Eve Executive" }));
    const dlg = await screen.findByRole("dialog", { name: "Reassign Eve Executive" });
    const select = await within(dlg).findByLabelText("New reporting manager");
    await waitFor(() => expect([...select.options].map((o) => o.textContent)).toEqual(["Select a manager", "Max Manager"])); // not the current manager, not deactivated
    expect(within(dlg).getByRole("button", { name: "Reassign" })).toBeDisabled();
    fireEvent.change(select, { target: { value: "2" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Reassign" }));
    await waitFor(() => expect(orgApi.assign).toHaveBeenCalledWith(2, ["user:2"], { reassign: true }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("Eve Executive now reports to Max Manager."));
  });

  test("remove asks for confirmation, then calls the API with the right manager", async () => {
    const onChanged = jest.fn();
    orgApi.remove.mockResolvedValue({ removed: "user:3" });
    render(<HierarchyAssign node={MIA} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Ed Executive" }));
    expect(orgApi.remove).not.toHaveBeenCalled();
    const dlg = await screen.findByRole("dialog", { name: "Remove from manager" });
    expect(dlg).toHaveTextContent("Team Management teams are not changed");
    fireEvent.click(within(dlg).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(orgApi.remove).toHaveBeenCalledWith(1, "user:3"));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("Ed Executive was removed from Mia Manager."));
  });

  test("an employee node can be assigned, reassigned or removed from its own details", async () => {
    const { rerender } = render(<HierarchyAssign node={EVE} onChanged={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Reassign to another manager" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove from manager" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign employees" })).not.toBeInTheDocument(); // not a manager
    rerender(<HierarchyAssign node={node("Executive", 4, "Cy Executive")} onChanged={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Assign to a manager" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove from manager" })).not.toBeInTheDocument();
  });

  test("HR and Admin nodes get no assignment controls (only Managers receive employees, HR is not assignable)", () => {
    const { container, rerender } = render(<HierarchyAssign node={node("HR", 1, "Hana HR")} onChanged={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<HierarchyAssign node={node("Admin", 1, "Boss")} onChanged={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
