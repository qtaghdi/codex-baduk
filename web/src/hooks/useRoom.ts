import { useMemo, useRef, useState } from 'react';
import type { ClientToServerMessage, RoomState } from '@go/shared';
import { WsClient, type ConnectionState } from '../lib/wsClient';

type ChatMessage = { sender: string; message: string; timestamp: number };

type UseRoomState = {
  room: RoomState | null;
  selfId: string | null;
  connection: ConnectionState;
  chat: ChatMessage[];
};

export const useRoom = () => {
  const [state, setState] = useState<UseRoomState>({
    room: null,
    selfId: null,
    connection: 'idle',
    chat: []
  });

  const clientRef = useRef<WsClient | null>(null);

  const client = useMemo(() => {
    if (clientRef.current) return clientRef.current;
    const ws = new WsClient({
      onMessage: (message) => {
        if (message.type === 'room_joined') {
          setState((prev) => ({ ...prev, room: message.room, selfId: message.selfId, chat: [] }));
        }
        if (message.type === 'room_updated') {
          setState((prev) => ({ ...prev, room: message.room }));
        }
        if (message.type === 'chat') {
          setState((prev) => ({ ...prev, chat: [...prev.chat, message] }));
        }
        if (message.type === 'error') {
          alert(message.message);
        }
      },
      onState: (connection) => {
        setState((prev) => ({ ...prev, connection }));
        if (connection === 'closed') {
          setState((prev) => ({ ...prev, room: null, selfId: null, chat: [] }));
        }
      }
    });
    clientRef.current = ws;
    return ws;
  }, []);

  const connect = (url: string) => client.connect(url);
  const disconnect = () => client.close();
  const send = (message: ClientToServerMessage) => client.send(message);

  return { ...state, connect, disconnect, send };
};
