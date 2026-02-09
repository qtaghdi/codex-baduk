import type {
  ClientToServerMessage,
  Player,
  PlayerInfo,
  RoomState,
  ServerToClientMessage,
  TimeControl
} from '../../shared/src/index.ts';
import { createGame, enterScoring, finalizeScore, playMove, setDeadStones } from '../../shared/src/index.ts';
import { otherPlayer } from '../../shared/src/index.ts';

interface Env {}

type SocketMeta = {
  id: string;
  color: Player;
};

export class Room implements DurableObject {
  private state: DurableObjectState;
  private room: RoomState | null = null;
  private sockets = new Map<WebSocket, SocketMeta>();
  private tickTimer: number | null = null;
  private roomCode: string | null = null;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  async fetch(request: Request) {
    if (request.headers.get('upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 400 });
    }
    const url = new URL(request.url);
    this.roomCode = url.searchParams.get('room') ?? this.roomCode;

    const { 0: client, 1: server } = new WebSocketPair();
    this.handleSession(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleSession(socket: WebSocket) {
    socket.accept();
    if (!this.room) {
      this.room = (await this.state.storage.get<RoomState>('room')) ?? null;
    }

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data as string) as ClientToServerMessage;
        this.onMessage(socket, message);
      } catch {
        // ignore bad payloads
      }
    });

