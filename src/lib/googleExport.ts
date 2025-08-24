// src/lib/googleExport.ts
// 전제: index.html 에 아래 스크립트 포함
// <script src="https://accounts.google.com/gsi/client" async defer></script>

declare global {
  interface Window {
    google?: any;
  }
}

export type ExportOptions = {
  html: string;
  equipmentName?: string;     // 예: '펌프'
  clientId: string;            // VITE_GOOGLE_CLIENT_ID
  folderId: string;            // VITE_DRIVE_TARGET_FOLDER_ID
  fileName?: string;           // 선택: 외부에서 완성 파일명 전달 시
  onToast?: (p: { type: "success" | "error" | "info"; message: string }) => void;
};

type ExportResult = {
  id: string;                  // Google Doc ID (관리용)
  fileName: string;            // 규칙 적용된 최종 파일명
  downloadUrl: string;         // DOCX Blob Object URL (앱에만 노출)
};

function fmtDateYYYYMMDD(d = new Date()) {
  const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`;
}

function assert(cond: any, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function ensureGisLoaded() {
  if (typeof window !== "undefined" && window.google?.accounts?.oauth2) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google Identity Services 로드 실패"));
    document.head.appendChild(s);
  });
}

/** 보고서 쓰레기 토큰/JSON 제거 & 본문만 추출 */
function sanitizeHtml(raw: string): string {
  const text = (raw ?? "").toString().trim();
  if (!text) return "";

  // 1) JSON 문자열이면 본문 키 우선 추출
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const obj = JSON.parse(text);
      const candidates = [
        obj?.final_report_html,
        obj?.precision_verification_html,
        obj?.final_summary_html,
        obj?.final_report,
        obj?.html,
      ].filter(Boolean);
      if (candidates.length) return String(candidates[0]);
      if (obj?.final_summary_text) return `<div>${String(obj.final_summary_text)}</div>`;
    } catch {
      /* ignore and fall through */
    }
  }

  // 2) 원문 내부에 섞인 JSON 패턴 제거
  let s = text;
  s = s.replace(
    /{"\s*(?:precision_verification_html|final_report_html|final_summary_text)"\s*:\s*"[\s\S]*?"\s*}/g,
    ""
  );
  s = s.replace(/["{]?(?:precision_verification_html|final_report_html|final_summary_text)["}]?:?/g, "");
  return s.trim();
}

/** Google 변환 안정성 확보를 위한 최소 문서 래핑 */
function wrapAsHtmlDocument(innerHtml: string): string {
  const body = innerHtml || "";
  return [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    '<meta charset="UTF-8" />',
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `<style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Apple SD Gothic Neo,Noto Sans KR,Pretendard,Arial,sans-serif;
           line-height:1.6; font-size:14px; color:#111;}
      h1{font-size:22px; font-weight:700; margin:0 0 14px;}
      h2{font-size:18px; font-weight:700; margin:18px 0 10px;}
      h3{font-size:16px; font-weight:700; margin:16px 0 8px;}
      p{margin:0 0 10px;}
      ul,ol{margin:0 0 12px 20px;}
      table{border-collapse:collapse; width:100%; margin:8px 0;}
      th,td{border:1px solid #bbb; padding:6px 8px; vertical-align:top;}
      strong,b{font-weight:600;}
      .small{font-size:12px; color:#444;}
    </style>`,
    "</head>",
    "<body>",
    body,
    "</body>",
    "</html>",
  ].join("");
}

/** GIS 토큰 획득 */
async function getAccessToken(clientId: string, scope: string): Promise<string> {
  await ensureGisLoaded();
  return await new Promise<string>((resolve, reject) => {
    try {
      const tc = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope,
        callback: (resp: any) => {
          if (resp?.error) return reject(new Error(`토큰 오류: ${resp.error}`));
          const at = resp?.access_token || window.google?.accounts?.oauth2?.getToken?.()?.access_token;
          if (!at) return reject(new Error("액세스 토큰을 받지 못했습니다."));
          resolve(at);
        },
      });
      tc.requestAccessToken({ prompt: "" });
    } catch (e) {
      reject(e);
    }
  });
}

/** 규칙 파일명 */
function buildFileName(equipmentName?: string, fileNameFromCaller?: string) {
  if (fileNameFromCaller && fileNameFromCaller.trim()) return fileNameFromCaller.trim();
  const safeEquip = (equipmentName || "미지정").trim();
  return `기술진단결과_${safeEquip}_${fmtDateYYYYMMDD()}`;
}

/**
 * Google Docs로 내보내되, 앱에는 Drive 링크를 노출하지 않고,
 * 사용자 기기로 저장 가능한 DOCX Blob URL만 반환
 */
export async function exportHtmlToGoogleDocs(opts: ExportOptions): Promise<ExportResult> {
  const { html, equipmentName, clientId, folderId, fileName: forcedName, onToast } = opts;
  assert(html && html.trim(), "빈 보고서는 내보낼 수 없습니다.");
  assert(clientId, "Google Client ID가 비어있습니다.");
  assert(folderId, "Drive 대상 폴더 ID가 비어있습니다.");

  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/documents",
  ].join(" ");
  const token = await getAccessToken(clientId, scopes);

  // 1) HTML 정제 & 래핑
  const cleanInner = sanitizeHtml(html);
  const cleanHtml = wrapAsHtmlDocument(cleanInner);

  // 2) 파일명
  const finalName = buildFileName(equipmentName, forcedName);

  // 3) Drive 업로드(HTML → Google Docs 변환 + 지정 폴더 저장)
  const boundary = "-------314159265358979323846";
  const metadata = {
    name: finalName,
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

  const createRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!createRes.ok) {
    const txt = await createRes.text();
    throw new Error(`Google Drive 업로드 실패: ${txt}`);
  }

  const { id } = await createRes.json() as { id: string };

  // 4) DOCX 로 export → Blob → Object URL (화면에만 노출)
  const exportUrl = `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document`;
  const expRes = await fetch(exportUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!expRes.ok) {
    const txt = await expRes.text();
    throw new Error(`문서 내보내기(DOCX) 실패: ${txt}`);
  }
  const blob = await expRes.blob();
  const downloadUrl = URL.createObjectURL(blob);

  onToast?.({ type: "success", message: "Google Docs 생성 완료(Drive 저장 + 로컬 다운로드 준비)." });

  return { id, fileName: `${finalName}.docx`, downloadUrl };
}

// 호환성: 다른 코드가 default 또는 두 이름 중 아무거나 불러도 동작하도록
export const exportHtmlToGoogleDoc = exportHtmlToGoogleDocs;
export default exportHtmlToGoogleDocs;
