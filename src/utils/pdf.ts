// src/utils/pdf.ts
// 목적: A4 흰 배경 + 검정 본문 + 포인트 블루(#2563EB)로 100% 가독성 PDF 생성
// 범위 제한: 이 파일만 교체. 앱의 다른 부분은 수정 금지.

// ------------------------ 1) html2pdf 동적 로더 ------------------------
const loadHtml2Pdf = () =>
  new Promise((resolve, reject) => {
    if ((window as any).html2pdf) return resolve((window as any).html2pdf);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    s.onload = () => (window as any).html2pdf ? resolve((window as any).html2pdf) : reject(new Error('html2pdf 로드 실패'));
    s.onerror = () => reject(new Error('html2pdf 스크립트 로드 실패'));
    document.head.appendChild(s);
  });

// ------------------------ 2) 기존 전처리 유틸 (그대로 유지) ------------------------
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
      i = end + 1; continue;
    } catch { out += ch; i++; continue; }
  }
  return out;
}

// ------------------------ 3) 색/배경 "중립화" (핵심 추가) ------------------------
/**
 * 원본 HTML의 인라인 색/배경/필터를 제거해 라이트 테마로 강제.
 * 레이아웃 관련 스타일은 유지, 텍스트 강조(strong/b)는 유지.
 */
function neutralizeInlineColors(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root')!;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

  // 제거 대상 클래스 prefix (tailwind/shadcn 등 공통)
  const classDropPrefixes = /^(dark|bg-|text-|from-|to-|via-|fill-|stroke-)/;

  // 순회
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const el = node as HTMLElement;

    // data-theme 등 테마 속성 제거
    el.removeAttribute('data-theme');

    // 인라인 스타일에서 color/background 관련만 제거
    const style = el.getAttribute('style');
    if (style) {
      const cleaned = style
        .replace(/(?:^|;)\s*color\s*:[^;]*;?/gi, '')
        .replace(/(?:^|;)\s*background(?:-color)?\s*:[^;]*;?/gi, '')
        .replace(/(?:^|;)\s*filter\s*:[^;]*;?/gi, '')
        .replace(/(?:^|;)\s*mix-blend-mode\s*:[^;]*;?/gi, '')
        .replace(/(?:^|;)\s*text-shadow\s*:[^;]*;?/gi, '')
        .replace(/;;+/g, ';').replace(/^\s*;\s*|\s*;\s*$/g, '');
      if (cleaned.trim()) el.setAttribute('style', cleaned);
      else el.removeAttribute('style');
    }

    // 색/배경을 강제하는 클래스 제거 (레이아웃 클래스는 유지)
    if (el.className) {
      const kept = el.className
        .split(/\s+/)
        .filter(c => c && !classDropPrefixes.test(c))
        .join(' ');
      if (kept) el.className = kept; else el.removeAttribute('class');
    }
  }

  return root.innerHTML;
}

// ------------------------ 4) 메인: iframe 샌드박스에서 캡처 ------------------------
export async function downloadPdfFromHtml(html: string, filename: string) {
  const fileBase = (filename || 'report').replace(/[\\/:*?"<>|]+/g, '_').replace(/\.+$/, '');
  const html2pdf = await loadHtml2Pdf();

  // 4-1) 전처리
  const pre = stripFenceMarkers(html || '');
  const inlined = inlineJsonBlocksSafe(pre);
  const sanitized = neutralizeInlineColors(inlined);

  // 4-2) 라이트 테마 & 가독성 보장 스타일
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

    /* 전역 리셋 - 배경 투명화, 색은 상속 */
    * { background-image:none !important; mix-blend-mode:normal !important; }
    /* 강조는 굵기만 유지(색 강조는 제목/번호로 제한) */
    strong, b { font-weight:700; color:#000000 !important; }

    .prose { max-width:none; padding:0; margin:0; }
    .prose > :first-child { margin-top:0 !important; padding-top:0 !important; }

    /* 제목/포인트 블루 */
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

    /* 카드/박스(둥근 모서리) */
    div[style*="border-radius"], .card, .box, .panel {
      border:1px solid #e5e7eb !important; background:#f9fafb !important;
      padding:12pt !important; margin:12pt 0 !important; border-radius:8px !important;
    }
  </style>`.trim();

  // 4-3) 샌드박스 iframe
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '794px';   // A4 @96dpi 근사
  iframe.style.height = '1123px';
  iframe.style.background = '#ffffff';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${fileBase}</title>${styleBlock}</head>
<body><div class="prose">${sanitized}</div></body></html>`);
  doc.close();

  // 레이아웃 안정 대기
  await new Promise((r) => setTimeout(r, 50));

  // 4-4) PDF 생성
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
    const textContent = (sanitized || '').replace(/<[^>]+>/g, '\n').replace(/\n\n+/g, '\n\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${fileBase}.txt`; a.click(); URL.revokeObjectURL(url);
    throw new Error('PDF 생성에 실패하여 텍스트 파일로 대체 다운로드합니다.');
  } finally {
    iframe.remove();
  }
}
