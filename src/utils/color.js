// Cor padrão do marcador, repetida aqui em vez de importada de `storage.js`
// para não fazer um utilitário puro depender de um módulo que fala com o
// `localStorage`.
const FALLBACK_HEX = "#ff6b6b";

const HEX_RE = /^#([0-9a-f]{6})$/i;

/**
 * Converte uma cor hexadecimal de 6 dígitos em `rgba(...)` com a opacidade
 * pedida. Serve aos brilhos do marcador (`box-shadow` / `text-shadow`), que
 * precisam da cor escolhida pelo usuário com transparência — algo que
 * `currentColor` não entrega.
 *
 * Hex ausente, curto (`#fff`), com lixo ou de outro formato (`red`,
 * `rgb(...)`) cai na cor padrão em vez de gerar `rgba(NaN, NaN, NaN, …)`, que
 * o navegador descarta calado e deixaria o marcador sem brilho nenhum.
 *
 * @param {string} hex - Cor no formato `#rrggbb`.
 * @param {number} alpha - Opacidade, de 0 a 1.
 * @returns {string} Cor no formato `rgba(r, g, b, alpha)`.
 */
export function hexToRgba(hex, alpha) {
  const match = typeof hex === "string" ? hex.match(HEX_RE) : null;
  const digits = match ? match[1] : FALLBACK_HEX.slice(1);

  const r = parseInt(digits.slice(0, 2), 16);
  const g = parseInt(digits.slice(2, 4), 16);
  const b = parseInt(digits.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
