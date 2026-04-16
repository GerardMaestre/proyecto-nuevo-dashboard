export function formatBytes(bytes = 0, precision = 1) {
  const value = Number(bytes) || 0;

  if (!value) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / (1024 ** index);

  return `${scaled.toFixed(precision)} ${units[index]}`;
}

export function formatPercent(value = 0) {
  const number = Number(value) || 0;
  return `${number.toFixed(1)}%`;
}

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

export function debounce(fn, wait = 200) {
  let timeoutRef;

  return (...args) => {
    clearTimeout(timeoutRef);
    timeoutRef = setTimeout(() => fn(...args), wait);
  };
}

export function byId(id) {
  return document.getElementById(id);
}

export function toIsoMinute(date) {
  const target = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  const hour = String(target.getHours()).padStart(2, '0');
  const minute = String(target.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}`;
}
