// src/utils/pdf.ts
// 목적: OCR/스크린샷이 아닌 "브라우저 인쇄 엔진"으로 벡터 PDF 생성
// 범위 제한: 이 파일만 교체. 앱의 나머지 코드는 수정하지 않음.

// ---------- (1) 기존 동작과 호환되는 전처리 유틸 ----------
function stripFenceMarkers(s: string): string {
  return (s || '').replace(/```json\s*/gi, '').replace(/```/g, '');
}
function findBalancedJsonEnd(s: string, start: number): number {
  let d = 0, str = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (str) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') str = false;
    } else {
      if (ch === '"') str = true;
      else if (ch === '{') d++;
      else if (ch === '}') { d--; if (d === 0) return i; }
    }
  }
  return -1;
}
function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}
function inlineJsonBlocksSafe(raw: string): string {
  if (!raw) return '';
  const keys = [
    'final_report_html',
    'precision_verification_html',
    'final_summary_html',
    'final_report',
    'final_summary_text',
  ];
  let out = '', i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch !== '{') { out += ch; i++; continue; }
    const end = findBalancedJsonEnd(raw, i);
    if (end === -1) { out += ch; i++; continue; }
    const block = raw.slice(i, end + 1);
    if (!keys.some(k => block.includes(`"${k}"`))) { out += ch; i++; continue; }
    try {
      const obj = JSON.parse(block);
      const htmlCandidate = [
        (obj as any).final_report_html,
        (obj as any).precision_verification_html,
        (obj as any).final_summary_html,
        (obj as any).final_report,
      ].map((v: any) => (typeof v === 'string' ? v.trim() : v)).find(nonEmpty);
      const summary = nonEmpty((obj as any).final_summary_text)
        ? `<p>${String((obj as any).final_summary_text).trim()}</p>` : '';
      const replacement = nonEmpty(htmlCandidate)
        ? (summary ? htmlCandidate + summary : htmlCandidate)
        : summary;
      out += replacement || '';
      i = end + 1;
    } catch {
      out += ch; i++;
    }
  }
  return out;
}

// ---------- (2) 핵심: 프린트 엔진 경로 ----------
/**
 * 인쇄 엔진을 이용해 PDF로 저장(사용자가 인쇄 대화상자에서 "PDF로 저장" 선택)
 * - 라이트 테마 강제, A4 규격, 흰 배경/검정 본문/포인트 블루만 허용
 * - 앱의 다크/전역 CSS 영향 차단
 */
export async function downloadPdfFromHtml(html: string, filename: string) {
  const fileBase = (filename || 'report').replace(/[\\/:*?"<>|]+/g, '_').replace(/\.+$/, '');
  const pre = stripFenceMarkers(html || '');
  const cleanedHtml = inlineJsonBlocksSafe(pre);

  // 오프스크린 iframe 생성
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.style.background = '#ffffff';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  // 프린트 전용 CSS: 라이트 강제 + A4 + 가독성 색상
  const PRINT_CSS = `
@page { size: A4; margin: 18mm 16mm; }
:root { color-scheme: light; }
html, body { background: #ffffff !important; }
* { box-shadow: none !important; text-shadow: none !important; }
body {
  margin: 0;
  font-family: 'Malgun Gothic','맑은 고딕',system-ui,-apple-system,sans-serif;
  line-height: 1.7; font-weight: 400; color: #111111 !important;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.prose { max-width: none; margin: 0; padding: 0; }

/* 모든 텍스트 기본 검정, 배경 투명(흰 바탕 위) */
.prose, .prose * {
  color: #111111 !important;
  background: transparent !important;
}

/* 제목/포인트 블루(샘플 기준) */
.prose h1, .prose h2, .prose h3, .prose h4 {
  font-weight: 700; page-break-after: avoid; color: #111111 !important;
  margin: 0;
}
.prose h1 { font-size: 20pt; margin: 24pt 0 12pt 0; color: #000000 !important; }
.prose h2 { font-size: 16pt; margin: 20pt 0 10pt 0; color: #2563EB !important; }
.prose h3 { font-size: 13pt; margin: 16pt 0 8pt 0;  color: #2563EB !important; }
.prose h4 { font-size: 11pt; margin: 14pt 0 7pt 0;  font-weight: 600; }

/* 본문/목록/테이블 */
.prose p { margin: 6pt 0; font-size: 10pt; }
.prose ul, .prose ol { margin: 6pt 0 6pt 20pt; font-size: 10pt; page-break-inside: avoid; }
.prose li { margin-bottom: 4pt; }
.prose ol > li::marker { color: #2563EB !important; font-weight: 700; }

.prose table { width: 100%; border-collapse: collapse; margin: 12pt 0; page-break-inside: avoid; font-size: 9pt; }
.prose th, .prose td { border: 1px solid #cccccc; padding: 6pt; text-align: left; vertical-align: top; }
.prose th { background: #f2f2f2 !important; font-weight: 700; }

/* 카드/박스 */
.prose div[style*="border-radius"], .prose .card, .prose .box, .prose .panel {
  border: 1px solid #e5e7eb !important;
  background: #f9fafb !important;
  padding: 12pt !important;
  margin: 12pt 0 !important;
  border-radius: 8px !important;
}

/* 페이지 분리 안정화 */
.prose div, .prose section, .prose article { page-break-inside: avoid; }
`;

  // 완전한 문서 작성
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${fileBase}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <div class="prose">${cleanedHtml}</div>
  <script>
    // 문서 로드 후 인쇄 호출
    setTimeout(function(){
      try { document.title = ${JSON.stringify(fileBase)}; window.focus(); window.print(); }
      catch(e) { console.error('print failed', e); }
    }, 30);
  </script>
</body>
</html>`);
  doc.close();

  // 인쇄 대화상자가 뜰 시간을 준 뒤 정리
  setTimeout(() => { iframe.remove(); }, 2000);
}
