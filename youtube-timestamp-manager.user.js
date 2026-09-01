// ==UserScript==
// @name            YouTube Timestamp Manager
// @name:pt         Gerenciador de Timestamps do YouTube
// @version         1.9.0
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
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/state.js
  var elements, state;
  var init_state = __esm({
    "src/state.js"() {
      elements = { video: null, pane: null };
      state = {
        nowid: null,
        videoId: null,
        currentUrl: location.href,
        // MutationObserver à espera do <video>, quando há um. Fica aqui porque quem
        // o desarma é o cleanup, não o próprio init que o criou.
        observer: null
      };
    }
  });

  // src/utils/debounce.js
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  var init_debounce = __esm({
    "src/utils/debounce.js"() {
    }
  });

  // src/drag.js
  var POSITION_KEY, RESIZE_DEBOUNCE, drag;
  var init_drag = __esm({
    "src/drag.js"() {
      init_state();
      init_debounce();
      POSITION_KEY = "ytts_pane_position";
      RESIZE_DEBOUNCE = 100;
      drag = {
        _pane: null,
        _header: null,
        // Distância entre o ponteiro e o canto superior esquerdo do painel no início
        // do arraste; mantém o painel preso ao ponto onde foi agarrado.
        _offset: null,
        // Medidas tiradas no início do arraste. O painel não muda de tamanho no meio
        // do gesto, então medir a cada `pointermove` só custaria reflow.
        _dims: null,
        // Houve movimento neste gesto? Um clique na alça não deve gravar posição.
        _moved: false,
        // Posição pretendida pelo usuário, mais a distância dali até o rodapé da
        // viewport. É intenção, não o que está na tela: o clamp pode empurrar o
        // painel para dentro sem mexer aqui, e por isso desfazer o que empurrou
        // (crescer a janela de novo, restaurar o painel) devolve o lugar escolhido.
        _anchor: null,
        _pointerId: null,
        _onResize: null,
        /**
         * Limita uma posição para que o painel caia inteiro dentro da viewport.
         * É função pura de propósito: recebe todas as medidas por parâmetro e não
         * toca em DOM nem em `window`. O jsdom não faz layout e devolve zero em
         * `offsetWidth` / `getBoundingClientRect`, então clamp que mede o DOM por
         * dentro seria intestável. Quem mede é `drag.measure`.
         * @param {{top: number, left: number, paneW: number, paneH: number, viewW: number, viewH: number}} dims
         * @returns {{top: number, left: number}} Posição limitada às bordas da viewport.
         */
        clampToViewport({ top, left, paneW, paneH, viewW, viewH }) {
          const maxLeft = Math.max(0, viewW - paneW);
          const maxTop = Math.max(0, viewH - paneH);
          return {
            top: Math.min(Math.max(top, 0), maxTop),
            left: Math.min(Math.max(left, 0), maxLeft)
          };
        },
        /**
         * Lê as medidas do painel e da janela para alimentar `clampToViewport`.
         * Único trecho do módulo que depende de layout real, logo o único que os
         * testes em jsdom não conseguem exercitar.
         * @param {HTMLElement} pane - Painel a medir.
         * @returns {{paneW: number, paneH: number, viewW: number, viewH: number}} Medidas atuais.
         */
        measure(pane) {
          return {
            paneW: pane.offsetWidth,
            paneH: pane.offsetHeight,
            viewW: window.innerWidth,
            viewH: window.innerHeight
          };
        },
        /**
         * Lê a posição salva no localStorage.
         * @returns {{top: number, left: number}|null} Posição salva, ou `null` se não houver ou estiver corrompida.
         */
        getSavedPosition() {
          try {
            const data = localStorage.getItem(POSITION_KEY);
            if (!data) return null;
            const position = JSON.parse(data);
            if (!Number.isFinite(position?.top) || !Number.isFinite(position?.left)) {
              return null;
            }
            return { top: position.top, left: position.left };
          } catch {
            return null;
          }
        },
        /**
         * Persiste a posição do painel no localStorage.
         * @param {number} top - Distância do topo da viewport, em pixels.
         * @param {number} left - Distância da esquerda da viewport, em pixels.
         */
        savePosition(top, left) {
          try {
            localStorage.setItem(POSITION_KEY, JSON.stringify({ top, left }));
          } catch (error) {
            console.error("[YT Timestamp Manager] Failed to save position:", error);
          }
        },
        /** Remove a posição salva do localStorage. */
        clearPosition() {
          try {
            localStorage.removeItem(POSITION_KEY);
          } catch (error) {
            console.error("[YT Timestamp Manager] Failed to clear position:", error);
          }
        },
        /**
         * Posiciona o painel na tela. A classe `moved` é o que zera o `bottom: 0` do
         * CSS — sem ela, `top` e `bottom` definidos ao mesmo tempo esticariam o
         * painel de uma borda à outra.
         * @param {HTMLElement} pane - Painel a posicionar.
         * @param {number} top - Distância do topo da viewport, em pixels.
         * @param {number} left - Distância da esquerda da viewport, em pixels.
         */
        applyPosition(pane, top, left) {
          pane.classList.add("moved");
          pane.style.top = `${top}px`;
          pane.style.left = `${left}px`;
        },
        /**
         * Clampa uma posição pretendida e a escreve no painel. Único caminho por
         * onde o painel se move, seja por arraste, por `resize` ou por mudança de
         * altura.
         * @param {HTMLElement} pane - Painel a posicionar.
         * @param {number} top - Posição pretendida a partir do topo, em pixels.
         * @param {number} left - Posição pretendida a partir da esquerda, em pixels.
         * @param {{paneW: number, paneH: number, viewW: number, viewH: number}} [dims] - Medidas já tiradas; medidas na hora se omitido.
         * @returns {{top: number, left: number}} Posição efetivamente aplicada.
         */
        _place(pane, top, left, dims = drag.measure(pane)) {
          const placed = drag.clampToViewport({ top, left, ...dims });
          drag.applyPosition(pane, placed.top, placed.left);
          return placed;
        },
        /**
         * Devolve o painel ao canto inferior esquerdo padrão e esquece a posição salva.
         * Sai sem efeito se o painel não estiver montado.
         */
        resetPosition() {
          drag.clearPosition();
          drag._anchor = null;
          const pane = elements.pane;
          if (!pane) return;
          pane.classList.remove("moved");
          pane.style.top = "";
          pane.style.left = "";
        },
        /**
         * Aplica a posição salva (se houver) e liga o arraste pelo cabeçalho.
         * Desliga primeiro o que estiver ligado: um `init` sem o `destroy` do
         * lifecycle (painel remontado por um caminho que não passou pelo cleanup)
         * sobrescreveria `_onResize` e deixaria o listener anterior preso à janela
         * para sempre, já que `destroy` só sabe remover a última referência.
         * @param {HTMLElement} pane - Painel a arrastar.
         * @param {HTMLElement} header - Faixa que funciona como alça de arraste.
         */
        init(pane, header) {
          drag.destroy();
          drag._pane = pane;
          drag._header = header;
          const saved = drag.getSavedPosition();
          if (saved) {
            const dims = drag.measure(pane);
            drag._place(pane, saved.top, saved.left, dims);
            drag._setAnchor(saved.top, saved.left, dims);
          }
          header.addEventListener("pointerdown", drag._onPointerDown);
          drag._onResize = debounce(drag.refresh, RESIZE_DEBOUNCE);
          window.addEventListener("resize", drag._onResize);
        },
        /**
         * Guarda a posição pretendida e a distância dali até o rodapé da viewport.
         * @param {number} top - Posição pretendida a partir do topo, em pixels.
         * @param {number} left - Posição pretendida a partir da esquerda, em pixels.
         * @param {{paneH: number, viewH: number}} dims - Medidas usadas para posicionar.
         */
        _setAnchor(top, left, { paneH, viewH }) {
          drag._anchor = { top, left, fromBottom: viewH - (top + paneH) };
        },
        /**
         * Recoloca o painel a partir da âncora, respeitando a borda vertical mais
         * próxima: encostado embaixo, ele continua encostado embaixo quando a altura
         * muda (minimizar, restaurar, ganhar ou perder timestamps); encostado em
         * cima, o topo é que fica parado. Sem isto o painel, ancorado só por `top`,
         * cresce sempre para baixo e escorre para fora da tela.
         *
         * Também é o que roda no `resize`. A âncora não é reescrita aqui, então
         * desfazer o que empurrou o painel devolve a posição escolhida.
         *
         * Sem efeito enquanto o painel estiver no canto padrão: lá o `bottom: 0` do
         * CSS já ancora pelo rodapé.
         */
        refresh() {
          const pane = drag._pane;
          const anchor = drag._anchor;
          if (!pane || !anchor || !pane.classList.contains("moved")) return;
          const dims = drag.measure(pane);
          const top = anchor.fromBottom < anchor.top ? dims.viewH - dims.paneH - anchor.fromBottom : anchor.top;
          drag._place(pane, top, anchor.left, dims);
        },
        /**
         * Início do arraste. Ignora cliques nos ícones do cabeçalho, que continuam
         * sendo só clique.
         * @param {PointerEvent} e - Evento de `pointerdown` no cabeçalho.
         */
        _onPointerDown(e) {
          if (e.button !== 0) return;
          if (drag._offset) return;
          if (e.target.closest(".ytts-icon-btn, #ytts-select-all")) return;
          const pane = drag._pane;
          if (!pane) return;
          const rect = pane.getBoundingClientRect();
          drag._offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          drag._dims = drag.measure(pane);
          drag._moved = false;
          e.preventDefault();
          if (drag._header.setPointerCapture) {
            drag._header.setPointerCapture(e.pointerId);
            drag._pointerId = e.pointerId;
          }
          pane.classList.add("dragging");
          window.addEventListener("pointermove", drag._onPointerMove);
          window.addEventListener("pointerup", drag._onPointerUp);
          window.addEventListener("pointercancel", drag._onPointerUp);
        },
        /**
         * Move o painel acompanhando o ponteiro, sempre dentro da viewport.
         * @param {PointerEvent} e - Evento de `pointermove` na janela.
         */
        _onPointerMove(e) {
          const pane = drag._pane;
          if (!pane || !drag._offset) return;
          const { top, left } = drag._place(
            pane,
            e.clientY - drag._offset.y,
            e.clientX - drag._offset.x,
            drag._dims
          );
          drag._setAnchor(top, left, drag._dims);
          drag._moved = true;
        },
        /**
         * Fim do arraste: solta os listeners de janela e persiste a posição.
         * Serve também ao `pointercancel`, que grava o que já tinha sido movido.
         *
         * A gravação e a limpeza vêm antes de soltar a captura de ponteiro, e a
         * liberação em si vai dentro de `try`: `releasePointerCapture` lança
         * `NotFoundError` quando o ponteiro já não está ativo — o caso do
         * `pointercancel` — e a exceção levaria junto tudo que viesse depois,
         * perdendo a posição arrastada.
         */
        _onPointerUp() {
          window.removeEventListener("pointermove", drag._onPointerMove);
          window.removeEventListener("pointerup", drag._onPointerUp);
          window.removeEventListener("pointercancel", drag._onPointerUp);
          if (drag._pane) {
            drag._pane.classList.remove("dragging");
          }
          if (drag._moved && drag._anchor) {
            drag.savePosition(drag._anchor.top, drag._anchor.left);
          }
          drag._offset = null;
          drag._dims = null;
          drag._moved = false;
          if (drag._pointerId !== null && drag._header?.releasePointerCapture) {
            try {
              drag._header.releasePointerCapture(drag._pointerId);
            } catch {
            }
            drag._pointerId = null;
          }
        },
        /**
         * Desliga o arraste e limpa o estado do módulo.
         * Chamado a cada navegação SPA: sem isso, cada painel recriado deixaria para
         * trás um listener de `resize`.
         */
        destroy() {
          if (drag._onResize) {
            window.removeEventListener("resize", drag._onResize);
            drag._onResize = null;
          }
          if (drag._header) {
            drag._header.removeEventListener("pointerdown", drag._onPointerDown);
          }
          window.removeEventListener("pointermove", drag._onPointerMove);
          window.removeEventListener("pointerup", drag._onPointerUp);
          window.removeEventListener("pointercancel", drag._onPointerUp);
          drag._pane = null;
          drag._header = null;
          drag._offset = null;
          drag._dims = null;
          drag._moved = false;
          drag._anchor = null;
          drag._pointerId = null;
        }
      };
    }
  });

  // src/utils/video.js
  function getVideoId() {
    if (!state.videoId) {
      state.videoId = location.search.split(/.+v=|&/)[1] || location.href.split(/\/live\/|\/shorts\/|\?|&/)[1];
    }
    return state.videoId;
  }
  function getVideo() {
    if (!elements.video) {
      elements.video = document.querySelector("video");
    }
    return elements.video;
  }
  function getVideoTitle() {
    const title = (document.title || "").replace(/^\(\d+\)\s*/, "").replace(/\s*-\s*YouTube$/, "").trim();
    return title === "YouTube" ? "" : title;
  }
  var init_video = __esm({
    "src/utils/video.js"() {
      init_state();
    }
  });

  // src/utils/time.js
  function formatTime(time) {
    const h = Math.floor(time / 3600);
    const m = Math.floor(time / 60) % 60;
    const s = Math.floor(time) % 60;
    return (h ? `${h}:${String(m).padStart(2, "0")}` : m) + `:${String(s).padStart(2, "0")}`;
  }
  var init_time = __esm({
    "src/utils/time.js"() {
    }
  });

  // src/progressMarkers.js
  var progressMarkers;
  var init_progressMarkers = __esm({
    "src/progressMarkers.js"() {
      init_video();
      init_time();
      progressMarkers = {
        markersContainer: null,
        _lastKey: null,
        /**
         * Inicializa os marcadores de progresso: cria o container e renderiza os pins.
         */
        init() {
          this.createMarkersContainer();
          this.updateMarkers();
        },
        /**
         * Cria e injeta o container de marcadores dentro da barra de progresso do YouTube.
         * Tenta novamente após 1 segundo se a barra ainda não estiver no DOM.
         */
        createMarkersContainer() {
          if (this.markersContainer) {
            this.markersContainer.remove();
          }
          const progressBar = document.querySelector(
            ".ytp-progress-bar-container, .ytp-progress-bar"
          );
          if (!progressBar) {
            setTimeout(() => this.createMarkersContainer(), 1e3);
            return;
          }
          this.markersContainer = document.createElement("div");
          this.markersContainer.className = "ytts-progress-markers";
          this.markersContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: auto;
      z-index: 100;
    `;
          progressBar.appendChild(this.markersContainer);
        },
        /**
         * Re-renderiza todos os pins de marcador com base nos timestamps atualmente na lista.
         * Limpa os marcadores existentes antes de redesenhar.
         * Inicializa o container automaticamente se ainda não existir.
         */
        updateMarkers() {
          if (!this.markersContainer) {
            this.init();
            return;
          }
          const video = getVideo();
          if (!video || !video.duration) return;
          const timestamps = this.getCurrentTimestamps();
          const key = JSON.stringify(timestamps);
          if (key === this._lastKey) return;
          this._lastKey = key;
          this.markersContainer.replaceChildren();
          const videoDuration = video.duration;
          timestamps.forEach((timestamp) => {
            const markerWrapper = document.createElement("div");
            const marker = document.createElement("div");
            const tooltip = document.createElement("div");
            const position = timestamp.time / videoDuration * 100;
            markerWrapper.className = "ytts-marker-wrapper";
            markerWrapper.style.cssText = `
        position: absolute;
        left: ${position}%;
        top: 0;
        height: 100%;
        transform: translateX(-50%);
        pointer-events: auto;
        z-index: 101;
        cursor: pointer;
      `;
            marker.className = "ytts-marker";
            marker.style.cssText = `
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 3px;
        height: 12px;
        background: #ff6b6b;
        border-radius: 2px;
        box-shadow: 0 0 4px rgba(255, 107, 107, 0.6);
        transition: all 0.2s ease;
      `;
            const tooltipText = `${formatTime(timestamp.time)}${timestamp.note ? ` - ${timestamp.note}` : ""}`;
            tooltip.className = "ytts-marker-tooltip";
            tooltip.textContent = tooltipText;
            tooltip.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(28, 28, 28, 0.95);
        color: white;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 12px;
        font-family: 'Roboto', Arial, sans-serif;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        z-index: 1000;
        max-width: 200px;
        text-align: center;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
      `;
            const tooltipArrow = document.createElement("div");
            tooltipArrow.className = "ytts-tooltip-arrow";
            tooltipArrow.style.cssText = `
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid rgba(28, 28, 28, 0.95);
      `;
            tooltip.appendChild(tooltipArrow);
            markerWrapper.addEventListener("mouseenter", () => {
              tooltip.style.opacity = "1";
              tooltip.style.visibility = "visible";
              marker.style.height = "16px";
              marker.style.width = "4px";
              marker.style.background = "#ff5252";
              marker.style.boxShadow = "0 0 8px rgba(255, 82, 82, 0.8)";
            });
            markerWrapper.addEventListener("mouseleave", () => {
              tooltip.style.opacity = "0";
              tooltip.style.visibility = "hidden";
              marker.style.height = "12px";
              marker.style.width = "3px";
              marker.style.background = "#ff6b6b";
              marker.style.boxShadow = "0 0 4px rgba(255, 107, 107, 0.6)";
            });
            markerWrapper.addEventListener("click", (e) => {
              e.stopPropagation();
              const v = getVideo();
              if (v) {
                v.currentTime = timestamp.time;
              }
            });
            markerWrapper.appendChild(marker);
            markerWrapper.appendChild(tooltip);
            this.markersContainer.appendChild(markerWrapper);
          });
        },
        /**
         * Lê os timestamps atualmente exibidos na lista do painel e os retorna como array.
         * @returns {Array<{time: number, note: string}>} Timestamps extraídos dos itens da lista.
         */
        getCurrentTimestamps() {
          const timestamps = [];
          const listItems = document.querySelectorAll(
            "#ytls-pane ul li:not(.now-playing)"
          );
          listItems.forEach((item) => {
            const timeElement = item.querySelector("a");
            const noteElement = item.querySelector(".ytts-note");
            if (timeElement && timeElement.dataset.time) {
              timestamps.push({
                time: parseInt(timeElement.dataset.time),
                note: noteElement ? noteElement.value : ""
              });
            }
          });
          return timestamps;
        },
        /**
         * Remove o container de marcadores do DOM e limpa a referência interna.
         */
        destroy() {
          if (this.markersContainer) {
            this.markersContainer.remove();
            this.markersContainer = null;
          }
          this._lastKey = null;
        }
      };
    }
  });

  // src/utils/clipboard.js
  async function copyToClipboard(text) {
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
  }
  function showCopyFeedback(element) {
    const svg = element ? element.querySelector("svg") : null;
    if (svg) {
      svg.style.fill = "#4CAF50";
      setTimeout(() => {
        svg.style.fill = "#e3e3e3";
      }, 500);
    }
  }
  var init_clipboard = __esm({
    "src/utils/clipboard.js"() {
    }
  });

  // src/utils/notification.js
  function showNotification(message, duration = 2e3) {
    document.querySelector(".ytts-toast")?.remove();
    const notification = document.createElement("div");
    notification.className = "ytts-toast";
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
    const host = document.fullscreenElement || document.body;
    host.appendChild(notification);
    setTimeout(() => {
      notification.style.transform = "translateX(0)";
    }, 10);
    setTimeout(() => {
      notification.style.transform = "translateX(100%)";
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }
  var init_notification = __esm({
    "src/utils/notification.js"() {
    }
  });

  // src/utils/hotkey.js
  function normalizeKey(key) {
    if (key === " ") return "Space";
    return key.length === 1 ? key.toUpperCase() : key;
  }
  function hotkeyFromEvent(event) {
    if (!event || !event.key || MODIFIER_KEYS.includes(event.key)) return null;
    return {
      key: normalizeKey(event.key),
      ctrl: !!event.ctrlKey,
      alt: !!event.altKey,
      shift: !!event.shiftKey,
      meta: !!event.metaKey
    };
  }
  function formatHotkey(hotkey) {
    if (!hotkey || !hotkey.key) return "";
    const parts = [];
    if (hotkey.ctrl) parts.push("Ctrl");
    if (hotkey.alt) parts.push("Alt");
    if (hotkey.shift) parts.push("Shift");
    if (hotkey.meta) parts.push("Meta");
    parts.push(normalizeKey(hotkey.key));
    return parts.join("+");
  }
  function matchesHotkey(event, hotkey) {
    if (!event || !hotkey || !hotkey.key) return false;
    const pressed = hotkeyFromEvent(event);
    if (!pressed) return false;
    return pressed.key === normalizeKey(hotkey.key) && pressed.ctrl === !!hotkey.ctrl && pressed.alt === !!hotkey.alt && pressed.shift === !!hotkey.shift && pressed.meta === !!hotkey.meta;
  }
  var MODIFIER_KEYS, DEFAULT_HOTKEY;
  var init_hotkey = __esm({
    "src/utils/hotkey.js"() {
      MODIFIER_KEYS = ["Shift", "Control", "Alt", "Meta", "AltGraph"];
      DEFAULT_HOTKEY = {
        key: "S",
        ctrl: false,
        alt: false,
        shift: true,
        meta: false
      };
    }
  });

  // src/utils/storage.js
  function saveTimestamps(videoId, timestamps) {
    try {
      localStorage.setItem(`${PREFIX}${videoId}`, JSON.stringify(timestamps));
    } catch (error) {
      console.error("[YT Timestamp Manager] Failed to save timestamps:", error);
    }
  }
  function loadTimestamps(videoId) {
    try {
      const data = localStorage.getItem(`${PREFIX}${videoId}`);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("[YT Timestamp Manager] Failed to load timestamps:", error);
      return [];
    }
  }
  function saveVideoTitle(videoId, title) {
    if (!title) return;
    try {
      localStorage.setItem(`${META_PREFIX}${videoId}`, JSON.stringify({ title }));
    } catch (error) {
      console.error("[YT Timestamp Manager] Failed to save video title:", error);
    }
  }
  function loadVideoTitle(videoId) {
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
  function deleteVideoTitle(videoId) {
    try {
      localStorage.removeItem(`${META_PREFIX}${videoId}`);
    } catch (error) {
      console.error("[YT Timestamp Manager] Failed to delete video title:", error);
    }
  }
  function getAllSavedVideos() {
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
  function deleteVideoTimestamps(videoId) {
    try {
      localStorage.removeItem(`${PREFIX}${videoId}`);
    } catch (error) {
      console.error("[YT Timestamp Manager] Failed to delete timestamps:", error);
    }
    deleteVideoTitle(videoId);
  }
  function getRetentionDays() {
    try {
      const days = parseInt(localStorage.getItem("ytts_retention_days"), 10);
      return Number.isNaN(days) || days < 1 ? DEFAULT_RETENTION_DAYS : days;
    } catch {
      return DEFAULT_RETENTION_DAYS;
    }
  }
  function removeExpiredFromStorage() {
    const cutoff = Date.now() - getRetentionDays() * 24 * 60 * 60 * 1e3;
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
            if (!Array.isArray(timestamps)) continue;
            const valid = timestamps.filter((ts) => {
              const created = Date.parse(ts.creation);
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
        error
      );
    }
    emptiedVideoIds.forEach((videoId) => deleteVideoTitle(videoId));
    return { cleanedCount, affectedVideoIds };
  }
  var PREFIX, META_PREFIX, DEFAULT_RETENTION_DAYS;
  var init_storage = __esm({
    "src/utils/storage.js"() {
      PREFIX = "ytts_";
      META_PREFIX = "yttsmeta_";
      DEFAULT_RETENTION_DAYS = 30;
    }
  });

  // src/utils/el.js
  function appendChildren(node, children) {
    const list = Array.isArray(children) ? children : [children];
    for (const child of list) {
      if (child === null || child === void 0 || child === false) continue;
      node.append(child);
    }
  }
  function el(tag, props = {}, children = []) {
    const isSvg = SVG_TAGS.has(tag);
    const node = isSvg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
    if (Array.isArray(props) || typeof props === "string" || typeof props === "number" || props instanceof Node) {
      appendChildren(node, props);
      return node;
    }
    for (const [key, value] of Object.entries(props ?? {})) {
      if (value === null || value === void 0) continue;
      if (key === "dataset") {
        Object.assign(node.dataset, value);
      } else if (key === "style") {
        for (const [name, styleValue] of Object.entries(value)) {
          if (name.includes("-")) {
            node.style.setProperty(name, styleValue);
          } else {
            node.style[name] = styleValue;
          }
        }
      } else if (key === "attrs") {
        for (const [name, attrValue] of Object.entries(value)) {
          node.setAttribute(name, attrValue);
        }
      } else if (key === "on") {
        for (const [type, listener] of Object.entries(value)) {
          const [fn, options] = Array.isArray(listener) ? listener : [listener];
          node.addEventListener(type, fn, options);
        }
      } else if (key === "children") {
        appendChildren(node, value);
      } else if (key === "className" && isSvg) {
        node.setAttribute("class", value);
      } else {
        node[key] = value;
      }
    }
    appendChildren(node, children);
    return node;
  }
  var SVG_NS, SVG_TAGS;
  var init_el = __esm({
    "src/utils/el.js"() {
      SVG_NS = "http://www.w3.org/2000/svg";
      SVG_TAGS = /* @__PURE__ */ new Set(["svg", "path", "g", "circle", "rect", "line"]);
    }
  });

  // src/ui.js
  var GITHUB_ICON_PATH, SELECTION_MIN_COUNT, STYLES, ui;
  var init_ui = __esm({
    "src/ui.js"() {
      init_state();
      init_debounce();
      init_el();
      init_drag();
      init_notification();
      init_progressMarkers();
      init_handlers();
      init_storage();
      init_video();
      init_hotkey();
      GITHUB_ICON_PATH = "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z";
      SELECTION_MIN_COUNT = 3;
      STYLES = `
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
  /* Painel arrastado para fora do canto: o \`bottom: auto\` \xE9 obrigat\xF3rio, sen\xE3o
     \`top\` e \`bottom\` valendo juntos esticariam o painel de uma borda \xE0 outra.
     Fora do canto ele deixa de ser pe\xE7a encaixada, da\xED os quatro cantos
     arredondados; o reset no modal devolve o formato original. */
  #ytls-pane.moved {
    bottom: auto;
    border-radius: 8px;
  }
  /* Durante o arraste o ponteiro pode sair do painel, e com ele o :hover \u2014 sem
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
    /* Sem \`touch-action: none\` o browser trata o gesto como rolagem da p\xE1gina e
       o \`pointermove\` nunca chega \u2014 \xE9 o que faz o arraste funcionar no
       m.youtube.com. */
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
  }
  #ytls-pane.minimized ul,
  #ytls-pane.minimized .ytls-buttons {
    display: none;
  }
  /* O header continua vis\xEDvel quando minimizado, ent\xE3o o "selecionar todos"
     precisa sair explicitamente: sem isso ele fica sozinho no header, marcando
     linhas que ningu\xE9m v\xEA, e ao restaurar o painel volta com tudo selecionado e
     o bot\xE3o destrutivo j\xE1 habilitado. O !important \xE9 necess\xE1rio porque
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
  /* A regra #ytls-pane input acima n\xE3o filtra tipo, ent\xE3o tamb\xE9m pegaria os
     checkboxes de sele\xE7\xE3o e os esticaria com cara de campo de texto. */
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
  /* A al\xE7a empurra os \xEDcones para a direita, papel que era do select-all. Ela
     fica antes dele, ent\xE3o o select-all n\xE3o precisa mais do margin-right. */
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
  .ytts-retention-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    color: white;
    font-size: 14px;
  }
  #ytts-hotkey-field,
  #ytts-retention-days {
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
      ui = {
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
            on: { change: () => ui.updateSelectionUI() }
          });
          const textInput = el("input", {
            type: "text",
            className: "ytts-note",
            value: note,
            placeholder: "Add note...",
            on: {
              input: debounce(() => {
                handlers.saveCurrentTimestamps();
              }, 500)
            }
          });
          const li = el(
            "li",
            {
              dataset: {
                creation: creation || (/* @__PURE__ */ new Date()).toISOString()
              }
            },
            [
              selectBox,
              a,
              textInput,
              el("span", {
                className: "ytts-icon-btn",
                title: "Copy timestamp",
                textContent: "\u{1F4CB}",
                on: { click: () => handlers.copyIndividualTimestamp(a, textInput) }
              }),
              el("span", {
                className: "ytts-icon-btn",
                title: "Delete timestamp",
                textContent: "\u26D4",
                on: {
                  click: () => {
                    if (confirm("Delete this timestamp?")) {
                      li.remove();
                      handlers.saveCurrentTimestamps();
                      ui.updateSelectionUI();
                    }
                  }
                }
              })
            ]
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
            "#ytls-pane ul li:not(.now-playing)"
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
            selectAllBox.checked = selectedCount > 0 && selectedCount === boxes.length;
            selectAllBox.indeterminate = selectedCount > 0 && selectedCount < boxes.length;
          }
          if (deleteSelectedBtn) {
            deleteSelectedBtn.style.display = display;
            deleteSelectedBtn.textContent = `Delete Selected (${selectedCount})`;
            deleteSelectedBtn.disabled = selectedCount === 0;
          }
          drag.refresh();
        },
        /**
         * Cria e injeta o painel flutuante principal no `document.body`.
         * Configura cabeçalho, lista de timestamps, botões de ação e estilos CSS.
         * Inicia o loop `watchTime` e carrega timestamps salvos após 1 segundo.
         * @returns {HTMLDivElement} Elemento do painel criado.
         */
        init() {
          const dragHandle = el("span", {
            id: "ytts-drag-handle",
            textContent: "\u283F",
            title: "Drag to move"
          });
          const selectAllBox = el("input", {
            type: "checkbox",
            id: "ytts-select-all",
            title: "Select all",
            style: { display: "none" },
            on: {
              change: () => {
                document.querySelectorAll("#ytls-pane .ytts-select").forEach((box) => {
                  box.checked = selectAllBox.checked;
                });
                ui.updateSelectionUI();
              }
            }
          });
          const minimizeBtn = el("span", {
            className: "ytts-icon-btn",
            textContent: "\u{1F53D}",
            title: "Minimize",
            on: { click: () => setMinimized(!pane.classList.contains("minimized")) }
          });
          const header = el("div", { className: "ytls-header" }, [
            dragHandle,
            selectAllBox,
            el("span", {
              className: "ytts-icon-btn",
              textContent: "\u2699\uFE0F",
              title: "Settings",
              on: { click: ui.openSettingsModal }
            }),
            minimizeBtn,
            el("span", {
              className: "ytts-icon-btn",
              textContent: "\u274C",
              title: "Close",
              on: { click: handlers.closePane }
            })
          ]);
          const list = el(
            "ul",
            {
              on: {
                click: handlers.clickStamp,
                touchstart: [handlers.clickStamp, { passive: true }]
              }
            },
            [
              el("li", { className: "now-playing" }, [
                el("a"),
                el("input", { disabled: true, value: "End of Video" })
              ])
            ]
          );
          const buttons = el("div", { className: "ytls-buttons" }, [
            el("button", {
              textContent: "Add Timestamp",
              dataset: { action: "add" },
              on: { click: handlers.addStamp }
            }),
            el("button", {
              textContent: "Copy Timestamps",
              dataset: { action: "copy" },
              on: { click: handlers.copyList }
            }),
            el("button", {
              id: "ytls-delete-selected",
              textContent: "Delete Selected (0)",
              dataset: { action: "delete-selected" },
              style: { display: "none" },
              on: { click: handlers.deleteSelectedTimestamps }
            })
          ]);
          const pane = el(
            "div",
            {
              id: "ytls-pane",
              // Carimba o vídeo dono do painel. A navegação SPA troca a URL antes de
              // remontar o painel, então `saveCurrentTimestamps` compara os dois e se
              // cala enquanto eles não batem.
              dataset: { videoId: getVideoId() }
            },
            [
              header,
              list,
              el("textarea", { id: "ytls-box", style: { display: "none" } }),
              buttons,
              el("style", { textContent: STYLES })
            ]
          );
          const setMinimized = (minimized) => {
            if (minimized) {
              pane.classList.add("minimized");
              minimizeBtn.textContent = "\u{1F53C}";
              minimizeBtn.title = "Restore";
            } else {
              pane.classList.remove("minimized");
              minimizeBtn.textContent = "\u{1F53D}";
              minimizeBtn.title = "Minimize";
            }
            drag.refresh();
          };
          window.addEventListener("unload", handlers.warn);
          document.addEventListener("keydown", handlers.onHotkey, true);
          document.body.appendChild(pane);
          elements.pane = pane;
          drag.init(pane, header);
          handlers.watchTime();
          setTimeout(() => {
            handlers.loadSavedTimestamps();
          }, 1e3);
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
            textContent: "\xD7"
          });
          const header = el("div", { className: "ytts-settings-header" }, [
            el("h3", { textContent: "Settings" }),
            closeBtn
          ]);
          const settingsTabBtn = el("button", {
            className: "ytts-tab ytts-tab-active",
            textContent: "Settings"
          });
          const videosTabBtn = el("button", {
            className: "ytts-tab",
            textContent: "Videos"
          });
          const tabs = el("div", { className: "ytts-tabs" }, [
            settingsTabBtn,
            videosTabBtn
          ]);
          const settingsTab = el("div", { id: "ytts-tab-settings" });
          const videosTab = el("div", {
            id: "ytts-tab-videos",
            style: { display: "none" }
          });
          const body = el("div", { className: "ytts-settings-body" }, [
            settingsTab,
            videosTab
          ]);
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
                const stored = hotkeyField.dataset.hotkey;
                hotkeyField.value = stored ? formatHotkey(JSON.parse(stored)) : "Disabled";
              },
              keydown: (e) => {
                e.preventDefault();
                e.stopPropagation();
                const captured = hotkeyFromEvent(e);
                if (!captured) return;
                setHotkeyField(captured);
                hotkeyField.blur();
              }
            }
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
                checked: ui.getAutoCleanupSetting()
              }),
              el("span", [
                "Automatically clean expired timestamps",
                el("br"),
                el("small", {
                  textContent: "A timestamp expires once it is older than the window set below."
                })
              ])
            ]),
            el("div", { className: "ytts-retention-row" }, [
              el("span", { textContent: "Expire timestamps after" }),
              el("input", {
                type: "number",
                id: "ytts-retention-days",
                min: "1",
                step: "1",
                value: ui.getRetentionDaysSetting()
              }),
              el("span", { textContent: "days" })
            ]),
            el(
              "label",
              { className: "ytts-setting-item", style: { marginTop: "12px" } },
              [
                el("input", {
                  type: "checkbox",
                  id: "start-minimized",
                  checked: ui.getStartMinimizedSetting()
                }),
                el("span", { textContent: "Start widget minimized" })
              ]
            ),
            el("div", { className: "ytts-hotkey-row" }, [
              el("span", { textContent: "Timestamp shortcut" }),
              hotkeyField,
              el("button", {
                id: "ytts-hotkey-clear",
                textContent: "Clear",
                title: "Turn the shortcut off",
                on: { click: () => setHotkeyField(null) }
              })
            ]),
            // Ação, não preferência: age no clique e não passa pelo Save.
            el("button", {
              id: "ytts-reset-position",
              textContent: "Reset widget position",
              on: {
                click: () => {
                  drag.resetPosition();
                  showNotification("\u21A9\uFE0F Widget position reset");
                }
              }
            })
          );
          const saveBtn = el("button", {
            id: "ytts-save-settings",
            textContent: "Save"
          });
          const cancelBtn = el("button", {
            id: "ytts-cancel-settings",
            textContent: "Cancel"
          });
          const footer = el("div", { className: "ytts-settings-footer" }, [
            el("div", { className: "ytts-settings-version" }, [
              el("span", { textContent: `v${"1.9.0"}` }),
              el("span", {
                className: "ytts-settings-version-separator",
                textContent: "|"
              }),
              el(
                "a",
                {
                  className: "ytts-settings-github-link",
                  href: "https://github.com/filipemanuelofs/youtube-timestamp-manager",
                  target: "_blank",
                  rel: "noopener noreferrer",
                  title: "GitHub"
                },
                [
                  el("svg", { attrs: { viewBox: "0 0 16 16" } }, [
                    el("path", { attrs: { d: GITHUB_ICON_PATH } })
                  ])
                ]
              )
            ]),
            saveBtn,
            cancelBtn
          ]);
          const modal = el("div", { id: "ytts-settings-modal" }, [
            el("div", { className: "ytts-settings-content" }, [
              header,
              tabs,
              body,
              footer
            ])
          ]);
          document.body.appendChild(modal);
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
                textContent: "No videos with timestamps yet."
              })
            );
            return;
          }
          const lastCreation = ({ timestamps }) => timestamps.reduce((newest, { creation }) => {
            const time = Date.parse(creation);
            return Number.isNaN(time) ? newest : Math.max(newest, time);
          }, 0);
          const firstCreation = (timestamps) => timestamps.reduce((oldest, { creation }) => {
            const time = Date.parse(creation);
            if (Number.isNaN(time)) return oldest;
            return oldest === null ? time : Math.min(oldest, time);
          }, null);
          videos.sort((a, b) => lastCreation(b) - lastCreation(a));
          const list = el("ul", { className: "ytts-video-list" });
          videos.forEach(({ videoId, title, timestamps }) => {
            const created = firstCreation(timestamps);
            const createdLabel = created === null ? null : new Date(created).toLocaleDateString();
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
                }
              }
            });
            const li = el(
              "li",
              { className: "ytts-video-item", dataset: { videoId } },
              [
                thumb,
                el("div", { className: "ytts-video-info" }, [
                  createdLabel && el("span", {
                    className: "ytts-video-date",
                    textContent: createdLabel,
                    title: `First timestamp: ${createdLabel}`
                  }),
                  el("a", {
                    className: "ytts-video-title",
                    href: `https://youtu.be/${videoId}`,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    textContent: title || videoId,
                    title: title || videoId
                  })
                ]),
                el("span", {
                  className: "ytts-video-count",
                  textContent: `${timestamps.length}`
                }),
                el("span", {
                  className: "ytts-icon-btn",
                  title: "Delete all timestamps of this video",
                  textContent: "\u26D4",
                  on: { click: () => handlers.deleteVideoFromList(videoId, li) }
                })
              ]
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
          const hotkeyField = document.querySelector("#ytts-hotkey-field");
          const retentionField = document.querySelector("#ytts-retention-days");
          const retentionRaw = retentionField ? retentionField.value.trim() : "";
          const retentionDays = /^\d+$/.test(retentionRaw) ? Number(retentionRaw) : NaN;
          if (retentionField && !(Number.isInteger(retentionDays) && retentionDays >= 1)) {
            showNotification(
              "\u274C Expiration window must be a whole number of days, 1 or more",
              2e3
            );
            return;
          }
          try {
            localStorage.setItem("ytts_auto_cleanup", autoCleanup.toString());
            localStorage.setItem("ytts_start_minimized", startMinimized.toString());
            if (hotkeyField) {
              localStorage.setItem(
                "ytts_hotkey",
                hotkeyField.dataset.hotkey || "null"
              );
            }
            if (retentionField) {
              localStorage.setItem("ytts_retention_days", retentionDays.toString());
            }
            if (autoCleanup) {
              handlers.cleanExpired();
            }
            showNotification("\u2705 Settings saved!");
          } catch {
            showNotification("\u274C Failed to save settings", 1500);
          }
          document.querySelector("#ytts-settings-modal").remove();
        }
      };
    }
  });

  // src/handlers.js
  var handlers;
  var init_handlers = __esm({
    "src/handlers.js"() {
      init_state();
      init_time();
      init_video();
      init_clipboard();
      init_notification();
      init_hotkey();
      init_storage();
      init_progressMarkers();
      init_ui();
      init_lifecycle();
      handlers = {
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
              timestampElement.parentElement.querySelector(".copy-btn")
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
          showNotification("\u23F1\uFE0F Timestamp added!");
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
          if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) {
            return;
          }
          if (!matchesHotkey(e, ui.getHotkeySetting())) return;
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
            "#ytls-pane ul li:not(.now-playing)"
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
            showNotification(`\u2713 ${count} timestamp${count > 1 ? "s" : ""} copied!`);
          } else {
            showNotification("\u274C Copy failed", 1500);
          }
        },
        /**
         * Apaga da lista os timestamps marcados, após confirmação do usuário.
         * A gravação fica toda com `saveCurrentTimestamps`, que já remove a chave do
         * vídeo quando a lista fica vazia. Exibe notificação com o total removido.
         */
        deleteSelectedTimestamps() {
          const selected = [
            ...document.querySelectorAll("#ytls-pane ul li:not(.now-playing)")
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
          showNotification(`\u{1F5D1}\uFE0F ${count} timestamp${count > 1 ? "s" : ""} deleted!`);
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
          if (videoId === getVideoId()) {
            document.querySelectorAll("#ytls-pane ul li:not(.now-playing)").forEach((item) => item.remove());
            progressMarkers.updateMarkers();
            ui.updateSelectionUI();
          }
          const list = li.parentElement;
          const container = list && list.parentElement;
          li.remove();
          if (container && list.children.length === 0) {
            ui.renderVideoList(container);
          }
          showNotification("\u{1F5D1}\uFE0F Video timestamps deleted!");
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
          const pane = document.querySelector("#ytls-pane");
          if (!pane || pane.dataset.videoId !== videoId) return;
          const listItems = document.querySelectorAll(
            "#ytls-pane ul li:not(.now-playing)"
          );
          const timestamps = [];
          listItems.forEach((item) => {
            const time = parseInt(item.querySelector("a").dataset.time);
            const note = item.querySelector(".ytts-note").value;
            const creation = item.dataset.creation;
            timestamps.push({ time, note, creation });
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
          savedTimestamps.forEach(({ time, note, creation }) => {
            ui.createTimestampItem(time, note, creation);
          });
          if (savedTimestamps.length > 0) {
            showNotification(
              `\u2705 ${savedTimestamps.length} saved timestamp${savedTimestamps.length > 1 ? "s" : ""} loaded!`
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
              `\u{1F9F9} Cleaned ${cleanedCount} expired timestamp${cleanedCount > 1 ? "s" : ""}!`
            );
            const currentVideoId = getVideoId();
            if (currentVideoId && affectedVideoIds.includes(currentVideoId)) {
              document.querySelectorAll("#ytls-pane ul li:not(.now-playing)").forEach((item) => item.remove());
              handlers.loadSavedTimestamps();
              progressMarkers.updateMarkers();
              ui.updateSelectionUI();
            }
          }
        }
      };
    }
  });

  // src/lifecycle.js
  function shouldShowTimestampManager() {
    const url = location.href;
    return url.includes("/watch") || url.includes("/live/") || url.includes("/shorts/");
  }
  function cleanupTimestampManager() {
    if (state.nowid) {
      cancelAnimationFrame(state.nowid);
      state.nowid = null;
    }
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    drag.destroy();
    if (elements.pane) {
      elements.pane.remove();
      elements.pane = null;
    }
    document.querySelector("#ytts-settings-modal")?.remove();
    progressMarkers.destroy();
    window.removeEventListener("unload", handlers.warn);
    document.removeEventListener("keydown", handlers.onHotkey, true);
    elements.video = null;
    state.videoId = null;
  }
  function initTimestampManager() {
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
  var init_lifecycle = __esm({
    "src/lifecycle.js"() {
      init_state();
      init_drag();
      init_progressMarkers();
      init_handlers();
      init_ui();
    }
  });

  // src/index.js
  var require_index = __commonJS({
    "src/index.js"() {
      init_state();
      init_lifecycle();
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initTimestampManager);
      } else {
        initTimestampManager();
      }
      var lastUrl = location.href;
      var onNavigate = () => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          state.videoId = null;
          setTimeout(() => {
            if (shouldShowTimestampManager()) {
              initTimestampManager();
            } else {
              cleanupTimestampManager();
            }
          }, 100);
        }
      };
      var origPushState = history.pushState.bind(history);
      history.pushState = function(...args) {
        origPushState(...args);
        onNavigate();
      };
      var origReplaceState = history.replaceState.bind(history);
      history.replaceState = function(...args) {
        origReplaceState(...args);
        onNavigate();
      };
      window.addEventListener("popstate", onNavigate);
      window.addEventListener("yt-navigate-finish", onNavigate);
      document.addEventListener("yt-navigate-finish", onNavigate);
    }
  });
  require_index();
})();
