import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, Wand2 } from 'lucide-react';

interface ActionButtonsProps {
  savedReadingsCount: number;
  isProcessing: boolean;
  onSubmit: () => void;
  isDark: boolean;
  tempMessagesCount: number;
  isWebhookReady: boolean; // [수정됨] 이 줄 추가
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  savedReadingsCount,
  isProcessing,
  onSubmit,
  isDark,
  tempMessagesCount,
  isWebhookReady, // [수정됨] 이 줄 추가
}) => {
  const hasDataToSubmit = savedReadingsCount > 0 || tempMessagesCount > 0;
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!hasDataToSubmit && !isProcessing) {
      const timer = setTimeout(() => setShowTooltip(true), 1000);
      return () => clearTimeout(timer);
    } else {
      setShowTooltip(false);
    }
  }, [hasDataToSubmit, isProcessing]);

  const getButtonText = () => {
    if (isProcessing) return "분석 중...";
    if (!isWebhookReady) return "채널 준비 중..."; // [수정됨] 준비 중 텍스트 추가
    return "전문 기술검토 및 진단 받기";
  };

  return (
    <div className="mt-4 relative">
      <Button
        onClick={onSubmit}
        disabled={!hasDataToSubmit || isProcessing || !isWebhookReady} // [수정됨] disabled 조건에 !isWebhookReady 추가
        className="w-full text-lg py-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing || !isWebhookReady ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <Wand2 className="mr-2 h-5 w-5" />
        )}
        {getButtonText()}
      </Button>
      {showTooltip && (
        <div className={`absolute bottom-full mb-2 w-full text-center text-sm p-2 rounded-md ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-black'}`}>
          계측값을 추가하거나 간단한 메모를 작성하여 진단을 시작하세요.
        </div>
      )}
    </div>
  );
};

export default ActionButtons;
