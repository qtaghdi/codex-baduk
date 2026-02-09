import type { ClientToServerMessage, ServerToClientMessage } from '@go/shared';

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

type Handlers = {
  onMessage: (message: ServerToClientMessage) => void;
  onState: (state: ConnectionState) => void;
};

export class WsClient {
  private socket: WebSocket | null = null;
  private state: ConnectionState = 'idle';
  private queue: ClientToServerMessage[] = [];
  private handlers: Handlers;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
  }

  connect(url: string) {
    if (this.socket) this.socket.close();
    this.setState('connecting');
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      this.setState('open');
      this.flush();
    };

    socket.onclose = () => {
      this.setState('closed');
      this.socket = null;
    };

    socket.onerror = () => {
      this.setState('error');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ServerToClientMessage;
        if (!data || typeof data !== 'object' || !('type' in data)) return;
        this.handlers.onMessage(data);
      } catch {
        // ignore malformed messages
      }
    };
  }

  send(message: ClientToServerMessage) {
    if (this.state !== 'open' || !this.socket) {
      this.queue.push(message);
      return;
    }
    this.socket.send(JSON.stringify(message));
  }

  close() {
    this.socket?.close();
    this.socket = null;
  }

  private flush() {
    if (!this.socket || this.state !== 'open') return;
    const pending = [...this.queue];
    this.queue = [];
    for (const msg of pending) this.socket.send(JSON.stringify(msg));
  }

  private setState(next: ConnectionState) {
    this.state = next;
    this.handlers.onState(next);
  }
}
