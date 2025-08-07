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

// GAPI 초기화 (개선된 로드 방식)
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

      // GAPI 기본 로드 (단계별 로드)
      console.log('GAPI 기본 라이브러리 로드 중...');
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('GAPI 기본 로드 시간 초과 (30초)'));
        }, 30000); // 30초로 연장

        gapi.load('client:auth2', () => {
          clearTimeout(timeout);
          console.log('GAPI 기본 라이브러리 로드 완료');
          resolve();
        });
      });

      // 클라이언트 초기화
      console.log('GAPI 클라이언트 초기화 중...');
      await gapi.client.init({
        clientId: clientId,
        scope: SCOPES,
        discoveryDocs: [DISCOVERY_DOC]
      });

      // 추가 API 로드 (순차적)
      console.log('Google Docs API 로드 중...');
      await gapi.client.load('docs', 'v1');
      
      console.log('Google Drive API 로드 중...');
      await gapi.client.load('drive', 'v3');

      gapiInitialized = true;
      console.log('GAPI 초기화 완료');
    } catch (error) {
      gapiInitialized = false;
      initializationPromise = null;
      console.error('GAPI 초기화 실패:', error);
      
      // 더 구체적인 오류 메시지 제공
      if (error instanceof Error) {
        if (error.message.includes('시간 초과')) {
          throw new Error('Google API 로드가 지연되고 있습니다. 네트워크 연결을 확인하고 다시 시도해주세요.');
        } else if (error.message.includes('Client ID')) {
          throw new Error('Google Client ID 설정에 문제가 있습니다. 관리자에게 문의해주세요.');
        }
      }
      
      throw new Error(`Google API 초기화에 실패했습니다: ${error}`);
    }
  })();

  return initializationPromise;
};

// 인증 상태 관리
let authenticationInProgress = false;

