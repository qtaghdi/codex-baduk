import React, { useState } from 'react';

type ChatItem = { sender: string; message: string; timestamp: number };

const ChatBox: React.FC<{ items: ChatItem[]; onSend: (message: string) => void }> = ({ items, onSend }) => {
  const [text, setText] = useState('');
  return (
    <div className="panel">
      <h3>채팅</h3>
      <div className="chat-box">
        {items.map((c, i) => (
          <div key={`${c.timestamp}-${i}`} className="chat-item">
            <span>{c.message}</span>
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="메시지"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim()) {
              onSend(text.trim());
              setText('');
            }
          }}
        />
        <button
          className="ghost"
          onClick={() => {
            if (!text.trim()) return;
            onSend(text.trim());
            setText('');
          }}
        >
          보내기
        </button>
      </div>
    </div>
  );
};

export default ChatBox;
