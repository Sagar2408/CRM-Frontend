import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import LeadSearch, { targetFor } from "./LeadSearch";
import { SearchContext } from "../../context/SearchContext";
import * as api from "../../services/apiService";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));
jest.mock("../../services/apiService", () => ({ searchLeads: jest.fn() }));

const setSearchQuery = jest.fn();
const fresh = { freshLeadId: 11, clientLeadId: 5, followUpId: null, name: "Alice Johnson", email: "alice@acme.com", phone: "+91 98765 43210", status: "New", stage: "fresh", client: { education: "MBA", country: "Canada" } };
const follow = { freshLeadId: 12, clientLeadId: 6, followUpId: 40, name: "Bob Stone", email: "bob@x.com", phone: "9000000002", status: "Follow-Up", stage: "followup", client: { country: "UK" } };
const closed = { freshLeadId: 13, clientLeadId: 7, followUpId: null, name: "Carol Closed", email: "c@x.com", phone: "9000000003", status: "Closed", stage: "closed", client: {} };

const setup = () =>
  render(
    <SearchContext.Provider value={{ setSearchQuery }}>
      <LeadSearch />
    </SearchContext.Provider>
  );

const type = async (text) => {
  fireEvent.change(screen.getByRole("combobox", { name: "Search leads" }), { target: { value: text } });
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockReset();
  setSearchQuery.mockReset();
  api.searchLeads.mockResolvedValue([fresh, follow, closed]);
});
afterEach(() => jest.useRealTimers());

test("waits for 2 characters and debounces: one request for a burst of typing", async () => {
  setup();
  await type("a");
  expect(api.searchLeads).not.toHaveBeenCalled();
  const input = screen.getByRole("combobox", { name: "Search leads" });
  fireEvent.change(input, { target: { value: "al" } });
  fireEvent.change(input, { target: { value: "ali" } });
  fireEvent.change(input, { target: { value: "alic" } });
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  expect(api.searchLeads).toHaveBeenCalledTimes(1);
  expect(api.searchLeads.mock.calls[0][0]).toBe("alic");
});

test("shows a loading state, then results with name, contact and stage", async () => {
  let resolve;
  api.searchLeads.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
  setup();
  await type("alice");
  expect(screen.getByText("Searching...")).toBeInTheDocument();
  await act(async () => resolve([fresh, follow]));
  const list = screen.getByRole("listbox", { name: "Matching leads" });
  expect(list).toHaveTextContent("Alice Johnson");
  expect(list).toHaveTextContent("+91 98765 43210 · alice@acme.com");
  expect(list).toHaveTextContent("Fresh");
  expect(list).toHaveTextContent("Follow-up");
});

test("empty and error states", async () => {
  api.searchLeads.mockResolvedValueOnce([]);
  setup();
  await type("zzzz");
  expect(screen.getByText(/No leads match/)).toBeInTheDocument();
  api.searchLeads.mockRejectedValueOnce({ response: { data: { error: "Search failed. Please try again." } } });
  await type("zzzzz");
  expect(screen.getByRole("alert")).toHaveTextContent("Search failed");
});

test("a fresh lead opens the Add follow-up page with its details", async () => {
  setup();
  await type("alice");
  fireEvent.click(screen.getByRole("button", { name: /Alice Johnson/ }));
  expect(mockNavigate).toHaveBeenCalledWith(
    "/executive/clients/5",
    expect.objectContaining({ state: expect.objectContaining({ createFollowUp: true, client: expect.objectContaining({ id: 5, freshLeadId: 11, name: "Alice Johnson", education: "MBA" }) }) })
  );
  expect(screen.getByRole("combobox", { name: "Search leads" })).toHaveValue(""); // cleared
});

test("a follow-up lead opens the follow-up editor", async () => {
  setup();
  await type("bob");
  fireEvent.click(screen.getByRole("button", { name: /Bob Stone/ }));
  expect(mockNavigate).toHaveBeenCalledWith(
    "/executive/clients/40/details",
    expect.objectContaining({ state: expect.objectContaining({ client: expect.objectContaining({ followUpId: 40, fresh_lead_id: 12 }) }) })
  );
});

test("a closed lead opens its list filtered to that client", async () => {
  setup();
  await type("carol");
  fireEvent.click(screen.getByRole("button", { name: /Carol Closed/ }));
  expect(mockNavigate).toHaveBeenCalledWith("/executive/close-leads", undefined);
  expect(setSearchQuery).toHaveBeenLastCalledWith("Carol Closed");
});

test("keyboard: arrows move, Enter opens, Escape closes", async () => {
  setup();
  await type("a");
  await type("al");
  const input = screen.getByRole("combobox", { name: "Search leads" });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(mockNavigate).toHaveBeenCalledWith("/executive/clients/40/details", expect.anything());
  await type("al");
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

test("clear button resets the box and the page filter", async () => {
  setup();
  await type("alice");
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  expect(screen.getByRole("combobox", { name: "Search leads" })).toHaveValue("");
  expect(setSearchQuery).toHaveBeenLastCalledWith("");
});

test("targetFor: a follow-up lead without a follow-up record falls back to Meetings", () => {
  expect(targetFor({ stage: "followup", followUpId: null }).path).toBe("/executive/schedule");
  expect(targetFor({ stage: "converted", name: "Z" })).toMatchObject({ path: "/executive/customer", filter: "Z" });
  waitFor;
});
