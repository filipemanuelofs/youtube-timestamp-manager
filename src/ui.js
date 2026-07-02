import { elements } from "./state.js";
import { debounce } from "./utils/debounce.js";
import { showNotification } from "./utils/notification.js";
import { progressMarkers } from "./progressMarkers.js";
import { handlers } from "./handlers.js";

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
  .ytls-header {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
    margin-bottom: 5px;
  }
  #ytls-pane.minimized ul,
  #ytls-pane.minimized .ytls-buttons {
    display: none;
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
  .ytts-settings-footer {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  .ytts-settings-footer button {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    padding: 8px 16px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .ytts-settings-footer button:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
  }
  #ytts-save-settings {
    background: #4FC3F7;
    border-color: #4FC3F7;
  }
  #ytts-save-settings:hover {
    background: #81D4FA;
    border-color: #81D4FA;
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
   * Inclui link clicável com o tempo, campo de nota e botões de copiar/deletar.
   * @param {number} time - Tempo em segundos do timestamp.
   * @param {string} [note=""] - Nota inicial para o timestamp.
   * @returns {HTMLInputElement} Campo de texto da nota, já inserido no DOM.
   */
  createTimestampItem(time, note = "", creation = null, expiration = null) {
    const now = new Date();
    const li = document.createElement("li");
    li.dataset.creation = creation || now.toISOString();
    li.dataset.expiration = expiration || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const a = document.createElement("a");
    const textInput = document.createElement("input");
    const copyBtn = document.createElement("span");
    const deleteBtn = document.createElement("span");

    handlers.updateStamp(a, time);

    textInput.type = "text";
    textInput.value = note;
    textInput.placeholder = "Add note...";

    textInput.addEventListener(
      "input",
      debounce(() => {
        handlers.saveCurrentTimestamps();
      }, 500),
    );

    copyBtn.classList.add("ytts-icon-btn");
    copyBtn.title = "Copy timestamp";
    copyBtn.textContent = "📋";

    deleteBtn.classList.add("ytts-icon-btn");
    deleteBtn.title = "Delete timestamp";
    deleteBtn.textContent = "⛔";

    copyBtn.addEventListener("click", () => {
      handlers.copyIndividualTimestamp(a, textInput);
    });

    deleteBtn.addEventListener("click", () => {
      if (confirm("Delete this timestamp?")) {
        li.remove();
        handlers.saveCurrentTimestamps();
      }
    });

    li.appendChild(a);
    li.appendChild(textInput);
    li.appendChild(copyBtn);
    li.appendChild(deleteBtn);

    const list = document.querySelector("#ytls-pane ul");
    const nowPlaying = list.querySelector(".now-playing");
    list.insertBefore(li, nowPlaying);

    return textInput;
  },

  /**
   * Cria e injeta o painel flutuante principal no `document.body`.
   * Configura cabeçalho, lista de timestamps, botões de ação e estilos CSS.
   * Inicia o loop `watchTime` e carrega timestamps salvos após 1 segundo.
   * @returns {HTMLDivElement} Elemento do painel criado.
   */
  init() {
    const pane = document.createElement("div");
    pane.id = "ytls-pane";

    const header = document.createElement("div");
    header.className = "ytls-header";

    const settingsBtn = document.createElement("span");
    settingsBtn.textContent = "⚙️";
    settingsBtn.classList.add("ytts-icon-btn");
    settingsBtn.title = "Settings";

    const minimizeBtn = document.createElement("span");
    minimizeBtn.textContent = "🔽";
    minimizeBtn.classList.add("ytts-icon-btn");
    minimizeBtn.title = "Minimize";

    const exitBtn = document.createElement("span");
    exitBtn.textContent = "❌";
    exitBtn.classList.add("ytts-icon-btn");
    exitBtn.title = "Close";

    settingsBtn.addEventListener("click", ui.openSettingsModal);

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
    };

    minimizeBtn.addEventListener("click", () => {
      setMinimized(!pane.classList.contains("minimized"));
    });

    exitBtn.addEventListener("click", handlers.closePane);

    header.appendChild(settingsBtn);
    header.appendChild(minimizeBtn);
    header.appendChild(exitBtn);

    const list = document.createElement("ul");

    const nowLi = document.createElement("li");
    nowLi.className = "now-playing";
    const nowLink = document.createElement("a");
    const nowText = document.createElement("input");
    nowText.disabled = true;
    nowText.value = "End of Video";
    nowLi.appendChild(nowLink);
    nowLi.appendChild(nowText);
    list.appendChild(nowLi);

    const box = document.createElement("textarea");
    box.id = "ytls-box";
    box.style.display = "none";

    const buttons = document.createElement("div");
    buttons.className = "ytls-buttons";

    const addBtn = document.createElement("button");
    addBtn.textContent = "Add Timestamp";
    addBtn.dataset.action = "add";
    addBtn.addEventListener("click", handlers.addStamp);

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy Timestamps";
    copyBtn.dataset.action = "copy";
    copyBtn.addEventListener("click", handlers.copyList);

    buttons.appendChild(addBtn);
    buttons.appendChild(copyBtn);

    const style = document.createElement("style");
    style.textContent = STYLES;

    list.addEventListener("click", handlers.clickStamp);
    list.addEventListener("touchstart", handlers.clickStamp, { passive: true });

    window.addEventListener("beforeunload", handlers.warn);

    pane.appendChild(header);
    pane.appendChild(list);
    pane.appendChild(box);
    pane.appendChild(buttons);
    pane.appendChild(style);

    document.body.appendChild(pane);
    elements.pane = pane;

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

    const modal = document.createElement("div");
    modal.id = "ytts-settings-modal";

    const content = document.createElement("div");
    content.className = "ytts-settings-content";

    const header = document.createElement("div");
    header.className = "ytts-settings-header";

    const title = document.createElement("h3");
    title.textContent = "Settings";

    const closeBtn = document.createElement("span");
    closeBtn.className = "ytts-settings-close";
    closeBtn.textContent = "×";

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "ytts-settings-body";

    const label = document.createElement("label");
    label.className = "ytts-setting-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "auto-cleanup-expired";
    checkbox.checked = ui.getAutoCleanupSetting();

    const span = document.createElement("span");
    span.append("Automatically clean expired timestamps");
    span.appendChild(document.createElement("br"));

    const small = document.createElement("small");
    small.textContent =
      "The expiration date is 1 month after the date the timestamp was added.";

    span.appendChild(small);

    label.appendChild(checkbox);
    label.appendChild(span);
    body.appendChild(label);

    const labelMinimized = document.createElement("label");
    labelMinimized.className = "ytts-setting-item";
    labelMinimized.style.marginTop = "12px";

    const checkboxMinimized = document.createElement("input");
    checkboxMinimized.type = "checkbox";
    checkboxMinimized.id = "start-minimized";
    checkboxMinimized.checked = ui.getStartMinimizedSetting();

    const spanMinimized = document.createElement("span");
    spanMinimized.textContent = "Start widget minimized";

    labelMinimized.appendChild(checkboxMinimized);
    labelMinimized.appendChild(spanMinimized);
    body.appendChild(labelMinimized);

    const footer = document.createElement("div");
    footer.className = "ytts-settings-footer";

    const saveBtn = document.createElement("button");
    saveBtn.id = "ytts-save-settings";
    saveBtn.textContent = "Save";

    const cancelBtn = document.createElement("button");
    cancelBtn.id = "ytts-cancel-settings";
    cancelBtn.textContent = "Cancel";

    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);

    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(footer);
    modal.appendChild(content);
    document.body.appendChild(modal);

    closeBtn.addEventListener("click", () => modal.remove());
    cancelBtn.addEventListener("click", () => modal.remove());
    saveBtn.addEventListener("click", ui.saveSettings);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
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

    try {
      localStorage.setItem("ytts_auto_cleanup", autoCleanup.toString());
      localStorage.setItem("ytts_start_minimized", startMinimized.toString());

      if (autoCleanup) {
        handlers.cleanExpired();
      }

      showNotification("✅ Settings saved!");
    } catch {
      showNotification("❌ Failed to save settings", 1500);
    }

    document.querySelector("#ytts-settings-modal").remove();
  },
};
