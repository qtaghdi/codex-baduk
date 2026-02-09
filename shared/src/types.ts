export type Stone = 'E' | 'B' | 'W';
export type Player = 'B' | 'W';
export type Phase = 'lobby' | 'playing' | 'scoring' | 'finished';

export interface MoveRecord {
  player: Player;
  index: number | null; // null = pass
  timestamp: number;
}

export interface GameState {
  size: number;
  komi: number;
  board: Stone[];
  nextPlayer: Player;
  captures: Record<Player, number>;
  ko: number | null;
  moveHistory: MoveRecord[];
  historyHashes: string[];
  phase: Phase;
  deadStones: number[]; // indices marked dead
  winner: Player | null;
  score: { B: number; W: number } | null;
}

export interface TimeControl {
  baseTimeSec: number;
}

export interface PlayerInfo {
  id: string;
  name: string;
  color: Player;
}

export interface RoomState {
  id: string;
  hostId: string;
  players: PlayerInfo[];
  game: GameState;
  time: TimeControl;
  remainingTimeSec: Record<Player, number>;
  activePlayer: Player;
  lastTick: number;
  scoringReady: Record<Player, boolean>;
}

export type ClientToServerMessage =
  | { type: 'create_room'; name: string; size: number; time: TimeControl; komi: number }
  | { type: 'join_room'; roomId: string; name: string }
  | { type: 'play_move'; index: number | null }
  | { type: 'enter_scoring' }
  | { type: 'set_dead'; indices: number[] }
  | { type: 'scoring_ready'; ready: boolean }
  | { type: 'resign' }
  | { type: 'chat'; message: string }
  | { type: 'ping'; ts: number };

export type ServerToClientMessage =
  | { type: 'room_joined'; room: RoomState; selfId: string }
  | { type: 'room_updated'; room: RoomState }
  | { type: 'error'; message: string }
  | { type: 'chat'; sender: string; message: string; timestamp: number }
  | { type: 'pong'; ts: number };
