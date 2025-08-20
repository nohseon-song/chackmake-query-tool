// src/services/webhookService.ts

import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

export const sendWebhookRequest = async (payload: any): Promise<string> => {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) {
    throw new Error("인증 토큰이 없습니다. 다시 로그인해주세요.");
  }

  const requestId = uuidv4();
  const payloadWithId = { ...payload, request_id: requestId };

  // Supabase Edge Function을 직접 호출
  const { error } = await supabase.functions.invoke('send-webhook-to-make', {
    body: payloadWithId,
  });

  if (error) {
    throw new Error(`서버 응답 오류: ${error.message}`);
  }

  return requestId;
};
