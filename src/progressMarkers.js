import { getVideo } from "./utils/video.js";
import { formatTime } from "./utils/time.js";

export const progressMarkers = {
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
      ".ytp-progress-bar-container, .ytp-progress-bar",
    );
    if (!progressBar) {
      setTimeout(() => this.createMarkersContainer(), 1000);
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

      const position = (timestamp.time / videoDuration) * 100;

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

      const tooltipText = `${formatTime(timestamp.time)}${
        timestamp.note ? ` - ${timestamp.note}` : ""
      }`;
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
      "#ytls-pane ul li:not(.now-playing)",
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

  /**
   * Remove o container de marcadores do DOM e limpa a referência interna.
   */
  destroy() {
    if (this.markersContainer) {
      this.markersContainer.remove();
      this.markersContainer = null;
    }
    this._lastKey = null;
  },
};
