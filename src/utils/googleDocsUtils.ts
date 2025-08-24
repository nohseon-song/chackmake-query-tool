import { supabase } from '@/integrations/supabase/client';
import { safeOpenNewTab } from './safeOpen';

export interface GoogleAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
}

/* ------------------------------ 공통 유틸 ------------------------------ */
const z2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const fmtDate = (d = new Date()) => `${d.getFullYear()}.${z2(d.getMonth() + 1)}.${z2(d.getDate())}`;

/** HTML 엔티티 보수적 디코딩: 보고서 가독성 ↑ */
function htmlEntitiesDecode(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/** 입력이 JSON 문자열이어도 본문 HTML만 깔끔 추출 */
function sanitizeGoogleReportHtml(raw: string): string {
  const text = (raw ?? '').toString().trim();
  if (!text) return '';

  // JSON 형태라면 다양한 키 후보를 순서대로 탐색
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const obj = JSON.parse(text);

      const pick = (...keys: string[]) => {
        for (const k of keys) {
          const v = obj?.[k];
          if (typeof v === 'string' && v.trim()) return v;
        }
        return '';
      };

      // 가장 가능성 높은 키 우선
      const html =
        pick(
          'final_report_html',
          'precision_verification_html',
          'final_summary_html',
          'report_html',
          'html',
        ) ||
        // 텍스트만 있으면 div로 감싸기
        ((): string => {
          const t =
            pick('final_summary_text', 'final_report_text', 'summary', 'content', 'text') || '';
          return t ? `<div>${t}</div>` : '';
        })();

      if (html) return html.toString();
      // 지원 키 미존재 시: 원문 그대로 사용
    } catch {
      /* JSON 파싱 실패 → 원문 사용 */
    }
  }
  return text;
}

/* ---------------- Google OAuth 콜백 파라미터 처리 ---------------- */
export const handleGoogleCallback = (): string | null => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  if (code && state === 'google_docs_auth') {
    window.history.replaceState({}, document.title, window.location.pathname);
    return code;
  }
  return null;
};

