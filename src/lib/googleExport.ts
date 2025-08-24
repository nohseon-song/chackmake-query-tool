// src/lib/googleExport.ts
// 전제: index.html에 <script src="https://accounts.google.com/gsi/client" async defer></script> 포함

type ToastFn = (p: { type: "success" | "error" | "info"; message: string }) => void;

export type ExportOptions = {
  html: string;                 // 리포트 HTML(가끔 JSON 문자열이 섞여 들어옴)
  equipmentName: string;        // 예: '펌프'
  clientId: string;             // VITE_GOOGLE_CLIENT_ID
  folderId: string;             // VITE_DRIVE_TARGET_FOLDER_ID
  fileName?: string;            // (선택) 파일명 명시 시 그대로 사용
  onToast?: ToastFn;
};

function z(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function ymd(d = new Date()) { return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`; }

function assert(cond: any, msg: string): asserts cond { if (!cond) throw new Error(msg); }

async function ensureGisLoaded() {
  if (typeof window !== "undefined" && (window.google?.accounts?.oauth2)) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google Identity Services 스크립트 로드 실패"));
    document.head.appendChild(s);
  });
}

/** HTML이 JSON 문자열일 경우 본문 키만 추출 */
function sanitizeHtml(raw: string): string {
  const text = (raw ?? "").toString().trim();
  if (!text) return "";
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const obj = JSON.parse(text);
      const pick = (k: string) => obj && obj[k] != null ? String(obj[k]) : "";
      return (
        pick("final_report_html") ||
        pick("final_summary_html") ||
        pick("precision_verification_html") ||
        pick("final_report") ||
        pick("html") ||
        (obj.final_summary_text ? `<div>${String(obj.final_summary_text)}</div>` : text)
      );
    } catch { /* 원문 사용 */ }
  }
  return text;
}

function wrapAsHtmlDocument(innerHtml: string): string {
  return [
    "<!DOCTYPE html>",
    "<html><head><meta charset=\"UTF-8\" />",
    "<style>body{white-space:normal;line-height:1.5} p{margin:0 0 10px}</style>",
    "</head><body>",
    innerHtml || "",
    "</body></html>"
  ].join("");
}

async function getAccessToken(clientId: string, onToast?: ToastFn): Promise<string> {
  await ensureGisLoaded();
  const scopes = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents";
  return await new Promise<string>((resolve, reject) => {
    try {
      const tc = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes,
        callback: (resp: any) => {
          if (resp?.error) return reject(new Error(`토큰 오류: ${resp.error}`));
          const at = resp?.access_token || window.google.accounts?.oauth2?.getToken?.()?.access_token;
          if (!at) return reject(new Error("액세스 토큰을 받지 못했습니다."));
          resolve(at);
        },
      });
      tc.requestAccessToken({ prompt: "" });
    } catch (e: any) {
      if (String(e?.message || e).includes("origin_mismatch")) {
        onToast?.({ type: "error", message: "Google Cloud Console의 승인된 JavaScript 원본을 확인하세요." });
      }
      reject(e);
    }
  });
}

/** Google Docs로 업로드(자동 이동 없음, 링크만 반환) */
export async function exportHtmlToGoogleDocs(opts: ExportOptions): Promise<{
  id: string; webViewLink: string; docUrl: string;
}> {
  const { html, equipmentName, clientId, folderId, fileName, onToast } = opts;
  assert(html && html.trim(), "빈 보고서는 내보낼 수 없습니다.");
  assert(clientId, "Google Client ID가 비어있습니다.");
  assert(folderId, "Drive 대상 폴더 ID가 비어있습니다.");

  const token = await getAccessToken(clientId, onToast);

  const cleanInner = sanitizeHtml(html);
  const cleanHtml = wrapAsHtmlDocument(cleanInner);

  const safeEquip = (equipmentName || "미지정").trim();
  const finalName = fileName?.trim() || `기술진단결과_${safeEquip}_${ymd()}`;

  const boundary = "-------314159265358979323846";
  const metadata = {
    name: finalName,
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
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google Drive 업로드 실패: ${txt}`);
  }

  const data = await res.json() as { id: string; webViewLink: string };
  const docUrl = data.webViewLink ? data.webViewLink : `https://docs.google.com/document/d/${data.id}/edit`;

  onToast?.({ type: "success", message: "Google Docs로 내보내기 완료 (링크가 표시됩니다)" });
  return { ...data, docUrl };
}

// default로도 동일 함수 제공(동적 import 호환)
export default exportHtmlToGoogleDocs;
