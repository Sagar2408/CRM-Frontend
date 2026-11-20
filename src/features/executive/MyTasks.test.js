import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

jest.mock("../../services/managerTaskService", () => {
  const actual = jest.requireActual("../../services/managerTaskService");
  return { ...actual, myTaskApi: { summary: jest.fn(), list: jest.fn(), update: jest.fn() } };
});

import { myTaskApi } from "../../services/managerTaskService";
import MyTasks from "./MyTasks";

const task = (o = {}) => ({ id: 1, title: "Call hot leads", description: "Top 20", priority: "high", status: "todo", progress: 0, dueDate: "2026-11-25", overdue: false, assignedBy: "Maya Manager", ...o });
const summary = { total: 3, todo: 1, inProgress: 1, completed: 1, overdue: 1, dueToday: 0, completionRate: 33 };

beforeEach(() => {
  jest.clearAllMocks();
  myTaskApi.summary.mockResolvedValue(summary);
  myTaskApi.list.mockResolvedValue({ tasks: [task(), task({ id: 2, title: "Send quotes", status: "in_progress", progress: 50, overdue: true }), task({ id: 3, title: "Old", status: "completed", progress: 100 })], total: 3 });
});

test("shows real assigned tasks, who assigned them, overdue flag and counts", async () => {
  render(<MyTasks />);
  expect((await screen.findAllByText("Call hot leads")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Maya Manager").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
  expect(screen.getByTestId("stat-overdue")).toHaveTextContent("1");
  expect(screen.getByTestId("stat-completed")).toHaveTextContent("1");
});

test("the Executive can start, set progress, complete and reopen, and nothing else", async () => {
  myTaskApi.update.mockResolvedValue({});
  render(<MyTasks />);
  await screen.findAllByText("Call hot leads");
  fireEvent.click(screen.getAllByRole("button", { name: "Start" })[0]);
  await waitFor(() => expect(myTaskApi.update).toHaveBeenCalledWith(1, { status: "in_progress", progress: 10 }));
  fireEvent.change(screen.getAllByLabelText("Progress for Send quotes")[0], { target: { value: "75" } });
  await waitFor(() => expect(myTaskApi.update).toHaveBeenCalledWith(2, { progress: 75 }));
  fireEvent.click(screen.getAllByRole("button", { name: "Complete" })[0]);
  await waitFor(() => expect(myTaskApi.update).toHaveBeenCalledWith(2, { status: "completed" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Reopen" })[0]);
  await waitFor(() => expect(myTaskApi.update).toHaveBeenCalledWith(3, { status: "in_progress", progress: 90 }));
  expect(screen.queryByRole("button", { name: /edit|delete/i })).toBeNull();
});

test("tabs ask the server for the matching view", async () => {
  render(<MyTasks />);
  await screen.findAllByText("Call hot leads");
  fireEvent.click(screen.getByRole("tab", { name: "Overdue" }));
  await waitFor(() => expect(myTaskApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ overdue: true })));
  fireEvent.click(screen.getByRole("tab", { name: "Completed" }));
  await waitFor(() => expect(myTaskApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: "completed" })));
});

test("empty state and server errors are shown, not swallowed", async () => {
  myTaskApi.list.mockResolvedValueOnce({ tasks: [], total: 0 });
  const { unmount } = render(<MyTasks />);
  expect(await screen.findByText("You have no tasks assigned yet.")).toBeInTheDocument();
  unmount();
  myTaskApi.list.mockRejectedValueOnce({ response: { data: { message: "Insufficient permissions." } } });
  render(<MyTasks />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Insufficient permissions.");
});
