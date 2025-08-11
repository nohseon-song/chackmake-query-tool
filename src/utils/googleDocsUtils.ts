// src/utils/googleDocsUtils.ts

import { supabase } from '@/integrations/supabase/client';

export interface GoogleAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
}

let GOOGLE_CLIENT_ID = '';

// --- 인증 관련 함수 (수정 없음) ---
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
export const setGoogleClientId = (clientId: string) => { GOOGLE_CLIENT_ID = clientId; };
export const getGoogleClientId = (): string => GOOGLE_CLIENT_ID;
export const authenticateGoogle = async (): Promise<string> => {
  try {
    let clientId = getGoogleClientId();
    if (!clientId) clientId = await fetchGoogleClientId();
    if (!clientId) throw new Error('Google Client ID를 가져올 수 없습니다.');
    const scope = ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive.file'].join(' ');
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
            if (code) resolve(code);
            else reject(new Error('Google 인증에 실패했습니다.'));
          }
        } catch (error) { /* Cross-origin error, ignore */ }
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
export const validateGoogleToken = async (accessToken: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
    return response.ok;
  } catch (error) {
    console.error('토큰 검증 실패:', error);
    return false;
  }
};
export const exchangeCodeForToken = async (code: string): Promise<{ accessToken: string; refreshToken?: string }> => {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error('Google Client ID가 설정되지 않았습니다.');
  const { data, error } = await supabase.functions.invoke('exchange-code-for-tokens', { body: { code, clientId } });
  if (error) throw new Error(`토큰 교환 실패: ${error.message || error}`);
  const access_token = (data as any)?.access_token as string | undefined;
  const refresh_token = (data as any)?.refresh_token as string | undefined;
  if (!access_token) throw new Error('올바른 토큰 응답을 받지 못했습니다.');
  return { accessToken: access_token, refreshToken: refresh_token };
};


// =================================================================
// [최종 오버홀 버전] 고성능 HTML 변환 엔진
// =================================================================
const convertHtmlToGoogleDocsRequests = (htmlContent: string): any[] => {
    const requests: any[] = [];
    let currentIndex = 1;

    // HTML을 정규화하고, 태그와 텍스트로 분리
    const cleanedHtml = htmlContent.replace(/<br\s*\/?>/gi, '\n').replace(/>\s+</g, '><').trim();
    const parts = cleanedHtml.split(/(<[^>]+>)/g).filter(Boolean);

    let currentTag = 'p'; // 현재 텍스트 블록의 태그 종류
    let isBold = false;
    let isItalic = false;

    for (const part of parts) {
        if (part.startsWith('<')) { // 태그 처리
            const match = part.match(/<\/?(\w+)/);
            if (match) {
                const tagName = match[1].toLowerCase();
                const isClosingTag = part.startsWith('</');

                if (['h1', 'h2', 'h3', 'p', 'li'].includes(tagName)) {
                    currentTag = isClosingTag ? 'p' : tagName;
                } else if (tagName === 'strong' || tagName === 'b') {
                    isBold = !isClosingTag;
                } else if (tagName === 'em' || tagName === 'i') {
                    isItalic = !isClosingTag;
                }
            }
        } else { // 텍스트 콘텐츠 처리
            const text = part.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            if (!text.trim()) continue;

            const textToInsert = text + '\n';
            const startIndex = currentIndex;
            requests.push({ insertText: { location: { index: startIndex }, text: textToInsert } });
            const endIndex = startIndex + textToInsert.length;

            const textStyle: any = {};
            let fields = '';

            // 1. 태그 기반 스타일 (h1, h2, li 등)
            switch (currentTag) {
                case 'h1':
                    textStyle.fontSize = { magnitude: 20, unit: 'PT' };
                    textStyle.bold = true;
                    fields = 'fontSize,bold';
                    break;
                case 'h2':
                    textStyle.fontSize = { magnitude: 16, unit: 'PT' };
                    textStyle.bold = true;
                    fields = 'fontSize,bold';
                    break;
                case 'h3':
                    textStyle.fontSize = { magnitude: 14, unit: 'PT' };
                    textStyle.bold = true;
                    fields = 'fontSize,bold';
                    break;
                case 'li':
                case 'p':
                default:
                    textStyle.fontSize = { magnitude: 11, unit: 'PT' };
                    fields = 'fontSize';
                    break;
            }

            // 2. 인라인 스타일 (strong, em)
            if (isBold) {
                textStyle.bold = true;
                if (!fields.includes('bold')) fields += ',bold';
            }
            if (isItalic) {
                textStyle.italic = true;
                if (!fields.includes('italic')) fields += ',italic';
            }
            
            requests.push({
                updateTextStyle: {
                    range: { startIndex, endIndex: endIndex - 1 },
                    textStyle,
                    fields: fields.replace(/,$/, ''),
                },
            });

            // 3. 목록(<li>)일 경우 글머리 기호 생성
            if (currentTag === 'li' || text.trim().startsWith('•')) {
                 requests.push({
                    createParagraphBullets: {
                        range: { startIndex, endIndex: endIndex - 1 },
                        bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
                    },
                });
            }

            currentIndex = endIndex;
        }
    }
    return requests;
};

// --- 나머지 함수 (수정 없음) ---
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

  const requests = convertHtmlToGoogleDocsRequests(htmlContent);

  if (requests.length > 0) {
    const updateResp = await fetch(
      `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      }
    );
    if (!updateResp.ok) {
      const errorBody = await updateResp.text();
      console.error("Google Docs API Error:", errorBody);
      throw new Error(`Google Docs 서식 적용 실패: ${errorBody}`);
    }
  } else {
    console.warn("내보낼 콘텐츠가 없어 빈 문서가 생성되었습니다.");
  }

  await fetch(
    `https://www.googleapis.com/drive/v3/files/${documentId}?addParents=${FOLDER_ID}&removeParents=root`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  ).catch(err => console.warn("폴더 이동 실패 (치명적이지 않음):", err));

  return `https://docs.google.com/document/d/${documentId}/edit`;
};