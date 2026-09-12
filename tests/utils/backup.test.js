import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyBackup,
  buildBackup,
  downloadBackup,
  parseBackup,
  readBackupFile,
  SETTING_KEYS,
} from "../../src/utils/backup.js";
import {
  getAllSavedVideos,
  loadTimestamps,
  loadVideoTitle,
  saveTimestamps,
  saveVideoTitle,
} from "../../src/utils/storage.js";

const timestamp = {
  time: 42,
  note: "Resposta",
  creation: "2025-01-02T03:04:05.000Z",
};

describe("backup", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("monta e reaplica o backup sem alterar os dados", () => {
    localStorage.setItem("ytts_auto_cleanup", "true");
    localStorage.setItem("ytts_start_minimized", "false");
    localStorage.setItem("ytts_hotkey", "null");
    localStorage.setItem("ytts_retention_days", "7");
    localStorage.setItem("ytts_marker_shape", "star");
    localStorage.setItem("ytts_marker_color", "#00ff00");
    saveTimestamps("video-1", [timestamp]);
    saveVideoTitle("video-1", "Vídeo");

    const backup = buildBackup();
    localStorage.clear();
    const result = applyBackup(parseBackup(JSON.stringify(backup)));

    expect(result).toEqual({
      settingsCount: 6,
      videosCount: 1,
      timestampsAdded: 1,
      affectedVideoIds: ["video-1"],
    });
    expect(buildBackup().settings).toEqual(backup.settings);
    expect(getAllSavedVideos()).toEqual(backup.videos);
    expect(Object.keys(backup.settings)).toEqual(SETTING_KEYS);
  });

  it("pula configurações inválidas sem impedir as válidas", () => {
    localStorage.setItem("ytts_retention_days", "9");

    const result = applyBackup({
      settings: {
        ytts_auto_cleanup: true,
        ytts_start_minimized: "true",
        ytts_hotkey: { key: "" },
        ytts_retention_days: 0,
        ytts_marker_shape: "toString",
        ytts_marker_color: "#ABCDEF",
      },
    });

    expect(result.settingsCount).toBe(2);
    expect(localStorage.getItem("ytts_auto_cleanup")).toBe("true");
    expect(localStorage.getItem("ytts_marker_color")).toBe("#ABCDEF");
    expect(localStorage.getItem("ytts_retention_days")).toBe("9");
    expect(localStorage.getItem("ytts_start_minimized")).toBeNull();
    expect(localStorage.getItem("ytts_hotkey")).toBeNull();
  });

  it("recusa videoId reservado sem corromper a configuração", () => {
    localStorage.setItem("ytts_hotkey", "null");

    const result = applyBackup({
      videos: [{ videoId: "hotkey", title: "Ataque", timestamps: [timestamp] }],
    });

    expect(result).toEqual({
      settingsCount: 0,
      videosCount: 0,
      timestampsAdded: 0,
      affectedVideoIds: [],
    });
    expect(localStorage.getItem("ytts_hotkey")).toBe("null");
    expect(localStorage.getItem("yttsmeta_hotkey")).toBeNull();
  });

  it("mescla, normaliza e não duplica timestamps ao reimportar", () => {
    saveTimestamps("video-1", [
      { time: 10.2, note: "existente", creation: timestamp.creation },
    ]);
    const data = {
      videos: [
        {
          videoId: "video-1",
          title: "Vídeo importado",
          timestamps: [
            { time: 10.49, note: "não substitui" },
            { time: 5 },
            { time: 5.2, note: "duplicado no arquivo" },
            { time: -1 },
            { time: Number.NaN },
          ],
        },
      ],
    };

    expect(applyBackup(data)).toEqual({
      settingsCount: 0,
      videosCount: 1,
      timestampsAdded: 1,
      affectedVideoIds: ["video-1"],
    });
    const saved = loadTimestamps("video-1");
    expect(saved.map(({ time }) => time)).toEqual([5, 10.2]);
    expect(saved[0].note).toBe("");
    expect(Number.isNaN(Date.parse(saved[0].creation))).toBe(false);
    expect(saved[1].note).toBe("existente");
    expect(loadVideoTitle("video-1")).toBe("Vídeo importado");

    expect(applyBackup(data).timestampsAdded).toBe(0);
    expect(loadTimestamps("video-1")).toHaveLength(2);
  });

  it("baixa o JSON com nome, MIME e revogação da URL", () => {
    const createObjectURL = vi.fn(() => "blob:backup");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    let clickedAnchor;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      clickedAnchor = this;
    });

    downloadBackup({ format: "ytts-backup" }, "ytts-backup-2025-01-02.json");

    const blob = createObjectURL.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/json");
    expect(clickedAnchor.download).toBe("ytts-backup-2025-01-02.json");
    expect(clickedAnchor.isConnected).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:backup");
  });

  it("gera o nome do arquivo com a data atual", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-04T12:00:00Z"));
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:backup"),
      revokeObjectURL: vi.fn(),
    });
    let filename;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      filename = this.download;
    });

    downloadBackup({});

    expect(filename).toBe("ytts-backup-2025-03-04.json");
    vi.useRealTimers();
  });

  it("lê o conteúdo textual de um arquivo", async () => {
    const file = new File(["backup"], "backup.json", {
      type: "application/json",
    });
    await expect(readBackupFile(file)).resolves.toBe("backup");
  });

  it("recusa JSON ilegível e envelopes desconhecidos", () => {
    expect(parseBackup("{invalid")).toBeNull();
    expect(parseBackup('{"format":"other","version":1}')).toBeNull();
    expect(parseBackup('{"format":"ytts-backup","version":2}')).toBeNull();
  });
});
