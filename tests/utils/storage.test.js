import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  saveTimestamps,
  loadTimestamps,
  getAllSavedVideos,
  deleteVideoTimestamps,
  removeExpiredFromStorage,
  getRetentionDays,
  getMarkerShape,
  getMarkerColor,
  MARKER_SHAPES,
  saveVideoTitle,
  loadVideoTitle,
  deleteVideoTitle,
} from "../../src/utils/storage.js";

const past = new Date(Date.now() - 1000).toISOString();
const future = new Date(Date.now() + 86400000).toISOString();
const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();

describe("saveTimestamps / loadTimestamps", () => {
  beforeEach(() => localStorage.clear());

  it("roundtrip", () => {
    const ts = [{ time: 100, note: "test", creation: past, expiration: future }];
    saveTimestamps("vid1", ts);
    expect(loadTimestamps("vid1")).toEqual(ts);
  });

  it("returns [] for unknown videoId", () => {
    expect(loadTimestamps("nonexistent")).toEqual([]);
  });

  it("overwrites existing data", () => {
    saveTimestamps("vid1", [{ time: 10 }]);
    saveTimestamps("vid1", [{ time: 20 }]);
    expect(loadTimestamps("vid1")).toEqual([{ time: 20 }]);
  });
});

describe("saveVideoTitle / loadVideoTitle / deleteVideoTitle", () => {
  beforeEach(() => localStorage.clear());

  it("roundtrip", () => {
    saveVideoTitle("vid1", "Meu Vídeo");
    expect(loadVideoTitle("vid1")).toBe("Meu Vídeo");
  });

  it("stores the title under yttsmeta_, apart from the timestamps", () => {
    saveTimestamps("vid1", [{ time: 10 }]);
    saveVideoTitle("vid1", "Meu Vídeo");
    expect(localStorage.getItem("yttsmeta_vid1")).toBe(
      JSON.stringify({ title: "Meu Vídeo" }),
    );
    expect(loadTimestamps("vid1")).toEqual([{ time: 10 }]);
  });

  it("returns '' for a video with no title saved", () => {
    expect(loadVideoTitle("nonexistent")).toBe("");
  });

  it("an empty title does not overwrite a saved one", () => {
    saveVideoTitle("vid1", "Meu Vídeo");
    saveVideoTitle("vid1", "");
    expect(loadVideoTitle("vid1")).toBe("Meu Vídeo");
  });

  it("returns '' when the meta value has no title string", () => {
    localStorage.setItem("yttsmeta_vid1", JSON.stringify({ other: 1 }));
    expect(loadVideoTitle("vid1")).toBe("");
  });

  it("deleteVideoTitle removes the meta key", () => {
    saveVideoTitle("vid1", "Meu Vídeo");
    deleteVideoTitle("vid1");
    expect(localStorage.getItem("yttsmeta_vid1")).toBeNull();
    expect(loadVideoTitle("vid1")).toBe("");
  });
});

describe("getAllSavedVideos", () => {
  beforeEach(() => localStorage.clear());

  it("returns all ytts_ videos", () => {
    saveTimestamps("vid1", [{ time: 10 }]);
    saveTimestamps("vid2", [{ time: 20 }]);
    const all = getAllSavedVideos();
    expect(all).toHaveLength(2);
    expect(all.map((v) => v.videoId)).toContain("vid1");
    expect(all.map((v) => v.videoId)).toContain("vid2");
  });

  it("excludes videos with empty timestamp arrays", () => {
    saveTimestamps("vid1", []);
    expect(getAllSavedVideos()).toHaveLength(0);
  });

  it("ignores non-ytts_ localStorage keys", () => {
    localStorage.setItem("other_key", "value");
    saveTimestamps("vid1", [{ time: 10 }]);
    expect(getAllSavedVideos()).toHaveLength(1);
  });

  it("returns the saved title, and '' for a video without one", () => {
    saveTimestamps("vid1", [{ time: 10 }]);
    saveVideoTitle("vid1", "Meu Vídeo");
    saveTimestamps("vid2", [{ time: 20 }]);

    const byId = Object.fromEntries(
      getAllSavedVideos().map((v) => [v.videoId, v.title]),
    );
    expect(byId).toEqual({ vid1: "Meu Vídeo", vid2: "" });
  });

  it("does not turn a yttsmeta_ key into an entry of its own", () => {
    saveTimestamps("vid1", [{ time: 10 }]);
    saveVideoTitle("vid1", "Meu Vídeo");
    expect(getAllSavedVideos().map((v) => v.videoId)).toEqual(["vid1"]);
  });

  it("ignores the ytts_ config keys, which are not arrays", () => {
    saveTimestamps("vid1", [{ time: 10 }]);
    localStorage.setItem("ytts_auto_cleanup", "true");
    localStorage.setItem("ytts_start_minimized", "false");
    localStorage.setItem("ytts_pane_position", JSON.stringify({ top: 1, left: 2 }));
    expect(getAllSavedVideos().map((v) => v.videoId)).toEqual(["vid1"]);
  });
});

