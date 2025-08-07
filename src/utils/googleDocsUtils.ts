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

// HTML을 Google Docs 요청 형식으로 변환
const convertHtmlToGoogleDocsRequests = (html: string): any[] => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const requests: any[] = [];
  let currentIndex = 1;
  
  // 전체 콘텐츠 구성
  const mainTitle = "기술진단 및 진단 보고서";
  const subTitle = "기계설비 성능점검 및 유지관리자 업무 Troubleshooting";
  const date = `작성일: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '')}`;
  
  const content = tempDiv.textContent || tempDiv.innerText || '';
  const lines = content.split('\n').filter(p => p.trim() !== '');
  
  // 전체 텍스트 구성 - 극대화된 가독성을 위한 구조화
  let fullText = mainTitle + '\n\n' + subTitle + '\n\n' + date + '\n\n\n';
  
  // 각 라인을 분석하여 구조화하고 줄바꿈 극대화
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine) {
      // 주요 항목 (숫자로 시작): "1. 점검 대상 설비"
      if (/^\d+\.\s/.test(trimmedLine)) {
        fullText += '\n══════════════════════════════════\n\n' + trimmedLine + '\n\n';
      }
      // 세부 항목 (한글 가나다 또는 영문으로 시작하는 하위 항목): "가. 설비 정보", "1) 펌프 성능"
      else if (/^[가-힣]\.\s|^\d+\)\s|^[a-zA-Z]\)\s/.test(trimmedLine)) {
        fullText += trimmedLine + '\n\n';
      }
      // 핵심 원인 분석이나 개선 방향 (특별 처리)
      else if (trimmedLine.includes('핵심 원인') || trimmedLine.includes('개선 권고') || 
               trimmedLine.includes('기대 효과') || trimmedLine.includes('종합 결론')) {
        fullText += trimmedLine + '\n\n';
      }
      // 일반 텍스트 - 문장을 짧게 분리하여 가독성 극대화
      else {
        // 문장을 더 짧게 분리 (40자 이상이면 분리)
        if (trimmedLine.length > 40) {
          // 쉼표나 접속어를 기준으로 분리
          const parts = trimmedLine.split(/,\s|이는\s|또한\s|따라서\s|그러나\s|하지만\s|그리고\s/).filter(p => p.trim());
          if (parts.length > 1) {
            parts.forEach((part, i) => {
              if (part.trim()) {
                if (i === 0) {
                  fullText += part.trim();
                  if (!part.trim().endsWith('.') && !part.trim().endsWith(',')) {
                    fullText += ',';
                  }
                  fullText += '\n';
                } else if (i === parts.length - 1) {
                  fullText += part.trim();
                  if (!part.trim().endsWith('.')) {
                    fullText += '.';
                  }
                  fullText += '\n\n';
                } else {
                  fullText += part.trim() + '\n';
                }
              }
            });
          } else {
            // 마침표로 분리
            const sentences = trimmedLine.split(/\.\s/).filter(s => s.trim());
            if (sentences.length > 1) {
              sentences.forEach((sentence, i) => {
                if (sentence.trim()) {
                  fullText += sentence.trim();
                  if (i < sentences.length - 1) {
                    fullText += '.\n';
                  } else {
                    fullText += trimmedLine.endsWith('.') ? '.\n\n' : '.\n\n';
                  }
                }
              });
            } else {
              fullText += trimmedLine + '\n\n';
            }
          }
        } else {
          fullText += trimmedLine + '\n\n';
        }
      }
    }
  });
  
  // 텍스트 삽입
  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: fullText
    }
  });
  
  // 인덱스 추적 변수
  let indexTracker = currentIndex;
  
  // 메인 제목을 Heading 1로 설정
  requests.push({
    updateParagraphStyle: {
      range: {
        startIndex: indexTracker,
        endIndex: indexTracker + mainTitle.length
      },
      paragraphStyle: {
        namedStyleType: 'HEADING_1'
      },
      fields: 'namedStyleType'
    }
  });
  indexTracker += mainTitle.length + 2; // +2 for newlines
  
  // 부제목을 Heading 2로 설정
  requests.push({
    updateParagraphStyle: {
      range: {
        startIndex: indexTracker,
        endIndex: indexTracker + subTitle.length
      },
      paragraphStyle: {
        namedStyleType: 'HEADING_2'
      },
      fields: 'namedStyleType'
    }
  });
  indexTracker += subTitle.length + 2; // +2 for newlines
  
  // 날짜 스타일링 (볼드)
  requests.push({
    updateTextStyle: {
      range: {
        startIndex: indexTracker,
        endIndex: indexTracker + date.length
      },
      textStyle: {
        bold: true
      },
      fields: 'bold'
    }
  });
  indexTracker += date.length + 3; // +3 for newlines
  
    // 스타일 적용을 위한 더 정확한 인덱스 추적
    let textParts: {text: string, style: 'H2' | 'H3' | 'BOLD' | 'NORMAL', startIndex: number, endIndex: number}[] = [];
    let currentPos = indexTracker;
    
    // 텍스트 파트별로 분석
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      
      // 주요 항목 (숫자로 시작): Heading 2
      if (/^\d+\.\s/.test(trimmedLine)) {
        // 구분선 건너뛰기
        currentPos += 37; // "══════════════════════════════════\n\n"
        textParts.push({
          text: trimmedLine,
          style: 'H2',
          startIndex: currentPos,
          endIndex: currentPos + trimmedLine.length
        });
        currentPos += trimmedLine.length + 2;
      }
      // 세부 항목: Heading 3
      else if (/^[가-힣]\.\s|^\d+\)\s|^[a-zA-Z]\)\s/.test(trimmedLine)) {
        textParts.push({
          text: trimmedLine,
          style: 'H3',
          startIndex: currentPos,
          endIndex: currentPos + trimmedLine.length
        });
        currentPos += trimmedLine.length + 2;
      }
      // 핵심 원인 분석이나 개선 방향 (특별 처리)
      else if (trimmedLine.includes('핵심 원인') || trimmedLine.includes('개선 권고') || 
               trimmedLine.includes('기대 효과') || trimmedLine.includes('종합 결론')) {
        textParts.push({
          text: trimmedLine,
          style: 'H3',
          startIndex: currentPos,
          endIndex: currentPos + trimmedLine.length
        });
        currentPos += trimmedLine.length + 2;
      }
      // 일반 텍스트
      else {
        // 40자 이상인 경우 분리된 텍스트 처리
        if (trimmedLine.length > 40) {
          const parts = trimmedLine.split(/,\s|이는\s|또한\s|따라서\s|그러나\s|하지만\s|그리고\s/).filter(p => p.trim());
          if (parts.length > 1) {
            parts.forEach((part, i) => {
              if (part.trim()) {
                let partText = part.trim();
                if (i === 0 && !partText.endsWith('.') && !partText.endsWith(',')) {
                  partText += ',';
                } else if (i === parts.length - 1 && !partText.endsWith('.')) {
                  partText += '.';
                }
                
                // 수치나 핵심 키워드 포함 여부 확인
                const shouldBold = partText.includes('진단') || partText.includes('점검') || 
                                 partText.includes('결과') || partText.includes('측정') ||
                                 partText.includes('핵심') || partText.includes('원인') ||
                                 partText.includes('압력') || partText.includes('온도') ||
                                 partText.includes('개선') || partText.includes('권고') ||
                                 /\d+\.?\d*\s*(kgf|cm²|℃|°C|Hz|RPM|bar|mm|kW|A|V|Ω|%|L\/min|m³\/h)/.test(partText);
                
                textParts.push({
                  text: partText,
                  style: shouldBold ? 'BOLD' : 'NORMAL',
                  startIndex: currentPos,
                  endIndex: currentPos + partText.length
                });
                currentPos += partText.length + 1; // +1 for newline
              }
            });
            currentPos += 1; // 마지막 줄바꿈
          } else {
            // 마침표로 분리
            const sentences = trimmedLine.split(/\.\s/).filter(s => s.trim());
            if (sentences.length > 1) {
              sentences.forEach((sentence, i) => {
                if (sentence.trim()) {
                  let sentenceText = sentence.trim();
                  if (i < sentences.length - 1) {
                    sentenceText += '.';
                  } else {
                    sentenceText += trimmedLine.endsWith('.') ? '.' : '.';
                  }
                  
                  const shouldBold = sentenceText.includes('진단') || sentenceText.includes('점검') || 
                                   sentenceText.includes('결과') || sentenceText.includes('측정') ||
                                   sentenceText.includes('핵심') || sentenceText.includes('원인') ||
                                   sentenceText.includes('압력') || sentenceText.includes('온도') ||
                                   sentenceText.includes('개선') || sentenceText.includes('권고') ||
                                   /\d+\.?\d*\s*(kgf|cm²|℃|°C|Hz|RPM|bar|mm|kW|A|V|Ω|%|L\/min|m³\/h)/.test(sentenceText);
                  
                  textParts.push({
                    text: sentenceText,
                    style: shouldBold ? 'BOLD' : 'NORMAL',
                    startIndex: currentPos,
                    endIndex: currentPos + sentenceText.length
                  });
                  currentPos += sentenceText.length + 1; // +1 for newline
                }
              });
              currentPos += 1; // 마지막 줄바꿈
            } else {
              const shouldBold = trimmedLine.includes('진단') || trimmedLine.includes('점검') || 
                               trimmedLine.includes('결과') || trimmedLine.includes('측정') ||
                               trimmedLine.includes('핵심') || trimmedLine.includes('원인') ||
                               trimmedLine.includes('압력') || trimmedLine.includes('온도') ||
                               trimmedLine.includes('개선') || trimmedLine.includes('권고') ||
                               /\d+\.?\d*\s*(kgf|cm²|℃|°C|Hz|RPM|bar|mm|kW|A|V|Ω|%|L\/min|m³\/h)/.test(trimmedLine);
              
              textParts.push({
                text: trimmedLine,
                style: shouldBold ? 'BOLD' : 'NORMAL',
                startIndex: currentPos,
                endIndex: currentPos + trimmedLine.length
              });
              currentPos += trimmedLine.length + 2;
            }
          }
        } else {
          const shouldBold = trimmedLine.includes('진단') || trimmedLine.includes('점검') || 
                           trimmedLine.includes('결과') || trimmedLine.includes('측정') ||
                           trimmedLine.includes('핵심') || trimmedLine.includes('원인') ||
                           trimmedLine.includes('압력') || trimmedLine.includes('온도') ||
                           trimmedLine.includes('개선') || trimmedLine.includes('권고') ||
                           /\d+\.?\d*\s*(kgf|cm²|℃|°C|Hz|RPM|bar|mm|kW|A|V|Ω|%|L\/min|m³\/h)/.test(trimmedLine);
          
          textParts.push({
            text: trimmedLine,
            style: shouldBold ? 'BOLD' : 'NORMAL',
            startIndex: currentPos,
            endIndex: currentPos + trimmedLine.length
          });
          currentPos += trimmedLine.length + 2;
        }
      }
    });
    
    // 스타일 적용
    textParts.forEach(part => {
      switch (part.style) {
        case 'H2':
          requests.push({
            updateParagraphStyle: {
              range: {
                startIndex: part.startIndex,
                endIndex: part.endIndex
              },
              paragraphStyle: {
                namedStyleType: 'HEADING_2'
              },
              fields: 'namedStyleType'
            }
          });
          break;
        case 'H3':
          requests.push({
            updateParagraphStyle: {
              range: {
                startIndex: part.startIndex,
                endIndex: part.endIndex
              },
              paragraphStyle: {
                namedStyleType: 'HEADING_3'
              },
              fields: 'namedStyleType'
            }
          });
          break;
        case 'BOLD':
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: part.startIndex,
                endIndex: part.endIndex
              },
              textStyle: {
                bold: true
              },
              fields: 'bold'
            }
          });
          break;
        // NORMAL은 아무 스타일도 적용하지 않음
      }
    });
  
  return requests;
};

const FOLDER_ID = '1Ndsjt8XGOTkH0mSg2LLfclc3wjO9yiR7';

// 파일명 생성 함수
const generateReportFileName = (equipmentName: string = 'ultra'): string => {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  
  return `기술진단내역작성_${equipmentName}_${year}.${month}.${day}`;
};

// Google Docs 생성 (완전 새로운 방식)
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

    // Google Docs 문서 생성 (parents 필드 제거)
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