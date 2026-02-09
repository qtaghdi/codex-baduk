import type { Player, Stone } from './types';

export const otherPlayer = (p: Player): Player => (p === 'B' ? 'W' : 'B');

export const indexToCoord = (index: number, size: number) => {
  const x = index % size;
  const y = Math.floor(index / size);
  return { x, y };
};

export const coordToIndex = (x: number, y: number, size: number) => y * size + x;

export const neighbors = (index: number, size: number) => {
  const { x, y } = indexToCoord(index, size);
  const result: number[] = [];
  if (x > 0) result.push(coordToIndex(x - 1, y, size));
  if (x < size - 1) result.push(coordToIndex(x + 1, y, size));
  if (y > 0) result.push(coordToIndex(x, y - 1, size));
  if (y < size - 1) result.push(coordToIndex(x, y + 1, size));
  return result;
};

export const boardHash = (board: Stone[]) => board.join('');

export const createEmptyBoard = (size: number): Stone[] =>
  Array.from({ length: size * size }, () => 'E');
