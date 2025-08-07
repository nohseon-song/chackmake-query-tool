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
    const scope = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid';
    const redirectUri = `${window.location.protocol}//${window.location.host}`;
    const responseType = 'code'; // 'token'에서 'code'로 변경
    const accessType = 'offline'; // refresh token을 받기 위해 추가
    const state = Math.random().toString(36).substring(2, 15);
    
    // OAuth URL 생성
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', responseType);
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('include_granted_scopes', 'true');
    authUrl.searchParams.append('access_type', accessType); // access_type 추가

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

    // 팝업에서 코드 받기
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
          resolve(event.data.code); // code를 반환하도록 수정
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
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');
            
            if (code) {
              clearInterval(checkUrl);
              clearInterval(checkClosed);
              window.removeEventListener('message', messageListener);
              popup.close();
              console.log('✅ 코드 획득 성공');
              resolve(code);
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

// **[수정됨]** HTML 콘텐츠에서 JSON을 파싱하고 정리하는 함수
const parseAndCleanHtml = (htmlContent: string): string => {
  let cleanContent = htmlContent;

  // 정규식을 사용하여 JSON 객체처럼 보이는 문자열 찾기
  const jsonRegex = /{\s*"[a-zA-Z_]+"\s*:\s*".*?"\s*}/g;
  
  const matches = cleanContent.match(jsonRegex);

  if (matches) {
    matches.forEach(jsonString => {
      try {
        const parsed = JSON.parse(jsonString);
        let replacementText = '';
        
        // JSON 객체 안의 키를 기반으로 텍스트 추출
        if (parsed.result_final_text) {
          replacementText += parsed.result_final_text;
        }
        if (parsed.final_summary) {
          replacementText += parsed.final_summary;
        }
        
        // 원본 문자열에서 JSON 부분을 추출된 텍스트로 교체
        cleanContent = cleanContent.replace(jsonString, replacementText);
      } catch (e) {
        // 유효한 JSON이 아니면 무시하고 원본 유지
        console.warn('Could not parse JSON string in content:', jsonString);
      }
    });
  }
  
  // 불필요한 태그나 텍스트 정리 (예: "기술검토 및 진단결과 종합")
  cleanContent = cleanContent.replace(/기술검토 및 진단결과 종합/g, '');

  return cleanContent;
};

// **[수정됨]** HTML을 Google Docs 요청 형식으로 변환하는 핵심 로직
const convertHtmlToGoogleDocsRequests = (html: string): any[] => {
  // 1. JSON 파싱 및 텍스트 정리
  const cleanHtml = parseAndCleanHtml(html);
  
  console.log('🔄 HTML을 Google Docs 형식으로 변환 시작');
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = cleanHtml;
  
  const requests: any[] = [];
  let currentIndex = 1;
  
  const processNode = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toLowerCase();
      const textContent = el.textContent?.trim() || '';

      if (!textContent) return;

      let styleType = 'NORMAL_TEXT';
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        styleType = `HEADING_${tagName.charAt(1)}`;
      }

      const textToInsert = textContent + '\n';
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: textToInsert,
        },
      });
      
      const startIndex = currentIndex;
      const endIndex = currentIndex + textContent.length;

      if (styleType !== 'NORMAL_TEXT') {
        requests.push({
          updateParagraphStyle: {
            range: { startIndex, endIndex },
            paragraphStyle: { namedStyleType: styleType },
            fields: 'namedStyleType',
          },
        });
      }

      currentIndex += textToInsert.length;
    } else if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent?.trim() || '';
      if (textContent) {
        const textToInsert = textContent + '\n';
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: textToInsert,
          },
        });
        currentIndex += textToInsert.length;
      }
    }
  };

  tempDiv.childNodes.forEach(node => processNode(node));
  
  console.log(`✅ 총 ${requests.length}개의 Google Docs 요청 생성 완료`);
  return requests;
};

const FOLDER_ID = '1Ndsjt8XGOTkH0mSg2LLfclc3wjO9yiR7';

