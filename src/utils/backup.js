import {
  getAllSavedVideos,
  getAutoCleanup,
  getHotkey,
  getMarkerColor,
  getMarkerShape,
  getRetentionDays,
  getStartMinimized,
  loadTimestamps,
  MARKER_SHAPES,
  saveTimestamps,
  saveVideoTitle,
} from "./storage.js";

export const SETTING_KEYS = [
  "ytts_auto_cleanup",
  "ytts_start_minimized",
  "ytts_hotkey",
  "ytts_retention_days",
  "ytts_marker_shape",
  "ytts_marker_color",
];

const RESERVED_VIDEO_IDS = new Set([
  "auto_cleanup",
  "start_minimized",
  "hotkey",
  "retention_days",
  "marker_shape",
  "marker_color",
  "pane_position",
]);
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

/**
 * Converte uma configuração válida para o formato usado no localStorage.
 * @param {string} key - Chave completa da configuração.
 * @param {*} value - Valor vindo do backup.
 * @returns {string|undefined} Valor serializado, ou `undefined` se inválido.
 */
function serializeSetting(key, value) {
  if (key === "ytts_auto_cleanup" || key === "ytts_start_minimized") {
    return typeof value === "boolean" ? String(value) : undefined;
  }
  if (key === "ytts_retention_days") {
    return Number.isInteger(value) && value >= 1 ? String(value) : undefined;
  }
  if (key === "ytts_marker_shape") {
    return typeof value === "string" && Object.hasOwn(MARKER_SHAPES, value)
      ? value
      : undefined;
  }
  if (key === "ytts_marker_color") {
    return typeof value === "string" && HEX_COLOR_RE.test(value)
      ? value
      : undefined;
  }
  if (key === "ytts_hotkey") {
    return value === null ||
      (value && typeof value === "object" && typeof value.key === "string" && value.key)
      ? JSON.stringify(value)
      : undefined;
  }
}

/**
 * Monta o envelope de backup com as configurações efetivas e os vídeos salvos.
 * @returns {{format: string, version: number, exportedAt: string, settings: object, videos: Array}}
 */
export function buildBackup() {
  return {
    format: "ytts-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      ytts_auto_cleanup: getAutoCleanup(),
      ytts_start_minimized: getStartMinimized(),
      ytts_hotkey: getHotkey(),
      ytts_retention_days: getRetentionDays(),
      ytts_marker_shape: getMarkerShape(),
      ytts_marker_color: getMarkerColor(),
    },
    videos: getAllSavedVideos(),
  };
}

/**
 * Lê um envelope de backup suportado.
 * @param {string} text - Conteúdo JSON do arquivo.
 * @returns {object|null} Backup lido, ou `null` se for inválido.
 */
export function parseBackup(text) {
  try {
    const data = JSON.parse(text);
    return data?.format === "ytts-backup" && data.version === 1 ? data : null;
  } catch {
    return null;
  }
}

/**
 * Baixa um envelope como arquivo JSON.
 * @param {object} data - Dados do backup.
 * @param {string} filename - Nome do arquivo baixado.
 */
export function downloadBackup(
  data,
  filename = `ytts-backup-${new Date().toISOString().slice(0, 10)}.json`,
) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Lê o conteúdo textual de um arquivo de backup.
 * @param {File} file - Arquivo escolhido pelo usuário.
 * @returns {Promise<string>} Conteúdo do arquivo.
 */
export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Valida e mescla no armazenamento as configurações e os vídeos de um backup.
 * @param {object} data - Envelope previamente lido por `parseBackup`.
 * @returns {{settingsCount: number, videosCount: number, timestampsAdded: number, affectedVideoIds: string[]}}
 */
export function applyBackup(data) {
  let settingsCount = 0;
  let videosCount = 0;
  let timestampsAdded = 0;
  const affectedVideoIds = [];
  const importedAt = new Date().toISOString();

  if (data?.settings && typeof data.settings === "object") {
    for (const key of SETTING_KEYS) {
      if (!Object.hasOwn(data.settings, key)) continue;
      const serialized = serializeSetting(key, data.settings[key]);
      if (serialized === undefined) continue;
      try {
        localStorage.setItem(key, serialized);
        settingsCount++;
      } catch (error) {
        console.error("[YT Timestamp Manager] Failed to import setting:", error);
      }
    }
  }

  if (Array.isArray(data?.videos)) {
    for (const video of data.videos) {
      if (
        !video ||
        typeof video.videoId !== "string" ||
        !VIDEO_ID_RE.test(video.videoId) ||
        RESERVED_VIDEO_IDS.has(video.videoId) ||
        !Array.isArray(video.timestamps)
      ) {
        continue;
      }

      if (typeof video.title === "string" && video.title) {
        saveVideoTitle(video.videoId, video.title);
      }

      const existing = loadTimestamps(video.videoId);
      const occupiedTimes = new Set(existing.map(({ time }) => Math.round(time)));
      const additions = [];
      for (const timestamp of video.timestamps) {
        if (!timestamp || !Number.isFinite(timestamp.time) || timestamp.time < 0) {
          continue;
        }
        const roundedTime = Math.round(timestamp.time);
        if (occupiedTimes.has(roundedTime)) continue;
        occupiedTimes.add(roundedTime);
        additions.push({
          time: timestamp.time,
          note: typeof timestamp.note === "string" ? timestamp.note : "",
          creation: Number.isNaN(Date.parse(timestamp.creation))
            ? importedAt
            : timestamp.creation,
        });
      }
      if (additions.length === 0) continue;

      saveTimestamps(
        video.videoId,
        [...existing, ...additions].sort((a, b) => a.time - b.time),
      );
      const savedTimes = new Set(
        loadTimestamps(video.videoId).map(({ time }) => Math.round(time)),
      );
      const persistedCount = additions.filter(({ time }) =>
        savedTimes.has(Math.round(time)),
      ).length;
      if (persistedCount === 0) continue;

      videosCount++;
      timestampsAdded += persistedCount;
      affectedVideoIds.push(video.videoId);
    }
  }

  return { settingsCount, videosCount, timestampsAdded, affectedVideoIds };
}
