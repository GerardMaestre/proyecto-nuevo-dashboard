import { byId, safeText } from '../core/utils.js';

const TYPE_TITLES = {
  success: 'Exito',
  warning: 'Advertencia',
  error: 'Error',
  info: 'Info'
};

export class ToastSystem {
  constructor() {
    this.root = byId('toast-root');
  }

  push({ type = 'info', title, message = '', timeout = 4200 }) {
    if (!this.root) {
      return;
    }

    const resolvedType = TYPE_TITLES[type] ? type : 'info';
    const toast = document.createElement('article');
    toast.className = `toast ${resolvedType}`;

    toast.innerHTML = `
      <h4>${safeText(title || TYPE_TITLES[resolvedType])}</h4>
      <p>${safeText(message)}</p>
    `;

    this.root.appendChild(toast);

    const remove = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(12px)';
      setTimeout(() => {
        toast.remove();
      }, 180);
    };

    setTimeout(remove, timeout);

    toast.addEventListener('click', remove);
  }
}
