// src/utils/pdf.ts
// 목표: 가독성 100% 유지 + JSON 안전 치환 + "문장강조 도배" 자동 해제 + 화면 전환 없이 미리보기

/** 균형 잡힌 JSON 블록 끝 위치(문자열/이스케이프/중괄호 깊이 인식) */
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

/** 값이 비어있지 않은 문자열인지 */
function nonEmpty(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** 본문 중간 JSON 오브젝트를 안전하게 치환(삭제 금지, 비어있는 HTML 건너뛰고 요약문은 포함) */
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
  let out = "";
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
      const end = findBalancedJsonEnd(s, i);
      if (end !== -1) {
        const block = s.slice(i, end + 1);
        if (keys.some(k => block.includes(`"${k}"`))) {
          try {
            const obj = JSON.parse(block);
            // 1) 비어있지 않은 HTML 후보
            const htmlCandidate =
              [obj.final_report_html, obj.precision_verification_html, obj.final_summary_html, obj.final_report]
                .map(v => (typeof v === "string" ? v.trim() : v))
                .find(nonEmpty);
            // 2) 요약문은 있으면 반드시 포함
            const summary = nonEmpty(obj.final_summary_text) ? `<p>${obj.final_summary_text.trim()}</p>` : "";

            const replacement = nonEmpty(htmlCandidate)
              ? (summary ? htmlCandidate + summary : htmlCandidate)
              : summary;

            out += replacement || "";   // 절대 삭제하지 않음
            i = end + 1;
            continue;
          } catch {
            // 파싱 실패 → 원문 유지
          }
        }
      }
      out += ch; i++; continue;
    }

    out += ch; i++;
  }
  return out;
}

/** 블록 전체가 <strong>/<b>로 감싸진 "문장강조 도배" 해제 */
function normalizeOverBold(html: string): string {
  if (!html) return "";
  let out = html;

  // 인라인 굵기 강제 제거(700/bold)
  out = out.replace(/font-weight\s*:\s*(700|bold)\s*;?/gi, "");

  const tags = ["p", "li", "div", "section", "article"];
  for (const tag of tags) {
    const reStrong = new RegExp(`<${tag}>(\\s*)<strong>([\\s\\S]*?)<\\/strong>(\\s*)<\\/${tag}>`, "gi");
    out = out.replace(reStrong, (_m, a, body, b) => {
      const plain = String(body).replace(/<\\/?strong>/gi, "");
      const textOnly = plain.replace(/<[^>]*>/g, "").trim();
      // 길이가 충분하고(≥24) 사실상 "전체 강조"면 해제
      if (textOnly.length >= 24) return `<${tag}>${a}${plain}${b}</${tag}>`;
      return _m;
    });

    const reB = new RegExp(`<${tag}>(\\s*)<b>([\\s\\S]*?)<\\/b>(\\s*)<\\/${tag}>`, "gi");
    out = out.replace(reB, (_m, a, body, b) => {
      const plain = String(body).replace(/<\\/?b>/gi, "");
      const textOnly = plain.replace(/<[^>]*>/g, "").trim();
      if (textOnly.length >= 24) return `<${tag}>${a}${plain}${b}</${tag}>`;
      return _m;
    });
  }
  return out;
}

/** 오버레이(앱 내 미리보기) 생성 */
function openOverlayWithIframe(htmlDoc: string, fileBase: string) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.6)";
  overlay.style.zIndex = "999999";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";

  const bar = document.createElement("div");
  bar.style.background = "#111827";
  bar.style.color = "#fff";
  bar.style.padding = "10px 12px";
  bar.style.display = "flex";
  bar.style.alignItems = "center";
  bar.style.gap = "8px";
  bar.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  bar.style.fontSize = "14px";

  const title = document.createElement("div");
  title.textContent = fileBase + ".pdf";
  title.style.flex = "1 1 auto";
  title.style.overflow = "hidden";
  title.style.textOverflow = "ellipsis";
  title.style.whiteSpace = "nowrap";

  const btnSave = document.createElement("button");
  btnSave.textContent = "PDF 저장(인쇄)";
  btnSave.style.background = "#2563eb";
  btnSave.style.color = "#fff";
  btnSave.style.border = "0";
  btnSave.style.padding = "6px 10px";
  btnSave.style.borderRadius = "6px";
  btnSave.style.cursor = "pointer";

  const btnClose = document.createElement("button");
  btnClose.textContent = "닫기";
  btnClose.style.background = "#374151";
  btnClose.style.color = "#fff";
  btnClose.style.border = "0";
  btnClose.style.padding = "6px 10px";
  btnClose.style.borderRadius = "6px";
  btnClose.style.cursor = "pointer";

  bar.appendChild(title);
  bar.appendChild(btnSave);
  bar.appendChild(btnClose);

  const frame = document.createElement("iframe");
  frame.style.flex = "1 1 auto";
  frame.style.border = "0";
  frame.style.width = "100%";
  frame.style.height = "100%";
  frame.setAttribute("sandbox", "allow-modals allow-same-origin allow-top-navigation-by-user-activation allow-forms allow-scripts");

  overlay.appendChild(bar);
  overlay.appendChild(frame);
  document.body.appendChild(overlay);

  let blobUrl: string | null = null;

  try {
    (frame as any).srcdoc = htmlDoc;
  } catch {
    const blob = new Blob([htmlDoc], { type: "text/html;charset=utf-8" });
    blobUrl = URL.createObjectURL(blob);
    frame.src = blobUrl;
  }

  btnSave.onclick = () => {
    try {
      const cw = frame.contentWindow;
      if (!cw) return;
      try { cw.document.title = fileBase; } catch {}
      cw.focus();
      cw.print();
    } catch {}
  };

  btnClose.onclick = () => {
    try { if (blobUrl) URL.revokeObjectURL(blobUrl); } catch {}
    document.body.removeChild(overlay);
  };
}

export function downloadPdfFromHtml(html: string, filename: string) {
  const fileBase = (filename || "report")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\.+$/, "");

  // 1) JSON 안전 치환 → 2) "문장강조 도배" 해제
  const cleaned = normalizeOverBold(inlineJsonBlocksSafe(html || ""));

  const htmlDoc = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>${fileBase}</title>
      <style> 
        /* 네가 주신 "가독성 100%" 기본 스타일 */
        @page{ size: A4; margin: 14mm } 
        body{ margin:0; font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; font-weight:400; color:#111; } 
        .prose { max-width: none; }
        .prose h1, .prose h2, .prose h3 { margin-top: 1em; margin-bottom: 0.5em; font-weight:700; }
        .prose p { margin: 0.5em 0; }
        ul, ol { margin: 0.5em 0 0.5em 1.25em; }
        table { width: 100%; border-collapse: collapse; margin: 1em 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: 700; }
        /* 문단 전체 볼드 방지(부분 강조는 유지) */
        strong, b { font-weight: 600; }
      </style>
    </head>
    <body>${cleaned}</body>
    </html>
  `;

  // 화면 전환 없이 즉시 미리보기
  openOverlayWithIframe(htmlDoc, fileBase);
}
