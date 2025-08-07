
import { Reading } from '@/types';

// Supabase에서 Webhook URL 가져오기
const fetchWebhookUrl = async (): Promise<string> => {
  try {
    const response = await fetch('https://rigbiqjmszdlacjdkhep.supabase.co/functions/v1/get-webhook-url', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw`,
        'apikey': `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch webhook URL from Supabase');
    }

    const data = await response.json();
    if (data.success && data.webhookUrl) {
      return data.webhookUrl;
    } else {
      throw new Error('Webhook URL not found in response');
    }
  } catch (error) {
    console.error('Error fetching webhook URL:', error);
    // Fallback URL (임시적으로 유지)
    return 'https://hook.eu2.make.com/8fj69eg79sbcssao26zgtxd1360pd1rq';
  }
};

export const sendWebhookData = async (payload: { readings?: Reading[]; chat?: string; timestamp: number }) => {
  const webhookUrl = await fetchWebhookUrl();
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  
  return await response.text();
};
