import { describe, it, expect } from "vitest";
import {
  DEFAULT_HOTKEY,
  formatHotkey,
  hotkeyFromEvent,
  matchesHotkey,
} from "../../src/utils/hotkey.js";

const event = (key, mods = {}) => ({
  key,
  ctrlKey: !!mods.ctrl,
  altKey: !!mods.alt,
  shiftKey: !!mods.shift,
  metaKey: !!mods.meta,
});

describe("DEFAULT_HOTKEY", () => {
  it("is Shift+S", () => {
    expect(formatHotkey(DEFAULT_HOTKEY)).toBe("Shift+S");
  });
});

describe("formatHotkey", () => {
  it("returns an empty label when there is no hotkey", () => {
    expect(formatHotkey(null)).toBe("");
    expect(formatHotkey({ key: "" })).toBe("");
  });

  it("lists the modifiers in a fixed order", () => {
    expect(
      formatHotkey({ key: "S", ctrl: true, alt: true, shift: true, meta: true }),
    ).toBe("Ctrl+Alt+Shift+Meta+S");
  });

  it("uppercases single letters and names the space bar", () => {
    expect(formatHotkey({ key: "s", shift: true })).toBe("Shift+S");
    expect(formatHotkey({ key: " ", alt: true })).toBe("Alt+Space");
    expect(formatHotkey({ key: "F2" })).toBe("F2");
  });
});

describe("hotkeyFromEvent", () => {
  it("reads the key and the modifiers pressed with it", () => {
    expect(hotkeyFromEvent(event("S", { shift: true }))).toEqual({
      key: "S",
      ctrl: false,
      alt: false,
      shift: true,
      meta: false,
    });
  });

  it("ignores events that carry only a modifier", () => {
    expect(hotkeyFromEvent(event("Shift", { shift: true }))).toBeNull();
    expect(hotkeyFromEvent(event("Control", { ctrl: true }))).toBeNull();
    expect(hotkeyFromEvent(event("Alt", { alt: true }))).toBeNull();
    expect(hotkeyFromEvent(event("Meta", { meta: true }))).toBeNull();
    expect(hotkeyFromEvent(event("AltGraph"))).toBeNull();
  });

  it("ignores an event without a key", () => {
    expect(hotkeyFromEvent(event(""))).toBeNull();
    expect(hotkeyFromEvent(null)).toBeNull();
  });
});

describe("matchesHotkey", () => {
  it("matches the configured combination", () => {
    expect(matchesHotkey(event("S", { shift: true }), DEFAULT_HOTKEY)).toBe(
      true,
    );
  });

  it("does not match when an extra modifier is held", () => {
    expect(
      matchesHotkey(event("S", { shift: true, ctrl: true }), DEFAULT_HOTKEY),
    ).toBe(false);
  });

  it("does not match when a required modifier is missing", () => {
    expect(matchesHotkey(event("S"), DEFAULT_HOTKEY)).toBe(false);
  });

  it("does not match another key", () => {
    expect(matchesHotkey(event("D", { shift: true }), DEFAULT_HOTKEY)).toBe(
      false,
    );
  });

  it("never matches when the hotkey is disabled", () => {
    expect(matchesHotkey(event("S", { shift: true }), null)).toBe(false);
    expect(matchesHotkey(event("S", { shift: true }), { key: "" })).toBe(false);
  });
});
