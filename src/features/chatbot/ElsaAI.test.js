import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import ElsaAI, { relativeTime } from "./ElsaAI";
import * as api from "../../services/apiService";

jest.mock("../../services/apiService", () => ({
  elsaListConversations: jest.fn(),
  elsaGetMessages: jest.fn(),
  elsaRenameConversation: jest.fn(),
  elsaDeleteConversation: jest.fn(),
  elsaSendMessage: jest.fn(),
}));

const NOW = new Date().toISOString();
const convs = () => [
  { id: 1, title: "Canada PR", lastMessageAt: NOW },
  { id: 2, title: "Australia visa", lastMessageAt: NOW },
];

beforeEach(() => {
  api.elsaListConversations.mockResolvedValue(convs());
  api.elsaGetMessages.mockImplementation(async (id) => [
    { id: 10, text: `Question in ${id}`, isUser: true },
    { id: 11, text: `Answer in ${id}`, isUser: false },
  ]);
  api.elsaRenameConversation.mockResolvedValue({});
  api.elsaDeleteConversation.mockResolvedValue({});
});

test("lists the user's chats and reopens one with its saved messages", async () => {
  render(<ElsaAI />);
  fireEvent.click(await screen.findByRole("button", { name: /^Canada PR/ }));
  expect(await screen.findByText("Question in 1")).toBeInTheDocument();
  expect(screen.getByText("Answer in 1")).toBeInTheDocument();
  expect(api.elsaGetMessages).toHaveBeenCalledWith(1);
  fireEvent.click(screen.getByRole("button", { name: /^Australia visa/ }));
  expect(await screen.findByText("Answer in 2")).toBeInTheDocument();
  expect(screen.queryByText("Answer in 1")).not.toBeInTheDocument();
});

test("a first message creates a chat; the next message continues the SAME conversation", async () => {
  api.elsaListConversations.mockResolvedValue([]);
  api.elsaSendMessage
    .mockResolvedValueOnce({ answer: "First answer", conversation: { id: 7, title: "Hello ELSA", lastMessageAt: NOW } })
    .mockResolvedValueOnce({ answer: "Second answer", conversation: { id: 7, title: "Hello ELSA", lastMessageAt: NOW } });
  render(<ElsaAI />);
  const input = await screen.findByRole("textbox", { name: "Message" });
  fireEvent.change(input, { target: { value: "Hello ELSA" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(await screen.findByText("First answer")).toBeInTheDocument();
  expect(api.elsaSendMessage).toHaveBeenNthCalledWith(1, "Hello ELSA", null);
  expect(await screen.findByRole("button", { name: /^Hello ELSA/ })).toBeInTheDocument(); // appears in the list

  fireEvent.change(input, { target: { value: "More please" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  expect(await screen.findByText("Second answer")).toBeInTheDocument();
  expect(api.elsaSendMessage).toHaveBeenNthCalledWith(2, "More please", 7);
});

test("shows a thinking state while waiting, and a retryable error when the provider fails", async () => {
  api.elsaListConversations.mockResolvedValue([]);
  let reject;
  api.elsaSendMessage.mockImplementationOnce(() => new Promise((_, r) => (reject = r)));
  render(<ElsaAI />);
  const input = await screen.findByRole("textbox", { name: "Message" });
  fireEvent.change(input, { target: { value: "Will this fail?" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(await screen.findByRole("status")).toHaveTextContent("ELSA is thinking");

  reject({ response: { data: { error: "ELSA is temporarily unavailable. Please try again." } } });
  expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
  expect(screen.getByText("Will this fail?")).toBeInTheDocument(); // the user's message is kept

  api.elsaSendMessage.mockResolvedValueOnce({ answer: "Recovered", conversation: { id: 3, title: "Will this fail?", lastMessageAt: NOW } });
  fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
  expect(await screen.findByText("Recovered")).toBeInTheDocument();
  expect(screen.getAllByText("Will this fail?").length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: /Retry/ })).not.toBeInTheDocument();
});

test("renames a chat inline (and rolls back when the server refuses)", async () => {
  render(<ElsaAI />);
  fireEvent.click(await screen.findByRole("button", { name: "Rename Canada PR" }));
  const field = screen.getByLabelText("Chat name");
  fireEvent.change(field, { target: { value: "  Canada Express Entry  " } });
  fireEvent.submit(field.closest("form"));
  await waitFor(() => expect(api.elsaRenameConversation).toHaveBeenCalledWith(1, "Canada Express Entry"));
  expect(await screen.findByRole("button", { name: /^Canada Express Entry/ })).toBeInTheDocument();

  api.elsaRenameConversation.mockRejectedValueOnce({ response: { data: { error: "Conversation not found" } } });
  fireEvent.click(screen.getByRole("button", { name: "Rename Australia visa" }));
  const f2 = screen.getByLabelText("Chat name");
  fireEvent.change(f2, { target: { value: "Oops" } });
  fireEvent.submit(f2.closest("form"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Conversation not found");
  expect(screen.getByRole("button", { name: /^Australia visa/ })).toBeInTheDocument();
});

test("deleting asks for confirmation, removes the chat and returns to a new chat when it was open", async () => {
  render(<ElsaAI />);
  fireEvent.click(await screen.findByRole("button", { name: /^Canada PR/ }));
  await screen.findByText("Answer in 1");
  fireEvent.click(screen.getByRole("button", { name: "Delete Canada PR" }));
  expect(api.elsaDeleteConversation).not.toHaveBeenCalled(); // not until confirmed
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirm delete" }));
  await waitFor(() => expect(api.elsaDeleteConversation).toHaveBeenCalledWith(1));
  await waitFor(() => expect(screen.queryByRole("button", { name: /^Canada PR/ })).not.toBeInTheDocument());
  expect(screen.queryByText("Answer in 1")).not.toBeInTheDocument();
  expect(screen.getByText(/How can I help with immigration/)).toBeInTheDocument();
});

test("'New chat' starts a fresh conversation without losing the saved ones", async () => {
  api.elsaSendMessage.mockResolvedValue({ answer: "A", conversation: { id: 9, title: "T", lastMessageAt: NOW } });
  render(<ElsaAI />);
  fireEvent.click(await screen.findByRole("button", { name: /^Canada PR/ }));
  await screen.findByText("Answer in 1");
  fireEvent.click(screen.getByRole("button", { name: /New chat/ }));
  expect(screen.queryByText("Answer in 1")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: "Brand new topic" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(api.elsaSendMessage).toHaveBeenCalledWith("Brand new topic", null));
  expect(screen.getByRole("button", { name: /^Canada PR/ })).toBeInTheDocument();
});

test("shows load errors and offers a retry; only text send and microphone controls exist", async () => {
  api.elsaListConversations.mockRejectedValueOnce({ response: { data: { error: "Could not load" } } });
  render(<ElsaAI />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("button", { name: /^Canada PR/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Use microphone" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /record/i })).not.toBeInTheDocument();
});

test("relativeTime", () => {
  const now = new Date(2026, 5, 10, 12, 0);
  expect(relativeTime(new Date(2026, 5, 9, 8, 0).toISOString(), now)).toBe("Yesterday");
  expect(relativeTime(new Date(2026, 5, 7, 8, 0).toISOString(), now)).toBe("3 days ago");
  expect(relativeTime("garbage", now)).toBe("");
});
