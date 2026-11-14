import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

const mockNavigate = jest.fn();
let mockId = "co-1";
let mockParams = new URLSearchParams();
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...r }) => <a href={to} {...r}>{children}</a>,
  NavLink: ({ to, children }) => <a href={to}>{typeof children === "function" ? children({ isActive: false }) : children}</a>,
  Outlet: () => null,
  useNavigate: () => mockNavigate,
  useParams: () => (mockId ? { id: mockId } : {}),
  useSearchParams: () => [mockParams, jest.fn()],
}));
jest.mock("recharts", () => {
  const Box = ({ children }) => <div data-testid="chart">{children}</div>;
  return new Proxy({}, { get: () => Box });
});
jest.mock("../../../context/MasterContext", () => ({ useMaster: () => ({ logout: jest.fn() }) }));
jest.mock("../../../context/CompanyContext", () => ({
  useCompany: () => ({ companies: [] }),
}));
jest.mock("../../../services/supportService", () => ({
  masterSupport: { list: jest.fn() },
  SUPPORT_PRIORITIES: ["Low", "Medium", "High", "Urgent"],
}));
jest.mock("../../../services/masterAdminService", () => {
  const actual = jest.requireActual("../../../services/masterAdminService");
  return {
    ...actual,
    masterAdmin: {
      dashboard: jest.fn(), companies: jest.fn(), company: jest.fn(), updateCompany: jest.fn(), updateSubscription: jest.fn(), renew: jest.fn(),
      expiryReminder: jest.fn(), admins: jest.fn(), activity: jest.fn(),
      createDraft: jest.fn(), updateCode: jest.fn(), database: jest.fn(), saveDatabase: jest.fn(), testDatabase: jest.fn(), invitation: jest.fn(), generateInvitation: jest.fn(), revokeInvitation: jest.fn(), activate: jest.fn(), features: jest.fn(), updateFeatures: jest.fn(),
      promotions: jest.fn(), promotion: jest.fn(), createPromotion: jest.fn(), updatePromotion: jest.fn(), cancelPromotion: jest.fn(),
    },
    announcements: { list: jest.fn(), get: jest.fn(), markRead: jest.fn() },
  };
});

import { masterAdmin, announcements } from "../../../services/masterAdminService";
import ControlCenterDashboard from "./ControlCenterDashboard";
import CompaniesPage from "./CompaniesPage";
import CompanyDetails, { TABS } from "./CompanyDetails";
import PromotionsPage, { validatePromotion, toPayload } from "./PromotionsPage";
import { validateProfile, toBody } from "./CompanyProfileFields";
import AnnouncementsPanel from "../../admin/AnnouncementsPanel";

const dash = (over = {}) => ({
  kpis: { totalCompanies: 12, activeCompanies: 9, inactiveCompanies: 3, trialCompanies: 2, expiringSubscriptions: 4, totalCompanyAdmins: 11, openSupportTickets: 5, recentlyRegistered: 3 },
  registrationTrend: [{ key: "2026-11", label: "Nov 26", count: 3 }],
  subscriptionDistribution: { byStatus: [{ status: "active", count: 9 }, { status: "expired", count: 1 }], byPlan: [{ plan: "Pro", count: 6 }] },
  upcomingExpiries: [{ id: "co-1", name: "Alpha", plan: "Pro", expiryDate: "2026-12-01", daysLeft: 12 }],
  recentCompanies: [{ id: "co-2", name: "Beta", code: "BETA-1", status: "active", plan: "Basic", createdAt: "2026-11-01" }],
  recentActivity: [{ id: 1, action: "company.created", entityType: "company", actorEmail: "m@x.com", details: { name: "Beta" }, createdAt: "2026-11-01T10:00:00Z" }],
  ...over,
});

const company = (over = {}) => ({
  id: "co-1", name: "Alpha Ltd", code: "ATO-AAA111", status: "active", createdAt: "2026-01-02", updatedAt: "2026-11-01", adminClaimedAt: "2026-01-03", expiryDate: "2026-12-01",
  legalName: "Alpha Limited", displayName: "Alpha", industry: "Retail", contactEmail: "hi@alpha.com", plan: "Pro", isTrial: false, userLimit: 25, storageLimitMb: 1024,
  subscriptionStatus: "expiring_soon", internalNotes: "VIP customer", features: {}, ...over,
});

