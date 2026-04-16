const fs = require('fs');
const path = require('path');

const LOG_DIRECTORY = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIRECTORY, 'dashboard.log');

function ensureLogDirectory() {
  if (!fs.existsSync(LOG_DIRECTORY)) {
    fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
  }
}

function normalizeMessage(message, data) {
  if (!data) {
    return String(message);
  }

  if (data instanceof Error) {
    return `${message} | ${data.message}\n${data.stack || ''}`;
  }

  if (typeof data === 'object') {
    return `${message} | ${JSON.stringify(data)}`;
  }

  return `${message} | ${String(data)}`;
}

function writeLogLine(line) {
  try {
    ensureLogDirectory();
    fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
  } catch (_error) {
    // Intentionally avoid recursive logging from logger internals.
  }
}

function createLogger(scope = 'app') {
  const makeLine = (level, message, data) => {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${scope}] ${normalizeMessage(message, data)}`;
  };

  return {
    debug(message, data) {
      const line = makeLine('debug', message, data);
      console.debug(line);
      writeLogLine(line);
    },
    info(message, data) {
      const line = makeLine('info', message, data);
      console.info(line);
      writeLogLine(line);
    },
    warn(message, data) {
      const line = makeLine('warn', message, data);
      console.warn(line);
      writeLogLine(line);
    },
    error(message, data) {
      const line = makeLine('error', message, data);
      console.error(line);
      writeLogLine(line);
    }
  };
}

module.exports = {
  createLogger
};
