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

  const { data, error } = await supabase.functions.invoke('send-webhook-to-make', {
    body: wrappedPayload,
  });

  if (error) {
    console.error("Supabase function invocation error:", error);
    const msg = typeof error.message === 'string' ? error.message : 'Unknown error';
    throw new Error(`Failed to invoke webhook function: ${msg}`);
  }
  
  // [ ✨ 여기가 핵심 수정 포인트! ✨ ]
  // Supabase가 보낸 JSON 상자(data)를 열어서
  // 그 안에 있는 진짜 내용물(data.data)만 꺼내서 반환한다.
  // 이렇게 하면 너의 소중한 문서 생성 코드는 예전처럼 순수한 HTML만 받게 돼.
  if (data && data.data) {
    return data.data;
  }

  // 만약의 경우를 대비해, 예전 방식의 데이터도 처리
  return data;
};
