// src/lib/googleExport.ts
// 전제: index.html에 아래 스크립트 포함
// <script src="https://accounts.google.com/gsi/client" async defer></script>

type ExportOptions = {
  html: string;                // 최종 리포트 HTML
  equipmentName?: string;      // 예: '펌프' (없으면 후술한 보강 로직으로 추출 시도)
  clientId: string;            // VITE_GOOGLE_CLIENT_ID
  folderId: string;            // VITE_DRIVE_TARGET_FOLDER_ID
  onToast?: (p: { type: "success" | "error" | "info"; message: string }) => void;
};

const DAY = () => {
  const d = new Date();
  const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`;
};

/** 보고서 HTML에 섞여 들어온 JSON 조각/키를 제거하고, 최소한의 문단 정리를 한다. */
export function sanitizeReportHtml(input: string): string {
  if (!input) return "";

  let html = input;

  // 1) JSON 아티팩트 제거 (precision_verification_html / final_report_html / final_summary_text / diagnosis_summary_html 등)
  html = html
    .replace(/\{\s*"precision_verification_html"\s*:\s*"(?:\\.|[^"])*"\s*(?:,\s*"final_summary_text"\s*:\s*"(?:\\.|[^"])*")?\s*\}/gs, "")
    .replace(/\{\s*"final_report_html"\s*:\s*"(?:\\.|[^"])*"\s*(?:,\s*"final_summary_text"\s*:\s*"(?:\\.|[^"])*")?\s*\}/gs, "")
    .replace(/"final_summary_text"\s*:\s*"(?:\\.|[^"])*"/gs, "")
    .replace(/"diagnosis_summary_html"\s*:\s*"(?:\\.|[^"])*"/gs, "");

  // 2) 남은 중괄호 덩어리가 문장 사이에 들어온 경우 완화
  html = html.replace(/\{\s*\}/g, "");

  // 3) 공백·개행 정리 (연속 <br> / 빈 문단 축약)
  html = html
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>")
    .replace(/<p>\s*<\/p>/gi, "");

  // 4) 본문을 간단한 스타일로 감싸 (Google Docs 가독성 향상)
  const hasHtmlTag = /<html[\s>]/i.test(html);
  if (!hasHtmlTag) {
    html =
      `<!doctype html><html><head><meta charset="utf-8">` +
      `<style>
        body{font-family:Arial,Apple SD Gothic Neo,Malgun Gothic,sans-serif;line-height:1.6;margin:24px;}
        h1,h2,h3{margin:0.6em 0 0.4em;}
        h1{font-size:28px;font-weight:700;}
        h2{font-size:22px;font-weight:700;}
        h3{font-size:18px;font-weight:700;}
        p,li{font-size:14px;margin:0.3em 0;}
        ul{margin:0.2em 0 0.6em 1.2em;}
        .subtitle{color:#666;font-size:12px;margin-top:4px;}
      </style></head><body>${html}</body></html>`;
  }

  return html;
}

/** HTML에서 설비명을 추정(파라미터가 비었을 때의 보험장치) */
function guessEquipmentName(html: string): string | undefined {
  if (!html) return undefined;
  // 예) "대상 설비", "설비", "펌프" 등이 포함된 제목/문구에서 첫 키워드 추출 시도
  const m1 = html.match(/대상\s*설비[^<]{0,20}[:：]?\s*([^<\n\r]{1,12})/i);
  if (m1?.[1]) return m1[1].trim();

  // h1/h2에 들어간 설비 키워드 추정
  const m2 = html.match(/<(h1|h2)[^>]*>([^<]{1,20})<\/\1>/i);
  if (m2?.[2]) {
    const v = m2[2].trim();
    if (v.length <= 12) return v;
  }
  return undefined;
}

async function ensureGisLoaded() {
  if ((window as any)?.google?.accounts?.oauth2) return;
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

/** Google Docs로 내보내기 (화면 이동 없음 / 링크만 반환) */
export async function exportHtmlToGoogleDocs(
  opts: ExportOptions
): Promise<{ id: string; webViewLink?: string; downloadUrl: string; fileName: string }> {
  const { clientId, folderId, onToast } = opts;
  let { html, equipmentName } = opts;

  if (!html || !html.trim()) throw new Error("빈 보고서는 내보낼 수 없습니다.");
  if (!clientId) throw new Error("Google Client ID가 비어있습니다.");
  if (!folderId) throw new Error("Drive 대상 폴더 ID가 비어있습니다.");

  await ensureGisLoaded();

  // 파일명 규칙 (equipmentName이 없으면 HTML에서 추정 → 최종 미지정)
  html = sanitizeReportHtml(html);
  const equip =
    (equipmentName && equipmentName.trim()) ||
    guessEquipmentName(html) ||
    "미지정";
  const fileName = `기술진단결과_${equip}_${DAY()}`;

  // OAuth 토큰
  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/documents",
  ].join(" ");

  const token: string = await new Promise((resolve, reject) => {
    try {
      const tc = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes,
        callback: (resp: any) => {
          if (resp?.error) return reject(new Error(`토큰 오류: ${resp.error}`));
          const at =
            resp?.access_token ||
            (window as any).google?.accounts?.oauth2?.getToken?.()?.access_token;
          if (!at) return reject(new Error("액세스 토큰을 받지 못했습니다."));
          resolve(at);
        },
      });
      // 반드시 클릭 핸들러 내부에서 호출되어야 팝업차단을 피함(호출측에서 보장)
      tc.requestAccessToken({ prompt: "" });
    } catch (e) {
      reject(e);
    }
  });

  // Drive 업로드(HTML → Google Docs 변환, 지정 폴더 저장)
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
      body,
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    onToast?.({ type: "error", message: "Google Drive 업로드 실패" });
    throw new Error(`Google Drive 업로드 실패: ${txt}`);
  }

  const data = (await res.json()) as { id: string; webViewLink?: string };

  // 화면 이동은 절대 하지 않음. 다운로드 URL만 만들어서 반환.
  // (DOCX로 저장 받기 편하도록 export?format=docx 링크 제공)
  const downloadUrl = `https://docs.google.com/document/d/${data.id}/export?format=docx`;

  onToast?.({ type: "success", message: "Google Docs로 내보내기 완료 (링크 생성됨)" });

  return { id: data.id, webViewLink: data.webViewLink, downloadUrl, fileName };
}
