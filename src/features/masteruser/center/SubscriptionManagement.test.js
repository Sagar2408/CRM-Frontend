import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...r }) => <a href={to} {...r}>{children}</a>,
  NavLink: ({ to, children }) => <a href={to}>{typeof children === "function" ? children({ isActive: false }) : children}</a>,
  Outlet: () => null,
}));
jest.mock("../../../context/MasterContext", () => ({ useMaster: () => ({ logout: jest.fn() }) }));
jest.mock("../../../services/billingService", () => ({ billing: { subscription: jest.fn(), receipt: jest.fn() } }));
jest.mock("../../../services/masterAdminService", () => {
  const actual = jest.requireActual("../../../services/masterAdminService");
  return {
    ...actual,
    masterAdmin: {
      plans: jest.fn(), createPlan: jest.fn(), updatePlan: jest.fn(), setPlanStatus: jest.fn(), subscriptionDetails: jest.fn(), assignPlan: jest.fn(),
      recordPayment: jest.fn(), updatePaymentStatus: jest.fn(), uploadReceipt: jest.fn(), receipt: jest.fn(),
      updateSubscription: jest.fn(), renew: jest.fn(), expiryReminder: jest.fn(),
    },
  };
});

import { masterAdmin } from "../../../services/masterAdminService";
import { billing } from "../../../services/billingService";
import MasterShell, { MASTER_NAV } from "./MasterShell";
import SubscriptionPlansPage, { validatePlan, planPayload, EMPTY_PLAN } from "./SubscriptionPlansPage";
import SubscriptionTab from "./setup/SubscriptionTab";
import SubscriptionBilling from "../../admin-settings/SubscriptionBilling";
import { addMonthsInput, addDaysInput, money, pricePer, remainingText, todayInput } from "../../subscription/format";

const plan = (over = {}) => ({
  id: 1, name: "Starter", description: "Small teams", billingCycle: "monthly", amount: 2999, currency: "INR", userLimit: 15, employeeLimit: 15, storageLimitMb: 20000,
  modules: ["messaging"], moduleDetails: [{ key: "messaging", label: "Internal messaging" }], highlights: ["Email support"], trialAvailable: true, trialDays: 14, status: "active",
  companiesAssigned: 1, companiesActive: 1, companies: [{ id: "co-1", name: "Alpha", code: "ALPHA", status: "active" }], ...over,
});
const catalogue = (plans = [plan()]) => ({ plans, totalPlans: plans.length, modules: [{ key: "messaging", label: "Internal messaging" }] });
const company = { id: "co-1", name: "Alpha Ltd", status: "active", provisioning: "active", subscriptionStatus: "active", expiryDate: "2027-01-01T00:00:00.000Z", subscriptionStart: "2026-12-01T00:00:00.000Z", plan: "Starter", billingCycle: "monthly", userLimit: 15 };
const record = (over = {}) => ({
  id: 5, event: "assigned", planId: 1, planSource: "plan", planName: "Starter", billingCycle: "monthly", standardAmount: 2999, amount: 2500, isCustomPrice: true, currency: "INR",
  userLimit: 15, employeeLimit: 15, storageLimitMb: 20000, startDate: "2026-12-01", periodStart: "2026-12-01", expiryDate: "2027-01-01", createdAt: "2026-11-20T10:00:00Z", actorEmail: "m@x.com", ...over,
});
const details = (over = {}) => ({ status: "active", daysRemaining: 34, current: record(), history: [record()], payments: [], ...over });

beforeEach(() => {
  jest.clearAllMocks();
  window.confirm = jest.fn(() => true);
});

describe("navigation", () => {
  test("Subscription Plans sits after Promotions and before Support", () => {
    expect(MASTER_NAV.map((n) => n.label)).toEqual(["Dashboard", "Companies", "Promotions", "Subscription Plans", "Support"]);
    render(<MasterShell />);
    expect(screen.getByRole("link", { name: "Subscription Plans" })).toHaveAttribute("href", "/master/subscription-plans");
  });
});

