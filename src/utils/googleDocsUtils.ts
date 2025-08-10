// src/utils/googleDocsUtils.ts

// Google OAuth + Google Docs Utilities (Authorization Code Flow + Rich Formatting)
import { supabase } from '@/integrations/supabase/client';
export interface GoogleAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
}

// Google Client ID - set dynamically
let GOOGLE_CLIENT_ID = '';

// Fetch Google Client ID from Supabase Edge Function (no secrets in client)
export const fetchGoogleClientId = async (): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-google-config', {
      body: {},
    });
    if (error) throw error;

    const clientId = (data as any)?.clientId as string | undefined;
    if (clientId) {
      GOOGLE_CLIENT_ID = clientId;
      return clientId;
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

// Convert rich HTML into Google Docs batchUpdate requests using DOMParser
const htmlToDocsRequests = (html: string): any[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstElementChild as HTMLElement;

  const requests: any[] = [];
  let currentIndex = 1; // Docs API content starts at index 1

  const insertText = (text: string) => {
    if (!text) return;
    requests.push({ insertText: { location: { index: currentIndex }, text } });
    currentIndex += text.length;
  };

  const applyParagraphStyle = (start: number, end: number, namedStyleType: string) => {
    if (end <= start) return;
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: { namedStyleType },
        fields: 'namedStyleType',
      },
    });
  };

  const applyTextStyle = (
    start: number,
    end: number,
    style: { bold?: boolean; italic?: boolean; underline?: boolean; link?: string | null }
  ) => {
    if (end <= start) return;
    const textStyle: any = {};
    const fields: string[] = [];
    if (style.bold) {
      textStyle.bold = true;
      fields.push('bold');
    }
    if (style.italic) {
      textStyle.italic = true;
      fields.push('italic');
    }
    if (style.underline) {
      textStyle.underline = true;
      fields.push('underline');
    }
    if (style.link) {
      textStyle.link = { url: style.link };
      fields.push('link');
    }
    if (fields.length === 0) return;
    requests.push({
      updateTextStyle: {
        range: { startIndex: start, endIndex: end },
        textStyle,
        fields: fields.join(','),
      },
    });
  };

  const makeBullets = (start: number, end: number, preset: 'BULLET_DISC_CIRCLE_SQUARE' | 'NUMBERED_DECIMAL_ALPHA_ROMAN') => {
    if (end <= start) return;
    requests.push({
      createParagraphBullets: {
        range: { startIndex: start, endIndex: end },
        bulletPreset: preset,
      },
    });
  };

  const headingMap: Record<string, string> = {
    H1: 'HEADING_1',
    H2: 'HEADING_2',
    H3: 'HEADING_3',
    H4: 'HEADING_4',
    H5: 'HEADING_5',
    H6: 'HEADING_6',
  };

  type StyleCtx = { bold?: boolean; italic?: boolean; underline?: boolean; link?: string | null };

  const mergeCtx = (base: StyleCtx, extra: StyleCtx): StyleCtx => ({
    bold: base.bold || extra.bold,
    italic: base.italic || extra.italic,
    underline: base.underline || extra.underline,
    link: extra.link ?? base.link ?? null,
  });

  const processInline = (node: Node, ctx: StyleCtx) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').replace(/\s+/g, ' ');
      if (!text) return;
      const start = currentIndex;
      insertText(text);
      applyTextStyle(start, currentIndex, ctx);
      return;
    }

    if (!(node instanceof HTMLElement)) return;

    const tag = node.tagName.toUpperCase();
    let nextCtx: StyleCtx = { ...ctx };

    if (tag === 'STRONG' || tag === 'B') nextCtx = mergeCtx(nextCtx, { bold: true });
    if (tag === 'EM' || tag === 'I') nextCtx = mergeCtx(nextCtx, { italic: true });
    if (tag === 'U') nextCtx = mergeCtx(nextCtx, { underline: true });
    if (tag === 'A') nextCtx = mergeCtx(nextCtx, { link: node.getAttribute('href') });
    if (tag === 'CODE' || tag === 'KBD' || tag === 'SAMP') {
      // Keep plain text; optionally could set monospace via weightedFontFamily, omitted for compatibility
    }

    Array.from(node.childNodes).forEach((child) => processInline(child, nextCtx));
  };

  const processBlock = (el: HTMLElement, opts?: { listType?: 'UL' | 'OL' }) => {
    const tag = el.tagName.toUpperCase();

    if (tag === 'BR') {
      insertText('\n');
      return;
    }

    if (tag === 'UL' || tag === 'OL') {
      Array.from(el.children).forEach((li) => processBlock(li as HTMLElement, { listType: tag as 'UL' | 'OL' }));
      return;
    }

    if (tag === 'LI') {
      const start = currentIndex;
      Array.from(el.childNodes).forEach((child) => processInline(child, {}));
      // Ensure line break at end of list item
      if (!el.textContent?.endsWith('\n')) insertText('\n');
      const end = currentIndex;
      makeBullets(start, end, opts?.listType === 'OL' ? 'NUMBERED_DECIMAL_ALPHA_ROMAN' : 'BULLET_DISC_CIRCLE_SQUARE');
      return;
    }

    const start = currentIndex;

    if (tag in headingMap) {
      Array.from(el.childNodes).forEach((child) => processInline(child, {}));
      if (!el.textContent?.endsWith('\n')) insertText('\n');
      const end = currentIndex;
      applyParagraphStyle(start, end, headingMap[tag]);
      return;
    }

    if (tag === 'P' || tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'PRE') {
      Array.from(el.childNodes).forEach((child) => processInline(child, {}));
      if (!el.textContent?.endsWith('\n')) insertText('\n');
      return;
    }

    // Fallback: process children
    Array.from(el.childNodes).forEach((child) => {
      if (child instanceof HTMLElement) {
        processBlock(child, opts);
      } else {
        processInline(child, {});
      }
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

  Array.from(container.children).forEach((child) => processBlock(child as HTMLElement));

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

  const { data, error } = await supabase.functions.invoke('exchange-code-for-tokens', {
    body: { code, clientId },
  });

  if (error) {
    throw new Error(`토큰 교환 실패: ${error.message || error}`);
  }

  const access_token = (data as any)?.access_token as string | undefined;
  const refresh_token = (data as any)?.refresh_token as string | undefined;
  if (!access_token)
    throw new Error('올바른 토큰 응답을 받지 못했습니다.');

  return { accessToken: access_token, refreshToken: refresh_token };
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
  const formattingRequests = htmlToDocsRequests(htmlContent);
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
