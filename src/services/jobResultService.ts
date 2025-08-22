export const pollJobResult = (
  jobId: string,
  onUpdate: (html?: string, htmlUrl?: string) => void,
  onError: (message: string) => void
): (() => void) => {
  let isPolling = true;
  let pollCount = 0;
  const maxPolls = 45; // 3분 (4초 * 45회)
  const pollInterval = 4000; // 4초
  const retryDelay = 5000; // 5초

  const SUPABASE_URL = "https://rigbiqjmszdlacjdkhep.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw";

  const pollOnce = async (): Promise<void> => {
    if (!isPolling) return;

    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/job_results?job_id=eq.${jobId}&select=status,html,html_url,error_message,completed_at&limit=1`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
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
        
        if (result.status !== 'processing') {
          isPolling = false;
          
          if (result.status === 'done') {
            onUpdate(result.html, result.html_url);
            return;
          }
          
          if (result.error_message) {
            onError(result.error_message);
            return;
          }
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