// Teclas que só existem como modificador: sozinhas não formam atalho, e o campo
// de captura recebe o `keydown` delas antes da tecla final.
const MODIFIER_KEYS = ["Shift", "Control", "Alt", "Meta", "AltGraph"];

/**
 * Atalho de fábrica para criar timestamp.
 * @type {{key: string, ctrl: boolean, alt: boolean, shift: boolean, meta: boolean}}
 */
export const DEFAULT_HOTKEY = {
  key: "S",
  ctrl: false,
  alt: false,
  shift: true,
  meta: false,
};

/**
 * Normaliza a tecla de um evento para o formato guardado no atalho.
 * Letra vira maiúscula (com Shift o browser já entrega "S", sem ele entrega
 * "s"), e o espaço vira "Space" para ter rótulo visível.
 * @param {string} key - Valor de `KeyboardEvent.key`.
 * @returns {string} Tecla normalizada.
 */
function normalizeKey(key) {
  if (key === " ") return "Space";
  return key.length === 1 ? key.toUpperCase() : key;
}

/**
 * Converte um `keydown` em atalho gravável.
 * @param {KeyboardEvent} event - Evento de teclado.
 * @returns {{key: string, ctrl: boolean, alt: boolean, shift: boolean, meta: boolean}|null}
 *   Atalho correspondente, ou `null` se o evento for só de modificador.
 */
export function hotkeyFromEvent(event) {
  if (!event || !event.key || MODIFIER_KEYS.includes(event.key)) return null;
  return {
    key: normalizeKey(event.key),
    ctrl: !!event.ctrlKey,
    alt: !!event.altKey,
    shift: !!event.shiftKey,
    meta: !!event.metaKey,
  };
}

/**
 * Monta o rótulo exibido para um atalho.
 * @param {{key: string, ctrl: boolean, alt: boolean, shift: boolean, meta: boolean}|null} hotkey - Atalho.
 * @returns {string} Rótulo (ex: "Shift+S"), ou `""` se não houver atalho.
 */
export function formatHotkey(hotkey) {
  if (!hotkey || !hotkey.key) return "";
  const parts = [];
  if (hotkey.ctrl) parts.push("Ctrl");
  if (hotkey.alt) parts.push("Alt");
  if (hotkey.shift) parts.push("Shift");
  if (hotkey.meta) parts.push("Meta");
  parts.push(normalizeKey(hotkey.key));
  return parts.join("+");
}

/**
 * Verifica se um evento de teclado corresponde exatamente ao atalho.
 * Modificador a mais não casa: `Ctrl+Shift+S` não dispara `Shift+S`.
 * @param {KeyboardEvent} event - Evento de teclado.
 * @param {{key: string, ctrl: boolean, alt: boolean, shift: boolean, meta: boolean}|null} hotkey - Atalho configurado.
 * @returns {boolean} `true` se o evento corresponde ao atalho.
 */
export function matchesHotkey(event, hotkey) {
  if (!event || !hotkey || !hotkey.key) return false;
  const pressed = hotkeyFromEvent(event);
  if (!pressed) return false;
  return (
    pressed.key === normalizeKey(hotkey.key) &&
    pressed.ctrl === !!hotkey.ctrl &&
    pressed.alt === !!hotkey.alt &&
    pressed.shift === !!hotkey.shift &&
    pressed.meta === !!hotkey.meta
  );
}
