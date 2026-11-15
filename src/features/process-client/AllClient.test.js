import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AllClient from "./AllClient";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });

const mockCtx = {};
jest.mock("../../context/ProcessServiceContext", () => ({ useProcessService: () => mockCtx }));

const clients = [
  { id: 1, fullName: "Asha Rao", email: "asha@x.com", phone: "9876543210", country: "Canada", status: "pending" },
  { id: 2, fullName: "Ben Cole", email: "ben@x.com", phone: "9123456780", country: "UK", status: "under_review" },
  { id: 3, fullName: "Done Person", status: "approved" },
];

beforeEach(() => {
  mockNavigate.mockReset();
  Object.assign(mockCtx, {
    customers: clients,
    setCustomers: jest.fn(),
    handleImportConvertedClients: jest.fn().mockResolvedValue({}),
    fetchCustomers: jest.fn().mockResolvedValue(clients),
  });
});

test("shows only the assigned pending / under-review clients and filters by search", async () => {
  render(<AllClient />);
  await waitFor(() => expect(screen.getByText("Asha Rao")).toBeInTheDocument());
  expect(screen.getByText("Ben Cole")).toBeInTheDocument();
  expect(screen.queryByText("Done Person")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Search clients"), { target: { value: "canada" } });
  expect(screen.getByText("Asha Rao")).toBeInTheDocument();
  expect(screen.queryByText("Ben Cole")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Search clients"), { target: { value: "zzz" } });
  expect(screen.getByText("No clients match your search")).toBeInTheDocument();
});

test("opens the client dashboard and documents routes", async () => {
  render(<AllClient />);
  await waitFor(() => screen.getByText("Asha Rao"));
  fireEvent.click(screen.getAllByText("Dashboard")[0]);
  expect(mockNavigate).toHaveBeenCalledWith("/processperson/client/dashboard/1", {
    state: { clientId: 1, clientName: "Asha Rao" },
  });
  fireEvent.click(screen.getAllByText("Documents")[0]);
  expect(mockNavigate.mock.calls[1][0]).toBe("/processperson/client/upload/1");
});

test("shows the empty state when nothing is assigned", async () => {
  mockCtx.customers = [];
  mockCtx.fetchCustomers = jest.fn().mockResolvedValue([]);
  render(<AllClient />);
  await waitFor(() => expect(screen.getByText("No clients assigned yet")).toBeInTheDocument());
});
