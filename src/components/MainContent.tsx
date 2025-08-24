// src/components/MainContent.tsx
import React, { useState } from 'react'; // ← useState 추가
import { Card, CardContent } from '@/components/ui/card';
import EquipmentSelection from '@/components/EquipmentSelection';
import ReadingsManagement from '@/components/ReadingsManagement';
import ActionButtons from '@/components/ActionButtons';
import LogDisplay from '@/components/LogDisplay';
import ActionBar from '@/components/ActionBar';
import { downloadPdfFromHtml } from '@/utils/pdf';
import { useToast } from '@/hooks/use-toast';

...

const MainContent: React.FC<MainContentProps> = ({
  ...
}) => {
  const { toast } = useToast();

  // ✅ 새로 추가: Google Docs 결과 링크 상태
  const [gdocsLinks, setGdocsLinks] = useState<{
    view?: string;
    docx?: string;
    pdf?: string;
    fileName?: string;
  } | null>(null);

  const handlePdf = () => {
    if (!resultHtml) return;
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const safeEquip = (equipment || "미지정").trim();
      const fileName = `기술진단결과_${safeEquip}_${y}.${m}.${d}`; // 규칙 통일

      downloadPdfFromHtml(resultHtml, fileName);
      toast({ title: "PDF 다운로드", description: "인쇄 대화상자가 열렸습니다." });
    } catch (error) {
      toast({ title: "PDF 다운로드 실패", description: "다시 시도해주세요.", variant: "destructive" });
    }
  };

  // ✅ 교체: 팝업/리다이렉트 제거, 링크만 수집
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
      // 동적 import (기존 구조 유지)
      const mod = await import('@/lib/googleExport');
      const exportFn =
        (mod as any).exportHtmlToGoogleDocs ||
        (mod as any).exportHtmlToGoogleDoc ||
        (mod as any).default;

      if (typeof exportFn !== 'function') {
        throw new Error('export function not found: exportHtmlToGoogleDocs');
      }

      // 파일명 규칙 통일
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const safeEquip = (equipment && equipment.trim()) || '미지정';
      const fileName = `기술진단결과_${safeEquip}_${y}.${m}.${d}`;

      // 👉 핵심: openNewTab/자동이동 사용하지 않음. 링크만 반환.
      const data: { id: string; webViewLink?: string } = await exportFn({
        clientId: GOOGLE_CLIENT_ID,
        folderId: DRIVE_FOLDER_ID,
        html: resultHtml,          // export 모듈에서 HTML 정규화 처리
        equipmentName: safeEquip,  // 파일명 규칙 내부에서도 동일 적용됨
        openNewTab: false,         // 혹시 옵션이 있으면 명시적으로 차단
        onToast: (t: { type: 'success' | 'error' | 'info'; message: string }) =>
          toast({
            title: t.type === 'success' ? '성공' : t.type === 'error' ? '오류' : '안내',
            description: t.message,
            variant: t.type === 'error' ? 'destructive' : 'default'
          }),
      });

      const id = data?.id;
      const view = data?.webViewLink;
      if (!id && !view) {
        toast({
          title: '문서 링크를 받지 못했습니다',
          description: '문서는 생성되었을 수 있으니 Google Drive 폴더를 확인해 주세요.',
          variant: 'destructive'
        });
        return;
      }

      // 다운로드/보기 링크 구성(선택 가능)
      const links = {
        view: view || (id ? `https://docs.google.com/document/d/${id}/edit` : undefined),
        docx: id ? `https://docs.google.com/document/d/${id}/export?format=docx` : undefined,
        pdf:  id ? `https://docs.google.com/document/d/${id}/export?format=pdf`  : undefined,
        fileName,
      };
      setGdocsLinks(links);

      toast({ title: 'Google Docs로 내보내기 완료', description: '지정 폴더에 저장되었습니다.' });
    } catch (err) {
      console.error('Google Docs 내보내기 오류:', err);
      setGdocsLinks(null);
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
      {/* (생략) 기존 카드/폼/버튼 렌더는 동일 */}

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

      {/* ✅ 추가: Google Docs 결과 링크 카드 (앱 화면을 가리지 않고 노출) */}
      {gdocsLinks && (
        <Card className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'} mt-3`}>
          <CardContent className="p-4 space-y-2">
            <p className="font-medium">Google Docs 문서가 생성되었습니다.</p>
            {gdocsLinks.fileName && <p className="text-sm text-muted-foreground">파일명: {gdocsLinks.fileName}</p>}
            <div className="flex flex-wrap gap-3">
              {gdocsLinks.view && (
                <a className="underline text-primary" href={gdocsLinks.view} target="_blank" rel="noopener noreferrer">
                  Google Docs 열기
                </a>
              )}
              {gdocsLinks.docx && (
                <a className="underline" href={gdocsLinks.docx} target="_blank" rel="noopener noreferrer" download>
                  DOCX 다운로드
                </a>
              )}
              {gdocsLinks.pdf && (
                <a className="underline" href={gdocsLinks.pdf} target="_blank" rel="noopener noreferrer" download>
                  PDF 내보내기
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* (나머지 기존 렌더 그대로) */}
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
