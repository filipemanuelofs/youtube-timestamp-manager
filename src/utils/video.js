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
