// 완전 재작성: PDF와 시각적으로 동일한 가독성/구조를 위한 변환 엔진
const convertHtmlToGoogleDocsRequests = (htmlContent: string): any[] => {
  const requests: any[] = [];
  let currentIndex = 1;

  // 줄바꿈 중복 방지 플래그
  let lastWasNewline = false;
  // h3 → p 사이 간격 예외 처리를 위한 이전 블록 태그 기억
  let prevBlockTag: string | null = null;

  // 블록 태그 판별
  const BLOCK_TAGS = new Set([
    'p', 'div', 'section', 'article', 'header', 'footer', 'aside', 'main',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote', 'ul', 'ol', 'li'
  ]);

  // 0. HTML에서 숨겨진 JSON 먼저 추출
  const jsonRegex = /<script\s+type=["']application\/json["']>([\s\S]*?)<\/script>|({[\s\S]*?"precision_verification_html"[\s\S]*?})/i;
  const jsonMatch = htmlContent.match(jsonRegex);
  let precisionHtml = '';
  let summaryText = '';
  let cleanHtml = htmlContent;

  if (jsonMatch) {
    cleanHtml = htmlContent.replace(jsonRegex, '');
    const jsonString = jsonMatch[1] || jsonMatch[2];
    try {
      const jsonData = JSON.parse(jsonString);
      precisionHtml = jsonData.precision_verification_html || '';
      summaryText = jsonData.final_summary_text || '';
    } catch (e) {
      console.warn('숨겨진 JSON 파싱 실패:', e);
    }
  }

  const parser = new DOMParser();

  // 유틸: 텍스트 삽입
  const insertText = (text: string) => {
    if (!text) return;
    // NBSP → space, 캐리지리턴 제거
    const normalized = text.replace(/\u00A0/g, ' ').replace(/\r/g, '');
    if (!normalized) return;
    requests.push({ insertText: { location: { index: currentIndex }, text: normalized } });
    currentIndex += normalized.length;
    lastWasNewline = /\n$/.test(normalized);
  };

  // 유틸: 필요 시 블록 시작 전 정확히 1개의 줄바꿈 보장
  const ensureLeadingGapForBlock = (currentTag: string) => {
    if (currentIndex === 1) {
      lastWasNewline = false;
      return;
    }
    const suppress = prevBlockTag === 'h3' && currentTag === 'p'; // h3 → p 사이 추가 간격 없음
    if (suppress) return;
    if (!lastWasNewline) {
      insertText('\n');
    }
  };

  // 유틸: 블록 기본 텍스트 스타일(폰트 크기/굵기/글꼴) 적용
  const applyBlockBaseTextStyle = (start: number, end: number, tag: string) => {
    let textStyle: any = {};
    const fields: string[] = [];

    const lower = tag.toLowerCase();
    if (lower === 'h1') {
      textStyle.fontSize = { magnitude: 20, unit: 'PT' };
      textStyle.bold = true;
      fields.push('fontSize', 'bold');
    } else if (lower === 'h2') {
      textStyle.fontSize = { magnitude: 16, unit: 'PT' };
      textStyle.bold = true;
      fields.push('fontSize', 'bold');
    } else if (['h3', 'h4', 'h5', 'h6'].includes(lower)) {
      textStyle.fontSize = { magnitude: 14, unit: 'PT' };
      textStyle.bold = true;
      fields.push('fontSize', 'bold');
    } else if (lower === 'pre') {
      textStyle.fontSize = { magnitude: 10, unit: 'PT' };
      textStyle.weightedFontFamily = { fontFamily: 'Courier New' };
      fields.push('fontSize', 'weightedFontFamily');
    } else {
      textStyle.fontSize = { magnitude: 10, unit: 'PT' };
      fields.push('fontSize');
    }

    requests.push({
      updateTextStyle: {
        range: { startIndex: start, endIndex: end },
        textStyle,
        fields: fields.join(','),
      },
    });
  };

  // 유틸: 목록 서식 적용 (ul/ol 내부 li에만)
  const applyListIfNeeded = (el: HTMLElement, start: number, end: number) => {
    if (el.tagName.toLowerCase() !== 'li') return;
    const parent = el.parentElement;
    if (!parent) return;
    const pt = parent.tagName.toLowerCase();
    if (pt !== 'ul' && pt !== 'ol') return;

    const bulletPreset =
      pt === 'ul' ? 'BULLET_DISC_CIRCLE_SQUARE' : 'NUMBERED_DECIMAL_ALPHA_ROMAN';

    requests.push({
      createParagraphBullets: {
        range: { startIndex: start, endIndex: end },
        bulletPreset,
      },
    });
  };

  // 인라인 처리: 굵게만 선별적으로 적용
  const processInline = (node: Node, inherited: { bold?: boolean } = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.textContent ?? '';
      if (!raw) return;

      // 텍스트 노드 내 연속 줄바꿈 축소(안전)
      const text = raw.replace(/\u00A0/g, ' ').replace(/\r/g, '');
      if (!text) return;

      const start = currentIndex;
      insertText(text);
      if (inherited.bold) {
        requests.push({
          updateTextStyle: {
            range: { startIndex: start, endIndex: currentIndex },
            textStyle: { bold: true },
            fields: 'bold',
          },
        });
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      // br: 여러 개 연속되면 하나로 축소
      if (tag === 'br') {
        if (!lastWasNewline) insertText('\n');
        return;
      }

      const nextInherited = { ...inherited };
      if (tag === 'strong' || tag === 'b') nextInherited.bold = true;

      el.childNodes.forEach((child) => processInline(child, nextInherited));
    }
  };

  // 블록 요소 처리
  const processBlock = (el: HTMLElement) => {
    const tag = el.tagName.toLowerCase();

    // 빈 문단/연속 공백 축소: 내용이 없으면 스킵
    const onlyWhitespaceOrEmpty = !el.textContent || el.textContent.replace(/\u00A0/g, ' ').trim() === '';
    if (onlyWhitespaceOrEmpty) {
      // 다수의 빈 p/div가 와도 최대 한 줄만 허용하고 싶다면 여기서 조정 가능
      return;
    }

    // 블록 시작 간격(예외: h3 → p)
    ensureLeadingGapForBlock(tag);

    const start = currentIndex;

    // 목록 컨테이너는 직접 텍스트를 갖지 않고 li만 처리
    if (tag === 'ul' || tag === 'ol') {
      Array.from(el.children).forEach((child) => {
        if ((child as HTMLElement).tagName.toLowerCase() === 'li') {
          processBlock(child as HTMLElement);
        }
      });
    } else {
      // 일반 블록: 인라인 처리
      el.childNodes.forEach((child) => processInline(child));

      const end = currentIndex;
      if (end > start) {
        // 블록 기본 텍스트 스타일(폰트/굵기/글꼴)
        applyBlockBaseTextStyle(start, end, tag);
        // li면 목록 서식 적용(ul/ol 내부에서만)
        applyListIfNeeded(el, start, end);
      }
    }

    prevBlockTag = tag;
  };

  // 컨테이너(문서 어떤 깊이에서도)에서 블록들을 순서대로 방문
  const walkContainer = (parent: Node) => {
    parent.childNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        if (tag === 'ul' || tag === 'ol') {
          processBlock(el);
        } else if (BLOCK_TAGS.has(tag)) {
          processBlock(el);
        } else {
          // 블록이 아닌 경우, 내부에서 블록을 계속 탐색
          walkContainer(el);
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        // body 직속 텍스트는 임시 p로 래핑 처리
        const text = (node.textContent ?? '').replace(/\u00A0/g, ' ');
        if (text.trim()) {
          const p = document.createElement('p');
          p.textContent = text;
          processBlock(p);
        }
      }
    });
  };

  // 1) 메인 HTML 처리
  const mainDoc = parser.parseFromString(cleanHtml, 'text/html');
  walkContainer(mainDoc.body);

  // 2) precision_verification_html 처리
  if (precisionHtml) {
    const precisionDoc = parser.parseFromString(`<div>${precisionHtml}</div>`, 'text/html');
    walkContainer(precisionDoc.body);
  }

  // 3) final_summary_text 처리
  if (summaryText && summaryText.trim()) {
    const p = document.createElement('p');
    p.textContent = summaryText;
    processBlock(p);
  }

  return requests;
};