// src/utils/pdf.ts
// 경량 프린트 PDF (브라우저 인쇄 → PDF 저장)
// 기존 시그니처를 100% 유지합니다.
export function downloadPdfFromHtml(html: string, filename: string) {
  // 1) 파일명 규칙 보정: 불법문자 치환 + 말단 점 제거
  const safeBase = (filename || "report")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\.+$/, ""); // 끝의 점을 제거하여 "..pdf" 방지

  // 2) 본문 정리: HTML에 섞인 JSON 조각(precision_verification_html 등) 제거
  const sanitize = (raw: string) => {
    let t = (raw ?? "").toString();
    const keys = ["precision_verification_html","final_report_html","final_summary_text"];
    for (const k of keys) {
      const re = new RegExp(
        String.raw`\\?\\?*\{\s*"(?:${k})"\s*:\s*"(?:[\s\S]*?)"\s*(?:,\s*"(?:[\s\S]*?)"\s*:\s*"(?:[\s\S]*?)"\s*)*\}`,
        "g"
      );
      t = t.replace(re, "");
    }
    const rePairs = new RegExp(String.raw`"(?:${keys.join("|")})"\s*:\s*"(?:[\s\S]*?)"`, "g");
    t = t.replace(rePairs, "");
    return t;
  };
  const cleanedHtml = sanitize(html);

  // 3) 새 창 열기(사용자 클릭 이벤트 내에서 호출되면 팝업 차단 회피)
  const w = window.open("", "_blank");
  if (!w) return;

  // 4) 프린트 전용 CSS: 과도한 볼드 방지, 표/문단 가독성 향상
  const style = `
    <style>
      @page { size: A4; margin: 14mm; }
      html, body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
      body { line-height: 1.6; font-size: 12pt; font-weight: 400; color: #111; }
      strong, b { font-weight: 600; }
      .prose { max-width: none; }
      .prose h1, .prose h2, .prose h3 { margin: 12px 0 8px; font-weight: 700; }
      .prose p { margin: 8px 0; }
      ul, ol { margin: 8px 0 8px 20px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; page-break-inside: auto; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; vertical-align: top; }
      th { background-color: #f5f5f5; font-weight: 700; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    </style>
  `;

  // 5) 문서 작성 + 인쇄
  w.document.open();
  w.document.write(`
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${safeBase}</title>
        ${style}
      </head>
      <body>${cleanedHtml}</body>
    </html>
  `);
  w.document.close();

  // 6) 인쇄 대화상자 (사용자 환경 설정에 따라 PDF 저장)
  w.focus();
  try { w.print(); } catch { /* 일부 브라우저 예외 무시 */ }
}
