import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

const mockApi = {};
jest.mock("../../../context/ApiContext", () => ({ useApi: () => mockApi }));
jest.mock("../SidebarToggle", () => () => null);
jest.mock("../../modal/alert", () => ({
  Alert: ({ alerts }) => <div data-testid="alerts">{alerts.map((a) => `${a.type}:${a.message}`).join("|")}</div>,
  soundManager: { playSound: () => {} },
}));
jest.mock("../../../services/userManagementService", () => ({
  ...jest.requireActual("../../../services/userManagementService"),
  listUsers: jest.fn(),
  getUser: jest.fn(),
  updateUser: jest.fn(),
  setUserActive: jest.fn(),
  getUserPhoto: jest.fn(),
  uploadUserPhoto: jest.fn(),
  deleteUserPhoto: jest.fn(),
}));

import UserManagement from "./UserManagement";
import { buildCreatePayload, validateCreate } from "./CreateUserModal";
import { validateEdit } from "./EditUserModal";
import * as svc from "../../../services/userManagementService";

const U = (over) => ({
  key: "user:2", kind: "user", id: 2, employeeId: "EXE-0002", name: "Ravi Kumar", username: "exec2", email: "ravi@acme.com",
  role: "Executive", roleLabel: "Executive", active: true, createdAt: "2026-10-01T10:00:00Z", hasPhoto: false, ...over,
});
const users = [
  U({}),
  U({ key: "manager:1", kind: "manager", id: 1, employeeId: "MGR-0001", name: "Mina Shah", username: "mina", role: "Manager", roleLabel: "Manager", active: false, email: "mina@acme.com" }),
  U({ key: "processperson:1", kind: "processperson", id: 1, employeeId: "PP-0001", name: "Pat Quinn", username: null, role: "ProcessPerson", roleLabel: "Process Person", email: "pat@acme.com", hasPhoto: true }),
];

beforeEach(() => {
  // CRA runs with resetMocks:true — set implementations per test.
  svc.listUsers.mockResolvedValue({ users, total: 3, page: 1, limit: 10 });
  svc.getUser.mockImplementation(async (kind, id) => ({ ...users.find((u) => u.kind === kind && u.id === id), firstname: "Ravi", lastname: "Kumar", country: "India", state: "MH", city: "Pune", postal_code: "411001", name: "Mina Shah", jobTitle: "Ops", fullName: "Pat Quinn" }));
  svc.updateUser.mockResolvedValue({});
  svc.setUserActive.mockResolvedValue({});
  svc.getUserPhoto.mockResolvedValue(new Blob(["x"], { type: "image/png" }));
  svc.uploadUserPhoto.mockResolvedValue({});
  svc.deleteUserPhoto.mockResolvedValue({});
  mockApi.createExecutive = jest.fn().mockResolvedValue({});
  mockApi.createTeamLead = jest.fn().mockResolvedValue({});
  mockApi.createAdmin = jest.fn().mockResolvedValue({});
  mockApi.createManager = jest.fn().mockResolvedValue({});
  mockApi.createHr = jest.fn().mockResolvedValue({});
  mockApi.createProcessPerson = jest.fn().mockResolvedValue({});
  global.URL.createObjectURL = jest.fn(() => "blob:x");
  global.URL.revokeObjectURL = jest.fn();
});

describe("payload builders and validators", () => {
  test("each role's create payload is a plain JSON object matching its endpoint", () => {
    const base = { username: "u1", firstname: "Ana", lastname: "Roy", email: "a@b.com", password: "secret1", country: "IN", state: "MH", city: "Pune", postal_code: "" };
    expect(buildCreatePayload({ ...base, role: "Executive" })).toEqual({ username: "u1", email: "a@b.com", password: "secret1", firstname: "Ana", lastname: "Roy", country: "IN", state: "MH", city: "Pune" });
    expect(buildCreatePayload({ ...base, role: "ProcessPerson" })).toEqual({ fullName: "Ana Roy", email: "a@b.com", password: "secret1" });
    expect(buildCreatePayload({ ...base, role: "Manager" })).toEqual({ name: "Ana Roy", username: "u1", email: "a@b.com", password: "secret1" });
    expect(buildCreatePayload({ ...base, role: "HR" })).toEqual({ name: "Ana Roy", email: "a@b.com", password: "secret1" });
    expect(buildCreatePayload({ ...base, role: "TL" })).not.toBeInstanceOf(FormData);
  });

  test("create validation", () => {
    expect(Object.keys(validateCreate({ role: "", username: "", firstname: "", lastname: "", email: "bad", password: "123", country: "", state: "", city: "", postal_code: "" })).sort())
      .toEqual(["email", "firstname", "password", "role", "username"]);
    expect(validateCreate({ role: "Executive", username: "u", firstname: "A", lastname: "", email: "a@b.com", password: "secret", country: "", state: "", city: "" })).toMatchObject({ country: expect.any(String), state: expect.any(String), city: expect.any(String) });
    expect(validateCreate({ role: "ProcessPerson", username: "", firstname: "A", lastname: "", email: "a@b.com", password: "secret" })).toEqual({});
  });

  test("edit validation", () => {
    expect(validateEdit("user", { username: "", email: "nope" })).toMatchObject({ username: expect.any(String), email: expect.any(String) });
    expect(validateEdit("processperson", { fullName: "Pat", email: "p@x.com" })).toEqual({});
  });
});

