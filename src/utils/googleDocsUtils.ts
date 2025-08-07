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

// HTML을 Google Docs 요청 형식으로 변환 (전체 내용 보존)
const convertHtmlToGoogleDocsRequests = (html: string): any[] => {
  console.log('🔄 HTML을 Google Docs 형식으로 변환 시작');
  console.log('📄 원본 HTML 길이:', html.length);
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const requests: any[] = [];
  let currentIndex = 1;
  
  // HTML에서 모든 텍스트 노드 추출 (구조 보존)
  const extractAllContent = (element: Element): string => {
    let content = '';
    
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          content += text + '\n\n';
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tagName = el.tagName.toLowerCase();
        
        // 제목 태그들은 헤딩으로 처리
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
          const headingText = el.textContent?.trim();
          if (headingText) {
            content += `\n${headingText}\n\n`;
          }
        }
        // 문단, div, section 등은 내용 추출
        else if (['p', 'div', 'section', 'article', 'span'].includes(tagName)) {
          const text = el.textContent?.trim();
          if (text) {
            content += text + '\n\n';
          }
        }
        // 리스트 항목들
        else if (['li'].includes(tagName)) {
          const text = el.textContent?.trim();
          if (text) {
            content += '• ' + text + '\n\n';
          }
        }
        // 기타 요소들도 재귀적으로 처리
        else {
          content += extractAllContent(el);
        }
      }
    }
    
    return content;
  };
  
  // 전체 내용 추출
  let fullContent = extractAllContent(tempDiv);
  
  // 만약 구조화된 추출에서 내용이 부족하면 전체 텍스트 사용
  if (fullContent.length < 500) {
    console.log('⚠️ 구조화된 추출 결과가 짧음, 전체 텍스트 사용');
    fullContent = tempDiv.textContent || tempDiv.innerText || '';
  }
  
  // 문서 헤더
  const mainTitle = "기술진단 및 진단 보고서";
  const subTitle = "기계설비 성능점검 및 유지관리자 업무 Troubleshooting";
  const date = `작성일: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '')}`;
  
  // 최종 문서 구성
  let structuredContent = '';
  structuredContent += mainTitle + '\n\n';
  structuredContent += subTitle + '\n\n';
  structuredContent += date + '\n\n\n';
  
  // 원본 HTML의 모든 내용 추가 (생략 없이)
  structuredContent += fullContent;
  
  console.log('📝 최종 문서 길이:', structuredContent.length);
  console.log('🔍 최종 문서 미리보기 (처음 500자):', structuredContent.substring(0, 500));
  
  // 텍스트가 너무 길면 여러 번에 나눠서 삽입
  const maxChunkSize = 50000; // Google Docs API 제한 고려
  const chunks = [];
  
  if (structuredContent.length > maxChunkSize) {
    console.log('📑 긴 문서를 청크로 분할');
    for (let i = 0; i < structuredContent.length; i += maxChunkSize) {
      chunks.push(structuredContent.substring(i, i + maxChunkSize));
    }
  } else {
    chunks.push(structuredContent);
  }
  
  // 각 청크를 순차적으로 삽입
  chunks.forEach((chunk, index) => {
    console.log(`📄 청크 ${index + 1}/${chunks.length} 추가 (길이: ${chunk.length})`);
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: chunk
      }
    });
    currentIndex += chunk.length;
  });
  
  // 스타일링 적용
  let styleIndex = 1;
  
  // 메인 제목 스타일링
  requests.push({
    updateParagraphStyle: {
      range: {
        startIndex: styleIndex,
        endIndex: styleIndex + mainTitle.length
      },
      paragraphStyle: {
        namedStyleType: 'HEADING_1'
      },
      fields: 'namedStyleType'
    }
  });
  styleIndex += mainTitle.length + 2;
  
  // 부제목 스타일링
  requests.push({
    updateParagraphStyle: {
      range: {
        startIndex: styleIndex,
        endIndex: styleIndex + subTitle.length
      },
      paragraphStyle: {
        namedStyleType: 'HEADING_2'
      },
      fields: 'namedStyleType'
    }
  });
  styleIndex += subTitle.length + 2;
  
  // 날짜 볼드 처리
  requests.push({
    updateTextStyle: {
      range: {
        startIndex: styleIndex,
        endIndex: styleIndex + date.length
      },
      textStyle: {
        bold: true
      },
      fields: 'bold'
    }
  });
  
  // 주요 키워드들에 대한 볼드 처리
  const keywordsToBold = [
    '종합 결론', '핵심 문제', '제안된 개선 방향', '결론 및 권고',
    '기술검토 및 진단 전문가', '기술 보완 전문가', '기술 검증 전문가',
    '압력 감소', '캐비테이션', 'kgf/cm²', '56%', '감소',
    '개선 방안', '점검', '유지보수'
  ];
  
  keywordsToBold.forEach(keyword => {
    let searchIndex = 0;
    while (true) {
      const foundIndex = structuredContent.indexOf(keyword, searchIndex);
      if (foundIndex === -1) break;
      
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: foundIndex + 1,
            endIndex: foundIndex + keyword.length + 1
          },
          textStyle: {
            bold: true
          },
          fields: 'bold'
        }
      });
      
      searchIndex = foundIndex + keyword.length;
    }
  });
  
  console.log(`✅ 총 ${requests.length}개의 Google Docs 요청 생성 완료`);
  return requests;
};

const FOLDER_ID = '1Ndsjt8XGOTkH0mSg2LLfclc3wjO9yiR7';

// 파일명 생성 함수
const generateReportFileName = (equipmentName?: string): string => {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  
  // equipmentName이 제공되지 않거나 비어있으면 기본값 사용하지 않고 빈 문자열 처리
  const equipment = equipmentName && equipmentName.trim() && equipmentName !== 'ultra' 
    ? equipmentName.trim() 
    : '설비';
  
  return `기술진단내역작성_${equipment}_${year}.${month}.${day}`;
};

// Google Docs 생성 (간소화 버전)
export const createGoogleDoc = async (htmlContent: string, accessToken: string, equipmentName?: string): Promise<string> => {
  try {
    console.log('🚀 Google Docs 생성 시작');
    
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
        title: generateReportFileName(equipmentName)
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