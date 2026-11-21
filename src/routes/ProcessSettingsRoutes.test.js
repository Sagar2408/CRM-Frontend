// Regression: Process Person Settings tabs used to append /profile, /theme ... forever
// (/process/process-settings/profile/profile/...). Uses the REAL router, nested exactly like the app
// (/process/* -> process-settings/*).
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";

// CRA's Jest cannot resolve react-router's "react-router/dom" subpath; point it at the package file.
jest.mock("react-router/dom", () => require("react-router/dist/development/dom-export.js"), { virtual: true });

jest.mock("../features/admin/ThemeContext", () => {
  const R = require("react");
  return { ThemeContext: R.createContext({ theme: "light" }) };
});
jest.mock("../context/LoadingContext", () => ({ useLoading: () => ({ isLoading: false, loadingText: "" }) }));
jest.mock("../features/spinner/LoadingSpinner", () => () => null);
jest.mock("../features/admin-settings/RequirePermission", () => ({ children }) => children);
jest.mock("../features/process-client/ProcessMyProfile", () => () => <div>page-profile</div>);
jest.mock("../features/settings/Theme", () => () => <div>page-theme</div>);
jest.mock("../features/settings/BeepSound", () => () => <div>page-beep</div>);
jest.mock("../features/settings/EmployeeLeave", () => () => <div>page-leave</div>);
jest.mock("../features/process-client/ProcessDocumentSettings", () => () => <div>page-documents</div>);
jest.mock("../features/process-client/ProcessClientAccessSettings", () => () => <div>page-client-access</div>);

// jsdom lacks TextEncoder, which react-router needs at load time
const util = require("util");
global.TextEncoder = global.TextEncoder || util.TextEncoder;
global.TextDecoder = global.TextDecoder || util.TextDecoder;

const { MemoryRouter, Routes, Route, useLocation, useNavigate } = require("react-router-dom");
const ProcessSettingsRoutes = require("./ProcessSettingsRoutes").default;

const visited = [];
let nav;
function Probe() {
  const location = useLocation();
  nav = useNavigate();
  visited.push(location.pathname);
  return <div data-testid="path">{location.pathname}</div>;
}

const mount = (url) => {
  visited.length = 0;
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Probe />
      <Routes>
        <Route
          path="/process/*"
          element={
            <Routes>
              <Route path="process-settings/*" element={<ProcessSettingsRoutes />} />
            </Routes>
          }
        />
      </Routes>
    </MemoryRouter>
  );
};

const BASE = "/process/process-settings";
const TABS = [
  { label: "My Profile", path: "profile", page: "page-profile" },
  { label: "Theme", path: "theme", page: "page-theme" },
  { label: "Change in Beep", path: "change-beep", page: "page-beep" },
  { label: "Ask for Leave", path: "leave", page: "page-leave" },
  { label: "Documents", path: "documents", page: "page-documents" },
  { label: "Client Portal Access Password", path: "client-access", page: "page-client-access" },
];
const pathname = () => screen.getByTestId("path").textContent;
const tab = (label) => screen.getByRole("link", { name: new RegExp(label) });

describe("Process Person Settings navigation", () => {
  test("all six tab links are absolute", () => {
    mount(`${BASE}/profile`);
    expect(TABS.map((t) => tab(t.label).getAttribute("href"))).toEqual(TABS.map((t) => `${BASE}/${t.path}`));
  });

  test("clicking every tab, in every order, lands on exactly /process/process-settings/<tab>", () => {
    mount(`${BASE}/profile`);
    for (const from of TABS) {
      for (const to of TABS) {
        fireEvent.click(tab(from.label));
        fireEvent.click(tab(to.label));
        expect(pathname()).toBe(`${BASE}/${to.path}`);
        expect(screen.getByText(to.page)).toBeInTheDocument();
      }
    }
    expect(visited.every((p) => TABS.some((t) => p === `${BASE}/${t.path}`))).toBe(true);
    expect(visited.some((p) => /(profile|theme|leave|documents|change-beep|client-access).*\/(profile|theme|leave|documents|change-beep|client-access)/.test(p))).toBe(false);
  });

  test("one click is exactly one navigation (no loop, no repeated redirects)", () => {
    mount(`${BASE}/profile`);
    const before = visited.length;
    fireEvent.click(tab("Theme"));
    expect(visited.slice(before)).toEqual([`${BASE}/theme`]);
    fireEvent.click(tab("Documents"));
    expect(visited.slice(before)).toEqual([`${BASE}/theme`, `${BASE}/documents`]);
  });

  test("direct / refreshed URL works for every tab", () => {
    for (const t of TABS) {
      const { unmount } = mount(`${BASE}/${t.path}`);
      expect(pathname()).toBe(`${BASE}/${t.path}`);
      expect(screen.getByText(t.page)).toBeInTheDocument();
      expect(visited).toEqual([`${BASE}/${t.path}`]);
      unmount();
    }
  });

  test("bare /process-settings and unknown or already-doubled paths settle on /profile once", () => {
    for (const url of [BASE, `${BASE}/`, `${BASE}/nope`, `${BASE}/profile/profile/profile`, `${BASE}/theme/theme`]) {
      const { unmount } = mount(url);
      expect(pathname()).toBe(`${BASE}/profile`);
      expect(visited.filter((p) => p === `${BASE}/profile`).length).toBeLessThanOrEqual(2);
      expect(visited.length).toBeLessThanOrEqual(2);
      unmount();
    }
  });

  test("browser back / forward move through the tabs visited", () => {
    mount(`${BASE}/profile`);
    fireEvent.click(tab("Theme"));
    fireEvent.click(tab("Ask for Leave"));
    fireEvent.click(tab("Documents"));
    act(() => nav(-1));
    expect(pathname()).toBe(`${BASE}/leave`);
    act(() => nav(-1));
    expect(pathname()).toBe(`${BASE}/theme`);
    act(() => nav(1));
    expect(pathname()).toBe(`${BASE}/leave`);
    expect(screen.getByText("page-leave")).toBeInTheDocument();
  });

  test("the active tab is highlighted", () => {
    mount(`${BASE}/change-beep`);
    expect(tab("Change in Beep").className).toContain("active");
    expect(tab("Theme").className).not.toContain("active");
  });
});
