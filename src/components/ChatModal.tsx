
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Trash2 } from 'lucide-react';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (message: string) => void;
  isDark: boolean;
  tempMessages: string[];
  onTempMessageAdd: (message: string) => void;
  onTempMessageDelete: (index: number) => void;
}

const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  onSendMessage,
  isDark,
  tempMessages,
  onTempMessageAdd,
  onTempMessageDelete
}) => {
  const [chatInput, setChatInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    console.log('Adding message to temp storage:', userMessage);
    
    // 임시저장 영역에만 추가
    onTempMessageAdd(userMessage);
    setChatInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-end">
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} w-full max-h-[70%] rounded-t-2xl flex flex-col border-t`}>
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
        
        {/* 임시저장 영역 */}
        <div className={`p-3 border-b ${isDark ? 'border-gray-700 bg-gray-700' : 'border-gray-200 bg-gray-50'} max-h-60 overflow-y-auto`}>
          <h4 className="text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">임시저장</h4>
          {tempMessages.length > 0 ? (
            <div className="space-y-2">
              {tempMessages.map((message, idx) => (
                <div
                  key={idx}
                  className={`flex justify-between items-center p-2 rounded text-sm ${
                    isDark ? 'bg-gray-600' : 'bg-white'
                  } border`}
                >
                  <span className="flex-1 break-words pr-2">{message}</span>
                  <Button
                    onClick={() => onTempMessageDelete(idx)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 text-sm py-4">
              임시저장된 메시지가 없습니다.
            </div>
          )}
        </div>
        
        {/* 메인 콘텐츠 영역 */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-center text-gray-500 text-sm">
            메시지를 입력하고 전송 버튼을 클릭하면 임시저장됩니다.
            <br />
            임시저장된 메시지는 '전문 기술검토 및 진단 받기' 버튼을 클릭할 때 함께 전송됩니다.
          </div>
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
