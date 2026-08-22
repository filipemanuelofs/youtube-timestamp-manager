/**
 * Exibe uma notificação toast animada no canto superior direito da tela.
 * A notificação desliza para dentro e some automaticamente após a duração definida.
 *
 * Em tela cheia o toast é montado dentro do elemento em tela cheia: filho do
 * `body` não é renderizado enquanto outro elemento ocupa a tela.
 *
 * Toast anterior ainda visível é removido antes: todos ocupam a mesma posição
 * fixa, então dois ao mesmo tempo — atalho apertado em sequência — ficariam
 * sobrepostos e ilegíveis.
 * @param {string} message - Mensagem a ser exibida.
 * @param {number} [duration=2000] - Duração em milissegundos antes de desaparecer.
 */
export function showNotification(message, duration = 2000) {
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
