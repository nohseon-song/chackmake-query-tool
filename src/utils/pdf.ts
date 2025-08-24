// src/utils/pdf.ts
// 기존 시그니처 유지: 새 창 프린트 방식에서, 팝업 차단에 강한 "히든 iframe 프린트"로 변경.
// 파일명 규칙 보정 + 가독성 CSS + JSON 쓰레기 블록 제거까지 포함.

export function downloadPdfFromHtml(html: string, filename: string) {
  try {
    // 1) 파일명 보정(불법문자 제거 + 말단 점 제거)
    const safeBase = (filename || "report")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\.+$/, "");

    // 2) 본문 정리: HTML에 섞인 JSON 조각 제거
    let t = (html ?? "").toString();
    const keys = ["precision_verification_html","final_report_html","final_summary_text"];
    for (const k of keys) {
      const re = new RegExp(
        String.raw`\{\s*"(?:${k})"\s*:\s*"(?:[\s\S]*?)"\s*(?:,\s*"(?:[\s\S]*?)"\s*:\s*"(?:[\s\S]*?)"\s*)*\}`,
        "g"
      );
      t = t.replace(re, "");
    }
    const rePairs = new RegExp(String.raw`"(?:${keys.join("|")})"\s*:\s*"(?:[\s\S]*?)"`, "g");
    t = t.replace(rePairs, "");

    // 3) 프린트용 CSS(샘플 PDF 스타일 참고)
    const style = `
      <style>
        @page { size: A4; margin: 14mm; }
        html, body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
        body { line-height: 1.6; font-size: 12pt; font-weight: 400; color: #111; }
        strong, b { font-weight: 600; } /* 볼드 도배 방지 */
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

    // 4) 히든 iframe에 문서 주입 후 print (팝업 차단 회피)
    const htmlDoc = `<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>${safeBase}</title>${style}</head><body>${t}</body></html>`;
    const blob = new Blob([htmlDoc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0"; iframe.style.bottom = "0";
    iframe.style.width = "0"; iframe.style.height = "0"; iframe.style.border = "0";
    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        const doc = iframe.contentWindow?.document!;
        doc.open(); doc.write(htmlDoc); doc.close();
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
    // 호출측에서 토스트 띄우므로 여기선 조용히 종료
  }
}
