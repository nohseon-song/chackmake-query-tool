// src/utils/pdf.ts
// 목적: A4 흰 배경 + 검정 본문 + 파란 포인트(#2563EB)로 가독성 100% PDF 생성
// 주의: 이 파일만 교체. 앱의 다른 부분은 수정하지 않음.

// ------------------------ 1) html2pdf 동적 로더 (기존 체계 유지) ------------------------
const loadHtml2Pdf = () =>
  new Promise((resolve, reject) => {
    if ((window as any).html2pdf) return resolve((window as any).html2pdf);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => {
      if ((window as any).html2pdf) resolve((window as any).html2pdf);
      else reject(new Error('html2pdf 로드 실패'));
    };
    script.onerror = () => reject(new Error('html2pdf 스크립트 로드 실패'));
    document.head.appendChild(script);
  });

// ------------------------ 2) 내용 전처리 유틸 (현행 로직 보존) ------------------------
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

// ------------------------ 3) 메인: iframe 샌드박스에서 캡처 ------------------------
export async function downloadPdfFromHtml(html: string, filename: string) {
  const fileBase = (filename || 'report').replace(/[\\/:*?"<>|]+/g, '_').replace(/\.+$/, '');
  const html2pdf = await loadHtml2Pdf();

  const pre = stripFenceMarkers(html || '');
  const cleanedHtml = inlineJsonBlocksSafe(pre);

  // 라이트 테마 & 가독성 보장 스타일(샘플 기준)
  const styleBlock = `
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    :root { color-scheme: light; }
    html, body { background:#ffffff !important; }
    body {
      margin:0;
      font-family:'Malgun Gothic','맑은 고딕',system-ui,-apple-system,sans-serif;
      line-height:1.7; font-weight:400; color:#111111 !important;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    * { background-image:none !important; box-shadow:none; filter:none !important; mix-blend-mode:normal !important; }
    :root, .prose, body {
      --background:#ffffff; --foreground:#111111;
      --muted:#f5f5f5; --muted-foreground:#444444;
      --card:#ffffff; --border:#e5e7eb; --ring:#2563EB;
    }
    .prose { max-width:none; padding:0; margin:0; }
    .prose > :first-child { margin-top:0 !important; padding-top:0 !important; }

    /* 제목/포인트 컬러 */
    .prose h1, .prose h2, .prose h3, .prose h4 {
      font-weight:700; page-break-after:avoid; color:#111111 !important;
    }
    .prose h1 { font-size:20pt; margin:24pt 0 12pt; }
    .prose h2 { font-size:16pt; margin:20pt 0 10pt; color:#2563EB !important; }
    .prose h3 { font-size:13pt; margin:16pt 0 8pt;  color:#2563EB !important; }
    .prose h4 { font-size:11pt; margin:14pt 0 7pt;  font-weight:600; }

    /* 본문/목록/테이블 */
    .prose p { margin:6pt 0; font-size:10pt; color:#111111 !important; }
    ul, ol { margin:6pt 0 6pt 20pt; font-size:10pt; page-break-inside:avoid; }
    li { margin-bottom:4pt; }
    ol > li::marker { color:#2563EB !important; font-weight:700; }

    table { width:100%; border-collapse:collapse; margin:12pt 0; page-break-inside:avoid; font-size:9pt; }
    th, td { border:1px solid #e5e7eb; padding:6pt; text-align:left; vertical-align:top; color:#111111 !important; }
    th { background:#f5f5f5 !important; font-weight:700; }

    /* 강조/카드 */
    strong, b { font-weight:700; color:#000000 !important; }
    div[style*="border-radius"], .card, .box, .panel {
      border:1px solid #e5e7eb !important; background:#f9fafb !important;
      padding:12pt !important; margin:12pt 0 !important; border-radius:8px !important;
    }
  </style>`.trim();

  // 1) 샌드박스 iframe 생성(보이지 않게)
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '794px';   // A4 width @96dpi 근사
  iframe.style.height = '1123px'; // A4 height @96dpi 근사
  iframe.style.background = '#ffffff';
  document.body.appendChild(iframe);

  // 2) 완전한 문서 작성
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${fileBase}</title>${styleBlock}</head>
<body><div class="prose">${cleanedHtml}</div></body></html>`);
  doc.close();

  // 3) 레이아웃 안정 대기
  await new Promise((r) => setTimeout(r, 50));

  // 4) PDF 생성
  const options = {
    margin: 0,
    filename: `${fileBase}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'avoid-all'] },
  } as const;

  try {
    await (html2pdf as any)().set(options).from(doc.body).save();
  } catch (err) {
    console.error('PDF 생성 실패:', err);
    const textContent = (html || '').replace(/<[^>]+>/g, '\n').replace(/\n\n+/g, '\n\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${fileBase}.txt`; a.click(); URL.revokeObjectURL(url);
    throw new Error('PDF 생성에 실패하여 텍스트 파일로 대체 다운로드합니다.');
  } finally {
    iframe.remove(); // 생성물 정리
  }
}
