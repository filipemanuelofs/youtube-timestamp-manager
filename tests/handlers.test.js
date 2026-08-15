import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { handlers } from "../src/handlers.js";
import { ui } from "../src/ui.js";
import { progressMarkers } from "../src/progressMarkers.js";
import { state } from "../src/state.js";
import * as clipboard from "../src/utils/clipboard.js";
import * as notification from "../src/utils/notification.js";
import { saveTimestamps, loadTimestamps } from "../src/utils/storage.js";
import {
  createPane,
  readListItems,
  resetEnvironment,
  stubVideo,
  stubVideoId,
} from "./helpers/dom.js";

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 1000).toISOString();

let copySpy;
let notifySpy;

beforeEach(() => {
  resetEnvironment();
  createPane();
  stubVideoId("vid1");
  // updateMarkers touches the real progress bar; the marker behaviour has its
  // own suite, so it is stubbed out here.
  vi.spyOn(progressMarkers, "updateMarkers").mockImplementation(() => {});
  copySpy = vi.spyOn(clipboard, "copyToClipboard").mockResolvedValue(true);
  notifySpy = vi
    .spyOn(notification, "showNotification")
    .mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("updateStamp", () => {
  it("writes label, dataset and youtu.be href", () => {
    const a = document.createElement("a");
    handlers.updateStamp(a, 125);
    expect(a.textContent).toBe("2:05");
    expect(a.dataset.time).toBe("125");
    expect(a.href).toBe("https://youtu.be/vid1?t=125");
  });
});

describe("clickStamp", () => {
  it("seeks the video to the clicked time", async () => {
    const video = stubVideo({ currentTime: 0 });
    const target = document.createElement("a");
    target.dataset.time = "42";
    const e = { target, preventDefault: vi.fn() };

    await handlers.clickStamp(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(video.currentTime).toBe(42);
  });

  it("ignores clicks on elements without a time", async () => {
    const video = stubVideo({ currentTime: 10 });
    const e = { target: document.createElement("span"), preventDefault: vi.fn() };

    await handlers.clickStamp(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(video.currentTime).toBe(10);
  });

  it("does not throw when there is no video element", async () => {
    const target = document.createElement("a");
    target.dataset.time = "42";
    await expect(
      handlers.clickStamp({ target, preventDefault: vi.fn() }),
    ).resolves.not.toThrow();
  });
});

describe("addStamp", () => {
  it("adds a stamp 5 seconds before the current time", () => {
    stubVideo({ currentTime: 65 });
    handlers.addStamp();
    expect(readListItems()).toEqual([{ time: "60", note: "" }]);
  });

  it("clamps the offset at zero near the start of the video", () => {
    stubVideo({ currentTime: 2 });
    handlers.addStamp();
    expect(readListItems()).toEqual([{ time: "0", note: "" }]);
  });

  it("persists the new stamp right away", () => {
    stubVideo({ currentTime: 100 });
    handlers.addStamp();
    expect(loadTimestamps("vid1")).toHaveLength(1);
    expect(loadTimestamps("vid1")[0].time).toBe(95);
  });

  it("no-ops without a video", () => {
    handlers.addStamp();
    expect(readListItems()).toEqual([]);
  });
});

describe("copyList", () => {
  it("copies one `link - note` line per stamp", async () => {
    ui.createTimestampItem(10, "intro");
    ui.createTimestampItem(70, "outro");

    await handlers.copyList();
    expect(copySpy).toHaveBeenCalledWith(
      "https://youtu.be/vid1?t=10 - intro\nhttps://youtu.be/vid1?t=70 - outro",
    );
  });

  it("omits the separator for stamps without a note", async () => {
    ui.createTimestampItem(10);
    await handlers.copyList();
    expect(copySpy).toHaveBeenCalledWith("https://youtu.be/vid1?t=10");
  });

  it("excludes the now-playing row", async () => {
    ui.createTimestampItem(10, "only");
    await handlers.copyList();
    expect(copySpy.mock.calls[0][0].split("\n")).toHaveLength(1);
  });

  it("reports the copied count, pluralised", async () => {
    ui.createTimestampItem(10);
    await handlers.copyList();
    expect(notifySpy).toHaveBeenCalledWith("✓ 1 timestamp copied!");

    notifySpy.mockClear();
    ui.createTimestampItem(20);
    await handlers.copyList();
    expect(notifySpy).toHaveBeenCalledWith("✓ 2 timestamps copied!");
  });

  it("reports a failed copy", async () => {
    copySpy.mockResolvedValue(false);
    ui.createTimestampItem(10);
    await handlers.copyList();
    expect(notifySpy).toHaveBeenCalledWith("❌ Copy failed", 1500);
  });
});

describe("deleteSelectedTimestamps", () => {
  const boxes = () => [...document.querySelectorAll("#ytls-pane .ytts-select")];

  const seedRows = (count) => {
    for (let i = 1; i <= count; i++) ui.createTimestampItem(i * 10, `n${i}`);
    handlers.saveCurrentTimestamps();
  };

  it("deletes only the checked rows, middle ones included", () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    seedRows(5);
    boxes()[1].checked = true;
    boxes()[3].checked = true;

    handlers.deleteSelectedTimestamps();

    expect(readListItems()).toEqual([
      { time: "10", note: "n1" },
      { time: "30", note: "n3" },
      { time: "50", note: "n5" },
    ]);
    expect(loadTimestamps("vid1").map((t) => t.time)).toEqual([10, 30, 50]);
  });

  it("asks for confirmation with the selected count", () => {
    const confirmSpy = vi.fn(() => false);
    vi.stubGlobal("confirm", confirmSpy);
    seedRows(5);
    boxes()[0].checked = true;
    boxes()[2].checked = true;

    handlers.deleteSelectedTimestamps();
    expect(confirmSpy).toHaveBeenCalledWith("Delete 2 selected timestamps?");
  });

  it("keeps every row when the delete is cancelled", () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    seedRows(5);
    boxes()[0].checked = true;

    handlers.deleteSelectedTimestamps();

    expect(readListItems()).toHaveLength(5);
    expect(loadTimestamps("vid1")).toHaveLength(5);
  });

  it("does nothing, not even confirm, with no row checked", () => {
    const confirmSpy = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmSpy);
    seedRows(5);

    handlers.deleteSelectedTimestamps();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(readListItems()).toHaveLength(5);
  });

  it("drops the storage key instead of saving an empty list", () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    seedRows(5);
    boxes().forEach((box) => {
      box.checked = true;
    });
    progressMarkers.updateMarkers.mockClear();

    handlers.deleteSelectedTimestamps();

    expect(readListItems()).toHaveLength(0);
    expect(localStorage.getItem("ytts_vid1")).toBeNull();
    expect(progressMarkers.updateMarkers).toHaveBeenCalled();
  });

  // O debounce de 500ms do campo de nota sobrevive à remoção do `li`: sem a
  // remoção da chave dentro de `saveCurrentTimestamps`, esse save atrasado
  // gravava `[]` por cima e ressuscitava a chave recém-apagada.
  it("keeps the storage key gone after the note debounce fires", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.stubGlobal("confirm", vi.fn(() => true));
    seedRows(5);

    const firstNote = document.querySelector("#ytls-pane ul .ytts-note");
    firstNote.value = "editada";
    firstNote.dispatchEvent(new Event("input"));

    boxes().forEach((box) => {
      box.checked = true;
    });
    handlers.deleteSelectedTimestamps();
    expect(localStorage.getItem("ytts_vid1")).toBeNull();

    vi.advanceTimersByTime(600);
    expect(localStorage.getItem("ytts_vid1")).toBeNull();

    vi.useRealTimers();
  });

  it("reports the deleted count, pluralised", () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    seedRows(5);
    boxes()[0].checked = true;

    handlers.deleteSelectedTimestamps();
    expect(notifySpy).toHaveBeenCalledWith("🗑️ 1 timestamp deleted!");

    notifySpy.mockClear();
    boxes()[0].checked = true;
    boxes()[1].checked = true;

    handlers.deleteSelectedTimestamps();
    expect(notifySpy).toHaveBeenCalledWith("🗑️ 2 timestamps deleted!");
  });
});