describe("deleteVideoTimestamps", () => {
  beforeEach(() => localStorage.clear());

  it("removes video from storage", () => {
    saveTimestamps("vid1", [{ time: 10 }]);
    deleteVideoTimestamps("vid1");
    expect(loadTimestamps("vid1")).toEqual([]);
  });

  it("no-ops for non-existent video", () => {
    expect(() => deleteVideoTimestamps("ghost")).not.toThrow();
  });

  it("removes the title along with the timestamps", () => {
    saveTimestamps("vid1", [{ time: 10 }]);
    saveVideoTitle("vid1", "Meu Vídeo");
    deleteVideoTimestamps("vid1");
    expect(localStorage.getItem("ytts_vid1")).toBeNull();
    expect(localStorage.getItem("yttsmeta_vid1")).toBeNull();
  });
});

describe("getRetentionDays", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to 30 when the key is absent", () => {
    expect(getRetentionDays()).toBe(30);
  });

  it("reads the stored number of days", () => {
    localStorage.setItem("ytts_retention_days", "7");
    expect(getRetentionDays()).toBe(7);
  });

  it("falls back to 30 for zero", () => {
    localStorage.setItem("ytts_retention_days", "0");
    expect(getRetentionDays()).toBe(30);
  });

  it("falls back to 30 for a non-numeric value", () => {
    localStorage.setItem("ytts_retention_days", "abc");
    expect(getRetentionDays()).toBe(30);
  });

  it("falls back to 30 for an empty value", () => {
    localStorage.setItem("ytts_retention_days", "");
    expect(getRetentionDays()).toBe(30);
  });

  it("falls back to 30 when localStorage is unreachable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(getRetentionDays()).toBe(30);
    vi.restoreAllMocks();
  });
});

describe("getMarkerShape", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to the bar when the key is absent", () => {
    expect(getMarkerShape()).toBe("bar");
  });

  it("reads every shape it offers", () => {
    Object.keys(MARKER_SHAPES).forEach((shape) => {
      localStorage.setItem("ytts_marker_shape", shape);
      expect(getMarkerShape()).toBe(shape);
    });
  });

  it("falls back to the bar for an unknown shape", () => {
    localStorage.setItem("ytts_marker_shape", "triangle");
    expect(getMarkerShape()).toBe("bar");
  });

  it("falls back to the bar for an empty value", () => {
    localStorage.setItem("ytts_marker_shape", "");
    expect(getMarkerShape()).toBe("bar");
  });

  it("falls back to the bar for an inherited property name", () => {
    localStorage.setItem("ytts_marker_shape", "toString");
    expect(getMarkerShape()).toBe("bar");
  });

  it("falls back to the bar when localStorage is unreachable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(getMarkerShape()).toBe("bar");
    vi.restoreAllMocks();
  });
});

describe("getMarkerColor", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to the current red when the key is absent", () => {
    expect(getMarkerColor()).toBe("#ff6b6b");
  });

  it("reads the stored colour", () => {
    localStorage.setItem("ytts_marker_color", "#00ff00");
    expect(getMarkerColor()).toBe("#00ff00");
  });

  it("accepts uppercase hex digits", () => {
    localStorage.setItem("ytts_marker_color", "#00FF00");
    expect(getMarkerColor()).toBe("#00FF00");
  });

  it("falls back to the default for a colour name", () => {
    localStorage.setItem("ytts_marker_color", "vermelho");
    expect(getMarkerColor()).toBe("#ff6b6b");
  });

  it("falls back to the default for a 3-digit hex", () => {
    localStorage.setItem("ytts_marker_color", "#fff");
    expect(getMarkerColor()).toBe("#ff6b6b");
  });

  it("falls back to the default for an empty value", () => {
    localStorage.setItem("ytts_marker_color", "");
    expect(getMarkerColor()).toBe("#ff6b6b");
  });

  it("falls back to the default when localStorage is unreachable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(getMarkerColor()).toBe("#ff6b6b");
    vi.restoreAllMocks();
  });
});

