
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, FileUp } from 'lucide-react';

interface ReportHeaderProps {
  onPdfDownload: () => void;
  onGoogleDocsDownload: () => void;
  onDeleteAll: () => void;
  isDownloading?: boolean;
  isGoogleDocsDownloading?: boolean;
}

const ReportHeader: React.FC<ReportHeaderProps> = ({ 
  onPdfDownload,
  onGoogleDocsDownload,
  onDeleteAll, 
  isDownloading = false,
  isGoogleDocsDownloading = false
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
          onClick={onGoogleDocsDownload}
          size="sm"
          variant="outline"
          className="flex items-center gap-1"
          disabled={isGoogleDocsDownloading || isDownloading}
        >
          {isGoogleDocsDownloading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <FileUp className="w-3 h-3" />
          )}
          {isGoogleDocsDownloading ? 'Google Docs 생성 중...' : 'Google Docs로 내보내기'}
        </Button>
        <Button
          onClick={onDeleteAll}
          size="sm"
          variant="outline"
          className="flex items-center gap-1 text-red-600 hover:text-red-700"
          disabled={isDownloading || isGoogleDocsDownloading}
        >
          삭제
        </Button>
      </div>
    </div>
  );
};

export default ReportHeader;
