
export const getReportStyles = (isDark: boolean) => `
  .report-content {
    page-break-inside: avoid;
    margin: 0;
    padding: 0;
  }
  
  .report-content h1 {
    font-size: 1.875rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
    color: ${isDark ? '#ffffff' : '#1f2937'};
    line-height: 1.2;
    page-break-after: avoid;
  }
  
  .report-content h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 1.25rem 0 0.75rem 0;
    color: ${isDark ? '#e5e7eb' : '#374151'};
    line-height: 1.3;
    page-break-after: avoid;
  }
  
  .report-content h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem 0;
    color: ${isDark ? '#d1d5db' : '#4b5563'};
    line-height: 1.4;
    page-break-after: avoid;
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
    margin: 1.5rem 0;
    padding: 0.5rem 0;
    page-break-inside: avoid;
  }
  
  .report-content article {
    max-width: none;
    margin: 0;
    padding: 0;
  }
  
  .report-content header {
    margin-bottom: 1.5rem;
    border-bottom: 1px solid ${isDark ? '#374151' : '#e5e7eb'};
    padding-bottom: 0.75rem;
    page-break-after: avoid;
  }
  
  .report-content footer {
    margin-top: 1.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid ${isDark ? '#374151' : '#e5e7eb'};
    font-size: 0.9rem;
    color: ${isDark ? '#9ca3af' : '#6b7280'};
    page-break-before: avoid;
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
    page-break-inside: avoid;
  }

  @media print {
    .report-content {
      margin: 0 !important;
      padding: 0 !important;
    }
    
    .report-content h1:first-child {
      margin-top: 0 !important;
      padding-top: 0 !important;
    }
  }
`;
