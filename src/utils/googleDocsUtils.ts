import { gapi } from 'gapi-script';

export interface GoogleAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
}

// Google Client ID - 공개적으로 노출되어도 안전한 값입니다
const GOOGLE_CLIENT_ID = '1031344058476-aep6m2skmm3njmc6oe6m7a7mfnfg18kl.apps.googleusercontent.com';
const DISCOVERY_DOC = 'https://docs.googleapis.com/$discovery/rest?version=v1';
const SCOPES = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file';

let gapiInitialized = false;

// GAPI 초기화
export const initializeGapi = async (): Promise<void> => {
  if (gapiInitialized) return;

  try {
    await new Promise<void>((resolve) => {
      gapi.load('auth2:client', resolve);
    });

    await gapi.client.init({
      clientId: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      discoveryDocs: [DISCOVERY_DOC]
    });

    gapiInitialized = true;
    console.log('GAPI 초기화 완료');
  } catch (error) {
    console.error('GAPI 초기화 실패:', error);
    throw new Error('Google API 초기화에 실패했습니다.');
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