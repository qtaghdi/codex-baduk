import type { GameState, Player, Stone } from './types';
import { boardHash, createEmptyBoard, neighbors, otherPlayer } from './utils';

const getGroup = (board: Stone[], start: number, size: number) => {
  const color = board[start];
  const stack = [start];
  const group = new Set<number>();
  const liberties = new Set<number>();
  while (stack.length > 0) {
    const idx = stack.pop() as number;
    if (group.has(idx)) continue;
    group.add(idx);
    for (const n of neighbors(idx, size)) {
      const stone = board[n];
      if (stone === 'E') liberties.add(n);
      else if (stone === color && !group.has(n)) stack.push(n);
    }
  }
  return { group, liberties };
};

export const createGame = (size = 19, komi = 6.5): GameState => {
  const board = createEmptyBoard(size);
  const hash = boardHash(board);
  return {
    size,
    komi,
    board,
    nextPlayer: 'B',
    captures: { B: 0, W: 0 },
    ko: null,
    moveHistory: [],
    historyHashes: [hash],
    phase: 'lobby',
    deadStones: [],
    winner: null,
    score: null
  };
};

export const isLegalMove = (state: GameState, index: number): { legal: boolean; reason?: string } => {
  if (state.board[index] !== 'E') return { legal: false, reason: 'occupied' };
  if (state.ko === index) return { legal: false, reason: 'ko' };

  const board = state.board.slice();
  const player = state.nextPlayer;
  board[index] = player;

  const opponent = otherPlayer(player);
  let captured = 0;
  for (const n of neighbors(index, state.size)) {
    if (board[n] !== opponent) continue;
    const { liberties, group } = getGroup(board, n, state.size);
    if (liberties.size === 0) {
      for (const g of group) board[g] = 'E';
      captured += group.size;
    }
  }

  const { liberties: ownLiberties } = getGroup(board, index, state.size);
  if (ownLiberties.size === 0 && captured === 0) return { legal: false, reason: 'suicide' };

  const hash = boardHash(board);
  if (state.historyHashes.includes(hash)) return { legal: false, reason: 'superko' };

  return { legal: true };
};

export const playMove = (state: GameState, index: number | null): GameState => {
  if (state.phase !== 'playing') return state;
  const player = state.nextPlayer;
  if (index === null) {
    const next: GameState = {
      ...state,
      nextPlayer: otherPlayer(player),
      moveHistory: [...state.moveHistory, { player, index: null, timestamp: Date.now() }]
    };
    return next;
  }

  const check = isLegalMove(state, index);
  if (!check.legal) return state;

  const board = state.board.slice();
  board[index] = player;
  const opponent = otherPlayer(player);
  let capturedIndices: number[] = [];
  for (const n of neighbors(index, state.size)) {
    if (board[n] !== opponent) continue;
    const { liberties, group } = getGroup(board, n, state.size);
    if (liberties.size === 0) {
      for (const g of group) board[g] = 'E';
      capturedIndices = capturedIndices.concat(Array.from(group));
    }
  }

  const { liberties: ownLiberties } = getGroup(board, index, state.size);
  if (ownLiberties.size === 0 && capturedIndices.length === 0) return state;

  let ko: number | null = null;
  if (capturedIndices.length === 1) {
    const capturedIndex = capturedIndices[0];
    if (neighbors(index, state.size).includes(capturedIndex)) ko = capturedIndex;
  }

  const hash = boardHash(board);

  const next: GameState = {
    ...state,
    board,
    nextPlayer: otherPlayer(player),
    captures: {
      ...state.captures,
      [player]: state.captures[player] + capturedIndices.length
    },
    ko,
    moveHistory: [...state.moveHistory, { player, index, timestamp: Date.now() }],
    historyHashes: [...state.historyHashes, hash]
  };

  return next;
};

export const enterScoring = (state: GameState): GameState => {
  if (state.phase !== 'playing') return state;
  return { ...state, phase: 'scoring', deadStones: [] };
};

export const setDeadStones = (state: GameState, indices: number[]): GameState => {
  if (state.phase !== 'scoring') return state;
  return { ...state, deadStones: indices };
};

export const computeScore = (state: GameState): { B: number; W: number; winner: Player } => {
  const size = state.size;
  const board = state.board.slice();
  const deadSet = new Set(state.deadStones);

  for (const idx of deadSet) {
    const stone = board[idx];
    if (stone === 'B' || stone === 'W') board[idx] = 'E';
  }

  let blackStones = 0;
  let whiteStones = 0;
  for (const s of board) {
    if (s === 'B') blackStones++;
    if (s === 'W') whiteStones++;
  }

  const visited = new Set<number>();
  let blackTerritory = 0;
  let whiteTerritory = 0;

  for (let i = 0; i < board.length; i++) {
    if (board[i] !== 'E' || visited.has(i)) continue;
    const stack = [i];
    const region: number[] = [];
    const bordering = new Set<Player>();
    while (stack.length > 0) {
      const idx = stack.pop() as number;
      if (visited.has(idx)) continue;
      visited.add(idx);
      region.push(idx);
      for (const n of neighbors(idx, size)) {
        const stone = board[n];
        if (stone === 'E' && !visited.has(n)) stack.push(n);
        if (stone === 'B' || stone === 'W') bordering.add(stone);
      }
    }
    if (bordering.size === 1) {
      const owner = Array.from(bordering)[0];
      if (owner === 'B') blackTerritory += region.length;
      if (owner === 'W') whiteTerritory += region.length;
    }
  }

  const blackScore = blackStones + blackTerritory;
  const whiteScore = whiteStones + whiteTerritory + state.komi;

  const winner = blackScore > whiteScore ? 'B' : 'W';
  return { B: blackScore, W: whiteScore, winner };
};

export const finalizeScore = (state: GameState): GameState => {
  if (state.phase !== 'scoring') return state;
  const { B, W, winner } = computeScore(state);
  return { ...state, phase: 'finished', winner, score: { B, W } };
};
