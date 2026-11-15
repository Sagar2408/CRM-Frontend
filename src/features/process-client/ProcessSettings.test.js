import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProcessMyProfile from "./ProcessMyProfile";
import { getProcessSettings, updateProcessSettingsApi } from "../../services/processService";

jest.mock("../../services/processService", () => ({
  getProcessSettings: jest.fn(),
  updateProcessSettingsApi: jest.fn(),
}));

const profile = { fullName: "Pat Process", email: "pat@acme.com", phone: "999", dob: "1990-02-03", nationality: "Indian", passportNumber: "P123", profession: "Visa officer", location: "Delhi" };

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("user", JSON.stringify({ id: 4, fullName: "Pat Process", type: "processperson" }));
  getProcessSettings.mockResolvedValue(profile);
  updateProcessSettingsApi.mockResolvedValue({ message: "ok" });
});

describe("Process Person - My Profile", () => {
  test("shows the real profile; email, role and id are read-only text, not inputs", async () => {
    render(<ProcessMyProfile />);
    await waitFor(() => expect(screen.getByText("pat@acme.com")).toBeInTheDocument());
    expect(screen.getAllByText("Process Person").length).toBeGreaterThan(0);
    expect(screen.getByText("4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit personal information" }));
    const labels = [...document.querySelectorAll("label")].map((l) => l.textContent.replace(" *", ""));
    expect(labels).toEqual(["Full name", "Phone", "Date of birth", "Nationality", "Passport number", "Profession", "Location"]);
    expect(screen.queryByLabelText(/email|role|username|permission/i)).toBeNull();
  });

  test("saves only the permitted fields and updates the stored name for the header", async () => {
    const heard = jest.fn();
    window.addEventListener("pp-profile-updated", heard);
    render(<ProcessMyProfile />);
    await waitFor(() => screen.getByRole("button", { name: "Edit personal information" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit personal information" }));
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: "  Pat P. Process " } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Profile updated."));
    const payload = updateProcessSettingsApi.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual(["dob", "fullName", "location", "nationality", "passportNumber", "phone", "profession"]);
    expect(payload).toMatchObject({ fullName: "Pat P. Process", phone: "12345" });
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("role");
    expect(JSON.parse(localStorage.getItem("user")).fullName).toBe("Pat P. Process");
    expect(heard).toHaveBeenCalled();
    window.removeEventListener("pp-profile-updated", heard);
  });

  test("validates the name and surfaces server errors", async () => {
    updateProcessSettingsApi.mockRejectedValue(new Error("Failed to update settings"));
    render(<ProcessMyProfile />);
    await waitFor(() => screen.getByRole("button", { name: "Edit personal information" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit personal information" }));
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Full name is required")).toBeInTheDocument();
    expect(updateProcessSettingsApi).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: "Pat" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Failed to update settings"));
  });

  test("a failed load is reported", async () => {
    getProcessSettings.mockRejectedValue(new Error("Settings not available"));
    render(<ProcessMyProfile />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Settings not available"));
  });
});
