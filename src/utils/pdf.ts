// src/utils/pdf.ts
// 히든 iframe 프린트(팝업차단 회피) + 샘플 톤 가독성 + 파일명/JSON 정리

function stripJsonBlocks(text: string, keys = ["precision_verification_html","final_report_html","final_summary_text"]) {
  let t = text ?? "";
  for (const key of keys) {
    let idx = 0;
    while (true) {
      const pos = t.indexOf(`"${key}"`, idx);
      if (pos === -1) break;
      let start = t.lastIndexOf("{", pos);
      if (start < 0) { idx = pos + key.length; continue; }
      let depth = 0, end = -1;
      for (let i = start; i < t.length; i++) {
        const ch = t[i];
        if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end !== -1) { t = t.slice(0, start) + t.slice(end + 1); idx = start; }
      else { idx = pos + key.length; }
    }
  }
  return t;
}

export function downloadPdfFromHtml(html: string, filename: string) {
  try {
    const safeBase = (filename || "report")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\.+$/, "");

    const bodyHtml = stripJsonBlocks((html ?? "").toString());

    const style = `
      <style>
        @page { size: A4; margin: 14mm; }
        html, body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
        body { line-height: 1.6; font-size: 12pt; font-weight: 400; color: #111; }
        strong, b { font-weight: 600; }
        .prose { max-width: none; }
        .prose h1, .prose h2, .prose h3 { margin: 12px 0 8px; font-weight: 700; }
        .prose p { margin: 8px 0; }
        ul, ol { margin: 8px 0 8px 20px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; page-break-inside:auto; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; vertical-align: top; }
        th { background: #f5f5f5; font-weight: 700; }
        tr { page-break-inside: avoid; page-break-after: auto; }
      </style>
    `;

    const htmlDoc = `<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>${safeBase}</title>${style}</head><body>${bodyHtml}</body></html>`;
    const blob = new Blob([htmlDoc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0"; iframe.style.bottom = "0";
    iframe.style.width = "0"; iframe.style.height = "0"; iframe.style.border = "0";
    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument!;
        doc.open(); doc.write(htmlDoc); doc.close();
        doc.title = safeBase;               // 파일명 힌트
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          URL.revokeObjectURL(url);
          document.body.removeChild(iframe);
        }, 1500);
      }
    };
    iframe.src = url;
  } catch {
    /* 호출부에서 토스트 처리 */
  }
}
