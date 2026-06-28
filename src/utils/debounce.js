/**
 * Retorna uma versão debounced da função fornecida.
 * A execução é adiada até que passem `wait` milissegundos sem novas chamadas.
 * Chamadas consecutivas dentro do período reiniciam o timer.
 * @param {Function} func - Função a ser debounced.
 * @param {number} wait - Tempo de espera em milissegundos.
 * @returns {Function} Versão debounced da função original.
 */
export function debounce(func, wait) {
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
