// src/hooks/useReadings.ts

import { useState } from 'react';
import { Reading, LogEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { downloadPdf } from '@/utils/pdfUtils';
import { getCombinedHtml } from '@/utils/htmlUtils';
import { createGoogleDoc, authenticateGoogle, exchangeCodeForToken } from '@/utils/googleDocsUtils';


export const useReadings = (
  initialReadings: Reading[],
  setInitialReadings: React.Dispatch<React.SetStateAction<Reading[]>>,
  initialLogs: LogEntry[],
  setInitialLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>,
  equipment?: string
) => {
  const [savedReadings, setSavedReadings] = useState<Reading[]>(initialReadings);
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);

  const { toast } = useToast();

  const handleSaveReading = (reading: Reading) => {
    setInitialReadings(prev => [...prev, reading]);
  };

  const handleUpdateReading = (index: number, reading: Reading) => {
    setInitialReadings(prev => prev.map((item, idx) => idx === index ? reading : item));
  };

  const handleDeleteReading = (index: number) => {
    setInitialReadings(prev => prev.filter((_, idx) => idx !== index));
  };

  const clearSavedReadings = () => {
    setInitialReadings([]);
  };

  const handleDeleteLog = (id: string) => {
    setInitialLogs(prev => prev.filter(log => log.id !== id));
    toast({ title: "삭제 완료", description: "진단 결과가 삭제되었습니다." });
  };
  
  const handleDownloadPdf = async (element: HTMLElement | null) => {
    if (!element) return;
    try {
      await downloadPdf(element);
    } catch (error) {
       console.error("PDF 다운로드 실패:", error);
       toast({ title: "PDF 다운로드 실패", description: "오류가 발생했습니다.", variant: "destructive" });
    }
  };
  
  const handleGoogleDocsExport = async () => {
    const finalReportLog = initialLogs.find(log => log.isResponse);
    if (!finalReportLog) {
      toast({ title: "내보내기 실패", description: "최종 보고서가 없습니다.", variant: "destructive" });
      return;
    }
    const htmlContent = getCombinedHtml(finalReportLog);

    try {
        const code = await authenticateGoogle();
        const { accessToken } = await exchangeCodeForToken(code);
        const documentUrl = await createGoogleDoc(htmlContent, accessToken, equipment);
        window.open(documentUrl, '_blank');
        toast({ title: "성공", description: "Google Docs 문서가 생성되었습니다." });
    } catch (error) {
        console.error("Google Docs 내보내기 오류:", error);
        const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
        toast({ title: "내보내기 실패", description: errorMessage, variant: "destructive" });
    }
  };

  return {
    handleSaveReading,
    handleUpdateReading,
    handleDeleteReading,
    clearSavedReadings,
    handleDeleteLog,
    handleDownloadPdf,
    handleGoogleDocsExport,
  };
};
