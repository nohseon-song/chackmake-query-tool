// src/lib/googleExport.ts

// Google Identity Services 타입 선언
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: { error?: string; access_token?: string }) => void;
          }) => {
            callback: (response: { error?: string; access_token?: string }) => void;
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

type TokenClient = {
  callback: (response: { error?: string; access_token?: string }) => void;
  requestAccessToken: (options?: { prompt?: string }) => void;
};

let tokenClient: TokenClient | null = null;
let accessToken: string | null = null;

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",   // 파일 생성/관리(앱이 만든 것)
  "https://www.googleapis.com/auth/documents"     // 문서 작업(필요 시)
].join(" ");

function initGisClient(clientId: string) {
  if (tokenClient || !window.google) return;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    prompt: "", // 이미 로그인되어 있으면 자동 발급
    callback: (resp) => {
      if (resp.error) {
        console.error("GIS token error:", resp);
        accessToken = null;
        return;
      }
      accessToken = resp.access_token || null;
    }
  });
}

async function ensureAccessToken(clientId: string) {
  if (!window.google) {
    throw new Error("Google Identity Services 스크립트가 로드되지 않았습니다.");
  }
  
  initGisClient(clientId);
  if (accessToken) return accessToken;

  // 토큰 요청은 사용자 제스처 안에서 호출되어야 팝업 차단을 피함.
  await new Promise<void>((resolve) => {
    if (tokenClient) {
      tokenClient.callback = (resp) => {
        if (resp.error) {
          console.error("GIS token error:", resp);
          accessToken = null;
        } else {
          accessToken = resp.access_token || null;
        }
        resolve();
      };
      tokenClient.requestAccessToken({ prompt: "consent" });
    } else {
      resolve();
    }
  });

  if (!accessToken) throw new Error("Google 인증 실패");
  return accessToken;
}

/**
 * HTML을 Google Docs(문서)로 업로드. Drive API multipart + 변환 방식.
 * - metadata.mimeType = application/vnd.google-apps.document (결과 유형)
 * - media part mimeType = text/html (업로드 소스)
 */
async function uploadHtmlAsGoogleDoc(opts: {
  accessToken: string;
  html: string;
  fileName: string;
  folderId: string;
}) {
  const boundary = "-------cg_boundary_" + Math.random().toString(36).slice(2);
  const metadata = {
    name: opts.fileName,
    mimeType: "application/vnd.google-apps.document",
    parents: [opts.folderId]
  };

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
    `${opts.html}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive 업로드 실패: ${res.status} ${txt}`);
  }
  const data = await res.json();
  // webViewLink 가져오기 위해 한번 더 fields 지정 요청
  const res2 = await fetch(
    `https://www.googleapis.com/drive/v3/files/${data.id}?fields=id,webViewLink`,
    { headers: { Authorization: `Bearer ${opts.accessToken}` } }
  );
  const meta = await res2.json();
  return { id: data.id as string, webViewLink: meta.webViewLink as string };
}

/**
 * 메인 엔트리: 버튼 클릭에서 호출.
 * 팝업 차단/샌드박스 회피를 위해 "클릭 동기 시점"에 새 탭을 먼저 띄운 뒤 진행.
 */
export async function exportHtmlToGoogleDoc(params: {
  clientId: string;            // VITE_GOOGLE_CLIENT_ID
  folderId: string;            // VITE_DRIVE_TARGET_FOLDER_ID
  html: string;                // 결과 HTML (finalHtml)
  fileName: string;            // 규칙 기반 파일명
  onToast?: (t: { type: "success" | "error"; message: string }) => void;
}) {
  // 1) 새 탭을 "먼저" 띄운다(팝업 차단 회피)
  const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
  if (!popup) {
    params.onToast?.({ type: "error", message: "팝업이 차단되었습니다. 브라우저 팝업 허용 후 다시 시도해주세요." });
    throw new Error("Popup blocked");
  }
  popup.document.write("<p style='font:14px/1.6 sans-serif;padding:24px'>Google Docs로 내보내는 중…</p>");

  try {
    // 2) 토큰 확보(사용자 제스처 흐름 안)
    const token = await ensureAccessToken(params.clientId);

    // 3) 업로드 & 변환
    const { webViewLink } = await uploadHtmlAsGoogleDoc({
      accessToken: token,
      html: params.html,
      fileName: params.fileName,
      folderId: params.folderId
    });

    // 4) 새 탭으로 이동
    popup.location.href = webViewLink;
    params.onToast?.({ type: "success", message: "Google Docs로 내보내기 완료!" });
  } catch (e: any) {
    console.error("Google Docs 내보내기 오류:", e);
    popup.close();
    params.onToast?.({ type: "error", message: "Google Docs 내보내기 실패. 다시 시도해주세요." });
    throw e;
  }
}