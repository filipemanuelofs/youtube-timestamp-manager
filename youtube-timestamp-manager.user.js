// ==UserScript==
// @name            YouTube Timestamp Manager
// @name:pt         Gerenciador de Timestamps do YouTube
// @version         1.0.2
// @description     Create, manage and copy YouTube video timestamps with notes. Perfect for live streams.
// @description:pt  Crie, gerencie e copie timestamps de vídeos do YouTube com anotações. Perfeito para vídeos ao vivo.
// @author          filipemanuelofs
// @namespace       https://github.com/filipemanuelofs/youtube-timestamp-manager
// @downloadURL     https://github.com/filipemanuelofs/youtube-timestamp-manager/raw/main/youtube-timestamp-manager.user.js
// @updateURL       https://github.com/filipemanuelofs/youtube-timestamp-manager/raw/main/youtube-timestamp-manager.user.js
// @homepageURL     https://github.com/filipemanuelofs/youtube-timestamp-manager
// @supportURL      https://github.com/filipemanuelofs/youtube-timestamp-manager/issues
// @license         MIT
// @match           *://www.youtube.com/*
// @match           *://m.youtube.com/*
// @match           *://music.youtube.com/*
// @icon            data:image/svg+xml;base64,PCEtLQp0YWdzOiBbdGltZSwgaG91ciwgd29yaywgYWxhcm0sIG9uXQpjYXRlZ29yeTogU3lzdGVtCnZlcnNpb246ICIxLjEwNSIKdW5pY29kZTogImY1NDkiCi0tPgo8c3ZnCiAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIzMiIKICBoZWlnaHQ9IjMyIgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMDAwMCIKICBzdHJva2Utd2lkdGg9IjEiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTIgN3Y1bDIgMiIgLz4KICA8cGF0aCBkPSJNMTcgMjJsNSAtM2wtNSAtM3oiIC8+CiAgPHBhdGggZD0iTTEzLjAxNyAyMC45NDNhOSA5IDAgMSAxIDcuODMxIC03LjI5MiIgLz4KPC9zdmc+Cg==
// @grant           none
// @run-at          document-start
// @noframes
// ==/UserScript==

