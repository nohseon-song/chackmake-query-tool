import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import EquipmentSelection from '@/components/EquipmentSelection';
import ReadingsManagement from '@/components/ReadingsManagement';
import ActionButtons from '@/components/ActionButtons';
import LogDisplay from '@/components/LogDisplay';
import ActionBar from '@/components/ActionBar';
import { downloadPdfFromHtml } from '@/utils/pdf';
import { useToast } from '@/hooks/use-toast';
import { sanitizeForScreen, inferEquipmentFromHtml } from '@/utils/screenSanitize';

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
  // --- 🚀 수정된 부분 1: 마지막으로 제출한 설비명을 기억하기 위한 저장소 ---
  const lastSubmittedEquipment = useRef<string>('');

  useEffect(() => {
    // 진단 요청이 시작될 때 (isProcessing이 true가 될 때) 현재 설비명을 저장해둠
    if (isProcessing && equipment) {
      lastSubmittedEquipment.current = equipment;
    }
  }, [isProcessing, equipment]);


  // 화면 표시 전용 정리(쓰레기 제거). PDF/Docs 변환엔 영향 없음.
  const displayHtml = sanitizeForScreen(resultHtml || "");

  // --- 🚀 수정된 부분 2: 파일명 생성 규칙 수정 ---
  // 파일명용 장비명: 현재 선택값 > 없으면 마지막 제출값 > 그래도 없으면 HTML에서 추정 > 최후엔 '미지정'
  const equipForNaming =
    (equipment && equipment.trim()) ||
    lastSubmittedEquipment.current ||
    inferEquipmentFromHtml(resultHtml || "") ||
    '미지정';

  // --- 🚀 수정된 부분 3: Google Docs 결과(문서 URL + 다운로드 URL)를 함께 저장 ---
  const [gdocsResult, setGdocsResult] = useState<{ docUrl: string; download?: { url: string; name: string } } | null>(null);

  // blob URL 정리
  useEffect(() => {
    return () => {
      if (gdocsResult?.download?.url) {
        try { URL.revokeObjectURL(gdocsResult.download.url); } catch {}
      }
    };
  }, [gdocsResult?.download?.url]);

  const handlePdf = () => {
    if (!resultHtml) return;
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      // 수정된 equipForNaming을 사용해서 정확한 파일명을 생성
      const fileName = `기술진단결과_${equipForNaming}_${y}.${m}.${d}`;
      downloadPdfFromHtml(resultHtml, fileName);
      // PDF는 라이브러리를 통해 직접 다운로드 되므로, 미리보기 안내는 제거
    } catch {
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

    try {
      const mod = await import('@/lib/googleExport');
      const exportFn =
        (mod as any).exportHtmlToGoogleDoc ||
        (mod as any).exportHtmlToGoogleDocs ||
        (mod as any).default;
      if (typeof exportFn !== 'function') throw new Error('export function not found');

      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      // 수정된 equipForNaming을 사용해서 정확한 파일명을 생성
      const fileBase = `기술진단결과_${equipForNaming}_${y}.${m}.${d}`;

      // Drive 폴더 저장 + 기기 저장용 DOCX blob URL 획득
      const res: any = await exportFn({
        clientId: GOOGLE_CLIENT_ID,
        folderId: DRIVE_FOLDER_ID,
        html: resultHtml,
        fileName: fileBase,
        equipmentName: equipForNaming, // 수정된 equipForNaming 전달
        onToast: (t: { type: 'success' | 'error' | 'info'; message: string }) =>
          toast({
            title: t.type === 'success' ? '성공' : t.type === 'error' ? '오류' : '안내',
            description: t.message,
            variant: t.type === 'error' ? 'destructive' : 'default'
          })
      });

      // --- 🚀 수정된 부분 4: 결과 처리 로직 개선 ---
      // 결과 state에 구글 문서 URL과 다운로드 링크(DOCX)를 모두 저장
      if (res?.docUrl) {
        setGdocsResult({
          docUrl: res.docUrl,
          download: res.download ? { url: res.download.blobUrl, name: res.download.fileName } : undefined
        });
        toast({ title: 'Google Docs 생성 완료', description: '아래 링크를 통해 확인 및 저장할 수 있습니다.' });
      } else {
        toast({
          title: '결과 처리 실패',
          description: '문서는 Drive에 저장되었을 수 있으나, 링크를 가져오지 못했습니다.',
          variant: 'destructive'
        });
      }
    } catch (err) {
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

      {/* --- 🚀 수정된 부분 5: Google Docs 결과 표시 카드 --- */}
      {gdocsResult && (
        <Card className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} mt-3`}>
          <CardHeader>
            <CardTitle className="text-lg">Google Docs 문서 생성 완료</CardTitle>
            <CardDescription>
              문서가 지정된 Drive 폴더에 저장되었습니다. 아래 링크를 이용하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2 text-sm">
            <a
              href={gdocsResult.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline block hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              🔗 Google Docs에서 문서 열기
            </a>
            {gdocsResult.download && (
              <a
                href={gdocsResult.download.url}
                download={gdocsResult.download.name}
                className="text-blue-600 underline block hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                📄 DOCX 파일로 다운로드 — {gdocsResult.download.name}
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {resultHtml ? (
        <Card className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} mt-4`}>
          <CardContent className="p-4">
            <section aria-live="polite" aria-busy={false}>
              <div
                id="report-content"
                className="result-content prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: displayHtml }}
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
