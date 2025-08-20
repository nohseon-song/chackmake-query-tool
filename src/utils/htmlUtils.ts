import DOMPurify from 'dompurify';
import { LogEntry } from '@/types';
import { marked } from 'marked';

// HTML 콘텐츠 결합 유틸리티 (원본 코드로 복구)
export const getCombinedHtml = (log: LogEntry) => {
  // 우선 순위: markdown_content → HTML 조각들 → content
  if (log.markdown_content && log.markdown_content.trim() !== '') {
    const rawHtml = marked.parse(log.markdown_content);
    return DOMPurify.sanitize(typeof rawHtml === 'string' ? rawHtml : String(rawHtml));
  }

  const parts = [
    log.diagnosis_summary_html || '',
    log.complementary_summary_html || '',
    log.precision_verification_html || '',
    log.final_summary_html || ''
  ].filter(part => part.trim() !== '');
  
  const html = parts.length > 0 ? parts.join('') : log.content;
  return DOMPurify.sanitize(html);
};
