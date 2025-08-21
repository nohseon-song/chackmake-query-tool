import { supabase } from '@/integrations/supabase/client';

export interface GoogleAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
}

// URL에서 Google 인증 코드 확인 및 처리
export const handleGoogleCallback = (): string | null => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  
  if (code && state === 'google_docs_auth') {
    // URL에서 파라미터 제거
    window.history.replaceState({}, document.title, window.location.pathname);
    return code;
  }
  
  return null;
};

// 1. 구글 로그인 페이지로 이동시켜 인증을 시작하는 함수 (리디렉션 방식)
export const authenticateGoogle = async (): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('get-google-config');
  if (error) throw new Error(`Supabase 함수 호출 실패: ${error.message}`);
  
  const { clientId, redirectUri } = data;
  if (!clientId || !redirectUri) throw new Error('Google Client ID 또는 Redirect URI를 찾을 수 없습니다.');
  
  const scope = "https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file";
  const state = 'google_docs_auth';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${state}`;

  // 현재 페이지 상태 저장 (복구를 위해)
  sessionStorage.setItem('google_auth_pending', 'true');
  sessionStorage.setItem('google_auth_timestamp', Date.now().toString());
  
  // iframe 환경 감지 및 상위 창으로 리디렉션 (Google X-Frame-Options 우회)
  try {
    if (window.self !== window.top) {
      // iframe 내부에서 실행 중인 경우, 상위 창(top)으로 리디렉션
      window.top!.location.href = authUrl;
    } else {
      // 일반 창에서 실행 중인 경우
      window.location.href = authUrl;
    }
  } catch (e) {
    // iframe 접근 권한이 없는 경우의 대체 방법
    window.open(authUrl, '_top');
  }
  
  // Promise는 페이지 리로드 후 콜백에서 처리됨
  throw new Error('Redirecting to Google...');
};

// 2. 구글이 보내준 '인증 코드'를 진짜 '액세스 토큰'으로 교환하는 함수
export const exchangeCodeForToken = async (code: string): Promise<{ accessToken: string; refreshToken?: string }> => {
  const { data, error } = await supabase.functions.invoke('exchange-code-for-tokens', { 
    body: { code } 
  });

  if (error) throw new Error(`토큰 교환 실패: ${error.message || error}`);
  
  const access_token = data?.access_token as string | undefined;
  if (!access_token) throw new Error('올바른 토큰 응답을 받지 못했습니다.');
  
  return { accessToken: access_token, refreshToken: data?.refresh_token };
};

// =================================================================
// [The Perfection] 최종 완성판 변환 엔진 ( ✨ 너의 소중한 코드 그대로 유지! ✨ )
// =================================================================
const convertHtmlToGoogleDocsRequests = (htmlContent: string): any[] => {
    let processedHtml = htmlContent;

    const jsonRegex = /{\s*"precision_verification_html":\s*"([\s\S]*?)",\s*"(?:final|tınal)_summary_text":\s*"([\s\S]*?)"\s*}/;
    const jsonMatch = processedHtml.match(jsonRegex);
    if (jsonMatch) {
        const verificationHtml = jsonMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        processedHtml = processedHtml.replace(jsonRegex, verificationHtml);
    }
    
    processedHtml = processedHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li>/gi, '\n• ')
        .replace(/<p>/gi, '\n')
        .replace(/<h[1-6]>/gi, '\n\n')
        .replace(/<\/(h[1-6]|p|li|div|section|article|footer)>/gi, '\n')
        .replace(/<strong>(.*?)<\/strong>/gi, '$1')
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/(\n\s*){2,}/g, '\n\n');

    const lines = processedHtml.split('\n');
    const uniqueLines: string[] = [];
    let lastNonBlankLine = '';
    for (const line of lines) {
        const currentTrimmed = line.trim();
        if (currentTrimmed && currentTrimmed === lastNonBlankLine) {
            continue;
        }
        uniqueLines.push(line);
        if (currentTrimmed) {
            lastNonBlankLine = currentTrimmed;
        }
    }
    processedHtml = uniqueLines.join('\n').trim();

    const requests: any[] = [];
    let currentIndex = 1;
    let isFirstLine = true;

    processedHtml.split('\n').forEach(line => {
        let trimmedLine = line.trim();
        if (!trimmedLine) {
            requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
            currentIndex++;
            return;
        }

        const isNumberedHeading = trimmedLine.match(/^\d+\.\s/);
        if (isNumberedHeading && !isFirstLine) {
            requests.push({ insertText: { location: { index: currentIndex }, text: '\n' } });
            currentIndex++;
        }

        const isBullet = trimmedLine.startsWith('•');
        if (isBullet) {
            trimmedLine = trimmedLine.substring(1).trim();
        }

        const startIndex = currentIndex;
        const textToInsert = trimmedLine + '\n';
        requests.push({ insertText: { location: { index: startIndex }, text: textToInsert } });
        const endIndex = startIndex + textToInsert.length;

        const textStyle: any = { fontSize: { magnitude: 11, unit: 'PT' }, bold: false };
        let fields = 'fontSize,bold';
        
        if (trimmedLine.match(/^기술검토 및 진단 종합 보고서$/)) {
            textStyle.fontSize = { magnitude: 20, unit: 'PT' }; textStyle.bold = true;
        } else if (trimmedLine.match(/^(\d\.\s|AI 전문가 패널 소개|4\.\s)/)) {
            textStyle.fontSize = { magnitude: 16, unit: 'PT' }; textStyle.bold = true;
        } else if (trimmedLine.match(/^(핵심 진단 요약|정밀 검증|최종 종합 의견|기술 검토 보완 요약|심층 검증 결과|추가 및 대안 권고|최종 정밀 검증 완료|단위 변환 공식|압력값 변환|유량 변환|양정\(H\) 계산|출력 전력\(Pout\) 계산|효율\(η\) 계산|경제성 분석|검증 결과|보완 보고서 내용 검토)/)) {
            textStyle.fontSize = { magnitude: 14, unit: 'PT' }; textStyle.bold = true;
        } else if (trimmedLine.match(/^(전문분야:|배경:|주요 조언:|핵심 조언:)/)) {
             textStyle.bold = true;
        }

        requests.push({
            updateTextStyle: { range: { startIndex, endIndex: endIndex - 1 }, textStyle, fields },
        });

        if (isBullet) {
            requests.push({ createParagraphBullets: { range: { startIndex, endIndex: endIndex - 1 }, bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' } });
        }
        currentIndex = endIndex;
        isFirstLine = false;
    });

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

// Google Docs 생성 전체 플로우 (인증부터 문서 생성까지)
export const createGoogleDocWithAuth = async (
  htmlContent: string,
  equipmentName?: string
): Promise<string> => {
  try {
    // 1. 콜백에서 코드 확인
    let authCode = handleGoogleCallback();
    
    if (!authCode) {
      // 2. 인증이 필요한 경우 Google로 리디렉션
      await authenticateGoogle();
      return ''; // 리디렉션되므로 여기는 실행되지 않음
    }
    
    // 3. 코드를 토큰으로 교환
    const { accessToken } = await exchangeCodeForToken(authCode);
    
    // 4. Google Docs 생성
    const docUrl = await createGoogleDoc(htmlContent, accessToken, equipmentName);
    
    // 5. 인증 상태 정리
    sessionStorage.removeItem('google_auth_pending');
    sessionStorage.removeItem('google_auth_timestamp');
    
    return docUrl;
  } catch (error) {
    sessionStorage.removeItem('google_auth_pending');
    sessionStorage.removeItem('google_auth_timestamp');
    throw error;
  }
};

export const createGoogleDoc = async (
  htmlContent: string,
  accessToken: string,
  equipmentName?: string
): Promise<string> => {
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
