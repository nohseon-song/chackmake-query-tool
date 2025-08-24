// src/utils/cleanHtml.ts
// 앱 화면 표시 전, 본문에 섞인 JSON 오브젝트를 안전하게 펼치고 요약문을 반드시 포함.
// PDF/Google Docs 생성 코드는 그대로 두고, 화면 렌더링에만 사용해 가독성 문제를 차단.

function findBalancedJsonEnd(s: string, start: number) {
  let d = 0, str = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (str) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === "\"") str = false;
    } else {
      if (ch === "\"") str = true;
      else if (ch === "{") d++;
      else if (ch === "}") { d--; if (d === 0) return i; }
    }
  }
  return -1;
}
function nonEmpty(v: unknown): v is string { return typeof v === "string" && v.trim().length > 0; }

function inlineJsonBlocksSafe(raw: string): string {
  if (!raw) return "";
  const keys = [
    "final_report_html",
    "precision_verification_html",
    "final_summary_html",
    "final_report",
    "final_summary_text",
  ];
  let out = "", i = 0; const s = raw;

  while (i < s.length) {
    const ch = s[i];
    if (ch !== "{") { out += ch; i++; continue; }

    const end = findBalancedJsonEnd(s, i);
    if (end === -1) { out += ch; i++; continue; }

    const block = s.slice(i, end + 1);
    if (!keys.some(k => block.includes(`"${k}"`))) {
      out += ch; i++; continue;
    }
    try {
      const obj = JSON.parse(block);
      const htmlCandidate =
        [obj.final_report_html, obj.precision_verification_html, obj.final_summary_html, obj.final_report]
          .map((v: any) => (typeof v === "string" ? v.trim() : v))
          .find(nonEmpty);
      const summary = nonEmpty((obj as any).final_summary_text)
        ? `<p>${String((obj as any).final_summary_text).trim()}</p>` : "";
      const replacement = nonEmpty(htmlCandidate)
        ? (summary ? htmlCandidate + summary : htmlCandidate)
        : summary;
      out += replacement || "";
      i = end + 1;
      continue;
    } catch {
      out += ch; i++; continue;
    }
  }
  return out;
}

function tryExtractFromJsonString(t: string): string {
  if (!(t.startsWith("{") || t.startsWith("["))) return "";
  try {
    const o = JSON.parse(t);
    const picked =
      o?.final_report_html ??
      o?.precision_verification_html ??
      o?.final_summary_html ??
      o?.final_report ??
      (o?.final_summary_text ? `<p>${o.final_summary_text}</p>` : "");
    return picked ? String(picked) : "";
  } catch { return ""; }
}

/** 앱 화면 표시용 클린 HTML */
export function cleanHtmlForApp(raw: string): string {
  const t = (raw ?? "").toString().trim();
  if (!t) return "";
  const inlined = inlineJsonBlocksSafe(t);
  const extracted = tryExtractFromJsonString(inlined);
  return extracted || inlined;
}
