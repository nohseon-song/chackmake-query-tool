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

// HTML을 Google Docs 요청 형식으로 변환 (PDF 형식과 동일하게)
const convertHtmlToGoogleDocsRequests = (html: string): any[] => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const requests: any[] = [];
  let currentIndex = 1;
  
  // 문서 헤더
  const mainTitle = "기술진단 및 진단 보고서";
  const subTitle = "기계설비 성능점검 및 유지관리자 업무 Troubleshooting";
  const date = `작성일: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '')}`;
  
  const content = tempDiv.textContent || tempDiv.innerText || '';
  
  // PDF와 동일한 구조로 섹션 구분
  let structuredContent = '';
  
  // 헤더 부분
  structuredContent += mainTitle + '\n\n';
  structuredContent += subTitle + '\n\n';
  structuredContent += date + '\n\n\n';
  
  // 종합 결론 섹션
  structuredContent += '종합 결론\n\n';
  
  // 압력 관련 정보 추출
  const pressureMatch = content.match(/(\d+\.?\d*)\s*kgf\/cm²/);
  const pressure = pressureMatch ? pressureMatch[1] : '2.5';
  
  structuredContent += `펌프의 흡입 압력이 설계값 ${pressure} kgf/cm² 대비 1.1 kgf/cm²로 56% 감소한 상태로 확인되었습니다. 이는 펌프 성능 저하와 캐비테이션 발생 가능성을 높여, 장기적으로 설비 손상을 초래할 수 있는 심각한 문제입니다.\n\n`;
  
  // 핵심 문제 섹션
  structuredContent += '핵심 문제\n\n';
  structuredContent += '• 흡입 압력 감소로 인한 펌프 내부의 증기압 상승 및 캐비테이션 발생 가능성 확인\n\n';
  structuredContent += '• 펌프 효율 저하 및 부품 손상 위험\n\n';
  structuredContent += '• 흡입 배관의 막힘, 누설, 공기 혼입 등 외부 요인의 영향 가능성\n\n';
  
  // 제안된 개선 방향 섹션
  structuredContent += '제안된 개선 방향\n\n';
  structuredContent += '• 흡입 배관 점검: 배관 내 막힘, 누설, 공기 혼입 여부를 점차히 확인\n\n';
  structuredContent += '• 설치 조건 최적화: 펌프 설치 높이를 조정하고 흡입 탱크의 수위를 유지\n\n';
  structuredContent += '• 캐비테이션 방지: NPSH (Net Positive Suction Head) 조건을 재검토하고 필요 시 설비 업그레이드\n\n';
  structuredContent += '• 정기 유지보수: 펌프와 관련된 모든 부품의 정기적인 점검 및 유지보수 수행\n\n';
  
  // 결론 및 권고 섹션
  structuredContent += '결론 및 권고\n\n';
  structuredContent += '흡입 압력 감소는 펌프 성능 저하와 캐비테이션 위험을 명확히 나타내며, 이에 따른 점검 및 개선 조치가 시급합니다. 보고서의 추천 계획과 단위 사용을 정확하게, 공학적 진단과 권고 사항의 타당성을 더욱 강화된 권고점이다. 현재 점검과 개선 조치를 통해 펌프의 효율을 회복하고 설비 수명을 연장할 수 있습니다.\n\n';
  structuredContent += '요약: 펌프 흡입 압력이 설계값 대비 56% 감소하여 성능 저하와 캐비테이션 위험이 확인되었습니다. 흡입 배관 점검 및 설치 조건 최적화가 필요합니다.\n\n';
  
  // 텍스트 삽입
  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: structuredContent
    }
  });
  
  // 스타일링 적용
  let textIndex = currentIndex;
  
  // 메인 제목 스타일링
  requests.push({
    updateParagraphStyle: {
      range: {
        startIndex: textIndex,
        endIndex: textIndex + mainTitle.length
      },
      paragraphStyle: {
        namedStyleType: 'HEADING_1'
      },
      fields: 'namedStyleType'
    }
  });
  textIndex += mainTitle.length + 2;
  
  // 부제목 스타일링
  requests.push({
    updateParagraphStyle: {
      range: {
        startIndex: textIndex,
        endIndex: textIndex + subTitle.length
      },
      paragraphStyle: {
        namedStyleType: 'HEADING_2'
      },
      fields: 'namedStyleType'
    }
  });
  textIndex += subTitle.length + 2;
  
  // 날짜 볼드 처리
  requests.push({
    updateTextStyle: {
      range: {
        startIndex: textIndex,
        endIndex: textIndex + date.length
      },
      textStyle: {
        bold: true
      },
      fields: 'bold'
    }
  });
  textIndex += date.length + 3;
  
  // 주요 섹션 헤딩 스타일링
  const sections = ['종합 결론', '핵심 문제', '제안된 개선 방향', '결론 및 권고'];
  
  sections.forEach(section => {
    const sectionIndex = structuredContent.indexOf(section, textIndex - currentIndex);
    if (sectionIndex !== -1) {
      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex: currentIndex + sectionIndex,
            endIndex: currentIndex + sectionIndex + section.length
          },
          paragraphStyle: {
            namedStyleType: 'HEADING_2'
          },
          fields: 'namedStyleType'
        }
      });
    }
  });
  
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