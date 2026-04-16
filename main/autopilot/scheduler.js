const { EventEmitter } = require('events');

function toMinuteStamp(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
}

function parseHourMinute(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const [rawHour, rawMinute] = value.split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

class Scheduler extends EventEmitter {
  constructor({ queue, processManager, logger, onTaskEvent, intervalMs = 1000 } = {}) {
    super();
    this.queue = queue;
    this.processManager = processManager;
    this.logger = logger;
    this.intervalMs = intervalMs;
    this.intervalRef = null;
    this.lastRunMinuteByTask = new Map();

    if (typeof onTaskEvent === 'function') {
      this.on('autopilot:event', onTaskEvent);
    }
  }

  start() {
    if (this.intervalRef) {
      return { running: true, intervalMs: this.intervalMs };
    }

    this.runStartupTasks().catch((error) => {
      this.logger?.error('Failed to run startup tasks', error);
    });

    this.intervalRef = setInterval(() => {
      this.tick().catch((error) => {
        this.logger?.error('Scheduler tick failed', error);
      });
    }, this.intervalMs);

    return { running: true, intervalMs: this.intervalMs };
  }

  stop() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }

    return { running: false };
  }

  listTasks() {
    return this.queue.list();
  }

  addTask(task) {
    if (!task || (!task.scriptId && !task.scriptName)) {
      throw new Error('Task must include scriptId or scriptName');
    }

    const normalized = this.queue.add(task);
    this.emit('autopilot:event', {
      type: 'task-added',
      task: normalized,
      timestamp: Date.now()
    });

    return normalized;
  }

  removeTask(id) {
    const removed = this.queue.remove(id);

    this.emit('autopilot:event', {
      type: 'task-removed',
      id,
      removed,
      timestamp: Date.now()
    });

    return { id, removed };
  }

  async runStartupTasks() {
    const tasks = this.queue.list().filter((task) => task.enabled && task.scheduleType === 'startup' && !task.startupExecuted);

    for (const task of tasks) {
      await this.executeTask(task);
      this.queue.update(task.id, {
        startupExecuted: true,
        lastRunAt: Date.now()
      });
    }
  }

  async tick() {
    const now = new Date();
    const tasks = this.queue.list().filter((task) => task.enabled);

    for (const task of tasks) {
      if (!this.isTaskDue(task, now)) {
        continue;
      }

      const minuteStamp = toMinuteStamp(now);

      if (this.lastRunMinuteByTask.get(task.id) === minuteStamp) {
        continue;
      }

      this.lastRunMinuteByTask.set(task.id, minuteStamp);

      await this.executeTask(task);

      this.queue.update(task.id, {
        lastRunAt: Date.now()
      });

      if (task.scheduleType === 'once') {
        this.queue.remove(task.id);
      }
    }
  }

  isTaskDue(task, now) {
    if (task.scheduleType === 'daily') {
      const parsed = parseHourMinute(task.runAt);
      if (!parsed) {
        return false;
      }

      return now.getHours() === parsed.hour && now.getMinutes() === parsed.minute;
    }

    if (task.scheduleType === 'once') {
      if (!task.runAt) {
        return false;
      }

      const runAtDate = new Date(task.runAt);
      if (Number.isNaN(runAtDate.getTime())) {
        return false;
      }

      return now.getTime() >= runAtDate.getTime();
    }

    return false;
  }

  async executeTask(task) {
    this.emit('autopilot:event', {
      type: 'task-started',
      task,
      timestamp: Date.now()
    });

    try {
      const result = await this.processManager.runScript({
        scriptId: task.scriptId,
        scriptName: task.scriptName,
        args: task.args,
        elevated: task.elevated
      });

      this.emit('autopilot:event', {
        type: 'task-dispatched',
        task,
        process: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      this.emit('autopilot:event', {
        type: 'task-error',
        task,
        message: error.message,
        timestamp: Date.now()
      });
      throw error;
    }
  }
}

module.exports = {
  Scheduler
};
