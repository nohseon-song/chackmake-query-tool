
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChatOCRCardsProps {
  class2: string;
  isDark: boolean;
  onChatOpen: () => void;
  onAddLogEntry: (tag: string, content: string) => void;
}

const ChatOCRCards: React.FC<ChatOCRCardsProps> = ({
  class2,
  isDark,
  onChatOpen,
  onAddLogEntry
}) => {
  const { toast } = useToast();

  const handleOCRClick = () => {
    if (!class2) {
      onAddLogEntry('🔔 안내', '설비→주요 점검 부분→세부 점검 항목을 먼저 선택하세요.');
      return;
    }
    toast({
      title: "OCR 기능",
      description: "이미지를 선택하여 텍스트를 추출하세요.",
    });
  };

  return (
    <div className="grid grid-cols-2 gap-3 mt-4">
      <Card 
        className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105 ${
          isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'
        }`}
        onClick={onChatOpen}
      >
        <CardContent className="p-3 flex items-center justify-center space-x-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium">챗봇</span>
        </CardContent>
      </Card>

      <Card 
        className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105 ${
          isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'
        }`}
        onClick={handleOCRClick}
      >
        <CardContent className="p-3 flex items-center justify-center space-x-2">
          <Camera className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium">OCR</span>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatOCRCards;
