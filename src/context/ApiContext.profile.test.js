import React from "react";
import { render, act } from "@testing-library/react";
import { ApiProvider, useApi } from "./ApiContext";
import * as apiService from "../services/apiService";

// Regression guard for "profile avatar shows nothing": the backend's
// GET /admin/profile returns `{ admin: {...} }` (verified in
// controllers/User.controller.js:getAdminById), but `fetchAdmin` and
// `fetchAdminUserData` in ApiContext.js read `data.username` /
// `response.username` directly off the top-level body instead of
// `data.admin.username`, so the `if (data.username && ...)` guard
// always failed, `adminProfile` stayed null forever, and the
// AdminNavbar popover never rendered the user's details.
//
// Only `fetchAdminProfile` is configured below; every other apiService
// call made by ApiContext's other (irrelevant, role-gated-off or
// unconditional) mount effects is left as an empty auto-mocked fn — each
// call site already wraps its await in try/catch (verified in
// ApiContext.stability.test.js), so an unresolved/undefined result there
// is caught and logged, not fatal.
jest.mock("../services/apiService", () => ({
  fetchAdminProfile: jest.fn(),
}));
jest.mock("../services/fileUpload", () => ({}));

describe("ApiContext admin profile shape", () => {
  it("maps the nested { admin: {...} } response into adminProfile", async () => {
    localStorage.clear();
    apiService.fetchAdminProfile.mockResolvedValue({
      admin: { username: "jdoe", email: "jdoe@example.com", role: "Admin" },
    });

    let api;
    const Capture = () => {
      api = useApi();
      return null;
    };

    await act(async () => {
      render(
        <ApiProvider>
          <Capture />
        </ApiProvider>
      );
    });

    await act(async () => {
      await api.fetchAdmin();
    });

    expect(apiService.fetchAdminProfile).toHaveBeenCalled();
    expect(api.adminProfile).toEqual({
      name: "jdoe",
      email: "jdoe@example.com",
      role: "Admin",
    });
  });
});
