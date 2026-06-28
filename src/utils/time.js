/**
 * Formata um tempo em segundos para string legível no formato HH:MM:SS ou MM:SS.
 * @param {number} time - Tempo em segundos.
 * @returns {string} Tempo formatado (ex: "1:23:45" ou "5:09").
 */
export function formatTime(time) {
  const h = Math.floor(time / 3600);
  const m = Math.floor(time / 60) % 60;
  const s = Math.floor(time) % 60;
  return (
    (h ? `${h}:${String(m).padStart(2, "0")}` : m) +
    `:${String(s).padStart(2, "0")}`
  );
}
