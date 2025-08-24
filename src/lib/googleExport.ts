// src/lib/googleExport.ts
// 전제: index.html에 아래 스크립트 포함
// <script src="https://accounts.google.com/gsi/client" async defer></script>

type ExportOptions = {
  html: string;               // 최종 리포트 HTML (가끔 JSON 문자열이 들어올 수도 있음)
  equipmentName: string;      // 예: '펌프'
  clientId: string;           // VITE_GOOGLE_CLIENT_ID
  folderId: string;           // VITE_DRIVE_TARGET_FOLDER_ID
  openNewTab?: boolean;       // 새 탭 열기 여부(기본 false: 현재 탭 사용)
  onToast?: (p: { type: "success" | "error" | "info"; message: string }) => void;
};

function fmtDateYYYYMMDD(d = new Date()) {
  const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`;
}

function assert(val: any, msg: string): asserts val {
  if (!val) throw new Error(msg);
}

async function ensureGisLoaded() {
  if (typeof window !== "undefined" && (window as any).google?.accounts?.oauth2) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google Identity Services 스크립트 로드 실패"));
    document.head.appendChild(s);
  });
}

/** ① HTML 정제: raw가 JSON이면 본문 HTML 필드만 추출, 아니면 원문 유지 */
function sanitizeHtml(raw: string): string {
  const text = (raw ?? "").toString().trim();
  if (!text) return "";

  // JSON 문자열인 경우: 리포트 본문 HTML 필드 우선 사용
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const obj = JSON.parse(text);
      // 가장 가능성 높은 필드들만 가볍게 지원 (없으면 원문 유지)
      // 사용 중인 백엔드에서 반환하는 최종 본문 키를 우선합니다.
      if (obj?.final_report_html) return String(obj.final_report_html);
      if (obj?.final_summary_html) return String(obj.final_summary_html);
      if (obj?.final_report) return String(obj.final_report);
      if (obj?.html) return String(obj.html);
      // text-only가 있다면 최소 div로 감싸서 반환
      if (obj?.final_summary_text) {
        return `<div>${String(obj.final_summary_text)}</div>`;
      }
      // 위 키들이 없다면 JSON 전체는 무시하고 원문을 그대로 사용
    } catch {
      // JSON 파싱 실패 → 원문 사용
    }
  }
  return text;
}

/** ② 변환 안정화를 위한 최소 HTML 문서 래핑 */
function wrapAsHtmlDocument(innerHtml: string): string {
  const body = innerHtml || "";
  return [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    '<meta charset="UTF-8" />',
    // 필요 시 간단한 기본 스타일(문단 간격 등)만 추가
    "<style>body{white-space:normal;line-height:1.5} p{margin:0 0 10px}</style>",
    "</head>",
    "<body>",
    body,
    "</body>",
    "</html>",
  ].join("");
}

export async function exportHtmlToGoogleDocs({
  html,
  equipmentName,
  clientId,
  folderId,
  openNewTab = false,
  onToast,
}: ExportOptions): Promise<{ id: string; webViewLink: string }> {
  assert(html && html.trim(), "빈 보고서는 내보낼 수 없습니다.");
  assert(clientId, "Google Client ID가 비어있습니다.");
  assert(folderId, "Drive 대상 폴더 ID가 비어있습니다.");

  // 0) GIS 보장
  await ensureGisLoaded();

  // 1) (선택) 팝업 차단 최소화를 위해 기본은 같은 탭. 새 탭을 원하면 true로.
  let win: Window | null = null;
  if (openNewTab) {
    try { win = window.open("", "_blank", "noopener"); } catch { /* ignore */ }
  }

  // 2) 토큰 받기(GIS Token Client)
  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/documents",
  ].join(" ");

  const token: string = await new Promise((resolve, reject) => {
    try {
      // @ts-ignore
      const tc = (google as any).accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes,
        callback: (resp: any) => {
          if (resp?.error) return reject(new Error(`토큰 오류: ${resp.error}`));
          const at =
            resp?.access_token ||
            // @ts-ignore
            (google as any).accounts?.oauth2?.getToken?.()?.access_token;
          if (!at) return reject(new Error("액세스 토큰을 받지 못했습니다."));
          resolve(at);
        },
      });
      // 사용자 클릭 핸들러 안에서 호출되어야 팝업 차단이 안 걸림
      tc.requestAccessToken({ prompt: "" });
    } catch (e: any) {
      reject(e);
    }
  }).catch((e: any) => {
    if (String(e?.message || e).includes("origin_mismatch") || String(e).includes("mismatch")) {
      onToast?.({ type: "error", message: "Google Cloud Console의 ‘승인된 JavaScript 원본’에 현재 주소를 추가하세요." });
    }
    throw e;
  });

  // ✅ 3) 업로드용 HTML 정제 + 래핑
  const cleanInner = sanitizeHtml(html);
  const cleanHtml = wrapAsHtmlDocument(cleanInner);

  // ✅ 4) 파일명 규칙
  const safeEquip = (equipmentName || "미지정").trim();
  const fileName = `기술진단결과_${safeEquip}_${fmtDateYYYYMMDD()}`;

  // 5) Drive 업로드(HTML → Google Docs 변환, 지정 폴더 저장)
  const boundary = "-------314159265358979323846";
  const metadata = {
    name: fileName,
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

  if (!res.ok) {
    const txt = await res.text();
    win?.close?.();
    throw new Error(`Google Drive 업로드 실패: ${txt}`);
  }

  const data = (await res.json()) as { id: string; webViewLink: string };

  // 6) 링크 열기(새 탭이면 그 탭, 아니면 현재 탭)
  if (data.webViewLink) {
    if (win) {
      try { win.location.replace(data.webViewLink); }
      catch { window.open(data.webViewLink, "_blank", "noopener"); }
    } else {
      window.location.assign(data.webViewLink);
    }
  }

  onToast?.({ type: "success", message: "Google Docs로 내보내기 완료" });
  return data;
}
