
import React from 'react';
import { MessageSquare } from 'lucide-react';

interface FloatingButtonsProps {
  isProcessing: boolean;
  class2: string;
  onChatOpen: () => void;
  onOCRResult: (result: string) => void;
  onAddLogEntry: (tag: string, content: string) => void;
}

const FloatingButtons: React.FC<FloatingButtonsProps> = ({
  isProcessing,
  class2,
  onChatOpen,
  onOCRResult,
  onAddLogEntry
}) => {
  return (
    <div className="fixed bottom-20 right-4 space-y-3">
      <button
        onClick={onChatOpen}
        className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
    </div>
  );
};

export default FloatingButtons;
