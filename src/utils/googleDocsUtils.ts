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
// [최종 완성본] 자동 보정 및 줄바꿈 최적화 엔진
// =================================================================
const convertHtmlToGoogleDocsRequests = (htmlContent: string): any[] => {
    let processedHtml = htmlContent;

    const jsonRegex = /{\s*"precision_verification_html":\s*"([\s\S]*?)",\s*"final_summary_text":\s*"([\s\S]*?)"\s*}/;
    const jsonMatch = processedHtml.match(jsonRegex);
    if (jsonMatch) {
        const verificationHtml = jsonMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/•/g, '<li>•');
        processedHtml = processedHtml.replace(jsonRegex, verificationHtml);
    }
    
    processedHtml = processedHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>|<\/li>|<\/h[1-3]>/gi, '\n')
        .replace(/\s*\n\s*/g, '\n')
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\n\s*•/g, '\n•')
        .trim();

    const requests: any[] = [];
    let currentIndex = 1;

    const lines = processedHtml.split('\n').filter(line => line.trim() !== '');

    for (const line of lines) {
        const trimmedLine = line.trim();
        const startIndex = currentIndex;
        const textToInsert = trimmedLine + '\n';
        
        requests.push({ insertText: { location: { index: startIndex }, text: textToInsert } });
        const endIndex = startIndex + textToInsert.length;

        const textStyle: any = { fontSize: { magnitude: 11, unit: 'PT' } };
        let fields = 'fontSize';

        const isH1 = trimmedLine.match(/^기술검토 및 진단 종합 보고서$/);
        const isH2 = trimmedLine.match(/^(\d\.|AI 전문가 패널 소개|최종 기술 진단 종합 보고서)/);
        const isH3 = trimmedLine.match(/^(핵심 진단 요약|정밀 검증|최종 종합 의견|기술 검토 보완 요약|심층 검증 결과|추가 및 대안 권고|최종 정밀 검증 완료)/);
        const isLabel = trimmedLine.match(/^(전문분야:|배경:|주요 조언:|핵심 조언:)/);
        
        if (isH1) {
            textStyle.fontSize = { magnitude: 20, unit: 'PT' };
            textStyle.bold = true;
            fields += ',bold';
        } else if (isH2) {
            textStyle.fontSize = { magnitude: 16, unit: 'PT' };
            textStyle.bold = true;
            fields += ',bold';
        } else if (isH3) {
            textStyle.fontSize = { magnitude: 14, unit: 'PT' };
            textStyle.bold = true;
            fields += ',bold';
        } else if (isLabel) {
             textStyle.bold = true;
             fields += ',bold';
        }

        requests.push({
            updateTextStyle: {
                range: { startIndex, endIndex: endIndex - 1 },
                textStyle,
                fields: fields,
            },
        });
        
        if (trimmedLine.startsWith('•')) {
            requests.push({
                createParagraphBullets: {
                    range: { startIndex, endIndex: endIndex - 1 },
                    bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
                },
            });
        }
        
        currentIndex = endIndex;
        
        // *** [최종 개선] 제목 뒤에 자동으로 공백 한 줄 추가 ***
        if (isH1 || isH2 || isH3) {
            requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
            currentIndex += 1;
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