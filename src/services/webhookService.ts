import { Reading } from '@/types';

let WEBHOOK_URL = '';

const getWebhookUrl = async () => {
  if (WEBHOOK_URL) return WEBHOOK_URL;

  try {
    const response = await fetch('https://rigbiqjmszdlacjdkhep.supabase.co/functions/v1/get-webhook-url', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw`,
            'apikey': `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ2JpcWptc3pkbGFjamRraGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNjc2NjcsImV4cCI6MjA2NDk0MzY2N30.d2qfGwW5f2mg5X1LRzeVLdrvm-MZbQFUCmM0O_ZcDMw`,
        },
    });
    if (!response.ok) throw new Error('Webhook URL을 가져오는데 실패했습니다.');
    const data = await response.json();
    WEBHOOK_URL = data.webhookUrl;
    return WEBHOOK_URL;
  } catch (error) {
    console.error(error);
    return '';
  }
}

export const sendWebhookData = async (
  payload: { readings?: Reading[]; chat?: string; timestamp: number } & Record<string, any>
) => {
  const url = await getWebhookUrl();
  if (!url) {
    throw new Error('Webhook URL이 설정되지 않았습니다.');
  }

  // Wrap expert profile variables if present
  const wrappedPayload = { ...payload } as any;
  const candidateKeys = ['expert_profile_html', 'expert_profile', 'expertProfile'];
  for (const key of candidateKeys) {
    const val = wrappedPayload[key];
    if (typeof val === 'string' && val.trim()) {
      const alreadyWrapped = /class=["']expert-profile["']/.test(val);
      const wrapped = alreadyWrapped ? val : `<div class="expert-profile">${val}</div>`;
      wrappedPayload[key] = wrapped; // replace in-place
      wrappedPayload[`${key}_html`] = wrapped; // also provide *_html variant for Make.com
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(wrappedPayload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Webhook 호출 실패');
  }

  return await response.text();
};