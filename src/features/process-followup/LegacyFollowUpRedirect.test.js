import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import LegacyFollowUpRedirect from "./LegacyFollowUpRedirect";
import { getAllProcessCustomerIdApi } from "../../services/processService";

let mockState = null;
jest.mock("react-router-dom", () => {
  const R = require("react");
  return {
    useParams: () => ({ id: "10" }),
    useLocation: () => ({ state: mockState }),
    Navigate: ({ to }) => R.createElement("div", { "data-testid": "nav", "data-to": to }),
  };
});
jest.mock("../../services/processService", () => ({ getAllProcessCustomerIdApi: jest.fn() }));

beforeEach(() => {
  jest.resetAllMocks();
  mockState = null;
});

describe("old follow-up links", () => {
  test("use the customer id from navigation state when present (no lookup)", () => {
    mockState = { client: { id: 4 } };
    render(<LegacyFollowUpRedirect />);
    expect(screen.getByTestId("nav")).toHaveAttribute("data-to", "/process/follow-up/4");
    expect(getAllProcessCustomerIdApi).not.toHaveBeenCalled();
  });

  test("otherwise look the fresh-lead id up among the signed-in person's own clients", async () => {
    getAllProcessCustomerIdApi.mockResolvedValue([{ id: 3, fresh_lead_id: 30 }, { id: 1, fresh_lead_id: 10 }]);
    render(<LegacyFollowUpRedirect />);
    await waitFor(() => expect(screen.getByTestId("nav")).toHaveAttribute("data-to", "/process/follow-up/1"));
  });

  test("a client that is not theirs falls back to Fresh Leads", async () => {
    getAllProcessCustomerIdApi.mockResolvedValue([{ id: 3, fresh_lead_id: 30 }]);
    render(<LegacyFollowUpRedirect />);
    await waitFor(() => expect(screen.getByTestId("nav")).toHaveAttribute("data-to", "/process/freshlead"));
  });
});
