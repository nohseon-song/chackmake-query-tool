import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import EquipmentSelection from '@/components/EquipmentSelection';
import ReadingsManagement from '@/components/ReadingsManagement';
import ActionButtons from '@/components/ActionButtons';
import LogDisplay from '@/components/LogDisplay';
import ActionBar from '@/components/ActionBar';
import { downloadPdfFromHtml } from '@/utils/pdf';
import { useToast } from '@/hooks/use-toast';

interface Reading {
  equipment: string;
  class1: string;
  class2: string;
  design: string;
  measure: string;
}

interface LogEntry {
  id: string;
  tag: string;
  content: string;
  isResponse?: boolean;
  timestamp: number;
}

interface MainContentProps {
  equipment: string;
  class1: string;
  class2: string;
  equipmentTree: Record<string, any>;
  savedReadings: Reading[];
  logs: LogEntry[];
  resultHtml: string;
  isProcessing: boolean;
  isDark: boolean;
  tempMessagesCount: number;
  onEquipmentChange: (value: string) => void;
  onClass1Change: (value: string) => void;
  onClass2Change: (value: string) => void;
  onSaveReading: (reading: Reading) => void;
  onUpdateReading: (index: number, reading: Reading) => void;
  onDeleteReading: (index: number) => void;
  onSubmit: () => void;
  onDeleteLog: (id: string) => void;
  onDownloadPdf: (content: string) => void;
  onGoogleAuth?: (htmlContent: string, equipmentName?: string) => Promise<void>;
  onChatOpen: () => void;
  onAddLogEntry: (tag: string, content: any) => void;
}

