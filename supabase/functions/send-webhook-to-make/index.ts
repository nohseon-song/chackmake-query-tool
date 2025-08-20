// supabase/functions/send-webhook-to-make/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 앱에서 보낸 payload를 그대로 받습니다.
    // 여기에는 'delivery_webhook_url'이 포함되어 있습니다.
    const payload = await req.json();

    const webhookUrl = Deno.env.get('MAKE_WEBHOOK_URL');
    if (!webhookUrl) {
      throw new Error('MAKE_WEBHOOK_URL이 설정되지 않았습니다.');
    }

    // payload를 그대로 Make.com으로 전달합니다.
    const makeResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!makeResponse.ok) {
      const errorBody = await makeResponse.text();
      throw new Error(`Make.com 웹훅 오류: ${errorBody}`);
    }

    // Make.com의 초기 응답("Accepted")을 JSON 형식으로 바꿔서 앱에 전달합니다.
    const responseText = await makeResponse.text();
    const responseData = { status: responseText };
    
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Edge Function Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
