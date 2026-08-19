import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  saveTimestamps,
  loadTimestamps,
  getAllSavedVideos,
  deleteVideoTimestamps,
  removeExpiredFromStorage,
  saveVideoTitle,
  loadVideoTitle,
  deleteVideoTitle,
} from "../../src/utils/storage.js";

const past = new Date(Date.now() - 1000).toISOString();
const future = new Date(Date.now() + 86400000).toISOString();

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

describe("removeExpiredFromStorage", () => {
  beforeEach(() => localStorage.clear());

  it("removes expired timestamps", () => {
    saveTimestamps("vid1", [
      { time: 10, note: "", expiration: past },
      { time: 20, note: "", expiration: future },
    ]);
    const { cleanedCount, affectedVideoIds } = removeExpiredFromStorage();
    expect(cleanedCount).toBe(1);
    expect(affectedVideoIds).toContain("vid1");
    const remaining = loadTimestamps("vid1");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].time).toBe(20);
  });

  it("removes key if all timestamps expired", () => {
    saveTimestamps("vid1", [{ time: 10, expiration: past }]);
    removeExpiredFromStorage();
    expect(loadTimestamps("vid1")).toEqual([]);
    expect(localStorage.getItem("ytts_vid1")).toBeNull();
  });

  it("keeps timestamps without expiration field", () => {
    saveTimestamps("vid1", [{ time: 10, note: "" }]);
    const { cleanedCount } = removeExpiredFromStorage();
    expect(cleanedCount).toBe(0);
    expect(loadTimestamps("vid1")).toHaveLength(1);
  });

  it("returns cleanedCount 0 when nothing expired", () => {
    saveTimestamps("vid1", [{ time: 10, expiration: future }]);
    const { cleanedCount } = removeExpiredFromStorage();
    expect(cleanedCount).toBe(0);
  });

  it("returns empty affectedVideoIds when nothing cleaned", () => {
    saveTimestamps("vid1", [{ time: 10, expiration: future }]);
    const { affectedVideoIds } = removeExpiredFromStorage();
    expect(affectedVideoIds).toHaveLength(0);
  });

  it("sweeps every video in one pass", () => {
    saveTimestamps("vid1", [{ time: 10, expiration: past }]);
    saveTimestamps("vid2", [{ time: 20, expiration: past }]);
    const { cleanedCount, affectedVideoIds } = removeExpiredFromStorage();
    expect(cleanedCount).toBe(2);
    expect(affectedVideoIds.sort()).toEqual(["vid1", "vid2"]);
  });

  // O laço varre do índice mais alto para o mais baixo, então as chaves de
  // configuração gravadas depois dos vídeos são as primeiras a ser lidas: antes
  // da guarda, o TypeError delas abortava a passagem e nenhum vídeo era limpo.
  it("sweeps every video even with the ytts_ config keys present", () => {
    saveTimestamps("vid1", [{ time: 10, expiration: past }]);
    saveTimestamps("vid2", [{ time: 20, expiration: past }]);
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
    saveTimestamps("vid1", [{ time: 10, expiration: past }]);
    saveVideoTitle("vid1", "Meu Vídeo");
    removeExpiredFromStorage();
    expect(localStorage.getItem("ytts_vid1")).toBeNull();
    expect(localStorage.getItem("yttsmeta_vid1")).toBeNull();
  });

  it("keeps the title when the video still has valid timestamps", () => {
    saveTimestamps("vid1", [
      { time: 10, expiration: past },
      { time: 20, expiration: future },
    ]);
    saveVideoTitle("vid1", "Meu Vídeo");
    removeExpiredFromStorage();
    expect(loadVideoTitle("vid1")).toBe("Meu Vídeo");
  });

  it("sweeps every video with yttsmeta_ keys interleaved", () => {
    saveVideoTitle("vid1", "Um");
    saveTimestamps("vid2", [{ time: 20, expiration: past }]);
    saveVideoTitle("vid2", "Dois");
    saveTimestamps("vid3", [{ time: 30, expiration: past }]);
    saveTimestamps("vid1", [{ time: 10, expiration: past }]);

    const { cleanedCount, affectedVideoIds } = removeExpiredFromStorage();

    expect(cleanedCount).toBe(3);
    expect(affectedVideoIds.sort()).toEqual(["vid1", "vid2", "vid3"]);
    expect(localStorage.length).toBe(0);
  });

  it("leaves non-ytts_ keys alone", () => {
    localStorage.setItem("other_key", "not json");
    saveTimestamps("vid1", [{ time: 10, expiration: past }]);
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
