import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  shouldShowTimestampManager,
  cleanupTimestampManager,
  initTimestampManager,
} from "../src/lifecycle.js";
import { ui } from "../src/ui.js";
import { drag } from "../src/drag.js";
import { handlers } from "../src/handlers.js";
import { progressMarkers } from "../src/progressMarkers.js";
import { elements, state } from "../src/state.js";
import { createPane, resetEnvironment, stubVideo } from "./helpers/dom.js";

const atUrl = (href) => vi.stubGlobal("location", { href, search: "" });

// A pending observer now lives in `state.observer`, so tests reach it through
// state instead of shadowing MutationObserver to collect handles. It has to be
// disconnected here and not only in resetEnvironment(): the last test of the
// file has no next beforeEach, and its observer would fire after jsdom is gone.
beforeEach(() => {
  resetEnvironment();
});

afterEach(() => {
  state.observer?.disconnect();
  state.observer = null;
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

  // O modal está no `body`, não dentro do painel, então sair junto não é de graça.
  it("takes the settings modal down with the pane", () => {
    createPane();
    ui.openSettingsModal();
    expect(document.querySelector("#ytts-settings-modal")).not.toBeNull();

    cleanupTimestampManager();
    expect(document.querySelector("#ytts-settings-modal")).toBeNull();
  });

  // Deixado para trás, o modal órfão travaria o ⚙️ do painel seguinte, porque
  // openSettingsModal desiste quando já existe um na página.
  it("lets the settings modal open again after a navigation", () => {
    createPane();
    ui.openSettingsModal();
    const stale = document.querySelector("#ytts-settings-modal");
    cleanupTimestampManager();

    createPane();
    ui.openSettingsModal();
    const fresh = document.querySelector("#ytts-settings-modal");

    // Não basta haver um modal: o órfão preso na página também satisfaria isso,
    // e é justamente ele que faz openSettingsModal desistir. Tem de ser outro.
    expect(fresh).not.toBeNull();
    expect(fresh).not.toBe(stale);
  });

  it("no-ops when no modal is open", () => {
    createPane();
    expect(() => cleanupTimestampManager()).not.toThrow();
  });

  // Every SPA navigation runs cleanup then init; without this the drag module
  // would stack one resize listener per visited video.
  it("shuts the drag module down", () => {
    createPane();
    const destroy = vi.spyOn(drag, "destroy");

    cleanupTimestampManager();
    expect(destroy).toHaveBeenCalled();
  });

  // Armed on a page whose <video> never showed up, the observer would fire on
  // any later mutation and mount a pane the navigation never asked for.
  it("disconnects the observer left waiting for the video", async () => {
    atUrl("https://www.youtube.com/watch?v=abc");
    const initSpy = vi.spyOn(ui, "init").mockImplementation(() => {});
    initTimestampManager();
    expect(state.observer).not.toBeNull();

    cleanupTimestampManager();
    expect(state.observer).toBeNull();

    document.body.appendChild(document.createElement("video"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(initSpy).not.toHaveBeenCalled();
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

  // The path that stacked panes: leave a watch page before its <video> loads,
  // come back to another one, and the first observer was still armed.
  it("does not let an observer from an earlier page mount a second pane", async () => {
    initTimestampManager();
    atUrl("https://www.youtube.com/feed/subscriptions");
    initTimestampManager();

    atUrl("https://www.youtube.com/watch?v=xyz");
    document.body.appendChild(document.createElement("video"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(initSpy).not.toHaveBeenCalled();
  });

  it("does not mount if navigation left the video page while waiting", async () => {
    initTimestampManager();
    atUrl("https://www.youtube.com/feed/subscriptions");

    document.body.appendChild(document.createElement("video"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(initSpy).not.toHaveBeenCalled();
  });
});
