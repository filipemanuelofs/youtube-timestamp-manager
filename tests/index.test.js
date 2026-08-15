import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// src/index.js patches history and attaches navigation listeners on import, so
// every test re-imports it against a fresh module registry.
vi.mock("../src/lifecycle.js", () => ({
  shouldShowTimestampManager: vi.fn(() => true),
  initTimestampManager: vi.fn(),
  cleanupTimestampManager: vi.fn(),
}));

const WATCH = "/watch?v=abc";
const HOME = "/feed/subscriptions";

const pristinePushState = history.pushState;
const pristineReplaceState = history.replaceState;

let lifecycle;
let state;
let listeners = [];

/**
 * Imports the userscript against a fresh module graph, recording the globals it
 * patches so `afterEach` can undo them — otherwise each reload stacks another
 * history wrapper and another set of navigation listeners on the same window.
 */
async function loadUserscript() {
  vi.resetModules();
  history.pushState = pristinePushState;
  history.replaceState = pristineReplaceState;

  const trackers = [window, document].map((target) => {
    const original = target.addEventListener.bind(target);
    return vi.spyOn(target, "addEventListener").mockImplementation((...args) => {
      listeners.push([target, args]);
      original(...args);
    });
  });

  lifecycle = await import("../src/lifecycle.js");
  lifecycle.shouldShowTimestampManager.mockReturnValue(true);
  state = (await import("../src/state.js")).state;
  await import("../src/index.js");

  trackers.forEach((tracker) => tracker.mockRestore());
}

beforeEach(() => {
  history.replaceState.call(history, {}, "", WATCH);
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  listeners.forEach(([target, args]) => target.removeEventListener(...args));
  listeners = [];
  history.pushState = pristinePushState;
  history.replaceState = pristineReplaceState;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("startup", () => {
  it("initialises immediately when the document is already parsed", async () => {
    await loadUserscript();
    expect(lifecycle.initTimestampManager).toHaveBeenCalledOnce();
  });

  it("waits for DOMContentLoaded while the document is still loading", async () => {
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    await loadUserscript();
    expect(lifecycle.initTimestampManager).not.toHaveBeenCalled();

    vi.restoreAllMocks();
    document.dispatchEvent(new Event("DOMContentLoaded"));
    expect(lifecycle.initTimestampManager).toHaveBeenCalledOnce();
  });
});

describe("SPA navigation", () => {
  it("re-initialises after a pushState to another video", async () => {
    await loadUserscript();
    lifecycle.initTimestampManager.mockClear();

    history.pushState({}, "", "/watch?v=other");
    vi.advanceTimersByTime(100);
    expect(lifecycle.initTimestampManager).toHaveBeenCalledOnce();
  });

  it("tears down when navigating away from a video page", async () => {
    await loadUserscript();
    lifecycle.shouldShowTimestampManager.mockReturnValue(false);

    history.pushState({}, "", HOME);
    vi.advanceTimersByTime(100);
    expect(lifecycle.cleanupTimestampManager).toHaveBeenCalledOnce();
    expect(lifecycle.initTimestampManager).toHaveBeenCalledOnce(); // startup only
  });

  it("reacts to replaceState too", async () => {
    await loadUserscript();
    lifecycle.initTimestampManager.mockClear();

    history.replaceState({}, "", "/watch?v=replaced");
    vi.advanceTimersByTime(100);
    expect(lifecycle.initTimestampManager).toHaveBeenCalledOnce();
  });

  // The URL is moved with the pristine replaceState so the patched history
  // wrapper stays out of it and the event under test is the only trigger.
  const navigateSilently = (url) =>
    pristineReplaceState.call(history, {}, "", url);

  it("reacts to popstate", async () => {
    await loadUserscript();
    lifecycle.initTimestampManager.mockClear();

    navigateSilently("/watch?v=back");
    window.dispatchEvent(new PopStateEvent("popstate"));
    vi.advanceTimersByTime(100);
    expect(lifecycle.initTimestampManager).toHaveBeenCalledOnce();
  });

  it("reacts to yt-navigate-finish on window and on document", async () => {
    await loadUserscript();

    navigateSilently("/watch?v=win");
    lifecycle.initTimestampManager.mockClear();
    window.dispatchEvent(new Event("yt-navigate-finish"));
    vi.advanceTimersByTime(100);
    expect(lifecycle.initTimestampManager).toHaveBeenCalledOnce();

    navigateSilently("/watch?v=doc");
    lifecycle.initTimestampManager.mockClear();
    document.dispatchEvent(new Event("yt-navigate-finish"));
    vi.advanceTimersByTime(100);
    expect(lifecycle.initTimestampManager).toHaveBeenCalledOnce();
  });

  it("ignores events that did not change the URL", async () => {
    await loadUserscript();
    lifecycle.initTimestampManager.mockClear();

    window.dispatchEvent(new Event("yt-navigate-finish"));
    window.dispatchEvent(new PopStateEvent("popstate"));
    vi.advanceTimersByTime(100);
    expect(lifecycle.initTimestampManager).not.toHaveBeenCalled();
  });

  it("fires once when several hooks report the same navigation", async () => {
    await loadUserscript();
    lifecycle.initTimestampManager.mockClear();

    history.pushState({}, "", "/watch?v=dup");
    window.dispatchEvent(new Event("yt-navigate-finish"));
    document.dispatchEvent(new Event("yt-navigate-finish"));
    vi.advanceTimersByTime(100);
    expect(lifecycle.initTimestampManager).toHaveBeenCalledOnce();
  });

  it("drops the cached video id so the new page resolves its own", async () => {
    await loadUserscript();
    state.videoId = "stale";

    history.pushState({}, "", "/watch?v=fresh");
    expect(state.videoId).toBeNull();
  });

  it("still performs the real history navigation", async () => {
    await loadUserscript();
    history.pushState({}, "", "/watch?v=real");
    expect(location.pathname + location.search).toBe("/watch?v=real");
  });
});
