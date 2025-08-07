import { gapi } from 'gapi-script';

export interface GoogleAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
}

// Google Client ID - 동적으로 설정 가능
let GOOGLE_CLIENT_ID = '';

// Supabase에서 Google Client ID 가져오기
export const fetchGoogleClientId = async (): Promise<string> => {
  try {
    const response = await fetch('https://rigbiqjmszdlacjdkhep.supabase.co/functions/v1/get-google-config', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw'}`,
        'apikey': `${import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw'}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Google Client ID from Supabase');
    }

    const data = await response.json();
    if (data.success && data.clientId) {
      GOOGLE_CLIENT_ID = data.clientId;
      return data.clientId;
    } else {
      throw new Error('Google Client ID not found in response');
    }
  } catch (error) {
    console.error('Error fetching Google Client ID:', error);
    // localStorage에서 fallback 확인
    if (typeof window !== 'undefined') {
      const storedClientId = localStorage.getItem('GOOGLE_CLIENT_ID');
      if (storedClientId) {
        GOOGLE_CLIENT_ID = storedClientId;
        return storedClientId;
      }
    }
    throw new Error('Google Client ID를 가져올 수 없습니다. Supabase Vault에 GOOGLE_CLIENT_ID가 설정되어 있는지 확인해주세요.');
  }
};

// Client ID 설정 함수
export const setGoogleClientId = (clientId: string) => {
  GOOGLE_CLIENT_ID = clientId;
};

// Client ID 가져오기 함수
export const getGoogleClientId = (): string => {
  return GOOGLE_CLIENT_ID;
};
const DISCOVERY_DOC = 'https://docs.googleapis.com/$discovery/rest?version=v1';
const SCOPES = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file';

let gapiInitialized = false;

// GAPI 초기화
export const initializeGapi = async (): Promise<void> => {
  if (gapiInitialized) return;

  try {
    // Supabase에서 Google Client ID 가져오기
    let clientId = getGoogleClientId();
    
    if (!clientId || clientId === '') {
      clientId = await fetchGoogleClientId();
    }
    
    console.log('사용중인 Google Client ID:', clientId);
    
    if (!clientId || clientId === '') {
      throw new Error('Google Client ID가 설정되지 않았습니다.');
    }

    await new Promise<void>((resolve) => {
      gapi.load('auth2:client', resolve);
    });

    await gapi.client.init({
      clientId: clientId,
      scope: SCOPES,
      discoveryDocs: [DISCOVERY_DOC]
    });

    gapiInitialized = true;
    console.log('GAPI 초기화 완료');
  } catch (error) {
    console.error('GAPI 초기화 실패:', error);
    throw new Error(`Google API 초기화에 실패했습니다: ${error}`);
  }
};

// Google 인증
export const authenticateGoogle = async (): Promise<string> => {
  try {
    await initializeGapi();

    const authInstance = gapi.auth2.getAuthInstance();
    
    if (!authInstance.isSignedIn.get()) {
      const authResult = await authInstance.signIn();
      const accessToken = authResult.getAuthResponse().access_token;
      console.log('Google 인증 성공');
      return accessToken;
    } else {
      const accessToken = authInstance.currentUser.get().getAuthResponse().access_token;
      return accessToken;
    }
  } catch (error) {
    console.error('Google 인증 실패:', error);
    throw new Error('Google 인증에 실패했습니다. 팝업 차단을 해제하거나 다시 시도해주세요.');
  }
};

// 토큰 유효성 검증
export const validateGoogleToken = async (accessToken: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
    return response.ok;
  } catch {
    return false;
  }
};

// HTML을 플레인 텍스트로 변환
export const htmlToPlainText = (html: string): string => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || '';
};

// Google Docs 생성
export const createGoogleDoc = async (htmlContent: string, accessToken: string): Promise<string> => {
  try {
    await initializeGapi();

    // 새 문서 생성
    const createResponse = await gapi.client.request({
      path: 'https://docs.googleapis.com/v1/documents',
      method: 'POST',
      body: {
        title: `기술검토 보고서 - ${new Date().toLocaleDateString('ko-KR')}`
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const documentId = createResponse.result.documentId;
    console.log('Google Docs 생성 완료:', documentId);

    // HTML 콘텐츠를 플레인 텍스트로 변환
    const plainText = htmlToPlainText(htmlContent);

    // 문서에 콘텐츠 추가
    await gapi.client.request({
      path: `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
      method: 'POST',
      body: {
        requests: [
          {
            insertText: {
              location: {
                index: 1
              },
              text: plainText
            }
          }
        ]
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
    console.log('Google Docs 업데이트 완료');
    
    return documentUrl;
  } catch (error) {
    console.error('Google Docs 생성 실패:', error);
    throw new Error('Google Docs 생성에 실패했습니다.');
  }
};