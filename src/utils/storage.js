const PREFIX = "ytts_";

/**
 * Salva um array de timestamps no localStorage para o vídeo indicado.
 * Chave de armazenamento: `ytts_${videoId}`.
 * @param {string} videoId - ID do vídeo.
 * @param {Array<{time: number, note: string, creation: string, expiration: string}>} timestamps - Lista de timestamps a salvar.
 */
export function saveTimestamps(videoId, timestamps) {
  try {
    localStorage.setItem(`${PREFIX}${videoId}`, JSON.stringify(timestamps));
  } catch (error) {
    console.error("[YT Timestamp Manager] Failed to save timestamps:", error);
  }
}

/**
 * Carrega os timestamps salvos no localStorage para o vídeo indicado.
 * @param {string} videoId - ID do vídeo.
 * @returns {Array<{time: number, note: string, creation: string, expiration: string}>} Lista de timestamps ou array vazio se não encontrado.
 */
export function loadTimestamps(videoId) {
  try {
    const data = localStorage.getItem(`${PREFIX}${videoId}`);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("[YT Timestamp Manager] Failed to load timestamps:", error);
    return [];
  }
}

/**
 * Retorna todos os vídeos que possuem timestamps salvos no localStorage.
 * Itera sobre todas as chaves com prefixo `ytts_` e ignora vídeos com listas vazias.
 * @returns {Array<{videoId: string, timestamps: Array}>} Lista de vídeos com seus timestamps.
 */
export function getAllSavedVideos() {
  const videos = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) {
        const videoId = key.replace(PREFIX, "");
        const timestamps = loadTimestamps(videoId);
        if (timestamps.length > 0) {
          videos.push({ videoId, timestamps });
        }
      }
    }
  } catch (error) {
    console.error("[YT Timestamp Manager] Failed to get saved videos:", error);
  }
  return videos;
}

/**
 * Remove todos os timestamps de um vídeo do localStorage.
 * @param {string} videoId - ID do vídeo a remover.
 */
export function deleteVideoTimestamps(videoId) {
  try {
    localStorage.removeItem(`${PREFIX}${videoId}`);
  } catch (error) {
    console.error("[YT Timestamp Manager] Failed to delete timestamps:", error);
  }
}

/**
 * Remove timestamps expirados de todos os vídeos no localStorage.
 * Um timestamp é considerado expirado quando `expiration < now`.
 * Vídeos que ficam sem timestamps válidos têm sua chave removida completamente.
 * @returns {{ cleanedCount: number, affectedVideoIds: string[] }} Quantidade de timestamps removidos e IDs dos vídeos afetados.
 */
export function removeExpiredFromStorage() {
  const now = new Date().toISOString();
  let cleanedCount = 0;
  const affectedVideoIds = [];

  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          const timestamps = JSON.parse(data);
          const valid = timestamps.filter(
            (ts) => !ts.expiration || ts.expiration > now,
          );

          if (valid.length !== timestamps.length) {
            cleanedCount += timestamps.length - valid.length;
            affectedVideoIds.push(key.replace(PREFIX, ""));
            if (valid.length > 0) {
              localStorage.setItem(key, JSON.stringify(valid));
            } else {
              localStorage.removeItem(key);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(
      "[YT Timestamp Manager] Failed to clean expired timestamps:",
      error,
    );
  }

  return { cleanedCount, affectedVideoIds };
}
