import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProfileAvatar, { useOwnPhotoUrl } from "./ProfileAvatar";
import * as api from "../../services/apiService";

jest.mock("../../services/apiService", () => ({ getOwnExecutivePhoto: jest.fn() }));

const Probe = ({ id, hasPhoto }) => {
  const url = useOwnPhotoUrl(id, hasPhoto);
  return <ProfileAvatar className="av" url={url} initial="D" alt="Dev photo" />;
};

beforeEach(() => {
  global.URL.createObjectURL = jest.fn(() => "blob:photo");
  global.URL.revokeObjectURL = jest.fn();
});

test("shows the photo fetched through the authenticated API", async () => {
  api.getOwnExecutivePhoto.mockResolvedValue(new Blob(["x"], { type: "image/png" }));
  render(<Probe id={2} hasPhoto />);
  const img = await screen.findByRole("img", { name: "Dev photo" });
  expect(img).toHaveAttribute("src", "blob:photo");
  expect(api.getOwnExecutivePhoto).toHaveBeenCalledTimes(1);
});

test("shows initials when there is no photo (404)", async () => {
  api.getOwnExecutivePhoto.mockRejectedValue({ response: { status: 404 } });
  const { container } = render(<Probe id={2} />);
  await waitFor(() => expect(api.getOwnExecutivePhoto).toHaveBeenCalled());
  expect(container.querySelector("img")).toBeNull();
  expect(container).toHaveTextContent("D");
});

test("does not call the API when the profile says there is no photo", () => {
  const { container } = render(<Probe id={2} hasPhoto={false} />);
  expect(api.getOwnExecutivePhoto).not.toHaveBeenCalled();
  expect(container).toHaveTextContent("D");
});

test("falls back to initials when the image fails to load", async () => {
  api.getOwnExecutivePhoto.mockResolvedValue(new Blob(["x"]));
  const { container } = render(<Probe id={2} hasPhoto />);
  fireEvent.error(await screen.findByRole("img", { name: "Dev photo" }));
  expect(container.querySelector("img")).toBeNull();
  expect(container).toHaveTextContent("D");
});

test("releases the object URL on unmount", async () => {
  api.getOwnExecutivePhoto.mockResolvedValue(new Blob(["x"]));
  const { unmount } = render(<Probe id={2} hasPhoto />);
  await screen.findByRole("img");
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo");
});

test("the photo is clipped to its avatar by global CSS, not by a page-specific wrapper", () => {
  // Regression: the img rules used to be scoped to .exec-shell-root, so any page rendered outside
  // that wrapper (the Settings routes) showed the photo at its natural size.
  const css = require("fs").readFileSync(require("path").join(__dirname, "../../styles/executiveHeader.css"), "utf8");
  const rule = /(^|\n)\.profile-avatar-img\s*\{[^}]*object-fit:\s*cover[^}]*max-width:\s*100%/;
  expect(css.replace(/\r\n/g, "\n")).toMatch(/(^|\n)\.profile-avatar-img\s*\{[\s\S]*?object-fit:\s*cover/);
  expect(css).not.toMatch(/\.exec-shell-root \.profile-avatar-img/);
  expect(rule.test(css.replace(/\r\n/g, "\n")) || /max-width:\s*100%/.test(css)).toBe(true);
});
