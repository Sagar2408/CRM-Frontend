import React from "react";
import { render } from "@testing-library/react";
import ProcessDashboardRoutes from "./ProcessDashboardRoutes";

// Record which <Route> sits under which parent, without a real router.
const mockRegistry = [];
jest.mock("react-router-dom", () => {
  const React = require("react");
  const Parent = React.createContext(null);
  return {
    Routes: ({ children }) => <>{children}</>,
    Navigate: () => null,
    Route: ({ path, element, children }) => {
      const parent = React.useContext(Parent);
      mockRegistry.push({ path: path || "(layout)", parent, portal: element && element.props && element.props.portal, element });
      return <Parent.Provider value={path || "(layout)"}>{children}</Parent.Provider>;
    },
  };
});
jest.mock("../layouts/ProcessLayout", () => () => null);
jest.mock("../features/process-client/ClientDash", () => () => null);
jest.mock("../features/process-client/ClientSetting", () => () => null);
jest.mock("../features/process-client/ClientUpload", () => () => null);
jest.mock("../features/process-client/CreateClient", () => () => null);
jest.mock("../features/process-client/AllClient", () => () => null);
jest.mock("../features/manage-clients/ManageClientsGate", () => () => null);

test("every client-portal route is nested under the shared portal layout (sidebar + header)", () => {
  render(<ProcessDashboardRoutes />);
  const layout = mockRegistry.find((r) => r.path === "(layout)");
  expect(layout.portal).toBe(true);
  const pages = mockRegistry.filter((r) => r.path !== "(layout)");
  const paths = pages.map((r) => r.path);
  ["client/all-clients", "client/dashboard/:id", "client/upload/:id", "client/settings", "client/create-client"].forEach((p) => expect(paths).toContain(p));
  pages.forEach((r) => expect(r.parent).toBe("(layout)"));
});

test("every Manage Clients page is wrapped in the access-password gate (nothing renders without it)", () => {
  mockRegistry.length = 0;
  render(<ProcessDashboardRoutes />);
  const Gate = jest.requireMock("../features/manage-clients/ManageClientsGate");
  const pages = mockRegistry.filter((r) => r.path !== "(layout)" && r.path !== "*");
  expect(pages.map((r) => r.path).sort()).toEqual(["client/all-clients", "client/create-client", "client/dashboard/:id", "client/settings", "client/upload/:id"]);
  pages.forEach((r) => expect(r.element.type).toBe(Gate));
});