describe("copyIndividualTimestamp", () => {
  it("copies `note link` and flashes the button", async () => {
    const feedback = vi
      .spyOn(clipboard, "showCopyFeedback")
      .mockImplementation(() => {});
    const input = ui.createTimestampItem(30, "chorus");
    const anchor = input.parentElement.querySelector("a");
    const copyBtn = input.parentElement.querySelectorAll("span")[0];
    copyBtn.classList.add("copy-btn");

    await handlers.copyIndividualTimestamp(anchor, input);
    expect(copySpy).toHaveBeenCalledWith("chorus https://youtu.be/vid1?t=30");
    expect(feedback).toHaveBeenCalledWith(copyBtn);
  });

  it("trims the leading space when there is no note", async () => {
    const input = ui.createTimestampItem(30);
    const anchor = input.parentElement.querySelector("a");
    await handlers.copyIndividualTimestamp(anchor, input);
    expect(copySpy).toHaveBeenCalledWith("https://youtu.be/vid1?t=30");
  });

  it("skips the feedback when the copy failed", async () => {
    const feedback = vi
      .spyOn(clipboard, "showCopyFeedback")
      .mockImplementation(() => {});
    copySpy.mockResolvedValue(false);
    const input = ui.createTimestampItem(30);

    await handlers.copyIndividualTimestamp(
      input.parentElement.querySelector("a"),
      input,
    );
    expect(feedback).not.toHaveBeenCalled();
  });
});

