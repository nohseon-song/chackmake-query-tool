// src/components/MainContent.tsx
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import EquipmentSelection from "@/components/EquipmentSelection";
import ReadingsManagement from "@/components/ReadingsManagement";
import ActionButtons from "@/components/ActionButtons";
import LogDisplay from "@/components/LogDisplay";
import ActionBar from "@/components/ActionBar";
import { downloadPdfFromHtml } from "@/utils/pdf";
import { useToast } from "@/hooks/use-toast";

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
  /**
   * 선택: 외부에서 Google Docs 내보내기를 직접 처리하고 싶을 때 주입
   * (없으면 내부 버튼은 비활성/미사용 처리)
   */
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
  onAddLogEntry,
}) => {
  const { toast } = useToast();

  // PDF 다운로드: 기존 pdf 유틸 그대로 사용 (파일명 규칙은 pdf 유틸에서 처리)
  const handlePdf = () => {
    if (!resultHtml) {
      toast({ title: "PDF 다운로드", description: "내보낼 보고서가 없습니다.", variant: "destructive" });
      return;
    }
    try {
      // 내부 유틸이 파일명 규칙을 적용하도록 유지
      downloadPdfFromHtml(resultHtml);
      toast({ title: "PDF 다운로드", description: "인쇄(저장) 대화상자가 열렸습니다." });
    } catch {
      toast({ title: "PDF 다운로드 실패", description: "다시 시도해주세요.", variant: "destructive" });
    }
  };

  // Google Docs 내보내기: 외부 핸들러가 주입된 경우에만 사용
  const handleGDocs = async () => {
    if (!resultHtml) {
      toast({ title: "내보낼 보고서가 없습니다.", variant: "destructive" });
      return;
    }
    if (!onGoogleAuth) {
      toast({
        title: "Google Docs",
        description: "현재 빌드에서는 Google Docs 내보내기 핸들러가 설정되어 있지 않습니다.",
        variant: "destructive",
      });
      return;
    }
    try {
      await onGoogleAuth(resultHtml, equipment);
    } catch (e: any) {
      // 내부 예외는 여기서 완충
      console.error("Google Docs 내보내기 오류:", e);
      toast({
        title: "Google Docs 내보내기 실패",
        description: "네트워크/권한을 확인 후 다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };

  const selectedEquipment = equipmentTree[equipment as keyof typeof equipmentTree];
  const selectedClass1 = selectedEquipment?.[class1 as keyof typeof selectedEquipment];
  const showInputs = Boolean(class2 && selectedClass1);

  return (
    <main className="flex-1 overflow-y-auto p-3 pb-24">
      <Card className={`${isDark ? "bg-gray-800 border-gray-700" : "bg-white"} mt-4`}>
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
        <Card className={`${isDark ? "bg-gray-800 border-gray-700" : "bg-white"} mt-4`}>
          <CardContent className="p-4">
            <section aria-live="polite" aria-busy={false}>
              <div
                id="report-content"
                className="result-content prose dark:prose-invert max-w-none"
                // 서버에서 온 HTML 그대로 렌더: 스타일/가독성 유지
                dangerouslySetInnerHTML={{ __html: resultHtml }}
              />
            </section>
          </CardContent>
        </Card>
      ) : isProcessing ? (
        <Card className={`${isDark ? "bg-gray-800 border-gray-700" : "bg-white"} mt-4`}>
          <CardContent className="p-4">
            <section aria-live="polite" aria-busy={true}>
              <div className="flex flex-col items-center justify-center p-8 space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
