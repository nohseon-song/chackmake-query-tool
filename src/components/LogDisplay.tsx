

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

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
  // 새로운 JSON 필드들
  diagnosis_summary_html?: string;
  complementary_summary_html?: string;
  precision_verification_html?: string;
  final_summary_html?: string;
}

interface LogDisplayProps {
  logs: LogEntry[];
  isDark: boolean;
  onDeleteLog?: (id: string) => void;
  onDownloadPdf?: (content: string) => void;
}

const LogDisplay: React.FC<LogDisplayProps> = ({ logs, isDark, onDeleteLog }) => {
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
  const handlePdfDownload = async () => {
    if (!logRef.current) return;
    
    try {
      const html2pdf = await loadHtml2Pdf();
      
      await (html2pdf as any)()
        .set({
          filename: 'report.pdf',
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(logRef.current)
        .save();
        
    } catch (error) {
      console.error('PDF 다운로드 중 오류:', error);
    }
  };

  // JSON 필드들을 HTML로 결합
  const getCombinedHtml = (log: LogEntry) => {
    const parts = [
      log.diagnosis_summary_html || '',
      log.complementary_summary_html || '',
      log.precision_verification_html || '',
      log.final_summary_html || ''
    ].filter(part => part.trim() !== '');
    
    return parts.length > 0 ? parts.join('') : log.content;
  };

  return (
    <div className="mt-4 space-y-2">
      <div
        id="chat-log"
        ref={logRef}
        className={`p-6 rounded-lg border-l-4 border-blue-500 ${
          isDark ? 'bg-gray-800 text-white' : 'bg-white text-black'
        } shadow-sm`}
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: '1.6'
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="font-medium text-lg">기술검토 및 진단 결과입니다.</div>
          <div className="flex gap-2">
            <Button
              onClick={handlePdfDownload}
              size="sm"
              variant="outline"
              className="flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              PDF 다운로드
            </Button>
            {responseLogs.map((log) => (
              <Button
                key={log.id}
                onClick={() => handleDelete(log.id)}
                size="sm"
                variant="outline"
                className="flex items-center gap-1 text-red-600 hover:text-red-700"
              >
                삭제
              </Button>
            ))}
          </div>
        </div>
        
        {/* HTML 콘텐츠 렌더링 */}
        {responseLogs.map((log) => (
          <div 
            key={log.id} 
            className="mt-4 report-content"
            dangerouslySetInnerHTML={{ __html: getCombinedHtml(log) }}
          />
        ))}
      </div>
      
      <style>{`
        .report-content h1 {
          font-size: 1.875rem;
          font-weight: 700;
          margin: 1.5rem 0 1rem 0;
          color: ${isDark ? '#ffffff' : '#1f2937'};
          line-height: 1.2;
        }
        
        .report-content h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 1.25rem 0 0.75rem 0;
          color: ${isDark ? '#e5e7eb' : '#374151'};
          line-height: 1.3;
        }
        
        .report-content h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 1rem 0 0.5rem 0;
          color: ${isDark ? '#d1d5db' : '#4b5563'};
          line-height: 1.4;
        }
        
        .report-content p {
          margin: 0.75rem 0;
          line-height: 1.6;
          color: ${isDark ? '#f3f4f6' : '#1f2937'};
        }
        
        .report-content em {
          font-style: italic;
          color: ${isDark ? '#9ca3af' : '#6b7280'};
          font-size: 0.9rem;
        }
        
        .report-content strong {
          font-weight: 600;
          color: ${isDark ? '#ffffff' : '#111827'};
        }
        
        .report-content ul {
          margin: 1rem 0;
          padding-left: 1.5rem;
          list-style-type: disc;
        }
        
        .report-content li {
          margin: 0.5rem 0;
          line-height: 1.6;
          color: ${isDark ? '#f3f4f6' : '#1f2937'};
        }
        
        .report-content section {
          margin: 2rem 0;
          padding: 1rem 0;
        }
        
        .report-content article {
          max-width: none;
        }
        
        .report-content header {
          margin-bottom: 2rem;
          border-bottom: 1px solid ${isDark ? '#374151' : '#e5e7eb'};
          padding-bottom: 1rem;
        }
        
        .report-content footer {
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid ${isDark ? '#374151' : '#e5e7eb'};
          font-size: 0.9rem;
          color: ${isDark ? '#9ca3af' : '#6b7280'};
        }
        
        .report-content pre {
          background: ${isDark ? '#1f2937' : '#f9fafb'};
          border: 1px solid ${isDark ? '#374151' : '#e5e7eb'};
          border-radius: 0.375rem;
          padding: 1rem;
          margin: 1rem 0;
          overflow-x: auto;
          white-space: pre-wrap;
          font-family: 'Courier New', monospace;
          font-size: 0.875rem;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
};

export default LogDisplay;

