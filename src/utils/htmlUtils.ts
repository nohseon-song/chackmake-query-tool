import { LogEntry } from '@/types';

// HTML 콘텐츠 결합 유틸리티 (수정됨)
export const getCombinedHtml = (log: LogEntry): string => {
  const parts = [
    log.diagnosis_summary_html,
    log.complementary_summary_html,
    log.precision_verification_html,
    log.final_summary_html
  ]
  .filter(part => part && part.trim() !== ''); // null 또는 빈 문자열을 안전하게 필터링

  // 각 HTML 조각을 독립적인 <div>로 감싸서 구조를 보존합니다.
  // 이렇게 하면 각 파트가 가진 h1, p, ul 등의 구조가 서로에게 영향을 주지 않습니다.
  if (parts.length > 0) {
    return parts.map(part => `<div>${part}</div>`).join('');
  }

  // HTML 조각이 없는 경우, 기존의 content를 사용합니다.
  // 이 content도 구조를 가질 수 있으므로 div로 감싸주는 것이 안전합니다.
  return `<div>${log.content}</div>`;
};