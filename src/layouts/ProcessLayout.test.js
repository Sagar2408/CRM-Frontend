import React from "react";
import { render, screen } from "@testing-library/react";
import ProcessLayout from "./ProcessLayout";

jest.mock("react-router-dom", () => ({ Outlet: () => <div>page</div> }));
jest.mock("../context/LoadingContext", () => ({ useLoading: () => ({ isLoading: false, loadingText: "" }) }));
jest.mock("../features/spinner/LoadingSpinner", () => () => null);
jest.mock("../features/process-client/useProcessWorkClock", () => () => ({ loaded: true }));
jest.mock("./ProcessSidebarNavbar", () => ({ portal }) => <nav data-testid="sidebar" data-portal={String(!!portal)} />);

beforeEach(() => localStorage.clear());

test("the shared layout always renders the sidebar/header around the page", () => {
  render(<ProcessLayout />);
  expect(screen.getByTestId("sidebar")).toHaveAttribute("data-portal", "false");
  expect(screen.getByText("page")).toBeInTheDocument();
});

test("portal layout keeps the sidebar (portal menu) next to the client pages", () => {
  const { container } = render(<ProcessLayout portal />);
  expect(screen.getByTestId("sidebar")).toHaveAttribute("data-portal", "true");
  expect(screen.getByText("page")).toBeInTheDocument();
  expect(container.querySelector(".exec-shell-root")).toBeInTheDocument();
});
