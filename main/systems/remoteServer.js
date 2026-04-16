const { WebSocketServer } = require('ws');

class RemoteServer {
  constructor({ logger, sendToRenderer } = {}) {
    this.logger = logger;
    this.sendToRenderer = sendToRenderer;
    this.server = null;
    this.port = null;
  }

  start(config = {}) {
    const port = Number(config.port) || 18777;

    if (this.server) {
      return {
        running: true,
        port: this.port
      };
    }

    this.server = new WebSocketServer({ port });
    this.port = port;

    this.server.on('connection', (socket, request) => {
      const client = request?.socket?.remoteAddress || 'unknown';
      this.logger?.info(`Remote client connected: ${client}`);
      this.sendToRenderer?.('remote:server:event', {
        type: 'client-connected',
        client,
        timestamp: Date.now()
      });

      socket.send(JSON.stringify({
        type: 'hello',
        message: 'Connected to My Dashboard remote server',
        timestamp: Date.now()
      }));

      socket.on('message', (rawMessage) => {
        const message = rawMessage.toString('utf8');
        this.sendToRenderer?.('remote:server:event', {
          type: 'message',
          client,
          message,
          timestamp: Date.now()
        });
      });

      socket.on('close', () => {
        this.sendToRenderer?.('remote:server:event', {
          type: 'client-disconnected',
          client,
          timestamp: Date.now()
        });
      });
    });

    this.server.on('listening', () => {
      this.sendToRenderer?.('remote:server:event', {
        type: 'started',
        port,
        timestamp: Date.now()
      });
    });

    this.server.on('error', (error) => {
      this.logger?.error('Remote server error', error);
      this.sendToRenderer?.('remote:server:event', {
        type: 'error',
        message: error.message,
        timestamp: Date.now()
      });
    });

    return {
      running: true,
      port
    };
  }

  stop() {
    if (!this.server) {
      return { running: false, port: null };
    }

    this.server.close();
    this.server = null;

    const oldPort = this.port;
    this.port = null;

    this.sendToRenderer?.('remote:server:event', {
      type: 'stopped',
      port: oldPort,
      timestamp: Date.now()
    });

    return {
      running: false,
      port: null
    };
  }

  status() {
    return {
      running: Boolean(this.server),
      port: this.port
    };
  }
}

module.exports = {
  RemoteServer
};
