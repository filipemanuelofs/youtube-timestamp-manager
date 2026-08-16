import { elements } from "./state.js";
import { debounce } from "./utils/debounce.js";

// Posição do painel na tela, uma só para todos os vídeos.
const POSITION_KEY = "ytts_pane_position";

const RESIZE_DEBOUNCE = 100;

export const drag = {
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
      left: Math.min(Math.max(left, 0), maxLeft),
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
      viewH: window.innerHeight,
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
    const top =
      anchor.fromBottom < anchor.top
        ? dims.viewH - dims.paneH - anchor.fromBottom
        : anchor.top;

    drag._place(pane, top, anchor.left, dims);
  },

  /**
   * Início do arraste. Ignora cliques nos ícones do cabeçalho, que continuam
   * sendo só clique.
   * @param {PointerEvent} e - Evento de `pointerdown` no cabeçalho.
   */
  _onPointerDown(e) {
    if (e.button !== 0) return;
    // Gesto já em andamento: um segundo dedo encostando no cabeçalho refaria o
    // offset a partir dele e trocaria `_pointerId`, deixando a captura do
    // primeiro sem liberação e o painel saltando entre os dois pontos.
    if (drag._offset) return;
    if (e.target.closest(".ytts-icon-btn, #ytts-select-all")) return;

    const pane = drag._pane;
    if (!pane) return;

    const rect = pane.getBoundingClientRect();
    drag._offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    drag._dims = drag.measure(pane);
    drag._moved = false;

    // Sem isto o arraste vira seleção de texto do cabeçalho.
    e.preventDefault();

    // Captura de ponteiro é otimização, não pré-requisito: o jsdom não a
    // implementa, e os listeners de movimento vão na janela justamente para o
    // arraste funcionar com ou sem ela.
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
      drag._dims,
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
        // Ponteiro já solto pelo browser; não há o que liberar.
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
  },
};
