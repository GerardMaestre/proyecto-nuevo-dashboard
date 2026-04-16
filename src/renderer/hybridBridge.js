const api = window.api;

function assertApi() {
  if (!api) {
    throw new Error('window.api is not available. Check preload configuration.');
  }
}

export const bridge = {
  send(channel, payload) {
    assertApi();
    api.send(channel, payload);
  },
  invoke(channel, payload) {
    assertApi();
    return api.invoke(channel, payload);
  },
  on(channel, handler) {
    assertApi();
    api.receive(channel, handler);
  },
  off(channel, handler) {
    assertApi();
    api.removeListener(channel, handler);
  }
};
