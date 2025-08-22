import { supabase } from '@/integrations/supabase/client';
import { waitForJob } from './jobResultService';

export const sendWebhookData = async (payload: any): Promise<string> => {
  try {
    // Direct call to Supabase edge function
    const response = await fetch('https://rigbiqjmszdlacjdkhep.supabase.co/functions/v1/start-job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw'
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge function 오류: ${response.status} - ${errorText}`);
    }

    // Return the response from the edge function
    return await response.text();

  } catch (error) {
    console.error("sendWebhookData 에러:", error);
    throw error;
  }
};

export async function startJobAndWait(payload: any) {
  // 기존 sendWebhookData 함수 호출 (startJob 역할)
  const responseText = await sendWebhookData(payload);
  
  // Parse response to get job_id
  let jobId: string | null = null;
  try {
    const parsed = JSON.parse(responseText);
    if (parsed.job_id && parsed.status === 'processing') {
      jobId = parsed.job_id;
    }
  } catch (parseError) {
    console.warn('Failed to parse webhook response:', parseError);
  }
  
  if (!jobId) throw new Error('job_id 없음');

  const result = await waitForJob(jobId);
  return { 
    job_id: jobId, 
    status: result.status,
    html: result.html,
    html_url: result.html_url,
    error_message: result.error_message,
    completed_at: result.completed_at
  };
}
