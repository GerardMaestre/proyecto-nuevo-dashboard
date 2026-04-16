import { byId, safeText } from '../core/utils.js';

export class AutopilotSystem {
  constructor({ bridge, toast } = {}) {
    this.bridge = bridge;
    this.toast = toast;
    this.scripts = [];

    this.form = byId('autopilot-form');
    this.taskNameInput = byId('task-name');
    this.taskScriptSelect = byId('task-script');
    this.taskScheduleType = byId('task-schedule-type');
    this.taskRunAt = byId('task-run-at');
    this.taskElevated = byId('task-elevated');
    this.taskList = byId('autopilot-task-list');

    this.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleSubmit().catch((error) => {
        this.toast?.push({
          type: 'error',
          title: 'Autopilot',
          message: error.message
        });
      });
    });
  }

  async initialize() {
    await this.refreshTasks();
  }

  setScripts(scripts = []) {
    this.scripts = scripts;

    if (!this.taskScriptSelect) {
      return;
    }

    this.taskScriptSelect.innerHTML = '';

    for (const script of scripts) {
      const option = document.createElement('option');
      option.value = script.id;
      option.textContent = script.directory
        ? `${script.name} (${script.category} · ${script.directory})`
        : `${script.name} (${script.category})`;
      this.taskScriptSelect.appendChild(option);
    }
  }

  normalizeRunAt(scheduleType, inputValue) {
    const value = String(inputValue || '').trim();

    if (scheduleType === 'startup') {
      return null;
    }

    if (scheduleType === 'daily') {
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) {
        throw new Error('Para tareas diarias usa formato HH:mm');
      }
      return value;
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error('Para tareas de una sola vez usa formato YYYY-MM-DDTHH:mm');
    }

    return parsedDate.toISOString();
  }

  async handleSubmit() {
    const taskName = this.taskNameInput?.value?.trim();
    const scriptId = this.taskScriptSelect?.value;
    const scheduleType = this.taskScheduleType?.value || 'once';
    const runAt = this.normalizeRunAt(scheduleType, this.taskRunAt?.value);
    const elevated = Boolean(this.taskElevated?.checked);

    if (!taskName) {
      throw new Error('Debes indicar un nombre para la tarea');
    }

    if (!scriptId) {
      throw new Error('Debes seleccionar un script');
    }

    const selectedScript = this.scripts.find((script) => script.id === scriptId);

    await this.bridge.invoke('autopilot:add-task', {
      name: taskName,
      scriptId,
      scriptName: selectedScript?.name || scriptId,
      args: [],
      elevated,
      scheduleType,
      runAt
    });

    this.toast?.push({
      type: 'success',
      title: 'Autopilot',
      message: 'Tarea agregada correctamente'
    });

    this.form?.reset();
    await this.refreshTasks();
  }

  async refreshTasks() {
    const tasks = await this.bridge.invoke('autopilot:list-tasks');
    this.renderTasks(tasks || []);
    return tasks || [];
  }

  renderTasks(tasks) {
    if (!this.taskList) {
      return;
    }

    this.taskList.innerHTML = '';

    if (!tasks.length) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="6">No hay tareas en cola</td>';
      this.taskList.appendChild(row);
      return;
    }

    tasks.forEach((task) => {
      const row = document.createElement('tr');
      const displayedScript = task.scriptId || task.scriptName;
      row.innerHTML = `
        <td>${safeText(task.name)}</td>
        <td>${safeText(displayedScript)}</td>
        <td>${safeText(task.scheduleType)}</td>
        <td>${safeText(task.runAt || 'startup')}</td>
        <td>${task.elevated ? 'Si' : 'No'}</td>
        <td><button data-remove-id="${safeText(task.id)}" class="chrome-btn">Eliminar</button></td>
      `;

      const removeButton = row.querySelector('button[data-remove-id]');
      removeButton?.addEventListener('click', async () => {
        const id = removeButton.getAttribute('data-remove-id');
        await this.bridge.invoke('autopilot:remove-task', { id });
        await this.refreshTasks();
      });

      this.taskList.appendChild(row);
    });
  }

  consumeEvent(event = {}) {
    if (!event?.type) {
      return;
    }

    if (event.type === 'task-error') {
      this.toast?.push({
        type: 'error',
        title: 'Autopilot',
        message: event.message || 'Error de tarea'
      });
    }

    if (event.type === 'task-started') {
      this.toast?.push({
        type: 'info',
        title: 'Autopilot',
        message: `Ejecutando: ${event.task?.name || event.task?.scriptName || 'tarea'}`
      });
    }

    if (event.type === 'task-added' || event.type === 'task-removed') {
      this.refreshTasks().catch(() => {});
    }
  }
}
