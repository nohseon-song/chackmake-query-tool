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

// HTML을 Google Docs 요청 형식으로 변환 (전체 내용 보존 및 서식 개선)
const convertHtmlToGoogleDocsRequests = (html: string): any[] => {
  console.log('🔄 HTML을 Google Docs 형식으로 변환 시작');
  console.log('📄 원본 HTML 길이:', html.length);
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const requests: any[] = [];
  let currentIndex = 1;
  
  // 구조화된 콘텐츠 추출 함수 (제목, 섹션, 문단 구분)
  const extractStructuredContent = (element: Element): { type: string; content: string; level: number }[] => {
    const sections: { type: string; content: string; level: number }[] = [];
    
    // 각 노드를 순회하며 구조화된 데이터 추출
    const traverseNodes = (node: Node, parentLevel: number = 0) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tagName = el.tagName.toLowerCase();
        
        // 제목 태그 처리
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
          const headingText = el.textContent?.trim();
          if (headingText && headingText.length > 0) {
            const level = parseInt(tagName.charAt(1));
            sections.push({
              type: 'heading',
              content: headingText,
              level: level
            });
          }
        }
        // 섹션, 아티클 등의 구조적 요소
        else if (['section', 'article'].includes(tagName)) {
          // 자식 노드들을 재귀적으로 처리
          el.childNodes.forEach(child => traverseNodes(child, parentLevel + 1));
        }
        // 문단 요소들
        else if (['p', 'div'].includes(tagName)) {
          const paragraphText = el.textContent?.trim();
          if (paragraphText && paragraphText.length > 0) {
            // 긴 문단을 적절한 길이로 분할
            const maxParagraphLength = 300;
            if (paragraphText.length > maxParagraphLength) {
              // 문장 단위로 분할
              const sentences = paragraphText.split(/[.!?]\s+/);
              let currentParagraph = '';
              
              sentences.forEach((sentence, index) => {
                if (currentParagraph.length + sentence.length < maxParagraphLength) {
                  currentParagraph += sentence + (index < sentences.length - 1 ? '. ' : '');
                } else {
                  if (currentParagraph.trim()) {
                    sections.push({
                      type: 'paragraph',
                      content: currentParagraph.trim(),
                      level: 0
                    });
                  }
                  currentParagraph = sentence + (index < sentences.length - 1 ? '. ' : '');
                }
              });
              
              if (currentParagraph.trim()) {
                sections.push({
                  type: 'paragraph',
                  content: currentParagraph.trim(),
                  level: 0
                });
              }
            } else {
              sections.push({
                type: 'paragraph',
                content: paragraphText,
                level: 0
              });
            }
          }
        }
        // 리스트 아이템
        else if (tagName === 'li') {
          const listText = el.textContent?.trim();
          if (listText && listText.length > 0) {
            sections.push({
              type: 'list',
              content: '• ' + listText,
              level: 0
            });
          }
        }
        // 기타 요소들의 자식 노드 처리
        else {
          el.childNodes.forEach(child => traverseNodes(child, parentLevel));
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text && text.length > 0 && text.length > 10) { // 의미있는 텍스트만 추가
          sections.push({
            type: 'text',
            content: text,
            level: 0
          });
        }
      }
    };
    
    element.childNodes.forEach(child => traverseNodes(child));
    return sections;
  };
  
  // 구조화된 콘텐츠 추출
  let structuredSections = extractStructuredContent(tempDiv);
  
  // 만약 구조화된 추출 결과가 부족하면 전체 텍스트를 문단으로 분할
  if (structuredSections.length === 0 || structuredSections.reduce((total, section) => total + section.content.length, 0) < 500) {
    console.log('⚠️ 구조화된 추출 결과가 부족함, 전체 텍스트를 문단으로 분할');
    const fullText = tempDiv.textContent || tempDiv.innerText || '';
    
    // 전체 텍스트를 문단으로 분할 (더블 줄바꿈 기준)
    const paragraphs = fullText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    structuredSections = paragraphs.map(paragraph => ({
      type: 'paragraph',
      content: paragraph.trim(),
      level: 0
    }));
  }
  
  // 문서 헤더 구성
  const headerSections = [
    { type: 'heading', content: '기술진단 및 진단 보고서', level: 1 },
    { type: 'heading', content: '기계설비 성능점검 및 유지관리자 업무 Troubleshooting', level: 2 },
    { 
      type: 'paragraph', 
      content: `작성일: ${new Date().toLocaleDateString('ko-KR', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      }).replace(/\. /g, '-').replace('.', '')}`, 
      level: 0 
    },
    { type: 'paragraph', content: '', level: 0 } // 빈 줄 추가
  ];
  
  // 헤더와 본문 콘텐츠 결합
  const allSections = [...headerSections, ...structuredSections];
  
  console.log(`📑 총 ${allSections.length}개의 섹션 추출:`, allSections.map(s => ({ type: s.type, length: s.content.length })));
  
  // 각 섹션을 Google Docs 요청으로 변환
  allSections.forEach((section, sectionIndex) => {
    if (!section.content.trim()) {
      // 빈 줄 추가
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: '\n'
        }
      });
      currentIndex += 1;
      return;
    }
    
    // 텍스트 삽입
    const textWithNewline = section.content + '\n\n';
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: textWithNewline
      }
    });
    
    const startIndex = currentIndex;
    const endIndex = currentIndex + section.content.length;
    
    // 스타일 적용
    if (section.type === 'heading') {
      let styleType = 'HEADING_3'; // 기본값
      
      if (section.level === 1) {
        styleType = 'HEADING_1';
      } else if (section.level === 2) {
        styleType = 'HEADING_2';
      } else if (section.level === 3) {
        styleType = 'HEADING_3';
      }
      
      requests.push({
        updateParagraphStyle: {
          range: { startIndex, endIndex },
          paragraphStyle: { namedStyleType: styleType },
          fields: 'namedStyleType'
        }
      });
    }
    
    // 특정 키워드 볼드 처리
    const boldKeywords = [
      '종합 결론', '핵심 문제', '제안된 개선 방향', '결론 및 권고', '작성일:',
      '기술검토 및 진단 전문가', '기술 보완 전문가', '기술 검증 전문가',
      '역할:', '전문분야:', '참여영역:', '배경:',
      '압력 감소', '캐비테이션', 'kgf/cm²', '㎏f/㎠', '%', '감소', '증가',
      '개선 방안', '점검', '유지보수', '권고', '진단', '측정값:', '설계값:', '편차:',
      '최종 요약:', '핵심 진단 요약', '정밀 검증', '최종 종합 의견', '마무리:',
      '계산 검증', '단위 검증', '논리 검증', '종합 평가'
    ];
    
    boldKeywords.forEach(keyword => {
      let searchPos = 0;
      while (true) {
        const foundPos = section.content.indexOf(keyword, searchPos);
        if (foundPos === -1) break;
        
        const keywordStart = startIndex + foundPos;
        const keywordEnd = keywordStart + keyword.length;
        
        requests.push({
          updateTextStyle: {
            range: { startIndex: keywordStart, endIndex: keywordEnd },
            textStyle: { bold: true },
            fields: 'bold'
          }
        });
        
        searchPos = foundPos + keyword.length;
      }
    });
    
    currentIndex += textWithNewline.length;
  });
  
  console.log(`✅ 총 ${requests.length}개의 Google Docs 요청 생성 완료`);
  console.log('📋 요청 타입별 분포:', {
    insertText: requests.filter(r => r.insertText).length,
    updateParagraphStyle: requests.filter(r => r.updateParagraphStyle).length,
    updateTextStyle: requests.filter(r => r.updateTextStyle).length
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
  
  // equipmentName 처리 로직 - 실제 선택된 설비명 사용
  let equipment = '설비'; // 기본값
  
  if (equipmentName && equipmentName.trim()) {
    const trimmedName = equipmentName.trim();
    // 비어있지 않은 모든 설비명 사용 (ultra, 설비 등 필터링 제거)
    if (trimmedName.length > 0) {
      equipment = trimmedName;
    }
  }
  
  console.log('🏷️ 파일명 생성:', { 
    originalEquipmentName: equipmentName, 
    finalEquipment: equipment,
    생성된파일명: `기술진단내역작성_${equipment}_${year}.${month}.${day}`
  });
  return `기술진단내역작성_${equipment}_${year}.${month}.${day}`;
};

// Google Docs 생성 (간소화 버전)
export const createGoogleDoc = async (htmlContent: string, accessToken: string, equipmentName?: string): Promise<string> => {
  try {
    console.log('🚀 Google Docs 생성 시작', {
      equipmentName: equipmentName,
      hasEquipmentName: !!equipmentName,
      equipmentNameLength: equipmentName?.length || 0
    });
    
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