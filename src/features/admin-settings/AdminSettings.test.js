import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import AdminSettings, { validatePhotoFile, validatePasswordChange, SPREADSHEET_MESSAGE } from "./AdminSettings";
import * as apiService from "../../services/apiService";

const mockApi = {
  user: { username: "boss", email: "boss@example.com", role: "Admin", firstname: "Sagar", lastname: "Kumar" },
  fetchAdminUserData: jest.fn(),
  handleUpdateProfile: jest.fn(),
  handleChangePassword: jest.fn(),
  isPasswordUpdating: false,
};

jest.mock("../../context/ApiContext", () => ({ useApi: () => mockApi }));
jest.mock("../../context/LoadingContext", () => ({
  useLoading: () => ({ showLoader: jest.fn(), hideLoader: jest.fn(), isLoading: false, variant: "" }),
}));
jest.mock("../admin/SidebarToggle", () => () => null);
jest.mock("../spinner/AdminSpinner", () => () => null);
jest.mock("./PageAccessControl", () => () => <div>PAGE-ACCESS-CONTROLLER</div>);
jest.mock("../modal/alert", () => ({
  Alert: ({ alerts }) => (
    <div data-testid="alerts">
      {alerts.map((a) => (
        <div key={a.id}>{`${a.title}: ${a.message}`}</div>
      ))}
    </div>
  ),
  soundManager: { playSound: jest.fn() },
}));
jest.mock("../../services/apiService", () => ({
  uploadAdminPhoto: jest.fn(),
  fetchAdminPhotoBlob: jest.fn(),
  deleteAdminPhoto: jest.fn(),
}));

beforeEach(() => {
  // CRA sets resetMocks:true, so URL stubs must be (re)created per test.
  global.URL.createObjectURL = jest.fn(() => "blob:preview");
  global.URL.revokeObjectURL = jest.fn();
  jest.clearAllMocks();
  mockApi.fetchAdminUserData.mockResolvedValue(undefined);
  mockApi.handleUpdateProfile.mockResolvedValue({});
  mockApi.handleChangePassword.mockResolvedValue({});
  apiService.fetchAdminPhotoBlob.mockResolvedValue(null);
});