describe("saveCurrentTimestamps", () => {
  it("stores time, note and the lifetime dates from the row", () => {
    const input = ui.createTimestampItem(15, "note A", past, future);
    input.value = "edited";

    handlers.saveCurrentTimestamps();
    expect(loadTimestamps("vid1")).toEqual([
      { time: 15, note: "edited", creation: past, expiration: future },
    ]);
  });

  it("drops the storage key once every row is gone", () => {
    ui.createTimestampItem(15);
    handlers.saveCurrentTimestamps();
    document
      .querySelectorAll("#ytls-pane ul li:not(.now-playing)")
      .forEach((li) => li.remove());

    handlers.saveCurrentTimestamps();
    expect(localStorage.getItem("ytts_vid1")).toBeNull();
  });

  it("no-ops without a video id", () => {
    ui.createTimestampItem(15);
    state.videoId = null;
    vi.stubGlobal("location", { search: "", href: "https://www.youtube.com/" });

    handlers.saveCurrentTimestamps();
    expect(loadTimestamps("vid1")).toEqual([]);
  });

  it("refreshes the progress markers", () => {
    handlers.saveCurrentTimestamps();
    expect(progressMarkers.updateMarkers).toHaveBeenCalled();
  });
});

describe("loadSavedTimestamps", () => {
  it("renders every saved stamp", () => {
    saveTimestamps("vid1", [
      { time: 10, note: "a", creation: past, expiration: future },
      { time: 20, note: "b", creation: past, expiration: future },
    ]);

    handlers.loadSavedTimestamps();
    expect(readListItems()).toEqual([
      { time: "10", note: "a" },
      { time: "20", note: "b" },
    ]);
  });

  it("preserves the stored creation and expiration dates", () => {
    saveTimestamps("vid1", [
      { time: 10, note: "a", creation: past, expiration: future },
    ]);

    handlers.loadSavedTimestamps();
    const li = document.querySelector("#ytls-pane ul li:not(.now-playing)");
    expect(li.dataset.creation).toBe(past);
    expect(li.dataset.expiration).toBe(future);
  });

  it("announces how many were loaded", () => {
    saveTimestamps("vid1", [{ time: 10 }, { time: 20 }]);
    handlers.loadSavedTimestamps();
    expect(notifySpy).toHaveBeenCalledWith("✅ 2 saved timestamps loaded!");
  });

  it("stays quiet when nothing is stored", () => {
    handlers.loadSavedTimestamps();
    expect(notifySpy).not.toHaveBeenCalled();
    expect(readListItems()).toEqual([]);
  });

  it("runs the expired sweep only when auto cleanup is on", () => {
    const cleanSpy = vi.spyOn(handlers, "cleanExpired");

    handlers.loadSavedTimestamps();
    expect(cleanSpy).not.toHaveBeenCalled();

    localStorage.setItem("ytts_auto_cleanup", "true");
    handlers.loadSavedTimestamps();
    expect(cleanSpy).toHaveBeenCalled();
  });
});

