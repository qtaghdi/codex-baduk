import React from 'react';

interface BoardProps {
  size: number;
  board: ('E' | 'B' | 'W')[];
  disabled?: boolean;
  scoringMode?: boolean;
  deadStones?: number[];
  lastMoveIndex?: number | null;
  onPlay?: (index: number) => void;
  onToggleDead?: (index: number) => void;
}

const starPoints = (size: number) => {
  if (size === 19) return [3, 9, 15];
  if (size === 13) return [3, 6, 9];
  if (size === 9) return [2, 4, 6];
  return [];
};

const Board: React.FC<BoardProps> = ({
  size,
  board,
  disabled,
  scoringMode,
  deadStones = [],
  lastMoveIndex,
  onPlay,
  onToggleDead
}) => {
  const stars = starPoints(size);
  const deadSet = new Set(deadStones);

  return (
    <div className="board-wrap">
      <div className="board-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {Array.from({ length: size * size }).map((_, index) => {
          const stone = board[index];
          const col = index % size;
          const row = Math.floor(index / size);
          const isStar = stars.length > 0 && stars.includes(col) && stars.includes(row);
          const isLast = lastMoveIndex === index;
          const isDead = deadSet.has(index);

          return (
            <button
              key={index}
              className={`board-cell ${stone !== 'E' ? 'has-stone' : ''} ${isLast ? 'last-move' : ''} ${isDead ? 'dead' : ''}`}
              disabled={disabled}
              onClick={() => {
                if (scoringMode) onToggleDead?.(index);
                else onPlay?.(index);
              }}
            >
              <span className="line-h" />
              <span className="line-v" />
              {isStar ? <span className="star" /> : null}
              {stone !== 'E' ? <span className={`stone ${stone === 'B' ? 'black' : 'white'}`} /> : null}
              {isDead && stone !== 'E' ? <span className="dead-mark">×</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Board;
