import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import EquipmentSelection from '@/components/EquipmentSelection';
import ReadingsManagement from '@/components/ReadingsManagement';
import ActionButtons from '@/components/ActionButtons';
import LogDisplay from '@/components/LogDisplay';
import ActionBar from '@/components/ActionBar';
import { downloadPdfFromHtml } from '@/utils/pdf';
import { useToast } from '@/hooks/use-toast';

interface Reading { equipment: string; class1: string; class2: string; design: string; measure: string; }
interface LogEntry { id: string; tag: string; content: string; isResponse?: boolean; timestamp: number; }

interface MainContentProps {
  equipment: string; class1: string; class2: string;
  equipmentTree: Record<string, any>;
  savedReadings: Reading[]; logs: LogEntry[];
  resultHtml: string; isProcessing: boolean; isDark: boolean; tempMessagesCount: number;
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
  equipment, class1, class2, equipmentTree, savedReadings, logs, resultHtml,
  isProcessing, isDark, tempMessagesCount, onEquipmentChange, onClass1Change, onClass2Change,
  onSaveReading, onUpdateReading, onDeleteReading, onSubmit, onDeleteLog, onDownloadPdf,
  onGoogleAuth, onChatOpen, onAddLogEntry
}) => {
  const { toast } = useToast();
  const [docxLink, setDocxLink] = useState<{ url: string; name: string } | null>(null);

  // HTML에서 설비명 힌트 찾기 (추가 보정)
  const guessFromHtml = (html: string): string | null => {
    if (!html) return null;
    const m = html.match(/대상\s*설비[^:：]*[:：]\s*([^\s<]+)/);
    return m?.[1]?.trim() || null;
  };

  // 설비명 보정: 선택값 → HTML 힌트 → 마지막 저장값 → '미지정'
  const resolveEquipmentName = () => {
    const a = (equipment || "").trim();
    if (a) return a;
    const b = guessFromHtml(resultHtml);
    if (b) return b;
    const c = savedReadings?.length ? (savedReadings[savedReadings.length - 1].equipment || "").trim() : "";
    return c || "미지정";
  };

  const handlePdf = () => {
    if (!resultHtml) return;
    try {
      const now = new Date();
      const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, "0"), d = String(now.getDate()).padStart(2, "0");
      const eq = resolveEquipmentName();
      const fileName = `기술진단결과_${eq}_${y}.${m}.${d}`;
      downloadPdfFromHtml(resultHtml, fileName);
      toast({ title: "PDF 다운로드", description: "인쇄 대화상자가 열렸습니다." });
    } catch {
      toast({ title: "PDF 다운로드 실패", description: "다시 시도해주세요.", variant: "destructive" });
    }
  };

  // Drive 링크는 노출하지 않고 DOCX만 기기 저장
  const handleGDocs = async () => {
    if (!resultHtml) { toast({ title: '내보낼 보고서가 없습니다.', variant: 'destructive' }); return; }
    const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
    const DRIVE_FOLDER_ID = import.meta.env.VITE_DRIVE_TARGET_FOLDER_ID as string;
    if (!GOOGLE_CLIENT_ID) { toast({ title: 'Google Client ID가 설정되지 않았습니다.', variant: 'destructive' }); return; }

    try {
      const mod = await import('@/lib/googleExport');
      const exportFn = (mod as any).exportHtmlToGoogleDocs || (mod as any).exportHtmlToGoogleDoc || (mod as any).default;
      if (typeof exportFn !== 'function') throw new Error('export function not found');

      const t = new Date();
      const y = t.getFullYear(), m = String(t.getMonth() + 1).padStart(2, '0'), d = String(t.getDate()).padStart(2, '0');
      const eq = resolveEquipmentName();
      const fileName = `기술진단결과_${eq}_${y}.${m}.${d}`;

      const res: any = await exportFn({
        clientId: GOOGLE_CLIENT_ID,
        folderId: DRIVE_FOLDER_ID,
        html: resultHtml,
        equipmentName: eq,
        fileName,
        onToast: (t: { type: 'success' | 'error' | 'info'; message: string }) =>
          toast({
            title: t.type === 'success' ? '성공' : t.type === 'error' ? '오류' : '안내',
            description: t.message,
            variant: t.type === 'error' ? 'destructive' : 'default'
          })
      });

      const dl = res?.download;
      if (dl?.blobUrl && dl?.fileName) {
        const a = document.createElement('a');
        a.href = dl.blobUrl; a.download = dl.fileName;
        document.body.appendChild(a); a.click(); a.remove();
        setDocxLink({ url: dl.blobUrl, name: dl.fileName });
        toast({ title: '문서 저장 완료', description: '기기에 DOCX 파일이 저장되었습니다.' });
        setTimeout(() => { try { URL.revokeObjectURL(dl.blobUrl); } catch {} }, 120000);
      } else {
        toast({ title: '문서 링크 생성 실패', description: 'Google Drive 폴더에는 저장되었습니다.', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Google Docs 내보내기 오류:', err);
      toast({ title: 'Google Docs 내보내기 실패', description: '네트워크/권한을 확인 후 다시 시도해주세요.', variant: 'destructive' });
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
            equipment={equipment} class1={class1} class2={class2}
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
            equipment={equipment} class1={class1} class2={class2}
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

      {docxLink && (
        <Card className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} mt-4`}>
          <CardContent className="p-4">
            <p className="mb-2 font-medium">문서가 기기에 저장되었습니다.</p>
            <a className="text-blue-600 underline break-all" href={docxLink.url} download={docxLink.name}>
              DOCX 다시 받기
            </a>
          </CardContent>
        </Card>
      )}

      {resultHtml ? (
        <Card className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} mt-4`}>
          <CardContent className="p-4">
            <section aria-live="polite" aria-busy={false}>
              <div id="report-content" className="result-content prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: resultHtml }} />
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
          logs={logs} isDark={isDark} equipment={equipment}
          onDeleteLog={onDeleteLog}
          onDownloadPdf={onDownloadPdf}
          onGoogleAuth={onGoogleAuth ? (html) => onGoogleAuth(html, resolveEquipmentName()) : undefined}
        />
      )}
    </main>
  );
};
export default MainContent;
