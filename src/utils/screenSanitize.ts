// src/utils/screenSanitize.ts
// 목적: 화면 표시 전용 정리(쓰레기 제거). PDF/Docs 변환 로직에는 영향 X.

// 코드펜스 마커만 제거(내용은 보존)
function stripFenceMarkers(s: string): string {
  if (!s) return "";
  // ```json, ``` → 마커만 삭제
  return s.replace(/```json\s*/gi, "").replace(/```/g, "");
}

// 값이 "비어있지 않은 문자열"인지
function nonEmpty(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** 본문 중간 JSON 오브젝트를 안전하게 치환(삭제 금지, 비어있는 HTML 건너뜀, 요약문은 포함) */
function inlineJsonBlocksSafe(raw: string): string {
  if (!raw) return "";
  let s = stripFenceMarkers(raw);

  const keys = [
    "final_report_html",
    "precision_verification_html",
    "final_summary_html",
    "final_report",
    "final_summary_text",
  ];

  let out = "";
  let i = 0, inStr = false, esc = false;

  function findBalancedJsonEnd(str: string, start: number) {
    let depth = 0, _in = false, _esc = false;
    for (let k = start; k < str.length; k++) {
      const ch = str[k];
      if (_in) {
        if (_esc) _esc = false;
        else if (ch === "\\") _esc = true;
        else if (ch === "\"") _in = false;
        continue;
      }
      if (ch === "\"") _in = true;
      else if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) return k; }
    }
    return -1;
  }

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
                .map((v: any) => (typeof v === "string" ? v.trim() : v))
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

/** 화면 표시용 정리 함수 (MainContent에서 사용) - Always sanitized with DOMPurify */
export function sanitizeForScreen(raw: string): string {
  if (!raw) return "";
  // 코드펜스 제거 후 JSON 안전 인라인
  const processed = inlineJsonBlocksSafe(raw);
  
  // Always use DOMPurify to sanitize HTML before rendering
  if (typeof window !== 'undefined' && (window as any).DOMPurify) {
    return (window as any).DOMPurify.sanitize(processed);
  }
  
  return processed;
}

/** 화면에서 파일명 규칙용 장비명 추정(없으면 null) */
export function inferEquipmentFromHtml(html: string): string | null {
  if (!html) return null;
  const m = html.match(/대상\s*설비[^:：]*[:：]\s*([^\s<]+)/);
  return m?.[1]?.trim() || null;
}
