
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

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
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} w-full max-h-[60%] rounded-t-2xl flex flex-col border-t`}>
        {/* Header with close button */}
        <div className={`flex justify-between items-center p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className="text-lg font-semibold">채팅</h3>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Messages area */}
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
        
        {/* Input form */}
        <form onSubmit={handleSubmit} className={`flex p-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="메시지를 입력하세요…"
            className="flex-1 mr-2"
          />
          <Button type="submit" className="px-4">전송</Button>
        </form>
      </div>
    </div>
  );
};

export default ChatModal;
