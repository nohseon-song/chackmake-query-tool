import { supabase } from '@/integrations/supabase/client';

export const sendWebhookData = async (payload: any): Promise<string> => {
  try {
    // 1. Supabase에 'get-webhook-url' 함수를 호출해서 Make.com의 진짜 웹훅 주소를 안전하게 물어봅니다.
    const { data, error: urlError } = await supabase.functions.invoke('get-webhook-url');
    if (urlError) {
      throw new Error(`웹훅 주소를 가져오지 못했습니다: ${urlError.message}`);
    }
    const webhookUrl = data?.webhookUrl;
    if (!webhookUrl) {
      throw new Error('Supabase로부터 유효한 웹훅 주소를 받지 못했습니다.');
    }

    // 2. 받아온 진짜 주소로 데이터를 직접 전송하고, 응답을 끝까지 기다립니다.
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Make.com에서 오류가 발생했습니다: ${response.status} - ${errorText}`);
    }

    // 3. Make.com이 보내준 최종 결과물(HTML)을 그대로 반환합니다.
    const responseText = await response.text();
    return responseText;

  } catch (error) {
    console.error("sendWebhookData 에러:", error);
    throw error;
  }
};