(function () {
  "use strict";

  let elements = {
    video: null,
    pane: null,
  };

  let state = {
    nowid: null,
    videoId: null,
    currentUrl: location.href,
  };

  function shouldShowTimestampManager() {
    const url = location.href;
    return (
      url.includes("/watch") ||
      url.includes("/live/") ||
      url.includes("/shorts/")
    );
  }

  function cleanupTimestampManager() {
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

  function initTimestampManager() {
    // Limpa instância anterior se existir
    cleanupTimestampManager();

    // Aguarda o vídeo carregar
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

  const utils = {
    formatTime(time) {
      const h = Math.floor(time / 3600);
      const m = Math.floor(time / 60) % 60;
      const s = Math.floor(time) % 60;
      return (
        (h ? `${h}:${String(m).padStart(2, "0")}` : m) +
        `:${String(s).padStart(2, "0")}`
      );
    },

    getVideoId() {
      if (!state.videoId) {
        state.videoId =
          location.search.split(/.+v=|&/)[1] ||
          location.href.split(/\/live\/|\/shorts\/|\?|&/)[1];
      }
      return state.videoId;
    },

    getVideo() {
      if (!elements.video) {
        elements.video = document.querySelector("video");
      }
      return elements.video;
    },

    async copyToClipboard(text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.cssText = "position:fixed;left:-9999px;opacity:0";
          document.body.appendChild(textarea);
          textarea.select();
          const success = document.execCommand("copy");
          document.body.removeChild(textarea);
          return success;
        }
      } catch (error) {
        console.error("[YT Timestamp Manager] Copy failed:", error);
        return false;
      }
    },

    showCopyFeedback(element) {
      const svg = element.querySelector("svg");
      if (svg) {
        svg.style.fill = "#4CAF50";
        setTimeout(() => {
          svg.style.fill = "#e3e3e3";
        }, 500);
      }
    },

    showNotification(message, duration = 2000) {
      const notification = document.createElement("div");
      notification.textContent = message;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(76, 175, 80, 0.9);
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        backdrop-filter: blur(10px);
        transform: translateX(100%);
        transition: transform 0.3s ease;
      `;

      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.transform = "translateX(0)";
      }, 10);

      setTimeout(() => {
        notification.style.transform = "translateX(100%)";
        setTimeout(() => notification.remove(), 300);
      }, duration);
    },

    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    saveTimestamps(videoId, timestamps) {
      try {
        const key = `ytts_${videoId}`;
        localStorage.setItem(key, JSON.stringify(timestamps));
      } catch (error) {
        console.error(
          "[YT Timestamp Manager] Failed to save timestamps:",
          error
        );
      }
    },

    loadTimestamps(videoId) {
      try {
        const key = `ytts_${videoId}`;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
      } catch (error) {
        console.error(
          "[YT Timestamp Manager] Failed to load timestamps:",
          error
        );
        return [];
      }
    },

    getAllSavedVideos() {
      const videos = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("ytts_")) {
            const videoId = key.replace("ytts_", "");
            const timestamps = this.loadTimestamps(videoId);
            if (timestamps.length > 0) {
              videos.push({ videoId, timestamps });
            }
          }
        }
      } catch (error) {
        console.error(
          "[YT Timestamp Manager] Failed to get saved videos:",
          error
        );
      }
      return videos;
    },

    deleteVideoTimestamps(videoId) {
      try {
        const key = `ytts_${videoId}`;
        localStorage.removeItem(key);
      } catch (error) {
        console.error(
          "[YT Timestamp Manager] Failed to delete timestamps:",
          error
        );
      }
    },
  };

  const handlers = {
    closePane() {
      if (confirm("Close timestamp tool?")) {
        cleanupTimestampManager();
      }
    },

    updateStamp(stamp, time) {
      const vid = utils.getVideoId();
      stamp.textContent = utils.formatTime(time);
      stamp.dataset.time = time;
      stamp.href = `https://youtu.be/${vid}?t=${time}`;
    },

    async clickStamp(e) {
      if (e.target.dataset.time) {
        e.preventDefault();
        const video = utils.getVideo();
        if (video) {
          video.currentTime = parseFloat(e.target.dataset.time);
        }
      }
    },

    watchTime() {
      try {
        const video = utils.getVideo();
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

    async copyIndividualTimestamp(timestampElement, noteElement) {
      const timestampLink = timestampElement.href;
      const note = noteElement.value;
      const textToCopy = `${note} ${timestampLink}`.trim();

      const success = await utils.copyToClipboard(textToCopy);
      if (success) {
        utils.showCopyFeedback(
          timestampElement.parentElement.querySelector(".copy-btn")
        );
      }
    },

    addStamp() {
      const video = utils.getVideo();
      if (!video) return;

      const time = Math.max(0, Math.floor(video.currentTime - 5));
      const textInput = ui.createTimestampItem(time);
      textInput.focus();

      handlers.saveCurrentTimestamps();

      progressMarkers.updateMarkers();
    },

    async copyList() {
      const listItems = document.querySelectorAll(
        "#ytls-pane ul li:not(.now-playing)"
      );
      let string = "";

      listItems.forEach((item, i) => {
        const stampLink = item.querySelector("a").href;
        const note = item.querySelector("input").value;
        const line = note ? `${stampLink} - ${note}` : stampLink;
        string += (i > 0 ? "\n" : "") + line;
      });

      const success = await utils.copyToClipboard(string);
      if (success) {
        const count = listItems.length;
        utils.showNotification(
          `✓ ${count} timestamp${count > 1 ? "s" : ""} copied!`
        );
      } else {
        utils.showNotification("❌ Copy failed", 1500);
      }
    },

    warn(e) {
      e.preventDefault();
      e.returnValue = "Close timestamp tool?";
      return e.returnValue;
    },

    saveCurrentTimestamps() {
      const videoId = utils.getVideoId();
      if (!videoId) return;

      const listItems = document.querySelectorAll(
        "#ytls-pane ul li:not(.now-playing)"
      );
      const timestamps = [];

      listItems.forEach((item) => {
        const time = parseInt(item.querySelector("a").dataset.time);
        const note = item.querySelector("input").value;
        const creation = new Date().toISOString();
        const expiration = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString();
        timestamps.push({ time, note, creation, expiration });
      });

      utils.saveTimestamps(videoId, timestamps);

      progressMarkers.updateMarkers();
    },

    loadSavedTimestamps() {
      const videoId = utils.getVideoId();
      if (!videoId) return;

      const savedTimestamps = utils.loadTimestamps(videoId);
      savedTimestamps.forEach(({ time, note }) => {
        ui.createTimestampItem(time, note);
      });

      if (savedTimestamps.length > 0) {
        utils.showNotification(
          `📥 ${savedTimestamps.length} saved timestamp${
            savedTimestamps.length > 1 ? "s" : ""
          } loaded!`
        );
      }
    },
  };

  const progressMarkers = {
    markersContainer: null,

    init() {
      this.createMarkersContainer();
      this.updateMarkers();
    },

    createMarkersContainer() {
      // Remove container anterior se existir
      if (this.markersContainer) {
        this.markersContainer.remove();
      }

      // Encontra a barra de progresso do YouTube
      const progressBar = document.querySelector(
        ".ytp-progress-bar-container, .ytp-progress-bar"
      );
      if (!progressBar) {
        setTimeout(() => this.createMarkersContainer(), 1000);
        return;
      }

      // Cria container para os marcadores
      this.markersContainer = document.createElement("div");
      this.markersContainer.className = "ytts-progress-markers";
      this.markersContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 100;
      `;

      progressBar.appendChild(this.markersContainer);
    },

    updateMarkers() {
      if (!this.markersContainer) {
        this.init();
        return;
      }

      // Limpa marcadores existentes
      this.markersContainer.innerHTML = "";

      const video = utils.getVideo();
      if (!video || !video.duration) return;

      const videoDuration = video.duration;

      // Obtém timestamps atuais
      const timestamps = this.getCurrentTimestamps();

      timestamps.forEach((timestamp) => {
        const marker = document.createElement("div");
        const position = (timestamp.time / videoDuration) * 100;

        marker.style.cssText = `
          position: absolute;
          left: ${position}%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 3px;
          height: 12px;
          background: #ff6b6b;
          border-radius: 2px;
          box-shadow: 0 0 4px rgba(255, 107, 107, 0.6);
          pointer-events: none;
          z-index: 101;
        `;

        marker.title = `${utils.formatTime(timestamp.time)}${
          timestamp.note ? ` - ${timestamp.note}` : ""
        }`;
        this.markersContainer.appendChild(marker);
      });
    },

    getCurrentTimestamps() {
      const timestamps = [];
      const listItems = document.querySelectorAll(
        "#ytls-pane ul li:not(.now-playing)"
      );

      listItems.forEach((item) => {
        const timeElement = item.querySelector("a");
        const noteElement = item.querySelector("input");

        if (timeElement && timeElement.dataset.time) {
          timestamps.push({
            time: parseInt(timeElement.dataset.time),
            note: noteElement ? noteElement.value : "",
          });
        }
      });

      return timestamps;
    },

    destroy() {
      if (this.markersContainer) {
        this.markersContainer.remove();
        this.markersContainer = null;
      }
    },
  };

  const ui = {
    createTimestampItem(time, note = "") {
      const li = document.createElement("li");
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
        utils.debounce(() => {
          handlers.saveCurrentTimestamps();
        }, 500)
      );

      copyBtn.className = "copy-btn";
      copyBtn.title = "Copy timestamp";
      copyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="#e3e3e3">
          <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/>
        </svg>
      `;

      deleteBtn.className = "delete-btn";
      deleteBtn.title = "Delete timestamp";
      deleteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="#f44336">
          <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/>
        </svg>
      `;

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

    init() {
      const pane = document.createElement("div");
      pane.id = "ytls-pane";

      const header = document.createElement("div");
      header.className = "ytls-header";

      const minimizeBtn = document.createElement("span");
      minimizeBtn.textContent = "−";
      minimizeBtn.className = "minimize-btn";
      minimizeBtn.title = "Minimize";

      const exitBtn = document.createElement("span");
      exitBtn.textContent = "×";
      exitBtn.className = "exit-btn";
      exitBtn.title = "Close";

      minimizeBtn.addEventListener("click", () => {
        const isMinimized = pane.classList.contains("minimized");

        if (isMinimized) {
          pane.classList.remove("minimized");
          minimizeBtn.textContent = "−";
          minimizeBtn.title = "Minimize";
        } else {
          pane.classList.add("minimized");
          minimizeBtn.textContent = "+";
          minimizeBtn.title = "Restore";
        }
      });

      exitBtn.addEventListener("click", handlers.closePane);

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
      copyBtn.textContent = "Copy List";
      copyBtn.dataset.action = "copy";
      copyBtn.addEventListener("click", handlers.copyList);

      buttons.appendChild(addBtn);
      buttons.appendChild(copyBtn);

      const style = document.createElement("style");
      style.textContent = `
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
        .minimize-btn {
          color: #FFC107;
          cursor: pointer;
          font-size: 18px;
          font-weight: bold;
          line-height: 1;
          padding: 2px 5px;
          border-radius: 3px;
          transition: background-color 0.2s ease;
        }
        .minimize-btn:hover {
          background: rgba(255, 193, 7, 0.2);
        }
        .exit-btn {
          color: white;
          cursor: pointer;
          font-size: 18px;
          font-weight: bold;
          line-height: 1;
          padding: 2px 5px;
          border-radius: 3px;
          transition: background-color 0.2s ease;
        }
        .exit-btn:hover {
          background: rgba(255,255,255,0.2);
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
          min-width: 60px;
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
        .copy-btn {
          cursor: pointer;
          padding: 2px;
          border-radius: 3px;
          transition: background-color 0.2s ease;
        }
        .copy-btn:hover {
          background: rgba(255,255,255,0.2);
        }
        .copy-btn svg {
          transition: fill 0.3s ease;
          display: block;
        }
        .delete-btn {
          cursor: pointer;
          padding: 2px;
          border-radius: 3px;
          transition: background-color 0.2s ease;
        }
        .delete-btn:hover {
          background: rgba(244, 67, 54, 0.2);
        }
        .delete-btn svg {
          transition: fill 0.3s ease;
          display: block;
        }
        .delete-btn:hover svg {
          fill: #f44336 !important;
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
      `;

      list.addEventListener("click", handlers.clickStamp);
      list.addEventListener("touchstart", handlers.clickStamp, {
        passive: true,
      });

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

      return pane;
    },
  };

  // Execução inicial
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTimestampManager);
  } else {
    initTimestampManager();
  }

  // Observer para detectar mudanças de URL (navegação SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      state.videoId = null; // Reset videoId para nova página
      setTimeout(() => {
        if (shouldShowTimestampManager()) {
          initTimestampManager();
        } else {
          cleanupTimestampManager();
        }
      }, 100);
    }
  }).observe(document, { subtree: true, childList: true });

  // Fallback para eventos de navegação
  window.addEventListener("popstate", () => {
    setTimeout(() => {
      if (shouldShowTimestampManager()) {
        initTimestampManager();
      } else {
        cleanupTimestampManager();
      }
    }, 100);
  });
})();
