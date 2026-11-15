import React from "react";
import { render } from "@testing-library/react";
import ProcessRoutes from "./ProcessRoutes";

// Record every <Route> (path + element type) without a real router.
const mockRoutes = [];
jest.mock("react-router-dom", () => {
  const React = require("react");
  return {
    Routes: ({ children }) => <>{children}</>,
    Navigate: () => null,
    Route: ({ path, index, element, children }) => {
      mockRoutes.push({ path: index ? "(index)" : path || "(layout)", element });
      return <>{children}</>;
    },
  };
});

const stub = (name) => () => <div>{name}</div>;
jest.mock("../features/Messaging/Messages", () => () => null);
jest.mock("../features/Messaging/RequireMessaging", () => ({ children }) => <>{children}</>);
jest.mock("../features/process-client/ProcessReportCard", () => () => null);
jest.mock("../features/executive/NewsComponent", () => () => null);
jest.mock("./ClientRoutes", () => () => null);
jest.mock("./CustomerRoutes", () => () => null);
jest.mock("./NotificationRoutes", () => () => null);
jest.mock("./ChatBotRoutes", () => () => null);
jest.mock("../features/chatbot/ElsaAI", () => () => null);
jest.mock("../features/process-client/ClientDash", () => () => null);
jest.mock("../features/process-client/ClientSetting", () => () => null);
jest.mock("../features/process-client/ClientUpload", () => () => null);
jest.mock("../features/process-client/CreateClient", () => () => null);
jest.mock("../features/process-client/AllClient", () => () => null);
jest.mock("../context/ProcessAuthContext", () => ({ useProcess: () => ({ user: { type: "processperson" } }) }));
jest.mock("../layouts/ProcessLayout", () => () => null);
jest.mock("../features/freshLeads/ProcessFreshlead", () => () => null);
jest.mock("./ProcessFollowupRoutes", () => () => null);
jest.mock("../features/process-client/ProcessStagePage", () => () => null);
jest.mock("../features/process-client/ProcessRejectedClients", () => () => null);
jest.mock("./ProcessMeetingRoutes", () => () => null);
jest.mock("../features/process-client/ProcessNotification", () => () => null);
jest.mock("./ProcessSettingsRoutes", () => () => null);
// Any import of the Invoice module from the Process Person routes would fail this test.
jest.mock("../features/Invoice/InvoicePage", () => {
  throw new Error("Process Person routes must not import the Invoice page");
});

const route = (path) => mockRoutes.find((r) => r.path === path);
const childNames = (el) => React.Children.toArray(el?.props?.children).map((c) => c.type?.name || c.type?.displayName || String(c.type));

beforeEach(() => {
  mockRoutes.length = 0;
  render(<ProcessRoutes />);
});

describe("Process Person routes", () => {
  test("the dashboard shows the stats cards followed by the Executive-style news", () => {
    expect(childNames(route("(index)").element)).toHaveLength(2);
  });

  test("invoice is not reachable: it redirects to the dashboard and renders no Invoice page", () => {
    const invoice = route("invoice/*");
    expect(invoice.element.type.name).toBe("Navigate");
    expect(invoice.element.props).toMatchObject({ to: "/process", replace: true });
    expect(mockRoutes.filter((r) => r.path === "invoice")).toEqual([]);
  });

  test("ELSA AI, the new settings and the old Executive settings redirect are routed", () => {
    expect(route("elsa")).toBeTruthy();
    expect(route("process-settings/*")).toBeTruthy();
    expect(route("settings/*").element.props.to).toBe("/process/process-settings");
  });
});
