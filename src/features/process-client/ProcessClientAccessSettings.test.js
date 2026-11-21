import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProcessClientAccessSettings from "./ProcessClientAccessSettings";
import * as access from "../../services/clientAccess";

jest.mock("../../services/clientAccess");

beforeEach(() => {
  jest.resetAllMocks();
  access.getClientAccessStatus.mockResolvedValue({ isSet: false });
  access.setClientAccessPassword.mockResolvedValue({ message: "Client Portal Access Password saved." });
  access.changeClientAccessPassword.mockResolvedValue({ message: "Client Portal Access Password updated." });
});

const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("Settings > Client Portal Access Password", () => {
  test("first time: asks for the CRM login password (to confirm it is you), the new password and a confirmation", async () => {
    render(<ProcessClientAccessSettings />);
    expect(await screen.findByLabelText(/CRM login password/)).toBeInTheDocument();
    expect(screen.getByLabelText("Access password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm access password")).toBeInTheDocument();
    expect(screen.queryByLabelText("Current access password")).toBeNull();
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  test("validates before calling the server", async () => {
    render(<ProcessClientAccessSettings />);
    await screen.findByLabelText(/CRM login password/);
    fireEvent.click(screen.getByRole("button", { name: "Set access password" }));
    expect(screen.getByText(/Enter your CRM login password/)).toBeInTheDocument();
    expect(screen.getByText(/8-72 characters/)).toBeInTheDocument();
    fill(/CRM login password/, "login-pw");
    fill("Access password", "Access#2024");
    fill("Confirm access password", "Other#2024");
    fireEvent.click(screen.getByRole("button", { name: "Set access password" }));
    expect(screen.getByText("The two passwords do not match.")).toBeInTheDocument();
    expect(access.setClientAccessPassword).not.toHaveBeenCalled();
  });

  test("sets the password, then clears every field (nothing is kept in the page)", async () => {
    access.getClientAccessStatus.mockResolvedValueOnce({ isSet: false }).mockResolvedValue({ isSet: true });
    render(<ProcessClientAccessSettings />);
    await screen.findByLabelText(/CRM login password/);
    fill(/CRM login password/, "login-pw");
    fill("Access password", "Access#2024");
    fill("Confirm access password", "Access#2024");
    fireEvent.click(screen.getByRole("button", { name: "Set access password" }));
    await waitFor(() => expect(access.setClientAccessPassword).toHaveBeenCalledWith("login-pw", "Access#2024", "Access#2024"));
    expect(await screen.findByRole("status")).toHaveTextContent("saved");
    expect(await screen.findByLabelText("Current access password")).toHaveValue("");
    expect(screen.getByText("Set")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Access#2024");
  });

  test("once set: the current access password is required to change it", async () => {
    access.getClientAccessStatus.mockResolvedValue({ isSet: true });
    render(<ProcessClientAccessSettings />);
    await screen.findByLabelText("Current access password");
    expect(screen.queryByLabelText(/CRM login password/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change access password" }));
    expect(screen.getByText("Enter your current access password.")).toBeInTheDocument();
    fill("Current access password", "Old#Pass123");
    fill("New access password", "Newer#2025");
    fill("Confirm access password", "Newer#2025");
    fireEvent.click(screen.getByRole("button", { name: "Change access password" }));
    await waitFor(() => expect(access.changeClientAccessPassword).toHaveBeenCalledWith("Old#Pass123", "Newer#2025", "Newer#2025"));
    expect(await screen.findByRole("status")).toHaveTextContent("updated");
  });

  test("server errors (wrong current password, locked) are shown", async () => {
    access.getClientAccessStatus.mockResolvedValue({ isSet: true });
    access.changeClientAccessPassword.mockRejectedValue(new Error("Incorrect password."));
    render(<ProcessClientAccessSettings />);
    await screen.findByLabelText("Current access password");
    fill("Current access password", "Wrong#1234");
    fill("New access password", "Newer#2025");
    fill("Confirm access password", "Newer#2025");
    fireEvent.click(screen.getByRole("button", { name: "Change access password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect password.");
  });

  test("status load failure is reported with retry", async () => {
    access.getClientAccessStatus.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ isSet: false });
    render(<ProcessClientAccessSettings />);
    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByLabelText(/CRM login password/)).toBeInTheDocument();
  });
});
