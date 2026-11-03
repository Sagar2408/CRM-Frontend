import React from "react";
import { render, cleanup } from "@testing-library/react";
import Chat from "./Chat";

// Regression tests for Phase 5 (SECURITY_AUDIT.md FRONT-005): the
// Botpress widget script is injected via document.createElement
// rather than a static <script> tag, so its only verifiable
// properties are the ones this component actually sets. These tests
// confirm the deliberate SRI decision (documented in Chat.js) didn't
// regress into something worse — no integrity hash that would break
// on the vendor's next CDN update, but still only ever loading from
// Botpress's real origin, over HTTPS, with crossOrigin set.

jest.mock("jwt-decode", () => ({
  jwtDecode: () => ({ id: "executive-1", name: "Test Executive" }),
}));

describe("Chat — Botpress script injection", () => {
  afterEach(() => {
    cleanup();
    document.querySelectorAll('script[src*="botpress"]').forEach((el) => el.remove());
  });

  it("injects the Botpress script from exactly cdn.botpress.cloud, with no SRI hash and crossOrigin set", () => {
    render(<Chat token="signed-token" enableBotpress={true} />);

    const script = document.querySelector('script[src*="botpress"]');
    expect(script).not.toBeNull();
    expect(script.src).toBe("https://cdn.botpress.cloud/webchat/v3.0/webchat.js");
    expect(script.crossOrigin).toBe("anonymous");
    // No fixed integrity hash — a real one would break the next time
    // Botpress updates this CDN path (see the comment in Chat.js for
    // why that trade-off was made deliberately, not an oversight).
    expect(script.integrity).toBeFalsy();
  });

  it("never injects the Botpress script when the caller disables it (e.g. the in-app ChatbotAssistantModal)", () => {
    render(<Chat token="signed-token" enableBotpress={false} />);

    expect(document.querySelector('script[src*="botpress"]')).toBeNull();
  });
});
