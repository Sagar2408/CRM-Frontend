import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import ManageClientsGate from "./ManageClientsGate";
import { CLIENT_ACCESS_LOCKED_EVENT, readClientAccessGrant, storeClientAccessGrant, clearClientAccessGrant } from "../../services/clientAccess";

jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...r }) => <a href={to} {...r}>{children}</a> }));

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const SECRET = "Access#2024";

const routes = (over = {}) => (url, init) => {
  if (url.endsWith("/client-access/status")) return Promise.resolve(over.status || reply(200, { isSet: true, locked: false }));
  if (url.endsWith("/client-access/verify")) return Promise.resolve(over.verify || reply(200, { accessGrant: { token: "grant-1", expiresInSeconds: 900 } }));
  if (url.endsWith("/client-access/renew")) return Promise.resolve(reply(200, { accessGrant: { token: "grant-2", expiresInSeconds: 900 } }));
  return Promise.resolve(reply(404, {}));
};

const mount = () =>
  render(
    <ManageClientsGate>
      <div>SECRET CLIENT LIST</div>
    </ManageClientsGate>
  );

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  localStorage.setItem("token", "login-token");
  localStorage.setItem("user", JSON.stringify({ id: 7, type: "processperson" }));
  global.fetch = jest.fn(routes());
});

describe("Manage Clients password gate", () => {
  test("shows nothing about clients, and makes no client request, until verified", async () => {
    mount();
    expect(await screen.findByRole("heading", { name: "Manage Clients is protected" })).toBeInTheDocument();
    expect(screen.queryByText("SECRET CLIENT LIST")).toBeNull();
    expect(global.fetch.mock.calls.some(([u]) => /managed-clients/.test(String(u)))).toBe(false);
  });

  test("a wrong password shows a safe message, clears the field and stays locked", async () => {
    global.fetch = jest.fn(routes({ verify: reply(401, { code: "ACCESS_PASSWORD_INCORRECT", message: "Incorrect password.", attemptsRemaining: 4 }) }));
    mount();
    fireEvent.change(await screen.findByLabelText("Access password"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect password.");
    expect(screen.getByLabelText("Access password")).toHaveValue("");
    expect(screen.queryByText("SECRET CLIENT LIST")).toBeNull();
  });

  test("too many attempts disables the form with the wait time", async () => {
    global.fetch = jest.fn(routes({ verify: reply(429, { code: "ACCESS_LOCKED", message: "Too many incorrect attempts.", retryAfterMinutes: 15 }) }));
    mount();
    fireEvent.change(await screen.findByLabelText("Access password"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(await screen.findByText(/Try again in 15 minutes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlock" })).toBeDisabled();
  });

  test("the right password unlocks; the password itself is never stored, only the server grant", async () => {
    mount();
    fireEvent.change(await screen.findByLabelText("Access password"), { target: { value: SECRET } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(await screen.findByText("SECRET CLIENT LIST")).toBeInTheDocument();
    const dump = JSON.stringify({ ...sessionStorage, ...localStorage });
    expect(dump).not.toContain(SECRET);
    expect(readClientAccessGrant().token).toBe("grant-1");
    const [, init] = global.fetch.mock.calls.find(([u]) => /verify/.test(String(u)));
    expect(JSON.parse(init.body)).toEqual({ password: SECRET });
  });

  test("a refresh in the same session does not ask again", () => {
    storeClientAccessGrant({ token: "grant-1", expiresInSeconds: 900 });
    mount();
    expect(screen.getByText("SECRET CLIENT LIST")).toBeInTheDocument();
    expect(screen.queryByLabelText("Access password")).toBeNull();
  });

  test("an expired grant, or another person's grant, asks again", () => {
    storeClientAccessGrant({ token: "grant-1", expiresInSeconds: 900 });
    const g = JSON.parse(sessionStorage.getItem("crm.pp.clientAccess"));
    sessionStorage.setItem("crm.pp.clientAccess", JSON.stringify({ ...g, expiresAt: Date.now() - 1 }));
    const { unmount } = mount();
    expect(screen.queryByText("SECRET CLIENT LIST")).toBeNull();
    unmount();
    storeClientAccessGrant({ token: "grant-1", expiresInSeconds: 900 });
    localStorage.setItem("user", JSON.stringify({ id: 8, type: "processperson" })); // someone else signed in
    mount();
    expect(screen.queryByText("SECRET CLIENT LIST")).toBeNull();
  });

  test("locks again when the server rejects the grant", async () => {
    storeClientAccessGrant({ token: "grant-1", expiresInSeconds: 900 });
    mount();
    expect(screen.getByText("SECRET CLIENT LIST")).toBeInTheDocument();
    act(() => {
      clearClientAccessGrant();
      window.dispatchEvent(new Event(CLIENT_ACCESS_LOCKED_EVENT));
    });
    expect(await screen.findByRole("heading", { name: "Manage Clients is protected" })).toBeInTheDocument();
    expect(screen.queryByText("SECRET CLIENT LIST")).toBeNull();
  });

  test("activity while unlocked renews the grant (idle period only starts when you stop)", async () => {
    storeClientAccessGrant({ token: "grant-1", expiresInSeconds: 900 });
    mount();
    fireEvent.click(screen.getByText("SECRET CLIENT LIST"));
    await waitFor(() => expect(readClientAccessGrant().token).toBe("grant-2"));
  });

  test("no access password yet: points to Settings instead of asking for one", async () => {
    global.fetch = jest.fn(routes({ status: reply(200, { isSet: false, locked: false }) }));
    mount();
    const link = await screen.findByRole("link", { name: /Client Portal Access Password/ });
    expect(link).toHaveAttribute("href", "/process/process-settings/client-access");
    expect(screen.queryByLabelText("Access password")).toBeNull();
  });
});
