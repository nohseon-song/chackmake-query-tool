// src/utils/googleDocsUtils.ts
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

/* ---------------- 임베디드 JSON 안전 치환기 ---------------- */
function findBalancedJsonEnd(s: string, start: number) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}
function nonEmpty(v: any): v is string { return typeof v === 'string' && v.trim().length > 0; }

/** 문자열형 JSON 내부 이스케이프 해제 */
function decodeJsonStr(s: string) {
  return s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
}

/** (보수 패치) 끊어진 꼬리 패턴:  , "final_summary_text":"…"}  → 내용만 보존 */
function patchDanglingFinalSummary(s: string): string {
  return s.replace(/,\s*"final_summary_text"\s*:\s*"([\s\S]*?)"\s*}/g, (_m, g1) => {
    const t = decodeJsonStr(g1).trim();
    return t ? `<p>${t}</p>` : '';
  });
}

/** (보수 패치) 비어있는 자리표시자 JSON은 조용히 제거 */
function dropEmptyPlaceholders(s: string): string {
  return s
    .replace(/{\s*"precision_verification_html"\s*:\s*""\s*}/g, '')
    .replace(/{\s*"final_report_html"\s*:\s*""\s*}/g, '');
}

/** (보수 패치) ```json 코드펜스는 테두리만 제거하고 내용은 살림 */
function stripCodeFences(s: string): string {
  return s.replace(/```(?:json)?\s*([\s\S]*?)```/gi, '$1');
}

/** 본문 중간 JSON 오브젝트를 안전하게 치환(빈 HTML 무시, final_summary_text는 포함) */
function inlineJsonBlocksSafe(raw: string): string {
  if (!raw) return '';
  const keys = [
    'final_report_html',
    'precision_verification_html',
    'final_summary_html',
    'final_report',
    'final_summary_text',
  ];

  let s = raw, out = '', i = 0, inStr = false, esc = false;

  while (i < s.length) {
    const ch = s[i];

    if (inStr) {
      out += ch;
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      i++; continue;
    }
    if (ch === '"') { inStr = true; out += ch; i++; continue; }

    if (ch === '{') {
      const end = findBalancedJsonEnd(s, i);
      if (end !== -1) {
        const block = s.slice(i, end + 1);
        if (keys.some(k => block.includes(`"${k}"`))) {
          try {
            const obj = JSON.parse(block);
            const htmlCandidate =
              [obj.final_report_html, obj.precision_verification_html, obj.final_summary_html, obj.final_report]
                .map((v: any) => (typeof v === 'string' ? v.trim() : v))
                .find(nonEmpty);
            const summary = nonEmpty(obj.final_summary_text) ? `<p>${obj.final_summary_text.trim()}</p>` : '';
            const replacement = nonEmpty(htmlCandidate)
              ? (summary ? htmlCandidate + summary : htmlCandidate)
              : summary;
            out += replacement || '';
            i = end + 1;
            continue;
          } catch {
            // 파싱 실패 → 원문 유지
          }
        }
      }
      out += ch; i++; continue;
    }

    out += ch; i++;
  }
  return out;
}
/* ---------------- 임베디드 JSON 안전 치환기 끝 ---------------- */

