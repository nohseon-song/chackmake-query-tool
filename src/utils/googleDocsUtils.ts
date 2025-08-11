// src/utils/googleDocsUtils.ts

import { supabase } from '@/integrations/supabase/client';

export interface GoogleAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
}

let GOOGLE_CLIENT_ID = '';

// Supabase Function을 통해 환경 변수에서 클라이언트 ID를 안전하게 가져옵니다.
export const fetchGoogleClientId = async (): Promise<string> => {
  if (GOOGLE_CLIENT_ID) return GOOGLE_CLIENT_ID;
  try {
    const { data, error } = await supabase.functions.invoke('get-google-config');
    if (error) throw new Error(`Supabase 함수 호출 실패: ${error.message}`);
    const clientId = (data as any)?.clientId;
    if (!clientId) throw new Error('Google Client ID를 응답에서 찾을 수 없습니다.');
    GOOGLE_CLIENT_ID = clientId;
    return clientId;
  } catch (error) {
    console.error('Google Client ID 가져오기 오류:', error);
    if (typeof window !== 'undefined') {
      const storedClientId = localStorage.getItem('GOOGLE_CLIENT_ID');
      if (storedClientId) {
        console.warn('Supabase 함수 실패, 로컬 스토리지에서 Client ID를 사용합니다.');
        GOOGLE_CLIENT_ID = storedClientId;
        return storedClientId;
      }
    }
    throw new Error('Google Client ID를 가져올 수 없습니다. API 설정을 확인하세요.');
  }
};

export const setGoogleClientId = (clientId: string) => {
  GOOGLE_CLIENT_ID = clientId;
};

export const getGoogleClientId = (): string => GOOGLE_CLIENT_ID;

// OAuth 인증 팝업을 통해 'Authorization Code'를 얻는 함수
export const authenticateGoogle = async (): Promise<string> => {
  try {
    let clientId = getGoogleClientId();
    if (!clientId) clientId = await fetchGoogleClientId();
    if (!clientId) throw new Error('Google Client ID를 가져올 수 없습니다.');

    const scope = [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file',
    ].join(' ');

    const redirectUri = `${window.location.protocol}//${window.location.host}`;

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('include_granted_scopes', 'true');
    authUrl.searchParams.append('access_type', 'offline');

    const popup = window.open(authUrl.toString(), 'google-auth', 'width=500,height=650');
    if (!popup) throw new Error('팝업이 차단되었습니다.');

    return new Promise<string>((resolve, reject) => {
      const timer = setInterval(() => {
        try {
          if (popup.location.href.startsWith(redirectUri)) {
            const url = new URL(popup.location.href);
            const code = url.searchParams.get('code');
            clearInterval(timer);
            popup.close();
            if (code) {
              resolve(code);
            } else {
              reject(new Error('Google 인증에 실패했습니다.'));
            }
          }
        } catch (error) {
          // Cross-origin error, ignore
        }
        if (popup.closed) {
          clearInterval(timer);
          reject(new Error('인증 창이 닫혔습니다.'));
        }
      }, 500);
    });
  } catch (error: any) {
    console.error('❌ 인증 실패:', error);
    throw new Error(`Google 인증에 실패했습니다: ${error.message}`);
  }
};

// 액세스 토큰의 유효성을 검사하는 함수
export const validateGoogleToken = async (accessToken: string): Promise<boolean> => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
    );
    return response.ok;
  } catch (error) {
    console.error('토큰 검증 실패:', error);
    return false;
  }
};

// 'Authorization Code'를 'Access Token'으로 교환하는 함수
export const exchangeCodeForToken = async (
  code: string
): Promise<{ accessToken: string; refreshToken?: string }> => {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error('Google Client ID가 설정되지 않았습니다.');

  const { data, error } = await supabase.functions.invoke('exchange-code-for-tokens', {
    body: { code, clientId },
  });

  if (error) {
    throw new Error(`토큰 교환 실패: ${error.message || error}`);
  }

  const access_token = (data as any)?.access_token as string | undefined;
  const refresh_token = (data as any)?.refresh_token as string | undefined;
  if (!access_token)
    throw new Error('올바른 토큰 응답을 받지 못했습니다.');

  return { accessToken: access_token, refreshToken: refresh_token };
};

