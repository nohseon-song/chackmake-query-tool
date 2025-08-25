// src/utils/pdf.ts
// 목표: 샘플과 동일한 가독성(흰 배경/검정 본문/포인트 블루), 다크테마 상속 차단

// 1) html2pdf 동적 로더 (기존 유지)
const loadHtml2Pdf = () =>
  new Promise((resolve, reject) => {
    if ((window as any).html2pdf) return resolve((window as any).html2pdf);
    const script = document.createElement('script');
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () =>
      (window as any).html2pdf
        ? resolve((window as any).html2pdf)
        : reject(new Error('html2pdf 로드 실패'));
    script.onerror = () => reject(new Error('html2pdf 스크립트 로드 실패'));
    document.head.appendChild(script);
  });

// 2) 내용 정리 유틸 (기존 로직 보존, 안전성만)
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
  const s = raw;
  while (i < s.length) {
    const ch = s[i];
    if (ch !== '{') { out += ch; i++; continue; }
    const end = findBalancedJsonEnd(s, i);
    if (end === -1) { out += ch; i++; continue; }
    const block = s.slice(i, end + 1);
    if (!keys.some(k => block.includes(`"${k}"`))) { out += ch; i++; continue; }
    try {
      const obj = JSON.parse(block);
      const htmlCandidate =
        [obj.final_report_html, obj.precision_verification_html, obj.final_summary_html, obj.final_report]
          .map((v: any) => (typeof v === 'string' ? v.trim() : v))
          .find(nonEmpty);
      const summary = nonEmpty((obj as any).final_summary_text)
        ? `<p>${String((obj as any).final_summary_text).trim()}</p>` : '';
      const replacement = nonEmpty(htmlCandidate)
        ? (summary ? htmlCandidate + summary : htmlCandidate)
        : summary;
      out += replacement || '';
      i = end + 1;
      continue;
    } catch {
      out += ch; i++; continue;
    }
  }
  return out;
}

// 3) 메인 함수 — 라이트 샌드박스에서 캡처
export async function downloadPdfFromHtml(html: string, filename: string) {
  const fileBase = (filename || 'report')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\.+$/, '');

  const html2pdf = await loadHtml2Pdf();

  const pre = stripFenceMarkers(html || '');
  const cleanedHtml = inlineJsonBlocksSafe(pre);

  // 샌드박스 HTML: A4/흰배경/검정 본문/포인트 블루, 다크무력화
  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${fileBase}</title>
<style>
  /* 인쇄 정확도 */
  @page { size: A4; margin: 18mm 16mm; }
  :root { color-scheme: light; }
  html, body { background: #ffffff !important; }
  body {
    margin: 0;
    font-family: 'Malgun Gothic','맑은 고딕',system-ui,-apple-system,sans-serif;
    line-height: 1.7;
    font-weight: 400;
    color: #111111 !important;
    -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
  }

  /* 다크테마/전역 변수 무력화 */
  * {
    background-image: none !important;
    box-shadow: none; filter: none !important; mix-blend-mode: normal !important;
  }
  /* 흔한 CSS 변수 강제 덮어쓰기 (Tailwind/shadcn 등) */
  :root, .prose, body {
    --background: #ffffff; --foreground: #111111;
    --muted: #f5f5f5; --muted-foreground: #444444;
    --card: #ffffff; --border: #e5e7eb; --ring: #2563EB;
  }

  .prose { max-width: none; padding: 0; margin: 0; }
  .prose > :first-child { margin-top: 0 !important; padding-top: 0 !important; }

  /* 제목/포인트 컬러 (샘플 기준) */
  .prose h1, .prose h2, .prose h3, .prose h4 {
    font-weight: 700; page-break-after: avoid; color: #111111 !important;
  }
  .prose h1 { font-size: 20pt; margin: 24pt 0 12pt; }
  .prose h2 { font-size: 16pt; margin: 20pt 0 10pt; color: #2563EB !important; }
  .prose h3 { font-size: 13pt; margin: 16pt 0 8pt;  color: #2563EB !important; }
  .prose h4 { font-size: 11pt; margin: 14pt 0 7pt;  font-weight: 600; }

  /* 본문/목록 */
  .prose p { margin: 6pt 0; font-size: 10pt; color: #111111 !important; }
  ul, ol { margin: 6pt 0 6pt 20pt; font-size: 10pt; page-break-inside: avoid; }
  li { margin-bottom: 4pt; }
  ol > li::marker { color: #2563EB !important; font-weight: 700; }

  /* 테이블 */
  table { width: 100%; border-collapse: collapse; margin: 12pt 0; page-break-inside: avoid; font-size: 9pt; }
  th, td { border: 1px solid #e5e7eb; padding: 6pt; text-align: left; vertical-align: top; color: #111111 !important; }
  th { background: #f5f5f5 !important; font-weight: 700; }

  /* 강조 */
  strong, b { font-weight: 700; color: #000000 !important; }

  /* 카드/박스(둥근 모서리) */
  div[style*="border-radius"],
  .card, .box, .panel {
    border: 1px solid #e5e7eb !important;
    background: #f9fafb !important;
    padding: 12pt !important; margin: 12pt 0 !important; border-radius: 8px !important;
  }

  /* 절대 흰 배경 보장 */
  div, section, article, header, footer { background: #ffffff00; } /* 투명 허용 */
</style>
</head>
<body>
  <div class="prose">${cleanedHtml}</div>
</body>
</html>`.trim();

  // 오프스크린 샌드박스에 붙여 계산 안정화
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px';   // A4 폭(96dpi 환산 근사) - 레이아웃 안정
  container.style.background = '#ffffff';
  container.innerHTML = fullHtml;
  document.body.appendChild(container);

  const options = {
    margin: 0,                           // @page가 담당
    filename: `${fileBase}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'         // 투명 합성 방지
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'avoid-all'] },
  } as const;

  try {
    await (html2pdf as any)().set(options).from(container).save();
  } finally {
    // 반드시 정리
    container.remove();
  }
}