    socket.addEventListener('close', () => {
      this.onClose(socket);
    });
  }

  private onMessage(socket: WebSocket, data: ClientToServerMessage) {
    this.tick();

    if (data.type === 'ping') {
      this.send(socket, { type: 'pong', ts: data.ts });
      return;
    }

    if (data.type === 'create_room') {
      if (this.room && this.room.players.length > 0) {
        this.send(socket, { type: 'error', message: '이미 방이 생성되어 있습니다.' });
        return;
      }
      const host: PlayerInfo = { id: crypto.randomUUID(), name: data.name, color: 'B' };
      const game = createGame(data.size, data.komi);
      game.phase = 'lobby';
      this.room = {
        id: this.roomCode ?? 'ROOM',
        hostId: host.id,
        players: [host],
        game,
        time: data.time,
        remainingTimeSec: { B: data.time.baseTimeSec, W: data.time.baseTimeSec },
        activePlayer: 'B',
        lastTick: Date.now(),
        scoringReady: { B: false, W: false }
      };
      this.sockets.set(socket, { id: host.id, color: 'B' });
      this.persist();
      this.send(socket, { type: 'room_joined', room: this.room, selfId: host.id });
      this.ensureTimer();
      return;
    }

    if (data.type === 'join_room') {
      if (!this.room) {
        this.send(socket, { type: 'error', message: '방이 아직 생성되지 않았습니다.' });
        return;
      }
      if (this.room.players.length >= 2) {
        this.send(socket, { type: 'error', message: '방이 가득 찼습니다.' });
        return;
      }
      if (this.room.players.some((p) => p.color === 'W')) {
        this.send(socket, { type: 'error', message: '백 자리가 이미 찼습니다.' });
        return;
      }
      const player: PlayerInfo = { id: crypto.randomUUID(), name: data.name, color: 'W' };
      this.room = this.startIfReady({ ...this.room, players: [...this.room.players, player] });
      this.sockets.set(socket, { id: player.id, color: player.color });
      this.persist();
      this.broadcast({ type: 'room_updated', room: this.room });
      this.send(socket, { type: 'room_joined', room: this.room, selfId: player.id });
      this.ensureTimer();
      return;
    }

    if (!this.room) return;

    if (data.type === 'chat') {
      const meta = this.sockets.get(socket);
      this.broadcast({ type: 'chat', sender: meta?.id ?? 'player', message: data.message, timestamp: Date.now() });
      return;
    }

    if (data.type === 'resign') {
      const meta = this.sockets.get(socket);
      if (!meta) return;
      const winner: Player = otherPlayer(meta.color);
      this.room = { ...this.room, game: { ...this.room.game, phase: 'finished', winner } };
      this.persist();
      this.broadcast({ type: 'room_updated', room: this.room });
      return;
    }

    if (data.type === 'play_move') {
      const meta = this.sockets.get(socket);
      if (!meta) return;
      if (this.room.game.phase !== 'playing') return;
      if (meta.color !== this.room.activePlayer) return;
      const updatedGame = playMove(this.room.game, data.index);
      if (updatedGame === this.room.game) return;
      this.room = {
        ...this.room,
        game: updatedGame,
        activePlayer: updatedGame.nextPlayer,
        lastTick: Date.now(),
        scoringReady: { B: false, W: false }
      };
      this.persist();
      this.broadcast({ type: 'room_updated', room: this.room });
      this.ensureTimer();
      return;
    }

    if (data.type === 'enter_scoring') {
      this.room = {
        ...this.room,
        game: enterScoring(this.room.game),
        scoringReady: { B: false, W: false }
      };
      this.persist();
      this.broadcast({ type: 'room_updated', room: this.room });
      return;
    }

    if (data.type === 'set_dead') {
      this.room = { ...this.room, game: setDeadStones(this.room.game, data.indices) };
      this.persist();
      this.broadcast({ type: 'room_updated', room: this.room });
      return;
    }

    if (data.type === 'scoring_ready') {
      const meta = this.sockets.get(socket);
      if (!meta) return;
      const ready = { ...this.room.scoringReady, [meta.color]: data.ready };
      this.room = { ...this.room, scoringReady: ready };
      if (ready.B && ready.W) {
        this.room = { ...this.room, game: finalizeScore(this.room.game) };
      }
      this.persist();
      this.broadcast({ type: 'room_updated', room: this.room });
    }
  }

  private onClose(socket: WebSocket) {
    const meta = this.sockets.get(socket);
    this.sockets.delete(socket);
    if (meta && this.room) {
      const players = this.room.players.filter((p) => p.id !== meta.id);
      this.room = { ...this.room, players };
      this.persist();
      this.broadcast({ type: 'room_updated', room: this.room });
    }
    if (this.sockets.size === 0) this.stopTimer();
  }

  private startIfReady(room: RoomState) {
    if (room.players.length < 2) return room;
    if (room.game.phase !== 'lobby') return room;
    return { ...room, game: { ...room.game, phase: 'playing' }, lastTick: Date.now() };
  }

  private send(socket: WebSocket, message: ServerToClientMessage) {
    socket.send(JSON.stringify(message));
  }

  private broadcast(message: ServerToClientMessage) {
    for (const socket of this.sockets.keys()) {
      socket.send(JSON.stringify(message));
    }
  }

  private tick() {
    if (!this.room) return;
    if (this.room.game.phase !== 'playing') return;
    const now = Date.now();
    const elapsedSec = Math.floor((now - this.room.lastTick) / 1000);
    if (elapsedSec <= 0) return;
    const active = this.room.activePlayer;
    const remaining = Math.max(0, this.room.remainingTimeSec[active] - elapsedSec);
    this.room = {
      ...this.room,
      remainingTimeSec: { ...this.room.remainingTimeSec, [active]: remaining },
      lastTick: now
    };
    if (remaining <= 0) {
      const winner: Player = otherPlayer(active);
      this.room = { ...this.room, game: { ...this.room.game, phase: 'finished', winner } };
    }
    this.persist();
    this.broadcast({ type: 'room_updated', room: this.room });
    if (!this.tickTimer && this.sockets.size > 0) this.startTimer();
  }

  private startTimer() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), 1000) as unknown as number;
  }

  private stopTimer() {
    if (!this.tickTimer) return;
    clearInterval(this.tickTimer as unknown as number);
    this.tickTimer = null;
  }

  private ensureTimer() {
    if (!this.room) return;
    if (this.room.game.phase !== 'playing') return;
    if (this.sockets.size === 0) return;
    this.startTimer();
  }

  private persist() {
    if (!this.room) return;
    void this.state.storage.put('room', this.room);
  }

}