// =================================================================
// [핵심] HTML을 Google Docs 요청으로 변환하는 로직 (규칙에 맞게 전면 재작성)
// =================================================================
export const convertHtmlToGoogleDocsRequests = (htmlContent: string): any[] => {
  const requests: any[] = [];
  let currentIndex = 1; // Google Docs API는 1부터 시작

  // 상태 플래그
  let lastWasNewline = false; // 연속 줄바꿈 방지
  let prevBlockTag: string | null = null; // h3 → p 간격 예외 처리용

  const BLOCK_TAGS = new Set([
    'p', 'div', 'section', 'article', 'header', 'footer', 'aside', 'main',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote', 'ul', 'ol', 'li'
  ]);

  // 0) HTML 내 숨겨진 JSON 추출 및 제거
  const jsonRegex = /<script\s+type=["']application\/json["']>([\s\S]*?)<\/script>|({[\s\S]*?"precision_verification_html"[\s\S]*?})/i;
  const jsonMatch = htmlContent.match(jsonRegex);
  let precisionHtml = '';
  let summaryText = '';
  let cleanHtml = htmlContent;

  if (jsonMatch) {
    cleanHtml = htmlContent.replace(jsonRegex, '');
    const jsonString = jsonMatch[1] || jsonMatch[2];
    try {
      const jsonData = JSON.parse(jsonString);
      precisionHtml = jsonData.precision_verification_html || '';
      summaryText = jsonData.final_summary_text || '';
    } catch (e) {
      console.warn('숨겨진 JSON 파싱 실패:', e);
    }
  }

  const parser = new DOMParser();

  // 텍스트 삽입 유틸 - NBSP/CR 정규화 및 인덱스/개행 상태 갱신
  const insertText = (text: string) => {
    if (!text) return;
    const normalized = text.replace(/\u00A0/g, ' ').replace(/\r/g, '');
    if (!normalized) return;
    requests.push({ insertText: { location: { index: currentIndex }, text: normalized } });
    currentIndex += normalized.length;
    lastWasNewline = /\n$/.test(normalized);
  };

  // 블록 시작 시 정확히 1개의 줄바꿈 보장 (단, h3 → p 예외)
  const ensureLeadingGapForBlock = (currentTag: string) => {
    if (currentIndex === 1) { // 문서 시작부
      lastWasNewline = false;
      return;
    }
    const suppress = prevBlockTag === 'h3' && currentTag === 'p';
    if (suppress) return;
    if (!lastWasNewline) insertText('\n');
  };

  // 블록 기본 텍스트 스타일(폰트 크기/굵기/글꼴)
  const applyBlockBaseTextStyle = (start: number, end: number, tag: string) => {
    let textStyle: any = {};
    const fields: string[] = [];

    const t = tag.toLowerCase();
    if (t === 'h1') {
      textStyle.fontSize = { magnitude: 20, unit: 'PT' };
      textStyle.bold = true;
      fields.push('fontSize', 'bold');
    } else if (t === 'h2') {
      textStyle.fontSize = { magnitude: 16, unit: 'PT' };
      textStyle.bold = true;
      fields.push('fontSize', 'bold');
    } else if (['h3', 'h4', 'h5', 'h6'].includes(t)) {
      textStyle.fontSize = { magnitude: 14, unit: 'PT' };
      textStyle.bold = true;
      fields.push('fontSize', 'bold');
    } else if (t === 'pre') {
      textStyle.fontSize = { magnitude: 10, unit: 'PT' };
      textStyle.weightedFontFamily = { fontFamily: 'Courier New' };
      fields.push('fontSize', 'weightedFontFamily');
    } else { // 기본 본문
      textStyle.fontSize = { magnitude: 10, unit: 'PT' };
      fields.push('fontSize');
    }

    requests.push({
      updateTextStyle: {
        range: { startIndex: start, endIndex: end },
        textStyle,
        fields: fields.join(','),
      },
    });
  };

  // 목록 서식 적용 (ul/ol 내부 li에만)
  const applyListIfNeeded = (el: HTMLElement, start: number, end: number) => {
    if (el.tagName.toLowerCase() !== 'li') return;
    const parent = el.parentElement;
    if (!parent) return;
    const pt = parent.tagName.toLowerCase();
    if (pt !== 'ul' && pt !== 'ol') return;

    const bulletPreset = pt === 'ul' ? 'BULLET_DISC_CIRCLE_SQUARE' : 'NUMBERED_DECIMAL_ALPHA_ROMAN';
    requests.push({
      createParagraphBullets: {
        range: { startIndex: start, endIndex: end },
        bulletPreset,
      },
    });
  };

  // 인라인 노드 처리 - 선택적 굵게(강조)만 적용, br는 최대 한 줄로 축소
  const processInline = (node: Node, inherited: { bold?: boolean } = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.textContent ?? '';
      if (!raw) return;

      const text = raw.replace(/\u00A0/g, ' ').replace(/\r/g, '');
      if (!text) return;

      const start = currentIndex;
      insertText(text);

      if (inherited.bold) {
        requests.push({
          updateTextStyle: {
            range: { startIndex: start, endIndex: currentIndex },
            textStyle: { bold: true },
            fields: 'bold',
          },
        });
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      // br: 여러 개 연속 시 최대 한 줄로만
      if (tag === 'br') {
        if (!lastWasNewline) insertText('\n');
        return;
      }

      const nextInherited = { ...inherited };
      if (tag === 'strong' || tag === 'b') nextInherited.bold = true;

      el.childNodes.forEach((child) => processInline(child, nextInherited));
    }
  };

  // 블록 요소 처리
  const processBlock = (el: HTMLElement) => {
    const tag = el.tagName.toLowerCase();

    // 내용이 실질적으로 없는 경우 스킵 (연속 빈 단락 제거 효과)
    const onlyWhitespaceOrEmpty = !el.textContent || el.textContent.replace(/\u00A0/g, ' ').trim() === '';
    if (onlyWhitespaceOrEmpty) return;

    // 블록 시작 간격 보장 (예외: h3 → p)
    ensureLeadingGapForBlock(tag);

    const start = currentIndex;

    if (tag === 'ul' || tag === 'ol') {
      // 목록 컨테이너 자체는 텍스트가 없고 li만 처리
      Array.from(el.children).forEach((child) => {
        if ((child as HTMLElement).tagName.toLowerCase() === 'li') processBlock(child as HTMLElement);
      });
    } else {
      // 일반 블록: 인라인 처리 후 스타일/목록 적용
      el.childNodes.forEach((child) => processInline(child));

      const end = currentIndex;
      if (end > start) {
        applyBlockBaseTextStyle(start, end, tag);
        applyListIfNeeded(el, start, end);
      }
    }

    prevBlockTag = tag;
  };

  // 컨테이너 내부 블록들을 순서대로 방문
  const walkContainer = (parent: Node) => {
    parent.childNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (tag === 'ul' || tag === 'ol') {
          processBlock(el);
        } else if (BLOCK_TAGS.has(tag)) {
          processBlock(el);
        } else {
          // 비블록 요소 내부에서 블록 탐색 계속
          walkContainer(el);
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        // body 직속 텍스트는 임시 p로 래핑하여 처리
        const text = (node.textContent ?? '').replace(/\u00A0/g, ' ');
        if (text.trim()) {
          const p = document.createElement('p');
          p.textContent = text;
          processBlock(p);
        }
      }
    });
  };

  // 1) 메인 HTML 처리
  const mainDoc = parser.parseFromString(cleanHtml, 'text/html');
  walkContainer(mainDoc.body);

  // 2) precision_verification_html 처리
  if (precisionHtml) {
    const precisionDoc = parser.parseFromString(`<div>${precisionHtml}</div>`, 'text/html');
    walkContainer(precisionDoc.body);
  }

  // 3) final_summary_text 처리
  if (summaryText && summaryText.trim()) {
    const p = document.createElement('p');
    p.textContent = summaryText;
    processBlock(p);
  }

  return requests;
};

