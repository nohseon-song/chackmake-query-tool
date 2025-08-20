// src/components/LogDisplay.tsx

import React, { useRef, useState, useEffect } from 'react';
import ReportHeader from './ReportHeader';
import ReportContent from './ReportContent';
import { downloadPdf } from '@/utils/pdfUtils';
import { getReportStyles } from '@/styles/reportStyles';
import { getCombinedHtml } from '@/utils/htmlUtils';
import { createGoogleDoc, authenticateGoogle, exchangeCodeForToken, fetchGoogleClientId, setGoogleClientId } from '@/utils/googleDocsUtils';
import { useToast } from '@/hooks/use-toast';
import { LogEntry } from '@/types';

interface LogDisplayProps {
  logs: LogEntry[];
  isDark: boolean;
  equipment?: string;
  onDeleteLog?: (id: string) => void;
}

const LogDisplay: React.FC<LogDisplayProps> = ({ logs, isDark, equipment, onDeleteLog }) => {
  const logRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGoogleDocsDownloading, setIsGoogleDocsDownloading] = useState(false);
  const { toast } = useToast();
  
  const equipmentRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (equipment && equipment.trim()) {
      equipmentRef.current = equipment.trim();
    }
  }, [equipment]);
  
  const responseLogs = logs.filter(log => log.isResponse);
  
  if (responseLogs.length === 0) return null;

  const handlePdfDownload = async () => {
    if (!logRef.current || isDownloading) return;
    try {
      setIsDownloading(true);
      await downloadPdf(logRef.current!);
    } catch (error) {
       console.error("PDF 다운로드 실패:", error);
       toast({ title: "PDF 다운로드 실패", description: "오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleGoogleDocsDownload = async () => {
    if (isGoogleDocsDownloading) return;
    
    const finalReportLog = responseLogs.find(log => log.tag === '📥 최종 보고서');
    if (!finalReportLog) {
      toast({ title: "내보내기 실패", description: "최종 보고서가 없습니다.", variant: "destructive" });
      return;
    }

    try {
        setIsGoogleDocsDownloading(true);
        await fetchGoogleClientId();
        const code = await authenticateGoogle();
        const { accessToken } = await exchangeCodeForToken(code);
        
        // 모든 HTML 조각을 하나로 합칩니다.
        const combinedHtml = responseLogs
            .sort((a, b) => a.timestamp - b.timestamp) // 시간순으로 정렬
            .map(log => getCombinedHtml(log))
            .join('<br><hr><br>');

        if (!combinedHtml.trim()) {
            throw new Error('내보낼 콘텐츠가 없습니다.');
        }

        const documentUrl = await createGoogleDoc(combinedHtml, accessToken, equipmentRef.current || equipment || undefined);
        
        toast({
            title: "Google Docs 문서가 생성되었습니다",
            description: "새 탭에서 문서를 확인하세요.",
        });
        
        window.open(documentUrl, '_blank');
        
    } catch (error) {
        console.error("Google Docs 생성 오류:", error);
        const errorMessage = error instanceof Error ? error.message : "문서 생성에 실패했습니다.";
        toast({ title: "문서 생성 실패", description: errorMessage, variant: "destructive" });
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
        id="report-container"
        ref={logRef}
        className="p-4 rounded-lg border-l-4 border-primary bg-card text-card-foreground shadow-sm"
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
        
        <ReportContent logs={responseLogs.sort((a, b) => a.timestamp - b.timestamp)} />
      </div>
      
      <style>{getReportStyles(isDark)}</style>
    </div>
  );
};

export default LogDisplay;
