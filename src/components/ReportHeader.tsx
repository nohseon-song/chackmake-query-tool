
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';

interface ReportHeaderProps {
  onPdfDownload: () => void;
  onDeleteAll: () => void;
  isDownloading?: boolean;
}

const ReportHeader: React.FC<ReportHeaderProps> = ({ 
  onPdfDownload, 
  onDeleteAll, 
  isDownloading = false 
}) => {
  return (
    <div className="flex justify-between items-center mb-4">
      <div className="font-medium text-lg">기술검토 및 진단 결과입니다.</div>
      <div className="flex gap-2">
        <Button
          onClick={onPdfDownload}
          size="sm"
          variant="outline"
          className="flex items-center gap-1"
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Download className="w-3 h-3" />
          )}
          {isDownloading ? 'PDF 생성 중...' : 'PDF 다운로드'}
        </Button>
        <Button
          onClick={onDeleteAll}
          size="sm"
          variant="outline"
          className="flex items-center gap-1 text-red-600 hover:text-red-700"
          disabled={isDownloading}
        >
          삭제
        </Button>
      </div>
    </div>
  );
};

export default ReportHeader;
