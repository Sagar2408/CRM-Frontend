import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import FollowUpWorkspace, { relativeDay, toDateTime } from "./FollowUpWorkspace";
import { SearchContext } from "../../context/SearchContext";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
}));

const mockApi = {};
jest.mock("../../context/ApiContext", () => ({ useApi: () => mockApi }));

const row = (id, name, over = {}) => ({
  id,
  fresh_lead_id: id * 10,
  freshLead: { id: id * 10, name, phone: `90000000${id}`, email: `${name.toLowerCase()}@x.com` },
  clientLeadStatus: "Follow-Up",
  follow_up_type: "interested",
  interaction_rating: "Hot",
  connect_via: "Call",
  reason_for_follow_up: `Notes for ${name}`,
  follow_up_date: "2026-06-12",
  follow_up_time: "10:30:00",
  education: "MBA",
  country: "Canada",
  createdAt: "2026-06-10T08:00:00.000Z",
  updatedAt: "2026-06-10T08:00:00.000Z",
  ...over,
});

const histories = [
  { id: 1, fresh_lead_id: 10, follow_up_type: "interested", connect_via: "Call", interaction_rating: "Hot", reason_for_follow_up: "Second call went well", follow_up_date: "2026-06-12", follow_up_time: "10:30:00", createdAt: "2026-06-10T08:00:00.000Z" },
  { id: 2, fresh_lead_id: 10, follow_up_type: "no response", connect_via: "Email", interaction_rating: "Warm", reason_for_follow_up: "Sent brochure", follow_up_date: "2026-06-08", follow_up_time: "09:00:00", createdAt: "2026-06-08T08:00:00.000Z" },
];

const renderPage = (search = "") =>
  render(
    <SearchContext.Provider value={{ searchQuery: search, setActivePage: jest.fn() }}>
      <FollowUpWorkspace />
    </SearchContext.Provider>
  );

beforeEach(() => {
  mockNavigate.mockReset();
  mockApi.followUps = {
    data: [
      row(1, "Alice"),
      row(2, "Bob", { follow_up_type: "not interested", interaction_rating: "Cold", follow_up_date: "2026-06-09" }),
      row(3, "Carol", { clientLeadStatus: "Closed" }), // not in the follow-up stage: hidden
    ],
  };
  mockApi.followUpLoading = false;
  mockApi.getAllFollowUps = jest.fn().mockResolvedValue(mockApi.followUps);
  mockApi.fetchFollowUpHistoriesAPI = jest.fn().mockResolvedValue(histories);
});

describe("date helpers", () => {
  test("toDateTime combines a date-only value and a time without timezone drift", () => {
    const d = toDateTime("2026-06-12", "10:30:00");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 5, 12, 10, 30]);
    expect(toDateTime(null, "10:00")).toBeNull();
  });

  test("relativeDay labels", () => {
    const now = new Date(2026, 5, 10, 12, 0);
    expect(relativeDay(new Date(2026, 5, 10, 23, 0), now)).toBe("Today");
    expect(relativeDay(new Date(2026, 5, 11, 1, 0), now)).toBe("Tomorrow");
    expect(relativeDay(new Date(2026, 5, 9, 1, 0), now)).toBe("Yesterday");
    expect(relativeDay(new Date(2026, 5, 15, 1, 0), now)).toBe("In 5 days");
    expect(relativeDay(new Date(2026, 5, 3, 1, 0), now)).toBe("7 days ago");
  });
});

describe("FollowUpWorkspace", () => {
  test("lists only leads in the follow-up stage and shows details, interaction type, status, next reminder, notes and history for the selected lead", async () => {
    renderPage();
    const list = await screen.findByRole("list", { name: "Follow-up leads" });
    expect(within(list).getByText("Alice")).toBeInTheDocument();
    expect(within(list).getByText("Bob")).toBeInTheDocument();
    expect(within(list).queryByText("Carol")).not.toBeInTheDocument();

    // The soonest next reminder (Bob, 9 Jun) is first and selected by default.
    expect(screen.getByRole("heading", { level: 3, name: "Bob" })).toBeInTheDocument();
    fireEvent.click(within(list).getByText("Alice"));
    expect(screen.getByRole("heading", { level: 3, name: "Alice" })).toBeInTheDocument();
    expect(screen.getByText("Current follow-up")).toBeInTheDocument();
    expect(screen.getByText("Interaction type")).toBeInTheDocument();
    expect(screen.getByText("Next reminder", { selector: "dt" })).toBeInTheDocument();
    expect(screen.getByText("Notes for Alice")).toBeInTheDocument();
    expect(screen.getByText("MBA")).toBeInTheDocument();
    await screen.findByText("Second call went well");
    expect(screen.getByText("Sent brochure")).toBeInTheDocument();
    expect(screen.getByText("Latest")).toBeInTheDocument();
  });

  test("filters by status tab and rating, and by the navbar search text", async () => {
    renderPage();
    await screen.findByText("Alice");
    fireEvent.click(screen.getByRole("tab", { name: /Not interested/ }));
    const list = screen.getByRole("list", { name: "Follow-up leads" });
    expect(within(list).queryByText("Alice")).not.toBeInTheDocument();
    expect(within(list).getByText("Bob")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /^All/ }));
    fireEvent.change(screen.getByLabelText("Rating"), { target: { value: "Hot" } });
    expect(within(list).queryByText("Bob")).not.toBeInTheDocument();
    expect(within(list).getByText("Alice")).toBeInTheDocument();
  });

  test("search text filters the list", async () => {
    renderPage("bob");
    const list = await screen.findByRole("list", { name: "Follow-up leads" });
    expect(within(list).queryByText("Alice")).not.toBeInTheDocument();
    expect(within(list).getByText("Bob")).toBeInTheDocument();
  });

  test("'Update follow-up' opens the existing editor with the lead's data (workflow preserved)", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Update follow-up" }));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/executive/clients/2/details",
      expect.objectContaining({ state: expect.objectContaining({ client: expect.objectContaining({ followUpId: 2, fresh_lead_id: 20 }), from: "followup" }) })
    );
  });

  test("shows an empty state when nothing matches", async () => {
    mockApi.followUps = { data: [] };
    renderPage();
    await waitFor(() => expect(screen.getByText("No follow-ups found")).toBeInTheDocument());
  });

  test("contains no email-template functionality", async () => {
    renderPage();
    await screen.findByText("Alice");
    expect(screen.queryByText(/template/i)).not.toBeInTheDocument();
  });
});
