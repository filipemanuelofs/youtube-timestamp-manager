import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { handlers } from "../src/handlers.js";
import { ui } from "../src/ui.js";
import { progressMarkers } from "../src/progressMarkers.js";
import { state } from "../src/state.js";
import * as clipboard from "../src/utils/clipboard.js";
import * as notification from "../src/utils/notification.js";
import {
  saveTimestamps,
  loadTimestamps,
  loadVideoTitle,
} from "../src/utils/storage.js";
import {
  createPane,
  readListItems,
  resetEnvironment,
  stubVideo,
  stubVideoId,
} from "./helpers/dom.js";

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 1000).toISOString();
// Além do prazo de retenção padrão (30 dias), então a limpeza leva.
const expired = new Date(Date.now() - 40 * 86400000).toISOString();

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

  it("announces the new stamp", () => {
    stubVideo({ currentTime: 65 });
    handlers.addStamp();
    expect(notifySpy).toHaveBeenCalledWith("⏱️ Timestamp added!");
  });

  it("no-ops without a video", () => {
    handlers.addStamp();
    expect(readListItems()).toEqual([]);
    expect(notifySpy).not.toHaveBeenCalled();
  });
});

describe("onHotkey", () => {
  const press = (key, mods = {}, target = document.body) => {
    const event = new KeyboardEvent("keydown", {
      key,
      ctrlKey: !!mods.ctrl,
      altKey: !!mods.alt,
      shiftKey: !!mods.shift,
      metaKey: !!mods.meta,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "target", { value: target });
    handlers.onHotkey(event);
    return event;
  };

  beforeEach(() => stubVideo({ currentTime: 65 }));

  it("adds a stamp on the factory shortcut", () => {
    press("S", { shift: true });
    expect(readListItems()).toEqual([{ time: "60", note: "" }]);
  });

  it("swallows the key it acted on", () => {
    const event = press("S", { shift: true });
    expect(event.defaultPrevented).toBe(true);
  });

  it("obeys the shortcut stored in settings", () => {
    localStorage.setItem(
      "ytts_hotkey",
      JSON.stringify({ key: "K", ctrl: false, alt: true, shift: false, meta: false }),
    );

    press("S", { shift: true });
    expect(readListItems()).toEqual([]);

    press("K", { alt: true });
    expect(readListItems()).toEqual([{ time: "60", note: "" }]);
  });

  it("stays quiet when the shortcut is switched off", () => {
    localStorage.setItem("ytts_hotkey", "null");
    const event = press("S", { shift: true });

    expect(readListItems()).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it("stays quiet on any other key", () => {
    press("S");
    press("D", { shift: true });
    expect(readListItems()).toEqual([]);
  });

  it("stays quiet without a pane on screen", () => {
    document.querySelector("#ytls-pane").remove();
    press("S", { shift: true });
    expect(readListItems()).toEqual([]);
  });

  it("stays quiet while the settings modal is open", () => {
    const modal = document.createElement("div");
    modal.id = "ytts-settings-modal";
    document.body.appendChild(modal);

    press("S", { shift: true });
    expect(readListItems()).toEqual([]);
  });

  it("stays quiet while a form field has the focus", () => {
    ["INPUT", "TEXTAREA", "SELECT"].forEach((tag) => {
      press("S", { shift: true }, document.createElement(tag));
    });
    expect(readListItems()).toEqual([]);
  });

  it("stays quiet while an editable element has the focus", () => {
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    // jsdom does not derive isContentEditable from the attribute.
    Object.defineProperty(editable, "isContentEditable", { value: true });

    press("S", { shift: true }, editable);
    expect(readListItems()).toEqual([]);
  });

  it("stays quiet while text is being composed", () => {
    const event = new KeyboardEvent("keydown", { key: "S", shiftKey: true });
    Object.defineProperty(event, "isComposing", { value: true });
    handlers.onHotkey(event);

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
  it("stores time, note and the creation date from the row", () => {
    const input = ui.createTimestampItem(15, "note A", past);
    input.value = "edited";

    handlers.saveCurrentTimestamps();
    expect(loadTimestamps("vid1")).toEqual([
      { time: 15, note: "edited", creation: past },
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

  // A navegação SPA move a URL antes de remontar o painel, e o painel novo passa
  // 1s vazio. Um save com debounce pendente que caia nessa janela lê a lista de
  // um vídeo com o ID do outro.
  it("does not wipe the next video while the pane still belongs to the old one", () => {
    saveTimestamps("vid2", [
      { time: 10, note: "b", creation: past, expiration: future },
    ]);
    ui.createTimestampItem(15, "a", past, future);
    state.videoId = "vid2";

    handlers.saveCurrentTimestamps();

    expect(loadTimestamps("vid2")).toEqual([
      { time: 10, note: "b", creation: past, expiration: future },
    ]);
    expect(loadTimestamps("vid1")).toEqual([]);
  });

  it("does not drop the next video key when the fresh pane is still empty", () => {
    saveTimestamps("vid2", [
      { time: 10, note: "b", creation: past, expiration: future },
    ]);
    localStorage.setItem("yttsmeta_vid2", JSON.stringify({ title: "Dois" }));
    state.videoId = "vid2";

    handlers.saveCurrentTimestamps();

    expect(loadTimestamps("vid2")).toHaveLength(1);
    expect(loadVideoTitle("vid2")).toBe("Dois");
  });

  it("no-ops without a pane", () => {
    document.querySelector("#ytls-pane").remove();
    handlers.saveCurrentTimestamps();
    expect(loadTimestamps("vid1")).toEqual([]);
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

  it("preserves the stored creation date", () => {
    saveTimestamps("vid1", [
      { time: 10, note: "a", creation: past, expiration: future },
    ]);

    handlers.loadSavedTimestamps();
    const li = document.querySelector("#ytls-pane ul li:not(.now-playing)");
    expect(li.dataset.creation).toBe(past);
    expect(li.dataset.expiration).toBeUndefined();
  });

  it("does not write the legacy expiration field back on save", () => {
    saveTimestamps("vid1", [
      { time: 10, note: "a", creation: past, expiration: future },
    ]);

    handlers.loadSavedTimestamps();
    handlers.saveCurrentTimestamps();
    expect(loadTimestamps("vid1")).toEqual([
      { time: 10, note: "a", creation: past },
    ]);
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
      { time: 10, note: "gone", creation: expired },
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
      { time: 30, note: "gone", creation: expired },
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

describe("saveCurrentTimestamps title", () => {
  const originalTitle = document.title;
  afterEach(() => {
    document.title = originalTitle;
  });

  it("stores the page title alongside the timestamps", () => {
    document.title = "(3) Meu Vídeo - YouTube";
    ui.createTimestampItem(10, "nota");

    handlers.saveCurrentTimestamps();
    expect(loadVideoTitle("vid1")).toBe("Meu Vídeo");
  });

  it("does not store a title when the list ends up empty", () => {
    document.title = "Meu Vídeo - YouTube";
    handlers.saveCurrentTimestamps();
    expect(localStorage.getItem("yttsmeta_vid1")).toBeNull();
  });
});

describe("deleteVideoFromList", () => {
  const stamp = (creation) => ({
    time: 10,
    note: "",
    creation,
    expiration: future,
  });

  let container;

  const renderList = () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    ui.renderVideoList(container);
    return container;
  };

  const deleteBtnFor = (videoId) =>
    container.querySelector(`[data-video-id="${videoId}"] .ytts-icon-btn`);

  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("drops the video from storage and from the list", () => {
    saveTimestamps("other", [stamp(past)]);
    localStorage.setItem("yttsmeta_other", JSON.stringify({ title: "Outro" }));
    saveTimestamps("vid1", [stamp(past)]);
    renderList();

    deleteBtnFor("other").click();

    expect(localStorage.getItem("ytts_other")).toBeNull();
    expect(localStorage.getItem("yttsmeta_other")).toBeNull();
    expect(container.querySelectorAll(".ytts-video-item").length).toBe(1);
    expect(loadTimestamps("vid1")).toHaveLength(1);
    expect(notifySpy).toHaveBeenCalledWith("🗑️ Video timestamps deleted!");
  });

  it("keeps everything when the confirm is declined", () => {
    saveTimestamps("other", [stamp(past)]);
    renderList();

    window.confirm.mockReturnValue(false);
    deleteBtnFor("other").click();

    expect(loadTimestamps("other")).toHaveLength(1);
    expect(container.querySelectorAll(".ytts-video-item").length).toBe(1);
  });

  it("falls back to the empty state once the last video goes", () => {
    saveTimestamps("other", [stamp(past)]);
    renderList();

    deleteBtnFor("other").click();

    expect(container.querySelector(".ytts-video-empty")).not.toBeNull();
    expect(container.querySelectorAll(".ytts-video-item").length).toBe(0);
  });

  it("clears the pane when the deleted video is the one playing", () => {
    ui.createTimestampItem(10, "nota");
    ui.createTimestampItem(20, "outra");
    handlers.saveCurrentTimestamps();
    renderList();

    deleteBtnFor("vid1").click();

    expect(readListItems()).toEqual([]);
    expect(progressMarkers.updateMarkers).toHaveBeenCalled();
    expect(localStorage.getItem("ytts_vid1")).toBeNull();
  });

  it("leaves the pane alone when the deleted video is another one", () => {
    ui.createTimestampItem(10, "nota");
    handlers.saveCurrentTimestamps();
    saveTimestamps("other", [stamp(past)]);
    renderList();

    deleteBtnFor("other").click();

    expect(readListItems()).toHaveLength(1);
    expect(loadTimestamps("vid1")).toHaveLength(1);
  });
});
