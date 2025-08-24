// src/lib/googleExport.ts
// 전제: index.html 에 아래 스크립트 포함
// <script src="https://accounts.google.com/gsi/client" async defer></script>

type ToastFn = (p: { type: "success" | "error" | "info"; message: string }) => void;

export type ExportOptions = {
  html: string;                 // 보고서 HTML(가끔 JSON 문자열이 섞여 들어옴)
  equipmentName: string;        // 예: '펌프'
  clientId: string;             // VITE_GOOGLE_CLIENT_ID
  folderId: string;             // VITE_DRIVE_TARGET_FOLDER_ID
  fileName?: string;            // (선택) 지정 시 우선
  onToast?: ToastFn;
};

function z(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function ymd(d = new Date()) { return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`; }
function assert(c: any, m: string): asserts c { if (!c) throw new Error(m); }
const ILLEGAL = /[\\/:*?"<>|]+/g;

/** HTML에 섞인 JSON 조각까지 제거 */
function sanitizeHtml(raw: string): string {
  let t = (raw ?? "").toString().trim();
  if (!t) return "";

  const pick = (o: any) =>
    o?.final_report_html || o?.final_summary_html || o?.precision_verification_html ||
    o?.final_report || o?.html ||
    (o?.final_summary_text ? `<div>${String(o.final_summary_text)}</div>` : "");

  // 전체가 JSON
  if (t.startsWith("{") || t.startsWith("[")) {
    try { const o = JSON.parse(t); const h = pick(o); if (h) return h; } catch {}
  }

  // 본문 중간 JSON 조각 제거
  const keys = ["precision_verification_html","final_report_html","final_summary_text"];
  for (const k of keys) {
    const re = new RegExp(
      String.raw`\{\s*"(?:${k})"\s*:\s*"(?:[\s\S]*?)"\s*(?:,\s*"(?:[\s\S]*?)"\s*:\s*"(?:[\s\S]*?)"\s*)*\}`,
      "g"
    );
    t = t.replace(re, "");
  }
  const rePairs = new RegExp(String.raw`"(?:${keys.join("|")})"\s*:\s*"(?:[\s\S]*?)"`, "g");
  t = t.replace(rePairs, "");
  return t.trim();
}

/** Docs 변환 안정화 + 볼드 도배 방지 */
function wrapAsHtmlDocument(inner: string): string {
  return [
    "<!DOCTYPE html>",
    "<html><head><meta charset=\"UTF-8\" />",
    "<style>",
    "body{white-space:normal;line-height:1.6;font-size:14px;font-weight:400;color:#111}",
    "strong,b{font-weight:600}",
    "p{margin:0 0 10px}",
    "table{border-collapse:collapse;width:100%}",
    "th,td{border:1px solid #ddd;padding:6px 8px;vertical-align:top}",
    "th{background:#f5f5f5;font-weight:700}",
    "</style>",
    "</head><body>", inner || "", "</body></html>"
  ].join("");
}

async function ensureGisLoaded() {
  if (typeof window !== "undefined" && (window as any).google?.accounts?.oauth2) return;
  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.defer = true;
    s.onload = () => res(); s.onerror = () => rej(new Error("GIS 스크립트 로드 실패"));
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
      if (String(e?.message || e).includes("origin_mismatch")) {
        onToast?.({ type: "error", message: "GCP > 승인된 JavaScript 원본을 확인하세요." });
      }
      reject(e);
    }
  });
}

/** 파일명 규칙 + 말단 점 제거 */
function makeFileName(eq: string, explicit?: string) {
  const name = explicit?.trim()
    || `기술진단결과_${(eq || "미지정").trim().replace(ILLEGAL,"_")}_${ymd()}`;
  return name.replace(/\.+$/, "");
}

/** Docs 업로드 + DOCX export(Blob) 반환 — Drive 링크는 화면에 노출하지 말 것 */
export async function exportHtmlToGoogleDocs({
  html, equipmentName, clientId, folderId, fileName, onToast,
}: ExportOptions): Promise<{
  id: string; webViewLink: string; docUrl: string;
  download?: { blobUrl: string; mimeType: string; fileName: string };
}> {
  assert(html && html.trim(), "빈 보고서는 내보낼 수 없습니다.");
  assert(clientId, "Google Client ID가 비어있습니다.");
  assert(folderId, "Drive 대상 폴더 ID가 비어있습니다.");

  const token = await getAccessToken(clientId, onToast);
  const inner = sanitizeHtml(html);
  const cleanHtml = wrapAsHtmlDocument(inner);
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

  // DOCX 내보내기(alt=media로 강제 다운로드)
  let dl: { blobUrl: string; mimeType: string; fileName: string } | undefined;
  try {
    const exp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${data.id}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document&alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (exp.ok) {
      const blob = await exp.blob();
      const blobUrl = URL.createObjectURL(blob);
      dl = { blobUrl, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileName: `${title}.docx` };
    }
  } catch { /* export 실패해도 업로드는 성공 */ }

  onToast?.({ type: "success", message: "Google Docs 저장 완료(기기 다운로드 가능)" });
  return { ...data, docUrl, download: dl };
}

// 호환용 별칭 + default
export const exportHtmlToGoogleDoc = exportHtmlToGoogleDocs;
export default exportHtmlToGoogleDocs;
