
import { Reading } from '@/types';

const WEBHOOK_URL = 'https://hook.eu2.make.com/8fj69eg79sbcssao26zgtxd1360pd1rq';

export const sendWebhookData = async (payload: { readings?: Reading[]; chat?: string; timestamp: number }) => {
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  
  return await response.text();
};
