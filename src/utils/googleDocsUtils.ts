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

// GAPI 초기화 (중복 초기화 방지)
export const initializeGapi = async (): Promise<void> => {
  if (gapiInitialized) return;
  
  // 이미 초기화 중인 경우 해당 Promise를 반환
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      // Supabase에서 Google Client ID 가져오기
      let clientId = getGoogleClientId();
      
      if (!clientId || clientId === '') {
        console.log('Client ID가 없어서 Supabase에서 가져오는 중...');
        clientId = await fetchGoogleClientId();
      }
      
      console.log('사용중인 Google Client ID:', clientId);
      
      if (!clientId || clientId === '') {
        throw new Error('Google Client ID가 설정되지 않았습니다.');
      }

      // GAPI 로드 및 초기화
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('GAPI 로드 시간 초과'));
        }, 10000);

        gapi.load('auth2:client:docs:drive', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      // 클라이언트 초기화
      await gapi.client.init({
        clientId: clientId,
        scope: SCOPES,
        discoveryDocs: [DISCOVERY_DOC],
        immediate: false
      });

      gapiInitialized = true;
      console.log('GAPI 초기화 완료');
    } catch (error) {
      gapiInitialized = false;
      initializationPromise = null;
      console.error('GAPI 초기화 실패:', error);
      throw new Error(`Google API 초기화에 실패했습니다: ${error}`);
    }
  })();

  return initializationPromise;
};

