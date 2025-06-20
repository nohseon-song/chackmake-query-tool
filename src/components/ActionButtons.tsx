
import React from 'react';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ActionButtonsProps {
  savedReadingsCount: number;
  isProcessing: boolean;
  onSubmit: () => void;
  logs: any[];
  isDark: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  savedReadingsCount,
  isProcessing,
  onSubmit,
  logs,
  isDark
}) => {
  const { toast } = useToast();

  const downloadPDF = () => {
    const responseEntries = logs.filter(log => log.isResponse);
    if (responseEntries.length === 0) {
      toast({
        title: "다운로드 불가",
        description: "다운로드할 응답 데이터가 없습니다.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "PDF 다운로드",
      description: "PDF 다운로드 기능은 추후 구현 예정입니다.",
    });
  };

  return (
    <div className="mt-4 space-y-2">
      <Button
        onClick={onSubmit}
        disabled={savedReadingsCount === 0 || isProcessing}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-full"
      >
        {isProcessing ? '처리 중...' : '전문 기술검토 및 진단 받기'}
      </Button>
      <Button
        onClick={downloadPDF}
        variant="outline"
        className="ml-auto block px-4 py-2 text-sm"
      >
        <FileDown className="w-4 h-4 mr-2" />
        PDF 다운로드
      </Button>
    </div>
  );
};

export default ActionButtons;
