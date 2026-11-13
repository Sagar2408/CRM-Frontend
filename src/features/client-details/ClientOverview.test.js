import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ClientOverview from "./ClientOverview";

const mockNavigate = jest.fn();
let mockState;
jest.mock("react-router-dom", () => ({
  useParams: () => ({ clientId: "55" }),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: mockState }),
}));
jest.mock("sweetalert2", () => ({ fire: jest.fn().mockResolvedValue({}) }));
jest.mock("../../hooks/useCopyNotification", () => () => {});

const mockApi = {};
jest.mock("../../context/ApiContext", () => ({ useApi: () => mockApi }));
const Swal = require("sweetalert2");

const lead = { id: 9, freshLeadId: 9, name: "Priya Shah", email: "priya@x.com", phone: "9000000001", country: "Canada", education: "MBA" };

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockReset();
  Swal.fire.mockClear();
  mockState = { client: lead, createFollowUp: true, followUpHistory: [] };
  Object.assign(mockApi, {
    updateFreshLeadFollowUp: jest.fn().mockResolvedValue({}),
    createFollowUp: jest.fn().mockResolvedValue({ data: { id: 77 } }),
    followUpLoading: false,
    createMeetingAPI: jest.fn().mockResolvedValue({}),
    fetchFreshLeads: jest.fn().mockResolvedValue([]),
    executiveInfo: { id: 5 },
    fetchNotifications: jest.fn(),
    createCopyNotification: jest.fn(),
    createFollowUpHistoryAPI: jest.fn().mockResolvedValue({}),
    createConvertedClientAPI: jest.fn().mockResolvedValue({}),
    createCloseLeadAPI: jest.fn().mockResolvedValue({}),
    updateClientLead: jest.fn().mockResolvedValue({}),
    scheduleFollowUpNotificationAPI: jest.fn().mockResolvedValue({}),
  });
});
afterEach(() => jest.useRealTimers());

const fill = () => {
  fireEvent.click(screen.getByLabelText("Call", { selector: "input" }));
  fireEvent.click(screen.getByLabelText("Interested"));
  fireEvent.click(screen.getByLabelText("Hot"));
  fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Wants PR pathway" } });
};

test("shows the lead's details, history and the interaction options; no email-template UI", () => {
  mockState = {
    ...mockState,
    followUpHistory: [{ id: 1, connect_via: "Call", interaction_rating: "Warm", reason_for_follow_up: "Earlier call", follow_up_date: "2026-06-01", follow_up_time: "10:00:00" }],
  };
  render(<ClientOverview />);
  expect(screen.getByRole("heading", { name: /Add follow-up/ })).toHaveTextContent("Priya Shah");
  expect(screen.getByLabelText("Education")).toHaveValue("MBA");
  expect(screen.getByText("Earlier call")).toBeInTheDocument();
  expect(screen.getByRole("radiogroup", { name: "Follow-up status" })).toBeInTheDocument();
  expect(screen.queryByText(/template/i)).not.toBeInTheDocument();
});

test("Create follow-up stays disabled and says what is still needed", () => {
  render(<ClientOverview />);
  const create = screen.getByRole("button", { name: "Create follow-up" });
  expect(create).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Still needed: how you connected, the status, a rating, notes");
  fill();
  expect(screen.getByRole("status")).toHaveTextContent("Ready to save");
  expect(create).toBeEnabled();
});

test("creates the follow-up and its history with the real payload, then returns to Fresh Leads", async () => {
  render(<ClientOverview />);
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Create follow-up" }));
  await waitFor(() => expect(mockApi.createFollowUp).toHaveBeenCalledTimes(1));
  expect(mockApi.createFollowUp).toHaveBeenCalledWith(
    expect.objectContaining({ connect_via: "Call", follow_up_type: "interested", interaction_rating: "Hot", reason_for_follow_up: "Wants PR pathway", fresh_lead_id: 9 })
  );
  await waitFor(() => expect(mockApi.createFollowUpHistoryAPI).toHaveBeenCalledWith(expect.objectContaining({ follow_up_id: 77, fresh_lead_id: 9 })));
  jest.advanceTimersByTime(2500);
  expect(mockNavigate).toHaveBeenCalledWith("/executive/freshlead");
});

test("a double click cannot create two follow-ups", async () => {
  let release;
  mockApi.createFollowUp.mockImplementation(() => new Promise((r) => (release = () => r({ data: { id: 1 } }))));
  render(<ClientOverview />);
  fill();
  const create = screen.getByRole("button", { name: "Create follow-up" });
  fireEvent.click(create);
  fireEvent.click(create);
  expect(mockApi.createFollowUp).toHaveBeenCalledTimes(1);
  release();
  await waitFor(() => expect(mockApi.createFollowUpHistoryAPI).toHaveBeenCalledTimes(1));
});

test("an appointment offers Create meeting, posts the meeting, and shows the server's reason when it is refused", async () => {
  render(<ClientOverview />);
  fireEvent.click(screen.getByLabelText("Call", { selector: "input" }));
  fireEvent.click(screen.getByLabelText("Appointment"));
  fireEvent.click(screen.getByLabelText("Warm"));
  fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Book assessment" } });
  const tomorrow = new Date(Date.now() + 86400000);
  const pad = (n) => String(n).padStart(2, "0");
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}` } });
  fireEvent.change(screen.getByLabelText("Time", { selector: "input" }), { target: { value: "11:30" } });

  mockApi.createMeetingAPI.mockRejectedValueOnce({ response: { data: { message: "You already have a meeting with Ravi at that time." } } });
  fireEvent.click(screen.getByRole("button", { name: "Create meeting" }));
  await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: "error", text: "You already have a meeting with Ravi at that time." })));
  expect(mockApi.createMeetingAPI).toHaveBeenCalledWith(expect.objectContaining({ clientName: "Priya Shah", fresh_lead_id: 9, reasonForFollowup: "Book assessment" }));
});

test("a past appointment time is blocked with a clear message", () => {
  render(<ClientOverview />);
  fireEvent.click(screen.getByLabelText("Appointment"));
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2020-01-01" } });
  expect(screen.getByRole("alert")).toHaveTextContent("future date or time");
});

test("saving client details calls the lead update with the edited values", async () => {
  render(<ClientOverview />);
  fireEvent.change(screen.getByLabelText("Education"), { target: { value: "PhD" } });
  fireEvent.click(screen.getByRole("button", { name: "Save client details" }));
  await waitFor(() => expect(mockApi.updateClientLead).toHaveBeenCalledWith("55", expect.objectContaining({ education: "PhD", name: "Priya Shah" })));
});

test.each([
  ["Interested", null],
  ["Appointment", "Create meeting"],
  ["No response", null],
  ["Converted", "Convert lead"],
  ["Not interested", null],
  ["Closed", null],
])("choosing %s keeps every section on the page and shows the right action", (label, action) => {
  render(<ClientOverview />);
  fireEvent.click(screen.getByLabelText(label === "Closed" ? "Close" : label));
  for (const name of ["Notes", "Date", "Remind me at"]) expect(screen.getByLabelText(name)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Lead details" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Follow-up history" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create follow-up" })).toBeInTheDocument();
  if (action) expect(screen.getByRole("button", { name: action })).toBeInTheDocument();
  // the radio chips stay inside their label (a stray absolutely-positioned input caused the blank-page scroll bug)
  expect(screen.getByRole("radiogroup", { name: "Follow-up status" }).querySelectorAll("label.fue__choice input")).toHaveLength(6);
});
