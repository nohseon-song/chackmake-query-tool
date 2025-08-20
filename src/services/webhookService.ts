// src/services/webhookService.ts

import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

export const sendWebhookRequest = async (payload: any): Promise<string> => {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) {
    throw new Error("인증 토큰이 없습니다. 다시 로그인해주세요.");
  }

  const requestId = uuidv4();
  // 여기서 request_id만 추가하고, organization_id는 더 이상 추가하지 않습니다.
  const payloadWithId = { ...payload, request_id: requestId };

  console.log('Sending webhook request with ID:', requestId);
  console.log('Final Payload:', payloadWithId);

  // Supabase Edge Function을 직접 호출
  const { data, error } = await supabase.functions.invoke('send-webhook-to-make', {
    body: payloadWithId,
  });

  if (error) {
    console.error('Webhook error:', error);
    // Edge Function에서 반환된 구체적인 에러 메시지를 포함하도록 수정
    const errorMessage = data?.error || error.message;
    throw new Error(`서버 응답 오류: ${errorMessage}`);
  }

  console.log('Webhook response:', data);
  return requestId;
};