// 파일명 생성 함수 - 설비명 추출 로직 강화
const generateReportFileName = (equipmentName?: string, htmlContent?: string): string => {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  
  let equipment = '설비'; // 기본값
  
  // 1. 직접 전달된 equipmentName 사용
  if (equipmentName && equipmentName.trim().length > 0) {
    equipment = equipmentName.trim();
    console.log('🎯 직접 전달된 설비명 사용:', equipment);
  }
  // 2. HTML 내용에서 설비명 추출 시도
  else if (htmlContent) {
    console.log('🔍 HTML에서 설비명 추출 시도...');
    
    // 설비명 목록
    const equipmentList = [
      '냉동기(압축식)', '냉동기(흡수식)', '냉각탑', '축열조', '보일러', '열교환기',
      '펌프', '공기조화기', '환기설비', '현열교환기', '전열교환기', '팬코일유니트',
      '위생기구설비', '급수급탕설비', '냉동기', '냉각기'
    ];
    
    // HTML에서 설비명 찾기
    for (const eq of equipmentList) {
      if (htmlContent.includes(eq)) {
        equipment = eq;
        console.log('✅ HTML에서 설비명 발견:', equipment);
        break;
      }
    }
  }
  
  const fileName = `기술진단내역작성_${equipment}_${year}.${month}.${day}`;
  
  console.log('🏷️ 최종 파일명 생성:', { 
    입력된equipmentName: equipmentName,
    HTML에서추출시도: !equipmentName && !!htmlContent,
    최종설비명: equipment,
    최종파일명: fileName
  });
  
  return fileName;
};

// Authorization Code를 Access Token으로 교환
export const exchangeCodeForToken = async (code: string): Promise<{ accessToken: string; refreshToken?: string }> => {
  try {
    const clientId = getGoogleClientId();
    if (!clientId) {
      throw new Error('Google Client ID가 설정되지 않았습니다.');
    }

    const response = await fetch('https://rigbiqjmszdlacjdkhep.supabase.co/functions/v1/exchange-code-for-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw`,
        'apikey': `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw`,
      },
      body: JSON.stringify({ code, clientId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`토큰 교환 실패: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.access_token) {
      throw new Error('올바른 토큰 응답을 받지 못했습니다.');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token
    };
  } catch (error) {
    console.error('토큰 교환 오류:', error);
    throw error;
  }
};

// Google Docs 생성 (간소화 버전)
export const createGoogleDoc = async (htmlContent: string, accessToken: string, equipmentName?: string): Promise<string> => {
  try {
    console.log('🚀 Google Docs 생성 시작', { equipmentName });
    
    // 토큰 유효성 검증
    console.log('🔍 토큰 유효성 검증...');
    const isTokenValid = await validateGoogleToken(accessToken);
    if (!isTokenValid) {
      throw new Error('토큰이 유효하지 않습니다.');
    }

    // HTML을 Google Docs 요청으로 변환
    console.log('📝 HTML 변환 중...');
    const formattingRequests = convertHtmlToGoogleDocsRequests(htmlContent);
    
    if (formattingRequests.length === 0) {
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
        title: generateReportFileName(equipmentName, htmlContent)
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

    // 문서를 지정된 폴더로 이동
    console.log('📁 문서 폴더 이동 중...');
    const moveResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${documentId}?addParents=${FOLDER_ID}&removeParents=root`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!moveResponse.ok) {
      const errorText = await moveResponse.text();
      console.error('폴더 이동 오류:', moveResponse.status, errorText);
      // 폴더 이동 실패해도 문서 생성은 계속 진행
      console.log('⚠️ 폴더 이동에 실패했지만 문서 생성은 계속 진행합니다.');
    } else {
      console.log('✅ 폴더 이동 완료');
    }

    // 문서에 포맷팅된 콘텐츠 추가
    console.log('📝 포맷팅된 콘텐츠 추가 중...');
    const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: formattingRequests
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