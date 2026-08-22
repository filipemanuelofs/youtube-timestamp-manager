import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { showNotification } from "../../src/utils/notification.js";

const toast = () => [...document.body.children].at(-1);

describe("showNotification", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("appends the message to the body", () => {
    showNotification("saved!");
    expect(toast().textContent).toBe("saved!");
  });

  it("slides in shortly after being appended", () => {
    // The off-screen start position comes from the inline cssText, which jsdom
    // drops on parse; only the scripted transition is observable here.
    showNotification("saved!");
    expect(toast().style.transform).not.toBe("translateX(0)");
    vi.advanceTimersByTime(10);
    expect(toast().style.transform).toBe("translateX(0)");
  });

  it("removes itself after the default duration plus the exit animation", () => {
    showNotification("saved!");
    vi.advanceTimersByTime(2000);
    expect(document.body.children).toHaveLength(1);
    vi.advanceTimersByTime(300);
    expect(document.body.children).toHaveLength(0);
  });

  it("honours a custom duration", () => {
    showNotification("quick", 500);
    vi.advanceTimersByTime(500 + 300);
    expect(document.body.children).toHaveLength(0);
  });

  it("replaces the previous notification instead of stacking on top of it", () => {
    showNotification("first", 500);
    showNotification("second", 2000);

    expect(document.body.children).toHaveLength(1);
    expect(toast().textContent).toBe("second");
  });

  it("keeps the survivor alive when the replaced one times out", () => {
    showNotification("first", 500);
    showNotification("second", 2000);
    vi.advanceTimersByTime(800);

    expect(document.body.children).toHaveLength(1);
    expect(toast().textContent).toBe("second");
  });

  it("mounts inside the fullscreen element while the player is fullscreen", () => {
    const player = document.createElement("div");
    document.body.appendChild(player);
    // jsdom implements no Fullscreen API, so the element is declared by hand.
    Object.defineProperty(document, "fullscreenElement", {
      value: player,
      configurable: true,
    });

    showNotification("saved!");
    expect(player.children).toHaveLength(1);
    expect(player.firstChild.textContent).toBe("saved!");

    delete document.fullscreenElement;
  });

  it("renders as text, never as HTML", () => {
    showNotification("<img src=x>");
    expect(toast().children).toHaveLength(0);
    expect(toast().textContent).toBe("<img src=x>");
  });
});
