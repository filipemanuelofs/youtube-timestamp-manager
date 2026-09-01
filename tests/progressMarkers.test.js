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

  it("draws the pins on the retry that finally finds the progress bar", () => {
    vi.useFakeTimers();
    stubVideo({ duration: 200 });
    ui.createTimestampItem(50);

    progressMarkers.init();
    expect(progressMarkers.markersContainer).toBeNull();

    createProgressBar();
    vi.advanceTimersByTime(1000);
    expect(markers()).toHaveLength(1);
  });
});

describe("updateMarkers without a container", () => {
  it("gives up instead of recursing into init", () => {
    vi.useFakeTimers();
    stubVideo({ duration: 200 });
    ui.createTimestampItem(50);
    progressMarkers.destroy();

    // Sem esta guarda, `updateMarkers` chamaria `init()`, que chamaria
    // `updateMarkers` de volta enquanto a barra de progresso não existisse:
    // `RangeError: Maximum call stack size exceeded`, mais um `setTimeout`
    // de retentativa por nível da recursão.
    expect(() => progressMarkers.updateMarkers()).not.toThrow();
    expect(progressMarkers.markersContainer).toBeNull();
    // Uma retentativa agendada, não uma por nível de recursão.
    expect(vi.getTimerCount()).toBe(1);
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

describe("marker shape and colour", () => {
  const marker = () => document.querySelector(".ytts-marker");

  beforeEach(() => {
    createProgressBar();
    stubVideo({ duration: 200 });
    progressMarkers.createMarkersContainer();
    ui.createTimestampItem(50);
  });

  it("draws the red bar when nothing is configured", () => {
    progressMarkers.updateMarkers();

    expect(marker().textContent).toBe("");
    expect(marker().style.width).toBe("3px");
    expect(marker().style.height).toBe("12px");
    expect(marker().style.backgroundColor).toBe("rgb(255, 107, 107)");
    expect(marker().style.boxShadow).toBe("0 0 4px rgba(255, 107, 107, 0.6)");
  });

  it("draws the configured glyph in the configured colour", () => {
    localStorage.setItem("ytts_marker_shape", "star");
    localStorage.setItem("ytts_marker_color", "#00ff00");
    progressMarkers.updateMarkers();

    expect(marker().textContent).toBe("★");
    expect(marker().style.color).toBe("rgb(0, 255, 0)");
    expect(marker().style.textShadow).toBe("0 0 4px rgba(0, 255, 0, 0.6)");
    expect(marker().style.backgroundColor).toBe("");
  });

  it("draws the bar in the configured colour", () => {
    localStorage.setItem("ytts_marker_color", "#00ff00");
    progressMarkers.updateMarkers();

    expect(marker().textContent).toBe("");
    expect(marker().style.backgroundColor).toBe("rgb(0, 255, 0)");
    expect(marker().style.boxShadow).toBe("0 0 4px rgba(0, 255, 0, 0.6)");
  });

  it("grows the bar on hover and restores the configured colour on leave", () => {
    localStorage.setItem("ytts_marker_color", "#00ff00");
    progressMarkers.updateMarkers();
    const wrapper = markers()[0];

    wrapper.dispatchEvent(new MouseEvent("mouseenter"));
    expect(marker().style.width).toBe("4px");
    expect(marker().style.height).toBe("16px");
    expect(marker().style.filter).toBe("brightness(1.2)");
    expect(marker().style.boxShadow).toBe("0 0 8px rgba(0, 255, 0, 0.8)");

    wrapper.dispatchEvent(new MouseEvent("mouseleave"));
    expect(marker().style.width).toBe("3px");
    expect(marker().style.height).toBe("12px");
    expect(marker().style.filter).toBe("");
    expect(marker().style.backgroundColor).toBe("rgb(0, 255, 0)");
    expect(marker().style.boxShadow).toBe("0 0 4px rgba(0, 255, 0, 0.6)");
  });

  it("scales the glyph on hover without losing its centring", () => {
    localStorage.setItem("ytts_marker_shape", "arrow");
    localStorage.setItem("ytts_marker_color", "#00ff00");
    progressMarkers.updateMarkers();
    const wrapper = markers()[0];

    expect(marker().textContent).toBe("▼");

    wrapper.dispatchEvent(new MouseEvent("mouseenter"));
    expect(marker().style.transform).toBe("translate(-50%, -50%) scale(1.25)");
    expect(marker().style.filter).toBe("brightness(1.2)");
    expect(marker().style.textShadow).toBe("0 0 8px rgba(0, 255, 0, 0.8)");

    wrapper.dispatchEvent(new MouseEvent("mouseleave"));
    expect(marker().style.transform).toBe("translate(-50%, -50%)");
    expect(marker().style.filter).toBe("");
    expect(marker().style.color).toBe("rgb(0, 255, 0)");
    expect(marker().style.textShadow).toBe("0 0 4px rgba(0, 255, 0, 0.6)");
  });

  it("draws the cross glyph", () => {
    localStorage.setItem("ytts_marker_shape", "cross");
    progressMarkers.updateMarkers();
    expect(marker().textContent).toBe("✕");
  });

  it("redraws when only the colour changed", () => {
    progressMarkers.updateMarkers();
    expect(marker().style.backgroundColor).toBe("rgb(255, 107, 107)");

    localStorage.setItem("ytts_marker_color", "#00ff00");
    progressMarkers.updateMarkers();
    expect(marker().style.backgroundColor).toBe("rgb(0, 255, 0)");
  });

  it("redraws when only the shape changed", () => {
    progressMarkers.updateMarkers();
    expect(marker().textContent).toBe("");

    localStorage.setItem("ytts_marker_shape", "star");
    progressMarkers.updateMarkers();
    expect(marker().textContent).toBe("★");
  });

  it("falls back to the bar for a corrupted shape", () => {
    localStorage.setItem("ytts_marker_shape", "triangle");
    progressMarkers.updateMarkers();

    expect(marker().textContent).toBe("");
    expect(marker().style.backgroundColor).toBe("rgb(255, 107, 107)");
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
