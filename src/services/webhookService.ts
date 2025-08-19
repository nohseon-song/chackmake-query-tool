import { supabase } from '@/integrations/supabase/client';

export const sendWebhookDataStream = async (
  payload: any,
  onData: (data: string) => void,
  onError: (error: string) => void
) => {
  const token = (await supabase.auth.getSession()).data.session?.access_token;

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-webhook-to-make`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.body) {
    onError("Streaming response not available.");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // 마지막 불완전한 라인은 버퍼에 남김

    for (const line of lines) {
      if (line.trim() === '') continue;
      try {
        const json = JSON.parse(line);
        if (json.type === 'final' && json.data) {
          onData(json.data);
        } else if (json.type === 'error') {
          onError(json.message);
        }
        // 'ping' 타입은 무시
      } catch (e) {
        console.warn('Failed to parse stream line:', line);
      }
    }
  }
};