const MainContent: React.FC<MainContentProps> = ({
  equipment,
  class1,
  class2,
  equipmentTree,
  savedReadings,
  logs,
  resultHtml,
  isProcessing,
  isDark,
  tempMessagesCount,
  onEquipmentChange,
  onClass1Change,
  onClass2Change,
  onSaveReading,
  onUpdateReading,
  onDeleteReading,
  onSubmit,
  onDeleteLog,
  onDownloadPdf,
  onGoogleAuth,
  onChatOpen,
  onAddLogEntry
}) => {
  const { toast } = useToast();

  const handlePdf = () => {
  if (!resultHtml) return;
  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const safeEquip = (equipment || "미지정").trim();
    const fileName = `기술진단결과_${safeEquip}_${y}.${m}.${d}`;  // ← 규칙 동일

    downloadPdfFromHtml(resultHtml, fileName);
    toast({ title: "PDF 다운로드", description: "인쇄 대화상자가 열렸습니다." });
  } catch (error) {
    toast({ title: "PDF 다운로드 실패", description: "다시 시도해주세요.", variant: "destructive" });
  }
};

  const handleGDocs = async () => {
    if (!resultHtml) {
      toast({ title: '내보낼 보고서가 없습니다.', variant: 'destructive' });
      return;
    }

    const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
    const DRIVE_FOLDER_ID = import.meta.env.VITE_DRIVE_TARGET_FOLDER_ID as string;

    if (!GOOGLE_CLIENT_ID) {
      toast({ title: 'Google Client ID가 설정되지 않았습니다.', variant: 'destructive' });
      return;
    }

    // ① 사용자 클릭과 동기적으로 새 탭 시도(차단 시 null)
    let popup: Window | null = window.open('about:blank', '_blank', 'noopener,noreferrer');
    const openedNewTab = !!popup;
    if (popup) {
      try {
        popup.document.write(`
          <html><head><title>Google Docs 생성 중...</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>html,body{height:100%;margin:0;display:flex;align-items:center;justify-content:center;font-family:sans-serif}</style>
          </head><body><div>Google Docs 문서를 생성하고 있습니다…</div></body></html>
        `);
        popup.document.close();
      } catch {}
    } else {
      toast({
        title: '팝업이 차단되었습니다',
        description:
          '브라우저 주소창 우측의 팝업 차단 아이콘을 눌러 허용해 주세요. (이번에는 현재 탭으로 열립니다.)',
        variant: 'destructive'
      });
    }

    try {
      // ② 유틸 모듈 로드(이름 불일치 방지: 존재 확인 후 호출)
      const mod = await import('@/lib/googleExport');
      const exportFn =
        (mod as any).exportHtmlToGoogleDoc ||
        (mod as any).exportHtmlToGoogleDocs ||
        (mod as any).default;

      if (typeof exportFn !== 'function') {
        throw new Error('export function not found: exportHtmlToGoogleDoc(s)');
      }

      // 파일명 규칙: 기술진단결과_{설비}_{YYYY.MM.DD}
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const safeEquip = (equipment && equipment.trim()) || '미지정';
      const fileName = `기술진단결과_${safeEquip}_${y}.${m}.${d}`;

      const res: any = await exportFn({
        clientId: GOOGLE_CLIENT_ID,
        folderId: DRIVE_FOLDER_ID,
        html: resultHtml,
        fileName,
        onToast: (t: { type: 'success' | 'error' | 'info'; message: string }) =>
          toast({
            title: t.type === 'success' ? '성공' : t.type === 'error' ? '오류' : '안내',
            description: t.message,
            variant: t.type === 'error' ? 'destructive' : 'default'
          })
      });

      const docUrl: string =
        res?.docUrl || res?.webViewLink || res?.alternateLink || res?.url || '';

      if (docUrl) {
        if (openedNewTab && popup) {
          popup.location.href = docUrl;   // 팝업 허용: 새 탭 이동
        } else {
          window.location.href = docUrl;  // 팝업 차단: 현재 탭 이동
        }
        toast({ title: 'Google Docs로 내보내기 완료', description: '지정 폴더에 저장되었습니다.' });
      } else {
        try { popup?.close(); } catch {}
        toast({
          title: '문서 링크를 받지 못했습니다',
          description: '문서는 생성되었을 수 있으니 Google Drive 폴더를 확인해 주세요.',
          variant: 'destructive'
        });
      }
    } catch (err) {
      try { popup?.close(); } catch {}
      console.error('Google Docs 내보내기 오류:', err);
      toast({
        title: 'Google Docs 내보내기 실패',
        description: '네트워크/권한을 확인 후 다시 시도해주세요.',
        variant: 'destructive'
      });
    }
  };

  const selectedEquipment = equipmentTree[equipment as keyof typeof equipmentTree];
  const selectedClass1 = selectedEquipment?.[class1 as keyof typeof selectedEquipment];
  const showInputs = class2 && selectedClass1;

  return (
    <main className="flex-1 overflow-y-auto p-3 pb-24">
      <Card className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} mt-4`}>
        <CardContent className="p-4 space-y-4">
          <EquipmentSelection
            equipment={equipment}
            class1={class1}
            class2={class2}
            equipmentTree={equipmentTree}
            onEquipmentChange={onEquipmentChange}
            onClass1Change={onClass1Change}
            onClass2Change={onClass2Change}
            onChatOpen={onChatOpen}
            onOCRResult={() => {}}
            onAddLogEntry={onAddLogEntry}
            isDark={isDark}
          />

          <ReadingsManagement
            equipment={equipment}
            class1={class1}
            class2={class2}
            showInputs={showInputs}
            savedReadings={savedReadings}
            onSaveReading={onSaveReading}
            onUpdateReading={onUpdateReading}
            onDeleteReading={onDeleteReading}
            isDark={isDark}
            logs={logs}
          />
        </CardContent>
      </Card>

      <ActionButtons
        savedReadingsCount={savedReadings.length}
        isProcessing={isProcessing}
        onSubmit={onSubmit}
        isDark={isDark}
        tempMessagesCount={tempMessagesCount}
      />

      {(resultHtml || isProcessing) && (
        <ActionBar html={resultHtml} loading={isProcessing} onPdf={handlePdf} onGDocs={handleGDocs} />
      )}

      {resultHtml ? (
        <Card className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} mt-4`}>
          <CardContent className="p-4">
            <section aria-live="polite" aria-busy={false}>
              <div
                id="report-content"
                className="result-content prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: resultHtml }}
              />
            </section>
          </CardContent>
        </Card>
      ) : isProcessing ? (
        <Card className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} mt-4`}>
          <CardContent className="p-4">
            <section aria-live="polite" aria-busy={true}>
              <div className="flex flex-col items-center justify-center p-8 space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-muted-foreground">분석 중…</p>
              </div>
            </section>
          </CardContent>
        </Card>
      ) : (
        <LogDisplay
          logs={logs}
          isDark={isDark}
          equipment={equipment}
          onDeleteLog={onDeleteLog}
          onDownloadPdf={onDownloadPdf}
          onGoogleAuth={onGoogleAuth ? (html) => onGoogleAuth(html, equipment) : undefined}
        />
      )}
    </main>
  );
};

export default MainContent;
