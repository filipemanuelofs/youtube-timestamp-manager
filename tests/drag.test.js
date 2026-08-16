import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { drag } from "../src/drag.js";
import { createPane, resetEnvironment } from "./helpers/dom.js";

const POSITION_KEY = "ytts_pane_position";

/**
 * jsdom has no layout: offsetWidth/offsetHeight are always 0. Every test that
 * exercises the clamp through the DOM has to hand the pane its dimensions.
 */
const sizePane = (pane, width, height) => {
  Object.defineProperty(pane, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(pane, "offsetHeight", { value: height, configurable: true });
};

const pointer = (target, type, x, y) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      clientX: x,
      clientY: y,
      button: 0,
      pointerId: 1,
      bubbles: true,
      cancelable: true,
    }),
  );

const position = (pane) => [pane.style.left, pane.style.top];

beforeEach(() => {
  resetEnvironment();
});

afterEach(() => {
  drag.destroy();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("clampToViewport", () => {
  const viewport = { paneW: 300, paneH: 200, viewW: 1024, viewH: 768 };

  it("leaves a position that already fits untouched", () => {
    expect(drag.clampToViewport({ top: 100, left: 100, ...viewport })).toEqual({
      top: 100,
      left: 100,
    });
  });

  it("pins to the right and bottom edges", () => {
    expect(drag.clampToViewport({ top: 900, left: 2000, ...viewport })).toEqual({
      top: 568,
      left: 724,
    });
  });

  it("pins to the top and left edges", () => {
    expect(drag.clampToViewport({ top: -50, left: -80, ...viewport })).toEqual({
      top: 0,
      left: 0,
    });
  });

  it("falls back to the origin when the pane is larger than the viewport", () => {
    expect(
      drag.clampToViewport({
        top: 10,
        left: 10,
        paneW: 2000,
        paneH: 2000,
        viewW: 1024,
        viewH: 768,
      }),
    ).toEqual({ top: 0, left: 0 });
  });

  it("lands exactly on the edge, not one pixel past it", () => {
    expect(drag.clampToViewport({ top: 568, left: 724, ...viewport })).toEqual({
      top: 568,
      left: 724,
    });
  });
});

describe("getSavedPosition", () => {
  it("returns null when nothing was ever saved", () => {
    expect(drag.getSavedPosition()).toBeNull();
  });

  it("returns null on corrupted JSON", () => {
    localStorage.setItem(POSITION_KEY, "{not-json");
    expect(drag.getSavedPosition()).toBeNull();
  });

  it("returns null when the coordinates are not numbers", () => {
    localStorage.setItem(POSITION_KEY, JSON.stringify({ top: "10", left: 20 }));
    expect(drag.getSavedPosition()).toBeNull();
  });

  it("round-trips a saved position", () => {
    drag.savePosition(120, 340);
    expect(drag.getSavedPosition()).toEqual({ top: 120, left: 340 });
  });

  it("returns null after clearPosition", () => {
    drag.savePosition(120, 340);
    drag.clearPosition();
    expect(drag.getSavedPosition()).toBeNull();
  });
});

describe("init", () => {
  it("applies the saved position, clamped to the current viewport", () => {
    const pane = createPane();
    sizePane(pane, 300, 200);
    drag.savePosition(700, 900);

    drag.init(pane, pane.querySelector(".ytls-header"));

    expect(position(pane)).toEqual(["724px", "568px"]);
    expect(pane.classList.contains("moved")).toBe(true);
  });

  it("leaves the pane in the default corner when nothing was saved", () => {
    const pane = createPane();
    drag.init(pane, pane.querySelector(".ytls-header"));

    expect(position(pane)).toEqual(["", ""]);
    expect(pane.classList.contains("moved")).toBe(false);
  });

  // destroy() only knows how to remove the last listener it stored, so an init
  // that overwrote the previous one would strand it on the window for good.
  it("drops the previous resize listener when it runs twice", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const pane = createPane();
    const header = pane.querySelector(".ytls-header");

    drag.init(pane, header);
    const first = add.mock.calls.find(([type]) => type === "resize")[1];
    drag.init(pane, header);

    expect(remove.mock.calls).toContainEqual(["resize", first]);
  });
});

describe("dragging", () => {
  let pane;
  let header;

  beforeEach(() => {
    pane = createPane();
    header = pane.querySelector(".ytls-header");
    sizePane(pane, 300, 200);
    drag.init(pane, header);
  });

  it("follows the pointer and keeps the grab offset", () => {
    pointer(header, "pointerdown", 10, 10);
    pointer(window, "pointermove", 410, 310);

    expect(position(pane)).toEqual(["400px", "300px"]);
  });

  it("marks the pane while the gesture is running", () => {
    pointer(header, "pointerdown", 10, 10);
    expect(pane.classList.contains("dragging")).toBe(true);

    pointer(window, "pointerup", 10, 10);
    expect(pane.classList.contains("dragging")).toBe(false);
  });

  it("persists the position on pointerup", () => {
    pointer(header, "pointerdown", 10, 10);
    pointer(window, "pointermove", 410, 310);
    pointer(window, "pointerup", 410, 310);

    expect(drag.getSavedPosition()).toEqual({ top: 300, left: 400 });
  });

  it("persists what was already moved when the gesture is cancelled", () => {
    pointer(header, "pointerdown", 10, 10);
    pointer(window, "pointermove", 410, 310);
    pointer(window, "pointercancel", 410, 310);

    expect(drag.getSavedPosition()).toEqual({ top: 300, left: 400 });
  });

  it("saves nothing when the header is clicked without moving", () => {
    pointer(header, "pointerdown", 10, 10);
    pointer(window, "pointerup", 10, 10);

    expect(drag.getSavedPosition()).toBeNull();
  });

  it("never lets the pane leave the viewport", () => {
    pointer(header, "pointerdown", 10, 10);
    pointer(window, "pointermove", 5000, 5000);

    expect(position(pane)).toEqual(["724px", "568px"]);
  });

  it("stops following once the pointer is released", () => {
    pointer(header, "pointerdown", 10, 10);
    pointer(window, "pointermove", 410, 310);
    pointer(window, "pointerup", 410, 310);
    pointer(window, "pointermove", 600, 600);

    expect(position(pane)).toEqual(["400px", "300px"]);
  });

  // The handle is the only grab area left once the pane is minimized.
  it("drags from the handle", () => {
    pointer(header.querySelector("#ytts-drag-handle"), "pointerdown", 10, 10);
    pointer(window, "pointermove", 410, 310);

    expect(position(pane)).toEqual(["400px", "300px"]);
  });

  it("ignores a gesture started on an icon button", () => {
    const icon = document.createElement("span");
    icon.className = "ytts-icon-btn";
    header.appendChild(icon);

    pointer(icon, "pointerdown", 10, 10);
    pointer(window, "pointermove", 410, 310);

    expect(position(pane)).toEqual(["", ""]);
  });

  it("ignores a gesture started on the select-all checkbox", () => {
    pointer(header.querySelector("#ytts-select-all"), "pointerdown", 10, 10);
    pointer(window, "pointermove", 410, 310);

    expect(position(pane)).toEqual(["", ""]);
  });

  // A second finger on the header would otherwise recompute the grab offset
  // from itself and make the pane jump between the two touch points.
  it("ignores a second pointer landing mid-gesture", () => {
    pointer(header, "pointerdown", 10, 10);
    pointer(window, "pointermove", 410, 310);
    pointer(header, "pointerdown", 200, 200);
    pointer(window, "pointermove", 420, 320);

    expect(position(pane)).toEqual(["410px", "310px"]);
  });

  // jsdom implements no pointer capture, so the release path only runs with
  // these stubs — and in a real browser it throws NotFoundError on cancel,
  // where the pointer is already gone.
  it("still persists the position when releasing the capture throws", () => {
    header.setPointerCapture = vi.fn();
    header.releasePointerCapture = vi.fn(() => {
      throw new DOMException("pointer is not active", "NotFoundError");
    });

    pointer(header, "pointerdown", 10, 10);
    pointer(window, "pointermove", 410, 310);
    pointer(window, "pointercancel", 410, 310);

    expect(header.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(drag.getSavedPosition()).toEqual({ top: 300, left: 400 });
    expect(pane.classList.contains("dragging")).toBe(false);
  });

  it("ignores secondary mouse buttons", () => {
    header.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 10,
        clientY: 10,
        button: 2,
        pointerId: 1,
        bubbles: true,
        cancelable: true,
      }),
    );
    pointer(window, "pointermove", 410, 310);

    expect(position(pane)).toEqual(["", ""]);
  });
});

