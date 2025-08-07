
import React, { useRef, useState } from 'react';
import ReportHeader from './ReportHeader';
import ReportContent from './ReportContent';
import { downloadPdf } from '@/utils/pdfUtils';
import { getReportStyles } from '@/styles/reportStyles';
import { getCombinedHtml } from '@/utils/htmlUtils';
import { createGoogleDoc } from '@/utils/googleDocsUtils';
import { useToast } from '@/hooks/use-toast';

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
  equipment?: string;
  onDeleteLog?: (id: string) => void;
  onDownloadPdf?: (content: string) => void;
  onGoogleAuth?: () => Promise<string>;
}

const LogDisplay: React.FC<LogDisplayProps> = ({ logs, isDark, equipment, onDeleteLog, onGoogleAuth }) => {
  const logRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGoogleDocsDownloading, setIsGoogleDocsDownloading] = useState(false);
  const { toast } = useToast();
  
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

  const handleGoogleDocsDownload = async () => {
    if (isGoogleDocsDownloading || !onGoogleAuth) return;
    
    try {
      setIsGoogleDocsDownloading(true);
      console.log('Google Docs 다운로드 버튼 클릭됨');
      
      // Google 인증 처리
      const accessToken = await onGoogleAuth();
      
      // HTML 콘텐츠 가져오기
      const combinedHtml = responseLogs.map(log => getCombinedHtml(log)).join('\n\n');
      
      if (!combinedHtml.trim()) {
        throw new Error('내보낼 콘텐츠가 없습니다.');
      }
      
      // Google Docs 문서 생성
      console.log('📱 LogDisplay에서 createGoogleDoc 호출', {
        equipment: equipment || '',
        hasEquipment: !!equipment
      });
      
      const documentUrl = await createGoogleDoc(combinedHtml, accessToken, equipment || undefined);
      
      toast({
        title: "Google Docs 문서가 생성되었습니다",
        description: "새 탭에서 문서를 확인하세요.",
      });
      
      // 새 탭에서 문서 열기
      window.open(documentUrl, '_blank');
      
    } catch (error) {
      console.error('Google Docs 생성 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '문서 생성에 실패했습니다.';
      
      toast({
        title: "문서 생성 실패",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGoogleDocsDownloading(false);
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
          onGoogleDocsDownload={handleGoogleDocsDownload}
          onDeleteAll={handleDeleteAll}
          isDownloading={isDownloading}
          isGoogleDocsDownloading={isGoogleDocsDownloading}
        />
        
        <ReportContent logs={responseLogs} />
      </div>
      
      <style>{getReportStyles(isDark)}</style>
    </div>
  );
};

export default LogDisplay;
