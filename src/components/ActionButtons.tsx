
import React from 'react';
import { Button } from '@/components/ui/button';

interface ActionButtonsProps {
  savedReadingsCount: number;
  isProcessing: boolean;
  onSubmit: () => void;
  isDark: boolean;
  tempMessagesCount: number;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  savedReadingsCount,
  isProcessing,
  onSubmit,
  isDark,
  tempMessagesCount
}) => {
  const hasDataToSubmit = savedReadingsCount > 0 || tempMessagesCount > 0;

  return (
    <div className="mt-4">
      <Button
        onClick={onSubmit}
        disabled={!hasDataToSubmit || isProcessing}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-full"
      >
        {isProcessing ? '처리 중...' : '전문 기술검토 및 진단 받기'}
      </Button>
      {tempMessagesCount > 0 && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          임시저장된 메시지 {tempMessagesCount}개가 함께 전송됩니다.
        </p>
      )}
    </div>
  );
};

export default ActionButtons;
