
import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash, Download } from 'lucide-react';

interface LogEntry {
  id: string;
  tag: string;
  content: string;
  isResponse?: boolean;
  timestamp: number;
}

interface LogDisplayProps {
  logs: LogEntry[];
  isDark: boolean;
  onDeleteLog?: (id: string) => void;
  onDownloadPdf?: (content: string) => void;
}

const LogDisplay: React.FC<LogDisplayProps> = ({ logs, isDark, onDeleteLog, onDownloadPdf }) => {
  // Filter to show only response logs
  const responseLogs = logs.filter(log => log.isResponse);
  
  if (responseLogs.length === 0) return null;

  const handleDelete = (id: string) => {
    if (onDeleteLog) {
      onDeleteLog(id);
    }
  };

  const handleDownload = (content: string) => {
    if (onDownloadPdf) {
      onDownloadPdf(content);
    }
  };

  const isHtmlContent = (content: string) => {
    // HTML 태그가 포함되어 있는지 더 정확하게 확인
    return /<[^>]*>/g.test(content.trim());
  };

  const renderContent = (content: string) => {
    if (isHtmlContent(content)) {
      return (
        <div 
          className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}
          dangerouslySetInnerHTML={{ __html: content }}
          style={{
            lineHeight: '1.6',
            color: isDark ? '#ffffff' : '#000000'
          }}
        />
      );
    } else {
      return (
        <pre 
          className="whitespace-pre-wrap text-sm font-mono"
          style={{
            lineHeight: '1.6',
            color: isDark ? '#ffffff' : '#000000'
          }}
        >
          {content}
        </pre>
      );
    }
  };

  return (
    <div className="mt-4 space-y-2">
      {responseLogs.map((log) => (
        <div
          key={log.id}
          className={`p-4 rounded-lg border-l-4 border-blue-500 ${
            isDark ? 'bg-gray-800 text-white' : 'bg-white text-black'
          } shadow-sm`}
        >
          <div className="flex justify-between items-center mb-3">
            <div className="font-medium text-lg">기술검토 및 진단 결과입니다.</div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleDownload(log.content)}
                size="sm"
                variant="outline"
                className="flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                PDF 다운로드
              </Button>
              <Button
                onClick={() => handleDelete(log.id)}
                size="sm"
                variant="outline"
                className="flex items-center gap-1 text-red-600 hover:text-red-700"
              >
                <Trash className="w-3 h-3" />
                삭제
              </Button>
            </div>
          </div>
          <div className="mt-3">
            {renderContent(log.content)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LogDisplay;
