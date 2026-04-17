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

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    const remove = () => {
      toast.classList.add('is-leaving');
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 220);
    };

    setTimeout(remove, timeout);

    toast.addEventListener('click', remove);
  }
}
