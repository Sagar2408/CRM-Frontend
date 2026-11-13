import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import ExecutiveConvertedLeads, { CONVERTED_BANNER } from "./ExecutiveConvertedLeads";
import { SearchContext } from "../../context/SearchContext";

const mockApi = {};
jest.mock("../../context/ApiContext", () => ({ useApi: () => mockApi }));
jest.mock("../../hooks/useCopyNotification", () => () => {});

const mk = (i, over = {}) => ({
  id: i,
  fresh_lead_id: i * 10,
  name: `Client ${i}`,
  phone: `90000000${String(i).padStart(2, "0")}`,
  email: `c${i}@x.com`,
  status: "Converted",
  updatedAt: `2026-06-${String(i).padStart(2, "0")}T10:00:00.000Z`,
  ...over,
});

const renderPage = (searchQuery = "", setSearchQuery = jest.fn()) =>
  render(
    <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      <ExecutiveConvertedLeads />
    </SearchContext.Provider>
  );

beforeEach(() => {
  Object.assign(mockApi, {
    convertedClients: [mk(1), mk(2), mk(3, { status: "Pending" })],
    convertedClientsLoading: false,
    fetchConvertedClientsAPI: jest.fn().mockResolvedValue([]),
    fetchNotifications: jest.fn(),
    createCopyNotification: jest.fn(),
    fetchFollowUpHistoriesAPI: jest.fn().mockResolvedValue([
      { fresh_lead_id: 20, follow_up_date: "2026-06-05", follow_up_time: "10:00:00", reason_for_follow_up: "Docs received", connect_via: "Call", follow_up_type: "converted", interaction_rating: "Hot" },
      { fresh_lead_id: 999, follow_up_date: "2026-06-01", follow_up_time: "10:00:00", reason_for_follow_up: "someone else" },
    ]),
    setConvertedCustomerCount: jest.fn(),
  });
});

test("shows the thank-you banner with the exact text", () => {
  renderPage();
  expect(screen.getByRole("status")).toHaveTextContent(CONVERTED_BANNER);
  expect(CONVERTED_BANNER).toBe(
    "Thank you for converting this lead! All leads converted by you are now managed by the Admin and Process Person teams. No further action is required from your side."
  );
});

test("lists only converted leads, newest first, with relevant details and a total", () => {
  renderPage();
  const rows = screen.getAllByRole("row").slice(1);
  expect(rows).toHaveLength(2); // the Pending record is not shown
  expect(within(rows[0]).getByText("Client 2")).toBeInTheDocument();
  expect(within(rows[1]).getByText("c1@x.com")).toBeInTheDocument();
  expect(screen.getByLabelText("Total converted leads")).toHaveTextContent("Total: 2");
  expect(mockApi.fetchConvertedClientsAPI).toHaveBeenCalled();
});

test("is read-only: no invoice, export, checkbox, edit or delete controls", () => {
  const { container } = renderPage();
  expect(screen.queryByText(/invoice/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/export/i)).not.toBeInTheDocument();
  expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  expect(screen.queryByRole("button", { name: /edit|delete|update|save/i })).not.toBeInTheDocument();
  // the only per-row action is Follow History
  expect(screen.getAllByRole("button").map((b) => b.textContent.trim())).toEqual(expect.not.arrayContaining(["Generate Invoice"]));
  expect(screen.getAllByRole("button", { name: /Follow History/ })).toHaveLength(2);
});

test("search (header text) filters by name, e-mail or phone and can be cleared", () => {
  const setSearchQuery = jest.fn();
  const { rerender } = renderPage("client 2", setSearchQuery);
  expect(screen.getAllByRole("row").slice(1)).toHaveLength(1);
  expect(screen.getByText(/Showing results for/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(setSearchQuery).toHaveBeenCalledWith("");
  rerender(
    <SearchContext.Provider value={{ searchQuery: "9000000001", setSearchQuery }}>
      <ExecutiveConvertedLeads />
    </SearchContext.Provider>
  );
  expect(screen.getAllByRole("row").slice(1)).toHaveLength(1);
  rerender(
    <SearchContext.Provider value={{ searchQuery: "nomatch", setSearchQuery }}>
      <ExecutiveConvertedLeads />
    </SearchContext.Provider>
  );
  expect(screen.getByText("No converted leads match your search.")).toBeInTheDocument();
});

test("paginates 10 per page", () => {
  mockApi.convertedClients = Array.from({ length: 23 }, (_, i) => mk(i + 1, { updatedAt: `2026-06-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z` }));
  renderPage();
  expect(screen.getAllByRole("row").slice(1)).toHaveLength(10);
  expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
  expect(screen.getAllByRole("row").slice(1)).toHaveLength(3);
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
});

test("Follow History opens only that lead's history in a dialog", async () => {
  renderPage();
  const row = screen.getByText("Client 2").closest("tr");
  fireEvent.click(within(row).getByRole("button", { name: /Follow History/ }));
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(within(dialog).getByText("Docs received")).toBeInTheDocument());
  expect(within(dialog).queryByText("someone else")).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("empty state", () => {
  mockApi.convertedClients = [];
  renderPage();
  expect(screen.getByText("No converted leads yet.")).toBeInTheDocument();
});
