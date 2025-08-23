export function downloadPdfFromHtml(html: string, filename: string) {
  // 경량 프린트 PDF (브라우저 인쇄 → PDF 저장)
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(`
    <html><head><meta charset="UTF-8">
    <title>${filename}</title>
    <style> 
      @page{ size: A4; margin: 14mm } 
      body{ margin:0; font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; } 
      .prose { max-width: none; }
      .prose h1, .prose h2, .prose h3 { margin-top: 1em; margin-bottom: 0.5em; }
      .prose p { margin: 0.5em 0; }
      table { width: 100%; border-collapse: collapse; margin: 1em 0; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #f5f5f5; font-weight: bold; }
    </style>
    </head><body>${html}</body></html>
  `);
  w.document.close();
  // 인쇄 대화상자 (사용자 환경에 따라 PDF 저장)
  w.focus();
  w.print();
}