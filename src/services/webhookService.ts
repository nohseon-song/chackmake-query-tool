import { Reading } from '@/types';
import { supabase } from '@/integrations/supabase/client';

export const sendWebhookData = async (
  payload: { readings?: Reading[]; chat?: string; timestamp: number } & Record<string, any>
) => {
  const wrappedPayload = { ...payload } as any;
  if (wrappedPayload.readings) {
    wrappedPayload.readings = wrappedPayload.readings.map((r: any) => {
      const { id, ...rest } = r;
      return rest;
    });
  }

  // [ ✨ 핵심 수정 ✨ ] 
  // Supabase의 공식 함수 호출 방식인 'invoke'를 사용합니다.
  // 이 방식은 데이터를 보낼 때(body가 있을 때) 자동으로 POST 방식을 사용해서
  // 우리가 겪은 'GET' 에러가 절대 발생하지 않습니다.
  const { data, error } = await supabase.functions.invoke('send-webhook-to-make', {
    body: wrappedPayload,
  });

  if (error) {
    console.error("Supabase function invocation error:", error);
    throw error;
  }
  
  return data;
};
