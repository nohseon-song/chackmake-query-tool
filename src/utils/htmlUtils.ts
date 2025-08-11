import { LogEntry } from '@/types';

// HTML 콘텐츠 결합 유틸리티 (최종 수정)
export const getCombinedHtml = (log: LogEntry): string => {
  // 각 보고서 파트에서 HTML 태그를 모두 제거하고 순수 텍스트만 추출합니다.
  const stripHtml = (html: string | undefined | null): string => {
    if (!html) return '';
    // 복잡한 정규식 대신, 간단하게 태그를 제거하고 공백을 정리합니다.
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const parts = [
    stripHtml(log.diagnosis_summary_html),
    stripHtml(log.complementary_summary_html),
    // precision_verification_html은 JSON 형식이므로 별도 처리 필요
    // 여기서는 일단 제외하거나, 텍스트만 추출하는 로직을 추가해야 합니다.
    // stripHtml(log.precision_verification_html), 
    stripHtml(log.final_summary_html)
  ].filter(part => part && part.trim() !== '');

  // 각 파트를 두 줄의 공백으로 명확하게 구분하여 합칩니다.
  if (parts.length > 0) {
    return parts.join('\n\n');
  }

  // 대체 콘텐츠 역시 태그를 제거하여 일관성을 유지합니다.
  return stripHtml(log.content);
};