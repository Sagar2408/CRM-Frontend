import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import AllClient from "./AllClient";
import * as access from "../../services/clientAccess";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });

const mockCtx = {};
jest.mock("../../context/ProcessServiceContext", () => ({ useProcessService: () => mockCtx }));
jest.mock("../../services/clientAccess");
jest.mock("../manage-clients/ClientPortalCredentialsModal", () => ({ client, onClose }) => (
  <div role="dialog">
    credentials for {client.fullName} <button onClick={onClose}>close</button>
  </div>
));

const clients = [
  { id: 1, fullName: "Asha Rao", email: "asha@x.com", phone: "9876543210", country: "Canada", status: "pending", lastActivityAt: "2026-11-20T10:00:00Z", latestFollowUp: { type: "visa filing", date: "2026-12-01" }, portal: { status: "active" } },
  { id: 2, fullName: "Ben Cole", email: "ben@x.com", phone: "9123456780", country: "UK", status: "under_review", lastActivityAt: "2026-11-18T10:00:00Z", latestFollowUp: null, portal: { status: "not_set" } },
  { id: 3, fullName: "Done Person", email: "d@x.com", phone: "9000000000", country: "India", status: "approved", lastActivityAt: null, latestFollowUp: null, portal: { status: "disabled" } },
];

beforeEach(() => {
  jest.resetAllMocks();
  mockNavigate.mockReset();
  mockCtx.handleImportConvertedClients = jest.fn().mockResolvedValue({});
  access.getManagedClients.mockResolvedValue(clients);
});

describe("Manage Clients cards", () => {
  test("each card shows name, email, phone, country, status, last activity and portal state", async () => {
    render(<AllClient />);
    const card = (await screen.findByText("Asha Rao")).closest("li");
    expect(within(card).getByText("asha@x.com")).toBeInTheDocument();
    expect(within(card).getByText("+91 9876543210")).toBeInTheDocument();
    expect(within(card).getByText("Canada")).toBeInTheDocument();
    expect(within(card).getByText("Pending")).toBeInTheDocument();
    expect(within(card).getByText(/Visa filing/)).toBeInTheDocument(); // latest follow-up
    expect(within(card).getByText("Portal active")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /Dashboard/ })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /Client Portal Credentials/ })).toBeInTheDocument();
    expect(screen.getByText("Portal not set")).toBeInTheDocument();
    expect(screen.getByText("Portal disabled")).toBeInTheDocument();
  });

  test("lists every assigned status (not only pending / under review) and filters by search and status", async () => {
    render(<AllClient />);
    await screen.findByText("Asha Rao");
    expect(screen.getByText("Done Person")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search clients"), { target: { value: "canada" } });
    expect(screen.queryByText("Ben Cole")).toBeNull();
    fireEvent.change(screen.getByLabelText("Search clients"), { target: { value: "zzz" } });
    expect(screen.getByText("No clients match your search")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Approved" }));
    expect(screen.queryByText("Asha Rao")).toBeNull();
    expect(screen.getByText("Done Person")).toBeInTheDocument();
  });

  test("the existing client dashboard (roadmap) and documents stay reachable", async () => {
    render(<AllClient />);
    await screen.findByText("Asha Rao");
    fireEvent.click(screen.getAllByRole("button", { name: /Dashboard/ })[0]);
    expect(mockNavigate).toHaveBeenCalledWith("/processperson/client/dashboard/1", { state: { clientId: 1, clientName: "Asha Rao" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Documents/ })[0]);
    expect(mockNavigate.mock.calls[1][0]).toBe("/processperson/client/upload/1");
  });

  test("Client Portal Credentials opens for that client", async () => {
    render(<AllClient />);
    await screen.findByText("Ben Cole");
    fireEvent.click(within(screen.getByText("Ben Cole").closest("li")).getByRole("button", { name: /Client Portal Credentials/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("credentials for Ben Cole");
  });

  test("empty state, load failure with retry, and an expired grant is not shown as an error", async () => {
    access.getManagedClients.mockResolvedValueOnce([]);
    const { unmount } = render(<AllClient />);
    expect(await screen.findByText("No clients assigned yet")).toBeInTheDocument();
    unmount();
    access.getManagedClients.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(clients);
    const second = render(<AllClient />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your clients");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Asha Rao")).toBeInTheDocument();
    second.unmount();
    const expired = Object.assign(new Error("x"), { code: "CLIENT_ACCESS_EXPIRED" });
    access.getManagedClients.mockRejectedValueOnce(expired);
    render(<AllClient />);
    await waitFor(() => expect(screen.queryAllByRole("alert")).toHaveLength(0));
  });

  test("Lock ends the access session (server-side) via the service", async () => {
    render(<AllClient />);
    await screen.findByText("Asha Rao");
    fireEvent.click(screen.getByRole("button", { name: /Lock/ }));
    expect(access.lockClientAccess).toHaveBeenCalledTimes(1);
  });

  test("import still works and reloads the list", async () => {
    render(<AllClient />);
    await screen.findByText("Asha Rao");
    fireEvent.click(screen.getByRole("button", { name: /Import clients/ }));
    await waitFor(() => expect(mockCtx.handleImportConvertedClients).toHaveBeenCalled());
    await waitFor(() => expect(access.getManagedClients).toHaveBeenCalledTimes(2));
  });
});
