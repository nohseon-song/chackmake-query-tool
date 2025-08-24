// src/lib/googleExport.ts
// 전제: <script src="https://accounts.google.com/gsi/client" async defer></script>

// ✅ 전역 선언(빌드 에러 방지)
declare const google: any;

type ExportOptions = {
  html: string;
  equipmentName: string;
  clientId: string;
  folderId: string;
  openNewTab?: boolean; // 유지: 기본 false, 하지만 더 이상 사용 안 함(자동 이동 금지)
  onToast?: (p: { type: "success" | "error" | "info"; message: string }) => void;
};

function fmtDateYYYYMMDD(d = new Date()) {
  const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`;
}

function assert(val: any, msg: string): asserts val { if (!val) throw new Error(msg); }

async function ensureGisLoaded() {
  // ✅ SSR 가드
  if (typeof window === "undefined") return;
  if ((window as any).google?.accounts?.oauth2) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google Identity Services 스크립트 로드 실패"));
    document.head.appendChild(s);
  });
}

/** JSON → 본문 HTML 추출 우선순위 */
function pickHtmlFromJson(obj: any): string | null {
  const keys = ["final_report_html", "final_summary_html", "final_report", "html"];
  for (const k of keys) if (obj?.[k]) return String(obj[k]);
  if (obj?.final_summary_text) return `<div>${String(obj.final_summary_text)}</div>`;
  return null;
}

/** ① HTML 정제: JSON/파편 토큰 제거 */
function sanitizeHtml(raw: string): string {
  const text = (raw ?? "").toString().trim();
  if (!text) return "";

  // a) JSON 문자열이면 본문 키만 사용
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const obj = JSON.parse(text);
      const picked = pickHtmlFromJson(obj);
      if (picked !== null) return picked;
    } catch { /* 원문으로 진행 */ }
  }

  // b) 원문 내 JSON-같은 토큰 제거(지목 키만 타겟)
  let cleaned = text;
  const keyNames = ["precision_verification_html", "final_summary_text", "final_report_html"];
  // 패턴 1: {"key": "..."} 또는 {"key": ...}
  for (const k of keyNames) {
    const reObj = new RegExp(`\\{\\s*"${k}"\\s*:\\s*(".*?"|\\{[\\s\\S]*?\\}|\\[?[\\s\\S]*?\\]?)\\s*\\}`, "g");
    cleaned = cleaned.replace(reObj, "");
    // 패턴 2: "key": "" 같은 맨들어진 조각
    const rePair = new RegExp(`"${k}"\\s*:\\s*(".*?"|\\{[\\s\\S]*?\\}|\\[?[\\s\\S]*?\\]?)\\s*`, "g");
    cleaned = cleaned.replace(rePair, "");
  }
  return cleaned.trim();
}

/** ② 최소 HTML 문서 래핑 */
function wrapAsHtmlDocument(innerHtml: string): string {
  const body = innerHtml || "";
  return [
    "<!DOCTYPE html>",
    "<html><head>",
    '<meta charset="UTF-8" />',
    "<style>body{white-space:normal;line-height:1.6;font-size:14px} p{margin:0 0 10px}</style>",
    "</head><body>",
    body,
    "</body></html>",
  ].join("");
}

/** ③ 파일명 규칙 */
function makeFileName(equipmentName: string) {
  const safeEquip = (equipmentName || "미지정").trim()
    .replace(/[\\/:*?"<>|]/g, "")      // 윈도우 금칙문자 제거
    .replace(/\s+/g, "");              // 공백 제거(원하면 '_'로 바꿔도 됨)
  return `기술진단결과_${safeEquip}_${fmtDateYYYYMMDD()}`;
}

export async function exportHtmlToGoogleDocs({
  html,
  equipmentName,
  clientId,
  folderId,
  openNewTab = false,   // 유지하되 실제 이동은 하지 않음
  onToast,
}: ExportOptions): Promise<{ id: string; webViewLink: string }> {
  assert(html && html.trim(), "빈 보고서는 내보낼 수 없습니다.");
  assert(clientId, "Google Client ID가 비어있습니다.");
  assert(folderId, "Drive 대상 폴더 ID가 비어있습니다.");

  // ✅ 브라우저에서만 실행
  if (typeof window === "undefined") {
    throw new Error("이 동작은 브라우저에서만 가능합니다.");
  }

  await ensureGisLoaded();

  // 1) OAuth 토큰
  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/documents",
  ].join(" ");

  const token: string = await new Promise((resolve, reject) => {
    try {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes,
        callback: (resp: any) => {
          if (resp?.error) return reject(new Error(`토큰 오류: ${resp.error}`));
          const at = resp?.access_token || google.accounts?.oauth2?.getToken?.()?.access_token;
          if (!at) return reject(new Error("액세스 토큰을 받지 못했습니다."));
          resolve(at);
        },
      });
      tc.requestAccessToken({ prompt: "" }); // 클릭 핸들러 내에서 호출 권장
    } catch (e) { reject(e); }
  }).catch((e: any) => {
    const msg = String(e?.message || e);
    if (msg.includes("origin_mismatch") || msg.includes("mismatch")) {
      onToast?.({ type: "error", message: "Google Cloud Console의 승인된 JavaScript 원본에 현재 도메인을 추가하세요." });
    }
    throw e;
  });

  // 2) 본문 정제 → HTML 도큐먼트
  const cleanInner = sanitizeHtml(html);
  const cleanHtml  = wrapAsHtmlDocument(cleanInner);

  // 3) 파일명
  const fileName = makeFileName(equipmentName);

  // 4) Drive 업로드(HTML → Docs)
  const boundary = "-------314159265358979323846";
  const metadata = {
    name: fileName,
    mimeType: "application/vnd.google-apps.document",
    parents: [folderId],
  };

  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n` +
    cleanHtml +
    `\r\n--${boundary}--`;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    { method: "POST", headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      }, body }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google Drive 업로드 실패: ${txt}`);
  }

  const data = (await res.json()) as { id: string; webViewLink: string };

  // ✅ 자동 이동 금지: 화면 덮는 문제 해결
  //    링크는 반환값 or 토스트로만 안내
  onToast?.({ type: "success", message: "Google Docs 업로드 완료. 다운로드 링크가 준비되었습니다." });

  return data; // { id, webViewLink } - 화면에서 링크만 노출
}