describe("removeExpiredFromStorage", () => {
  beforeEach(() => localStorage.clear());

  it("removes expired timestamps", () => {
    saveTimestamps("vid1", [
      { time: 10, note: "", creation: daysAgo(40) },
      { time: 20, note: "", creation: daysAgo(3) },
    ]);
    const { cleanedCount, affectedVideoIds } = removeExpiredFromStorage();
    expect(cleanedCount).toBe(1);
    expect(affectedVideoIds).toContain("vid1");
    const remaining = loadTimestamps("vid1");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].time).toBe(20);
  });

  it("removes key if all timestamps expired", () => {
    saveTimestamps("vid1", [{ time: 10, creation: daysAgo(40) }]);
    removeExpiredFromStorage();
    expect(loadTimestamps("vid1")).toEqual([]);
    expect(localStorage.getItem("ytts_vid1")).toBeNull();
  });

  it("keeps timestamps without a creation field", () => {
    saveTimestamps("vid1", [{ time: 10, note: "" }]);
    const { cleanedCount } = removeExpiredFromStorage();
    expect(cleanedCount).toBe(0);
    expect(loadTimestamps("vid1")).toHaveLength(1);
  });

  it("keeps timestamps whose creation does not parse as a date", () => {
    saveTimestamps("vid1", [{ time: 10, note: "", creation: "not a date" }]);
    const { cleanedCount } = removeExpiredFromStorage();
    expect(cleanedCount).toBe(0);
    expect(loadTimestamps("vid1")).toHaveLength(1);
  });

  it("honors a shorter configured retention", () => {
    localStorage.setItem("ytts_retention_days", "7");
    saveTimestamps("vid1", [
      { time: 10, note: "old", creation: daysAgo(10) },
      { time: 20, note: "recent", creation: daysAgo(3) },
    ]);
    const { cleanedCount } = removeExpiredFromStorage();
    expect(cleanedCount).toBe(1);
    expect(loadTimestamps("vid1")).toHaveLength(1);
    expect(loadTimestamps("vid1")[0].note).toBe("recent");
  });

  it("keeps that same stamp under the default 30 day retention", () => {
    saveTimestamps("vid1", [{ time: 10, note: "old", creation: daysAgo(10) }]);
    const { cleanedCount } = removeExpiredFromStorage();
    expect(cleanedCount).toBe(0);
    expect(loadTimestamps("vid1")).toHaveLength(1);
  });

  // Registros de versões antigas guardam `expiration`; ele não manda mais.
  it("ignores the legacy expiration field", () => {
    saveTimestamps("vid1", [
      { time: 10, note: "", creation: daysAgo(1), expiration: past },
    ]);
    const { cleanedCount } = removeExpiredFromStorage();
    expect(cleanedCount).toBe(0);
    expect(loadTimestamps("vid1")).toHaveLength(1);
  });

  it("returns cleanedCount 0 when nothing expired", () => {
    saveTimestamps("vid1", [{ time: 10, creation: daysAgo(3) }]);
    const { cleanedCount } = removeExpiredFromStorage();
    expect(cleanedCount).toBe(0);
  });

  it("returns empty affectedVideoIds when nothing cleaned", () => {
    saveTimestamps("vid1", [{ time: 10, creation: daysAgo(3) }]);
    const { affectedVideoIds } = removeExpiredFromStorage();
    expect(affectedVideoIds).toHaveLength(0);
  });

  it("sweeps every video in one pass", () => {
    saveTimestamps("vid1", [{ time: 10, creation: daysAgo(40) }]);
    saveTimestamps("vid2", [{ time: 20, creation: daysAgo(40) }]);
    const { cleanedCount, affectedVideoIds } = removeExpiredFromStorage();
    expect(cleanedCount).toBe(2);
    expect(affectedVideoIds.sort()).toEqual(["vid1", "vid2"]);
  });

  // O laço varre do índice mais alto para o mais baixo, então as chaves de
  // configuração gravadas depois dos vídeos são as primeiras a ser lidas: antes
  // da guarda, o TypeError delas abortava a passagem e nenhum vídeo era limpo.
  it("sweeps every video even with the ytts_ config keys present", () => {
    saveTimestamps("vid1", [{ time: 10, creation: daysAgo(40) }]);
    saveTimestamps("vid2", [{ time: 20, creation: daysAgo(40) }]);
    localStorage.setItem("ytts_auto_cleanup", "true");
    localStorage.setItem("ytts_start_minimized", "false");
    localStorage.setItem("ytts_pane_position", JSON.stringify({ top: 1, left: 2 }));

    const { cleanedCount, affectedVideoIds } = removeExpiredFromStorage();

    expect(cleanedCount).toBe(2);
    expect(affectedVideoIds.sort()).toEqual(["vid1", "vid2"]);
    expect(localStorage.getItem("ytts_auto_cleanup")).toBe("true");
    expect(localStorage.getItem("ytts_pane_position")).toBe(
      JSON.stringify({ top: 1, left: 2 }),
    );
  });

  it("removes the title when the video loses every timestamp", () => {
    saveTimestamps("vid1", [{ time: 10, creation: daysAgo(40) }]);
    saveVideoTitle("vid1", "Meu Vídeo");
    removeExpiredFromStorage();
    expect(localStorage.getItem("ytts_vid1")).toBeNull();
    expect(localStorage.getItem("yttsmeta_vid1")).toBeNull();
  });

  it("keeps the title when the video still has valid timestamps", () => {
    saveTimestamps("vid1", [
      { time: 10, creation: daysAgo(40) },
      { time: 20, creation: daysAgo(3) },
    ]);
    saveVideoTitle("vid1", "Meu Vídeo");
    removeExpiredFromStorage();
    expect(loadVideoTitle("vid1")).toBe("Meu Vídeo");
  });

  it("sweeps every video with yttsmeta_ keys interleaved", () => {
    saveVideoTitle("vid1", "Um");
    saveTimestamps("vid2", [{ time: 20, creation: daysAgo(40) }]);
    saveVideoTitle("vid2", "Dois");
    saveTimestamps("vid3", [{ time: 30, creation: daysAgo(40) }]);
    saveTimestamps("vid1", [{ time: 10, creation: daysAgo(40) }]);

    const { cleanedCount, affectedVideoIds } = removeExpiredFromStorage();

    expect(cleanedCount).toBe(3);
    expect(affectedVideoIds.sort()).toEqual(["vid1", "vid2", "vid3"]);
    expect(localStorage.length).toBe(0);
  });

  it("leaves non-ytts_ keys alone", () => {
    localStorage.setItem("other_key", "not json");
    saveTimestamps("vid1", [{ time: 10, creation: daysAgo(40) }]);
    removeExpiredFromStorage();
    expect(localStorage.getItem("other_key")).toBe("not json");
  });
});

describe("storage resilience", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("loadTimestamps returns [] on corrupt JSON", () => {
    localStorage.setItem("ytts_vid1", "{not json");
    expect(loadTimestamps("vid1")).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it("getAllSavedVideos skips a corrupt entry and keeps the rest", () => {
    localStorage.setItem("ytts_broken", "{not json");
    saveTimestamps("vid1", [{ time: 10 }]);
    expect(getAllSavedVideos().map((v) => v.videoId)).toEqual(["vid1"]);
  });

  it("saveTimestamps swallows a write failure", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => saveTimestamps("vid1", [{ time: 10 }])).not.toThrow();
    expect(console.error).toHaveBeenCalled();
  });

  it("removeExpiredFromStorage survives corrupt data and leaves it in place", () => {
    localStorage.setItem("ytts_broken", "{not json");
    let result;
    expect(() => {
      result = removeExpiredFromStorage();
    }).not.toThrow();

    expect(result).toEqual({ cleanedCount: 0, affectedVideoIds: [] });
    expect(localStorage.getItem("ytts_broken")).toBe("{not json");
    expect(console.error).toHaveBeenCalled();
  });
});
