import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  saveTimestamps,
  loadTimestamps,
  getAllSavedVideos,
  deleteVideoTimestamps,
  removeExpiredFromStorage,
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
