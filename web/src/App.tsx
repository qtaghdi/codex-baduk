import React, { useEffect, useMemo, useRef, useState } from 'react';
import Board from './components/Board';
import ChatBox from './components/ChatBox';
import ScorePanel from './components/ScorePanel';
import {
  ClientToServerMessage,
  GameState,
  Player,
  RoomState,
  TimeControl
} from '@go/shared';
import {
  computeScore,
  createGame,
  enterScoring,
  finalizeScore,
  isLegalMove,
  playMove,
  setDeadStones
} from '@go/shared';
import { otherPlayer } from '@go/shared';
import { formatTime } from './lib/time';
import { useRoom } from './hooks/useRoom';

const defaultTime: TimeControl = { baseTimeSec: 20 * 60 };

const randomLegalMove = (state: GameState) => {
  const legal: number[] = [];
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i] !== 'E') continue;
    if (isLegalMove(state, i).legal) legal.push(i);
  }
  if (legal.length === 0) return null;
  return legal[Math.floor(Math.random() * legal.length)];
};

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'room' | 'solo'>('home');
  const [name, setName] = useState('');
  const [serverUrl, setServerUrl] = useState(
    import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8787'
  );
  const [roomId, setRoomId] = useState('');
  const [boardSize, setBoardSize] = useState(19);
  const [komi, setKomi] = useState(6.5);
  const [time, setTime] = useState(defaultTime.baseTimeSec);

  const { room, selfId, connection, chat, connect, disconnect, send } = useRoom();

  const [soloGame, setSoloGame] = useState<GameState | null>(null);
  const [soloRemaining, setSoloRemaining] = useState<Record<Player, number>>({ B: time, W: time });
  const [soloActive, setSoloActive] = useState<Player>('B');
  const soloTimerRef = useRef<number | null>(null);

  const selfColor = useMemo(() => {
    if (!room || !selfId) return null;
    return room.players.find((p) => p.id === selfId)?.color ?? null;
  }, [room, selfId]);

  useEffect(() => {
    if (view !== 'solo' || !soloGame || soloGame.phase !== 'playing') return;
    if (soloTimerRef.current) return;
    soloTimerRef.current = window.setInterval(() => {
      setSoloRemaining((prev) => {
        const next = { ...prev };
        next[soloActive] = Math.max(0, next[soloActive] - 1);
        return next;
      });
    }, 1000);
    return () => {
      if (soloTimerRef.current) window.clearInterval(soloTimerRef.current);
      soloTimerRef.current = null;
    };
  }, [view, soloGame, soloActive]);

  useEffect(() => {
    if (!soloGame) return;
    if (soloRemaining[soloActive] > 0) return;
    setSoloGame({ ...soloGame, phase: 'finished', winner: otherPlayer(soloActive) });
  }, [soloRemaining, soloActive, soloGame]);

  useEffect(() => {
    if (view !== 'solo' || !soloGame) return;
    if (soloGame.phase !== 'playing') return;
    if (soloActive !== 'W') return;
    const timeout = window.setTimeout(() => {
      const move = randomLegalMove(soloGame);
      const nextGame = playMove(soloGame, move);
      if (nextGame !== soloGame) {
        setSoloGame(nextGame);
        setSoloActive(nextGame.nextPlayer);
      }
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [view, soloGame, soloActive]);

  const startSolo = () => {
    const game = createGame(boardSize, komi);
    game.phase = 'playing';
    setSoloGame(game);
    setSoloRemaining({ B: time, W: time });
    setSoloActive('B');
    setView('solo');
  };

  const applySoloMove = (index: number | null) => {
    if (!soloGame || soloGame.phase !== 'playing') return;
    if (soloActive !== 'B') return;
    const next = playMove(soloGame, index);
    if (next !== soloGame) {
      setSoloGame(next);
      setSoloActive(next.nextPlayer);
    }
  };

  const toggleSoloDead = (index: number) => {
    if (!soloGame) return;
    const dead = new Set(soloGame.deadStones);
    if (dead.has(index)) dead.delete(index);
    else dead.add(index);
    setSoloGame(setDeadStones(soloGame, Array.from(dead)));
  };

  const soloScore = soloGame?.phase === 'scoring' ? computeScore(soloGame) : null;

  const sendRoom = (message: ClientToServerMessage) => send(message);

  const normalizeUrl = (input: string) => {
    if (/^https?:\/\//i.test(input) || /^wss?:\/\//i.test(input)) return input;
    return `http://${input}`;
  };

  const toHttpBase = (input: string) => {
    const url = new URL(normalizeUrl(input));
    if (url.protocol === 'ws:') url.protocol = 'http:';
    if (url.protocol === 'wss:') url.protocol = 'https:';
    return url.origin;
  };

  const toWsUrl = (input: string, roomCode: string) => {
    const url = new URL(normalizeUrl(input));
    if (url.protocol === 'http:') url.protocol = 'ws:';
    if (url.protocol === 'https:') url.protocol = 'wss:';
    url.pathname = '/ws';
    url.searchParams.set('room', roomCode);
    return url.toString();
  };

  const handleCreateRoom = async () => {
    try {
      const httpBase = toHttpBase(serverUrl);
      const response = await fetch(`${httpBase}/rooms`, { method: 'POST' });
      const data = (await response.json()) as { roomId?: string };
      if (!data.roomId) throw new Error('room id failed');
      const wsUrl = toWsUrl(httpBase, data.roomId);
      connect(wsUrl);
      sendRoom({ type: 'create_room', name: name || '플레이어', size: boardSize, time: { baseTimeSec: time }, komi });
      setView('room');
    } catch {
      alert('방 생성에 실패했습니다. 서버 주소를 확인하세요.');
    }
  };

  const handleJoinRoom = () => {
    if (!roomId) return;
    const httpBase = toHttpBase(serverUrl);
    const wsUrl = toWsUrl(httpBase, roomId);
    connect(wsUrl);
    sendRoom({ type: 'join_room', roomId, name: name || '플레이어' });
    setView('room');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Gosan</span>
          <span className="brand-sub">Web Go Studio</span>
        </div>
        <div className="top-actions">
          {view !== 'home' ? (
            <button className="ghost" onClick={() => setView('home')}>
              홈으로
            </button>
          ) : null}
        </div>
      </header>

      {view === 'home' && (
        <main className="home">
          <section className="panel">
            <h2>온라인 대국</h2>
            <label>
              닉네임
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="플레이어" />
            </label>
            <label>
              서버 URL
              <input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
            </label>
            <div className="grid-2">
              <label>
                바둑판
                <select value={boardSize} onChange={(e) => setBoardSize(Number(e.target.value))}>
                  <option value={19}>19x19</option>
                  <option value={13}>13x13</option>
                  <option value={9}>9x9</option>
                </select>
              </label>
              <label>
                덤
                <input type="number" step="0.5" value={komi} onChange={(e) => setKomi(Number(e.target.value))} />
              </label>
            </div>
            <label>
              기본 시간 (분)
              <input
                type="number"
                value={Math.floor(time / 60)}
                onChange={(e) => setTime(Number(e.target.value) * 60)}
              />
            </label>
            <div className="grid-2">
              <button onClick={handleCreateRoom} disabled={connection === 'connecting'}>
                방 만들기
              </button>
              <div className="join-row">
                <input
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="방 코드"
                />
                <button className="ghost" onClick={handleJoinRoom} disabled={connection === 'connecting' || !roomId}>
                  입장
                </button>
              </div>
            </div>
          </section>

          <section className="panel">
            <h2>로컬 대국</h2>
            <p className="muted">오프라인에서 간단한 AI(랜덤 합법 착수)와 대국합니다.</p>
            <button onClick={startSolo}>AI와 대국 시작</button>
          </section>
        </main>
      )}

      {view === 'room' && room && (
        <main className="room">
          <section className="side">
            <div className="panel">
              <h3>방 정보</h3>
              <div className="room-code">CODE {room.id}</div>
              <div className="players">
                {room.players.map((p) => (
                  <div key={p.id} className={`player ${p.color === 'B' ? 'black' : 'white'}`}>
                    <span>{p.name}</span>
                    <span>{p.color === 'B' ? '흑' : '백'}</span>
                  </div>
                ))}
              </div>
              <div className="muted">연결 상태: {connection}</div>
            </div>
            <div className="panel">
              <h3>시간</h3>
              <div className="timer-row">
                <span>흑</span>
                <strong>{formatTime(room.remainingTimeSec.B)}</strong>
              </div>
              <div className="timer-row">
                <span>백</span>
                <strong>{formatTime(room.remainingTimeSec.W)}</strong>
              </div>
            </div>
            <div className="panel">
              <h3>대국 조작</h3>
              <div className="grid-2">
                <button onClick={() => sendRoom({ type: 'play_move', index: null })}>패스</button>
                <button className="ghost" onClick={() => sendRoom({ type: 'resign' })}>
                  기권
                </button>
              </div>
              <button className="ghost" onClick={() => sendRoom({ type: 'enter_scoring' })}>
                계가 시작
              </button>
              {room.game.phase === 'scoring' && (
                <button
                  onClick={() =>
                    sendRoom({ type: 'scoring_ready', ready: !room.scoringReady[selfColor ?? 'B'] })
                  }
                >
                  {room.scoringReady[selfColor ?? 'B'] ? '동의 취소' : '계가 동의'}
                </button>
              )}
              <button className="ghost" onClick={disconnect}>
                연결 해제
              </button>
            </div>
          </section>

          <section className="board">
            <Board
              size={room.game.size}
              board={room.game.board}
              scoringMode={room.game.phase === 'scoring'}
              deadStones={room.game.deadStones}
              lastMoveIndex={room.game.moveHistory.at(-1)?.index ?? null}
              disabled={
                room.game.phase === 'finished' ||
                (room.game.phase === 'playing' && (selfColor !== room.activePlayer || room.players.length < 2))
              }
              onPlay={(index) => sendRoom({ type: 'play_move', index })}
              onToggleDead={(index) => {
                const dead = new Set(room.game.deadStones);
                if (dead.has(index)) dead.delete(index);
                else dead.add(index);
                sendRoom({ type: 'set_dead', indices: Array.from(dead) });
              }}
            />

            <div className="status-bar">
              <div>
                현재 차례: <strong>{room.activePlayer === 'B' ? '흑' : '백'}</strong>
              </div>
              <div>
                캡처: 흑 {room.game.captures.B} / 백 {room.game.captures.W}
              </div>
              {room.game.phase === 'finished' && room.game.winner && (
                <div>
                  승자: <strong>{room.game.winner === 'B' ? '흑' : '백'}</strong>
                </div>
              )}
            </div>
          </section>

          <section className="side">
            <ChatBox items={chat} onSend={(message) => sendRoom({ type: 'chat', message })} />
            {room.game.phase === 'scoring' && <ScorePanel game={room.game} />}
          </section>
        </main>
      )}

      {view === 'solo' && soloGame && (
        <main className="room">
          <section className="side">
            <div className="panel">
              <h3>로컬 대국</h3>
              <div className="timer-row">
                <span>흑</span>
                <strong>{formatTime(soloRemaining.B)}</strong>
              </div>
              <div className="timer-row">
                <span>백(AI)</span>
                <strong>{formatTime(soloRemaining.W)}</strong>
              </div>
            </div>
            <div className="panel">
              <h3>대국 조작</h3>
              <div className="grid-2">
                <button onClick={() => applySoloMove(null)}>패스</button>
                <button className="ghost" onClick={() => setSoloGame({ ...soloGame, phase: 'finished', winner: 'W' })}>
                  기권
                </button>
              </div>
              <button className="ghost" onClick={() => setSoloGame(enterScoring(soloGame))}>
                계가 시작
              </button>
              {soloGame.phase === 'scoring' && (
                <button onClick={() => setSoloGame(finalizeScore(soloGame))}>계가 확정</button>
              )}
            </div>
          </section>
          <section className="board">
            <Board
              size={soloGame.size}
              board={soloGame.board}
              scoringMode={soloGame.phase === 'scoring'}
              deadStones={soloGame.deadStones}
              lastMoveIndex={soloGame.moveHistory.at(-1)?.index ?? null}
              disabled={soloGame.phase === 'finished' || (soloGame.phase === 'playing' && soloActive !== 'B')}
              onPlay={applySoloMove}
              onToggleDead={toggleSoloDead}
            />
            <div className="status-bar">
              <div>
                현재 차례: <strong>{soloActive === 'B' ? '흑' : '백(AI)'}</strong>
              </div>
              <div>
                캡처: 흑 {soloGame.captures.B} / 백 {soloGame.captures.W}
              </div>
              {soloGame.phase === 'finished' && soloGame.winner && (
                <div>
                  승자: <strong>{soloGame.winner === 'B' ? '흑' : '백'}</strong>
                </div>
              )}
            </div>
          </section>
          <section className="side">
            <div className="panel">
              <h3>계가</h3>
              {soloGame.phase === 'scoring' && soloScore ? (
                <div className="score-line">
                  <span>흑 {soloScore.B.toFixed(1)}</span>
                  <span>백 {soloScore.W.toFixed(1)}</span>
                </div>
              ) : (
                <p className="muted">계가 모드에서 죽은 돌을 표시하세요.</p>
              )}
            </div>
          </section>
        </main>
      )}

      {view === 'room' && !room && (
        <main className="home">
          <section className="panel">
            <h2>연결 대기 중...</h2>
            <p className="muted">서버 응답을 기다리는 중입니다.</p>
          </section>
        </main>
      )}
    </div>
  );
};

export default App;
