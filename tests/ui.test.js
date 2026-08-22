import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ui } from "../src/ui.js";
import { drag } from "../src/drag.js";
import { handlers } from "../src/handlers.js";
import { progressMarkers } from "../src/progressMarkers.js";
import { elements } from "../src/state.js";
import * as notification from "../src/utils/notification.js";
import { saveTimestamps } from "../src/utils/storage.js";
import { DEFAULT_HOTKEY } from "../src/utils/hotkey.js";
import {
  createPane,
  readListItems,
  resetEnvironment,
  stubVideo,
  stubVideoId,
} from "./helpers/dom.js";

const rows = () =>
  document.querySelectorAll("#ytls-pane ul li:not(.now-playing)");

const hotkeyField = () => document.querySelector("#ytts-hotkey-field");

const press = (target, key, mods = {}) =>
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      ctrlKey: !!mods.ctrl,
      altKey: !!mods.alt,
      shiftKey: !!mods.shift,
      metaKey: !!mods.meta,
      bubbles: true,
      cancelable: true,
    }),
  );

beforeEach(() => {
  resetEnvironment();
  stubVideoId("vid1");
  vi.spyOn(progressMarkers, "updateMarkers").mockImplementation(() => {});
  vi.spyOn(progressMarkers, "init").mockImplementation(() => {});
  vi.spyOn(notification, "showNotification").mockImplementation(() => {});
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
});

