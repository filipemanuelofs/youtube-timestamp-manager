import { describe, it, expect, beforeEach, vi } from "vitest";
import { elements, state } from "../../src/state.js";
import { getVideoId, getVideo } from "../../src/utils/video.js";

describe("getVideoId", () => {
  beforeEach(() => {
    state.videoId = null;
    vi.unstubAllGlobals();
  });

  it("parses ?v= query param", () => {
    vi.stubGlobal("location", {
      search: "?v=dQw4w9WgXcQ",
      href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(getVideoId()).toBe("dQw4w9WgXcQ");
  });

  it("parses /live/ URL", () => {
    vi.stubGlobal("location", {
      search: "",
      href: "https://www.youtube.com/live/abc123def",
    });
    expect(getVideoId()).toBe("abc123def");
  });

  it("parses /shorts/ URL", () => {
    vi.stubGlobal("location", {
      search: "",
      href: "https://www.youtube.com/shorts/shortVidId",
    });
    expect(getVideoId()).toBe("shortVidId");
  });

  it("strips extra query params after videoId", () => {
    vi.stubGlobal("location", {
      search: "?v=abc123&t=60",
      href: "https://www.youtube.com/watch?v=abc123&t=60",
    });
    expect(getVideoId()).toBe("abc123");
  });

  it("caches result in state.videoId", () => {
    vi.stubGlobal("location", {
      search: "?v=cached123",
      href: "https://www.youtube.com/watch?v=cached123",
    });
    getVideoId();
    vi.stubGlobal("location", {
      search: "?v=other456",
      href: "https://www.youtube.com/watch?v=other456",
    });
    expect(getVideoId()).toBe("cached123");
  });
});

describe("getVideo", () => {
  beforeEach(() => {
    elements.video = null;
    document.body.innerHTML = "";
  });

  it("returns video element from DOM", () => {
    const video = document.createElement("video");
    document.body.appendChild(video);
    expect(getVideo()).toBe(video);
  });

  it("caches result in elements.video", () => {
    const video = document.createElement("video");
    document.body.appendChild(video);
    getVideo();
    document.body.innerHTML = "";
    expect(getVideo()).toBe(video);
  });

  it("returns null if no video in DOM", () => {
    expect(getVideo()).toBeNull();
  });
});
