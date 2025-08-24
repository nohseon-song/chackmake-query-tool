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
const ILLEGAL = /[\\/:*?"<>|]+/g;

/** 전체 JSON이거나, HTML 안에 끼어든 JSON 조각까지 모두 제거 */
function sanitizeHtml(raw: string): string {
  let text = (raw ?? "").toString().trim();
  if (!text) return "";

  const pickFromObj = (obj: any) =>
    obj?.final_report_html ||
    obj?.final_summary_html ||
    obj?.precision_verification_html ||
    obj?.final_report ||
    obj?.html ||
    (obj?.final_summary_text ? `<div>${String(obj.final_summary_text)}</div>` : "");

  // ① 전체가 JSON일 때
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const obj = JSON.parse(text);
      const html = pickFromObj(obj);
      if (html) return html;
    } catch { /* 원문 사용 */ }
  }

  // ② HTML 본문 안의 JSON 조각 제거(대표 키 기준)
  const keys = ["precision_verification_html","final_report_html","final_summary_text"];
  for (const k of keys) {
    const re = new RegExp(
      String.raw`\{\s*"(?:${k})"\s*:\s*"(?:[\s\S]*?)"\s*(?:,\s*"(?:[\s\S]*?)"\s*:\s*"(?:[\s\S]*?)"\s*)*\}`,
      "g"
    );
    text = text.replace(re, "");
  }
  const rePairs = new RegExp(String.raw`"(?:${keys.join("|")})"\s*:\s*"(?:[\s\S]*?)"`, "g");
  text = text.replace(rePairs, "");

  return text.trim();
}

/** 최소 문서 래핑(Docs 변환 안정화 + 과도 볼드 방지) */
function wrapAsHtmlDocument(innerHtml: string): string {
  return [
    "<!DOCTYPE html>",
    "<html><head><meta charset=\"UTF-8\" />",
    "<style>",
    "body{white-space:normal;line-height:1.6;font-size:14px;font-weight:400;color:#111}",
    "strong,b{font-weight:600}",
    "p{margin:0 0 10px}",
    "</style>",
    "</head><body>",
    innerHtml || "",
    "</body></html>"
  ].join("");
}

async function ensureGisLoaded() {
  if (typeof window !== "undefined" && (window as any).google?.accounts?.oauth2) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google Identity Services 스크립트 로드 실패"));
    document.head.appendChild(s);
  });
}

async function getAccessToken(clientId: string, onToast?: ToastFn): Promise<string> {
  await ensureGisLoaded();
  const scopes = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents";
  return await new Promise<string>((resolve, reject) => {
    try {
      const tc = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId, scope: scopes,
        callback: (resp: any) => {
          if (resp?.error) return reject(new Error(`토큰 오류: ${resp.error}`));
          const at = resp?.access_token || (window as any).google.accounts?.oauth2?.getToken?.()?.access_token;
          if (!at) return reject(new Error("액세스 토큰을 받지 못했습니다."));
          resolve(at);
        },
      });
      tc.requestAccessToken({ prompt: "" });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("origin_mismatch")) {
        onToast?.({ type: "error", message: "Google Cloud Console > 승인된 JavaScript 원본을 확인하세요." });
      }
      reject(e);
    }
  });
}

/** 파일명 규칙 + 말단 점 제거 */
function makeFileName(equipmentName: string, explicit?: string) {
  const name = explicit?.trim()
    || `기술진단결과_${(equipmentName || "미지정").trim().replace(ILLEGAL,"_")}_${ymd()}`;
  return name.replace(/\.+$/, ""); // 끝의 점 제거
}

/** Google Docs 업로드 + 로컬 다운로드용 Blob 생성(Drive 링크는 반환하되 화면에 노출하지 말 것) */
export async function exportHtmlToGoogleDocs({
  html, equipmentName, clientId, folderId, fileName, onToast,
}: ExportOptions): Promise<{
  id: string;
  webViewLink: string;
  docUrl: string;
  download?: { blobUrl: string; mimeType: string; fileName: string };
}> {
  assert(html && html.trim(), "빈 보고서는 내보낼 수 없습니다.");
  assert(clientId, "Google Client ID가 비어있습니다.");
  assert(folderId, "Drive 대상 폴더 ID가 비어있습니다.");

  const token = await getAccessToken(clientId, onToast);
  const cleanInner = sanitizeHtml(html);
  const cleanHtml  = wrapAsHtmlDocument(cleanInner);
  const title = makeFileName(equipmentName, fileName);

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
  if (!res.ok) throw new Error(`Google Drive 업로드 실패: ${await res.text()}`);

  const data = await res.json() as { id: string; webViewLink: string };
  const docUrl = data.webViewLink || `https://docs.google.com/document/d/${data.id}/edit`;

  // ❗ 개인정보 보호: 사용자에게 Drive 링크를 보여주지 않아도, 기기 저장이 필요
  // 생성된 문서를 DOCX로 익스포트 받아 Blob 생성 → blobUrl 반환
  let dl: { blobUrl: string; mimeType: string; fileName: string } | undefined;
  try {
    const exp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${data.id}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (exp.ok) {
      const blob = await exp.blob();
      const blobUrl = URL.createObjectURL(blob);
      dl = { blobUrl, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileName: `${title}.docx` };
    }
  } catch { /* ignore: export 실패해도 업로드 자체는 성공 */ }

  onToast?.({ type: "success", message: "Google Docs로 내보내기 완료(기기에 다운로드 가능)" });
  return { ...data, docUrl, download: dl };
}

// 호환용 별칭 + default
export const exportHtmlToGoogleDoc = exportHtmlToGoogleDocs;
export default exportHtmlToGoogleDocs;
