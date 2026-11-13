import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ExecutiveLayout, { SIDEBAR_PREF_KEY } from "./ExecutiveLayout";

jest.mock("react-router-dom", () => ({ Outlet: () => <div>page</div> }));
jest.mock("../context/LoadingContext", () => ({ useLoading: () => ({ isLoading: false, loadingText: "" }) }));
jest.mock("../features/spinner/LoadingSpinner", () => () => null);
jest.mock("./SidebarandNavbar", () => ({ collapsed, onToggleCollapse }) => (
  <button onClick={onToggleCollapse}>{collapsed ? "collapsed" : "expanded"}</button>
));

const root = (container) => container.querySelector(".exec-shell-root");

beforeEach(() => localStorage.clear());

test("defaults to expanded", () => {
  const { container } = render(<ExecutiveLayout />);
  expect(root(container)).not.toHaveClass("is-collapsed");
  expect(screen.getByRole("button")).toHaveTextContent("expanded");
});

test("a saved preference is applied on the very first render (no expand-then-collapse jump)", () => {
  localStorage.setItem(SIDEBAR_PREF_KEY, "1");
  const { container } = render(<ExecutiveLayout />);
  expect(root(container)).toHaveClass("is-collapsed");
});

test("toggling collapses, expands again, and persists the preference", () => {
  const { container } = render(<ExecutiveLayout />);
  fireEvent.click(screen.getByRole("button"));
  expect(root(container)).toHaveClass("is-collapsed");
  expect(localStorage.getItem(SIDEBAR_PREF_KEY)).toBe("1");
  fireEvent.click(screen.getByRole("button"));
  expect(root(container)).not.toHaveClass("is-collapsed");
  expect(localStorage.getItem(SIDEBAR_PREF_KEY)).toBe("0");
});

test("still works when localStorage is blocked", () => {
  const get = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const { container } = render(<ExecutiveLayout />);
  fireEvent.click(screen.getByRole("button"));
  expect(root(container)).toHaveClass("is-collapsed");
  get.mockRestore();
  set.mockRestore();
});
