import { elements, state } from "./state.js";
import { drag } from "./drag.js";
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
 * Cancela o loop de animação, desarma o observer à espera do vídeo, desliga o
 * arraste do painel, remove o painel do DOM, destrói os marcadores de progresso
 * e limpa todas as referências de estado.
 */
export function cleanupTimestampManager() {
  if (state.nowid) {
    cancelAnimationFrame(state.nowid);
    state.nowid = null;
  }

  // Observer que ainda não viu o <video> da página anterior. Deixado vivo, ele
  // continua armado e monta um segundo painel na primeira mutação depois que a
  // navegação já montou o dele — com um segundo loop de `watchTime` junto,
  // porque `state.nowid` seria sobrescrito sem o primeiro ser cancelado.
  if (state.observer) {
    state.observer.disconnect();
    state.observer = null;
  }

  drag.destroy();

  if (elements.pane) {
    elements.pane.remove();
    elements.pane = null;
  }

  // O modal vive no `body`, fora do painel, então sobreviveria à navegação: fica
  // órfão sobre a página nova com a lista de vídeos velha, e `openSettingsModal`
  // desiste enquanto ele existir — o ⚙️ do painel novo pararia de responder.
  document.querySelector("#ytts-settings-modal")?.remove();

  progressMarkers.destroy();

  window.removeEventListener("unload", handlers.warn);
  // O terceiro argumento tem de repetir o `true` do `ui.init()`: listener de
  // captura e de bolha são registros distintos, e sem ele o atalho sobreviveria
  // ao cleanup, criando timestamp com o painel já fora da tela.
  document.removeEventListener("keydown", handlers.onHotkey, true);
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

  if (!shouldShowTimestampManager()) return;

  if (document.querySelector("video")) {
    ui.init();
    return;
  }

  state.observer = new MutationObserver((_, obs) => {
    if (document.querySelector("video") && shouldShowTimestampManager()) {
      obs.disconnect();
      state.observer = null;
      ui.init();
    }
  });
  state.observer.observe(document.body, { childList: true, subtree: true });
}
