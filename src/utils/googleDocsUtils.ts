// src/utils/googleDocsUtils.ts

// Google OAuth + Google Docs Utilities (Authorization Code Flow + Rich Formatting)
export interface GoogleAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
}

// Google Client ID - set dynamically
let GOOGLE_CLIENT_ID = '';

// Fetch Google Client ID from Supabase Edge Function (no secrets in client)
export const fetchGoogleClientId = async (): Promise<string> => {
  try {
    const response = await fetch(
      'https://rigbiqjmszdlacjdkhep.supabase.co/functions/v1/get-google-config',
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) throw new Error('Failed to fetch Google Client ID');

    const data = await response.json();
    if (data?.success && data?.clientId) {
      GOOGLE_CLIENT_ID = data.clientId as string;
      return GOOGLE_CLIENT_ID;
    }

    throw new Error('Google Client ID not found in response');
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

export const setGoogleClientId = (clientId: string) => {
  GOOGLE_CLIENT_ID = clientId;
};

export const getGoogleClientId = (): string => GOOGLE_CLIENT_ID;

// Direct OAuth (popup) to get Authorization Code with offline access (for refresh token)
export const authenticateGoogle = async (): Promise<string> => {
  try {
    let clientId = getGoogleClientId();
    if (!clientId) clientId = await fetchGoogleClientId();
    if (!clientId) throw new Error('Google Client ID를 가져올 수 없습니다.');

    const scope = [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'openid',
    ].join(' ');

    const redirectUri = `${window.location.protocol}//${window.location.host}`;
    const state = Math.random().toString(36).slice(2);

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('include_granted_scopes', 'true');
    authUrl.searchParams.append('access_type', 'offline');

    const popup = window.open(
      authUrl.toString(),
      'google-auth',
      'width=500,height=650,scrollbars=yes,resizable=yes'
    );
    if (!popup) throw new Error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');

    return new Promise<string>((resolve, reject) => {
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          reject(new Error('팝업이 닫혔습니다. 다시 시도해주세요.'));
        }
      }, 800);

      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          popup.close();
          resolve(event.data.code);
        } else if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          popup.close();
          reject(new Error(event.data.error || 'Google 인증에 실패했습니다.'));
        }
      };
      window.addEventListener('message', messageListener);

      // Fallback: same-origin redirect detection
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
              resolve(code);
            } else if (error) {
              clearInterval(checkUrl);
              clearInterval(checkClosed);
              window.removeEventListener('message', messageListener);
              popup.close();
              reject(new Error(`인증 오류: ${error}`));
            }
          }
        } catch (_) {
          // Cross-origin while on accounts.google.com – ignore
        }
      }, 500);
    });
  } catch (error: any) {
    console.error('❌ 인증 실패:', error);
    throw new Error(`Google 인증에 실패했습니다: ${error.message}`);
  }
};

export const validateGoogleToken = async (accessToken: string): Promise<boolean> => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
    );
    return response.ok;
  } catch (error) {
    console.error('토큰 검증 실패:', error);
    return false;
  }
};

