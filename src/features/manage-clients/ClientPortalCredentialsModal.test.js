import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ClientPortalCredentialsModal from "./ClientPortalCredentialsModal";
import * as access from "../../services/clientAccess";

jest.mock("../../services/clientAccess");

const client = { id: 5, fullName: "Asha Rao" };
const notSet = { customerId: 5, loginEmail: "asha@x.com", status: "not_set" };
const active = { customerId: 5, loginEmail: "asha@x.com", status: "active", lastLoginAt: "2026-11-20T10:00:00Z" };

const mount = (props = {}) => render(<ClientPortalCredentialsModal client={client} onClose={jest.fn()} onChanged={jest.fn()} {...props} />);

beforeEach(() => {
  jest.resetAllMocks();
  access.getClientPortalInfo.mockResolvedValue(notSet);
  access.setClientPortalPassword.mockResolvedValue({ message: "Client portal access created." });
  access.setClientPortalActive.mockResolvedValue({ message: "Client portal access disabled." });
});

describe("Client Portal Credentials", () => {
  test("shows the client's own e-mail as the login and the access status", async () => {
    mount();
    expect(await screen.findByText("asha@x.com")).toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Set Client Portal Password" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull(); // the e-mail is not editable; only password fields
  });

  test("validates length, letter+number and confirmation before calling the server", async () => {
    mount();
    await screen.findByText("asha@x.com");
    const pw = screen.getByLabelText("Initial password");
    const cf = screen.getByLabelText("Confirm password");
    const submit = () => fireEvent.click(screen.getByRole("button", { name: "Create portal access" }));
    fireEvent.change(pw, { target: { value: "short1" } });
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("at least 8");
    fireEvent.change(pw, { target: { value: "onlyletters" } });
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("letter and one number");
    fireEvent.change(pw, { target: { value: "Client#2024" } });
    fireEvent.change(cf, { target: { value: "Different#1" } });
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("do not match");
    expect(access.setClientPortalPassword).not.toHaveBeenCalled();
  });

  test("creates access, clears the password fields, never displays the password, and refreshes the list", async () => {
    const onChanged = jest.fn();
    access.getClientPortalInfo.mockResolvedValueOnce(notSet).mockResolvedValue(active);
    mount({ onChanged });
    await screen.findByText("asha@x.com");
    fireEvent.change(screen.getByLabelText("Initial password"), { target: { value: "Client#2024" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "Client#2024" } });
    fireEvent.click(screen.getByRole("button", { name: "Create portal access" }));
    await waitFor(() => expect(access.setClientPortalPassword).toHaveBeenCalledWith(5, "Client#2024", "Client#2024"));
    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("Client#2024");
    expect(screen.getByRole("heading", { name: "Reset password" })).toBeInTheDocument();
  });

  test("an active client can have the password reset and access disabled / enabled", async () => {
    access.getClientPortalInfo.mockResolvedValue(active);
    mount();
    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disable access" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disable access" }));
    await waitFor(() => expect(access.setClientPortalActive).toHaveBeenCalledWith(5, false));
    expect(await screen.findByRole("status")).toHaveTextContent("disabled");
    access.getClientPortalInfo.mockResolvedValue({ ...active, status: "disabled" });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" })); // validation only: empty
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  test("shows server refusals (e-mail already in use, not your client)", async () => {
    access.setClientPortalPassword.mockRejectedValue(new Error("This e-mail address is already used by another account in this company."));
    mount();
    await screen.findByText("asha@x.com");
    fireEvent.change(screen.getByLabelText("Initial password"), { target: { value: "Client#2024" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "Client#2024" } });
    fireEvent.click(screen.getByRole("button", { name: "Create portal access" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already used by another account");
  });

  test("load failure is reported with retry; Escape closes", async () => {
    access.getClientPortalInfo.mockRejectedValueOnce(new Error("Client not found.")).mockResolvedValueOnce(notSet);
    const onClose = jest.fn();
    mount({ onClose });
    expect(await screen.findByRole("alert")).toHaveTextContent("Client not found.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("asha@x.com");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
