// src/lib/googleExport.ts
// 전제: index.html 에 아래 스크립트가 포함되어 있어야 합니다.
// <script src="https://accounts.google.com/gsi/client" async defer></script>

type ExportOptions = {
  html: string;                 // 최종 보고서 HTML
  equipmentName: string;        // 예: '펌프'
  clientId: string;             // VITE_GOOGLE_CLIENT_ID
  folderId: string;             // VITE_DRIVE_TARGET_FOLDER_ID
  openNewTab?: boolean;         // 새 탭/창 미리 열기 (기본 true)
  onToast?: (p: { type: "success" | "error"; message: string }) => void;
};

// YYYY.MM.DD
function fmtDateYYYYMMDD(d = new Date()) {
  const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`;
}

// 팝업이 막히면 현재 탭으로 열기 위한 헬퍼
function openWindowSafe(url?: string) {
  try {
    const w = window.open(url ?? "", "_blank", "noopener");
    if (!w) return null; // 팝업 차단
    return w;
  } catch {
    return null;
  }
}

export async function exportHtmlToGoogleDoc({
  html,
  equipmentName,
  clientId,
  folderId,
  openNewTab = true,
  onToast,
}: ExportOptions): Promise<{ id: string; webViewLink: string }> {
  // 1) 미리 창을 연다(팝업차단 회피). 실패하면 null 리턴됨.
  const preWin = openNewTab ? openWindowSafe() : null;

  // 2) GIS 토큰 클라이언트로 액세스 토큰 받기(리디렉트 불필요)
  const scopes =
    "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents";

  const token: string = await new Promise((resolve, reject) => {
    // @ts-ignore
    const tc = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: scopes,
      // popup 기본(ux_mode 생략). redirect_uri 불필요.
      callback: (resp: any) => {
        if (resp && resp.access_token) {
          resolve(resp.access_token);
        } else {
          reject(new Error(resp?.error || "Failed to fetch access token"));
        }
      },
    });
    // 사용자 클릭 이벤트 안에서 호출되어야 브라우저가 팝업으로 인식
    tc.requestAccessToken({ prompt: "" });
  });

  // 3) 파일명 규칙
  const safeEquip = (equipmentName || "미지정").trim();
  const fileName = `기술진단결과_${safeEquip}_${fmtDateYYYYMMDD()}`;

  // 4) Google Drive에 멀티파트 업로드(HTML → Google Docs 변환 + 지정 폴더 저장)
  const boundary = "-------314159265358979323846";
  const metadata = {
    name: fileName,
    mimeType: "application/vnd.google-apps.document",
    parents: folderId ? [folderId] : undefined,
  };

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
    html +
    `\r\n--${boundary}--`;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!res.ok) {
    preWin?.close?.();
    const txt = await res.text();
    onToast?.({ type: "error", message: "Google Drive 업로드 실패" });
    throw new Error(`Google Drive upload failed: ${txt}`);
  }

  const data = (await res.json()) as { id: string; webViewLink: string };

  // 5) 미리 연 창이 있으면, 그 창에서 문서 링크로 이동. 없으면 현재 탭으로 열기.
  if (data.webViewLink) {
    if (preWin) {
      preWin.location.replace(data.webViewLink);
    } else {
      // 팝업이 막힌 경우 현재 탭에서 열기
      window.location.assign(data.webViewLink);
    }
  }

  onToast?.({ type: "success", message: "Google Docs 문서가 생성되었습니다." });
  return data;
}