afterEach(() => {
  // ui.init() wires the drag listeners; without this each test would leave a
  // resize listener behind on the shared window.
  drag.destroy();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("createTimestampItem", () => {
  beforeEach(() => createPane());

  it("builds a row with link, note field and both icon buttons", () => {
    const input = ui.createTimestampItem(65, "chorus");
    const li = input.parentElement;

    expect(li.querySelector("a").textContent).toBe("1:05");
    expect(li.querySelector("a").href).toBe("https://youtu.be/vid1?t=65");
    expect(input.value).toBe("chorus");
    expect(input.placeholder).toBe("Add note...");
    expect(li.querySelectorAll("span.ytts-icon-btn")).toHaveLength(2);
  });

  it("defaults the expiration to 30 days after creation", () => {
    const li = ui.createTimestampItem(10).parentElement;
    const lifetime =
      Date.parse(li.dataset.expiration) - Date.parse(li.dataset.creation);
    expect(lifetime).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("keeps the dates it is given", () => {
    const creation = "2025-01-01T00:00:00.000Z";
    const expiration = "2025-02-01T00:00:00.000Z";
    const li = ui.createTimestampItem(10, "", creation, expiration).parentElement;

    expect(li.dataset.creation).toBe(creation);
    expect(li.dataset.expiration).toBe(expiration);
  });

  it("inserts rows above the now-playing row, in creation order", () => {
    ui.createTimestampItem(10, "first");
    ui.createTimestampItem(20, "second");

    expect(readListItems()).toEqual([
      { time: "10", note: "first" },
      { time: "20", note: "second" },
    ]);
    expect(
      document.querySelector("#ytls-pane ul").lastElementChild.className,
    ).toBe("now-playing");
  });

  it("saves the note only after the debounce window", () => {
    vi.useFakeTimers();
    const save = vi
      .spyOn(handlers, "saveCurrentTimestamps")
      .mockImplementation(() => {});
    const input = ui.createTimestampItem(10);

    input.value = "typed";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new Event("input"));
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(save).toHaveBeenCalledOnce();
  });

  it("copies the stamp when the copy button is clicked", () => {
    const copy = vi
      .spyOn(handlers, "copyIndividualTimestamp")
      .mockResolvedValue(undefined);
    const input = ui.createTimestampItem(10);
    const [copyBtn] = input.parentElement.querySelectorAll("span");

    copyBtn.click();
    expect(copy).toHaveBeenCalledWith(
      input.parentElement.querySelector("a"),
      input,
    );
  });

  it("deletes the row and re-saves once the delete is confirmed", () => {
    const save = vi
      .spyOn(handlers, "saveCurrentTimestamps")
      .mockImplementation(() => {});
    vi.stubGlobal("confirm", vi.fn(() => true));
    const input = ui.createTimestampItem(10);

    input.parentElement.querySelectorAll("span")[1].click();
    expect(rows()).toHaveLength(0);
    expect(save).toHaveBeenCalledOnce();
  });

  it("keeps the row when the delete is cancelled", () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const input = ui.createTimestampItem(10);

    input.parentElement.querySelectorAll("span")[1].click();
    expect(rows()).toHaveLength(1);
  });
});

describe("updateSelectionUI", () => {
  const boxes = () => [...document.querySelectorAll("#ytls-pane .ytts-select")];
  const selectAll = () => document.querySelector("#ytts-select-all");
  const deleteBtn = () => document.querySelector("#ytls-delete-selected");
  const addRows = (count) => {
    for (let i = 1; i <= count; i++) ui.createTimestampItem(i * 10, `n${i}`);
  };

  beforeEach(() => createPane());

  // Every list-size change funnels through here, and the list height is what
  // pushes a moved pane past the bottom edge.
  it("repositions the pane whenever the list changes size", () => {
    const refresh = vi.spyOn(drag, "refresh");

    ui.createTimestampItem(10, "n1");
    expect(refresh).toHaveBeenCalled();

    refresh.mockClear();
    document.querySelector("#ytls-pane ul li:not(.now-playing)").remove();
    ui.updateSelectionUI();
    expect(refresh).toHaveBeenCalled();
  });

  it("stays hidden up to the threshold and shows past it", () => {
    addRows(3);
    expect(selectAll().style.display).toBe("none");
    expect(deleteBtn().style.display).toBe("none");
    expect(boxes().every((box) => box.style.display === "none")).toBe(true);

    ui.createTimestampItem(40, "n4");
    expect(selectAll().style.display).toBe("");
    expect(deleteBtn().style.display).toBe("");
    expect(boxes().every((box) => box.style.display === "")).toBe(true);
  });

  it("hides again and clears the selection when the list shrinks", () => {
    addRows(4);
    boxes()[0].checked = true;
    ui.updateSelectionUI();
    expect(deleteBtn().textContent).toBe("Delete Selected (1)");

    rows()[0].remove();
    ui.updateSelectionUI();

    expect(deleteBtn().style.display).toBe("none");
    expect(deleteBtn().textContent).toBe("Delete Selected (0)");
    expect(boxes().some((box) => box.checked)).toBe(false);
  });

  it("tracks the selected count in the label and disables at zero", () => {
    addRows(5);
    expect(deleteBtn().disabled).toBe(true);
    expect(deleteBtn().textContent).toBe("Delete Selected (0)");

    boxes()[1].checked = true;
    boxes()[3].checked = true;
    ui.updateSelectionUI();

    expect(deleteBtn().disabled).toBe(false);
    expect(deleteBtn().textContent).toBe("Delete Selected (2)");
  });

  it("marks select-all indeterminate on a partial selection", () => {
    addRows(4);
    boxes()[0].checked = true;
    ui.updateSelectionUI();

    expect(selectAll().indeterminate).toBe(true);
    expect(selectAll().checked).toBe(false);
  });

  it("checks select-all once every row is selected", () => {
    addRows(4);
    boxes().forEach((box) => {
      box.checked = true;
    });
    ui.updateSelectionUI();

    expect(selectAll().checked).toBe(true);
    expect(selectAll().indeterminate).toBe(false);
  });

  it("survives a pane that is not mounted", () => {
    document.body.replaceChildren();
    expect(() => ui.updateSelectionUI()).not.toThrow();
  });
});

describe("select all", () => {
  const boxes = () => [...document.querySelectorAll("#ytls-pane .ytts-select")];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    stubVideo({ duration: 120 });
    ui.init();
    for (let i = 1; i <= 4; i++) ui.createTimestampItem(i * 10, `n${i}`);
  });

  it("checks every row and clears them all again", () => {
    const selectAll = document.querySelector("#ytts-select-all");

    selectAll.checked = true;
    selectAll.dispatchEvent(new Event("change"));
    expect(boxes().every((box) => box.checked)).toBe(true);
    expect(document.querySelector("#ytls-delete-selected").textContent).toBe(
      "Delete Selected (4)",
    );

    selectAll.checked = false;
    selectAll.dispatchEvent(new Event("change"));
    expect(boxes().some((box) => box.checked)).toBe(false);
  });
});

