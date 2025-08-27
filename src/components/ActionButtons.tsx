
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

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
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  const steps = [
    '데이터 준비 중...',
    '전문가 시스템 연결 중...',
    '기술 분석 진행 중...',
    '진단 결과 생성 중...',
    '최종 검토 중...'
  ];

  useEffect(() => {
    if (isProcessing) {
      setProgress(0);
      setCurrentStep(steps[0]);
      
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = Math.min(prev + Math.random() * 8 + 2, 95);
          
          // Update step based on progress
          if (newProgress < 20) {
            setCurrentStep(steps[0]);
          } else if (newProgress < 40) {
            setCurrentStep(steps[1]);
          } else if (newProgress < 60) {
            setCurrentStep(steps[2]);
          } else if (newProgress < 80) {
            setCurrentStep(steps[3]);
          } else {
            setCurrentStep(steps[4]);
          }
          
          return newProgress;
        });
      }, 300);

      return () => clearInterval(interval);
    } else {
      setProgress(0);
      setCurrentStep('');
    }
  }, [isProcessing]);

  return (
    <div className="mt-4">
      <Button
        onClick={onSubmit}
        disabled={!hasDataToSubmit || isProcessing}
        variant="intelligence"
        className="w-full py-3 rounded-full transition-all duration-300 border-2 border-button-intelligence font-semibold"
      >
        {isProcessing ? (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            <span>처리 중... {Math.round(progress)}%</span>
          </div>
        ) : (
          '⌬⚙︎∞ Activate Intelligence ∞⚙︎⌬'
        )}
      </Button>
      
      {isProcessing && (
        <div className="mt-3 space-y-2">
          <Progress value={progress} className="w-full h-2" />
          <p className="text-sm text-muted-foreground text-center animate-pulse">
            {currentStep}
          </p>
        </div>
      )}
      
      {tempMessagesCount > 0 && !isProcessing && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          임시저장된 메시지 {tempMessagesCount}개가 함께 전송됩니다.
        </p>
      )}
    </div>
  );
};

export default ActionButtons;
