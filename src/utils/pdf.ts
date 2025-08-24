// src/utils/pdf.ts
// 새 창 인쇄(파일명 힌트 최우선) + iframe 백업 + 부모 타이틀 임시 변경
// 가독성 CSS 고정 + JSON 블록 안전 치환(본문 삭제 금지)

function parseBlocksAndInline(text: string): string {
  const keys = ["final_report_html","precision_verification_html","final_summary_html","final_report","final_summary_text"];
  if (!text) return "";
  let s = text, out = "";
  let i = 0, inStr = false, esc = false;

  while (i < s.length) {
    const ch = s[i];
    if (inStr) {
      out += ch;
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === "\"") inStr = false;
      i++; continue;
    }
    if (ch === "\"") { inStr = true; out += ch; i++; continue; }
    if (ch === "{") {
      // 균형 잡힌 JSON 블록 찾기
      let j = i, d = 0, str = false, esc2 = false, end = -1;
      while (j < s.length) {
        const cj = s[j];
        if (str) {
          if (esc2) esc2 = false;
          else if (cj === "\\") esc2 = true;
          else if (cj === "\"") str = false;
        } else {
          if (cj === "\"") str = true;
          else if (cj === "{") d++;
          else if (cj === "}") { d--; if (d === 0) { end = j; break; } }
        }
        j++;
      }
      if (end !== -1) {
        const block = s.slice(i, end + 1);
        if (keys.some(k => block.includes(`"${k}"`))) {
          try {
            const obj = JSON.parse(block);
            const rep =
              obj.final_report_html ??
              obj.precision_verification_html ??
              obj.final_summary_html ??
              obj.final_report ??
              (obj.final_summary_text ? `<p>${obj.final_summary_text}</p>` : "");
            out += rep || "";
            i = end + 1;
            continue;
          } catch {/* keep going */}
        }
      }
      out += ch; i++; continue;
    }
    out += ch; i++;
  }
  return out.trim();
}

export function downloadPdfFromHtml(html: string, filename: string) {
  const safeBase = (filename || "report").replace(/[\\/:*?"<>|]+/g, "_").replace(/\.+$/, "");
  const bodyHtml = parseBlocksAndInline((html ?? "").toString());

  const style = `
    <style>
      @page { size: A4; margin: 14mm; }
      html, body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
      body { line-height: 1.6; font-size: 12pt; font-weight: 400; color: #111; }
      strong, b { font-weight: 600; }
      .doc-wrap { max-width: 820px; margin: 0 auto; }
      .prose h1, .prose h2, .prose h3 { margin: 12px 0 8px; font-weight: 700; }
      .prose p { margin: 8px 0; }
      ul, ol { margin: 8px 0 8px 20px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; page-break-inside:auto; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; vertical-align: top; }
      th { background: #f5f5f5; font-weight: 700; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    </style>
  `;
  const htmlDoc = `<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>${safeBase}</title>${style}</head><body><div class="doc-wrap">${bodyHtml}</div></body></html>`;

  // 1) 새 창(파일명 힌트 최우선)
  let w: Window | null = null;
  try { w = window.open("", "_blank", "noopener"); } catch {}
  if (w) {
    try {
      w.document.open(); w.document.write(htmlDoc); w.document.close();
      w.document.title = safeBase;
      w.focus(); w.print();
      return;
    } catch { try { w.close(); } catch {} }
  }

  // 2) 새 창 실패 → iframe + 부모 타이틀 임시 변경
  const oldTitle = document.title;
  document.title = safeBase;

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
      doc.title = safeBase;
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        try { document.title = oldTitle; } catch {}
        URL.revokeObjectURL(url);
        document.body.removeChild(iframe);
      }, 1500);
    }
  };
  iframe.src = url;
}
