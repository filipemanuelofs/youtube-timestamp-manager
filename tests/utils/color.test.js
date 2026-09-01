import { describe, it, expect } from "vitest";
import { hexToRgba } from "../../src/utils/color.js";

describe("hexToRgba", () => {
  it("converts a 6-digit hex to rgba", () => {
    expect(hexToRgba("#ff6b6b", 0.6)).toBe("rgba(255, 107, 107, 0.6)");
    expect(hexToRgba("#000000", 1)).toBe("rgba(0, 0, 0, 1)");
    expect(hexToRgba("#00ff00", 0.8)).toBe("rgba(0, 255, 0, 0.8)");
  });

  it("accepts uppercase hex digits", () => {
    expect(hexToRgba("#FF6B6B", 0.6)).toBe("rgba(255, 107, 107, 0.6)");
  });

  it("falls back to the default colour on invalid input", () => {
    expect(hexToRgba("", 0.6)).toBe("rgba(255, 107, 107, 0.6)");
    expect(hexToRgba("red", 0.6)).toBe("rgba(255, 107, 107, 0.6)");
    expect(hexToRgba("#fff", 0.6)).toBe("rgba(255, 107, 107, 0.6)");
    expect(hexToRgba("ff6b6b", 0.6)).toBe("rgba(255, 107, 107, 0.6)");
    expect(hexToRgba(null, 0.6)).toBe("rgba(255, 107, 107, 0.6)");
    expect(hexToRgba(undefined, 0.6)).toBe("rgba(255, 107, 107, 0.6)");
  });
});
