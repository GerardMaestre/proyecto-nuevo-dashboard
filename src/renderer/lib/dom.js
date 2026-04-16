/**
 * Returns an element by id.
 * @param {string} id
 * @returns {HTMLElement | null}
 */
export function byId(id) {
  return document.getElementById(id);
}

/**
 * Escapes HTML-sensitive characters.
 * @param {string} text
 * @returns {string}
 */
export function safeText(text) {
  return String(text ?? '').replace(/[<>&"']/g, (char) => {
    const map = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return map[char] || char;
  });
}

/**
 * Debounces a callback function.
 * @template {(...args: any[]) => void} T
 * @param {T} callback
 * @param {number} waitMs
 * @returns {(...args: Parameters<T>) => void}
 */
export function debounce(callback, waitMs = 150) {
  let timeoutId = null;

  return (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      callback(...args);
    }, waitMs);
  };
}
