const PREFIX = "ytts_";
// Metadado do vídeo (hoje só o título) fica em chave própria para não mexer no
// formato de array puro que `loadTimestamps` e `removeExpiredFromStorage` leem.
// Sem o underscore de propósito: `yttsmeta_` não casa com `PREFIX`, então as
// varreduras por prefixo já não o enxergam e nenhum ID de vídeo válido pode
// colidir com ele (`ytts_meta_` colidiria com o ID `meta_abc123`, que cabe nos
// 11 caracteres de `[A-Za-z0-9_-]` que o YouTube usa).
const META_PREFIX = "yttsmeta_";

// Prazo de retenção padrão, em dias. Vale para quem nunca abriu as
// configurações e para todo valor gravado que não sirva como número de dias.
const DEFAULT_RETENTION_DAYS = 30;

/**
 * Salva um array de timestamps no localStorage para o vídeo indicado.
 * Chave de armazenamento: `ytts_${videoId}`.
 * @param {string} videoId - ID do vídeo.
 * @param {Array<{time: number, note: string, creation: string}>} timestamps - Lista de timestamps a salvar.
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
 * @returns {Array<{time: number, note: string, creation: string}>} Lista de timestamps ou array vazio se não encontrado.
 */
export function loadTimestamps(videoId) {
  try {
    const data = localStorage.getItem(`${PREFIX}${videoId}`);
    if (!data) return [];
    const parsed = JSON.parse(data);
    // O prefixo `ytts_` também cobre as chaves de configuração
    // (`ytts_auto_cleanup`, `ytts_start_minimized`, `ytts_pane_position`), cujos
    // valores não são arrays. Quem varre o storage por prefixo cai nelas, então
    // a guarda mora aqui, no ponto onde o JSON vira dado.
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("[YT Timestamp Manager] Failed to load timestamps:", error);
    return [];
  }
}

/**
 * Salva o título de um vídeo no localStorage, em chave separada dos timestamps.
 * Chave de armazenamento: `yttsmeta_${videoId}`.
 * Título vazio não grava nada: a página nem sempre expõe o título no instante
 * do save, e gravar `""` apagaria um título bom guardado antes.
 * @param {string} videoId - ID do vídeo.
 * @param {string} title - Título do vídeo.
 */
export function saveVideoTitle(videoId, title) {
  if (!title) return;
  try {
    localStorage.setItem(`${META_PREFIX}${videoId}`, JSON.stringify({ title }));
  } catch (error) {
    console.error("[YT Timestamp Manager] Failed to save video title:", error);
  }
}

/**
 * Carrega o título salvo para o vídeo indicado.
 * @param {string} videoId - ID do vídeo.
 * @returns {string} Título salvo, ou `""` se ausente, inválido ou ilegível.
 */
export function loadVideoTitle(videoId) {
  try {
    const data = localStorage.getItem(`${META_PREFIX}${videoId}`);
    if (!data) return "";
    const parsed = JSON.parse(data);
    return parsed && typeof parsed.title === "string" ? parsed.title : "";
  } catch (error) {
    console.error("[YT Timestamp Manager] Failed to load video title:", error);
    return "";
  }
}

/**
 * Remove o título salvo de um vídeo do localStorage.
 * @param {string} videoId - ID do vídeo.
 */
export function deleteVideoTitle(videoId) {
  try {
    localStorage.removeItem(`${META_PREFIX}${videoId}`);
  } catch (error) {
    console.error("[YT Timestamp Manager] Failed to delete video title:", error);
  }
}

/**
 * Retorna todos os vídeos que possuem timestamps salvos no localStorage.
 * Itera sobre todas as chaves com prefixo `ytts_` e ignora vídeos com listas vazias.
 * @returns {Array<{videoId: string, title: string, timestamps: Array}>} Lista de vídeos com título e timestamps.
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
          videos.push({ videoId, title: loadVideoTitle(videoId), timestamps });
        }
      }
    }
  } catch (error) {
    console.error("[YT Timestamp Manager] Failed to get saved videos:", error);
  }
  return videos;
}

/**
 * Remove todos os timestamps de um vídeo do localStorage, junto do seu título.
 * @param {string} videoId - ID do vídeo a remover.
 */
export function deleteVideoTimestamps(videoId) {
  try {
    localStorage.removeItem(`${PREFIX}${videoId}`);
  } catch (error) {
    console.error("[YT Timestamp Manager] Failed to delete timestamps:", error);
  }
  deleteVideoTitle(videoId);
}

/**
 * Lê o prazo de retenção configurado, em dias.
 * Chave ausente, valor não numérico, menor que 1 ou `localStorage` inacessível
 * caem no padrão — o campo é global e um valor corrompido não pode virar uma
 * limpeza mais agressiva do que a que o usuário escolheu.
 * @returns {number} Número inteiro de dias, sempre `>= 1`.
 */
export function getRetentionDays() {
  try {
    const days = parseInt(localStorage.getItem("ytts_retention_days"), 10);
    return Number.isNaN(days) || days < 1 ? DEFAULT_RETENTION_DAYS : days;
  } catch {
    return DEFAULT_RETENTION_DAYS;
  }
}

/**
 * Remove timestamps expirados de todos os vídeos no localStorage.
 * Um timestamp é considerado expirado quando `creation` é mais antigo que o
 * prazo de retenção configurado; item sem `creation` legível é mantido.
 * Vídeos que ficam sem timestamps válidos têm sua chave removida completamente.
 * @returns {{ cleanedCount: number, affectedVideoIds: string[] }} Quantidade de timestamps removidos e IDs dos vídeos afetados.
 */
export function removeExpiredFromStorage() {
  // Calculado uma vez, fora do laço: o prazo é global e reler a configuração a
  // cada item faria itens da mesma varredura serem julgados por instantes
  // diferentes de `now`.
  const cutoff = Date.now() - getRetentionDays() * 24 * 60 * 60 * 1000;
  let cleanedCount = 0;
  const affectedVideoIds = [];
  const emptiedVideoIds = [];

  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          const timestamps = JSON.parse(data);

          // Sem esta guarda, `ytts_auto_cleanup` (que vira `true`) e
          // `ytts_pane_position` (que vira objeto) chegam aqui sem `.filter`; o
          // TypeError cai no catch de fora e aborta a varredura inteira, então
          // os vídeos ainda não visitados no laço nunca são limpos.
          if (!Array.isArray(timestamps)) continue;

          const valid = timestamps.filter((ts) => {
            const created = Date.parse(ts.creation);
            // `creation` ausente ou ilegível vira NaN: sem âncora temporal não
            // há como afirmar que expirou, e apagar destruiria dado do usuário
            // por causa de um campo que faltou.
            return Number.isNaN(created) || created >= cutoff;
          });

          if (valid.length !== timestamps.length) {
            const videoId = key.replace(PREFIX, "");
            cleanedCount += timestamps.length - valid.length;
            affectedVideoIds.push(videoId);
            if (valid.length > 0) {
              localStorage.setItem(key, JSON.stringify(valid));
            } else {
              localStorage.removeItem(key);
              emptiedVideoIds.push(videoId);
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

  // Fora do laço de propósito: apagar a chave visitada desloca só índices já
  // vistos, mas a chave meta fica em índice arbitrário e apagá-la lá dentro
  // desloca os que ainda faltam, fazendo a descida reler posição já lida. Aqui
  // fora o laço continua sendo uma descida simples.
  emptiedVideoIds.forEach((videoId) => deleteVideoTitle(videoId));

  return { cleanedCount, affectedVideoIds };
}
