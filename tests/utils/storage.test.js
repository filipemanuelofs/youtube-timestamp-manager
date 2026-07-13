import { describe, it, expect, beforeEach } from "vitest";
import {
  saveTimestamps,
  loadTimestamps,
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
