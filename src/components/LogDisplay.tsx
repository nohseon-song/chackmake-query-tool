
import React, { useRef, useState } from 'react';
import ReportHeader from './ReportHeader';
import ReportContent from './ReportContent';
import { downloadPdf } from '@/utils/pdfUtils';
import { getReportStyles } from '@/styles/reportStyles';

interface LogEntry {
  id: string;
  tag: string;
  content: string;
  isResponse?: boolean;
  timestamp: number;
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
  const [isDownloading, setIsDownloading] = useState(false);
  
  // 응답 로그만 필터링
  const responseLogs = logs.filter(log => log.isResponse);
  
  if (responseLogs.length === 0) return null;

  const handlePdfDownload = async () => {
    if (!logRef.current || isDownloading) return;
    
    try {
      setIsDownloading(true);
      console.log('PDF 다운로드 버튼 클릭됨');
      
      // 약간의 지연을 주어 UI 업데이트가 반영되도록 함
      setTimeout(async () => {
        await downloadPdf(logRef.current!);
        setIsDownloading(false);
      }, 100);
      
    } catch (error) {
      console.error('PDF 다운로드 핸들러 오류:', error);
      setIsDownloading(false);
    }
  };

  const handleDeleteAll = () => {
    responseLogs.forEach((log) => {
      if (onDeleteLog) {
        onDeleteLog(log.id);
      }
    });
  };

  return (
    <div className="mt-4 space-y-2">
      <div
        id="chat-log"
        ref={logRef}
        className={`p-4 rounded-lg border-l-4 border-blue-500 ${
          isDark ? 'bg-gray-800 text-white' : 'bg-white text-black'
        } shadow-sm`}
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: '1.6',
          margin: 0,
          padding: '16px'
        }}
      >
        <ReportHeader 
          onPdfDownload={handlePdfDownload}
          onDeleteAll={handleDeleteAll}
          isDownloading={isDownloading}
        />
        
        <ReportContent logs={responseLogs} />
      </div>
      
      <style>{getReportStyles(isDark)}</style>
    </div>
  );
};

export default LogDisplay;
