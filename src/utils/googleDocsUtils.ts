// src/utils/googleDocsUtils.ts

import { supabase } from '@/integrations/supabase/client';

export interface GoogleAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
}

let GOOGLE_CLIENT_ID = '';

// =================================================================
// 인증 관련 함수 (수정 없음 - 완벽하게 작동 중)
// =================================================================
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
// [핵심] PDF와 동일한 가독성을 위한 최종 완성본 변환 로직
// =================================================================
const convertHtmlToGoogleDocsRequests = (htmlContent: string): any[] => {
    const requests: any[] = [];
    let currentIndex = 1;

    const parser = new DOMParser();
    // `<br>` 태그를 임시로 줄바꿈 문자로 바꿔서 처리
    const doc = parser.parseFromString(
        htmlContent.replace(/<br\s*\/?>/gi, '\n'), 
        'text/html'
    );

    const processNode = (node: ChildNode) => {
        // 1. 텍스트 노드 처리
        if (node.nodeType === Node.TEXT_NODE && node.textContent) {
            const text = node.textContent.replace(/\u00A0/g, ' ');
            if (text.trim()) {
                const startIndex = currentIndex;
                requests.push({ insertText: { location: { index: currentIndex }, text } });
                currentIndex += text.length;

                // 부모 노드를 확인하여 인라인 스타일(굵게 등)을 적용
                let parent = node.parentElement;
                if (parent && parent.closest('strong, b')) {
                    requests.push({
                        updateTextStyle: {
                            range: { startIndex, endIndex: currentIndex },
                            textStyle: { bold: true },
                            fields: 'bold',
                        },
                    });
                }
            }
        // 2. 엘리먼트 노드 처리
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tagName = el.tagName.toLowerCase();
            const isBlock = ['p', 'h1', 'h2', 'h3', 'h4', 'div', 'li', 'header', 'footer', 'section', 'article'].includes(tagName);
            
            const startBlockIndex = currentIndex;
            
            // 재귀적으로 자식 노드 처리
            el.childNodes.forEach(processNode);

            const endBlockIndex = currentIndex;

            // 블록 요소 전체에 스타일 적용
            if (isBlock && endBlockIndex > startBlockIndex) {
                 if (['h1', 'h2', 'h3', 'h4'].includes(tagName)) {
                    requests.push({
                        updateParagraphStyle: {
                            range: { startIndex: startBlockIndex, endIndex: endBlockIndex },
                            paragraphStyle: { namedStyleType: `HEADING_${tagName.substring(1)}` },
                            fields: 'namedStyleType',
                        },
                    });
                } else if (tagName === 'li') {
                    requests.push({
                        createParagraphBullets: {
                            range: { startIndex: startBlockIndex, endIndex: endBlockIndex },
                            bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
                        },
                    });
                }
            }

            // 블록 요소 처리 후 줄바꿈 추가
            if (isBlock) {
                requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
                currentIndex += 1;
            }
        }
    };

    doc.body.childNodes.forEach(processNode);
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

  if (requests.length === 0) {
    // 내용이 없을 경우 빈 문서를 만들고 제목만 설정
    console.warn("내보낼 콘텐츠가 없어 빈 문서를 생성합니다.");
  }

  // 1. 문서 생성
  const createResp = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: generateReportFileName(equipmentName) }),
  });
  if (!createResp.ok) throw new Error(`Google Docs 문서 생성 실패: ${await createResp.text()}`);
  const createdDoc = await createResp.json();
  const documentId = createdDoc.documentId as string;

  // 2. 내용 및 서식 일괄 업데이트 (내용이 있을 때만)
  if (requests.length > 0) {
      console.log("Sending to Google Docs API:", JSON.stringify(requests, null, 2));
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
  }

  // 3. 폴더 이동
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${documentId}?addParents=${FOLDER_ID}&removeParents=root`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  ).catch(err => console.warn("폴더 이동 실패 (non-fatal):", err));

  return `https://docs.google.com/document/d/${documentId}/edit`;
};