describe("users list", () => {
  test("shows avatars, name, username, email, role, employee ID, status and created date", async () => {
    render(<UserManagement />);
    await screen.findByText("Ravi Kumar");
    expect(svc.listUsers).toHaveBeenCalledWith({ page: 1, limit: 10 });
    const row = screen.getByText("Ravi Kumar").closest("tr");
    expect(within(row).getByText("exec2")).toBeInTheDocument();
    expect(within(row).getByText("ravi@acme.com")).toBeInTheDocument();
    expect(within(row).getByText("EXE-0002")).toBeInTheDocument();
    expect(within(row).getByText("Active")).toBeInTheDocument();
    expect(within(row).getByLabelText("Ravi Kumar avatar")).toHaveTextContent("RK"); // initials fallback
    expect(within(screen.getByText("Mina Shah").closest("tr")).getByText("Inactive")).toBeInTheDocument();
    expect(within(screen.getByText("Pat Quinn").closest("tr")).getByText("Process Person")).toBeInTheDocument();
    await waitFor(() => expect(svc.getUserPhoto).toHaveBeenCalledWith("processperson", 1)); // photo via authed blob fetch
    expect(screen.getByText("Showing 1–3 of 3")).toBeInTheDocument();
  });

  test("search (debounced), role and status filters call the API", async () => {
    render(<UserManagement />);
    await screen.findByText("Ravi Kumar");
    fireEvent.change(screen.getByLabelText("Filter by role"), { target: { value: "Manager" } });
    await waitFor(() => expect(svc.listUsers).toHaveBeenLastCalledWith({ page: 1, limit: 10, role: "Manager" }));
    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "inactive" } });
    await waitFor(() => expect(svc.listUsers).toHaveBeenLastCalledWith({ page: 1, limit: 10, role: "Manager", status: "inactive" }));
    fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "mina" } });
    await waitFor(() => expect(svc.listUsers).toHaveBeenLastCalledWith({ page: 1, limit: 10, q: "mina", role: "Manager", status: "inactive" }));
  });

  test("pagination requests the next page", async () => {
    svc.listUsers.mockResolvedValue({ users, total: 25, page: 1, limit: 10 });
    render(<UserManagement />);
    await screen.findByText("Ravi Kumar");
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Next ›"));
    await waitFor(() => expect(svc.listUsers).toHaveBeenLastCalledWith({ page: 2, limit: 10 }));
  });

  test("empty, filtered-empty and error states", async () => {
    svc.listUsers.mockResolvedValue({ users: [], total: 0 });
    const { unmount } = render(<UserManagement />);
    expect(await screen.findByText(/No users yet/)).toBeInTheDocument();
    unmount();
    svc.listUsers.mockRejectedValue({ response: { data: { message: "Boom" } } });
    render(<UserManagement />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Boom");
    svc.listUsers.mockResolvedValue({ users, total: 3 });
    fireEvent.click(screen.getByText("Retry"));
    await screen.findByText("Ravi Kumar");
  });
});

describe("status changes", () => {
  test("deactivate asks for confirmation, then refreshes; activate is immediate", async () => {
    render(<UserManagement />);
    await screen.findByText("Ravi Kumar");
    fireEvent.click(screen.getByLabelText("Deactivate Ravi Kumar"));
    expect(svc.setUserActive).not.toHaveBeenCalled();
    expect(screen.getByText("Deactivate account?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(svc.setUserActive).toHaveBeenCalledWith("user", 2, false));
    await waitFor(() => expect(svc.listUsers.mock.calls.length).toBeGreaterThan(1)); // list refreshed
    expect(screen.getByTestId("alerts")).toHaveTextContent("success");

    fireEvent.click(screen.getByLabelText("Activate Mina Shah"));
    await waitFor(() => expect(svc.setUserActive).toHaveBeenCalledWith("manager", 1, true));
  });

  test("cancel leaves the account untouched; server errors are shown", async () => {
    render(<UserManagement />);
    await screen.findByText("Ravi Kumar");
    fireEvent.click(screen.getByLabelText("Deactivate Ravi Kumar"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(svc.setUserActive).not.toHaveBeenCalled();
    svc.setUserActive.mockRejectedValue({ response: { data: { message: "You cannot deactivate your own account." } } });
    fireEvent.click(screen.getByLabelText("Deactivate Ravi Kumar"));
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(screen.getByTestId("alerts")).toHaveTextContent("You cannot deactivate your own account."));
  });
});

describe("create user", () => {
  test("opens the modal, validates, submits plain JSON to the role's API and refreshes", async () => {
    render(<UserManagement />);
    await screen.findByText("Ravi Kumar");
    fireEvent.click(screen.getByText("+ Create User"));
    fireEvent.click(screen.getByRole("button", { name: "Create User" }));
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
    expect(mockApi.createProcessPerson).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "ProcessPerson" } });
    expect(screen.queryByLabelText("Username")).toBeNull(); // Process Person has no username
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Pat" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Quinn" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "pat@acme.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret1" } });
    const before = svc.listUsers.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Create User" }));
    await waitFor(() => expect(mockApi.createProcessPerson).toHaveBeenCalledWith({ fullName: "Pat Quinn", email: "pat@acme.com", password: "secret1" }));
    await waitFor(() => expect(svc.listUsers.mock.calls.length).toBeGreaterThan(before));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("alerts")).toHaveTextContent("Process Person created successfully.");
  });

  test("shows the backend's error message and keeps the modal open", async () => {
    mockApi.createExecutive.mockRejectedValue({ response: { data: { message: "Email already registered" } } });
    render(<UserManagement />);
    await screen.findByText("Ravi Kumar");
    fireEvent.click(screen.getByText("+ Create User"));
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Executive" } });
    for (const [label, value] of [["Username", "u1"], ["First name", "Ana"], ["Email", "a@b.com"], ["Password", "secret1"], ["Country", "IN"], ["State", "MH"], ["City", "Pune"]]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Create User" }));
    expect(await screen.findByText("Email already registered")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mockApi.createExecutive.mock.calls[0][0]).not.toBeInstanceOf(FormData);
  });
});

