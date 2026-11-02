import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChatbotAssistantModal from "./ChatbotAssistantModal";

jest.mock("jwt-decode", () => ({
  jwtDecode: () => ({ id: "executive-1", name: "Test Executive" }),
}));

describe("ChatbotAssistantModal", () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("renders the existing chat UI instead of relying on an iframe", () => {
    render(<ChatbotAssistantModal onClose={jest.fn()} />);

    expect(screen.getByText("ChatBot Assistant")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
    expect(screen.getByText("Ask a question to start chatting.")).toBeInTheDocument();
    expect(screen.queryByTitle("Botpress Chatbot")).not.toBeInTheDocument();
  });

  it("sends an authenticated question to the executive agent and renders its answer", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ answer: "The assistant response" }),
    });
    render(<ChatbotAssistantModal onClose={jest.fn()} token="signed-token" />);

    const input = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(input, { target: { value: "How do I apply?" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(await screen.findByText("The assistant response")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      `${process.env.REACT_APP_API_BASE_URL}/crew/executive`,
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer signed-token",
        },
        body: JSON.stringify({ question: "How do I apply?" }),
      })
    );
  });

  it("shows backend failures instead of presenting them as assistant replies", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "AI service is not configured" }),
    });
    render(<ChatbotAssistantModal onClose={jest.fn()} token="signed-token" />);

    const input = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(input, { target: { value: "How do I apply?" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "AI service is not configured"
    );
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
    );
  });
});
