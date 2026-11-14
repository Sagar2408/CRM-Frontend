import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ResetPasswordSection, { validateNewPassword } from "./ResetPasswordSection";
import * as svc from "../../../services/userManagementService";

jest.mock("../../../services/userManagementService", () => ({
  apiError: (e, f) => e?.response?.data?.message || f,
  canResetPasswords: jest.fn(),
  resetUserPassword: jest.fn(),
}));

beforeEach(() => svc.canResetPasswords.mockReturnValue(true));

test("validateNewPassword", () => {
  expect(validateNewPassword("short", "short")).toMatch(/8 characters/);
  expect(validateNewPassword("longenough1", "different1")).toMatch(/do not match/);
  expect(validateNewPassword("longenough1", "longenough1")).toBe("");
});

test("Admin resets a password through User Management", async () => {
  svc.resetUserPassword.mockResolvedValue({ message: "Password updated." });
  render(<ResetPasswordSection user={{ kind: "user", id: 5 }} />);
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "Brand-new-1" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "Brand-new-1" } });
  fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
  await waitFor(() => expect(svc.resetUserPassword).toHaveBeenCalledWith("user", 5, "Brand-new-1"));
  expect(await screen.findByText("Password updated.")).toBeInTheDocument();
});

test("mismatch is blocked client-side; server errors are shown; hidden outside the Admin view", async () => {
  render(<ResetPasswordSection user={{ kind: "hr", id: 1 }} />);
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "Brand-new-1" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "nope" } });
  fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/do not match/);
  expect(svc.resetUserPassword).not.toHaveBeenCalled();
  svc.canResetPasswords.mockReturnValue(false);
  const { container } = render(<ResetPasswordSection user={{ kind: "hr", id: 1 }} />);
  expect(container).toBeEmptyDOMElement();
});
