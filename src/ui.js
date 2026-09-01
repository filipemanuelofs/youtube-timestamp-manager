import { elements } from "./state.js";
import { debounce } from "./utils/debounce.js";
import { el } from "./utils/el.js";
import { drag } from "./drag.js";
import { showNotification } from "./utils/notification.js";
import { progressMarkers } from "./progressMarkers.js";
import { handlers } from "./handlers.js";
import {
  getAllSavedVideos,
  getRetentionDays,
  getMarkerShape,
  getMarkerColor,
  MARKER_SHAPES,
} from "./utils/storage.js";
import { getVideoId } from "./utils/video.js";
import {
  DEFAULT_HOTKEY,
  formatHotkey,
  hotkeyFromEvent,
} from "./utils/hotkey.js";

// Caminho do ícone do GitHub no rodapé do modal de Settings.
const GITHUB_ICON_PATH =
  "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z";

// Acima desta quantidade de timestamps a UI de seleção múltipla aparece.
const SELECTION_MIN_COUNT = 3;

const STYLES = `
  #ytls-pane {
    background: rgba(0,0,0,.8);
    backdrop-filter: blur(5px);
    position: fixed;
    bottom: 0;
    left: 0;
    padding: 8px;
    opacity: .6;
    z-index: 5000;
    border-radius: 0 8px 0 0;
    transition: opacity 0.2s ease;
    max-width: 400px;
    max-height: 300px;
    overflow-y: auto;
  }
  #ytls-pane:hover {
    opacity: 1;
  }
  /* Painel arrastado para fora do canto: o \`bottom: auto\` é obrigatório, senão
     \`top\` e \`bottom\` valendo juntos esticariam o painel de uma borda à outra.
     Fora do canto ele deixa de ser peça encaixada, daí os quatro cantos
     arredondados; o reset no modal devolve o formato original. */
  #ytls-pane.moved {
    bottom: auto;
    border-radius: 8px;
  }
  /* Durante o arraste o ponteiro pode sair do painel, e com ele o :hover — sem
     isto o painel voltaria para 60% de opacidade no meio do gesto. */
  #ytls-pane.dragging {
    opacity: 1;
    transition: none;
  }
  .ytls-header {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
    margin-bottom: 5px;
    cursor: move;
    /* Sem \`touch-action: none\` o browser trata o gesto como rolagem da página e
       o \`pointermove\` nunca chega — é o que faz o arraste funcionar no
       m.youtube.com. */
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
  }
  #ytls-pane.minimized ul,
  #ytls-pane.minimized .ytls-buttons {
    display: none;
  }
  /* O header continua visível quando minimizado, então o "selecionar todos"
     precisa sair explicitamente: sem isso ele fica sozinho no header, marcando
     linhas que ninguém vê, e ao restaurar o painel volta com tudo selecionado e
     o botão destrutivo já habilitado. O !important é necessário porque
     updateSelectionUI escreve display inline, que venceria esta regra. */
  #ytls-pane.minimized #ytts-select-all {
    display: none !important;
  }
  #ytls-pane.minimized {
    max-height: auto;
  }
  #ytls-pane ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  #ytls-pane li {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 0;
    padding: 2px;
    border-radius: 3px;
    transition: background-color 0.2s ease;
  }
  #ytls-pane li:hover:not(.now-playing) {
    background: rgba(255,255,255,0.1);
  }
  #ytls-pane li.now-playing {
    opacity: 0.7;
    font-style: italic;
  }
  #ytls-pane a {
    color: #4FC3F7;
    text-decoration: none;
    min-width: 30px;
    font-family: monospace;
    cursor: pointer;
    transition: color 0.2s ease;
  }
  #ytls-pane a:hover {
    color: #81D4FA;
    text-decoration: underline;
  }
  #ytls-pane input {
    background: rgba(255,255,255,0.1);
    color: white;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 3px;
    padding: 4px 6px;
    font-size: 12px;
    flex: 1;
    outline: none;
    transition: border-color 0.2s ease;
  }
  #ytls-pane input:focus {
    border-color: #4FC3F7;
    background: rgba(255,255,255,0.15);
  }
  #ytls-pane input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  /* A regra #ytls-pane input acima não filtra tipo, então também pegaria os
     checkboxes de seleção e os esticaria com cara de campo de texto. */
  #ytls-pane input[type="checkbox"] {
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    margin: 0;
    padding: 0;
    background: none;
    border: none;
    border-radius: 0;
    accent-color: #4FC3F7;
    cursor: pointer;
  }
  /* A alça empurra os ícones para a direita, papel que era do select-all. Ela
     fica antes dele, então o select-all não precisa mais do margin-right. */
  #ytts-drag-handle {
    margin-right: auto;
    color: rgba(255, 255, 255, 0.45);
    font-size: 14px;
    line-height: 1;
    padding: 1px 4px;
    cursor: move;
  }
  #ytls-pane:hover #ytts-drag-handle {
    color: rgba(255, 255, 255, 0.8);
  }
  .ytls-buttons {
    display: flex;
    gap: 4px;
    margin-top: 8px;
  }
  .ytls-buttons button {
    background: rgba(255,255,255,0.1);
    color: white;
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 4px;
    padding: 6px 12px;
    font-size: 11px;
    cursor: pointer;
    flex: 1;
    transition: all 0.2s ease;
  }
  .ytls-buttons button:hover {
    background: rgba(255,255,255,0.2);
    border-color: rgba(255,255,255,0.5);
  }
  .ytls-buttons button:active {
    transform: translateY(1px);
  }
  #ytls-delete-selected {
    color: #ff6b6b;
    border-color: #ff6b6b;
  }
  #ytls-delete-selected:hover:not(:disabled) {
    background: rgba(255, 107, 107, 0.2);
    border-color: #ff6b6b;
  }
  #ytls-delete-selected:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  #ytls-box {
    display: none;
  }
  .ytts-progress-markers {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    pointer-events: none !important;
    z-index: 100 !important;
  }
  .ytts-progress-markers div {
    transition: all 0.2s ease;
  }
  .ytts-progress-markers div:hover {
    height: 16px !important;
    box-shadow: 0 0 8px rgba(255, 107, 107, 0.8) !important;
  }
  #ytts-settings-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  }
  .ytts-settings-content {
    background: #1a1a1a;
    border-radius: 8px;
    padding: 0;
    min-width: 300px;
    max-width: 90vw;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }
  .ytts-settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .ytts-settings-header h3 {
    margin: 0;
    color: white;
    font-size: 16px;
    font-weight: 500;
  }
  .ytts-settings-close {
    color: white;
    cursor: pointer;
    font-size: 24px;
    line-height: 1;
    padding: 4px;
    border-radius: 4px;
    transition: background-color 0.2s ease;
  }
  .ytts-settings-close:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  .ytts-settings-body {
    padding: 20px;
  }
  .ytts-setting-item {
    display: flex;
    align-items: center;
    gap: 8px;
    color: white;
    cursor: pointer;
    font-size: 14px;
  }
  .ytts-setting-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #4FC3F7;
    cursor: pointer;
  }
  .ytts-hotkey-row,
  .ytts-retention-row,
  .ytts-marker-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    color: white;
    font-size: 14px;
  }
  #ytts-hotkey-field,
  #ytts-retention-days,
  #ytts-marker-shape {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 12px;
    text-align: center;
  }
  #ytts-hotkey-field {
    flex: 1;
    cursor: pointer;
    caret-color: transparent;
  }
  #ytts-retention-days {
    width: 60px;
  }
  #ytts-marker-shape {
    flex: 1;
    cursor: pointer;
  }
  /* O menu do <select> é desenhado pelo navegador, fora do CSS do painel: sem
     esta regra as opções sairiam com texto branco sobre fundo branco. */
  #ytts-marker-shape option {
    background: #1c1c1c;
    color: white;
  }
  #ytts-marker-color {
    width: 44px;
    height: 30px;
    padding: 2px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    cursor: pointer;
  }
  #ytts-hotkey-field.capturing {
    border-color: #4FC3F7;
    color: #4FC3F7;
  }
  #ytts-hotkey-clear {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  #ytts-hotkey-clear:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
  }
  .ytts-settings-footer {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  .ytts-settings-footer button,
  #ytts-reset-position {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    padding: 8px 16px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .ytts-settings-footer button:hover,
  #ytts-reset-position:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
  }
  #ytts-reset-position {
    display: block;
    margin-top: 16px;
  }
  .ytts-settings-version {
    display: flex;
    align-items: center;
    gap: 6px;
    color: rgba(255, 255, 255, 0.35);
    font-size: 11px;
    margin-right: auto;
    align-self: center;
  }
  .ytts-settings-version-separator {
    opacity: 0.6;
  }
  .ytts-settings-github-link {
    display: inline-flex;
    align-items: center;
    color: rgba(255, 255, 255, 0.35);
    transition: color 0.2s ease;
  }
  .ytts-settings-github-link:hover {
    color: rgba(255, 255, 255, 0.7);
  }
  .ytts-settings-github-link svg {
    width: 13px;
    height: 13px;
    fill: currentColor;
  }
  #ytts-save-settings {
    background: #4FC3F7;
    border-color: #4FC3F7;
  }
  #ytts-save-settings:hover {
    background: #81D4FA;
    border-color: #81D4FA;
  }
  .ytts-tabs {
    display: flex;
    padding: 0 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .ytts-tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    padding: 10px 12px;
    cursor: pointer;
    transition: color 0.2s ease, border-color 0.2s ease;
  }
  .ytts-tab:hover {
    color: white;
  }
  .ytts-tab-active {
    color: white;
    border-bottom-color: #4FC3F7;
  }
  #ytts-tab-videos {
    width: 420px;
    max-width: 100%;
  }
  .ytts-video-empty {
    margin: 0;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
  }
  .ytts-video-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 300px;
    overflow-y: auto;
  }
  .ytts-video-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
  }
  .ytts-video-item + .ytts-video-item {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  .ytts-video-item img {
    width: 80px;
    height: 45px;
    object-fit: cover;
    border-radius: 3px;
    flex: 0 0 auto;
  }
  .ytts-video-info {
    flex: 1;
    min-width: 0;
  }
  .ytts-video-date {
    display: block;
    color: rgba(255, 255, 255, 0.4);
    font-size: 10px;
    line-height: 1.2;
  }
  .ytts-video-title {
    display: block;
    color: white;
    font-size: 13px;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ytts-video-title:hover {
    color: #4FC3F7;
  }
  .ytts-video-count {
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    flex: 0 0 auto;
  }
  .ytts-icon-btn {
    font-size: 14px;
    line-height: 1;
    padding: 1px 2px;
    cursor: pointer;
  }
`;