/* ---------------- 인증: 새 탭에서 진행 (기존 시그니처 유지) ---------------- */
export const authenticateGoogle = async (): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('get-google-config');
  if (error) throw new Error(`Supabase 함수 호출 실패: ${error.message}`);
  const { clientId, redirectUri } = data || {};
  if (!clientId || !redirectUri) throw new Error('Google Client ID 또는 Redirect URI를 찾을 수 없습니다.');

  const scope =
    'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file';
  const state = 'google_docs_auth';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${state}`;

  sessionStorage.setItem('google_auth_pending', 'true');
  sessionStorage.setItem('google_auth_timestamp', Date.now().toString());

  safeOpenNewTab(authUrl);
  throw new Error('새 탭에서 Google 인증을 진행합니다.');
};

/* ---------------- 인증 코드 → 토큰 교환 ---------------- */
export const exchangeCodeForToken = async (
  code: string,
): Promise<{ accessToken: string; refreshToken?: string }> => {
  const { data, error } = await supabase.functions.invoke('exchange-code-for-tokens', {
    body: { code },
  });
  if (error) throw new Error(`토큰 교환 실패: ${error.message || error}`);
  const access_token = data?.access_token as string | undefined;
  if (!access_token) throw new Error('올바른 토큰 응답을 받지 못했습니다.');
  return { accessToken: access_token, refreshToken: data?.refresh_token };
};

/* ---------------- 보고서 → Google Docs 변환 엔진 ---------------- */
/** 기존 함수 이름/리턴 유지. 내부에서 HTML 정규화만 강화 */
const convertHtmlToGoogleDocsRequests = (htmlContent: string): any[] => {
  // 1) 전처리: JSON → 본문 HTML 추출, 엔티티/개행 정리
  let processedHtml = sanitizeGoogleReportHtml(htmlContent);
  processedHtml = htmlEntitiesDecode(processedHtml)
    .replace(/\r\n/g, '\n')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/&bull;|•/g, '•') // 글머리 기호 통일
    // 제목/문단/리스트 → 개행
    .replace(/<\s*h[1-6][^>]*>/gi, '\n\n')
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, '\n')
    .replace(/<\s*p[^>]*>/gi, '\n')
    .replace(/<\s*\/\s*p\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\s*\/\s*(li|div|section|article|footer)\s*>/gi, '\n')
    // 남은 태그 제거
    .replace(/<[^>]+>/g, '')
    // 공백 정리
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 2) 중복 라인 억제(가독성 ↑)
  const lines = processedHtml.split('\n');
  const uniqueLines: string[] = [];
  let lastNonBlank = '';
  for (const ln of lines) {
    const t = ln.trim();
    if (t && t === lastNonBlank) continue;
    uniqueLines.push(ln);
    if (t) lastNonBlank = t;
  }
  processedHtml = uniqueLines.join('\n').trim();

  // 3) Google Docs batchUpdate 요청 구성 (기존 로직 유지, 스타일만 약간 보강)
  const requests: any[] = [];
  let currentIndex = 1;
  let isFirstLine = true;

  processedHtml.split('\n').forEach((line) => {
    let txt = line.trim();

    // 완전 빈 줄 → 개행만 삽입
    if (!txt) {
      requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
      currentIndex += 1;
      return;
    }

    const isNumberedHeading = /^\d+\.\s/.test(txt);
    if (isNumberedHeading && !isFirstLine) {
      requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
      currentIndex += 1;
    }

    const bullet = txt.startsWith('•');
    if (bullet) txt = txt.substring(1).trim();

    const startIndex = currentIndex;
    const textToInsert = txt + '\n';
    requests.push({ insertText: { location: { index: startIndex }, text: textToInsert } });
    const endIndex = startIndex + textToInsert.length;

    // 기본 스타일(보고서 본문 11pt), 제목류는 굵게/크게
    const textStyle: any = { fontSize: { magnitude: 11, unit: 'PT' }, bold: false };
    let fields = 'fontSize,bold';

    if (/^기계설비 성능점검.*Troubleshooting$/i.test(txt) || /^기술검토 및 진단 종합 보고서$/.test(txt)) {
      textStyle.fontSize = { magnitude: 20, unit: 'PT' };
      textStyle.bold = true;
    } else if (/^(Overview|프로필|핵심 진단|최종 종합 의견|요약|요약 및 권고)/.test(txt) || isNumberedHeading) {
      textStyle.fontSize = { magnitude: 16, unit: 'PT' };
      textStyle.bold = true;
    } else if (
      /^(핵심 진단 요약|정밀 검증|기술 검토 보완 요약|심층 검증 결과|추가 및 대안 권고|최종 정밀 검증 완료|단위 변환 공식|압력값 변환|유량 변환|양정\(H\) 계산|경제성 분석|종합 평가)/.test(
        txt,
      )
    ) {
      textStyle.fontSize = { magnitude: 14, unit: 'PT' };
      textStyle.bold = true;
    } else if (/^(전문분야:|배경:|주요 조언:|핵심 조언:)/.test(txt)) {
      textStyle.bold = true;
    }

    requests.push({
      updateTextStyle: { range: { startIndex, endIndex: endIndex - 1 }, textStyle, fields },
    });

    if (bullet) {
      requests.push({
        createParagraphBullets: {
          range: { startIndex, endIndex: endIndex - 1 },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      });
    }

    currentIndex = endIndex;
    isFirstLine = false;
  });

  return requests;
};

/* ---------------- 폴더/파일명 규칙 ---------------- */
const FALLBACK_FOLDER_ID = '1Ndsjt8XGOTkH0mSg2LLfclc3wjO9yiR7'; // 기존 값 유지(안전 폴백)
const getDriveFolderId = (): string => {
  // Vite 환경변수 우선, 없으면 기존 하드코드
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any)?.env || {};
  return env.VITE_DRIVE_TARGET_FOLDER_ID || FALLBACK_FOLDER_ID;
};

const generateReportFileName = (equipmentName?: string): string => {
  const equipment = (equipmentName?.trim() || '미지정').replace(/[\\/:*?"<>|]/g, '_');
  return `기술진단결과_${equipment}_${fmtDate()}`;
};

/* ---------------- 인증 → 문서 생성 (콜백까지 포함) ---------------- */
export const createGoogleDocWithAuth = async (
  htmlContent: string,
  equipmentName?: string,
): Promise<string> => {
  try {
    let authCode = handleGoogleCallback();
    if (!authCode) {
      await authenticateGoogle();
      return ''; // 여기 도달하지 않음(새 탭 이동)
    }

    const { accessToken } = await exchangeCodeForToken(authCode);
    const docUrl = await createGoogleDoc(htmlContent, accessToken, equipmentName);

    sessionStorage.removeItem('google_auth_pending');
    sessionStorage.removeItem('google_auth_timestamp');
    return docUrl;
  } catch (error) {
    sessionStorage.removeItem('google_auth_pending');
    sessionStorage.removeItem('google_auth_timestamp');
    throw error;
  }
};

/* ---------------- 실제 Google Docs 생성 ---------------- */
export const createGoogleDoc = async (
  htmlContent: string,
  accessToken: string,
  equipmentName?: string,
): Promise<string> => {
  // 1) 빈 제목 문서 생성 (파일명 규칙 적용)
  const createResp = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: generateReportFileName(equipmentName) }),
  });
  if (!createResp.ok) {
    throw new Error(`Google Docs 문서 생성 실패: ${await createResp.text()}`);
  }
  const createdDoc = await createResp.json();
  const documentId = createdDoc.documentId as string;

  // 2) 본문 변환 & 삽입
  const requests = convertHtmlToGoogleDocsRequests(htmlContent);
  if (requests.length > 0) {
    const updateResp = await fetch(
      `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      },
    );
    if (!updateResp.ok) {
      const errorBody = await updateResp.text();
      console.error('Google Docs API Error:', errorBody);
      throw new Error(`Google Docs 서식 적용 실패: ${errorBody}`);
    }
  } else {
    console.warn('내보낼 콘텐츠가 없어 빈 문서가 생성되었습니다.');
  }

  // 3) 지정 폴더로 이동 (env 우선, 실패시 무시)
  const targetFolderId = getDriveFolderId();
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${documentId}?addParents=${targetFolderId}&removeParents=root`,
    { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` } },
  ).catch((err) => console.warn('폴더 이동 실패 (치명적이지 않음):', err));

  // 4) 편집 링크 반환 (앱은 링크만 표시 → 화면 덮어쓰기 없음)
  return `https://docs.google.com/document/d/${documentId}/edit`;
};
