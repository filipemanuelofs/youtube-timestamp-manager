import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  shouldShowTimestampManager,
  cleanupTimestampManager,
  initTimestampManager,
} from "../src/lifecycle.js";
import { ui } from "../src/ui.js";
import { handlers } from "../src/handlers.js";
import { progressMarkers } from "../src/progressMarkers.js";
import { elements, state } from "../src/state.js";
import { createPane, resetEnvironment, stubVideo } from "./helpers/dom.js";

const atUrl = (href) => vi.stubGlobal("location", { href, search: "" });

// initTimestampManager leaves a MutationObserver running whenever the <video>
// never shows up; keep a handle on each one so tests can disconnect it.
const RealMutationObserver = globalThis.MutationObserver;
const observers = [];

beforeEach(() => {
  resetEnvironment();
  vi.stubGlobal(
    "MutationObserver",
    class extends RealMutationObserver {
      constructor(callback) {
        super(callback);
        observers.push(this);
      }
    },
  );
});

afterEach(() => {
  observers.forEach((observer) => observer.disconnect());
  observers.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("shouldShowTimestampManager", () => {
  it.each([
    "https://www.youtube.com/watch?v=abc",
    "https://www.youtube.com/live/abc",
    "https://www.youtube.com/shorts/abc",
    "https://m.youtube.com/watch?v=abc&t=30",
  ])("accepts %s", (href) => {
    atUrl(href);
    expect(shouldShowTimestampManager()).toBe(true);
  });

  it.each([
    "https://www.youtube.com/",
    "https://www.youtube.com/results?search_query=abc",
    "https://www.youtube.com/@channel",
    "https://www.youtube.com/feed/subscriptions",
  ])("rejects %s", (href) => {
    atUrl(href);
    expect(shouldShowTimestampManager()).toBe(false);
  });
});

describe("cleanupTimestampManager", () => {
  it("cancels the watchTime loop", () => {
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    state.nowid = 7;

    cleanupTimestampManager();
    expect(cancel).toHaveBeenCalledWith(7);
    expect(state.nowid).toBeNull();
  });

  it("removes the pane and destroys the markers", () => {
    createPane();
    const destroy = vi.spyOn(progressMarkers, "destroy");

    cleanupTimestampManager();
    expect(document.querySelector("#ytls-pane")).toBeNull();
    expect(elements.pane).toBeNull();
    expect(destroy).toHaveBeenCalled();
  });

  it("clears the cached video and video id so the next page re-resolves them", () => {
    stubVideo();
    state.videoId = "old";

    cleanupTimestampManager();
    expect(elements.video).toBeNull();
    expect(state.videoId).toBeNull();
  });

  it("detaches the unload listener", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    cleanupTimestampManager();
    expect(remove).toHaveBeenCalledWith("unload", handlers.warn);
  });

  it("is safe to call when nothing was ever initialised", () => {
    expect(() => cleanupTimestampManager()).not.toThrow();
  });
});

describe("initTimestampManager", () => {
  let initSpy;

  beforeEach(() => {
    initSpy = vi.spyOn(ui, "init").mockImplementation(() => {});
    atUrl("https://www.youtube.com/watch?v=abc");
  });

  it("mounts the pane when the video element is already there", () => {
    document.body.appendChild(document.createElement("video"));
    initTimestampManager();
    expect(initSpy).toHaveBeenCalledOnce();
  });

  it("tears down the previous instance before mounting a new one", () => {
    createPane();
    document.body.appendChild(document.createElement("video"));

    initTimestampManager();
    expect(document.querySelectorAll("#ytls-pane")).toHaveLength(0);
    expect(initSpy).toHaveBeenCalledOnce();
  });

  it("does nothing outside a video page", () => {
    atUrl("https://www.youtube.com/feed/subscriptions");
    document.body.appendChild(document.createElement("video"));

    initTimestampManager();
    expect(initSpy).not.toHaveBeenCalled();
  });

  it("waits for the video element to appear in the DOM", async () => {
    initTimestampManager();
    expect(initSpy).not.toHaveBeenCalled();

    document.body.appendChild(document.createElement("video"));
    await vi.waitFor(() => expect(initSpy).toHaveBeenCalledOnce());
  });

  it("stops observing after the first mount", async () => {
    initTimestampManager();
    document.body.appendChild(document.createElement("video"));
    await vi.waitFor(() => expect(initSpy).toHaveBeenCalledOnce());

    document.body.appendChild(document.createElement("div"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(initSpy).toHaveBeenCalledOnce();
  });

  it("does not mount if navigation left the video page while waiting", async () => {
    initTimestampManager();
    atUrl("https://www.youtube.com/feed/subscriptions");

    document.body.appendChild(document.createElement("video"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(initSpy).not.toHaveBeenCalled();
  });
});