const png = (size = 100, type = "image/png") => {
  const f = new File(["x"], "a.png", { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

describe("validators", () => {
  test("photo", () => {
    expect(validatePhotoFile(png())).toBeNull();
    expect(validatePhotoFile(png(10, "image/gif"))).toMatch(/Only JPEG/);
    expect(validatePhotoFile(png(3 * 1024 * 1024))).toMatch(/2MB/);
    expect(validatePhotoFile(null)).toMatch(/Choose/);
  });
  test("password policy", () => {
    expect(validatePasswordChange({ currentPassword: "", newPassword: "abcdef", confirmPassword: "abcdef" })).toMatch(/current/);
    expect(validatePasswordChange({ currentPassword: "old", newPassword: "abc", confirmPassword: "abc" })).toMatch(/at least 6/);
    expect(validatePasswordChange({ currentPassword: "abcdef", newPassword: "abcdef", confirmPassword: "abcdef" })).toMatch(/different/);
    expect(validatePasswordChange({ currentPassword: "old", newPassword: "abcdef", confirmPassword: "abcdeg" })).toMatch(/do not match/);
    expect(validatePasswordChange({ currentPassword: "old", newPassword: "abcdef", confirmPassword: "abcdef" })).toBeNull();
  });
});

describe("tabs", () => {
  test("Team, Plan and Billing are gone; Page Access Controller still works", async () => {
    render(<AdminSettings />);
    const tabs = within(document.querySelector(".settings-tabs")).getAllByRole("button").map((b) => b.textContent);
    expect(tabs).toEqual(["Profile", "Password", "Page Access Controller", "Integrations"]);
    fireEvent.click(screen.getByText("Page Access Controller"));
    expect(screen.getByText("PAGE-ACCESS-CONTROLLER")).toBeInTheDocument();
  });
});

describe("profile", () => {
  test("loads and saves first/last name through the profile API", async () => {
    render(<AdminSettings />);
    const first = screen.getByLabelText("First Name");
    const last = screen.getByLabelText("Last Name");
    await waitFor(() => expect(first).toHaveValue("Sagar"));
    expect(last).toHaveValue("Kumar");
    fireEvent.change(first, { target: { value: " Asha " } });
    fireEvent.change(last, { target: { value: "Verma" } });
    fireEvent.click(screen.getByText("Save Changes"));
    await waitFor(() =>
      expect(mockApi.handleUpdateProfile).toHaveBeenCalledWith({ email: "boss@example.com", firstname: "Asha", lastname: "Verma" })
    );
    await screen.findByText(/Profile updated successfully/);
    expect(mockApi.fetchAdminUserData).toHaveBeenCalledTimes(2); // initial + refresh after save
  });

  test("save failure shows the server message", async () => {
    mockApi.handleUpdateProfile.mockRejectedValue({ response: { data: { message: "Email already in use" } } });
    render(<AdminSettings />);
    fireEvent.click(screen.getByText("Save Changes"));
    await screen.findByText(/Email already in use/);
  });
});

describe("photo", () => {
  const pick = (file) => fireEvent.change(screen.getByLabelText("Choose profile photo"), { target: { files: [file] } });

  test("upload: preview first, then save (and notifies the navbar icon)", async () => {
    apiService.uploadAdminPhoto.mockResolvedValue({});
    const seen = jest.fn();
    window.addEventListener("adminPhotoChanged", seen);
    render(<AdminSettings />);
    pick(png());
    expect(screen.getByAltText("Profile preview")).toHaveAttribute("src", "blob:preview");
    expect(apiService.uploadAdminPhoto).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Save photo"));
    await waitFor(() => expect(apiService.uploadAdminPhoto).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(seen).toHaveBeenCalled());
    window.removeEventListener("adminPhotoChanged", seen);
    await screen.findByText(/Profile photo saved/);
  });

  test("cancel discards the pending preview", async () => {
    render(<AdminSettings />);
    pick(png());
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByAltText("Profile preview")).toBeNull();
    expect(apiService.uploadAdminPhoto).not.toHaveBeenCalled();
  });

  test("invalid type and oversize are rejected client-side", async () => {
    render(<AdminSettings />);
    pick(png(10, "application/pdf"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Only JPEG/);
    pick(png(5 * 1024 * 1024));
    expect(await screen.findByRole("alert")).toHaveTextContent(/2MB/);
    expect(apiService.uploadAdminPhoto).not.toHaveBeenCalled();
  });

  test("delete asks for confirmation then removes", async () => {
    apiService.fetchAdminPhotoBlob.mockResolvedValueOnce(new Blob(["x"])).mockResolvedValue(null);
    apiService.deleteAdminPhoto.mockResolvedValue({});
    render(<AdminSettings />);
    await waitFor(() => expect(screen.getByText("Delete")).not.toBeDisabled());
    fireEvent.click(screen.getByText("Delete"));
    expect(apiService.deleteAdminPhoto).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Yes, remove"));
    await waitFor(() => expect(apiService.deleteAdminPhoto).toHaveBeenCalledTimes(1));
    await screen.findByText(/Profile photo removed/);
  });

  test("Delete is disabled when there is no photo", async () => {
    render(<AdminSettings />);
    expect(screen.getByText("Delete")).toBeDisabled();
  });

  test("server upload error is shown", async () => {
    apiService.uploadAdminPhoto.mockRejectedValue({ response: { data: { message: "File content does not match an allowed image type." } } });
    render(<AdminSettings />);
    pick(png());
    fireEvent.click(screen.getByText("Save photo"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/does not match/);
  });
});

describe("password", () => {
  const fill = (cur, nw, cf) => {
    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: cur } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: nw } });
    fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: cf } });
    fireEvent.click(screen.getByText("Update Password"));
  };
  beforeEach(() => render(<AdminSettings />) && fireEvent.click(screen.getByText("Password", { selector: ".settings-tabs button" })));

  test("mismatch blocks the request", async () => {
    fill("old123", "newpass1", "newpass2");
    expect(await screen.findByRole("alert")).toHaveTextContent(/do not match/);
    expect(mockApi.handleChangePassword).not.toHaveBeenCalled();
  });

  test("short password blocked by policy", async () => {
    fill("old123", "abc", "abc");
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 6/);
  });

  test("success calls API with current + new and clears the form", async () => {
    fill("old123", "newpass1", "newpass1");
    await waitFor(() => expect(mockApi.handleChangePassword).toHaveBeenCalledWith("old123", "newpass1"));
    await waitFor(() => expect(screen.getByLabelText("Current Password")).toHaveValue(""));
  });

  test("wrong current password shows the server error", async () => {
    mockApi.handleChangePassword.mockRejectedValue({ response: { data: { message: "Old password is incorrect" } } });
    fill("wrong1", "newpass1", "newpass1");
    expect(await screen.findByRole("alert")).toHaveTextContent("Old password is incorrect");
  });
});

describe("integrations", () => {
  test("Excel card with Microsoft branding; Connect opens popup with the exact message; OK closes", async () => {
    render(<AdminSettings />);
    fireEvent.click(screen.getByText("Integrations", { selector: ".settings-tabs button" }));
    expect(screen.getByText("Microsoft Excel / Spreadsheets")).toBeInTheDocument();
    expect(screen.getByLabelText("Microsoft logo")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByText("Connect"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(SPREADSHEET_MESSAGE)).toBeInTheDocument();
    expect(SPREADSHEET_MESSAGE).toBe(
      "AdAgency360 provides you the ability to integrate your workflow with your spreadsheets in the future. Thank you for your patience!"
    );
    fireEvent.click(within(dialog).getByText("OK"));
    expect(screen.queryByRole("dialog")).toBeNull();
    // UI-only: no network calls were made
    expect(apiService.uploadAdminPhoto).not.toHaveBeenCalled();
  });
});

describe("CSP allows the authenticated photo blob", () => {
  test("public/index.html img-src includes blob: and still no wildcard", () => {
    const html = require("fs").readFileSync(require("path").join(__dirname, "../../../public/index.html"), "utf8");
    const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)[1];
    const img = /img-src ([^;]+);/.exec(csp)[1].split(/\s+/);
    expect(img).toEqual(expect.arrayContaining(["'self'", "data:", "blob:", "https:"]));
    expect(img).not.toContain("*");
  });
});
