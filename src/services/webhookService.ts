import { supabase } from '@/integrations/supabase/client';

export const sendWebhookData = async (payload: any): Promise<string> => {
  try {
    // Direct call to Supabase edge function
    const response = await fetch('https://rigbiqjmszdlacjdkhep.supabase.co/functions/v1/start-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge function 오류: ${response.status} - ${errorText}`);
    }

    // Return the response from the edge function
    return await response.text();

  } catch (error) {
    console.error("sendWebhookData 에러:", error);
    throw error;
  }
};
