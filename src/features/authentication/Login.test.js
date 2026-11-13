import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockLogin = jest.fn();
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...r }) => <a href={to} {...r}>{children}</a> }));
jest.mock("react-toastify", () => ({ ToastContainer: () => null, toast: {} }));
jest.mock("react-toastify/dist/ReactToastify.css", () => ({}), { virtual: true });
jest.mock("../../context/AuthContext", () => ({ useAuth: () => ({ login: mockLogin }) }));

import Login from "./Login";

beforeEach(() => {
  jest.clearAllMocks();
  mockLogin.mockResolvedValue(undefined);
});

describe("the one /login page", () => {
  test("asks only for company code, email and password - no role choice - and keeps forgot-password", () => {
    render(<Login />);
    expect(screen.getByPlaceholderText("Company Code")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/cannot sign in on this page/i)).not.toBeInTheDocument();
    expect(screen.getByText("Forgot Password").closest("a")).toHaveAttribute("href", "/forgot-password");
  });

  test("submits exactly (email, password, companyCode) - the role is never sent", async () => {
    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText("Company Code"), { target: { value: "ACME01" } });
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "hal@acme.com" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "secret1" } });
    fireEvent.click(screen.getByRole("button", { name: "SIGN IN" }));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));
    expect(mockLogin).toHaveBeenCalledWith("hal@acme.com", "secret1", "ACME01");
  });
});
