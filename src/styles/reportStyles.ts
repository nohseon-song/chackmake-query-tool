
export const getReportStyles = (isDark: boolean) => `
  .report-content h1 {
    font-size: 1.875rem;
    font-weight: 700;
    margin: 1.5rem 0 1rem 0;
    color: ${isDark ? '#ffffff' : '#1f2937'};
    line-height: 1.2;
  }
  
  .report-content h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 1.25rem 0 0.75rem 0;
    color: ${isDark ? '#e5e7eb' : '#374151'};
    line-height: 1.3;
  }
  
  .report-content h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem 0;
    color: ${isDark ? '#d1d5db' : '#4b5563'};
    line-height: 1.4;
  }
  
  .report-content p {
    margin: 0.75rem 0;
    line-height: 1.6;
    color: ${isDark ? '#f3f4f6' : '#1f2937'};
  }
  
  .report-content em {
    font-style: italic;
    color: ${isDark ? '#9ca3af' : '#6b7280'};
    font-size: 0.9rem;
  }
  
  .report-content strong {
    font-weight: 600;
    color: ${isDark ? '#ffffff' : '#111827'};
  }
  
  .report-content ul {
    margin: 1rem 0;
    padding-left: 1.5rem;
    list-style-type: disc;
  }
  
  .report-content li {
    margin: 0.5rem 0;
    line-height: 1.6;
    color: ${isDark ? '#f3f4f6' : '#1f2937'};
  }
  
  .report-content section {
    margin: 2rem 0;
    padding: 1rem 0;
  }
  
  .report-content article {
    max-width: none;
  }
  
  .report-content header {
    margin-bottom: 2rem;
    border-bottom: 1px solid ${isDark ? '#374151' : '#e5e7eb'};
    padding-bottom: 1rem;
  }
  
  .report-content footer {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid ${isDark ? '#374151' : '#e5e7eb'};
    font-size: 0.9rem;
    color: ${isDark ? '#9ca3af' : '#6b7280'};
  }
  
  .report-content pre {
    background: ${isDark ? '#1f2937' : '#f9fafb'};
    border: 1px solid ${isDark ? '#374151' : '#e5e7eb'};
    border-radius: 0.375rem;
    padding: 1rem;
    margin: 1rem 0;
    overflow-x: auto;
    white-space: pre-wrap;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
  }
`;