const FOLDER_ID = '1Ndsjt8XGOTkH0mSg2LLfclc3wjO9yiR7';

const generateReportFileName = (equipmentName?: string): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const equipment = equipmentName?.trim() || '설비';
  return `기술진단내역작성_${equipment}_${year}.${month}.${day}`;
};

export const createGoogleDoc = async (
  htmlContent: string,
  accessToken: string,
  equipmentName?: string
): Promise<string> => {
  const isValid = await validateGoogleToken(accessToken);
  if (!isValid) throw new Error('Google API 토큰이 유효하지 않습니다.');

  const requests = convertHtmlToGoogleDocsRequests(htmlContent);
  if (requests.length === 0) throw new Error('Google Docs로 변환할 콘텐츠가 없습니다.');

  // 1) 문서 생성
  const createResp = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: generateReportFileName(equipmentName) }),
  });
  if (!createResp.ok) throw new Error(`Google Docs 문서 생성 실패: ${await createResp.text()}`);
  const createdDoc = await createResp.json();
  const documentId = createdDoc.documentId as string;

  // 2) 콘텐츠 삽입/서식 적용
  const updateResp = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    }
  );
  if (!updateResp.ok) throw new Error(`Google Docs 서식 적용 실패: ${await updateResp.text()}`);

  // 3) 문서 이동 (선택)
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${documentId}?addParents=${FOLDER_ID}&removeParents=root`,
    { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` } }
  ).catch((err) => console.warn('폴더 이동 실패 (non-fatal):', err));

  return `https://docs.google.com/document/d/${documentId}/edit`;
};
