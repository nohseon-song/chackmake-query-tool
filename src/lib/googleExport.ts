 type ExportOptions = {
-  html: string;
-  equipmentName: string;
+  html: string;
+  equipmentName?: string;      // 선택값
+  fileName?: string;           // 명시 파일명 우선 적용
   clientId: string;
   folderId: string;
-  openNewTab?: boolean;
   onToast?: (p: { type: "success" | "error" | "info"; message: string }) => void;
 };

+// HTML 정규화: JSON이면 필요한 섹션만 결합, 아니면 토큰 라인 제거
+function normalizeHtml(input: string): string {
+  try {
+    const j = JSON.parse(input);
+    const keys = [
+      'diagnosis_summary_html',
+      'complementary_summary_html',
+      'precision_verification_html',
+      'final_summary_html',
+      'final_report_html',
+      'final_summary_text'
+    ];
+    const parts = keys.map(k => (j?.[k] ?? '')).filter(s => typeof s === 'string' && s.trim());
+    if (parts.length) return parts.join('');
+  } catch {}
+  // 토큰 패턴 제거
+  return input
+    .replace(/^\s*\{?\s*"?(precision_verification_html|final_report_html|final_summary_text)"?\s*:?.*$/gmi, '')
+    .replace(/^\s*\}\s*$/gm, '');
+}
+
 function fmtDateYYYYMMDD(d = new Date()) {
   const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
   return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`;
 }
 
 export async function exportHtmlToGoogleDoc(opts: ExportOptions) {
-  const { html, equipmentName, clientId, folderId, openNewTab, onToast } = opts;
+  const { html, equipmentName, fileName, clientId, folderId, onToast } = opts;
+  const cleanedHtml = normalizeHtml(html);
 
   // ... (기존 OAuth 토큰 획득 로직 그대로)
 
-  // 1) 문서 생성 (제목 자동)
-  const title = `기술진단결과_${(equipmentName || '미지정').trim()}_${fmtDateYYYYMMDD()}`;
+  // 1) 문서 생성 (명시 fileName 우선, 없으면 규칙 생성)
+  const title = (fileName && fileName.trim())
+    ? fileName.trim()
+    : `기술진단결과_${(equipmentName || '미지정').trim()}_${fmtDateYYYYMMDD()}`;
   const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
     method: 'POST',
     headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
     body: JSON.stringify({ title })
   });
   // ... (에러 처리 동일)
 
-  // 2) 본문 반영: 기존 변환 로직 사용하되 cleanedHtml 사용
-  const requests = convertHtmlToGoogleDocsRequests(html);
+  // 2) 본문 반영: cleanedHtml 사용
+  const requests = convertHtmlToGoogleDocsRequests(cleanedHtml);
   await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, { ... });
 
   // 3) 드라이브 권한/링크/폴더 이동 (기존 동일)
   // webViewLink 확보
-  // 6) 링크 열기(현재는 자동 이동)
-  if (data.webViewLink) { ... window.location.assign(data.webViewLink) ... }
-
-  onToast?.({ type: "success", message: "Google Docs로 내보내기 완료" });
-  return data;
+  const pdfLink  = `https://docs.google.com/document/d/${docId}/export?format=pdf`;
+  const docxLink = `https://docs.google.com/document/d/${docId}/export?format=docx`;
+  onToast?.({ type: "success", message: "Google Docs로 내보내기 완료 (화면에 다운로드 링크 표시됨)" });
+  // **자동 이동 금지** → 링크만 반환
+  return { ...data, docId, exportPdfLink: pdfLink, exportDocxLink: docxLink };
 }
