import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import EquipmentSelection from '@/components/EquipmentSelection';
import ReadingsManagement from '@/components/ReadingsManagement';
import ActionButtons from '@/components/ActionButtons';
import LogDisplay from '@/components/LogDisplay';
import ActionBar from '@/components/ActionBar';
import { downloadPdfFromHtml } from '@/utils/pdf';
import { useToast } from '@/hooks/use-toast';

// 추가: Google Docs 내보내기 유틸(정화 포함)
import { exportHtmlToGoogleDocs, sanitizeReportHtml } from '@/lib/googleExport';

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

  // Google Docs 다운로드 링크 상태(문서 생성 후에만 노출)
  const [gdocsLink, setGdocsLink] = React.useState<string | null>(null);
  const [gdocsFileName, setGdocsFileName] = React.useState<string | null>(null);

  // 파일명 규칙용 설비명 (equipment 비어있으면 보강)
  const effectiveEquipName =
    (equipment && equipment.trim()) ||
    (savedReadings[0]?.equipment?.trim()) ||
    (class2 && class2.trim()) ||
    "미지정";

  const buildFileName = React.useCallback(() => {
    const d = new Date();
    const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const stamp = `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`;
    return `기술진단결과_${effectiveEquipName}_${stamp}`;
  }, [effectiveEquipName]);

  const handlePdf = () => {
    if (!resultHtml) return;
    try {
      // 이상한 JSON 조각 제거 후 PDF화 + 파일명 규칙 적용
      const cleaned = sanitizeReportHtml(resultHtml);
      downloadPdfFromHtml(cleaned, buildFileName());
      toast({ title: "PDF 다운로드", description: "인쇄 대화상자가 열렸습니다." });
    } catch (error) {
      toast({ title: "PDF 다운로드 실패", description: "다시 시도해주세요.", variant: "destructive" });
    }
  };

  const handleGDocs = async () => {
    if (!resultHtml) {
      toast({ title: "내보낼 보고서가 없습니다.", variant: "destructive" });
      return;
    }

    const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
    const DRIVE_FOLDER_ID  = import.meta.env.VITE_DRIVE_TARGET_FOLDER_ID as string;
    if (!GOOGLE_CLIENT_ID || !DRIVE_FOLDER_ID) {
      toast({ title: "Google 설정이 비어있습니다.", description: "환경변수를 확인하세요.", variant: "destructive" });
      return;
    }

    try {
      // 화면 이동 없이 문서 생성 + 다운로드 링크 반환
      const { downloadUrl, fileName } = await exportHtmlToGoogleDocs({
        html: resultHtml,
        equipmentName: effectiveEquipName,
        clientId: GOOGLE_CLIENT_ID,
        folderId: DRIVE_FOLDER_ID,
        onToast: (t) =>
          toast({
            title: t.type === "success" ? "성공" : t.type === "info" ? "안내" : "오류",
            description: t.message,
            variant: t.type === "error" ? "destructive" : "default",
          }),
      });

      setGdocsLink(downloadUrl);
      setGdocsFileName(fileName);

      // 로그에도 남겨 앱 내부 이력에서 링크 재확인 가능
      onAddLogEntry("GoogleDocs", `생성 완료: ${fileName}\n${downloadUrl}`);
    } catch (error) {
      console.error("Google Docs 내보내기 오류:", error);
      toast({ title: "Google Docs 내보내기 실패", description: "네트워크/권한을 확인 후 다시 시도해주세요.", variant: "destructive" });
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

      {/* Action Bar */}
      {(resultHtml || isProcessing) && (
        <ActionBar
          html={resultHtml}
          loading={isProcessing}
          onPdf={handlePdf}
          onGDocs={handleGDocs}
        />
      )}

      {/* Google Docs 다운로드 링크 표시(생성된 이후에만) */}
      {gdocsLink && (
        <Card className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} mt-4`}>
          <CardContent className="p-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm">Google Docs 문서가 지정된 Google Drive 폴더에 저장되었습니다.</p>
              <a
                href={gdocsLink}
                download={gdocsFileName || undefined}
                className="text-blue-600 underline"
                target="_blank"
                rel="noreferrer"
              >
                {gdocsFileName || "문서 다운로드 (DOCX)"}
              </a>
              <p className="text-xs text-muted-foreground">
                링크는 DOCX 다운로드 전용입니다. (화면 이동 없이 기기에 저장)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 결과/로딩/로그 */}
      {resultHtml ? (
        <Card className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} mt-4`}>
          <CardContent className="p-4">
            <section aria-live="polite" aria-busy={false}>
              <div
                id="report-content"
                className="result-content prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeReportHtml(resultHtml) }}
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
