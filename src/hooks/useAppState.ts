// src/hooks/useAppState.ts

import { useState } from 'react';

function useAppState() {
    const [logs, setLogs] = useState<any[]>([]);
    const [reportContent, setReportContent] = useState<string>('');
    const [isDownloadReady, setIsDownloadReady] = useState<boolean>(false);
    const [processingMessage, setProcessingMessage] = useState<string>('');

    return {
        logs,
        setLogs,
        reportContent,
        setReportContent,
        isDownloadReady,
        setIsDownloadReady,
        processingMessage
    };
}

export default useAppState; // useAppState 훅을 내보냅니다.