beforeEach(() => {
  mockParams = new URLSearchParams();
  jest.clearAllMocks();
});

describe("Master dashboard", () => {
  test("shows every KPI, charts, expiries, registrations and activity from real API data", async () => {
    masterAdmin.dashboard.mockResolvedValue(dash());
    render(<ControlCenterDashboard />);
    expect(await screen.findByTestId("kpi-totalCompanies")).toHaveTextContent("12");
    expect(screen.getByTestId("kpi-activeCompanies")).toHaveTextContent("9");
    expect(screen.getByTestId("kpi-inactiveCompanies")).toHaveTextContent("3");
    expect(screen.getByTestId("kpi-trialCompanies")).toHaveTextContent("2");
    expect(screen.getByTestId("kpi-expiringSubscriptions")).toHaveTextContent("4");
    expect(screen.getByTestId("kpi-totalCompanyAdmins")).toHaveTextContent("11");
    expect(screen.getByTestId("kpi-openSupportTickets")).toHaveTextContent("5");
    expect(screen.getByTestId("kpi-recentlyRegistered")).toHaveTextContent("3");
    expect(screen.getAllByTestId("chart").length).toBeGreaterThan(0);
    expect(screen.getByText("Alpha").closest("a")).toHaveAttribute("href", "/master/companies/co-1");
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText(/company created/i)).toBeInTheDocument();
  });

  test("quick actions navigate; empty states and errors are handled", async () => {
    masterAdmin.dashboard.mockResolvedValue(dash({ upcomingExpiries: [], recentCompanies: [], recentActivity: [], subscriptionDistribution: { byStatus: [], byPlan: [] } }));
    render(<ControlCenterDashboard />);
    expect(await screen.findByText(/nothing expires in the next 30 days/i)).toBeInTheDocument();
    expect(screen.getByText(/no activity recorded yet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add company/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/master/companies/new");
    fireEvent.click(screen.getByRole("button", { name: /new promotion/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/master/promotions?new=1");
  });

  test("a failed load shows an error with retry", async () => {
    masterAdmin.dashboard.mockRejectedValueOnce({ response: { data: { message: "Boom" } } }).mockResolvedValueOnce(dash());
    render(<ControlCenterDashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Boom");
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByTestId("kpi-totalCompanies")).toBeInTheDocument();
  });
});

describe("Companies list", () => {
  test("filters by subscription status and searches via the API; suspend toggles status", async () => {
    masterAdmin.companies.mockResolvedValue({ total: 1, companies: [company()] });
    masterAdmin.updateCompany.mockResolvedValue({});
    render(<CompaniesPage />);
    const row = await screen.findByTestId("company-row-ATO-AAA111");
    expect(row).toHaveTextContent("Alpha");
    expect(row).toHaveTextContent("Expiring soon");
    fireEvent.change(screen.getByLabelText(/subscription filter/i), { target: { value: "expired" } });
    await waitFor(() => expect(masterAdmin.companies).toHaveBeenLastCalledWith(expect.objectContaining({ subscription: "expired", page: 1 })));
    window.confirm = jest.fn(() => true);
    fireEvent.click(await screen.findByRole("button", { name: /suspend alpha ltd/i }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(masterAdmin.updateCompany).toHaveBeenCalledWith("co-1", { status: "paused" }));
  });

  test("empty state; Add company opens the full-page setup (no popup)", async () => {
    masterAdmin.companies.mockResolvedValue({ total: 0, companies: [] });
    render(<CompaniesPage />);
    expect(await screen.findByText(/no companies match/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add company/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/master/companies/new");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("a draft company shows its setup stage and a Continue setup link instead of a suspend toggle", async () => {
    masterAdmin.companies.mockResolvedValue({ total: 1, companies: [company({ id: "co-9", code: "ATO-DRAFT1", name: "Draft Co", provisioning: "draft", adminClaimedAt: null, expiryDate: null, subscriptionStatus: "not_configured", setup: { stage: "database_pending", steps: [], canActivate: false } })] });
    render(<CompaniesPage />);
    const row = await screen.findByTestId("company-row-ATO-DRAFT1");
    expect(row).toHaveTextContent("Database pending");
    expect(within(row).getByRole("link", { name: /continue setup/i })).toHaveAttribute("href", "/master/companies/co-9");
    expect(within(row).queryByRole("button", { name: /suspend|activate/i })).not.toBeInTheDocument();
  });
});

describe("Company details", () => {
  beforeEach(() => {
    masterAdmin.company.mockResolvedValue(company());
    masterAdmin.features.mockResolvedValue([{ key: "messaging", label: "Internal messaging & presence", enabled: true }]);
  });

  test("has every required tab", async () => {
    render(<CompanyDetails />);
    await screen.findByRole("tablist");
    expect(TABS).toEqual(expect.arrayContaining(["Overview", "Subscription", "Admin Users", "Activity", "Promotions", "Support Tickets", "Internal Notes"]));
    TABS.forEach((t) => expect(screen.getByRole("tab", { name: t })).toBeInTheDocument());
    expect(screen.getByText("Alpha Limited")).toBeInTheDocument();
  });

  test("subscription tab saves and renews without touching anything else", async () => {
    masterAdmin.updateSubscription.mockResolvedValue({});
    masterAdmin.renew.mockResolvedValue({});
    render(<CompanyDetails />);
    fireEvent.click(await screen.findByRole("tab", { name: "Subscription" }));
    fireEvent.change(screen.getByLabelText("Employee / user limit"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: /save subscription/i }));
    await waitFor(() => expect(masterAdmin.updateSubscription).toHaveBeenCalledWith("co-1", expect.objectContaining({ userLimit: 40, plan: "Pro" })));
    fireEvent.click(screen.getByRole("button", { name: /renew \+12 mo/i }));
    await waitFor(() => expect(masterAdmin.renew).toHaveBeenCalledWith("co-1", 12));
  });

  test("admin users: registered admins are listed read-only - there is no password reset", async () => {
    masterAdmin.admins.mockResolvedValue({ admins: [{ id: 1, username: "boss", email: "b@a.com", firstname: "Big", lastname: "Boss", can_login: true }] });
    masterAdmin.invitation.mockResolvedValue({ current: null, history: [] });
    render(<CompanyDetails />);
    fireEvent.click(await screen.findByRole("tab", { name: "Admin Users" }));
    await screen.findByText("boss");
    expect(screen.queryByRole("button", { name: /reset/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
    expect(screen.getByText(/never visible to master users/i)).toBeInTheDocument();
  });

  test("feature toggle sends only that module and reflects the server's answer", async () => {
    masterAdmin.updateFeatures.mockResolvedValue([{ key: "messaging", label: "Internal messaging & presence", enabled: false }]);
    render(<CompanyDetails />);
    fireEvent.click(await screen.findByRole("tab", { name: "Features" }));
    fireEvent.click(await screen.findByRole("switch", { name: /internal messaging/i }));
    await waitFor(() => expect(masterAdmin.updateFeatures).toHaveBeenCalledWith("co-1", { messaging: false }));
    expect(await screen.findByText(/enforced on the server immediately/i)).toBeInTheDocument();
  });

  test("internal notes save", async () => {
    masterAdmin.updateCompany.mockResolvedValue({});
    render(<CompanyDetails />);
    fireEvent.click(await screen.findByRole("tab", { name: "Internal Notes" }));
    const box = screen.getByLabelText("Internal notes");
    expect(box).toHaveValue("VIP customer");
    fireEvent.change(box, { target: { value: "Renewal call booked" } });
    fireEvent.click(screen.getByRole("button", { name: /save notes/i }));
    await waitFor(() => expect(masterAdmin.updateCompany).toHaveBeenCalledWith("co-1", { internalNotes: "Renewal call booked" }));
  });

  test("profile validation catches bad input before the server does", () => {
    expect(validateProfile({ contactEmail: "nope", website: "ftp://x", contactPhone: "abc", userLimit: "-1" })).toEqual(expect.objectContaining({ contactEmail: expect.any(String), website: expect.any(String), contactPhone: expect.any(String), userLimit: expect.any(String) }));
    expect(validateProfile({ subscriptionStart: "2026-02-01", expiryDate: "2026-01-01" }).expiryDate).toBeTruthy();
    expect(toBody({ plan: "Pro", userLimit: "10", website: "", isTrial: true }, { forCreate: true })).toEqual({ plan: "Pro", userLimit: 10, isTrial: true });
  });
});

describe("Promotions", () => {
  const promo = (over = {}) => ({ id: "p1", title: "Diwali Offer", description: "20% off", category: "Offer", audienceType: "all", companyIds: [], status: "Published", publishedAt: "2026-11-10T10:00:00Z", expiresAt: null, stats: { deliveredCompanies: 5, readCompanies: 2, unreadCompanies: 3, totalReads: 2, notifiedAdmins: 5 }, ...over });

  test("validatePromotion mirrors the server rules", () => {
    const now = new Date("2026-11-14T10:00:00Z");
    const base = { title: "Hello", description: "World", category: "Offer", audienceType: "all", companyIds: [], ctaLabel: "", ctaUrl: "", bannerUrl: "", mode: "publish", publishAt: "", expiresAt: "" };
    expect(validatePromotion(base, now)).toEqual({});
    expect(validatePromotion({ ...base, title: "x" }, now).title).toBeTruthy();
    expect(validatePromotion({ ...base, audienceType: "selected" }, now).companyIds).toBeTruthy();
    expect(validatePromotion({ ...base, ctaUrl: "javascript:alert(1)", ctaLabel: "Go" }, now).ctaUrl).toBeTruthy();
    expect(validatePromotion({ ...base, ctaUrl: "https://a.com" }, now).ctaLabel).toBeTruthy();
    expect(validatePromotion({ ...base, mode: "schedule" }, now).publishAt).toBeTruthy();
    expect(validatePromotion({ ...base, mode: "schedule", publishAt: "2026-11-13T10:00" }, now).publishAt).toMatch(/future/);
    expect(validatePromotion({ ...base, mode: "schedule", publishAt: "2026-12-01T10:00", expiresAt: "2026-11-30T10:00" }, now).expiresAt).toBeTruthy();
    expect(toPayload({ ...base, mode: "schedule", publishAt: "2026-12-01T10:00", audienceType: "selected", companyIds: ["a"] })).toMatchObject({ action: "schedule", audienceType: "selected", companyIds: ["a"] });
    expect(toPayload({ ...base, audienceType: "all", companyIds: ["a"] }).companyIds).toEqual([]);
  });

  test("history shows delivery / read statistics and the cancel confirmation flow", async () => {
    masterAdmin.promotions.mockResolvedValue({ total: 1, promotions: [promo()] });
    masterAdmin.companies.mockResolvedValue({ companies: [] });
    masterAdmin.cancelPromotion.mockResolvedValue({});
    render(<PromotionsPage />);
    const row = (await screen.findByText("Diwali Offer")).closest("tr");
    expect(row).toHaveTextContent("5");
    expect(row).toHaveTextContent("2 / 3");
    fireEvent.click(within(row).getByRole("button", { name: "Cancel" }));
    expect(masterAdmin.cancelPromotion).not.toHaveBeenCalled(); // needs confirmation
    fireEvent.click(within(row).getByRole("button", { name: /confirm cancel/i }));
    await waitFor(() => expect(masterAdmin.cancelPromotion).toHaveBeenCalledWith("p1"));
  });

  test("creating: validation first, then publish-now with the chosen audience and a live preview", async () => {
    masterAdmin.promotions.mockResolvedValue({ total: 0, promotions: [] });
    masterAdmin.companies.mockResolvedValue({ companies: [{ id: "co-1", name: "Alpha", code: "A" }, { id: "co-2", name: "Beta", code: "B" }] });
    masterAdmin.createPromotion.mockResolvedValue({});
    render(<PromotionsPage />);
    fireEvent.click(await screen.findByRole("button", { name: /new promotion/i }));
    fireEvent.click(screen.getByRole("button", { name: /publish now/i }));
    expect(await screen.findByText(/add a title/i)).toBeInTheDocument();
    expect(masterAdmin.createPromotion).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Maintenance tonight" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Short downtime at 11pm" } });
    expect(within(screen.getByTestId("promo-preview")).getByText("Maintenance tonight")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Maintenance" } });
    fireEvent.change(screen.getByLabelText("Audience"), { target: { value: "selected" } });
    fireEvent.click(screen.getByRole("button", { name: /publish now/i }));
    expect(await screen.findByText(/select at least one company/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Beta/));
    fireEvent.click(screen.getByRole("button", { name: /publish now/i }));
    await waitFor(() => expect(masterAdmin.createPromotion).toHaveBeenCalledWith(expect.objectContaining({ title: "Maintenance tonight", category: "Maintenance", audienceType: "selected", companyIds: ["co-2"], action: "publish" })));
  });

  test("details modal shows per-company delivery and read state", async () => {
    masterAdmin.promotions.mockResolvedValue({ total: 1, promotions: [promo()] });
    masterAdmin.companies.mockResolvedValue({ companies: [] });
    masterAdmin.promotion.mockResolvedValue({ promotion: promo(), deliveries: [{ companyId: "co-1", companyName: "Alpha", deliveredAt: "2026-11-10T10:00:00Z", read: true }, { companyId: "co-2", companyName: "Beta", deliveredAt: "2026-11-10T10:00:00Z", read: false }] });
    render(<PromotionsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Diwali Offer" }));
    expect(await screen.findByTestId("promo-stats")).toHaveTextContent(/Delivered to 5.*Read by 2.*Unread 3/);
    expect(screen.getByText("Alpha").closest("tr")).toHaveTextContent("Read");
    expect(screen.getByText("Beta").closest("tr")).toHaveTextContent("Unread");
  });
});

describe("Company admin announcements", () => {
  const item = (over = {}) => ({ id: "a1", title: "New feature", category: "Product Update", publishedAt: "2026-11-10T10:00:00Z", read: false, ...over });

  test("renders nothing when there are no announcements", async () => {
    announcements.list.mockResolvedValue({ promotions: [], unread: 0 });
    const { container } = render(<AnnouncementsPanel />);
    await waitFor(() => expect(announcements.list).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  test("shows unread count; opening shows full details and marks it read; unsafe links are not rendered", async () => {
    announcements.list.mockResolvedValue({ promotions: [item()], unread: 1 });
    announcements.get.mockResolvedValue({ ...item(), description: "Read all about it", ctaLabel: "Learn more", ctaUrl: "javascript:alert(1)", bannerUrl: "javascript:x" });
    announcements.markRead.mockResolvedValue({});
    render(<AnnouncementsPanel />);
    expect(await screen.findByTestId("announcement-unread")).toHaveTextContent("1 new");
    fireEvent.click(screen.getByRole("button", { name: /new feature/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Read all about it");
    expect(within(dialog).queryByRole("link")).toBeNull(); // javascript: URL refused
    await waitFor(() => expect(announcements.markRead).toHaveBeenCalledWith("a1"));
  });

  test("a safe CTA opens in a new tab with noopener", async () => {
    announcements.list.mockResolvedValue({ promotions: [item({ read: true })], unread: 0 });
    announcements.get.mockResolvedValue({ ...item({ read: true }), description: "d", ctaLabel: "Learn more", ctaUrl: "https://example.com/x" });
    render(<AnnouncementsPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /new feature/i }));
    const link = await screen.findByRole("link", { name: "Learn more" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(announcements.markRead).not.toHaveBeenCalled(); // already read
  });
});

describe("Company setup workspace (full page)", () => {
  const draftCompany = (over = {}) => company({
    id: "co-d", name: "Draft Co", code: "ATO-DRAFT1", provisioning: "draft", adminClaimedAt: null, expiryDate: null, subscriptionStatus: "not_configured", dbConfigured: false,
    setup: { stage: "draft", steps: [{ key: "details", label: "Company details", done: true }, { key: "database", label: "Database connected", done: false }, { key: "invitation", label: "Admin invited", done: false }, { key: "admin", label: "Admin registered", done: false }, { key: "activation", label: "Activated", done: false }], canActivate: false },
    ...over,
  });
  beforeEach(() => {
    mockId = "co-d";
    window.confirm = jest.fn(() => true);
    masterAdmin.features.mockResolvedValue([]);
  });
  afterEach(() => { mockId = "co-1"; });

  test("a new company is entered on a page (not a popup): only Overview is open; Save draft creates it and opens its workspace", async () => {
    mockId = undefined;
    masterAdmin.createDraft.mockResolvedValue({ company: { id: "new-1" } });
    render(<CompanyDetails />);
    expect(screen.getByRole("heading", { name: /new company/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    TABS.filter((t) => t !== "Overview").forEach((t) => expect(screen.getByRole("tab", { name: t })).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(await screen.findByText(/company name is required/i)).toBeInTheDocument();
    expect(masterAdmin.createDraft).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Company name *"), { target: { value: "Fresh Co" } });
    fireEvent.change(screen.getByLabelText("Legal company name"), { target: { value: "Fresh Company Pvt Ltd" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(masterAdmin.createDraft).toHaveBeenCalledWith(expect.objectContaining({ name: "Fresh Co", legalName: "Fresh Company Pvt Ltd" })));
    expect(masterAdmin.createDraft.mock.calls[0][0]).not.toHaveProperty("code");
    expect(mockNavigate).toHaveBeenCalledWith("/master/companies/new-1", { replace: true });
  });

  test("overview shows setup progress and holds Activate back until the requirements are met", async () => {
    masterAdmin.company.mockResolvedValue(draftCompany());
    render(<CompanyDetails />);
    expect(await screen.findByRole("region", { name: /setup progress/i })).toBeInTheDocument();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.queryByRole("button", { name: /activate company/i })).not.toBeInTheDocument();
    expect(screen.getByText(/activation unlocks once/i)).toBeInTheDocument();
  });

  test("activation is offered when ready, asks for confirmation, and calls the activate endpoint", async () => {
    masterAdmin.company.mockResolvedValue(draftCompany({ adminClaimedAt: "2026-11-02", dbConfigured: true, setup: { stage: "admin_registered", steps: [{ key: "details", label: "Company details", done: true }], canActivate: true } }));
    masterAdmin.activate.mockResolvedValue({ message: "Company activated" });
    render(<CompanyDetails />);
    fireEvent.click(await screen.findByRole("button", { name: /activate company/i }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(masterAdmin.activate).toHaveBeenCalledWith("co-d"));
  });

  test("suspend asks for confirmation first", async () => {
    masterAdmin.company.mockResolvedValue(company());
    masterAdmin.updateCompany.mockResolvedValue({});
    mockId = "co-1";
    window.confirm = jest.fn(() => false);
    render(<CompanyDetails />);
    fireEvent.click(await screen.findByRole("button", { name: /suspend company/i }));
    expect(masterAdmin.updateCompany).not.toHaveBeenCalled();
    window.confirm = jest.fn(() => true);
    fireEvent.click(screen.getByRole("button", { name: /suspend company/i }));
    await waitFor(() => expect(masterAdmin.updateCompany).toHaveBeenCalledWith("co-1", { status: "paused" }));
  });

  test("unsaved edits are protected: switching tabs asks before discarding", async () => {
    masterAdmin.company.mockResolvedValue(draftCompany());
    render(<CompanyDetails />);
    fireEvent.click(await screen.findByRole("button", { name: /edit draft/i }));
    fireEvent.change(screen.getByLabelText("Industry"), { target: { value: "Logistics" } });
    expect(await screen.findByText(/unsaved changes/i)).toBeInTheDocument();
    window.confirm = jest.fn(() => false);
    fireEvent.click(screen.getByRole("tab", { name: "Subscription" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    window.confirm = jest.fn(() => true);
    fireEvent.click(screen.getByRole("tab", { name: "Subscription" }));
    expect(screen.getByRole("tab", { name: "Subscription" })).toHaveAttribute("aria-selected", "true");
  });

  test("database tab: the stored password is never shown; blank keeps it; a new one is sent and cleared", async () => {
    masterAdmin.company.mockResolvedValue(draftCompany({ dbConfigured: true }));
    const db = { configured: true, db_name: "acme_db", db_host: "db.acme.com", db_port: 3306, db_user: "acme", passwordSet: true, status: "untested", locked: false, lastTestAt: null };
    masterAdmin.database.mockResolvedValue(db);
    masterAdmin.saveDatabase.mockResolvedValue({ message: "Database configuration saved.", database: { ...db, db_host: "db2.acme.com" } });
    masterAdmin.testDatabase.mockResolvedValue({ ok: true, message: "Connection successful.", database: { ...db, status: "connected" } });
    render(<CompanyDetails />);
    fireEvent.click(await screen.findByRole("tab", { name: "Database Configuration" }));
    const pw = await screen.findByLabelText(/database password/i);
    expect(pw).toHaveAttribute("type", "password");
    expect(pw).toHaveValue("");
    expect(pw).toHaveAttribute("placeholder", expect.stringMatching(/unchanged/i));
    expect(screen.getByRole("button", { name: /test connection/i })).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText(/database host/i), { target: { value: "db2.acme.com" } });
    expect(screen.getByRole("button", { name: /test connection/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /save configuration/i }));
    await waitFor(() => expect(masterAdmin.saveDatabase).toHaveBeenCalledWith("co-d", { db_name: "acme_db", db_host: "db2.acme.com", db_port: 3306, db_user: "acme" }));
    expect(masterAdmin.saveDatabase.mock.calls[0][1]).not.toHaveProperty("db_password");
    fireEvent.change(screen.getByLabelText(/database password/i), { target: { value: "N3w-secret" } });
    fireEvent.click(screen.getByRole("button", { name: /save configuration/i }));
    await waitFor(() => expect(masterAdmin.saveDatabase).toHaveBeenLastCalledWith("co-d", expect.objectContaining({ db_password: "N3w-secret" })));
    await waitFor(() => expect(screen.getByLabelText(/database password/i)).toHaveValue(""));
    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));
    expect(await screen.findByText("Connection successful.")).toBeInTheDocument();
    for (const l of [/database name/i, /database host/i, /database port/i, /database username/i, /database password/i]) expect(screen.getByLabelText(l)).not.toBeDisabled();
  });

  test("database tab: a failed test shows the safe error and keeps every field editable", async () => {
    masterAdmin.company.mockResolvedValue(draftCompany({ dbConfigured: true }));
    const db = { configured: true, db_name: "acme_db", db_host: "db.acme.com", db_port: 3306, db_user: "acme", passwordSet: true, status: "untested", locked: false, lastTestAt: null };
    masterAdmin.database.mockResolvedValue(db);
    masterAdmin.testDatabase.mockResolvedValue({ ok: false, message: "Access denied: check the database username and password.", database: { ...db, status: "failed", lastTestOk: false } });
    render(<CompanyDetails />);
    fireEvent.click(await screen.findByRole("tab", { name: "Database Configuration" }));
    fireEvent.click(await screen.findByRole("button", { name: /test connection/i }));
    expect(await screen.findByText("Access denied: check the database username and password.")).toBeInTheDocument();
    expect(screen.getByText("Connection failed")).toBeInTheDocument();
    for (const l of [/database name/i, /database host/i, /database port/i, /database username/i, /database password/i]) expect(screen.getByLabelText(l)).not.toBeDisabled();
  });

  test("admin tab: invitation needs a connected database, the token is shown once with Copy, and revoke asks first", async () => {
    const steps = (dbDone) => [{ key: "details", label: "Company details", done: true }, { key: "database", label: "Database connected", done: dbDone }];
    masterAdmin.company.mockResolvedValue(draftCompany({ setup: { stage: "draft", steps: steps(false), canActivate: false } }));
    masterAdmin.admins.mockResolvedValue({ admins: [] });
    masterAdmin.invitation.mockResolvedValue({ current: null, history: [] });
    const first = render(<CompanyDetails />);
    fireEvent.click(await screen.findByRole("tab", { name: "Admin Users" }));
    expect(await screen.findByText(/connect and test the company database first/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate admin invitation token/i })).toBeDisabled();
    first.unmount();

    masterAdmin.company.mockResolvedValue(draftCompany({ dbConfigured: true, setup: { stage: "database_connected", steps: steps(true), canActivate: false } }));
    masterAdmin.generateInvitation.mockResolvedValue({ token: "RAW-ONE-TIME-TOKEN-1234567890abcdef", invitation: { id: "i1", adminEmail: "boss@acme.com", expiresAt: "2026-11-20T10:00:00Z", status: "pending" } });
    masterAdmin.revokeInvitation.mockResolvedValue({});
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue() } });
    render(<CompanyDetails />);
    fireEvent.click(await screen.findByRole("tab", { name: "Admin Users" }));
    fireEvent.click(await screen.findByRole("button", { name: /generate admin invitation token/i }));
    expect(await screen.findByText(/enter the admin.s full name/i)).toBeInTheDocument();
    expect(masterAdmin.generateInvitation).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/admin full name/i), { target: { value: "Asha Boss" } });
    fireEvent.change(screen.getByLabelText(/admin email/i), { target: { value: "boss@acme.com" } });
    masterAdmin.invitation.mockResolvedValue({ current: { id: "i1", adminName: "Asha Boss", adminEmail: "boss@acme.com", status: "pending", expiresAt: "2026-11-20T10:00:00Z", createdAt: "2026-11-14T10:00:00Z", createdByEmail: "m@x.com" }, history: [] });
    fireEvent.click(screen.getByRole("button", { name: /generate admin invitation token/i }));
    await waitFor(() => expect(masterAdmin.generateInvitation).toHaveBeenCalledWith("co-d", expect.objectContaining({ adminName: "Asha Boss", adminEmail: "boss@acme.com", expiresInHours: 72 })));
    expect(JSON.stringify(masterAdmin.generateInvitation.mock.calls[0][1])).not.toMatch(/password/i);
    const tokenBox = await screen.findByLabelText("Invitation token");
    expect(tokenBox).toHaveValue("RAW-ONE-TIME-TOKEN-1234567890abcdef");
    fireEvent.click(screen.getByRole("button", { name: /^copy$/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("RAW-ONE-TIME-TOKEN-1234567890abcdef"));
    fireEvent.click(screen.getByRole("button", { name: /hide/i }));
    expect(screen.queryByLabelText("Invitation token")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("RAW-ONE-TIME-TOKEN-1234567890abcdef")).not.toBeInTheDocument();
    window.confirm = jest.fn(() => false);
    fireEvent.click(await screen.findByRole("button", { name: /revoke unused invitation/i }));
    expect(masterAdmin.revokeInvitation).not.toHaveBeenCalled();
    window.confirm = jest.fn(() => true);
    fireEvent.click(screen.getByRole("button", { name: /revoke unused invitation/i }));
    await waitFor(() => expect(masterAdmin.revokeInvitation).toHaveBeenCalledWith("co-d"));
  });

  test("subscription tab exposes billing cycle, renewal, employee limit and notes", async () => {
    masterAdmin.company.mockResolvedValue(company());
    masterAdmin.updateSubscription.mockResolvedValue({});
    mockId = "co-1";
    render(<CompanyDetails />);
    fireEvent.click(await screen.findByRole("tab", { name: "Subscription" }));
    fireEvent.change(screen.getByLabelText("Billing cycle"), { target: { value: "yearly" } });
    fireEvent.change(screen.getByLabelText(/maximum employees/i), { target: { value: "80" } });
    fireEvent.click(screen.getByLabelText(/auto-renewing/i));
    fireEvent.change(screen.getByLabelText(/internal subscription notes/i), { target: { value: "Annual deal" } });
    fireEvent.click(screen.getByRole("button", { name: /save subscription/i }));
    await waitFor(() => expect(masterAdmin.updateSubscription).toHaveBeenCalledWith("co-1", expect.objectContaining({ billingCycle: "yearly", employeeLimit: 80, autoRenew: true, subscriptionNotes: "Annual deal" })));
  });
});