// Google 인증 (OAuth 설정 문제 해결)
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
      throw new Error('Google Auth2 인스턴스를 가져올 수 없습니다. GAPI 초기화를 확인해주세요.');
    }
    
    // 기존 세션 정리
    if (authInstance.isSignedIn.get()) {
      console.log('🔄 기존 세션 정리 중...');
      await authInstance.signOut();
    }
    
    console.log('🪟 Google 계정 선택 팝업 시작');
    
    // 단일 인증 시도
    const authResult = await authInstance.signIn({
      prompt: 'select_account',
      scope: SCOPES
    });
    
    if (!authResult) {
      throw new Error('Google 인증이 취소되었습니다.');
    }
    
    const authResponse = authResult.getAuthResponse();
    if (!authResponse?.access_token) {
      throw new Error('유효한 액세스 토큰을 받지 못했습니다.');
    }
    
    console.log('✅ Google 인증 완료');
    return authResponse.access_token;
    
  } catch (error: any) {
    console.error('❌ Google 인증 실패:', error);
    
    // 구체적인 OAuth 설정 오류 처리
    if (error?.type === 'tokenFailed' && error?.error === 'server_error') {
      const currentDomain = window.location.origin;
      throw new Error(`🚨 Google Cloud Console OAuth 설정 오류

현재 도메인: ${currentDomain}

필수 해결사항:

1️⃣ Google Cloud Console (console.cloud.google.com) 접속
2️⃣ 프로젝트 선택 → API 및 서비스 → OAuth 동의 화면
3️⃣ 다음 중 하나 선택:

옵션 A) 프로덕션 환경으로 발행
   - "앱 발행" 버튼 클릭
   - 검토 제출 (승인까지 1-2주 소요)

옵션 B) 테스트 사용자 추가 (즉시 해결)
   - OAuth 동의 화면 → "테스트 사용자" 섹션
   - 현재 Google 계정 이메일 추가

4️⃣ 사용자 인증 정보 → OAuth 2.0 클라이언트 ID
   - "승인된 자바스크립트 원본"에 다음 추가:
     ${currentDomain}

5️⃣ 변경사항 저장 후 5분 대기

이 설정이 완료되면 오류가 해결됩니다.`);
    }
    
    if (error?.error === 'popup_closed_by_user') {
      throw new Error('팝업이 사용자에 의해 닫혔습니다. 팝업 차단기를 해제하고 다시 시도해주세요.');
    }
    
    if (error?.error === 'access_denied') {
      throw new Error('Google 계정 접근이 거부되었습니다. 권한을 허용하고 다시 시도해주세요.');
    }
    
    if (error?.error === 'unauthorized_client') {
      throw new Error('OAuth 클라이언트가 승인되지 않았습니다. Google Cloud Console에서 클라이언트 ID 설정을 확인해주세요.');
    }
    
    if (error instanceof Error) {
      throw error;
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

// Google Docs 생성 (타임아웃 및 진행상황 로그 개선)
export const createGoogleDoc = async (htmlContent: string, accessToken: string): Promise<string> => {
  try {
    console.log('🚀 Google Docs 생성 프로세스 시작');
    await initializeGapi();

    console.log('✅ GAPI 초기화 완료, 액세스 토큰 길이:', accessToken.length);

    // 토큰 유효성 재검증
    console.log('🔍 토큰 유효성 검증 중...');
    const isTokenValid = await validateGoogleToken(accessToken);
    if (!isTokenValid) {
      throw new Error('액세스 토큰이 유효하지 않습니다. 다시 로그인해주세요.');
    }
    console.log('✅ 토큰 유효성 검증 완료');

    // Google Docs API가 로드되었는지 확인 및 재로드
    if (!gapi.client.docs) {
      console.log('📚 Google Docs API 로드 중...');
      try {
        await gapi.client.load('docs', 'v1');
        console.log('✅ Google Docs API 로드 완료');
      } catch (loadError) {
        console.error('❌ Google Docs API 로드 실패:', loadError);
        throw new Error('Google Docs API를 로드할 수 없습니다. 네트워크 연결을 확인해주세요.');
      }
    }

    let documentId: string;
    
    try {
      console.log('📄 새 문서 생성 중...');
      // 타임아웃 설정 (30초)
      const createPromise = gapi.client.docs.documents.create({
        title: `기술검토 보고서 - ${new Date().toLocaleDateString('ko-KR')}`
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('문서 생성 타임아웃 (30초)')), 30000);
      });

      const createResponse = await Promise.race([createPromise, timeoutPromise]) as any;

      documentId = createResponse.result.documentId;
      if (!documentId) {
        throw new Error('문서 ID를 받지 못했습니다.');
      }
      
      console.log('✅ Google Docs 생성 완료:', documentId);
    } catch (createError) {
      console.error('❌ GAPI 문서 생성 중 오류:', createError);
      
      // Fallback: 직접 HTTP 요청으로 문서 생성
      console.log('🔄 Fallback 방식으로 문서 생성 시도...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      try {
        const createResponse = await fetch('https://docs.googleapis.com/v1/documents', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: `기술검토 보고서 - ${new Date().toLocaleDateString('ko-KR')}`
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          throw new Error(`문서 생성 실패: ${createResponse.status} ${errorText}`);
        }

        const createResult = await createResponse.json();
        documentId = createResult.documentId;
        
        if (!documentId) {
          throw new Error('Fallback 방식으로도 문서 ID를 받지 못했습니다.');
        }
        
        console.log('✅ Fallback으로 Google Docs 생성 완료:', documentId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    }

    // HTML 콘텐츠를 플레인 텍스트로 변환
    console.log('📝 콘텐츠 변환 중...');
    const plainText = htmlToPlainText(htmlContent);
    
    if (!plainText || plainText.trim().length === 0) {
      throw new Error('변환할 콘텐츠가 없습니다.');
    }
    console.log('✅ 콘텐츠 변환 완료, 길이:', plainText.length);

    try {
      console.log('📝 문서에 콘텐츠 추가 중...');
      // 타임아웃 설정 (30초)
      const updatePromise = gapi.client.docs.documents.batchUpdate({
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

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('문서 업데이트 타임아웃 (30초)')), 30000);
      });

      await Promise.race([updatePromise, timeoutPromise]);
      
      console.log('✅ GAPI로 문서 업데이트 완료');
    } catch (updateError) {
      console.error('❌ GAPI 업데이트 중 오류:', updateError);
      
      // Fallback: 직접 HTTP 요청으로 문서 업데이트
      console.log('🔄 Fallback 방식으로 문서 업데이트 시도...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      try {
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
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`문서 업데이트 실패: ${updateResponse.status} ${errorText}`);
        }
        
        console.log('✅ Fallback으로 문서 업데이트 완료');
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    }

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
    console.log('🎉 Google Docs 생성 및 업데이트 완료:', documentUrl);
    
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