describe("reclamp on resize", () => {
  let pane;

  beforeEach(() => {
    vi.useFakeTimers();
    pane = createPane();
    sizePane(pane, 300, 200);
    drag.savePosition(300, 400);
    drag.init(pane, pane.querySelector(".ytls-header"));
  });

  const shrinkTo = (width, height) => {
    vi.stubGlobal("innerWidth", width);
    vi.stubGlobal("innerHeight", height);
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(100);
  };

  // Saved at top 300 in a 768-tall window, so the pane sits 268px above the
  // floor and is bottom-anchored. A 400-tall window cannot keep that gap with a
  // 200-tall pane, so the clamp gives back as much of it as fits.
  it("pulls the pane back inside a smaller window", () => {
    shrinkTo(500, 400);
    expect(position(pane)).toEqual(["200px", "0px"]);
  });

  it("keeps a pane resting on the floor resting on the floor", () => {
    drag.destroy();
    pane = createPane();
    sizePane(pane, 300, 200);
    drag.savePosition(568, 100); // bottom edge on the viewport floor
    drag.init(pane, pane.querySelector(".ytls-header"));

    shrinkTo(500, 400);
    expect(position(pane)).toEqual(["100px", "200px"]);
  });

  it("keeps the saved position, so restoring the window restores the pane", () => {
    shrinkTo(500, 400);
    expect(drag.getSavedPosition()).toEqual({ top: 300, left: 400 });

    shrinkTo(1024, 768);
    expect(position(pane)).toEqual(["400px", "300px"]);
  });

  it("does nothing when no position was ever saved", () => {
    drag.clearPosition();
    drag.resetPosition();

    shrinkTo(500, 400);
    expect(position(pane)).toEqual(["", ""]);
  });
});

