import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Chat from "./Chat";

// The small popup chat (Fresh Leads) shares ELSA's backend: replies are saved as a
// conversation and follow-ups continue the same one.
describe("Chat popup", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  afterEach(() => {
    delete global.fetch;
  });

  const send = (text) => {
    const input = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(input, { target: { value: text } });
    fireEvent.keyDown(input, { key: "Enter" });
  };

  it("is branded ELSA AI, has only send + microphone, and continues one conversation", async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ answer: "One", conversation: { id: 12 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ answer: "Two", conversation: { id: 12 } }) });
    render(<Chat token="tok" />);
    expect(screen.getByRole("heading", { name: "ELSA AI" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use microphone" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /record/i })).not.toBeInTheDocument();

    send("first");
    expect(await screen.findByText("One")).toBeInTheDocument();
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ question: "first" });

    send("second");
    expect(await screen.findByText("Two")).toBeInTheDocument();
    expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({ question: "second", conversationId: 12 });
  });

  it("surfaces backend errors", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: "ELSA is temporarily unavailable. Please try again." }) });
    render(<Chat token="tok" />);
    send("hi");
    expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
  });
});
