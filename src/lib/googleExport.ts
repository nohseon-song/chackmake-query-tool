// src/lib/googleExport.ts
// Google Identity Services 자동 로드 + HTML → Google Docs 변환 업로드 유틸
// 기존 코드와 100% 호환: exportHtmlToGoogleDoc, exportHtmlToGoogleDocs, default 모두 제공

declare global {
  interface Window {
    google?: any;
  }
}

// 기존 방식 호환: equipmentName/openNewTab 지원
type ExportOptionsLegacy = {
  html: string;
  equipmentName: string;     // 예: '펌프'
  clientId: string;
  folderId: string;
  openNewTab?: boolean;      // 기본 true
};

// 새 방식: fileName을 직접 전달
type ExportOptionsModern = {
  html: string;
  fileName: string;          // 예: '기술진단결과_펌프_2025.08.24'
  clientId: string;
  folderId: string;
  openNewTab?: boolean;      // 기본 true
};

type ExportOptions = ExportOptionsLegacy | ExportOptionsModern;

function fmtDateYYYYMMDD(d = new Date()) {
  const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`;
}

/**
 * HTML을 Google Docs로 변환하여 Google Drive 지정 폴더에 저장.
 * @returns { id, webViewLink, url, docUrl }
 */
export async function exportHtmlToGoogleDoc(
  opts: ExportOptions
): Promise<{ id: string; webViewLink: string; url: string; docUrl: string }> {
  const { html, clientId, folderId } = opts;
  const openNewTab = opts.openNewTab ?? true;

  // fileName 우선, 없으면 equipmentName 기반으로 자동 생성
  const fileName =
    (opts as ExportOptionsModern).fileName ??
    `기술진단결과_${(opts as ExportOptionsLegacy).equipmentName ?? '미지정'}_${fmtDateYYYYMMDD()}`;

  // 1) 사용자 클릭과 동기적으로 새 탭 선점(팝업 차단 회피)
  const win: Window | null = openNewTab ? window.open('about:blank', '_blank', 'noopener,noreferrer') : null;
  if (win) {
    try {
      win.document.write(`
        <html><head><title>Google Docs 생성 중...</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>html,body{height:100%;margin:0;display:flex;align-items:center;justify-content:center;font-family:sans-serif}</style>
        </head><body><div>Google Docs 문서를 생성하고 있습니다…</div></body></html>
      `);
      win.document.close();
    } catch { /* 일부 브라우저에서 document 접근 차단 가능 → 무시 */ }
  }

  // 2) GIS 스크립트 준비(없으면 자동 로드)
  await ensureGisLoaded();

  // 3) 액세스 토큰 발급(클릭 제스처 컨텍스트에서 호출되어야 함)
  const token = await getAccessToken(clientId);

  // 4) Drive 업로드 (multipart/related) : HTML → Google Docs 변환 + 지정 폴더 저장
  const boundary = '-------314159265358979323846';
  const metadata = {
    name: fileName,
    mimeType: 'application/vnd.google-apps.document', // 최종 형식: Google Docs
    parents: [folderId],
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
    }
  );

  if (!res.ok) {
    try { win?.close(); } catch {}
    const txt = await res.text();
    // 에러 원인 간결 표시(앞부분만)
    throw new Error(`Drive upload failed: ${txt.slice(0, 200)}`);
  }

  const data = (await res.json()) as { id: string; webViewLink: string };

  // 5) 미리 연 새 탭으로 이동(팝업 허용 시)
  if (win && data.webViewLink) {
    try { win.location.replace(data.webViewLink); } catch {}
  }

  // 다중 키로 반환(호환성)
  return {
    id: data.id,
    webViewLink: data.webViewLink,
    url: data.webViewLink,
    docUrl: data.webViewLink,
  };
}

// 과거 이름과의 완전 호환 제공
export const exportHtmlToGoogleDocs = exportHtmlToGoogleDoc;
// default export도 함수로 제공(임포트 스타일 혼용 대비)
export default exportHtmlToGoogleDoc;

/* -------------------- 내부 유틸 -------------------- */

async function ensureGisLoaded(): Promise<void> {
  if (window.google?.accounts?.oauth2) return;

  await new Promise<void>((resolve, reject) => {
    const id = 'gis-sdk';
    const existed = document.getElementById(id) as HTMLScriptElement | null;
    if (existed) {
      // 이미 태그가 있으면, 로드 완료 혹은 짧은 대기 후 진행
      existed.addEventListener('load', () => resolve());
      setTimeout(() => resolve(), 300);
      return;
    }
    const s = document.createElement('script');
    s.id = id;
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
}

function getAccessToken(clientId: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const google = window.google;
    if (!google?.accounts?.oauth2) {
      reject(new Error('GIS not available'));
      return;
    }
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope:
        'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents',
      callback: (resp: any) => {
        if (resp?.error) return reject(new Error(resp.error));
        const token =
          resp?.access_token || google.accounts.oauth2.getToken?.()?.access_token;
        if (!token) return reject(new Error('No access token'));
        resolve(token);
      },
    });
    // 클릭 제스처 내에서 호출되어야 팝업 차단이 안 됨
    tokenClient.requestAccessToken({ prompt: '' });
  });
}
