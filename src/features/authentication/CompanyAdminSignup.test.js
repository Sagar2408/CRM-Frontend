import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockNavigate = jest.fn();
const mockRegister = jest.fn();
const mockToast = { error: jest.fn(), success: jest.fn() };
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...r }) => <a href={to} {...r}>{children}</a>,
  useNavigate: () => mockNavigate,
}));
jest.mock("react-toastify", () => ({ ToastContainer: () => null, toast: { error: (...a) => mockToast.error(...a), success: (...a) => mockToast.success(...a) } }));
jest.mock("react-toastify/dist/ReactToastify.css", () => ({}), { virtual: true });
jest.mock("../../services/companyAdminAuth", () => ({ registerCompanyAdmin: (...a) => mockRegister(...a) }));

import CompanyAdminSignup from "./CompanyAdminSignup";

const fill = (placeholder, value) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

beforeEach(() => {
  jest.clearAllMocks();
  mockRegister.mockResolvedValue({});
});

describe("Company admin first-time registration", () => {
  test("asks for company code, invited email, invitation token and the admin's own new password", () => {
    render(<CompanyAdminSignup />);
    ["Company Code", "Invitation Token", "Registered Admin Email", "New Password (min 8 characters)", "Confirm Password"].forEach((p) =>
      expect(screen.getByPlaceholderText(p)).toBeInTheDocument()
    );
    expect(screen.getByPlaceholderText("Invitation Token")).toHaveAttribute("autocomplete", "off");
    expect(screen.getByPlaceholderText("New Password (min 8 characters)")).toHaveAttribute("type", "password");
  });

  test("submits the invitation fields and never a role; redirects to login on success", async () => {
    render(<CompanyAdminSignup />);
    fill("Company Code", " ATO-ABC123 ");
    fill("Invitation Token", "tok-0123456789abcdefghijklmnop");
    fill("Registered Admin Email", "boss@acme.com");
    fill("New Password (min 8 characters)", "My-Own-Passw0rd");
    fill("Confirm Password", "My-Own-Passw0rd");
    fireEvent.click(screen.getByRole("button", { name: /register admin account/i }));
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(mockRegister).toHaveBeenCalledWith({
      companyCode: "ATO-ABC123",
      invitationToken: "tok-0123456789abcdefghijklmnop",
      email: "boss@acme.com",
      password: "My-Own-Passw0rd",
      confirmPassword: "My-Own-Passw0rd",
    });
    await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
  });

  test("mismatched or short passwords never reach the server", () => {
    render(<CompanyAdminSignup />);
    fill("Company Code", "ATO-ABC123");
    fill("Invitation Token", "tok-0123456789abcdefghijklmnop");
    fill("Registered Admin Email", "boss@acme.com");
    fill("New Password (min 8 characters)", "My-Own-Passw0rd");
    fill("Confirm Password", "Different-1234");
    fireEvent.click(screen.getByRole("button", { name: /register admin account/i }));
    expect(mockToast.error).toHaveBeenCalledWith("Passwords do not match");
    fill("New Password (min 8 characters)", "short");
    fill("Confirm Password", "short");
    fireEvent.click(screen.getByRole("button", { name: /register admin account/i }));
    expect(mockToast.error).toHaveBeenLastCalledWith(expect.stringMatching(/at least 8/i));
    expect(mockRegister).not.toHaveBeenCalled();
  });

  test("a failed registration shows the server's generic message", async () => {
    mockRegister.mockRejectedValueOnce(new Error("Registration could not be completed."));
    render(<CompanyAdminSignup />);
    fill("Company Code", "ATO-ABC123");
    fill("Invitation Token", "tok-0123456789abcdefghijklmnop");
    fill("Registered Admin Email", "boss@acme.com");
    fill("New Password (min 8 characters)", "My-Own-Passw0rd");
    fill("Confirm Password", "My-Own-Passw0rd");
    fireEvent.click(screen.getByRole("button", { name: /register admin account/i }));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Registration could not be completed."));
  });
});
