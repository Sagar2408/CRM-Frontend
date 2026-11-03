import fs from "fs";
import path from "path";
import React from "react";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import BeepNotification, { POPUP_AUTO_DISMISS_MS } from "./BeepNotification";
import { BeepSettingsContext } from "./context/BeepSettingsContext";
import { __trackedGenerator } from "./features/settings/SoundGenerator";

// Regression tests for the executive "new lead" notification UX fix:
// - the popup used to sit at top:20px, directly over the notification
//   bell (which lives inside the 70px-tall sticky .navbar);
// - the sound used to repeat on a setInterval for as long as the popup
//   was shown, and the popup itself was rescheduled (with another sound)
//   every reminderDelay seconds forever while anything stayed unread —
//   together, an unbounded "continuous buzzer" rather than a short alert.

jest.mock("./features/settings/SoundGenerator", () => {
  const trackedGenerator = jest.fn().mockResolvedValue(undefined);
  // A real class (not a jest.fn() mockImplementation) — `new` on an arrow
  // function that returns a plain object does not reliably give back that
  // object through jest's mock constructor plumbing, so `.close` ends up
  // missing on the instance. A real class avoids that entirely.
  class MockSoundGenerator {
    close() {}
  }
  return {
    __trackedGenerator: trackedGenerator,
    SoundGenerator: MockSoundGenerator,
    soundOptions: [
      { id: "beep1", name: "Classic Beep", generator: () => trackedGenerator() },
    ],
  };
});

const settingsValue = {
  settings: { enabled: true, selectedSound: "beep1", volume: 50 },
  setSettings: jest.fn(),
};

const renderWithSettings = (props) =>
  render(
    <BeepSettingsContext.Provider value={settingsValue}>
      <BeepNotification {...props} />
    </BeepSettingsContext.Provider>
  );

const rerenderWithSettings = (rerender, props) =>
  rerender(
    <BeepSettingsContext.Provider value={settingsValue}>
      <BeepNotification {...props} />
    </BeepSettingsContext.Provider>
  );

beforeEach(() => {
  jest.useFakeTimers();
  __trackedGenerator.mockClear();
});

afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("BeepNotification popup CSS — never overlaps the notification bell", () => {
  it("positions .beep-notification-overlay below the 70px sticky navbar, not at the old top:20px", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "styles", "beepNotification.css"),
      "utf8"
    );
    const overlayBlock = css.match(/\.beep-notification-overlay\s*\{([^}]*)\}/);
    expect(overlayBlock).not.toBeNull();
    const top = overlayBlock[1].match(/top:\s*(\d+)px/);
    expect(top).not.toBeNull();
    // sidebar.css's .navbar is 70px tall and sticky at top:0.
    expect(Number(top[1])).toBeGreaterThan(70);
  });
});

describe("BeepNotification — short alert, not a continuous buzzer", () => {
  it("plays exactly one sound and shows the popup for a new unread notification, then auto-dismisses", () => {
    renderWithSettings({
      notifications: [
        { id: 1, is_read: false, message: "You have been assigned a new lead: Acme Corp" },
      ],
      unreadCount: 1,
    });

    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(screen.getByText("New Lead Assignment")).toBeInTheDocument();
    expect(__trackedGenerator).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(POPUP_AUTO_DISMISS_MS);
    });

    expect(screen.queryByText("New Lead Assignment")).not.toBeInTheDocument();
  });

  it("never repeats the sound while the popup stays open (no recurring interval loop)", () => {
    renderWithSettings({
      notifications: [
        { id: 1, is_read: false, message: "You have been assigned a new lead: Acme Corp" },
      ],
      unreadCount: 1,
    });

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(__trackedGenerator).toHaveBeenCalledTimes(1);

    // Well past the old settings.timing-based repeat interval.
    act(() => {
      jest.advanceTimersByTime(20000);
    });
    expect(__trackedGenerator).toHaveBeenCalledTimes(1);
  });

  it("does not replay the sound when the same notification id reappears (duplicate event or re-fetch)", () => {
    const base = [
      { id: 1, is_read: false, message: "You have been assigned a new lead: Acme Corp" },
    ];
    const { rerender } = renderWithSettings({ notifications: base, unreadCount: 1 });

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(__trackedGenerator).toHaveBeenCalledTimes(1);

    rerenderWithSettings(rerender, { notifications: [...base], unreadCount: 1 });

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(__trackedGenerator).toHaveBeenCalledTimes(1);
  });

  it("coalesces several new unread notifications arriving close together into a single alert", () => {
    const { rerender } = renderWithSettings({
      notifications: [
        { id: 1, is_read: false, message: "You have been assigned a new lead: A" },
      ],
      unreadCount: 1,
    });

    act(() => {
      jest.advanceTimersByTime(100); // still inside the batch window
    });

    rerenderWithSettings(rerender, {
      notifications: [
        { id: 1, is_read: false, message: "You have been assigned a new lead: A" },
        { id: 2, is_read: false, message: "You have been assigned a new lead: B" },
      ],
      unreadCount: 2,
    });

    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(__trackedGenerator).toHaveBeenCalledTimes(1);
    expect(screen.getByText("2 new leads assigned")).toBeInTheDocument();
  });
});

describe("BeepNotification — bell/panel interaction", () => {
  it("hides the popup as soon as unreadCount reaches 0 (e.g. marked read from the notification panel)", () => {
    const { rerender } = renderWithSettings({
      notifications: [{ id: 1, is_read: false, message: "New notification" }],
      unreadCount: 1,
    });

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(screen.getByText("Notification Alert")).toBeInTheDocument();

    rerenderWithSettings(rerender, {
      notifications: [{ id: 1, is_read: true, message: "New notification" }],
      unreadCount: 0,
    });

    expect(screen.queryByText("Notification Alert")).not.toBeInTheDocument();
  });

  it('clicking "View Notification" calls onViewNotification and dismisses the popup', () => {
    const onViewNotification = jest.fn();
    renderWithSettings({
      notifications: [
        { id: 1, is_read: false, message: "You have been assigned a new lead: A" },
      ],
      unreadCount: 1,
      onViewNotification,
    });

    act(() => {
      jest.advanceTimersByTime(400);
    });

    fireEvent.click(screen.getByText("View Notification"));

    expect(onViewNotification).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("New Lead Assignment")).not.toBeInTheDocument();
  });

  it('clicking "Dismiss" calls onDismissPopup and hides the popup without marking anything read', () => {
    const onDismissPopup = jest.fn();
    renderWithSettings({
      notifications: [
        { id: 1, is_read: false, message: "You have been assigned a new lead: A" },
      ],
      unreadCount: 1,
      onDismissPopup,
    });

    act(() => {
      jest.advanceTimersByTime(400);
    });

    fireEvent.click(screen.getByText("Dismiss"));

    expect(onDismissPopup).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("New Lead Assignment")).not.toBeInTheDocument();
  });
});

describe("BeepNotification — cleanup", () => {
  it("does not throw when unmounted while a batched alert or auto-dismiss timer is still pending", () => {
    const { unmount } = renderWithSettings({
      notifications: [
        { id: 1, is_read: false, message: "You have been assigned a new lead: A" },
      ],
      unreadCount: 1,
    });

    unmount();

    expect(() => {
      act(() => {
        jest.advanceTimersByTime(10000);
      });
    }).not.toThrow();
  });
});
