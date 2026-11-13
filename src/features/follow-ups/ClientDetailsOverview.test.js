import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ClientDetailsOverview from "./ClientDetailsOverview";

let mockState;
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn(), useLocation: () => ({ state: mockState }) }));
jest.mock("sweetalert2", () => ({ fire: jest.fn().mockResolvedValue({}) }));
jest.mock("../../hooks/useCopyNotification", () => () => {});
const mockApi = {};
jest.mock("../../context/ApiContext", () => ({ useApi: () => mockApi }));

beforeEach(() => {
  mockState = { client: { id: 3, followUpId: 3, fresh_lead_id: 9, name: "Priya", email: "p@x.com" } };
  Object.assign(mockApi, {
    fetchFollowUpHistoriesAPI: jest.fn().mockResolvedValue([]),
    updateFollowUp: jest.fn(),
    createConvertedClientAPI: jest.fn(),
    createCloseLeadAPI: jest.fn(),
    createMeetingAPI: jest.fn(),
    fetchFreshLeadsAPI: jest.fn(),
    fetchMeetings: jest.fn(),
    refreshMeetings: jest.fn(),
    followUpLoading: false,
    createFollowUpHistoryAPI: jest.fn(),
    executiveInfo: { id: 1 },
    fetchNotifications: jest.fn(),
    createCopyNotification: jest.fn(),
    scheduleFollowUpNotificationAPI: jest.fn(),
  });
});

test.each([
  ["Interested", null],
  ["Appointment", "Create meeting"],
  ["No response", null],
  ["Converted", "Create converted"],
  ["Not interested", null],
  ["Closed", "Create close"],
])("choosing %s keeps the whole editor visible and shows the right extra action", async (label, action) => {
  render(<ClientDetailsOverview />);
  await waitFor(() => expect(mockApi.fetchFollowUpHistoriesAPI).toHaveBeenCalled());
  fireEvent.click(screen.getByLabelText(label));
  for (const name of ["Notes", "Date", "Time", "Reminder time"]) expect(screen.getAllByLabelText(name).length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Lead details" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Update follow-up" })).toBeInTheDocument();
  if (action) expect(screen.getByRole("button", { name: action })).toBeInTheDocument();
});
