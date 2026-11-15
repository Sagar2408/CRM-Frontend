import React, { useContext } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ThemeProvider, ThemeContext } from "../admin/ThemeContext";
import { BeepSettingsProvider, BeepSettingsContext, beepStorageKey, saveBeepSettings, loadBeepSettings } from "../../context/BeepSettingsContext";

const setUser = (u) => localStorage.setItem("user", JSON.stringify(u));

const ThemeProbe = () => {
  const { theme, changeTheme } = useContext(ThemeContext);
  return (
    <>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => changeTheme("dark")}>dark</button>
    </>
  );
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("Process Person theme", () => {
  test("choosing a theme changes the interface, is saved under a Process Person key, and is restored after a reload", () => {
    setUser({ id: 7, type: "processperson", fullName: "Pat" });
    const first = render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    fireEvent.click(screen.getByText("dark"));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("processTheme_7")).toBe("dark");
    first.unmount();

    document.documentElement.removeAttribute("data-theme");
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>); // "refresh"
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  test("does not share storage with an Executive who has the same id", () => {
    setUser({ id: 7, role: "Executive" });
    localStorage.setItem("executiveTheme_7", "green");
    setUser({ id: 7, type: "processperson" });
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    fireEvent.click(screen.getByText("dark"));
    expect(localStorage.getItem("executiveTheme_7")).toBe("green");
  });

  test("Executive behaviour is unchanged", () => {
    setUser({ id: 7, role: "Executive" });
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    fireEvent.click(screen.getByText("dark"));
    expect(localStorage.getItem("executiveTheme_7")).toBe("dark");
    expect(localStorage.getItem("processTheme_7")).toBeNull();
  });
});

describe("Process Person beep preferences", () => {
  test("saved per Process Person, separate from an Executive with the same id", () => {
    setUser({ id: 3, role: "Executive" });
    const execKey = beepStorageKey();
    setUser({ id: 3, type: "processperson" });
    expect(beepStorageKey()).not.toBe(execKey);
    expect(beepStorageKey()).toBe("beepSoundSettings_pp3");
  });

  test("reload() applies the saved sound, volume and reminder settings of the signed-in person to the provider", () => {
    let ctx;
    const Probe = () => {
      ctx = useContext(BeepSettingsContext);
      return null;
    };
    render(<BeepSettingsProvider><Probe /></BeepSettingsProvider>); // mounted before sign-in
    expect(ctx.settings.volume).toBe(50);

    setUser({ id: 9, type: "processperson" });
    saveBeepSettings({ selectedSound: "beep2", volume: 80, timing: 10, enabled: false, reminderDelay: 120 });
    act(() => ctx.reload());
    expect(ctx.settings).toEqual({ selectedSound: "beep2", volume: 80, timing: 10, enabled: false, reminderDelay: 120 });
    expect(loadBeepSettings()).toEqual(ctx.settings);
  });
});