export const ui = {
  /**
   * Cria e insere um item de timestamp na lista do painel.
   * Inclui checkbox de seleção, link clicável com o tempo, campo de nota e
   * botões de copiar/deletar.
   * @param {number} time - Tempo em segundos do timestamp.
   * @param {string} [note=""] - Nota inicial para o timestamp.
   * @returns {HTMLInputElement} Campo de texto da nota, já inserido no DOM.
   */
  createTimestampItem(time, note = "", creation = null) {
    const a = el("a");
    handlers.updateStamp(a, time);

    const selectBox = el("input", {
      type: "checkbox",
      className: "ytts-select",
      title: "Select timestamp",
      style: { display: "none" },
      on: { change: () => ui.updateSelectionUI() },
    });

    const textInput = el("input", {
      type: "text",
      className: "ytts-note",
      value: note,
      placeholder: "Add note...",
      on: {
        input: debounce(() => {
          handlers.saveCurrentTimestamps();
        }, 500),
      },
    });

    const li = el(
      "li",
      {
        dataset: {
          creation: creation || new Date().toISOString(),
        },
      },
      [
        selectBox,
        a,
        textInput,
        el("span", {
          className: "ytts-icon-btn",
          title: "Copy timestamp",
          textContent: "📋",
          on: { click: () => handlers.copyIndividualTimestamp(a, textInput) },
        }),
        el("span", {
          className: "ytts-icon-btn",
          title: "Delete timestamp",
          textContent: "⛔",
          on: {
            click: () => {
              if (confirm("Delete this timestamp?")) {
                li.remove();
                handlers.saveCurrentTimestamps();
                ui.updateSelectionUI();
              }
            },
          },
        }),
      ],
    );

    const list = document.querySelector("#ytls-pane ul");
    const nowPlaying = list.querySelector(".now-playing");
    list.insertBefore(li, nowPlaying);

    ui.updateSelectionUI();

    return textInput;
  },

  /**
   * Sincroniza a UI de seleção múltipla com o estado atual da lista.
   * A UI só existe acima de `SELECTION_MIN_COUNT` itens; abaixo disso ela some
   * e a seleção é limpa, para não sobrar marcação fantasma se a lista voltar a
   * crescer. Também mantém o rótulo e o estado do botão e do "selecionar todos".
   * Sai sem efeito se os elementos ainda não estiverem no DOM.
   */
  updateSelectionUI() {
    const items = document.querySelectorAll(
      "#ytls-pane ul li:not(.now-playing)",
    );
    const boxes = [...document.querySelectorAll("#ytls-pane .ytts-select")];
    const visible = items.length > SELECTION_MIN_COUNT;
    const display = visible ? "" : "none";

    if (!visible) {
      boxes.forEach((box) => {
        box.checked = false;
      });
    }

    boxes.forEach((box) => {
      box.style.display = display;
    });

    const selectedCount = boxes.filter((box) => box.checked).length;
    const selectAllBox = document.querySelector("#ytts-select-all");
    const deleteSelectedBtn = document.querySelector("#ytls-delete-selected");

    if (selectAllBox) {
      selectAllBox.style.display = display;
      selectAllBox.checked =
        selectedCount > 0 && selectedCount === boxes.length;
      selectAllBox.indeterminate =
        selectedCount > 0 && selectedCount < boxes.length;
    }

    if (deleteSelectedBtn) {
      deleteSelectedBtn.style.display = display;
      deleteSelectedBtn.textContent = `Delete Selected (${selectedCount})`;
      deleteSelectedBtn.disabled = selectedCount === 0;
    }

    // Ponto único por onde passam todas as mudanças de tamanho da lista
    // (adicionar, deletar individual, deletar selecionados, limpar expirados),
    // e é a altura da lista que empurraria o painel movido para fora da tela.
    drag.refresh();
  },

  /**
   * Cria e injeta o painel flutuante principal no `document.body`.
   * Configura cabeçalho, lista de timestamps, botões de ação e estilos CSS.
   * Inicia o loop `watchTime` e carrega timestamps salvos após 1 segundo.
   * @returns {HTMLDivElement} Elemento do painel criado.
   */
  init() {
    // Minimizado, o cabeçalho é só os três ícones encostados à direita e não
    // sobra faixa vazia para agarrar; a alça é a área de pega em qualquer
    // estado, e diz onde pegar sem depender do usuário notar o cursor.
    const dragHandle = el("span", {
      id: "ytts-drag-handle",
      textContent: "⠿",
      title: "Drag to move",
    });

    const selectAllBox = el("input", {
      type: "checkbox",
      id: "ytts-select-all",
      title: "Select all",
      style: { display: "none" },
      on: {
        change: () => {
          document
            .querySelectorAll("#ytls-pane .ytts-select")
            .forEach((box) => {
              box.checked = selectAllBox.checked;
            });
          ui.updateSelectionUI();
        },
      },
    });

    const minimizeBtn = el("span", {
      className: "ytts-icon-btn",
      textContent: "🔽",
      title: "Minimize",
      on: { click: () => setMinimized(!pane.classList.contains("minimized")) },
    });

    const header = el("div", { className: "ytls-header" }, [
      dragHandle,
      selectAllBox,
      el("span", {
        className: "ytts-icon-btn",
        textContent: "⚙️",
        title: "Settings",
        on: { click: ui.openSettingsModal },
      }),
      minimizeBtn,
      el("span", {
        className: "ytts-icon-btn",
        textContent: "❌",
        title: "Close",
        on: { click: handlers.closePane },
      }),
    ]);

    const list = el(
      "ul",
      {
        on: {
          click: handlers.clickStamp,
          touchstart: [handlers.clickStamp, { passive: true }],
        },
      },
      [
        el("li", { className: "now-playing" }, [
          el("a"),
          el("input", { disabled: true, value: "End of Video" }),
        ]),
      ],
    );

    const buttons = el("div", { className: "ytls-buttons" }, [
      el("button", {
        textContent: "Add Timestamp",
        dataset: { action: "add" },
        on: { click: handlers.addStamp },
      }),
      el("button", {
        textContent: "Copy Timestamps",
        dataset: { action: "copy" },
        on: { click: handlers.copyList },
      }),
      el("button", {
        id: "ytls-delete-selected",
        textContent: "Delete Selected (0)",
        dataset: { action: "delete-selected" },
        style: { display: "none" },
        on: { click: handlers.deleteSelectedTimestamps },
      }),
    ]);

    const pane = el(
      "div",
      {
        id: "ytls-pane",
        // Carimba o vídeo dono do painel. A navegação SPA troca a URL antes de
        // remontar o painel, então `saveCurrentTimestamps` compara os dois e se
        // cala enquanto eles não batem.
        dataset: { videoId: getVideoId() },
      },
      [
        header,
        list,
        el("textarea", { id: "ytls-box", style: { display: "none" } }),
        buttons,
        el("style", { textContent: STYLES }),
      ],
    );

    const setMinimized = (minimized) => {
      if (minimized) {
        pane.classList.add("minimized");
        minimizeBtn.textContent = "🔼";
        minimizeBtn.title = "Restore";
      } else {
        pane.classList.remove("minimized");
        minimizeBtn.textContent = "🔽";
        minimizeBtn.title = "Minimize";
      }

      // A altura acabou de mudar: sem isto o painel movido, ancorado por `top`,
      // descola do rodapé ao minimizar e transborda ao restaurar.
      drag.refresh();
    };

    window.addEventListener("unload", handlers.warn);
    // Fase de captura: o YouTube escuta as próprias teclas em `document`, e sem
    // chegar antes dele um atalho sobre uma tecla dele seria consumido lá.
    document.addEventListener("keydown", handlers.onHotkey, true);

    document.body.appendChild(pane);
    elements.pane = pane;

    drag.init(pane, header);

    handlers.watchTime();

    setTimeout(() => {
      handlers.loadSavedTimestamps();
    }, 1000);

    setTimeout(() => {
      progressMarkers.init();
    }, 1500);

    setMinimized(ui.getStartMinimizedSetting());

    return pane;
  },

  /**
   * Abre o modal de configurações caso ainda não esteja aberto.
   * Exibe opção de limpeza automática de timestamps expirados.
   */
  openSettingsModal() {
    if (document.querySelector("#ytts-settings-modal")) return;

    const closeBtn = el("span", {
      className: "ytts-settings-close",
      textContent: "×",
    });

    const header = el("div", { className: "ytts-settings-header" }, [
      el("h3", { textContent: "Settings" }),
      closeBtn,
    ]);

    const settingsTabBtn = el("button", {
      className: "ytts-tab ytts-tab-active",
      textContent: "Settings",
    });

    const videosTabBtn = el("button", {
      className: "ytts-tab",
      textContent: "Videos",
    });

    const tabs = el("div", { className: "ytts-tabs" }, [
      settingsTabBtn,
      videosTabBtn,
    ]);

    const settingsTab = el("div", { id: "ytts-tab-settings" });

    const videosTab = el("div", {
      id: "ytts-tab-videos",
      style: { display: "none" },
    });

    const body = el("div", { className: "ytts-settings-body" }, [
      settingsTab,
      videosTab,
    ]);

    // Somente leitura: o valor vem do `keydown` capturado, nunca do que for
    // digitado. O `dataset` carrega a combinação até o Save — `""` é atalho
    // desligado, e `saveSettings` a traduz para `null` no storage.
    const hotkeyField = el("input", {
      id: "ytts-hotkey-field",
      type: "text",
      readOnly: true,
      title: "Click and press the combination you want",
      on: {
        focus: () => {
          hotkeyField.classList.add("capturing");
          hotkeyField.value = "Press a combination...";
        },
        blur: () => {
          hotkeyField.classList.remove("capturing");
          // Saiu sem apertar nada: o `dataset` ainda tem o valor de antes, que
          // volta ao rótulo no lugar do texto de captura.
          const stored = hotkeyField.dataset.hotkey;
          hotkeyField.value = stored
            ? formatHotkey(JSON.parse(stored))
            : "Disabled";
        },
        keydown: (e) => {
          // O atalho global escuta na fase de captura em `document`: sem barrar
          // aqui, configurar a tecla nova já criaria um timestamp no ato.
          e.preventDefault();
          e.stopPropagation();

          const captured = hotkeyFromEvent(e);
          if (!captured) return;

          setHotkeyField(captured);
          hotkeyField.blur();
        },
      },
    });

    const setHotkeyField = (hotkey) => {
      hotkeyField.dataset.hotkey = hotkey ? JSON.stringify(hotkey) : "";
      hotkeyField.value = formatHotkey(hotkey) || "Disabled";
    };

    setHotkeyField(ui.getHotkeySetting());

    settingsTab.append(
      el("label", { className: "ytts-setting-item" }, [
        el("input", {
          type: "checkbox",
          id: "auto-cleanup-expired",
          checked: ui.getAutoCleanupSetting(),
        }),
        el("span", [
          "Automatically clean expired timestamps",
          el("br"),
          el("small", {
            textContent:
              "A timestamp expires once it is older than the window set below.",
          }),
        ]),
      ]),
      el("div", { className: "ytts-retention-row" }, [
        el("span", { textContent: "Expire timestamps after" }),
        el("input", {
          type: "number",
          id: "ytts-retention-days",
          min: "1",
          step: "1",
          value: ui.getRetentionDaysSetting(),
        }),
        el("span", { textContent: "days" }),
      ]),
      el("div", { className: "ytts-marker-row" }, [
        el("span", { textContent: "Marker style" }),
        el(
          "select",
          { id: "ytts-marker-shape" },
          Object.entries(MARKER_SHAPES).map(([shape, { label }]) =>
            el("option", {
              value: shape,
              textContent: label,
              selected: shape === ui.getMarkerShapeSetting(),
            }),
          ),
        ),
        el("input", {
          type: "color",
          id: "ytts-marker-color",
          title: "Marker colour",
          value: ui.getMarkerColorSetting(),
        }),
      ]),
      el(
        "label",
        { className: "ytts-setting-item", style: { marginTop: "12px" } },
        [
          el("input", {
            type: "checkbox",
            id: "start-minimized",
            checked: ui.getStartMinimizedSetting(),
          }),
          el("span", { textContent: "Start widget minimized" }),
        ],
      ),
      el("div", { className: "ytts-hotkey-row" }, [
        el("span", { textContent: "Timestamp shortcut" }),
        hotkeyField,
        el("button", {
          id: "ytts-hotkey-clear",
          textContent: "Clear",
          title: "Turn the shortcut off",
          on: { click: () => setHotkeyField(null) },
        }),
      ]),
      // Ação, não preferência: age no clique e não passa pelo Save.
      el("button", {
        id: "ytts-reset-position",
        textContent: "Reset widget position",
        on: {
          click: () => {
            drag.resetPosition();
            showNotification("↩️ Widget position reset");
          },
        },
      }),
    );

    const saveBtn = el("button", {
      id: "ytts-save-settings",
      textContent: "Save",
    });

    const cancelBtn = el("button", {
      id: "ytts-cancel-settings",
      textContent: "Cancel",
    });

    const footer = el("div", { className: "ytts-settings-footer" }, [
      el("div", { className: "ytts-settings-version" }, [
        el("span", { textContent: `v${__VERSION__}` }),
        el("span", {
          className: "ytts-settings-version-separator",
          textContent: "|",
        }),
        el(
          "a",
          {
            className: "ytts-settings-github-link",
            href: "https://github.com/filipemanuelofs/youtube-timestamp-manager",
            target: "_blank",
            rel: "noopener noreferrer",
            title: "GitHub",
          },
          [
            el("svg", { attrs: { viewBox: "0 0 16 16" } }, [
              el("path", { attrs: { d: GITHUB_ICON_PATH } }),
            ]),
          ],
        ),
      ]),
      saveBtn,
      cancelBtn,
    ]);

    const modal = el("div", { id: "ytts-settings-modal" }, [
      el("div", { className: "ytts-settings-content" }, [
        header,
        tabs,
        body,
        footer,
      ]),
    ]);

    document.body.appendChild(modal);

    // Save grava preferência, e a aba de vídeos não tem preferência a gravar:
    // some junto com o conteúdo de Settings.
    const showVideosTab = (videos) => {
      settingsTab.style.display = videos ? "none" : "";
      videosTab.style.display = videos ? "" : "none";
      settingsTabBtn.classList.toggle("ytts-tab-active", !videos);
      videosTabBtn.classList.toggle("ytts-tab-active", videos);
      saveBtn.style.display = videos ? "none" : "";
      if (videos) ui.renderVideoList(videosTab);
    };

    settingsTabBtn.addEventListener("click", () => showVideosTab(false));
    videosTabBtn.addEventListener("click", () => showVideosTab(true));

    closeBtn.addEventListener("click", () => modal.remove());
    cancelBtn.addEventListener("click", () => modal.remove());
    saveBtn.addEventListener("click", ui.saveSettings);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  },

  /**
   * Renderiza no container a lista de vídeos com timestamps salvos.
   * Ordena pelo timestamp criado mais recentemente em cada vídeo, do mais novo
   * para o mais antigo; entrada legada sem `creation` cai no fim.
   * @param {HTMLElement} container - Elemento que recebe a lista.
   */
  renderVideoList(container) {
    container.replaceChildren();

    const videos = getAllSavedVideos();

    if (videos.length === 0) {
      container.appendChild(
        el("p", {
          className: "ytts-video-empty",
          textContent: "No videos with timestamps yet.",
        }),
      );
      return;
    }

    const lastCreation = ({ timestamps }) =>
      timestamps.reduce((newest, { creation }) => {
        const time = Date.parse(creation);
        return Number.isNaN(time) ? newest : Math.max(newest, time);
      }, 0);

    // Entrada legada sem `creation` válido não tem data para exibir: devolver
    // `null` deixa a linha sem a data, em vez de renderizar "Invalid Date".
    const firstCreation = (timestamps) =>
      timestamps.reduce((oldest, { creation }) => {
        const time = Date.parse(creation);
        if (Number.isNaN(time)) return oldest;
        return oldest === null ? time : Math.min(oldest, time);
      }, null);

    videos.sort((a, b) => lastCreation(b) - lastCreation(a));

    const list = el("ul", { className: "ytts-video-list" });

    videos.forEach(({ videoId, title, timestamps }) => {
      const created = firstCreation(timestamps);
      const createdLabel =
        created === null ? null : new Date(created).toLocaleDateString();

      const thumb = el("img", {
        src: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        loading: "lazy",
        referrerPolicy: "no-referrer",
        alt: "",
        on: {
          // Vídeo removido responde 404 na miniatura: esconder mantém a linha
          // legível.
          error: () => {
            thumb.style.display = "none";
          },
        },
      });

      const li = el(
        "li",
        { className: "ytts-video-item", dataset: { videoId } },
        [
          thumb,
          el("div", { className: "ytts-video-info" }, [
            createdLabel &&
              el("span", {
                className: "ytts-video-date",
                textContent: createdLabel,
                title: `First timestamp: ${createdLabel}`,
              }),
            el("a", {
              className: "ytts-video-title",
              href: `https://youtu.be/${videoId}`,
              target: "_blank",
              rel: "noopener noreferrer",
              textContent: title || videoId,
              title: title || videoId,
            }),
          ]),
          el("span", {
            className: "ytts-video-count",
            textContent: `${timestamps.length}`,
          }),
          el("span", {
            className: "ytts-icon-btn",
            title: "Delete all timestamps of this video",
            textContent: "⛔",
            on: { click: () => handlers.deleteVideoFromList(videoId, li) },
          }),
        ],
      );

      list.appendChild(li);
    });

    container.appendChild(list);
  },

  /**
   * Lê a configuração de limpeza automática de timestamps expirados do localStorage.
   * @returns {boolean} `true` se a limpeza automática estiver habilitada.
   */
  getAutoCleanupSetting() {
    try {
      return localStorage.getItem("ytts_auto_cleanup") === "true";
    } catch {
      return false;
    }
  },

  /**
   * Lê o prazo de retenção configurado, em dias.
   * @returns {number} Número inteiro de dias, sempre `>= 1`.
   */
  getRetentionDaysSetting() {
    return getRetentionDays();
  },

  /**
   * Lê a forma configurada para o marcador na barra de progresso.
   * @returns {string} Chave de `MARKER_SHAPES`.
   */
  getMarkerShapeSetting() {
    return getMarkerShape();
  },

  /**
   * Lê a cor configurada para o marcador na barra de progresso.
   * @returns {string} Cor no formato `#rrggbb`.
   */
  getMarkerColorSetting() {
    return getMarkerColor();
  },

  /**
   * Lê o atalho de teclado configurado para criar timestamp.
   * Chave ausente devolve o atalho de fábrica; `null` gravado significa atalho
   * desligado pelo usuário; valor corrompido cai no padrão.
   * @returns {{key: string, ctrl: boolean, alt: boolean, shift: boolean, meta: boolean}|null}
   *   Atalho configurado, ou `null` se desligado.
   */
  getHotkeySetting() {
    try {
      const raw = localStorage.getItem("ytts_hotkey");
      if (raw === null) return DEFAULT_HOTKEY;
      const parsed = JSON.parse(raw);
      if (parsed === null) return null;
      if (parsed && typeof parsed.key === "string" && parsed.key) {
        return parsed;
      }
      return DEFAULT_HOTKEY;
    } catch {
      return DEFAULT_HOTKEY;
    }
  },

  getStartMinimizedSetting() {
    try {
      const val = localStorage.getItem("ytts_start_minimized");
      return val === null ? true : val === "true";
    } catch {
      return true;
    }
  },

  /**
   * Persiste as configurações do modal no localStorage e fecha o modal.
   * Se a limpeza automática for ativada, executa `cleanExpired` imediatamente.
   */
  saveSettings() {
    const autoCleanup = document.querySelector("#auto-cleanup-expired").checked;
    const startMinimized = document.querySelector("#start-minimized").checked;
    // O campo de atalho guarda a combinação capturada no próprio `dataset`, e
    // só o Save a promove a preferência — fechar no Cancel descarta a captura.
    const hotkeyField = document.querySelector("#ytts-hotkey-field");
    // Só dígitos. `parseInt` pararia no primeiro caractere não numérico e
    // aceitaria calado o que o campo `type="number"` deixa digitar: "1e3"
    // viraria 1 e "7.5" viraria 7 — uma janela muito mais curta que a pedida,
    // que com a limpeza automática ligada apaga timestamps na mesma hora.
    const retentionField = document.querySelector("#ytts-retention-days");
    const retentionRaw = retentionField ? retentionField.value.trim() : "";
    const retentionDays = /^\d+$/.test(retentionRaw)
      ? Number(retentionRaw)
      : NaN;

    // Forma e cor não têm validação a fazer como o prazo tem: o `<select>` só
    // devolve uma das opções que ele mesmo montou e o `type="color"` só
    // devolve `#rrggbb`. Os getters já caem no padrão se algo escapar.
    const shapeField = document.querySelector("#ytts-marker-shape");
    const colorField = document.querySelector("#ytts-marker-color");

    // Prazo inválido cancela o Save inteiro e mantém o modal aberto: descartar
    // só esse campo e ainda anunciar "Settings saved!" deixaria o usuário
    // achando que gravou um prazo que continua sendo o antigo.
    if (
      retentionField &&
      !(Number.isInteger(retentionDays) && retentionDays >= 1)
    ) {
      showNotification(
        "❌ Expiration window must be a whole number of days, 1 or more",
        2000,
      );
      return;
    }

    try {
      localStorage.setItem("ytts_auto_cleanup", autoCleanup.toString());
      localStorage.setItem("ytts_start_minimized", startMinimized.toString());
      if (hotkeyField) {
        localStorage.setItem(
          "ytts_hotkey",
          hotkeyField.dataset.hotkey || "null",
        );
      }
      if (retentionField) {
        localStorage.setItem("ytts_retention_days", retentionDays.toString());
      }
      if (shapeField) {
        localStorage.setItem("ytts_marker_shape", shapeField.value);
      }
      if (colorField) {
        localStorage.setItem("ytts_marker_color", colorField.value);
      }

      if (autoCleanup) {
        handlers.cleanExpired();
      }

      showNotification("✅ Settings saved!");
    } catch {
      showNotification("❌ Failed to save settings", 1500);
    }

    document.querySelector("#ytts-settings-modal").remove();

    // Redesenha na hora: sem isso o marcador só mudaria de cara na próxima
    // navegação, e o usuário não veria o efeito do que acabou de escolher.
    //
    // Fora do `try` de propósito: falhar ao desenhar não é falhar ao gravar.
    // Dentro dele, um erro daqui anunciaria "Failed to save settings" com tudo
    // já persistido, e o usuário reabriria o modal atrás de um dado que nunca
    // se perdeu. Depois do `remove()` pelo mesmo motivo: o modal fecha mesmo se
    // o desenho quebrar.
    progressMarkers.updateMarkers();
  },
};
