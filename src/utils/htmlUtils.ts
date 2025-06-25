
import { LogEntry } from '@/types';

// HTML 콘텐츠 결합 유틸리티
export const getCombinedHtml = (log: LogEntry) => {
  const parts = [
    log.diagnosis_summary_html || '',
    log.complementary_summary_html || '',
    log.precision_verification_html || '',
    log.final_summary_html || ''
  ].filter(part => part.trim() !== '');
  
  return parts.length > 0 ? parts.join('') : log.content;
};
