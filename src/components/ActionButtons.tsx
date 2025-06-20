
import React from 'react';
import { Button } from '@/components/ui/button';

interface ActionButtonsProps {
  savedReadingsCount: number;
  isProcessing: boolean;
  onSubmit: () => void;
  isDark: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  savedReadingsCount,
  isProcessing,
  onSubmit,
  isDark
}) => {
  return (
    <div className="mt-4">
      <Button
        onClick={onSubmit}
        disabled={savedReadingsCount === 0 || isProcessing}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-full"
      >
        {isProcessing ? '처리 중...' : '전문 기술검토 및 진단 받기'}
      </Button>
    </div>
  );
};

export default ActionButtons;
