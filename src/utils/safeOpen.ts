// src/utils/safeOpen.ts
export function safeOpenNewTab(url: string) {
  // 미리보기/샌드박스 여부 (iframe 안인지)
  const inIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();

  // 항상 새 탭으로만 연다 (top-navigation 금지)
  const w = window.open('about:blank', '_blank', 'noopener,noreferrer');
  if (!w) {
    // 팝업 차단 안내
    try {
      // @ts-ignore - toast might not be available globally
      window?.toast?.error?.('팝업이 차단되었습니다. 브라우저에서 팝업 허용 후 다시 시도해주세요.');
    } catch { /* no-op */ }
    alert('팝업이 차단되었습니다. 브라우저에서 팝업 허용 후 다시 시도해주세요.');
    return;
  }

  // 보안상 상호 참조 금지
  try { (w as any).opener = null; } catch { /* no-op */ }

  // 샌드박스/미리보기 여부와 무관하게 새 탭 내에서만 URL 이동
  try { 
    w.location.replace(url); 
  } catch {
    // 혹시 replace가 막히면 href로
    try { 
      w.location.href = url; 
    } catch {
      // 최후의 fallback: 링크를 구성해 강제 클릭
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
      w.close();
    }
  }
}