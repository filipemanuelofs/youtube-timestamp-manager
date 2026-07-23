import { state } from "./state.js";
import { formatTime } from "./utils/time.js";
import { getVideoId, getVideo } from "./utils/video.js";
import { copyToClipboard, showCopyFeedback } from "./utils/clipboard.js";
import { showNotification } from "./utils/notification.js";
import { saveTimestamps, loadTimestamps, removeExpiredFromStorage } from "./utils/storage.js";
import { progressMarkers } from "./progressMarkers.js";
// ui e lifecycle importados aqui — usados apenas dentro de funções (não no nível do módulo),
// portanto referências circulares se resolvem corretamente em runtime.
import { ui } from "./ui.js";
import { cleanupTimestampManager } from "./lifecycle.js";

export const handlers = {
  /**
   * Solicita confirmação ao usuário e encerra o gerenciador de timestamps caso confirmado.
   */
  closePane() {
    if (confirm("Close timestamp tool?")) {
      cleanupTimestampManager();
    }
  },

  /**
   * Atualiza o texto, dataset e href de um elemento âncora de timestamp.
   * @param {HTMLAnchorElement} stamp - Elemento âncora a atualizar.
   * @param {number} time - Tempo em segundos.
   */
  updateStamp(stamp, time) {
    const vid = getVideoId();
    stamp.textContent = formatTime(time);
    stamp.dataset.time = time;
    stamp.href = `https://youtu.be/${vid}?t=${time}`;
  },

  /**
   * Handler de clique em timestamps da lista: navega o vídeo para o tempo do timestamp clicado.
   * @param {MouseEvent|TouchEvent} e - Evento de clique ou toque.
   */
  async clickStamp(e) {
    if (e.target.dataset.time) {
      e.preventDefault();
      const video = getVideo();
      if (video) {
        video.currentTime = parseFloat(e.target.dataset.time);
      }
    }
  },

  /**
   * Loop via `requestAnimationFrame` que mantém o timestamp "End of Video" atualizado
   * com a duração total do vídeo em tempo real.
   */
  watchTime() {
    try {
      const video = getVideo();
      if (video && video.duration) {
        const nowStamp = document.querySelector("#ytls-pane .now-playing a");
        if (nowStamp) {
          handlers.updateStamp(nowStamp, Math.floor(video.duration));
        }
      }
    } catch (e) {
      console.error("[YT Timestamp Manager] Watch time failed:", e);
    }
    state.nowid = requestAnimationFrame(handlers.watchTime);
  },

  /**
   * Copia um timestamp individual (nota + link) para a área de transferência.
   * @param {HTMLAnchorElement} timestampElement - Elemento âncora com o link do timestamp.
   * @param {HTMLInputElement} noteElement - Campo de texto com a nota associada.
   */
  async copyIndividualTimestamp(timestampElement, noteElement) {
    const timestampLink = timestampElement.href;
    const note = noteElement.value;
    const textToCopy = `${note} ${timestampLink}`.trim();

    const success = await copyToClipboard(textToCopy);
    if (success) {
      showCopyFeedback(
        timestampElement.parentElement.querySelector(".copy-btn"),
      );
    }
  },

  /**
   * Adiciona um novo timestamp com o tempo atual do vídeo (menos 5 segundos) à lista.
   * Salva automaticamente e atualiza os marcadores de progresso.
   */
  addStamp() {
    const video = getVideo();
    if (!video) return;

    const time = Math.max(0, Math.floor(video.currentTime - 5));
    const textInput = ui.createTimestampItem(time);
    textInput.focus();

    handlers.saveCurrentTimestamps();
    progressMarkers.updateMarkers();
  },

  /**
   * Copia todos os timestamps da lista para a área de transferência no formato `link - nota`.
   * Exibe notificação com a quantidade copiada ou mensagem de erro.
   */
  async copyList() {
    const listItems = document.querySelectorAll(
      "#ytls-pane ul li:not(.now-playing)",
    );
    let string = "";

    listItems.forEach((item, i) => {
      const stampLink = item.querySelector("a").href;
      const note = item.querySelector("input").value;
      const line = note ? `${stampLink} - ${note}` : stampLink;
      string += (i > 0 ? "\n" : "") + line;
    });

    const success = await copyToClipboard(string);
    if (success) {
      const count = listItems.length;
      showNotification(`✓ ${count} timestamp${count > 1 ? "s" : ""} copied!`);
    } else {
      showNotification("❌ Copy failed", 1500);
    }
  },

  /**
   * Handler `unload`: sem efeito no browser (evento não suporta diálogo de confirmação).
   * Mantido em `unload` (não `beforeunload`) de propósito para não exibir popup ao fechar a aba.
   * @param {Event} e - Evento de descarregamento da página.
   */
  warn(e) {
    e.preventDefault();
    e.returnValue = "Close timestamp tool?";
    return e.returnValue;
  },

  /**
   * Lê todos os timestamps atualmente na lista e os salva no localStorage.
   * Atualiza os marcadores de progresso após salvar.
   */
  saveCurrentTimestamps() {
    const videoId = getVideoId();
    if (!videoId) return;

    const listItems = document.querySelectorAll(
      "#ytls-pane ul li:not(.now-playing)",
    );
    const timestamps = [];

    listItems.forEach((item) => {
      const time = parseInt(item.querySelector("a").dataset.time);
      const note = item.querySelector("input").value;
      const creation = item.dataset.creation;
      const expiration = item.dataset.expiration;
      timestamps.push({ time, note, creation, expiration });
    });

    saveTimestamps(videoId, timestamps);
    progressMarkers.updateMarkers();
  },

  /**
   * Carrega os timestamps salvos no localStorage para o vídeo atual e os adiciona à lista.
   * Exibe notificação com a quantidade carregada.
   * Se a limpeza automática estiver ativa, executa `cleanExpired` após carregar.
   */
  loadSavedTimestamps() {
    const videoId = getVideoId();
    if (!videoId) return;

    const savedTimestamps = loadTimestamps(videoId);
    savedTimestamps.forEach(({ time, note, creation, expiration }) => {
      ui.createTimestampItem(time, note, creation, expiration);
    });

    if (savedTimestamps.length > 0) {
      showNotification(
        `✅ ${savedTimestamps.length} saved timestamp${
          savedTimestamps.length > 1 ? "s" : ""
        } loaded!`,
      );
    }

    if (ui.getAutoCleanupSetting()) {
      handlers.cleanExpired();
    }
  },

  /**
   * Remove timestamps expirados do localStorage e atualiza a lista e os marcadores
   * caso o vídeo atual seja um dos afetados. Exibe notificação com o total removido.
   */
  cleanExpired() {
    const { cleanedCount, affectedVideoIds } = removeExpiredFromStorage();

    if (cleanedCount > 0) {
      showNotification(
        `🧹 Cleaned ${cleanedCount} expired timestamp${
          cleanedCount > 1 ? "s" : ""
        }!`,
      );

      const currentVideoId = getVideoId();
      if (currentVideoId && affectedVideoIds.includes(currentVideoId)) {
        document
          .querySelectorAll("#ytls-pane ul li:not(.now-playing)")
          .forEach((item) => item.remove());
        handlers.loadSavedTimestamps();
        progressMarkers.updateMarkers();
      }
    }
  },
};
