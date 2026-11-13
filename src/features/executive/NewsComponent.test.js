import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NewsComponent, { formatNewsDate } from "./NewsComponent";
import * as api from "../../services/apiService";

jest.mock("../../services/apiService", () => ({
  fetchNewsSources: jest.fn(),
  fetchImmigrationNews: jest.fn(),
}));

const sources = [
  { key: "cic", label: "CIC News", country: "Canada", website: "https://www.cicnews.com" },
  { key: "australia", label: "Home Affairs - Australia", country: "Australia", website: "https://immi.homeaffairs.gov.au" },
];

beforeEach(() => {
  localStorage.clear();
  api.fetchNewsSources.mockResolvedValue({ default: "cic", sources });
  api.fetchImmigrationNews.mockImplementation(async (key) =>
    key === "cic"
      ? {
          source: sources[0],
          stale: false,
          items: [{ title: "Express Entry draw", link: "https://www.cicnews.com/a", publishedAt: "2026-06-02T10:00:00.000Z", summary: "Invitations issued" }],
        }
      : {
          source: sources[1],
          stale: true,
          fetchedAt: "2026-06-01T00:00:00.000Z",
          items: [{ title: "Student visa changes", link: "https://example.gov.au/b", publishedAt: "2026-06-03T10:00:00.000Z", summary: "" }],
        }
  );
});

test("loads CIC News by default with dated links that open the source in a new tab", async () => {
  render(<NewsComponent />);
  const link = await screen.findByRole("link", { name: "Express Entry draw" });
  expect(api.fetchImmigrationNews).toHaveBeenCalledWith("cic");
  expect(link).toHaveAttribute("href", "https://www.cicnews.com/a");
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  expect(screen.getByText(formatNewsDate("2026-06-02T10:00:00.000Z"))).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /CIC News/ })).toHaveAttribute("aria-selected", "true");
});

test("switching source loads that source, remembers the choice and flags stale data", async () => {
  render(<NewsComponent />);
  await screen.findByText("Express Entry draw");
  fireEvent.click(screen.getByRole("tab", { name: /Home Affairs - Australia/ }));
  expect(await screen.findByText("Student visa changes")).toBeInTheDocument();
  expect(api.fetchImmigrationNews).toHaveBeenLastCalledWith("australia");
  expect(screen.getByRole("status")).toHaveTextContent(/not responding/);
  expect(localStorage.getItem("crm.newsSource")).toBe("australia");
});

test("restores the previously chosen source", async () => {
  localStorage.setItem("crm.newsSource", "australia");
  render(<NewsComponent />);
  expect(await screen.findByText("Student visa changes")).toBeInTheDocument();
});

test("shows a retryable error instead of a blank section when the feed fails", async () => {
  api.fetchImmigrationNews.mockRejectedValueOnce({ response: { data: { message: "News source is temporarily unavailable." } } });
  render(<NewsComponent />);
  expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.getByText("Express Entry draw")).toBeInTheDocument());
});
