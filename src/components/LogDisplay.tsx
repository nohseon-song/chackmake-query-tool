
import React from 'react';

interface LogEntry {
  id: string;
  tag: string;
  content: string;
  isResponse?: boolean;
  timestamp: number;
}

interface LogDisplayProps {
  logs: LogEntry[];
  isDark: boolean;
}

const LogDisplay: React.FC<LogDisplayProps> = ({ logs, isDark }) => {
  if (logs.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      {logs.map((log) => (
        <div
          key={log.id}
          className={`p-3 rounded-lg text-sm ${
            log.isResponse
              ? `border-l-4 border-blue-500 ${isDark ? 'bg-gray-800' : 'bg-white'}`
              : `${isDark ? 'bg-gray-800' : 'bg-white'}`
          } shadow-sm`}
        >
          <div className="font-medium mb-1">{log.tag}</div>
          <pre className="whitespace-pre-wrap text-xs">{log.content}</pre>
        </div>
      ))}
    </div>
  );
};

export default LogDisplay;
