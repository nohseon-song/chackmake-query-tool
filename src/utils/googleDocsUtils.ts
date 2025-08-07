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
let initializationPromise: Promise<void> | null = null;

// GAPI 초기화 (근본적 문제 해결 - 단순화)
export const initializeGapi = async (): Promise<void> => {
  if (gapiInitialized) return;
  
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      console.log('🚀 GAPI 초기화 시작');
      
      // Client ID 확인
      let clientId = getGoogleClientId();
      if (!clientId) {
        console.log('📡 Supabase에서 Client ID 가져오는 중...');
        clientId = await fetchGoogleClientId();
      }
      
      if (!clientId) {
        throw new Error('Google Client ID를 가져올 수 없습니다.');
      }
      
      console.log('🔑 Client ID 확인 완료');

      // GAPI 로드 (auth2만 로드)
      console.log('📚 GAPI Auth2 라이브러리 로드 중...');
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('GAPI 로드 타임아웃'));
        }, 10000);

        gapi.load('auth2', {
          callback: () => {
            clearTimeout(timeout);
            console.log('✅ GAPI Auth2 로드 완료');
            resolve();
          },
          onerror: () => {
            clearTimeout(timeout);
            reject(new Error('GAPI Auth2 로드 실패'));
          }
        });
      });

      // Auth2만 초기화 (단순화)
      console.log('🔧 GAPI Auth2 초기화 중...');
      await gapi.auth2.init({
        client_id: clientId,
        scope: SCOPES
      });

      gapiInitialized = true;
      console.log('✅ GAPI 초기화 완료');
      
    } catch (error) {
      gapiInitialized = false;
      initializationPromise = null;
      console.error('❌ GAPI 초기화 실패:', error);
      throw new Error(`Google API 초기화 실패: ${error}`);
    }
  })();

  return initializationPromise;
};

// 인증 상태 관리
let authenticationInProgress = false;

// Google 인증 (근본적 문제 해결 버전)
export const authenticateGoogle = async (): Promise<string> => {
  if (authenticationInProgress) {
    throw new Error('이미 인증이 진행 중입니다. 잠시 후 다시 시도해주세요.');
  }

  try {
    authenticationInProgress = true;
    console.log('🚀 Google OAuth 인증 시작');
    
    await initializeGapi();

    const authInstance = gapi.auth2.getAuthInstance();
    
    if (!authInstance) {
      throw new Error('Auth2 인스턴스 생성 실패');
    }
    
    console.log('🔍 현재 인증 상태:', authInstance.isSignedIn.get());
    
    // 완전한 세션 정리
    if (authInstance.isSignedIn.get()) {
      console.log('🔄 기존 세션 완전 정리...');
      await authInstance.signOut();
      // 추가 정리 시간
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('🪟 새로운 인증 시도 - 단순화된 방식');
    
    // 가장 단순한 인증 방식
    const authResult = await authInstance.signIn();
    
    if (!authResult) {
      throw new Error('인증이 취소되었습니다.');
    }
    
    const authResponse = authResult.getAuthResponse();
    if (!authResponse?.access_token) {
      throw new Error('액세스 토큰을 받지 못했습니다.');
    }
    
    console.log('✅ 인증 성공, 토큰 길이:', authResponse.access_token.length);
    
    // 즉시 토큰 검증
    const tokenValid = await validateGoogleToken(authResponse.access_token);
    if (!tokenValid) {
      throw new Error('받은 토큰이 유효하지 않습니다.');
    }
    
    return authResponse.access_token;
    
  } catch (error: any) {
    console.error('❌ 인증 실패 상세:', error);
    
    // 실제 오류 원인 분석
    if (error?.details) {
      console.error('오류 세부사항:', error.details);
    }
    
    // 기본적인 오류만 처리
    if (error?.error === 'popup_closed_by_user') {
      throw new Error('팝업이 닫혔습니다. 다시 시도해주세요.');
    }
    
    if (error?.error === 'access_denied') {
      throw new Error('권한이 거부되었습니다. 다시 시도해주세요.');
    }
    
    // 일반 오류
    if (error instanceof Error) {
      throw new Error(`인증 오류: ${error.message}`);
    }
    
    throw new Error('Google 인증에 실패했습니다.');
  } finally {
    authenticationInProgress = false;
  }
};

// 토큰 유효성 검증 (향상된 버전)
export const validateGoogleToken = async (accessToken: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log('토큰 검증 실패:', response.status, response.statusText);
      return false;
    }
    
    const tokenInfo = await response.json();
    console.log('토큰 정보:', tokenInfo);
    
    // 토큰이 Google Docs와 Drive 스코프를 포함하는지 확인
    const hasRequiredScopes = tokenInfo.scope && (
      tokenInfo.scope.includes('https://www.googleapis.com/auth/documents') ||
      tokenInfo.scope.includes('https://www.googleapis.com/auth/drive')
    );
    
    if (!hasRequiredScopes) {
      console.warn('토큰에 필요한 스코프가 없습니다:', tokenInfo.scope);
    }
    
    return true;
  } catch (error) {
    console.error('토큰 검증 중 오류:', error);
    return false;
  }
};

// HTML을 플레인 텍스트로 변환
export const htmlToPlainText = (html: string): string => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || '';
};

// Google Docs 생성 (완전 단순화 버전)
export const createGoogleDoc = async (htmlContent: string, accessToken: string): Promise<string> => {
  try {
    console.log('🚀 Google Docs 생성 시작');
    
    console.log('🔍 토큰 유효성 검증...');
    const isTokenValid = await validateGoogleToken(accessToken);
    if (!isTokenValid) {
      throw new Error('토큰이 유효하지 않습니다.');
    }

    // HTML을 플레인 텍스트로 변환
    console.log('📝 HTML 변환 중...');
    const plainText = htmlToPlainText(htmlContent);
    
    if (!plainText.trim()) {
      throw new Error('변환할 콘텐츠가 없습니다.');
    }

    // 직접 HTTP 요청으로 문서 생성 (GAPI 대신)
    console.log('📄 Google Docs 문서 생성...');
    
    const createResponse = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `기술검토 보고서 - ${new Date().toLocaleDateString('ko-KR')}`
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('문서 생성 응답 오류:', createResponse.status, errorText);
      throw new Error(`문서 생성 실패: ${createResponse.status}`);
    }

    const createResult = await createResponse.json();
    const documentId = createResult.documentId;
    
    if (!documentId) {
      throw new Error('문서 ID를 받지 못했습니다.');
    }
    
    console.log('✅ 문서 생성 완료:', documentId);

    // 문서에 콘텐츠 추가
    console.log('📝 콘텐츠 추가 중...');
    
    const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: plainText
            }
          }
        ]
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('문서 업데이트 응답 오류:', updateResponse.status, errorText);
      throw new Error(`문서 업데이트 실패: ${updateResponse.status}`);
    }
    
    console.log('✅ 콘텐츠 추가 완료');

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
    console.log('🎉 Google Docs 생성 완료:', documentUrl);
    
    return documentUrl;
    
  } catch (error) {
    console.error('❌ Google Docs 생성 실패:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        throw new Error('Google Docs API 권한이 없습니다. Google Cloud Console에서 API를 활성화해주세요.');
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
      }
      throw error;
    }
    
    throw new Error('Google Docs 생성에 실패했습니다.');
  }
};