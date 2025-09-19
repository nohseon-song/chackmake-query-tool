// src/lib/googleExport.ts
// <script src="https://accounts.google.com/gsi/client" async defer></script> 필요

type ToastFn = (p: { type: "success" | "error" | "info"; message: string }) => void;

export type ExportOptions = {
  html: string;
  equipmentName: string;
  clientId: string;
  // ✅ 선택값: 폴더가 없어도 동작
  folderId?: string;
  fileName?: string;
  onToast?: ToastFn;
};

const ILLEGAL = /[\\/:*?"<>|]+/g;
const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const ymd = (d = new Date()) => `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`;
function assert(c: any, m: string): asserts c { if (!c) throw new Error(m); }

// 선택: 자동 공유 대상(수집자) 이메일
const COLLECTOR = (import.meta.env.VITE_COLLECTOR_EMAIL as string | undefined)?.trim() || undefined;

// 코드펜스 마커만 제거(내용 보존)
function stripFenceMarkers(s: string): string {
  return (s || "").replace(/```json\s*/gi, "").replace(/```/g, "");
}

// ---------- 안전 파서: JSON 오브젝트만 정확히 치환 ----------
function parseBlocksAndInline(text: string): string {
  if (!text) return "";
  const keys = ["final_report_html","precision_verification_html","final_summary_html","final_report","final_summary_text"];

  let s = text;
  let out = "";
  let i = 0;
  let inStr = false, esc = false;

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
            const rep =
              obj.final_report_html ??
              obj.precision_verification_html ??
              obj.final_summary_html ??
              obj.final_report ??
              (obj.final_summary_text ? `<p>${obj.final_summary_text}</p>` : "");
            out += rep || "";
            i = end + 1;
            continue;
          } catch { /* JSON 아니면 그대로 출력 */ }
        }
      }
      out += ch; i++; continue;
    }

    out += ch; i++;
  }

  return out.trim();
}

function sanitizeHtml(raw: string): string {
  let t = (raw ?? "").toString().trim();
  if (!t) return "";
  // 코드펜스 마커 제거
  t = stripFenceMarkers(t);

  // 전체가 JSON이면 내부 HTML 필드 우선
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const o = JSON.parse(t);
      const picked =
        o?.final_report_html ?? o?.precision_verification_html ??
        o?.final_summary_html ?? o?.final_report ??
        (o?.final_summary_text ? `<p>${o.final_summary_text}</p>` : "");
      if (picked) return String(picked);
    } catch { /* ignore */ }
  }
  // 본문 중간 JSON → 안전 치환
  return parseBlocksAndInline(t);
}

function wrapAsHtmlDocument(inner: string): string {
  return [
    "<!DOCTYPE html><html><head><meta charset=\"UTF-8\" />",
    "<style>",
    "body{margin:0;line-height:1.6;font-size:14px;font-weight:400;color:#111}",
    "strong,b{font-weight:600}",
    "p{margin:0 0 10px}",
    "table{border-collapse:collapse;width:100%;margin:10px 0}",
    "th,td{border:1px solid #ddd;padding:6px 8px;vertical-align:top}",
    "th{background:#f5f5f5;font-weight:700}",
    ".doc-wrap{max-width:820px;margin:0 auto}",
    "</style></head><body><div class=\"doc-wrap\">",
    inner || "",
    "</div></body></html>"
  ].join("");
}

