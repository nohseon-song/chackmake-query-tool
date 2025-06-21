
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

  return (
    <div className="mt-4 space-y-2">
      {responseLogs.map((log) => (
        <div
          key={log.id}
          className={`p-3 rounded-lg text-sm border-l-4 border-blue-500 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          } shadow-sm`}
        >
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium">기술검토 및 진단 결과입니다.</div>
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
          <pre className="whitespace-pre-wrap text-sm">{log.content}</pre>
        </div>
      ))}
    </div>
  );
};

export default LogDisplay;