/** 입력이 JSON 문자열이어도 본문 HTML만 깔끔 추출(문자열 시작이 JSON일 때) */
function sanitizeGoogleReportHtml(raw: string): string {
  const text = (raw ?? '').toString().trim();
  if (!text) return '';

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const obj = JSON.parse(text);

      const pick = (...keys: string[]) => {
        for (const k of keys) {
          const v = (obj as any)?.[k];
          if (typeof v === 'string' && v.trim()) return v;
        }
        return '';
      };

      const html =
        pick('final_report_html', 'precision_verification_html', 'final_summary_html', 'report_html', 'html') ||
        (() => {
          const t = pick('final_summary_text', 'final_report_text', 'summary', 'content', 'text') || '';
          return t ? `<div>${t}</div>` : '';
        })();

      if (html) return html.toString();
    } catch { /* 원문 사용 */ }
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

  const scope = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file';
  const state = 'google_docs_auth';
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&scope=${encodeURIComponent(scope)}` +
    `&access_type=offline&prompt=consent&state=${state}`;

  sessionStorage.setItem('google_auth_pending', 'true');
  sessionStorage.setItem('google_auth_timestamp', Date.now().toString());

  safeOpenNewTab(authUrl);
  throw new Error('새 탭에서 Google 인증을 진행합니다.');
};

/* ---------------- 인증 코드 → 토큰 교환 ---------------- */
export const exchangeCodeForToken = async (
  code: string,
): Promise<{ accessToken: string; refreshToken?: string }> => {
  const { data, error } = await supabase.functions.invoke('exchange-code-for-tokens', { body: { code } });
  if (error) throw new Error(`토큰 교환 실패: ${error.message || error}`);
  const access_token = data?.access_token as string | undefined;
  if (!access_token) throw new Error('올바른 토큰 응답을 받지 못했습니다.');
  return { accessToken: access_token, refreshToken: data?.refresh_token };
};

/* ---------------- 보고서 → Google Docs 변환 엔진 ---------------- */
/**
 * ✅ 변경 요약
 * 1) (신규) patchDanglingFinalSummary/ dropEmptyPlaceholders/ stripCodeFences 로 '끊어진 JSON 꼬리'만 보수
 * 2) 기존 inlineJsonBlocksSafe + sanitizeGoogleReportHtml 그대로 사용
 * 3) 나머지 라인/스타일 변환 로직은 그대로 유지
 * → 앱 화면/PDF 경로에는 영향 없음(이 함수는 Google Docs 변환 전용)
 */
const convertHtmlToGoogleDocsRequests = (htmlContent: string): any[] => {
  // 0) 원문 보수 패치: 끊어진 요약 꼬리/빈 자리표시자/코드펜스
  let processedHtml = htmlContent || '';
  processedHtml = patchDanglingFinalSummary(processedHtml);
  processedHtml = dropEmptyPlaceholders(processedHtml);
  processedHtml = stripCodeFences(processedHtml);

  // 1) 임베디드 JSON 블록 정리(요약 포함)
  processedHtml = inlineJsonBlocksSafe(processedHtml);

  // 2) 문자열 전체가 JSON이면 본문 키만 추출
  processedHtml = sanitizeGoogleReportHtml(processedHtml);

  // 3) 엔티티/개행 정리(기존 로직)
  processedHtml = htmlEntitiesDecode(processedHtml)
    .replace(/\r\n/g, '\n')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/&bull;|•/g, '•')
    .replace(/<\s*h[1-6][^>]*>/gi, '\n\n')
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, '\n')
    .replace(/<\s*p[^>]*>/gi, '\n')
    .replace(/<\s*\/\s*p\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\s*\/\s*(li|div|section|article|footer)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 4) 중복 라인 억제
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

  // 5) Google Docs batchUpdate 요청 구성(기존 그대로)
  const requests: any[] = [];
  let currentIndex = 1;
  let isFirstLine = true;

  processedHtml.split('\n').forEach((line) => {
    let txt = line.trim();

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

    const textStyle: any = { fontSize: { magnitude: 11, unit: 'PT' }, bold: false };
    let fields = 'fontSize,bold';

    if (/^기계설비 성능점검.*Troubleshooting$/i.test(txt) || /^기술검토 및 진단 종합 보고서$/.test(txt)) {
      textStyle.fontSize = { magnitude: 20, unit: 'PT' }; textStyle.bold = true;
    } else if (/^(Overview|프로필|핵심 진단|최종 종합 의견|요약|요약 및 권고)/.test(txt) || isNumberedHeading) {
      textStyle.fontSize = { magnitude: 16, unit: 'PT' }; textStyle.bold = true;
    } else if (/^(핵심 진단 요약|정밀 검증|기술 검토 보완 요약|심층 검증 결과|추가 및 대안 권고|최종 정밀 검증 완료|단위 변환 공식|압력값 변환|유량 변환|양정\(H\) 계산|경제성 분석|종합 평가)/.test(txt)) {
      textStyle.fontSize = { magnitude: 14, unit: 'PT' }; textStyle.bold = true;
    } else if (/^(전문분야:|배경:|주요 조언:|핵심 조언:)/.test(txt)) {
      textStyle.bold = true;
    }

    requests.push({ updateTextStyle: { range: { startIndex, endIndex: endIndex - 1 }, textStyle, fields } });
    if (bullet) {
      requests.push({ createParagraphBullets: { range: { startIndex, endIndex: endIndex - 1 }, bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' } });
    }

    currentIndex = endIndex;
    isFirstLine = false;
  });

  return requests;
};

// ====== [추가] Google Docs 가독성 프리셋 ======
type RGB = { red: number; green: number; blue: number };
const _rgb = (hex: string): RGB => {
  const n = hex.replace('#', '');
  return {
    red:   parseInt(n.slice(0,2),16)/255,
    green: parseInt(n.slice(2,4),16)/255,
    blue:  parseInt(n.slice(4,6),16)/255,
  };
};

const _COLOR_BASE = _rgb('#111111');   // 본문 기본색(진한 검정)
const _COLOR_ACC  = _rgb('#2563EB');   // 포인트(제목용 파랑)

function _buildReadabilityPresetRequests(documentEndIndex = 1_000_000) {
  const WHOLE = { startIndex: 1, endIndex: documentEndIndex };

  return [
    // 문서: A4 + 여백
    {
      updateDocumentStyle: {
        documentStyle: {
          pageSize: {
            width:  { magnitude: 595, unit: 'PT' },
            height: { magnitude: 842, unit: 'PT' },
          },
          marginTop:    { magnitude: 51, unit: 'PT' },
          marginBottom: { magnitude: 51, unit: 'PT' },
          marginLeft:   { magnitude: 45, unit: 'PT' },
          marginRight:  { magnitude: 45, unit: 'PT' },
        },
        fields: 'pageSize,marginTop,marginBottom,marginLeft,marginRight',
      },
    },
    // 문단 기본: 줄간격 1.5, 단락 뒤 6pt
    {
      updateParagraphStyle: {
        range: WHOLE,
        paragraphStyle: { lineSpacing: 150, spaceBelow: { magnitude: 6, unit: 'PT' } },
        fields: 'lineSpacing,spaceBelow',
      },
    },
    // 본문 글자색: 진한 검정
    {
      updateTextStyle: {
        range: WHOLE,
        textStyle: { foregroundColor: { color: { rgbColor: _COLOR_BASE } } },
        fields: 'foregroundColor',
      },
    },
    // 제목 스타일 색/여백(문서의 NamedStyle 정의만 교정; 문단에 적용은 기존 로직 유지)
    {
      updateNamedStyle: {
        namedStyleType: 'HEADING_2',
        style: {
          textStyle: { bold: true, foregroundColor: { color: { rgbColor: _COLOR_ACC } } },
          paragraphStyle: {
            spaceAbove: { magnitude: 10, unit: 'PT' },
            spaceBelow: { magnitude: 10, unit: 'PT' },
          },
        },
        fields: 'textStyle.bold,textStyle.foregroundColor,paragraphStyle.spaceAbove,paragraphStyle.spaceBelow',
      },
    },
    {
      updateNamedStyle: {
        namedStyleType: 'HEADING_3',
        style: {
          textStyle: { bold: true, foregroundColor: { color: { rgbColor: _COLOR_ACC } } },
          paragraphStyle: {
            spaceAbove: { magnitude: 8, unit: 'PT' },
            spaceBelow: { magnitude: 8, unit: 'PT' },
          },
        },
        fields: 'textStyle.bold,textStyle.foregroundColor,paragraphStyle.spaceAbove,paragraphStyle.spaceBelow',
      },
    },
  ];
}

/** 문서 생성 직후, 가독성 프리셋 1회 적용 (REST/fetch 사용) */
export async function applyDocsReadabilityPreset(documentId: string, accessToken: string) {
  const requests = _buildReadabilityPresetRequests();
  const resp = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(()=>'');
    console.warn('Docs preset failed:', resp.status, t);
    // 프리셋 실패여도 문서 생성/콘텐츠 삽입은 계속 진행 (안정성 우선)
  }
}

/* ---------------- 폴더/파일명 규칙 ---------------- */
const FALLBACK_FOLDER_ID = '1Ndsjt8XGOTkH0mSg2LLfclc3wjO9yiR7'; // 기존 값 유지(안전 폴백)
const getDriveFolderId = (): string => {
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
      return '';
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
  // 1) 규칙 제목으로 생성
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

  // 4) 편집 링크 반환
  return `https://docs.google.com/document/d/${documentId}/edit`;
};
