import { getCombinedHtml } from './htmlUtils';

// Google API 설정
const GOOGLE_DOCS_API_URL = 'https://docs.googleapis.com/v1/documents';
const GOOGLE_DOCS_SCOPE = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file';

export interface GoogleAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
}

// HTML을 플레인 텍스트로 변환하는 함수
const htmlToPlainText = (html: string): string => {
  // 임시 DOM 요소를 사용하여 HTML 태그 제거
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // 줄바꿈 처리
  const text = temp.textContent || temp.innerText || '';
  return text.replace(/\s+/g, ' ').trim();
};

// Google 인증 함수
export const authenticateGoogle = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Google OAuth 2.0 인증을 위한 팝업 창 열기
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    
    if (!clientId) {
      reject(new Error('Google Client ID가 설정되지 않았습니다.'));
      return;
    }

    const redirectUri = encodeURIComponent(window.location.origin);
    const scope = encodeURIComponent(GOOGLE_DOCS_SCOPE);
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${redirectUri}&` +
      `response_type=token&` +
      `scope=${scope}&` +
      `include_granted_scopes=true&` +
      `state=state_parameter_passthrough_value`;

    const popup = window.open(authUrl, 'google-auth', 'width=500,height=600');
    
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        reject(new Error('사용자가 인증을 취소했습니다.'));
      }
    }, 1000);

    // 메시지 리스너로 토큰 받기
    const messageListener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageListener);
        popup?.close();
        resolve(event.data.accessToken);
      } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageListener);
        popup?.close();
        reject(new Error(event.data.error));
      }
    };

    window.addEventListener('message', messageListener);
  });
};

// Google Docs 문서 생성 함수
export const createGoogleDoc = async (htmlContent: string, accessToken: string): Promise<string> => {
  try {
    const plainText = htmlToPlainText(htmlContent);
    const currentDate = new Date().toLocaleDateString('ko-KR');
    const title = `기술검토진단결과_${currentDate}`;

    // 1. 빈 문서 생성
    const createResponse = await fetch(GOOGLE_DOCS_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title
      })
    });

    if (!createResponse.ok) {
      throw new Error(`문서 생성 실패: ${createResponse.statusText}`);
    }

    const docData = await createResponse.json();
    const documentId = docData.documentId;

    // 2. 문서에 내용 추가
    const batchUpdateResponse = await fetch(`${GOOGLE_DOCS_API_URL}/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
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

    if (!batchUpdateResponse.ok) {
      throw new Error(`문서 내용 추가 실패: ${batchUpdateResponse.statusText}`);
    }

    // 3. 문서 URL 반환
    return `https://docs.google.com/document/d/${documentId}/edit`;

  } catch (error) {
    console.error('Google Docs 생성 오류:', error);
    throw error;
  }
};

// 간단한 토큰 검증 함수
export const validateGoogleToken = async (accessToken: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
    return response.ok;
  } catch {
    return false;
  }
};