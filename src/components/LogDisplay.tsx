
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Trash, Download } from 'lucide-react';

// html2pdf.js CDN 자동 로딩
const loadHtml2Pdf = () =>
  new Promise((resolve) => {
    if ((window as any).html2pdf) return resolve((window as any).html2pdf);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => resolve((window as any).html2pdf);
    document.body.appendChild(script);
  });

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
  const logRef = useRef<HTMLDivElement>(null);
  
  // 응답 로그만 필터링
  const responseLogs = logs.filter(log => log.isResponse);
  
  if (responseLogs.length === 0) return null;

  const handleDelete = (id: string) => {
    if (onDeleteLog) {
      onDeleteLog(id);
    }
  };

  // PDF 다운로드 함수
  const handlePdfDownload = async (content: string) => {
    try {
      const html2pdf = await loadHtml2Pdf();
      
      // 임시 div 생성하여 내용 렌더링
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      tempDiv.style.padding = '20px';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      tempDiv.style.lineHeight = '1.6';
      tempDiv.style.color = '#000';
      tempDiv.style.background = '#fff';
      
      document.body.appendChild(tempDiv);
      
      await (html2pdf as any)()
        .set({
          filename: 'report.pdf',
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(tempDiv)
        .save();
        
      document.body.removeChild(tempDiv);
    } catch (error) {
      console.error('PDF 다운로드 중 오류:', error);
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
          ref={logRef}
          id="chat-log"
          className={`p-4 rounded-lg border-l-4 border-blue-500 ${
            isDark ? 'bg-gray-800 text-white' : 'bg-white text-black'
          } shadow-sm`}
        >
          <div className="flex justify-between items-center mb-3">
            <div className="font-medium text-lg">기술검토 및 진단 결과입니다.</div>
            <div className="flex gap-2">
              <Button
                onClick={() => handlePdfDownload(log.content)}
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
