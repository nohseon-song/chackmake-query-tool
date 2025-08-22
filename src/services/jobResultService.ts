export const pollJobResult = (
  jobId: string,
  onUpdate: (html: string) => void,
  onError: (message: string) => void
): (() => void) => {
  let isPolling = true;
  let pollCount = 0;
  const maxPolls = 600; // 30분 (3초 * 600회)
  const pollInterval = 3000; // 3초
  const retryDelay = 5000; // 5초

  const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw";

  const pollOnce = async (): Promise<void> => {
    if (!isPolling) return;

    try {
      const response = await fetch(
        `https://rigbiqjmszdlacjdkhep.supabase.co/rest/v1/job_results?select=job_id,status,html,error_message&job_id=eq.${jobId}`,
        {
          method: 'GET',
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.length === 1) {
        const result = data[0];
        
        if (result.status === 'done') {
          isPolling = false;
          onUpdate(result.html || '');
          return;
        }
        
        if (result.status === 'error') {
          isPolling = false;
          onError(result.error_message || '오류');
          return;
        }
      }
      
      // Continue polling for 'processing' status
      pollCount++;
      if (pollCount >= maxPolls) {
        isPolling = false;
        onError('처리 시간이 너무 오래 걸립니다. 나중에 다시 시도해 주세요.');
        return;
      }
      
      setTimeout(pollOnce, pollInterval);
      
    } catch (error) {
      console.error('Polling error:', error);
      
      // Network error - retry after 5 seconds
      if (isPolling) {
        setTimeout(pollOnce, retryDelay);
      }
    }
  };

  // Start polling
  setTimeout(pollOnce, pollInterval);

  // Return cleanup function
  return () => {
    isPolling = false;
  };
};