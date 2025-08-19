// src/services/webhookService.ts

import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid'; // 방금 설치한 도구를 가져옵니다.

// 이 함수는 이제 고유한 요청 ID를 생성하고,
// Make.com으로 요청을 보낸 뒤 그 ID를 반환하는 역할만 합니다.
export const sendWebhookRequest = async (payload: any): Promise<string> => {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) {
    throw new Error("인증 토큰이 없습니다. 다시 로그인해주세요.");
  }

  const requestId = uuidv4(); // 고유한 요청 ID를 여기서 생성합니다.
  const payloadWithId = { ...payload, request_id: requestId };

  // Supabase Edge Function을 통해 Make.com으로 요청을 보냅니다.
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-webhook-to-make`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payloadWithId),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`서버 응답 오류: ${response.status} - ${errorText}`);
  }

  // 성공적으로 요청을 보냈으면, 우리가 만든 고유 ID를 반환합니다.
  return requestId;
};
