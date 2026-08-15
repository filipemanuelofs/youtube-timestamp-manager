import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  copyToClipboard,
  showCopyFeedback,
} from "../../src/utils/clipboard.js";

describe("copyToClipboard", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete document.execCommand;
  });

  it("uses the Clipboard API in a secure context", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.stubGlobal("isSecureContext", true);

    await expect(copyToClipboard("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand outside a secure context", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });
    vi.stubGlobal("isSecureContext", false);
    document.execCommand = vi.fn(() => true);

    await expect(copyToClipboard("fallback")).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("falls back when the Clipboard API is absent", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("isSecureContext", true);
    document.execCommand = vi.fn(() => true);

    await expect(copyToClipboard("no api")).resolves.toBe(true);
  });

  it("removes the temporary textarea after the fallback copy", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("isSecureContext", false);
    let seenValue = null;
    document.execCommand = vi.fn(() => {
      seenValue = document.querySelector("textarea").value;
      return true;
    });

    await copyToClipboard("temp text");
    expect(seenValue).toBe("temp text");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("returns false when execCommand reports failure", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("isSecureContext", false);
    document.execCommand = vi.fn(() => false);

    await expect(copyToClipboard("nope")).resolves.toBe(false);
  });

  it("returns false when the Clipboard API rejects", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    vi.stubGlobal("isSecureContext", true);

    await expect(copyToClipboard("denied")).resolves.toBe(false);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("showCopyFeedback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const buildButton = () => {
    const btn = document.createElement("span");
    btn.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
    return btn;
  };

  it("turns the icon green then restores it", () => {
    const btn = buildButton();
    const svg = btn.querySelector("svg");

    showCopyFeedback(btn);
    expect(svg.style.fill).toBe("rgb(76, 175, 80)");

    vi.advanceTimersByTime(500);
    expect(svg.style.fill).toBe("rgb(227, 227, 227)");
  });

  it("no-ops for a null element", () => {
    expect(() => showCopyFeedback(null)).not.toThrow();
  });

  it("no-ops when the element has no svg", () => {
    expect(() => showCopyFeedback(document.createElement("span"))).not.toThrow();
  });
});