// Robust JSON extraction from mixed HTML/text
// - Finds inline JSON blocks and replaces them with human-readable text
const parseAndCleanHtml = (htmlContent: string): string => {
  let content = htmlContent ?? '';

  // Normalize <br> to newlines to preserve paragraph breaks
  content = content.replace(/<br\s*\/?>(?=\s*<)/gi, '\n');
  content = content.replace(/<br\s*\/?>(?!\n)/gi, '\n');

  // Remove recurring headings that shouldn't appear in final doc
  content = content.replace(/기술검토 및 진단결과 종합/g, '');

  // Extract JSON-looking fragments safely (spanning lines)
  const jsonRegex = /\{[\s\S]*?\}/g;
  const candidates = content.match(jsonRegex) || [];

  for (const frag of candidates) {
    try {
      const parsed = JSON.parse(frag);
      // Collect known fields in desired order
      const keys = [
        'result_final_text',
        'final_summary',
        'finalSummary',
        'diagnosis_summary',
        'complementary_summary',
        'precision_verification',
      ];
      const pieces: string[] = [];
      for (const k of keys) {
        const v = (parsed as any)[k];
        if (typeof v === 'string' && v.trim()) pieces.push(v.trim());
      }

      const replacement = pieces.join('\n').replace(/\\n/g, '\n');
      // Replace JSON block with extracted text
      if (replacement) content = content.replace(frag, replacement);
    } catch (_) {
      // Not valid JSON – ignore
    }
  }

  // Strip any isolated braces/quotes remnants
  content = content.replace(/\{\}|\[\]|\"\"/g, '');

  // Convert remaining HTML to plain text while preserving line breaks
  const div = document.createElement('div');
  div.innerHTML = content
    // Convert list items to bullet lines so we can style them later
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<h1[^>]*>/gi, '\n# ')
    .replace(/<h2[^>]*>/gi, '\n## ')
    .replace(/<h3[^>]*>/gi, '\n### ')
    .replace(/<h[4-6][^>]*>/gi, '\n#### ')
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '\n');

  const text = (div.textContent || div.innerText || '').replace(/\u00A0/g, ' ');

  // Collapse excessive blank lines and trim
  return text
    .split('\n')
    .map((l) => l.replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Convert cleaned plain text to Google Docs batchUpdate requests with styles
const convertHtmlToGoogleDocsRequests = (html: string): any[] => {
  const rawText = parseAndCleanHtml(html);
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const requests: any[] = [];
  let currentIndex = 1; // Docs API content starts at index 1

  const insertText = (text: string) => {
    requests.push({ insertText: { location: { index: currentIndex }, text } });
    currentIndex += text.length;
  };

  const applyParagraphStyle = (start: number, end: number, namedStyleType: string) => {
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: { namedStyleType },
        fields: 'namedStyleType',
      },
    });
  };

  const applyBold = (start: number, end: number) => {
    if (end > start) {
      requests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end },
          textStyle: { bold: true },
          fields: 'bold',
        },
      });
    }
  };

  const makeBullet = (start: number, end: number) => {
    requests.push({
      createParagraphBullets: {
        range: { startIndex: start, endIndex: end },
        bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
      },
    });
  };

  // Header block
  const title = '기술검토 및 진단 보고서\n';
  const subtitle = '기계설비 성능점검 및 유지관리자 업무 Troubleshooting\n';
  const dateLine = `작성일: ${new Date().toLocaleDateString('ko-KR')}\n\n`;
  const titleStart = currentIndex;
  insertText(title);
  applyParagraphStyle(titleStart, titleStart + title.length - 1, 'HEADING_1');

  const subtitleStart = currentIndex;
  insertText(subtitle);
  applyParagraphStyle(subtitleStart, subtitleStart + subtitle.length - 1, 'HEADING_2');

  insertText(dateLine);

  // Section keyword heuristics
  const sectionKeywords = [
    '핵심 진단 요약',
    '정밀 검증',
    '최종 종합 의견',
    '기술 진단 의견',
    '심층 검증',
    '계산 검증',
    '단위 검증',
    '논리 검증',
    '종합 평가',
    '주요 원인 분석',
    '개선 권고 사항',
    '기대 효과',
    '결론',
  ];

  const isNumberedHeading = (line: string) => /^(\d+\.|\d+\)|[IVX]+\.|[가-힣]\)|[A-Z]\))\s+/.test(line);
  const isSectionHeading = (line: string) =>
    sectionKeywords.some((k) => line.startsWith(k)) || /[:：]$/.test(line);
  const isBulletLine = (line: string) => /^([•\-\*]|\u2022)\s+/.test(line);

  for (const line of lines) {
    const textToInsert = line + '\n';
    const startIndex = currentIndex;
    insertText(textToInsert);
    const endIndex = startIndex + textToInsert.length;

    if (isNumberedHeading(line)) {
      applyParagraphStyle(startIndex, endIndex, 'HEADING_2');
      // Bold up to first colon if present
      const m = line.match(/^(.{1,80}?)([:：])/);
      if (m) applyBold(startIndex, startIndex + m[1].length);
    } else if (isSectionHeading(line)) {
      applyParagraphStyle(startIndex, endIndex, 'HEADING_3');
      const m = line.match(/^(.{1,80}?)([:：])/);
      if (m) applyBold(startIndex, startIndex + m[1].length);
    } else if (isBulletLine(line)) {
      // Convert to real bullet list and bold label before colon
      makeBullet(startIndex, endIndex);
      const m = line.replace(/^([•\-\*]|\u2022)\s+/, '').match(/^(.{1,80}?)([:：])/);
      if (m) {
        const offset = line.indexOf(' ') + 1; // after bullet symbol + space
        applyBold(startIndex + offset, startIndex + offset + m[1].length);
      }
    } else {
      // Normal paragraph: bold leading label (e.g., "원인:")
      const m = line.match(/^(.{1,80}?)([:：])/);
      if (m) applyBold(startIndex, startIndex + m[1].length);
    }
  }

  return requests;
};