describe("cleanExpired", () => {
  it("drops expired stamps and redraws the list of the current video", () => {
    saveTimestamps("vid1", [
      { time: 10, note: "gone", creation: past, expiration: past },
      { time: 20, note: "kept", creation: past, expiration: future },
    ]);
    handlers.loadSavedTimestamps();
    notifySpy.mockClear();

    handlers.cleanExpired();
    expect(readListItems()).toEqual([{ time: "20", note: "kept" }]);
    expect(notifySpy).toHaveBeenCalledWith("🧹 Cleaned 1 expired timestamp!");
  });

  it("leaves the list untouched when another video was the one cleaned", () => {
    saveTimestamps("vid1", [
      { time: 20, note: "kept", creation: past, expiration: future },
    ]);
    saveTimestamps("vid2", [
      { time: 30, note: "gone", creation: past, expiration: past },
    ]);
    handlers.loadSavedTimestamps();
    notifySpy.mockClear();

    handlers.cleanExpired();
    expect(readListItems()).toEqual([{ time: "20", note: "kept" }]);
    expect(notifySpy).toHaveBeenCalledWith("🧹 Cleaned 1 expired timestamp!");
    expect(loadTimestamps("vid2")).toEqual([]);
  });

  it("stays silent when nothing expired", () => {
    saveTimestamps("vid1", [{ time: 20, expiration: future }]);
    handlers.cleanExpired();
    expect(notifySpy).not.toHaveBeenCalled();
  });
});

describe("watchTime", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("keeps the now-playing row on the video duration", () => {
    stubVideo({ duration: 3661.7 });
    handlers.watchTime();

    const now = document.querySelector("#ytls-pane .now-playing a");
    expect(now.textContent).toBe("1:01:01");
    expect(now.dataset.time).toBe("3661");
  });

  it("reschedules itself and records the frame id", () => {
    stubVideo({ duration: 100 });
    handlers.watchTime();
    expect(requestAnimationFrame).toHaveBeenCalledWith(handlers.watchTime);
    expect(state.nowid).toBe(1);
  });

  it("still reschedules when there is no video", () => {
    handlers.watchTime();
    expect(requestAnimationFrame).toHaveBeenCalled();
    expect(document.querySelector("#ytls-pane .now-playing a").textContent).toBe(
      "",
    );
  });

  it("keeps looping after an error", () => {
    stubVideo({ duration: 100 });
    vi.spyOn(handlers, "updateStamp").mockImplementation(() => {
      throw new Error("boom");
    });

    expect(() => handlers.watchTime()).not.toThrow();
    expect(requestAnimationFrame).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("closePane", () => {
  it("tears the pane down once confirmed", () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    handlers.closePane();
    expect(document.querySelector("#ytls-pane")).toBeNull();
  });

  it("keeps the pane when the user cancels", () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    handlers.closePane();
    expect(document.querySelector("#ytls-pane")).not.toBeNull();
  });
});
