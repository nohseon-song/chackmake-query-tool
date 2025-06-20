
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (message: string) => void;
  isDark: boolean;
}

const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  onSendMessage,
  isDark
}) => {
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{text: string, isUser: boolean}[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { text: userMessage, isUser: true }]);
    setChatInput('');
    onSendMessage(userMessage);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-end">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} w-full max-h-[60%] rounded-t-2xl flex flex-col`}>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`max-w-[70%] p-3 rounded-xl text-sm ${
                msg.isUser
                  ? 'ml-auto bg-blue-600 text-white'
                  : `mr-auto ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`
              }`}
            >
              {msg.text}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex p-3 border-t border-gray-200 dark:border-gray-700">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="메시지를 입력하세요…"
            className="flex-1 mr-2"
          />
          <Button type="submit" className="px-4">전송</Button>
        </form>
        <Button
          onClick={onClose}
          variant="ghost"
          className="absolute top-2 right-2"
        >
          ✕
        </Button>
      </div>
    </div>
  );
};

export default ChatModal;
