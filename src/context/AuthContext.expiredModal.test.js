import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";

// Regression: logging in as an expired company only made the page "blink".
// AuthProvider used to render `{!loading && children}` and login() flipped
// `loading`, so the whole tree (Login page + InsufficientBalanceModal) unmounted
// during the request and the SUBSCRIPTION_EXPIRED event had no listener.
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }));
jest.mock("../services/auth", () => ({ loginUser: jest.fn() }));
jest.mock("../services/executiveService", () => ({ recordStartWork: jest.fn(), recordStopWork: jest.fn() }));
jest.mock("../features/executive/useLoginTimer", () => () => {});
jest.mock("../features/admin/ThemeContext", () => {
  const ReactLib = require("react");
  return { ThemeContext: ReactLib.createContext({ forceLightTheme: () => {} }) };
});

const authService = require("../services/auth");
const { AuthProvider, useAuth } = require("./AuthContext");
const InsufficientBalanceModal = require("../features/authentication/InsufficientBalanceModal").default;

let mounts = 0;
function LoginStub() {
  const { login } = useAuth();
  React.useEffect(() => { mounts += 1; }, []);
  return <button onClick={() => login("a@a.com", "pw", "ATO-FHDZM3")}>SIGN IN</button>;
}

test("expired-subscription login shows the modal, keeps the login page mounted, and can be closed", async () => {
  mounts = 0;
  authService.loginUser.mockRejectedValue(
    Object.assign(new Error("x"), { code: "SUBSCRIPTION_EXPIRED", companyName: "Test", expiryDate: "2026-11-16" })
  );
  render(
    <AuthProvider>
      <InsufficientBalanceModal />
      <LoginStub />
    </AuthProvider>
  );
  await act(async () => { fireEvent.click(screen.getByText("SIGN IN")); });

  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByText(/Your subscription has ended\. Please recharge your account with\s+sufficient balance to continue using the CRM\./)).toBeTruthy();
  expect(mounts).toBe(1); // login page was never unmounted/remounted

  fireEvent.click(screen.getByText("Close"));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText("SIGN IN")).toBeTruthy(); // still on login, button usable
});