describe("formatting and validation", () => {
  test("money, prices, dates and remaining days", () => {
    expect(money(59999.5)).toBe("₹59,999.50");
    expect(money(null)).toBe("Not recorded");
    expect(money(0)).toBe("₹0");
    expect(pricePer(2999, "monthly")).toBe("₹2,999 / month");
    expect(pricePer(null, "monthly")).toBe("Price not recorded");
    expect(addMonthsInput("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonthsInput("2026-11-15", 12)).toBe("2027-11-15");
    expect(addDaysInput("2026-12-31", 1)).toBe("2027-01-01");
    expect(remainingText(0)).toBe("Expires today");
    expect(remainingText(-1)).toBe("Expired 1 day ago");
    expect(remainingText(null)).toBe("No expiry date");
  });

  test("plan validation and payload", () => {
    expect(validatePlan(EMPTY_PLAN)).toEqual(expect.objectContaining({ name: expect.any(String), amount: expect.any(String) }));
    const bad = validatePlan({ ...EMPTY_PLAN, name: "Ok", amount: "10.555", userLimit: "0", trialAvailable: true, trialDays: "400" });
    expect(Object.keys(bad).sort()).toEqual(["amount", "trialDays", "userLimit"]);
    expect(planPayload({ ...EMPTY_PLAN, name: " Pro ", amount: "0", highlights: "a\n\n b " })).toEqual(expect.objectContaining({ name: "Pro", amount: 0, userLimit: null, highlights: ["a", "b"], trialAvailable: false }));
    expect(planPayload({ ...EMPTY_PLAN, name: "Pro", amount: "1" })).not.toHaveProperty("trialDays");
  });
});

describe("Subscription Plans page", () => {
  test("lists plans with subscriber counts, searches and filters via the API", async () => {
    masterAdmin.plans.mockResolvedValue(catalogue());
    render(<SubscriptionPlansPage />);
    const row = await screen.findByTestId("plan-row-1");
    expect(row).toHaveTextContent("Starter");
    expect(row).toHaveTextContent("₹2,999");
    expect(row).toHaveTextContent("1 active");
    fireEvent.click(within(row).getByRole("button", { name: /1 companies on starter/i }));
    expect(screen.getByRole("link", { name: "Alpha" })).toHaveAttribute("href", "/master/companies/co-1");
    fireEvent.change(screen.getByLabelText("Search plans"), { target: { value: "star" } });
    fireEvent.change(screen.getByLabelText("Status filter"), { target: { value: "inactive" } });
    fireEvent.change(screen.getByLabelText("Billing cycle filter"), { target: { value: "yearly" } });
    await waitFor(() => expect(masterAdmin.plans).toHaveBeenLastCalledWith({ q: "star", status: "inactive", billingCycle: "yearly" }));
  });

  test("creates a plan after validating", async () => {
    masterAdmin.plans.mockResolvedValue(catalogue([]));
    masterAdmin.createPlan.mockResolvedValue({ message: "Plan created" });
    render(<SubscriptionPlansPage />);
    expect(await screen.findByText(/no subscription plans yet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Create plan" }));
    expect(masterAdmin.createPlan).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Plan name"), { target: { value: "Growth" } });
    fireEvent.change(screen.getByLabelText("Plan amount (INR)"), { target: { value: "5999" } });
    fireEvent.change(screen.getByLabelText("Plan billing cycle"), { target: { value: "yearly" } });
    fireEvent.change(screen.getByLabelText("Plan maximum users"), { target: { value: "40" } });
    fireEvent.click(screen.getByLabelText("Internal messaging"));
    fireEvent.click(screen.getByRole("button", { name: "Create plan" }));
    await waitFor(() => expect(masterAdmin.createPlan).toHaveBeenCalledWith(expect.objectContaining({ name: "Growth", amount: 5999, billingCycle: "yearly", userLimit: 40, modules: ["messaging"], status: "active" })));
    expect(await screen.findByText("Plan created")).toBeInTheDocument();
  });

  test("edits a plan and asks before deactivating", async () => {
    masterAdmin.plans.mockResolvedValue(catalogue());
    masterAdmin.updatePlan.mockResolvedValue({ message: "Plan updated." });
    masterAdmin.setPlanStatus.mockResolvedValue({ message: "Plan deactivated." });
    render(<SubscriptionPlansPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Starter" }));
    expect(screen.getByText(/recorded price and limits will not change/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Plan amount (INR)"), { target: { value: "3499" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(masterAdmin.updatePlan).toHaveBeenCalledWith(1, expect.objectContaining({ amount: 3499, trialDays: 14 })));
    window.confirm = jest.fn(() => false);
    fireEvent.click(await screen.findByRole("button", { name: "Deactivate Starter" }));
    expect(masterAdmin.setPlanStatus).not.toHaveBeenCalled();
    window.confirm = jest.fn(() => true);
    fireEvent.click(screen.getByRole("button", { name: "Deactivate Starter" }));
    await waitFor(() => expect(masterAdmin.setPlanStatus).toHaveBeenCalledWith(1, "inactive"));
  });

  test("shows an error with retry", async () => {
    masterAdmin.plans.mockRejectedValueOnce({ response: { data: { message: "Server down" } } }).mockResolvedValue(catalogue());
    render(<SubscriptionPlansPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Server down");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByTestId("plan-row-1")).toBeInTheDocument();
  });
});

describe("company Subscription tab", () => {
  const setup = (d = details({ current: null, history: [] }), plans = [plan(), plan({ id: 2, name: "Retired", status: "inactive" })]) => {
    masterAdmin.plans.mockResolvedValue(catalogue(plans));
    masterAdmin.subscriptionDetails.mockResolvedValue(d);
    const reload = jest.fn();
    render(<SubscriptionTab company={company} reload={reload} setDirty={jest.fn()} />);
    return { reload };
  };

  test("offers only active plans, populates terms, and sends a negotiated price after confirmation", async () => {
    masterAdmin.assignPlan.mockResolvedValue({ message: "Subscription saved" });
    const { reload } = setup();
    const select = await screen.findByLabelText("Select Subscription Plan");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["— Choose a plan —", "Starter — ₹2,999 / month", "Custom Plan (negotiated terms)"]);
    fireEvent.change(select, { target: { value: "1" } });
    const summary = screen.getByTestId("plan-summary");
    expect(summary).toHaveTextContent("Monthly");
    expect(summary).toHaveTextContent("20,000 MB");
    expect(summary).toHaveTextContent("Internal messaging, Email support");
    expect(screen.getByLabelText("Start date")).toHaveValue(todayInput());
    expect(screen.getByLabelText("Expiry date")).toHaveValue(addMonthsInput(todayInput(), 1));
    fireEvent.click(screen.getByLabelText(/use a custom negotiated amount/i));
    fireEvent.change(screen.getByLabelText("Custom amount (INR)"), { target: { value: "2500" } });
    expect(summary).toHaveTextContent("Custom price");
    window.confirm = jest.fn(() => false);
    fireEvent.click(screen.getByRole("button", { name: "Assign plan" }));
    expect(window.confirm.mock.calls[0][0]).toMatch(/₹2,500.*standard price ₹2,999/);
    expect(masterAdmin.assignPlan).not.toHaveBeenCalled();
    window.confirm = jest.fn(() => true);
    fireEvent.click(screen.getByRole("button", { name: "Assign plan" }));
    await waitFor(() => expect(masterAdmin.assignPlan).toHaveBeenCalledWith("co-1", {
      planId: 1, customAmount: 2500, startDate: todayInput(), expiryDate: addMonthsInput(todayInput(), 1), isTrial: false, autoRenew: false, applyModules: false, notes: null,
    }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  test("a trial ends after the plan's trial duration", async () => {
    setup();
    fireEvent.change(await screen.findByLabelText("Select Subscription Plan"), { target: { value: "1" } });
    fireEvent.click(screen.getByLabelText("Start as a trial"));
    expect(screen.getByLabelText("Trial end date")).toHaveValue(addDaysInput(todayInput(), 13));
    expect(screen.getByLabelText("Expiry date")).toHaveValue(addDaysInput(todayInput(), 13));
  });

  test("custom plan sends its own terms without a customAmount", async () => {
    masterAdmin.assignPlan.mockResolvedValue({});
    setup();
    fireEvent.change(await screen.findByLabelText("Select Subscription Plan"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("Plan amount (INR)"), { target: { value: "41000" } });
    fireEvent.change(screen.getByLabelText("Plan billing cycle"), { target: { value: "yearly" } });
    expect(screen.getByLabelText("Expiry date")).toHaveValue(addMonthsInput(todayInput(), 12));
    fireEvent.click(screen.getByRole("button", { name: "Assign plan" }));
    await waitFor(() => expect(masterAdmin.assignPlan).toHaveBeenCalled());
    const body = masterAdmin.assignPlan.mock.calls[0][1];
    expect(body.custom).toEqual(expect.objectContaining({ name: "Custom Plan", amount: 41000, billingCycle: "yearly" }));
    expect(body).not.toHaveProperty("planId");
    expect(body).not.toHaveProperty("customAmount");
  });

  test("the current plan stays selectable when inactive and keeps its agreed price", async () => {
    setup(details(), [plan({ status: "inactive", amount: 3999 })]);
    await screen.findByTestId("current-subscription");
    const select = screen.getByLabelText("Select Subscription Plan");
    expect(select).toHaveTextContent("inactive, current plan");
    fireEvent.change(select, { target: { value: "1" } });
    expect(screen.getByLabelText("Custom amount (INR)")).toHaveValue("2500");
    expect(screen.getByLabelText("Expiry date")).toHaveValue("2027-01-01");
  });

  test("renewal asks for confirmation", async () => {
    masterAdmin.renew.mockResolvedValue({});
    setup(details());
    await screen.findByTestId("current-subscription");
    window.confirm = jest.fn(() => false);
    fireEvent.click(screen.getByRole("button", { name: "Renew +3 mo" }));
    expect(masterAdmin.renew).not.toHaveBeenCalled();
    window.confirm = jest.fn(() => true);
    fireEvent.click(screen.getByRole("button", { name: "Renew +3 mo" }));
    await waitFor(() => expect(masterAdmin.renew).toHaveBeenCalledWith("co-1", 3));
  });

  test("history shows standard vs custom price; payments are recorded and moved through statuses", async () => {
    masterAdmin.recordPayment.mockResolvedValue({});
    masterAdmin.updatePaymentStatus.mockResolvedValue({});
    setup(details({ payments: [{ id: 9, amount: 2500, currency: "INR", paymentDate: "2026-11-01", method: "upi", reference: "R1", status: "pending", receipt: null }] }));
    const row = await screen.findByTestId("history-row-5");
    expect(row).toHaveTextContent("Standard ₹2,999");
    const payment = screen.getByTestId("payment-row-9");
    expect(payment).toHaveTextContent("Pending");
    fireEvent.click(within(payment).getByRole("button", { name: "Mark paid" }));
    await waitFor(() => expect(masterAdmin.updatePaymentStatus).toHaveBeenCalledWith("co-1", 9, { status: "paid", paymentDate: todayInput() }));
    fireEvent.click(await screen.findByRole("button", { name: "Record payment" }));
    fireEvent.change(screen.getByLabelText("Amount (INR)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save payment" }));
    expect(masterAdmin.recordPayment).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Amount (INR)"), { target: { value: "2500" } });
    fireEvent.change(screen.getByLabelText("Transaction / reference ID"), { target: { value: " UTR-2 " } });
    fireEvent.click(screen.getByRole("button", { name: "Save payment" }));
    await waitFor(() => expect(masterAdmin.recordPayment).toHaveBeenCalledWith("co-1", expect.objectContaining({ amount: 2500, reference: "UTR-2", status: "paid", method: "bank_transfer" })));
  });
});

describe("Company Admin billing page", () => {
  const data = {
    company: { name: "Alpha" },
    current: { planName: "Starter", planDescription: "Small teams", status: "expiring_soon", daysRemaining: 7, billingCycle: "monthly", amount: 2500, isCustomPrice: true, currency: "INR", startDate: "2026-11-01", expiryDate: "2026-12-05", userLimit: 15, employeeLimit: 12, storageLimitMb: 2000, moduleDetails: [{ key: "messaging", label: "Internal messaging" }], highlights: ["Email support"], autoRenew: false },
    previous: [{ id: 1, planName: "Legacy", amount: null, billingCycle: "monthly", periodStart: "2026-01-01", expiryDate: "2026-02-01", outcome: "expired", endedAt: "2026-02-03" }],
    payments: [
      { id: 3, amount: 2500, currency: "INR", paymentDate: "2026-11-02", method: "bank_transfer", reference: "UTR-1", status: "paid", receipt: { name: "r.pdf" } },
      { id: 4, amount: 10, currency: "INR", paymentDate: "2026-11-03", method: "cash", reference: null, status: "failed", receipt: null },
    ],
  };

  test("shows the plan, previous plans and payments, read only, and downloads receipts", async () => {
    billing.subscription.mockResolvedValue(data);
    billing.receipt.mockResolvedValue(new Blob(["x"]));
    global.URL.createObjectURL = jest.fn(() => "blob:x");
    global.URL.revokeObjectURL = jest.fn();
    render(<SubscriptionBilling />);
    const card = await screen.findByTestId("billing-current");
    ["Starter", "Expiring soon", "Negotiated price", "7 days remaining", "₹2,500 / month", "Small teams", "Internal messaging", "Email support", "2,000 MB", "5 Dec 2026"]
      .forEach((t) => expect(card).toHaveTextContent(t));
    expect(screen.getByText("Legacy")).toBeInTheDocument();
    expect(screen.getByText("Price not recorded")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Not available")).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Download"]); // nothing editable
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /download r\.pdf/i }));
    await waitFor(() => expect(billing.receipt).toHaveBeenCalledWith(3));
  });

  test("loading, empty and error states", async () => {
    billing.subscription.mockRejectedValueOnce({ response: { data: { message: "Nope" } } }).mockResolvedValue({ current: null, previous: [], payments: [] });
    render(<SubscriptionBilling />);
    expect(screen.getByRole("status", { name: /loading subscription/i })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Nope");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/no subscription has been set up/i)).toBeInTheDocument();
    expect(screen.getByText(/no payments have been recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/no previous subscription periods/i)).toBeInTheDocument();
  });
});
