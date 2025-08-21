import { supabase } from '@/integrations/supabase/client';

export const sendWebhookData = async (payload: any): Promise<string> => {
  try {
    // 1. Supabase에서 Make.com의 진짜 웹훅 주소를 안전하게 가져옵니다.
    const { data: webhookUrl, error: urlError } = await supabase.functions.invoke('get-webhook-url');
    if (urlError) throw new Error(`웹훅 주소를 가져오지 못했습니다: ${urlError.message}`);
    if (!webhookUrl) throw new Error('웹훅 주소가 비어있습니다.');

    // 2. 가져온 주소로 데이터를 직접 전송하고, 응답을 끝까지 기다립니다.
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

    const responseText = await response.text();
    return responseText;

  } catch (error) {
    console.error("sendWebhookData 에러:", error);
    throw error;
  }
};
