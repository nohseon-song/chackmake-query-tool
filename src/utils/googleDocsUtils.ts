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
// [핵심] 가독성 문제를 해결한 최종 완성본 변환 로직
// =================================================================
const convertHtmlToGoogleDocsRequests = (htmlContent: string): any[] => {
    const requests: any[] = [];
    let currentIndex = 1;

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    const processNodes = (nodes: NodeListOf<ChildNode>) => {
        nodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                const textContent = (el.textContent || '').trim();
                
                if (!textContent) return; // 내용이 없는 요소는 건너뜁니다.

                const textToInsert = textContent + '\n';
                const startIndex = currentIndex;

                requests.push({ insertText: { location: { index: currentIndex }, text: textToInsert } });
                currentIndex += textToInsert.length;
                
                const elementEndIndex = currentIndex - 1;

                switch (el.tagName.toLowerCase()) {
                    case 'h1':
                    case 'h2':
                    case 'h3':
                    case 'h4':
                        requests.push({
                            updateParagraphStyle: {
                                range: { startIndex, endIndex: elementEndIndex },
                                paragraphStyle: { namedStyleType: `HEADING_${el.tagName.substring(1)}` },
                                fields: 'namedStyleType',
                            },
                        });
                        break;
                    case 'ul':
                        // ul 안의 li들을 찾아서 처리합니다.
                        el.querySelectorAll('li').forEach(li => {
                            const liText = (li.textContent || '').trim();
                            if (!liText) return;

                            const liStartIndex = (requests[requests.length - 1].insertText.text.lastIndexOf(liText) + startIndex);
                            const liEndIndex = liStartIndex + liText.length;
                           
                            requests.push({
                                createParagraphBullets: {
                                    range: { startIndex: liStartIndex, endIndex: liEndIndex },
                                    bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
                                },
                            });
                        });
                        break;
                }
                
                // strong 태그는 별도로 찾아 처리합니다 (더 안정적).
                el.querySelectorAll('strong, b').forEach(strong => {
                    const strongText = (strong.textContent || '').trim();
                    if (!strongText) return;

                    let strongStartIndex = -1;
                    let lastRequestText = requests[requests.length-1].insertText.text;
                    let searchOffset = startIndex;

                    // 텍스트 블록 내에서 strong 태그의 위치를 찾습니다.
                    strongStartIndex = lastRequestText.indexOf(strongText, searchOffset - (currentIndex - lastRequestText.length));

                    if (strongStartIndex !== -1) {
                         const absoluteStartIndex = (currentIndex - lastRequestText.length) + strongStartIndex;
                         const strongEndIndex = absoluteStartIndex + strongText.length;
                        requests.push({
                            updateTextStyle: {
                                range: { startIndex: absoluteStartIndex, endIndex: strongEndIndex },
                                textStyle: { bold: true },
                                fields: 'bold',
                            },
                        });
                    }
                });
            }
        });
    };

    processNodes(doc.body.childNodes);
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
    throw new Error('Google Docs로 변환할 콘텐츠가 없습니다.');
  }

  // 디버깅을 위해 최종 요청 객체를 콘솔에 출력합니다.
  console.log("Sending to Google Docs API:", JSON.stringify(requests, null, 2));

  const createResp = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: generateReportFileName(equipmentName) }),
  });
  if (!createResp.ok) throw new Error(`Google Docs 문서 생성 실패: ${await createResp.text()}`);
  const createdDoc = await createResp.json();
  const documentId = createdDoc.documentId as string;

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

  await fetch(
    `https://www.googleapis.com/drive/v3/files/${documentId}?addParents=${FOLDER_ID}&removeParents=root`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  ).catch(err => console.warn("폴더 이동 실패 (non-fatal):", err));

  return `https://docs.google.com/document/d/${documentId}/edit`;
};