describe("view and edit", () => {
  test("view shows details", async () => {
    render(<UserManagement />);
    await screen.findByText("Ravi Kumar");
    fireEvent.click(screen.getByLabelText("View Ravi Kumar"));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Pune");
    expect(within(dialog).getByText("EXE-0002")).toBeInTheDocument();
    expect(within(dialog).getByText("India")).toBeInTheDocument();
  });

  test("edit loads existing values, validates, saves and refreshes; role is read-only", async () => {
    render(<UserManagement />);
    await screen.findByText("Ravi Kumar");
    fireEvent.click(screen.getByLabelText("Edit Ravi Kumar"));
    const city = await screen.findByLabelText("City");
    expect(city).toHaveValue("Pune");
    expect(screen.getByLabelText("Role")).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "bad" } });
    fireEvent.click(screen.getByText("Save changes"));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(svc.updateUser).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "ravi@new.com" } });
    fireEvent.change(city, { target: { value: "Mumbai" } });
    fireEvent.click(screen.getByText("Save changes"));
    await waitFor(() => expect(svc.updateUser).toHaveBeenCalledWith("user", 2, expect.objectContaining({ city: "Mumbai", email: "ravi@new.com", active: true })));
    expect(svc.updateUser.mock.calls[0][2]).not.toHaveProperty("role");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByTestId("alerts")).toHaveTextContent("User updated successfully.");
  });

  test("unchecking Account active requires confirmation before saving", async () => {
    render(<UserManagement />);
    await screen.findByText("Ravi Kumar");
    fireEvent.click(screen.getByLabelText("Edit Ravi Kumar"));
    await screen.findByLabelText("City");
    fireEvent.click(screen.getByLabelText(/Account active/));
    fireEvent.click(screen.getByText("Save changes"));
    expect(svc.updateUser).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(svc.updateUser).toHaveBeenCalledWith("user", 2, expect.objectContaining({ active: false })));
  });

  test("server validation errors are shown inside the edit modal", async () => {
    svc.updateUser.mockRejectedValue({ response: { data: { message: "That email is already in use." } } });
    render(<UserManagement />);
    await screen.findByText("Ravi Kumar");
    fireEvent.click(screen.getByLabelText("Edit Ravi Kumar"));
    await screen.findByLabelText("City");
    fireEvent.click(screen.getByText("Save changes"));
    expect(await screen.findByText("That email is already in use.")).toBeInTheDocument();
  });

  test("photo: rejects bad files client-side, uploads valid ones, removal needs confirmation", async () => {
    render(<UserManagement />);
    await screen.findByText("Ravi Kumar");
    fireEvent.click(screen.getByLabelText("Edit Pat Quinn"));
    await screen.findByLabelText(/Full name/);
    const input = screen.getByLabelText("Profile photo");

    fireEvent.change(input, { target: { files: [new File(["x"], "a.gif", { type: "image/gif" })] } });
    expect(await screen.findByText("Photo must be a JPEG, PNG or WEBP image.")).toBeInTheDocument();
    const big = new File(["x"], "b.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 3 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByText("Photo must be 2MB or smaller.")).toBeInTheDocument();
    expect(svc.uploadUserPhoto).not.toHaveBeenCalled();

    const good = new File(["x"], "c.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [good] } });
    fireEvent.click(screen.getByText("Update photo")); // Pat already has a photo
    await waitFor(() => expect(svc.uploadUserPhoto).toHaveBeenCalledWith("processperson", 1, good));

    await waitFor(() => expect(screen.queryByText("Working…")).toBeNull()); // upload finished
    fireEvent.click(screen.getByText("Remove photo"));
    expect(svc.deleteUserPhoto).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(svc.deleteUserPhoto).toHaveBeenCalledWith("processperson", 1));
    await waitFor(() => expect(screen.queryByText("Remove photo")).toBeNull());
  });
});
