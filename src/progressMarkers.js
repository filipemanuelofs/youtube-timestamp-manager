import { getVideo } from "./utils/video.js";
import { formatTime } from "./utils/time.js";
import { hexToRgba } from "./utils/color.js";
import {
  MARKER_SHAPES,
  getMarkerShape,
  getMarkerColor,
} from "./utils/storage.js";

export const progressMarkers = {
  markersContainer: null,
  _lastKey: null,
  _retryId: null,

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
      // Retenta por `init()`, e não só por `createMarkersContainer()`: quando a
      // barra finalmente aparece, o container sozinho ficaria vazio até a
      // próxima mudança na lista, porque ninguém chamaria `updateMarkers`.
      //
      // Uma retentativa por vez: `init()` chama esta função e logo depois
      // `updateMarkers`, que também tenta montar o container quando falta. Sem
      // a guarda, cada rodada agendaria um timer novo, e o segundo a disparar
      // recriaria um container já montado — vazio, porque `_lastKey` bloqueia
      // o redesenho de uma lista que não mudou.
      if (this._retryId === null) {
        this._retryId = setTimeout(() => {
          this._retryId = null;
          this.init();
        }, 1000);
      }
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
      // `createMarkersContainer()` e não `init()`: `init()` chama
      // `updateMarkers` de volta, e enquanto a barra de progresso não estivesse
      // no DOM os dois se chamariam até estourar a pilha
      // (`RangeError: Maximum call stack size exceeded`), com um `setTimeout`
      // de retentativa agendado por nível.
      this.createMarkersContainer();
      // Barra ainda ausente: desiste desta rodada e deixa a retentativa
      // agendada acima refazer o caminho inteiro por `init()`.
      if (!this.markersContainer) return;
    }

    const video = getVideo();
    if (!video || !video.duration) return;

    // Lidos uma vez, fora do laço: são preferências globais, e reler a cada
    // item deixaria marcadores da mesma renderização em estados diferentes se
    // a configuração mudasse no meio.
    const shape = getMarkerShape();
    const color = getMarkerColor();
    const glyph = MARKER_SHAPES[shape].glyph;
    const glow = hexToRgba(color, 0.6);
    const glowHover = hexToRgba(color, 0.8);

    const timestamps = this.getCurrentTimestamps();
    // Forma e cor entram na chave junto dos timestamps: sem elas, salvar a
    // configuração não mudaria nada na tela enquanto a lista não mexesse.
    const key = JSON.stringify({ timestamps, shape, color });
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
      // A barra é uma caixa pintada com `background-color`; as outras formas
      // são um caractere pintado com `color`. Daí o brilho trocar de
      // `box-shadow` por `text-shadow`: sombra de caixa num nó de texto sem
      // fundo desenharia um retângulo em volta do glifo, não o contorno dele.
      //
      // `background-color` e não o atalho `background`: o parser de CSS do
      // jsdom engole o resto do bloco depois do atalho, e aí nenhum estilo do
      // marcador chega ao teste.
      marker.style.cssText = glyph
        ? `
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        color: ${color};
        font-size: 14px;
        line-height: 1;
        text-shadow: 0 0 4px ${glow};
        transition: all 0.2s ease;
      `
        : `
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 3px;
        height: 12px;
        background-color: ${color};
        border-radius: 2px;
        box-shadow: 0 0 4px ${glow};
        transition: all 0.2s ease;
      `;
      if (glyph) marker.textContent = glyph;

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

      // O hover deixa de trocar de cor (`#ff6b6b` → `#ff5252`) e passa a
      // clarear a cor escolhida: com cor livre não existe um segundo tom fixo
      // que sirva para qualquer hex.
      markerWrapper.addEventListener("mouseenter", () => {
        tooltip.style.opacity = "1";
        tooltip.style.visibility = "visible";
        marker.style.filter = "brightness(1.2)";
        if (glyph) {
          // O `translate` continua na regra porque é ele que centraliza o
          // marcador; sozinho, o `scale` jogaria o glifo para fora do lugar.
          marker.style.transform = "translate(-50%, -50%) scale(1.25)";
          marker.style.textShadow = `0 0 8px ${glowHover}`;
        } else {
          marker.style.height = "16px";
          marker.style.width = "4px";
          marker.style.boxShadow = `0 0 8px ${glowHover}`;
        }
      });

      markerWrapper.addEventListener("mouseleave", () => {
        tooltip.style.opacity = "0";
        tooltip.style.visibility = "hidden";
        marker.style.filter = "";
        if (glyph) {
          marker.style.transform = "translate(-50%, -50%)";
          marker.style.textShadow = `0 0 4px ${glow}`;
        } else {
          marker.style.height = "12px";
          marker.style.width = "3px";
          marker.style.boxShadow = `0 0 4px ${glow}`;
        }
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
      const noteElement = item.querySelector(".ytts-note");

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
    // Retentativa pendente cancelada junto: deixada viva, ela remontaria os
    // marcadores depois da navegação já ter saído da página de vídeo.
    if (this._retryId !== null) {
      clearTimeout(this._retryId);
      this._retryId = null;
    }

    if (this.markersContainer) {
      this.markersContainer.remove();
      this.markersContainer = null;
    }
    this._lastKey = null;
  },
};
