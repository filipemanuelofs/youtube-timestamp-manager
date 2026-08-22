import { state } from "./state.js";
import { formatTime } from "./utils/time.js";
import { getVideoId, getVideo, getVideoTitle } from "./utils/video.js";
import { copyToClipboard, showCopyFeedback } from "./utils/clipboard.js";
import { showNotification } from "./utils/notification.js";
import { matchesHotkey } from "./utils/hotkey.js";
import {
  saveTimestamps,
  loadTimestamps,
  removeExpiredFromStorage,
  deleteVideoTimestamps,
  saveVideoTitle,
} from "./utils/storage.js";
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
   * Notifica a criação: pelo atalho de teclado, com o painel minimizado ou em
   * tela cheia, o toast é o único sinal de que o timestamp existe.
   */
  addStamp() {
    const video = getVideo();
    if (!video) return;

    const time = Math.max(0, Math.floor(video.currentTime - 5));
    const textInput = ui.createTimestampItem(time);
    textInput.focus();

    handlers.saveCurrentTimestamps();
    progressMarkers.updateMarkers();
    showNotification("⏱️ Timestamp added!");
  },

  /**
   * Handler global de `keydown`: cria um timestamp quando o atalho configurado
   * é pressionado.
   * Fica calado sem painel na tela, com o modal de Settings aberto (onde a
   * própria captura do atalho acontece), durante composição de texto (IME) e
   * quando o foco está em campo editável — inclusive a nota do timestamp e a
   * busca do YouTube.
   * @param {KeyboardEvent} e - Evento de teclado.
   */
  onHotkey(e) {
    if (!document.querySelector("#ytls-pane")) return;
    if (document.querySelector("#ytts-settings-modal")) return;
    if (e.isComposing) return;

    const target = e.target;
    if (
      target &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    ) {
      return;
    }

    if (!matchesHotkey(e, ui.getHotkeySetting())) return;

    // O YouTube escuta as próprias teclas em `document`: sem barrar a propagação
    // aqui, um atalho configurado sobre uma tecla dele dispararia os dois.
    e.preventDefault();
    e.stopPropagation();
    handlers.addStamp();
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
      const note = item.querySelector(".ytts-note").value;
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
   * Apaga da lista os timestamps marcados, após confirmação do usuário.
   * A gravação fica toda com `saveCurrentTimestamps`, que já remove a chave do
   * vídeo quando a lista fica vazia. Exibe notificação com o total removido.
   */
  deleteSelectedTimestamps() {
    const selected = [
      ...document.querySelectorAll("#ytls-pane ul li:not(.now-playing)"),
    ].filter((item) => {
      const box = item.querySelector(".ytts-select");
      return box && box.checked;
    });

    const count = selected.length;
    if (count === 0) return;

    if (!confirm(`Delete ${count} selected timestamp${count > 1 ? "s" : ""}?`)) {
      return;
    }

    selected.forEach((item) => item.remove());

    handlers.saveCurrentTimestamps();
    ui.updateSelectionUI();
    showNotification(`🗑️ ${count} timestamp${count > 1 ? "s" : ""} deleted!`);
  },

  /**
   * Apaga todos os timestamps de um vídeo a partir da lista da aba "Videos",
   * após confirmação do usuário.
   * @param {string} videoId - ID do vídeo a apagar.
   * @param {HTMLLIElement} li - Item da lista que representa o vídeo.
   */
  deleteVideoFromList(videoId, li) {
    if (!confirm("Delete all timestamps of this video?")) return;

    deleteVideoTimestamps(videoId);

    // O vídeo apagado é o que está aberto: sem esvaziar o painel ele segue
    // exibindo timestamps que não existem mais, e o próximo
    // `saveCurrentTimestamps` os ressuscita no storage.
    if (videoId === getVideoId()) {
      document
        .querySelectorAll("#ytls-pane ul li:not(.now-playing)")
        .forEach((item) => item.remove());
      progressMarkers.updateMarkers();
      ui.updateSelectionUI();
    }

    const list = li.parentElement;
    const container = list && list.parentElement;
    li.remove();

    // Lista esvaziada: re-renderizar para cair no estado vazio.
    if (container && list.children.length === 0) {
      ui.renderVideoList(container);
    }

    showNotification("🗑️ Video timestamps deleted!");
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
   * Lista vazia remove a chave do vídeo em vez de gravar `[]`, para não deixar
   * chave órfã no storage — e para que o save atrasado do debounce da nota não
   * ressuscite a chave depois de um delete em massa.
   * Atualiza os marcadores de progresso após salvar.
   */
  saveCurrentTimestamps() {
    const videoId = getVideoId();
    if (!videoId) return;

    // A navegação SPA troca a URL e só remonta o painel 100ms depois, e o painel
    // novo passa 1s vazio antes de `loadSavedTimestamps` rodar. O save com
    // debounce da nota (500ms) cai bem nessa janela: `getVideoId()` já devolve o
    // vídeo novo enquanto a lista está vazia, e o `else` abaixo apagaria os
    // timestamps salvos dele. O carimbo do painel diz de quem é a lista lida.
    const pane = document.querySelector("#ytls-pane");
    if (!pane || pane.dataset.videoId !== videoId) return;

    const listItems = document.querySelectorAll(
      "#ytls-pane ul li:not(.now-playing)",
    );
    const timestamps = [];

    listItems.forEach((item) => {
      const time = parseInt(item.querySelector("a").dataset.time);
      const note = item.querySelector(".ytts-note").value;
      const creation = item.dataset.creation;
      const expiration = item.dataset.expiration;
      timestamps.push({ time, note, creation, expiration });
    });

    if (timestamps.length > 0) {
      saveTimestamps(videoId, timestamps);
      saveVideoTitle(videoId, getVideoTitle());
    } else {
      deleteVideoTimestamps(videoId);
    }

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
        ui.updateSelectionUI();
      }
    }
  },
};
