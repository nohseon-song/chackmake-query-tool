
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Trash2, Edit3, Check, X as XIcon } from 'lucide-react';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (message: string) => void;
  isDark: boolean;
  tempMessages: string[];
  onTempMessageAdd: (message: string) => void;
  onTempMessageUpdate?: (index: number, newMessage: string) => void;
  onTempMessageDelete: (index: number) => void;
}

const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  onSendMessage,
  isDark,
  tempMessages,
  onTempMessageAdd,
  onTempMessageUpdate,
  onTempMessageDelete
}) => {
  const [chatInput, setChatInput] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    console.log('Adding message to temp storage:', userMessage);
    
    // 임시저장 영역에만 추가
    onTempMessageAdd(userMessage);
    setChatInput('');
  };

  const handleEditStart = (index: number, currentMessage: string) => {
    setEditingIndex(index);
    setEditingText(currentMessage);
  };

  const handleEditSave = (index: number) => {
    if (!editingText.trim()) return;
    
    if (onTempMessageUpdate) {
      onTempMessageUpdate(index, editingText.trim());
    }
    
    setEditingIndex(null);
    setEditingText('');
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
    setEditingText('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 z-50 flex items-end">
      <div className="bg-card border-border w-full max-h-[70%] rounded-t-2xl flex flex-col border-t">
        {/* Header with close button */}
        <div className="flex justify-between items-center p-4 border-b border-border">
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
        <div className="p-3 border-b border-border bg-muted max-h-60 overflow-y-auto">
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">임시저장</h4>
          {tempMessages.length > 0 ? (
            <div className="space-y-2">
              {tempMessages.map((message, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 p-2 rounded text-sm bg-card border`}
                >
                  {editingIndex === idx ? (
                    <>
                      <Input
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="flex-1 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleEditSave(idx);
                          } else if (e.key === 'Escape') {
                            handleEditCancel();
                          }
                        }}
                        autoFocus
                      />
                      <Button
                        onClick={() => handleEditSave(idx)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-green-600 hover:text-green-700 flex-shrink-0"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={handleEditCancel}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground flex-shrink-0"
                      >
                        <XIcon className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 break-words pr-2">{message}</span>
                      <Button
                        onClick={() => handleEditStart(idx, message)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 flex-shrink-0"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={() => onTempMessageDelete(idx)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700 flex-shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground text-sm py-4">
              임시저장된 메시지가 없습니다.
            </div>
          )}
        </div>
        
        {/* 메인 콘텐츠 영역 */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-center text-muted-foreground text-sm">
            메시지를 입력하고 전송 버튼을 클릭하면 임시저장됩니다.
            <br />
            임시저장된 메시지는 편집 버튼을 클릭하여 수정할 수 있습니다.
            <br />
            임시저장된 메시지는 '전문 기술검토 및 진단 받기' 버튼을 클릭할 때 함께 전송됩니다.
          </div>
        </div>
        
        {/* Input form */}
        <form onSubmit={handleSubmit} className="flex p-3 border-t border-border">
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
