// src/utils/pdf.ts
// 목표: 가독성 100% 유지 + JSON 안전 치환 + "문단 전체 볼드" 해제 + 안정적인 파일명으로 직접 다운로드

// html2pdf.js 라이브러리를 동적으로 로드하는 헬퍼 함수
const loadHtml2Pdf = () => new Promise((resolve, reject) => {
    // 라이브러리가 이미 로드되었는지 확인
    if ((window as any).html2pdf) {
      return resolve((window as any).html2pdf);
    }
    // 스크립트 태그를 동적으로 생성하여 라이브러리 로드
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => {
        if ((window as any).html2pdf) {
            resolve((window as any).html2pdf);
        } else {
            reject(new Error('html2pdf 라이브러리 로드 실패'));
        }
    };
    script.onerror = () => reject(new Error('html2pdf 스크립트 로드 실패'));
    document.head.appendChild(script);
});


// --- 화면 표시용 HTML 정리 유틸리티들 (기존 코드와 동일) ---

function stripFenceMarkers(s: string): string {
  return (s || "").replace(/```json\s*/gi, "").replace(/```/g, "");
}

function findBalancedJsonEnd(s: string, start: number): number {
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
          .map((v: any) => (typeof v === 'string' ? v.trim() : v))
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

function unwrapOverBold(html: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="__root">${html}</div>`, "text/html");
    const root = doc.getElementById("__root");
    if (!root) return html;

    const targets = root.querySelectorAll("p, li, div, section, article");
    targets.forEach((el) => {
      const st = (el as HTMLElement).getAttribute("style") || "";
      if (/font-weight\s*:\s*(700|bold)/i.test(st)) {
        (el as HTMLElement).setAttribute("style", st.replace(/font-weight\s*:\s*(700|bold)\s*;?/ig, ""));
      }
      if (el.children.length === 1) {
        const only = el.children[0] as HTMLElement;
        const tag = only.tagName.toLowerCase();
        if (tag === "strong" || tag === "b") {
          if (!only.querySelector("p,div,section,article,table")) {
            const plain = only.textContent ? only.textContent.trim() : "";
            if (plain.length >= 24) {
              el.innerHTML = only.innerHTML;
            }
          }
        }
      }
    });
    return (root as HTMLElement).innerHTML;
  } catch {
    return html;
  }
}

// --- 메인 PDF 다운로드 함수 ---

export async function downloadPdfFromHtml(html: string, filename: string) {
  const fileBase = (filename || "report").replace(/[\\/:*?"<>|]+/g, "_").replace(/\.+$/, "");

  try {
    const html2pdf = await loadHtml2Pdf();
    
    // 1) 코드펜스 마커 제거 → 2) JSON 안전 치환 → 3) 문단 전체 볼드 언랩
    const pre = stripFenceMarkers(html || "");
    const cleanedHtml = unwrapOverBold(inlineJsonBlocksSafe(pre));

    // PDF로 변환할 전체 HTML 구조 생성
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>${fileBase}</title>
        <style> 
          @page{ size: A4; margin: 14mm; } 
          body{ margin:0; font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; font-weight: 400; color:#111; -webkit-print-color-adjust: exact; } 
          .prose { max-width: none; }
          .prose h1, .prose h2, .prose h3 { margin-top: 1em; margin-bottom: 0.5em; font-weight: 700; page-break-after: avoid; }
          .prose p { margin: 0.5em 0; }
          ul, ol { margin: 0.5em 0 0.5em 1.25em; page-break-inside: avoid; }
          table { width: 100%; border-collapse: collapse; margin: 1em 0; page-break-inside: avoid; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: 700; }
          strong, b { font-weight: 600; }
          div, section, article { page-break-inside: avoid; }
        </style>
      </head>
      <body><div class="prose">${cleanedHtml}</div></body>
      </html>
    `;

    const element = document.createElement('div');
    element.innerHTML = fullHtml;
    
    // PDF 생성 옵션
    const options = {
      margin: 14, // mm 단위
      filename: `${fileBase}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'avoid-all'] }
    };

    // PDF 생성 및 저장 실행
    await (html2pdf as any)().set(options).from(element).save();

  } catch (error) {
    console.error("PDF 생성 실패:", error);
    // PDF 생성 실패 시, 텍스트 파일로 대체 다운로드
    const textContent = html.replace(/<[^>]+>/g, '\n').replace(/\n\n+/g, '\n\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileBase}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    throw new Error("PDF 생성에 실패하여 텍스트 파일로 대체 다운로드합니다.");
  }
}
