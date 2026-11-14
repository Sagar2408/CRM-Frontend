import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

const mockNavigate = jest.fn();
let mockParams = new URLSearchParams();
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...r }) => <a href={to} {...r}>{children}</a>,
  NavLink: ({ to, children }) => <a href={to}>{typeof children === "function" ? children({ isActive: false }) : children}</a>,
  Outlet: () => null,
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: "co-1" }),
  useSearchParams: () => [mockParams, jest.fn()],
}));
jest.mock("recharts", () => {
  const Box = ({ children }) => <div data-testid="chart">{children}</div>;
  return new Proxy({}, { get: () => Box });
});
jest.mock("../../../context/MasterContext", () => ({ useMaster: () => ({ logout: jest.fn() }) }));
jest.mock("../../../context/CompanyContext", () => ({
  useCompany: () => ({ companies: [], regenerateAdminToken: jest.fn(), addCompany: jest.fn() }),
}));
jest.mock("../AddCompanyModal", () => () => <div>ADD-COMPANY-MODAL</div>);
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
      expiryReminder: jest.fn(), admins: jest.fn(), resetAdminPassword: jest.fn(), activity: jest.fn(), features: jest.fn(), updateFeatures: jest.fn(),
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
    expect(mockNavigate).toHaveBeenCalledWith("/master/companies?add=1");
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
    fireEvent.click(await screen.findByRole("button", { name: /suspend alpha ltd/i }));
    await waitFor(() => expect(masterAdmin.updateCompany).toHaveBeenCalledWith("co-1", { status: "paused" }));
  });

  test("empty state and the add-company modal", async () => {
    masterAdmin.companies.mockResolvedValue({ total: 0, companies: [] });
    render(<CompaniesPage />);
    expect(await screen.findByText(/no companies match/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add company/i }));
    expect(screen.getByText("ADD-COMPANY-MODAL")).toBeInTheDocument();
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

  test("admin users: reset password needs 8+ chars and calls the API", async () => {
    masterAdmin.admins.mockResolvedValue({ admins: [{ id: 1, username: "boss", email: "b@a.com", firstname: "Big", lastname: "Boss", can_login: true }] });
    masterAdmin.resetAdminPassword.mockResolvedValue({});
    render(<CompanyDetails />);
    fireEvent.click(await screen.findByRole("tab", { name: "Admin Users" }));
    await screen.findByText("boss");
    fireEvent.change(screen.getByLabelText("New password for boss"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 8/i);
    expect(masterAdmin.resetAdminPassword).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("New password for boss"), { target: { value: "Brand-new-pass1" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(masterAdmin.resetAdminPassword).toHaveBeenCalledWith("co-1", 1, "Brand-new-pass1"));
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
