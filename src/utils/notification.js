/**
 * Exibe uma notificação toast animada no canto superior direito da tela.
 * A notificação desliza para dentro e some automaticamente após a duração definida.
 * @param {string} message - Mensagem a ser exibida.
 * @param {number} [duration=2000] - Duração em milissegundos antes de desaparecer.
 */
export function showNotification(message, duration = 2000) {
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
}
