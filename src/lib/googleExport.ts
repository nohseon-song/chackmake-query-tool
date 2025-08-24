// src/lib/googleExport.ts
// 전제: index.html에 GIS 스크립트 포함
// <script src="https://accounts.google.com/gsi/client" async defer></script>

/* 빌드 안정화: 전역 google 타입 선언 */
declare const google: any;

type ExportOptions = {
  html: string;               // 최종 리포트 HTML (가끔 JSON 문자열이 들어올 수도 있음)
  equipmentName?: string;     // 예: '펌프' (없으면 '미지정')
  clientId: string;           // VITE_GOOGLE_CLIENT_ID
  folderId: string;           // VITE_DRIVE_TARGET_FOLDER_ID
  openNewTab?: boolean;       // 호환 유지용(사용하지 않음)
  fileName?: string;          // 명시 파일명(있으면 우선)
  onToast?: (p: { type: "success" | "error" | "info"; message: string }) => void;
};

function z2(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function fmtDateYYYYMMDD(d = new Date()) { return `${d.getFullYear()}.${z2(d.getMonth() + 1)}.${z2(d.getDate())}`; }
function assert(val: any, msg: string): asserts val { if (!val) throw new Error(msg); }

async function ensureGisLoaded() {
  if (typeof window === "undefined") return; // SSR 가드
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

/** JSON/HTML 섞임 방지: 본문 HTML만 추출 */
function sanitizeHtml(raw: string): string {
  const text = (raw ?? "").toString().trim();
  if (!text) return "";

  // JSON 문자열이라면 키 우선순위로 추출
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const obj = JSON.parse(text);
      const pick = (...keys: string[]) => {
        for (const k of keys) {
          const v = obj?.[k];
          if (typeof v === "string" && v.trim()) return v;
        }
        return "";
      };
      const html =
        pick("final_report_html", "precision_verification_html", "final_summary_html", "report_html", "html") ||
        ((): string => {
          const t = pick("final_summary_text", "final_report_text", "summary", "content", "text");
          return t ? `<div>${t}</div>` : "";
        })();
      if (html) return html;
    } catch { /* 원문 사용 */ }
  }

  // 원문 내 JSON-같은 키 조각 제거(지목 키만 타겟)
  let cleaned = text;
  const keyNames = ["precision_verification_html", "final_summary_text", "final_report_html"];
  for (const k of keyNames) {
    const reObj = new RegExp(`\\{\\s*"${k}"\\s*:\\s*(".*?"|\\{[\\s\\S]*?\\}|\\[[\\s\\S]*?\\])\\s*\\}`, "g");
    cleaned = cleaned.replace(reObj, "");
    const rePair = new RegExp(`"${k}"\\s*:\\s*(".*?"|\\{[\\s\\S]*?\\}|\\[[\\s\\S]*?\\])\\s*`, "g");
    cleaned = cleaned.replace(rePair, "");
  }
  return cleaned.trim();
}

/** 변환 안정화를 위한 최소 HTML 문서 래핑 */
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

/** 파일명 규칙 */
function makeFileName(equipmentName?: string, explicit?: string) {
  if (explicit && explicit.trim()) return explicit.trim();
  const safeEquip = (equipmentName || "미지정").trim().replace(/[\\/:*?"<>|]/g, "_");
  return `기술진단결과_${safeEquip}_${fmtDateYYYYMMDD()}`;
}

/** OAuth 토큰 받기 */
async function getAccessToken(clientId: string, scope: string): Promise<string> {
  await ensureGisLoaded();
  return new Promise((resolve, reject) => {
    try {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope,
        callback: (resp: any) => {
          if (resp?.error) return reject(new Error(`토큰 오류: ${resp.error}`));
          const at = resp?.access_token || google.accounts?.oauth2?.getToken?.()?.access_token;
          if (!at) return reject(new Error("액세스 토큰을 받지 못했습니다."));
          resolve(at);
        },
      });
      tc.requestAccessToken({ prompt: "" });
    } catch (e) { reject(e); }
  });
}

/** 메인 함수: 링크만 반환(자동 이동 금지) */
export async function exportHtmlToGoogleDocs({
  html,
  equipmentName,
  clientId,
  folderId,
  onToast,
  fileName,
}: ExportOptions): Promise<{ id: string; webViewLink: string }> {
  assert(html && html.trim(), "빈 보고서는 내보낼 수 없습니다.");
  assert(clientId, "Google Client ID가 비어있습니다.");
  assert(folderId, "Drive 대상 폴더 ID가 비어있습니다.");

  if (typeof window === "undefined") throw new Error("이 동작은 브라우저에서만 가능합니다.");

  const scope = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/documents",
  ].join(" ");
  const token = await getAccessToken(clientId, scope).catch((e: any) => {
    const msg = String(e?.message || e);
    if (msg.includes("origin_mismatch") || msg.includes("mismatch")) {
      onToast?.({ type: "error", message: "Google Cloud Console의 승인된 JavaScript 원본에 현재 도메인을 추가하세요." });
    }
    throw e;
  });

  // 정제 + 래핑
  const cleanInner = sanitizeHtml(html);
  const cleanHtml  = wrapAsHtmlDocument(cleanInner);
  const title = makeFileName(equipmentName, fileName);

  // Drive 업로드 (HTML → Docs 변환)
  const boundary = "-------314159265358979323846";
  const metadata = { name: title, mimeType: "application/vnd.google-apps.document", parents: [folderId] };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n` +
    cleanHtml +
    `\r\n--${boundary}--`;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google Drive 업로드 실패: ${txt}`);
  }

  const data = (await res.json()) as { id: string; webViewLink: string };

  // 자동 이동 ❌ — 호출자(UI)에서만 링크를 사용
  onToast?.({ type: "success", message: "Google Docs 업로드 완료. 링크가 준비되었습니다." });
  return data;
}

// 호환성을 위해 별칭/기본 내보내기도 제공
export const exportHtmlToGoogleDoc = exportHtmlToGoogleDocs;
export default exportHtmlToGoogleDocs;
