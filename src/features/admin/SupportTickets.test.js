import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import SupportTickets from "./SupportTickets";
import { companySupport, formatCountdown } from "../../services/supportService";
import { validateAttachment } from "../support/TicketThread";

jest.mock("./SidebarToggle", () => () => null);
jest.mock("../modal/alert", () => ({ Alert: () => null, soundManager: { playSound: () => {} } }));
jest.mock("../../services/supportService", () => ({
  ...jest.requireActual("../../services/supportService"),
  companySupport: { form: jest.fn(), list: jest.fn(), create: jest.fn(), get: jest.fn(), reply: jest.fn(), download: jest.fn() },
}));

const ctx = { adminName: "Asha", companyName: "Acme", email: "a@acme.com", contactNumber: "", categories: ["Login", "Other"], cooldownSeconds: 600 };

test("formatCountdown renders mm:ss", () => {
  expect(formatCountdown(0)).toBe("00:00");
  expect(formatCountdown(599.2)).toBe("10:00");
  expect(formatCountdown(65)).toBe("01:05");
});

test("validateAttachment enforces type and 5MB size", () => {
  expect(validateAttachment(null)).toBe("");
  expect(validateAttachment({ type: "image/png", size: 100 })).toBe("");
  expect(validateAttachment({ type: "application/x-msdownload", size: 100 })).toMatch(/JPEG, PNG, WEBP or PDF/);
  expect(validateAttachment({ type: "application/pdf", size: 6 * 1024 * 1024 })).toMatch(/5MB/);
});

test("auto-fills admin details, lists history with latest reply, and disables submit during cooldown", async () => {
  companySupport.form.mockResolvedValue({ ...ctx, retryAfterSeconds: 125 });
  companySupport.list.mockResolvedValue({
    tickets: [
      { id: 1, ticketNumber: "TKT-000001", subject: "Login broken", category: "Login", createdAt: "2026-11-01T10:00:00Z", status: "Replied", unread: true, latestReply: { body: "Try resetting", senderName: "master" } },
    ],
  });
  render(<SupportTickets />);
  await waitFor(() => expect(screen.getByDisplayValue("Asha")).toBeInTheDocument());
  expect(screen.getByDisplayValue("Acme")).toHaveAttribute("readonly");
  expect(screen.getByText("TKT-000001")).toBeInTheDocument();
  expect(screen.getByText("Try resetting")).toBeInTheDocument();
  expect(screen.getByText("New reply")).toBeInTheDocument();
  expect(screen.getByText("02:05")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /submit query/i })).toBeDisabled();
});
