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
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw`,
        'apikey': `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw`,
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
const SCOPES = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive';

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
      discoveryDocs: [DISCOVERY_DOC],
      immediate: false
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
    
    if (!authInstance) {
      throw new Error('Google Auth2 인스턴스를 가져올 수 없습니다.');
    }
    
    // 기존 로그인 상태 확인 및 로그아웃
    if (authInstance.isSignedIn.get()) {
      console.log('기존 세션 정리 중...');
      await authInstance.signOut();
    }
    
    console.log('새로운 Google 로그인 시작...');
    
    // 새로운 로그인 시도 (OAuth 2.0 옵션 추가)
    const authResult = await authInstance.signIn({
      prompt: 'select_account',
      scope: SCOPES,
      response_type: 'token',
      include_granted_scopes: true
    });
    
    if (!authResult) {
      throw new Error('Google 로그인이 취소되었습니다.');
    }
    
    // 인증 결과 검증
    const authResponse = authResult.getAuthResponse();
    if (!authResponse) {
      throw new Error('Google 인증 응답을 받지 못했습니다.');
    }
    
    if (!authResponse.access_token) {
      throw new Error('Google 액세스 토큰을 받지 못했습니다.');
    }
    
    // 토큰 유효성 검증
    const isValid = await validateGoogleToken(authResponse.access_token);
    if (!isValid) {
      throw new Error('받은 액세스 토큰이 유효하지 않습니다.');
    }
    
    console.log('Google 인증 성공 및 토큰 검증 완료');
    return authResponse.access_token;
    
  } catch (error) {
    console.error('Google 인증 실패:', error);
    
    // 에러 타입별 처리
    if (error && typeof error === 'object') {
      const errorObj = error as any;
      
      if (errorObj.error === 'popup_closed_by_user') {
        throw new Error('팝업이 사용자에 의해 닫혔습니다. 다시 시도해주세요.');
      }
      
      if (errorObj.error === 'access_denied') {
        throw new Error('Google 계정 접근이 거부되었습니다. 권한을 허용해주세요.');
      }
      
      if (errorObj.error === 'server_error') {
        throw new Error('Google 서버 오류가 발생했습니다. Google Cloud Console에서 OAuth 설정을 확인해주세요.');
      }
      
      if (errorObj.type === 'tokenFailed') {
        throw new Error('토큰 발급에 실패했습니다. OAuth 클라이언트 설정을 확인해주세요.');
      }
    }
    
    if (error instanceof Error) {
      if (error.message.includes('popup')) {
        throw new Error('팝업이 차단되었습니다. 브라우저의 팝업 차단을 해제하고 다시 시도해주세요.');
      } else if (error.message.includes('cancelled') || error.message.includes('취소')) {
        throw new Error('Google 로그인이 취소되었습니다.');
      } else if (error.message.includes('unauthorized_client')) {
        throw new Error('OAuth 클라이언트가 승인되지 않았습니다. Google Cloud Console 설정을 확인해주세요.');
      }
      throw error;
    }
    
    throw new Error('Google 인증에 실패했습니다. OAuth 설정을 확인하고 다시 시도해주세요.');
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

    console.log('Google Docs 생성 시작, 액세스 토큰 길이:', accessToken.length);

    // 토큰 유효성 재검증
    const isTokenValid = await validateGoogleToken(accessToken);
    if (!isTokenValid) {
      throw new Error('액세스 토큰이 유효하지 않습니다. 다시 로그인해주세요.');
    }

    // 새 문서 생성 (gapi.client.docs 사용)
    const createResponse = await gapi.client.docs.documents.create({
      title: `기술검토 보고서 - ${new Date().toLocaleDateString('ko-KR')}`
    });

    const documentId = createResponse.result.documentId;
    if (!documentId) {
      throw new Error('문서 ID를 받지 못했습니다.');
    }
    
    console.log('Google Docs 생성 완료:', documentId);

    // HTML 콘텐츠를 플레인 텍스트로 변환
    const plainText = htmlToPlainText(htmlContent);

    // 문서에 콘텐츠 추가 (gapi.client.docs 사용)
    await gapi.client.docs.documents.batchUpdate({
      documentId: documentId,
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
    });

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
    console.log('Google Docs 업데이트 완료');
    
    return documentUrl;
  } catch (error) {
    console.error('Google Docs 생성 실패:', error);
    throw new Error('Google Docs 생성에 실패했습니다.');
  }
};