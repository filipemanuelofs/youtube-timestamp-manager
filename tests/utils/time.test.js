import { describe, it, expect } from "vitest";
import { formatTime } from "../../src/utils/time.js";

describe("formatTime", () => {
  it("formats seconds only", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(59)).toBe("0:59");
  });

  it("formats minutes and seconds", () => {
    expect(formatTime(60)).toBe("1:00");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(3599)).toBe("59:59");
  });

  it("formats hours, minutes and seconds", () => {
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3661)).toBe("1:01:01");
    expect(formatTime(7322)).toBe("2:02:02");
  });

  it("pads seconds with leading zero", () => {
    expect(formatTime(61)).toBe("1:01");
    expect(formatTime(3601)).toBe("1:00:01");
  });

  it("pads minutes with a leading zero only past the first hour", () => {
    expect(formatTime(305)).toBe("5:05");
    expect(formatTime(3905)).toBe("1:05:05");
  });

  it("truncates fractional seconds", () => {
    expect(formatTime(65.9)).toBe("1:05");
    expect(formatTime(3599.99)).toBe("59:59");
  });

  it("handles durations past 10 hours", () => {
    expect(formatTime(36000)).toBe("10:00:00");
    expect(formatTime(86399)).toBe("23:59:59");
  });
});
