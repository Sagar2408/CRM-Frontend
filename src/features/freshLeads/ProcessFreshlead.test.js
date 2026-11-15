import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ProcessFreshlead from "./ProcessFreshlead";
import { SearchContext } from "../../context/SearchContext";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));
const mockService = {};
jest.mock("../../context/ProcessServiceContext", () => ({ useProcessService: () => mockService }));
jest.mock("../../context/ApiContext", () => ({ useApi: () => ({ fetchNotifications: jest.fn(), createCopyNotification: jest.fn() }) }));
jest.mock("../../hooks/useCopyNotification", () => () => {});
jest.mock("../spinner/LoadingSpinner", () => () => null);
jest.mock("../process-client/ExecutiveHistoryModal", () => ({ customerId, clientName }) => <div role="dialog">history {customerId} {clientName}</div>);

const lead = (id, name) => ({ id, fresh_lead_id: id * 10, fullName: name, phone: `90000${id}`, email: `${name.toLowerCase()}@x.com`, status: "pending", profession: "Engineer", freshLead: { lead: { clientLead: {} } } });

const renderPage = (search = "") =>
  render(
    <SearchContext.Provider value={{ searchQuery: search }}>
      <ProcessFreshlead />
    </SearchContext.Provider>
  );

beforeEach(() => {
  mockNavigate.mockReset();
  mockService.fetchCustomers = jest.fn().mockResolvedValue();
  mockService.customers = [lead(1, "Asha"), lead(2, "Ben"), { ...lead(3, "Done"), status: "under_review" }];
});

describe("Fresh Leads (Process Person)", () => {
  test("lists pending clients with Add Follow-up and Executive History, and no Call button", async () => {
    renderPage();
    expect(await screen.findByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("Ben")).toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add Follow-up" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Executive follow-up history/ })).toHaveLength(2);
    expect(screen.queryByRole("columnheader", { name: "Call" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Contact / })).toBeNull();
    expect(document.querySelector(".call-button, .call-cell, .popover")).toBeNull();
    expect(document.body.textContent).not.toContain("📞");
  });

  test("table cells carry data-labels so rows can stack as cards on narrow screens", async () => {
    renderPage();
    await screen.findByText("Asha");
    const labels = [...document.querySelectorAll("tbody tr:first-child td")].map((td) => td.getAttribute("data-label"));
    expect(labels).toEqual(["Name", "Phone", "Email", "Add follow-up", "Executive history"]);
  });

  test("search box and header search both filter", async () => {
    const { unmount } = renderPage();
    await screen.findByText("Asha");
    fireEvent.change(screen.getByLabelText("Search fresh leads"), { target: { value: "ben" } });
    expect(screen.queryByText("Asha")).not.toBeInTheDocument();
    expect(screen.getByText("Ben")).toBeInTheDocument();
    unmount();
    renderPage("asha");
    expect(await screen.findByText("Asha")).toBeInTheDocument();
    expect(screen.queryByText("Ben")).not.toBeInTheDocument();
  });

  test("Add Follow-up opens the existing follow-up form; Executive History opens the read-only modal", async () => {
    renderPage();
    await screen.findByText("Asha");
    fireEvent.click(screen.getAllByRole("button", { name: "Add Follow-up" })[0]);
    expect(mockNavigate).toHaveBeenCalledWith("/process/clients/processperson/Asha/10", expect.objectContaining({ state: expect.objectContaining({ createFollowUp: true }) }));
    fireEvent.click(screen.getAllByRole("button", { name: /Executive follow-up history for Asha/ })[0]);
    expect(screen.getByRole("dialog")).toHaveTextContent("history 1 Asha");
  });
});