// Google 인증 (재시도 로직 포함)
export const authenticateGoogle = async (retryCount = 0): Promise<string> => {
  const MAX_RETRIES = 2;
  
  try {
    await initializeGapi();

    const authInstance = gapi.auth2.getAuthInstance();
    
    if (!authInstance) {
      throw new Error('Google Auth2 인스턴스를 가져올 수 없습니다.');
    }
    
    // 현재 로그인 상태 확인
    const isSignedIn = authInstance.isSignedIn.get();
    console.log('현재 Google 로그인 상태:', isSignedIn);
    
    let accessToken: string | null = null;
    
    if (isSignedIn) {
      const currentUser = authInstance.currentUser.get();
      const authResponse = currentUser.getAuthResponse();
      
      if (authResponse && authResponse.access_token) {
        // 기존 토큰 유효성 확인
        const isTokenValid = await validateGoogleToken(authResponse.access_token);
        if (isTokenValid) {
          console.log('기존 유효한 토큰 사용');
          return authResponse.access_token;
        } else {
          console.log('기존 토큰이 만료됨, 재인증 필요');
          await authInstance.signOut();
        }
      }
    }
    
    console.log('새로운 Google 로그인 시작...');
    
    // 새로운 로그인 시도
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
      if (retryCount < MAX_RETRIES) {
        console.log(`토큰 검증 실패, 재시도 중... (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
        return authenticateGoogle(retryCount + 1);
      }
      throw new Error('토큰 검증에 실패했습니다. Google Cloud Console 설정을 확인해주세요.');
    }
    
    console.log('Google 인증 성공 및 토큰 검증 완료');
    return authResponse.access_token;
    
  } catch (error) {
    console.error('Google 인증 실패:', error);
    
    // 재시도 가능한 오류인 경우
    if (retryCount < MAX_RETRIES) {
      const retryableErrors = ['server_error', 'network_error', 'timeout'];
      const errorObj = error as any;
      
      if (retryableErrors.some(err => errorObj?.error?.includes(err) || errorObj?.message?.includes(err))) {
        console.log(`재시도 가능한 오류 발생, 재시도 중... (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
        return authenticateGoogle(retryCount + 1);
      }
    }
    
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
        throw new Error('Google 서버 일시적 오류입니다. 잠시 후 다시 시도해주세요.');
      }
      
      if (errorObj.type === 'tokenFailed') {
        throw new Error('Google OAuth 설정에 문제가 있습니다. Google Cloud Console에서 OAuth 클라이언트 설정을 확인해주세요.');
      }
      
      if (errorObj.error === 'unauthorized_client') {
        throw new Error('OAuth 클라이언트가 승인되지 않았습니다. Google Cloud Console에서 OAuth 동의 화면을 "프로덕션 환경"으로 설정하거나 테스트 사용자에 추가해주세요.');
      }
    }
    
    if (error instanceof Error) {
      if (error.message.includes('popup')) {
        throw new Error('팝업이 차단되었습니다. 브라우저의 팝업 차단을 해제하고 다시 시도해주세요.');
      } else if (error.message.includes('cancelled') || error.message.includes('취소')) {
        throw new Error('Google 로그인이 취소되었습니다.');
      } else if (error.message.includes('Client ID')) {
        throw new Error('Google Client ID 설정에 문제가 있습니다. Supabase Edge Function 설정을 확인해주세요.');
      }
      throw error;
    }
    
    throw new Error('Google 인증에 실패했습니다. 네트워크 연결을 확인하고 다시 시도해주세요.');
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

// Google Docs 생성 (완전한 오류 처리 포함)
export const createGoogleDoc = async (htmlContent: string, accessToken: string): Promise<string> => {
  try {
    await initializeGapi();

    console.log('Google Docs 생성 시작, 액세스 토큰 길이:', accessToken.length);

    // 토큰 유효성 재검증
    const isTokenValid = await validateGoogleToken(accessToken);
    if (!isTokenValid) {
      throw new Error('액세스 토큰이 유효하지 않습니다. 다시 로그인해주세요.');
    }

    // Google Docs API가 로드되었는지 확인
    if (!gapi.client.docs) {
      console.log('Google Docs API 재로드 중...');
      await gapi.client.load('docs', 'v1');
    }

    let documentId: string;
    
    try {
      // 새 문서 생성
      const createResponse = await gapi.client.docs.documents.create({
        title: `기술검토 보고서 - ${new Date().toLocaleDateString('ko-KR')}`
      });

      documentId = createResponse.result.documentId;
      if (!documentId) {
        throw new Error('문서 ID를 받지 못했습니다.');
      }
      
      console.log('Google Docs 생성 완료:', documentId);
    } catch (createError) {
      console.error('문서 생성 중 오류:', createError);
      
      // Fallback: 직접 HTTP 요청으로 문서 생성
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
        throw new Error(`문서 생성 실패: ${createResponse.status} ${errorText}`);
      }

      const createResult = await createResponse.json();
      documentId = createResult.documentId;
      
      if (!documentId) {
        throw new Error('Fallback 방식으로도 문서 ID를 받지 못했습니다.');
      }
      
      console.log('Fallback으로 Google Docs 생성 완료:', documentId);
    }

    // HTML 콘텐츠를 플레인 텍스트로 변환
    const plainText = htmlToPlainText(htmlContent);
    
    if (!plainText || plainText.trim().length === 0) {
      throw new Error('변환할 콘텐츠가 없습니다.');
    }

    try {
      // 문서에 콘텐츠 추가
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
      
      console.log('GAPI로 문서 업데이트 완료');
    } catch (updateError) {
      console.error('GAPI 업데이트 중 오류:', updateError);
      
      // Fallback: 직접 HTTP 요청으로 문서 업데이트
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
                location: {
                  index: 1
                },
                text: plainText
              }
            }
          ]
        })
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`문서 업데이트 실패: ${updateResponse.status} ${errorText}`);
      }
      
      console.log('Fallback으로 문서 업데이트 완료');
    }

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
    console.log('Google Docs 생성 및 업데이트 완료:', documentUrl);
    
    return documentUrl;
  } catch (error) {
    console.error('Google Docs 생성 실패:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        throw new Error('Google Docs API 접근 권한이 없습니다. Google Cloud Console에서 Google Docs API가 활성화되어 있는지 확인해주세요.');
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
      } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
        throw new Error('API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
      } else if (error.message.includes('네트워크') || error.message.includes('network')) {
        throw new Error('네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.');
      }
      throw error;
    }
    
    throw new Error('Google Docs 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }
};