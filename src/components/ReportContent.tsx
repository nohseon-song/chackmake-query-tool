
import React from 'react';
import { LogEntry } from '@/types';
import { getCombinedHtml } from '@/utils/htmlUtils';

interface ReportContentProps {
  logs: LogEntry[];
}

const ReportContent: React.FC<ReportContentProps> = ({ logs }) => {
  return (
    <>
      {logs.map((log) => (
        <div 
          key={log.id} 
          className="mt-4 report-content"
          dangerouslySetInnerHTML={{ __html: getCombinedHtml(log) }}
        />
      ))}
    </>
  );
};

export default ReportContent;
