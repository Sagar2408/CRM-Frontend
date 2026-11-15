import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ExecutiveHistoryModal from "./ExecutiveHistoryModal";
import ProcessStagePage from "./ProcessStagePage";
import ProcessRejectedClients from "./ProcessRejectedClients";

jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock("../../services/processService", () => ({
  getExecutiveHistoryApi: jest.fn(),
  getStageProgressApi: jest.fn(),
  getRejectedClientsApi: jest.fn(),
}));
jest.mock("../../context/SearchContext", () => {
  const React = require("react");
  return { SearchContext: React.createContext({ searchQuery: "" }) };
});

describe("ExecutiveHistoryModal (read-only)", () => {
  const data = {
    executive: "Alex Exec",
    entries: [
      { source: "latest", executive: "Alex Exec", status: "Current", outcome: "Hot", via: "Call", type: "Interested", comments: "Wants UK visa", followUpDate: "2026-05-02", followUpTime: "10:00:00", nextFollowUpDate: "2026-05-02", recordedAt: "2026-04-20T10:00:00Z" },
      { source: "history", executive: "Alex Exec", status: "Previous", outcome: "Warm", via: "Email", type: "Interested", comments: "Sent brochure", followUpDate: "2026-04-10", followUpTime: "09:30:00", recordedAt: "2026-04-10T09:30:00Z" },
    ],
  };

  test("shows every Executive entry with name, comments, outcome and dates - and no edit/delete controls", async () => {
    render(<ExecutiveHistoryModal customerId={1} clientName="Asha" onClose={() => {}} load={() => Promise.resolve(data)} />);
    await waitFor(() => expect(screen.getByText("Wants UK visa")).toBeInTheDocument());
    expect(screen.getByText("Sent brochure")).toBeInTheDocument();
    expect(screen.getAllByText("Alex Exec").length).toBeGreaterThan(1);
    expect(screen.getByText("Hot")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("Next follow-up")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button").map((b) => (b.getAttribute("aria-label") || b.textContent).toLowerCase());
    expect(buttons.filter((t) => /edit|delete|remove|save/.test(t))).toEqual([]);
    expect(document.querySelector("textarea, input")).toBeNull();
  });

  test("empty and error states", async () => {
    const { unmount } = render(<ExecutiveHistoryModal customerId={1} onClose={() => {}} load={() => Promise.resolve({ entries: [] })} />);
    await waitFor(() => expect(screen.getByText("No Executive follow-ups recorded")).toBeInTheDocument());
    unmount();
    render(<ExecutiveHistoryModal customerId={9} onClose={() => {}} load={() => Promise.reject(new Error("Client not found."))} />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Client not found."));
  });

  test("Escape closes", async () => {
    const onClose = jest.fn();
    render(<ExecutiveHistoryModal customerId={1} onClose={onClose} load={() => Promise.resolve({ entries: [] })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Final Stage / Completed Clients pages", () => {
  const clients = [
    { customerId: 1, fullName: "Final One", stage: "final_stage", currentStage: 14, totalStages: 15 },
    { customerId: 2, fullName: "Done One", stage: "completed", currentStage: 15, totalStages: 15, completedAt: "2026-03-01T10:00:00.000Z" },
    { customerId: 3, fullName: "Busy One", stage: "in_progress", currentStage: 3, totalStages: 15 },
    { customerId: 4, fullName: "Gone One", stage: "rejected", currentStage: 14, totalStages: 15 },
  ];
  const load = () => Promise.resolve({ totalStages: 15, clients });

  test("Final Stage lists only clients one stage away - not completed, active or rejected ones", async () => {
    render(<ProcessStagePage mode="final" load={load} />);
    await waitFor(() => expect(screen.getByText("Final One")).toBeInTheDocument());
    expect(screen.getByText("14 of 15")).toBeInTheDocument();
    ["Done One", "Busy One", "Gone One"].forEach((n) => expect(screen.queryByText(n)).not.toBeInTheDocument());
  });

  test("Completed Clients lists only completed ones, with final stage and completion date", async () => {
    render(<ProcessStagePage mode="completed" load={load} />);
    await waitFor(() => expect(screen.getByText("Done One")).toBeInTheDocument());
    expect(screen.getByText("Stage 15")).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.queryByText("Final One")).not.toBeInTheDocument();
  });
});

describe("Rejected Leads page", () => {
  const clients = [
    { customerId: 1, fullName: "Withdrawn Wendy", kind: "client_withdrawal", reason: "Moved abroad for work", stageReached: 7, totalStages: 15, withdrawnAt: "2026-04-01T10:00:00Z", responsible: "Pat Process", followUps: [] },
    { customerId: 2, fullName: "Rejected Rob", kind: "internal_rejection", reason: "Failed eligibility", stageReached: 0, totalStages: 15, withdrawnAt: "2026-04-02T10:00:00Z", responsible: "Pat Process", followUps: [{ id: 5, type: "other", via: "Call", comments: "Called twice", by: "Pat Process", date: "2026-03-30" }] },
    { customerId: 3, fullName: "Legacy Larry", kind: "unspecified", reason: "", stageReached: 2, totalStages: 15, withdrawnAt: "2026-02-02T10:00:00Z", responsible: null, followUps: [] },
  ];
  const load = () => Promise.resolve({ clients });

  test("shows the real reason, stage, date and responsible person, and distinguishes the two kinds", async () => {
    render(<ProcessRejectedClients load={load} />);
    await waitFor(() => expect(screen.getByText("Withdrawn Wendy")).toBeInTheDocument());
    expect(screen.getByText("Moved abroad for work")).toBeInTheDocument();
    expect(screen.getByText("Failed eligibility")).toBeInTheDocument();
    expect(screen.getByText("Stage 7 of 15")).toBeInTheDocument();
    expect(screen.getAllByText("Pat Process").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Client withdrew").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rejected internally").length).toBeGreaterThan(0);
    // no invented reason for a record that has none
    expect(screen.getByText("No reason recorded")).toBeInTheDocument();
  });

  test("filter separates client withdrawals from internal rejections", async () => {
    render(<ProcessRejectedClients load={load} />);
    await waitFor(() => screen.getByText("Withdrawn Wendy"));
    fireEvent.click(screen.getByRole("button", { name: "Client withdrew" }));
    expect(screen.getByText("Withdrawn Wendy")).toBeInTheDocument();
    expect(screen.queryByText("Rejected Rob")).not.toBeInTheDocument();
  });

  test("follow-up comments are available on expand", async () => {
    render(<ProcessRejectedClients load={load} />);
    await waitFor(() => screen.getByText("Rejected Rob"));
    fireEvent.click(screen.getByRole("button", { name: /Follow-ups/ }));
    expect(screen.getByText("Called twice")).toBeInTheDocument();
  });
});
