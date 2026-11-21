import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ClientDetailsCard from "./ClientDetailsCard";
import { validateFollowUp, ratingLabel, ratingKey, localDate, toDateTime } from "./followUpHelpers";
import * as api from "../../services/processService";

jest.mock("../../services/processService");

const saved = { id: 1, freshLeadId: 10, fullName: "Asha Rao", email: "asha@x.com", phone: "9000000001", country: "India", state: "Punjab", education: "MBA", experience: "5 years", dob: "1992-04-05" };

beforeEach(() => jest.resetAllMocks());

describe("ClientDetailsCard (shared client record)", () => {
  test("shows the values the Executive saved, not empty defaults", async () => {
    api.getProcessClientDetailsApi.mockResolvedValue(saved);
    render(<ClientDetailsCard customerId="1" />);
    expect(await screen.findByLabelText("Education")).toHaveValue("MBA");
    expect(screen.getByLabelText("Experience")).toHaveValue("5 years");
    expect(screen.getByLabelText("State")).toHaveValue("Punjab");
    expect(screen.getByLabelText("Date of birth")).toHaveValue("1992-04-05");
    expect(screen.getByLabelText("Full name")).toHaveValue("Asha Rao");
  });

  test("save is disabled until something changes, then sends ONLY the changed values", async () => {
    api.getProcessClientDetailsApi.mockResolvedValue(saved);
    api.updateProcessClientDetailsApi.mockResolvedValue({ client: { ...saved, education: "PhD", state: "Delhi" } });
    const onSaved = jest.fn();
    render(<ClientDetailsCard customerId="1" onSaved={onSaved} />);
    await screen.findByLabelText("Education");
    expect(screen.getByRole("button", { name: "Save details" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Education"), { target: { value: "PhD" } });
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "Delhi" } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    await waitFor(() => expect(api.updateProcessClientDetailsApi).toHaveBeenCalledWith("1", { education: "PhD", state: "Delhi" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Client details saved.");
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ education: "PhD" }));
  });

  test("clearing a saved value never sends an empty overwrite", async () => {
    api.getProcessClientDetailsApi.mockResolvedValue(saved);
    render(<ClientDetailsCard customerId="1" />);
    await screen.findByLabelText("Education");
    fireEvent.change(screen.getByLabelText("Education"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("cannot be cleared");
    expect(api.updateProcessClientDetailsApi).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByLabelText("Education")).toHaveValue("MBA");
  });

  test("shows server errors (e.g. duplicate email) and load failures with retry", async () => {
    api.getProcessClientDetailsApi.mockRejectedValueOnce(new Error("Client not found.")).mockResolvedValueOnce(saved);
    render(<ClientDetailsCard customerId="1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Client not found.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByLabelText("Email");
    api.updateProcessClientDetailsApi.mockRejectedValue(new Error("Another client already uses this email address."));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "taken@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already uses this email");
  });
});

describe("followUpHelpers", () => {
  const ok = { contactMethod: "Call", category: "visa filing", rating: "Calm", comments: "hi", date: "2026-12-01", time: "10:00", documentName: "" };
  test("validateFollowUp accepts a complete form and rejects each gap", () => {
    expect(validateFollowUp(ok)).toEqual({});
    expect(Object.keys(validateFollowUp({ ...ok, comments: "  " }))).toEqual(["comments"]);
    expect(Object.keys(validateFollowUp({ ...ok, comments: "x".repeat(2001) }))).toEqual(["comments"]);
    expect(Object.keys(validateFollowUp({ ...ok, date: "" }))).toEqual(["date"]);
    expect(Object.keys(validateFollowUp({ ...ok, category: "document collection" }))).toEqual(["documentName"]);
    expect(Object.keys(validateFollowUp({ ...ok, category: "meeting", date: "2020-01-01" }))).toEqual(["date"]);
    expect(validateFollowUp({ ...ok, category: "meeting", date: "2030-01-01" })).toEqual({});
  });

  test("rating spelling is mapped both ways", () => {
    expect(ratingLabel("Agressive")).toBe("Aggressive");
    expect(ratingLabel("Aggressive")).toBe("Aggressive");
    expect(ratingKey("Aggressive")).toBe("agressive");
    expect(ratingLabel("Calm")).toBe("Calm");
  });

  test("local date is not shifted by UTC and datetimes parse", () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(toDateTime("2026-06-12", "10:30:00").getHours()).toBe(10);
    expect(toDateTime(null, null)).toBeNull();
  });
});
