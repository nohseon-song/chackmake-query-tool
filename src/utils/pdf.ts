// src/utils/pdf.ts
// 의존성 없음. 인쇄 IFrame으로 PDF 저장(브라우저 인쇄 대화상자)

function sanitizeForPrint(raw: string): string {
  if (!raw) return "";
  let html = raw.toString();

  // JSON/키 토큰 제거
  html = html.replace(
    /{"\s*(?:precision_verification_html|final_report_html|final_summary_text)"\s*:\s*"[\s\S]*?"\s*}/g,
    ""
  );
  html = html.replace(/["{]?(?:precision_verification_html|final_report_html|final_summary_text)["}]?:?/g, "");

  return html.trim();
}

export function downloadPdfFromHtml(html: string, fileName = "report") {
  const body = sanitizeForPrint(html);

  const doc = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>${fileName}</title>
    <style>
      @page { size: A4; margin: 16mm; }
      body{ font-family: system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,Noto Sans KR,Pretendard,Arial,sans-serif;
            font-size: 12pt; line-height: 1.6; color:#111; }
      h1{ font-size: 20pt; font-weight: 700; margin:0 0 12pt; }
      h2{ font-size: 16pt; font-weight: 700; margin:14pt 0 8pt; }
      h3{ font-size: 14pt; font-weight: 700; margin:12pt 0 6pt; }
      p{ margin: 0 0 8pt
