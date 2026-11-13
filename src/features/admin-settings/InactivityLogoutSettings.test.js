import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InactivityLogoutSettings, { validateMinutes } from "./InactivityLogoutSettings";
import * as executiveService from "../../services/executiveService";

jest.mock("../../services/executiveService", () => ({
  getInactivitySettings: jest.fn(),
  saveInactivitySettings: jest.fn(),
}));

describe("validateMinutes", () => {
  test("accepts whole minutes in range only", () => {
    expect(validateMinutes("5")).toBeNull();
    expect(validateMinutes(480)).toBeNull();
    expect(validateMinutes(0)).toMatch(/between 1 and 480/);
    expect(validateMinutes(481)).toMatch(/between/);
    expect(validateMinutes("7.5")).toMatch(/whole number/);
    expect(validateMinutes("")).toMatch(/whole number/);
  });
});

describe("InactivityLogoutSettings", () => {
  beforeEach(() => {
    executiveService.getInactivitySettings.mockResolvedValue({ enabled: true, minutes: 45 });
    executiveService.saveInactivitySettings.mockImplementation(async (v) => v);
  });

  test("loads the tenant value (custom 45) and saves a preset", async () => {
    const onNotify = jest.fn();
    render(<InactivityLogoutSettings onNotify={onNotify} />);
    expect(await screen.findByLabelText("Custom minutes")).toHaveValue(45);

    fireEvent.click(screen.getByLabelText("10 minutes"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(executiveService.saveInactivitySettings).toHaveBeenCalledWith({ enabled: true, minutes: 10 })
    );
    expect(onNotify).toHaveBeenCalledWith("success", "Saved", expect.stringContaining("10 minutes"));
  });

  test("a custom duration is validated before it is sent", async () => {
    render(<InactivityLogoutSettings />);
    const input = await screen.findByLabelText("Custom minutes");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/between 1 and 480/);
    expect(executiveService.saveInactivitySettings).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(executiveService.saveInactivitySettings).toHaveBeenCalledWith({ enabled: true, minutes: 20 })
    );
  });

  test("can be switched off, and server errors are shown", async () => {
    executiveService.saveInactivitySettings.mockRejectedValueOnce({ response: { data: { message: "Only Admin" } } });
    render(<InactivityLogoutSettings />);
    fireEvent.click(await screen.findByLabelText("Enable automatic logout"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only Admin");
    expect(executiveService.saveInactivitySettings).toHaveBeenCalledWith({ enabled: false, minutes: 45 });
  });
});
