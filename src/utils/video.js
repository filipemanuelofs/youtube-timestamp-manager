import { elements, state } from "../state.js";

/**
 * Retorna o ID do vídeo atual extraído da URL.
 * Suporta URLs com parâmetro `?v=`, caminhos `/live/` e `/shorts/`.
 * Armazena o resultado em `state.videoId` para evitar reprocessamento.
 * @returns {string|undefined} ID do vídeo ou `undefined` se não encontrado.
 */
export function getVideoId() {
  if (!state.videoId) {
    state.videoId =
      location.search.split(/.+v=|&/)[1] ||
      location.href.split(/\/live\/|\/shorts\/|\?|&/)[1];
  }
  return state.videoId;
}

/**
 * Retorna o elemento `<video>` presente na página.
 * Armazena o resultado em `elements.video` para evitar consultas repetidas ao DOM.
 * @returns {HTMLVideoElement|null} Elemento de vídeo ou `null` se ausente.
 */
export function getVideo() {
  if (!elements.video) {
    elements.video = document.querySelector("video");
  }
  return elements.video;
}

/**
 * Retorna o título do vídeo atual a partir de `document.title`.
 * Remove o prefixo de notificação (`(3) `) e o sufixo ` - YouTube`.
 * Não usa cache em `state`: o título muda a cada navegação SPA e reler é barato.
 * Antes de a página hidratar, `document.title` é só `"YouTube"` — sem o hífen,
 * o sufixo não casa e sobraria "YouTube" como título do vídeo. Vale como vazio:
 * a lista de vídeos cai no ID, que ao menos identifica qual vídeo é.
 * @returns {string} Título limpo ou `""` se nada de útil sobrar.
 */
export function getVideoTitle() {
  const title = (document.title || "")
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s*-\s*YouTube$/, "")
    .trim();
  return title === "YouTube" ? "" : title;
}
