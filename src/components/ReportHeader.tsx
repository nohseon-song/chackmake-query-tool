
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface ReportHeaderProps {
  onPdfDownload: () => void;
  onDeleteAll: () => void;
}

const ReportHeader: React.FC<ReportHeaderProps> = ({ onPdfDownload, onDeleteAll }) => {
  return (
    <div className="flex justify-between items-center mb-4">
      <div className="font-medium text-lg">기술검토 및 진단 결과입니다.</div>
      <div className="flex gap-2">
        <Button
          onClick={onPdfDownload}
          size="sm"
          variant="outline"
          className="flex items-center gap-1"
        >
          <Download className="w-3 h-3" />
          PDF 다운로드
        </Button>
        <Button
          onClick={onDeleteAll}
          size="sm"
          variant="outline"
          className="flex items-center gap-1 text-red-600 hover:text-red-700"
        >
          삭제
        </Button>
      </div>
    </div>
  );
};

export default ReportHeader;
