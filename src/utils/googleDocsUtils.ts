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
// [핵심] PDF와 동일한 가독성을 위한 최종 완성본 변환 로직 (패턴 분석 방식으로 전면 수정)
// =================================================================
const convertHtmlToGoogleDocsRequests = (htmlContent: string): any[] => {
    const requests: any[] = [];
    let currentIndex = 1;

    // 1. HTML을 다루기 쉬운 텍스트로 정제합니다.
    // <p>, <div>, <br> 태그를 모두 줄바꿈(\n)으로 변경하여 일관성을 유지합니다.
    const textContent = htmlContent
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?p>/gi, '\n')
        .replace(/<\/?div.*?>/gi, '\n')
        .replace(/&nbsp;/g, ' ') // 공백 문자 처리
        .replace(/\n{3,}/g, '\n\n') // 여러 줄바꿈을 최대 2개로 압축
        .trim();

    // 2. 정제된 텍스트를 줄바꿈 기준으로 문단 배열로 만듭니다.
    const paragraphs = textContent.split('\n');

    // 3. 각 문단을 순회하며 내용에 따라 서식을 적용합니다.
    for (const paragraph of paragraphs) {
        const trimmedParagraph = paragraph.trim();
        if (!trimmedParagraph) {
            // 빈 줄은 그대로 유지하여 단락 구분을 만듭니다.
            requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
            currentIndex++;
            continue;
        }

        const paragraphStartIndex = currentIndex;

        // 4. 문단 내의 굵은 글씨(<strong>, <b>)를 처리합니다.
        // 정규식을 사용하여 태그와 일반 텍스트를 분리합니다.
        const parts = trimmedParagraph.split(/(<strong>.*?<\/strong>|<b>.*?<\/b>)/g).filter(Boolean);

        for (const part of parts) {
            const isBold = /<strong>.*?<\/strong>|<b>.*?<\/b>/.test(part);
            const text = part.replace(/<\/?(strong|b)>/g, '');

            if (text) {
                const textStartIndex = currentIndex;
                requests.push({ insertText: { location: { index: currentIndex }, text } });
                currentIndex += text.length;

                if (isBold) {
                    requests.push({
                        updateTextStyle: {
                            range: { startIndex: textStartIndex, endIndex: currentIndex },
                            textStyle: { bold: true },
                            fields: 'bold',
                        },
                    });
                }
            }
        }
        
        // 5. 문단 전체에 적용될 스타일을 내용 패턴에 따라 결정합니다.
        // 예: "1. ~", "2. ~" 로 시작하면 HEADING_2 스타일 적용
        if (/^\d+\.\s/.test(trimmedParagraph)) {
            requests.push({
                updateParagraphStyle: {
                    range: { startIndex: paragraphStartIndex, endIndex: currentIndex },
                    paragraphStyle: { namedStyleType: 'HEADING_2' },
                    fields: 'namedStyleType',
                },
            });
        // 예: "• " 로 시작하면 글머리 기호 적용
        } else if (/^•\s/.test(trimmedParagraph)) {
             requests.push({
                createParagraphBullets: {
                    range: { startIndex: paragraphStartIndex, endIndex: currentIndex },
                    bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
                },
            });
        // 예: "핵심 진단 요약", "최종 종합 의견" 등 특정 키워드는 HEADING_3 스타일 적용
        } else if (['핵심 진단 요약', '정밀 검증', '최종 종합 의견', '기술 검토 보완 요약', '심층 검증 결과', '추가 및 대안 권고', '최종 정밀 검증 완료'].includes(trimmedParagraph)) {
             requests.push({
                updateParagraphStyle: {
                    range: { startIndex: paragraphStartIndex, endIndex: currentIndex },
                    paragraphStyle: { namedStyleType: 'HEADING_3' },
                    fields: 'namedStyleType',
                },
            });
        }

        // 각 문단이 끝난 후 줄바꿈을 추가하여 다음 문단과 분리합니다.
        requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
        currentIndex++;
    }

    return requests;
};


const FOLDER_ID = '1Ndsjt8XGOTkH0mSg2LLfclc3wjO9yiR7'; // 지정된 구글 드라이브 폴더 ID

/**
 * 보고서 파일 이름을 생성합니다. (예: 기술진단내역작성_설비명_2025.08.11)
 * @param equipmentName 설비 이름
 * @returns 생성된 파일 이름
 */
const generateReportFileName = (equipmentName?: string): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const equipment = equipmentName?.trim() || '설비';
  return `기술진단내역작성_${equipment}_${year}.${month}.${day}`;
};

/**
 * HTML 콘텐츠를 사용하여 Google Docs 문서를 생성하고 지정된 폴더로 이동시킵니다.
 * @param htmlContent 문서에 채울 HTML 형식의 콘텐츠
 * @param accessToken Google API 접근 토큰
 * @param equipmentName 파일 이름에 사용될 설비 이름
 * @returns 생성된 Google Docs 문서의 URL
 */
export const createGoogleDoc = async (
  htmlContent: string,
  accessToken: string,
  equipmentName?: string
): Promise<string> => {
  const isValid = await validateGoogleToken(accessToken);
  if (!isValid) throw new Error('Google API 토큰이 유효하지 않습니다.');

  // 1. 문서 생성 (제목만 포함)
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

  // 2. HTML을 Google Docs API 요청으로 변환
  const requests = convertHtmlToGoogleDocsRequests(htmlContent);

  // 3. 내용 및 서식 일괄 업데이트 (내용이 있을 때만)
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
      // 문서 업데이트 실패 시 생성된 빈 문서를 삭제하는 로직을 추가할 수 있습니다.
      throw new Error(`Google Docs 서식 적용 실패: ${errorBody}`);
    }
  } else {
    console.warn("내보낼 콘텐츠가 없어 빈 문서가 생성되었습니다.");
  }

  // 4. 생성된 문서를 지정된 폴더로 이동
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${documentId}?addParents=${FOLDER_ID}&removeParents=root`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  ).catch(err => console.warn("폴더 이동 실패 (치명적이지 않음):", err));

  return `https://docs.google.com/document/d/${documentId}/edit`;
};