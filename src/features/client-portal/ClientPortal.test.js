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
  documents: [],
  documentRequests: [
    { name: "Passport", requestedAt: "2026-11-01T10:00:00Z", status: "Received", uploadedAt: "2026-11-02T10:00:00Z", documentId: 5 },
    { name: "Bank Statement", requestedAt: "2026-11-03T10:00:00Z", status: "Pending", uploadedAt: null, documentId: null },
  ],
  uploads: [
    { id: 5, fileName: "Passport.pdf", mimeType: "application/pdf", uploadedAt: "2026-11-02T10:00:00Z", status: "Submitted", previewable: true, forRequest: true },
    { id: 6, fileName: "notes.docx", mimeType: "application/msword", uploadedAt: "2026-11-04T10:00:00Z", status: "Submitted", previewable: false, forRequest: false },
  ],
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
    expect(within(docs).getByText("Documents Requested")).toBeInTheDocument();
    expect(within(docs).getByText("My Uploaded Documents")).toBeInTheDocument();
    expect(within(docs).getByText("Received")).toBeInTheDocument();
    expect(within(docs).getByText("Pending")).toBeInTheDocument();
    expect(within(docs).getByText("Passport.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Document collection - Passport/)).toBeInTheDocument();
    expect(screen.getByText("Reminder: please upload your bank statement")).toBeInTheDocument();
  });

  test("only pending requests offer an Upload; previews only for previewable files", async () => {
    render(<ClientPortalDashboard />);
    await screen.findByRole("heading", { name: "Welcome, Asha" });
    expect(screen.getByLabelText("Upload Bank Statement")).toBeInTheDocument();
    expect(screen.queryByLabelText("Upload Passport")).toBeNull();
    expect(screen.getByRole("button", { name: "Preview Passport.pdf" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Preview notes.docx" })).toBeNull();
    expect(screen.getByRole("button", { name: "Download notes.docx" })).toBeInTheDocument();
  });

  test("uploading against a request sends that request name, then reloads the overview", async () => {
    api.uploadClientDocument.mockResolvedValue({});
    render(<ClientPortalDashboard />);
    await screen.findByRole("heading", { name: "Welcome, Asha" });
    const file = new File(["x"], "bank.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Upload Bank Statement"), { target: { files: [file] } });
    await waitFor(() => expect(api.uploadClientDocument).toHaveBeenCalledWith(file, "Bank Statement"));
    expect(await screen.findByText("Bank Statement uploaded.")).toBeInTheDocument();
    expect(api.getClientOverview).toHaveBeenCalledTimes(2);
  });

  test("a failed upload shows the error and keeps the page", async () => {
    api.uploadClientDocument.mockRejectedValue(new Error("Unsupported file type."));
    render(<ClientPortalDashboard />);
    await screen.findByRole("heading", { name: "Welcome, Asha" });
    fireEvent.change(screen.getByLabelText("Upload another document"), { target: { files: [new File(["x"], "a.exe")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Unsupported file type.");
  });

  test("empty sections show friendly messages", async () => {
    api.getClientOverview.mockResolvedValue({ ...overview, roadmap: { total: 0, current: 0, stages: [] }, followUps: [], documents: [], documentRequests: [], uploads: [], updates: [] });
    render(<ClientPortalDashboard />);
    expect(await screen.findByText(/roadmap will appear here/)).toBeInTheDocument();
    expect(screen.getByText("No documents have been requested yet.")).toBeInTheDocument();
    expect(screen.getByText("You have not uploaded any documents yet.")).toBeInTheDocument();
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
  test("light theme sets explicit readable text colours", () => {
    expect(css).toMatch(/--cp-text: #0f172a/);
    expect(css).toContain(".cp-shell :where(h1, h2, h3, p, li, dd) {");
  });

  test("two-column areas collapse at tablet width, journey turns vertical and header compacts on phones", () => {
    const block = (sel) => {
      const i = css.indexOf(sel + " {");
      return i < 0 ? "" : css.slice(i, css.indexOf("}", i));
    };
    const media = (w) => {
      const i = css.indexOf("@media (max-width: " + w + "px)");
      return i < 0 ? "" : css.slice(i, css.indexOf("\n}\n", i));
    };
    expect(media(860)).toContain(".cp-grid");
    expect(media(860)).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(media(640)).toContain("flex-direction: column");
    expect(media(560)).toContain(".cp-header__inner");
    expect(block(".cp-roadmap")).toContain("overflow-x: auto");
    expect(block(".cp-card")).toContain("min-width: 0");
    expect(block(".cp-main")).toContain("max-width: 1100px");
  });
});
