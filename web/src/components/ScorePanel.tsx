import React from 'react';
import type { GameState } from '@go/shared';
import { computeScore } from '@go/shared';

const ScorePanel: React.FC<{ game: GameState }> = ({ game }) => {
  const score = computeScore(game);
  return (
    <div className="panel">
      <h3>계가</h3>
      <p className="muted">죽은 돌을 클릭으로 표시 후 양측 동의.</p>
      <div className="score-line">
        <span>흑 {score.B.toFixed(1)}</span>
        <span>백 {score.W.toFixed(1)}</span>
      </div>
    </div>
  );
};

export default ScorePanel;
