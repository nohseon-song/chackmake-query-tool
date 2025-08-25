// src/utils/pdf.ts
// 목표: A4 흰 배경 + 검정 글자 + 파란 제목(샘플 톤) 고정, 내용 누락 방지, 앱 나머지 영향 0

// html2pdf.js 동적 로더 (변경 없음)
const loadHtml2Pdf = () =>
  new Promise((resolve, reject) => {
    if ((window as any).html2pdf) return resolve((window as any).html2pdf);
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.onload = () => {
      if ((window as any).html2pdf) resolve((window as any).html2pdf);
      else reject(new Error("html2pdf 라이브러리 로드 실패"));
    };
    script.onerror = () => reject(new Error("html2pdf 스크립트 로드 실패"));
    document.head.appendChild(script);
  });

// ---------- 내용 누락 방지: 유틸 ----------
function stripFenceMarkers(s: string): string {
  return (s || "")
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "");
}
function findBalancedJsonEnd(s: string, start: number): number {
  let d = 0, str = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (str) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') str = false;
    } else {
      if (ch === '"') str = true;
      else if (ch === "{") d++;
      else if (ch === "}") { d--; if (d === 0) return i; }
    }
  }
  return -1;
}
function nonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function inlineJsonBlocksSafe(raw: string): string {
  if (!raw) return "";
  const keys = [
    "final_report_html",
    "precision_verification_html",
    "final_summary_html",
    "final_report",
    "final_summary_text",
  ];
  let out = "", i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch !== "{") { out += ch; i++; continue; }
    const end = findBalancedJsonEnd(raw, i);
    if (end === -1) { out += ch; i++; continue; }
    const block = raw.slice(i, end + 1);
    if (!keys.some(k => block.includes(`"${k}"`))) { // 정확 매칭
      out += ch; i++; continue;
    }
    try {
      const obj = JSON.parse(block);
      const htmlCandidate = [
        (obj as any).final_report_html,
        (obj as any).precision_verification_html,
        (obj as any).final_summary_html,
        (obj as any).final_report,
      ].map((v: any) => (typeof v === "string" ? v.trim() : v)).find(nonEmpty);
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

// ---------- 메인 ----------
export async function downloadPdfFromHtml(html: string, filename: string) {
  const fileBase = (filename || "report")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\.+$/, "");

  try {
    const html2pdf = await loadHtml2Pdf();

    // 1) 원문 정리
    const pre = stripFenceMarkers(html || "");
    const cleanedHtml = inlineJsonBlocksSafe(pre);

    // 2) 오프스크린 전용 루트 & 전용 스타일 삽입
    const STYLE_ID = "pdf-print-style-v2";
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
/* ---- PDF 전용: #pdf-print-root 내부만 강제 오버라이드 ---- */
#pdf-print-root { 
  position: fixed; left: -10000px; top: 0;
  width: 210mm; min-height: 297mm; 
  padding: 18mm 16mm; 
  background: #ffffff !important; color: #111111 !important;
  font-family: 'Malgun Gothic','맑은 고딕', system-ui, -apple-system, sans-serif;
  line-height: 1.7; font-weight: 400;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
  box-sizing: border-box;
}
#pdf-print-root, #pdf-print-root * {
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
  text-shadow: none !important; box-shadow: none !important;
}
#pdf-print-root .prose { max-width: none; margin: 0; padding: 0; }

/* 기본 색상 강제 (다크테마/인라인컬러 무력화) */
#pdf-print-root p, 
#pdf-print-root li, 
#pdf-print-root td, 
#pdf-print-root th, 
#pdf-print-root span, 
#pdf-print-root strong, 
#pdf-print-root em,
#pdf-print-root a,
#pdf-print-root div {
  color: #111111 !important;
  background: transparent !important;
  border-color: #e5e7eb !important;
}

/* 제목 & 번호(샘플 톤) */
#pdf-print-root h1, 
#pdf-print-root h2, 
#pdf-print-root h3, 
#pdf-print-root h4 {
  font-weight: 700; page-break-after: avoid; color: #111111 !important; margin: 0;
}
#pdf-print-root h1 { font-size: 20pt; margin: 24pt 0 12pt 0; color: #000000 !important; }
#pdf-print-root h2 { font-size: 16pt; margin: 20pt 0 10pt 0; color: #2563EB !important; }
#pdf-print-root h3 { font-size: 13pt; margin: 16pt 0 8pt 0;  color: #2563EB !important; }
#pdf-print-root h4 { font-size: 11pt; margin: 14pt 0 7pt 0;  font-weight: 600; }

/* 본문/목록 */
#pdf-print-root p { margin: 6pt 0; font-size: 10pt; }
#pdf-print-root ul, #pdf-print-root ol { margin: 6pt 0 6pt 20pt; font-size: 10pt; page-break-inside: avoid; }
#pdf-print-root li { margin-bottom: 4pt; }

/* 테이블 */
#pdf-print-root table { width: 100%; border-collapse: collapse; margin: 12pt 0; page-break-inside: avoid; font-size: 9pt; }
#pdf-print-root th, #pdf-print-root td { border: 1px solid #cccccc; padding: 6pt; text-align: left; vertical-align: top; }
#pdf-print-root th { background-color: #f2f2f2 !important; font-weight: 700; }

/* 강조 */
#pdf-print-root strong, #pdf-print-root b { font-weight: 600; color: #000000 !important; }
#pdf-print-root mark { background: #fff2a8 !important; color: #111111 !important; }

/* 샘플의 박스(연회색 카드) 느낌 */
#pdf-print-root blockquote,
#pdf-print-root div[role="note"],
#pdf-print-root div[style*="border-radius"] {
  border: 1px solid #e5e7eb !important;
  background-color: #f9fafb !important;
  padding: 12pt !important;
  margin: 12pt 0 !important;
  border-radius: 8px !important;
}

/* 페이지 분리 품질 */
#pdf-print-root div, 
#pdf-print-root section, 
#pdf-print-root article { page-break-inside: avoid; }
      `;
      document.head.appendChild(style);
    }

    const root = document.createElement("div");
    root.id = "pdf-print-root";
    root.innerHTML = `<div class="prose">${cleanedHtml}</div>`;
    document.body.appendChild(root);

    // 3) html2pdf 옵션 (A4, 흰 배경 보장)
    const options = {
      margin: 0, // 실제 여백은 컨테이너 패딩으로 제어
      filename: `${fileBase}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "avoid-all"] },
    } as const;

    await (html2pdf as any)().set(options).from(root).save();

    // 4) 청소
    root.remove();
    // 스타일은 재사용을 위해 남겨둠(필요시 아래 주석 해제)
    // const st = document.getElementById(STYLE_ID); if (st) st.remove();

  } catch (error) {
    console.error("PDF 생성 실패:", error);
    // 안전한 텍스트 대체
    const textContent = (html || "").replace(/<[^>]+>/g, "\n").replace(/\n\n+/g, "\n\n");
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${fileBase}.txt`; a.click();
    URL.revokeObjectURL(url);
    throw new Error("PDF 생성에 실패하여 텍스트 파일로 대체 다운로드합니다.");
  }
}
