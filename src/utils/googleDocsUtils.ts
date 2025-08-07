// 완전히 새로운 Google OAuth 구현 - 직접 OAuth 플로우 사용
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
    if (typeof window !== 'undefined') {
      const storedClientId = localStorage.getItem('GOOGLE_CLIENT_ID');
      if (storedClientId) {
        GOOGLE_CLIENT_ID = storedClientId;
        return storedClientId;
      }
    }
    throw new Error('Google Client ID를 가져올 수 없습니다.');
  }
};

// Client ID 설정 및 가져오기 함수
export const setGoogleClientId = (clientId: string) => {
  GOOGLE_CLIENT_ID = clientId;
};

export const getGoogleClientId = (): string => {
  return GOOGLE_CLIENT_ID;
};

// 직접 OAuth 플로우를 사용한 Google 인증 (GAPI 없이)
export const authenticateGoogle = async (): Promise<string> => {
  try {
    console.log('🚀 직접 Google OAuth 인증 시작');
    
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

    // OAuth 2.0 파라미터 설정
    const scope = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file';
    const redirectUri = window.location.origin;
    const responseType = 'token';
    const state = Math.random().toString(36).substring(2, 15);
    
    // OAuth URL 생성
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', responseType);
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('include_granted_scopes', 'true');
    authUrl.searchParams.append('prompt', 'consent');

    console.log('🪟 OAuth 팝업 열기');
    
    // 팝업으로 인증 창 열기
    const popup = window.open(
      authUrl.toString(),
      'google-auth',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      throw new Error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
    }

    // 팝업에서 토큰 받기
    return new Promise<string>((resolve, reject) => {
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          reject(new Error('팝업이 닫혔습니다. 다시 시도해주세요.'));
        }
      }, 1000);

      // postMessage 이벤트 리스너
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          popup.close();
          console.log('✅ 인증 성공');
          resolve(event.data.accessToken);
        } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          popup.close();
          reject(new Error(event.data.error || 'Google 인증에 실패했습니다.'));
        }
      };

      window.addEventListener('message', messageListener);

      // URL 변경 감지 (fallback)
      const checkUrl = setInterval(() => {
        try {
          if (popup.location.href.includes(redirectUri)) {
            const url = new URL(popup.location.href);
            const fragment = url.hash.substring(1);
            const params = new URLSearchParams(fragment);
            
            const accessToken = params.get('access_token');
            const error = params.get('error');
            
            if (accessToken) {
              clearInterval(checkUrl);
              clearInterval(checkClosed);
              window.removeEventListener('message', messageListener);
              popup.close();
              console.log('✅ 토큰 획득 성공');
              resolve(accessToken);
            } else if (error) {
              clearInterval(checkUrl);
              clearInterval(checkClosed);
              window.removeEventListener('message', messageListener);
              popup.close();
              reject(new Error(`인증 오류: ${error}`));
            }
          }
        } catch (e) {
          // 크로스 오리진 에러는 무시 (정상)
        }
      }, 500);
    });
    
  } catch (error: any) {
    console.error('❌ 인증 실패:', error);
    throw new Error(`Google 인증에 실패했습니다: ${error.message}`);
  }
};

// 토큰 유효성 검증
export const validateGoogleToken = async (accessToken: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
    return response.ok;
  } catch (error) {
    console.error('토큰 검증 실패:', error);
    return false;
  }
};

// HTML을 플레인 텍스트로 변환
export const htmlToPlainText = (html: string): string => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || '';
};

// 파일명 생성 함수 import
import { generateReportFileName } from './reportGenerator';

// Google Docs 생성 (완전 새로운 방식)
export const createGoogleDoc = async (htmlContent: string, accessToken: string): Promise<string> => {
  try {
    console.log('🚀 Google Docs 생성 시작');
    
    // 토큰 유효성 검증
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

    // Google Docs 문서 생성
    console.log('📄 Google Docs 문서 생성...');
    const createResponse = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: generateReportFileName(),
        parents: ['1Ndsjt8XGOTkH0mSg2LLfclc3wjO9yiR7'] // 지정된 폴더 ID
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('문서 생성 오류:', createResponse.status, errorText);
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
      console.error('문서 업데이트 오류:', updateResponse.status, errorText);
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
        throw new Error('Google Docs API 권한이 없습니다.');
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
      }
      throw error;
    }
    
    throw new Error('Google Docs 생성에 실패했습니다.');
  }
};