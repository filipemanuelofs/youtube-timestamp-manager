/**
 * Copia texto para a área de transferência.
 * Usa a Clipboard API quando disponível em contexto seguro (HTTPS),
 * com fallback via `execCommand('copy')` para contextos não seguros.
 * @param {string} text - Texto a ser copiado.
 * @returns {Promise<boolean>} `true` se copiado com sucesso, `false` caso contrário.
 */
export async function copyToClipboard(text) {
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

/**
 * Exibe feedback visual no ícone de cópia alterando a cor do SVG para verde brevemente.
 * @param {HTMLElement|null} element - Elemento pai que contém o `<svg>` do ícone.
 */
export function showCopyFeedback(element) {
  const svg = element ? element.querySelector("svg") : null;
  if (svg) {
    svg.style.fill = "#4CAF50";
    setTimeout(() => {
      svg.style.fill = "#e3e3e3";
    }, 500);
  }
}
