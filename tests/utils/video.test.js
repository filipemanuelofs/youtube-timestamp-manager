import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { elements, state } from "../../src/state.js";
import {
  getVideoId,
  getVideo,
  getVideoTitle,
} from "../../src/utils/video.js";

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

  it("parses a /shorts/ URL that carries query params", () => {
    vi.stubGlobal("location", {
      search: "",
      href: "https://www.youtube.com/shorts/shortVidId?feature=share",
    });
    expect(getVideoId()).toBe("shortVidId");
  });

  it("prefers the ?v= param over the path segment", () => {
    vi.stubGlobal("location", {
      search: "?v=fromQuery",
      href: "https://www.youtube.com/live/fromPath?v=fromQuery",
    });
    expect(getVideoId()).toBe("fromQuery");
  });

  it("returns undefined off a video page", () => {
    vi.stubGlobal("location", {
      search: "",
      href: "https://www.youtube.com/",
    });
    expect(getVideoId()).toBeUndefined();
  });

  it("keeps resolving after an undefined result instead of caching it", () => {
    vi.stubGlobal("location", { search: "", href: "https://www.youtube.com/" });
    getVideoId();
    vi.stubGlobal("location", {
      search: "?v=later123",
      href: "https://www.youtube.com/watch?v=later123",
    });
    expect(getVideoId()).toBe("later123");
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

describe("getVideoTitle", () => {
  const original = document.title;
  afterEach(() => {
    document.title = original;
  });

  it("strips the notification prefix and the ' - YouTube' suffix", () => {
    document.title = "(3) Meu Vídeo - YouTube";
    expect(getVideoTitle()).toBe("Meu Vídeo");
  });

  it("strips the suffix when there is no notification prefix", () => {
    document.title = "Meu Vídeo - YouTube";
    expect(getVideoTitle()).toBe("Meu Vídeo");
  });

  it("keeps a title that carries neither", () => {
    document.title = "Meu Vídeo";
    expect(getVideoTitle()).toBe("Meu Vídeo");
  });

  it("keeps a dash that belongs to the title itself", () => {
    document.title = "Artista - Música - YouTube";
    expect(getVideoTitle()).toBe("Artista - Música");
  });

  it("returns '' when nothing is left", () => {
    document.title = " - YouTube";
    expect(getVideoTitle()).toBe("");
  });

  // Título da aba antes de a página hidratar. Sem hífen, o sufixo não casa.
  it("returns '' for the bare 'YouTube' title", () => {
    document.title = "YouTube";
    expect(getVideoTitle()).toBe("");
  });

  it("returns '' for 'YouTube' behind a notification prefix", () => {
    document.title = "(3) YouTube";
    expect(getVideoTitle()).toBe("");
  });

  // Falso positivo aceito: um vídeo de fato chamado "YouTube" perde o título e
  // cai no ID na lista. Trocar um título errado por um ID sai mais barato que o
  // contrário, e o caso do título literal é bem mais comum que o do vídeo.
  it("also drops a video genuinely named YouTube", () => {
    document.title = "YouTube - YouTube";
    expect(getVideoTitle()).toBe("");
  });

  it("returns '' for an empty document title", () => {
    document.title = "";
    expect(getVideoTitle()).toBe("");
  });
});