const FOLDER_ID = '1Ndsjt8XGOTkH0mSg2LLfclc3wjO9yiR7';

// File name generator with equipment extraction
const generateReportFileName = (equipmentName?: string, htmlContent?: string): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  let equipment = '설비';
  if (equipmentName?.trim()) {
    equipment = equipmentName.trim();
  } else if (htmlContent) {
    const equipmentList = [
      '냉동기(압축식)',
      '냉동기(흡수식)',
      '냉각탑',
      '축열조',
      '보일러',
      '열교환기',
      '펌프',
      '공기조화기',
      '환기설비',
      '현열교환기',
      '전열교환기',
      '팬코일유니트',
      '위생기구설비',
      '급수급탕설비',
      '냉동기',
      '냉각기',
    ];
    for (const eq of equipmentList) {
      if (htmlContent.includes(eq)) {
        equipment = eq;
        break;
      }
    }
  }
  return `기술진단내역작성_${equipment}_${year}.${month}.${day}`;
};

// Exchange authorization code for tokens via Supabase Edge Function
export const exchangeCodeForToken = async (
  code: string
): Promise<{ accessToken: string; refreshToken?: string }> => {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error('Google Client ID가 설정되지 않았습니다.');

  const resp = await fetch(
    'https://rigbiqjmszdlacjdkhep.supabase.co/functions/v1/exchange-code-for-tokens',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, clientId }),
    }
  );

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`토큰 교환 실패: ${t}`);
  }
  const data = await resp.json();
  if (!data?.success || !data?.access_token)
    throw new Error('올바른 토큰 응답을 받지 못했습니다.');

  return { accessToken: data.access_token, refreshToken: data.refresh_token };
};

// Create Google Doc and apply rich formatting
export const createGoogleDoc = async (
  htmlContent: string,
  accessToken: string,
  equipmentName?: string
): Promise<string> => {
  // Validate token first
  const isValid = await validateGoogleToken(accessToken);
  if (!isValid) throw new Error('토큰이 유효하지 않습니다.');

  // Build formatting requests from content
  const formattingRequests = convertHtmlToGoogleDocsRequests(htmlContent);
  if (formattingRequests.length === 0) throw new Error('변환할 콘텐츠가 없습니다.');

  // 1) Create document
  const createResp = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: generateReportFileName(equipmentName, htmlContent),
    }),
  });
  if (!createResp.ok) {
    const t = await createResp.text();
    throw new Error(`문서 생성 실패: ${createResp.status} ${t}`);
  }
  const created = await createResp.json();
  const documentId = created.documentId as string;
  if (!documentId) throw new Error('문서 ID를 받지 못했습니다.');

  // 2) Move to folder (best-effort)
  const moveResp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${documentId}?addParents=${FOLDER_ID}&removeParents=root`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    }
  );
  if (!moveResp.ok) {
    // non-fatal
    console.warn('폴더 이동 실패:', await moveResp.text());
  }

  // 3) Apply content updates
  const updateResp = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: formattingRequests }),
    }
  );
  if (!updateResp.ok) {
    const t = await updateResp.text();
    throw new Error(`문서 업데이트 실패: ${updateResp.status} ${t}`);
  }

  return `https://docs.google.com/document/d/${documentId}/edit`;
};
