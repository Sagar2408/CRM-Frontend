import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import ProcessDocumentSettings from "./ProcessDocumentSettings";
import * as api from "../../services/processService";

jest.mock("../../services/processService");

let store;
beforeEach(() => {
  jest.resetAllMocks();
  store = [
    { id: 1, name: "Passport" },
    { id: 2, name: "PAN Card" },
  ];
  api.getProcessDocumentTypesApi.mockImplementation(async () => store.map((d) => ({ ...d })));
  api.createProcessDocumentTypeApi.mockImplementation(async (name) => {
    store = [...store, { id: 10, name }];
    return {};
  });
  api.renameProcessDocumentTypeApi.mockImplementation(async (id, name) => {
    store = store.map((d) => (d.id === id ? { ...d, name } : d));
    return {};
  });
  api.deleteProcessDocumentTypeApi.mockImplementation(async (id) => {
    store = store.filter((d) => d.id !== id);
    return {};
  });
});

describe("Settings > Documents", () => {
  test("lists the configured documents", async () => {
    render(<ProcessDocumentSettings />);
    expect(await screen.findByText("Passport")).toBeInTheDocument();
    expect(screen.getByText("PAN Card")).toBeInTheDocument();
  });

  test("adds a document (whitespace collapsed) and shows it immediately", async () => {
    render(<ProcessDocumentSettings />);
    await screen.findByText("Passport");
    fireEvent.change(screen.getByPlaceholderText("e.g. Bank statement"), { target: { value: "  Bank   Statement " } });
    fireEvent.click(screen.getByRole("button", { name: "Add document" }));
    await waitFor(() => expect(api.createProcessDocumentTypeApi).toHaveBeenCalledWith("Bank Statement"));
    expect(await screen.findByText("Bank Statement")).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent('"Bank Statement" added.');
  });

  test("rejects empty and duplicate names before calling the server", async () => {
    render(<ProcessDocumentSettings />);
    await screen.findByText("Passport");
    fireEvent.click(screen.getByRole("button", { name: "Add document" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a document name.");
    fireEvent.change(screen.getByPlaceholderText("e.g. Bank statement"), { target: { value: "passport" } });
    fireEvent.click(screen.getByRole("button", { name: "Add document" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already in your list");
    expect(api.createProcessDocumentTypeApi).not.toHaveBeenCalled();
  });

  test("renames a document", async () => {
    render(<ProcessDocumentSettings />);
    await screen.findByText("Passport");
    fireEvent.click(screen.getByRole("button", { name: "Rename Passport" }));
    const input = screen.getByRole("textbox", { name: "Rename Passport" });
    fireEvent.change(input, { target: { value: "Passport (valid)" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.renameProcessDocumentTypeApi).toHaveBeenCalledWith(1, "Passport (valid)"));
    expect(await screen.findByText("Passport (valid)")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Earlier follow-ups keep their original wording.");
  });

  test("deleting asks for confirmation first, then removes it", async () => {
    render(<ProcessDocumentSettings />);
    await screen.findByText("PAN Card");
    fireEvent.click(screen.getByRole("button", { name: "Delete PAN Card" }));
    expect(api.deleteProcessDocumentTypeApi).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep" })); // cancel
    expect(screen.getByText("PAN Card")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete PAN Card" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    await waitFor(() => expect(api.deleteProcessDocumentTypeApi).toHaveBeenCalledWith(2));
    await waitFor(() => expect(screen.queryByText("PAN Card")).toBeNull());
  });

  test("server errors are shown (duplicate from another tab)", async () => {
    api.createProcessDocumentTypeApi.mockRejectedValue(new Error("A document type with this name already exists."));
    render(<ProcessDocumentSettings />);
    await screen.findByText("Passport");
    fireEvent.change(screen.getByPlaceholderText("e.g. Bank statement"), { target: { value: "Visa" } });
    fireEvent.click(screen.getByRole("button", { name: "Add document" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
  });

  test("empty state and load failure", async () => {
    store = [];
    const { unmount } = render(<ProcessDocumentSettings />);
    expect(await screen.findByText("No documents yet")).toBeInTheDocument();
    unmount();
    api.getProcessDocumentTypesApi.mockRejectedValueOnce(new Error("Failed to load document types"));
    render(<ProcessDocumentSettings />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load document types");
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
