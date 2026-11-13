import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import ScheduleMeeting, { inRange, reminderLabel } from "./ScheduleMeeting";
import { SearchContext } from "../../context/SearchContext";
import * as api from "../../services/apiService";

jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }));
jest.mock("sweetalert2", () => ({ fire: jest.fn().mockResolvedValue({ isConfirmed: true }) }));
jest.mock("../../services/apiService", () => ({
  fetchMeetings: jest.fn(),
  createMeetingAPI: jest.fn(),
  updateMeeting: jest.fn(),
  updateMeetingStatus: jest.fn(),
  deleteMeeting: jest.fn(),
}));
jest.mock("./FollowUpForm", () => () => null);
jest.mock("./FollowUpHistory", () => () => null);

const mockApi = {};
jest.mock("../../context/ApiContext", () => ({ useApi: () => mockApi }));

const inHours = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();

const meeting = (id, name, over = {}) => ({
  id,
  clientName: name,
  clientEmail: `${name.toLowerCase()}@x.com`,
  clientPhone: `98000000${id}`,
  reasonForFollowup: `Purpose ${name}`,
  startTime: inHours(2 + id),
  endTime: null,
  status: "Scheduled",
  reminderMinutes: 10,
  notes: null,
  fresh_lead_id: id * 10,
  clientLead: { id, status: "Meeting", name },
  ...over,
});

const renderPage = (search = "") =>
  render(
    <SearchContext.Provider value={{ searchQuery: search }}>
      <ScheduleMeeting />
    </SearchContext.Provider>
  );

beforeEach(() => {
  Object.assign(mockApi, {
    fetchFollowUpHistoriesAPI: jest.fn().mockResolvedValue([]),
    updateFollowUp: jest.fn(),
    createFollowUp: jest.fn(),
    createFollowUpHistoryAPI: jest.fn(),
    fetchFreshLeadsAPI: jest.fn().mockResolvedValue([
      { id: 70, name: "Zed Lead", email: "zed@x.com", phone: "9111111111", clientLead: { status: "Assigned" } },
      { id: 71, name: "Closed Lead", email: "c@x.com", phone: "9222222222", clientLead: { status: "Closed" } },
    ]),
    refreshMeetings: jest.fn().mockResolvedValue([]),
    createConvertedClientAPI: jest.fn(),
    createCloseLeadAPI: jest.fn(),
    getAllFollowUps: jest.fn(),
    updateClientLead: jest.fn(),
  });
  api.fetchMeetings.mockResolvedValue([
    meeting(1, "Alice"),
    meeting(2, "Bob", { status: "Completed" }),
    meeting(3, "Dan", { status: "Scheduled", startTime: new Date(Date.now() - 3600 * 1000).toISOString() }), // past, no outcome yet
  ]);
  api.updateMeetingStatus.mockResolvedValue({});
  api.createMeetingAPI.mockResolvedValue({});
  api.deleteMeeting.mockResolvedValue({});
});

describe("helpers", () => {
  test("inRange handles today / upcoming / past", () => {
    const now = new Date(2026, 5, 10, 12, 0);
    expect(inRange(new Date(2026, 5, 10, 18, 0), "today", now)).toBe(true);
    expect(inRange(new Date(2026, 5, 11, 0, 5), "today", now)).toBe(false);
    expect(inRange(new Date(2026, 5, 10, 13, 0), "upcoming", now)).toBe(true);
    expect(inRange(new Date(2026, 5, 10, 11, 0), "past", now)).toBe(true);
    expect(inRange(new Date(2026, 5, 8, 11, 0), "week", now)).toBe(true); // Monday-based week of Wed 10 Jun
    expect(inRange(new Date(2026, 5, 15, 11, 0), "week", now)).toBe(false);
  });

  test("reminderLabel", () => {
    expect(reminderLabel(0)).toBe("No reminder");
    expect(reminderLabel(30)).toBe("30 minutes before");
    expect(reminderLabel(45)).toBe("45 min before");
  });
});

describe("ScheduleMeeting", () => {
  test("shows the executive's real meetings from the backend with status and reminder, plus stats", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "All" }));
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Needs outcome")).toBeInTheDocument(); // Dan: past and still Scheduled
    expect(screen.getAllByText("10 minutes before").length).toBeGreaterThan(0);
    expect(api.fetchMeetings).toHaveBeenCalled();
    expect(screen.getByText("Needs an outcome").nextSibling).toHaveTextContent("1");
  });

  test("marking a meeting completed calls the status API and reloads", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "All" }));
    const card = (await screen.findByText("Alice")).closest("li");
    fireEvent.click(within(card).getByRole("button", { name: "Mark completed" }));
    await waitFor(() => expect(api.updateMeetingStatus).toHaveBeenCalledWith(1, "Completed"));
    await waitFor(() => expect(api.fetchMeetings.mock.calls.length).toBeGreaterThan(1));
    expect(mockApi.refreshMeetings).toHaveBeenCalled();
  });

  test("scheduling a new meeting validates, then posts to the backend with the chosen lead and reminder", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "+ New meeting" }));
    const dialog = await screen.findByRole("dialog");

    // Closed leads are not offered.
    expect(within(dialog).queryByText(/Closed Lead/)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule meeting" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Choose the lead");

    fireEvent.change(within(dialog).getByLabelText("Lead"), { target: { value: "70" } });
    expect(within(dialog).getByLabelText("Client name")).toHaveValue("Zed Lead");
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    fireEvent.change(within(dialog).getByLabelText("Date"), {
      target: { value: `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}` },
    });
    fireEvent.change(within(dialog).getByLabelText("Start time"), { target: { value: "11:00" } });
    fireEvent.change(within(dialog).getByLabelText("Reminder"), { target: { value: "30" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule meeting" }));

    await waitFor(() => expect(api.createMeetingAPI).toHaveBeenCalledTimes(1));
    expect(api.createMeetingAPI).toHaveBeenCalledWith(
      expect.objectContaining({ fresh_lead_id: 70, clientName: "Zed Lead", clientEmail: "zed@x.com", reminderMinutes: 30, endTime: null })
    );
  });

  test("a rejected save (e.g. a time clash) keeps the dialog open and shows the server message", async () => {
    api.createMeetingAPI.mockRejectedValueOnce({ response: { data: { message: "You already have a meeting with Alice at that time." } } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "+ New meeting" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Lead"), { target: { value: "70" } });
    const t = new Date(Date.now() + 24 * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    fireEvent.change(within(dialog).getByLabelText("Date"), { target: { value: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}` } });
    fireEvent.change(within(dialog).getByLabelText("Start time"), { target: { value: "11:00" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schedule meeting" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("You already have a meeting with Alice");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("shows an empty state with a call to action when there are no meetings", async () => {
    api.fetchMeetings.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("No meetings here")).toBeInTheDocument();
  });

  test("shows a retryable error when loading fails", async () => {
    api.fetchMeetings.mockRejectedValueOnce({ response: { data: { error: "x" } }, message: "Network Error" });
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Network Error");
  });
});
