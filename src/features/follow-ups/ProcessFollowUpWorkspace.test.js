import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import ProcessFollowUpWorkspace from "./ProcessFollowUpWorkspace";
import { SearchContext } from "../../context/SearchContext";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
}));

const mockService = {};
jest.mock("../../context/ProcessServiceContext", () => ({ useProcessService: () => mockService }));
jest.mock("../../services/processService", () => ({ getProcessFollowUpTimelineApi: jest.fn() }));

const client = (id, name, latest, over = {}) => ({
  id,
  fullName: name,
  email: `${name.toLowerCase()}@x.com`,
  phone: `+91 90000 0000${id}`,
  country: "India",
  status: "under_review",
  fresh_lead_id: id * 10,
  freshLead: { name, lead: { id, clientLead: { education: "MBA", experience: "5", state: "Delhi", dob: "1990-01-01" } } },
  processfollowuphistories: latest ? [latest] : [],
  ...over,
});

const fu = (type, rating, comments, date = "2026-06-12") => ({
  id: 1,
  follow_up_type: type,
  interaction_rating: rating,
  connect_via: "Call",
  follow_up_date: date,
  follow_up_time: "10:30:00",
  comments,
  createdAt: "2026-06-10T08:00:00.000Z",
});

const timelineRows = [
  { id: 2, follow_up_type: "document collection", interaction_rating: "Calm", connect_via: "Email", comments: "Sent checklist", follow_up_date: "2026-06-12", follow_up_time: "10:30:00", createdAt: "2026-06-10T08:00:00.000Z" },
  { id: 1, follow_up_type: "other", interaction_rating: "Neutral", connect_via: "Call", comments: "Intro call", follow_up_date: "2026-06-08", follow_up_time: "09:00:00", createdAt: "2026-06-08T08:00:00.000Z" },
];

const renderPage = (search = "", loadTimeline = jest.fn().mockResolvedValue(timelineRows)) => {
  const view = render(
    <SearchContext.Provider value={{ searchQuery: search, setActivePage: jest.fn() }}>
      <ProcessFollowUpWorkspace loadTimeline={loadTimeline} />
    </SearchContext.Provider>
  );
  return { ...view, loadTimeline };
};

beforeEach(() => {
  mockNavigate.mockReset();
  mockService.fetchCustomers = jest.fn().mockResolvedValue();
  mockService.customers = [
    client(1, "Alice", fu("document collection", "Calm", "Needs passport scan")),
    client(2, "Bob", fu("payment follow-up", "Agressive", "Pay by Friday", "2026-06-09")),
    client(3, "Cara", fu("visa filing", "Neutral", "Filing next week", "2026-06-20")),
    client(4, "Dev", null, { status: "pending" }), // fresh lead: not a follow-up
    client(5, "Eve", fu("rejected", "Calm", "withdrew", "2026-06-01"), { status: "rejected" }),
  ];
});

const list = () => screen.getByRole("list", { name: "Follow-up clients" });
const names = () => within(list()).getAllByRole("button").map((b) => b.querySelector(".fuw__name").textContent);

describe("Process Person follow-ups workspace", () => {
  test("lists only clients that are in follow-up (not fresh leads, not rejected), soonest follow-up first", async () => {
    renderPage();
    await waitFor(() => expect(names()).toEqual(["Bob", "Alice", "Cara"]));
    expect(screen.queryByText("Dev")).not.toBeInTheDocument();
    expect(screen.queryByText("Eve")).not.toBeInTheDocument();
  });

  test("keeps the Process Person categories with counts and filters by them", async () => {
    renderPage();
    await waitFor(() => expect(names()).toHaveLength(3));
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent.replace(/\s+/g, " ").trim());
    expect(tabs).toEqual(["All Follow-ups 3", "Document Collection 1", "Payment Follow-up 1", "Visa Filing 1"]);
    fireEvent.click(screen.getByRole("tab", { name: /Payment Follow-up/ }));
    expect(names()).toEqual(["Bob"]);
    fireEvent.click(screen.getByRole("tab", { name: /Visa Filing/ }));
    expect(names()).toEqual(["Cara"]);
    fireEvent.click(screen.getByRole("tab", { name: /All Follow-ups/ }));
    expect(names()).toHaveLength(3);
  });

  test("search (local box and header search), rating filter and sorting", async () => {
    renderPage();
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.change(screen.getByLabelText("Search follow-ups"), { target: { value: "ali" } });
    expect(names()).toEqual(["Alice"]);
    fireEvent.change(screen.getByLabelText("Search follow-ups"), { target: { value: "" } });

    fireEvent.change(screen.getByLabelText("Rating"), { target: { value: "agressive" } });
    expect(names()).toEqual(["Bob"]);
    fireEvent.change(screen.getByLabelText("Rating"), { target: { value: "all" } });

    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "name" } });
    expect(names()).toEqual(["Alice", "Bob", "Cara"]);
  });

  test("header search from the shared navbar also filters", async () => {
    renderPage("cara");
    await waitFor(() => expect(names()).toEqual(["Cara"]));
  });

  test("selected client shows current follow-up, details, history timeline and the three actions", async () => {
    const { loadTimeline } = renderPage();
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(within(list()).getByText("Alice"));

    const detail = document.querySelector(".fuw__detail");
    await waitFor(() => expect(within(detail).getByText("Sent checklist")).toBeInTheDocument());
    expect(loadTimeline).toHaveBeenLastCalledWith(10);
    expect(within(detail).getByText("Needs passport scan")).toBeInTheDocument(); // current notes
    expect(within(detail).getByText("Intro call")).toBeInTheDocument();
    expect(within(detail).getByText("Latest")).toBeInTheDocument();
    expect(within(detail).getByText("Email", { selector: ".fuw__chip" })).toBeInTheDocument();
    expect(within(detail).getByText("Neutral")).toBeInTheDocument(); // rating shown with its label

    expect(within(detail).getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+919000000001");
    expect(within(detail).getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/919000000001");
    fireEvent.click(within(detail).getByRole("button", { name: "Update follow-up" }));
    expect(mockNavigate).toHaveBeenCalledWith("/process/clients/details/10/10", {
      state: { client: expect.objectContaining({ fresh_lead_id: 10, id: 1 }), createFollowUp: false, from: "followup" },
    });
  });

  test("an empty history and a failed history load are reported, not hidden", async () => {
    const empty = renderPage("", jest.fn().mockResolvedValue([]));
    await waitFor(() => expect(screen.getByText("No earlier interactions recorded for this client.")).toBeInTheDocument());
    empty.unmount();
    renderPage("", jest.fn().mockRejectedValue(new Error("Failed to load follow-up history")));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Failed to load follow-up history"));
  });

  test("load failure shows a retryable error; no clients shows the empty state", async () => {
    mockService.fetchCustomers = jest.fn().mockRejectedValueOnce(new Error("x"));
    renderPage();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not load follow-ups"));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(names()).toHaveLength(3));

    mockService.customers = [];
    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    await waitFor(() => expect(screen.getByText("No follow-ups found")).toBeInTheDocument());
  });
});
