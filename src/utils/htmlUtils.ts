import DOMPurify from 'dompurify';
import { LogEntry } from '@/types';

// HTML 콘텐츠 결합 유틸리티 - 안전한 속성 접근으로 수정
export const getCombinedHtml = (log: LogEntry) => {
  // log가 undefined이거나 null인 경우 처리
  if (!log) {
    console.warn('getCombinedHtml: log is undefined or null');
    return '';
  }

  // 안전한 속성 접근을 위한 null check
  const parts = [
    log.diagnosis_summary_html?.toString() || '',
    log.complementary_summary_html?.toString() || '',
    log.precision_verification_html?.toString() || '',
    log.final_summary_html?.toString() || ''
  ].filter(part => part && part.trim() !== '');
  
  // content가 undefined인 경우를 처리
  const fallbackContent = log.content?.toString() || '';
  const html = parts.length > 0 ? parts.join('') : fallbackContent;
  
  return DOMPurify.sanitize(html);
};
