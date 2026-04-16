const { v4: uuidv4 } = require('uuid');

class TaskQueue {
  constructor() {
    this.tasks = new Map();
  }

  add(task = {}) {
    const id = task.id || uuidv4();
    const resolvedScriptId = task.scriptId || task.scriptName || null;
    const resolvedScriptName = task.scriptName || task.scriptId || null;

    const normalized = {
      id,
      name: task.name || resolvedScriptName || 'Unnamed Task',
      scriptId: resolvedScriptId,
      scriptName: resolvedScriptName,
      args: Array.isArray(task.args) ? task.args : [],
      elevated: Boolean(task.elevated),
      scheduleType: task.scheduleType || 'once',
      runAt: task.runAt || null,
      enabled: task.enabled !== false,
      createdAt: task.createdAt || Date.now(),
      lastRunAt: task.lastRunAt || null,
      startupExecuted: Boolean(task.startupExecuted)
    };

    this.tasks.set(id, normalized);
    return normalized;
  }

  remove(id) {
    if (!id) {
      return false;
    }

    return this.tasks.delete(id);
  }

  update(id, partial = {}) {
    const existing = this.tasks.get(id);

    if (!existing) {
      return null;
    }

    const updated = {
      ...existing,
      ...partial,
      id: existing.id
    };

    this.tasks.set(id, updated);
    return updated;
  }

  get(id) {
    return this.tasks.get(id) || null;
  }

  list() {
    return [...this.tasks.values()].sort((a, b) => a.createdAt - b.createdAt);
  }
}

module.exports = {
  TaskQueue
};
