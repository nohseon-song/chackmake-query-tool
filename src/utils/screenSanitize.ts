// src/utils/screenSanitize.ts
// 화면 렌더 직전에만 적용하는 "쓰레기 제거 + 본문 인라인" 정리기

/** 균형 잡힌 JSON 블록 끝 찾기(문자열/이스케이프/중괄호 깊이 인식) */
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
const nonEmpty = (v: any): v is string => typeof v === "string" && v.trim().length > 0;

/** ```json … ``` 코드펜스 제거 */
function stripCodeFences(s: string) {
  return s.replace(/```(?:json|html)?\s*([\s\S]*?)\s*```/gi, "$1");
}

/** 화면 표시 전용: JSON 오브젝트를 본문에 인라인(삭제 금지, 요약문 포함) */
export function sanitizeForScreen(raw: string): string {
  if (!raw) return "";
  let s = stripCodeFences(raw);

  const keys = [
    "final_report_html",
    "precision_verification_html",
    "final_summary_html",
    "final_report",
    "final_summary_text",
  ];

  let out = "", i = 0, inStr = false, esc = false;
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
      const end = findBalancedJsonEnd(s, i);
      if (end !== -1) {
        const block = s.slice(i, end + 1);
        if (keys.some(k => block.includes(`"${k}"`))) {
          try {
            const obj = JSON.parse(block);
            const htmlCandidate =
              [obj.final_report_html, obj.precision_verification_html, obj.final_summary_html, obj.final_report]
                .map(v => typeof v === "string" ? v.trim() : v)
                .find(nonEmpty);
            const summary = nonEmpty(obj.final_summary_text) ? `<p>${obj.final_summary_text.trim()}</p>` : "";
            const replacement = nonEmpty(htmlCandidate)
              ? (summary ? htmlCandidate + summary : htmlCandidate)
              : summary;
            out += replacement || "";
            i = end + 1;
            continue;
          } catch { /* 파싱 실패 → 원문 유지 */ }
        }
      }
      out += ch; i++; continue;
    }

    out += ch; i++;
  }
  return out;
}

/** 파일명용 장비명 추정기(화면 HTML에서 백업 추출) */
export function inferEquipmentFromHtml(html?: string): string | null {
  if (!html) return null;
  const s = String(html);
  // "대상 설비" 라벨 근처의 단어를 추출
  const m = s.match(/대상\s*설비[^:：]*[:：]\s*([^\s<>\n\r]+)/);
  return m?.[1]?.trim() || null;
}
