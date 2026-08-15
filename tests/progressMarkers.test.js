import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { progressMarkers } from "../src/progressMarkers.js";
import { ui } from "../src/ui.js";
import {
  createPane,
  createProgressBar,
  resetEnvironment,
  stubVideo,
  stubVideoId,
} from "./helpers/dom.js";

const markers = () =>
  document.querySelectorAll(".ytts-progress-markers .ytts-marker-wrapper");

beforeEach(() => {
  resetEnvironment();
  progressMarkers.destroy();
  createPane();
  stubVideoId("vid1");
});

afterEach(() => {
  progressMarkers.destroy();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("createMarkersContainer", () => {
  it("mounts the container inside the YouTube progress bar", () => {
    const bar = createProgressBar();
    progressMarkers.createMarkersContainer();
    expect(bar.querySelector(".ytts-progress-markers")).toBe(
      progressMarkers.markersContainer,
    );
  });

  it("retries every second while the progress bar is missing", () => {
    vi.useFakeTimers();
    progressMarkers.createMarkersContainer();
    expect(progressMarkers.markersContainer).toBeNull();

    createProgressBar();
    vi.advanceTimersByTime(1000);
    expect(progressMarkers.markersContainer).not.toBeNull();
  });

  it("replaces a previous container instead of stacking them", () => {
    const bar = createProgressBar();
    progressMarkers.createMarkersContainer();
    progressMarkers.createMarkersContainer();
    expect(bar.querySelectorAll(".ytts-progress-markers")).toHaveLength(1);
  });
});

describe("getCurrentTimestamps", () => {
  it("reads time and note from each list row", () => {
    ui.createTimestampItem(10, "intro");
    ui.createTimestampItem(70, "");
    expect(progressMarkers.getCurrentTimestamps()).toEqual([
      { time: 10, note: "intro" },
      { time: 70, note: "" },
    ]);
  });

  it("skips the now-playing row and rows without a time", () => {
    const orphan = document.createElement("li");
    orphan.appendChild(document.createElement("a"));
    document.querySelector("#ytls-pane ul").prepend(orphan);

    expect(progressMarkers.getCurrentTimestamps()).toEqual([]);
  });
});

describe("updateMarkers", () => {
  beforeEach(() => {
    createProgressBar();
    stubVideo({ duration: 200 });
    progressMarkers.createMarkersContainer();
  });

  it("draws one pin per timestamp, positioned by percentage", () => {
    ui.createTimestampItem(50, "half of one");
    ui.createTimestampItem(100, "");
    progressMarkers.updateMarkers();

    expect(markers()).toHaveLength(2);
    expect(markers()[0].style.left).toBe("25%");
    expect(markers()[1].style.left).toBe("50%");
  });

  it("labels the tooltip with time and note", () => {
    ui.createTimestampItem(65, "chorus");
    progressMarkers.updateMarkers();
    expect(markers()[0].querySelector(".ytts-marker-tooltip").textContent).toBe(
      "1:05 - chorus",
    );
  });

  it("labels the tooltip with the time alone when there is no note", () => {
    ui.createTimestampItem(65);
    progressMarkers.updateMarkers();
    expect(markers()[0].querySelector(".ytts-marker-tooltip").textContent).toBe(
      "1:05",
    );
  });

  it("redraws instead of appending when the timestamps change", () => {
    ui.createTimestampItem(50);
    progressMarkers.updateMarkers();
    ui.createTimestampItem(100);
    progressMarkers.updateMarkers();
    expect(markers()).toHaveLength(2);
  });

  it("skips the redraw when nothing changed", () => {
    ui.createTimestampItem(50);
    progressMarkers.updateMarkers();
    const first = markers()[0];

    progressMarkers.updateMarkers();
    expect(markers()[0]).toBe(first);
  });

  it("bails out while the video duration is unknown", () => {
    stubVideo({ duration: 0 });
    ui.createTimestampItem(50);
    progressMarkers.updateMarkers();
    expect(markers()).toHaveLength(0);
  });

  it("initialises itself when called before init", () => {
    progressMarkers.destroy();
    ui.createTimestampItem(50);
    progressMarkers.updateMarkers();
    expect(markers()).toHaveLength(1);
  });

  it("seeks the video when a pin is clicked", () => {
    const video = stubVideo({ currentTime: 0, duration: 200 });
    ui.createTimestampItem(50);
    progressMarkers.updateMarkers();

    markers()[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(video.currentTime).toBe(50);
  });

  it("keeps the click off the YouTube progress bar underneath", () => {
    const barClick = vi.fn();
    document
      .querySelector(".ytp-progress-bar-container")
      .addEventListener("click", barClick);
    ui.createTimestampItem(50);
    progressMarkers.updateMarkers();

    markers()[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(barClick).not.toHaveBeenCalled();
  });

  it("reveals the tooltip on hover and hides it on leave", () => {
    ui.createTimestampItem(50);
    progressMarkers.updateMarkers();
    const wrapper = markers()[0];
    const tooltip = wrapper.querySelector(".ytts-marker-tooltip");

    wrapper.dispatchEvent(new MouseEvent("mouseenter"));
    expect(tooltip.style.visibility).toBe("visible");
    expect(tooltip.style.opacity).toBe("1");

    wrapper.dispatchEvent(new MouseEvent("mouseleave"));
    expect(tooltip.style.visibility).toBe("hidden");
    expect(tooltip.style.opacity).toBe("0");
  });
});

describe("destroy", () => {
  it("removes the container and clears the redraw cache", () => {
    createProgressBar();
    stubVideo({ duration: 200 });
    ui.createTimestampItem(50);
    progressMarkers.init();
    expect(markers()).toHaveLength(1);

    progressMarkers.destroy();
    expect(document.querySelector(".ytts-progress-markers")).toBeNull();
    expect(progressMarkers.markersContainer).toBeNull();

    progressMarkers.init();
    expect(markers()).toHaveLength(1);
  });

  it("is safe to call twice", () => {
    progressMarkers.destroy();
    expect(() => progressMarkers.destroy()).not.toThrow();
  });
});
