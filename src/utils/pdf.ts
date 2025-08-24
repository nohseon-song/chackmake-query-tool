// src/utils/pdf.ts
// 새 창 인쇄(파일명 힌트 최우선) + iframe 백업, 샘플 톤 CSS, 안전 JSON 인라인

function findBalancedJsonEnd(s: string, start: number) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === "\"") inStr = false;
      continue;
    }
    if (ch === "\"") inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function inlineJsonObjects(text: string) {
  const keys = ["precision_verification_html","final_report_html","final_summary_html","final_report","final_summary_text"];
  let s = text ?? "";
  let idx = 0;
  while (true) {
    let pos = -1, key = "";
    for (const k of keys) {
      const p = s.indexOf(`"${k}"`, idx);
      if (p !== -1 && (pos === -1 || p < pos)) { pos = p; key = k; }
    }
    if (pos === -1) break;
    const brace = s.indexOf("{", pos);
    if (brace === -1) { idx = pos + key.length; continue; }
    const end = findBalancedJsonEnd(s, brace);
    if (end === -1) { idx = pos + key.length; continue; }
    const jsonStr = s.slice(brace, end + 1);
    try {
      const obj = JSON.parse(jsonStr);
      const html =
        obj.final_report_html ?? obj.precision_verification_html ??
        obj.final_summary_html ?? obj.final_report ??
        (obj.final_summary_text ? `<div>${obj.final_summary_text}</div>` : "");
      s = s.slice(0, brace) + (html ?? "") + s.slice(end + 1);
      idx = brace + (html ? String(html).length : 0);
    } catch { idx = end + 1; }
  }
  return s;
}

export function downloadPdfFromHtml(html: string, filename: string) {
  const safeBase = (filename || "report").replace(/[\\/:*?"<>|]+/g, "_").replace(/\.+$/, "");
  const bodyHtml = inlineJsonObjects((html ?? "").toString());

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

  // 1) 새 창 시도(파일명 힌트 최우선)
  let w: Window | null = null;
  try { w = window.open("", "_blank", "noopener"); } catch {}
  if (w) {
    try {
      w.document.open(); w.document.write(htmlDoc); w.document.close();
      w.document.title = safeBase;
      w.focus(); w.print();
      return;
    } catch {
      try { w.close(); } catch {}
    }
  }

  // 2) 새 창 실패 → iframe 백업
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
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(iframe); }, 1500);
    }
  };
  iframe.src = url;
}
