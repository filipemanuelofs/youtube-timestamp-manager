import { elements, state } from "./state.js";
import { progressMarkers } from "./progressMarkers.js";
import { handlers } from "./handlers.js";
import { ui } from "./ui.js";

/**
 * Verifica se a URL atual corresponde a uma página de vídeo do YouTube
 * (watch, live ou shorts).
 * @returns {boolean} `true` se o gerenciador deve ser exibido na página atual.
 */
export function shouldShowTimestampManager() {
  const url = location.href;
  return (
    url.includes("/watch") ||
    url.includes("/live/") ||
    url.includes("/shorts/")
  );
}

/**
 * Encerra e remove o gerenciador de timestamps da página.
 * Cancela o loop de animação, remove o painel do DOM, destrói os marcadores de progresso
 * e limpa todas as referências de estado.
 */
export function cleanupTimestampManager() {
  if (state.nowid) {
    cancelAnimationFrame(state.nowid);
    state.nowid = null;
  }

  if (elements.pane) {
    elements.pane.remove();
    elements.pane = null;
  }

  progressMarkers.destroy();

  window.removeEventListener("beforeunload", handlers.warn);
  elements.video = null;
  state.videoId = null;
}

/**
 * Inicializa o gerenciador de timestamps para o vídeo atual.
 * Encerra qualquer instância anterior, aguarda o elemento `<video>` aparecer no DOM
 * e então monta o painel e os marcadores de progresso.
 */
export function initTimestampManager() {
  cleanupTimestampManager();

  const checkVideo = () => {
    const video = document.querySelector("video");
    if (video && shouldShowTimestampManager()) {
      ui.init();
      setTimeout(() => progressMarkers.init(), 1500);
    } else if (shouldShowTimestampManager()) {
      setTimeout(checkVideo, 500);
    }
  };

  setTimeout(checkVideo, 100);
}
