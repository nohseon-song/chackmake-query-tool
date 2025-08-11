// src/utils/googleDocsUtils.ts

import { supabase } from '@/integrations/supabase/client';

export interface GoogleAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
}

let GOOGLE_CLIENT_ID = '';

// =================================================================
// 인증 관련 함수 (수정 없음)
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
// [최종] 순수 텍스트 패턴 분석 기반의 완벽한 변환 엔진
// =================================================================
const convertHtmlToGoogleDocsRequests = (htmlContent: string): any[] => {
    const requests: any[] = [];
    let currentIndex = 1;

    // HTML 태그를 모두 제거하고 순수 텍스트로 변환
    const textContent = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // 텍스트를 줄바꿈 기준으로 나눔 (여러 공백이나 특정 구분자로 나눌 수도 있음)
    // 여기서는 보고서의 구조적 단위를 나타내는 키워드로 분할
    const sections = textContent.split(/(기술검토 및 진단 종합 보고서|AI 전문가 패널 소개|\d\.\s기술.*Expert|핵심 진단 요약|정밀 검증|최종 종합 의견|기술 검토 보완 요약|추가 및 대안 권고)/)
        .filter(Boolean);


    for (let i = 0; i < sections.length; i++) {
        const part = sections[i].trim();
        if (!part) continue;

        const lineStartIndex = currentIndex;
        
        // 텍스트 삽입
        requests.push({ insertText: { location: { index: currentIndex }, text: part + '\n' } });
        currentIndex += part.length + 1;

        const lineEndIndex = currentIndex;

        // 패턴에 따라 스타일 적용
        let textStyle: any = { fontSize: { magnitude: 10, unit: 'PT' } };
        let fields = 'fontSize';

        if (/^기술검토 및 진단 종합 보고서/.test(part)) {
            textStyle = { fontSize: { magnitude: 20, unit: 'PT' }, bold: true };
            fields = 'fontSize,bold';
        } else if (/^기계설비 성능점검/.test(part)) {
            textStyle = { fontSize: { magnitude: 16, unit: 'PT' }, bold: false };
            fields = 'fontSize,bold';
        } else if (/^\d+\.\s.*(Expert|전문가)/.test(part) || /^AI 전문가 패널 소개/.test(part) || /^4\.\s최종 기술 진단 종합 보고서/.test(part)) {
            textStyle = { fontSize: { magnitude: 16, unit: 'PT' }, bold: true };
            fields = 'fontSize,bold';
        } else if (/^핵심 진단 요약|^주요 조언|^정밀 검증|^최종 종합 의견|^기술 검토 보완 요약|^추가 및 대안 권고/.test(part)) {
            textStyle = { fontSize: { magnitude: 14, unit: 'PT' }, bold: true };
            fields = 'fontSize,bold';
        }

        requests.push({
            updateTextStyle: {
                range: { startIndex: lineStartIndex, endIndex: lineEndIndex },
                textStyle,
                fields,
            },
        });

        // 글머리 기호 적용
        const bulletLines = part.split('•').filter(l => l.trim());
        if (bulletLines.length > 1) {
            let bulletStartIndex = lineStartIndex;
            for (const bulletLine of bulletLines) {
                const trimmedBullet = "• " + bulletLine.trim();
                const bulletEndIndex = bulletStartIndex + trimmedBullet.length;
                 if(bulletStartIndex > lineStartIndex){ // 첫번째는 이미 텍스트가 있으므로 제외
                    requests.push({ insertText: { location: { index: bulletStartIndex }, text: trimmedBullet + '\n' } });
                    currentIndex += trimmedBullet.length + 1;
                 }
                
                requests.push({
                    createParagraphBullets: {
                        range: { startIndex: bulletStartIndex, endIndex: bulletEndIndex },
                        bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
                    },
                });
                bulletStartIndex = bulletEndIndex + 1;
            }
        }
        
        // 특정 키워드만 굵게 처리
        const boldKeywordMatch = part.match(/^(핵심 조언:|전문분야:|배경:)/);
        if (boldKeywordMatch) {
            const keyword = boldKeywordMatch[0];
            requests.push({
                updateTextStyle: {
                    range: { startIndex: lineStartIndex, endIndex: lineStartIndex + keyword.length },
                    textStyle: { bold: true },
                    fields: 'bold',
                },
            });
        }
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
