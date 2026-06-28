import { describe, it, expect, beforeEach } from "vitest";
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
});
