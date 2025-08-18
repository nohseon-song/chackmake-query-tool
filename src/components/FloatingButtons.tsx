
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
    </div>
  );
};

export default FloatingButtons;
