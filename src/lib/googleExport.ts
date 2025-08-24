// src/lib/googleExport.ts
// 전제: <script src="https://accounts.google.com/gsi/client" async defer></script> 로드 가능

type ToastFn = (p: { type: "success" | "error" | "info"; message: string }) => void;

export type ExportOptions = {
  html: string;               // 보고서 HTML(중간에 JSON 오브젝트가 섞여 있어도 OK)
  equipmentName: string;      // 설비명(빈값일 수 있음)
  clientId: string;           // Google OAuth client id
  folderId: string;           // 대상 Drive 폴더 id
  fileName?: string;          // (선택) 완전 고정 파일명 — 우선 적용
  onToast?: ToastFn;
};

const ILLEGAL = /[\\/:*?"<>|]+/g;
const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const ymd = (d = new Date()) => `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`;

function assert(cond: any, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/* ───────────────────────── JSON 블록 안전 치환기 ─────────────────────────
   - 본문 어딘가에 섞여 들어온 {"final_summary_text": "..."} 같은 JSON을
     문자열/이스케이프/중괄호 ‘깊이’로 파싱해서 안전 치환.
   - 우선순위: final_report_html > precision_verification_html > final_summary_html > final_report
   - 어떤 HTML도 없으면 final_summary_text를 <p>...</p>로 ‘반드시 포함’(삭제 금지)
*/
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
      // JSON 파싱 실패 → 원문 유지
      out += ch; i++; continue;
    }
  }
  return out;
}

/** 전체가 JSON 문자열로 온 경우 처리(단독 JSON) */
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

/** 최종 업로드용 HTML 정리 */
function sanitizeHtml(raw: string): string {
  const t = (raw ?? "").toString().trim();
  if (!t) return "";
  // 1) 본문 어딘가에 섞인 JSON 오브젝트 치환
  const inlined = inlineJsonBlocksSafe(t);
  // 2) 입력 자체가 JSON이면 최종 본문 추출
  const extracted = tryExtractFromJsonString(inlined);
  return extracted || inlined;
}

/** HTML → 전체 문서 래핑(간단한 기본 스타일만) */
function wrapAsHtmlDocument(inner: string): string {
  return [
    "<!DOCTYPE html>",
    "<html><head><meta charset=\"UTF-8\" />",
    "<style>",
    "body{margin:0;line-height:1.6;font-size:14px;color:#111;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}",
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

/* ───────────────────────── Google Identity ───────────────────────── */
async function ensureGisLoaded() {
  // 브라우저 환경 한정
  if (typeof window === "undefined") return;
  if ((window as any).google?.accounts?.oauth2) return;
  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = () => res();
    s.onerror = () => rej(new Error("GIS 스크립트 로드 실패"));
    document.head.appendChild(s);
  });
}

async function getAccessToken(clientId: string, onToast?: ToastFn): Promise<string> {
  await ensureGisLoaded();
  const scopes = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents";
  return await new Promise<string>((resolve, reject) => {
    try {
      const tc = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes,
        callback: (resp: any) => {
          if (resp?.error) return reject(new Error(`토큰 오류: ${resp.error}`));
          const at =
            resp?.access_token ||
            (window as any).google.accounts?.oauth2?.getToken?.()?.access_token;
          if (!at) return reject(new Error("액세스 토큰을 받지 못했습니다."));
          resolve(at);
        },
      });
      tc.requestAccessToken({ prompt: "" });
    } catch (e: any) {
      if (String(e?.message || e).includes("origin_mismatch")) {
        onToast?.({ type: "error", message: "Google Cloud Console의 ‘승인된 JavaScript 원본’을 확인하세요." });
      }
      reject(e);
    }
  });
}

/* ───────────────────────── 파일명 규칙 ───────────────────────── */
function guessEquipmentFromHtml(html: string): string | null {
  // 화면 본문 내 "대상 설비: XXX" 패턴 추정(없으면 null)
  const m = html?.match(/대상\s*설비[^:：]*[:：]\s*([^\s<]+)/);
  return m?.[1]?.trim() || null;
}

function buildTitle(equipmentName: string, html: string, explicit?: string): string {
  if (explicit && explicit.trim()) {
    return explicit.replace(ILLEGAL, "_").replace(/\.+$/, "");
  }
  const eq = (equipmentName || "").trim();
  const chosen = eq && eq !== "미지정"
    ? eq
    : (guessEquipmentFromHtml(html) || "미지정");
  return `기술진단결과_${chosen.replace(ILLEGAL, "_")}_${ymd()}`;
}

/* ───────────────────────── 공개 API ───────────────────────── */
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

  // 본문 정리(요약문 반드시 포함, 쓰레기 JSON 숨김)
  const inner = sanitizeHtml(html);
  const cleanHtml = wrapAsHtmlDocument(inner);

  // 파일명 규칙
  const title = buildTitle(equipmentName, html, fileName);

  // 업로드(HTML→Google Docs 변환)
  const boundary = "-------314159265358979323846";
  const metadata = {
    name: title,
    mimeType: "application/vnd.google-apps.document",
    parents: [folderId],
  };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
    cleanHtml +
    `\r\n--${boundary}--`;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) throw new Error(`Google Drive 업로드 실패: ${await res.text()}`);

  const data = (await res.json()) as { id: string; webViewLink: string };
  const docUrl = data.webViewLink || `https://docs.google.com/document/d/${data.id}/edit`;

  // (선택) 사용자가 기기에 바로 저장할 수 있도록 DOCX Blob 링크 생성
  let dl: { blobUrl: string; mimeType: string; fileName: string } | undefined;
  try {
    const exp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${data.id}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document&alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (exp.ok) {
      const blob = await exp.blob();
      const blobUrl = URL.createObjectURL(blob);
      dl = {
        blobUrl,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileName: `${title}.docx`,
      };
    }
  } catch {
    // 네트워크/권한 문제 시 건너뛰되 실패로 간주하지 않음
  }

  onToast?.({ type: "success", message: "Google Docs 저장 완료(지정 폴더 + 기기 저장 가능)" });
  return { ...data, docUrl, download: dl };
}

// 호환 별칭
export const exportHtmlToGoogleDoc = exportHtmlToGoogleDocs;
export default exportHtmlToGoogleDocs;