async function ensureGisLoaded() {
  if ((window as any).google?.accounts?.oauth2) return;
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

function guessEquipmentFromHtml(html: string): string | null {
  const m = html?.match(/대상\s*설비[^:：]*[:：]\s*([^\s<]+)/);
  return m?.[1]?.trim() || null;
}

function makeFileName(eq: string, html?: string, explicit?: string) {
  const guessed = (!eq || eq === "미지정") ? (guessEquipmentFromHtml(html || "") || "미지정") : eq;
  const name = explicit?.trim()
    || `기술진단결과_${guessed.replace(ILLEGAL,"_")}_${ymd()}`;
  return name.replace(/\.+$/, "");
}

/* ========== 업로드/공유 헬퍼 ========== */

// parents를 선택적으로 포함하여 Google Doc 생성
async function uploadAsGoogleDoc(token: string, html: string, title: string, parents?: string[]) {
  const boundary = "-------314159265358979323846";
  const metadata: any = { name: title, mimeType: "application/vnd.google-apps.document" };
  if (parents && parents.length) metadata.parents = parents;

  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n` +
    html +
    `\r\n--${boundary}--`;

  const url = "https://www.googleapis.com/upload/drive/v3/files"
            + "?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink";

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ id: string; webViewLink?: string }>;
}

// 수집자(네 이메일)에게 자동 공유
async function shareToCollector(token: string, fileId: string, email?: string) {
  if (!email) return;
  const endpoint = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true&sendNotificationEmail=false`;
  for (const role of ["writer", "reader"]) {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "user", role, emailAddress: email })
    });
    if (r.ok) return;
    // writer 실패 시 reader로 폴백
  }
  // 실패해도 사용자 저장은 이미 끝났으므로 치명 아님
}

/* ========== 메인 함수 ========== */

export async function exportHtmlToGoogleDocs({
  html, equipmentName, clientId, folderId, fileName, onToast,
}: ExportOptions): Promise<{
  id: string; webViewLink: string; docUrl: string;
  download?: { blobUrl: string; mimeType: string; fileName: string };
}> {
  assert(html && html.trim(), "빈 보고서는 내보낼 수 없습니다.");
  assert(clientId, "Google Client ID가 비어있습니다.");

  const token = await getAccessToken(clientId, onToast);
  const inner = sanitizeHtml(html);
  const cleanHtml = wrapAsHtmlDocument(inner);
  const title = makeFileName(equipmentName, html, fileName);

  let data: { id: string; webViewLink?: string } | null = null;
  let triedFolder = false;

  // 1차: 지정 폴더 시도 (권한 없으면 404/403이 정상적으로 발생 → 폴백)
  if (folderId) {
    try {
      data = await uploadAsGoogleDoc(token, cleanHtml, title, [folderId]);
      triedFolder = true;
    } catch (e: any) {
      const msg = String(e?.message || e);
      console.info("[export] folder upload failed → fallback:", msg);
      if (
        msg.includes("notFound") ||
        msg.includes("insufficientFilePermissions") ||
        msg.includes("File not found") ||
        msg.toLowerCase().includes("folder")
      ) {
        onToast?.({ type: "info", message: "지정 폴더 접근 불가 → ‘내 드라이브’에 저장합니다." });
      } else {
        // 폴더 권한 문제가 아니면 그대로 에러 처리
        throw new Error("Google Drive 업로드 실패: " + msg);
      }
    }
  }

  // 2차: 폴더 없이(사용자 ‘내 드라이브’) 업로드
  if (!data) {
    try {
      data = await uploadAsGoogleDoc(token, cleanHtml, title);
    } catch (e: any) {
      const msg = String(e?.message || e);
      console.error("[export] fallback upload failed:", msg);
      throw new Error("Google Drive 업로드(내 드라이브) 실패: " + msg);
    }
  }

  // 수집자 자동 공유(선택)
  try {
    await shareToCollector(token, data.id, COLLECTOR);
  } catch (e) {
    console.warn("[export] shareToCollector warning:", e);
  }

  const docUrl = data.webViewLink || `https://docs.google.com/document/d/${data.id}/edit`;

  // 로컬 저장용 DOCX (실패해도 치명적 아님)
  let dl: { blobUrl: string; mimeType: string; fileName: string } | undefined;
  try {
    const exp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${data.id}/export?supportsAllDrives=true&mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document&alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (exp.ok) {
      const blob = await exp.blob();
      dl = {
        blobUrl: URL.createObjectURL(blob),
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileName: `${title}.docx`
      };
    }
  } catch (e) {
    console.warn("[export] docx export warning:", e);
  }

  onToast?.({ type: "success", message: triedFolder ? "Google Docs 저장 완료" : "Google Docs 저장 완료(내 드라이브)" });
  return { id: data.id, webViewLink: data.webViewLink || "", docUrl, download: dl };
}

export const exportHtmlToGoogleDoc = exportHtmlToGoogleDocs;
export default exportHtmlToGoogleDocs;
