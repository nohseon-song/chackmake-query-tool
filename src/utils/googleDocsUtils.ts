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
// [핵심] PDF와 동일한 가독성을 위한 최종 완성본 변환 로직 (HTML DOM 파싱 방식으로 전면 재설계)
// =================================================================
const convertHtmlToGoogleDocsRequests = (htmlContent: string): any[] => {
    const requests: any[] = [];
    let currentIndex = 1;

    // HTML 문자열에서 숨겨진 JSON 데이터를 먼저 추출하고 제거합니다.
    const jsonRegex = /<script type="application\/json">([\s\S]*?)<\/script>|({[\s\S]*"precision_verification_html"[\s\S]*})/;
    const jsonMatch = htmlContent.match(jsonRegex);
    let precisionHtml = '';
    let summaryText = '';
    let cleanHtml = htmlContent;

    if (jsonMatch) {
        cleanHtml = htmlContent.replace(jsonRegex, ''); // 원본 HTML에서 JSON 부분 제거
        const jsonString = jsonMatch[1] || jsonMatch[2];
        try {
            const jsonData = JSON.parse(jsonString);
            precisionHtml = jsonData.precision_verification_html || '';
            summaryText = jsonData.final_summary_text || '';
        } catch (e) {
            console.error("숨겨진 JSON 데이터 파싱 실패:", e);
        }
    }

    const parser = new DOMParser();

    // DOM 노드를 재귀적으로 탐색하며 Google Docs API 요청을 생성하는 함수
    const processNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (text && text.trim()) {
                const textStartIndex = currentIndex;
                requests.push({ insertText: { location: { index: currentIndex }, text } });
                currentIndex += text.length;

                // 부모 태그에 따라 인라인 스타일(굵게, 기울임) 적용
                const parent = node.parentElement;
                if (parent) {
                    const textStyle: { bold?: boolean; italic?: boolean } = {};
                    const fields: string[] = [];
                    if (parent.closest('strong, b')) {
                        textStyle.bold = true;
                        fields.push('bold');
                    }
                    if (parent.closest('em, i')) {
                        textStyle.italic = true;
                        fields.push('italic');
                    }
                    if (fields.length > 0) {
                        requests.push({
                            updateTextStyle: {
                                range: { startIndex: textStartIndex, endIndex: currentIndex },
                                textStyle,
                                fields: fields.join(','),
                            },
                        });
                    }
                }
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tagName = el.tagName.toLowerCase();
            const blockStartIndex = currentIndex;

            el.childNodes.forEach(processNode);

            // 블록 레벨 요소에 따라 스타일 적용
            const headingMatch = tagName.match(/^h([1-6])$/);
            if (headingMatch) {
                requests.push({
                    updateParagraphStyle: {
                        range: { startIndex: blockStartIndex, endIndex: currentIndex },
                        paragraphStyle: { namedStyleType: `HEADING_${headingMatch[1]}` },
                        fields: 'namedStyleType',
                    },
                });
            } else if (tagName === 'li') {
                requests.push({
                    createParagraphBullets: {
                        range: { startIndex: blockStartIndex, endIndex: currentIndex },
                        bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
                    },
                });
            } else if (tagName === 'pre') {
                 requests.push({
                    updateTextStyle: {
                        range: { startIndex: blockStartIndex, endIndex: currentIndex },
                        textStyle: { weightedFontFamily: { fontFamily: 'Courier New' }, fontSize: { magnitude: 9, unit: 'PT' } },
                        fields: 'weightedFontFamily,fontSize',
                    },
                });
            }

            // 블록 요소 처리 후 줄바꿈 추가 (가독성 향상)
            if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'div', 'section', 'header', 'footer', 'article', 'pre'].includes(tagName)) {
                if (currentIndex > 1 && requests[requests.length - 1]?.insertText?.text !== '\n') {
                    requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
                    currentIndex++;
                }
            }
        }
    };
    
    // 1. 정리된 기본 HTML 콘텐츠 처리
    const mainDoc = parser.parseFromString(cleanHtml, 'text/html');
    processNode(mainDoc.body);

    // 2. 추출된 JSON 안의 HTML 콘텐츠 처리
    if (precisionHtml) {
        const precisionDoc = parser.parseFromString(`<div>${precisionHtml}</div>`, 'text/html');
        processNode(precisionDoc.body);
    }
    
    // 3. 추출된 JSON 안의 요약 텍스트 처리
    if (summaryText) {
        requests.push({ insertText: { location: { index: currentIndex }, text: summaryText + '\n' } });
        currentIndex += summaryText.length + 1;
    }

    // 마지막에 불필요한 줄바꿈이 있으면 제거
    if (requests.length > 0 && requests[requests.length - 1]?.insertText?.text === '\n') {
        requests.pop();
    }

    return requests;
};


const FOLDER_ID = '1Ndsjt8XGOTkH0mSg2LLfclc3wjO9yiR7'; // 지정된 구글 드라이브 폴더 ID

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
    // console.log("Sending to Google Docs API:", JSON.stringify(requests, null, 2));
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