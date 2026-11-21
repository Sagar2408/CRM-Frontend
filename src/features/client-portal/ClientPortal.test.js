import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import fs from "fs";
import path from "path";
import ClientPortalDashboard from "./ClientPortalDashboard";
import { ClientPortalPrivateRoute } from "./ClientPortalRoutes";
import * as api from "../../services/clientPortalApi";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  Navigate: ({ to }) => <div data-testid="redirect" data-to={to} />,
  Routes: ({ children }) => <>{children}</>,
  Route: () => null,
}));
jest.mock("../../services/clientPortalApi");

const overview = {
  profile: { fullName: "Asha Rao", email: "asha@x.com", phone: "9876543210", country: "India", memberSince: "2026-01-01T00:00:00Z" },
  status: { code: "under_review", label: "In progress" },
  roadmap: { total: 4, current: 2, stages: [1, 2, 3, 4].map((n) => ({ number: n, label: `Stage ${n}`, state: n < 2 ? "completed" : n === 2 ? "current" : "upcoming" })) },
  followUps: [{ id: 1, category: "Document collection", date: "2026-12-05", time: "09:30:00", document: "Passport" }],
  documents: [{ name: "Passport", status: "Received" }, { name: "Bank Statement", status: "Requested" }],
  updates: [{ id: 9, message: "Reminder: please upload your bank statement", createdAt: "2026-11-20T10:00:00Z" }],
};

beforeEach(() => {
  jest.resetAllMocks();
  mockNavigate.mockReset();
  api.getClientOverview.mockResolvedValue(overview);
  api.logoutClient.mockResolvedValue();
});

describe("Client Portal dashboard", () => {
  test("shows the client's own profile, status, roadmap, documents, schedule and updates", async () => {
    render(<ClientPortalDashboard />);
    expect(await screen.findByRole("heading", { name: "Welcome, Asha" })).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Stage 2 of 4")).toBeInTheDocument();
    const steps = screen.getAllByRole("listitem").filter((li) => li.className.includes("cp-step"));
    expect(steps.map((s) => s.className.match(/cp-step--(\w+)/)[1])).toEqual(["completed", "current", "upcoming", "upcoming"]);
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("asha@x.com")).toBeInTheDocument();
    const docs = screen.getByRole("heading", { name: "Documents" }).closest("section");
    expect(within(docs).getByText("Received")).toBeInTheDocument();
    expect(within(docs).getByText("Requested")).toBeInTheDocument();
    expect(screen.getByText(/Document collection - Passport/)).toBeInTheDocument();
    expect(screen.getByText("Reminder: please upload your bank statement")).toBeInTheDocument();
  });

  test("renders nothing editable: no inputs, forms or save actions", async () => {
    render(<ClientPortalDashboard />);
    await screen.findByRole("heading", { name: "Welcome, Asha" });
    expect(document.querySelectorAll("input, textarea, select, form")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /save|edit|update|delete|upload/i })).toBeNull();
  });

  test("empty sections show friendly messages", async () => {
    api.getClientOverview.mockResolvedValue({ ...overview, roadmap: { total: 0, current: 0, stages: [] }, followUps: [], documents: [], updates: [] });
    render(<ClientPortalDashboard />);
    expect(await screen.findByText(/roadmap will appear here/)).toBeInTheDocument();
    expect(screen.getByText("No documents have been requested yet.")).toBeInTheDocument();
    expect(screen.getByText("Nothing scheduled right now.")).toBeInTheDocument();
    expect(screen.getByText("No updates yet.")).toBeInTheDocument();
  });

  test("a disabled portal shows a clear message and no client data", async () => {
    api.getClientOverview.mockRejectedValue(Object.assign(new Error("off"), { status: 403, code: "CLIENT_PORTAL_DISABLED" }));
    render(<ClientPortalDashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Portal access is disabled");
    expect(screen.queryByText("Your details")).toBeNull();
  });

  test("an ended / unauthorised session clears it and returns to the login page", async () => {
    api.getClientOverview.mockRejectedValue(Object.assign(new Error("ended"), { status: 401, code: "CLIENT_SESSION_ENDED" }));
    render(<ClientPortalDashboard />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true }));
    expect(api.clearClientSession).toHaveBeenCalled();
  });

  test("other errors are shown with a retry; sign out revokes and goes to login", async () => {
    api.getClientOverview.mockRejectedValueOnce(new Error("Network down")).mockResolvedValueOnce(overview);
    render(<ClientPortalDashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Network down");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Welcome, Asha" });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(api.logoutClient).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });
});

describe("Client Portal route guard", () => {
  beforeEach(() => localStorage.clear());
  const guarded = () => render(<ClientPortalPrivateRoute><div>portal</div></ClientPortalPrivateRoute>);

  test("only a client session may open the portal", () => {
    localStorage.setItem("token", "t");
    localStorage.setItem("userType", "client");
    guarded();
    expect(screen.getByText("portal")).toBeInTheDocument();
  });

  test.each([["processperson"], ["customer"], [null]])("%s / no session is sent to /login", (type) => {
    localStorage.setItem("token", "t");
    if (type) localStorage.setItem("userType", type);
    guarded();
    expect(screen.getByTestId("redirect")).toHaveAttribute("data-to", "/login");
  });

  test("no token is sent to /login even with the client type", () => {
    localStorage.setItem("userType", "client");
    guarded();
    expect(screen.getByTestId("redirect")).toHaveAttribute("data-to", "/login");
  });
});

describe("responsive layout (CSS contract; real-browser check is done separately)", () => {
  const css = fs.readFileSync(path.join(__dirname, "../../styles/clientPortal.css"), "utf8");
  test("single column grid at tablet width, compact header on phones, no fixed-width overflow", () => {
    expect(css).toMatch(/@media \(max-width: 860px\)[\s\S]*\.cp-grid[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
    expect(css).toMatch(/@media \(max-width: 560px\)/);
    expect(css).toMatch(/\.cp-roadmap\s*\{[^}]*repeat\(auto-fill, minmax\(84px, 1fr\)\)/); // wraps, never scrolls sideways
    expect(css).toMatch(/\.cp-card\s*\{[^}]*min-width: 0/);
    expect(css).toMatch(/\.cp-main\s*\{[^}]*max-width: 1100px/);
  });
});