describe("init", () => {
  beforeEach(() => {
    // Only the timers are faked: requestAnimationFrame stays the stub above, so
    // watchTime does not spin a real loop.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    stubVideo({ duration: 120 });
  });

  it("mounts the pane and records it in state", () => {
    const pane = ui.init();
    expect(document.querySelector("#ytls-pane")).toBe(pane);
    expect(elements.pane).toBe(pane);
    expect(pane.querySelector("ul .now-playing")).not.toBeNull();
  });

  it("stamps the pane with the video it was mounted for", () => {
    expect(ui.init().dataset.videoId).toBe("vid1");
  });

  it("mounts the selection controls hidden", () => {
    const pane = ui.init();
    const selectAll = pane.querySelector(".ytls-header #ytts-select-all");
    const deleteBtn = pane.querySelector(".ytls-buttons #ytls-delete-selected");

    expect(selectAll).not.toBeNull();
    expect(deleteBtn).not.toBeNull();
    expect(selectAll.style.display).toBe("none");
    expect(deleteBtn.style.display).toBe("none");
  });

  it("puts the delete button last in the action row", () => {
    const labels = [...ui.init().querySelectorAll(".ytls-buttons button")].map(
      (button) => button.textContent,
    );
    expect(labels).toEqual([
      "Add Timestamp",
      "Copy Timestamps",
      "Delete Selected (0)",
    ]);
  });

  // O header sobrevive ao minimizar, então sem a regra .minimized o select-all
  // ficaria sozinho lá marcando linhas invisíveis, e o painel voltaria do
  // minimizado com tudo selecionado e o botão destrutivo já habilitado.
  it("hides the select-all while the pane is minimized", () => {
    const pane = ui.init();
    for (let i = 1; i <= 4; i++) ui.createTimestampItem(i * 10);
    const selectAll = pane.querySelector("#ytts-select-all");
    // Title flips between Minimize/Restore, so pick it by position among the
    // icon buttons (settings, minimize, close) — the drag handle is not one.
    const minimizeBtn = pane.querySelectorAll(".ytls-header .ytts-icon-btn")[1];

    // getStartMinimizedSetting() devolve true por padrão, então o painel nasce
    // minimizado: é o caminho comum, não um caso de canto.
    expect(pane.classList.contains("minimized")).toBe(true);
    expect(getComputedStyle(selectAll).display).toBe("none");

    minimizeBtn.click();

    expect(pane.classList.contains("minimized")).toBe(false);
    expect(getComputedStyle(selectAll).display).not.toBe("none");
  });

  it("starts the watchTime loop", () => {
    ui.init();
    expect(requestAnimationFrame).toHaveBeenCalledWith(handlers.watchTime);
  });

  it("puts the drag handle first in the header and keeps it while minimized", () => {
    const pane = ui.init();
    const handle = pane.querySelector("#ytts-drag-handle");

    expect(pane.querySelector(".ytls-header").firstElementChild).toBe(handle);
    expect(pane.classList.contains("minimized")).toBe(true);
    expect(getComputedStyle(handle).display).not.toBe("none");
  });

  // Minimizing changes the pane height, and a moved pane anchored by `top`
  // would come unstuck from the bottom edge without a reposition.
  it("repositions the pane after minimizing and restoring", () => {
    const refresh = vi.spyOn(drag, "refresh");
    const pane = ui.init();
    const minimizeBtn = pane.querySelectorAll(".ytls-header .ytts-icon-btn")[1];

    const before = refresh.mock.calls.length;
    minimizeBtn.click();
    minimizeBtn.click();

    expect(refresh.mock.calls.length).toBe(before + 2);
  });

  it("hands the pane and its header to the drag module", () => {
    const dragInit = vi.spyOn(drag, "init");
    const pane = ui.init();

    expect(dragInit).toHaveBeenCalledWith(pane, pane.querySelector(".ytls-header"));
  });

  it("mounts already moved when a position was saved", () => {
    drag.savePosition(120, 340);
    const pane = ui.init();

    expect([pane.style.left, pane.style.top]).toEqual(["340px", "120px"]);
    expect(pane.classList.contains("moved")).toBe(true);
  });

  it("loads saved timestamps a second in", () => {
    saveTimestamps("vid1", [{ time: 42, note: "late" }]);
    ui.init();
    expect(rows()).toHaveLength(0);

    vi.advanceTimersByTime(1000);
    expect(readListItems()).toEqual([{ time: "42", note: "late" }]);
  });

  it("starts the progress markers after the pane settles", () => {
    ui.init();
    vi.advanceTimersByTime(1500);
    expect(progressMarkers.init).toHaveBeenCalled();
  });

  it("starts minimized by default", () => {
    expect(ui.init().className).toBe("minimized");
  });

  it("starts expanded when the setting says so", () => {
    localStorage.setItem("ytts_start_minimized", "false");
    expect(ui.init().className).toBe("");
  });

  it("toggles minimized state from the header button", () => {
    const pane = ui.init();
    const minimizeBtn = pane.querySelector('[title="Restore"]');

    minimizeBtn.click();
    expect(pane.classList.contains("minimized")).toBe(false);
    expect(minimizeBtn.title).toBe("Minimize");

    minimizeBtn.click();
    expect(pane.classList.contains("minimized")).toBe(true);
  });

  it("wires the add and copy buttons", () => {
    const add = vi.spyOn(handlers, "addStamp").mockImplementation(() => {});
    const copy = vi.spyOn(handlers, "copyList").mockResolvedValue(undefined);
    const pane = ui.init();

    pane.querySelector('[data-action="add"]').click();
    pane.querySelector('[data-action="copy"]').click();
    expect(add).toHaveBeenCalled();
    expect(copy).toHaveBeenCalled();
  });

  it("seeks when a stamp inside the list is clicked", () => {
    const video = stubVideo({ currentTime: 0, duration: 120 });
    ui.init();
    const anchor = ui.createTimestampItem(30).parentElement.querySelector("a");

    anchor.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(video.currentTime).toBe(30);
  });
});

