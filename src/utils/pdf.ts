// src/utils/pdf.ts
// 목표: 샘플과 동일한 100% 가독성, 내용 삭제 버그 해결, 항상 흰 배경으로 출력

// html2pdf.js 라이브러리를 동적으로 로드하는 헬퍼 함수
const loadHtml2Pdf = () => new Promise((resolve, reject) => {
    // 라이브러리가 이미 로드되었는지 확인
    if ((window as any).html2pdf) {
      return resolve((window as any).html2pdf);
    }
    // 스크립트 태그를 동적으로 생성하여 라이브러리 로드
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => {
        if ((window as any).html2pdf) {
            resolve((window as any).html2pdf);
        } else {
            reject(new Error('html2pdf 라이브러리 로드 실패'));
        }
    };
    script.onerror = () => reject(new Error('html2pdf 스크립트 로드 실패'));
    document.head.appendChild(script);
});


// --- HTML 정리 유틸리티들 (내용 삭제 버그를 유발했던 unwrapOverBold 함수 제거) ---

function stripFenceMarkers(s: string): string {
  return (s || "").replace(/```json\s*/gi, "").replace(/```/g, "");
}

function findBalancedJsonEnd(s: string, start: number): number {
  let d = 0, str = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (str) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === "\"") str = false;
    } else {
      if (ch === "\"") str = true;
      else if (ch === "{") d++;
      else if (ch === "}") { d--; if (d === 0) return i; }
    }
  }
  return -1;
}

function nonEmpty(v: unknown): v is string { return typeof v === "string" && v.trim().length > 0; }

function inlineJsonBlocksSafe(raw: string): string {
  if (!raw) return "";
  const keys = [
    "final_report_html",
    "precision_verification_html",
    "final_summary_html",
    "final_report",
    "final_summary_text",
  ];
  let out = "", i = 0; const s = raw;

  while (i < s.length) {
    const ch = s[i];
    if (ch !== "{") { out += ch; i++; continue; }

    const end = findBalancedJsonEnd(s, i);
    if (end === -1) { out += ch; i++; continue; }

    const block = s.slice(i, end + 1);
    if (!keys.some(k => block.includes(`"${k}"`))) {
      out += ch; i++; continue;
    }
    try {
      const obj = JSON.parse(block);
      const htmlCandidate =
        [obj.final_report_html, obj.precision_verification_html, obj.final_summary_html, obj.final_report]
          .map((v: any) => (typeof v === 'string' ? v.trim() : v))
          .find(nonEmpty);
      const summary = nonEmpty((obj as any).final_summary_text)
        ? `<p>${String((obj as any).final_summary_text).trim()}</p>` : "";
      const replacement = nonEmpty(htmlCandidate)
        ? (summary ? htmlCandidate + summary : htmlCandidate)
        : summary;
      out += replacement || "";
      i = end + 1;
      continue;
    } catch {
      out += ch; i++; continue;
    }
  }
  return out;
}


// --- 메인 PDF 다운로드 함수 ---

export async function downloadPdfFromHtml(html: string, filename: string) {
  const fileBase = (filename || "report").replace(/[\\/:*?"<>|]+/g, "_").replace(/\.+$/, "");

  try {
    const html2pdf = await loadHtml2Pdf();
    
    // 🚀 수정된 부분: unwrapOverBold 함수를 제거하여 내용 삭제 버그 해결
    const pre = stripFenceMarkers(html || "");
    const cleanedHtml = inlineJsonBlocksSafe(pre);

    // 🚀 수정된 부분: 샘플 PDF와 동일한 스타일 적용
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>${fileBase}</title>
        <style> 
          /* A4 용지 크기와 여백 설정 */
          @page {
            size: A4;
            margin: 18mm 16mm; /* 상하 18mm, 좌우 16mm 여백 */
          } 
          /* 인쇄를 위한 기본 스타일 (항상 흰 배경, 검은 글씨) */
          body { 
            margin: 0; 
            font-family: 'Malgun Gothic', '맑은 고딕', system-ui, -apple-system, sans-serif; 
            line-height: 1.7; 
            font-weight: 400; 
            color: #333333 !important; /* 글자색 검정 강제 */
            background-color: #ffffff !important; /* 배경색 흰색 강제 */
            -webkit-print-color-adjust: exact; 
          } 
          /* 내용이 페이지 상단에서 시작하도록 보정 */
          .prose { 
            max-width: none; 
            padding: 0;
            margin: 0;
          }
          .prose > :first-child {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          .prose h1, .prose h2, .prose h3, .prose h4 { 
            font-weight: 700; 
            page-break-after: avoid; 
            color: #111111 !important;
          }
          .prose h1 { font-size: 20pt; margin: 24pt 0 12pt 0; }
          .prose h2 { font-size: 16pt; margin: 20pt 0 10pt 0; }
          .prose h3 { font-size: 13pt; margin: 16pt 0 8pt 0; }
          .prose p { margin: 6pt 0; font-size: 10pt; }
          ul, ol { margin: 6pt 0 6pt 20pt; font-size: 10pt; page-break-inside: avoid; }
          li { margin-bottom: 4pt; }
          table { width: 100%; border-collapse: collapse; margin: 12pt 0; page-break-inside: avoid; font-size: 9pt; }
          th, td { border: 1px solid #cccccc; padding: 6pt; text-align: left; }
          th { background-color: #f2f2f2 !important; font-weight: 700; }
          strong, b { font-weight: 600; }
          div, section, article { page-break-inside: avoid; }
        </style>
      </head>
      <body><div class="prose">${cleanedHtml}</div></body>
      </html>
    `;

    const element = document.createElement('div');
    element.innerHTML = fullHtml;
    
    const options = {
      margin: 0, // @page에서 여백을 제어하므로 0으로 설정
      filename: `${fileBase}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'avoid-all'] }
    };

    await (html2pdf as any)().set(options).from(element).save();

  } catch (error) {
    console.error("PDF 생성 실패:", error);
    // PDF 생성 실패 시, 텍스트 파일로 대체 다운로드
    const textContent = html.replace(/<[^>]+>/g, '\n').replace(/\n\n+/g, '\n\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileBase}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    throw new Error("PDF 생성에 실패하여 텍스트 파일로 대체 다운로드합니다.");
  }
}