describe("refresh", () => {
  let pane;

  const mountAt = (top, left, height = 200) => {
    pane = createPane();
    sizePane(pane, 300, height);
    drag.savePosition(top, left);
    drag.init(pane, pane.querySelector(".ytls-header"));
  };

  // Viewport is jsdom's default 1024x768.
  it("keeps the bottom edge when the pane sits near the bottom", () => {
    mountAt(568, 100); // bottom edge exactly on the viewport floor
    sizePane(pane, 300, 80); // minimized: shorter
    drag.refresh();

    expect(position(pane)).toEqual(["100px", "688px"]);
  });

  it("grows upwards instead of overflowing when the list gets longer", () => {
    mountAt(568, 100);
    sizePane(pane, 300, 300); // three more timestamps
    drag.refresh();

    expect(position(pane)).toEqual(["100px", "468px"]);
  });

  it("keeps the top edge when the pane sits near the top", () => {
    mountAt(40, 100);
    sizePane(pane, 300, 300);
    drag.refresh();

    expect(position(pane)).toEqual(["100px", "40px"]);
  });

  it("does nothing while the pane is in the default corner", () => {
    pane = createPane();
    sizePane(pane, 300, 200);
    drag.init(pane, pane.querySelector(".ytls-header"));

    drag.refresh();

    expect(position(pane)).toEqual(["", ""]);
  });
});

describe("resetPosition", () => {
  it("drops the saved position and the inline styles", () => {
    const pane = createPane();
    sizePane(pane, 300, 200);
    drag.savePosition(120, 340);
    drag.init(pane, pane.querySelector(".ytls-header"));

    drag.resetPosition();

    expect(position(pane)).toEqual(["", ""]);
    expect(pane.classList.contains("moved")).toBe(false);
    expect(drag.getSavedPosition()).toBeNull();
  });

  it("is safe to call with no pane mounted", () => {
    drag.savePosition(120, 340);
    expect(() => drag.resetPosition()).not.toThrow();
    expect(drag.getSavedPosition()).toBeNull();
  });
});

describe("destroy", () => {
  it("detaches the header and window listeners", () => {
    vi.useFakeTimers();
    const pane = createPane();
    const header = pane.querySelector(".ytls-header");
    sizePane(pane, 300, 200);
    drag.savePosition(300, 400);
    drag.init(pane, header);

    drag.destroy();

    pointer(header, "pointerdown", 10, 10);
    pointer(window, "pointermove", 410, 310);
    vi.stubGlobal("innerWidth", 500);
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(100);

    expect(position(pane)).toEqual(["400px", "300px"]);
  });

  it("is safe to call before any init", () => {
    expect(() => drag.destroy()).not.toThrow();
  });
});
