// src/utils/pdf.ts
// 가독성은 "기존 최고" 스타일 100% 유지.
// 추가: 본문 중간 JSON 블록을 안전하게 HTML/텍스트로 치환(삭제 금지),
//       인쇄 파일명 힌트 강제(document.title).

/** 균형 잡힌 JSON 블록 끝 위치 찾기(문자열/이스케이프/중괄호 깊이 인식) */
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

/** 본문 중간 JSON 오브젝트를 "필요한 HTML/텍스트"로만 치환(내용 삭제 금지) */
function inlineJsonBlocksSafe(raw: string): string {
  if (!raw) return "";
  const keys = [
    "final_report_html",
    "precision_verification_html",
    "final_summary_html",
    "final_report",
    "final_summary_text",
  ];
  let s = raw;
  let i = 0;
  let out = "";
  let inStr = false, esc = false;

  while (i < s.length) {
    const ch = s[i];

    // 문자열 상태 처리
    if (inStr) {
      out += ch;
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === "\"") inStr = false;
      i++;
      continue;
    }
    if (ch === "\"") { inStr = true; out += ch; i++; continue; }

    // JSON 블록 후보
    if (ch === "{") {
      const end = findBalancedJsonEnd(s, i);
      if (end !== -1) {
        const block = s.slice(i, end + 1);
        // 키가 하나라도 있으면 치환 시도
        if (keys.some(k => block.includes(`"${k}"`))) {
          try {
            const obj = JSON.parse(block);
            const rep =
              obj.final_report_html ??
              obj.precision_verification_html ??
              obj.final_summary_html ??
              obj.final_report ??
              (obj.final_summary_text ? `<p>${obj.final_summary_text}</p>` : "");
            out += rep || "";           // 성공 시 치환(삭제 아님)
            i = end + 1;
            continue;
          } catch {
            // JSON 파싱 실패 → 원문 유지
          }
        }
      }
      // 키가 없거나 파싱 실패 시 원문 그대로
      out += ch; i++; continue;
    }

    // 일반 문자
    out += ch; i++;
  }
  return out;
}

export function downloadPdfFromHtml(html: string, filename: string) {
  // 파일명 안전화: 불법문자/끝점 제거
  const safeName = (filename || "report")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\.+$/, "");

  // 네가 준 "최고 가독성" 스타일 유지 + JSON 안전 치환만 추가
  const cleaned = inlineJsonBlocksSafe(html || "");

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(`
    <html><head><meta charset="UTF-8">
    <title>${safeName}</title>
    <style> 
      @page{ size: A4; margin: 14mm } 
      body{ margin:0; font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; } 
      .prose { max-width: none; }
      .prose h1, .prose h2, .prose h3 { margin-top: 1em; margin-bottom: 0.5em; }
      .prose p { margin: 0.5em 0; }
      ul, ol { margin: 0.5em 0 0.5em 1.25em; }
      table { width: 100%; border-collapse: collapse; margin: 1em 0; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #f5f5f5; font-weight: bold; }
    </style>
    </head><body>${cleaned}</body></html>
  `);
  w.document.close();

  // 인쇄 대화상자 (브라우저가 제목을 파일명으로 쓰도록 힌트 추가)
  try { w.document.title = safeName; } catch {}
  w.focus();
  w.print();
}
