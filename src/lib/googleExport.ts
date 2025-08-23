// src/lib/googleExport.ts
// 전제: index.html에 <script src="https://accounts.google.com/gsi/client" async defer></script> 포함

type ExportOptions = {
  html: string;               // 저장할 HTML (최종 리포트)
  equipmentName: string;      // '펌프' 등 선택된 대상 설비
  clientId: string;           // VITE_GOOGLE_CLIENT_ID
  folderId: string;           // VITE_DRIVE_TARGET_FOLDER_ID
  openNewTab?: boolean;       // 새 탭 열 여부(기본 true)
};

function fmtDateYYYYMMDD(d = new Date()) {
  const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`;
}

export async function exportHtmlToGoogleDocs({
  html,
  equipmentName,
  clientId,
  folderId,
  openNewTab = true,
}: ExportOptions): Promise<{ id: string; webViewLink: string }> {
  // 1) 새 창을 "동기적으로" 미리 열어 팝업 차단 방지
  const win = openNewTab ? window.open('', '_blank', 'noopener') : null;

  // 2) GIS 토큰 클라이언트 준비
  const scopes = [
    'https://www.googleapis.com/auth/drive.file', // 본인이 만든/앱이 만든 파일 접근
    'https://www.googleapis.com/auth/documents',  // (옵션) Docs 편집 권한
  ].join(' ');

  const token = await new Promise<string>((resolve, reject) => {
    // @ts-ignore
    const tc = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: scopes,
      callback: (resp: any) => {
        if (resp.error) return reject(new Error(resp.error));
        const at =
          resp.access_token ||
          // @ts-ignore
          (google.accounts.oauth2.getToken?.() as any)?.access_token;
        if (!at) return reject(new Error('No access token'));
        resolve(at);
      },
    });
    // 클릭 핸들러 내부에서 이 함수가 호출되어야 팝업이 차단되지 않음
    tc.requestAccessToken({ prompt: '' });
  });

  // 3) 파일명 규칙 생성
  const fileName = `기술진단결과_${equipmentName}_${fmtDateYYYYMMDD()}`;

  // 4) Drive 파일 생성(HTML 업로드 → Google Docs로 변환 + 폴더 지정)
  const boundary = '-------314159265358979323846';
  const metadata = {
    name: fileName,
    mimeType: 'application/vnd.google-apps.document', // 최종 형식: Google Docs
    parents: [folderId], // 지정 폴더에 저장
  };

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
    html +
    `\r\n--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!res.ok) {
    win?.close?.();
    const txt = await res.text();
    throw new Error(`Google Drive upload failed: ${txt}`);
  }

  const data = (await res.json()) as { id: string; webViewLink: string };

  // 5) 미리 연 새 창에 링크 주입(팝업 차단 회피 + 즉시 확인)
  if (win && data.webViewLink) {
    win.location.replace(data.webViewLink);
  }

  return data;
}
