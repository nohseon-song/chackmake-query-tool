import React from 'react';
import DOMPurify from 'dompurify';

/**
 * Secure HTML rendering component that always sanitizes content with DOMPurify
 * Use this instead of dangerouslySetInnerHTML to prevent XSS attacks
 */
interface SecureHtmlProps {
  html: string;
  className?: string;
  id?: string;
}

export const SecureHtml: React.FC<SecureHtmlProps> = ({ html, className, id }) => {
  const sanitizedHtml = DOMPurify.sanitize(html);
  
  return (
    <div 
      id={id}
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

/**
 * Hook to safely sanitize HTML strings
 */
export const useSanitizedHtml = (html: string): string => {
  return React.useMemo(() => DOMPurify.sanitize(html), [html]);
};