describe("settings", () => {
  beforeEach(() => createPane());

  it("reads auto cleanup as off unless explicitly enabled", () => {
    expect(ui.getAutoCleanupSetting()).toBe(false);
    localStorage.setItem("ytts_auto_cleanup", "true");
    expect(ui.getAutoCleanupSetting()).toBe(true);
  });

  it("defaults start-minimized to on when never set", () => {
    expect(ui.getStartMinimizedSetting()).toBe(true);
    localStorage.setItem("ytts_start_minimized", "false");
    expect(ui.getStartMinimizedSetting()).toBe(false);
  });

  it("falls back to the factory hotkey when nothing is stored", () => {
    expect(ui.getHotkeySetting()).toEqual(DEFAULT_HOTKEY);
  });

  it("reads the stored hotkey", () => {
    const stored = { key: "D", ctrl: true, alt: false, shift: false, meta: false };
    localStorage.setItem("ytts_hotkey", JSON.stringify(stored));
    expect(ui.getHotkeySetting()).toEqual(stored);
  });

  it("reads a stored null as the hotkey being switched off", () => {
    localStorage.setItem("ytts_hotkey", "null");
    expect(ui.getHotkeySetting()).toBeNull();
  });

  it("falls back to the factory hotkey when the stored value is unusable", () => {
    localStorage.setItem("ytts_hotkey", "{not json");
    expect(ui.getHotkeySetting()).toEqual(DEFAULT_HOTKEY);

    localStorage.setItem("ytts_hotkey", JSON.stringify({ key: "" }));
    expect(ui.getHotkeySetting()).toEqual(DEFAULT_HOTKEY);
  });

  it("persists the hotkey held by the capture field on save", () => {
    ui.openSettingsModal();
    press(hotkeyField(), "K", { alt: true });

    document.querySelector("#ytts-save-settings").click();
    expect(ui.getHotkeySetting()).toEqual({
      key: "K",
      ctrl: false,
      alt: true,
      shift: false,
      meta: false,
    });
  });

  it("persists an emptied capture field as the hotkey being switched off", () => {
    ui.openSettingsModal();
    document.querySelector("#ytts-hotkey-clear").click();

    document.querySelector("#ytts-save-settings").click();
    expect(localStorage.getItem("ytts_hotkey")).toBe("null");
    expect(ui.getHotkeySetting()).toBeNull();
  });

  it("opens the capture field showing the hotkey in force", () => {
    ui.openSettingsModal();
    expect(hotkeyField().value).toBe("Shift+S");

    document.querySelector("#ytts-cancel-settings").click();
    localStorage.setItem("ytts_hotkey", "null");
    ui.openSettingsModal();
    expect(hotkeyField().value).toBe("Disabled");
  });

  it("announces it is listening while the capture field has focus", () => {
    ui.openSettingsModal();
    const field = hotkeyField();
    field.dispatchEvent(new FocusEvent("focus"));

    expect(field.value).toBe("Press a combination...");
    expect(field.classList.contains("capturing")).toBe(true);
  });

  it("puts the label back when focus leaves without a key being pressed", () => {
    ui.openSettingsModal();
    const field = hotkeyField();
    field.dispatchEvent(new FocusEvent("focus"));
    field.dispatchEvent(new FocusEvent("blur"));

    expect(field.value).toBe("Shift+S");
    expect(field.classList.contains("capturing")).toBe(false);
  });

  it("records the combination pressed in the capture field", () => {
    ui.openSettingsModal();
    const field = hotkeyField();
    press(field, "d", { ctrl: true, shift: true });

    expect(field.value).toBe("Ctrl+Shift+D");
    expect(JSON.parse(field.dataset.hotkey)).toEqual({
      key: "D",
      ctrl: true,
      alt: false,
      shift: true,
      meta: false,
    });
  });

  it("keeps listening while only a modifier is held down", () => {
    ui.openSettingsModal();
    const field = hotkeyField();
    field.dispatchEvent(new FocusEvent("focus"));
    press(field, "Shift", { shift: true });

    expect(field.value).toBe("Press a combination...");
  });

  it("swallows the key so the global shortcut does not fire while capturing", () => {
    ui.openSettingsModal();
    const event = new KeyboardEvent("keydown", {
      key: "S",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    hotkeyField().dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("discards the captured hotkey when the modal is cancelled", () => {
    ui.openSettingsModal();
    press(hotkeyField(), "K", { alt: true });
    document.querySelector("#ytts-cancel-settings").click();

    expect(localStorage.getItem("ytts_hotkey")).toBeNull();
    expect(ui.getHotkeySetting()).toEqual(DEFAULT_HOTKEY);
  });

  it("opens the modal reflecting the stored settings", () => {
    localStorage.setItem("ytts_auto_cleanup", "true");
    localStorage.setItem("ytts_start_minimized", "false");
    ui.openSettingsModal();

    expect(document.querySelector("#auto-cleanup-expired").checked).toBe(true);
    expect(document.querySelector("#start-minimized").checked).toBe(false);
  });

  it("resets the pane position on the spot, without waiting for save", () => {
    const pane = document.querySelector("#ytls-pane");
    drag.savePosition(120, 340);
    drag.applyPosition(pane, 120, 340);
    ui.openSettingsModal();

    document.querySelector("#ytts-reset-position").click();

    expect([pane.style.left, pane.style.top]).toEqual(["", ""]);
    expect(pane.classList.contains("moved")).toBe(false);
    expect(drag.getSavedPosition()).toBeNull();
    expect(document.querySelector("#ytts-settings-modal")).not.toBeNull();
  });

  it("shows the build version in the footer", () => {
    ui.openSettingsModal();
    expect(
      document.querySelector(".ytts-settings-version span").textContent,
    ).toBe("v0.0.0-test");
  });

  it("never opens a second modal", () => {
    ui.openSettingsModal();
    ui.openSettingsModal();
    expect(document.querySelectorAll("#ytts-settings-modal")).toHaveLength(1);
  });

  it("closes on cancel and on a backdrop click", () => {
    ui.openSettingsModal();
    document.querySelector("#ytts-cancel-settings").click();
    expect(document.querySelector("#ytts-settings-modal")).toBeNull();

    ui.openSettingsModal();
    const modal = document.querySelector("#ytts-settings-modal");
    modal.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector("#ytts-settings-modal")).toBeNull();
  });

  it("stays open when the click lands inside the modal content", () => {
    ui.openSettingsModal();
    document
      .querySelector(".ytts-settings-content")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector("#ytts-settings-modal")).not.toBeNull();
  });

  it("persists both settings and closes on save", () => {
    ui.openSettingsModal();
    document.querySelector("#auto-cleanup-expired").checked = true;
    document.querySelector("#start-minimized").checked = false;

    document.querySelector("#ytts-save-settings").click();
    expect(localStorage.getItem("ytts_auto_cleanup")).toBe("true");
    expect(localStorage.getItem("ytts_start_minimized")).toBe("false");
    expect(document.querySelector("#ytts-settings-modal")).toBeNull();
    expect(notification.showNotification).toHaveBeenCalledWith(
      "✅ Settings saved!",
    );
  });

  it("sweeps expired timestamps as soon as auto cleanup is switched on", () => {
    const clean = vi.spyOn(handlers, "cleanExpired").mockImplementation(() => {});
    ui.openSettingsModal();
    document.querySelector("#auto-cleanup-expired").checked = true;

    document.querySelector("#ytts-save-settings").click();
    expect(clean).toHaveBeenCalled();
  });

  it("does not sweep when auto cleanup stays off", () => {
    const clean = vi.spyOn(handlers, "cleanExpired").mockImplementation(() => {});
    ui.openSettingsModal();

    document.querySelector("#ytts-save-settings").click();
    expect(clean).not.toHaveBeenCalled();
  });
});

describe("settings modal tabs", () => {
  const tabButtons = () => document.querySelectorAll(".ytts-tab");

  it("opens on Settings, with the video tab hidden", () => {
    ui.openSettingsModal();
    const [settingsTab, videosTab] = tabButtons();

    expect(settingsTab.classList.contains("ytts-tab-active")).toBe(true);
    expect(videosTab.classList.contains("ytts-tab-active")).toBe(false);
    expect(document.querySelector("#ytts-tab-videos").style.display).toBe("none");
    expect(
      document.querySelector("#ytts-tab-settings #auto-cleanup-expired"),
    ).not.toBeNull();
    expect(
      document.querySelector("#ytts-tab-settings #start-minimized"),
    ).not.toBeNull();
    expect(
      document.querySelector("#ytts-tab-settings #ytts-reset-position"),
    ).not.toBeNull();
  });

  it("swaps the panes back and forth", () => {
    ui.openSettingsModal();
    const [settingsTab, videosTab] = tabButtons();
    const settingsPane = document.querySelector("#ytts-tab-settings");
    const videosPane = document.querySelector("#ytts-tab-videos");

    videosTab.click();
    expect(settingsPane.style.display).toBe("none");
    expect(videosPane.style.display).toBe("");
    expect(videosTab.classList.contains("ytts-tab-active")).toBe(true);
    expect(settingsTab.classList.contains("ytts-tab-active")).toBe(false);

    settingsTab.click();
    expect(settingsPane.style.display).toBe("");
    expect(videosPane.style.display).toBe("none");
    expect(settingsTab.classList.contains("ytts-tab-active")).toBe(true);
  });

  it("hides Save on the Videos tab and brings it back on Settings", () => {
    ui.openSettingsModal();
    const [settingsTab, videosTab] = tabButtons();
    const save = document.querySelector("#ytts-save-settings");

    videosTab.click();
    expect(save.style.display).toBe("none");

    settingsTab.click();
    expect(save.style.display).toBe("");
  });

  it("renders the list only once the Videos tab is opened", () => {
    saveTimestamps("vid1", [
      { time: 10, note: "", creation: "2024-01-01T00:00:00.000Z", expiration: null },
    ]);
    const render = vi.spyOn(ui, "renderVideoList");

    ui.openSettingsModal();
    expect(render).not.toHaveBeenCalled();

    tabButtons()[1].click();
    expect(render).toHaveBeenCalledWith(document.querySelector("#ytts-tab-videos"));
  });
});

describe("renderVideoList", () => {
  const stamp = (creation) => ({
    time: 10,
    note: "",
    creation,
    expiration: null,
  });
  const items = (container) => [...container.querySelectorAll(".ytts-video-item")];

  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("shows the empty state when nothing is saved", () => {
    ui.renderVideoList(container);
    expect(container.querySelector(".ytts-video-empty").textContent).toBe(
      "No videos with timestamps yet.",
    );
    expect(container.querySelector(".ytts-video-list")).toBeNull();
  });

  it("sorts by the newest creation, legacy entries last", () => {
    saveTimestamps("old", [stamp("2024-01-01T00:00:00.000Z")]);
    saveTimestamps("new", [
      stamp("2020-01-01T00:00:00.000Z"),
      stamp("2026-05-05T00:00:00.000Z"),
    ]);
    saveTimestamps("legacy", [stamp(undefined)]);

    ui.renderVideoList(container);
    expect(items(container).map((li) => li.dataset.videoId)).toEqual([
      "new",
      "old",
      "legacy",
    ]);
  });

  it("builds the row out of thumbnail, title, count and delete button", () => {
    saveTimestamps("vid1", [
      stamp("2024-01-01T00:00:00.000Z"),
      stamp("2024-01-02T00:00:00.000Z"),
    ]);
    localStorage.setItem("yttsmeta_vid1", JSON.stringify({ title: "Meu Vídeo" }));

    ui.renderVideoList(container);
    const [li] = items(container);

    expect(li.querySelector("img").src).toBe(
      "https://i.ytimg.com/vi/vid1/mqdefault.jpg",
    );
    expect(li.querySelector("img").loading).toBe("lazy");
    expect(li.querySelector("a").textContent).toBe("Meu Vídeo");
    expect(li.querySelector("a").href).toBe("https://youtu.be/vid1");
    expect(li.querySelector("a").target).toBe("_blank");
    expect(li.querySelector("a").rel).toBe("noopener noreferrer");
    expect(li.querySelector(".ytts-video-count").textContent).toBe("2");
    expect(li.querySelector(".ytts-icon-btn").textContent).toBe("⛔");
  });

  it("shows the oldest creation as the date, above the title", () => {
    saveTimestamps("vid1", [
      stamp("2026-05-05T00:00:00.000Z"),
      stamp("2020-01-01T00:00:00.000Z"),
      stamp("2024-01-01T00:00:00.000Z"),
    ]);

    ui.renderVideoList(container);
    const info = container.querySelector(".ytts-video-item > .ytts-video-info");

    expect([...info.children].map((child) => child.className)).toEqual([
      "ytts-video-date",
      "ytts-video-title",
    ]);
    // Comparar com a mesma API, e não com string fixa: `toLocaleDateString`
    // segue o locale do ambiente e um literal quebraria fora do runner local.
    expect(info.querySelector(".ytts-video-date").textContent).toBe(
      new Date(Date.parse("2020-01-01T00:00:00.000Z")).toLocaleDateString(),
    );
  });

  it("skips the date when no timestamp has a valid creation", () => {
    saveTimestamps("legacy", [stamp(undefined), stamp("not a date")]);

    ui.renderVideoList(container);

    expect(container.querySelector(".ytts-video-info")).not.toBeNull();
    expect(container.querySelector(".ytts-video-date")).toBeNull();
  });

  it("falls back to the videoId when no title was saved", () => {
    saveTimestamps("vid1", [stamp("2024-01-01T00:00:00.000Z")]);
    ui.renderVideoList(container);
    expect(container.querySelector("a").textContent).toBe("vid1");
  });

  it("hides a thumbnail that fails to load", () => {
    saveTimestamps("gone", [stamp("2024-01-01T00:00:00.000Z")]);
    ui.renderVideoList(container);

    const img = container.querySelector("img");
    img.dispatchEvent(new Event("error"));
    expect(img.style.display).toBe("none");
    expect(container.querySelector("a").textContent).toBe("gone");
  });

  it("replaces the previous render instead of stacking lists", () => {
    saveTimestamps("vid1", [stamp("2024-01-01T00:00:00.000Z")]);
    ui.renderVideoList(container);
    ui.renderVideoList(container);
    expect(container.querySelectorAll(".ytts-video-list").length).toBe(1);
  });
});
